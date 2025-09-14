# 音视频编辑执行系统设计方案

## 概述

本文档详细描述了音视频编辑执行系统的架构设计。该系统允许用户通过编写JavaScript代码来执行音视频编辑操作，系统会自动将这些操作转换为配置，验证后通过批量命令系统执行。

## 设计目标

1. 提供安全的用户脚本执行环境
2. 支持通过JS代码调用音视频编辑操作
3. 自动生成和验证操作配置
4. 利用现有的BaseBatchCommand系统进行批量执行
5. 提供完善的错误处理和回滚机制

## 系统架构

### 整体执行流程

```
用户JS代码
    ↓
执行环境沙箱 (ScriptExecutor)
    ↓
函数执行 & 操作配置生成
    ↓
配置验证器 (ConfigValidator)
    ↓
批量命令构建器 (BatchCommandExecutor)
    ↓
BaseBatchCommand执行
    ↓
结果返回 & 状态更新
```

## 核心组件设计

### 1. ScriptExecutor - 脚本执行器

```typescript
/**
 * 脚本执行器 - 在沙箱环境中执行用户JS代码
 * 负责将用户函数调用转换为操作配置
 */
class ScriptExecutor {
  private operations: OperationConfig[] = []
  private api: ExecutionAPI

  constructor() {
    this.api = this.createExecutionAPI()
  }

  // 创建安全的API接口
  private createExecutionAPI(): ExecutionAPI {
    return {
      // 时间轴项目操作
      addTimelineItem: (item) => this.recordOperation('addTimelineItem', item),
      rmTimelineItem: (id) => this.recordOperation('rmTimelineItem', { timelineItemId: id }),
      mvTimelineItem: (id, position, trackId) =>
        this.recordOperation('mvTimelineItem', { timelineItemId: id, newPosition: position, newTrackId: trackId }),
      
      // 轨道操作
      addTrack: (type = 'video', position) => this.recordOperation('addTrack', { type, position }),
      rmTrack: (id) => this.recordOperation('rmTrack', { trackId: id }),
      renameTrack: (id, name) => this.recordOperation('renameTrack', { trackId: id, newName: name }),
      
      // 文本操作
      updateTextContent: (id, text, style) =>
        this.recordOperation('updateTextContent', { timelineItemId: id, newText: text, newStyle: style }),
      updateTextStyle: (id, style) =>
        this.recordOperation('updateTextStyle', { timelineItemId: id, newStyle: style }),
      
      // 关键帧操作
      createKeyframe: (id, position) =>
        this.recordOperation('createKeyframe', { timelineItemId: id, position }),
      deleteKeyframe: (id, position) =>
        this.recordOperation('deleteKeyframe', { timelineItemId: id, position }),
      updateKeyframeProperty: (id, position, property, value) =>
        this.recordOperation('updateKeyframeProperty', {
          timelineItemId: id, position, property, value
        }),
      clearAllKeyframes: (id) =>
        this.recordOperation('clearAllKeyframes', { timelineItemId: id }),
      
      // 其他操作
      splitTimelineItem: (id, position) =>
        this.recordOperation('splitTimelineItem', { timelineItemId: id, splitPosition: position }),
      cpTimelineItem: (id, position, trackId) =>
        this.recordOperation('cpTimelineItem', {
          timelineItemId: id, newPosition: position, newTrackId: trackId
        }),
      resizeTimelineItem: (id, timeRange) =>
        this.recordOperation('resizeTimelineItem', { timelineItemId: id, newTimeRange: timeRange }),
      updateTimelineItemTransform: (id, transform) =>
        this.recordOperation('updateTimelineItemTransform', { timelineItemId: id, newTransform: transform }),
      
      autoArrangeTrack: (id) => this.recordOperation('autoArrangeTrack', { trackId: id }),
      toggleTrackVisibility: (id, visible) =>
        this.recordOperation('toggleTrackVisibility', { trackId: id, visible }),
      toggleTrackMute: (id, muted) =>
        this.recordOperation('toggleTrackMute', { trackId: id, muted }),
    }
  }

  // 执行用户代码并生成操作配置 - 基于Web Worker的安全执行
  async executeScript(script: string): Promise<OperationConfig[]> {
    this.operations = []
    
    try {
      // 获取所有API方法
      const api = this.createExecutionAPI()
      
      // 使用Web Worker执行器
      const executor = this.createWebWorkerExecutor();
      
      // 注册所有API函数到Worker
      const fnMap = Object.keys(api).reduce((map, key) => {
        map[key] = api[key as keyof ExecutionAPI].toString();
        return map;
      }, {} as Record<string, string>);
      
      await executor.registerFunctions(fnMap);
      
      // 执行用户脚本
      const result = await executor.exec(`
        ${script}
        return {
          operations: operations,
          success: true
        };
      `, {});
      
      return result.operations || [];
      
    } catch (error) {
      throw new Error(`脚本执行失败: ${error.message}`)
    }
  }

  // 创建Web Worker执行器
  private createWebWorkerExecutor(defaultTimeout = 5000) {
    const workerCode = `
      const registry = {};
      self.onmessage = function (e) {
        const { id, type, name, fnStr, fnMap, code, args } = e.data;
        try {
          if (type === 'register') {
            registry[name] = eval('(' + fnStr + ')');
            self.postMessage({ id, result: true });
            return;
          }
          if (type === 'registerBatch') {
            for (let key in fnMap) {
              registry[key] = eval('(' + fnMap[key] + ')');
            }
            self.postMessage({ id, result: true });
            return;
          }
          if (type === 'exec') {
            const fn = new Function(...Object.keys(args), 'registry', code);
            const result = fn(...Object.values(args), registry);
            if (result instanceof Promise) {
              result
                .then(res => self.postMessage({ id, result: res }))
                .catch(err => self.postMessage({ id, error: err.message }));
            } else {
              self.postMessage({ id, result });
            }
            return;
          }
          throw new Error('Unknown message type: ' + type);
        } catch (err) {
          self.postMessage({ id, error: err.message });
        }
      };
    `;

    let worker: Worker;
    let workerUrl: string;
    let callbacks = new Map<string, {resolve: Function, reject: Function}>();
    
    const genId = () => Math.random().toString(36).slice(2);

    const initWorker = () => {
      if (worker) worker.terminate();
      if (workerUrl) URL.revokeObjectURL(workerUrl);
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      workerUrl = URL.createObjectURL(blob);
      worker = new Worker(workerUrl);
      
      worker.onmessage = (e) => {
        const { id, result, error } = e.data;
        const cb = callbacks.get(id);
        if (cb) {
          if (error) cb.reject(new Error(error));
          else cb.resolve(result);
          callbacks.delete(id);
        }
      };
    };

    initWorker();

    return {
      registerFunctions: async (fnMap: Record<string, string>) => {
        return new Promise((resolve, reject) => {
          const id = genId();
          callbacks.set(id, { resolve, reject });
          worker.postMessage({
            id,
            type: 'registerBatch',
            fnMap
          });
        });
      },

      exec: async (code: string, args: Record<string, any> = {}, timeout = defaultTimeout) => {
        return new Promise((resolve, reject) => {
          const id = genId();
          callbacks.set(id, { resolve, reject });
          
          worker.postMessage({
            id,
            type: 'exec',
            code,
            args
          });

          // 超时终止逻辑
          const timer = setTimeout(() => {
            if (callbacks.has(id)) {
              callbacks.get(id)?.reject(new Error(`执行超时(${timeout}ms)`));
              callbacks.delete(id);
              
              // 重建Worker
              initWorker();
            }
          }, timeout);
          
          // 超时完成时清除定时器
          const origResolve = resolve;
          const origReject = reject;
          callbacks.set(id, {
            resolve: (val: any) => {
              clearTimeout(timer);
              origResolve(val);
            },
            reject: (err: any) => {
              clearTimeout(timer);
              origReject(err);
            }
          });
        });
      },

      terminate: () => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        callbacks.clear();
      }
    };
  }
}
```

### 2. ConfigValidator - 配置验证器

```typescript
/**
 * 配置验证器 - 验证操作配置的合法性
 * 确保所有操作参数符合系统要求
 */
class ConfigValidator {
  validateOperations(operations: OperationConfig[]): ValidationResult {
    const errors: ValidationError[] = []
    const validOperations: OperationConfig[] = []

    for (const op of operations) {
      try {
        this.validateSingleOperation(op)
        validOperations.push(op)
      } catch (error) {
        errors.push({ operation: op, error: error.message })
      }
    }

    return { validOperations, errors }
  }

  private validateSingleOperation(op: OperationConfig) {
    switch (op.type) {
      case 'addTimelineItem':
        this.validateTimelineItemData(op.params)
        break
      case 'rmTimelineItem':
        this.validateTimelineItemId(op.params.timelineItemId)
        break
      // ... 其他操作类型的验证
    }
  }
}
```

### 3. BatchCommandExecutor - 批量命令执行器

```typescript
/**
 * 批量命令执行器 - 将操作配置转换为具体命令
 * 利用BaseBatchCommand进行批量执行
 */
class BatchCommandExecutor {
  constructor(
    private historyModule: UnifiedHistoryModule,
    private timelineModule: UnifiedTimelineModule,
    private webavModule: UnifiedWebavModule,
    private mediaModule: UnifiedMediaModule,
    private configModule: UnifiedConfigModule,
    private trackModule: UnifiedTrackModule,
    private selectionModule: UnifiedSelectionModule
  ) {}

  async executeOperations(operations: OperationConfig[]): Promise<ExecutionResult> {
    const batchBuilder = this.historyModule.startBatch('用户脚本批量操作')
    const results: OperationResult[] = []

    for (const op of operations) {
      try {
        const command = this.createCommandFromOperation(op)
        batchBuilder.addCommand(command)
        results.push({ success: true, operation: op })
      } catch (error) {
        results.push({ success: false, operation: op, error: error.message })
      }
    }

    if (batchBuilder.getCommandCount() > 0) {
      const batchCommand = batchBuilder.build()
      await this.historyModule.executeBatchCommand(batchCommand)
    }

    return { results }
  }

  private createCommandFromOperation(op: OperationConfig): SimpleCommand {
    switch (op.type) {
      case 'addTimelineItem':
        return new AddTimelineItemCommand(
          op.params,
          this.getTimelineModuleInterface(),
          this.getWebavModuleInterface(),
          this.getMediaModuleInterface(),
          this.getConfigModuleInterface()
        )
      case 'rmTimelineItem':
        return new RemoveTimelineItemCommand(
          op.params.timelineItemId,
          this.getTimelineModuleInterface(),
          this.getWebavModuleInterface(),
          this.getMediaModuleInterface(),
          this.getConfigModuleInterface()
        )
      // ... 其他命令创建
    }
  }
}
```

### 4. VideoEditExecutionSystem - 主执行系统

```typescript
/**
 * 音视频编辑执行系统 - 主协调器
 * 协调脚本执行、配置验证和命令执行的全流程
 */
class VideoEditExecutionSystem {
  private scriptExecutor = new ScriptExecutor()
  private configValidator = new ConfigValidator()
  private commandExecutor: BatchCommandExecutor

  constructor(modules: ExecutionModules) {
    this.commandExecutor = new BatchCommandExecutor(
      modules.historyModule,
      modules.timelineModule,
      modules.webavModule,
      modules.mediaModule,
      modules.configModule,
      modules.trackModule,
      modules.selectionModule
    )
  }

  async executeUserScript(script: string): Promise<ExecutionSummary> {
    // 第一阶段：执行JS代码生成配置
    const operations = await this.scriptExecutor.executeScript(script)
    
    // 第二阶段：验证配置合法性
    const validationResult = this.configValidator.validateOperations(operations)
    
    if (validationResult.errors.length > 0) {
      return {
        success: false,
        executedCount: 0,
        errorCount: validationResult.errors.length,
        errors: validationResult.errors
      }
    }

    // 第三阶段：执行批量命令
    const executionResult = await this.commandExecutor.executeOperations(
      validationResult.validOperations
    )

    return {
      success: executionResult.results.every(r => r.success),
      executedCount: executionResult.results.length,
      errorCount: executionResult.results.filter(r => !r.success).length,
      results: executionResult.results
    }
  }
}
```

## 类型定义

```typescript
// 操作配置接口
interface OperationConfig {
  type: string
  params: any
  timestamp: number
  id: string
}

// 执行结果接口
interface ExecutionResult {
  results: OperationResult[]
}

interface OperationResult {
  success: boolean
  operation: OperationConfig
  error?: string
}

interface ExecutionSummary {
  success: boolean
  executedCount: number
  errorCount: number
  results: OperationResult[]
  errors?: ValidationError[]
}

interface ValidationError {
  operation: OperationConfig
  error: string
}

interface ValidationResult {
  validOperations: OperationConfig[]
  errors: ValidationError[]
}
```

## 安全性设计

### 1. 沙箱执行环境
- 使用Function构造函数而非eval
- 限制作用域和访问权限
- 设置执行超时时间（例如30秒）

### 2. 操作限制
- 限制单次脚本最大操作数量（例如100个）
- 限制递归调用深度
- 禁止访问敏感API

### 3. 参数验证
- 所有输入参数类型检查
- 范围验证（如时间码格式、坐标范围等）
- 资源存在性验证

### 4. 错误隔离
- 单个操作失败不影响批量执行
- 详细的错误报告和日志记录
- 自动回滚机制

## 错误处理和回滚

```typescript
class ErrorRecovery {
  // 批量操作回滚
  async rollbackFailedBatch(batchCommand: BaseBatchCommand): Promise<void> {
    try {
      await batchCommand.undo()
      console.log('✅ 批量操作已成功回滚')
    } catch (rollbackError) {
      console.error('❌ 批量操作回滚失败:', rollbackError)
      // 需要人工干预的情况
    }
  }

  // 部分成功时的状态恢复
  async recoverPartialExecution(originalState: SystemState): Promise<void> {
    // 实现基于快照的状态恢复
  }
}
```

## 使用示例

### 用户JS代码示例 - 简洁语法
```javascript
// 用户编写的编辑脚本 - 直接调用函数，无需api.前缀

// 添加视频轨道
addTrack('video')

// 添加时间轴项目
addTimelineItem({
  mediaItemId: 'video-1',
  trackId: 'track-1',
  timeRange: {
    start: '00:00:00.00',
    end: '00:00:10.00'
  }
})

// 移动项目位置
mvTimelineItem('item-1', '00:00:05.00')

// 添加文本项目
addTimelineItem({
  mediaItemId: 'text-1',
  trackId: 'track-1',
  timeRange: {
    start: '00:00:02.00',
    end: '00:00:08.00'
  }
})

// 更新文本内容
updateTextContent('text-1', 'Hello World', {
  fontSize: 24,
  color: '#ff0000'
})

// 创建关键帧
createKeyframe('video-1', '00:00:05.00')

// 自动排列轨道
autoArrangeTrack('track-1')
```

### 系统调用示例
```typescript
// 创建执行系统实例
const executionSystem = new VideoEditExecutionSystem({
  historyModule: unifiedHistoryModule,
  timelineModule: unifiedTimelineModule,
  webavModule: unifiedWebavModule,
  mediaModule: unifiedMediaModule,
  configModule: unifiedConfigModule,
  trackModule: unifiedTrackModule,
  selectionModule: unifiedSelectionModule
})

// 执行用户脚本
const result = await executionSystem.executeUserScript(userScript)

// 处理执行结果
if (result.success) {
  console.log(`✅ 执行成功: ${result.executedCount}个操作`)
} else {
  console.log(`❌ 执行失败: ${result.errorCount}个错误`)
  result.errors.forEach(error => {
    console.error(`操作 ${error.operation.type} 失败: ${error.error}`)
  })
}
```

## 执行环境说明

### 函数调用方式
用户脚本中的函数调用会被自动映射到对应的API方法，例如：
```javascript
// 用户编写的代码
addTrack('video')
addTimelineItem({...})

// 实际执行时相当于
addTrack('video')
addTimelineItem({...})
```

### Web Worker安全性优势
- ✅ **完全隔离**: 用户脚本在独立的Worker线程中执行
- ✅ **计算限制**: 支持执行超时设置（默认5秒）
- ✅ **内存隔离**: Worker线程崩溃不会影响到主线程
- ✅ **自动恢复**: Worker异常后可自动重建
- ✅ **无全局污染**: 不会注入主线程的任何全局变量

### 执行流程
1. 创建Web Worker
2. 将API函数注册到Worker的registry中
3. 传递用户脚本到Worker执行
4. 接收执行结果
5. 处理超时和异常情况

## 集成现有系统

### 与BaseBatchCommand集成
- 直接使用现有的批量命令基类
- 重用撤销/重做功能
- 集成历史记录管理

### 与现有命令系统集成
- 使用现有的AddTimelineItemCommand、RemoveTimelineItemCommand等
- 保持命令接口一致性
- 重用参数验证逻辑

### 与模块系统集成
- 通过依赖注入方式集成各模块
- 保持模块接口的稳定性
- 支持模块的热替换

## 性能考虑

1. **批量执行优化**: 利用BaseBatchCommand的批量执行能力
2. **内存管理**: 及时清理临时配置和命令对象
3. **并发控制**: 避免同时执行多个用户脚本
4. **资源限制**: 监控CPU和内存使用情况

## 完整使用示例

### Web Worker执行器使用示例
```typescript
// 创建执行系统实例
const executionSystem = new VideoEditExecutionSystem({
  historyModule: unifiedHistoryModule,
  timelineModule: unifiedTimelineModule,
  webavModule: unifiedWebavModule,
  mediaModule: unifiedMediaModule,
  configModule: unifiedConfigModule,
  trackModule: unifiedTrackModule,
  selectionModule: unifiedSelectionModule
})

// 用户脚本示例
const userScript = `
// 添加音频轨道
addTrack('audio')

// 添加视频轨道
addTrack('video')

// 导入音频文件
addTimelineItem({
  mediaItemId: 'audio-1',
  trackId: 'audio-track-1',
  timeRange: {
    start: '00:00:00.00',
    end: '00:00:05.00'
  }
})

// 添加背景音乐
addTimelineItem({
  mediaItemId: 'music-1',
  trackId: 'audio-track-2',
  timeRange: {
    start: '00:00:00.00',
    end: '00:00:10.00'
  }
})

// 添加视频片段
addTimelineItem({
  mediaItemId: 'video-1',
  trackId: 'video-track-1',
  timeRange: {
    start: '00:00:00.00',
    end: '00:00:08.00'
  }
})

// 添加Logo
addTimelineItem({
  mediaItemId: 'logo-1',
  trackId: 'video-track-1',
  timeRange: {
    start: '00:00:00.00',
    end: '00:00:10.00'
  }
})

// 添加字幕
updateTextContent('text-1', '欢迎观看本视频', {
  fontSize: 24,
  color: '#ffffff',
  backgroundColor: 'rgba(0,0,0,0.5)',
  fontFamily: 'Arial'
})

// 自动排列轨道
autoArrangeTrack('video-track-1')
autoArrangeTrack('audio-track-1')

// 创建转场关键帧
createKeyframe('video-1', '00:00:02.00')
updateKeyframeProperty('video-1', '00:00:02.00', 'opacity', 0.8)
`

// 执行用户脚本（支持自定义超时时间，默认5秒）
const result = await executionSystem.executeUserScript(userScript)

// 处理执行结果
if (result.success) {
  console.log(`✅ 执行成功: ${result.executedCount}个操作`)
  console.log(`📊 操作详情:`)
  result.results.forEach((r, idx) => {
    console.log(`  ${idx + 1}. ${r.operation.type}: ${r.success ? '✅' : '❌'}`)
  })
} else {
  console.log(`❌ 执行失败: ${result.errorCount}个错误`)
  result.errors.forEach(error => {
    console.error(`  - ${error.operation.type}: ${error.error}`)
  })
}
```

## Web Worker优势总结

### 1. **安全性**
- Worker线程完全隔离，无法访问主线程的全局变量
- 支持设置执行超时时间
- 自动处理异常的Worker重建

### 2. **性能**
- 在用户脚本执行期间不会阻塞主线程UI
- 支持并发执行多个用户脚本
- 内存使用更加可控

### 3. **错误处理**
- Worker内部错误不会导致主线程崩溃
- 详细的错误信息和堆栈跟踪
- 支持异常重试机制

### 4. **超时控制**
```typescript
const executor = this.createWebWorkerExecutor(10000); // 设置10秒超时
const result = await executionSystem.executeUserScript(userScript);
```

## 扩展性设计

1. **插件系统**: 支持自定义操作类型
2. **脚本库**: 提供常用脚本模板
3. **调试工具**: 集成脚本调试和性能分析
4. **权限控制**: 支持不同用户的执行权限

## 总结

这个执行系统设计充分利用了现有的音视频编辑基础设施，提供了安全、高效的用户脚本执行能力。通过三阶段的执行流程（脚本执行→配置验证→批量执行），确保了系统的稳定性和可靠性，同时保持了良好的扩展性和维护性。
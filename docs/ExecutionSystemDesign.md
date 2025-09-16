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
批量命令构建器 (BatchCommandBuilder) → 构建批量命令
    ↓
VideoEditExecutionSystem → 执行批量命令
    ↓
结果返回 & 状态更新
```

## 核心组件设计

### 1. ScriptExecutor - 脚本执行器

ScriptExecutor采用一次性Web Worker设计，在沙箱环境中安全执行用户JavaScript代码。主要特性：

- **一次性使用**: 每次执行完成后自动清理Worker资源，避免内存泄漏
- **超时控制**: 支持自定义执行超时时间（默认5秒）
- **错误隔离**: Worker线程崩溃不会影响主线程
- **自动清理**: 执行完成或超时后自动终止Worker释放资源

执行流程：
1. 初始化Web Worker实例
2. 传递用户脚本到Worker执行
3. 接收执行结果并生成操作配置
4. 处理超时和异常情况
5. 自动清理Worker资源


### 2. ConfigValidator - 配置验证器

ConfigValidator负责验证操作配置的合法性，确保所有参数符合系统要求。主要特性：

- **全面验证**: 支持所有音视频编辑操作的参数验证
- **类型检查**: 严格的参数类型和格式验证
- **时间码验证**: 验证HH:MM:SS.FF格式的时间码
- **错误收集**: 批量收集所有验证错误，便于调试
- **性能优化**: 高效的验证流程，支持大批量操作验证

验证流程：
1. 接收操作配置数组
2. 逐个验证操作参数合法性
3. 收集验证错误和有效操作
4. 返回验证结果供后续处理

### 3. BatchCommandBuilder - 批量命令构建器

```typescript
/**
 * 批量命令构建器 - 将操作配置转换为具体命令
 * 专注于命令构建，不负责执行
 */
class BatchCommandBuilder {
  constructor(
    private historyModule: UnifiedHistoryModule,
    private timelineModule: UnifiedTimelineModule,
    private webavModule: UnifiedWebavModule,
    private mediaModule: UnifiedMediaModule,
    private configModule: UnifiedConfigModule,
    private trackModule: UnifiedTrackModule,
    private selectionModule: UnifiedSelectionModule
  ) {}

  buildOperations(operations: OperationConfig[]): {
    batchCommand: BaseBatchCommand,
    buildResults: OperationResult[]
  } {
    const batchBuilder = this.historyModule.startBatch('用户脚本批量操作')
    const buildResults: OperationResult[] = []

    for (const op of operations) {
      try {
        const command = this.createCommandFromOperation(op)
        batchBuilder.addCommand(command)
        buildResults.push({ success: true, operation: op })
      } catch (error) {
        buildResults.push({ success: false, operation: op, error: error.message })
      }
    }

    return {
      batchCommand: batchBuilder.build(),
      buildResults
    }
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
 * 协调脚本执行、配置验证、命令构建和命令执行的全流程
 */
class VideoEditExecutionSystem {
  private scriptExecutor = new ScriptExecutor()
  private configValidator = new ConfigValidator()
  private commandBuilder: BatchCommandBuilder

  constructor(modules: ExecutionModules) {
    this.commandBuilder = new BatchCommandBuilder(
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

    // 第三阶段：构建批量命令（由BatchCommandBuilder负责）
    const { batchCommand, buildResults } = this.commandBuilder.buildOperations(
      validationResult.validOperations
    )

    // 第四阶段：执行批量命令（由主执行系统控制）
    if (batchCommand.getCommandCount() > 0) {
      await this.historyModule.executeBatchCommand(batchCommand)
    }

    return {
      success: buildResults.every(r => r.success),
      executedCount: buildResults.length,
      errorCount: buildResults.filter(r => !r.success).length,
      results: buildResults
    }
  }
}
```

## 类型定义

```typescript
// 操作配置接口 - 简化版本，只保留核心字段
interface OperationConfig {
  type: string
  params: any
}

// 构建结果接口
interface BuildResult {
  batchCommand: BaseBatchCommand
  buildResults: OperationResult[]
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
用户脚本中的函数调用通过独立的ScriptExecutor.worker.ts处理，实际API映射逻辑在worker中实现。

#### 支持的API函数
- **时间轴项目操作**: `addTimelineItem()`, `rmTimelineItem()`, `mvTimelineItem()`
- **轨道操作**: `addTrack()`, `rmTrack()`, `renameTrack()`
- **文本操作**: `updateTextContent()`, `updateTextStyle()`
- **关键帧操作**: `createKeyframe()`, `deleteKeyframe()`, `updateKeyframeProperty()`, `clearAllKeyframes()`
- **其他操作**: `splitTimelineItem()`, `cpTimelineItem()`, `resizeTimelineItem()`, `updateTimelineItemTransform()`
- **轨道控制**: `autoArrangeTrack()`, `toggleTrackVisibility()`, `toggleTrackMute()`

### Web Worker安全性优势
- ✅ **完全隔离**: 用户脚本在独立的Worker线程中执行
- ✅ **计算限制**: 支持执行超时设置（默认5秒）
- ✅ **内存隔离**: Worker线程崩溃不会影响到主线程
- ✅ **自动清理**: 执行完成后自动终止Worker释放资源
- ✅ **无全局污染**: 不会注入主线程的任何全局变量

### 执行流程
1. 创建Web Worker实例
2. 传递用户脚本到Worker执行
3. 接收执行结果并生成操作配置
4. 处理超时和异常情况
5. 自动清理Worker资源

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

1. **职责分离**: BatchCommandBuilder专注于命令构建，VideoEditExecutionSystem控制执行
2. **批量执行优化**: 利用BaseBatchCommand的批量执行能力
3. **内存管理**: 及时清理临时配置和命令对象
4. **并发控制**: 避免同时执行多个用户脚本
5. **资源限制**: 监控CPU和内存使用情况

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
- 支持设置执行超时时间（默认5秒）
- 自动清理Worker资源，防止内存泄漏

### 2. **性能**
- 在用户脚本执行期间不会阻塞主线程UI
- 内存使用更加可控
- 一次性使用设计，避免资源占用

### 3. **错误处理**
- Worker内部错误不会导致主线程崩溃
- 详细的错误信息和超时提示
- 自动异常处理和资源清理

### 4. **超时控制**
```typescript
// 支持自定义超时时间
const operations = await scriptExecutor.executeScript(userScript, 10000); // 10秒超时
```

## 扩展性设计

1. **插件系统**: 支持自定义操作类型
2. **脚本库**: 提供常用脚本模板
3. **调试工具**: 集成脚本调试和性能分析
4. **权限控制**: 支持不同用户的执行权限

## 总结

这个执行系统设计充分利用了现有的音视频编辑基础设施，提供了安全、高效的用户脚本执行能力。ScriptExecutor采用简化的一次性Web Worker设计，自动处理资源清理和错误恢复。通过四阶段的执行流程（脚本执行→配置验证→命令构建→批量执行），并采用职责分离原则（BatchCommandBuilder专注于构建，VideoEditExecutionSystem控制执行），确保了系统的稳定性和可靠性，同时保持了良好的扩展性和维护性。
# 批量操作系统

## 📋 概述

批量操作系统为视频编辑器提供统一的多步骤操作管理，允许复杂的操作（如自动排列、批量删除）作为单个历史记录进行撤销/重做。系统基于命令模式设计，支持灵活的批量操作组合。

## 🎯 核心特性

### ✅ 已实现功能

#### 批量命令架构
- **BaseBatchCommand基类**：提供批量命令的基础架构
- **GenericBatchCommand**：通用的批量命令实现
- **BatchBuilder构建器**：链式调用方式构建批量命令
- **子命令管理**：支持任意数量子命令的组合

#### 具体批量操作
- **批量删除**：同时删除多个时间轴项目
- **批量自动排列**：单轨道内项目的智能排列
- **批量属性修改**：同时修改多个项目的属性
- **批量移动**：多个项目的位置调整

#### 历史记录集成
- **单一历史条目**：整个批量操作作为一个历史记录
- **原子性操作**：批量操作要么全部成功，要么全部失败
- **智能撤销**：一键撤销整个批量操作
- **错误处理**：完善的异常捕获和回滚机制

## 🏗️ 技术架构

### 核心组件

#### BaseBatchCommand基类
```typescript
abstract class BaseBatchCommand implements Command {
  public readonly id: string
  public readonly description: string
  protected subCommands: Command[] = []

  constructor(description: string) {
    this.id = generateCommandId()
    this.description = description
  }

  // 批量执行：依次执行所有子命令
  async execute(): Promise<void> {
    for (const command of this.subCommands) {
      await command.execute()
    }
  }

  // 批量撤销：逆序撤销所有子命令
  async undo(): Promise<void> {
    for (let i = this.subCommands.length - 1; i >= 0; i--) {
      await this.subCommands[i].undo()
    }
  }

  // 添加子命令
  protected addCommand(command: Command): void {
    this.subCommands.push(command)
  }

  // 获取批量操作摘要
  getBatchSummary(): string {
    return `${this.description} (${this.subCommands.length}个操作)`
  }
}
```

#### BatchBuilder构建器
```typescript
class BatchBuilder {
  private commands: Command[] = []
  
  constructor(private description: string) {}
  
  // 添加命令
  addCommand(command: Command): BatchBuilder {
    this.commands.push(command)
    return this
  }
  
  // 构建批量命令
  build(): GenericBatchCommand {
    const batchCommand = new GenericBatchCommand(this.description)
    this.commands.forEach(cmd => batchCommand.addCommand(cmd))
    return batchCommand
  }
}
```

### 具体批量命令实现

#### BatchDeleteCommand - 批量删除
```typescript
class BatchDeleteCommand extends BaseBatchCommand {
  constructor(timelineItemIds: string[]) {
    super(`批量删除 ${timelineItemIds.length} 个项目`)
    
    // 为每个项目创建删除命令
    timelineItemIds.forEach(itemId => {
      const item = videoStore.getTimelineItem(itemId)
      if (item) {
        this.addCommand(new RemoveTimelineItemCommand(itemId, item))
      }
    })
  }
}
```

#### BatchAutoArrangeTrackCommand - 批量自动排列
```typescript
class BatchAutoArrangeTrackCommand extends BaseBatchCommand {
  constructor(trackId: number) {
    super(`自动排列轨道 ${trackId}`)
    
    const trackItems = videoStore.getTrackItems(trackId)
    let currentTime = 0
    
    trackItems.forEach(item => {
      if (item.timeRange.start !== currentTime) {
        // 创建移动命令
        this.addCommand(new MoveTimelineItemCommand(
          item.id, 
          currentTime, 
          trackId
        ))
      }
      currentTime += item.duration
    })
  }
}
```

#### BatchUpdatePropertiesCommand - 批量属性修改
```typescript
class BatchUpdatePropertiesCommand extends BaseBatchCommand {
  constructor(
    timelineItemIds: string[], 
    propertyType: string, 
    newValue: any
  ) {
    super(`批量修改 ${timelineItemIds.length} 个项目的${propertyType}`)
    
    timelineItemIds.forEach(itemId => {
      const item = videoStore.getTimelineItem(itemId)
      if (item) {
        const oldValue = item.transformProperties[propertyType]
        this.addCommand(new UpdateTransformCommand(
          itemId, 
          propertyType, 
          oldValue, 
          newValue
        ))
      }
    })
  }
}
```

## 🎮 使用方式

### 方式1：直接使用专用批量命令
```typescript
// 批量删除选中项目
const selectedIds = videoStore.getSelectedTimelineItemIds()
const success = await videoStore.batchDeleteTimelineItems(selectedIds)

// 自动排列轨道
const success = await videoStore.autoArrangeTrackWithHistory(trackId)

// 批量修改属性
const success = await videoStore.batchUpdateProperties(
  selectedIds, 
  'opacity', 
  0.5
)
```

### 方式2：使用构建器模式
```typescript
// 创建自定义批量操作
const batch = videoStore.startBatch('自定义批量操作')

// 添加各种命令
batch.addCommand(new AddTimelineItemCommand(...))
batch.addCommand(new UpdateTransformCommand(...))
batch.addCommand(new MoveTimelineItemCommand(...))

// 构建并执行
const batchCommand = batch.build()
await videoStore.executeBatchCommand(batchCommand)
```

### 方式3：编程式批量操作
```typescript
// 复杂的批量操作逻辑
async function customBatchOperation() {
  const batch = videoStore.startBatch('复杂批量操作')
  
  // 根据条件动态添加命令
  const selectedItems = videoStore.getSelectedTimelineItems()
  
  selectedItems.forEach(item => {
    if (item.type === 'video') {
      batch.addCommand(new UpdateTransformCommand(
        item.id, 'volume', item.volume, 0.8
      ))
    } else if (item.type === 'image') {
      batch.addCommand(new UpdateTransformCommand(
        item.id, 'duration', item.duration, 5
      ))
    }
  })
  
  const batchCommand = batch.build()
  await videoStore.executeBatchCommand(batchCommand)
}
```

## 📊 性能优化

### 简洁设计理念
- **轻量级实现**：前端操作无需复杂的性能优化
- **框架依赖**：依赖Vue响应式系统的内置优化
- **WebAV优化**：利用WebAV的内部性能优化机制
- **避免过度工程化**：保持代码简洁和可维护性

### 执行优化
```typescript
// 批量操作时的UI更新优化
async function executeBatchCommand(batchCommand: BaseBatchCommand): Promise<void> {
  try {
    // 暂停UI更新（可选）
    const shouldPauseUpdates = batchCommand.subCommands.length > 10
    if (shouldPauseUpdates) {
      pauseUIUpdates()
    }
    
    // 执行批量命令
    await batchCommand.execute()
    
    // 恢复UI更新
    if (shouldPauseUpdates) {
      resumeUIUpdates()
    }
    
    // 添加到历史记录
    historyManager.addCommand(batchCommand)
    
    // 显示成功通知
    showToast(`${batchCommand.getBatchSummary()} 执行成功`)
    
  } catch (error) {
    // 错误处理和回滚
    await handleBatchCommandError(batchCommand, error)
  }
}
```

### 内存管理
- **命令复用**：相同类型的命令对象复用
- **状态清理**：批量操作完成后清理临时状态
- **资源回收**：及时释放不再需要的WebAV资源

## 🔧 错误处理

### 异常捕获机制
```typescript
async function handleBatchCommandError(
  batchCommand: BaseBatchCommand, 
  error: Error
): Promise<void> {
  console.error('批量命令执行失败:', error)
  
  try {
    // 尝试回滚已执行的操作
    await batchCommand.undo()
    showToast('操作失败，已自动回滚', 'error')
  } catch (rollbackError) {
    console.error('回滚失败:', rollbackError)
    showToast('操作失败，回滚也失败，请刷新页面', 'error')
  }
}
```

### 依赖验证
```typescript
// 批量操作前的依赖检查
function validateBatchDependencies(batchCommand: BaseBatchCommand): boolean {
  return batchCommand.subCommands.every(command => {
    return command.validateDependencies?.() !== false
  })
}
```

## 🎯 应用场景

### 常见批量操作
1. **多选删除**：选择多个项目后批量删除
2. **轨道整理**：自动排列轨道内的所有项目
3. **批量调整**：同时修改多个项目的属性
4. **批量导入**：一次性导入多个媒体文件
5. **模板应用**：将预设效果应用到多个项目

### 高级批量操作
1. **智能排列**：根据内容类型智能排列项目
2. **批量变换**：对选中项目应用相同的变换
3. **条件操作**：根据条件批量修改项目属性
4. **批量导出**：批量导出多个项目片段

## 🧪 测试策略

### 功能测试
- ✅ 各种批量命令的正确执行
- ✅ 批量操作的撤销/重做功能
- ✅ 错误情况下的回滚机制
- ✅ 复杂批量操作的组合测试

### 性能测试
- ✅ 大量项目的批量操作性能
- ✅ 内存使用情况监控
- ✅ UI响应性测试
- ✅ 长时间批量操作的稳定性

### 边界测试
- ✅ 空批量操作的处理
- ✅ 单个命令失败时的处理
- ✅ 依赖项缺失时的处理
- ✅ 并发批量操作的处理

## 🎉 实现成果

### 功能完整性
- ✅ 支持所有主要的批量操作类型
- ✅ 完整的历史记录集成
- ✅ 灵活的批量操作构建机制
- ✅ 可靠的错误处理和回滚

### 架构优势
- ✅ 简洁高效的设计理念
- ✅ 易于扩展的架构模式
- ✅ 统一的批量操作接口
- ✅ 完善的错误处理机制

### 用户体验
- ✅ 直观的批量操作体验
- ✅ 一键撤销复杂操作
- ✅ 清晰的操作进度反馈
- ✅ 可靠的操作结果保证

---

*最后更新：2025-06-19*

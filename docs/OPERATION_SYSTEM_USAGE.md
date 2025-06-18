# 现代化操作系统使用指南

## 📋 概述

本文档介绍如何使用新的现代化操作系统，该系统提供了强大的撤销/重做功能、性能监控和高级操作管理。

## 🚀 快速开始

### 1. 在VideoStore中初始化

```typescript
// 在组件中使用
import { useVideoStore } from '@/stores/videoStore'

const videoStore = useVideoStore()

// 初始化现代化操作系统
await videoStore.initializeOperationSystem()
```

### 2. 基础操作使用

```typescript
// 获取操作系统实例
const operationSystem = videoStore.operationSystem

// 检查是否已初始化
if (operationSystem.isInitialized.value) {
  // 执行操作
  const factory = operationSystem.getFactory()
  const operation = factory.createTimelineItemAdd(itemData)
  await operationSystem.execute(operation)
}
```

## 🎯 核心功能

### 撤销/重做操作

```typescript
// 撤销
const undoResult = await operationSystem.undo()
if (undoResult) {
  console.log('撤销成功')
}

// 重做
const redoResult = await operationSystem.redo()
if (redoResult) {
  console.log('重做成功')
}

// 检查状态
console.log('可以撤销:', operationSystem.canUndo.value)
console.log('可以重做:', operationSystem.canRedo.value)
```

### 直接使用系统管理器

```typescript
// 获取系统管理器（高级用法）
const systemManager = operationSystem.getSystemManager()

// 便捷方法
await systemManager.addTimelineItem(itemData)
await systemManager.removeTimelineItem(itemId)
await systemManager.moveTimelineItem(itemId, from, to)
await systemManager.transformTimelineItem(itemId, oldTransform, newTransform)
```

### 批量操作

```typescript
// 创建多个操作
const operations = [
  factory.createTimelineItemAdd(itemData1),
  factory.createTimelineItemAdd(itemData2),
  factory.createTimelineItemAdd(itemData3)
]

// 批量执行（事务模式）
const result = await systemManager.executeBatch(operations, 'transactional')
```

## 📊 监控和调试

### 系统状态监控

```typescript
// 获取系统状态
const status = systemManager.getSystemStatus()
console.log('系统状态:', status)

// 响应式状态
console.log('当前操作索引:', operationSystem.currentIndex.value)
console.log('总操作数:', operationSystem.totalOperations.value)
console.log('是否正在执行:', operationSystem.isExecuting.value)
```

### 性能报告

```typescript
// 获取性能报告
const report = systemManager.getPerformanceReport()
console.log('性能报告:', report)

// 报告包含：
// - 总操作数和成功率
// - 平均执行时间
// - 操作类型统计
// - 最近错误
// - 慢操作列表
// - 性能建议
```

### 通知系统

```typescript
// 监听操作通知
operationSystem.onNotification((notification) => {
  console.log('操作通知:', notification)
  // notification.type: 'success' | 'error' | 'warning' | 'info'
  // notification.title: 通知标题
  // notification.message: 通知消息
})

// 手动显示通知
operationSystem.showSuccess('操作成功', '时间轴项目已添加')
operationSystem.showError('操作失败', '无法删除项目')
```

## 🔧 高级配置

### 调度器配置

```typescript
// 设置并发数（默认为1，串行执行）
systemManager.setSchedulerConcurrency(3)

// 调度操作执行（非紧急操作）
await systemManager.schedule(operation, 5) // 优先级为5
```

### 性能分析器配置

```typescript
// 启用/禁用性能分析
systemManager.setAnalyzerEnabled(true)

// 获取操作类型统计
const analyzer = systemManager.analyzer
const typeStats = analyzer.getOperationTypeStats()
```

## 🧪 测试功能

### 运行内置测试

```typescript
// 在浏览器控制台中运行
import { runOperationSystemTest, runStressTest } from '@/stores/operations/tests/OperationSystemTest'

// 基础功能测试
await runOperationSystemTest()

// 压力测试
await runStressTest()
```

### 自定义测试

```typescript
// 创建测试操作
const testItemData = {
  id: 'test_item',
  mediaItemId: 'test_media',
  trackId: 1,
  mediaType: 'video',
  timeRange: { timelineStartTime: 0, timelineEndTime: 10000000 },
  position: { x: 0, y: 0 },
  size: { width: 1920, height: 1080 },
  rotation: 0,
  zIndex: 1,
  opacity: 1
}

// 测试添加和撤销
await systemManager.addTimelineItem(testItemData)
await systemManager.undo()
await systemManager.redo()
```

## 🔄 迁移指南

### 从旧系统迁移

新系统提供了兼容性接口，可以逐步迁移：

```typescript
// 旧方式（仍然支持）
await videoStore.addTimelineItemWithHistory(timelineItem)

// 新方式（推荐）
await videoStore.operationSystem.getSystemManager().addTimelineItem(itemData)
```

### 迁移助手

```typescript
import { OperationMigrationHelper } from '@/stores/migration/OperationMigrationHelper'

const migrationHelper = new OperationMigrationHelper(systemManager)

// 使用迁移助手执行操作
await migrationHelper.addTimelineItemWithHistory(timelineItem)
await migrationHelper.removeTimelineItemWithHistory(itemId)
```

## ⚠️ 注意事项

### 重要原则

1. **从源头重建原则**: 每次操作都从已解析的MP4Clip/ImgClip重新创建对象
2. **异步操作**: 所有操作都是异步的，需要使用await
3. **错误处理**: 始终检查操作结果的success字段
4. **资源管理**: 系统会自动管理WebAV资源的创建和销毁

### 性能建议

1. **批量操作**: 对于多个相关操作，使用批量执行提高性能
2. **并发控制**: 根据系统性能调整调度器并发数
3. **监控分析**: 定期查看性能报告，识别性能瓶颈
4. **内存管理**: 大量操作后考虑清理历史记录

### 调试技巧

1. **启用详细日志**: 操作系统会输出详细的执行日志
2. **使用性能报告**: 识别慢操作和错误模式
3. **监控系统状态**: 实时查看操作队列和执行状态
4. **测试功能**: 使用内置测试验证系统功能

## 📚 API参考

详细的API文档请参考：
- [操作接口定义](../frontend/src/stores/operations/types/Operation.ts)
- [系统管理器](../frontend/src/stores/operations/OperationSystemManager.ts)
- [操作工厂](../frontend/src/stores/operations/factory/OperationFactory.ts)
- [历史管理器](../frontend/src/stores/operations/history/ReactiveHistoryManager.ts)

## 🤝 贡献指南

如需扩展操作系统功能：

1. 创建新的操作类继承`AtomicOperation`
2. 在`OperationFactory`中添加创建方法
3. 更新类型定义和导出
4. 添加相应的测试用例
5. 更新文档

---

*本文档会随着系统功能的完善而持续更新。*

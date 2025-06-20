# 选择操作历史记录

## 📋 概述

选择操作历史记录功能为视频编辑器的选择操作提供完整的撤销/重做支持，包括单选和多选操作。用户可以通过撤销/重做按钮恢复到之前的选择状态。

## 🎯 核心特性

### ✅ 已实现功能

#### 选择操作支持
- **单选操作**：点击时间轴项目进行单选，支持撤销/重做
- **多选操作**：Ctrl+点击进行多选/取消选择，支持撤销/重做
- **清除选择**：点击空白区域清除所有选择，支持撤销/重做
- **选择状态同步**：自动同步时间轴和AVCanvas的选择状态

#### 智能优化
- **状态变化检测**：只有在选择状态实际发生变化时才创建历史记录
- **避免重复记录**：相同的选择操作不会创建多个历史记录
- **防抖机制**：100毫秒内的重复操作会被自动忽略
- **事件冒泡处理**：避免多个事件处理器同时触发清除选择操作
- **错误处理**：选择操作失败时自动回退到普通选择模式

## 🏗️ 技术架构

### 核心组件

#### SelectTimelineItemsCommand
```typescript
export class SelectTimelineItemsCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private previousSelection: Set<string> // 保存操作前的选择状态
  private newSelection: Set<string> // 保存操作后的选择状态

  constructor(
    itemIds: string[],
    mode: 'replace' | 'toggle',
    selectionModule: SelectionModuleInterface,
    timelineModule: TimelineModuleInterface,
    mediaModule: MediaModuleInterface
  )

  async execute(): Promise<void> // 应用新的选择状态
  async undo(): Promise<void> // 恢复到之前的选择状态
}
```

#### 选择模块扩展
```typescript
// 新增带历史记录的选择方法
async function selectTimelineItemsWithHistory(
  itemIds: string[], 
  mode: 'replace' | 'toggle' = 'replace'
): Promise<void>

// 原有的选择方法保持不变，用于内部调用
function selectTimelineItems(
  itemIds: string[], 
  mode: 'replace' | 'toggle' = 'replace', 
  withHistory: boolean = true
): void
```

### 设计原则

#### 向后兼容
- 保持现有的`selectTimelineItems`方法不变
- 新增`selectTimelineItemsWithHistory`方法用于需要历史记录的场景
- 组件可以选择使用哪种方法

#### 状态一致性
- 选择命令直接操作选择状态，避免循环调用
- 自动触发AVCanvas同步逻辑
- 保持时间轴和AVCanvas选择状态的一致性

## 🎮 使用方式

### 用户操作

#### 基础选择操作
- **单选**：点击时间轴项目 → 自动记录到历史
- **多选**：Ctrl+点击时间轴项目 → 自动记录到历史
- **清除选择**：点击空白区域 → 自动记录到历史

#### 撤销/重做
- **撤销**：点击撤销按钮或Ctrl+Z → 恢复到上一个选择状态
- **重做**：点击重做按钮或Ctrl+Y → 重新应用选择操作

### 开发者API

#### 带历史记录的选择
```typescript
// 单选（带历史记录）
await videoStore.selectTimelineItemsWithHistory(['item-id'], 'replace')

// 多选切换（带历史记录）
await videoStore.selectTimelineItemsWithHistory(['item-id'], 'toggle')

// 清除选择（带历史记录）
await videoStore.selectTimelineItemsWithHistory([], 'replace')
```

#### 普通选择（不记录历史）
```typescript
// 内部调用，不创建历史记录
videoStore.selectTimelineItems(['item-id'], 'replace')
```

## 📊 操作描述

### 描述格式

#### 单选操作
- `选择项目: 视频文件名.mp4`
- `取消选择所有项目`

#### 多选操作
- `添加选择: 视频文件名.mp4`
- `取消选择: 视频文件名.mp4`
- `选择 3 个项目`
- `切换选择 2 个项目`

## 🔧 实现细节

### 防抖机制
```typescript
// 防抖机制：避免短时间内重复执行相同的选择操作
let lastSelectionCommand: { itemIds: string[], mode: string, timestamp: number } | null = null
const SELECTION_DEBOUNCE_TIME = 100 // 100毫秒内的重复操作会被忽略

// 检查是否是重复的操作（防抖）
if (lastSelectionCommand) {
  const timeDiff = now - lastSelectionCommand.timestamp
  const isSameOperation =
    lastSelectionCommand.mode === mode &&
    arraysEqual(lastSelectionCommand.itemIds, itemIds)

  if (isSameOperation && timeDiff < SELECTION_DEBOUNCE_TIME) {
    console.log('🎯 检测到重复选择操作，跳过历史记录')
    return
  }
}
```

### 状态变化检测
```typescript
// 检查是否有实际的选择变化
const currentSelection = new Set(selectedTimelineItemIds.value)
const newSelection = calculateNewSelection(itemIds, mode, currentSelection)

// 如果选择状态没有变化，不创建历史记录
if (setsEqual(currentSelection, newSelection)) {
  console.log('🎯 选择状态无变化，跳过历史记录')
  return
}
```

### 事件冒泡处理
```typescript
// 在轨道内容点击处理器中阻止事件冒泡
async function handleTimelineClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.classList.contains('track-content')) {
    // 阻止事件冒泡，避免触发容器的点击事件
    event.stopPropagation()
    await videoStore.selectTimelineItemsWithHistory([], 'replace')
  }
}

// 容器点击处理器不再处理 track-content 的点击
async function handleTimelineContainerClick(event: MouseEvent) {
  // 注意：不包括 track-content，因为它由 handleTimelineClick 处理
  if (target.classList.contains('timeline') || /* 其他条件但不包括 track-content */) {
    await videoStore.selectTimelineItemsWithHistory([], 'replace')
  }
}
```

### 错误处理
```typescript
try {
  // 尝试使用带历史记录的选择
  await videoStore.selectTimelineItemsWithHistory([itemId], 'replace')
} catch (error) {
  console.error('❌ 选择操作失败:', error)
  // 如果历史记录选择失败，回退到普通选择
  videoStore.selectTimelineItems([itemId], 'replace')
}
```

## 📈 性能特点

### 优化策略
- **智能检测**：只有在选择状态实际变化时才创建历史记录
- **避免循环**：选择命令直接操作状态，不通过选择方法
- **内存优化**：利用现有的历史记录限制机制

### 兼容性
- **组件兼容**：现有组件可以逐步迁移到新的API
- **功能兼容**：不影响现有的选择功能
- **性能兼容**：不增加显著的性能开销

## 🎉 实现成果

### 功能完整性
- ✅ 支持所有选择操作的历史记录
- ✅ 智能状态变化检测
- ✅ 完善的错误处理机制

### 用户体验
- ✅ 操作直观，一键撤销选择操作
- ✅ 反馈清晰，详细的操作描述
- ✅ 性能流畅，无明显延迟

### 代码质量
- ✅ 类型安全的TypeScript实现
- ✅ 向后兼容的API设计
- ✅ 模块化架构，易于维护

---

*最后更新：2025-06-20*

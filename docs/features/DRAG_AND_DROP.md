# 拖拽功能系统

## 📋 概述

拖拽功能系统为视频编辑器提供直观的拖拽操作体验，支持素材库到时间轴的拖拽、时间轴内项目的拖拽移动，以及统一的视觉反馈系统。

## 🎯 核心特性

### ✅ 已实现功能

#### 素材库拖拽
- **素材到时间轴**：从素材库拖拽视频/图片到时间轴
- **智能放置**：自动检测目标轨道和时间位置
- **冲突检测**：实时检测时间冲突并提供视觉反馈
- **多格式支持**：支持视频和图片素材的拖拽

#### 时间轴内拖拽
- **项目移动**：时间轴项目的位置调整
- **跨轨道移动**：支持项目在不同轨道间移动
- **多选拖拽**：支持多个项目的批量拖拽移动
- **精确定位**：基于时间刻度的精确位置控制

#### 统一预览系统
- **一致的视觉效果**：所有拖拽操作使用统一的预览样式
- **实时反馈**：拖拽过程中实时显示目标位置和时长
- **冲突指示**：红色边框指示时间冲突
- **多选显示**：多选拖拽时显示项目数量

## 🏗️ 技术架构

### 核心组件

#### DragPreviewManager
统一的拖拽预览管理器，负责所有拖拽操作的视觉反馈：

```typescript
class DragPreviewManager {
  // 显示/更新预览
  updatePreview(config: {
    name: string
    duration: number
    startTime: number
    trackId: number
    isConflict: boolean
    isMultiple?: boolean
    count?: number
  }, timelineWidth: number): void
  
  // 隐藏预览
  hidePreview(): void
}
```

#### 拖拽事件处理
- **dragstart**：设置拖拽数据和初始状态
- **dragover**：实时更新预览位置和冲突检测
- **drop**：执行实际的移动或创建操作
- **dragend**：清理拖拽状态和预览

### 数据传输格式

#### 素材库拖拽数据
```typescript
// MIME类型：application/media-item
{
  mediaItemId: string
  type: 'video' | 'image'
  duration: number
  name: string
}
```

#### 时间轴拖拽数据
```typescript
// MIME类型：application/timeline-item
{
  timelineItemIds: string[]
  isMultiSelect: boolean
  dragOffset: number  // 鼠标在第一个项目中的相对位置
}
```

## 🎨 视觉设计

### 预览样式
- **正常状态**：灰色半透明背景 `rgba(128, 128, 128, 0.6)`
- **冲突状态**：红色边框和背景 `#ff4444`
- **边框**：2px实线边框
- **尺寸**：根据实际时长计算宽度，最小60px
- **内容**：显示项目名称或多选数量

### 位置计算
```typescript
// 时间到像素转换
const pixelPosition = videoStore.timeToPixel(targetTime)

// 轨道位置计算
const trackTop = trackId * trackHeight + trackOffset

// 预览元素定位
previewElement.style.left = `${pixelPosition}px`
previewElement.style.top = `${trackTop}px`
previewElement.style.width = `${duration * pixelPerSecond}px`
```

## 🔧 实现细节

### 冲突检测算法
```typescript
function detectTimelineConflicts(
  targetTrackId: number,
  startTime: number,
  endTime: number,
  excludeIds: string[] = []
): boolean {
  const trackItems = videoStore.getTrackItems(targetTrackId)
  
  return trackItems.some(item => {
    if (excludeIds.includes(item.id)) return false
    
    const itemStart = item.timeRange.start
    const itemEnd = item.timeRange.end
    
    // 检测时间重叠
    return !(endTime <= itemStart || startTime >= itemEnd)
  })
}
```

### 多选拖拽处理
```typescript
function handleMultiSelectDrag(selectedIds: string[], targetTime: number, targetTrackId: number) {
  // 计算相对位置偏移
  const firstItem = videoStore.getTimelineItem(selectedIds[0])
  const timeOffset = targetTime - firstItem.timeRange.start
  
  // 批量移动所有选中项目
  const commands = selectedIds.map(id => {
    const item = videoStore.getTimelineItem(id)
    const newStartTime = item.timeRange.start + timeOffset
    
    return new MoveTimelineItemCommand(id, newStartTime, targetTrackId)
  })
  
  // 作为批量操作执行
  await videoStore.executeBatchCommand(new BatchMoveCommand(commands))
}
```

## 🎮 使用方式

### 素材库拖拽
1. 从素材库选择视频或图片
2. 拖拽到时间轴目标位置
3. 实时预览显示放置位置和时长
4. 释放鼠标完成添加

### 时间轴内拖拽
1. 选择一个或多个时间轴项目
2. 拖拽到新的位置或轨道
3. 预览显示移动后的位置
4. 红色预览表示时间冲突
5. 释放鼠标完成移动

### 快捷操作
- **Ctrl+拖拽**：复制项目而非移动
- **Shift+拖拽**：限制在同一轨道内移动
- **Alt+拖拽**：磁性吸附到时间刻度

## 📊 性能优化

### DOM操作优化
- **元素复用**：预览元素复用，避免频繁创建/销毁
- **样式缓存**：只在必要时更新样式属性
- **事件节流**：dragover事件使用节流处理

### 内存管理
- **自动清理**：拖拽结束后自动清理预览元素
- **事件解绑**：组件卸载时清理所有事件监听器
- **状态重置**：拖拽取消时重置所有相关状态

### 渲染优化
```typescript
// 使用requestAnimationFrame优化预览更新
function updatePreviewPosition(x: number, y: number) {
  if (this.animationFrame) {
    cancelAnimationFrame(this.animationFrame)
  }
  
  this.animationFrame = requestAnimationFrame(() => {
    this.previewElement.style.transform = `translate(${x}px, ${y}px)`
  })
}
```

## 🔄 事件流程

### 素材库拖拽流程
```
1. MediaLibrary dragstart
   ↓ 设置 application/media-item 数据
2. Timeline dragover
   ↓ handleMediaItemDragOver → 显示灰色预览
3. Timeline drop
   ↓ 创建新时间轴项目 + 清理预览
4. 完成
```

### 时间轴拖拽流程
```
1. VideoClip dragstart
   ↓ 设置 application/timeline-item 数据
2. Timeline dragover
   ↓ handleTimelineItemDragOver → 显示预览（含冲突检测）
3. Timeline drop
   ↓ 移动项目 + 清理预览
4. VideoClip dragend
   ↓ 清理全局状态
5. 完成
```

## 🧪 测试要点

### 功能测试
- ✅ 素材库到时间轴的拖拽创建
- ✅ 时间轴内项目的位置移动
- ✅ 跨轨道拖拽移动
- ✅ 多选项目的批量拖拽
- ✅ 冲突检测和视觉反馈

### 边界测试
- ✅ 拖拽到时间轴边界外
- ✅ 拖拽到无效区域
- ✅ 拖拽过程中取消操作
- ✅ 快速连续拖拽操作

### 性能测试
- ✅ 大量项目时的拖拽性能
- ✅ 长时间拖拽的内存使用
- ✅ 复杂时间轴的冲突检测性能

## 🎉 实现成果

### 用户体验
- ✅ 直观的拖拽操作体验
- ✅ 一致的视觉反馈系统
- ✅ 清晰的冲突状态指示
- ✅ 流畅的多选拖拽支持

### 技术质量
- ✅ 统一的架构设计
- ✅ 高性能的实现方案
- ✅ 完善的错误处理
- ✅ 良好的代码可维护性

### 功能完整性
- ✅ 支持所有主要拖拽场景
- ✅ 完整的操作历史记录
- ✅ 智能的冲突检测机制
- ✅ 灵活的扩展能力

---

*最后更新：2025-06-19*

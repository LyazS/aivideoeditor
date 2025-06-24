# 🛠️ 时间码系统改进实施指南

## 📖 概述

本文档提供了将视频编辑器系统中剩余的数字时间格式转换为时间码格式的具体实施步骤。

## 🎯 改进目标

将以下部分从数字时间格式改为时间码格式，按精度收益排序：
1. **内部计算逻辑** (最高优先级) - 解决浮点数精度问题
2. **Store方法参数** (高优先级) - 提升API一致性
3. **拖拽数据类型** (中优先级) - 改善操作精度
4. **类型定义** (低优先级) - 完善类型安全

## 🚀 阶段1: 内部计算逻辑时间码化 (最高优先级)

### 1.1 精度问题分析

**当前问题**: 使用浮点数秒进行时间计算存在累积精度误差
```typescript
// 问题示例
const frameRate = 30
const frameTime = 1 / frameRate  // 0.03333333333333333 (不精确)
let totalTime = 0
for (let i = 0; i < 30; i++) {
  totalTime += frameTime  // 累积误差
}
console.log(totalTime)  // 0.9999999999999999 而不是 1.0 ❌
```

**解决方案**: 使用基于整数帧的时间码计算
```typescript
// 精确计算
const frameRate = 30
let totalTime = Timecode.zero(frameRate)
for (let i = 0; i < 30; i++) {
  totalTime = totalTime.add(new Timecode(1, frameRate))  // 添加1帧
}
console.log(totalTime.toString())  // "00:01.00" 精确 ✅
```

### 1.2 修改坐标转换函数

**文件**: `frontend/src/stores/utils/coordinateUtils.ts`

```typescript
// 修改像素到时间码的转换
export function pixelToTimecode(
  pixel: number,
  timelineWidth: number,
  totalDuration: Timecode,  // 改为接受Timecode
  zoomLevel: number,
  scrollOffset: number,
): Timecode {
  // 计算相对位置（0-1之间）
  const relativePosition = (pixel + scrollOffset) / (timelineWidth * zoomLevel)

  // 直接基于总帧数计算，避免浮点数中间步骤
  const targetFrames = Math.round(relativePosition * totalDuration.totalFrames)

  // 确保不超出范围
  const clampedFrames = Math.max(0, Math.min(targetFrames, totalDuration.totalFrames))

  return new Timecode(clampedFrames, totalDuration.frameRate)
}

// 修改时间码到像素的转换
export function timecodeToPixel(
  timecode: Timecode,
  timelineWidth: number,
  totalDuration: Timecode,  // 改为接受Timecode
  zoomLevel: number,
  scrollOffset: number,
): number {
  // 基于帧数计算相对位置，保持精确
  const relativePosition = timecode.totalFrames / totalDuration.totalFrames

  // 计算像素位置
  const pixelPosition = relativePosition * timelineWidth * zoomLevel - scrollOffset

  return pixelPosition
}

// 添加时间码范围计算函数
export function calculateVisibleTimecodeRange(
  timelineWidth: number,
  totalDuration: Timecode,
  zoomLevel: number,
  scrollOffset: number
): { startTime: Timecode, endTime: Timecode } {
  const startTime = pixelToTimecode(0, timelineWidth, totalDuration, zoomLevel, scrollOffset)
  const endTime = pixelToTimecode(timelineWidth, timelineWidth, totalDuration, zoomLevel, scrollOffset)

  return { startTime, endTime }
}
```

### 1.3 修改时间轴冲突检测

**文件**: `frontend/src/components/Timeline.vue`

```typescript
// 修改冲突检测使用时间码精确计算
function detectMediaItemConflicts(
  dropTime: Timecode,  // 改为Timecode
  targetTrackId: number,
  duration: Timecode   // 改为Timecode
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = []
  const trackItems = videoStore.getTimelineItemsForTrack(targetTrackId)

  // 使用时间码精确运算
  const dragEndTime = dropTime.add(duration)

  for (const item of trackItems) {
    // 从微秒转换为时间码，保持精度
    const itemStartTime = Timecode.fromMicroseconds(item.timeRange.timelineStartTime, videoStore.frameRate)
    const itemEndTime = Timecode.fromMicroseconds(item.timeRange.timelineEndTime, videoStore.frameRate)

    // 精确的帧级重叠检测
    if (dropTime.lessThan(itemEndTime) && dragEndTime.greaterThan(itemStartTime)) {
      const mediaItem = videoStore.getMediaItem(item.mediaItemId)

      // 计算精确的重叠范围
      const overlapStart = Timecode.max(dropTime, itemStartTime)
      const overlapEnd = Timecode.min(dragEndTime, itemEndTime)

      conflicts.push({
        itemId: item.id,
        itemName: mediaItem?.name || 'Unknown',
        startTime: itemStartTime,
        endTime: itemEndTime,
        overlapStart,
        overlapEnd
      })
    }
  }

  return conflicts
}

// 修改拖拽位置计算
function calculateDropPosition(event: DragEvent, timelineWidth: number): {
  dropTime: Timecode,  // 改为返回Timecode
  targetTrackId: number
} | null {
  const rect = timelineBody.value?.getBoundingClientRect()
  if (!rect) return null

  const clickX = event.clientX - rect.left - 200  // 减去轨道控制区域

  // 直接计算时间码，避免秒数中间转换
  const dropTimecode = videoStore.pixelToTimecode(clickX, timelineWidth)

  // 自动对齐到帧边界（如果需要）
  const alignedTimecode = dropTimecode.alignToFrame()

  const targetTrackId = calculateTargetTrack(event.clientY - rect.top)

  return {
    dropTime: alignedTimecode,
    targetTrackId
  }
}
```

## 🚀 阶段2: Store方法参数时间码化

### 1.1 修改videoStore.ts中的方法签名

**文件**: `frontend/src/stores/videoStore.ts`

```typescript
// 第一步：添加新的时间码版本方法（保持向后兼容）
async function moveTimelineItemWithHistoryTC(
  timelineItemId: string,
  newPosition: Timecode,
  newTrackId?: number
) {
  // 转换为秒数，调用现有方法
  const newPositionSeconds = newPosition.toSeconds()
  return await moveTimelineItemWithHistory(timelineItemId, newPositionSeconds, newTrackId)
}

async function splitTimelineItemAtTimeWithHistoryTC(
  timelineItemId: string,
  splitTime: Timecode
) {
  const splitTimeSeconds = splitTime.toSeconds()
  return await splitTimelineItemAtTimeWithHistory(timelineItemId, splitTimeSeconds)
}

async function updateTimelineItemTransformWithHistoryTC(
  timelineItemId: string,
  newTransform: {
    x?: number
    y?: number
    width?: number
    height?: number
    rotation?: number
    opacity?: number
    zIndex?: number
    duration?: Timecode  // 改为Timecode
    playbackRate?: number
    volume?: number
    isMuted?: boolean
  }
) {
  // 转换duration为秒数
  const convertedTransform = { ...newTransform }
  if (newTransform.duration !== undefined) {
    convertedTransform.duration = newTransform.duration.toSeconds()
  }
  
  return await updateTimelineItemTransformWithHistory(timelineItemId, convertedTransform)
}
```

### 1.2 更新调用方

**文件**: `frontend/src/components/Timeline.vue`

```typescript
// 修改拖拽处理函数
async function handleTimelineItemDrop(event: DragEvent, dragData: TimelineItemDragData) {
  // ... 现有代码 ...
  
  // 原来
  // await moveTimelineItemWithHistory(dragData.itemId, dropTime, targetTrackId)
  
  // 修改后
  const dropTimecode = Timecode.fromSeconds(dropTime, videoStore.frameRate)
  await moveTimelineItemWithHistoryTC(dragData.itemId, dropTimecode, targetTrackId)
}

// 修改素材拖拽处理
async function handleMediaItemDrop(event: DragEvent, mediaDragData: MediaItemDragData) {
  // ... 现有代码 ...
  
  // 原来
  // await createMediaClipFromMediaItem(mediaItemForCreation, dropTime, targetTrackId)
  
  // 修改后
  const dropTimecode = Timecode.fromSeconds(dropTime, videoStore.frameRate)
  await createMediaClipFromMediaItemTC(mediaItemForCreation, dropTimecode, targetTrackId)
}
```

**文件**: `frontend/src/components/PropertiesPanel.vue`

```typescript
// 修改时长更新函数
const updateTargetDurationFromTimecode = async (microseconds: number, timecode: string) => {
  // 原来
  // const newTargetDuration = microseconds / 1000000
  // await updateTargetDuration(newTargetDuration)
  
  // 修改后
  const newTargetTimecode = Timecode.fromMicroseconds(microseconds, videoStore.frameRate)
  await videoStore.updateTimelineItemTransformWithHistoryTC(selectedTimelineItem.value.id, {
    duration: newTargetTimecode
  })
}
```

**文件**: `frontend/src/components/TimeScale.vue`

```typescript
// 修改时间刻度点击处理
function handleClick(event: MouseEvent) {
  // ... 现有代码 ...
  
  // 原来
  // const newTimecode = videoStore.pixelToTimecode(clickX, containerWidth.value)
  // webAVControls.seekTo(finalTimecode)
  
  // 修改后（已经是Timecode，无需修改）
  const newTimecode = videoStore.pixelToTimecode(clickX, containerWidth.value)
  webAVControls.seekTo(newTimecode)  // seekTo已经支持Timecode
}
```

### 1.3 导出新方法

**文件**: `frontend/src/stores/videoStore.ts`

```typescript
// 在return语句中添加新方法
return {
  // ... 现有方法 ...
  
  // 新的时间码版本方法
  moveTimelineItemWithHistoryTC,
  splitTimelineItemAtTimeWithHistoryTC,
  updateTimelineItemTransformWithHistoryTC,
  
  // ... 其他方法 ...
}
```

## 🚀 阶段2: 拖拽数据类型时间码化

### 2.1 更新类型定义

**文件**: `frontend/src/types/videoTypes.ts`

```typescript
// 添加新的时间码版本接口
export interface TimelineItemDragDataTC {
  type: 'timeline-item'
  itemId: string
  trackId: number
  startTime: Timecode  // 改为Timecode
  selectedItems: string[]
  dragOffset: { x: number, y: number }
}

export interface MediaItemDragDataTC {
  type: 'media-item'
  mediaItemId: string
  name: string
  duration: Timecode  // 改为Timecode
  mediaType: 'video' | 'image'
}

// 添加转换工具函数
export function convertTimelineItemDragDataToTC(
  data: TimelineItemDragData, 
  frameRate: number
): TimelineItemDragDataTC {
  return {
    ...data,
    startTime: Timecode.fromSeconds(data.startTime, frameRate)
  }
}

export function convertMediaItemDragDataToTC(
  data: MediaItemDragData, 
  frameRate: number
): MediaItemDragDataTC {
  return {
    ...data,
    duration: Timecode.fromSeconds(data.duration, frameRate)
  }
}
```

### 2.2 更新拖拽工具

**文件**: `frontend/src/composables/useDragUtils.ts`

```typescript
// 添加时间码版本的拖拽数据创建方法
function createDragPreviewDataTC(
  name: string,
  duration: Timecode,
  dropTime: Timecode,
  targetTrackId: number,
  isConflict: boolean,
  isMultiSelect: boolean,
  selectedCount?: number
) {
  return {
    name,
    duration: duration.toString(),  // 转换为显示字符串
    dropTime: dropTime.toString(),  // 转换为显示字符串
    targetTrackId,
    isConflict,
    isMultiSelect,
    selectedCount
  }
}

// 添加时间码版本的位置计算方法
function calculateDropPositionTC(
  event: DragEvent, 
  timelineWidth: number, 
  frameRate: number,
  dragOffset?: { x: number, y: number }
): { dropTime: Timecode, targetTrackId: number } | null {
  const result = calculateDropPosition(event, timelineWidth, dragOffset)
  if (!result) return null
  
  return {
    dropTime: Timecode.fromSeconds(result.dropTime, frameRate),
    targetTrackId: result.targetTrackId
  }
}
```

### 2.3 更新冲突检测

**文件**: `frontend/src/components/Timeline.vue`

```typescript
// 修改冲突检测函数
function detectMediaItemConflictsTC(
  dropTime: Timecode,
  targetTrackId: number, 
  duration: Timecode
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = []
  const trackItems = videoStore.getTimelineItemsForTrack(targetTrackId)
  
  const dragEndTime = dropTime.add(duration)  // 使用Timecode运算
  
  for (const item of trackItems) {
    const itemStartTime = Timecode.fromMicroseconds(item.timeRange.timelineStartTime, videoStore.frameRate)
    const itemEndTime = Timecode.fromMicroseconds(item.timeRange.timelineEndTime, videoStore.frameRate)
    
    // 使用Timecode比较方法检查重叠
    if (dropTime.lessThan(itemEndTime) && dragEndTime.greaterThan(itemStartTime)) {
      const mediaItem = videoStore.getMediaItem(item.mediaItemId)
      conflicts.push({
        itemId: item.id,
        itemName: mediaItem?.name || 'Unknown',
        startTime: itemStartTime,
        endTime: itemEndTime,
        overlapStart: Timecode.max(dropTime, itemStartTime),
        overlapEnd: Timecode.min(dragEndTime, itemEndTime)
      })
    }
  }
  
  return conflicts
}

// 类似地更新 detectTimelineConflictsTC
function detectTimelineConflictsTC(
  dropTime: Timecode, 
  targetTrackId: number, 
  dragData: TimelineItemDragDataTC
): ConflictInfo[] {
  // ... 类似的实现
}
```

## 🧪 测试策略

### 单元测试

```typescript
// 测试文件: tests/stores/videoStore.test.ts
describe('VideoStore Timecode Methods', () => {
  it('should move timeline item with timecode position', async () => {
    const store = useVideoStore()
    const newPosition = new Timecode('00:30.15', 30)
    
    await store.moveTimelineItemWithHistoryTC('test-item', newPosition, 2)
    
    const item = store.getTimelineItem('test-item')
    const actualPosition = Timecode.fromMicroseconds(item.timeRange.timelineStartTime, 30)
    expect(actualPosition.equals(newPosition)).toBe(true)
  })
  
  it('should update duration with timecode', async () => {
    const store = useVideoStore()
    const newDuration = new Timecode('00:05.00', 30)
    
    await store.updateTimelineItemTransformWithHistoryTC('test-item', {
      duration: newDuration
    })
    
    const item = store.getTimelineItem('test-item')
    const actualDuration = Timecode.fromMicroseconds(
      item.timeRange.timelineEndTime - item.timeRange.timelineStartTime, 
      30
    )
    expect(actualDuration.equals(newDuration)).toBe(true)
  })
})
```

### 集成测试

```typescript
// 测试文件: tests/components/Timeline.test.ts
describe('Timeline Timecode Integration', () => {
  it('should handle drag and drop with timecode calculations', async () => {
    const wrapper = mount(Timeline)
    
    // 模拟拖拽事件
    const dragData: TimelineItemDragDataTC = {
      type: 'timeline-item',
      itemId: 'test-item',
      trackId: 1,
      startTime: new Timecode('00:10.00', 30),
      selectedItems: ['test-item'],
      dragOffset: { x: 0, y: 0 }
    }
    
    // 触发拖拽处理
    await wrapper.vm.handleTimelineItemDropTC(mockEvent, dragData)
    
    // 验证结果
    const item = videoStore.getTimelineItem('test-item')
    expect(item.trackId).toBe(2) // 假设拖拽到轨道2
  })
})
```

## 📋 实施检查清单

### 阶段1检查项
- [ ] 添加新的时间码版本Store方法
- [ ] 更新Timeline.vue中的拖拽处理
- [ ] 更新PropertiesPanel.vue中的时长设置
- [ ] 更新TimeScale.vue中的点击处理
- [ ] 导出新方法到videoStore
- [ ] 运行单元测试确保功能正常

### 阶段2检查项
- [ ] 添加新的时间码版本拖拽数据类型
- [ ] 更新拖拽工具函数
- [ ] 更新冲突检测函数
- [ ] 更新拖拽预览计算
- [ ] 运行集成测试确保拖拽功能正常

### 验收标准
- [ ] 所有时间相关操作使用时间码对象
- [ ] 拖拽操作支持帧级精度
- [ ] 播放控制功能正常
- [ ] 性能没有明显下降
- [ ] 所有测试通过

## ⚠️ 注意事项

1. **保持向后兼容**: 在完全迁移完成前，保留原有的数字时间方法
2. **渐进式迁移**: 逐个组件进行迁移，避免大范围修改
3. **充分测试**: 每个阶段完成后都要进行充分的功能测试
4. **性能监控**: 关注时间码对象创建对性能的影响

## 🚫 WebAV边界保护原则

### 重要：不要修改WebAV相关模块

以下模块属于WebAV库接口层，**绝对不能**进行时间码化：

```typescript
// ❌ 禁止修改的WebAV相关文件
- VideoVisibleSprite.ts     // WebAV视频精灵实现
- ImageVisibleSprite.ts     // WebAV图片精灵实现
- spriteFactory.ts          // WebAV精灵工厂
- webavModule.ts            // WebAV核心模块
- useWebAVControls.ts       // WebAV播放控制（已有边界转换）
```

### 正确的边界转换模式

```typescript
// ✅ 正确：业务逻辑层使用时间码
const startTimeTC = new Timecode('00:30.15', 30)
const endTimeTC = new Timecode('01:15.00', 30)
const durationTC = endTimeTC.subtract(startTimeTC)

// ✅ 正确：在接口边界转换为WebAV需要的微秒格式
sprite.setTimeRange({
  clipStartTime: startTimeTC.toMicroseconds(),      // 转换为微秒
  clipEndTime: endTimeTC.toMicroseconds(),          // 转换为微秒
  timelineStartTime: startTimeTC.toMicroseconds(),
  timelineEndTime: endTimeTC.toMicroseconds(),
})

// ✅ 正确：从WebAV获取数据后转换为时间码
const timeRange = sprite.getTimeRange()
const currentStartTC = Timecode.fromMicroseconds(timeRange.timelineStartTime, frameRate)
const currentEndTC = Timecode.fromMicroseconds(timeRange.timelineEndTime, frameRate)

// ❌ 错误：不要在WebAV模块内部使用时间码
class VideoVisibleSprite {
  setTimeRange(timeRange: { startTime: Timecode, endTime: Timecode }) {
    // 这样做是错误的！WebAV库期望微秒格式
  }
}
```

### 边界转换检查清单

- [ ] 确认所有WebAV相关文件保持原有微秒格式
- [ ] 验证时间码转换仅在业务逻辑层进行
- [ ] 测试WebAV播放控制功能正常
- [ ] 确认精灵创建和时间范围设置正确
- [ ] 验证时间同步功能无异常

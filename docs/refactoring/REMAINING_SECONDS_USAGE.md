# 项目中仍在使用秒数计算的地方

## 📋 概述

经过全面检查，发现项目中还有多个地方在使用秒数进行逻辑计算。这些地方需要根据重要性和影响范围进行分类处理。

## 🎯 分类处理策略

### 🔴 高优先级（核心时间逻辑）

#### 1. **坐标转换函数** - `coordinateUtils.ts`
**影响范围**: 所有时间轴交互
**问题**: `timeToPixel()` 和 `pixelToTime()` 仍使用秒数
```typescript
// 当前实现
export function timeToPixel(time: number, ...) // time是秒数
export function pixelToTime(pixel: number, ...) // 返回秒数
```
**建议**: 创建帧数版本的转换函数

#### 2. **时间轴刻度计算** - `TimeScale.vue`
**影响范围**: 时间轴显示
**问题**: 刻度间隔仍使用秒数计算
```typescript
let majorInterval = 10 // 主刻度间隔（秒）
let minorInterval = 1 // 次刻度间隔（秒）
```
**建议**: 改为帧数间隔

#### 3. **播放头位置计算** - `TimeScale.vue`
**影响范围**: 播放头显示
**问题**: 仍使用 `currentTime` 而不是 `currentFrame`
```typescript
const playheadPosition = computed(() => {
  const currentTime = videoStore.currentTime // 应该使用 currentFrame
  return videoStore.timeToPixel(currentTime, containerWidth.value)
})
```

### 🟡 中优先级（UI显示和工具函数）

#### 4. **时间格式化函数** - `timeUtils.ts`
**影响范围**: 时间显示
**问题**: 旧的格式化函数仍存在
```typescript
export function formatTime(seconds: number, ...) // 应该废弃
export function formatTimeWithAutoPrecision(seconds: number, ...) // 应该废弃
```
**建议**: 标记为废弃，推荐使用 `framesToTimecode()`

#### 5. **VideoClip组件** - `VideoClip.vue`
**影响范围**: 视频片段显示和操作
**问题**: 大量秒数计算
- 时长显示: `formatDuration(timelineDuration)`
- 位置计算: `timeRange.timelineStartTime / 1000000`
- 调整大小: `resizeStartDuration.value`

#### 6. **PropertiesPanel组件** - `PropertiesPanel.vue`
**影响范围**: 属性面板
**问题**: 时长控制使用秒数
```typescript
const targetDuration = computed(() => timelineDuration.value) // 秒数
```

### 🟢 低优先级（兼容性和边界处理）

#### 7. **拖拽工具** - `useDragUtils.ts`
**影响范围**: 拖拽操作
**问题**: 拖拽位置计算使用秒数
```typescript
dropTime = videoStore.pixelToTime(mouseX, timelineWidth) // 返回秒数
```

#### 8. **时长计算工具** - `durationUtils.ts`
**影响范围**: 时长统计
**问题**: 内容结束时间计算
```typescript
return timeRange.timelineEndTime / 1000000 // 转换为秒
```

#### 9. **缩放工具** - `zoomUtils.ts` 和 `viewportModule.ts`
**影响范围**: 缩放和滚动
**问题**: 可见时间范围计算使用秒数

## 🛠️ 推荐的重构顺序

### 阶段1: 核心转换函数（立即处理）
1. **创建帧数版本的坐标转换函数**
2. **修复播放头位置计算**
3. **重构时间轴刻度计算**

### 阶段2: UI组件重构（短期）
1. **VideoClip组件帧数化**
2. **PropertiesPanel时长控制**
3. **拖拽操作帧数化**

### 阶段3: 工具函数清理（中期）
1. **标记旧格式化函数为废弃**
2. **重构时长计算工具**
3. **缩放工具优化**

## 📊 影响评估

### 高影响（需要立即处理）
- **坐标转换**: 影响所有时间轴交互
- **播放头位置**: 影响播放状态显示
- **时间轴刻度**: 影响时间轴可读性

### 中影响（可分步处理）
- **VideoClip**: 影响片段操作精度
- **PropertiesPanel**: 影响属性编辑精度
- **拖拽操作**: 影响拖拽精度

### 低影响（可延后处理）
- **工具函数**: 主要是代码清理
- **统计计算**: 不影响核心功能

## 🎯 具体实施建议

### 1. 创建帧数版本的坐标转换
```typescript
// 新增函数
export function frameToPixel(frames: number, ...) 
export function pixelToFrame(pixel: number, ...)

// 包装现有函数
export function timeToPixel(time: number, ...) {
  const frames = secondsToFrames(time)
  return frameToPixel(frames, ...)
}
```

### 2. 重构播放头位置
```typescript
const playheadPosition = computed(() => {
  const currentFrame = videoStore.currentFrame // 使用帧数
  return videoStore.frameToPixel(currentFrame, containerWidth.value)
})
```

### 3. 重构时间轴刻度
```typescript
// 改为帧数间隔
let majorIntervalFrames = 300 // 主刻度间隔（帧）
let minorIntervalFrames = 30 // 次刻度间隔（帧）
```

这个分析报告显示了需要进一步重构的地方，按优先级排序，可以分阶段实施。

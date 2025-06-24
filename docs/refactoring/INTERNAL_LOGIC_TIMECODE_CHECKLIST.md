# 🔍 内部逻辑时间码化详细清单

## 📋 概述

本文档详细列出了系统中所有仍在使用数字时间（秒、毫秒、微秒）进行内部计算的地方，按优先级和影响程度排序。

## 🚨 高优先级 - 精度关键区域

### 1. 视频片段操作模块 (`clipOperationsModule.ts`)

#### 🔪 分割操作 - 第231-298行
**当前问题**: 混合使用微秒和秒数进行比例计算，存在精度丢失
```typescript
// ❌ 问题代码
const timelineDuration = timelineEndTime - timelineStartTime  // 微秒
const relativeTimelineTime = splitTime - timelineStartTime   // 秒 - 微秒 ❌
const relativeRatio = relativeTimelineTime / timelineDuration // 单位不匹配 ❌

const clipStartTime = timeRange.clipStartTime / 1000000      // 转换损失精度
const clipDuration = clipEndTime - clipStartTime            // 浮点数运算
const splitClipTime = clipStartTime + clipDuration * relativeRatio // 累积误差
```

**修改方案**:
```typescript
// ✅ 时间码精确计算
const timelineStartTC = Timecode.fromMicroseconds(timelineStartTime, frameRate)
const timelineEndTC = Timecode.fromMicroseconds(timelineEndTime, frameRate)
const splitTimeTC = Timecode.fromSeconds(splitTime, frameRate)

const timelineDurationTC = timelineEndTC.subtract(timelineStartTC)
const relativeTimelineTimeTC = splitTimeTC.subtract(timelineStartTC)
const relativeRatio = relativeTimelineTimeTC.totalFrames / timelineDurationTC.totalFrames

const clipStartTC = Timecode.fromMicroseconds(timeRange.clipStartTime, frameRate)
const clipEndTC = Timecode.fromMicroseconds(timeRange.clipEndTime, frameRate)
const clipDurationTC = clipEndTC.subtract(clipStartTC)
const splitClipTC = clipStartTC.add(clipDurationTC.multiply(relativeRatio))
```

#### 🎬 播放速度更新 - 第193-224行
**当前问题**: 时间范围计算使用除法运算，可能产生精度误差
```typescript
// ❌ 问题代码
const clipDuration = (item.timeRange.clipEndTime - item.timeRange.clipStartTime) / 1000000
const timelineDuration = (item.timeRange.timelineEndTime - item.timeRange.timelineStartTime) / 1000000
```

### 2. 自动排列功能 (`timelineArrangementUtils.ts`)

#### 📐 轨道项目排列 - 第28-53行
**当前问题**: 使用秒数累加，长时间编辑会产生累积误差
```typescript
// ❌ 问题代码
let currentPosition = 0  // 秒数累加
for (const item of sortedItems) {
  const duration = (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000
  // 设置新位置
  sprite.setTimeRange({
    timelineStartTime: currentPosition * 1000000,
    timelineEndTime: (currentPosition + duration) * 1000000,
  })
  currentPosition += duration  // 累积误差
}
```

**修改方案**:
```typescript
// ✅ 时间码精确累加
let currentPositionTC = Timecode.zero(frameRate)
for (const item of sortedItems) {
  const startTC = Timecode.fromMicroseconds(timeRange.timelineStartTime, frameRate)
  const endTC = Timecode.fromMicroseconds(timeRange.timelineEndTime, frameRate)
  const durationTC = endTC.subtract(startTC)
  
  const newEndTC = currentPositionTC.add(durationTC)
  sprite.setTimeRange({
    timelineStartTime: currentPositionTC.toMicroseconds(),
    timelineEndTime: newEndTC.toMicroseconds(),
  })
  currentPositionTC = newEndTC  // 无累积误差
}
```

### 3. 时间轴拖拽计算 (`Timeline.vue`)

#### 🖱️ 多选项目移动 - 第654-676行
**当前问题**: 时间偏移计算使用浮点数运算
```typescript
// ❌ 问题代码
const timeOffset = newTime - originalStartTime  // 浮点数
for (const itemId of itemIds) {
  const currentStartTime = item.timeRange.timelineStartTime / 1000000
  const newStartTime = currentStartTime + timeOffset  // 累积误差
  const clampedNewStartTime = Math.max(0, newStartTime)
}
```

#### 🎯 拖拽位置计算 - 第556-594行
**当前问题**: 拖拽目标位置使用秒数表示，精度不足
```typescript
// ❌ 问题代码
const { dropTime, targetTrackId } = dropPosition  // dropTime是秒数
console.log('dropTime:', dropTime.toFixed(2))     // 精度限制在小数点后2位
```

### 4. 网格线和刻度生成

#### 📏 网格线计算 (`Timeline.vue` 第323-381行)
**当前问题**: 帧级网格线使用浮点数循环，精度不可靠
```typescript
// ❌ 问题代码
const frameInterval = 1 / videoStore.frameRate  // 0.03333... 不精确
for (let i = frameStartTime; i <= frameEndTime; i += frameInterval) {
  if (i >= 0 && Math.abs(i % interval) > 0.001) {  // 需要容差处理
    lines.push({ time: i, isFrame: true })
  }
}
```

#### ⏱️ 时间刻度 (`TimeScale.vue` 第132-157行)
**当前问题**: 主要刻度判断使用浮点数模运算
```typescript
// ❌ 问题代码
const isMajor = Math.abs(time % adjustedMajorInterval) < 0.001  // 容差处理
const isFrame = isFrameLevel && Math.abs(time % adjustedMinorInterval) < 0.001
```

## 🟡 中优先级 - 功能影响区域

### 5. 坐标转换工具 (`coordinateUtils.ts`)

#### 🔄 像素时间转换 - 第74-85行
**当前问题**: 虽然有时间码版本，但仍保留秒数版本
```typescript
// ❌ 仍在使用的秒数版本
export function pixelToTime(pixel, timelineWidth, totalDuration, zoomLevel, scrollOffset): number {
  const pixelsPerSecond = (timelineWidth * zoomLevel) / totalDuration
  const time = (pixel + scrollOffset) / pixelsPerSecond
  return Math.max(0, Math.min(time, totalDuration))
}
```

### 6. 时间工具函数 (`timeUtils.ts`)

#### ⚙️ 帧对齐函数 - 第12-15行
**当前问题**: 基于浮点数的帧对齐，不够精确
```typescript
// ❌ 问题代码
export function alignTimeToFrame(time: number, frameRate: number): number {
  const frameDuration = 1 / frameRate  // 不精确
  return Math.floor(time / frameDuration) * frameDuration  // 累积误差
}
```

#### 📊 像素密度计算 - 第24-30行
**当前问题**: 基于秒数的像素密度计算
```typescript
// ❌ 问题代码
export function calculatePixelsPerSecond(
  timelineWidth: number,
  totalDuration: number,  // 秒数
  zoomLevel: number,
): number {
  return (timelineWidth * zoomLevel) / totalDuration
}
```

### 7. 批量命令 (`batchCommands.ts`)

#### 📦 批量移动命令 - 第101-112行
**当前问题**: 批量操作中的时间计算使用秒数
```typescript
// ❌ 问题代码
let currentPosition = 0
const duration = (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000
const newTimeRange = {
  timelineStartTime: currentPosition * 1000000,
  timelineEndTime: (currentPosition + duration) * 1000000,
}
currentPosition += duration  // 累积误差
```

## 🟢 低优先级 - 显示和辅助功能

### 8. 素材创建 (`Timeline.vue`)

#### 🎬 素材时间范围设置 - 第748-779行
**当前问题**: 创建时间轴项目时使用秒数计算
```typescript
// ❌ 问题代码
const timeRangeConfig = {
  clipStartTime: 0,
  clipEndTime: mediaItem.duration * 1000000,  // 秒转微秒
  timelineStartTime: startTime * 1000000,     // 秒转微秒
  timelineEndTime: (startTime + mediaItem.duration) * 1000000,  // 浮点数运算
}
```

## 📈 改进优先级矩阵

| 模块 | 文件 | 行数范围 | 精度影响 | 用户影响 | 优先级 |
|------|------|----------|----------|----------|--------|
| 视频分割 | clipOperationsModule.ts | 231-298 | 极高 | 高 | 🔴 最高 |
| 自动排列 | timelineArrangementUtils.ts | 28-53 | 极高 | 中 | 🔴 最高 |
| 多选拖拽 | Timeline.vue | 654-676 | 高 | 高 | 🔴 高 |
| 网格线生成 | Timeline.vue | 323-381 | 高 | 中 | 🔴 高 |
| 时间刻度 | TimeScale.vue | 132-157 | 高 | 中 | 🔴 高 |
| 坐标转换 | coordinateUtils.ts | 74-85 | 中 | 低 | 🟡 中 |
| 时间工具 | timeUtils.ts | 12-30 | 中 | 低 | 🟡 中 |
| 批量命令 | batchCommands.ts | 101-112 | 中 | 低 | 🟡 中 |
| 素材创建 | Timeline.vue | 748-779 | 低 | 低 | 🟢 低 |

## 🚫 不需要修改的WebAV相关模块

以下模块属于WebAV库接口层，**不应该**使用时间码，保持原有的微秒格式：

| 模块 | 文件 | 说明 | 原因 |
|------|------|------|------|
| 视频精灵 | VideoVisibleSprite.ts | WebAV视频精灵实现 | WebAV库要求微秒格式 |
| 图片精灵 | ImageVisibleSprite.ts | WebAV图片精灵实现 | WebAV库要求微秒格式 |
| 精灵工厂 | spriteFactory.ts | 创建WebAV精灵 | 直接与WebAV交互 |
| WebAV控制 | useWebAVControls.ts | WebAV播放控制 | 已有时间码转换边界 |
| WebAV模块 | webavModule.ts | WebAV核心模块 | WebAV库内部逻辑 |

**重要原则**:
- WebAV边界保持微秒格式
- 时间码仅用于UI层和业务逻辑层
- 在接口边界进行格式转换

## 🎯 实施建议

### 第一阶段 (1-2天)
1. **视频分割操作** - 修复最严重的精度问题
2. **自动排列功能** - 消除累积误差
3. **多选拖拽计算** - 提升操作精度

### 第二阶段 (2-3天)
4. **网格线生成** - 改善视觉精度
5. **时间刻度计算** - 提升刻度准确性
6. **拖拽位置计算** - 完善交互精度

### 第三阶段 (1-2天)
7. **坐标转换工具** - 统一转换逻辑
8. **时间工具函数** - 清理遗留函数
9. **批量命令** - 完善批量操作

### 第四阶段 (1天)
10. **辅助功能** - 完善剩余细节

## ✅ 验证标准

每个模块改进后需要验证：
1. **精度测试**: 长时间操作无累积误差
2. **功能测试**: 原有功能正常工作
3. **性能测试**: 性能无明显下降
4. **边界测试**: 极值情况处理正确

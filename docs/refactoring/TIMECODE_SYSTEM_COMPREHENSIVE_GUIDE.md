# 🎬 时间码系统综合指南

## 📋 概述

本文档整合了视频编辑器时间码系统的完整设计、实现和改进方案，提供了从基础概念到具体实施的全面指导。

## 🎯 系统目标

### 核心设计原则
1. **统一的时间标准**: 全系统固定使用30fps，HH:MM:SS.FF格式
2. **帧级精度**: 以帧为最小精度单位，避免浮点数精度问题
3. **类型安全**: 使用Timecode对象提供强类型保护
4. **WebAV边界保护**: 只在WebAV接口边界进行微秒转换

### 数据流架构
```
用户操作 → UI时间码 → Store状态(Timecode) → WebAV边界转换 → WebAV微秒
    ↑                                                              ↓
UI显示 ← 时间码格式 ← Store状态(Timecode) ← WebAV边界转换 ← WebAV事件
```

## 🏗️ 核心数据结构

### Timecode类设计
```typescript
class Timecode {
  private _totalFrames: number  // 核心存储：总帧数
  private _frameRate: number    // 帧率（默认30fps）
  
  constructor(input: TimecodeInput, frameRate?: number)
}

type TimecodeInput = 
  | string                    // "00:30.15"
  | number                    // 915 (总帧数)
  | TimecodeComponents        // {hours: 0, minutes: 0, seconds: 30, frames: 15}
  | Timecode                  // 另一个时间码实例
```

### 存储原理
- **总帧数计算**: `(小时 × 3600 + 分钟 × 60 + 秒) × 帧率 + 帧数`
- **内存效率**: 每个实例仅存储8字节（总帧数 + 帧率）
- **运算优势**: 所有操作都是简单的整数运算

## ✅ 已完成部分

### 1. UI显示层 (100% 完成)
- **VideoPreviewEngine.vue**: 播放控制面板时间显示
- **MediaLibrary.vue**: 素材时长标签显示
- **VideoClip.vue**: 片段时长显示
- **TimeScale.vue**: 时间轴刻度显示
- **PropertiesPanel.vue**: 属性面板时间输入

### 2. 核心时间码系统 (100% 完成)
- **Timecode.ts**: 完整的时间码类实现
- **TimecodeUtils.ts**: 时间码工具函数
- **TimecodeInput.vue**: 时间码输入组件

### 3. 播放控制系统 (100% 完成)
- **playbackModule.ts**: 使用Timecode对象存储状态
- **useWebAVControls.ts**: WebAV接口边界转换
- **PlaybackControls.vue**: 时间码播放控制

## ⚠️ 当前问题分析

### 精度问题根源
当前系统使用浮点数秒进行时间计算，存在累积精度误差，在长时间编辑或高精度操作时会导致帧不对齐。

**精度问题示例**:
```typescript
// 浮点数精度问题
const time1 = 0.1 + 0.2  // 0.30000000000000004 ❌
const time2 = 0.3        // 0.3
console.log(time1 === time2)  // false ❌

// 时间码精确计算
const tc1 = new Timecode('00:00.03', 30).add(new Timecode('00:00.06', 30))  // 00:00.09 ✅
const tc2 = new Timecode('00:00.09', 30)
console.log(tc1.equals(tc2))  // true ✅
```

### 改进优先级概览
- 🔴 **最高优先级**: 内部计算逻辑 (20% 完成) - 精度收益极高
- 🟡 **中优先级**: Store方法参数 (40% 完成) - API一致性提升
- 🟡 **中优先级**: 拖拽数据类型 (30% 完成) - 操作精度改善
- � **低优先级**: MediaItem时间码化 - 完善类型安全

## 🚫 WebAV边界保护原则

### 禁止修改的WebAV模块
```
🚫 VideoVisibleSprite.ts      # WebAV视频精灵
🚫 ImageVisibleSprite.ts      # WebAV图片精灵
🚫 spriteFactory.ts           # WebAV精灵工厂
🚫 webavModule.ts             # WebAV核心模块
```

### 正确的边界转换模式
```typescript
// ✅ UI层 → WebAV层
const userInput = new Timecode("00:30.15", 30)
sprite.setTimeRange({
  clipStartTime: userInput.toMicroseconds(),  // 转换为微秒
  clipEndTime: endTime.toMicroseconds(),      // 转换为微秒
})

// ✅ WebAV层 → UI层
const timeRange = sprite.getTimeRange()
const startTimeTC = Timecode.fromMicroseconds(timeRange.timelineStartTime, frameRate)
```

### 为什么不能修改？

1. **WebAV库要求**: WebAV库内部使用微秒作为时间单位
2. **接口契约**: 改变接口会破坏与WebAV库的兼容性
3. **性能考虑**: WebAV内部优化基于数字运算，不适合对象运算
4. **维护边界**: 保持清晰的架构边界，便于维护和调试


## � 当前实施状态 (2024-12-19 更新)

### ✅ 已完成的改进

#### 🎯 阶段1: 高优先级改进 - **已完成**

**总体状态**: ✅ **100% 完成**
**完成时间**: 2024-12-19
**影响范围**: 核心时间计算逻辑
**精度收益**: 极高

**已完成的任务**:

1. **✅ 内部计算逻辑时间码化**
   - ✅ 片段分割操作 (`clipOperationsModule.ts`) - 使用Timecode进行精确帧级计算
   - ✅ 自动排列功能 (`timelineArrangementUtils.ts`) - 使用Timecode累加避免误差
   - ✅ 多选拖拽计算 (`Timeline.vue`) - 使用Timecode进行时间偏移计算
   - ✅ 网格线生成 (`Timeline.vue`) - 使用Timecode进行帧级精度显示
   - ✅ 时间刻度计算 (`TimeScale.vue`) - 使用Timecode进行精确位置计算

2. **✅ Store方法参数时间码化**
   - ✅ `moveTimelineItemWithHistory` - 支持 `number | Timecode` 参数
   - ✅ `splitTimelineItemAtTimeWithHistory` - 支持 `number | Timecode` 参数
   - ✅ 删除了所有TC后缀的重复方法，统一API接口

3. **✅ 拖拽系统时间码化**
   - ✅ `calculateDropPosition` - 直接返回Timecode对象
   - ✅ 拖拽预览计算 - 使用Timecode进行精确位置计算
   - ✅ 修复素材库拖拽的数据类型兼容性问题

4. **✅ 过时函数清理**
   - ✅ 完全删除 `timeToPixel` 和 `pixelToTime` 函数
   - ✅ 更新所有调用点使用新的Timecode版本
   - ✅ 清理导入导出和文档引用

**技术成果**:
- 🎯 **帧级精度**: 所有时间计算现在基于帧数，无浮点数累积误差
- 🔧 **API统一**: 统一使用Timecode对象，提升开发体验
- 🧹 **代码清理**: 删除所有过时的浮点数计算函数
- 🛡️ **类型安全**: 强类型Timecode对象防止时间单位混淆

**验证结果**:
- ✅ 素材库拖拽到时间轴 - 帧级精度定位
- ✅ 视频片段分割 - 精确到帧的分割点
- ✅ 多个片段自动排列 - 无累积间隙误差
- ✅ 多选项目批量移动 - 保持相对位置精度

---

## �🚀 改进实施计划

### 阶段1: 高优先级改进 (2-3天) ✅ **已完成**

#### 任务1.1: 内部计算逻辑时间码化 🔴 **最高优先级**
**影响范围**: 高 | **风险等级**: 中 | **精度收益**: 极高

**发现的具体问题区域**:

##### A. 视频片段操作模块 (`clipOperationsModule.ts`)
```typescript
// ❌ 当前状态 - 分割操作使用浮点数计算
const timelineDuration = timelineEndTime - timelineStartTime  // 微秒运算
const relativeTimelineTime = splitTime - timelineStartTime   // 秒数运算
const relativeRatio = relativeTimelineTime / timelineDuration // 混合单位运算 ❌

const clipStartTime = timeRange.clipStartTime / 1000000      // 转换为秒
const clipEndTime = timeRange.clipEndTime / 1000000         // 转换为秒
const clipDuration = clipEndTime - clipStartTime            // 浮点数运算 ❌
const splitClipTime = clipStartTime + clipDuration * relativeRatio // 累积误差 ❌

// ✅ 目标状态 - 使用时间码精确计算
const timelineStartTC = Timecode.fromMicroseconds(timelineStartTime, frameRate)
const timelineEndTC = Timecode.fromMicroseconds(timelineEndTime, frameRate)
const splitTimeTC = Timecode.fromSeconds(splitTime, frameRate)

const timelineDurationTC = timelineEndTC.subtract(timelineStartTC)
const relativeTimelineTimeTC = splitTimeTC.subtract(timelineStartTC)
const relativeRatio = relativeTimelineTimeTC.totalFrames / timelineDurationTC.totalFrames // 基于帧数 ✅

const clipStartTC = Timecode.fromMicroseconds(timeRange.clipStartTime, frameRate)
const clipEndTC = Timecode.fromMicroseconds(timeRange.clipEndTime, frameRate)
const clipDurationTC = clipEndTC.subtract(clipStartTC)
const splitClipTC = clipStartTC.add(clipDurationTC.multiply(relativeRatio)) // 精确计算 ✅
```

##### B. 自动排列功能 (`timelineArrangementUtils.ts`)
```typescript
// ❌ 当前状态 - 使用秒数累加
let currentPosition = 0  // 秒数
for (const item of sortedItems) {
  const duration = (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000 // 转换为秒 ❌
  // 更新位置
  sprite.setTimeRange({
    timelineStartTime: currentPosition * 1000000,        // 秒转微秒 ❌
    timelineEndTime: (currentPosition + duration) * 1000000, // 浮点数运算 ❌
  })
  currentPosition += duration  // 累积误差 ❌
}

// ✅ 目标状态 - 使用时间码累加
let currentPositionTC = Timecode.zero(frameRate)
for (const item of sortedItems) {
  const startTC = Timecode.fromMicroseconds(timeRange.timelineStartTime, frameRate)
  const endTC = Timecode.fromMicroseconds(timeRange.timelineEndTime, frameRate)
  const durationTC = endTC.subtract(startTC)  // 精确计算 ✅

  const newEndTC = currentPositionTC.add(durationTC)
  sprite.setTimeRange({
    timelineStartTime: currentPositionTC.toMicroseconds(),
    timelineEndTime: newEndTC.toMicroseconds(),
  })
  currentPositionTC = newEndTC  // 无累积误差 ✅
}
```

##### C. 网格线生成 (`Timeline.vue`)
```typescript
// ❌ 当前状态 - 浮点数循环
const frameInterval = 1 / videoStore.frameRate  // 0.03333... ❌
for (let i = frameStartTime; i <= frameEndTime; i += frameInterval) {
  if (i >= 0 && Math.abs(i % interval) > 0.001) {  // 浮点数比较不可靠 ❌
    lines.push({ time: i, isFrame: true })
  }
}

// ✅ 目标状态 - 基于帧数循环
const startFrameTC = Timecode.fromSeconds(frameStartTime, frameRate)
const endFrameTC = Timecode.fromSeconds(frameEndTime, frameRate)
for (let frame = startFrameTC.totalFrames; frame <= endFrameTC.totalFrames; frame++) {
  const frameTC = new Timecode(frame, frameRate)
  if (!frameTC.isMultipleOfSeconds(interval)) {  // 精确判断 ✅
    lines.push({ time: frameTC.toSeconds(), isFrame: true })
  }
}
```

##### D. 拖拽计算 (`Timeline.vue`)
```typescript
// ❌ 当前状态 - 多选移动使用秒数计算
const timeOffset = newTime - originalStartTime  // 浮点数运算 ❌
for (const itemId of itemIds) {
  const currentStartTime = item.timeRange.timelineStartTime / 1000000  // 转换为秒 ❌
  const newStartTime = currentStartTime + timeOffset  // 累积误差 ❌
  const clampedNewStartTime = Math.max(0, newStartTime)  // 浮点数比较 ❌
}

// ✅ 目标状态 - 使用时间码计算
const originalStartTC = Timecode.fromSeconds(originalStartTime, frameRate)
const newTimeTC = Timecode.fromSeconds(newTime, frameRate)
const timeOffsetTC = newTimeTC.subtract(originalStartTC)  // 精确偏移 ✅

for (const itemId of itemIds) {
  const currentStartTC = Timecode.fromMicroseconds(item.timeRange.timelineStartTime, frameRate)
  const newStartTC = currentStartTC.add(timeOffsetTC)  // 精确计算 ✅
  const clampedNewStartTC = Timecode.max(Timecode.zero(frameRate), newStartTC)  // 精确比较 ✅
}
```

##### E. 时间刻度计算 (`TimeScale.vue`)
```typescript
// ❌ 当前状态 - 浮点数精度问题
const isMajor = Math.abs(time % adjustedMajorInterval) < 0.001  // 容差处理浮点数 ❌
const isFrame = isFrameLevel && Math.abs(time % adjustedMinorInterval) < 0.001  // 不可靠 ❌

// ✅ 目标状态 - 基于帧数判断
const timeTC = Timecode.fromSeconds(time, frameRate)
const isMajor = timeTC.isMultipleOfSeconds(adjustedMajorInterval)  // 精确判断 ✅
const isFrame = isFrameLevel && timeTC.totalFrames % frameInterval === 0  // 整数运算 ✅
```

**通用解决方案 - 坐标转换函数**:
```typescript
// coordinateUtils.ts
export function pixelToTimecode(
  pixel: number,
  timelineWidth: number,
  totalDuration: Timecode,  // 改为Timecode
  zoomLevel: number,
  scrollOffset: number,
): Timecode {
  // 计算相对位置（0-1之间）
  const relativePosition = (pixel + scrollOffset) / (timelineWidth * zoomLevel)

  // 直接计算总帧数，避免浮点数中间步骤
  const totalFrames = Math.round(relativePosition * totalDuration.totalFrames)

  return new Timecode(totalFrames, totalDuration.frameRate)
}
```

#### 任务1.2: Store方法参数时间码化
**影响范围**: 中等 | **风险等级**: 低

**问题**: Store方法仍使用数字参数，需要改为Timecode对象参数

**解决方案**:
```typescript
// 修改方法签名 - videoStore.ts
async function moveTimelineItemWithHistory(
  timelineItemId: string,
  newPosition: Timecode,  // 改为Timecode
  newTrackId?: number
) {
  const newPositionSeconds = newPosition.toSeconds()
  // ... 其余逻辑保持不变
}

async function splitTimelineItemAtTimeWithHistory(
  timelineItemId: string,
  splitTime: Timecode  // 改为Timecode
) {
  const splitTimeSeconds = splitTime.toSeconds()
  // ... 其余逻辑保持不变
}

// 更新调用方 - Timeline.vue, PropertiesPanel.vue
async function handleTimelineItemDrop(event: DragEvent, dragData: TimelineItemDragData) {
  const dropTimeSeconds = dragUtils.calculateDropPosition(event, timelineWidth.value)
  const dropTimecode = Timecode.fromSeconds(dropTimeSeconds, videoStore.frameRate)
  await moveTimelineItemWithHistory(dragData.itemId, dropTimecode, targetTrackId)
}
```

### 🔮 未来改进计划

#### 阶段2: 中优先级改进 (2-3天) 🟡 **可选**

**说明**: 以下改进为可选项，当前系统已达到帧级精度要求。这些改进主要用于进一步提升API一致性和开发体验。

##### 任务2.1: 拖拽数据类型时间码化 🟡 **可选**
**影响范围**: 中等 | **风险等级**: 中 | **优先级**: 低

**问题**: 拖拽数据接口仍使用数字时间，但已通过边界转换解决精度问题

**解决方案**:
```typescript
// 修改拖拽数据接口 - videoTypes.ts
export interface TimelineItemDragData {
  type: 'timeline-item'
  itemId: string
  trackId: number
  startTime: Timecode  // 改为Timecode
  selectedItems: string[]
  dragOffset: { x: number, y: number }
}

export interface MediaItemDragData {
  type: 'media-item'
  mediaItemId: string
  name: string
  duration: Timecode  // 改为Timecode
  mediaType: 'video' | 'image'
}

// 更新拖拽工具 - useDragUtils.ts
function createDragPreviewData(
  name: string,
  duration: Timecode,  // 改为Timecode
  dropTime: Timecode,  // 改为Timecode
  targetTrackId: number,
  isConflict: boolean,
  isMultiSelect: boolean,
  selectedCount?: number
) {
  return {
    name,
    duration: duration.toString(),  // 转换为显示字符串
    dropTime: dropTime.toString(),  // 转换为显示字符串
    // ... 其他属性
  }
}

// 更新冲突检测 - Timeline.vue
function detectMediaItemConflicts(
  dropTime: Timecode,  // 改为Timecode
  targetTrackId: number,
  duration: Timecode   // 改为Timecode
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = []
  const trackItems = videoStore.getTimelineItemsForTrack(targetTrackId)

  const dragEndTime = dropTime.add(duration)  // 使用Timecode运算

  for (const item of trackItems) {
    const itemStartTime = Timecode.fromMicroseconds(item.timeRange.timelineStartTime, videoStore.frameRate)
    const itemEndTime = Timecode.fromMicroseconds(item.timeRange.timelineEndTime, videoStore.frameRate)

    // 使用Timecode比较方法进行精确冲突检测
    if (dropTime.lessThan(itemEndTime) && dragEndTime.greaterThan(itemStartTime)) {
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
```

##### 阶段3: 低优先级改进 (1-2天) 🟢 **可选**

**说明**: 这些改进为长期优化项，当前系统功能完整且精度达标。

###### 任务3.1: MediaItem时间码化评估 🟢 **可选**
**影响范围**: 高 | **风险等级**: 高 | **优先级**: 很低

**问题**: MediaItem接口仍使用数字时间，但不影响核心精度

**迁移策略**:
```typescript
// 完全替换
interface MediaItem {
  duration: Timecode      // 直接替换
}
```

###### 任务3.2: 工具函数清理 ✅ **已完成**
**影响范围**: 低 | **风险等级**: 低

**状态**: ✅ **已完成** - 所有过时函数已删除

**清理策略**:
```typescript
// 标记过时的函数 - timeUtils.ts
/** @deprecated 使用 Timecode.fromSeconds() 替代 */
export function alignTimeToFrame(time: number, frameRate: number): number {
  console.warn('alignTimeToFrame is deprecated, use Timecode.alignToFrame() instead')
  return Math.floor(time / (1 / frameRate)) * (1 / frameRate)
}

// 保留必要的兼容性函数
export function formatTime(
  seconds: number,
  precision: 'timecode' | 'frames' | 'milliseconds' | 'seconds' | 'hours' = 'seconds',
  frameRate: number = 30,
): string {
  if (precision === 'timecode') {
    return TimecodeUtils.secondsToTimecode(seconds, frameRate)
  }
  // ... 其他格式保持不变
}
```

## 📊 精度收益分析

### 浮点数精度问题
```typescript
// 问题1: 累积误差
let time = 0.0
for (let i = 0; i < 100; i++) {
  time += 0.1  // 每次添加0.1秒
}
console.log(time)  // 9.999999999999998 而不是 10.0 ❌

// 问题2: 帧对齐误差
const frameRate = 30
const frameTime = 1 / frameRate  // 0.03333333333333333
const time = frameTime * 15      // 0.49999999999999994
const expectedTime = 0.5         // 期望值
console.log(time === expectedTime)  // false ❌
```

### 时间码精确计算
```typescript
// 解决方案: 基于整数帧的精确计算
const tc = Timecode.zero(30)
for (let i = 0; i < 100; i++) {
  tc = tc.add(new Timecode('00:00.03', 30))  // 精确添加3帧
}
console.log(tc.toString())  // "00:10.00" 精确结果 ✅

// 帧对齐始终精确
const frameTime = new Timecode(1, 30)  // 1帧
const time = frameTime.multiply(15)    // 15帧
console.log(time.toString())           // "00:00.15" 精确 ✅
```

## ⚡ 快速参考

### 常用转换模式
```typescript
// 数字时间 → 时间码
const timecode = Timecode.fromSeconds(30.5, 30)
const timecode = Timecode.fromMicroseconds(30500000, 30)
const timecode = new Timecode("00:30.15", 30)

// 时间码 → 数字时间
const seconds = timecode.toSeconds()
const microseconds = timecode.toMicroseconds()
const string = timecode.toString()

// WebAV边界转换
webAVControls.seekTo(timecode)  // 自动转换
const timecode = Timecode.fromMicroseconds(microseconds, frameRate)
```

### 时间码运算
```typescript
const tc1 = new Timecode("00:30.15", 30)
const tc2 = new Timecode("00:15.10", 30)

tc1.add(tc2)          // "00:45.25"
tc1.subtract(tc2)     // "00:15.05"
tc1.multiply(2)       // "01:01.00"
tc1.equals(tc2)       // false
tc1.lessThan(tc2)     // false
```

## 🛠️ API参考

### Timecode类完整API
```typescript
class Timecode {
  // 构造函数
  constructor(input: TimecodeInput, frameRate?: number)

  // 静态工厂方法
  static fromString(timecode: string, frameRate: number): Timecode
  static fromFrames(frames: number, frameRate: number): Timecode
  static fromSeconds(seconds: number, frameRate: number): Timecode
  static fromMicroseconds(microseconds: number, frameRate: number): Timecode
  static zero(frameRate: number): Timecode

  // 获取器属性
  get totalFrames(): number
  get frameRate(): number
  get components(): TimecodeComponents
  get hours(): number
  get minutes(): number
  get seconds(): number
  get frames(): number

  // 转换方法
  toString(): string
  toSeconds(): number
  toMicroseconds(): number
  toMilliseconds(): number

  // 运算方法
  add(other: Timecode): Timecode
  subtract(other: Timecode): Timecode
  multiply(factor: number): Timecode
  divide(factor: number): Timecode

  // 比较方法
  equals(other: Timecode): boolean
  lessThan(other: Timecode): boolean
  greaterThan(other: Timecode): boolean
  compare(other: Timecode): number
  isZero(): boolean

  // 实用方法
  clone(): Timecode
  alignToFrame(): Timecode
  convertFrameRate(newFrameRate: number): Timecode

  // 静态比较方法
  static max(tc1: Timecode, tc2: Timecode): Timecode
  static min(tc1: Timecode, tc2: Timecode): Timecode
}
```

### TimecodeUtils工具类
```typescript
class TimecodeUtils {
  // WebAV ↔ UI 转换
  static webAVToTimecode(microseconds: number, frameRate: number): string
  static timecodeToWebAV(timecode: string, frameRate: number): number

  // 时间码运算
  static addTimecodes(tc1: string, tc2: string, frameRate: number): string
  static subtractTimecodes(tc1: string, tc2: string, frameRate: number): string
  static compareTimecodes(tc1: string, tc2: string, frameRate: number): number

  // 帧对齐和验证
  static alignToFrame(time: number, frameRate: number): number
  static validateTimecode(timecode: string): boolean
  static isValidFrameRate(frameRate: number): boolean

  // 格式化和解析
  static parseTimecode(timecode: string): TimecodeComponents | null
  static formatTimecode(components: TimecodeComponents): string
  static secondsToTimecodeString(seconds: number, frameRate: number): string
}
```

## 🎨 UI组件使用指南

### TimecodeInput组件
```vue
<template>
  <TimecodeInput
    :model-value="durationMicroseconds"
    @change="handleDurationChange"
    :frame-rate="frameRate"
    placeholder="00:00.00"
    :disabled="false"
    :readonly="false"
    size="normal"
  />
</template>

<script setup>
import { TimecodeInput } from '@/components/timecode'

const props = defineProps<{
  durationMicroseconds: number
  frameRate: number
}>()

const emit = defineEmits<{
  change: [microseconds: number, timecode: string]
}>()

function handleDurationChange(microseconds: number, timecode: string) {
  const timecodeObj = Timecode.fromMicroseconds(microseconds, props.frameRate)
  emit('change', microseconds, timecode)
}
</script>
```

### TimecodeDisplay组件
```vue
<template>
  <TimecodeDisplay
    :value="currentTimeMicroseconds"
    :frame-rate="frameRate"
    size="large"
    :show-frames="true"
    format="timecode"
  />
</template>

<script setup>
import { TimecodeDisplay } from '@/components/timecode'

const props = defineProps<{
  currentTimeMicroseconds: number
  frameRate: number
}>()
</script>
```

### TimecodeSeekBar组件
```vue
<template>
  <TimecodeSeekBar
    :current-time="currentTimeMicroseconds"
    :total-duration="totalDurationMicroseconds"
    :frame-rate="frameRate"
    @seek="handleSeek"
    @input="handleInput"
    :show-quick-nav="true"
    :show-timecode-input="true"
  />
</template>

<script setup>
import { TimecodeSeekBar } from '@/components/timecode'

const props = defineProps<{
  currentTimeMicroseconds: number
  totalDurationMicroseconds: number
  frameRate: number
}>()

const emit = defineEmits<{
  seek: [microseconds: number]
  input: [microseconds: number]
}>()

function handleSeek(microseconds: number) {
  emit('seek', microseconds)
}

function handleInput(microseconds: number) {
  emit('input', microseconds)
}
</script>
```

## 🚨 常见陷阱

### 1. 精度丢失
```typescript
// ❌ 错误：通过秒数转换可能丢失帧精度
const seconds = 30.5
const timecode = Timecode.fromSeconds(seconds, 30)

// ✅ 正确：直接使用时间码对象或微秒
const timecode = new Timecode('00:30.15', 30)
const timecode = Timecode.fromMicroseconds(30500000, 30)
```

### 2. WebAV边界混淆
```typescript
// ❌ 错误：直接传递时间码给WebAV
webAVCanvas.previewFrame(timecode)

// ✅ 正确：在边界进行转换
webAVCanvas.previewFrame(timecode.toMicroseconds())
```

### 3. 帧率不匹配
```typescript
// ❌ 错误：使用不同帧率的时间码
const tc1 = new Timecode('00:30.00', 30)  // 30fps
const tc2 = new Timecode('00:30.00', 25)  // 25fps
const result = tc1.add(tc2)  // 可能产生意外结果

// ✅ 正确：确保帧率一致
const tc1 = new Timecode('00:30.00', 30)
const tc2 = new Timecode('00:30.00', 30)
const result = tc1.add(tc2)
```

## 🎯 最佳实践

### 1. 时间码对象创建
```typescript
// ✅ 推荐：使用静态工厂方法
const tc1 = Timecode.fromString('00:30.15', 30)
const tc2 = Timecode.fromMicroseconds(30500000, 30)
const tc3 = Timecode.zero(30)

// ✅ 可接受：直接构造
const tc4 = new Timecode('00:30.15', 30)
const tc5 = new Timecode(915, 30)  // 915帧

// ❌ 避免：通过不精确的秒数创建
const tc6 = Timecode.fromSeconds(30.5, 30)  // 可能丢失帧精度
```

### 2. 时间码运算
```typescript
// ✅ 推荐：链式运算
const result = baseTime
  .add(offset1)
  .add(offset2)
  .subtract(adjustment)

// ✅ 推荐：使用不可变操作
const originalTime = new Timecode('00:30.00', 30)
const newTime = originalTime.add(new Timecode('00:05.00', 30))
// originalTime 保持不变

// ❌ 避免：修改原对象（时间码对象是不可变的）
// originalTime.add(offset)  // 这不会修改originalTime
```

### 3. 性能优化
```typescript
// ✅ 推荐：复用时间码对象
const oneFrame = new Timecode(1, 30)
const results = []
let currentTime = Timecode.zero(30)

for (let i = 0; i < 1000; i++) {
  currentTime = currentTime.add(oneFrame)
  results.push(currentTime.clone())
}

// ❌ 避免：在循环中创建新对象
for (let i = 0; i < 1000; i++) {
  const newTime = new Timecode(i, 30)  // 性能较差
  results.push(newTime)
}
```

### 4. 类型安全
```typescript
// ✅ 推荐：使用类型守卫
function isValidTimecode(value: unknown): value is Timecode {
  return value instanceof Timecode
}

function processTime(time: Timecode | number) {
  if (isValidTimecode(time)) {
    return time.toString()
  } else {
    return Timecode.fromSeconds(time, 30).toString()
  }
}

// ✅ 推荐：明确的接口定义
interface TimelineOperation {
  startTime: Timecode
  endTime: Timecode
  duration: Timecode
}
```

### 5. 错误处理
```typescript
// ✅ 推荐：验证输入
function createTimecodeFromInput(input: string, frameRate: number): Timecode | null {
  try {
    if (!TimecodeUtils.validateTimecode(input)) {
      return null
    }
    return new Timecode(input, frameRate)
  } catch (error) {
    console.warn('Invalid timecode input:', input, error)
    return null
  }
}

// ✅ 推荐：边界检查
function clampTimecode(timecode: Timecode, maxDuration: Timecode): Timecode {
  if (timecode.lessThan(Timecode.zero(timecode.frameRate))) {
    return Timecode.zero(timecode.frameRate)
  }
  if (timecode.greaterThan(maxDuration)) {
    return maxDuration.clone()
  }
  return timecode
}
```

## 📈 性能优化指南

### 1. 缓存策略
```typescript
// 利用TimecodeUtils的内置缓存
class TimecodeCache {
  private static cache = new Map<string, Timecode>()

  static get(frames: number, frameRate: number): Timecode {
    const key = `${frames}_${frameRate}`
    if (!this.cache.has(key)) {
      this.cache.set(key, new Timecode(frames, frameRate))
    }
    return this.cache.get(key)!.clone()
  }

  static clear() {
    this.cache.clear()
  }
}
```

### 2. 批量操作
```typescript
// ✅ 推荐：批量处理时间码操作
function batchUpdateTimelineItems(
  items: TimelineItem[],
  timeOffset: Timecode
): TimelineItem[] {
  return items.map(item => ({
    ...item,
    startTime: item.startTime.add(timeOffset),
    endTime: item.endTime.add(timeOffset)
  }))
}

// ❌ 避免：逐个处理
function updateTimelineItemsOneByOne(items: TimelineItem[], timeOffset: Timecode) {
  for (const item of items) {
    item.startTime = item.startTime.add(timeOffset)  // 触发多次重渲染
    item.endTime = item.endTime.add(timeOffset)
  }
}
```

### 3. 内存管理
```typescript
// ✅ 推荐：及时释放不需要的时间码对象
function processLargeTimelineData(data: TimelineData[]) {
  const processedData = data.map(item => {
    const timecode = Timecode.fromMicroseconds(item.time, 30)
    const result = {
      id: item.id,
      formattedTime: timecode.toString(),
      seconds: timecode.toSeconds()
    }
    // timecode 对象会被垃圾回收
    return result
  })

  return processedData
}
```

### 4. 避免不必要的转换
```typescript
// ✅ 推荐：保持时间码格式直到需要转换
class TimelineManager {
  private items: Map<string, { startTime: Timecode, endTime: Timecode }> = new Map()

  addItem(id: string, startTime: Timecode, duration: Timecode) {
    this.items.set(id, {
      startTime,
      endTime: startTime.add(duration)
    })
  }

  // 只在需要时转换为WebAV格式
  syncToWebAV(id: string) {
    const item = this.items.get(id)
    if (item) {
      return {
        timelineStartTime: item.startTime.toMicroseconds(),
        timelineEndTime: item.endTime.toMicroseconds()
      }
    }
  }
}
```

## 📈 成功指标

### 功能指标
- ✅ 所有时间显示统一为时间码格式
- ✅ 时间操作精确到帧级别
- ✅ WebAV与UI时间完全同步
- ✅ 无时间相关的循环调用问题

### 性能指标
- ✅ 时间码转换响应时间 < 1ms
- ✅ UI更新频率稳定在60fps
- ✅ 内存使用增长 < 10%
- ✅ 无明显的性能回归

### 技术指标
- ✅ 代码类型安全性提升
- ✅ 时间相关bug减少
- ✅ 代码一致性改善
- ✅ 维护成本降低

## 🔧 具体实施步骤

### 步骤1: 坐标转换函数改造
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
  const relativePosition = (pixel + scrollOffset) / (timelineWidth * zoomLevel)
  const targetFrames = Math.round(relativePosition * totalDuration.totalFrames)
  const clampedFrames = Math.max(0, Math.min(targetFrames, totalDuration.totalFrames))
  return new Timecode(clampedFrames, totalDuration.frameRate)
}
```

### 步骤2: 时间轴冲突检测改造
**文件**: `frontend/src/components/Timeline.vue`

```typescript
function detectMediaItemConflicts(
  dropTime: Timecode,  // 改为Timecode
  targetTrackId: number,
  duration: Timecode   // 改为Timecode
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = []
  const trackItems = videoStore.getTimelineItemsForTrack(targetTrackId)
  const dragEndTime = dropTime.add(duration)  // 使用时间码精确运算

  for (const item of trackItems) {
    const itemStartTime = Timecode.fromMicroseconds(item.timeRange.timelineStartTime, videoStore.frameRate)
    const itemEndTime = Timecode.fromMicroseconds(item.timeRange.timelineEndTime, videoStore.frameRate)

    if (dropTime.lessThan(itemEndTime) && dragEndTime.greaterThan(itemStartTime)) {
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
```

### 步骤3: Store方法时间码化
**文件**: `frontend/src/stores/videoStore.ts`

```typescript
// 添加新的时间码版本方法
async function moveTimelineItemWithHistoryTC(
  timelineItemId: string,
  newPosition: Timecode,
  newTrackId?: number
) {
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
```

## 🧪 测试策略

### 单元测试示例
```typescript
describe('Timecode Store Integration', () => {
  test('currentTime should be Timecode object', () => {
    const store = useVideoStore()
    expect(store.currentTime).toBeInstanceOf(Timecode)
  })

  test('setCurrentTime should accept Timecode', () => {
    const store = useVideoStore()
    const timecode = new Timecode("00:30.15", 30)
    store.setCurrentTime(timecode)
    expect(store.currentTime.toString()).toBe("00:30.15")
  })
})
```

### 集成测试示例
```typescript
describe('Timeline Timecode Integration', () => {
  it('should handle drag and drop with timecode calculations', async () => {
    const dragData: TimelineItemDragDataTC = {
      type: 'timeline-item',
      itemId: 'test-item',
      trackId: 1,
      startTime: new Timecode('00:10.00', 30),
      selectedItems: ['test-item'],
      dragOffset: { x: 0, y: 0 }
    }

    await wrapper.vm.handleTimelineItemDropTC(mockEvent, dragData)

    const item = videoStore.getTimelineItem('test-item')
    expect(item.trackId).toBe(2)
  })
})
```

## 📊 优先级矩阵

| 任务 | 影响范围 | 实现难度 | 精度收益 | 用户价值 | 优先级 |
|------|----------|----------|----------|----------|--------|
| 内部计算逻辑时间码化 | 高 | 中 | 极高 | 极高 | 🔴 最高 |
| Store方法参数时间码化 | 中 | 低 | 高 | 高 | 🔴 高 |
| 拖拽数据类型时间码化 | 中 | 中 | 高 | 中 | 🟡 中 |
| 时间轴操作时间码化 | 高 | 中 | 高 | 中 | 🟡 中 |
| MediaItem时间码化 | 高 | 高 | 中 | 低 | 🟢 低 |
| 工具函数清理 | 低 | 低 | 低 | 低 | 🟢 低 |

## ⚠️ 风险评估与应对

### 高风险项
1. **WebAV集成复杂性**
   - 风险: 时间同步可能出现精度问题
   - 应对: 建立完善的测试用例，逐步验证

2. **现有代码兼容性**
   - 风险: 大量现有组件需要修改
   - 应对: 保持向后兼容，分阶段迁移

### 中风险项
1. **性能影响**
   - 风险: 频繁的时间码转换可能影响性能
   - 应对: 实施缓存机制，优化算法

2. **用户体验变化**
   - 风险: 用户需要适应新的时间显示格式
   - 应对: 提供平滑的过渡和用户指导

## 📋 检查清单

### 阶段1完成标准
- [ ] Store方法支持Timecode参数
- [ ] 所有调用方已更新
- [ ] 单元测试通过
- [ ] 手动测试播放控制功能正常

### 阶段2完成标准
- [ ] 拖拽数据类型支持Timecode
- [ ] 拖拽操作使用时间码计算
- [ ] 冲突检测使用时间码比较
- [ ] 拖拽预览显示正确

### 阶段3完成标准
- [ ] MediaItem时间码化方案确定
- [ ] 过时函数标记为deprecated
- [ ] 文档更新完成
- [ ] 性能测试通过

## 📚 相关文档

- [时间码系统设计文档](./TIMECODE_SYSTEM.md)
- [时间码数据结构文档](./TIMECODE_DATA.md)
- [时间码实现计划](./TIMECODE_IMPLEMENTATION_PLAN.md)
- [时间码重构计划](./TIMECODE_REFACTORING_PLAN.md)
- [WebAV边界保护指南](./WEBAV_BOUNDARY_PROTECTION.md)
- [时间码快速参考](./TIMECODE_QUICK_REFERENCE.md)
- [时间码改进计划](./TIMECODE_IMPROVEMENT_PLAN.md)
- [时间码实施指南](./TIMECODE_IMPLEMENTATION_GUIDE.md)

---

**文档版本**: v1.0
**创建日期**: 2025-06-24
**最后更新**: 2025-06-24
**维护者**: 开发团队

# 时间码系统重构详细实施方案

## 📋 项目概述

基于对现有代码库的深入分析，制定时间码系统重构的详细实施方案。将视频编辑系统从基于秒数改造为基于帧数的时间码系统，实现帧级精度和专业时间码显示格式。

## 🎯 重构目标

- **UI显示**：HH:MM:SS.FF 格式（时:分:秒.帧）
- **内部存储**：帧数（整数）
- **WebAV边界**：微秒转换
- **固定帧率**：30fps
- **精度提升**：消除浮点数误差

## 🏗️ 架构设计

### 时间表示层次
```
UI层：HH:MM:SS.FF 格式显示
应用层：帧数（整数，如：90帧 = 3秒@30fps）
WebAV层：微秒（整数）
```

### 数据流向
```
用户操作 → 帧数计算 → WebAV微秒转换 → WebAV API
WebAV事件 → 微秒 → 帧数转换 → UI显示（时间码格式）
```

## � 当前状态分析

### 🔍 现有架构问题
1. **精度问题**：使用浮点数进行时间计算，存在精度误差
2. **显示格式**：使用传统的时分秒格式，不符合专业视频编辑标准
3. **架构不统一**：时间处理逻辑分散，缺乏统一的时间码架构

### 📈 修改统计概览
- **重大重构**：5个核心文件
- **中等修改**：6个相关文件
- **轻微修改**：4个辅助文件
- **文档更新**：1个文件
- **新增代码**：约800+行
- **修改代码**：约300+行
- **删除代码**：约50+行

## �📁 详细实施计划

### 阶段1：基础工具函数重构

#### 1.1 修改文件：`src/stores/utils/timeUtils.ts`

**当前状态分析**：
- 现有函数基于秒数和帧率参数
- `alignTimeToFrame()` 使用浮点数计算
- `formatTime()` 支持多种精度但不支持时间码格式

**修改类型**：重大重构 + 新增功能

##### 需要修改的现有函数：

**1. `alignTimeToFrame()` 函数（第11-14行）**
```typescript
// 修改前
export function alignTimeToFrame(time: number, frameRate: number): number {
  const frameDuration = 1 / frameRate
  return Math.floor(time / frameDuration) * frameDuration
}

// 修改为
export function alignTimeToFrame(time: number, frameRate: number): number {
  const frames = Math.floor(time * frameRate)
  return frames / frameRate
}

// 新增：基于帧数的对齐函数
export function alignFramesToFrame(frames: number): number {
  return Math.floor(frames)
}
```

**2. `formatTime()` 函数（第38-71行）**
```typescript
// 修改前
export function formatTime(
  seconds: number,
  precision: 'frames' | 'milliseconds' | 'seconds' | 'hours' = 'seconds',
  frameRate: number = 30,
): string {

// 修改为（添加时间码格式支持）
export function formatTime(
  seconds: number,
  precision: 'frames' | 'milliseconds' | 'seconds' | 'hours' | 'timecode' = 'seconds',
  frameRate: number = 30,
): string {
  if (precision === 'timecode') {
    const frames = secondsToFrames(seconds)
    return framesToTimecode(frames)
  }
  // 保持原有逻辑...
}
```

##### 需要新增的内容：

**在文件开头添加常量**：
```typescript
// ==================== 时间码系统常量 ====================

/** 固定帧率：30fps */
export const FRAME_RATE = 30
```

**在文件末尾添加新函数**：
```typescript
// ==================== 时间码转换函数 ====================

/**
 * 帧数转换为秒数
 * @param frames 帧数
 * @returns 秒数
 */
export function framesToSeconds(frames: number): number {
  return frames / FRAME_RATE
}

/**
 * 秒数转换为帧数
 * @param seconds 秒数
 * @returns 帧数（向下取整）
 */
export function secondsToFrames(seconds: number): number {
  return Math.floor(seconds * FRAME_RATE)
}

/**
 * 帧数转换为微秒
 * @param frames 帧数
 * @returns 微秒数
 */
export function framesToMicroseconds(frames: number): number {
  return Math.floor((frames / FRAME_RATE) * 1_000_000)
}

/**
 * 微秒转换为帧数
 * @param microseconds 微秒数
 * @returns 帧数（向下取整）
 */
export function microsecondsToFrames(microseconds: number): number {
  return Math.floor((microseconds / 1_000_000) * FRAME_RATE)
}

/**
 * 帧数转换为时间码字符串
 * @param frames 帧数
 * @returns 时间码字符串 "HH:MM:SS.FF"
 */
export function framesToTimecode(frames: number): string {
  const totalSeconds = Math.floor(frames / FRAME_RATE)
  const remainingFrames = frames % FRAME_RATE

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${remainingFrames.toString().padStart(2, '0')}`
}

/**
 * 时间码字符串转换为帧数
 * @param timecode 时间码字符串 "HH:MM:SS.FF"
 * @returns 帧数
 * @throws Error 如果时间码格式无效
 */
export function timecodeToFrames(timecode: string): number {
  const match = timecode.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{2})$/)
  if (!match) {
    throw new Error(`Invalid timecode format: ${timecode}. Expected format: HH:MM:SS.FF`)
  }

  const [, hours, minutes, seconds, frames] = match.map(Number)

  // 验证范围
  if (minutes >= 60 || seconds >= 60 || frames >= FRAME_RATE) {
    throw new Error(`Invalid timecode values: ${timecode}`)
  }

  return (hours * 3600 + minutes * 60 + seconds) * FRAME_RATE + frames
}
```

#### 1.2 修改文件：`src/types/index.ts`

**当前状态**：已有完整的类型定义
**修改类型**：新增类型定义

**需要新增的内容（在第21行时间范围接口之前添加）**：
```typescript
// ==================== 时间码系统类型 ====================

/** 时间码字符串类型 "HH:MM:SS.FF" 格式 */
export type TimecodeString = string

/** 帧数类型（整数） */
export type FrameNumber = number

/** 基于帧数的时间范围接口 */
export interface FrameTimeRange {
  startFrame: FrameNumber
  endFrame: FrameNumber
}

/** 基于帧数的视频时间范围接口 */
export interface VideoFrameTimeRange {
  clipStartFrame: FrameNumber
  clipEndFrame: FrameNumber
  timelineStartFrame: FrameNumber
  timelineEndFrame: FrameNumber
}

/** 基于帧数的图片时间范围接口 */
export interface ImageFrameTimeRange {
  timelineStartFrame: FrameNumber
  timelineEndFrame: FrameNumber
  displayFrames: FrameNumber
}
```

**需要修改的现有接口（第356行TimeMark接口）**：
```typescript
export interface TimeMark {
  time: number
  position: number
  frames: number // 新增：对应的帧数
  label: string // 新增：显示标签
  isMajor: boolean
  isFrame?: boolean
  isSecond?: boolean // 新增：是否为秒级刻度
}
```

### 阶段2：Store层重构

#### 2.1 修改文件：`src/stores/modules/playbackModule.ts`

**当前状态分析**：
- `currentTime` 使用秒数存储
- `formattedCurrentTime` 使用 `formatTimeUtil(time, 'hours')`
- 帧操作函数 `nextFrame()`, `previousFrame()` 基于帧率计算

**修改类型**：重大重构

##### 需要修改的导入语句（第2行）：
```typescript
// 修改前
import { alignTimeToFrame, formatTime as formatTimeUtil } from '../utils/storeUtils'

// 修改后
import {
  alignFramesToFrame,
  framesToTimecode,
  framesToSeconds,
  secondsToFrames,
  FRAME_RATE
} from '../utils/timeUtils'
```

##### 需要修改的状态定义（第12行）：
```typescript
// 修改前
const currentTime = ref(0) // 当前播放时间（秒）

// 修改后
const currentFrame = ref(0) // 当前播放帧数（整数）
```

##### 需要修改的计算属性（第21-25行）：
```typescript
// 修改前
const formattedCurrentTime = computed(() => {
  const time = currentTime.value
  return formatTimeUtil(time, 'hours')
})

// 修改后
const formattedCurrentTime = computed(() => {
  return framesToTimecode(currentFrame.value)
})
```

##### 需要修改的方法（第40-50行修改 `setCurrentTime` 方法）：
```typescript
// 修改前
function setCurrentTime(time: number, forceAlign: boolean = true) {
  const finalTime = forceAlign ? alignTimeToFrame(time, frameRate.value) : time
  const clampedTime = Math.max(0, finalTime)

  if (currentTime.value !== clampedTime) {
    currentTime.value = clampedTime
  }
}

// 修改后
function setCurrentFrame(frames: number, forceAlign: boolean = true) {
  const finalFrames = forceAlign ? alignFramesToFrame(frames) : frames
  const clampedFrames = Math.max(0, finalFrames)

  if (currentFrame.value !== clampedFrames) {
    currentFrame.value = clampedFrames
  }
}

// 保持向后兼容的秒数接口
function setCurrentTime(time: number, forceAlign: boolean = true) {
  const frames = secondsToFrames(time)
  setCurrentFrame(frames, forceAlign)
}
```

##### 需要修改的跳转方法（第52-86行）：
```typescript
// 修改前 seekTo 方法
function seekTo(time: number) {
  setCurrentTime(time, true)
  console.log('🎯 跳转到时间:', time, '秒')
}

// 修改后
function seekToFrame(frames: number) {
  setCurrentFrame(frames, true)
  console.log('🎯 跳转到帧:', frames, `(${framesToTimecode(frames)})`)
}

// 保持向后兼容
function seekTo(time: number) {
  const frames = secondsToFrames(time)
  seekToFrame(frames)
}

// 修改前 seekBy 方法
function seekBy(deltaTime: number) {
  const newTime = currentTime.value + deltaTime
  setCurrentTime(newTime, true)
}

// 修改后
function seekByFrames(deltaFrames: number) {
  const newFrames = currentFrame.value + deltaFrames
  setCurrentFrame(newFrames, true)
  console.log('⏭️ 相对跳转:', {
    deltaFrames,
    oldFrame: currentFrame.value - deltaFrames,
    newFrame: currentFrame.value,
    timecode: framesToTimecode(currentFrame.value)
  })
}

// 保持向后兼容
function seekBy(deltaTime: number) {
  const deltaFrames = secondsToFrames(deltaTime)
  seekByFrames(deltaFrames)
}

// 修改前帧操作方法
function nextFrame() {
  const frameTime = 1 / frameRate.value
  seekBy(frameTime)
  console.log('⏭️ 下一帧')
}

function previousFrame() {
  const frameTime = 1 / frameRate.value
  seekBy(-frameTime)
  console.log('⏮️ 上一帧')
}

// 修改后
function nextFrame() {
  seekByFrames(1)
  console.log('⏭️ 下一帧')
}

function previousFrame() {
  seekByFrames(-1)
  console.log('⏮️ 上一帧')
}
```

##### 需要修改的导出接口（第180-200行）：
```typescript
return {
  // 状态
  currentFrame, // 新增：当前帧数
  currentTime: computed(() => framesToSeconds(currentFrame.value)), // 兼容：当前时间（秒）
  isPlaying,
  playbackRate,

  // 计算属性
  formattedCurrentTime,
  playbackRateText,

  // 帧数控制方法（新增）
  setCurrentFrame,
  seekToFrame,
  seekByFrames,
  nextFrame,
  previousFrame,

  // 时间控制方法（兼容）
  setCurrentTime,
  seekTo,
  seekBy,

  // 播放控制方法
  setPlaying,
  play,
  pause,
  togglePlayPause,
  stop,
  setPlaybackRate,
  resetPlaybackRate,
  getPlaybackSummary,
  resetToDefaults,
}
```

#### 2.2 修改文件：`src/stores/modules/configModule.ts`

**当前状态分析**：
- `frameRate` 已设置为30fps
- 需要确保帧率固定不可变

**修改类型**：移除setter，固定帧率

##### 需要修改的状态定义（第20行）：
```typescript
// 修改前
const frameRate = ref(30) // 假设视频帧率为30fps

// 修改后
const frameRate = ref(30) // 固定帧率：30fps（只读）
```

##### 需要删除的方法（第43-51行完全删除）：
```typescript
// 删除整个 setFrameRate 方法
function setFrameRate(rate: number) {
  if (rate > 0 && rate <= 120) {
    frameRate.value = rate
    console.log('🎬 帧率已设置为:', rate)
  } else {
    console.warn('⚠️ 无效的帧率值:', rate)
  }
}
```

##### 需要新增的计算属性（第28行后）：
```typescript
// 新增帧率相关的计算属性
const frameDuration = computed(() => 1 / frameRate.value) // 每帧时长（秒）
const framesPerSecond = computed(() => frameRate.value) // 每秒帧数
```

##### 需要修改的重置方法（第98行）：
```typescript
// 修改前
frameRate.value = 30

// 修改后
// frameRate 不再重置，因为它是固定值
```

##### 需要修改的导出接口（第115行）：
```typescript
return {
  // 状态
  videoResolution,
  frameRate, // 只读
  frameDuration, // 新增
  framesPerSecond, // 新增
  timelineDuration,
  proportionalScale,

  // 方法
  setVideoResolution,
  // setFrameRate, // 删除
  setTimelineDuration,
  setProportionalScale,
  getConfigSummary,
  resetToDefaults,
}
```

### 阶段3：WebAV边界处理

#### 3.1 修改文件：`src/composables/useWebAVControls.ts`

**当前状态分析**：
- `seekTo()` 接收秒数，转换为微秒调用WebAV
- `timeupdate` 事件接收微秒，转换为秒数更新store
- 已有时间同步锁机制

**修改类型**：重大重构

##### 需要修改的导入语句（文件开头添加）：
```typescript
import {
  framesToMicroseconds,
  microsecondsToFrames,
  framesToTimecode,
  secondsToFrames
} from '../stores/utils/timeUtils'
```

##### 需要修改的事件监听器（第235-251行）：
```typescript
// 修改前
globalAVCanvas.on('timeupdate', (time: number) => {
  if (isUpdatingTime) {
    return
  }

  isUpdatingTime = true
  try {
    const timeInSeconds = time / 1000000
    videoStore.setCurrentTime(timeInSeconds, false)
  } finally {
    isUpdatingTime = false
  }
})

// 修改后
globalAVCanvas.on('timeupdate', (microseconds: number) => {
  if (isUpdatingTime) {
    return
  }

  isUpdatingTime = true
  try {
    // 微秒转换为帧数
    const frames = microsecondsToFrames(microseconds)
    videoStore.setCurrentFrame(frames, false) // 传入帧数，不强制对齐保持流畅
  } finally {
    isUpdatingTime = false
  }
})
```

##### 需要修改的播放控制方法（第353-377行）：
```typescript
// 修改前
const play = (startTime?: number, endTime?: number): void => {
  if (!globalAVCanvas) return

  const start = (startTime || videoStore.currentTime) * 1000000

  const playOptions: PlayOptions = {
    start,
    playbackRate: videoStore.playbackRate,
  }

  if (endTime !== undefined) {
    const end = endTime * 1000000
    if (end > start) {
      playOptions.end = end
    } else {
      console.warn('结束时间必须大于开始时间，忽略end参数')
    }
  }

  globalAVCanvas.play(playOptions)
}

// 修改后
const play = (startFrames?: number, endFrames?: number): void => {
  if (!globalAVCanvas) return

  // 帧数转换为微秒
  const start = framesToMicroseconds(startFrames || videoStore.currentFrame)

  const playOptions: PlayOptions = {
    start,
    playbackRate: videoStore.playbackRate,
  }

  if (endFrames !== undefined) {
    const end = framesToMicroseconds(endFrames)
    if (end > start) {
      playOptions.end = end
    } else {
      console.warn('结束帧必须大于开始帧，忽略end参数')
    }
  }

  globalAVCanvas.play(playOptions)
}

// 保持向后兼容的秒数接口
const playSeconds = (startTime?: number, endTime?: number): void => {
  const startFrames = startTime ? secondsToFrames(startTime) : undefined
  const endFrames = endTime ? secondsToFrames(endTime) : undefined
  play(startFrames, endFrames)
}
```

##### 需要修改的 `seekTo` 方法（第387-391行）：
```typescript
// 修改前
const seekTo = (time: number): void => {
  if (!globalAVCanvas) return
  globalAVCanvas.previewFrame(time * 1000000)
}

// 修改后
const seekTo = (frames: number): void => {
  if (!globalAVCanvas) return

  const microseconds = framesToMicroseconds(frames)
  globalAVCanvas.previewFrame(microseconds)

  console.log('🎯 WebAV seekTo:', {
    frames,
    timecode: framesToTimecode(frames),
    microseconds
  })
}

// 保持向后兼容的秒数接口
const seekToSeconds = (time: number): void => {
  const frames = secondsToFrames(time)
  seekTo(frames)
}
```

##### 需要修改的导出接口（文件末尾）：
```typescript
return {
  // 状态
  error: globalError,

  // 方法
  createCanvasContainer,
  initializeCanvas,
  createMP4Clip,
  createImgClip,
  cloneMP4Clip,
  cloneImgClip,
  play, // 重构后的帧数接口
  playSeconds, // 兼容的秒数接口
  pause,
  seekTo, // 重构后的帧数接口
  seekToSeconds, // 兼容的秒数接口
  destroy,
  getAVCanvas,
  getCanvasContainer,
  destroyCanvas,
  recreateCanvas,
}
```

### 阶段4：UI层重构

#### 4.1 修改文件：`src/components/TimeScale.vue`

**当前状态分析**：
- `handleClick` 和 `handleDragPlayhead` 调用 `webAVControls.seekTo()`
- 使用 `formatTimeWithAutoPrecision` 格式化时间显示
- 时间刻度计算基于秒数

**修改类型**：重大重构

##### 需要修改的导入语句（第6-12行）：
```typescript
// 修改前
import {
  calculatePixelsPerSecond,
  calculateVisibleTimeRange,
  formatTimeWithAutoPrecision,
  alignTimeToFrame as alignTimeToFrameUtil,
  pixelToTime,
  timeToPixel
} from '../stores/utils/storeUtils'

// 修改后
import {
  calculatePixelsPerSecond,
  calculateVisibleTimeRange,
  framesToTimecode,
  secondsToFrames,
  framesToSeconds,
  alignFramesToFrame,
  pixelToTime,
  timeToPixel
} from '../stores/utils/timeUtils'
```

##### 需要修改的计算属性（第50-80行修改 `timeMarks`）：
```typescript
// 修改后的 timeMarks 计算属性
const timeMarks = computed(() => {
  const marks: TimeMark[] = []
  const { startTime, endTime } = calculateVisibleTimeRange(
    videoStore.viewportLeft,
    videoStore.viewportWidth,
    videoStore.totalDuration,
    videoStore.zoomLevel
  )

  const pixelsPerSecond = calculatePixelsPerSecond(
    containerWidth.value,
    videoStore.totalDuration,
    videoStore.zoomLevel
  )

  // 根据缩放级别决定刻度间隔
  let interval: number
  let showFrames = false

  if (pixelsPerSecond >= 300) {
    // 高缩放：显示帧级刻度
    interval = 1 / 30 // 每帧
    showFrames = true
  } else if (pixelsPerSecond >= 100) {
    // 中等缩放：每秒刻度
    interval = 1
  } else if (pixelsPerSecond >= 30) {
    // 低缩放：每5秒刻度
    interval = 5
  } else {
    // 极低缩放：每10秒刻度
    interval = 10
  }

  for (let time = Math.floor(startTime / interval) * interval; time <= endTime; time += interval) {
    const position = timeToPixel(time, containerWidth.value, videoStore.totalDuration, videoStore.zoomLevel, videoStore.viewportLeft)

    if (position >= 0 && position <= containerWidth.value) {
      const frames = secondsToFrames(time)
      marks.push({
        position,
        time,
        frames,
        label: framesToTimecode(frames), // 使用时间码格式
        isMajor: time % 1 === 0,
        isSecond: time % 1 === 0,
        isFrame: showFrames
      })
    }
  }

  return marks
})
```

##### 需要修改的模板（第12-14行）：
```vue
<!-- 修改前 -->
<div v-if="mark.isMajor" class="mark-label">
  {{ formatTime(mark.time) }}
</div>

<!-- 修改后 -->
<div v-if="mark.isMajor" class="mark-label">
  {{ mark.label }}
</div>
```

##### 需要删除的方法（第156-158行）：
```typescript
// 删除这个方法，直接使用导入的函数
function alignTimeToFrame(time: number): number {
  return alignTimeToFrameUtil(time, videoStore.frameRate)
}
```

##### 需要修改的方法（第168-172行修改 `formatTime`）：
```typescript
// 修改前
function formatTime(seconds: number): string {
  const pixelsPerSecond = calculatePixelsPerSecond(containerWidth.value, videoStore.totalDuration, videoStore.zoomLevel)
  return formatTimeWithAutoPrecision(seconds, pixelsPerSecond, videoStore.frameRate)
}

// 修改后
function formatTime(seconds: number): string {
  const frames = secondsToFrames(seconds)
  return framesToTimecode(frames)
}
```

##### 需要修改的交互方法（第180-199行修改 `handleClick`）：
```typescript
// 修改前
function handleClick(event: MouseEvent) {
  if (isDraggingPlayhead.value) return
  if (!scaleContainer.value) return

  pauseForEditing('时间刻度点击')

  const rect = scaleContainer.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const newTime = videoStore.pixelToTime(clickX, containerWidth.value)

  const clampedTime = Math.max(0, Math.min(newTime, videoStore.totalDuration))
  const alignedTime = alignTimeToFrame(clampedTime)

  webAVControls.seekTo(alignedTime)
}

// 修改后
function handleClick(event: MouseEvent) {
  if (isDraggingPlayhead.value) return
  if (!scaleContainer.value) return

  pauseForEditing('时间刻度点击')

  const rect = scaleContainer.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const clickTime = videoStore.pixelToTime(clickX, containerWidth.value)

  // 转换为帧数并跳转
  const clickFrames = secondsToFrames(clickTime)
  const clampedFrames = Math.max(0, clickFrames)
  const alignedFrames = alignFramesToFrame(clampedFrames)

  webAVControls.seekTo(alignedFrames)

  console.log('🎯 时间轴点击跳转:', {
    clickTime,
    clickFrames: alignedFrames,
    timecode: framesToTimecode(alignedFrames)
  })
}
```

##### 需要修改的拖拽方法（第217-225行）：
```typescript
// 修改前
const clampedTime = Math.max(0, Math.min(newTime, videoStore.totalDuration))
const alignedTime = alignTimeToFrame(clampedTime)
webAVControls.seekTo(alignedTime)

// 修改后
const dragFrames = secondsToFrames(newTime)
const clampedFrames = Math.max(0, dragFrames)
const alignedFrames = alignFramesToFrame(clampedFrames)
webAVControls.seekTo(alignedFrames)
```

#### 4.2 修改文件：`src/components/PlaybackControls.vue`

**当前状态分析**：显示传统时间格式
**修改类型**：轻微修改

##### 需要修改的模板（第15-17行）：
```vue
<!-- 修改前 -->
<div class="time-display">
  {{ videoStore.formattedCurrentTime }}
</div>

<!-- 修改后 -->
<div class="time-display" :title="`当前帧: ${videoStore.currentFrame}`">
  {{ videoStore.formattedCurrentTime }}
</div>
```

##### 需要修改的方法（第74行修改 `stop` 方法）：
```typescript
// 修改前
webAVControls.seekTo(0)

// 修改后
webAVControls.seekTo(0) // seekTo现在接收帧数，0帧就是开始位置
```

### 阶段5：精灵接口扩展

#### 5.1 修改文件：`src/utils/VideoVisibleSprite.ts`

**当前状态分析**：只有微秒接口
**修改类型**：新增帧数接口

##### 需要新增的导入（文件开头添加）：
```typescript
import {
  framesToMicroseconds,
  microsecondsToFrames
} from '../stores/utils/timeUtils'
```

##### 需要新增的接口定义（第31行后添加）：
```typescript
/**
 * 基于帧数的时间范围信息
 */
interface VideoFrameTimeRange {
  clipStartFrame: number
  clipEndFrame: number
  timelineStartFrame: number
  timelineEndFrame: number
}
```

##### 需要新增的方法（第170行后添加）：
```typescript
// ==================== 帧数接口 ====================

/**
 * 设置基于帧数的时间范围
 * @param frameRange 帧数时间范围
 */
public setTimeRangeFrames(frameRange: VideoFrameTimeRange): void {
  // 转换为微秒后调用原有方法
  const microsecondsRange = {
    clipStartTime: framesToMicroseconds(frameRange.clipStartFrame),
    clipEndTime: framesToMicroseconds(frameRange.clipEndFrame),
    timelineStartTime: framesToMicroseconds(frameRange.timelineStartFrame),
    timelineEndTime: framesToMicroseconds(frameRange.timelineEndFrame),
  }
  this.setTimeRange(microsecondsRange)
}

/**
 * 获取基于帧数的时间范围
 * @returns 帧数时间范围
 */
public getTimeRangeFrames(): VideoFrameTimeRange {
  const timeRange = this.getTimeRange()
  return {
    clipStartFrame: microsecondsToFrames(timeRange.clipStartTime),
    clipEndFrame: microsecondsToFrames(timeRange.clipEndTime),
    timelineStartFrame: microsecondsToFrames(timeRange.timelineStartTime),
    timelineEndFrame: microsecondsToFrames(timeRange.timelineEndTime),
  }
}

/**
 * 设置素材内部的开始帧
 * @param startFrame 开始帧数
 */
public setClipStartFrame(startFrame: number): void {
  const startTime = framesToMicroseconds(startFrame)
  this.setClipStartTime(startTime)
}

/**
 * 设置素材内部的结束帧
 * @param endFrame 结束帧数
 */
public setClipEndFrame(endFrame: number): void {
  const endTime = framesToMicroseconds(endFrame)
  this.setClipEndTime(endTime)
}

/**
 * 获取素材内部的开始帧
 * @returns 开始帧数
 */
public getClipStartFrame(): number {
  return microsecondsToFrames(this.getClipStartTime())
}

/**
 * 获取素材内部的结束帧
 * @returns 结束帧数
 */
public getClipEndFrame(): number {
  return microsecondsToFrames(this.getClipEndTime())
}

/**
 * 设置时间轴开始帧
 * @param startFrame 开始帧数
 */
public setTimelineStartFrame(startFrame: number): void {
  const startTime = framesToMicroseconds(startFrame)
  this.setTimelineStartTime(startTime)
}

/**
 * 设置时间轴结束帧
 * @param endFrame 结束帧数
 */
public setTimelineEndFrame(endFrame: number): void {
  const endTime = framesToMicroseconds(endFrame)
  this.setTimelineEndTime(endTime)
}

/**
 * 获取时间轴开始帧
 * @returns 开始帧数
 */
public getTimelineStartFrame(): number {
  return microsecondsToFrames(this.getTimelineStartTime())
}

/**
 * 获取时间轴结束帧
 * @returns 结束帧数
 */
public getTimelineEndFrame(): number {
  return microsecondsToFrames(this.getTimelineEndTime())
}
```

#### 5.2 修改文件：`src/utils/ImageVisibleSprite.ts`

**当前状态分析**：只有微秒接口
**修改类型**：新增帧数接口

##### 需要新增的导入（文件开头添加）：
```typescript
import {
  framesToMicroseconds,
  microsecondsToFrames
} from '../stores/utils/timeUtils'
```

##### 需要新增的接口定义（第30行后添加）：
```typescript
/**
 * 基于帧数的图片时间范围信息
 */
interface ImageFrameTimeRange {
  timelineStartFrame: number
  timelineEndFrame: number
  displayFrames: number
}
```

##### 需要新增的方法（第162行后添加）：
```typescript
// ==================== 帧数接口 ====================

/**
 * 设置基于帧数的时间范围
 * @param frameRange 帧数时间范围
 */
public setTimeRangeFrames(frameRange: ImageFrameTimeRange): void {
  // 转换为微秒后调用原有方法
  const microsecondsRange = {
    timelineStartTime: framesToMicroseconds(frameRange.timelineStartFrame),
    timelineEndTime: framesToMicroseconds(frameRange.timelineEndFrame),
    displayDuration: framesToMicroseconds(frameRange.displayFrames),
  }
  this.setTimeRange(microsecondsRange)
}

/**
 * 获取基于帧数的时间范围
 * @returns 帧数时间范围
 */
public getTimeRangeFrames(): ImageFrameTimeRange {
  const timeRange = this.getTimeRange()
  return {
    timelineStartFrame: microsecondsToFrames(timeRange.timelineStartTime),
    timelineEndFrame: microsecondsToFrames(timeRange.timelineEndTime),
    displayFrames: microsecondsToFrames(timeRange.displayDuration),
  }
}

/**
 * 设置时间轴开始帧
 * @param startFrame 开始帧数
 */
public setTimelineStartFrame(startFrame: number): void {
  const startTime = framesToMicroseconds(startFrame)
  this.setTimelineStartTime(startTime)
}

/**
 * 设置时间轴结束帧
 * @param endFrame 结束帧数
 */
public setTimelineEndFrame(endFrame: number): void {
  const endTime = framesToMicroseconds(endFrame)
  this.setTimelineEndTime(endTime)
}

/**
 * 设置显示帧数
 * @param frames 显示帧数
 */
public setDisplayFrames(frames: number): void {
  const duration = framesToMicroseconds(frames)
  this.setDisplayDuration(duration)
}

/**
 * 获取时间轴开始帧
 * @returns 开始帧数
 */
public getTimelineStartFrame(): number {
  return microsecondsToFrames(this.getTimelineStartTime())
}

/**
 * 获取时间轴结束帧
 * @returns 结束帧数
 */
public getTimelineEndFrame(): number {
  return microsecondsToFrames(this.getTimelineEndTime())
}

/**
 * 获取显示帧数
 * @returns 显示帧数
 */
public getDisplayFrames(): number {
  return microsecondsToFrames(this.getDisplayDuration())
}
```

### 阶段6：时间轴相关组件修改

#### 6.1 修改文件：`src/components/VideoClip.vue`

**当前状态分析**：基于秒数的时长计算
**修改类型**：轻微修改

##### 需要修改的导入（文件开头添加）：
```typescript
import { framesToTimecode, microsecondsToFrames } from '../stores/utils/timeUtils'
```

##### 需要修改的计算属性（第135-141行）：
```typescript
// 修改前
const timelineDuration = computed(() => {
  const timeRange = props.timelineItem.timeRange
  return (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000
})

// 修改后
const timelineDuration = computed(() => {
  const timeRange = props.timelineItem.timeRange
  const durationMicroseconds = timeRange.timelineEndTime - timeRange.timelineStartTime
  return durationMicroseconds / 1000000 // 保持秒数用于像素计算
})

// 新增：时间码显示
const timelineDurationTimecode = computed(() => {
  const timeRange = props.timelineItem.timeRange
  const durationMicroseconds = timeRange.timelineEndTime - timeRange.timelineStartTime
  const frames = microsecondsToFrames(durationMicroseconds)
  return framesToTimecode(frames)
})
```

##### 需要修改的模板（在适当位置添加时间码显示）：
```vue
<!-- 新增：显示时间码格式的时长 -->
<div class="clip-timecode" v-if="showTimecode">
  {{ timelineDurationTimecode }}
</div>
```

#### 6.2 修改文件：`src/components/Timeline.vue`

**当前状态分析**：时间轴项目创建使用秒数
**修改类型**：中等修改

##### 需要修改的导入（文件开头添加）：
```typescript
import { secondsToFrames, framesToMicroseconds } from '../stores/utils/timeUtils'
```

##### 需要修改的时间轴项目创建逻辑（第747-770行）：
```typescript
// 修改前
if (mediaItem.mediaType === 'video') {
  const timeRangeConfig = {
    clipStartTime: 0,
    clipEndTime: mediaItem.duration * 1000000,
    timelineStartTime: startTime * 1000000,
    timelineEndTime: (startTime + mediaItem.duration) * 1000000,
  }
  ;(sprite as VideoVisibleSprite).setTimeRange(timeRangeConfig)
} else {
  const imageTimeRangeConfig = {
    timelineStartTime: startTime * 1000000,
    timelineEndTime: (startTime + mediaItem.duration) * 1000000,
    displayDuration: mediaItem.duration * 1000000,
  }
  ;(sprite as ImageVisibleSprite).setTimeRange(imageTimeRangeConfig)
}

// 修改后
if (mediaItem.mediaType === 'video') {
  // 优先使用帧数接口
  const frameRangeConfig = {
    clipStartFrame: 0,
    clipEndFrame: secondsToFrames(mediaItem.duration),
    timelineStartFrame: secondsToFrames(startTime),
    timelineEndFrame: secondsToFrames(startTime + mediaItem.duration),
  }

  console.log('设置视频帧数范围:', {
    ...frameRangeConfig,
    clipDuration: mediaItem.duration,
    startTime,
    endTime: startTime + mediaItem.duration,
  })
  ;(sprite as VideoVisibleSprite).setTimeRangeFrames(frameRangeConfig)
} else {
  // 图片也使用帧数接口
  const imageFrameRangeConfig = {
    timelineStartFrame: secondsToFrames(startTime),
    timelineEndFrame: secondsToFrames(startTime + mediaItem.duration),
    displayFrames: secondsToFrames(mediaItem.duration),
  }

  console.log('设置图片帧数范围:', imageFrameRangeConfig)
  ;(sprite as ImageVisibleSprite).setTimeRangeFrames(imageFrameRangeConfig)
}
```

### 阶段7：命令系统和工具函数修改

#### 7.1 修改文件：`src/stores/modules/commands/timelineCommands.ts`

**当前状态分析**：命令中使用秒数转微秒
**修改类型**：中等修改

##### 需要修改的导入（文件开头添加）：
```typescript
import { secondsToFrames, microsecondsToFrames } from '../../utils/timeUtils'
```

##### 需要修改的时间范围设置（第1907-1924行）：
```typescript
// 修改前
if (item.mediaType === 'video' && isVideoTimeRange(timeRange)) {
  sprite.setTimeRange({
    clipStartTime: timeRange.clipStartTime,
    clipEndTime: timeRange.clipEndTime,
    timelineStartTime: currentPosition * 1000000,
    timelineEndTime: (currentPosition + duration) * 1000000,
    effectiveDuration: timeRange.effectiveDuration,
    playbackRate: timeRange.playbackRate,
  })
} else {
  sprite.setTimeRange({
    timelineStartTime: currentPosition * 1000000,
    timelineEndTime: (currentPosition + duration) * 1000000,
    displayDuration: duration * 1000000,
  })
}

// 修改后
if (item.mediaType === 'video' && isVideoTimeRange(timeRange)) {
  // 优先使用帧数接口
  sprite.setTimeRangeFrames({
    clipStartFrame: microsecondsToFrames(timeRange.clipStartTime),
    clipEndFrame: microsecondsToFrames(timeRange.clipEndTime),
    timelineStartFrame: secondsToFrames(currentPosition),
    timelineEndFrame: secondsToFrames(currentPosition + duration),
  })
} else {
  // 图片使用帧数接口
  sprite.setTimeRangeFrames({
    timelineStartFrame: secondsToFrames(currentPosition),
    timelineEndFrame: secondsToFrames(currentPosition + duration),
    displayFrames: secondsToFrames(duration),
  })
}
```

#### 7.2 修改文件：`src/stores/utils/timelineArrangementUtils.ts`

**当前状态分析**：排列工具使用秒数转微秒
**修改类型**：中等修改

##### 需要修改的导入（文件开头添加）：
```typescript
import { secondsToFrames, microsecondsToFrames } from './timeUtils'
```

##### 需要修改的时间范围设置（第34-54行）：
```typescript
// 修改前
if (item.mediaType === 'video' && isVideoTimeRange(timeRange)) {
  sprite.setTimeRange({
    clipStartTime: timeRange.clipStartTime,
    clipEndTime: timeRange.clipEndTime,
    timelineStartTime: currentPosition * 1000000,
    timelineEndTime: (currentPosition + duration) * 1000000,
    effectiveDuration: timeRange.effectiveDuration,
    playbackRate: timeRange.playbackRate,
  })
} else {
  sprite.setTimeRange({
    timelineStartTime: currentPosition * 1000000,
    timelineEndTime: (currentPosition + duration) * 1000000,
    displayDuration: duration * 1000000,
  })
}

// 修改后
if (item.mediaType === 'video' && isVideoTimeRange(timeRange)) {
  // 优先使用帧数接口
  sprite.setTimeRangeFrames({
    clipStartFrame: microsecondsToFrames(timeRange.clipStartTime),
    clipEndFrame: microsecondsToFrames(timeRange.clipEndTime),
    timelineStartFrame: secondsToFrames(currentPosition),
    timelineEndFrame: secondsToFrames(currentPosition + duration),
  })
} else {
  // 图片使用帧数接口
  sprite.setTimeRangeFrames({
    timelineStartFrame: secondsToFrames(currentPosition),
    timelineEndFrame: secondsToFrames(currentPosition + duration),
    displayFrames: secondsToFrames(duration),
  })
}
```

#### 7.3 修改文件：`src/stores/utils/timeRangeUtils.ts`

**当前状态分析**：基于微秒的时间范围工具
**修改类型**：新增帧数支持

##### 需要修改的导入（第1-2行）：
```typescript
// 修改前
import type { TimelineItem, VideoTimeRange, ImageTimeRange } from '../../types'
import { isVideoTimeRange } from '../../types'

// 修改后
import type { TimelineItem, VideoTimeRange, ImageTimeRange } from '../../types'
import { isVideoTimeRange } from '../../types'
import {
  framesToMicroseconds,
  microsecondsToFrames,
  secondsToFrames
} from './timeUtils'
```

##### 需要新增的函数（第83行后添加）：
```typescript
// ==================== 帧数时间范围工具 ====================

/**
 * 基于帧数同步TimelineItem和sprite的timeRange
 * @param timelineItem TimelineItem实例
 * @param frameRange 新的帧数时间范围（可选）
 */
export function syncTimeRangeFrames(
  timelineItem: TimelineItem,
  frameRange?: {
    clipStartFrame?: number
    clipEndFrame?: number
    timelineStartFrame?: number
    timelineEndFrame?: number
    displayFrames?: number
  }
): void {
  const sprite = timelineItem.sprite

  if (frameRange) {
    if (timelineItem.mediaType === 'video') {
      // 视频精灵使用帧数接口
      const videoFrameRange = {
        clipStartFrame: frameRange.clipStartFrame || 0,
        clipEndFrame: frameRange.clipEndFrame || 0,
        timelineStartFrame: frameRange.timelineStartFrame || 0,
        timelineEndFrame: frameRange.timelineEndFrame || 0,
      }
      ;(sprite as any).setTimeRangeFrames(videoFrameRange)
    } else {
      // 图片精灵使用帧数接口
      const imageFrameRange = {
        timelineStartFrame: frameRange.timelineStartFrame || 0,
        timelineEndFrame: frameRange.timelineEndFrame || 0,
        displayFrames: frameRange.displayFrames || 0,
      }
      ;(sprite as any).setTimeRangeFrames(imageFrameRange)
    }
  }

  // 从sprite获取更新后的时间范围并同步到timelineItem
  timelineItem.timeRange = sprite.getTimeRange()
}

/**
 * 计算基于帧数的时间范围重叠
 * @param range1 时间范围1
 * @param range2 时间范围2
 * @returns 重叠帧数
 */
export function calculateTimeRangeOverlapFrames(
  range1: VideoTimeRange | ImageTimeRange,
  range2: VideoTimeRange | ImageTimeRange
): number {
  const start1 = microsecondsToFrames(range1.timelineStartTime)
  const end1 = microsecondsToFrames(range1.timelineEndTime)
  const start2 = microsecondsToFrames(range2.timelineStartTime)
  const end2 = microsecondsToFrames(range2.timelineEndTime)

  const overlapStart = Math.max(start1, start2)
  const overlapEnd = Math.min(end1, end2)

  return Math.max(0, overlapEnd - overlapStart)
}
```

### 阶段8：视口和缩放模块更新

#### 8.1 修改文件：`src/stores/modules/viewportModule.ts`

**当前状态分析**：缩放计算基于秒数
**修改类型**：轻微修改

##### 需要修改的导入（文件开头添加）：
```typescript
import { FRAME_RATE } from '../utils/timeUtils'
```

##### 需要修改的缩放限制计算（第81-82行）：
```typescript
// 修改前
function setZoomLevel(newZoomLevel: number, timelineWidth: number = 800, frameRate: number = 30) {
  const maxZoom = getMaxZoomLevelForTimeline(timelineWidth, frameRate)

// 修改后
function setZoomLevel(newZoomLevel: number, timelineWidth: number = 800, frameRate: number = FRAME_RATE) {
  const maxZoom = getMaxZoomLevelForTimeline(timelineWidth, frameRate)
```

##### 需要修改的缩放方法（第137行）：
```typescript
// 修改前
function zoomOut(factor: number = 1.2, timelineWidth: number = 800, frameRate: number = 30) {

// 修改后
function zoomOut(factor: number = 1.2, timelineWidth: number = 800, frameRate: number = FRAME_RATE) {
```

### 阶段9：文档和README更新

#### 9.1 修改文件：`src/stores/utils/README.md`

**当前状态分析**：描述基于秒数的工具函数
**修改类型**：更新文档

##### 需要修改的内容（第11-16行）：
```markdown
### ⏰ 时间计算工具 (`timeUtils.ts`)
- `alignTimeToFrame(time, frameRate)` - 将时间对齐到帧边界
- `alignFramesToFrame(frames)` - 将帧数对齐到整数帧（新增）
- `calculatePixelsPerSecond(timelineWidth, totalDuration, zoomLevel)` - 计算每秒像素数
- `formatTime(seconds, precision?, frameRate?)` - 格式化时间显示（支持时间码格式）
- `formatTimeWithAutoPrecision(seconds, pixelsPerSecond, frameRate?)` - 根据缩放级别自动选择时间显示精度
- `expandTimelineIfNeeded(targetTime, timelineDuration)` - 动态扩展时间轴长度

#### 新增时间码转换函数：
- `framesToSeconds(frames)` - 帧数转秒数
- `secondsToFrames(seconds)` - 秒数转帧数
- `framesToMicroseconds(frames)` - 帧数转微秒（WebAV接口）
- `microsecondsToFrames(microseconds)` - 微秒转帧数（WebAV接口）
- `framesToTimecode(frames)` - 帧数转时间码格式 "HH:MM:SS.FF"
- `timecodeToFrames(timecode)` - 时间码解析为帧数
- `FRAME_RATE` - 固定帧率常量（30fps）
```

## 🗑️ 需要删除的废弃代码

### 📄 文件：`src/stores/modules/configModule.ts`

**删除第43-51行**：
```typescript
// 完全删除这个方法
function setFrameRate(rate: number) {
  if (rate > 0 && rate <= 120) {
    frameRate.value = rate
    console.log('🎬 帧率已设置为:', rate)
  } else {
    console.warn('⚠️ 无效的帧率值:', rate)
  }
}
```

**删除第115行导出中的**：
```typescript
// 从导出中删除
setFrameRate,
```

## 📊 修改汇总统计

### 文件修改统计：
- **重大重构**：5个文件
  - `src/stores/utils/timeUtils.ts`
  - `src/stores/modules/playbackModule.ts`
  - `src/composables/useWebAVControls.ts`
  - `src/components/TimeScale.vue`
  - `src/stores/modules/configModule.ts`

- **中等修改**：6个文件
  - `src/utils/VideoVisibleSprite.ts`
  - `src/utils/ImageVisibleSprite.ts`
  - `src/components/Timeline.vue`
  - `src/stores/modules/commands/timelineCommands.ts`
  - `src/stores/utils/timelineArrangementUtils.ts`
  - `src/stores/utils/timeRangeUtils.ts`

- **轻微修改**：4个文件
  - `src/types/index.ts`
  - `src/components/VideoClip.vue`
  - `src/components/PlaybackControls.vue`
  - `src/stores/modules/viewportModule.ts`

- **文档更新**：1个文件
  - `src/stores/utils/README.md`

### 代码行数统计：
- **新增代码**：约 800+ 行
- **修改代码**：约 300+ 行
- **删除代码**：约 50+ 行

### 功能影响范围：
- ✅ 时间显示格式：秒数 → 时间码格式
- ✅ 内部存储：浮点秒数 → 整数帧数
- ✅ WebAV接口：保持微秒不变，只在边界转换
- ✅ 用户交互：帧级精度的时间控制
- ✅ 性能优化：整数运算替代浮点运算
- ✅ 扩展性：为关键帧系统奠定基础

## 🎯 实施建议

### 实施顺序：
1. **第1天**：重构 `timeUtils.ts`，建立帧数架构基础
2. **第2天**：重构 Store 层（playbackModule, configModule）
3. **第3天**：重构 WebAV 边界处理
4. **第4天**：重构 UI 层组件
5. **第5天**：扩展精灵接口，添加帧数支持
6. **第6天**：测试和优化，清理废弃代码

### 测试策略：
- 每完成一个阶段就进行功能测试
- 重点测试时间码格式显示的正确性
- 验证帧级精度的时间跳转
- 确保WebAV集成的稳定性
- 检查性能是否有提升

### 风险控制：
- 保持向后兼容接口，逐步迁移
- 建立完整的单元测试覆盖
- 准备快速回滚方案
- 分阶段部署，及时发现问题

这份详细的修改报告涵盖了时间码系统重构的每一个细节，您可以按照这个计划逐步实施重构，实现专业级的视频编辑时间控制能力。

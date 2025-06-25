# 时间码系统重构实施方案

## 📋 项目概述

基于对现有代码库的深入分析，当前系统使用**秒数（number类型浮点数）**作为内部时间单位，目标是改为**帧数（number类型整数）**。这主要是**计算逻辑的重构**，而不是大规模的架构重构。

## 🎯 重构目标

- **UI显示**：HH:MM:SS.FF 格式（时:分:秒.帧）
- **内部存储**：帧数（number类型，整数）
- **WebAV边界**：保持微秒不变（WebAV要求）
- **固定帧率**：30fps
- **精度提升**：整数帧数替代浮点秒数计算

## 🏗️ 架构设计

### 时间表示层次
```
UI层：HH:MM:SS.FF 格式显示
应用层：帧数（number类型整数，如：90帧 = 3秒@30fps）
WebAV层：微秒（number类型整数，保持不变）
```

### 数据流向
```
用户操作 → 帧数计算 → WebAV微秒转换 → WebAV API
WebAV事件 → 微秒 → 帧数转换 → UI显示（时间码格式）
```

## 🔍 当前状态分析

### 现有架构特点
1. **时间单位**：当前使用秒数（number类型浮点数）
2. **WebAV接口**：已经使用微秒，无需修改
3. **数据类型**：都是number类型，类型系统无需大改
4. **转换边界**：只在WebAV接口处进行微秒转换

### 真正需要修改的内容
- **计算逻辑**：秒数计算 → 帧数计算
- **显示格式**：时分秒 → 时间码格式
- **转换函数**：新增帧数与微秒/秒数的转换
- **精度处理**：整数帧数替代浮点秒数

## 📁 实施计划

### 阶段1：基础转换函数（新增）

#### 修改文件：`src/stores/utils/timeUtils.ts`

**新增常量和转换函数**：
```typescript
// ==================== 时间码系统常量 ====================
/** 固定帧率：30fps */
export const FRAME_RATE = 30

// ==================== 时间码转换函数 ====================
/**
 * 帧数转换为秒数
 */
export function framesToSeconds(frames: number): number {
  return frames / FRAME_RATE
}

/**
 * 秒数转换为帧数
 */
export function secondsToFrames(seconds: number): number {
  return Math.floor(seconds * FRAME_RATE)
}

/**
 * 帧数转换为微秒（WebAV接口）
 */
export function framesToMicroseconds(frames: number): number {
  return Math.floor((frames / FRAME_RATE) * 1_000_000)
}

/**
 * 微秒转换为帧数（WebAV接口）
 */
export function microsecondsToFrames(microseconds: number): number {
  return Math.floor((microseconds / 1_000_000) * FRAME_RATE)
}

/**
 * 帧数转换为时间码字符串
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

### 阶段2：播放控制模块重构

#### 修改文件：`src/stores/modules/playbackModule.ts`

**主要修改**：
1. `currentTime` → `currentFrame`（内部存储改为帧数）
2. 新增帧数操作方法
3. 保持向后兼容的秒数接口

**关键修改点**：
```typescript
// 状态改为帧数
const currentFrame = ref(0) // 当前播放帧数（整数）

// 计算属性改为时间码格式
const formattedCurrentTime = computed(() => {
  return framesToTimecode(currentFrame.value)
})

// 新增帧数控制方法
function setCurrentFrame(frames: number, forceAlign: boolean = true) {
  const finalFrames = forceAlign ? Math.floor(frames) : frames
  const clampedFrames = Math.max(0, finalFrames)
  if (currentFrame.value !== clampedFrames) {
    currentFrame.value = clampedFrames
  }
}

// 保持向后兼容
function setCurrentTime(time: number, forceAlign: boolean = true) {
  const frames = secondsToFrames(time)
  setCurrentFrame(frames, forceAlign)
}

// 帧操作简化
function nextFrame() {
  setCurrentFrame(currentFrame.value + 1)
}

function previousFrame() {
  setCurrentFrame(currentFrame.value - 1)
}
```

### 阶段3：WebAV边界处理

#### 修改文件：`src/composables/useWebAVControls.ts`

**主要修改**：
1. `timeupdate`事件：微秒 → 帧数
2. `seekTo`方法：帧数 → 微秒
3. `play`方法：帧数 → 微秒

**关键修改点**：
```typescript
// timeupdate事件处理
globalAVCanvas.on('timeupdate', (microseconds: number) => {
  if (isUpdatingTime) return
  
  isUpdatingTime = true
  try {
    const frames = microsecondsToFrames(microseconds)
    videoStore.setCurrentFrame(frames, false) // 使用帧数接口
  } finally {
    isUpdatingTime = false
  }
})

// seekTo方法
const seekTo = (frames: number): void => {
  if (!globalAVCanvas) return
  const microseconds = framesToMicroseconds(frames)
  globalAVCanvas.previewFrame(microseconds)
}

// 保持向后兼容的秒数接口
const seekToSeconds = (time: number): void => {
  const frames = secondsToFrames(time)
  seekTo(frames)
}
```

### 阶段4：UI层显示格式

#### 修改文件：`src/components/TimeScale.vue`

**主要修改**：
1. 时间刻度显示改为时间码格式
2. 点击跳转使用帧数计算

**关键修改点**：
```typescript
// 时间格式化改为时间码
function formatTime(seconds: number): string {
  const frames = secondsToFrames(seconds)
  return framesToTimecode(frames)
}

// 点击跳转使用帧数
function handleClick(event: MouseEvent) {
  // ... 计算点击位置
  const clickFrames = secondsToFrames(clickTime)
  const alignedFrames = Math.floor(clickFrames)
  webAVControls.seekTo(alignedFrames) // 使用帧数接口
}
```

## 📊 修改统计

### 实际修改范围
- **核心文件**：4个（timeUtils.ts, playbackModule.ts, useWebAVControls.ts, TimeScale.vue）
- **新增代码**：约200行（主要是转换函数）
- **修改代码**：约100行（主要是计算逻辑）
- **删除代码**：约20行（简化的逻辑）

### 不需要修改的部分
- **WebAV相关代码**：保持微秒接口不变
- **类型定义**：都是number类型，无需修改
- **大部分UI组件**：只需要修改显示格式
- **精灵类**：可选择性添加帧数接口，不强制

## 🎯 实施建议

### 实施顺序
1. **第1步**：添加转换函数（timeUtils.ts）
2. **第2步**：重构播放控制（playbackModule.ts）
3. **第3步**：修改WebAV边界（useWebAVControls.ts）
4. **第4步**：更新UI显示（TimeScale.vue等）

### 测试策略
- 重点测试时间码格式显示
- 验证帧级精度的时间跳转
- 确保WebAV集成稳定性
- 检查向后兼容性

### 风险控制
- 保持向后兼容接口
- 分步骤实施，每步测试
- WebAV接口保持不变，降低风险

这个简化方案专注于真正需要修改的计算逻辑，避免了不必要的大规模重构。

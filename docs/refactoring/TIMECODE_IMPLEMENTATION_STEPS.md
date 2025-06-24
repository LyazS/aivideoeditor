# 🎬 时间码重构实施步骤

## 📋 实施概览

本文档提供时间码系统重构的具体实施步骤，确保重构过程的可控性和可回滚性。

## 🚀 阶段1: 核心基础重构

### 步骤1.1: playbackModule.ts 重构

#### 当前状态分析
```typescript
// 文件: frontend/src/stores/modules/playbackModule.ts
const currentTime = ref(0) // 当前播放时间（秒）
const isPlaying = ref(false)
const playbackRate = ref(1)
```

#### 重构步骤
1. **添加新的Timecode状态**
```typescript
// 添加新状态，暂时与旧状态并存
const currentTimecode = ref(Timecode.zero(30))
```

2. **创建双向同步机制**
```typescript
// 临时同步机制，确保重构过程中的兼容性
watch(currentTime, (newTime) => {
  currentTimecode.value = Timecode.fromSeconds(newTime, frameRate.value)
})

watch(currentTimecode, (newTimecode) => {
  currentTime.value = newTimecode.toSeconds()
})
```

3. **更新setCurrentTime方法**
```typescript
// 重构前
function setCurrentTime(time: number, forceAlign: boolean = true) {
  const finalTime = forceAlign ? alignTimeToFrame(time, frameRate.value) : time
  const clampedTime = Math.max(0, finalTime)
  if (currentTime.value !== clampedTime) {
    currentTime.value = clampedTime
  }
}

// 重构后
function setCurrentTime(input: number | Timecode, forceAlign: boolean = true) {
  let timecode: Timecode
  
  if (typeof input === 'number') {
    // 兼容旧接口
    timecode = Timecode.fromSeconds(input, frameRate.value)
  } else {
    timecode = input
  }
  
  if (forceAlign) {
    timecode = timecode.alignToFrame()
  }
  
  // 确保时间不为负数
  if (timecode.totalFrames < 0) {
    timecode = Timecode.zero(frameRate.value)
  }
  
  if (!currentTimecode.value.equals(timecode)) {
    currentTimecode.value = timecode
  }
}
```

4. **更新formattedCurrentTime**
```typescript
// 重构前
const formattedCurrentTime = computed(() => {
  const time = currentTime.value
  return secondsToTimecodeString(time, frameRate.value)
})

// 重构后
const formattedCurrentTime = computed(() => {
  return currentTimecode.value.toString()
})
```

#### 验证步骤
- [ ] 播放控制功能正常
- [ ] 时间显示正确
- [ ] 帧对齐功能正常
- [ ] 无类型错误

### 步骤1.2: useWebAVControls.ts 重构

#### 当前状态分析
```typescript
// WebAV事件处理
globalAVCanvas.on('timeupdate', (time: number) => {
  const timeInSeconds = time / 1000000
  videoStore.setCurrentTime(timeInSeconds, false)
})

// 播放控制
const seekTo = (timeInSeconds: number): void => {
  const microseconds = timeInSeconds * 1000000
  globalAVCanvas.previewFrame(microseconds)
}
```

#### 重构步骤
1. **更新timeupdate事件处理**
```typescript
globalAVCanvas.on('timeupdate', (time: number) => {
  if (isUpdatingTime) return
  
  isUpdatingTime = true
  try {
    // 直接转换为Timecode对象
    const timecode = TimecodeUtils.webAVToTimecode(time, videoStore.frameRate)
    videoStore.setCurrentTime(timecode, false)
  } finally {
    isUpdatingTime = false
  }
})
```

2. **更新seekTo方法**
```typescript
// 重构前
const seekTo = (timeInSeconds: number): void => {
  const microseconds = timeInSeconds * 1000000
  globalAVCanvas.previewFrame(microseconds)
}

// 重构后
const seekTo = (input: number | Timecode): void => {
  let microseconds: number
  
  if (typeof input === 'number') {
    // 兼容旧接口
    microseconds = input * 1000000
  } else {
    // 新接口：Timecode对象
    microseconds = input.toMicroseconds()
  }
  
  globalAVCanvas.previewFrame(microseconds)
}
```

#### 验证步骤
- [ ] WebAV时间同步正常
- [ ] 播放头拖拽正常
- [ ] 时间跳转精确
- [ ] 无循环调用问题

### 步骤1.3: 时间工具函数重构

#### 重构storeUtils.ts
```typescript
// 重构前
export function timeToPixel(time: number, timelineWidth: number, totalDuration: number, zoomLevel: number): number

// 重构后
export function timecodeToPixel(timecode: Timecode, timelineWidth: number, totalDuration: Timecode, zoomLevel: number): number {
  const timeRatio = timecode.totalFrames / totalDuration.totalFrames
  return timeRatio * timelineWidth * zoomLevel
}

export function pixelToTimecode(pixel: number, timelineWidth: number, totalDuration: Timecode, zoomLevel: number): Timecode {
  const timeRatio = pixel / (timelineWidth * zoomLevel)
  const targetFrames = Math.round(timeRatio * totalDuration.totalFrames)
  return new Timecode(targetFrames, totalDuration.frameRate)
}
```

## 🚀 阶段2: 时间轴系统重构

### 步骤2.1: VideoVisibleSprite.ts 重构

#### 当前状态分析
```typescript
export interface VideoTimeRange {
  clipStartTime: number      // 微秒
  clipEndTime: number        // 微秒
  timelineStartTime: number  // 微秒
  timelineEndTime: number    // 微秒
}
```

#### 重构步骤
1. **定义新的时间范围接口**
```typescript
export interface TimecodeVideoTimeRange {
  clipStartTime: Timecode
  clipEndTime: Timecode
  timelineStartTime: Timecode
  timelineEndTime: Timecode
  effectiveDuration: Timecode
  playbackRate: number
}
```

2. **创建转换适配器**
```typescript
class TimeRangeAdapter {
  static toWebAV(range: TimecodeVideoTimeRange): VideoTimeRange {
    return {
      clipStartTime: range.clipStartTime.toMicroseconds(),
      clipEndTime: range.clipEndTime.toMicroseconds(),
      timelineStartTime: range.timelineStartTime.toMicroseconds(),
      timelineEndTime: range.timelineEndTime.toMicroseconds(),
      effectiveDuration: range.effectiveDuration.toMicroseconds(),
      playbackRate: range.playbackRate
    }
  }
  
  static fromWebAV(range: VideoTimeRange, frameRate: number): TimecodeVideoTimeRange {
    return {
      clipStartTime: Timecode.fromMicroseconds(range.clipStartTime, frameRate),
      clipEndTime: Timecode.fromMicroseconds(range.clipEndTime, frameRate),
      timelineStartTime: Timecode.fromMicroseconds(range.timelineStartTime, frameRate),
      timelineEndTime: Timecode.fromMicroseconds(range.timelineEndTime, frameRate),
      effectiveDuration: Timecode.fromMicroseconds(range.effectiveDuration, frameRate),
      playbackRate: range.playbackRate
    }
  }
}
```

### 步骤2.2: TimelineItem类型重构

#### 重构videoTypes.ts
```typescript
// 重构前
export interface TimelineItem {
  timeRange: VideoTimeRange | ImageTimeRange
  // ... 其他属性
}

// 重构后
export interface TimelineItem {
  timeRange: TimecodeVideoTimeRange | TimecodeImageTimeRange
  // ... 其他属性
}
```

## 🚀 阶段3: UI组件层重构

### 步骤3.1: TimeScale.vue 重构

#### 重构事件处理
```typescript
// 重构前
function handleClick(event: MouseEvent) {
  const newTime = videoStore.pixelToTime(clickX, containerWidth.value)
  const alignedTime = alignTimeToFrame(clampedTime)
  webAVControls.seekTo(alignedTime)
}

// 重构后
function handleClick(event: MouseEvent) {
  const newTimecode = videoStore.pixelToTimecode(clickX, containerWidth.value)
  const alignedTimecode = newTimecode.alignToFrame()
  webAVControls.seekTo(alignedTimecode)
}
```

### 步骤3.2: PropertiesPanel.vue 重构

#### 重构时长控制
```typescript
// 重构前
const targetDurationMicroseconds = computed(() => targetDuration.value * 1000000)

// 重构后
const targetDurationTimecode = computed(() => {
  if (!selectedTimelineItem.value) return Timecode.zero(30)
  const timeRange = selectedTimelineItem.value.timeRange
  return timeRange.timelineEndTime.subtract(timeRange.timelineStartTime)
})
```

## 📋 每阶段验证清单

### 阶段1验证
- [ ] 播放控制功能完全正常
- [ ] 时间显示格式正确
- [ ] WebAV同步无问题
- [ ] 性能无明显下降
- [ ] 无TypeScript错误

### 阶段2验证
- [ ] 时间轴项目拖拽正常
- [ ] 片段调整大小正确
- [ ] 时间范围计算准确
- [ ] 自动排列功能正常

### 阶段3验证
- [ ] 所有UI时间显示正确
- [ ] 用户交互响应正常
- [ ] 属性面板功能完整
- [ ] 时间码输入工作正常

## 🔄 回滚策略

### 快速回滚点
每个阶段完成后创建Git标签：
- `timecode-refactor-stage1`
- `timecode-refactor-stage2`  
- `timecode-refactor-stage3`

### 回滚步骤
1. 停止开发服务器
2. 回滚到指定标签: `git reset --hard <tag-name>`
3. 重新安装依赖: `npm install`
4. 重启服务器验证功能

## ⚡ 性能监控

### 关键指标
- 时间码对象创建频率
- 内存使用情况
- UI响应时间
- WebAV同步延迟

### 监控代码
```typescript
class TimecodePerformanceMonitor {
  private static creationCount = 0
  private static conversionCount = 0
  
  static trackCreation() {
    this.creationCount++
    if (this.creationCount % 100 === 0) {
      console.log(`Timecode objects created: ${this.creationCount}`)
    }
  }
  
  static trackConversion() {
    this.conversionCount++
    if (this.conversionCount % 50 === 0) {
      console.log(`Timecode conversions: ${this.conversionCount}`)
    }
  }
}
```

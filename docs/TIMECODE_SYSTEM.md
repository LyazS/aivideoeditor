# 时间码转换系统

## 概述

本系统提供了完整的时间码转换功能，用于在UI显示的时间码格式（时:分:秒.帧）和WebAV使用的微秒格式之间进行转换。

## 核心特性

- **统一帧率**: 使用30fps作为标准帧率
- **双向转换**: 支持时间码↔微秒的双向转换
- **UI组件**: 提供输入和显示组件
- **工具类**: 提供高级时间码操作功能
- **WebAV集成**: 无缝集成WebAV的时间控制系统

## 时间码格式

### 标准格式
- **完整格式**: `HH:MM:SS.FF` (小时:分钟:秒.帧)
- **简化格式**: `MM:SS.FF` (分钟:秒.帧，当小时为0时)
- **帧率**: 固定30fps

### 示例
```
00:30.15  -> 30秒15帧
01:25.00  -> 1分钟25秒0帧
02:10:45.29 -> 2小时10分钟45秒29帧
```

## 核心API

### 基础转换函数

```typescript
// 微秒 → 时间码字符串
microsecondsToTimecodeString(microseconds: number, frameRate?: number): string

// 时间码字符串 → 微秒
timecodeStringToMicroseconds(timecodeString: string, frameRate?: number): number

// 秒 → 时间码字符串（兼容现有代码）
secondsToTimecodeString(seconds: number, frameRate?: number): string

// 时间码字符串 → 秒（兼容现有代码）
timecodeStringToSeconds(timecodeString: string, frameRate?: number): number
```

### 时间码对象操作

```typescript
// 微秒 → 时间码对象
microsecondsToTimecode(microseconds: number, frameRate?: number): Timecode

// 时间码对象 → 微秒
timecodeToMicroseconds(timecode: Timecode, frameRate?: number): number

// 格式化时间码对象
formatTimecode(timecode: Timecode): string

// 解析时间码字符串
parseTimecode(timecodeString: string): Timecode
```

## TimecodeUtils工具类

### WebAV集成方法

```typescript
// WebAV时间 → UI时间码
TimecodeUtils.webAVToTimecode(microseconds: number): string

// UI时间码 → WebAV时间
TimecodeUtils.timecodeToWebAV(timecodeString: string): number
```

### 时间码运算

```typescript
// 时间码加法
TimecodeUtils.addTimecodes(timecode1: Timecode, timecode2: Timecode): Timecode

// 时间码减法
TimecodeUtils.subtractTimecodes(timecode1: Timecode, timecode2: Timecode): Timecode

// 时间码比较
TimecodeUtils.compareTimecodes(timecode1: Timecode, timecode2: Timecode): number
```

### 实用工具

```typescript
// 帧对齐
TimecodeUtils.alignToFrame(microseconds: number): number

// 格式验证
TimecodeUtils.isValidTimecodeString(timecodeString: string): boolean

// 零时间码
TimecodeUtils.zero(): Timecode
TimecodeUtils.isZero(timecode: Timecode): boolean
```

## UI组件

### TimecodeInput 组件

用于输入时间码的组件：

```vue
<TimecodeInput 
  v-model="timeMicroseconds" 
  placeholder="00:00.00"
  :frame-rate="30"
  @change="handleChange"
/>
```

**Props:**
- `modelValue`: 时间值（微秒）
- `placeholder`: 占位符文本
- `frameRate`: 帧率（默认30）
- `disabled`: 是否禁用

**Events:**
- `update:modelValue`: 值变化
- `change`: 值确认变化

### TimecodeDisplay 组件

用于显示时间码的组件：

```vue
<TimecodeDisplay 
  :value="timeMicroseconds"
  :frame-rate="30"
  size="large"
  :show-milliseconds="false"
/>
```

**Props:**
- `value`: 时间值（微秒）
- `frameRate`: 帧率（默认30）
- `size`: 显示尺寸（small/normal/large）
- `showMilliseconds`: 是否显示毫秒而不是帧

## 使用示例

### 基础转换

```typescript
import { TimecodeUtils } from '@/utils/TimecodeUtils'

// WebAV返回的时间转换为UI显示
const webAVTime = 30500000 // 30.5秒的微秒值
const timecodeString = TimecodeUtils.webAVToTimecode(webAVTime)
console.log(timecodeString) // "00:30.15"

// UI输入的时间码转换为WebAV时间
const userInput = "01:25.00"
const microseconds = TimecodeUtils.timecodeToWebAV(userInput)
console.log(microseconds) // 85000000
```

### 在时间轴中使用

```typescript
// 时间轴点击事件
function handleTimelineClick(event: MouseEvent) {
  const clickTime = pixelToTime(event.offsetX)
  const clickTimeMicroseconds = clickTime * 1000000
  
  // 对齐到帧边界
  const alignedMicroseconds = TimecodeUtils.alignToFrame(clickTimeMicroseconds)
  
  // 跳转到对齐后的时间
  const alignedSeconds = alignedMicroseconds / 1000000
  webAVControls.seekTo(alignedSeconds)
}
```

### 时间码运算

```typescript
import { parseTimecode, TimecodeUtils } from '@/utils/TimecodeUtils'

const startTime = parseTimecode("00:30.00")
const duration = parseTimecode("00:15.10")
const endTime = TimecodeUtils.addTimecodes(startTime, duration)

console.log(TimecodeUtils.formatTimecodeAs(endTime, 'standard')) // "00:45.10"
```

## 集成指南

### 1. 更新现有时间显示

将现有的时间显示替换为时间码格式：

```typescript
// 旧代码
const formattedTime = formatTime(seconds, 'frames', 30)

// 新代码
const formattedTime = secondsToTimecodeString(seconds, 30)
```

### 2. 时间输入控件

使用TimecodeInput组件替换普通输入：

```vue
<!-- 旧代码 -->
<input v-model="timeValue" type="number" />

<!-- 新代码 -->
<TimecodeInput v-model="timeMicroseconds" />
```

### 3. WebAV时间同步

在WebAV事件处理中使用转换函数：

```typescript
// timeupdate事件处理
globalAVCanvas.on('timeupdate', (timeMicroseconds: number) => {
  // 直接使用微秒值，无需转换
  videoStore.setCurrentTime(timeMicroseconds / 1000000)
  
  // UI显示时自动转换为时间码格式
  const timecodeString = TimecodeUtils.webAVToTimecode(timeMicroseconds)
  updateTimeDisplay(timecodeString)
})
```

## 注意事项

1. **帧率一致性**: 整个系统使用30fps，确保所有组件使用相同的帧率
2. **精度处理**: 微秒精度可能导致浮点数误差，使用Math.round()进行舍入
3. **边界检查**: 输入验证确保时间码格式正确且值在有效范围内
4. **性能考虑**: 频繁转换时考虑缓存结果
5. **向后兼容**: 保留原有的formatTime函数，添加'timecode'选项

## 组件集成示例

### 1. 在播放控制中显示时间码

```vue
<!-- VideoPreviewEngine.vue -->
<div class="time-display">
  {{ formatTime(videoStore.currentTime) }} /
  {{ formatTime(videoStore.contentEndTime || videoStore.totalDuration) }}
</div>

<script>
import { secondsToTimecodeString } from '../stores/utils/storeUtils'

function formatTime(seconds: number): string {
  return secondsToTimecodeString(seconds, videoStore.frameRate)
}
</script>
```

### 2. 时间码输入和跳转

```vue
<!-- TimecodeSeekBar.vue -->
<TimecodeInput
  v-model="currentTimeMicroseconds"
  :frame-rate="frameRate"
  @change="handleTimeChange"
/>

<script>
const currentTimeMicroseconds = computed({
  get: () => Math.round(videoStore.currentTime * 1000000),
  set: (value: number) => {
    const seconds = value / 1000000
    webAVControls.seekTo(seconds)
  }
})
</script>
```

### 3. 时间轴刻度显示

```vue
<!-- TimeScale.vue -->
<div class="mark-label">
  {{ formatTime(mark.time) }}
</div>

<script>
function formatTime(seconds: number): string {
  const pixelsPerSecond = calculatePixelsPerSecond(...)
  return formatTimeWithAutoPrecision(seconds, pixelsPerSecond, videoStore.frameRate)
}
</script>
```

## 系统架构

### 数据流向

```
UI输入时间码 → TimecodeUtils.timecodeToWebAV() → WebAV微秒值 → webAVControls.seekTo()
                                                                        ↓
UI显示时间码 ← TimecodeUtils.webAVToTimecode() ← WebAV微秒值 ← timeupdate事件
```

### 核心转换链

1. **UI → WebAV**: `时间码字符串 → 微秒 → 秒 → WebAV`
2. **WebAV → UI**: `WebAV → 微秒 → 时间码字符串 → UI显示`

### 帧对齐机制

```typescript
// 用户输入时自动对齐到帧边界
const alignedMicroseconds = TimecodeUtils.alignToFrame(inputMicroseconds)
webAVControls.seekTo(alignedMicroseconds / 1000000)
```

## 测试

### 集成测试

使用TimecodeSeekBar组件测试实际集成：

```vue
<TimecodeSeekBar />
```

### 功能验证

在实际使用中验证时间码功能：
1. 播放控制面板的时间显示
2. 媒体库素材时长显示
3. 时间轴刻度和片段时长
4. 属性面板的时间码输入

## 性能优化

1. **缓存转换结果**: 对频繁转换的值进行缓存
2. **批量更新**: 避免频繁的UI更新
3. **精度控制**: 根据显示需求选择合适的精度
4. **懒加载**: 大量时间码标记的懒加载

## 故障排除

### 常见问题

1. **时间码格式错误**: 检查输入格式是否为 `MM:SS.FF` 或 `HH:MM:SS.FF`
2. **帧数超出范围**: 确保帧数在0-29之间（30fps）
3. **精度丢失**: 使用Math.round()处理浮点数精度问题
4. **循环调用**: 确保时间同步锁正确工作

### 调试工具

```typescript
// 启用调试日志
console.log('时间码转换:', {
  input: timecodeString,
  microseconds: TimecodeUtils.timecodeToWebAV(timecodeString),
  output: TimecodeUtils.webAVToTimecode(microseconds)
})
```

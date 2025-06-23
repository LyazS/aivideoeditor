# 时间码系统快速开始指南

## 🚀 5分钟快速上手

### 1. 基础转换

```typescript
import { TimecodeUtils } from '@/utils/TimecodeUtils'

// WebAV时间 → UI时间码
const webAVTime = 30500000 // 30.5秒的微秒值
const timecode = TimecodeUtils.webAVToTimecode(webAVTime)
console.log(timecode) // "00:30.15"

// UI时间码 → WebAV时间
const userInput = "01:25.00"
const microseconds = TimecodeUtils.timecodeToWebAV(userInput)
console.log(microseconds) // 85000000
```

### 2. 在组件中显示时间码

```vue
<template>
  <TimecodeDisplay :value="currentTimeMicroseconds" />
</template>

<script setup>
import { computed } from 'vue'
import { useVideoStore } from '@/stores/videoStore'
import TimecodeDisplay from '@/components/TimecodeDisplay.vue'

const videoStore = useVideoStore()
const currentTimeMicroseconds = computed(() => 
  Math.round(videoStore.currentTime * 1000000)
)
</script>
```

### 3. 时间码输入控件

```vue
<template>
  <TimecodeInput 
    v-model="timeMicroseconds" 
    @change="handleTimeChange"
  />
</template>

<script setup>
import { ref } from 'vue'
import { useWebAVControls } from '@/composables/useWebAVControls'
import TimecodeInput from '@/components/TimecodeInput.vue'

const webAVControls = useWebAVControls()
const timeMicroseconds = ref(0)

const handleTimeChange = (microseconds) => {
  const seconds = microseconds / 1000000
  webAVControls.seekTo(seconds)
}
</script>
```

## 📋 常用场景

### 场景1: 更新现有时间显示

**旧代码:**
```typescript
const formattedTime = formatTime(seconds, 'frames', 30)
```

**新代码:**
```typescript
const formattedTime = secondsToTimecodeString(seconds, 30)
```

### 场景2: 时间轴点击跳转

```typescript
function handleTimelineClick(event: MouseEvent) {
  const clickTime = pixelToTime(event.offsetX)
  const clickTimeMicroseconds = clickTime * 1000000
  
  // 对齐到帧边界
  const alignedMicroseconds = TimecodeUtils.alignToFrame(clickTimeMicroseconds)
  
  // 跳转
  const alignedSeconds = alignedMicroseconds / 1000000
  webAVControls.seekTo(alignedSeconds)
}
```

### 场景3: WebAV事件处理

```typescript
// timeupdate事件处理
globalAVCanvas.on('timeupdate', (timeMicroseconds: number) => {
  // 更新Store（秒）
  videoStore.setCurrentTime(timeMicroseconds / 1000000)
  
  // UI显示（时间码）
  const timecodeString = TimecodeUtils.webAVToTimecode(timeMicroseconds)
  updateTimeDisplay(timecodeString)
})
```

## 🎯 核心概念

### 时间格式对照表

| 格式 | 示例 | 用途 |
|------|------|------|
| 微秒 | 30500000 | WebAV内部使用 |
| 秒 | 30.5 | 计算和存储 |
| 时间码 | 00:30.15 | UI显示 |

### 转换关系

```
30.5秒 = 30,500,000微秒 = 00:30.15时间码
```

### 帧率说明

- **标准帧率**: 30fps
- **1帧时长**: 1/30秒 ≈ 33,333微秒
- **帧数范围**: 0-29帧

## 🔧 实用工具

### 1. 时间码验证

```typescript
if (TimecodeUtils.isValidTimecodeString(userInput)) {
  const microseconds = TimecodeUtils.timecodeToWebAV(userInput)
  // 处理有效输入
} else {
  // 显示错误信息
}
```

### 2. 时间码运算

```typescript
const startTime = parseTimecode("00:30.00")
const duration = parseTimecode("00:15.10")
const endTime = TimecodeUtils.addTimecodes(startTime, duration)
// 结果: 00:45.10
```

### 3. 帧对齐

```typescript
// 确保时间对齐到帧边界
const alignedTime = TimecodeUtils.alignToFrame(microseconds)
```

## 📦 组件API速查

### TimecodeInput

```vue
<TimecodeInput 
  v-model="microseconds"     // 微秒值
  :frame-rate="30"           // 帧率
  placeholder="00:00.00"     // 占位符
  @change="handleChange"     // 值变化事件
/>
```

### TimecodeDisplay

```vue
<TimecodeDisplay 
  :value="microseconds"      // 微秒值
  :frame-rate="30"           // 帧率
  size="large"               // 尺寸: small/normal/large
  :show-milliseconds="false" // 显示毫秒而不是帧
/>
```

## 🐛 常见错误

### 1. 格式错误
```
❌ "1:30:15"     // 缺少帧数
❌ "01:30.30"    // 帧数超出范围(30fps最大29帧)
❌ "01:60.15"    // 分钟超出范围
✅ "01:30.15"    // 正确格式
```

### 2. 精度问题
```typescript
// ❌ 直接使用浮点数
const microseconds = seconds * 1000000

// ✅ 使用舍入避免精度问题
const microseconds = Math.round(seconds * 1000000)
```

### 3. 循环调用
```typescript
// ❌ 可能导致循环调用
watch(() => videoStore.currentTime, (time) => {
  webAVControls.seekTo(time)
})

// ✅ 使用时间同步锁
if (!isUpdatingTime) {
  webAVControls.seekTo(time)
}
```

## 🎨 样式定制

### 时间码输入框样式

```css
.timecode-input input {
  font-family: 'Courier New', monospace;
  text-align: center;
  background: #2d2d2d;
  color: #fff;
  border: 1px solid #555;
}
```

### 时间码显示样式

```css
.timecode-display {
  font-family: 'Courier New', monospace;
  background: rgba(0, 0, 0, 0.8);
  color: #0f0;
  padding: 4px 8px;
  border-radius: 4px;
}
```

## 📚 进阶用法

### 自定义时间码格式

```typescript
const timecode = { hours: 1, minutes: 5, seconds: 30, frames: 15 }

// 标准格式: 01:05:30.15
TimecodeUtils.formatTimecodeAs(timecode, 'standard')

// 紧凑格式: 1:05:30.15
TimecodeUtils.formatTimecodeAs(timecode, 'compact')

// 详细格式: 1h 5m 30s 15f
TimecodeUtils.formatTimecodeAs(timecode, 'verbose')
```

### 批量时间码处理

```typescript
const timecodes = ['00:30.00', '01:15.10', '02:45.29']
const microsecondsList = timecodes.map(tc => 
  TimecodeUtils.timecodeToWebAV(tc)
)
```

## 🔗 相关文档

- [完整API文档](./TIMECODE_SYSTEM.md)
- [系统完成状态](./TIMECODE_SYSTEM_COMPLETE.md)

## 💡 最佳实践

1. **统一使用30fps**: 整个项目保持帧率一致
2. **帧对齐**: 用户操作时自动对齐到帧边界
3. **错误处理**: 提供友好的错误提示
4. **性能优化**: 避免频繁的转换计算
5. **类型安全**: 使用TypeScript类型定义

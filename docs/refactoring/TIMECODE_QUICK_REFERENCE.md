# ⚡ 时间码系统快速参考指南

## 🎯 当前状态总览

### ✅ 已完成 (100%)
- **UI显示层**: 所有用户可见的时间都使用时间码格式
- **播放控制**: 播放状态管理使用Timecode对象
- **时间码组件**: 完整的时间码输入和显示组件

### ⚠️ 部分完成 (60%)
- **Store方法**: 大部分仍使用数字参数
- **拖拽操作**: 使用数字时间计算
- **类型定义**: 混合使用数字和时间码

### ❌ 待改进 (40%) - 精度问题严重
- **内部计算**: 大量使用秒数计算 🔴 **精度风险极高**
- **数据类型**: MediaItem等仍使用数字时间
- **工具函数**: 保留了大量基于秒的函数

### 🚨 精度问题警告
```typescript
// 当前系统存在的精度问题
const frameRate = 30
const frameTime = 1 / frameRate  // 0.03333333333333333 ❌ 不精确

// 累积误差示例
let totalTime = 0
for (let i = 0; i < 900; i++) {  // 30秒的视频，900帧
  totalTime += frameTime
}
console.log(totalTime)  // 29.999999999999996 ❌ 应该是30.0

// 帧对齐失败
const time = 15 * frameTime  // 15帧
console.log(time * frameRate)  // 14.999999999999998 ❌ 应该是15
```

## 🎯 精度优先的转换模式

### ⚠️ 避免精度丢失的转换

```typescript
// ❌ 错误：通过浮点数秒转换会丢失精度
const seconds = 30.5  // 可能不是精确的帧边界
const timecode = Timecode.fromSeconds(seconds, 30)  // 精度已丢失

// ✅ 正确：直接使用帧数或时间码字符串
const timecode1 = new Timecode(915, 30)  // 915帧，精确
const timecode2 = new Timecode('00:30.15', 30)  // 字符串，精确

// ✅ 最佳：从WebAV微秒转换（保持最高精度）
const timecode3 = Timecode.fromMicroseconds(30500000, 30)  // 微秒，最精确
```

### 数字时间 → 时间码
```typescript
// 秒数转时间码
const seconds = 30.5
const timecode = Timecode.fromSeconds(seconds, 30)

// 微秒转时间码
const microseconds = 30500000
const timecode = Timecode.fromMicroseconds(microseconds, 30)

// 字符串转时间码
const timecodeString = "00:30.15"
const timecode = Timecode.fromString(timecodeString, 30)
```

### 时间码 → 数字时间
```typescript
const timecode = new Timecode("00:30.15", 30)

// 时间码转秒数
const seconds = timecode.toSeconds()  // 30.5

// 时间码转微秒
const microseconds = timecode.toMicroseconds()  // 30500000

// 时间码转字符串
const timecodeString = timecode.toString()  // "00:30.15"
```

### WebAV边界转换
```typescript
// UI → WebAV
const userInput = new Timecode("00:30.15", 30)
webAVControls.seekTo(userInput)  // seekTo已支持Timecode

// WebAV → UI
globalAVCanvas.on('timeupdate', (microseconds: number) => {
  const timecode = Timecode.fromMicroseconds(microseconds, frameRate)
  videoStore.setCurrentTime(timecode)
})
```

## 📝 代码迁移模式

### Store方法调用
```typescript
// 原来
await videoStore.moveTimelineItemWithHistory(itemId, 30.5, 2)

// 改为
const position = Timecode.fromSeconds(30.5, videoStore.frameRate)
await videoStore.moveTimelineItemWithHistoryTC(itemId, position, 2)
```

### 拖拽数据处理
```typescript
// 原来
const dragData: TimelineItemDragData = {
  startTime: 30.5,  // 数字
  // ...
}

// 改为
const dragData: TimelineItemDragDataTC = {
  startTime: Timecode.fromSeconds(30.5, frameRate),  // 时间码
  // ...
}
```

### 时间计算 - 精度至关重要
```typescript
// ❌ 原来 - 浮点数计算存在精度问题
const endTime = startTime + duration  // 累积误差
const isOverlap = (startTime < otherEndTime) && (endTime > otherStartTime)  // 不可靠比较

// 精度问题示例
const time1 = 0.1 + 0.2  // 0.30000000000000004
const time2 = 0.3
console.log(time1 === time2)  // false ❌

// ✅ 改为 - 时间码精确计算
const endTime = startTime.add(duration)  // 基于整数帧运算，无累积误差
const isOverlap = startTime.lessThan(otherEndTime) && endTime.greaterThan(otherStartTime)  // 精确比较

// 精确计算示例
const tc1 = new Timecode('00:00.03', 30).add(new Timecode('00:00.06', 30))  // 00:00.09
const tc2 = new Timecode('00:00.09', 30)
console.log(tc1.equals(tc2))  // true ✅

// 复杂运算保持精度
const baseTime = new Timecode('00:30.00', 30)
const offset = new Timecode('00:00.01', 30)  // 1帧
let result = baseTime
for (let i = 0; i < 100; i++) {
  result = result.add(offset)  // 100次1帧累加
}
console.log(result.toString())  // "00:33.10" 精确结果
```

## 🎨 UI组件使用

### 时间码输入
```vue
<template>
  <TimecodeInput
    :model-value="durationMicroseconds"
    @change="handleDurationChange"
    :frame-rate="frameRate"
    placeholder="00:00.00"
  />
</template>

<script>
function handleDurationChange(microseconds: number, timecode: string) {
  const timecodeObj = Timecode.fromMicroseconds(microseconds, frameRate)
  // 使用timecodeObj进行后续处理
}
</script>
```

### 时间码显示
```vue
<template>
  <div class="time-display">
    {{ formatTime(currentTimecode.toSeconds()) }}
  </div>
</template>

<script>
import { secondsToTimecodeString } from '@/stores/utils/timeUtils'

function formatTime(seconds: number): string {
  return secondsToTimecodeString(seconds, frameRate)
}
</script>
```

## 🧪 测试模式

### 单元测试
```typescript
describe('Timecode Operations', () => {
  it('should handle timecode arithmetic', () => {
    const tc1 = new Timecode('00:30.00', 30)
    const tc2 = new Timecode('00:15.15', 30)
    const result = tc1.add(tc2)
    
    expect(result.toString()).toBe('00:45.15')
  })
  
  it('should convert between formats correctly', () => {
    const timecode = new Timecode('00:30.15', 30)
    
    expect(timecode.toSeconds()).toBe(30.5)
    expect(timecode.toMicroseconds()).toBe(30500000)
  })
})
```

### 集成测试
```typescript
describe('Timeline Operations', () => {
  it('should move item with timecode precision', async () => {
    const newPosition = new Timecode('00:30.15', 30)
    await videoStore.moveTimelineItemWithHistoryTC('item-1', newPosition)
    
    const item = videoStore.getTimelineItem('item-1')
    const actualPosition = Timecode.fromMicroseconds(
      item.timeRange.timelineStartTime, 
      30
    )
    
    expect(actualPosition.equals(newPosition)).toBe(true)
  })
})
```

## 🚨 常见陷阱

### 1. 帧率不匹配
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

### 2. 精度丢失
```typescript
// ❌ 错误：通过秒数转换可能丢失帧精度
const seconds = 30.5
const timecode = Timecode.fromSeconds(seconds, 30)
const backToSeconds = timecode.toSeconds()  // 可能不完全相等

// ✅ 正确：直接使用时间码对象
const timecode = new Timecode('00:30.15', 30)
// 进行时间码运算，保持精度
```

### 3. WebAV边界混淆 🚫
```typescript
// ❌ 错误：直接传递时间码给WebAV
webAVCanvas.previewFrame(timecode)  // WebAV需要微秒数

// ❌ 错误：在WebAV模块中使用时间码
class VideoVisibleSprite {
  setTimeRange(range: { startTime: Timecode }) {  // 禁止！
    // WebAV库期望微秒格式，不是时间码
  }
}

// ✅ 正确：在边界进行转换
webAVCanvas.previewFrame(timecode.toMicroseconds())

// ✅ 正确：WebAV模块保持微秒格式
class VideoVisibleSprite {
  setTimeRange(range: {
    clipStartTime: number,      // 微秒
    clipEndTime: number,        // 微秒
    timelineStartTime: number,  // 微秒
    timelineEndTime: number     // 微秒
  }) {
    // WebAV内部逻辑保持不变
  }
}

// ✅ 正确：业务逻辑层进行转换
const startTimeTC = new Timecode('00:30.15', 30)
sprite.setTimeRange({
  clipStartTime: startTimeTC.toMicroseconds(),  // 转换为微秒
  // ...
})
```

### 🚫 WebAV边界保护规则

**禁止修改的文件**:
- `VideoVisibleSprite.ts` - WebAV视频精灵
- `ImageVisibleSprite.ts` - WebAV图片精灵
- `spriteFactory.ts` - WebAV精灵工厂
- `webavModule.ts` - WebAV核心模块

**原则**: WebAV = 微秒，业务逻辑 = 时间码，边界 = 转换

## 📊 性能优化建议

### 1. 避免频繁创建时间码对象
```typescript
// ❌ 低效：在循环中创建对象
for (const item of items) {
  const timecode = new Timecode(item.time, frameRate)
  // 处理...
}

// ✅ 高效：复用对象或使用静态方法
const baseTimecode = Timecode.zero(frameRate)
for (const item of items) {
  const timecode = baseTimecode.add(Timecode.fromSeconds(item.time, frameRate))
  // 处理...
}
```

### 2. 使用缓存
```typescript
// 利用TimecodeUtils的内置缓存
const timecode = TimecodeUtils.webAVToTimecode(microseconds, frameRate)
```

### 3. 批量操作
```typescript
// ✅ 批量更新时间码相关属性
const updates = items.map(item => ({
  id: item.id,
  timecode: Timecode.fromSeconds(item.time, frameRate)
}))
// 一次性应用所有更新
```

## 🔗 相关资源

- [Timecode类API文档](../src/utils/Timecode.ts)
- [TimecodeUtils工具函数](../src/utils/TimecodeUtils.ts)
- [时间码组件使用指南](../src/components/timecode/README.md)
- [完整改进计划](./TIMECODE_IMPROVEMENT_PLAN.md)
- [实施指南](./TIMECODE_IMPLEMENTATION_GUIDE.md)

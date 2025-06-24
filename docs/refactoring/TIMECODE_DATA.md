# 时间码数据结构设计文档

## 📋 概述

本文档定义了视频编辑系统中时间码的数据结构设计，采用基于总帧数的存储方式，以帧为最小精度单位，提供类型安全和高性能的时间码操作。

## 🎯 设计目标

1. **帧级精度**：以帧为最小单位，满足视频编辑需求
2. **类型安全**：防止无效的时间码操作
3. **高性能**：简化运算，避免复杂的时间进位计算
4. **易用性**：直观的API设计，支持多种输入格式
5. **WebAV集成**：无缝对接WebAV引擎

## 🏗️ 核心数据结构

### Timecode 类

```typescript
class Timecode {
  private _totalFrames: number  // 核心存储：总帧数
  private _frameRate: number    // 帧率（默认30fps）
  
  constructor(input: TimecodeInput, frameRate?: number)
}
```

### 支持的输入类型

```typescript
type TimecodeInput = 
  | string                    // "00:30.15"
  | number                    // 915 (总帧数)
  | TimecodeComponents        // {hours: 0, minutes: 0, seconds: 30, frames: 15}
  | Timecode                  // 另一个时间码实例

interface TimecodeComponents {
  hours: number
  minutes: number
  seconds: number
  frames: number
}
```

## 🔢 内部存储原理

### 总帧数计算公式

```
总帧数 = (小时 × 3600 + 分钟 × 60 + 秒) × 帧率 + 帧数
```

### 示例转换

| 时间码 | 计算过程 | 总帧数 (30fps) |
|--------|----------|----------------|
| 00:30.15 | (0×3600 + 0×60 + 30) × 30 + 15 | 915 |
| 01:00.00 | (0×3600 + 1×60 + 0) × 30 + 0 | 1800 |
| 02:15.29 | (0×3600 + 2×60 + 15) × 30 + 29 | 4079 |

### 反向转换

```typescript
// 从总帧数恢复时分秒帧
const totalSeconds = Math.floor(totalFrames / frameRate)
const frames = totalFrames % frameRate
const hours = Math.floor(totalSeconds / 3600)
const minutes = Math.floor((totalSeconds % 3600) / 60)
const seconds = totalSeconds % 60
```

## 🛠️ API 设计

### 静态工厂方法

```typescript
// 从不同格式创建时间码
Timecode.fromString("00:30.15", 30)
Timecode.fromFrames(915, 30)
Timecode.fromSeconds(30.5, 30)
Timecode.fromMicroseconds(30500000, 30)
Timecode.zero(30)
```

### 获取器属性

```typescript
const tc = new Timecode("00:30.15")

tc.totalFrames    // 915
tc.frameRate      // 30
tc.components     // {hours: 0, minutes: 0, seconds: 30, frames: 15}
tc.hours          // 0
tc.minutes        // 0
tc.seconds        // 30
tc.frames         // 15
```

### 转换方法

```typescript
tc.toString()         // "00:30.15"
tc.toSeconds()        // 30.5
tc.toMicroseconds()   // 30500000
tc.toMilliseconds()   // 30500
```

### 运算方法

```typescript
const tc1 = new Timecode("00:30.15")  // 915帧
const tc2 = new Timecode("00:15.10")  // 460帧

tc1.add(tc2)          // 1375帧 → "00:45.25"
tc1.subtract(tc2)     // 455帧 → "00:15.05"
tc1.multiply(2)       // 1830帧 → "01:01.00"
tc1.divide(2)         // 457帧 → "00:15.07"
```

### 比较方法

```typescript
tc1.equals(tc2)       // false
tc1.lessThan(tc2)     // false
tc1.greaterThan(tc2)  // true
tc1.compare(tc2)      // 1 (大于)
tc1.isZero()          // false
```

### 实用方法

```typescript
tc1.clone()                    // 创建副本
tc1.convertFrameRate(25)       // 转换到25fps
```

## 🔄 运算优势

### 简单的整数运算

```typescript
// ✅ 基于总帧数的运算
class Timecode {
  add(other: Timecode): Timecode {
    return new Timecode(this._totalFrames + other._totalFrames, this._frameRate)
  }
  
  subtract(other: Timecode): Timecode {
    const result = Math.max(0, this._totalFrames - other._totalFrames)
    return new Timecode(result, this._frameRate)
  }
  
  compare(other: Timecode): number {
    return this._totalFrames - other._totalFrames
  }
}
```

### 避免复杂的进位计算

```typescript
// ❌ 如果直接用时分秒帧组件运算
function addComponents(a: TimecodeComponents, b: TimecodeComponents) {
  let frames = a.frames + b.frames
  let seconds = a.seconds + b.seconds
  let minutes = a.minutes + b.minutes
  let hours = a.hours + b.hours
  
  // 处理进位
  if (frames >= 30) { seconds += Math.floor(frames / 30); frames %= 30 }
  if (seconds >= 60) { minutes += Math.floor(seconds / 60); seconds %= 60 }
  if (minutes >= 60) { hours += Math.floor(minutes / 60); minutes %= 60 }
  
  return { hours, minutes, seconds, frames }
}
```

## 🎯 使用场景

### 1. 视频编辑操作

```typescript
// 剪切操作
const clipStart = new Timecode("00:30.00")
const clipEnd = new Timecode("01:15.15")
const clipDuration = clipEnd.subtract(clipStart)  // "00:45.15"

// 时间轴定位
const currentTime = new Timecode("00:45.10")
const nextFrame = currentTime.add(new Timecode("00:00.01"))  // "00:45.11"
```

### 2. WebAV集成

```typescript
// UI → WebAV
const userInput = new Timecode("00:30.15")
webAVControls.seekTo(userInput.toSeconds())  // 30.5

// WebAV → UI
function onTimeUpdate(microseconds: number) {
  const currentTime = Timecode.fromMicroseconds(microseconds)
  updateUI(currentTime.toString())  // "00:30.15"
}
```

### 3. 时间码验证

```typescript
// 输入验证
function validateTimecode(input: string): boolean {
  try {
    new Timecode(input)
    return true
  } catch {
    return false
  }
}
```

## 📊 性能特性

### 内存效率

```typescript
// 每个时间码实例只存储两个数字
class Timecode {
  private _totalFrames: number  // 4字节
  private _frameRate: number    // 4字节
}
// 总计：8字节 + 对象开销
```

### 运算效率

| 操作 | 复杂度 | 说明 |
|------|--------|------|
| 加法 | O(1) | 简单整数加法 |
| 减法 | O(1) | 简单整数减法 |
| 比较 | O(1) | 简单整数比较 |
| 转换为字符串 | O(1) | 固定的除法和取模运算 |

## 🔒 类型安全

### 防止无效操作

```typescript
// ✅ 类型安全
function processTimecode(tc: Timecode) {
  return tc.add(new Timecode("00:01.00"))
}

// ❌ 容易出错
function processTime(time: string | number) {
  // 不知道是秒还是帧还是时间码字符串
}
```

### 帧率一致性检查

```typescript
const tc1 = new Timecode("00:30.00", 30)  // 30fps
const tc2 = new Timecode("00:15.00", 25)  // 25fps

tc1.add(tc2)  // 抛出错误：帧率不匹配
```

## 🌟 扩展性

### 支持不同帧率

```typescript
const film = new Timecode("00:30.00", 24)    // 24fps 电影
const pal = new Timecode("00:30.00", 25)     // 25fps PAL
const ntsc = new Timecode("00:30.00", 30)    // 30fps NTSC
const highFps = new Timecode("00:30.00", 60) // 60fps 高帧率
```

### 帧率转换

```typescript
const ntscTime = new Timecode("00:30.00", 30)
const palTime = ntscTime.convertFrameRate(25)  // 自动转换到25fps
```

## 📝 实现注意事项

1. **输入验证**：构造函数需要验证时间码格式和数值范围
2. **帧率验证**：确保帧率为正数且在合理范围内
3. **溢出处理**：大数值运算时注意整数溢出
4. **精度保持**：避免浮点数运算，保持帧级精度
5. **不可变性**：运算方法返回新实例，不修改原实例

## 🎯 总结

基于总帧数的时间码设计提供了：

- **简单高效**的运算性能
- **精确可靠**的帧级精度  
- **类型安全**的操作接口
- **灵活强大**的转换能力
- **完美集成**WebAV系统

这种设计既满足了视频编辑的专业需求，又保证了系统的性能和可维护性。

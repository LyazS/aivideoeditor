# 🚫 WebAV边界保护指南

## 📋 概述

本文档明确规定了在时间码系统改进过程中，哪些WebAV相关模块**绝对不能**修改，以及如何正确处理WebAV边界的时间格式转换。

## 🚫 禁止修改的WebAV模块

### 核心WebAV文件
以下文件属于WebAV库接口层，**绝对禁止**进行时间码化：

```
📁 frontend/src/utils/
├── 🚫 VideoVisibleSprite.ts      # WebAV视频精灵实现
├── 🚫 ImageVisibleSprite.ts      # WebAV图片精灵实现
└── 🚫 spriteFactory.ts           # WebAV精灵工厂

📁 frontend/src/stores/modules/
└── 🚫 webavModule.ts             # WebAV核心模块

📁 frontend/src/composables/
└── ✅ useWebAVControls.ts        # 已有正确的边界转换
```

### 为什么不能修改？

1. **WebAV库要求**: WebAV库内部使用微秒作为时间单位
2. **接口契约**: 改变接口会破坏与WebAV库的兼容性
3. **性能考虑**: WebAV内部优化基于数字运算，不适合对象运算
4. **维护边界**: 保持清晰的架构边界，便于维护和调试

## ✅ 正确的边界转换模式

### 1. 业务逻辑层 → WebAV层

```typescript
// ✅ 正确的转换模式
class TimelineOperations {
  async splitVideoClip(itemId: string, splitTimeTC: Timecode) {
    // 业务逻辑使用时间码
    const item = this.getTimelineItem(itemId)
    const startTimeTC = Timecode.fromMicroseconds(item.timeRange.timelineStartTime, frameRate)
    const endTimeTC = Timecode.fromMicroseconds(item.timeRange.timelineEndTime, frameRate)
    
    // 计算分割点（时间码运算）
    const durationTC = endTimeTC.subtract(startTimeTC)
    const relativeTimeTC = splitTimeTC.subtract(startTimeTC)
    const ratio = relativeTimeTC.totalFrames / durationTC.totalFrames
    
    // 转换为WebAV需要的微秒格式
    const firstSprite = await createSpriteFromMediaItem(mediaItem)
    firstSprite.setTimeRange({
      clipStartTime: startTimeTC.toMicroseconds(),           // 转换为微秒
      clipEndTime: splitTimeTC.toMicroseconds(),             // 转换为微秒
      timelineStartTime: startTimeTC.toMicroseconds(),       // 转换为微秒
      timelineEndTime: splitTimeTC.toMicroseconds(),         // 转换为微秒
    })
  }
}
```

### 2. WebAV层 → 业务逻辑层

```typescript
// ✅ 正确的转换模式
class TimelineSync {
  syncFromSprite(sprite: VideoVisibleSprite, frameRate: number) {
    // 从WebAV获取微秒格式的时间范围
    const timeRange = sprite.getTimeRange()
    
    // 转换为业务逻辑层的时间码格式
    const startTimeTC = Timecode.fromMicroseconds(timeRange.timelineStartTime, frameRate)
    const endTimeTC = Timecode.fromMicroseconds(timeRange.timelineEndTime, frameRate)
    const durationTC = endTimeTC.subtract(startTimeTC)
    
    // 更新业务逻辑层的数据
    this.updateTimelineItem({
      startTime: startTimeTC,
      endTime: endTimeTC,
      duration: durationTC
    })
  }
}
```

### 3. 播放控制边界

```typescript
// ✅ useWebAVControls.ts 已经正确实现了边界转换
export function useWebAVControls() {
  // 接受时间码，转换为WebAV需要的格式
  function seekTo(timecode: Timecode | number) {
    let targetTime: number
    
    if (timecode instanceof Timecode) {
      targetTime = timecode.toSeconds()  // 转换为秒数
    } else {
      targetTime = timecode
    }
    
    // 传递给WebAV
    globalAVCanvas?.seek(targetTime)
  }
  
  // 从WebAV接收微秒，转换为时间码
  globalAVCanvas?.on('timeupdate', (microseconds: number) => {
    const currentTimecode = Timecode.fromMicroseconds(microseconds, frameRate)
    playbackModule.setCurrentTime(currentTimecode)  // 传递时间码对象
  })
}
```

## ❌ 错误的修改示例

### 不要这样做！

```typescript
// ❌ 错误：修改WebAV精灵接口
class VideoVisibleSprite {
  setTimeRange(timeRange: {
    clipStartTime: Timecode,      // ❌ 不要改为时间码
    clipEndTime: Timecode,        // ❌ 不要改为时间码
    timelineStartTime: Timecode,  // ❌ 不要改为时间码
    timelineEndTime: Timecode     // ❌ 不要改为时间码
  }) {
    // 这会破坏WebAV库的兼容性！
  }
}

// ❌ 错误：在WebAV模块中使用时间码运算
class VideoVisibleSprite {
  updatePlaybackRate(newRate: number) {
    // 不要在这里使用时间码计算
    const durationTC = this.endTimeTC.subtract(this.startTimeTC)  // ❌
    
    // 保持原有的微秒计算
    const duration = this.timeRange.timelineEndTime - this.timeRange.timelineStartTime  // ✅
  }
}
```

## 🔍 边界检查清单

### 开发阶段检查

- [ ] 确认没有修改 `VideoVisibleSprite.ts`
- [ ] 确认没有修改 `ImageVisibleSprite.ts`
- [ ] 确认没有修改 `spriteFactory.ts`
- [ ] 确认没有修改 `webavModule.ts`
- [ ] 确认所有WebAV接口调用使用微秒格式
- [ ] 确认时间码转换仅在边界进行

### 测试阶段验证

```typescript
// 测试WebAV边界转换
describe('WebAV Boundary Protection', () => {
  it('should maintain microsecond format in WebAV interfaces', () => {
    const sprite = new VideoVisibleSprite()
    
    // 确保WebAV接口仍然接受微秒
    sprite.setTimeRange({
      clipStartTime: 30500000,      // 微秒格式 ✅
      clipEndTime: 60000000,        // 微秒格式 ✅
      timelineStartTime: 0,         // 微秒格式 ✅
      timelineEndTime: 30500000,    // 微秒格式 ✅
    })
    
    const timeRange = sprite.getTimeRange()
    expect(typeof timeRange.clipStartTime).toBe('number')  // 确保返回数字
    expect(timeRange.clipStartTime).toBe(30500000)         // 确保是微秒
  })
  
  it('should convert timecode to microseconds at boundary', () => {
    const timecode = new Timecode('00:30.15', 30)
    const microseconds = timecode.toMicroseconds()
    
    // 边界转换测试
    expect(microseconds).toBe(30500000)
    
    // 确保WebAV接口接受转换后的值
    const sprite = new VideoVisibleSprite()
    expect(() => {
      sprite.setTimeRange({
        clipStartTime: microseconds,  // 转换后的微秒 ✅
        // ...
      })
    }).not.toThrow()
  })
})
```

## 📊 架构边界图

```
┌─────────────────────────────────────────────────────────────┐
│                    UI层 (时间码格式)                          │
│  TimecodeInput, TimeScale, Timeline, PropertiesPanel      │
│                         ↕️                                  │
│                   时间码 ↔ 时间码                            │
└─────────────────────────────────────────────────────────────┘
                            ↕️
                    时间码 ↔ 微秒 (转换边界)
                            ↕️
┌─────────────────────────────────────────────────────────────┐
│                  业务逻辑层 (时间码格式)                       │
│  videoStore, clipOperations, timelineArrangement          │
│                         ↕️                                  │
│                   时间码 ↔ 时间码                            │
└─────────────────────────────────────────────────────────────┘
                            ↕️
                    时间码 ↔ 微秒 (转换边界)
                            ↕️
┌─────────────────────────────────────────────────────────────┐
│                   WebAV层 (微秒格式)                         │
│  VideoVisibleSprite, ImageVisibleSprite, webavModule      │
│                         ↕️                                  │
│                    微秒 ↔ 微秒                              │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 最佳实践

### 1. 转换函数命名规范

```typescript
// ✅ 清晰的转换函数命名
function timecodeToWebAVMicroseconds(timecode: Timecode): number {
  return timecode.toMicroseconds()
}

function webAVMicrosecondsToTimecode(microseconds: number, frameRate: number): Timecode {
  return Timecode.fromMicroseconds(microseconds, frameRate)
}
```

### 2. 类型安全保护

```typescript
// ✅ 使用类型系统防止错误
interface WebAVTimeRange {
  clipStartTime: number      // 明确标注为微秒
  clipEndTime: number        // 明确标注为微秒
  timelineStartTime: number  // 明确标注为微秒
  timelineEndTime: number    // 明确标注为微秒
}

interface BusinessTimeRange {
  clipStartTime: Timecode    // 明确标注为时间码
  clipEndTime: Timecode      // 明确标注为时间码
  timelineStartTime: Timecode // 明确标注为时间码
  timelineEndTime: Timecode   // 明确标注为时间码
}
```

### 3. 文档注释

```typescript
/**
 * 设置WebAV精灵的时间范围
 * @param timeRange 时间范围配置（微秒格式）
 * @important 此方法属于WebAV边界，必须使用微秒格式，不要传入时间码对象
 */
setTimeRange(timeRange: WebAVTimeRange): void {
  // WebAV内部实现
}
```

## 🚨 违规检测

如果发现以下情况，说明违反了WebAV边界保护原则：

1. WebAV文件中出现 `Timecode` 类型引用
2. WebAV接口参数改为时间码对象
3. WebAV内部逻辑使用时间码运算
4. 缺少边界转换的直接传递

**记住**: WebAV = 微秒，业务逻辑 = 时间码，边界 = 转换

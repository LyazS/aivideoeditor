# 🎬 时间码系统全面重构计划

## 📋 重构目标

将当前基于秒数的时间系统重构为真正基于时间码(Timecode)的系统，实现：
- **系统内部统一使用 Timecode 对象**（基于帧数存储）
- **只在 WebAV 接口边界进行微秒转换**
- **帧级精度的时间控制**
- **类型安全的时间操作**

## 🎯 核心设计原则

### 1. **时间表示层次**
```
UI层 ← → Timecode对象 ← → Store状态管理
                ↓
        只在WebAV边界转换
                ↓
            WebAV微秒
```

### 2. **数据流向**
```
用户操作 → Timecode对象 → Store状态 → 必要时转换为微秒 → WebAV
WebAV微秒 → 转换为Timecode → Store状态 → UI显示
```

### 3. **转换边界**
- **内部**: 全部使用 `Timecode` 对象
- **WebAV接口**: `TimecodeUtils.timecodeToWebAV()` / `TimecodeUtils.webAVToTimecode()`
- **用户输入**: 字符串 → `Timecode.fromString()`
- **显示**: `timecode.toString()`

## 🏗️ 重构范围分析

### 📊 **需要重构的核心模块**

#### 1. **Store状态管理** 🔴 高优先级
- `playbackModule.ts` - 播放时间状态
- `configModule.ts` - 时间轴配置
- `timelineModule.ts` - 时间轴项目管理
- `storeUtils.ts` - 时间计算工具

#### 2. **WebAV接口层** 🔴 高优先级  
- `useWebAVControls.ts` - WebAV控制接口
- `VideoVisibleSprite.ts` - 时间范围管理
- `ImageVisibleSprite.ts` - 图片时间管理

#### 3. **UI组件层** 🟡 中优先级
- `TimeScale.vue` - 时间轴刻度
- `VideoClip.vue` - 视频片段
- `PropertiesPanel.vue` - 属性面板
- `VideoPreviewEngine.vue` - 播放控制

#### 4. **工具函数层** 🟢 低优先级
- `timeUtils.ts` - 时间工具函数
- `coordinateTransform.ts` - 坐标转换
- `thumbnailGenerator.ts` - 缩略图生成

## 📋 详细重构任务

### 阶段1: 核心基础重构 (2-3天)

#### 任务1.1: Store状态管理重构
**文件**: `frontend/src/stores/modules/playbackModule.ts`
**当前问题**:
```typescript
const currentTime = ref(0) // 当前播放时间（秒）
```
**重构目标**:
```typescript
const currentTime = ref(Timecode.zero(30)) // 当前播放时间（Timecode对象）
```

**具体修改**:
- [ ] 将 `currentTime` 类型从 `number` 改为 `Timecode`
- [ ] 更新 `setCurrentTime()` 方法接受 `Timecode` 参数
- [ ] 修改 `formattedCurrentTime` 计算属性直接使用 `toString()`
- [ ] 更新所有时间比较和计算逻辑

#### 任务1.2: 时间轴配置重构
**文件**: `frontend/src/stores/modules/configModule.ts`
**重构目标**:
```typescript
const timelineDuration = ref(Timecode.fromSeconds(60, 30)) // 时间轴总时长
```

#### 任务1.3: WebAV接口边界重构
**文件**: `frontend/src/composables/useWebAVControls.ts`
**当前问题**:
```typescript
const timeInSeconds = time / 1000000
videoStore.setCurrentTime(timeInSeconds, false)
```
**重构目标**:
```typescript
const timecode = TimecodeUtils.webAVToTimecode(time, frameRate)
videoStore.setCurrentTime(timecode, false)
```

### 阶段2: 时间轴系统重构 (2-3天)

#### 任务2.1: 时间轴项目管理
**文件**: `frontend/src/stores/modules/timelineModule.ts`
**重构内容**:
- [ ] TimelineItem 的时间范围使用 Timecode 对象
- [ ] 时间轴项目的位置计算使用 Timecode
- [ ] 拖拽和调整大小的时间计算

#### 任务2.2: 时间范围管理重构
**文件**: `frontend/src/utils/VideoVisibleSprite.ts`
**当前问题**:
```typescript
interface VideoTimeRange {
  clipStartTime: number      // 微秒
  clipEndTime: number        // 微秒
  timelineStartTime: number  // 微秒
  timelineEndTime: number    // 微秒
}
```
**重构目标**:
```typescript
interface VideoTimeRange {
  clipStartTime: Timecode
  clipEndTime: Timecode  
  timelineStartTime: Timecode
  timelineEndTime: Timecode
}
```

#### 任务2.3: 时间计算工具重构
**文件**: `frontend/src/stores/utils/storeUtils.ts`
**重构内容**:
- [ ] `timeToPixel()` / `pixelToTime()` 使用 Timecode
- [ ] `alignTimeToFrame()` 直接在 Timecode 内部处理
- [ ] 所有时间计算函数使用 Timecode 参数

### 阶段3: UI组件层重构 (2-3天)

#### 任务3.1: 时间轴刻度重构
**文件**: `frontend/src/components/TimeScale.vue`
**当前问题**:
```typescript
const newTime = videoStore.pixelToTime(clickX, containerWidth.value)
const alignedTime = alignTimeToFrame(clampedTime)
webAVControls.seekTo(alignedTime) // 传递秒数
```
**重构目标**:
```typescript
const newTimecode = videoStore.pixelToTimecode(clickX, containerWidth.value)
const alignedTimecode = newTimecode.alignToFrame()
webAVControls.seekTo(alignedTimecode) // 传递Timecode，内部转换为微秒
```

#### 任务3.2: 视频片段组件重构
**文件**: `frontend/src/components/VideoClip.vue`
**重构内容**:
- [ ] 片段时长显示直接使用 `timecode.toString()`
- [ ] 拖拽位置计算使用 Timecode
- [ ] 片段调整大小使用 Timecode

#### 任务3.3: 属性面板重构
**文件**: `frontend/src/components/PropertiesPanel.vue`
**重构内容**:
- [ ] 目标时长使用 Timecode 对象
- [ ] TimecodeInput 组件直接绑定 Timecode
- [ ] 时长更新逻辑使用 Timecode

### 阶段4: 工具函数和优化 (1-2天)

#### 任务4.1: 时间工具函数重构
**文件**: `frontend/src/stores/utils/timeUtils.ts`
**重构内容**:
- [ ] 移除基于秒数的时间计算函数
- [ ] 保留 Timecode 相关的便捷函数
- [ ] 更新像素-时间转换函数

#### 任务4.2: 类型定义更新
**文件**: `frontend/src/types/videoTypes.ts`
**重构内容**:
- [ ] 更新 TimelineItem 接口使用 Timecode
- [ ] 更新所有时间相关的类型定义
- [ ] 确保类型安全

## 🔧 重构实施策略

### 1. **渐进式重构**
- 从核心 Store 开始，逐层向外重构
- 保持每个阶段的功能完整性
- 每个任务完成后进行测试验证

### 2. **向后兼容**
- 在重构过程中保留必要的转换函数
- 逐步移除旧的基于秒数的接口
- 确保重构过程中项目可正常运行

### 3. **测试策略**
- 每个模块重构后立即测试
- 重点测试时间精度和同步性
- 验证 WebAV 集成的正确性

## 📊 预期效果

### ✅ **重构完成后的优势**

1. **真正的帧级精度**: 所有时间操作都基于帧数，避免浮点数精度问题
2. **类型安全**: Timecode 对象提供强类型保护，防止时间相关错误
3. **性能优化**: 基于整数帧数的快速计算，避免复杂的时间转换
4. **代码清晰**: 时间相关逻辑更加直观和易维护
5. **专业标准**: 符合视频编辑行业的时间码标准

### 📈 **关键指标**

- **时间精度**: 帧级精度 (1/30秒 ≈ 33.33ms)
- **性能提升**: 减少不必要的时间格式转换
- **代码质量**: 类型安全，减少时间相关bug
- **用户体验**: 更精确的时间控制和显示

## ⚠️ 风险评估

### 🔴 **高风险项**
1. **WebAV集成复杂性**: 需要确保微秒转换的精确性
2. **大量代码修改**: 涉及多个核心模块的重构

### 🟡 **中风险项**  
1. **性能影响**: 需要验证 Timecode 对象的性能表现
2. **测试覆盖**: 需要全面测试时间相关功能

### 应对策略
- 分阶段实施，每阶段充分测试
- 保留回滚机制，必要时可快速恢复
- 重点关注 WebAV 接口的稳定性

## 📅 时间规划

- **阶段1**: 2-3天 (核心基础)
- **阶段2**: 2-3天 (时间轴系统) 
- **阶段3**: 2-3天 (UI组件层)
- **阶段4**: 1-2天 (优化完善)
- **总计**: 7-11天

## 🎯 成功标准

1. ✅ 所有时间状态使用 Timecode 对象存储
2. ✅ WebAV 接口边界正确转换微秒
3. ✅ 时间操作具有帧级精度
4. ✅ 项目功能完全正常
5. ✅ 性能不低于重构前
6. ✅ 代码类型安全，无时间相关错误

## 🔧 技术实现细节

### 核心接口设计

#### 1. **Store状态接口**
```typescript
// 重构前
interface PlaybackState {
  currentTime: number  // 秒
  totalDuration: number  // 秒
}

// 重构后
interface PlaybackState {
  currentTime: Timecode
  totalDuration: Timecode
}
```

#### 2. **WebAV接口适配器**
```typescript
class WebAVTimecodeAdapter {
  static seekTo(timecode: Timecode): void {
    const microseconds = timecode.toMicroseconds()
    globalAVCanvas.previewFrame(microseconds)
  }

  static onTimeUpdate(callback: (timecode: Timecode) => void): void {
    globalAVCanvas.on('timeupdate', (microseconds: number) => {
      const timecode = Timecode.fromMicroseconds(microseconds, 30)
      callback(timecode)
    })
  }
}
```

#### 3. **时间轴坐标转换**
```typescript
// 重构前
function pixelToTime(pixel: number, width: number): number // 返回秒数

// 重构后
function pixelToTimecode(pixel: number, width: number): Timecode // 返回Timecode对象
```

### 数据迁移策略

#### 1. **渐进式类型转换**
```typescript
// 阶段1: 添加新接口，保留旧接口
interface PlaybackModule {
  currentTime: Ref<number>  // 旧接口，标记为deprecated
  currentTimecode: Ref<Timecode>  // 新接口

  setCurrentTime(time: number): void  // 旧方法
  setCurrentTimecode(timecode: Timecode): void  // 新方法
}

// 阶段2: 逐步迁移调用方
// 阶段3: 移除旧接口
```

#### 2. **兼容性包装器**
```typescript
// 为旧代码提供临时兼容
function legacyTimeToTimecode(seconds: number): Timecode {
  return Timecode.fromSeconds(seconds, 30)
}

function timecodeToLegacyTime(timecode: Timecode): number {
  return timecode.toSeconds()
}
```

### 性能优化考虑

#### 1. **Timecode对象缓存**
```typescript
class TimecodeCache {
  private static cache = new Map<string, Timecode>()

  static get(frames: number, frameRate: number): Timecode {
    const key = `${frames}_${frameRate}`
    if (!this.cache.has(key)) {
      this.cache.set(key, new Timecode(frames, frameRate))
    }
    return this.cache.get(key)!
  }
}
```

#### 2. **批量操作优化**
```typescript
// 避免频繁创建Timecode对象
class TimecodeOperations {
  static addFrames(timecode: Timecode, frames: number): Timecode {
    return new Timecode(timecode.totalFrames + frames, timecode.frameRate)
  }

  static subtractFrames(timecode: Timecode, frames: number): Timecode {
    return new Timecode(Math.max(0, timecode.totalFrames - frames), timecode.frameRate)
  }
}
```

## 📋 详细检查清单

### 阶段1检查项
- [ ] playbackModule.ts 中所有时间状态改为Timecode
- [ ] useWebAVControls.ts 中WebAV接口边界转换正确
- [ ] 时间更新事件处理使用Timecode
- [ ] 播放控制方法接受Timecode参数
- [ ] 所有时间比较使用Timecode方法

### 阶段2检查项
- [ ] TimelineItem接口使用Timecode时间范围
- [ ] VideoVisibleSprite时间范围使用Timecode
- [ ] 时间轴项目拖拽使用Timecode计算
- [ ] 片段调整大小使用Timecode
- [ ] 自动排列功能使用Timecode

### 阶段3检查项
- [ ] TimeScale组件时间计算使用Timecode
- [ ] VideoClip组件显示使用Timecode
- [ ] PropertiesPanel时长设置使用Timecode
- [ ] 所有UI时间显示直接调用toString()
- [ ] 用户输入转换为Timecode对象

### 阶段4检查项
- [ ] 移除所有基于秒数的时间函数
- [ ] 更新所有时间相关类型定义
- [ ] 性能测试通过
- [ ] 内存使用合理
- [ ] 无类型错误

## 🧪 测试计划

### 单元测试
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

### 集成测试
```typescript
describe('WebAV Timecode Integration', () => {
  test('seekTo should convert Timecode to microseconds', async () => {
    const timecode = new Timecode("00:30.15", 30)
    await webAVControls.seekTo(timecode)
    // 验证WebAV接收到正确的微秒数
  })

  test('timeupdate should convert microseconds to Timecode', () => {
    // 模拟WebAV timeupdate事件
    // 验证Store接收到正确的Timecode对象
  })
})
```

### 端到端测试
- 播放控制的时间精度测试
- 时间轴拖拽的帧对齐测试
- 片段编辑的时间计算测试
- 属性面板时长设置测试

## 📚 文档更新

### 需要更新的文档
1. **API文档**: 更新所有时间相关接口
2. **开发指南**: 添加Timecode使用规范
3. **类型定义**: 更新TypeScript类型文档
4. **示例代码**: 提供Timecode使用示例

### 新增文档
1. **Timecode最佳实践**: 如何正确使用Timecode对象
2. **性能指南**: Timecode对象的性能优化建议
3. **迁移指南**: 从秒数到Timecode的迁移步骤

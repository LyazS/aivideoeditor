# TimelineItem 配置类型激进重构方案

## 概述

本文档描述了 TimelineItem 接口的激进重构方案，目标是彻底重新设计配置类型结构，为不同的媒体类型（video、image、audio）提供类型安全的配置，提高代码的可维护性和扩展性。

## 重构理念

**激进重构，不保留向后兼容性**。我们将彻底重新设计 TimelineItem 接口，优先考虑：

1. **类型安全**：每种媒体类型只包含相关属性
2. **架构清晰**：属性按功能和适用性分层组织
3. **扩展性优先**：为未来功能扩展提供最佳架构
4. **数据流向一致性**：严格遵循 UI → WebAV → TimelineItem → UI 的数据流向

## 数据流向准则

### 核心数据流向原则

**UI → WebAV → TimelineItem → UI**

这是系统中所有数据变更必须遵循的单向数据流：

1. **UI 层**：用户交互触发属性变更
2. **WebAV 层**：接收变更并更新内部状态，通过 `propsChange` 事件通知系统
3. **TimelineItem 层**：监听 WebAV 事件，更新配置数据
4. **UI 层**：响应 TimelineItem 变更，更新界面显示

### 数据流向实施要求

#### 1. 属性设置流程

```typescript
// ✅ 正确的数据流向
function updateItemProperty<T extends MediaType>(
  item: TimelineItem<T>,
  property: keyof GetMediaConfig<T>,
  value: any
) {
  // 1. UI → WebAV：设置 WebAV 属性
  item.sprite[property] = value

  // 2. WebAV → TimelineItem：WebAV 自动触发 propsChange 事件
  // 3. TimelineItem → UI：响应式数据自动更新 UI
}

// ❌ 错误的数据流向 - 直接修改 TimelineItem
function updateItemPropertyWrong<T extends MediaType>(
  item: TimelineItem<T>,
  property: keyof GetMediaConfig<T>,
  value: any
) {
  // 这样会破坏数据流向一致性
  item.config[property] = value
}
```

#### 2. 撤销/重做流程

撤销操作必须保持相同的数据流向：

```typescript
async undo(): Promise<void> {
  const item = this.timelineModule.getTimelineItem(this.timelineItemId)
  if (!item) return

  // ✅ 正确：通过 WebAV 恢复属性，保持数据流向
  Object.entries(this.oldValues).forEach(([key, value]) => {
    item.sprite[key] = value // UI → WebAV
    // WebAV 会自动触发 propsChange → TimelineItem → UI
  })

  // 触发渲染更新
  avCanvas.preFrame()
}
```

#### 3. 动画系统数据流向

关键帧动画也必须遵循相同的数据流向：

```typescript
// ✅ 正确的动画属性更新
function applyKeyframeValues<T extends MediaType>(
  item: TimelineItem<T>,
  keyframeValues: Partial<GetKeyframeProperties<T>>
) {
  // 1. UI → WebAV：通过 WebAV 设置属性
  Object.entries(keyframeValues).forEach(([key, value]) => {
    item.sprite[key] = value
  })

  // 2. WebAV → TimelineItem：WebAV 触发 propsChange
  // 3. TimelineItem → UI：自动更新界面
}
```

#### 4. 特殊属性处理

某些属性（如 opacity、volume）需要特殊的数据流向处理：

```typescript
// opacity 属性的数据流向
function updateOpacity<T extends MediaType>(item: TimelineItem<T>, opacity: number) {
  // 1. UI → WebAV
  item.sprite.opacity = opacity

  // 2. WebAV 不支持 opacity 的 propsChange，需要自定义事件
  item.sprite.emit('opacityChange', { opacity })

  // 3. TimelineItem 监听自定义事件并更新配置
  // 4. UI 响应配置变更
}

// volume 属性的数据流向
function updateVolume<T extends MediaType>(item: TimelineItem<T>, volume: number) {
  // 1. UI → WebAV
  item.sprite.volume = volume

  // 2. volume 也不支持 propsChange，使用自定义事件
  item.sprite.emit('volumeChange', { volume })

  // 3. TimelineItem → UI
}
```

### 数据流向违规检查

在重构过程中，必须检查并修复所有违反数据流向的代码：

#### 常见违规模式

```typescript
// ❌ 违规：直接修改 TimelineItem 配置
item.config.x = newX

// ❌ 违规：绕过 WebAV 直接同步
item.config.opacity = newOpacity
updateUI()

// ❌ 违规：双向同步导致循环更新
watch(() => item.config.x, (newX) => {
  item.sprite.x = newX // 可能导致循环
})
```

#### 正确的实现模式

```typescript
// ✅ 正确：遵循数据流向
function setItemPosition(item: TimelineItem, x: number, y: number) {
  // UI → WebAV
  item.sprite.x = x
  item.sprite.y = y
  // WebAV → TimelineItem → UI (自动)
}

// ✅ 正确：单向数据绑定
function setupDataBinding<T extends MediaType>(item: TimelineItem<T>) {
  // 只监听 WebAV 的变更，不反向设置
  item.sprite.on('propsChange', (props) => {
    Object.assign(item.config, props)
  })
}
```

## 当前问题

现有的 TimelineItem 接口存在根本性设计问题：

1. **类型混乱**：所有媒体类型共享相同属性，音频项目也有 `x`、`y` 等视觉属性
2. **架构落后**：平铺式属性设计无法适应多媒体类型的复杂需求
3. **扩展困难**：新增媒体类型需要污染核心接口

## 设计方案

### 1. 基础类型定义

```typescript
// 媒体类型 - 添加音频支持
export type MediaType = 'video' | 'image' | 'audio'

// 轨道类型保持不变
export type TrackType = 'video' | 'audio' | 'text'
```

### 2. 配置属性分层

#### 基础属性（所有媒体类型共享）

```typescript
interface BaseMediaProps {
  // 层级控制
  zIndex: number
  
  // 动画配置（可选）
  animation?: AnimationConfig
}
```

#### 视觉媒体属性（video 和 image 共享）

```typescript
interface VisualMediaProps extends BaseMediaProps {
  // 位置和大小
  x: number
  y: number
  width: number
  height: number
  
  // 视觉效果
  rotation: number // 旋转角度（弧度）
  opacity: number  // 透明度（0-1）
}
```

#### 音频媒体属性（video 和 audio 共享）

```typescript
interface AudioMediaProps {
  // 音频控制
  volume: number   // 音量（0-1）
  isMuted: boolean // 静音状态
  
  // 预留：音频特效
  // audioEffects?: AudioEffectConfig[]
}
```

### 3. 具体媒体类型配置

```typescript
// 视频配置：同时具有视觉和音频属性
interface VideoMediaConfig extends VisualMediaProps, AudioMediaProps {
  // 视频特有属性（预留）
  // playbackRate?: number // 倍速可能在 timeRange 中更合适
}

// 图片配置：只有视觉属性
interface ImageMediaConfig extends VisualMediaProps {
  // 图片特有属性（预留）
  // filters?: ImageFilterConfig[]
}

// 音频配置：只有音频属性
interface AudioMediaConfig extends BaseMediaProps, AudioMediaProps {
  // 音频特有属性（预留）
  // waveformColor?: string
  // showWaveform?: boolean
}
```

### 4. 类型映射和工具类型

```typescript
// 媒体配置映射
type MediaConfigMap = {
  video: VideoMediaConfig
  image: ImageMediaConfig
  audio: AudioMediaConfig
}

// 根据媒体类型获取对应配置的工具类型
type GetMediaConfig<T extends MediaType> = MediaConfigMap[T]
```

### 5. 重构后的 TimelineItem 接口

```typescript
export interface TimelineItem<T extends MediaType = MediaType> {
  // 基础信息
  id: string
  mediaItemId: string
  trackId: string
  mediaType: T
  timeRange: T extends 'video' ? VideoTimeRange : 
            T extends 'audio' ? AudioTimeRange : 
            ImageTimeRange
  sprite: Raw<CustomSprite>
  thumbnailUrl?: string
  
  // 媒体配置（根据类型自动推断）
  config: GetMediaConfig<T>
}
```

## 使用示例

### 创建不同类型的时间轴项目

```typescript
// 视频项目 - 具有完整的视觉和音频属性
const videoItem: TimelineItem<'video'> = {
  id: 'video-1',
  mediaItemId: 'media-1',
  trackId: 'track-1',
  mediaType: 'video',
  timeRange: { /* VideoTimeRange */ },
  sprite: markRaw(videoSprite),
  config: {
    // 视觉属性
    x: 100, y: 100, width: 640, height: 360,
    rotation: 0, opacity: 1, zIndex: 1,
    // 音频属性  
    volume: 0.8, isMuted: false,
    // 基础属性
    animation: undefined
  }
}

// 图片项目 - 只有视觉属性，没有音频属性
const imageItem: TimelineItem<'image'> = {
  id: 'image-1',
  mediaItemId: 'media-2',
  trackId: 'track-1',
  mediaType: 'image',
  timeRange: { /* ImageTimeRange */ },
  sprite: markRaw(imageSprite),
  config: {
    // 视觉属性
    x: 200, y: 200, width: 400, height: 300,
    rotation: 0.5, opacity: 0.9, zIndex: 2,
    // 基础属性
    animation: undefined
    // 注意：没有 volume、isMuted 等音频属性
  }
}

// 音频项目 - 只有音频属性，没有视觉属性
const audioItem: TimelineItem<'audio'> = {
  id: 'audio-1',
  mediaItemId: 'media-3',
  trackId: 'track-2',
  mediaType: 'audio',
  timeRange: { /* AudioTimeRange */ },
  sprite: markRaw(audioSprite),
  config: {
    // 音频属性
    volume: 1.0, isMuted: false,
    // 基础属性
    zIndex: 1, animation: undefined
    // 注意：没有 x、y、width、height 等视觉属性
  }
}
```

### 类型安全的属性访问

```typescript
function updateItemConfig<T extends MediaType>(item: TimelineItem<T>) {
  // 基础属性 - 所有类型都有
  item.config.zIndex = 10
  
  // 条件属性访问 - TypeScript 会进行类型检查
  if (item.mediaType === 'video') {
    // 视频类型：可以访问视觉和音频属性
    item.config.x = 100        // ✅ 正确
    item.config.volume = 0.5   // ✅ 正确
  }
  
  if (item.mediaType === 'image') {
    // 图片类型：只能访问视觉属性
    item.config.opacity = 0.8  // ✅ 正确
    // item.config.volume = 0.5   // ❌ 编译错误
  }
  
  if (item.mediaType === 'audio') {
    // 音频类型：只能访问音频属性
    item.config.isMuted = true // ✅ 正确
    // item.config.x = 100        // ❌ 编译错误
  }
}
```

## 实施策略

### 激进重构方案

**一次性完全重构，不保留向后兼容性**

1. **立即替换**：直接用新的 TimelineItem 接口替换现有接口
2. **全面更新**：同时更新所有相关代码，包括组件、store、工具函数
3. **彻底清理**：移除所有旧的类型定义和相关代码

### 重构步骤

1. **更新类型定义**：在 `types/index.ts` 中完全替换 TimelineItem 接口
2. **更新核心模块**：修改 timelineModule、videoStore 等核心模块
3. **更新组件**：修改所有使用 TimelineItem 的 Vue 组件
4. **更新工具函数**：修改所有相关的工具函数和辅助方法
5. **测试验证**：确保所有功能正常工作

## 重构优势

### 1. 彻底的类型安全
- 每种媒体类型只包含相关属性，从根本上杜绝类型错误
- 编译时强制类型检查，运行时零类型错误
- 音频项目永远不会有视觉属性，图片项目永远不会有音频属性

### 2. 架构现代化
- 基于组合模式的配置设计，符合现代软件架构理念
- 属性按功能域分层，代码结构清晰明了
- 接口职责单一，符合 SOLID 原则

### 3. 极致的扩展性
- 新增媒体类型只需添加配置接口，零侵入性
- 属性集合可以灵活组合，支持复杂的媒体类型
- 为 AI 生成内容、3D 模型等未来媒体类型预留空间

### 4. 开发体验优化
- IDE 智能提示更精确，只显示相关属性
- 重构工具支持更好，属性重命名影响范围明确
- 代码可读性大幅提升，新人上手更容易

## 重构要求

### 必须完成的修改

1. **类型定义**：完全重写 `types/index.ts` 中的 TimelineItem 相关类型
2. **核心模块**：更新所有 store 模块中的 TimelineItem 使用
3. **组件层**：修改所有 Vue 组件中的属性访问方式
4. **工具函数**：更新所有辅助函数和工具方法
5. **测试代码**：更新所有相关的测试用例

### 代码质量要求

- 所有 TypeScript 编译错误必须解决
- 所有 ESLint 警告必须清理
- 所有功能测试必须通过
- 代码覆盖率不能下降

## 关键帧系统重构方案

### 1. 关键帧属性类型重构

#### 当前问题

现有关键帧系统硬编码了所有视觉属性，无法适应不同媒体类型：

```typescript
// 当前的硬编码实现
export interface KeyframeProperties {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
}
```

#### 重构方案

```typescript
// 基础可动画属性（所有媒体类型共享）
interface BaseAnimatableProps {
  zIndex: number
}

// 视觉可动画属性（video 和 image 共享）
interface VisualAnimatableProps extends BaseAnimatableProps {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
}

// 音频可动画属性（video 和 audio 共享）
interface AudioAnimatableProps extends BaseAnimatableProps {
  volume: number
  // 注意：isMuted 通常不需要动画，但可以考虑添加
}

// 根据媒体类型的关键帧属性映射
type KeyframePropertiesMap = {
  video: VisualAnimatableProps & AudioAnimatableProps
  image: VisualAnimatableProps
  audio: AudioAnimatableProps
}

// 泛型关键帧属性工具类型
type GetKeyframeProperties<T extends MediaType> = KeyframePropertiesMap[T]

// 重构后的关键帧接口
export interface Keyframe<T extends MediaType = MediaType> {
  framePosition: number
  properties: GetKeyframeProperties<T>
}

// 重构后的动画配置
export interface AnimationConfig<T extends MediaType = MediaType> {
  keyframes: Keyframe<T>[]
  isEnabled: boolean
  easing?: string
}
```

### 2. 关键帧命令系统重构

#### 当前问题

关键帧命令硬编码了属性快照，无法适应不同媒体类型：

```typescript
// 当前的硬编码实现
interface KeyframeSnapshot {
  animationConfig: AnimationConfig | null
  itemProperties: {
    x: number
    y: number
    width: number
    height: number
    rotation: number
    opacity: number
  }
}
```

#### 重构方案

```typescript
// 泛型关键帧快照
interface KeyframeSnapshot<T extends MediaType = MediaType> {
  animationConfig: AnimationConfig<T> | null
  itemProperties: GetMediaConfig<T>
}

// 泛型关键帧命令基类
abstract class BaseKeyframeCommand<T extends MediaType = MediaType> implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  protected beforeSnapshot: KeyframeSnapshot<T>
  protected afterSnapshot: KeyframeSnapshot<T> | null = null

  constructor(
    protected timelineItemId: string,
    protected frame: number,
    protected timelineModule: {
      getTimelineItem: (id: string) => TimelineItem<T> | undefined
    },
    protected webavAnimationManager: {
      updateWebAVAnimation: (item: TimelineItem<T>) => Promise<void>
    }
  ) {
    this.id = generateCommandId()

    // 保存执行前的状态快照
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${timelineItemId}`)
    }
    this.beforeSnapshot = this.createSnapshot(item)
  }

  /**
   * 创建类型安全的状态快照
   */
  protected createSnapshot(item: TimelineItem<T>): KeyframeSnapshot<T> {
    return {
      animationConfig: item.config.animation || null,
      itemProperties: { ...item.config }
    }
  }

  /**
   * 应用类型安全的状态快照
   */
  protected async applySnapshot(item: TimelineItem<T>, snapshot: KeyframeSnapshot<T>): Promise<void> {
    // 恢复动画配置
    item.config.animation = snapshot.animationConfig || undefined

    // 恢复项目属性（只恢复可动画的属性）
    Object.assign(item.config, snapshot.itemProperties)

    // 更新WebAV动画
    await this.webavAnimationManager.updateWebAVAnimation(item)
  }

  abstract execute(): Promise<void>
  abstract undo(): Promise<void>
}

// 具体的关键帧命令实现
export class CreateKeyframeCommand<T extends MediaType = MediaType> extends BaseKeyframeCommand<T> {
  constructor(
    timelineItemId: string,
    frame: number,
    timelineModule: { getTimelineItem: (id: string) => TimelineItem<T> | undefined },
    webavAnimationManager: { updateWebAVAnimation: (item: TimelineItem<T>) => Promise<void> },
    private playbackControls?: { seekTo: (frame: number) => void }
  ) {
    super(timelineItemId, frame, timelineModule, webavAnimationManager)
    this.description = `创建关键帧 (帧 ${frame})`
  }

  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    // 使用类型安全的关键帧创建逻辑
    const keyframe = createKeyframe(item, this.frame)

    if (!item.config.animation) {
      initializeAnimation(item)
    }
    enableAnimation(item)

    item.config.animation!.keyframes.push(keyframe)
    sortKeyframes(item)

    await this.webavAnimationManager.updateWebAVAnimation(item)
    this.afterSnapshot = this.createSnapshot(item)

    if (this.playbackControls) {
      this.playbackControls.seekTo(this.frame)
    }
  }

  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    await this.applySnapshot(item, this.beforeSnapshot)

    if (this.playbackControls) {
      this.playbackControls.seekTo(this.frame)
    }
  }
}
```

### 3. 关键帧工具函数重构

#### 当前问题

关键帧工具函数硬编码了属性提取逻辑：

```typescript
// 当前的硬编码实现
export function createKeyframe(item: TimelineItem, absoluteFrame: number): Keyframe {
  return {
    framePosition: relativeFrame,
    properties: {
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      rotation: item.rotation,
      opacity: item.opacity,
    },
  }
}
```

#### 重构方案

```typescript
/**
 * 类型安全的关键帧创建函数
 */
export function createKeyframe<T extends MediaType>(
  item: TimelineItem<T>,
  absoluteFrame: number
): Keyframe<T> {
  const relativeFrame = absoluteFrameToRelativeFrame(absoluteFrame, item.timeRange)

  // 根据媒体类型提取相应的可动画属性
  const properties = extractAnimatableProperties(item)

  return {
    framePosition: relativeFrame,
    properties
  }
}

/**
 * 提取可动画属性的类型安全工具函数
 */
function extractAnimatableProperties<T extends MediaType>(item: TimelineItem<T>): GetKeyframeProperties<T> {
  const baseProps = { zIndex: item.config.zIndex }

  if (item.mediaType === 'video') {
    return {
      ...baseProps,
      x: item.config.x,
      y: item.config.y,
      width: item.config.width,
      height: item.config.height,
      rotation: item.config.rotation,
      opacity: item.config.opacity,
      volume: item.config.volume
    } as GetKeyframeProperties<T>
  }

  if (item.mediaType === 'image') {
    return {
      ...baseProps,
      x: item.config.x,
      y: item.config.y,
      width: item.config.width,
      height: item.config.height,
      rotation: item.config.rotation,
      opacity: item.config.opacity
    } as GetKeyframeProperties<T>
  }

  if (item.mediaType === 'audio') {
    return {
      ...baseProps,
      volume: item.config.volume
    } as GetKeyframeProperties<T>
  }

  throw new Error(`不支持的媒体类型: ${item.mediaType}`)
}

/**
 * 类型安全的动画初始化函数
 */
export function initializeAnimation<T extends MediaType>(item: TimelineItem<T>): void {
  if (!item.config.animation) {
    item.config.animation = {
      keyframes: [],
      isEnabled: false,
      easing: 'linear',
    } as AnimationConfig<T>
  }
}

/**
 * 类型安全的动画启用函数
 */
export function enableAnimation<T extends MediaType>(item: TimelineItem<T>): void {
  if (item.config.animation) {
    item.config.animation.isEnabled = true
  }
}

/**
 * 类型安全的关键帧排序函数
 */
export function sortKeyframes<T extends MediaType>(item: TimelineItem<T>): void {
  if (item.config.animation) {
    item.config.animation.keyframes.sort((a, b) => a.framePosition - b.framePosition)
  }
}
```

## 操作记录系统重构方案

### 1. 时间轴项目命令重构

#### 当前问题

时间轴命令硬编码了所有属性，无法适应不同媒体类型：

```typescript
// 当前的硬编码实现
this.originalTimelineItemData = {
  id: timelineItem.id,
  mediaItemId: timelineItem.mediaItemId,
  trackId: timelineItem.trackId,
  mediaType: timelineItem.mediaType,
  timeRange: { ...timelineItem.timeRange },
  x: timelineItem.x,
  y: timelineItem.y,
  width: timelineItem.width,
  height: timelineItem.height,
  rotation: timelineItem.rotation,
  zIndex: timelineItem.zIndex,
  opacity: timelineItem.opacity,
  volume: timelineItem.volume,
  isMuted: timelineItem.isMuted,
  thumbnailUrl: timelineItem.thumbnailUrl,
}
```

#### 重构方案

```typescript
// 泛型时间轴项目数据接口
interface TimelineItemData<T extends MediaType = MediaType> {
  id: string
  mediaItemId: string
  trackId: string
  mediaType: T
  timeRange: T extends 'video' ? VideoTimeRange :
            T extends 'audio' ? AudioTimeRange :
            ImageTimeRange
  config: GetMediaConfig<T>
  thumbnailUrl?: string
}

// 泛型时间轴命令基类
abstract class BaseTimelineCommand<T extends MediaType = MediaType> implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  protected originalTimelineItemData: TimelineItemData<T>

  constructor(
    timelineItem: TimelineItem<T>,
    protected timelineModule: any,
    protected webavModule: any,
    protected mediaModule: any
  ) {
    this.id = generateCommandId()

    // 类型安全的数据保存
    this.originalTimelineItemData = {
      id: timelineItem.id,
      mediaItemId: timelineItem.mediaItemId,
      trackId: timelineItem.trackId,
      mediaType: timelineItem.mediaType,
      timeRange: { ...timelineItem.timeRange },
      config: { ...timelineItem.config },
      thumbnailUrl: timelineItem.thumbnailUrl
    }

    const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
    this.description = `操作时间轴项目: ${mediaItem?.name || '未知素材'}`
  }

  /**
   * 类型安全的时间轴项目重建方法
   */
  protected async rebuildTimelineItem(): Promise<TimelineItem<T>> {
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`媒体素材不存在: ${this.originalTimelineItemData.mediaItemId}`)
    }

    // 根据媒体类型创建相应的sprite
    let sprite: CustomSprite
    if (this.originalTimelineItemData.mediaType === 'video') {
      sprite = await this.createVideoSprite(mediaItem)
    } else if (this.originalTimelineItemData.mediaType === 'image') {
      sprite = await this.createImageSprite(mediaItem)
    } else if (this.originalTimelineItemData.mediaType === 'audio') {
      sprite = await this.createAudioSprite(mediaItem)
    } else {
      throw new Error(`不支持的媒体类型: ${this.originalTimelineItemData.mediaType}`)
    }

    // 创建类型安全的时间轴项目
    const newTimelineItem: TimelineItem<T> = reactive({
      id: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: this.originalTimelineItemData.timeRange,
      sprite: markRaw(sprite),
      thumbnailUrl: this.originalTimelineItemData.thumbnailUrl,
      config: { ...this.originalTimelineItemData.config }
    }) as TimelineItem<T>

    // 设置双向数据同步
    this.timelineModule.setupBidirectionalSync(newTimelineItem)

    return newTimelineItem
  }

  abstract execute(): Promise<void>
  abstract undo(): Promise<void>
}

// 具体的时间轴命令实现
export class AddTimelineItemCommand<T extends MediaType = MediaType> extends BaseTimelineCommand<T> {
  async execute(): Promise<void> {
    const newTimelineItem = await this.rebuildTimelineItem()

    this.timelineModule.addTimelineItem(newTimelineItem)
    this.webavModule.addSprite(newTimelineItem.sprite)

    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    console.log(`✅ 已添加时间轴项目: ${mediaItem?.name || '未知素材'}`)
  }

  async undo(): Promise<void> {
    this.timelineModule.removeTimelineItem(this.originalTimelineItemData.id)

    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    console.log(`↩️ 已撤销添加时间轴项目: ${mediaItem?.name || '未知素材'}`)
  }
}
```

### 2. 属性变换命令重构

#### 重构方案

```typescript
/**
 * 类型安全的属性变换命令
 */
export class UpdateTimelineItemTransformCommand<T extends MediaType = MediaType> implements SimpleCommand {
  public readonly id: string
  public readonly description: string

  constructor(
    private timelineItemId: string,
    private propertyType: keyof GetMediaConfig<T>, // 类型安全的属性名
    private oldValues: Partial<GetMediaConfig<T>>,
    private newValues: Partial<GetMediaConfig<T>>,
    private timelineModule: {
      updateTimelineItemTransform: (id: string, transform: any) => void
      getTimelineItem: (id: string) => TimelineItem<T> | undefined
    },
    private mediaModule: {
      getMediaItem: (id: string) => MediaItem | undefined
    }
  ) {
    this.id = generateCommandId()

    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    const mediaItem = timelineItem ? this.mediaModule.getMediaItem(timelineItem.mediaItemId) : null

    this.description = this.generateDescription(mediaItem?.name || '未知素材')
  }

  private generateDescription(mediaName: string): string {
    const propertyNames: Record<string, string> = {
      x: '水平位置',
      y: '垂直位置',
      width: '宽度',
      height: '高度',
      rotation: '旋转',
      opacity: '透明度',
      volume: '音量',
      zIndex: '层级'
    }

    return `修改${propertyNames[this.propertyType as string] || this.propertyType}: ${mediaName}`
  }

  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    // 类型安全的属性更新
    Object.assign(item.config, this.newValues)

    console.log(`✅ 已更新属性: ${this.propertyType}`, this.newValues)
  }

  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    // 类型安全的属性恢复
    Object.assign(item.config, this.oldValues)

    console.log(`↩️ 已恢复属性: ${this.propertyType}`, this.oldValues)
  }
}
```

### 3. 命令工厂函数重构

```typescript
/**
 * 类型安全的命令工厂函数
 */
export class CommandFactory {
  /**
   * 创建添加时间轴项目命令
   */
  static createAddTimelineItemCommand<T extends MediaType>(
    timelineItem: TimelineItem<T>,
    modules: {
      timelineModule: any
      webavModule: any
      mediaModule: any
    }
  ): AddTimelineItemCommand<T> {
    return new AddTimelineItemCommand(
      timelineItem,
      modules.timelineModule,
      modules.webavModule,
      modules.mediaModule
    )
  }

  /**
   * 创建属性变换命令
   */
  static createUpdateTransformCommand<T extends MediaType>(
    timelineItemId: string,
    propertyType: keyof GetMediaConfig<T>,
    oldValues: Partial<GetMediaConfig<T>>,
    newValues: Partial<GetMediaConfig<T>>,
    modules: {
      timelineModule: any
      mediaModule: any
    }
  ): UpdateTimelineItemTransformCommand<T> {
    return new UpdateTimelineItemTransformCommand(
      timelineItemId,
      propertyType,
      oldValues,
      newValues,
      modules.timelineModule,
      modules.mediaModule
    )
  }

  /**
   * 创建关键帧命令
   */
  static createKeyframeCommand<T extends MediaType>(
    type: 'create' | 'delete' | 'update' | 'toggle',
    timelineItemId: string,
    frame: number,
    modules: {
      timelineModule: any
      webavAnimationManager: any
      playbackControls?: any
    },
    additionalParams?: any
  ): BaseKeyframeCommand<T> {
    switch (type) {
      case 'create':
        return new CreateKeyframeCommand(
          timelineItemId,
          frame,
          modules.timelineModule,
          modules.webavAnimationManager,
          modules.playbackControls
        )
      case 'delete':
        return new DeleteKeyframeCommand(
          timelineItemId,
          frame,
          modules.timelineModule,
          modules.webavAnimationManager,
          modules.playbackControls
        )
      case 'toggle':
        return new ToggleKeyframeCommand(
          timelineItemId,
          frame,
          modules.timelineModule,
          modules.webavAnimationManager,
          modules.playbackControls
        )
      default:
        throw new Error(`不支持的关键帧命令类型: ${type}`)
    }
  }
}
```

## 重构实施要点

### 数据流向重构要点

1. **严格遵循数据流向**：所有属性变更必须遵循 UI → WebAV → TimelineItem → UI 流程
2. **事件驱动同步**：使用 WebAV 的 `propsChange` 事件进行数据同步，避免轮询
3. **单向数据绑定**：避免双向绑定导致的循环更新问题
4. **特殊属性处理**：为不支持 `propsChange` 的属性（opacity、volume）实现自定义事件

### 关键帧系统重构要点

1. **类型安全优先**：所有关键帧操作都必须是类型安全的
2. **属性分层**：根据媒体类型提供相应的可动画属性
3. **数据流向一致**：关键帧插值结果必须通过 WebAV 设置，不能直接修改 TimelineItem
4. **性能优化**：避免不必要的属性复制和计算

### 操作记录系统重构要点

1. **泛型支持**：所有命令类都必须支持泛型
2. **数据完整性**：确保命令的撤销/重做不会丢失数据
3. **数据流向保持**：撤销/重做操作必须保持相同的数据流向
4. **错误处理**：提供完善的错误处理和恢复机制
5. **内存管理**：避免命令历史记录导致的内存泄漏

### 重构验证标准

1. **编译检查**：所有TypeScript编译错误必须解决
2. **类型检查**：确保不同媒体类型只能访问相关属性
3. **数据流向检查**：验证所有属性变更都遵循正确的数据流向
4. **功能测试**：所有关键帧和撤销/重做功能必须正常工作
5. **性能测试**：重构后的性能不能明显下降
6. **同步测试**：验证 UI 与 WebAV 之间的数据同步正确性

## 数据流向实施指南

### 1. 组件层数据流向实施

#### 属性面板组件

```typescript
// ✅ 正确的属性面板实现
<template>
  <div class="properties-panel">
    <!-- 位置控制 -->
    <NumberInput
      v-if="hasVisualProps(selectedItem)"
      :value="selectedItem.config.x"
      @change="updateProperty('x', $event)"
    />

    <!-- 音量控制 -->
    <SliderInput
      v-if="hasAudioProps(selectedItem)"
      :value="selectedItem.config.volume"
      @change="updateProperty('volume', $event)"
    />
  </div>
</template>

<script setup lang="ts">
function updateProperty<T extends MediaType>(
  property: keyof GetMediaConfig<T>,
  value: any
) {
  if (!selectedItem.value) return

  // ✅ 遵循数据流向：UI → WebAV
  selectedItem.value.sprite[property] = value

  // WebAV → TimelineItem → UI (自动完成)
}

// 类型守卫函数
function hasVisualProps(item: TimelineItem): item is TimelineItem<'video' | 'image'> {
  return item.mediaType === 'video' || item.mediaType === 'image'
}

function hasAudioProps(item: TimelineItem): item is TimelineItem<'video' | 'audio'> {
  return item.mediaType === 'video' || item.mediaType === 'audio'
}
</script>
```

#### 时间轴组件

```typescript
// ✅ 正确的时间轴拖拽实现
function handleItemDrag<T extends MediaType>(
  item: TimelineItem<T>,
  deltaX: number,
  deltaY: number
) {
  if (!hasVisualProps(item)) return

  // ✅ 遵循数据流向：UI → WebAV
  item.sprite.x += deltaX
  item.sprite.y += deltaY

  // WebAV → TimelineItem → UI (自动完成)

  // 触发渲染更新
  avCanvas.preFrame()
}
```

### 2. Store 层数据流向实施

#### TimelineModule 重构

```typescript
// ✅ 正确的双向同步设置
export function setupBidirectionalSync<T extends MediaType>(item: TimelineItem<T>) {
  // 只设置 WebAV → TimelineItem 的单向同步
  item.sprite.on('propsChange', (changedProps: any) => {
    // 只更新支持 propsChange 的属性
    Object.entries(changedProps).forEach(([key, value]) => {
      if (key in item.config) {
        (item.config as any)[key] = value
      }
    })
  })

  // 特殊属性的自定义事件监听
  if (hasVisualProps(item)) {
    item.sprite.on('opacityChange', ({ opacity }: { opacity: number }) => {
      item.config.opacity = opacity
    })
  }

  if (hasAudioProps(item)) {
    item.sprite.on('volumeChange', ({ volume }: { volume: number }) => {
      item.config.volume = volume
    })
  }
}
```

### 3. 动画系统数据流向实施

#### WebAV 动画管理器

```typescript
// ✅ 正确的动画属性应用
export class WebAVAnimationManager {
  async updateWebAVAnimation<T extends MediaType>(item: TimelineItem<T>): Promise<void> {
    if (!item.config.animation?.isEnabled) {
      // 清除动画
      item.sprite.removeAnimation?.()
      return
    }

    // 转换关键帧为 WebAV 格式
    const webavKeyframes = this.convertToWebAVKeyframes(item.config.animation.keyframes)

    // ✅ 通过 WebAV 设置动画，保持数据流向
    item.sprite.setAnimation?.(webavKeyframes)
  }

  private convertToWebAVKeyframes<T extends MediaType>(
    keyframes: Keyframe<T>[]
  ): WebAVKeyframe[] {
    return keyframes.map(kf => ({
      time: kf.framePosition / 30, // 转换为时间
      props: kf.properties
    }))
  }
}
```

### 4. 命令系统数据流向实施

#### 属性变更命令

```typescript
export class UpdatePropertyCommand<T extends MediaType> implements SimpleCommand {
  async execute(): Promise<void> {
    const item = this.getTimelineItem()
    if (!item) return

    // ✅ 遵循数据流向：通过 WebAV 设置属性
    Object.entries(this.newValues).forEach(([key, value]) => {
      item.sprite[key] = value
    })

    // 触发渲染更新
    avCanvas.preFrame()

    // WebAV → TimelineItem → UI (自动完成)
  }

  async undo(): Promise<void> {
    const item = this.getTimelineItem()
    if (!item) return

    // ✅ 撤销也遵循相同的数据流向
    Object.entries(this.oldValues).forEach(([key, value]) => {
      item.sprite[key] = value
    })

    avCanvas.preFrame()
  }
}
```

### 5. 数据流向调试工具

#### 数据流向监控

```typescript
// 开发环境下的数据流向监控
export function enableDataFlowMonitoring<T extends MediaType>(item: TimelineItem<T>) {
  if (process.env.NODE_ENV !== 'development') return

  // 监控 WebAV → TimelineItem 的数据流
  item.sprite.on('propsChange', (props: any) => {
    console.log(`🔄 数据流向: WebAV → TimelineItem`, {
      itemId: item.id,
      mediaType: item.mediaType,
      changedProps: props
    })
  })

  // 监控 TimelineItem 配置变更
  watch(() => item.config, (newConfig, oldConfig) => {
    console.log(`📝 数据流向: TimelineItem → UI`, {
      itemId: item.id,
      mediaType: item.mediaType,
      configDiff: getDiff(oldConfig, newConfig)
    })
  }, { deep: true })
}

function getDiff(oldObj: any, newObj: any): Record<string, { old: any, new: any }> {
  const diff: Record<string, { old: any, new: any }> = {}

  Object.keys(newObj).forEach(key => {
    if (oldObj[key] !== newObj[key]) {
      diff[key] = { old: oldObj[key], new: newObj[key] }
    }
  })

  return diff
}
```

### 6. 数据流向最佳实践

#### DO's (应该做的)

1. **始终通过 WebAV 设置属性**
   ```typescript
   // ✅ 正确
   item.sprite.x = newX
   ```

2. **使用事件驱动的数据同步**
   ```typescript
   // ✅ 正确
   item.sprite.on('propsChange', updateTimelineItem)
   ```

3. **在操作完成后触发渲染**
   ```typescript
   // ✅ 正确
   item.sprite.x = newX
   avCanvas.preFrame()
   ```

#### DON'Ts (不应该做的)

1. **不要直接修改 TimelineItem 配置**
   ```typescript
   // ❌ 错误
   item.config.x = newX
   ```

2. **不要创建双向数据绑定**
   ```typescript
   // ❌ 错误 - 可能导致循环更新
   watch(() => item.config.x, (newX) => {
     item.sprite.x = newX
   })
   watch(() => item.sprite.x, (newX) => {
     item.config.x = newX
   })
   ```

3. **不要绕过 WebAV 直接更新 UI**
   ```typescript
   // ❌ 错误
   item.config.x = newX
   forceUpdateUI()
   ```

## 结论

这是一次彻底的架构升级，将为项目带来长期的技术红利。通过严格遵循数据流向准则，新的架构将确保：

1. **类型安全**：编译时就能发现类型错误，避免运行时问题
2. **数据一致性**：单向数据流确保 UI 与 WebAV 状态始终同步
3. **扩展性**：轻松添加新的媒体类型和可动画属性
4. **维护性**：代码结构清晰，数据流向明确，易于理解和修改
5. **稳定性**：完善的撤销/重做机制和数据流向保证系统可靠性

**关键要点：所有属性变更必须遵循 UI → WebAV → TimelineItem → UI 的数据流向，这是系统稳定性的基石。**

## 组件层重构方案

### 1. 属性面板组件重构

#### 当前问题

现有的 `VideoClipProperties.vue` 组件硬编码了所有属性，无法适应不同媒体类型：

```typescript
// 当前的硬编码实现
const x = computed(() => props.selectedTimelineItem?.x || 0)
const y = computed(() => props.selectedTimelineItem?.y || 0)
const volume = computed(() => props.selectedTimelineItem?.volume || 1)
// 音频项目也会显示 x、y 等视觉属性
```

#### 重构方案

```typescript
// 类型安全的属性面板组件
<template>
  <div class="video-clip-properties">
    <!-- 基础属性（所有类型共享） -->
    <PropertySection title="基础属性">
      <NumberInput
        label="层级"
        :value="config.zIndex"
        @change="updateProperty('zIndex', $event)"
      />
    </PropertySection>

    <!-- 视觉属性（仅 video 和 image） -->
    <PropertySection v-if="hasVisualProps" title="位置和大小">
      <NumberInput
        label="X 位置"
        :value="config.x"
        @change="updateProperty('x', $event)"
      />
      <NumberInput
        label="Y 位置"
        :value="config.y"
        @change="updateProperty('y', $event)"
      />
      <NumberInput
        label="透明度"
        :value="config.opacity"
        :min="0"
        :max="1"
        :step="0.01"
        @change="updateProperty('opacity', $event)"
      />
    </PropertySection>

    <!-- 音频属性（仅 video 和 audio） -->
    <PropertySection v-if="hasAudioProps" title="音频控制">
      <SliderInput
        label="音量"
        :value="config.volume"
        :min="0"
        :max="1"
        @change="updateProperty('volume', $event)"
      />
      <CheckboxInput
        label="静音"
        :value="config.isMuted"
        @change="updateProperty('isMuted', $event)"
      />
    </PropertySection>

    <!-- 动画属性（所有类型，如果有动画） -->
    <PropertySection v-if="config.animation" title="动画">
      <KeyframeControls
        :timeline-item="selectedTimelineItem"
        :current-frame="currentFrame"
      />
    </PropertySection>
  </div>
</template>

<script setup lang="ts">
interface Props {
  selectedTimelineItem: TimelineItem | null
  currentFrame: number
}

const props = defineProps<Props>()

// 类型守卫
const hasVisualProps = computed(() => {
  return props.selectedTimelineItem?.mediaType === 'video' ||
         props.selectedTimelineItem?.mediaType === 'image'
})

const hasAudioProps = computed(() => {
  return props.selectedTimelineItem?.mediaType === 'video' ||
         props.selectedTimelineItem?.mediaType === 'audio'
})

// 类型安全的配置访问
const config = computed(() => {
  return props.selectedTimelineItem?.config || {}
})

// 类型安全的属性更新
function updateProperty<T extends MediaType>(
  property: keyof GetMediaConfig<T>,
  value: any
) {
  if (!props.selectedTimelineItem) return

  // ✅ 遵循数据流向：UI → WebAV
  props.selectedTimelineItem.sprite[property] = value
  // WebAV → TimelineItem → UI (自动完成)
}
</script>
```

### 2. 时间轴组件重构

#### VideoClip 组件类型安全化

```typescript
// 重构后的 VideoClip 组件
<template>
  <div
    class="video-clip"
    :class="clipClasses"
    :style="clipStyle"
    :data-media-type="timelineItem.mediaType"
  >
    <!-- 视觉媒体的缩略图 -->
    <div v-if="hasVisualProps" class="clip-thumbnail">
      <img v-if="timelineItem.thumbnailUrl" :src="timelineItem.thumbnailUrl" />
    </div>

    <!-- 音频媒体的波形图 -->
    <div v-if="hasAudioProps && !hasVisualProps" class="audio-waveform">
      <!-- 音频波形显示 -->
    </div>

    <!-- 关键帧标记（仅视觉媒体） -->
    <div v-if="hasVisualProps" class="keyframe-markers">
      <div
        v-for="marker in keyframeMarkers"
        :key="marker.framePosition"
        class="keyframe-marker"
        :style="{ left: marker.pixelPosition + 'px' }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  timelineItem: TimelineItem
  track?: Track
  timelineWidth: number
  totalDurationFrames: number
}

const props = defineProps<Props>()

// 类型守卫
const hasVisualProps = computed(() => {
  return props.timelineItem.mediaType === 'video' ||
         props.timelineItem.mediaType === 'image'
})

const hasAudioProps = computed(() => {
  return props.timelineItem.mediaType === 'video' ||
         props.timelineItem.mediaType === 'audio'
})

// 类型安全的样式计算
const clipClasses = computed(() => ({
  'video-clip': true,
  'visual-media': hasVisualProps.value,
  'audio-media': hasAudioProps.value && !hasVisualProps.value,
  'selected': isSelected.value,
  'overlapping': isOverlapping.value
}))
</script>
```

### 3. 工具函数重构

#### 时间轴搜索工具重构

```typescript
// 类型安全的搜索工具函数
export function getTimelineItemAtFrames<T extends MediaType = MediaType>(
  frames: number,
  timelineItems: TimelineItem<T>[],
): TimelineItem<T> | null {
  return timelineItems.find((item) => {
    const timeRange = item.sprite.getTimeRange()
    return frames >= timeRange.timelineStartTime && frames < timeRange.timelineEndTime
  }) || null
}

export function getTimelineItemsByTrack<T extends MediaType = MediaType>(
  trackId: string,
  timelineItems: TimelineItem<T>[],
): TimelineItem<T>[] {
  return timelineItems.filter((item) => item.trackId === trackId)
}

export function getTimelineItemsByMediaType<T extends MediaType>(
  mediaType: T,
  timelineItems: TimelineItem[],
): TimelineItem<T>[] {
  return timelineItems.filter((item): item is TimelineItem<T> =>
    item.mediaType === mediaType
  )
}
```

## Store 模块重构方案

### 1. TimelineModule 重构

#### 当前问题

现有的 timelineModule 没有类型安全的方法：

```typescript
// 当前的实现
function addTimelineItem(timelineItem: TimelineItem) {
  // 没有类型检查
  setupBidirectionalSync(timelineItem)
}
```

#### 重构方案

```typescript
// 类型安全的 timelineModule
export function createTimelineModule() {
  const timelineItems = ref<TimelineItem[]>([])

  // 类型安全的添加方法
  function addTimelineItem<T extends MediaType>(timelineItem: TimelineItem<T>) {
    // 类型安全的轨道分配
    if (!timelineItem.trackId && trackModule) {
      const compatibleTrack = findCompatibleTrack(timelineItem.mediaType)
      if (compatibleTrack) {
        timelineItem.trackId = compatibleTrack.id
      }
    }

    // 类型安全的同步设置
    setupBidirectionalSync(timelineItem)

    timelineItems.value.push(timelineItem)
  }

  // 类型安全的查找方法
  function getTimelineItem<T extends MediaType = MediaType>(
    id: string
  ): TimelineItem<T> | undefined {
    return timelineItems.value.find(item => item.id === id) as TimelineItem<T> | undefined
  }

  // 类型安全的过滤方法
  function getTimelineItemsByType<T extends MediaType>(
    mediaType: T
  ): TimelineItem<T>[] {
    return timelineItems.value.filter((item): item is TimelineItem<T> =>
      item.mediaType === mediaType
    )
  }

  return {
    timelineItems: readonly(timelineItems),
    addTimelineItem,
    getTimelineItem,
    getTimelineItemsByType,
    // ... 其他方法
  }
}

// 轨道兼容性检查
function findCompatibleTrack(mediaType: MediaType): Track | undefined {
  const trackType: TrackType = mediaType === 'audio' ? 'audio' : 'video'
  return trackModule.tracks.value.find(track => track.type === trackType)
}
```

### 2. VideoStore 重构

```typescript
// 类型安全的 videoStore 方法
export function createVideoStore() {
  // 类型安全的选择方法
  function selectTimelineItem<T extends MediaType>(
    item: TimelineItem<T> | null
  ): void {
    if (item) {
      selectedTimelineItemId.value = item.id
      // 类型安全的属性访问
      if (hasVisualProps(item)) {
        // 可以安全访问视觉属性
        console.log('Selected visual item at:', item.config.x, item.config.y)
      }
    } else {
      selectedTimelineItemId.value = null
    }
  }

  // 类型安全的属性更新
  function updateTimelineItemProperty<T extends MediaType>(
    itemId: string,
    property: keyof GetMediaConfig<T>,
    value: any
  ): void {
    const item = getTimelineItem<T>(itemId)
    if (!item) return

    // ✅ 遵循数据流向
    item.sprite[property] = value
  }

  return {
    selectTimelineItem,
    updateTimelineItemProperty,
    // ... 其他方法
  }
}
```

## 迁移策略和风险控制

### 1. 分阶段迁移计划

#### 第一阶段：类型定义重构（1-2天）
1. 更新 `types/index.ts` 中的 TimelineItem 接口
2. 添加新的媒体配置类型
3. 更新关键帧和动画相关类型
4. 确保所有类型编译通过

#### 第二阶段：核心模块重构（2-3天）
1. 重构 timelineModule 的核心方法
2. 更新 videoStore 的相关方法
3. 重构命令系统的类型安全性
4. 更新数据流向实现

#### 第三阶段：组件层重构（3-4天）
1. 重构 VideoClipProperties 组件
2. 更新 VideoClip 组件的类型安全性
3. 重构属性面板的条件渲染
4. 更新所有相关的 UI 组件

#### 第四阶段：工具函数重构（1-2天）
1. 重构所有搜索和查找工具函数
2. 更新动画和关键帧工具函数
3. 重构坐标转换和时间计算函数
4. 更新所有辅助工具函数

### 2. 风险控制措施

#### 编译时风险控制
```typescript
// 使用严格的类型检查
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}

// 添加类型断言辅助函数
export function assertMediaType<T extends MediaType>(
  item: TimelineItem,
  expectedType: T
): asserts item is TimelineItem<T> {
  if (item.mediaType !== expectedType) {
    throw new Error(`Expected ${expectedType}, got ${item.mediaType}`)
  }
}
```

#### 运行时风险控制
```typescript
// 添加运行时类型检查
export function validateTimelineItem<T extends MediaType>(
  item: TimelineItem<T>
): boolean {
  // 基础验证
  if (!item.id || !item.mediaItemId || !item.trackId) {
    return false
  }

  // 类型特定验证
  if (item.mediaType === 'video') {
    return hasVisualProps(item) && hasAudioProps(item)
  } else if (item.mediaType === 'image') {
    return hasVisualProps(item) && !hasAudioProps(item)
  } else if (item.mediaType === 'audio') {
    return !hasVisualProps(item) && hasAudioProps(item)
  }

  return false
}
```

### 3. 测试策略

#### 单元测试重构
```typescript
// 类型安全的测试用例
describe('TimelineItem Type Safety', () => {
  test('video item should have visual and audio properties', () => {
    const videoItem: TimelineItem<'video'> = createVideoItem()

    // 应该能访问视觉属性
    expect(videoItem.config.x).toBeDefined()
    expect(videoItem.config.y).toBeDefined()
    expect(videoItem.config.opacity).toBeDefined()

    // 应该能访问音频属性
    expect(videoItem.config.volume).toBeDefined()
    expect(videoItem.config.isMuted).toBeDefined()
  })

  test('audio item should only have audio properties', () => {
    const audioItem: TimelineItem<'audio'> = createAudioItem()

    // 不应该有视觉属性
    expect('x' in audioItem.config).toBe(false)
    expect('y' in audioItem.config).toBe(false)

    // 应该有音频属性
    expect(audioItem.config.volume).toBeDefined()
    expect(audioItem.config.isMuted).toBeDefined()
  })
})
```

## 激进重构执行方案

### 1. 立即替换策略

**完全抛弃旧代码，一次性替换所有相关实现**

#### 重构执行顺序

1. **第一步：注释旧类型定义**
   ```bash
   # 注释 types/index.ts 中的旧 TimelineItem 接口
   # 保留原有逻辑作为参考，让 TypeScript 编译错误指导我们找到所有需要修改的地方
   ```

2. **第二步：实现新类型定义**
   ```typescript
   // 立即用新的类型定义替换
   export interface TimelineItem<T extends MediaType = MediaType> {
     id: string
     mediaItemId: string
     trackId: string
     mediaType: T
     timeRange: T extends 'video' ? VideoTimeRange :
               T extends 'audio' ? AudioTimeRange :
               ImageTimeRange
     sprite: Raw<CustomSprite>
     thumbnailUrl?: string
     config: GetMediaConfig<T>
   }
   ```

3. **第三步：修复所有编译错误**
   ```bash
   # 运行 TypeScript 编译，让错误信息指导重构
   npm run type-check
   # 逐个修复每个编译错误，强制使用新的类型安全接口
   ```

### 2. 破坏性变更清单

#### 必须立即注释的代码

```typescript
// ❌ 立即注释 - 旧的平铺属性访问（保留作为参考）
// item.x = 100
// item.y = 200
// item.opacity = 0.5

// ❌ 立即注释 - 直接属性修改（保留逻辑参考）
// item.volume = 0.8
// item.isMuted = true

// ❌ 立即注释 - 旧的双向同步逻辑（保留实现参考）
// watch(() => item.x, (newX) => {
//   item.sprite.x = newX
// })
```

#### 必须立即实现的新代码

```typescript
// ✅ 立即实现 - 新的数据流向
item.sprite.x = 100  // UI → WebAV
// WebAV → TimelineItem → UI (自动)

// ✅ 立即实现 - 类型安全的属性访问
if (hasVisualProps(item)) {
  item.config.x = 100  // 只在类型安全的情况下访问
}

// ✅ 立即实现 - 新的同步机制
item.sprite.on('propsChange', (props) => {
  Object.assign(item.config, props)
})
```

### 3. 激进重构检查清单

#### 激进重构执行清单

```markdown
## 激进重构执行清单 - 无向后兼容

### 🔥 第一阶段：旧代码注释（立即执行）
- [ ] 注释 types/index.ts 中的旧 TimelineItem 接口（保留作为参考）
- [ ] 注释所有平铺属性访问代码 (item.x, item.y, etc.)
- [ ] 注释所有直接属性修改代码
- [ ] 注释旧的双向同步逻辑
- [ ] 注释所有兼容性代码

### 🚀 第二阶段：新架构实现（立即执行）
- [ ] 实现新的 TimelineItem<T> 泛型接口
- [ ] 实现媒体配置类型 (VideoMediaConfig, ImageMediaConfig, AudioMediaConfig)
- [ ] 实现类型安全的关键帧系统
- [ ] 实现严格的数据流向 (UI → WebAV → TimelineItem → UI)
- [ ] 实现类型守卫函数

### ⚡ 第三阶段：组件层重写（立即执行）
- [ ] 重写 VideoClipProperties 组件，支持类型安全
- [ ] 重写 VideoClip 组件，适配不同媒体类型
- [ ] 重写所有属性访问，使用 config.* 方式
- [ ] 重写所有条件渲染，基于媒体类型
- [ ] 删除所有不必要的属性显示

### 💾 第四阶段：Store 层重写（立即执行）
- [ ] 重写 timelineModule 所有方法，支持泛型
- [ ] 重写 videoStore 属性更新方法
- [ ] 重写命令系统，支持类型安全
- [ ] 重写数据同步机制，严格遵循数据流向
- [ ] 删除所有旧的属性访问方式

### 🛠️ 第五阶段：工具函数重写（立即执行）
- [ ] 重写所有搜索函数，支持泛型
- [ ] 重写关键帧工具函数，类型安全
- [ ] 重写动画转换器，适配新类型
- [ ] 重写所有辅助函数，注释旧逻辑作为参考
- [ ] 注释所有向后兼容代码

### ✅ 验证标准（零容忍）
- [ ] 零 TypeScript 编译错误
- [ ] 零 ESLint 警告
- [ ] 零未注释的旧代码
- [ ] 零向后兼容代码在新实现中
- [ ] 100% 新架构覆盖
- [ ] 旧代码完整保留为注释参考
```

## 激进重构行动计划

### 🔥 激进重构的核心理念

**彻底抛弃旧代码，零向后兼容，一次性实现现代化架构**

### 📋 重构覆盖领域

1. **核心架构** - 完全重写类型定义、数据流向、接口设计
2. **系统层面** - 彻底重构关键帧系统、操作记录系统、动画管理
3. **组件层面** - 重写属性面板、时间轴组件、视频剪辑组件
4. **Store 层面** - 重构 timelineModule、videoStore、命令系统
5. **工具函数** - 重写搜索工具、动画工具、所有辅助函数

### ⚡ 激进执行策略

1. **立即注释** - 注释所有旧的 TimelineItem 相关代码，保留逻辑参考
2. **立即重写** - 用新的类型安全架构替换所有实现
3. **零容忍** - 不允许任何旧代码在新实现中运行
4. **一次到位** - 不分阶段，一次性完成所有重构
5. **保留参考** - 旧代码作为注释保留，便于理解原有逻辑

### 🎯 执行顺序

1. **注释旧类型** → **实现新类型** → **修复编译错误**
2. **重写 Store** → **重写组件** → **重写工具函数**
3. **验证功能** → **清理注释** → **完成重构**

### 📝 注释策略

```typescript
// ===== 旧实现 (保留作为参考) =====
// export interface TimelineItem {
//   id: string
//   x: number
//   y: number
//   // ... 其他旧属性
// }

// ===== 新实现 =====
export interface TimelineItem<T extends MediaType = MediaType> {
  id: string
  config: GetMediaConfig<T>
  // ... 新的类型安全属性
}
```

**立即开始激进重构！注释所有旧代码保留参考，实现现代化的类型安全架构！**

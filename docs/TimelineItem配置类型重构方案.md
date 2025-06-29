# TimelineItem 配置类型激进重构方案

## 概述

本文档描述了 TimelineItem 接口的激进重构方案，目标是彻底重新设计配置类型结构，为不同的媒体类型（video、image、audio）提供类型安全的配置，提高代码的可维护性和扩展性。

## 重构理念

**激进重构，不保留向后兼容性**。我们将彻底重新设计 TimelineItem 接口，优先考虑：

1. **类型安全**：每种媒体类型只包含相关属性
2. **架构清晰**：属性按功能和适用性分层组织
3. **扩展性优先**：为未来功能扩展提供最佳架构

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

### 关键帧系统重构要点

1. **类型安全优先**：所有关键帧操作都必须是类型安全的
2. **属性分层**：根据媒体类型提供相应的可动画属性
3. **向后兼容**：在重构过程中保持API的一致性
4. **性能优化**：避免不必要的属性复制和计算

### 操作记录系统重构要点

1. **泛型支持**：所有命令类都必须支持泛型
2. **数据完整性**：确保命令的撤销/重做不会丢失数据
3. **错误处理**：提供完善的错误处理和恢复机制
4. **内存管理**：避免命令历史记录导致的内存泄漏

### 重构验证标准

1. **编译检查**：所有TypeScript编译错误必须解决
2. **类型检查**：确保不同媒体类型只能访问相关属性
3. **功能测试**：所有关键帧和撤销/重做功能必须正常工作
4. **性能测试**：重构后的性能不能明显下降

## 结论

这是一次彻底的架构升级，将为项目带来长期的技术红利。虽然短期内需要大量的代码修改工作，但新的架构将显著提升开发效率、代码质量和系统可维护性。

关键帧系统和操作记录系统的重构是整个TimelineItem重构的核心部分，它们的成功实施将确保：

1. **类型安全**：编译时就能发现类型错误，避免运行时问题
2. **扩展性**：轻松添加新的媒体类型和可动画属性
3. **维护性**：代码结构清晰，易于理解和修改
4. **稳定性**：完善的撤销/重做机制确保用户操作的可靠性

**立即开始重构，不要犹豫。现代化的架构值得这次投入。**

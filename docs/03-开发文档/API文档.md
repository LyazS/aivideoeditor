# API文档

## 📋 概述

本文档详细描述了AI视频编辑器的核心API接口，包括状态管理、WebAV集成、组件接口和工具函数。

## 🏪 VideoStore API

### 媒体管理

#### 状态
```typescript
// 素材库数据
mediaItems: Ref<MediaItem[]>
```

#### 方法
```typescript
// 添加媒体项目
addMediaItem(mediaItem: MediaItem): void

// 删除媒体项目
removeMediaItem(mediaItemId: string): void

// 获取媒体项目
getMediaItem(mediaItemId: string): MediaItem | undefined

// 更新媒体项目名称
updateMediaItemName(mediaItemId: string, newName: string): void

// 设置视频元素
setVideoElement(mediaItemId: string, element: HTMLVideoElement): void

// 获取视频原始分辨率
getVideoOriginalResolution(mediaItemId: string): { width: number; height: number } | null
```

### 时间轴管理

#### 状态
```typescript
// 时间轴项目数据
timelineItems: Ref<TimelineItem[]>

// 轨道数据
tracks: Ref<Track[]>
```

#### 方法
```typescript
// 添加时间轴项目
addTimelineItem(item: Omit<TimelineItem, 'id'>): string

// 删除时间轴项目
removeTimelineItem(itemId: string): void

// 更新时间轴项目
updateTimelineItem(itemId: string, updates: Partial<TimelineItem>): void

// 分割时间轴项目
splitTimelineItem(itemId: string, splitTime: number): void

// 轨道管理
addTrack(track: Omit<Track, 'id'>): string
removeTrack(trackId: string): void
updateTrack(trackId: string, updates: Partial<Track>): void
```

### 播放控制

#### 状态
```typescript
// 当前播放时间
currentTime: Ref<number>

// 播放状态
isPlaying: Ref<boolean>

// 播放速率
playbackRate: Ref<number>

// 计算属性
currentFrame: ComputedRef<number>
formattedCurrentTime: ComputedRef<string>
```

#### 方法
```typescript
// 设置当前时间
setCurrentTime(time: number): void

// 设置播放状态
setIsPlaying(playing: boolean): void

// 设置播放速率
setPlaybackRate(rate: number): void
```

### 选择管理

#### 状态
```typescript
// 选中的时间轴项目ID
selectedTimelineItemId: Ref<string | null>

// 多选项目ID集合
selectedTimelineItemIds: Ref<Set<string>>
```

#### 方法
```typescript
// 单选时间轴项目
selectTimelineItem(itemId: string | null): void

// 多选时间轴项目
selectTimelineItems(itemIds: string[], mode: 'replace' | 'toggle'): void

// 清除所有选择
clearSelection(): void

// 检查是否为多选模式
isMultiSelectMode(): boolean
```

### WebAV集成

#### 状态
```typescript
// AVCanvas实例
avCanvas: Ref<AVCanvas | null>

// WebAV就绪状态
isWebAVReady: Ref<boolean>

// WebAV错误信息
webAVError: Ref<string | null>
```

#### 方法
```typescript
// 设置AVCanvas实例
setAVCanvas(canvas: AVCanvas | null): void

// 设置WebAV就绪状态
setWebAVReady(ready: boolean): void

// 设置WebAV错误信息
setWebAVError(error: string | null): void

// 清除WebAV状态
clearWebAVState(): void

// 检查WebAV是否可用
isWebAVAvailable(): boolean

// 获取WebAV状态摘要
getWebAVSummary(): object

// 精灵管理
addSprite(sprite: unknown): boolean
removeSprite(sprite: unknown): boolean
```

## 🎮 useWebAVControls API

### 画布管理
```typescript
// 创建画布容器
createCanvasContainer(options: ContainerOptions): HTMLElement

// 获取画布容器
getCanvasContainer(): HTMLElement | null

// 初始化画布
initializeCanvas(container: HTMLElement, options: CanvasOptions): Promise<void>

// 重新创建画布
recreateCanvas(container: HTMLElement, options: CanvasOptions, backup?: CanvasBackup): Promise<void>

// 销毁画布
destroyCanvas(): Promise<CanvasBackup | null>
```

### 媒体处理
```typescript
// 创建MP4Clip
createMP4Clip(file: File): Promise<MP4Clip>

// 创建ImgClip
createImgClip(file: File): Promise<ImgClip>

// 克隆MP4Clip
cloneMP4Clip(originalClip: MP4Clip): Promise<MP4Clip>

// 克隆ImgClip
cloneImgClip(originalClip: ImgClip): Promise<ImgClip>
```

### 播放控制
```typescript
// 播放
play(startTime?: number, endTime?: number): void

// 暂停
pause(): void

// 跳转到指定时间
seekTo(time: number): void

// 获取当前时间
getCurrentTime(): number

// 获取AVCanvas实例
getAVCanvas(): AVCanvas | null
```

## 🎭 VideoVisibleSprite API

### 属性
```typescript
interface VideoVisibleSprite extends VisibleSprite {
  // 时间范围
  timeRange: { start: number; end: number }
  
  // 变换属性
  transformX: number
  transformY: number
  scaleX: number
  scaleY: number
  rotation: number
  opacity: number
  zIndex: number
  
  // 关联的时间轴项目ID
  timelineItemId: string
}
```

### 方法
```typescript
// 设置时间范围
setTimeRange(start: number, end: number): void

// 设置变换属性
setTransform(transform: Partial<Transform>): void

// 获取当前属性
getProperties(): SpriteProperties

// 事件监听
on(event: 'propsChange', callback: (props: SpriteProperties) => void): void
off(event: 'propsChange', callback: (props: SpriteProperties) => void): void
```

## 📊 类型定义

### MediaItem
```typescript
interface MediaItem {
  id: string
  file: File
  url: string
  name: string
  duration: number
  mediaType: 'video' | 'image'
  mp4Clip: Raw<MP4Clip> | null
  imgClip: Raw<ImgClip> | null
  isReady: boolean
  thumbnailUrl?: string
  originalResolution?: { width: number; height: number }
}
```

### TimelineItem
```typescript
interface TimelineItem {
  id: string
  mediaItemId: string
  trackId: number
  mediaType: 'video' | 'image'
  timeRange: VideoTimeRange | ImageTimeRange
  sprite: Raw<VideoVisibleSprite | ImageVisibleSprite>
  thumbnailUrl?: string

  // 变换属性（通过工厂函数实现 getter/setter）
  x: number // 位置X（项目坐标系，中心为原点）
  y: number // 位置Y（项目坐标系，中心为原点）
  width: number // 宽度
  height: number // 高度
  rotation: number // 旋转角度（弧度）
  opacity: number // 透明度（0-1）
  zIndex: number // 层级
  volume: number // 音量（0-1之间，仅对视频有效）
  isMuted: boolean // 静音状态（仅对视频有效）
}
```

### Track
```typescript
interface Track {
  id: string
  name: string
  type: 'video' | 'audio'
  isVisible: boolean
  isLocked: boolean
  height: number
  order: number
}
```

### VideoResolution
```typescript
interface VideoResolution {
  name: string
  width: number
  height: number
  aspectRatio: string
}
```

### TimeRange
```typescript
interface VideoTimeRange {
  start: number // 开始时间（秒）
  end: number   // 结束时间（秒）
  playbackRate: number // 播放速度
}

interface ImageTimeRange {
  start: number // 开始时间（秒）
  end: number   // 结束时间（秒）
  duration: number // 显示时长（秒）
}
```

## 🎪 事件系统

### WebAV事件
```typescript
// 播放状态变化
avCanvas.on('play', () => void)
avCanvas.on('pause', () => void)

// 时间更新
avCanvas.on('timeupdate', (event: { ts: number }) => void)

// 错误事件
avCanvas.on('error', (error: Error) => void)

// 渲染完成
avCanvas.on('rendered', () => void)
```

### VideoVisibleSprite事件
```typescript
// 属性变化
sprite.on('propsChange', (props: SpriteProperties) => void)

// 时间范围变化
sprite.on('timeRangeChange', (range: { start: number; end: number }) => void)
```

### 组件事件
```typescript
// Timeline组件
@timelineItemSelected="onTimelineItemSelected"
@timelineItemMoved="onTimelineItemMoved"
@timelineItemResized="onTimelineItemResized"

// PreviewWindow组件
@spriteTransformed="onSpriteTransformed"

// MediaLibrary组件
@mediaItemAdded="onMediaItemAdded"
@mediaItemDragStart="onMediaItemDragStart"
```

## 🛠️ 工具函数API

### 坐标转换
```typescript
// 时间轴坐标转换
timeToPixel(time: number, zoomLevel: number, scrollOffset: number): number
pixelToTime(pixel: number, zoomLevel: number, scrollOffset: number): number

// 可见时间范围计算
calculateVisibleTimeRange(zoomLevel: number, scrollOffset: number, containerWidth: number): { start: number; end: number }
```

### 时间处理
```typescript
// 帧对齐
alignTimeToFrame(time: number, frameRate: number): number

// 时间格式化
formatTime(seconds: number): string
formatTimeWithAutoPrecision(seconds: number): string

// 像素密度计算
calculatePixelsPerSecond(zoomLevel: number): number

// 时间轴扩展
expandTimelineIfNeeded(currentDuration: number, requiredTime: number): number
```

### 查找工具
```typescript
// 根据时间查找项目
getTimelineItemAtTime(time: number, trackId?: number): TimelineItem | null

// 根据轨道查找项目
getTimelineItemsByTrack(trackId: number): TimelineItem[]

// 根据sprite查找项目
findTimelineItemBySprite(sprite: VideoVisibleSprite | ImageVisibleSprite): TimelineItem | null

// 查找重叠项目
getTimelineItemsAtTime(time: number): TimelineItem[]

// 查找孤立项目
findOrphanedTimelineItems(): TimelineItem[]
```

### 自动整理
```typescript
// 单轨道整理
autoArrangeTrackItems(trackId: number): void

// 全局整理
autoArrangeTimelineItems(): void
```

### 数据验证
```typescript
// 数据完整性验证
validateDataIntegrity(): { isValid: boolean; errors: string[] }

// 清理无效引用
cleanupInvalidReferences(): void
```

## 🎯 最佳实践

### WebAV对象处理
```typescript
// ✅ 正确：使用markRaw包装WebAV对象
const mp4Clip = markRaw(await createMP4Clip(file))

// ✅ 正确：使用toRaw获取原始对象
const rawSprite = toRaw(sprite)
rawSprite.setTransform(transform)

// ❌ 错误：直接使用响应式包装的对象
sprite.setTransform(transform) // 可能导致私有字段访问错误
```

### 内存管理
```typescript
// ✅ 正确：及时清理资源
onUnmounted(() => {
  if (sprite) {
    sprite.destroy()
  }
  if (mp4Clip) {
    mp4Clip.destroy()
  }
})

// ✅ 正确：移除事件监听器
onUnmounted(() => {
  sprite.off('propsChange', handlePropsChange)
  avCanvas.off('timeupdate', handleTimeUpdate)
})
```

### 错误处理
```typescript
// ✅ 正确：使用try-catch处理异步操作
try {
  const mp4Clip = await createMP4Clip(file)
  // 处理成功情况
} catch (error) {
  console.error('创建MP4Clip失败:', error)
  videoStore.setWebAVError(error.message)
}
```

### 状态更新
```typescript
// ✅ 正确：使用Store方法更新状态
videoStore.updateTimelineItem(itemId, { x: newX, y: newY })

// ❌ 错误：直接修改响应式对象
timelineItem.x = newX // 不会触发sprite更新
```

## 🔗 相关文档

- [架构设计](架构设计.md) - 系统架构设计和技术选型
- [开发环境](开发环境.md) - 开发环境设置和工作流程
- [代码规范](代码规范.md) - 编码标准和最佳实践
- [类型定义](../types/videoTypes.ts) - 完整的TypeScript类型定义

---

**提示**：API文档会随着项目发展持续更新，请关注最新的接口变化和使用方法。

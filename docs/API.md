# API 文档

## VideoStore API

### 核心状态

#### 媒体管理
```typescript
// 素材库数据
mediaItems: Ref<MediaItem[]>

// 添加媒体项目
addMediaItem(mediaItem: MediaItem): void

// 删除媒体项目
removeMediaItem(mediaItemId: string): void

// 获取媒体项目
getMediaItem(mediaItemId: string): MediaItem | undefined

// 更新媒体项目名称
updateMediaItemName(mediaItemId: string, newName: string): void
```

#### 时间轴管理
```typescript
// 时间轴项目数据
timelineItems: Ref<TimelineItem[]>

// 添加时间轴项目
addTimelineItem(item: Omit<TimelineItem, 'id'>): string

// 删除时间轴项目
removeTimelineItem(itemId: string): void

// 更新时间轴项目
updateTimelineItem(itemId: string, updates: Partial<TimelineItem>): void

// 分割时间轴项目
splitTimelineItem(itemId: string, splitTime: number): void
```

#### 播放控制
```typescript
// 当前播放时间
currentTime: Ref<number>

// 播放状态
isPlaying: Ref<boolean>

// 播放速率
playbackRate: Ref<number>

// 播放控制方法
play(): void
pause(): void
seekTo(time: number): void
setPlaybackRate(rate: number): void
```

#### 选择管理
```typescript
// 选中的时间轴项目ID
selectedTimelineItemId: Ref<string | null>

// 选中的AVCanvas精灵
selectedAVCanvasSprite: Ref<Raw<CustomVisibleSprite> | null>

// 选择方法
selectTimelineItem(itemId: string | null): void
selectAVCanvasSprite(sprite: Raw<CustomVisibleSprite> | null): void
```

### WebAV集成

#### WebAV状态
```typescript
// AVCanvas实例
avCanvas: Ref<AVCanvas | null>

// WebAV就绪状态
isWebAVReady: Ref<boolean>

// WebAV错误信息
webAVError: Ref<string | null>
```

#### WebAV方法
```typescript
// 初始化WebAV
initializeWebAV(canvasElement: HTMLCanvasElement, options?: WebAVOptions): Promise<boolean>

// 设置AVCanvas
setAVCanvas(canvas: AVCanvas | null): void

// 销毁WebAV
destroyWebAV(): void
```

## useWebAVControls API

### 核心方法

#### 画布管理
```typescript
// 创建画布容器
createCanvasContainer(width: number, height: number): HTMLElement

// 初始化画布
initializeCanvas(container: HTMLElement, options: CanvasOptions): Promise<AVCanvas>

// 重新创建画布
recreateCanvas(options: CanvasOptions): Promise<void>

// 销毁画布
destroyCanvas(): void
```

#### 媒体处理
```typescript
// 创建MP4Clip
createMP4Clip(file: File): Promise<MP4Clip>

// 克隆MP4Clip
cloneMP4Clip(originalClip: MP4Clip): MP4Clip

// 播放控制
play(): Promise<void>
pause(): void
seekTo(time: number): void
```

## CustomVisibleSprite API

### 属性
```typescript
interface CustomVisibleSprite extends VisibleSprite {
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
```

## 类型定义

### MediaItem
```typescript
interface MediaItem {
  id: string
  file: File
  url: string
  name: string
  duration: number
  type: string
  mp4Clip: Raw<MP4Clip> | null
  isReady: boolean
}
```

### TimelineItem
```typescript
interface TimelineItem {
  id: string
  mediaItemId: string
  trackId: string
  startTime: number
  endTime: number
  duration: number
  trimStart: number
  trimEnd: number
  
  // 变换属性
  transformX: number
  transformY: number
  scaleX: number
  scaleY: number
  rotation: number
  opacity: number
  zIndex: number
  
  // WebAV相关
  sprite?: Raw<CustomVisibleSprite>
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

## 事件系统

### WebAV事件
```typescript
// 播放状态变化
avCanvas.on('play', () => void)
avCanvas.on('pause', () => void)

// 时间更新
avCanvas.on('timeupdate', (time: number) => void)

// 错误事件
avCanvas.on('error', (error: Error) => void)
```

### CustomVisibleSprite事件
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
@spriteSelected="onSpriteSelected"
@spriteTransformed="onSpriteTransformed"

// MediaLibrary组件
@mediaItemAdded="onMediaItemAdded"
@mediaItemDragStart="onMediaItemDragStart"
```

## 工具函数

### 坐标转换
```typescript
// 画布坐标转换
canvasToScreenCoordinates(canvasX: number, canvasY: number): { x: number; y: number }
screenToCanvasCoordinates(screenX: number, screenY: number): { x: number; y: number }

// 时间轴坐标转换
timeToPixel(time: number, zoomLevel: number): number
pixelToTime(pixel: number, zoomLevel: number): number
```

### 时间处理
```typescript
// 帧对齐
alignTimeToFrame(time: number, frameRate: number): number

// 时间格式化
formatTime(seconds: number): string

// 时长计算
calculateDuration(startTime: number, endTime: number): number
```

### 调试工具
```typescript
// 性能计时器
createPerformanceTimer(name: string): PerformanceTimer

// 日志记录
logWebAVReadyStateChange(isReady: boolean, wasReady: boolean): void
logComponentLifecycle(component: string, event: string, data?: any): void

// 错误处理
debugError(message: string, error: Error, context?: any): void
```

## 最佳实践

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
  // 处理错误情况
}
```

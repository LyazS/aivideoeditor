# API参考文档

## 状态管理 (Pinia Store)

### 核心状态

#### VideoClip 接口
```typescript
interface VideoClip {
  id: string                    // 唯一标识符
  file: File                    // 原始文件对象
  url: string                   // Blob URL
  duration: number              // 片段时长（秒）
  originalDuration: number      // 原始视频时长
  startTime: number             // 片段开始时间
  endTime: number               // 片段结束时间
  timelinePosition: number      // 在时间轴上的位置
  name: string                  // 片段名称
  playbackRate: number          // 播放速度 (0.1-5.0)
  trackId: number               // 所属轨道ID
  transform: VideoTransform     // 变换属性
  zIndex: number                // 层级顺序
  originalResolution?: {        // 原始分辨率
    width: number
    height: number
  }
}
```

#### VideoTransform 接口
```typescript
interface VideoTransform {
  x: number          // X轴位置
  y: number          // Y轴位置
  scaleX: number     // X轴缩放 (0.1-5.0)
  scaleY: number     // Y轴缩放 (0.1-5.0)
  rotation: number   // 旋转角度 (0-360)
  opacity: number    // 透明度 (0-1)
}
```

#### Track 接口
```typescript
interface Track {
  id: number         // 轨道ID
  name: string       // 轨道名称
  isVisible: boolean // 是否可见
  isMuted: boolean   // 是否静音
  height: number     // 轨道高度（像素）
}
```

### 主要方法

#### 片段管理
```typescript
// 添加片段
addClip(clip: VideoClip): void

// 移除片段
removeClip(clipId: string): void

// 更新片段位置
updateClipPosition(clipId: string, newPosition: number, newTrackId?: number): void

// 更新片段时长
updateClipDuration(clipId: string, newDuration: number): void

// 更新片段变换属性
updateClipTransform(clipId: string, transform: Partial<VideoTransform>): void

// 选择片段
selectClip(clipId: string | null): void

// 在指定时间分割片段
splitClipAtTime(clipId: string, time: number): void

// 自动排列片段（消除重叠）
autoArrangeClips(): void
```

#### 播放控制
```typescript
// 播放
play(): void

// 暂停
pause(): void

// 停止
stop(): void

// 设置当前时间
setCurrentTime(time: number, forceAlign?: boolean): void

// 设置播放速度
setPlaybackRate(rate: number): void

// 上一帧
previousFrame(): void

// 下一帧
nextFrame(): void
```

#### 轨道管理
```typescript
// 添加轨道
addTrack(): void

// 移除轨道
removeTrack(trackId: number): void

// 重命名轨道
renameTrack(trackId: number, newName: string): void

// 切换轨道可见性
toggleTrackVisibility(trackId: number): void

// 切换轨道静音
toggleTrackMute(trackId: number): void
```

#### 时间轴控制
```typescript
// 时间转像素
timeToPixel(time: number, containerWidth: number): number

// 像素转时间
pixelToTime(pixel: number, containerWidth: number): number

// 设置缩放级别
setZoomLevel(level: number): void

// 设置滚动偏移
setScrollOffset(offset: number): void

// 扩展时间轴长度
expandTimelineIfNeeded(requiredTime: number): void
```

## WebAV渲染器

### WebAVRenderer 类

#### 构造函数
```typescript
constructor(container: HTMLElement)
```

#### 主要方法
```typescript
// 初始化渲染器
async init(): Promise<void>

// 加载视频
async loadVideo(clip: VideoClip): Promise<void>

// 更新播放时间
updateTime(time: number): void

// 应用变换属性
applyTransform(sprite: VisibleSprite, clip: VideoClip): void

// 更新片段属性
updateClipProperties(clip: VideoClip): void

// 清空画布
clear(): void

// 销毁渲染器
destroy(): void

// 设置画布尺寸
setCanvasSize(width: number, height: number): void
```

#### 回调设置
```typescript
// 设置属性变化回调
setPropsChangeCallback(callback: (transform: VideoTransform) => void): void

// 设置精灵选择回调
setSpriteSelectCallback(callback: (clipId: string | null) => void): void

// 设置视频元数据回调
setVideoMetaCallback(callback: (clipId: string, width: number, height: number) => void): void
```

## 组件接口

### MediaLibrary 组件

#### MediaItem 接口
```typescript
interface MediaItem {
  id: string        // 唯一标识符
  file: File        // 文件对象
  url: string       // Blob URL
  name: string      // 文件名
  duration: number  // 时长（秒）
  type: string      // MIME类型
}
```

#### 主要方法
```typescript
// 添加素材项
addMediaItem(file: File): Promise<void>

// 移除素材项
removeMediaItem(itemId: string): void

// 处理文件选择
handleFileSelect(event: Event): void

// 处理拖拽放置
handleDrop(event: DragEvent): void
```

### Timeline 组件

#### Props
```typescript
interface TimelineProps {
  clips: VideoClip[]     // 片段列表
  tracks: Track[]        // 轨道列表
  currentTime: number    // 当前时间
  totalDuration: number  // 总时长
  zoomLevel: number      // 缩放级别
}
```

#### Events
```typescript
// 片段位置更新
@update-position(clipId: string, newPosition: number, newTrackId?: number)

// 片段时长更新
@update-timing(clipId: string, newDuration: number, timelinePosition?: number)

// 移除片段
@remove(clipId: string)

// 时间变更
@time-change(newTime: number)
```

### VideoClip 组件

#### Props
```typescript
interface VideoClipProps {
  clip: VideoClip        // 片段数据
  track?: Track          // 轨道信息
  timelineWidth: number  // 时间轴宽度
  totalDuration: number  // 总时长
}
```

#### 计算属性
```typescript
// 片段样式
clipStyle: CSSProperties

// 是否重叠
isOverlapping: boolean

// 是否选中
isSelected: boolean

// 显示详情
showDetails: boolean
```

### PropertiesPanel 组件

#### 编辑方法
```typescript
// 更新片段名称
updateClipName(): void

// 更新变换属性
updateTransform(property: keyof VideoTransform, value: number): void

// 更新播放速度
updatePlaybackRate(rate: number): void

// 重置变换
resetTransform(): void

// 应用等比缩放
applyUniformScale(scale: number): void
```

## 工具函数

### videoHelper.ts

```typescript
// 创建视频元素
createVideoElement(file: File): Promise<HTMLVideoElement>

// 从URL创建视频元素
createVideoElementFromURL(url: string): Promise<HTMLVideoElement>

// 格式化时间显示
formatTime(seconds: number): string

// 格式化文件大小
formatFileSize(bytes: number): string

// 格式化时长
formatDuration(seconds: number): string
```

### 时间处理工具

```typescript
// 对齐到帧边界
alignTimeToFrame(time: number, frameRate: number): number

// 秒转帧数
secondsToFrames(seconds: number, frameRate: number): number

// 帧数转秒
framesToSeconds(frames: number, frameRate: number): number

// 时间格式化为时:分:秒.帧
formatTimeWithFrames(seconds: number, frameRate: number): string
```

## 事件系统

### 全局事件
```typescript
// 片段选择变化
'clip-selected': { clipId: string | null }

// 时间变化
'time-changed': { time: number }

// 播放状态变化
'playback-state-changed': { isPlaying: boolean }

// 缩放级别变化
'zoom-changed': { zoomLevel: number }
```

### 组件间通信
```typescript
// 从时间轴到属性面板
'clip-properties-changed': { clipId: string, properties: Partial<VideoClip> }

// 从属性面板到渲染器
'transform-updated': { clipId: string, transform: VideoTransform }

// 从渲染器到属性面板
'sprite-selected': { clipId: string | null }
```

## 错误处理

### 错误类型
```typescript
enum ErrorType {
  VIDEO_LOAD_ERROR = 'VIDEO_LOAD_ERROR',
  WEBAV_INIT_ERROR = 'WEBAV_INIT_ERROR',
  BROWSER_NOT_SUPPORTED = 'BROWSER_NOT_SUPPORTED',
  FILE_FORMAT_ERROR = 'FILE_FORMAT_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR'
}
```

### 错误处理方法
```typescript
// 处理视频加载错误
handleVideoLoadError(error: Error, clipId: string): void

// 处理渲染器错误
handleRendererError(error: Error): void

// 显示用户友好的错误信息
showUserError(errorType: ErrorType, details?: string): void
```

## 性能监控

### 性能指标
```typescript
interface PerformanceMetrics {
  frameRate: number          // 当前帧率
  memoryUsage: number        // 内存使用量
  activeClips: number        // 活跃片段数
  renderTime: number         // 渲染耗时
  loadTime: number           // 加载耗时
}
```

### 监控方法
```typescript
// 获取性能指标
getPerformanceMetrics(): PerformanceMetrics

// 开始性能监控
startPerformanceMonitoring(): void

// 停止性能监控
stopPerformanceMonitoring(): void
```

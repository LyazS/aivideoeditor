# 架构设计文档

## 系统概述

AI视频编辑器是一个基于现代Web技术栈的视频编辑应用，采用模块化架构设计，实现了高性能的视频处理和实时预览功能。

### 核心设计原则

1. **模块化**: 功能按模块划分，降低耦合度
2. **响应式**: 基于Vue 3响应式系统的状态管理
3. **性能优先**: WebAV硬件加速渲染，优化用户体验
4. **类型安全**: 全面使用TypeScript确保代码质量
5. **可扩展**: 清晰的接口设计，便于功能扩展

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                            │
├─────────────────────────────────────────────────────────────┤
│  VideoPreviewEngine │ MediaLibrary │ Timeline │ Properties  │
├─────────────────────────────────────────────────────────────┤
│                        组件层                               │
├─────────────────────────────────────────────────────────────┤
│  PreviewWindow │ PlaybackControls │ VideoClip │ TimeScale   │
├─────────────────────────────────────────────────────────────┤
│                      状态管理层                              │
├─────────────────────────────────────────────────────────────┤
│                     VideoStore (Pinia)                     │
├─────────────────────────────────────────────────────────────┤
│                      模块层                                 │
├─────────────────────────────────────────────────────────────┤
│ WebAV │ Media │ Playback │ Config │ Track │ Timeline │ ... │
├─────────────────────────────────────────────────────────────┤
│                      服务层                                 │
├─────────────────────────────────────────────────────────────┤
│           useWebAVControls │ VideoVisibleSprite            │
├─────────────────────────────────────────────────────────────┤
│                      引擎层                                 │
├─────────────────────────────────────────────────────────────┤
│                WebAV (av-canvas + av-cliper)               │
└─────────────────────────────────────────────────────────────┘
```

## 模块化设计

### 状态管理模块

#### WebAV模块 (webavModule.ts)
**职责**: WebAV引擎的状态管理（实际操作由useWebAVControls处理）
```typescript
interface WebAVModule {
  // 状态
  avCanvas: Ref<AVCanvas | null>
  isWebAVReady: Ref<boolean>
  webAVError: Ref<string | null>

  // 状态管理方法
  setAVCanvas(canvas: AVCanvas | null): void
  setWebAVReady(ready: boolean): void
  setWebAVError(error: string | null): void
  clearWebAVState(): void

  // 工具方法
  isWebAVAvailable(): boolean
  getWebAVSummary(): object
  addSprite(sprite: unknown): boolean
  removeSprite(sprite: unknown): boolean
}
```

#### 媒体模块 (mediaModule.ts)
**职责**: 素材库和媒体文件管理
```typescript
interface MediaModule {
  // 状态
  mediaItems: Ref<MediaItem[]>
  
  // 方法
  addMediaItem(item: MediaItem): void
  removeMediaItem(id: string): void
  getMediaItem(id: string): MediaItem | undefined
  setVideoElement(id: string, element: HTMLVideoElement): void
  getVideoOriginalResolution(id: string): { width: number; height: number } | null
}
```

#### 播放模块 (playbackModule.ts)
**职责**: 播放状态和时间控制
```typescript
interface PlaybackModule {
  // 状态
  currentTime: Ref<number>
  isPlaying: Ref<boolean>
  playbackRate: Ref<number>
  
  // 计算属性
  currentFrame: ComputedRef<number>
  formattedCurrentTime: ComputedRef<string>
  
  // 方法
  setCurrentTime(time: number): void
  setIsPlaying(playing: boolean): void
  setPlaybackRate(rate: number): void
}
```

#### 配置模块 (configModule.ts)
**职责**: 项目级别的配置管理
```typescript
interface ConfigModule {
  // 状态
  videoResolution: Ref<VideoResolution>
  frameRate: Ref<number>
  timelineDuration: Ref<number>
  proportionalScale: Ref<boolean>
  
  // 方法
  setVideoResolution(resolution: VideoResolution): void
  setFrameRate(rate: number): void
  setTimelineDuration(duration: number): void
  setProportionalScale(enabled: boolean): void
}
```

### 数据流架构

#### 单向数据流
```
用户操作 → UI组件 → Action → Store → State → UI更新
```

#### WebAV事件流
```
WebAV事件 → 事件监听器 → Store更新 → UI响应
```

#### 双向同步机制
```
UI变化 → Sprite属性更新 → propsChange事件 → Store同步 → UI反馈
```

## WebAV集成架构

### 单例模式设计
```typescript
// 全局唯一的WebAV实例
let globalAVCanvas: AVCanvas | null = null
let globalCanvasContainer: HTMLElement | null = null

export function useWebAVControls() {
  // 确保全局唯一性
  const getAVCanvas = () => globalAVCanvas
  const setAVCanvas = (canvas: AVCanvas | null) => {
    globalAVCanvas = canvas
  }
}
```

### 资源管理策略
```typescript
interface CanvasBackup {
  sprites: Array<{
    sprite: Raw<VideoVisibleSprite>
    clip: MP4Clip
    timelineItemId: string
  }>
  currentTime: number
  isPlaying: boolean
}

// 画布重建时的内容迁移
async function recreateCanvas(options: CanvasOptions) {
  const backup = createBackup()
  await destroyCanvas()
  await initializeCanvas(options)
  await restoreFromBackup(backup)
}
```

### 内存管理机制
```typescript
// 自动资源清理
onUnmounted(() => {
  // 清理WebAV对象
  sprites.forEach(sprite => sprite.destroy())
  mp4Clips.forEach(clip => clip.destroy())
  
  // 移除事件监听器
  avCanvas?.off('timeupdate', handleTimeUpdate)
  
  // 清理DOM引用
  canvasContainer = null
})
```

## 组件架构

### 组件层次结构
```
App
└── VideoPreviewEngine (主容器)
    ├── MediaLibrary (素材库)
    │   └── 素材项组件
    ├── PreviewWindow (预览区域)
    │   ├── WebAVRenderer (WebAV渲染器)
    │   └── 控制覆盖层
    ├── Timeline (时间轴，包含轨道管理)
    │   ├── TimeScale (时间刻度)
    │   └── VideoClip[] (视频片段)
    ├── PlaybackControls (播放控制)
    ├── PropertiesPanel (属性面板)
    └── ClipManagementToolbar (工具栏)
```

### 组件通信模式

#### Props/Events模式
```vue
<!-- 父组件 -->
<ChildComponent 
  :prop-data="data" 
  @child-event="handleChildEvent" 
/>

<!-- 子组件 -->
<script setup lang="ts">
interface Props {
  propData: DataType
}
const props = defineProps<Props>()

interface Emits {
  childEvent: [payload: PayloadType]
}
const emit = defineEmits<Emits>()
</script>
```

#### Store模式
```typescript
// 跨组件状态共享
const videoStore = useVideoStore()

// 组件A
videoStore.selectTimelineItem(itemId)

// 组件B自动响应
watch(() => videoStore.selectedTimelineItemId, (itemId) => {
  // 响应选择变化
})
```

#### 事件总线模式
```typescript
// WebAV事件监听
avCanvas.on('timeupdate', (time: number) => {
  videoStore.setCurrentTime(time)
})

// VideoVisibleSprite事件监听
sprite.on('propsChange', (props: SpriteProperties) => {
  videoStore.updateTimelineItem(itemId, props)
})
```

## 性能优化架构

### 渲染优化
```typescript
// WebAV硬件加速
const avCanvas = new AVCanvas(canvasElement, {
  width: 1920,
  height: 1080,
  // 启用硬件加速
  alpha: false,
  antialias: true
})

// 帧率控制
const targetFPS = 30
const frameInterval = 1000 / targetFPS
```

### 内存优化
```typescript
// MP4Clip复用机制
const clipCache = new Map<string, MP4Clip>()

function getOrCreateClip(mediaItemId: string): MP4Clip {
  if (!clipCache.has(mediaItemId)) {
    const clip = createMP4Clip(mediaItem.file)
    clipCache.set(mediaItemId, clip)
  }
  return clipCache.get(mediaItemId)!.clone()
}
```

### 响应式优化
```typescript
// 避免深度响应式
const webAVObjects = shallowRef(new Map())

// 使用markRaw避免响应式包装
const mp4Clip = markRaw(await createMP4Clip(file))

// 批量更新优化
const { pause, resume } = pauseTracking()
pause()
// 批量状态更新
resume()
```

## 错误处理架构

### 分层错误处理
```typescript
// 1. WebAV层错误
avCanvas.on('error', (error: Error) => {
  videoStore.setWebAVError(error.message)
})

// 2. 业务逻辑层错误
try {
  await businessOperation()
} catch (error) {
  handleBusinessError(error)
}

// 3. UI层错误
const errorBoundary = (error: Error, instance: ComponentInternalInstance) => {
  console.error('组件错误:', error)
  // 错误上报和恢复
}
```

### 错误恢复机制
```typescript
// WebAV错误恢复
async function recoverFromWebAVError() {
  try {
    // 1. 保存当前状态
    const backup = createStateBackup()
    
    // 2. 重新初始化WebAV
    await reinitializeWebAV()
    
    // 3. 恢复状态
    await restoreState(backup)
    
    // 4. 清除错误状态
    videoStore.setWebAVError(null)
  } catch (error) {
    // 最终错误处理
    handleFatalError(error)
  }
}
```

---

*最后更新：2025-06-19*

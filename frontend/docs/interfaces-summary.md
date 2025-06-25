# 项目Interface类型定义整理

本文档整理了项目中所有的TypeScript interface定义，按功能模块分类。

## 📁 核心数据类型 (`src/types/videoTypes.ts`)

### 媒体相关接口

```typescript
// 素材状态枚举
export type MediaStatus = 'parsing' | 'ready' | 'error' | 'missing'

// 素材层：包装MP4Clip/ImgClip和原始文件信息
export interface MediaItem {
  id: string
  name: string
  file: File
  url: string
  duration: number
  type: string
  mediaType: 'video' | 'image' // 媒体类型：视频或图片
  mp4Clip: Raw<MP4Clip> | null // 视频文件解析中时为null，解析完成后为MP4Clip实例
  imgClip: Raw<ImgClip> | null // 图片文件解析中时为null，解析完成后为ImgClip实例
  isReady: boolean // 是否解析完成
  status: MediaStatus // 素材状态
  thumbnailUrl?: string // WebAV生成的缩略图URL
}

// 时间轴层：包装VideoVisibleSprite/ImageVisibleSprite和时间轴位置信息
export interface TimelineItem {
  id: string
  mediaItemId: string // 引用MediaItem的ID
  trackId: number
  mediaType: 'video' | 'image' // 媒体类型：视频或图片
  timeRange: VideoTimeRange | ImageTimeRange // 时间范围信息（视频包含倍速，图片不包含）
  sprite: Raw<VideoVisibleSprite | ImageVisibleSprite> // 视频或图片sprite
  thumbnailUrl?: string // 时间轴clip的缩略图URL
  // Sprite位置和大小属性（响应式）
  x: number
  y: number
  width: number
  height: number
  // 其他sprite属性（响应式）
  rotation: number // 旋转角度（弧度）
  zIndex: number
  opacity: number
  // 音频属性（仅对视频有效）
  volume: number // 音量（0-1之间）
  isMuted: boolean // 静音状态
}

// 轨道接口
export interface Track {
  id: number
  name: string
  isVisible: boolean
  isMuted: boolean
  height: number // 轨道高度
}

// 视频分辨率接口
export interface VideoResolution {
  name: string
  width: number
  height: number
  aspectRatio: string
  category?: string
}
```

### WebAV事件相关接口

```typescript
// 定义WebAV属性变化事件的类型
export interface PropsChangeEvent {
  rect?: Partial<Rect>
  zIndex?: number
}
```

### 拖拽相关接口

```typescript
// 时间轴项目拖拽数据结构
export interface TimelineItemDragData {
  type: 'timeline-item'
  itemId: string
  trackId: number
  startTime: number
  selectedItems: string[]  // 多选支持
  dragOffset: { x: number, y: number }  // 拖拽偏移
}

// 素材库拖拽数据结构
export interface MediaItemDragData {
  type: 'media-item'
  mediaItemId: string
  name: string
  duration: number
  mediaType: 'video' | 'image'
}

// 拖拽预览数据结构
export interface DragPreviewData {
  name: string
  duration: number
  startTime: number
  trackId: number
  isConflict?: boolean
  isMultiple?: boolean
  count?: number
}
```

## 📁 时间范围接口 (`src/utils/`)

### 视频时间范围 (`VideoVisibleSprite.ts`)

```typescript
// 时间范围接口定义
export interface VideoTimeRange {
  /** 素材内部开始时间（微秒） - 从素材的哪个时间点开始播放 */
  clipStartTime: number
  /** 素材内部结束时间（微秒） - 播放到素材的哪个时间点结束 */
  clipEndTime: number
  /** 时间轴开始时间（微秒） - 素材在整个项目时间轴上的开始位置 */
  timelineStartTime: number
  /** 时间轴结束时间（微秒） - 素材在整个项目时间轴上的结束位置 */
  timelineEndTime: number
  /** 有效播放时长（微秒） - 在时间轴上占用的时长，如果与素材内部时长不同则表示变速 */
  effectiveDuration: number
  /** 播放速度倍率 - 1.0为正常速度，2.0为2倍速，0.5为0.5倍速 */
  playbackRate: number
}

// 音频状态接口
export interface AudioState {
  /** 音量（0-1之间，0为静音，1为最大音量） */
  volume: number
  /** 静音状态标记 */
  isMuted: boolean
}
```

### 图片时间范围 (`ImageVisibleSprite.ts`)

```typescript
// 图片时间范围接口定义
// 图片没有倍速概念，所以不包含playbackRate
export interface ImageTimeRange {
  /** 时间轴开始时间（微秒） - 图片在整个项目时间轴上的开始位置 */
  timelineStartTime: number
  /** 时间轴结束时间（微秒） - 图片在整个项目时间轴上的结束位置 */
  timelineEndTime: number
  /** 显示时长（微秒） - 图片在时间轴上显示的时长 */
  displayDuration: number
}
```

## 📁 历史管理接口 (`src/stores/modules/historyModule.ts`)

### 命令模式接口

```typescript
// 通知管理器接口
// 定义历史管理器需要的通知功能
interface NotificationManager {
  showSuccess(title: string, message?: string, duration?: number): string
  showError(title: string, message?: string, duration?: number): string
  showWarning(title: string, message?: string, duration?: number): string
  showInfo(title: string, message?: string, duration?: number): string
}

// 简单命令接口
// 阶段1的最简实现，只包含基础的execute和undo方法
export interface SimpleCommand {
  id: string
  description: string
  execute(): void | Promise<void>
  undo(): void | Promise<void>
}
```

## 📁 WebAV控制接口 (`src/composables/useWebAVControls.ts`)

### 播放控制接口

```typescript
// 定义播放选项接口
interface PlayOptions {
  start: number
  playbackRate: number
  end?: number
}

// 画布重新创建时的内容备份 - 只备份元数据，不备份WebAV对象
interface CanvasBackup {
  timelineItems: Array<{
    id: string
    mediaItemId: string
    trackId: number
    mediaType: 'video' | 'image'
    timeRange: VideoTimeRange | ImageTimeRange
    x: number
    y: number
    width: number
    height: number
    rotation: number
    zIndex: number
    opacity: number
    volume: number
    isMuted: boolean
    thumbnailUrl: string
  }>
  currentTime: number
  isPlaying: boolean
}
```

## 📁 命令模式接口 (`src/stores/modules/commands/timelineCommands.ts`)

### 时间轴命令相关接口

```typescript
// 定义时间轴项目数据接口，用于命令模式中的数据保存
interface TimelineItemData {
  id: string
  mediaItemId: string
  trackId: number
  mediaType: 'video' | 'image'
  timeRange: VideoTimeRange | ImageTimeRange
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  opacity: number
  volume: number
  isMuted: boolean
  thumbnailUrl?: string
}

// 定义变换数据接口
interface TransformData {
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  opacity?: number
  zIndex?: number
  duration?: number
  playbackRate?: number
  volume?: number
  isMuted?: boolean
}
```

## 📁 全局类型声明 (`src/types/global.d.ts`)

### 全局Window接口扩展

```typescript
// 扩展 Window 接口，添加拖拽数据属性
declare global {
  interface Window {
    __timelineDragData?: TimelineItemDragData | null
    __mediaDragData?: MediaItemDragData | null
  }
}
```

## 📊 接口统计

- **核心数据接口**: 7个 (MediaItem, TimelineItem, Track, VideoResolution等)
- **时间范围接口**: 3个 (VideoTimeRange, ImageTimeRange, AudioState)
- **拖拽相关接口**: 3个 (TimelineItemDragData, MediaItemDragData, DragPreviewData)
- **命令模式接口**: 4个 (SimpleCommand, NotificationManager, TimelineItemData, TransformData)
- **WebAV控制接口**: 2个 (PlayOptions, CanvasBackup)
- **全局扩展接口**: 1个 (Window扩展)
- **Store模块类型**: 1个 (MediaModule)
- **调试工具常量**: 1个 (DEBUG_GROUPS)

**总计**: 22个主要interface/type定义

## 📁 Store模块接口

### 媒体模块类型 (`src/stores/modules/mediaModule.ts`)

```typescript
// 导出类型定义
export type MediaModule = ReturnType<typeof createMediaModule>
```

### 批量命令接口 (`src/stores/modules/commands/batchCommands.ts`)

批量命令类继承自 `BaseBatchCommand`，主要包含：

- `BatchDeleteCommand` - 批量删除时间轴项目命令
- `BatchAutoArrangeTrackCommand` - 批量自动排列轨道命令
- `BatchUpdatePropertiesCommand` - 批量属性修改命令

这些类都实现了 `SimpleCommand` 接口。

## 📁 调试工具常量 (`src/utils/webavDebug.ts`)

### 调试分组常量

```typescript
export const DEBUG_GROUPS = {
  // 🚀 初始化相关
  INIT: {
    PREFIX: '🚀 [WebAV Init]',
    CONTAINER: '📦 [Container]',
    CANVAS: '🎨 [Canvas]',
    EVENTS: '🎧 [Events]',
  },
  // 🔄 画布重建相关
  REBUILD: {
    PREFIX: '🔄 [Canvas Rebuild]',
    DESTROY: '💥 [Destroy]',
    BACKUP: '📦 [Backup]',
    RESTORE: '🔄 [Restore]',
    COORDS: '📐 [Coordinates]',
  },
  // 🎬 组件生命周期相关
  LIFECYCLE: {
    PREFIX: '🎬 [Lifecycle]',
    RENDERER: '🖼️ [Renderer]',
    ENGINE: '⚙️ [Engine]',
    STORE: '🏪 [Store]',
  },
  // ⚡ 性能监控相关
  PERFORMANCE: {
    PREFIX: '⚡ [Performance]',
    TIMER: '⏱️ [Timer]',
    STATS: '📊 [Stats]',
  },
} as const
```

## 🔗 接口关系图

```
MediaItem ──┐
            ├─→ TimelineItem ──→ VideoTimeRange/ImageTimeRange
Track ──────┘                 └─→ AudioState

SimpleCommand ──→ TimelineItemData ──→ TransformData
     ↑
BaseBatchCommand ──→ BatchDeleteCommand
                 ├─→ BatchAutoArrangeTrackCommand
                 └─→ BatchUpdatePropertiesCommand

DragData ──→ TimelineItemDragData/MediaItemDragData ──→ DragPreviewData

NotificationManager ──→ HistoryModule
```

## 📋 使用建议

### 1. 类型导入规范

```typescript
// 推荐：从统一类型文件导入
import type { MediaItem, TimelineItem, VideoTimeRange, SimpleCommand } from '@/types'

// 避免：批量导入所有类型（除非确实需要）
import type * from '@/types'
```

### 2. 接口扩展模式

```typescript
// 扩展现有接口时，使用继承或交叉类型
interface ExtendedTimelineItem extends TimelineItem {
  customProperty: string
}

// 或使用交叉类型
type EnhancedMediaItem = MediaItem & {
  processingStatus: 'idle' | 'processing' | 'complete'
}
```

### 3. 类型守卫使用

项目中提供了多个类型守卫函数，建议使用：

```typescript
import {
  isVideoTimeRange,
  isImageTimeRange,
  isVideoTimelineItem,
  isImageTimelineItem
} from '@/types'

// 使用类型守卫进行类型缩窄
if (isVideoTimelineItem(item)) {
  // 此时 item 被缩窄为视频类型
  console.log(item.timeRange.playbackRate)
}
```

## 🔄 更新记录

- **2024-12**: 初始整理，包含20个主要interface定义
- 涵盖核心数据类型、时间范围、拖拽、命令模式、WebAV控制等模块
- 提供了接口关系图和使用建议

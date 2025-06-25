/**
 * 统一的类型定义文件
 * 将分散在各个文件中的interface定义集中管理
 */

import type { Raw } from 'vue'
import type { MP4Clip, ImgClip, Rect, VisibleSprite } from '@webav/av-cliper'

// ==================== 基础类型定义 ====================

/**
 * 素材状态枚举
 */
export type MediaStatus = 'parsing' | 'ready' | 'error' | 'missing'

/**
 * 媒体类型
 */
export type MediaType = 'video' | 'image'

// ==================== 时间范围接口 ====================

/**
 * 视频时间范围接口定义
 */
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

/**
 * 图片时间范围接口定义
 * 图片没有倍速概念，所以不包含playbackRate
 */
export interface ImageTimeRange {
  /** 时间轴开始时间（微秒） - 图片在整个项目时间轴上的开始位置 */
  timelineStartTime: number
  /** 时间轴结束时间（微秒） - 图片在整个项目时间轴上的结束位置 */
  timelineEndTime: number
  /** 显示时长（微秒） - 图片在时间轴上显示的时长 */
  displayDuration: number
}

/**
 * 音频状态接口
 */
export interface AudioState {
  /** 音量（0-1之间，0为静音，1为最大音量） */
  volume: number
  /** 静音状态标记 */
  isMuted: boolean
}

// ==================== 核心数据接口 ====================

/**
 * 素材项目接口
 * 素材层：包装MP4Clip/ImgClip和原始文件信息
 */
export interface MediaItem {
  id: string
  name: string
  file: File
  url: string
  duration: number
  type: string
  mediaType: MediaType
  mp4Clip: Raw<MP4Clip> | null // 视频文件解析中时为null，解析完成后为MP4Clip实例
  imgClip: Raw<ImgClip> | null // 图片文件解析中时为null，解析完成后为ImgClip实例
  isReady: boolean // 是否解析完成
  status: MediaStatus // 素材状态
  thumbnailUrl?: string // WebAV生成的缩略图URL
}

/**
 * 时间轴项目接口
 * 时间轴层：包装VideoVisibleSprite/ImageVisibleSprite和时间轴位置信息
 */
export interface TimelineItem {
  id: string
  mediaItemId: string // 引用MediaItem的ID
  trackId: number
  mediaType: MediaType
  timeRange: VideoTimeRange | ImageTimeRange // 时间范围信息（视频包含倍速，图片不包含）
  sprite: Raw<VisibleSprite> // 视频或图片sprite
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

/**
 * 轨道接口
 */
export interface Track {
  id: number
  name: string
  isVisible: boolean
  isMuted: boolean
  height: number // 轨道高度
}

/**
 * 视频分辨率接口
 */
export interface VideoResolution {
  name: string
  width: number
  height: number
  aspectRatio: string
  category?: string
}

// ==================== WebAV相关接口 ====================

/**
 * WebAV属性变化事件的类型
 */
export interface PropsChangeEvent {
  rect?: Partial<Rect>
  zIndex?: number
}

/**
 * 播放选项接口
 */
export interface PlayOptions {
  start: number
  playbackRate: number
  end?: number
}

/**
 * 画布备份接口
 * 画布重新创建时的内容备份 - 只备份元数据，不备份WebAV对象
 */
export interface CanvasBackup {
  timelineItems: Array<{
    id: string
    mediaItemId: string
    trackId: number
    mediaType: MediaType
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

// ==================== 拖拽相关接口 ====================

/**
 * 时间轴项目拖拽数据结构
 */
export interface TimelineItemDragData {
  type: 'timeline-item'
  itemId: string
  trackId: number
  startTime: number
  selectedItems: string[]  // 多选支持
  dragOffset: { x: number, y: number }  // 拖拽偏移
}

/**
 * 素材库拖拽数据结构
 */
export interface MediaItemDragData {
  type: 'media-item'
  mediaItemId: string
  name: string
  duration: number
  mediaType: MediaType
}

/**
 * 拖拽预览数据结构
 */
export interface DragPreviewData {
  name: string
  duration: number
  startTime: number
  trackId: number
  isConflict?: boolean
  isMultiple?: boolean
  count?: number
}

/**
 * 冲突信息接口
 * 用于检测和显示时间轴项目之间的重叠冲突
 */
export interface ConflictInfo {
  itemId: string
  itemName: string
  startTime: number
  endTime: number
  overlapStart: number
  overlapEnd: number
}

// ==================== 命令模式接口 ====================

/**
 * 简单命令接口
 * 阶段1的最简实现，只包含基础的execute和undo方法
 */
export interface SimpleCommand {
  id: string
  description: string
  execute(): void | Promise<void>
  undo(): void | Promise<void>
}

/**
 * 通知类型枚举
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info'

/**
 * 通知接口
 */
export interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number // 显示时长（毫秒），0表示不自动消失
  timestamp?: number // 创建时间戳
  persistent?: boolean // 是否持久化（不会被批量清除）
}

/**
 * 通知管理器接口
 * 定义历史管理器需要的通知功能
 */
export interface NotificationManager {
  showSuccess(title: string, message?: string, duration?: number): string
  showError(title: string, message?: string, duration?: number): string
  showWarning(title: string, message?: string, duration?: number): string
  showInfo(title: string, message?: string, duration?: number): string
}

/**
 * 时间轴项目数据接口
 * 用于命令模式中的数据保存
 */
export interface TimelineItemData {
  id: string
  mediaItemId: string
  trackId: number
  mediaType: MediaType
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

/**
 * 变换数据接口
 */
export interface TransformData {
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

/**
 * 属性类型枚举
 * 用于标识可修改的时间轴项目属性类型
 */
export type PropertyType = 'position' | 'size' | 'rotation' | 'opacity' | 'zIndex' | 'duration' | 'playbackRate' | 'volume' | 'audioState' | 'multiple'

// ==================== Store模块类型 ====================

/**
 * 媒体模块类型
 */
export type MediaModule = {
  mediaItems: any
  addMediaItem: (item: MediaItem) => void
  removeMediaItem: (id: string) => void
  getMediaItem: (id: string) => MediaItem | undefined
  updateMediaItemName: (id: string, name: string) => void
  updateMediaItem: (id: string, updates: Partial<MediaItem>) => void
  setVideoElement: (id: string, element: HTMLVideoElement) => void
  getVideoOriginalResolution: (id: string) => Promise<{ width: number; height: number }>
  setImageElement: (id: string, element: HTMLImageElement) => void
  getImageOriginalResolution: (id: string) => Promise<{ width: number; height: number }>
}

// ==================== 缩略图生成相关接口 ====================

/**
 * 缩略图生成所需的媒体项目信息
 * 只包含生成缩略图必需的属性
 */
export interface MediaItemForThumbnail {
  mediaType: MediaType
  mp4Clip?: Raw<MP4Clip> | null
  imgClip?: Raw<ImgClip> | null
}

// ==================== 时间刻度相关接口 ====================

/**
 * 时间刻度标记接口
 * 用于时间轴刻度显示
 */
export interface TimeMark {
  time: number
  position: number
  isMajor: boolean
  isFrame?: boolean // 标记是否为帧级别的刻度
}

// ==================== 调试工具类型 ====================

/**
 * 调试分组常量类型
 */
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

// ==================== 类型守卫函数 ====================

/**
 * 检查时间范围是否为视频时间范围
 * @param timeRange 时间范围对象
 * @returns 是否为视频时间范围
 */
export function isVideoTimeRange(timeRange: VideoTimeRange | ImageTimeRange): timeRange is VideoTimeRange {
  return 'clipStartTime' in timeRange && 'clipEndTime' in timeRange && 'effectiveDuration' in timeRange && 'playbackRate' in timeRange
}

/**
 * 检查时间范围是否为图片时间范围
 * @param timeRange 时间范围对象
 * @returns 是否为图片时间范围
 */
export function isImageTimeRange(timeRange: VideoTimeRange | ImageTimeRange): timeRange is ImageTimeRange {
  return 'displayDuration' in timeRange && !('clipStartTime' in timeRange)
}

/**
 * 检查时间轴项目是否为视频类型
 * @param item 时间轴项目
 * @returns 是否为视频类型
 */
export function isVideoTimelineItem(item: TimelineItem): item is TimelineItem & { timeRange: VideoTimeRange } {
  return item.mediaType === 'video' && isVideoTimeRange(item.timeRange)
}

/**
 * 检查时间轴项目是否为图片类型
 * @param item 时间轴项目
 * @returns 是否为图片类型
 */
export function isImageTimelineItem(item: TimelineItem): item is TimelineItem & { timeRange: ImageTimeRange } {
  return item.mediaType === 'image' && isImageTimeRange(item.timeRange)
}

// ==================== 类型声明扩展 ====================

/**
 * 扩展 WebAV 的 VisibleSprite 类型
 * 添加我们自定义的方法签名
 */
declare module '@webav/av-cliper' {
  interface VisibleSprite {
    getTimeRange(): VideoTimeRange | ImageTimeRange
    setTimeRange(timeRange: VideoTimeRange | ImageTimeRange): void
  }
}

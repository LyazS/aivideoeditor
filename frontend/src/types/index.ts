/**
 * 统一的类型定义文件
 * 将分散在各个文件中的interface定义集中管理
 *
 * 激进重构版本：基于继承关系的异步处理素材支持
 */

import type { Raw } from 'vue'
import type { MP4Clip, ImgClip, AudioClip, Rect } from '@webav/av-cliper'

// ==================== 基础类型定义 ====================

/**
 * 素材状态枚举
 */
export type MediaStatus = 'parsing' | 'ready' | 'error' | 'missing'

/**
 * 核心媒体类型 - 支持视频、图片、音频和文本
 */
export type MediaType = 'video' | 'image' | 'audio' | 'text'

/**
 * 异步处理素材在处理前使用 'unknown' 类型，处理后使用实际检测到的类型
 */
export type MediaTypeOrUnknown = MediaType | 'unknown'

/**
 * 异步处理素材状态枚举
 */
export type AsyncProcessingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'error'
  | 'cancelled'
  | 'unsupported'

/**
 * 异步处理类型枚举（当前只支持远程下载）
 */
export type AsyncProcessingType = 'remote-download'

/**
 * 媒体错误类型枚举
 */
export type MediaErrorType =
  | 'webav_parse_error' // WebAV解析失败（如格式不支持、文件损坏）
  | 'file_load_error' // 文件加载失败（如文件不存在、权限问题）
  | 'unsupported_format' // 不支持的文件格式

/**
 * 轨道类型
 */
export type TrackType = 'video' | 'audio' | 'text'

// ==================== 时间范围接口（继承关系设计） ====================

/**
 * 基础时间范围接口 - 所有时间范围的共同基础
 */
export interface BaseTimeRange {
  /** 时间轴开始时间（帧数） - 在整个项目时间轴上的开始位置 */
  timelineStartTime: number
  /** 时间轴结束时间（帧数） - 在整个项目时间轴上的结束位置 */
  timelineEndTime: number
}

/**
 * 视频时间范围接口 - 继承基础时间范围，添加视频特有属性
 * 包含视频和音频的时间范围信息
 */
export interface VideoTimeRange extends BaseTimeRange {
  /** 素材内部开始时间（帧数） - 从素材的哪个帧开始播放 */
  clipStartTime: number
  /** 素材内部结束时间（帧数） - 播放到素材的哪个帧结束 */
  clipEndTime: number
  /** 有效播放时长（帧数） - 在时间轴上占用的时长，如果与素材内部时长不同则表示变速 */
  effectiveDuration: number
  /** 播放速度倍率 - 1.0为正常速度，2.0为2倍速，0.5为0.5倍速 */
  playbackRate: number
}

/**
 * 图片时间范围接口 - 继承基础时间范围，添加图片特有属性
 * 图片没有倍速概念，所以不包含playbackRate
 */
export interface ImageTimeRange extends BaseTimeRange {
  /** 显示时长（帧数） - 图片在时间轴上显示的时长 */
  displayDuration: number
}

/**
 * 异步处理时间轴项目专用时间范围接口 - 继承基础时间范围
 */
export interface AsyncProcessingTimeRange extends BaseTimeRange {
  // 继承 timelineStartTime 和 timelineEndTime
  // 可以在未来添加异步处理特有的时间范围属性
}

// ==================== 异步处理配置类型 ====================

/**
 * 远程下载配置
 */
export interface RemoteDownloadConfig {
  type: 'remote-download'
  url: string // 远程URL
  headers?: Record<string, string> // 自定义请求头
  timeout?: number // 超时时间（毫秒）
}

/**
 * 异步处理配置联合类型（当前只支持远程下载）
 */
export type AsyncProcessingConfig = RemoteDownloadConfig

/**
 * 音频状态接口
 */
export interface AudioState {
  /** 音量（0-1之间，0为静音，1为最大音量） */
  volume: number
  /** 静音状态标记 */
  isMuted: boolean
}

// ==================== 核心数据接口（基于继承关系的激进重构） ====================

/**
 * 基础媒体项目接口 - 所有媒体项目的共同基础
 */
export interface BaseMediaItem {
  id: string
  name: string
  createdAt: string
}

/**
 * 本地媒体项目接口 - 继承基础接口，添加本地文件相关属性
 */
export interface LocalMediaItem extends BaseMediaItem {
  mediaType: MediaType
  file: File
  url: string
  duration: number // 素材时长（帧数）
  type: string
  mp4Clip: Raw<MP4Clip> | null
  imgClip: Raw<ImgClip> | null
  audioClip: Raw<AudioClip> | null
  status: MediaStatus // 唯一状态源（响应式）
  thumbnailUrl?: string
  isAsyncProcessing?: false // 明确标识为本地媒体
}

/**
 * 异步处理媒体项目接口 - 继承基础接口，添加异步处理相关属性
 */
export interface AsyncProcessingMediaItem extends BaseMediaItem {
  mediaType: MediaTypeOrUnknown // 处理前为'unknown'，处理后为实际类型
  isAsyncProcessing: true // 标识为异步处理媒体
  processingType: AsyncProcessingType // 处理类型
  processingStatus: AsyncProcessingStatus // 处理状态
  processingProgress: number // 处理进度 0-100
  expectedDuration: number // 用户输入的预计时长（帧数）

  // 处理配置和参数
  processingConfig: AsyncProcessingConfig // 处理配置（根据类型不同）

  // 处理过程中的临时数据
  processedFile?: File // 处理完成的文件对象
  errorMessage?: string // 错误信息

  // UI显示相关
  thumbnailUrl?: string // 默认图标或预览图

  // 时间戳
  startedAt?: string // 开始处理时间
  completedAt?: string // 完成处理时间

  // 转换状态标记
  isConverting: boolean // 转换中标记，UI层面隐藏显示（必须字段）
}

/**
 * 激进重构：删除旧的类型别名，强制使用新的命名约定
 *
 * ❌ 删除的类型别名：
 * - MediaItem = LocalMediaItem （强制使用 LocalMediaItem）
 *
 * ✅ 新的类型架构：
 * BaseMediaItem
 *   ├── LocalMediaItem
 *   └── AsyncProcessingMediaItem
 */

// ==================== 时间轴项目接口 ====================

/**
 * 基础媒体属性（所有媒体类型共享）
 */
export interface BaseMediaProps<T extends MediaType = MediaType> {
  /** 层级控制 */
  zIndex: number
  /** 动画配置（可选） */
  animation?: AnimationConfig<T>
}

/**
 * 视觉媒体属性（video 和 image 共享）
 */
interface VisualMediaProps<T extends MediaType = MediaType> extends BaseMediaProps<T> {
  /** 水平位置 */
  x: number
  /** 垂直位置 */
  y: number
  /** 宽度 */
  width: number
  /** 高度 */
  height: number
  /** 旋转角度（弧度） */
  rotation: number
  /** 透明度（0-1） */
  opacity: number
  /** 原始宽度（用于计算缩放系数） */
  originalWidth: number
  /** 原始高度（用于计算缩放系数） */
  originalHeight: number
  /** 等比缩放状态（每个clip独立） */
  proportionalScale: boolean
}

/**
 * 音频媒体属性（video 和 audio 共享）
 */
interface AudioMediaProps {
  /** 音量（0-1） */
  volume: number
  /** 静音状态 */
  isMuted: boolean
}

/**
 * 视频媒体配置：同时具有视觉和音频属性
 */
export interface VideoMediaConfig extends VisualMediaProps<'video'>, AudioMediaProps {
  /** 配置名称 */
  name: string
  // 视频特有属性（预留）
  // playbackRate?: number // 倍速可能在 timeRange 中更合适
}

/**
 * 图片媒体配置：只有视觉属性
 */
export interface ImageMediaConfig extends VisualMediaProps<'image'> {
  /** 配置名称 */
  name: string
  // 图片特有属性（预留）
  // filters?: ImageFilterConfig[]
}

/**
 * 音频媒体配置：只有音频属性
 */
export interface AudioMediaConfig extends BaseMediaProps<'audio'>, AudioMediaProps {
  /** 配置名称 */
  name: string
  /** 增益（dB） */
  gain: number
  // 音频特有属性（预留）
  // waveformColor?: string
  // showWaveform?: boolean
}

/**
 * 文本媒体配置：继承视觉媒体属性，添加文本特有属性
 */
export interface TextMediaConfig extends VisualMediaProps<'text'> {
  /** 配置名称 */
  name: string
  /** 文本内容 */
  text: string
  /** 文本样式配置 */
  style: TextStyleConfig
}

/**
 * 媒体配置映射
 */
type MediaConfigMap = {
  video: VideoMediaConfig
  image: ImageMediaConfig
  audio: AudioMediaConfig
  text: TextMediaConfig
}

/**
 * 根据媒体类型获取对应配置的工具类型
 */
export type GetMediaConfig<T extends MediaType> = MediaConfigMap[T]

/**
 * 基础时间轴配置接口 - 用于未知媒体类型的占位符配置
 */
export interface BasicTimelineConfig {
  /** 配置名称 */
  name: string
  /** 预计时长（帧数） */
  expectedDuration: number
}

/**
 * 视觉媒体配置联合类型
 */
export type VisualMediaConfig = VideoMediaConfig | ImageMediaConfig | TextMediaConfig

/**
 * 类型守卫函数（激进重构后直接使用联合类型）
 */
export function isLocalTimelineItem(
  item: LocalTimelineItem<MediaType> | AsyncProcessingTimelineItem | undefined,
): item is LocalTimelineItem<MediaType> {
  return item != null && item.isAsyncProcessingPlaceholder !== true
}

export function isAsyncProcessingTimelineItem(
  item: LocalTimelineItem<MediaType> | AsyncProcessingTimelineItem | undefined,
): item is AsyncProcessingTimelineItem {
  return item != null && item.isAsyncProcessingPlaceholder === true
}

export function isLocalMediaItem(
  item: LocalMediaItem | AsyncProcessingMediaItem | undefined,
): item is LocalMediaItem {
  return item != null && item.isAsyncProcessing !== true
}

export function isAsyncProcessingMediaItem(
  item: LocalMediaItem | AsyncProcessingMediaItem | undefined,
): item is AsyncProcessingMediaItem {
  return item != null && item.isAsyncProcessing === true
}

/**
 * 轨道接口
 */
export interface Track {
  id: string
  name: string
  type: TrackType // 轨道类型
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
 * 扩展的WebAV属性变化事件类型
 * 在原有PropsChangeEvent基础上添加opacity属性支持
 */
export interface ExtendedPropsChangeEvent extends PropsChangeEvent {
  opacity?: number
  // 文本更新事件数据
  textUpdate?: {
    text: string
    style: TextStyleConfig
    needsRecreation: boolean
  }
  // 未来可扩展其他属性
}

/**
 * 播放选项接口
 */
export interface PlayOptions {
  start: number // 开始时间（帧数）
  playbackRate: number
  end?: number // 结束时间（帧数）
}

// ==================== 画布备份接口 ====================

/**
 * 类型安全的画布备份接口
 * 画布重新创建时的内容备份 - 只备份元数据，不备份WebAV对象
 */
export interface CanvasBackup {
  timelineItems: LocalTimelineItemData[]
  currentFrame: number // 当前播放帧数
  isPlaying: boolean
}

// ==================== 拖拽相关接口 ====================

/**
 * 时间轴项目拖拽数据结构
 */
export interface TimelineItemDragData {
  type: 'timeline-item'
  itemId: string
  trackId: string
  startTime: number // 开始时间（帧数）
  selectedItems: string[] // 多选支持
  dragOffset: { x: number; y: number } // 拖拽偏移
}

/**
 * 素材库拖拽数据结构
 */
export interface MediaItemDragData {
  type: 'media-item'
  mediaItemId: string
  name: string
  duration: number // 素材时长（帧数）- 来自MediaItem.duration
  mediaType: MediaType
}

/**
 * 拖拽预览数据结构
 */
export interface DragPreviewData {
  name: string
  duration: number // 预览时长（帧数）- 来自MediaItem.duration
  startTime: number // 开始时间（帧数）
  trackId: string
  isConflict?: boolean
  isMultiple?: boolean
  count?: number
  height?: number // 预览高度（像素）- 与被拖拽clip的高度一致
  mediaType?: MediaType // 媒体类型，用于确定默认高度
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

// ==================== 时间轴项目接口（基于继承关系的激进重构） ====================

/**
 * 基础时间轴项目接口 - 所有时间轴项目的共同基础
 */
export interface BaseTimelineItem {
  id: string
  mediaItemId: string
  trackId: string
  mediaType: MediaTypeOrUnknown
}

/**
 * 本地时间轴项目数据接口（持久化数据）
 * 继承基础属性，添加本地时间轴项目的持久化数据
 */
export interface LocalTimelineItemData<T extends MediaType = MediaType> extends BaseTimelineItem {
  mediaType: T
  timeRange: T extends 'video'
    ? VideoTimeRange
    : T extends 'audio'
      ? VideoTimeRange
      : ImageTimeRange
  config: GetMediaConfig<T>
  animation?: AnimationConfig<T>
  mediaName: string
}

/**
 * 本地时间轴项目接口 - 继承 LocalTimelineItemData，添加运行时属性
 */
export interface LocalTimelineItem<T extends MediaType = MediaType>
  extends LocalTimelineItemData<T> {
  sprite: Raw<CustomSprite>
  thumbnailUrl?: string
  isAsyncProcessingPlaceholder?: false
}

/**
 * 异步处理时间轴项目接口 - 继承基础接口，添加异步处理相关属性
 *
 * 注意：异步处理状态相关字段（processingType、processingStatus、processingProgress、errorMessage）
 * 不在此接口中定义，应该通过 mediaItemId 从对应的 AsyncProcessingMediaItem 实时获取
 */
export interface AsyncProcessingTimelineItem extends BaseTimelineItem {
  mediaType: MediaTypeOrUnknown // 处理前为'unknown'，处理后为实际类型
  mediaItemId: string // 指向 AsyncProcessingMediaItem.id，通过此ID获取实时状态

  // 时间范围 - 使用基础时间范围接口
  timeRange: AsyncProcessingTimeRange

  // 占位符配置
  config: {
    name: string // 显示名称
    expectedDuration: number // 预计时长（帧数）
  }

  // 标识字段
  isAsyncProcessingPlaceholder: true
  sprite: null // 异步处理占位符不创建sprite
}

/**
 * 激进重构：删除旧的类型别名，强制使用新的命名约定
 *
 * ❌ 删除的类型别名：
 * - TimelineItem<T> = LocalTimelineItem<T> （强制使用 LocalTimelineItem）
 * - TimelineItemData<T> = LocalTimelineItemData<T> （强制使用 LocalTimelineItemData）
 *
 * ✅ 新的类型架构：
 * BaseTimelineItem
 *   ├── LocalTimelineItemData<T> → LocalTimelineItem<T>
 *   └── AsyncProcessingTimelineItem
 */

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
  duration?: number // 时长（帧数）- 用于时间轴项目时长调整
  playbackRate?: number
  volume?: number
  isMuted?: boolean
  gain?: number // 音频增益（dB）
}

/**
 * 属性类型枚举
 * 用于标识可修改的时间轴项目属性类型
 */
export type PropertyType =
  | 'position'
  | 'size'
  | 'rotation'
  | 'opacity'
  | 'zIndex'
  | 'duration'
  | 'playbackRate'
  | 'volume'
  | 'audioState'
  | 'gain'
  | 'multiple'

// ==================== Store模块类型 ====================

/**
 * 媒体模块类型（激进重构后使用新的类型）
 */
export type MediaModule = {
  mediaItems: any
  addLocalMediaItem: (item: LocalMediaItem) => void
  removeLocalMediaItem: (id: string) => void
  getLocalMediaItem: (id: string) => LocalMediaItem | undefined
  updateLocalMediaItemName: (id: string, name: string) => void
  updateLocalMediaItem: (id: string, updates: Partial<LocalMediaItem>) => void
  setVideoElement: (id: string, element: HTMLVideoElement) => void
  getVideoOriginalResolution: (id: string) => Promise<{ width: number; height: number }>
  setImageElement: (id: string, element: HTMLImageElement) => void
  getImageOriginalResolution: (id: string) => Promise<{ width: number; height: number }>
  waitForMediaItemReady: (mediaItemId: string) => Promise<boolean>
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
  time: number // 时间值（帧数）- 内部使用帧数进行精确计算
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
export function isVideoTimeRange(
  timeRange: VideoTimeRange | ImageTimeRange | AsyncProcessingTimeRange,
): timeRange is VideoTimeRange {
  return (
    'clipStartTime' in timeRange &&
    'clipEndTime' in timeRange &&
    'effectiveDuration' in timeRange &&
    'playbackRate' in timeRange
  )
}

/**
 * 检查时间范围是否为图片时间范围
 * @param timeRange 时间范围对象
 * @returns 是否为图片时间范围
 */
export function isImageTimeRange(
  timeRange: VideoTimeRange | ImageTimeRange | AsyncProcessingTimeRange,
): timeRange is ImageTimeRange {
  return 'displayDuration' in timeRange && !('clipStartTime' in timeRange)
}

// ===== 激进重构：删除旧的辅助函数，使用新的类型守卫 =====

/**
 * 从 LocalTimelineItem 创建 LocalTimelineItemData（类型安全版本）
 * 用于去除运行时属性（sprite, thumbnailUrl），保留持久化数据（包括 animation）
 */
export function createLocalTimelineItemData<T extends MediaType>(
  item: LocalTimelineItem<T>,
): LocalTimelineItemData<T> {
  return {
    id: item.id,
    mediaItemId: item.mediaItemId,
    trackId: item.trackId,
    mediaType: item.mediaType,
    timeRange: { ...item.timeRange }, // 深拷贝 timeRange 对象，避免引用共享
    config: { ...item.config },
    animation: item.animation ? { ...item.animation } : undefined,
    mediaName: item.mediaName,
  }
}

/**
 * 从 LocalTimelineItemData 获取视觉属性（如果存在）
 */
export function getVisualPropsFromData(data: LocalTimelineItemData): any {
  // 使用类型守卫进行检查
  if (hasVisualPropsData(data)) {
    const config = data.config
    return {
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      rotation: config.rotation,
      opacity: config.opacity,
      zIndex: config.zIndex,
    }
  }
  return null
}

/**
 * 从 LocalTimelineItemData 获取音频属性（如果存在）
 */
export function getAudioPropsFromData(data: LocalTimelineItemData): any {
  if (data.mediaType === 'video' || data.mediaType === 'audio') {
    // 类型安全的配置访问
    if (!hasAudioProperties(data.config)) {
      return null
    }
    const config = data.config
    return {
      volume: config.volume,
      isMuted: config.isMuted,
    }
  }
  return null
}

// ==================== 文本样式配置 ====================

/**
 * 文本样式配置接口
 */
export interface TextStyleConfig {
  // 基础字体属性
  fontSize: number // 字体大小 (px)
  fontFamily: string // 字体族
  fontWeight: string | number // 字重
  fontStyle: 'normal' | 'italic' // 字体样式

  // 颜色属性
  color: string // 文字颜色
  backgroundColor?: string // 背景颜色

  // 文本效果
  textShadow?: string // 文字阴影
  textStroke?: {
    // 文字描边
    width: number
    color: string
  }
  textGlow?: {
    // 文字发光
    color: string
    blur: number
    spread?: number
  }

  // 布局属性
  textAlign: 'left' | 'center' | 'right' // 文本对齐
  lineHeight?: number // 行高
  maxWidth?: number // 最大宽度

  // 自定义字体
  customFont?: {
    name: string
    url: string
  }
}

/**
 * 默认文本样式配置
 */
export const DEFAULT_TEXT_STYLE: TextStyleConfig = {
  fontSize: 48,
  fontFamily: 'Arial, sans-serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#ffffff',
  textAlign: 'center',
  lineHeight: 1.2,
}

// ==================== 自定义 Sprite 类型 ====================

// 导入我们的自定义 Sprite 类
import type { VideoVisibleSprite } from '../utils/VideoVisibleSprite'
import type { ImageVisibleSprite } from '../utils/ImageVisibleSprite'
import type { TextVisibleSprite } from '../utils/TextVisibleSprite'
import type { AudioVisibleSprite } from '../utils/AudioVisibleSprite'

/**
 * 原有的 CustomSprite 类型别名（更新以包含文本精灵）
 */
export type CustomSprite =
  | VideoVisibleSprite
  | ImageVisibleSprite
  | TextVisibleSprite
  | AudioVisibleSprite

// ==================== 媒体类型分类系统 ====================

/**
 * 媒体类型分类
 * 区分基于文件的媒体和程序生成的媒体
 */
export const MEDIA_TYPE_CATEGORIES = {
  /** 基于文件的媒体类型（需要素材库项目） */
  FILE_BASED: ['video', 'image', 'audio'] as const,

  /** 程序生成的媒体类型（不需要素材库项目） */
  GENERATED: ['text'] as const,
} as const

/**
 * 检查媒体类型是否需要素材库项目
 * @param mediaType 媒体类型
 * @returns 是否需要素材库项目
 */
export function requiresMediaItem(mediaType: MediaType): boolean {
  return (MEDIA_TYPE_CATEGORIES.FILE_BASED as readonly MediaType[]).includes(mediaType)
}

/**
 * 检查媒体类型是否为程序生成
 * @param mediaType 媒体类型
 * @returns 是否为程序生成的媒体
 */
export function isGeneratedMedia(mediaType: MediaType): boolean {
  return (MEDIA_TYPE_CATEGORIES.GENERATED as readonly MediaType[]).includes(mediaType)
}

/**
 * 获取媒体类型的分类名称
 * @param mediaType 媒体类型
 * @returns 分类名称
 */
export function getMediaTypeCategory(mediaType: MediaType): 'FILE_BASED' | 'GENERATED' | 'UNKNOWN' {
  if (requiresMediaItem(mediaType)) {
    return 'FILE_BASED'
  }
  if (isGeneratedMedia(mediaType)) {
    return 'GENERATED'
  }
  return 'UNKNOWN'
}

/**
 * 检查时间轴项目是否具有视觉属性（类型守卫版本）
 * @param item 时间轴项目
 * @returns 是否具有视觉属性，同时进行类型守卫
 */
export function hasVisualProps(
  item: LocalTimelineItem,
): item is LocalTimelineItem<'video' | 'image' | 'text'> {
  const hasVisual =
    item.mediaType === 'video' || item.mediaType === 'image' || item.mediaType === 'text'
  if (hasVisual) {
    // 额外的运行时检查，确保配置确实具有视觉属性
    return hasVisualProperties(item.config)
  }
  return false
}

/**
 * 检查时间轴项目是否具有音频属性（类型守卫版本）
 * @param item 时间轴项目
 * @returns 是否具有音频属性，同时进行类型守卫
 */
export function hasAudioProps(
  item: LocalTimelineItem,
): item is LocalTimelineItem<'video' | 'audio'> {
  const hasAudio = item.mediaType === 'video' || item.mediaType === 'audio'
  if (hasAudio) {
    // 额外的运行时检查，确保配置确实具有音频属性
    return hasAudioProperties(item.config)
  }
  return false
}

/**
 * 检查时间轴项目数据是否具有视觉属性（类型守卫版本）
 * @param itemData 时间轴项目数据
 * @returns 是否具有视觉属性，同时进行类型守卫
 */
export function hasVisualPropsData(
  itemData: LocalTimelineItemData,
): itemData is LocalTimelineItemData<'video' | 'image' | 'text'> {
  const hasVisual =
    itemData.mediaType === 'video' ||
    itemData.mediaType === 'image' ||
    itemData.mediaType === 'text'
  if (hasVisual) {
    // 额外的运行时检查，确保配置确实具有视觉属性
    return hasVisualProperties(itemData.config)
  }
  return false
}

/**
 * 类型守卫函数：检查配置是否具有视觉属性
 * @param config 媒体配置对象
 * @returns 是否具有视觉属性
 */
export function hasVisualProperties(
  config: GetMediaConfig<MediaType>,
): config is VideoMediaConfig | ImageMediaConfig | TextMediaConfig {
  return (
    'width' in config &&
    'height' in config &&
    'x' in config &&
    'y' in config &&
    'rotation' in config &&
    'opacity' in config
  )
}

/**
 * 类型守卫函数：检查配置是否具有音频属性
 * @param config 媒体配置对象
 * @returns 是否具有音频属性
 */
export function hasAudioProperties(
  config: GetMediaConfig<MediaType>,
): config is VideoMediaConfig | AudioMediaConfig {
  return 'volume' in config && 'isMuted' in config
}

/**
 * 类型安全的配置属性访问器
 * 根据媒体类型安全地访问配置属性
 */
export function getConfigProperty<T extends MediaType, K extends keyof GetMediaConfig<T>>(
  item: LocalTimelineItem<T>,
  property: K,
): GetMediaConfig<T>[K] {
  return (item.config as GetMediaConfig<T>)[property]
}

/**
 * 类型安全的配置属性设置器
 * 根据媒体类型安全地设置配置属性
 */
export function setConfigProperty<T extends MediaType, K extends keyof GetMediaConfig<T>>(
  item: LocalTimelineItem<T>,
  property: K,
  value: GetMediaConfig<T>[K],
): void {
  ;(item.config as GetMediaConfig<T>)[property] = value
}

/**
 * 类型守卫：检查关键帧属性是否包含指定属性
 */
export function hasKeyframeProperty<T extends MediaType>(
  properties: GetKeyframeProperties<T>,
  property: keyof GetKeyframeProperties<T>,
): boolean {
  return property in properties
}

/**
 * 类型安全的关键帧属性访问器
 */
export function getKeyframeProperty<T extends MediaType, K extends keyof GetKeyframeProperties<T>>(
  properties: GetKeyframeProperties<T>,
  property: K,
): GetKeyframeProperties<T>[K] {
  return properties[property]
}

/**
 * 类型安全的关键帧属性设置器
 */
export function setKeyframeProperty<T extends MediaType, K extends keyof GetKeyframeProperties<T>>(
  properties: GetKeyframeProperties<T>,
  property: K,
  value: GetKeyframeProperties<T>[K],
): void {
  properties[property] = value
}

// ==================== 关键帧动画系统类型 ====================

/**
 * 基础可动画属性（所有媒体类型共享）
 */
interface BaseAnimatableProps {
  zIndex: number
}

/**
 * 视觉可动画属性（video 和 image 共享）
 */
export interface VisualAnimatableProps extends BaseAnimatableProps {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
}

/**
 * 音频可动画属性（video 和 audio 共享）
 */
export interface AudioAnimatableProps extends BaseAnimatableProps {
  volume: number
  // 注意：isMuted 通常不需要动画，但可以考虑添加
}

/**
 * 根据媒体类型的关键帧属性映射
 */
type KeyframePropertiesMap = {
  video: VisualAnimatableProps & AudioAnimatableProps
  image: VisualAnimatableProps
  audio: AudioAnimatableProps
  text: VisualAnimatableProps
}

/**
 * 泛型关键帧属性工具类型
 */
export type GetKeyframeProperties<T extends MediaType> = KeyframePropertiesMap[T]

/**
 * 关键帧属性集合（向后兼容）
 * 统一关键帧系统中每个关键帧包含的所有可动画属性
 */
export interface KeyframeProperties extends VisualAnimatableProps {
  // 保持向后兼容，使用视觉属性作为默认
}

/**
 * 重构后的关键帧接口（类型安全）
 */
export interface Keyframe<T extends MediaType = MediaType> {
  /** 关键帧位置（相对于clip开始的帧数） */
  framePosition: number
  /** 包含所有可动画属性的完整状态 */
  properties: GetKeyframeProperties<T>
}

/**
 * 重构后的动画配置（类型安全）
 */
export interface AnimationConfig<T extends MediaType = MediaType> {
  /** 关键帧数组 */
  keyframes: Keyframe<T>[]
  /** 是否启用动画 */
  isEnabled: boolean
  /** 缓动函数（预留） */
  easing?: string
}

/**
 * 关键帧按钮状态
 */
export type KeyframeButtonState = 'none' | 'on-keyframe' | 'between-keyframes'

/**
 * 关键帧UI状态
 */
export interface KeyframeUIState {
  /** 是否有动画 */
  hasAnimation: boolean
  /** 当前帧是否在关键帧位置 */
  isOnKeyframe: boolean
}

/**
 * WebAV动画配置格式
 * 用于转换给WebAV的setAnimation接口
 */
export interface WebAVAnimationConfig {
  /** 关键帧配置 { '0%': { x: 100, y: 100 }, '50%': { x: 200, y: 200 } } */
  keyframes: Record<string, Record<string, number>>
  /** 动画选项 */
  options: {
    /** 动画时长（微秒） */
    duration: number
    /** 迭代次数 */
    iterCount: number
    /** 缓动函数 */
    easing?: string
  }
}

// ==================== 项目管理相关接口 ====================

/**
 * 基础媒体引用接口 - 所有媒体引用的共同基础
 */
export interface BaseMediaReference {
  originalFileName: string
  type: MediaType | 'unknown'
  fileSize: number
  checksum: string
}

/**
 * 本地媒体引用接口 - 继承基础接口，添加本地文件相关属性
 * 扩展支持错误状态持久化
 */
export interface LocalMediaReference extends BaseMediaReference {
  type: MediaType
  storedPath: string // 正常状态：实际存储路径；错误状态：空字符串

  // 新增：状态管理字段
  status?: 'normal' | 'error' // 默认为normal，兼容现有数据

  // 新增：错误状态相关字段（仅当status为error时有值）
  errorType?: 'webav_parse_error' | 'file_load_error' | 'unsupported_format'
  errorMessage?: string
  errorTimestamp?: string

  // 新增：保留原始文件信息用于重试功能
  originalFile?: {
    name: string
    size: number
    type: string
    lastModified: number
  }
}

/**
 * 异步处理媒体引用接口 - 继承基础接口，添加异步处理相关属性
 * 用于项目配置中引用异步处理素材
 */
export interface AsyncProcessingMediaReference extends BaseMediaReference {
  type: 'unknown'
  processingType: AsyncProcessingType
  processingConfig: AsyncProcessingConfig
  expectedDuration: number
  isAsyncProcessingPlaceholder: true
  processingStatus?: AsyncProcessingStatus // 持久化错误状态
  errorMessage?: string // 持久化错误信息
}

/**
 * 激进重构：删除旧的类型别名，强制使用新的命名约定
 *
 * ❌ 删除的类型别名：
 * - MediaReference = LocalMediaReference （强制使用 LocalMediaReference）
 *
 * ✅ 新的类型架构：
 * BaseMediaReference
 *   ├── LocalMediaReference
 *   └── AsyncProcessingMediaReference
 */

/**
 * 项目配置接口（激进重构后支持异步处理素材）
 */
export interface ProjectConfig {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  version: string
  thumbnail?: string
  duration?: string

  // 项目设置
  settings: {
    videoResolution: {
      name: string
      width: number
      height: number
      aspectRatio: string
    }
    frameRate: number
    timelineDurationFrames: number
  }

  // 时间轴数据
  timeline: {
    tracks: any[]
    timelineItems: any[]
    mediaItems: any[]
  }

  // 本地媒体文件引用（包括已转换的异步处理素材）
  localMediaReferences: {
    [mediaId: string]: LocalMediaReference
  }

  // 异步处理媒体引用（仅包括处理中和错误状态的素材，转换完成后会被清理）
  asyncProcessingMediaReferences: {
    [mediaId: string]: AsyncProcessingMediaReference
  }

  // 导出历史
  exports: any[]
}

/**
 * 媒体元数据接口
 */
export interface MediaMetadata {
  // 基础信息
  id: string
  originalFileName: string
  fileSize: number
  mimeType: string
  checksum: string // 文件完整性校验

  // WebAV解析后的核心元数据
  duration?: number // 微秒（视频和音频需要）
  width?: number // 分辨率宽度（视频和图片需要）
  height?: number // 分辨率高度（视频和图片需要）

  // 缩略图信息
  thumbnailPath?: string

  // WebAV Clip重建信息
  clipType: 'MP4Clip' | 'ImgClip' | 'AudioClip'

  // 导入时间戳
  importedAt: string
}

// ==================== 时间重叠检测相关接口 ====================

/**
 * 重叠检测时间范围接口 - 用于时间重叠检测的统一时间范围表示
 */
export interface OverlapTimeRange {
  start: number // 开始时间（帧数）
  end: number // 结束时间（帧数）
}

/**
 * 重叠检测结果
 */
export interface OverlapResult {
  hasOverlap: boolean // 是否有重叠
  overlapStart: number // 重叠开始时间（帧数）
  overlapEnd: number // 重叠结束时间（帧数）
  overlapDuration: number // 重叠时长（帧数）
}

/**
 * 冲突信息 - 用于拖拽预览等场景
 */
export interface ConflictInfo {
  itemId: string
  startTime: number
  endTime: number
  overlapStart: number
  overlapEnd: number
}

// ==================== 关键帧命令相关接口 ====================

/**
 * 关键帧命令执行器接口（激进重构后使用新类型）
 * 定义执行关键帧命令所需的模块依赖
 */
export interface KeyframeCommandExecutor {
  /** 时间轴模块 */
  timelineModule: {
    getTimelineItem: (id: string) => LocalTimelineItem | undefined
  }
  /** WebAV动画管理器 */
  webavAnimationManager: {
    updateWebAVAnimation: (item: LocalTimelineItem) => Promise<void>
  }
  /** 历史记录模块 */
  historyModule: {
    executeCommand: (command: any) => Promise<void>
  }
  /** 播放头控制器 */
  playbackControls: {
    seekTo: (frame: number) => void
  }
}

/**
 * 批量关键帧操作
 * 支持在一个命令中执行多个关键帧操作
 */
export interface BatchKeyframeOperation {
  type: 'create' | 'delete' | 'update' | 'clear' | 'toggle'
  timelineItemId: string
  frame?: number
  property?: string
  value?: any
}

// ==================== 吸附指示器相关接口 ====================

/**
 * 吸附指示器数据接口
 */
export interface SnapIndicatorData {
  // 是否显示指示器
  show: boolean
  // 吸附点信息
  snapPoint?: any // 引用 types/snap.ts 中的 SnapPoint
  // 时间轴宽度
  timelineWidth: number
  // 时间轴容器的偏移量
  timelineOffset?: { x: number; y: number }
  // 是否显示工具提示
  showTooltip?: boolean
  // 指示线高度
  lineHeight?: number
}

// ==================== 自动保存相关接口 ====================

/**
 * 自动保存配置
 */
export interface AutoSaveConfig {
  debounceTime: number // 防抖时间（毫秒）
  throttleTime: number // 节流时间（毫秒）
  maxRetries: number // 最大重试次数
  enabled: boolean // 是否启用自动保存
}

/**
 * 自动保存状态
 */
export interface AutoSaveState {
  isEnabled: boolean
  lastSaveTime: Date | null
  saveCount: number
  errorCount: number
  isDirty: boolean // 是否有未保存的更改
}

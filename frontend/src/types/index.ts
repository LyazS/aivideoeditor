/**
 * 统一的类型定义文件
 * 将分散在各个文件中的interface定义集中管理
 */

import type { Raw } from 'vue'
import type { MP4Clip, ImgClip, Rect } from '@webav/av-cliper'

// ==================== 基础类型定义 ====================

/**
 * 素材状态枚举
 */
export type MediaStatus = 'parsing' | 'ready' | 'error' | 'missing'

/**
 * 媒体类型 - 添加音频支持
 */
export type MediaType = 'video' | 'image' | 'audio'

/**
 * 轨道类型
 */
export type TrackType = 'video' | 'audio' | 'text'

// ==================== 时间范围接口 ====================

/**
 * 视频时间范围接口定义（帧数版本）
 * 应用层使用帧数进行精确计算，减少浮点数误差
 */
export interface VideoTimeRange {
  /** 素材内部开始时间（帧数） - 从素材的哪个帧开始播放 */
  clipStartTime: number
  /** 素材内部结束时间（帧数） - 播放到素材的哪个帧结束 */
  clipEndTime: number
  /** 时间轴开始时间（帧数） - 素材在整个项目时间轴上的开始位置 */
  timelineStartTime: number
  /** 时间轴结束时间（帧数） - 素材在整个项目时间轴上的结束位置 */
  timelineEndTime: number
  /** 有效播放时长（帧数） - 在时间轴上占用的时长，如果与素材内部时长不同则表示变速 */
  effectiveDuration: number
  /** 播放速度倍率 - 1.0为正常速度，2.0为2倍速，0.5为0.5倍速 */
  playbackRate: number
}

/**
 * 图片时间范围接口定义（帧数版本）
 * 图片没有倍速概念，所以不包含playbackRate
 */
export interface ImageTimeRange {
  /** 时间轴开始时间（帧数） - 图片在整个项目时间轴上的开始位置 */
  timelineStartTime: number
  /** 时间轴结束时间（帧数） - 图片在整个项目时间轴上的结束位置 */
  timelineEndTime: number
  /** 显示时长（帧数） - 图片在时间轴上显示的时长 */
  displayDuration: number
}

/**
 * 音频时间范围接口定义（帧数版本）
 * 音频支持倍速播放，类似视频但没有视觉相关的属性
 */
export interface AudioTimeRange {
  /** 素材内部开始时间（帧数） - 从音频的哪个帧开始播放 */
  clipStartTime: number
  /** 素材内部结束时间（帧数） - 播放到音频的哪个帧结束 */
  clipEndTime: number
  /** 时间轴开始时间（帧数） - 音频在整个项目时间轴上的开始位置 */
  timelineStartTime: number
  /** 时间轴结束时间（帧数） - 音频在整个项目时间轴上的结束位置 */
  timelineEndTime: number
  /** 有效播放时长（帧数） - 在时间轴上占用的时长，如果与音频内部时长不同则表示变速 */
  effectiveDuration: number
  /** 播放速度倍率 - 1.0为正常速度，2.0为2倍速，0.5为0.5倍速 */
  playbackRate: number
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

// ==================== 媒体配置属性分层接口 ====================

/**
 * 基础媒体属性（所有媒体类型共享）
 */
export interface BaseMediaProps {
  /** 层级控制 */
  zIndex: number
  /** 动画配置（可选） - 使用any类型避免循环依赖 */
  animation?: any
}

/**
 * 视觉媒体属性（video 和 image 共享）
 */
export interface VisualMediaProps extends BaseMediaProps {
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
}

/**
 * 音频媒体属性（video 和 audio 共享）
 */
export interface AudioMediaProps {
  /** 音量（0-1） */
  volume: number
  /** 静音状态 */
  isMuted: boolean
  // 预留：音频特效
  // audioEffects?: AudioEffectConfig[]
}

/**
 * 视频媒体配置：同时具有视觉和音频属性
 */
export interface VideoMediaConfig extends VisualMediaProps, AudioMediaProps {
  // 视频特有属性（预留）
  // playbackRate?: number // 倍速可能在 timeRange 中更合适
}

/**
 * 图片媒体配置：只有视觉属性
 */
export interface ImageMediaConfig extends VisualMediaProps {
  // 图片特有属性（预留）
  // filters?: ImageFilterConfig[]
}

/**
 * 音频媒体配置：只有音频属性
 */
export interface AudioMediaConfig extends BaseMediaProps, AudioMediaProps {
  // 音频特有属性（预留）
  // waveformColor?: string
  // showWaveform?: boolean
}

/**
 * 媒体配置映射
 */
export type MediaConfigMap = {
  video: VideoMediaConfig
  image: ImageMediaConfig
  audio: AudioMediaConfig
}

/**
 * 根据媒体类型获取对应配置的工具类型
 */
export type GetMediaConfig<T extends MediaType> = MediaConfigMap[T]

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
  duration: number // 素材时长（帧数）- 视频从HTML video.duration转换而来，图片固定为150帧（5秒@30fps）
  type: string
  mediaType: MediaType
  mp4Clip: Raw<MP4Clip> | null // 视频文件解析中时为null，解析完成后为MP4Clip实例
  imgClip: Raw<ImgClip> | null // 图片文件解析中时为null，解析完成后为ImgClip实例
  isReady: boolean // 是否解析完成
  status: MediaStatus // 素材状态
  thumbnailUrl?: string // WebAV生成的缩略图URL
}

/**
 * 时间轴项目接口（重构版本）
 * 使用泛型支持不同媒体类型的类型安全配置
 */
export interface TimelineItem<T extends MediaType = MediaType> {
  /** 唯一标识符 */
  id: string
  /** 引用MediaItem的ID */
  mediaItemId: string
  /** 轨道ID */
  trackId: string
  /** 媒体类型 */
  mediaType: T
  /** 时间范围信息（根据媒体类型自动推断） */
  timeRange: T extends 'video' ? VideoTimeRange :
            T extends 'audio' ? AudioTimeRange :
            ImageTimeRange
  /** 自定义的sprite */
  sprite: Raw<CustomSprite>
  /** 时间轴clip的缩略图URL */
  thumbnailUrl?: string
  /** 媒体配置（根据类型自动推断） */
  config: GetMediaConfig<T>
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

/**
 * 画布备份接口（重构版本）
 * 画布重新创建时的内容备份 - 只备份元数据，不备份WebAV对象
 */
export interface CanvasBackup {
  timelineItems: Array<TimelineItemData>
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
}

/**
 * 冲突信息接口
 * 用于检测和显示时间轴项目之间的重叠冲突
 */
export interface ConflictInfo {
  itemId: string
  itemName: string
  startTime: number // 开始时间（帧数）
  endTime: number // 结束时间（帧数）
  overlapStart: number // 重叠开始时间（帧数）
  overlapEnd: number // 重叠结束时间（帧数）
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
 * 时间轴项目数据接口（重构版本）
 * 用于命令模式中的数据保存，支持泛型
 */
export interface TimelineItemData<T extends MediaType = MediaType> {
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
  | 'multiple'

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
  timeRange: VideoTimeRange | ImageTimeRange | AudioTimeRange,
): timeRange is VideoTimeRange {
  return (
    'clipStartTime' in timeRange &&
    'clipEndTime' in timeRange &&
    'effectiveDuration' in timeRange &&
    'playbackRate' in timeRange &&
    !('displayDuration' in timeRange)
  )
}

/**
 * 检查时间范围是否为图片时间范围
 * @param timeRange 时间范围对象
 * @returns 是否为图片时间范围
 */
export function isImageTimeRange(
  timeRange: VideoTimeRange | ImageTimeRange | AudioTimeRange,
): timeRange is ImageTimeRange {
  return 'displayDuration' in timeRange && !('clipStartTime' in timeRange)
}

/**
 * 检查时间范围是否为音频时间范围
 * @param timeRange 时间范围对象
 * @returns 是否为音频时间范围
 */
export function isAudioTimeRange(
  timeRange: VideoTimeRange | ImageTimeRange | AudioTimeRange,
): timeRange is AudioTimeRange {
  return (
    'clipStartTime' in timeRange &&
    'clipEndTime' in timeRange &&
    'effectiveDuration' in timeRange &&
    'playbackRate' in timeRange &&
    !('displayDuration' in timeRange)
  )
}

/**
 * 检查时间轴项目是否为视频类型
 * @param item 时间轴项目
 * @returns 是否为视频类型
 */
export function isVideoTimelineItem(
  item: TimelineItem,
): item is TimelineItem<'video'> {
  return item.mediaType === 'video' && isVideoTimeRange(item.timeRange as any)
}

/**
 * 检查时间轴项目是否为图片类型
 * @param item 时间轴项目
 * @returns 是否为图片类型
 */
export function isImageTimelineItem(
  item: TimelineItem,
): item is TimelineItem<'image'> {
  return item.mediaType === 'image' && isImageTimeRange(item.timeRange as any)
}

/**
 * 检查时间轴项目是否为音频类型
 * @param item 时间轴项目
 * @returns 是否为音频类型
 */
export function isAudioTimelineItem(
  item: TimelineItem,
): item is TimelineItem<'audio'> {
  return item.mediaType === 'audio' && isAudioTimeRange(item.timeRange as any)
}

// ==================== 自定义 Sprite 类型 ====================

// 导入我们的自定义 Sprite 类
import type { VideoVisibleSprite } from '../utils/VideoVisibleSprite'
import type { ImageVisibleSprite } from '../utils/ImageVisibleSprite'

/**
 * 自定义 Sprite 联合类型
 * 表示我们扩展的 VideoVisibleSprite 或 ImageVisibleSprite
 */
export type CustomSprite = VideoVisibleSprite | ImageVisibleSprite

// ==================== 关键帧动画系统类型（重构版本） ====================

/**
 * 基础可动画属性（所有媒体类型共享）
 */
export interface BaseAnimatableProps {
  /** 层级控制 */
  zIndex: number
}

/**
 * 视觉可动画属性（video 和 image 共享）
 */
export interface VisualAnimatableProps extends BaseAnimatableProps {
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
}

/**
 * 音频可动画属性（video 和 audio 共享）
 */
export interface AudioAnimatableProps extends BaseAnimatableProps {
  /** 音量（0-1） */
  volume: number
  // 注意：isMuted 通常不需要动画，但可以考虑添加
}

/**
 * 根据媒体类型的关键帧属性映射
 */
export type KeyframePropertiesMap = {
  video: VisualAnimatableProps & AudioAnimatableProps
  image: VisualAnimatableProps
  audio: AudioAnimatableProps
}

/**
 * 泛型关键帧属性工具类型
 */
export type GetKeyframeProperties<T extends MediaType> = KeyframePropertiesMap[T]

/**
 * 关键帧数据结构（重构版本）
 * 支持不同媒体类型的可动画属性
 */
export interface Keyframe<T extends MediaType = MediaType> {
  /** 关键帧位置（相对于clip开始的帧数） */
  framePosition: number
  /** 包含该媒体类型可动画属性的完整状态 */
  properties: GetKeyframeProperties<T>
}

/**
 * 动画配置（重构版本）
 * 支持不同媒体类型的关键帧
 */
export interface AnimationConfig<T extends MediaType = MediaType> {
  /** 关键帧数组 */
  keyframes: Keyframe<T>[]
  /** 是否启用动画 */
  isEnabled: boolean
  /** 缓动函数（预留） */
  easing?: string
}

// ==================== 向后兼容的类型别名 ====================

/**
 * 关键帧属性集合（向后兼容）
 * @deprecated 使用 GetKeyframeProperties<'video'> 或 VisualAnimatableProps 替代
 */
export type KeyframeProperties = VisualAnimatableProps

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

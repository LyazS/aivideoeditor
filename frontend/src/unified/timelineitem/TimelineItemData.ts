/**
 * 统一时间轴项目数据类型定义（混合类型系统重构版）
 * 基于"类型安全 + 动态类型支持"的改进方案
 *
 * 设计理念：
 * - 使用泛型确保编译时类型安全
 * - 支持媒体类型动态变化（unknown -> 具体类型）
 * - 保持与旧架构相同的精确性
 * - 通过联合类型和类型守卫处理运行时类型检查
 */

import type { Raw } from 'vue'
import type { MediaType, MediaTypeOrUnknown } from '../mediaitem'
import type {
  BaseTimeRange,
  VideoTimeRange,
  ImageTimeRange,
  CustomSprite,
  GetMediaConfig,
  VideoMediaConfig,
  ImageMediaConfig,
  AudioMediaConfig,
  TextMediaConfig,
} from '../../types'

// ==================== 基础类型定义 ====================

/**
 * 时间轴项目状态类型 - 3状态简化版
 */
export type TimelineItemStatus =
  | 'ready' // 完全就绪，可用于时间轴
  | 'loading' // 正在处理中，包含下载、解析、等待
  | 'error' // 不可用状态，包含错误、缺失、取消



/**
 * 状态转换规则定义
 */
export const VALID_TIMELINE_TRANSITIONS: Record<TimelineItemStatus, TimelineItemStatus[]> = {
  loading: ['ready', 'error'],
  ready: ['loading', 'error'],
  error: ['loading'],
} as const

/**
 * 媒体状态到时间轴状态的映射表
 */
export const MEDIA_TO_TIMELINE_STATUS_MAP = {
  pending: 'loading', // 等待开始 → 加载中
  asyncprocessing: 'loading', // 异步处理中 → 加载中
  webavdecoding: 'loading', // WebAV解析中 → 加载中
  ready: 'ready', // 就绪 → 就绪
  error: 'error', // 错误 → 错误
  cancelled: 'error', // 已取消 → 错误
  missing: 'error', // 文件缺失 → 错误
} as const

// ==================== 时间范围类型映射 ====================

/**
 * 根据媒体类型获取对应的时间范围类型
 */
export type GetTimeRange<T extends MediaTypeOrUnknown> = T extends 'video'
  ? VideoTimeRange
  : T extends 'audio'
    ? VideoTimeRange
    : T extends 'image'
      ? ImageTimeRange
      : T extends 'text'
        ? ImageTimeRange
        : T extends 'unknown'
          ? BaseTimeRange
          : BaseTimeRange

// ==================== 配置类型映射 ====================

/**
 * 变换数据接口（保持兼容性）
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
 * 未知媒体类型的基础配置
 */
export interface UnknownMediaConfig {
  name: string
  expectedDuration?: number
  transform?: Partial<TransformData>
}

/**
 * 扩展的媒体配置映射（包含unknown类型）
 */
type ExtendedMediaConfigMap = {
  video: VideoMediaConfig
  image: ImageMediaConfig
  audio: AudioMediaConfig
  text: TextMediaConfig
  unknown: UnknownMediaConfig
}

/**
 * 根据媒体类型获取对应配置的工具类型
 */
export type GetExtendedMediaConfig<T extends MediaTypeOrUnknown> = ExtendedMediaConfigMap[T]

// ==================== 核心接口设计 ====================

/**
 * 统一时间轴项目数据接口（泛型版本）
 *
 * 设计特点：
 * 1. 使用泛型确保类型安全
 * 2. 支持媒体类型动态变化
 * 3. 保持与旧架构相同的精确性
 * 4. 纯数据对象，使用 reactive() 包装
 */
export interface UnifiedTimelineItemData<T extends MediaTypeOrUnknown = MediaTypeOrUnknown> {
  // ==================== 核心属性 ====================
  readonly id: string
  mediaItemId: string // 关联的统一媒体项目ID
  trackId?: string

  // ==================== 状态管理 ====================
  timelineStatus: TimelineItemStatus // 仅3状态：ready|loading|error

  // ==================== 媒体信息 ====================
  mediaType: T

  // ==================== 时间范围（类型安全） ====================
  timeRange: GetTimeRange<T>

  // ==================== 配置（类型安全） ====================
  config: GetExtendedMediaConfig<T>

  // ==================== Sprite引用 ====================
  sprite?: Raw<CustomSprite> // 直接持有Sprite引用，与时间轴项目生命周期一致
}

// ==================== 联合类型定义 ====================

/**
 * 已知媒体类型的时间轴项目（类型安全）
 */
export type KnownTimelineItem =
  | UnifiedTimelineItemData<'video'>
  | UnifiedTimelineItemData<'image'>
  | UnifiedTimelineItemData<'audio'>
  | UnifiedTimelineItemData<'text'>

/**
 * 未知媒体类型的时间轴项目（异步处理中）
 */
export type UnknownTimelineItem = UnifiedTimelineItemData<'unknown'>



// ==================== 工厂函数选项类型 ====================

/**
 * 创建已知媒体类型时间轴项目的选项
 */
export interface CreateKnownTimelineItemOptions<T extends MediaType> {
  mediaItemId: string
  trackId?: string
  mediaType: T
  timeRange: GetTimeRange<T>
  config: GetExtendedMediaConfig<T>
  initialStatus?: TimelineItemStatus
}

/**
 * 创建未知媒体类型时间轴项目的选项
 */
export interface CreateUnknownTimelineItemOptions {
  mediaItemId: string
  trackId?: string
  timeRange: BaseTimeRange
  config: UnknownMediaConfig
  initialStatus?: TimelineItemStatus
}

/**
 * 通用创建选项（向后兼容）
 */
export interface CreateTimelineItemOptions {
  mediaItemId: string
  trackId?: string
  timeRange: BaseTimeRange
  config: UnknownMediaConfig
  mediaType?: MediaTypeOrUnknown
  initialStatus?: TimelineItemStatus
}

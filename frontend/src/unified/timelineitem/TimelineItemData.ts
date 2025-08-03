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
import type { UnifiedTimeRange } from '../types/timeRange'
// ==================== 从 types/index.ts 复制的类型定义 ====================

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
 * 基础媒体属性（所有媒体类型共享）
 */
interface BaseMediaProps<T extends MediaType = MediaType> {
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
  // 视频特有属性（预留）
  // playbackRate?: number // 倍速可能在 timeRange 中更合适
}

/**
 * 图片媒体配置：只有视觉属性
 */
export interface ImageMediaConfig extends VisualMediaProps<'image'> {
  // 图片特有属性（预留）
  // filters?: ImageFilterConfig[]
}

/**
 * 音频媒体配置：只有音频属性
 */
export interface AudioMediaConfig extends BaseMediaProps<'audio'>, AudioMediaProps {
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

// 导入我们的自定义 Sprite 类
import type { UnifiedSprite } from '../visiblesprite'

// ==================== 基础类型定义 ====================

/**
 * 时间轴项目状态类型 - 3状态简化版
 */
export type TimelineItemStatus =
  | 'ready' // 完全就绪，可用于时间轴
  | 'loading' // 正在处理中，包含下载、解析、等待
  | 'error' // 不可用状态，包含错误、缺失、取消

// ==================== 动画系统类型定义 ====================

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
 * 时间轴项目配置映射（包含unknown类型）
 * 区别于媒体项目配置，这是时间轴项目级别的配置
 */
type TimelineItemConfigMap = {
  video: VideoMediaConfig
  image: ImageMediaConfig
  audio: AudioMediaConfig
  text: TextMediaConfig
  unknown: UnknownMediaConfig
}

/**
 * 根据媒体类型获取对应时间轴项目配置的工具类型
 */
export type GetTimelineItemConfig<T extends MediaTypeOrUnknown> = TimelineItemConfigMap[T]

// ==================== 核心接口设计 ====================

/**
 * 统一时间轴项目数据接口（泛型版本）
 *
 * 设计特点：
 * 1. 使用泛型确保类型安全
 * 2. 支持媒体类型动态变化
 * 3. 保持与旧架构相同的精确性
 * 4. 纯数据对象，使用 reactive() 包装
 * 5. 除sprite之外都可以持久化保存
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

  // ==================== 时间范围 ====================
  timeRange: UnifiedTimeRange

  // ==================== 配置（类型安全） ====================
  config: GetTimelineItemConfig<T>

  // ==================== 动画配置（类型安全） ====================
  animation?: T extends MediaType ? AnimationConfig<T> : undefined

  // ==================== Sprite引用 缩略图 ====================
  // 注意一个要点：sprite和thumbnailUrl总是放在command里边管理
  sprite?: Raw<UnifiedSprite> // 直接持有Sprite引用，与时间轴项目生命周期一致
  thumbnailUrl?: string
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
  timeRange: UnifiedTimeRange
  config: GetTimelineItemConfig<T>
  initialStatus?: TimelineItemStatus
}

/**
 * 创建未知媒体类型时间轴项目的选项
 */
export interface CreateUnknownTimelineItemOptions {
  mediaItemId: string
  trackId?: string
  timeRange: UnifiedTimeRange
  config: UnknownMediaConfig
  initialStatus?: TimelineItemStatus
}

/**
 * 通用创建选项（向后兼容）
 */
export interface CreateTimelineItemOptions {
  mediaItemId: string
  trackId?: string
  timeRange: UnifiedTimeRange
  config: UnknownMediaConfig
  mediaType?: MediaTypeOrUnknown
  initialStatus?: TimelineItemStatus
}

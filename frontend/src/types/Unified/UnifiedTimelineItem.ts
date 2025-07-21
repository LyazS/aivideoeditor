/**
 * 统一时间轴项目类型设计
 * 
 * 基于统一媒体类型设计，将LocalTimelineItem和AsyncProcessingTimelineItem
 * 统一为单一的UnifiedTimelineItem，采用状态驱动的设计模式，
 * 实现时间轴项目的自动化生命周期管理
 */

import type { Raw } from 'vue'
import type { MediaType, TransitionContext } from './UnifiedMediaItem'

// ==================== 基础类型定义 ====================

/**
 * 统一时间轴项目状态 - 基于实际业务场景的三元模型
 * 
 * 设计哲学：从"状态驱动一切"到"状态作为基础，上下文承载细节"
 */
export type TimelineItemStatus = 
  | 'ready'    // 完全就绪，可用于时间轴
  | 'loading'  // 正在处理中，包含下载、解析、等待
  | 'error'    // 不可用状态，包含错误、缺失、取消

/**
 * 时间轴项目状态上下文 - 承载当前状态的详细信息和UI展示数据
 */
export interface TimelineStatusContext {
  stage: string           // 当前阶段标识
  message: string         // 用户友好的状态描述
  progress?: number       // 进度百分比 (0-100)
  canRetry?: boolean      // 是否可以重试
  canCancel?: boolean     // 是否可以取消
  errorCode?: string      // 错误代码
  estimatedTime?: number  // 预估剩余时间(ms)
  metadata?: Record<string, any> // 其他元数据
}

// ==================== 时间范围接口 ====================

/**
 * 基础时间范围接口
 */
export interface TimeRange {
  timelineStartTime: number // 时间轴开始时间（帧数）
  timelineEndTime: number   // 时间轴结束时间（帧数）
}

// ==================== 媒体配置类型 ====================

/**
 * 基础视觉媒体属性
 */
export interface VisualMediaProps {
  x: number
  y: number
  w: number
  h: number
  angle: number
  opacity: number
  zIndex: number
}

/**
 * 视频媒体配置
 */
export interface VideoMediaConfig extends VisualMediaProps {
  volume: number
  isMuted: boolean
  thumbnailUrl?: string
}

/**
 * 图片媒体配置
 */
export interface ImageMediaConfig extends VisualMediaProps {
  thumbnailUrl?: string
}

/**
 * 音频媒体配置
 */
export interface AudioMediaConfig {
  volume: number
  isMuted: boolean
}

/**
 * 文本媒体配置
 */
export interface TextMediaConfig extends VisualMediaProps {
  text: string
  fontSize: number
  fontFamily: string
  fontWeight: string
  color: string
  backgroundColor?: string
  textAlign: 'left' | 'center' | 'right'
  lineHeight?: number
}

/**
 * 获取媒体配置类型的泛型工具
 */
export type GetMediaConfig<T extends MediaType> = 
  T extends 'video' ? VideoMediaConfig :
  T extends 'image' ? ImageMediaConfig :
  T extends 'audio' ? AudioMediaConfig :
  T extends 'text' ? TextMediaConfig :
  never

/**
 * 动画配置接口（简化版）
 */
export interface AnimationConfig<T extends MediaType> {
  type: string
  duration: number
  easing?: string
  keyframes?: any[]
}

/**
 * 统一的基础配置 - 静态配置信息
 */
export interface BasicTimelineConfig {
  name: string                           // 显示名称
  mediaConfig: GetMediaConfig<MediaType> // 媒体配置（变换、音量、缩略图等参数）
  animation?: AnimationConfig<MediaType> // 可选动画配置
}

// ==================== 精灵相关类型 ====================

/**
 * 自定义精灵接口（简化版）
 */
export interface CustomSprite {
  id: string
  visible: boolean
  destroy(): void
  update(props: any): void
}

/**
 * 扩展的属性变化事件类型
 */
export type ExtendedPropsChangeEvent = Partial<{
  rect: Partial<{ x: number; y: number; w: number; h: number; angle: number }>
  zIndex: number
  opacity: number
  textUpdate?: {
    text: string
    style: any
    needsRecreation: boolean
  }
}>

// ==================== 统一时间轴项目接口 ====================

/**
 * 统一的时间轴项目接口 - 3状态极简核心 + 上下文扩展
 * 
 * 核心设计理念：
 * - 状态驱动的统一架构：将"本地"和"异步"从类型区分改为状态区分
 * - 三层状态映射：数据源状态 → 媒体项目状态 → 时间轴项目状态
 * - 自动化的Sprite生命周期管理
 */
export interface UnifiedTimelineItem {
  // ==================== 类型标识 ====================
  readonly __type__: 'UnifiedTimelineItem'

  // ==================== 核心属性 ====================
  id: string
  mediaItemId: string // 关联的统一媒体项目ID
  trackId?: string
  
  // ==================== 状态管理 ====================
  timelineStatus: TimelineItemStatus // 仅3状态：ready|loading|error
  
  // ==================== 状态上下文 - 动态状态信息 ====================
  statusContext?: TimelineStatusContext // 承载当前状态的详细信息和UI展示数据
  
  // ==================== 媒体信息 ====================
  mediaType: MediaType | 'unknown' // 从关联的媒体项目同步
  
  // ==================== 时间范围 ====================
  timeRange: TimeRange
  
  // ==================== 统一配置 ====================
  config: BasicTimelineConfig // 统一基础配置，取消占位符/准备中分离
  
  // ==================== 精灵对象 ====================
  sprite?: Raw<CustomSprite> // ready状态可用
  
  // ==================== 状态机方法 ====================
  
  /**
   * 状态转换 - 统一3状态驱动
   * @param newStatus ready|loading|error
   * @param context 详细的阶段信息和展示文案
   */
  transitionTo(newStatus: TimelineItemStatus, context?: TimelineStatusContext): void
  
  /**
   * 检查3状态的合法性
   */
  canTransitionTo(newStatus: TimelineItemStatus): boolean

  /**
   * 状态转换钩子
   */
  onStatusChanged?(oldStatus: TimelineItemStatus, newStatus: TimelineItemStatus, context?: TimelineStatusContext): void

  // ==================== 查询方法 ====================

  /**
   * 是否已就绪
   */
  isReady(): boolean

  /**
   * 是否正在加载中
   */
  isLoading(): boolean

  /**
   * 是否有错误
   */
  hasError(): boolean

  /**
   * 获取当前状态描述
   */
  getStatusMessage(): string

  /**
   * 获取进度（如果有）
   */
  getProgress(): number | undefined

  /**
   * 是否可以重试
   */
  canRetry(): boolean

  /**
   * 是否可以取消
   */
  canCancel(): boolean
}

// ==================== 状态转换规则 ====================

/**
 * 极简3状态转换规则 - 基于真实业务场景
 *
 * 原6状态24种转换 -> 简化到9种转换
 * 所有中间状态都通过TimelineStatusContext表达
 */
export const VALID_TIMELINE_TRANSITIONS: Record<TimelineItemStatus, TimelineItemStatus[]> = {
  'loading': ['ready', 'error'],  // loading完成后变为就绪或错误
  'ready': ['loading', 'error'],  // 重新处理或出错
  'error': ['loading', 'ready']   // 重试或恢复
}

/**
 * 验证时间轴项目状态转换是否合法
 */
export function isValidTimelineTransition(from: TimelineItemStatus, to: TimelineItemStatus): boolean {
  return VALID_TIMELINE_TRANSITIONS[from]?.includes(to) ?? false
}

// ==================== 状态映射 ====================

/**
 * 媒体状态到时间轴状态的映射
 */
export const MEDIA_TO_TIMELINE_STATUS_MAP = {
  'pending': 'loading',           // 等待开始处理
  'asyncprocessing': 'loading',   // 下载/获取中（显示下载进度）
  'webavdecoding': 'loading',     // 解析中（显示"解析中..."文案）
  'ready': 'ready',               // 完全就绪
  'error': 'error',               // 各种错误状态
  'cancelled': 'error',           // 用户取消
  'missing': 'error'              // 文件缺失
} as const

/**
 * 将媒体状态映射到时间轴状态
 */
export function mapMediaStatusToTimelineStatus(mediaStatus: string): TimelineItemStatus {
  return MEDIA_TO_TIMELINE_STATUS_MAP[mediaStatus as keyof typeof MEDIA_TO_TIMELINE_STATUS_MAP] || 'error'
}

// ==================== 工厂函数 ====================

/**
 * 创建统一时间轴项目的选项
 */
export interface CreateUnifiedTimelineItemOptions {
  id: string
  mediaItemId: string
  trackId?: string
  mediaType: MediaType | 'unknown'
  timeRange: TimeRange
  config: BasicTimelineConfig
  onStatusChanged?: (oldStatus: TimelineItemStatus, newStatus: TimelineItemStatus, context?: TimelineStatusContext) => void
}

/**
 * 时间轴项目创建工厂函数
 */
export function createUnifiedTimelineItem(options: CreateUnifiedTimelineItemOptions): UnifiedTimelineItem {
  const {
    id,
    mediaItemId,
    trackId,
    mediaType,
    timeRange,
    config,
    onStatusChanged
  } = options

  const timelineItem: UnifiedTimelineItem = {
    __type__: 'UnifiedTimelineItem',
    id,
    mediaItemId,
    trackId,
    timelineStatus: 'loading', // 初始状态为loading
    mediaType,
    timeRange,
    config,

    // 状态机方法实现
    transitionTo(newStatus: TimelineItemStatus, context?: TimelineStatusContext): void {
      if (!this.canTransitionTo(newStatus)) {
        throw new Error(`Invalid timeline transition from ${this.timelineStatus} to ${newStatus}`)
      }

      const oldStatus = this.timelineStatus
      this.timelineStatus = newStatus
      this.statusContext = context

      // 触发状态变化钩子
      this.onStatusChanged?.(oldStatus, newStatus, context)
    },

    canTransitionTo(newStatus: TimelineItemStatus): boolean {
      return isValidTimelineTransition(this.timelineStatus, newStatus)
    },

    onStatusChanged,

    // 查询方法实现
    isReady(): boolean {
      return this.timelineStatus === 'ready'
    },

    isLoading(): boolean {
      return this.timelineStatus === 'loading'
    },

    hasError(): boolean {
      return this.timelineStatus === 'error'
    },

    getStatusMessage(): string {
      return this.statusContext?.message || this.timelineStatus
    },

    getProgress(): number | undefined {
      return this.statusContext?.progress
    },

    canRetry(): boolean {
      return this.statusContext?.canRetry ?? false
    },

    canCancel(): boolean {
      return this.statusContext?.canCancel ?? false
    }
  }

  return timelineItem
}

// ==================== 辅助函数 ====================

/**
 * 创建状态上下文的辅助函数
 */
export function createTimelineStatusContext(
  stage: string,
  message: string,
  options?: Partial<TimelineStatusContext>
): TimelineStatusContext {
  return {
    stage,
    message,
    ...options
  }
}

/**
 * 创建加载状态上下文
 */
export function createLoadingContext(
  stage: string,
  message: string,
  progress?: number,
  canCancel = false
): TimelineStatusContext {
  return createTimelineStatusContext(stage, message, {
    progress,
    canCancel
  })
}

/**
 * 创建错误状态上下文
 */
export function createErrorContext(
  message: string,
  errorCode?: string,
  canRetry = true
): TimelineStatusContext {
  return createTimelineStatusContext('error', message, {
    errorCode,
    canRetry
  })
}

/**
 * 创建就绪状态上下文
 */
export function createReadyContext(message = '已就绪'): TimelineStatusContext {
  return createTimelineStatusContext('ready', message)
}

// ==================== 类型守卫函数 ====================

/**
 * 检查是否为统一时间轴项目
 */
export function isUnifiedTimelineItem(item: any): item is UnifiedTimelineItem {
  return item && item.__type__ === 'UnifiedTimelineItem'
}

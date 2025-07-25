/**
 * 统一时间轴项目查询函数
 * 提供无状态的查询和验证功能
 */

import type {
  UnifiedTimelineItem,
  TimelineItemStatus,
  TimelineStatusContext,
  DownloadContext,
  ParseContext,
  ProcessingContext,
  ReadyContext,
  ErrorContext,
  ProgressExtension
} from './types'
import { VALID_TIMELINE_TRANSITIONS } from './types'

// ==================== 状态查询函数 ====================

/**
 * 统一时间轴项目查询函数 - 无状态查询函数
 */
export const UnifiedTimelineItemQueries = {
  // ==================== 基础状态检查 ====================
  
  /**
   * 检查是否为加载中状态
   */
  isLoading(item: UnifiedTimelineItem): boolean {
    return item.timelineStatus === 'loading'
  },

  /**
   * 检查是否为就绪状态
   */
  isReady(item: UnifiedTimelineItem): boolean {
    return item.timelineStatus === 'ready'
  },

  /**
   * 检查是否为错误状态
   */
  hasError(item: UnifiedTimelineItem): boolean {
    return item.timelineStatus === 'error'
  },

  /**
   * 检查是否可用（就绪状态且有sprite）
   */
  isAvailable(item: UnifiedTimelineItem): boolean {
    return item.timelineStatus === 'ready' && !!item.sprite
  },

  /**
   * 检查是否正在处理中（加载状态）
   */
  isProcessing(item: UnifiedTimelineItem): boolean {
    return item.timelineStatus === 'loading'
  },

  // ==================== 状态转换验证 ====================

  /**
   * 检查是否可以转换到指定状态
   */
  canTransitionTo(item: UnifiedTimelineItem, newStatus: TimelineItemStatus): boolean {
    const validTransitions = VALID_TIMELINE_TRANSITIONS[item.timelineStatus]
    return validTransitions?.includes(newStatus) || false
  },

  /**
   * 检查是否可以重试
   */
  canRetry(item: UnifiedTimelineItem): boolean {
    return item.timelineStatus === 'error' && 
           this.canTransitionTo(item, 'loading')
  },

  /**
   * 检查是否可以取消
   */
  canCancel(item: UnifiedTimelineItem): boolean {
    return item.timelineStatus === 'loading'
  },

  // ==================== 上下文信息查询 ====================

  /**
   * 获取当前进度信息
   */
  getProgress(item: UnifiedTimelineItem): number | undefined {
    if (!item.statusContext || !('progress' in item.statusContext)) {
      return undefined
    }
    return item.statusContext.progress.percent
  },

  /**
   * 获取当前状态消息
   */
  getStatusMessage(item: UnifiedTimelineItem): string {
    return item.statusContext?.message || this.getDefaultStatusMessage(item.timelineStatus)
  },

  /**
   * 获取错误信息
   */
  getError(item: UnifiedTimelineItem): { code: string; message: string; recoverable: boolean } | undefined {
    if (!item.statusContext || !('error' in item.statusContext)) {
      return undefined
    }
    return item.statusContext.error
  },

  /**
   * 检查错误是否可恢复
   */
  isErrorRecoverable(item: UnifiedTimelineItem): boolean {
    const error = this.getError(item)
    return error?.recoverable || false
  },

  // ==================== 媒体信息查询 ====================

  /**
   * 获取媒体类型
   */
  getMediaType(item: UnifiedTimelineItem): string {
    return item.mediaType
  },

  /**
   * 检查是否为已知媒体类型
   */
  hasKnownMediaType(item: UnifiedTimelineItem): boolean {
    return item.mediaType !== 'unknown'
  },

  /**
   * 获取时间范围信息
   */
  getTimeRange(item: UnifiedTimelineItem): { start: number; end: number; duration: number } {
    const { timelineStartTime, timelineEndTime } = item.timeRange
    return {
      start: timelineStartTime,
      end: timelineEndTime,
      duration: timelineEndTime - timelineStartTime
    }
  },

  /**
   * 获取显示名称
   */
  getDisplayName(item: UnifiedTimelineItem): string {
    return item.config.name
  },

  // ==================== Sprite相关查询 ====================

  /**
   * 检查是否有可用的Sprite
   */
  hasSprite(item: UnifiedTimelineItem): boolean {
    return !!item.sprite
  },

  /**
   * 检查Sprite是否应该存在（ready状态应该有sprite）
   */
  shouldHaveSprite(item: UnifiedTimelineItem): boolean {
    return item.timelineStatus === 'ready'
  },

  /**
   * 检查Sprite状态是否正常
   */
  isSpriteStateValid(item: UnifiedTimelineItem): boolean {
    if (item.timelineStatus === 'ready') {
      return !!item.sprite
    } else {
      return !item.sprite
    }
  },

  // ==================== 动画相关查询 ====================

  /**
   * 检查是否有动画配置
   */
  hasAnimation(item: UnifiedTimelineItem): boolean {
    return !!item.config.animation && item.config.animation.isEnabled
  },

  /**
   * 获取关键帧数量
   */
  getKeyframeCount(item: UnifiedTimelineItem): number {
    return item.config.animation?.keyframes.length || 0
  },

  // ==================== 工具函数 ====================

  /**
   * 获取默认状态消息
   */
  getDefaultStatusMessage(status: TimelineItemStatus): string {
    switch (status) {
      case 'loading':
        return '正在处理...'
      case 'ready':
        return '已就绪'
      case 'error':
        return '发生错误'
      default:
        return '未知状态'
    }
  },

  /**
   * 获取状态的中文描述
   */
  getStatusDisplayText(status: TimelineItemStatus): string {
    switch (status) {
      case 'loading':
        return '加载中'
      case 'ready':
        return '就绪'
      case 'error':
        return '错误'
      default:
        return '未知'
    }
  },

  /**
   * 检查两个时间轴项目是否在时间上重叠
   */
  isTimeOverlapping(item1: UnifiedTimelineItem, item2: UnifiedTimelineItem): boolean {
    const range1 = this.getTimeRange(item1)
    const range2 = this.getTimeRange(item2)
    
    return !(range1.end <= range2.start || range2.end <= range1.start)
  },

  /**
   * 检查时间轴项目是否在指定时间点激活
   */
  isActiveAtTime(item: UnifiedTimelineItem, time: number): boolean {
    const { start, end } = this.getTimeRange(item)
    return time >= start && time < end
  },

  /**
   * 获取项目在指定时间的相对位置（0-1）
   */
  getRelativePositionAtTime(item: UnifiedTimelineItem, time: number): number {
    const { start, duration } = this.getTimeRange(item)
    if (duration === 0) return 0

    const relativeTime = time - start
    return Math.max(0, Math.min(1, relativeTime / duration))
  }
}

// ==================== 状态上下文类型守卫工具函数 ====================

/**
 * 类型守卫和工具函数
 */
export const TimelineContextUtils = {
  /**
   * 检查是否为下载上下文
   */
  isDownloading: (ctx: TimelineStatusContext): ctx is DownloadContext =>
    ctx.stage === 'downloading',

  /**
   * 检查是否为解析上下文
   */
  isParsing: (ctx: TimelineStatusContext): ctx is ParseContext =>
    ctx.stage === 'parsing',

  /**
   * 检查是否为处理上下文
   */
  isProcessing: (ctx: TimelineStatusContext): ctx is ProcessingContext =>
    ctx.stage === 'processing',

  /**
   * 检查是否有进度信息
   */
  hasProgress: (ctx: TimelineStatusContext): ctx is TimelineStatusContext & ProgressExtension =>
    'progress' in ctx,

  /**
   * 检查是否为错误状态
   */
  hasError: (ctx: TimelineStatusContext): ctx is ErrorContext =>
    ctx.stage === 'error',

  /**
   * 检查是否为就绪状态
   */
  isReady: (ctx: TimelineStatusContext): ctx is ReadyContext =>
    ctx.stage === 'ready'
}

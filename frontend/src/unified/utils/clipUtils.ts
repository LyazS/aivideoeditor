/**
 * 统一Clip架构相关工具函数
 */

import type { UnifiedTimelineItemData, TimelineItemStatus } from '@/unified/timelineitem/TimelineItemData'
import type { MediaType } from '@/unified/mediaitem'

// ==================== 状态判断工具 ====================

/**
 * 检查时间轴项目是否处于加载状态
 */
export function isTimelineItemLoading(data: UnifiedTimelineItemData<MediaType>): boolean {
  return data.timelineStatus === 'loading'
}

/**
 * 检查时间轴项目是否处于错误状态
 */
export function isTimelineItemError(data: UnifiedTimelineItemData<MediaType>): boolean {
  return data.timelineStatus === 'error'
}

/**
 * 检查时间轴项目是否就绪
 */
export function isTimelineItemReady(data: UnifiedTimelineItemData<MediaType>): boolean {
  return data.timelineStatus === 'ready'
}

/**
 * 检查时间轴项目是否为未知媒体类型
 * 注意：由于类型约束，现在总是返回 false
 */
export function isUnknownMediaType(data: UnifiedTimelineItemData<MediaType>): boolean {
  return false // 由于类型约束，不再有 unknown 类型
}

/**
 * 检查时间轴项目是否为已知媒体类型
 * 注意：由于类型约束，现在总是返回 true
 */
export function isKnownMediaType(data: UnifiedTimelineItemData<MediaType>): boolean {
  return true // 由于类型约束，都是已知类型
}

// ==================== 类型判断工具 ====================

/**
 * 检查是否为视频类型
 */
export function isVideoType(mediaType: MediaType): boolean {
  return mediaType === 'video'
}

/**
 * 检查是否为图片类型
 */
export function isImageType(mediaType: MediaType): boolean {
  return mediaType === 'image'
}

/**
 * 检查是否为音频类型
 */
export function isAudioType(mediaType: MediaType): boolean {
  return mediaType === 'audio'
}

/**
 * 检查是否为文本类型
 */
export function isTextType(mediaType: MediaType): boolean {
  return mediaType === 'text'
}

/**
 * 检查是否为视觉媒体类型（视频或图片）
 */
export function isVisualMediaType(mediaType: MediaType): boolean {
  return mediaType === 'video' || mediaType === 'image'
}

// ==================== 状态优先级工具 ====================

/**
 * 状态优先级映射
 */
const STATUS_PRIORITY: Record<TimelineItemStatus, number> = {
  error: 0, // 最高优先级，需要用户关注
  loading: 1, // 中等优先级，正在处理
  ready: 2, // 最低优先级，正常状态
}

/**
 * 比较两个状态的优先级
 * @param status1 状态1
 * @param status2 状态2
 * @returns 负数表示status1优先级更高，正数表示status2优先级更高，0表示相等
 */
export function compareStatusPriority(
  status1: TimelineItemStatus,
  status2: TimelineItemStatus,
): number {
  return STATUS_PRIORITY[status1] - STATUS_PRIORITY[status2]
}

/**
 * 获取状态的优先级数值
 */
export function getStatusPriority(status: TimelineItemStatus): number {
  return STATUS_PRIORITY[status]
}

// ==================== 渲染器选择辅助工具 ====================

/**
 * 判断是否应该使用状态渲染器
 */
export function shouldUseStatusRenderer(data: UnifiedTimelineItemData<MediaType>): boolean {
  return data.timelineStatus !== 'ready'
}

/**
 * 判断是否应该使用媒体类型渲染器
 */
export function shouldUseMediaTypeRenderer(data: UnifiedTimelineItemData<MediaType>): boolean {
  return data.timelineStatus === 'ready' // 由于类型约束，不再需要检查 unknown
}

/**
 * 获取渲染器选择的描述信息
 */
export function getRendererSelectionInfo(data: UnifiedTimelineItemData<MediaType>): {
  type: 'status' | 'mediatype' | 'default'
  value: string
  reason: string
} {
  if (shouldUseStatusRenderer(data)) {
    return {
      type: 'status',
      value: data.timelineStatus,
      reason: `Non-ready status: ${data.timelineStatus}`,
    }
  }

  if (shouldUseMediaTypeRenderer(data)) {
    return {
      type: 'mediatype',
      value: data.mediaType,
      reason: `Ready status with known media type: ${data.mediaType}`,
    }
  }

  return {
    type: 'default',
    value: 'default',
    reason: `Ready status with unknown media type or no specific renderer`,
  }
}

// ==================== 时间范围工具 ====================

/**
 * 计算时间轴项目的持续时间（帧数）
 */
export function getTimelineItemDuration(data: UnifiedTimelineItemData<MediaType>): number {
  return data.timeRange.timelineEndTime - data.timeRange.timelineStartTime
}

/**
 * 检查时间轴项目是否在指定时间范围内
 */
export function isTimelineItemInRange(
  data: UnifiedTimelineItemData<MediaType>,
  startFrame: number,
  endFrame: number,
): boolean {
  return !(
    data.timeRange.timelineEndTime <= startFrame || data.timeRange.timelineStartTime >= endFrame
  )
}

/**
 * 检查时间轴项目是否包含指定帧
 */
export function doesTimelineItemContainFrame(
  data: UnifiedTimelineItemData<MediaType>,
  frame: number,
): boolean {
  return frame >= data.timeRange.timelineStartTime && frame < data.timeRange.timelineEndTime
}

// ==================== 样式工具 ====================

/**
 * 获取媒体类型对应的CSS类名
 */
export function getMediaTypeCssClass(mediaType: MediaType): string {
  return `media-type-${mediaType}`
}

/**
 * 获取状态对应的CSS类名
 */
export function getStatusCssClass(status: TimelineItemStatus): string {
  return `status-${status}`
}

/**
 * 获取时间轴项目的完整CSS类名数组
 */
export function getTimelineItemCssClasses(
  data: UnifiedTimelineItemData<MediaType>,
  additionalClasses: string[] = [],
): string[] {
  return [
    'timeline-item',
    getMediaTypeCssClass(data.mediaType),
    getStatusCssClass(data.timelineStatus),
    ...additionalClasses,
  ]
}

// ==================== 媒体项目信息工具 ====================

/**
 * 获取时间轴项目关联的媒体项目名称
 */
export function getMediaItemName(data: UnifiedTimelineItemData<MediaType>): string {
  // 动态导入避免循环依赖
  try {
    // 这里需要在运行时获取store，避免在模块加载时导入
    // 暂时返回默认值，实际使用时需要传入store或使用其他方式获取
    return 'Unknown'
  } catch (error) {
    console.warn('无法获取媒体项目名称:', error)
    return 'Unknown'
  }
}

/**
 * 获取时间轴项目的显示名称（优先使用媒体项目名称）
 */
export function getTimelineItemDisplayName(data: UnifiedTimelineItemData<MediaType>): string {
  // 对于文本类型，优先显示文本内容
  if (data.mediaType === 'text' && 'text' in data.config) {
    const textContent = (data.config as any).text
    if (textContent && typeof textContent === 'string') {
      return textContent.length > 20 ? textContent.substring(0, 20) + '...' : textContent
    }
  }

  // 注意：由于类型约束，不再有 unknown 类型，移除相关逻辑

  // 其他情况尝试获取媒体项目名称
  return getMediaItemName(data)
}

// ==================== 调试工具 ====================

/**
 * 获取时间轴项目的调试信息
 */
export function getTimelineItemDebugInfo(data: UnifiedTimelineItemData<MediaType>): {
  id: string
  mediaType: MediaType
  status: TimelineItemStatus
  duration: number
  timeRange: string
  configName: string
} {
  return {
    id: data.id,
    mediaType: data.mediaType,
    status: data.timelineStatus,
    duration: getTimelineItemDuration(data),
    timeRange: `${data.timeRange.timelineStartTime}-${data.timeRange.timelineEndTime}`,
    configName: getTimelineItemDisplayName(data),
  }
}

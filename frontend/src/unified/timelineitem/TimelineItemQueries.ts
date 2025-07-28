/**
 * 统一时间轴项目查询工具函数
 * 提供各种查询和计算功能的纯函数
 */

import type {
  UnifiedTimelineItemData,
  TimelineItemStatus
} from './TimelineItemData'
import { TimelineStatusDisplayUtils } from './TimelineStatusDisplayUtils'
import { useUnifiedStore } from '../unifiedStore'

// ==================== 状态查询函数 ====================

/**
 * 检查是否为就绪状态
 */
export function isReady(data: UnifiedTimelineItemData): boolean {
  return data.timelineStatus === 'ready' && !!data.sprite
}

/**
 * 检查是否正在加载
 */
export function isLoading(data: UnifiedTimelineItemData): boolean {
  return data.timelineStatus === 'loading'
}

/**
 * 检查是否有错误
 */
export function hasError(data: UnifiedTimelineItemData): boolean {
  return data.timelineStatus === 'error'
}

/**
 * 检查是否可以播放
 */
export function canPlay(data: UnifiedTimelineItemData): boolean {
  return isReady(data) && hasValidTimeRange(data)
}

/**
 * 检查是否可以编辑
 */
export function canEdit(data: UnifiedTimelineItemData): boolean {
  return data.timelineStatus !== 'loading'
}

/**
 * 获取状态显示文本
 */
export function getStatusText(data: UnifiedTimelineItemData): string {
  const unifiedStore = useUnifiedStore()
  const mediaData = unifiedStore.getMediaItem(data.mediaItemId)
  return mediaData ? TimelineStatusDisplayUtils.getStatusText(mediaData) : '未知状态'
}

/**
 * 获取进度信息
 */
export function getProgressInfo(data: UnifiedTimelineItemData): {
  hasProgress: boolean
  percent: number
  text: string
} {
  const unifiedStore = useUnifiedStore()
  const mediaData = unifiedStore.getMediaItem(data.mediaItemId)
  if (!mediaData) {
    return { hasProgress: false, percent: 0, text: '' }
  }

  const progressInfo = TimelineStatusDisplayUtils.getProgressInfo(mediaData)
  if (!progressInfo.hasProgress) {
    return { hasProgress: false, percent: 0, text: '' }
  }

  const text = progressInfo.speed
    ? `${progressInfo.percent}% (${progressInfo.speed})`
    : `${progressInfo.percent}%`

  return {
    hasProgress: true,
    percent: progressInfo.percent,
    text
  }
}

/**
 * 获取错误信息
 */
export function getErrorInfo(data: UnifiedTimelineItemData): {
  hasError: boolean
  message: string
  recoverable: boolean
} {
  const unifiedStore = useUnifiedStore()
  const mediaData = unifiedStore.getMediaItem(data.mediaItemId)
  if (!mediaData) {
    return { hasError: false, message: '', recoverable: false }
  }

  const errorInfo = TimelineStatusDisplayUtils.getErrorInfo(mediaData)
  return {
    hasError: errorInfo.hasError,
    message: errorInfo.message || '',
    recoverable: errorInfo.recoverable || false
  }
}

// ==================== 时间范围查询函数 ====================

/**
 * 获取项目持续时间（帧数）
 */
export function getDuration(data: UnifiedTimelineItemData): number {
  return data.timeRange.timelineEndTime - data.timeRange.timelineStartTime
}

/**
 * 获取项目持续时间（秒）
 */
export function getDurationInSeconds(data: UnifiedTimelineItemData, frameRate: number = 30): number {
  return getDuration(data) / frameRate
}

/**
 * 检查时间范围是否有效
 */
export function hasValidTimeRange(data: UnifiedTimelineItemData): boolean {
  return data.timeRange.timelineEndTime > data.timeRange.timelineStartTime &&
         data.timeRange.timelineStartTime >= 0
}

/**
 * 检查是否与另一个项目在时间上重叠
 */
export function isOverlapping(
  data1: UnifiedTimelineItemData, 
  data2: UnifiedTimelineItemData
): boolean {
  // 不同轨道不算重叠
  if (data1.trackId !== data2.trackId) {
    return false
  }

  const start1 = data1.timeRange.timelineStartTime
  const end1 = data1.timeRange.timelineEndTime
  const start2 = data2.timeRange.timelineStartTime
  const end2 = data2.timeRange.timelineEndTime

  return start1 < end2 && start2 < end1
}

/**
 * 检查指定时间点是否在项目范围内
 */
export function containsTime(data: UnifiedTimelineItemData, time: number): boolean {
  return time >= data.timeRange.timelineStartTime && time < data.timeRange.timelineEndTime
}

/**
 * 获取项目在时间轴上的位置信息
 */
export function getTimelinePosition(data: UnifiedTimelineItemData): {
  startTime: number
  endTime: number
  duration: number
  centerTime: number
} {
  const startTime = data.timeRange.timelineStartTime
  const endTime = data.timeRange.timelineEndTime
  const duration = endTime - startTime
  const centerTime = startTime + duration / 2

  return { startTime, endTime, duration, centerTime }
}

// ==================== 配置查询函数 ====================

/**
 * 获取变换配置
 */
export function getTransform(data: UnifiedTimelineItemData) {
  return data.config.transform || {}
}

/**
 * 获取透明度
 */
export function getOpacity(data: UnifiedTimelineItemData): number {
  return data.config.transform?.opacity ?? 1
}

/**
 * 获取音量
 */
export function getVolume(data: UnifiedTimelineItemData): number {
  return data.config.audioConfig?.volume ?? 1
}

/**
 * 检查是否静音
 */
export function isMuted(data: UnifiedTimelineItemData): boolean {
  return data.config.audioConfig?.isMuted ?? false
}

/**
 * 获取视频裁剪信息
 */
export function getVideoClip(data: UnifiedTimelineItemData): {
  hasClip: boolean
  startTime?: number
  endTime?: number
  duration?: number
} {
  const videoConfig = data.config.videoConfig
  if (!videoConfig || (!videoConfig.clipStartTime && !videoConfig.clipEndTime)) {
    return { hasClip: false }
  }

  const startTime = videoConfig.clipStartTime ?? 0
  const endTime = videoConfig.clipEndTime
  const duration = endTime ? endTime - startTime : undefined

  return {
    hasClip: true,
    startTime,
    endTime,
    duration
  }
}

// ==================== 批量查询函数 ====================

/**
 * 过滤指定状态的项目
 */
export function filterByStatus(
  items: UnifiedTimelineItemData[], 
  status: TimelineItemStatus
): UnifiedTimelineItemData[] {
  return items.filter(item => item.timelineStatus === status)
}

/**
 * 过滤指定轨道的项目
 */
export function filterByTrack(
  items: UnifiedTimelineItemData[], 
  trackId: string
): UnifiedTimelineItemData[] {
  return items.filter(item => item.trackId === trackId)
}

/**
 * 过滤指定媒体类型的项目
 */
export function filterByMediaType(
  items: UnifiedTimelineItemData[], 
  mediaType: string
): UnifiedTimelineItemData[] {
  return items.filter(item => item.mediaType === mediaType)
}

/**
 * 按时间排序项目
 */
export function sortByTime(items: UnifiedTimelineItemData[]): UnifiedTimelineItemData[] {
  return [...items].sort((a, b) => a.timeRange.timelineStartTime - b.timeRange.timelineStartTime)
}

/**
 * 查找指定时间点的所有项目
 */
export function findItemsAtTime(
  items: UnifiedTimelineItemData[], 
  time: number
): UnifiedTimelineItemData[] {
  return items.filter(item => containsTime(item, time))
}

/**
 * 查找与指定项目重叠的所有项目
 */
export function findOverlappingItems(
  items: UnifiedTimelineItemData[], 
  targetItem: UnifiedTimelineItemData
): UnifiedTimelineItemData[] {
  return items.filter(item => 
    item.id !== targetItem.id && isOverlapping(item, targetItem)
  )
}

/**
 * 获取轨道的时间范围统计
 */
export function getTrackTimeStats(
  items: UnifiedTimelineItemData[], 
  trackId: string
): {
  itemCount: number
  totalDuration: number
  earliestStart: number
  latestEnd: number
  gaps: Array<{ start: number; end: number; duration: number }>
} {
  const trackItems = filterByTrack(items, trackId)
  
  if (trackItems.length === 0) {
    return {
      itemCount: 0,
      totalDuration: 0,
      earliestStart: 0,
      latestEnd: 0,
      gaps: []
    }
  }

  const sortedItems = sortByTime(trackItems)
  const totalDuration = trackItems.reduce((sum, item) => sum + getDuration(item), 0)
  const earliestStart = sortedItems[0].timeRange.timelineStartTime
  const latestEnd = sortedItems[sortedItems.length - 1].timeRange.timelineEndTime

  // 计算间隙
  const gaps: Array<{ start: number; end: number; duration: number }> = []
  for (let i = 0; i < sortedItems.length - 1; i++) {
    const currentEnd = sortedItems[i].timeRange.timelineEndTime
    const nextStart = sortedItems[i + 1].timeRange.timelineStartTime
    
    if (nextStart > currentEnd) {
      gaps.push({
        start: currentEnd,
        end: nextStart,
        duration: nextStart - currentEnd
      })
    }
  }

  return {
    itemCount: trackItems.length,
    totalDuration,
    earliestStart,
    latestEnd,
    gaps
  }
}

// ==================== 导出查询工具集合 ====================

export const TimelineItemQueries = {
  // 状态查询
  isReady,
  isLoading,
  hasError,
  canPlay,
  canEdit,
  getStatusText,
  getProgressInfo,
  getErrorInfo,

  // 时间查询
  getDuration,
  getDurationInSeconds,
  hasValidTimeRange,
  isOverlapping,
  containsTime,
  getTimelinePosition,

  // 配置查询
  getTransform,
  getOpacity,
  getVolume,
  isMuted,
  getVideoClip,

  // 批量查询
  filterByStatus,
  filterByTrack,
  filterByMediaType,
  sortByTime,
  findItemsAtTime,
  findOverlappingItems,
  getTrackTimeStats
}

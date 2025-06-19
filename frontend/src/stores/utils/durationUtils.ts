import type { TimelineItem } from '../../types/videoTypes'

// ==================== 时长计算工具 ====================

/**
 * 计算内容结束时间（最后一个视频片段的结束时间）
 * @param timelineItems 时间轴项目数组
 * @returns 内容结束时间（秒）
 */
export function calculateContentEndTime(timelineItems: TimelineItem[]): number {
  if (timelineItems.length === 0) return 0
  return Math.max(
    ...timelineItems.map((item) => {
      const sprite = item.sprite
      const timeRange = sprite.getTimeRange()
      return timeRange.timelineEndTime / 1000000 // 转换为秒
    }),
  )
}

/**
 * 计算总时长
 * @param timelineItems 时间轴项目数组
 * @param timelineDuration 基础时间轴时长（秒）
 * @returns 总时长（秒）
 */
export function calculateTotalDuration(
  timelineItems: TimelineItem[],
  timelineDuration: number,
): number {
  if (timelineItems.length === 0) return timelineDuration
  const maxEndTime = Math.max(
    ...timelineItems.map((item) => {
      const sprite = item.sprite
      const timeRange = sprite.getTimeRange()
      const timelineEndTime = timeRange.timelineEndTime / 1000000 // 转换为秒
      return timelineEndTime
    }),
  )
  return Math.max(maxEndTime, timelineDuration)
}

/**
 * 计算最大可见时长
 * @param contentEndTime 内容结束时间（秒）
 * @param defaultDuration 默认时长（秒）
 * @returns 最大可见时长（秒）
 */
export function calculateMaxVisibleDuration(
  contentEndTime: number,
  defaultDuration: number = 60,
): number {
  if (contentEndTime === 0) {
    return defaultDuration // 没有视频时使用默认值
  }
  // 最大可见范围：视频内容长度的4倍
  return contentEndTime * 4
}

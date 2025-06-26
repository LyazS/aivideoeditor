import type { TimelineItem } from '../../types'

// ==================== 时长计算工具 ====================

// ==================== 帧数版本的时长计算工具 ====================

/**
 * 计算内容结束时间（帧数）
 * @param timelineItems 时间轴项目数组
 * @returns 内容结束时间（帧数）
 */
export function calculateContentEndTimeFrames(timelineItems: TimelineItem[]): number {
  if (timelineItems.length === 0) return 0
  return Math.max(
    ...timelineItems.map((item) => {
      const sprite = item.sprite
      const timeRange = sprite.getTimeRange()
      return timeRange.timelineEndTime // 已经是帧数，不需要转换
    }),
  )
}

/**
 * 计算总时长（帧数）
 * @param timelineItems 时间轴项目数组
 * @param timelineDurationFrames 基础时间轴时长（帧数）
 * @returns 总时长（帧数）
 */
export function calculateTotalDurationFrames(
  timelineItems: TimelineItem[],
  timelineDurationFrames: number,
): number {
  if (timelineItems.length === 0) return timelineDurationFrames
  const maxEndTimeFrames = Math.max(
    ...timelineItems.map((item) => {
      const sprite = item.sprite
      const timeRange = sprite.getTimeRange()
      return timeRange.timelineEndTime // 已经是帧数，不需要转换
    }),
  )
  return Math.max(maxEndTimeFrames, timelineDurationFrames)
}

/**
 * 计算最大可见时长（帧数）
 * @param contentEndTimeFrames 内容结束时间（帧数）
 * @param defaultDurationFrames 默认时长（帧数，默认60秒=1800帧）
 * @returns 最大可见时长（帧数）
 */
export function calculateMaxVisibleDurationFrames(
  contentEndTimeFrames: number,
  defaultDurationFrames: number = 1800, // 60秒 * 30fps
): number {
  if (contentEndTimeFrames === 0) {
    return defaultDurationFrames
  }
  // 最大可见范围：视频内容长度的4倍
  return contentEndTimeFrames * 4
}

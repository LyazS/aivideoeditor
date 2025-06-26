import type { TimelineItem, VideoTimeRange, ImageTimeRange } from '../../types'
import { isVideoTimeRange } from '../../types'

// ==================== 时间范围工具 ====================

/**
 * 同步TimelineItem和sprite的timeRange
 * 确保两者的时间范围信息保持一致
 * @param timelineItem TimelineItem实例
 * @param newTimeRange 新的时间范围（可选，如果不提供则从sprite获取）
 */
export function syncTimeRange(
  timelineItem: TimelineItem,
  newTimeRange?: Partial<VideoTimeRange>,
): void {
  const sprite = timelineItem.sprite

  if (newTimeRange) {
    // 如果提供了新的时间范围，同时更新sprite和TimelineItem
    const completeTimeRange = {
      ...sprite.getTimeRange(),
      ...newTimeRange,
    }

    // sprite.setTimeRange会在内部自动计算effectiveDuration
    sprite.setTimeRange(completeTimeRange)
    // 从sprite获取更新后的完整timeRange（包含自动计算的effectiveDuration）
    timelineItem.timeRange = sprite.getTimeRange()

    console.log('🔄 同步timeRange (提供新值):', {
      timelineItemId: timelineItem.id,
      timeRange: completeTimeRange,
    })
  } else {
    // 如果没有提供新值，从sprite同步到TimelineItem
    const spriteTimeRange = sprite.getTimeRange()
    timelineItem.timeRange = spriteTimeRange

    console.log('🔄 同步timeRange (从sprite获取):', {
      timelineItemId: timelineItem.id,
      timeRange: spriteTimeRange,
    })
  }
}

/**
 * 验证时间范围是否有效
 * @param timeRange 时间范围
 * @returns 是否有效
 */
export function validateTimeRange(timeRange: VideoTimeRange | ImageTimeRange): boolean {
  // 通用验证：时间轴时间范围
  const basicValid =
    timeRange.timelineStartTime >= 0 && timeRange.timelineEndTime > timeRange.timelineStartTime

  // 视频特有验证
  if (isVideoTimeRange(timeRange)) {
    return (
      basicValid && timeRange.clipStartTime >= 0 && timeRange.clipEndTime > timeRange.clipStartTime
    )
  }

  // 图片特有验证
  return basicValid && timeRange.displayDuration > 0
}

/**
 * 计算时间范围重叠
 * @param range1 时间范围1
 * @param range2 时间范围2
 * @returns 重叠时长（帧数）
 */
export function calculateTimeRangeOverlap(
  range1: VideoTimeRange | ImageTimeRange,
  range2: VideoTimeRange | ImageTimeRange,
): number {
  const start1 = range1.timelineStartTime // 帧数
  const end1 = range1.timelineEndTime // 帧数
  const start2 = range2.timelineStartTime // 帧数
  const end2 = range2.timelineEndTime // 帧数

  const overlapStart = Math.max(start1, start2)
  const overlapEnd = Math.min(end1, end2)

  return Math.max(0, overlapEnd - overlapStart)
}

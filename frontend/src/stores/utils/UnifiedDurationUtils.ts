/**
 * 统一时长计算工具 (UnifiedDurationUtils)
 *
 * 基于新架构的统一类型设计，提供时长计算相关的工具函数
 * 参考 frontend/src/stores/utils/durationUtils.ts
 */

import type { UnifiedTimelineItem } from '../../unified/timelineitem/types'
import { secondsToFrames } from './timeUtils'

// ==================== 时长计算工具 ====================

/**
 * 计算内容结束时间（帧数）
 * @param timelineItems 统一时间轴项目数组
 * @returns 内容结束时间（帧数）
 */
export function calculateContentEndTimeFrames(
  timelineItems: UnifiedTimelineItem[],
): number {
  if (timelineItems.length === 0) return 0
  return Math.max(
    ...timelineItems.map((item) => {
      return item.timeRange.timelineEndTime // 直接使用响应式的timeRange
    }),
  )
}

/**
 * 计算总时长（帧数）
 * @param timelineItems 统一时间轴项目数组
 * @param timelineDurationFrames 基础时间轴时长（帧数）
 * @returns 总时长（帧数）
 */
export function calculateTotalDurationFrames(
  timelineItems: UnifiedTimelineItem[],
  timelineDurationFrames: number,
): number {
  if (timelineItems.length === 0) return timelineDurationFrames
  const maxEndTimeFrames = Math.max(
    ...timelineItems.map((item) => {
      return item.timeRange.timelineEndTime // 直接使用响应式的timeRange
    }),
  )
  console.log('calculateTotalDurationFrames:', maxEndTimeFrames, timelineDurationFrames)
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
  defaultDurationFrames: number = secondsToFrames(60), // 60秒转换为帧数
): number {
  if (contentEndTimeFrames === 0) {
    return defaultDurationFrames
  }
  // 最大可见范围：视频内容长度的4倍
  return contentEndTimeFrames * 4
}

import type { Ref } from 'vue'
import type { MediaItem, TimelineItem, Track } from '../../types/videoTypes'
import { findOrphanedTimelineItems } from './timelineSearchUtils'
import { validateTimeRange, calculateTimeRangeOverlap } from './timeRangeUtils'

// ==================== 验证和清理工具 ====================

/**
 * 验证数据完整性
 * @param mediaItems 媒体项目数组
 * @param timelineItems 时间轴项目数组
 * @param tracks 轨道数组
 * @returns 验证结果
 */
export function validateDataIntegrity(
  mediaItems: MediaItem[],
  timelineItems: TimelineItem[],
  tracks: Track[],
): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // 检查孤立的时间轴项目
  const orphanedItems = findOrphanedTimelineItems(timelineItems, mediaItems)
  if (orphanedItems.length > 0) {
    errors.push(`发现 ${orphanedItems.length} 个孤立的时间轴项目（没有对应的媒体项目）`)
  }

  // 检查无效的轨道引用
  const trackIds = new Set(tracks.map((track) => track.id))
  const invalidTrackItems = timelineItems.filter((item) => !trackIds.has(item.trackId))
  if (invalidTrackItems.length > 0) {
    errors.push(`发现 ${invalidTrackItems.length} 个时间轴项目引用了不存在的轨道`)
  }

  // 检查时间范围有效性
  const invalidTimeRangeItems = timelineItems.filter((item) => !validateTimeRange(item.timeRange))
  if (invalidTimeRangeItems.length > 0) {
    warnings.push(`发现 ${invalidTimeRangeItems.length} 个时间轴项目的时间范围无效`)
  }

  // 检查重叠项目（同一轨道内）
  const trackGroups = new Map<number, TimelineItem[]>()
  timelineItems.forEach((item) => {
    if (!trackGroups.has(item.trackId)) {
      trackGroups.set(item.trackId, [])
    }
    trackGroups.get(item.trackId)!.push(item)
  })

  trackGroups.forEach((trackItems, trackId) => {
    for (let i = 0; i < trackItems.length; i++) {
      for (let j = i + 1; j < trackItems.length; j++) {
        const overlap = calculateTimeRangeOverlap(trackItems[i].timeRange, trackItems[j].timeRange)
        if (overlap > 0) {
          warnings.push(`轨道 ${trackId} 中发现重叠项目，重叠时长 ${overlap.toFixed(2)} 秒`)
        }
      }
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * 清理无效的引用
 * @param timelineItems 时间轴项目数组的ref
 * @param mediaItems 媒体项目数组
 * @returns 清理的项目数量
 */
export function cleanupInvalidReferences(
  timelineItems: Ref<TimelineItem[]>,
  mediaItems: MediaItem[],
): number {
  const orphanedItems = findOrphanedTimelineItems(timelineItems.value, mediaItems)

  if (orphanedItems.length > 0) {
    // 移除孤立的时间轴项目
    timelineItems.value = timelineItems.value.filter(
      (item) => !orphanedItems.some((orphaned) => orphaned.id === item.id),
    )

    console.warn(`🧹 清理了 ${orphanedItems.length} 个孤立的时间轴项目`)
  }

  return orphanedItems.length
}

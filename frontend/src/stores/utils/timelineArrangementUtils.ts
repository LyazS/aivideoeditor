import type { Ref } from 'vue'
import type { TimelineItem } from '../../types/videoTypes'
import { isVideoTimeRange } from '../../types/videoTypes'

// ==================== 自动整理工具 ====================

/**
 * 自动整理单个轨道的时间轴项目，按时间排序并消除重叠
 * @param timelineItems 时间轴项目数组的ref
 * @param trackId 要整理的轨道ID
 */
export function autoArrangeTrackItems(timelineItems: Ref<TimelineItem[]>, trackId: number) {
  // 获取指定轨道的所有项目
  const trackItems = timelineItems.value.filter((item) => item.trackId === trackId)

  if (trackItems.length === 0) {
    console.log(`⚠️ 轨道 ${trackId} 没有片段需要整理`)
    return
  }

  // 按时间轴开始时间排序
  const sortedItems = trackItems.sort((a, b) => {
    const rangeA = a.sprite.getTimeRange()
    const rangeB = b.sprite.getTimeRange()
    return rangeA.timelineStartTime - rangeB.timelineStartTime
  })

  let currentPosition = 0
  for (const item of sortedItems) {
    const sprite = item.sprite
    const timeRange = sprite.getTimeRange()
    const duration = (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000 // 转换为秒

    // 更新时间轴位置 - 根据媒体类型设置不同的时间范围
    if (item.mediaType === 'video' && isVideoTimeRange(timeRange)) {
      sprite.setTimeRange({
        clipStartTime: timeRange.clipStartTime,
        clipEndTime: timeRange.clipEndTime,
        timelineStartTime: currentPosition * 1000000, // 转换为微秒
        timelineEndTime: (currentPosition + duration) * 1000000,
      })
    } else {
      // 图片类型
      sprite.setTimeRange({
        timelineStartTime: currentPosition * 1000000, // 转换为微秒
        timelineEndTime: (currentPosition + duration) * 1000000,
        displayDuration: duration * 1000000,
      })
    }
    // 从sprite获取更新后的完整timeRange（包含自动计算的effectiveDuration）
    item.timeRange = sprite.getTimeRange()
    currentPosition += duration
  }

  console.log(`✅ 轨道 ${trackId} 的片段自动整理完成，共整理 ${sortedItems.length} 个片段`)
}

/**
 * 自动整理时间轴项目，按轨道分组并在每个轨道内按时间排序
 * @param timelineItems 时间轴项目数组的ref
 */
export function autoArrangeTimelineItems(timelineItems: Ref<TimelineItem[]>) {
  // 按轨道分组，然后在每个轨道内按时间位置排序
  const trackGroups = new Map<number, TimelineItem[]>()

  timelineItems.value.forEach((item) => {
    if (!trackGroups.has(item.trackId)) {
      trackGroups.set(item.trackId, [])
    }
    trackGroups.get(item.trackId)!.push(item)
  })

  // 在每个轨道内重新排列项目
  trackGroups.forEach((_, trackId) => {
    autoArrangeTrackItems(timelineItems, trackId)
  })

  console.log('✅ 所有轨道的时间轴项目自动整理完成')
}

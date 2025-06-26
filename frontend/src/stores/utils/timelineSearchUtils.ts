import type { MediaItem, TimelineItem } from '../../types'

// ==================== 查找工具 ====================

/**
 * 根据时间查找对应的时间轴项目（帧数版本）
 * @param frames 时间（帧数）
 * @param timelineItems 时间轴项目数组
 * @returns 找到的时间轴项目或null
 */
export function getTimelineItemAtFrames(
  frames: number,
  timelineItems: TimelineItem[],
): TimelineItem | null {
  return (
    timelineItems.find((item) => {
      const sprite = item.sprite
      const timeRange = sprite.getTimeRange()
      // 我们自定义的 VideoVisibleSprite 和 ImageVisibleSprite 的 getTimeRange() 返回的是帧数，不需要转换
      const startFrames = timeRange.timelineStartTime
      const endFrames = timeRange.timelineEndTime
      return frames >= startFrames && frames < endFrames
    }) || null
  )
}



/**
 * 根据轨道ID查找时间轴项目
 * @param trackId 轨道ID
 * @param timelineItems 时间轴项目数组
 * @returns 该轨道的所有项目
 */
export function getTimelineItemsByTrack(
  trackId: number,
  timelineItems: TimelineItem[],
): TimelineItem[] {
  return timelineItems.filter((item) => item.trackId === trackId)
}

/**
 * 查找孤立的时间轴项目（没有对应媒体项目）
 * @param timelineItems 时间轴项目数组
 * @param mediaItems 媒体项目数组
 * @returns 孤立的时间轴项目
 */
export function findOrphanedTimelineItems(
  timelineItems: TimelineItem[],
  mediaItems: MediaItem[],
): TimelineItem[] {
  return timelineItems.filter(
    (timelineItem) => !mediaItems.find((mediaItem) => mediaItem.id === timelineItem.mediaItemId),
  )
}

/**
 * 根据sprite查找时间轴项目
 * @param sprite VideoVisibleSprite实例
 * @param timelineItems 时间轴项目数组
 * @returns 对应的时间轴项目或null
 */
export function findTimelineItemBySprite(
  sprite: unknown,
  timelineItems: TimelineItem[],
): TimelineItem | null {
  return timelineItems.find((item) => item.sprite === sprite) || null
}

/**
 * 根据时间查找所有重叠的时间轴项目（帧数版本）
 * @param frames 时间（帧数）
 * @param timelineItems 时间轴项目数组
 * @returns 重叠的时间轴项目数组
 */
export function getTimelineItemsAtFrames(
  frames: number,
  timelineItems: TimelineItem[],
): TimelineItem[] {
  return timelineItems.filter((item) => {
    const sprite = item.sprite
    const timeRange = sprite.getTimeRange()
    // 我们自定义的 VideoVisibleSprite 和 ImageVisibleSprite 的 getTimeRange() 返回的是帧数，不需要转换
    const startFrames = timeRange.timelineStartTime
    const endFrames = timeRange.timelineEndTime
    return frames >= startFrames && frames < endFrames
  })
}



/**
 * 根据轨道和时间查找时间轴项目（帧数版本）
 * @param trackId 轨道ID
 * @param frames 时间（帧数）
 * @param timelineItems 时间轴项目数组
 * @returns 找到的时间轴项目或null
 */
export function getTimelineItemAtTrackAndFrames(
  trackId: number,
  frames: number,
  timelineItems: TimelineItem[],
): TimelineItem | null {
  return (
    timelineItems.find((item) => {
      if (item.trackId !== trackId) return false
      const sprite = item.sprite
      const timeRange = sprite.getTimeRange()
      // 我们自定义的 VideoVisibleSprite 和 ImageVisibleSprite 的 getTimeRange() 返回的是帧数，不需要转换
      const startFrames = timeRange.timelineStartTime
      const endFrames = timeRange.timelineEndTime
      return frames >= startFrames && frames < endFrames
    }) || null
  )
}



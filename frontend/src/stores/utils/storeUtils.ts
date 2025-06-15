import type { Ref } from 'vue'
import type { MediaItem, TimelineItem } from '../../types/videoTypes'

// ==================== 调试信息工具 ====================

/**
 * 打印调试信息，包括操作详情、素材库状态、时间轴状态等
 * @param operation 操作名称
 * @param details 操作详情
 * @param mediaItems 素材库数据
 * @param timelineItems 时间轴数据
 * @param tracks 轨道数据
 */
export function printDebugInfo(
  operation: string,
  details: unknown,
  mediaItems: Ref<MediaItem[]>,
  timelineItems: Ref<TimelineItem[]>,
  tracks: Ref<any[]>
) {
  const timestamp = new Date().toLocaleTimeString()
  console.group(`🎬 [${timestamp}] ${operation}`)

  if (details) {
    console.log('📋 操作详情:', details)
  }

  console.log('📚 素材库状态 (mediaItems):')
  console.table(mediaItems.value.map(item => ({
    id: item.id,
    name: item.name,
    duration: `${item.duration.toFixed(2)}s`,
    type: item.type,
    hasMP4Clip: !!item.mp4Clip
  })))

  console.log('🎞️ 时间轴状态 (timelineItems):')
  console.table(timelineItems.value.map(item => ({
    id: item.id,
    mediaItemId: item.mediaItemId,
    trackId: item.trackId,
    position: `${(item.timeRange.timelineStartTime / 1000000).toFixed(2)}s`,
    hasSprite: !!item.sprite
  })))

  console.log('📊 统计信息:')
  console.log(`- 素材库项目数: ${mediaItems.value.length}`)
  console.log(`- 时间轴项目数: ${timelineItems.value.length}`)
  console.log(`- 轨道数: ${tracks.value.length}`)

  // 检查引用关系
  const orphanedTimelineItems = timelineItems.value.filter(timelineItem =>
    !mediaItems.value.find(mediaItem => mediaItem.id === timelineItem.mediaItemId)
  )
  if (orphanedTimelineItems.length > 0) {
    console.warn('⚠️ 发现孤立的时间轴项目 (没有对应的素材库项目):', orphanedTimelineItems)
  }

  console.groupEnd()
}

// ==================== 时间计算工具 ====================

/**
 * 将时间对齐到帧边界
 * @param time 时间（秒）
 * @param frameRate 帧率
 * @returns 对齐后的时间
 */
export function alignTimeToFrame(time: number, frameRate: number): number {
  const frameDuration = 1 / frameRate
  return Math.floor(time / frameDuration) * frameDuration
}

/**
 * 将时间转换为像素位置（考虑缩放和滚动）
 * @param time 时间（秒）
 * @param timelineWidth 时间轴宽度（像素）
 * @param totalDuration 总时长（秒）
 * @param zoomLevel 缩放级别
 * @param scrollOffset 滚动偏移量（像素）
 * @returns 像素位置
 */
export function timeToPixel(
  time: number,
  timelineWidth: number,
  totalDuration: number,
  zoomLevel: number,
  scrollOffset: number
): number {
  const pixelsPerSecond = (timelineWidth * zoomLevel) / totalDuration
  return time * pixelsPerSecond - scrollOffset
}

/**
 * 将像素位置转换为时间（考虑缩放和滚动）
 * @param pixel 像素位置
 * @param timelineWidth 时间轴宽度（像素）
 * @param totalDuration 总时长（秒）
 * @param zoomLevel 缩放级别
 * @param scrollOffset 滚动偏移量（像素）
 * @returns 时间（秒）
 */
export function pixelToTime(
  pixel: number,
  timelineWidth: number,
  totalDuration: number,
  zoomLevel: number,
  scrollOffset: number
): number {
  const pixelsPerSecond = (timelineWidth * zoomLevel) / totalDuration
  return (pixel + scrollOffset) / pixelsPerSecond
}

/**
 * 动态扩展时间轴长度（用于拖拽时预先扩展）
 * @param targetTime 目标时间
 * @param timelineDuration 当前时间轴长度的ref
 */
export function expandTimelineIfNeeded(targetTime: number, timelineDuration: Ref<number>) {
  if (targetTime > timelineDuration.value) {
    // 扩展到目标时间的1.5倍，确保有足够的空间
    timelineDuration.value = Math.max(targetTime * 1.5, timelineDuration.value)
  }
}

// ==================== 查找工具 ====================

/**
 * 根据时间查找对应的时间轴项目
 * @param time 时间（秒）
 * @param timelineItems 时间轴项目数组
 * @returns 找到的时间轴项目或null
 */
export function getTimelineItemAtTime(time: number, timelineItems: TimelineItem[]): TimelineItem | null {
  return timelineItems.find((item) => {
    const sprite = item.sprite
    const timeRange = sprite.getTimeRange()
    const startTime = timeRange.timelineStartTime / 1000000 // 转换为秒
    const endTime = timeRange.timelineEndTime / 1000000 // 转换为秒
    return time >= startTime && time < endTime
  }) || null
}

// ==================== 自动整理工具 ====================

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
  trackGroups.forEach((trackItems) => {
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

      // 更新时间轴位置
      sprite.setTimeRange({
        clipStartTime: timeRange.clipStartTime,
        clipEndTime: timeRange.clipEndTime,
        timelineStartTime: currentPosition * 1000000, // 转换为微秒
        timelineEndTime: (currentPosition + duration) * 1000000
      })
      // 从sprite获取更新后的完整timeRange（包含自动计算的effectiveDuration）
      item.timeRange = sprite.getTimeRange()
      currentPosition += duration
    }
  })

  console.log('✅ 时间轴项目自动整理完成')
}

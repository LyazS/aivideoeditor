import type { Ref } from 'vue'
import type { MediaItem, TimelineItem, Track } from '../../types/videoTypes'
import type { VideoTimeRange } from '../../utils/VideoVisibleSprite'

// ==================== 调试开关 ====================

// 声明全局调试开关类型
declare global {
  interface Window {
    DEBUG_TIMELINE_CONVERSION?: boolean
    DEBUG_TIMELINE_ZOOM?: boolean
    enableTimelineDebug?: () => void
    disableTimelineDebug?: () => void
  }
}

// 设置全局调试开关（默认关闭，需要时可手动开启）
window.DEBUG_TIMELINE_CONVERSION = false
window.DEBUG_TIMELINE_ZOOM = false

// 提供便捷的调试控制函数
window.enableTimelineDebug = () => {
  window.DEBUG_TIMELINE_CONVERSION = true
  window.DEBUG_TIMELINE_ZOOM = true
  console.log('🔧 时间轴调试模式已开启')
  console.log('📝 可用调试开关:')
  console.log('  - window.DEBUG_TIMELINE_CONVERSION: 坐标转换调试（会产生大量日志）')
  console.log('  - window.DEBUG_TIMELINE_ZOOM: 缩放调试（已精简，只显示警告信息）')
}

window.disableTimelineDebug = () => {
  window.DEBUG_TIMELINE_CONVERSION = false
  window.DEBUG_TIMELINE_ZOOM = false
  console.log('🔧 时间轴调试模式已关闭')
}

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
  mediaItems: MediaItem[],
  timelineItems: TimelineItem[],
  tracks: any[],
) {
  const timestamp = new Date().toLocaleTimeString()
  console.group(`🎬 [${timestamp}] ${operation}`)

  if (details) {
    console.log('📋 操作详情:', details)
  }

  console.log('📚 素材库状态 (mediaItems):')
  console.table(
    mediaItems.map((item) => ({
      id: item.id,
      name: item.name,
      duration: `${item.duration.toFixed(2)}s`,
      type: item.type,
      hasMP4Clip: !!item.mp4Clip,
    })),
  )

  console.log('🎞️ 时间轴状态 (timelineItems):')
  console.table(
    timelineItems.map((item) => ({
      id: item.id,
      mediaItemId: item.mediaItemId,
      trackId: item.trackId,
      position: `${(item.timeRange.timelineStartTime / 1000000).toFixed(2)}s`,
      hasSprite: !!item.sprite,
    })),
  )

  console.log('📊 统计信息:')
  console.log(`- 素材库项目数: ${mediaItems.length}`)
  console.log(`- 时间轴项目数: ${timelineItems.length}`)
  console.log(`- 轨道数: ${tracks.length}`)

  // 检查引用关系
  const orphanedTimelineItems = timelineItems.filter(
    (timelineItem) => !mediaItems.find((mediaItem) => mediaItem.id === timelineItem.mediaItemId),
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
  scrollOffset: number,
): number {
  const pixelsPerSecond = (timelineWidth * zoomLevel) / totalDuration
  const pixelPosition = time * pixelsPerSecond - scrollOffset

  // 只在调试模式下输出详细信息，避免过多日志
  if (window.DEBUG_TIMELINE_CONVERSION) {
    console.log('⏰➡️📐 [坐标转换] 时间转像素:', {
      time: time.toFixed(3),
      timelineWidth,
      totalDuration: totalDuration.toFixed(2),
      zoomLevel: zoomLevel.toFixed(3),
      scrollOffset: scrollOffset.toFixed(2),
      pixelsPerSecond: pixelsPerSecond.toFixed(2),
      pixelPosition: pixelPosition.toFixed(2),
    })
  }

  return pixelPosition
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
  scrollOffset: number,
): number {
  const pixelsPerSecond = (timelineWidth * zoomLevel) / totalDuration
  const time = (pixel + scrollOffset) / pixelsPerSecond

  // 只在调试模式下输出详细信息，避免过多日志
  if (window.DEBUG_TIMELINE_CONVERSION) {
    console.log('📐➡️⏰ [坐标转换] 像素转时间:', {
      pixel: pixel.toFixed(2),
      timelineWidth,
      totalDuration: totalDuration.toFixed(2),
      zoomLevel: zoomLevel.toFixed(3),
      scrollOffset: scrollOffset.toFixed(2),
      pixelsPerSecond: pixelsPerSecond.toFixed(2),
      time: time.toFixed(3),
    })
  }

  return time
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
export function getTimelineItemAtTime(
  time: number,
  timelineItems: TimelineItem[],
): TimelineItem | null {
  return (
    timelineItems.find((item) => {
      const sprite = item.sprite
      const timeRange = sprite.getTimeRange()
      const startTime = timeRange.timelineStartTime / 1000000 // 转换为秒
      const endTime = timeRange.timelineEndTime / 1000000 // 转换为秒
      return time >= startTime && time < endTime
    }) || null
  )
}

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

    // 更新时间轴位置
    sprite.setTimeRange({
      clipStartTime: timeRange.clipStartTime,
      clipEndTime: timeRange.clipEndTime,
      timelineStartTime: currentPosition * 1000000, // 转换为微秒
      timelineEndTime: (currentPosition + duration) * 1000000,
    })
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
  trackGroups.forEach((trackItems, trackId) => {
    autoArrangeTrackItems(timelineItems, trackId)
  })

  console.log('✅ 所有轨道的时间轴项目自动整理完成')
}

// ==================== 缩放计算工具 ====================

/**
 * 计算最大缩放级别
 * @param timelineWidth 时间轴宽度（像素）
 * @param frameRate 帧率
 * @param totalDuration 总时长（秒）
 * @returns 最大缩放级别
 */
export function getMaxZoomLevel(
  timelineWidth: number,
  frameRate: number,
  totalDuration: number,
): number {
  // 最大缩放级别：一帧占用容器宽度的1/20（即5%）
  const targetFrameWidth = timelineWidth / 20 // 一帧占1/20横幅
  const frameDuration = 1 / frameRate // 一帧的时长（秒）
  const requiredPixelsPerSecond = targetFrameWidth / frameDuration
  const calculatedMaxZoom = (requiredPixelsPerSecond * totalDuration) / timelineWidth
  const maxZoom = Math.max(calculatedMaxZoom, 100) // 确保至少有100倍缩放

  if (window.DEBUG_TIMELINE_ZOOM) {
    console.group('🔬 [缩放计算] 计算最大缩放级别')

    console.log('📐 最大缩放计算参数:', {
      timelineWidth,
      frameRate,
      totalDuration: totalDuration.toFixed(2),
      targetFrameWidth: targetFrameWidth.toFixed(2),
      frameDuration: frameDuration.toFixed(4),
    })

    console.log('📊 最大缩放计算结果:', {
      requiredPixelsPerSecond: requiredPixelsPerSecond.toFixed(2),
      calculatedMaxZoom: calculatedMaxZoom.toFixed(3),
      finalMaxZoom: maxZoom.toFixed(3),
      limitedByMinimum: maxZoom === 100,
    })

    console.groupEnd()
  }

  return maxZoom
}

/**
 * 计算最小缩放级别
 * @param totalDuration 总时长（秒）
 * @param maxVisibleDuration 最大可见时长（秒）
 * @returns 最小缩放级别
 */
export function getMinZoomLevel(totalDuration: number, maxVisibleDuration: number): number {
  // 基于最大可见范围计算最小缩放级别
  const minZoom = totalDuration / maxVisibleDuration

  if (window.DEBUG_TIMELINE_ZOOM) {
    console.group('🔍 [缩放计算] 计算最小缩放级别')

    console.log('📐 最小缩放计算参数:', {
      totalDuration: totalDuration.toFixed(2),
      maxVisibleDuration: maxVisibleDuration.toFixed(2),
    })

    console.log('📊 最小缩放计算结果:', {
      minZoom: minZoom.toFixed(3),
      ratio: (totalDuration / maxVisibleDuration).toFixed(3),
    })

    console.groupEnd()
  }

  return minZoom
}

/**
 * 计算最大滚动偏移量
 * @param timelineWidth 时间轴宽度（像素）
 * @param zoomLevel 缩放级别
 * @param totalDuration 总时长（秒）
 * @param maxVisibleDuration 最大可见时长（秒）
 * @returns 最大滚动偏移量（像素）
 */
export function getMaxScrollOffset(
  timelineWidth: number,
  zoomLevel: number,
  totalDuration: number,
  maxVisibleDuration: number,
): number {
  // 使用最大可见范围作为滚动范围，允许滚动到内容结束时间*4的位置
  const effectiveDuration = maxVisibleDuration
  const pixelsPerSecond = (timelineWidth * zoomLevel) / totalDuration
  const visibleDuration = timelineWidth / pixelsPerSecond
  const maxScrollableTime = Math.max(0, effectiveDuration - visibleDuration)
  const maxScrollOffset = maxScrollableTime * pixelsPerSecond

  // 精简调试信息，只在需要时输出

  return maxScrollOffset
}

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
  defaultDuration: number = 300,
): number {
  if (contentEndTime === 0) {
    return defaultDuration // 没有视频时使用默认值
  }
  // 最大可见范围：视频内容长度的4倍
  return contentEndTime * 4
}

// ==================== 时间范围工具 ====================

/**
 * 同步TimelineItem和sprite的timeRange
 * 确保两者的时间范围信息保持一致
 * @param timelineItem TimelineItem实例
 * @param newTimeRange 新的时间范围（可选，如果不提供则从sprite获取）
 */
export function syncTimeRange(timelineItem: TimelineItem, newTimeRange?: Partial<VideoTimeRange>): void {
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
export function validateTimeRange(timeRange: VideoTimeRange): boolean {
  return (
    timeRange.clipStartTime >= 0 &&
    timeRange.clipEndTime > timeRange.clipStartTime &&
    timeRange.timelineStartTime >= 0 &&
    timeRange.timelineEndTime > timeRange.timelineStartTime
  )
}

/**
 * 计算时间范围重叠
 * @param range1 时间范围1
 * @param range2 时间范围2
 * @returns 重叠时长（秒）
 */
export function calculateTimeRangeOverlap(range1: VideoTimeRange, range2: VideoTimeRange): number {
  const start1 = range1.timelineStartTime / 1000000 // 转换为秒
  const end1 = range1.timelineEndTime / 1000000
  const start2 = range2.timelineStartTime / 1000000
  const end2 = range2.timelineEndTime / 1000000

  const overlapStart = Math.max(start1, start2)
  const overlapEnd = Math.min(end1, end2)

  return Math.max(0, overlapEnd - overlapStart)
}

// ==================== 查找和过滤工具 ====================

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
 * @param sprite CustomVisibleSprite实例
 * @param timelineItems 时间轴项目数组
 * @returns 对应的时间轴项目或null
 */
export function findTimelineItemBySprite(
  sprite: any,
  timelineItems: TimelineItem[],
): TimelineItem | null {
  return timelineItems.find((item) => item.sprite === sprite) || null
}

/**
 * 根据时间查找所有重叠的时间轴项目
 * @param time 时间（秒）
 * @param timelineItems 时间轴项目数组
 * @returns 重叠的时间轴项目数组
 */
export function getTimelineItemsAtTime(
  time: number,
  timelineItems: TimelineItem[],
): TimelineItem[] {
  return timelineItems.filter((item) => {
    const sprite = item.sprite
    const timeRange = sprite.getTimeRange()
    const startTime = timeRange.timelineStartTime / 1000000 // 转换为秒
    const endTime = timeRange.timelineEndTime / 1000000 // 转换为秒
    return time >= startTime && time < endTime
  })
}

/**
 * 根据轨道和时间查找时间轴项目
 * @param trackId 轨道ID
 * @param time 时间（秒）
 * @param timelineItems 时间轴项目数组
 * @returns 找到的时间轴项目或null
 */
export function getTimelineItemAtTrackAndTime(
  trackId: number,
  time: number,
  timelineItems: TimelineItem[],
): TimelineItem | null {
  return (
    timelineItems.find((item) => {
      if (item.trackId !== trackId) return false
      const sprite = item.sprite
      const timeRange = sprite.getTimeRange()
      const startTime = timeRange.timelineStartTime / 1000000 // 转换为秒
      const endTime = timeRange.timelineEndTime / 1000000 // 转换为秒
      return time >= startTime && time < endTime
    }) || null
  )
}

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

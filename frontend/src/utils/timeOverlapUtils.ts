/**
 * 时间重叠检测工具
 * 统一处理所有时间范围重叠检测的逻辑，避免代码重复
 */

import type {
  LocalTimelineItem,
  AsyncProcessingTimelineItem,
  VideoTimeRange,
  ImageTimeRange,
  OverlapTimeRange,
  OverlapResult,
  ConflictInfo,
} from '../types'

// ==================== 核心重叠检测函数 ====================

/**
 * 检测两个时间范围是否重叠
 * @param range1 时间范围1
 * @param range2 时间范围2
 * @returns 重叠检测结果
 */
export function detectTimeRangeOverlap(
  range1: OverlapTimeRange,
  range2: OverlapTimeRange,
): OverlapResult {
  const overlapStart = Math.max(range1.start, range2.start)
  const overlapEnd = Math.min(range1.end, range2.end)
  const hasOverlap = overlapStart < overlapEnd

  return {
    hasOverlap,
    overlapStart,
    overlapEnd,
    overlapDuration: hasOverlap ? overlapEnd - overlapStart : 0,
  }
}

/**
 * 简单的重叠检测 - 只返回布尔值
 * @param range1 时间范围1
 * @param range2 时间范围2
 * @returns 是否重叠
 */
export function isTimeRangeOverlapping(
  range1: OverlapTimeRange,
  range2: OverlapTimeRange,
): boolean {
  return !(range1.end <= range2.start || range2.end <= range1.start)
}

/**
 * 计算重叠时长
 * @param range1 时间范围1
 * @param range2 时间范围2
 * @returns 重叠时长（帧数），无重叠返回0
 */
export function calculateOverlapDuration(
  range1: OverlapTimeRange,
  range2: OverlapTimeRange,
): number {
  const overlapStart = Math.max(range1.start, range2.start)
  const overlapEnd = Math.min(range1.end, range2.end)
  return Math.max(0, overlapEnd - overlapStart)
}

// ==================== TimelineItem 专用函数 ====================

/**
 * 从TimelineItem提取时间范围
 * @param item 时间轴项目
 * @returns 时间范围
 */
export function extractTimeRange(
  item: LocalTimelineItem | AsyncProcessingTimelineItem,
): OverlapTimeRange {
  return {
    start: item.timeRange.timelineStartTime,
    end: item.timeRange.timelineEndTime,
  }
}

/**
 * 检测两个TimelineItem是否重叠
 * @param item1 时间轴项目1
 * @param item2 时间轴项目2
 * @returns 是否重叠
 */
export function isTimelineItemsOverlapping(
  item1: LocalTimelineItem | AsyncProcessingTimelineItem,
  item2: LocalTimelineItem | AsyncProcessingTimelineItem,
): boolean {
  const range1 = extractTimeRange(item1)
  const range2 = extractTimeRange(item2)
  return isTimeRangeOverlapping(range1, range2)
}

/**
 * 检测TimelineItem与指定时间范围是否重叠
 * @param item 时间轴项目
 * @param startTime 开始时间（帧数）
 * @param endTime 结束时间（帧数）
 * @returns 重叠检测结果
 */
export function detectTimelineItemOverlap(
  item: LocalTimelineItem,
  startTime: number,
  endTime: number,
): OverlapResult {
  const itemRange = extractTimeRange(item)
  const targetRange: OverlapTimeRange = { start: startTime, end: endTime }
  return detectTimeRangeOverlap(itemRange, targetRange)
}

// ==================== 轨道级别的重叠检测 ====================

/**
 * 检测TimelineItem在指定轨道上是否与其他项目重叠
 * @param targetItem 目标项目
 * @param trackItems 轨道上的所有项目
 * @param excludeIds 要排除的项目ID列表（如正在拖拽的项目）
 * @returns 是否有重叠
 */
export function hasOverlapInTrack(
  targetItem: LocalTimelineItem | AsyncProcessingTimelineItem,
  trackItems: (LocalTimelineItem | AsyncProcessingTimelineItem)[],
  excludeIds: string[] = [],
): boolean {
  const targetRange = extractTimeRange(targetItem)

  return trackItems.some((item) => {
    // 跳过自己和排除的项目
    if (item.id === targetItem.id || excludeIds.includes(item.id)) {
      return false
    }

    const itemRange = extractTimeRange(item)
    return isTimeRangeOverlapping(targetRange, itemRange)
  })
}

/**
 * 检测指定时间范围在轨道上的冲突
 * @param startTime 开始时间（帧数）
 * @param endTime 结束时间（帧数）
 * @param trackItems 轨道上的所有项目
 * @param excludeIds 要排除的项目ID列表
 * @param getItemName 获取项目名称的函数
 * @returns 冲突信息列表
 */
export function detectTrackConflicts(
  startTime: number,
  endTime: number,
  trackItems: (LocalTimelineItem | AsyncProcessingTimelineItem)[],
  excludeIds: string[] = [],
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = []
  const targetRange: OverlapTimeRange = { start: startTime, end: endTime }

  for (const item of trackItems) {
    // 跳过排除的项目
    if (excludeIds.includes(item.id)) continue

    const itemRange = extractTimeRange(item)
    const overlap = detectTimeRangeOverlap(targetRange, itemRange)

    if (overlap.hasOverlap) {
      conflicts.push({
        itemId: item.id,
        startTime: itemRange.start,
        endTime: itemRange.end,
        overlapStart: overlap.overlapStart,
        overlapEnd: overlap.overlapEnd,
      })
    }
  }

  return conflicts
}

// ==================== 批量重叠检测 ====================

/**
 * 统计轨道组中的重叠项目数量
 * @param timelineItems 所有时间轴项目
 * @returns 重叠项目的数量
 */
export function countOverlappingItems(
  timelineItems: (LocalTimelineItem | AsyncProcessingTimelineItem)[],
): number {
  let count = 0
  const tracks = new Map<string, (LocalTimelineItem | AsyncProcessingTimelineItem)[]>()

  // 按轨道分组
  timelineItems.forEach((item) => {
    if (!tracks.has(item.trackId)) {
      tracks.set(item.trackId, [])
    }
    tracks.get(item.trackId)!.push(item)
  })

  // 检查每个轨道内的重叠
  tracks.forEach((trackItems) => {
    for (let i = 0; i < trackItems.length; i++) {
      for (let j = i + 1; j < trackItems.length; j++) {
        if (isTimelineItemsOverlapping(trackItems[i], trackItems[j])) {
          count++
        }
      }
    }
  })

  return count
}

/**
 * 获取所有重叠的项目对
 * @param timelineItems 所有时间轴项目
 * @param getItemName 获取项目名称的函数
 * @returns 重叠项目对的信息
 */
export function getAllOverlappingPairs(
  timelineItems: LocalTimelineItem[],
  getItemName: (item: LocalTimelineItem) => string = (item) => `Item ${item.id}`,
): Array<{
  trackId: string
  item1: { id: string; name: string; range: OverlapTimeRange }
  item2: { id: string; name: string; range: OverlapTimeRange }
  overlap: OverlapResult
}> {
  const overlappingPairs: Array<{
    trackId: string
    item1: { id: string; name: string; range: OverlapTimeRange }
    item2: { id: string; name: string; range: OverlapTimeRange }
    overlap: OverlapResult
  }> = []

  const tracks = new Map<string, LocalTimelineItem[]>()

  // 按轨道分组
  timelineItems.forEach((item) => {
    if (!tracks.has(item.trackId)) {
      tracks.set(item.trackId, [])
    }
    tracks.get(item.trackId)!.push(item)
  })

  // 检查每个轨道内的重叠
  tracks.forEach((trackItems, trackId) => {
    for (let i = 0; i < trackItems.length; i++) {
      for (let j = i + 1; j < trackItems.length; j++) {
        const item1 = trackItems[i]
        const item2 = trackItems[j]
        const range1 = extractTimeRange(item1)
        const range2 = extractTimeRange(item2)
        const overlap = detectTimeRangeOverlap(range1, range2)

        if (overlap.hasOverlap) {
          overlappingPairs.push({
            trackId,
            item1: { id: item1.id, name: getItemName(item1), range: range1 },
            item2: { id: item2.id, name: getItemName(item2), range: range2 },
            overlap,
          })
        }
      }
    }
  })

  return overlappingPairs
}

// ==================== 兼容性函数 ====================

/**
 * 兼容现有的 calculateTimeRangeOverlap 函数
 * @param range1 视频或图片时间范围1
 * @param range2 视频或图片时间范围2
 * @returns 重叠时长（帧数）
 */
export function calculateTimeRangeOverlap(
  range1: VideoTimeRange | ImageTimeRange,
  range2: VideoTimeRange | ImageTimeRange,
): number {
  const timeRange1: OverlapTimeRange = {
    start: range1.timelineStartTime,
    end: range1.timelineEndTime,
  }
  const timeRange2: OverlapTimeRange = {
    start: range2.timelineStartTime,
    end: range2.timelineEndTime,
  }

  return calculateOverlapDuration(timeRange1, timeRange2)
}

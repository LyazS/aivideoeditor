import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import type { ConflictInfo } from '@/unified/types'

/**
 * 时间轴冲突检测模块
 * 提供时间轴项目冲突检测相关的功能，包括素材库拖拽冲突检测和时间轴项目拖拽冲突检测
 */
export function useTimelineConflictDetection() {
  /**
   * 检测素材库拖拽的重叠冲突
   * @param dropTime 放置时间（帧数）
   * @param targetTrackId 目标轨道ID
   * @param duration 素材时长（帧数）
   * @param trackItems 目标轨道上的所有项目
   * @param excludeItems 需要排除的项目ID列表
   * @returns 冲突信息数组
   */
  function detectMediaItemConflicts(
    dropTime: number,
    targetTrackId: string,
    duration: number,
    trackItems: UnifiedTimelineItemData[],
    excludeItems: string[] = [],
  ): ConflictInfo[] {
    const dragEndTime = dropTime + duration

    // 使用统一的冲突检测工具
    return detectTrackConflicts(
      dropTime,
      dragEndTime,
      trackItems,
      excludeItems, // 没有需要排除的项目
    )
  }

  /**
   * 检测时间轴项目拖拽冲突
   * @param dropTime 放置时间（帧数）
   * @param targetTrackId 目标轨道ID
   * @param dragData 拖拽数据
   * @param trackItems 目标轨道上的所有项目
   * @returns 冲突信息数组
   */
  function detectTimelineConflicts(
    dropTime: number,
    targetTrackId: string,
    dragData: {
      itemId: string
      selectedItems: string[]
    },
    trackItems: UnifiedTimelineItemData[],
  ): ConflictInfo[] {
    // 计算拖拽项目的时长
    const draggedItem = trackItems.find((item) => item.id === dragData.itemId)
    if (!draggedItem) return []

    const dragDuration =
      draggedItem.timeRange.timelineEndTime - draggedItem.timeRange.timelineStartTime // 帧数
    const dragEndTime = dropTime + dragDuration

    // 使用统一的冲突检测工具
    return detectTrackConflicts(
      dropTime,
      dragEndTime,
      trackItems,
      dragData.selectedItems, // 排除正在拖拽的项目
    )
  }

  /**
   * 统一的冲突检测工具
   * @param startTime 开始时间（帧数）
   * @param endTime 结束时间（帧数）
   * @param trackItems 轨道上的所有项目
   * @param excludeItems 需要排除的项目ID列表
   * @returns 冲突信息数组
   */
  function detectTrackConflicts(
    startTime: number,
    endTime: number,
    trackItems: UnifiedTimelineItemData[],
    excludeItems: string[] = [],
  ): ConflictInfo[] {
    const conflicts: ConflictInfo[] = []

    for (const item of trackItems) {
      // 跳过被排除的项目
      if (excludeItems.includes(item.id)) {
        continue
      }

      const itemStart = item.timeRange.timelineStartTime
      const itemEnd = item.timeRange.timelineEndTime

      // 检查时间重叠
      if (startTime < itemEnd && endTime > itemStart) {
        conflicts.push({
          itemId: item.id,
          startTime: Math.max(startTime, itemStart),
          endTime: Math.min(endTime, itemEnd),
        } as ConflictInfo)
      }
    }

    return conflicts
  }

  return {
    // 方法
    detectMediaItemConflicts,
    detectTimelineConflicts,
    detectTrackConflicts,
  }
}

/**
 * 统一时间范围工具函数
 * 基于新架构的统一类型系统，适用于UnifiedTimelineItemData
 */

import type { UnifiedTimelineItemData } from '../timelineitem/TimelineItemData'
import type { BaseTimeRange } from '../../types'
import { isReady } from '../timelineitem/TimelineItemQueries'

// ==================== 时间范围同步工具 ====================

/**
 * 同步UnifiedTimelineItem和sprite的timeRange
 * 确保两者的时间范围信息保持一致
 * @param timelineItem UnifiedTimelineItemData实例
 * @param newTimeRange 新的时间范围（可选，如果不提供则从sprite获取）
 */
export function syncTimeRange(
  timelineItem: UnifiedTimelineItemData,
  newTimeRange?: Partial<BaseTimeRange>,
): void {
  // 只有就绪状态的时间轴项目才有sprite
  if (!isReady(timelineItem) || !timelineItem.sprite) {
    // 对于非就绪状态的项目，直接更新timeRange
    if (newTimeRange) {
      const completeTimeRange = {
        ...timelineItem.timeRange,
        ...newTimeRange,
      }
      
      // 验证时间范围有效性
      if (completeTimeRange.timelineEndTime <= completeTimeRange.timelineStartTime) {
        console.warn('⚠️ 无效的时间范围：结束时间必须大于开始时间', completeTimeRange)
        return
      }
      
      if (completeTimeRange.timelineStartTime < 0) {
        console.warn('⚠️ 无效的时间范围：开始时间不能为负数', completeTimeRange)
        return
      }
      
      timelineItem.timeRange = completeTimeRange
      
      console.log('🔄 同步timeRange (非就绪状态):', {
        timelineItemId: timelineItem.id,
        status: timelineItem.timelineStatus,
        timeRange: completeTimeRange,
      })
    }
    return
  }

  const sprite = timelineItem.sprite

  if (newTimeRange) {
    // 如果提供了新的时间范围，同时更新sprite和TimelineItem
    const completeTimeRange = {
      ...sprite.getTimeRange(),
      ...newTimeRange,
    }

    // 验证时间范围有效性
    if (completeTimeRange.timelineEndTime <= completeTimeRange.timelineStartTime) {
      console.warn('⚠️ 无效的时间范围：结束时间必须大于开始时间', completeTimeRange)
      return
    }
    
    if (completeTimeRange.timelineStartTime < 0) {
      console.warn('⚠️ 无效的时间范围：开始时间不能为负数', completeTimeRange)
      return
    }

    // sprite.setTimeRange会在内部自动计算effectiveDuration
    sprite.setTimeRange(completeTimeRange)
    // 从sprite获取更新后的完整timeRange（包含自动计算的effectiveDuration）
    timelineItem.timeRange = sprite.getTimeRange()

    console.log('🔄 同步timeRange (提供新值):', {
      timelineItemId: timelineItem.id,
      status: timelineItem.timelineStatus,
      timeRange: completeTimeRange,
    })
  } else {
    // 如果没有提供新值，从sprite同步到TimelineItem
    const spriteTimeRange = sprite.getTimeRange()
    timelineItem.timeRange = spriteTimeRange

    console.log('🔄 同步timeRange (从sprite获取):', {
      timelineItemId: timelineItem.id,
      status: timelineItem.timelineStatus,
      timeRange: spriteTimeRange,
    })
  }
}

// ==================== 时间范围验证工具 ====================

/**
 * 验证基础时间范围是否有效
 * @param timeRange 基础时间范围
 * @returns 是否有效
 */
export function validateBaseTimeRange(timeRange: BaseTimeRange): boolean {
  // 基础验证：时间轴时间范围
  return (
    timeRange.timelineStartTime >= 0 && 
    timeRange.timelineEndTime > timeRange.timelineStartTime
  )
}

/**
 * 验证UnifiedTimelineItem的时间范围是否有效
 * @param timelineItem UnifiedTimelineItemData实例
 * @returns 验证结果
 */
export function validateTimelineItemTimeRange(timelineItem: UnifiedTimelineItemData): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  // 基础时间范围验证
  if (!validateBaseTimeRange(timelineItem.timeRange)) {
    if (timelineItem.timeRange.timelineStartTime < 0) {
      errors.push('时间轴开始时间不能为负数')
    }
    if (timelineItem.timeRange.timelineEndTime <= timelineItem.timeRange.timelineStartTime) {
      errors.push('时间轴结束时间必须大于开始时间')
    }
  }
  
  // 如果是就绪状态且有sprite，验证sprite的时间范围一致性
  if (isReady(timelineItem) && timelineItem.sprite) {
    try {
      const spriteTimeRange = timelineItem.sprite.getTimeRange()
      
      // 检查时间范围是否同步
      if (Math.abs(spriteTimeRange.timelineStartTime - timelineItem.timeRange.timelineStartTime) > 0.1) {
        errors.push('时间轴项目与sprite的开始时间不同步')
      }
      
      if (Math.abs(spriteTimeRange.timelineEndTime - timelineItem.timeRange.timelineEndTime) > 0.1) {
        errors.push('时间轴项目与sprite的结束时间不同步')
      }
    } catch (error) {
      errors.push(`无法获取sprite时间范围: ${error}`)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// ==================== 时间范围计算工具 ====================

/**
 * 计算时间轴项目的持续时长（帧数）
 * @param timelineItem UnifiedTimelineItemData实例
 * @returns 持续时长（帧数）
 */
export function calculateDuration(timelineItem: UnifiedTimelineItemData): number {
  return timelineItem.timeRange.timelineEndTime - timelineItem.timeRange.timelineStartTime
}

/**
 * 检查时间轴项目是否包含指定时间点
 * @param timelineItem UnifiedTimelineItemData实例
 * @param frame 时间点（帧数）
 * @returns 是否包含该时间点
 */
export function containsFrame(timelineItem: UnifiedTimelineItemData, frame: number): boolean {
  return frame >= timelineItem.timeRange.timelineStartTime && 
         frame < timelineItem.timeRange.timelineEndTime
}

/**
 * 检查两个时间轴项目的时间范围是否重叠
 * @param item1 时间轴项目1
 * @param item2 时间轴项目2
 * @returns 是否重叠
 */
export function isTimeRangeOverlapping(
  item1: UnifiedTimelineItemData, 
  item2: UnifiedTimelineItemData
): boolean {
  return !(
    item1.timeRange.timelineEndTime <= item2.timeRange.timelineStartTime ||
    item2.timeRange.timelineEndTime <= item1.timeRange.timelineStartTime
  )
}

/**
 * 计算两个时间轴项目的重叠时长
 * @param item1 时间轴项目1
 * @param item2 时间轴项目2
 * @returns 重叠时长（帧数），无重叠返回0
 */
export function calculateOverlapDuration(
  item1: UnifiedTimelineItemData, 
  item2: UnifiedTimelineItemData
): number {
  const overlapStart = Math.max(item1.timeRange.timelineStartTime, item2.timeRange.timelineStartTime)
  const overlapEnd = Math.min(item1.timeRange.timelineEndTime, item2.timeRange.timelineEndTime)
  return Math.max(0, overlapEnd - overlapStart)
}

// ==================== 时间范围操作工具 ====================

/**
 * 移动时间轴项目到新位置
 * @param timelineItem UnifiedTimelineItemData实例
 * @param newStartTime 新的开始时间（帧数）
 * @returns 是否成功移动
 */
export function moveTimelineItem(
  timelineItem: UnifiedTimelineItemData, 
  newStartTime: number
): boolean {
  if (newStartTime < 0) {
    console.warn('⚠️ 无法移动到负数位置:', newStartTime)
    return false
  }
  
  const duration = calculateDuration(timelineItem)
  const newTimeRange: BaseTimeRange = {
    timelineStartTime: newStartTime,
    timelineEndTime: newStartTime + duration
  }
  
  syncTimeRange(timelineItem, newTimeRange)
  return true
}

/**
 * 调整时间轴项目的时长
 * @param timelineItem UnifiedTimelineItemData实例
 * @param newDuration 新的时长（帧数）
 * @returns 是否成功调整
 */
export function resizeTimelineItem(
  timelineItem: UnifiedTimelineItemData, 
  newDuration: number
): boolean {
  if (newDuration <= 0) {
    console.warn('⚠️ 时长必须大于0:', newDuration)
    return false
  }
  
  const newTimeRange: BaseTimeRange = {
    timelineStartTime: timelineItem.timeRange.timelineStartTime,
    timelineEndTime: timelineItem.timeRange.timelineStartTime + newDuration
  }
  
  syncTimeRange(timelineItem, newTimeRange)
  return true
}

/**
 * 裁剪时间轴项目到指定范围
 * @param timelineItem UnifiedTimelineItemData实例
 * @param startTime 裁剪开始时间（帧数）
 * @param endTime 裁剪结束时间（帧数）
 * @returns 是否成功裁剪
 */
export function trimTimelineItem(
  timelineItem: UnifiedTimelineItemData,
  startTime: number,
  endTime: number
): boolean {
  if (startTime < 0 || endTime <= startTime) {
    console.warn('⚠️ 无效的裁剪范围:', { startTime, endTime })
    return false
  }
  
  const newTimeRange: BaseTimeRange = {
    timelineStartTime: startTime,
    timelineEndTime: endTime
  }
  
  syncTimeRange(timelineItem, newTimeRange)
  return true
}

// ==================== 导出工具集合 ====================

export const UnifiedTimeRangeUtils = {
  // 同步工具
  syncTimeRange,
  
  // 验证工具
  validateBaseTimeRange,
  validateTimelineItemTimeRange,
  
  // 计算工具
  calculateDuration,
  containsFrame,
  isTimeRangeOverlapping,
  calculateOverlapDuration,
  
  // 操作工具
  moveTimelineItem,
  resizeTimelineItem,
  trimTimelineItem
}

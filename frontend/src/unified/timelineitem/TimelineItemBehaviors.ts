/**
 * 统一时间轴项目行为函数
 * 基于"核心数据与行为分离"的重构方案 - 无状态纯函数
 */

import type {
  UnifiedTimelineItemData,
  TimelineItemStatus,
  UnknownTimelineItem,
  GetTimelineItemConfig,
} from './TimelineItemData'
import type { UnifiedTimeRange } from '../types/timeRange'
import { VALID_TIMELINE_TRANSITIONS } from './TimelineItemData'
import type { MediaType } from '../../types'

// ==================== 状态转换行为函数 ====================
// 注意：状态转换函数已被删除，因为未被使用
// 如果需要状态转换功能，请直接修改 timelineStatus 属性

// ==================== 查询函数 ====================

/**
 * 状态转换验证函数
 */
export function canTransitionTo(
  data: UnifiedTimelineItemData,
  newStatus: TimelineItemStatus,
): boolean {
  // 3状态间的简单规则
  const allowed = VALID_TIMELINE_TRANSITIONS[data.timelineStatus]
  return allowed?.includes(newStatus) ?? false
}

/**
 * 检查是否为就绪状态
 */
export function isReady(data: UnifiedTimelineItemData<MediaType>): boolean {
  return data.timelineStatus === 'ready' && !!data.runtime.sprite
}

/**
 * 检查是否正在加载
 */
export function isLoading(data: UnifiedTimelineItemData<MediaType>): boolean {
  return data.timelineStatus === 'loading'
}

/**
 * 检查是否有错误
 */
export function hasError(data: UnifiedTimelineItemData<MediaType>): boolean {
  return data.timelineStatus === 'error'
}

/**
 * 获取项目持续时间（帧数）
 */
export function getDuration(data: UnifiedTimelineItemData<MediaType>): number {
  return data.timeRange.timelineEndTime - data.timeRange.timelineStartTime
}

/**
 * 检查时间范围是否有效
 */
export function hasValidTimeRange(data: UnifiedTimelineItemData): boolean {
  return (
    data.timeRange.timelineEndTime > data.timeRange.timelineStartTime &&
    data.timeRange.timelineStartTime >= 0
  )
}

// ==================== 时间范围操作函数 ====================

/**
 * 更新时间范围
 */
export function updateTimeRange(data: UnifiedTimelineItemData, newRange: UnifiedTimeRange): void {
  if (newRange.timelineEndTime <= newRange.timelineStartTime) {
    throw new Error('结束时间必须大于开始时间')
  }

  if (newRange.timelineStartTime < 0) {
    throw new Error('开始时间不能为负数')
  }

  data.timeRange = newRange // ✅ 响应式更新

  // 如果有sprite，同步更新sprite的时间范围
  if (data.runtime.sprite) {
    updateSpriteTimeRange(data, newRange)
  }
}

/**
 * 移动时间轴项目位置
 */
export function moveTimelineItem(data: UnifiedTimelineItemData, newStartTime: number): void {
  const duration = getDuration(data)
  updateTimeRange(data, {
    timelineStartTime: newStartTime,
    timelineEndTime: newStartTime + duration,
    clipStartTime: data.timeRange.clipStartTime,
    clipEndTime: data.timeRange.clipEndTime,
  })
}

/**
 * 调整项目持续时间
 */
export function resizeTimelineItem(data: UnifiedTimelineItemData, newDuration: number): void {
  if (newDuration <= 0) {
    throw new Error('持续时间必须大于0')
  }

  updateTimeRange(data, {
    timelineStartTime: data.timeRange.timelineStartTime,
    timelineEndTime: data.timeRange.timelineStartTime + newDuration,
    clipStartTime: data.timeRange.clipStartTime,
    clipEndTime: data.timeRange.clipEndTime,
  })
}

/**
 * 更新Sprite时间范围（异步）
 */
async function updateSpriteTimeRange(
  data: UnifiedTimelineItemData,
  timeRange: UnifiedTimeRange,
): Promise<void> {
  if (!data.runtime.sprite) return

  try {
    const { updateSpriteTimeRange } = await import('./TimelineItemSpriteOperations')
    updateSpriteTimeRange(data.runtime.sprite, timeRange)
  } catch (error) {
    console.error('更新Sprite时间范围失败:', error)
  }
}

// ==================== 类型转换函数 ====================

/**
 * 将未知类型的时间轴项目转换为已知类型
 * 用于异步处理完成后的类型转换
 */
// 注意：convertUnknownToKnown 函数已被移除，因为不再支持 unknown 类型的时间轴项目
// 如果需要类型转换，应该在媒体项目层面完成，然后重新创建时间轴项目

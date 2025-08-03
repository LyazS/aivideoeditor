/**
 * 统一时间轴项目行为函数
 * 基于"核心数据与行为分离"的重构方案 - 无状态纯函数
 */

import type { MediaTypeOrUnknown } from '../mediaitem'
import type {
  UnifiedTimelineItemData,
  TimelineItemStatus,
  UnknownTimelineItem,
  GetTimelineItemConfig
} from './TimelineItemData'
import type { UnifiedTimeRange } from '../types/timeRange'
import { VALID_TIMELINE_TRANSITIONS } from './TimelineItemData'
import type { MediaType } from '../../types'



// ==================== 状态转换行为函数 ====================

/**
 * 状态转换行为函数 - 无状态纯函数
 * 基于简化的3状态转换，状态显示信息通过关联媒体项目计算
 */
export async function transitionTimelineStatus(
  data: UnifiedTimelineItemData,
  newStatus: TimelineItemStatus
): Promise<void> {
  if (!canTransitionTo(data, newStatus)) {
    throw new Error(`Invalid timeline transition: ${data.timelineStatus} → ${newStatus}`)
  }

  const oldStatus = data.timelineStatus
  data.timelineStatus = newStatus // ✅ 自动触发响应式更新

  // 精灵生命周期管理 - 更清晰的3分支
  await handleSpriteLifecycle(data, oldStatus, newStatus)

  console.log(`✅ 时间轴项目状态转换: ${oldStatus} → ${newStatus}`)
}

/**
 * Sprite生命周期管理函数
 */
async function handleSpriteLifecycle(
  data: UnifiedTimelineItemData,
  oldStatus: TimelineItemStatus,
  newStatus: TimelineItemStatus
): Promise<void> {
  
  switch (newStatus) {
    case 'ready':
      // 只在ready时创建sprite，所有准备工作已完成
      if (oldStatus !== 'ready') {
        await createSprite(data)
      }
      break

    case 'loading':           // 保持现状不变
    case 'error':            // 清理资源
    default:
      if (oldStatus === 'ready') {
        await destroySprite(data)
      }
  }
}

/**
 * 创建Sprite函数
 */
async function createSprite(data: UnifiedTimelineItemData): Promise<void> {
  // 检查时间轴项目是否为就绪状态
  if (data.timelineStatus !== 'ready') {
    throw new Error('时间轴项目必须为就绪状态才能创建Sprite')
  }

  // 获取关联的媒体项目 - 需要从全局状态或传入的上下文中获取
  // 这里暂时使用 null，实际使用时需要传入正确的媒体数据
  // TODO: 重构为接受媒体数据参数或从全局状态获取
  const mediaData = null // await getMediaItem(data.mediaItemId)
  if (!mediaData) {
    console.warn('无法找到关联的媒体项目，跳过Sprite创建')
    return
  }

  // 通过新的方式创建Sprite
  const { createSpriteForTimelineData } = await import('./TimelineItemSpriteOperations')

  // 需要获取AVCanvas实例，这里暂时使用占位符
  const avCanvas = null as any // TODO: 需要从外部传入AVCanvas实例

  await createSpriteForTimelineData(data, mediaData, avCanvas)
}

/**
 * 销毁Sprite函数
 */
async function destroySprite(data: UnifiedTimelineItemData): Promise<void> {
  if (!data.runtime.sprite) {
    return
  }

  // 动态导入以避免循环依赖
  const { destroySpriteForTimelineData } = await import('./TimelineItemSpriteOperations')

  // 需要获取AVCanvas实例，这里暂时使用占位符
  const avCanvas = null as any // TODO: 需要从外部传入AVCanvas实例

  await destroySpriteForTimelineData(data, avCanvas)
}

// ==================== 查询函数 ====================

/**
 * 状态转换验证函数
 */
export function canTransitionTo(
  data: UnifiedTimelineItemData,
  newStatus: TimelineItemStatus
): boolean {
  // 3状态间的简单规则
  const allowed = VALID_TIMELINE_TRANSITIONS[data.timelineStatus]
  return allowed?.includes(newStatus) ?? false
}

/**
 * 检查是否为就绪状态
 */
export function isReady(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): boolean {
  return data.timelineStatus === 'ready' && !!data.runtime.sprite
}

/**
 * 检查是否正在加载
 */
export function isLoading(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): boolean {
  return data.timelineStatus === 'loading'
}

/**
 * 检查是否有错误
 */
export function hasError(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): boolean {
  return data.timelineStatus === 'error'
}

/**
 * 获取项目持续时间（帧数）
 */
export function getDuration(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): number {
  return data.timeRange.timelineEndTime - data.timeRange.timelineStartTime
}

/**
 * 检查时间范围是否有效
 */
export function hasValidTimeRange(data: UnifiedTimelineItemData): boolean {
  return data.timeRange.timelineEndTime > data.timeRange.timelineStartTime &&
         data.timeRange.timelineStartTime >= 0
}

// ==================== 简化的状态转换函数 ====================

/**
 * 设置为加载状态
 */
export function setLoading(data: UnifiedTimelineItemData): Promise<void> {
  return transitionTimelineStatus(data, 'loading')
}

/**
 * 设置为就绪状态
 */
export function setReady(data: UnifiedTimelineItemData): Promise<void> {
  return transitionTimelineStatus(data, 'ready')
}

/**
 * 设置错误状态
 */
export function setError(data: UnifiedTimelineItemData): Promise<void> {
  return transitionTimelineStatus(data, 'error')
}

/**
 * 重置为加载状态（用于重试）
 */
export function resetToLoading(data: UnifiedTimelineItemData): Promise<void> {
  return transitionTimelineStatus(data, 'loading')
}



// ==================== 时间范围操作函数 ====================

/**
 * 更新时间范围
 */
export function updateTimeRange(
  data: UnifiedTimelineItemData,
  newRange: UnifiedTimeRange
): void {
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
export function moveTimelineItem(
  data: UnifiedTimelineItemData,
  newStartTime: number
): void {
  const duration = getDuration(data)
  updateTimeRange(data, {
    timelineStartTime: newStartTime,
    timelineEndTime: newStartTime + duration,
    clipStartTime: data.timeRange.clipStartTime,
    clipEndTime: data.timeRange.clipEndTime
  })
}

/**
 * 调整项目持续时间
 */
export function resizeTimelineItem(
  data: UnifiedTimelineItemData,
  newDuration: number
): void {
  if (newDuration <= 0) {
    throw new Error('持续时间必须大于0')
  }

  updateTimeRange(data, {
    timelineStartTime: data.timeRange.timelineStartTime,
    timelineEndTime: data.timeRange.timelineStartTime + newDuration,
    clipStartTime: data.timeRange.clipStartTime,
    clipEndTime: data.timeRange.clipEndTime
  })
}

/**
 * 更新Sprite时间范围（异步）
 */
async function updateSpriteTimeRange(
  data: UnifiedTimelineItemData,
  timeRange: UnifiedTimeRange
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
export function convertUnknownToKnown<T extends MediaType>(
  unknownItem: UnknownTimelineItem,
  newMediaType: T,
  newConfig: GetTimelineItemConfig<T>,
  newTimeRange: UnifiedTimeRange
): UnifiedTimelineItemData<T> {
  return {
    ...unknownItem,
    mediaType: newMediaType,
    config: newConfig,
    timeRange: newTimeRange,
  } as UnifiedTimelineItemData<T>
}

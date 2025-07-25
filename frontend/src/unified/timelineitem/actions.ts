/**
 * 统一时间轴项目行为函数
 * 提供无状态的操作和状态转换功能
 */

import type { 
  UnifiedTimelineItem, 
  TimelineItemStatus, 
  TimelineStatusContext,
  BasicTimelineConfig
} from './types'
import { UnifiedTimelineItemQueries } from './queries'



// ==================== 行为函数 ====================

/**
 * 统一时间轴项目行为函数 - 无状态操作函数
 */
export const UnifiedTimelineItemActions = {
  // ==================== 状态转换 ====================

  /**
   * 状态转换 - 统一3状态驱动
   * @param item 时间轴项目
   * @param newStatus 新状态
   * @param context 状态上下文
   * @returns 是否转换成功
   */
  transitionTo(
    item: UnifiedTimelineItem,
    newStatus: TimelineItemStatus,
    context?: TimelineStatusContext
  ): boolean {
    // 验证状态转换的合法性
    if (!UnifiedTimelineItemQueries.canTransitionTo(item, newStatus)) {
      console.warn(`🚨 [TimelineItem] 无效状态转换: ${item.timelineStatus} → ${newStatus} (${item.config.name})`)
      return false
    }

    const oldStatus = item.timelineStatus
    const timestamp = Date.now()

    // 执行状态转换
    item.timelineStatus = newStatus
    
    // 更新状态上下文
    if (context) {
      item.statusContext = {
        ...context,
        timestamp: context.timestamp || timestamp
      }
    }

    // 状态变化已完成，Vue3响应式系统会自动通知相关组件

    console.log(`✅ [TimelineItem] 状态转换成功: ${item.config.name} ${oldStatus} → ${newStatus}`)
    return true
  },

  /**
   * 转换到加载状态
   */
  transitionToLoading(item: UnifiedTimelineItem, context?: TimelineStatusContext): boolean {
    return this.transitionTo(item, 'loading', context)
  },

  /**
   * 转换到就绪状态
   */
  transitionToReady(item: UnifiedTimelineItem, context?: TimelineStatusContext): boolean {
    return this.transitionTo(item, 'ready', context)
  },

  /**
   * 转换到错误状态
   */
  transitionToError(item: UnifiedTimelineItem, context?: TimelineStatusContext): boolean {
    return this.transitionTo(item, 'error', context)
  },

  // ==================== 配置管理 ====================

  /**
   * 更新基础配置
   */
  updateConfig(item: UnifiedTimelineItem, config: Partial<BasicTimelineConfig>): void {
    item.config = {
      ...item.config,
      ...config
    }
    
    console.log(`📝 [TimelineItem] 配置已更新: ${item.config.name}`)
  },

  /**
   * 更新显示名称
   */
  updateName(item: UnifiedTimelineItem, name: string): void {
    this.updateConfig(item, { name })
  },

  /**
   * 更新媒体配置
   */
  updateMediaConfig(item: UnifiedTimelineItem, mediaConfig: any): void {
    this.updateConfig(item, { mediaConfig })
  },

  // ==================== 时间范围管理 ====================

  /**
   * 更新时间范围
   */
  updateTimeRange(
    item: UnifiedTimelineItem, 
    timeRange: Partial<UnifiedTimelineItem['timeRange']>
  ): void {
    item.timeRange = {
      ...item.timeRange,
      ...timeRange
    }
    
    console.log(`⏱️ [TimelineItem] 时间范围已更新: ${item.config.name}`)
  },

  /**
   * 设置开始时间
   */
  setStartTime(item: UnifiedTimelineItem, startTime: number): void {
    const duration = item.timeRange.timelineEndTime - item.timeRange.timelineStartTime
    this.updateTimeRange(item, {
      timelineStartTime: startTime,
      timelineEndTime: startTime + duration
    })
  },

  /**
   * 设置结束时间
   */
  setEndTime(item: UnifiedTimelineItem, endTime: number): void {
    this.updateTimeRange(item, {
      timelineEndTime: endTime
    })
  },

  /**
   * 设置持续时间
   */
  setDuration(item: UnifiedTimelineItem, duration: number): void {
    this.updateTimeRange(item, {
      timelineEndTime: item.timeRange.timelineStartTime + duration
    })
  },

  // ==================== Sprite管理 ====================

  /**
   * 设置Sprite对象
   */
  setSprite(item: UnifiedTimelineItem, sprite: any): void {
    item.sprite = sprite
    console.log(`🎭 [TimelineItem] Sprite已设置: ${item.config.name}`)
  },

  /**
   * 清除Sprite对象
   */
  clearSprite(item: UnifiedTimelineItem): void {
    item.sprite = undefined
    console.log(`🗑️ [TimelineItem] Sprite已清除: ${item.config.name}`)
  },

  // ==================== 媒体类型管理 ====================

  /**
   * 更新媒体类型
   */
  updateMediaType(item: UnifiedTimelineItem, mediaType: string): void {
    item.mediaType = mediaType as any
    console.log(`🎬 [TimelineItem] 媒体类型已更新: ${item.config.name} → ${mediaType}`)
  },

  // ==================== 便捷操作 ====================

  /**
   * 重试操作（从错误状态恢复）
   */
  retry(item: UnifiedTimelineItem): boolean {
    if (!UnifiedTimelineItemQueries.canRetry(item)) {
      console.warn(`🚨 [TimelineItem] 无法重试: ${item.config.name} (当前状态: ${item.timelineStatus})`)
      return false
    }

    return this.transitionToLoading(item, {
      stage: 'processing',
      message: '正在重试...',
      timestamp: Date.now()
    } as any)
  },

  /**
   * 取消操作（从加载状态取消）
   */
  cancel(item: UnifiedTimelineItem): boolean {
    if (!UnifiedTimelineItemQueries.canCancel(item)) {
      console.warn(`🚨 [TimelineItem] 无法取消: ${item.config.name} (当前状态: ${item.timelineStatus})`)
      return false
    }

    return this.transitionToError(item, {
      stage: 'error',
      message: '操作已取消',
      error: {
        code: 'CANCELLED',
        message: '用户取消了操作',
        recoverable: true
      },
      timestamp: Date.now()
    } as any)
  },

  /**
   * 重置项目状态
   */
  reset(item: UnifiedTimelineItem): boolean {
    // 清除sprite
    this.clearSprite(item)
    
    // 重置到加载状态
    return this.transitionToLoading(item, {
      stage: 'processing',
      message: '正在重置...',
      timestamp: Date.now()
    } as any)
  },

  // ==================== 批量操作 ====================

  /**
   * 批量状态转换
   */
  batchTransition(
    items: UnifiedTimelineItem[],
    newStatus: TimelineItemStatus,
    context?: TimelineStatusContext
  ): { success: UnifiedTimelineItem[]; failed: UnifiedTimelineItem[] } {
    const success: UnifiedTimelineItem[] = []
    const failed: UnifiedTimelineItem[] = []

    items.forEach(item => {
      if (this.transitionTo(item, newStatus, context)) {
        success.push(item)
      } else {
        failed.push(item)
      }
    })

    console.log(`📦 [TimelineItem] 批量状态转换完成: 成功 ${success.length}, 失败 ${failed.length}`)
    return { success, failed }
  }
}

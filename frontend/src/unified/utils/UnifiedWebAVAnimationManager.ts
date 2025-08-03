/**
 * 统一WebAV动画管理器
 * 基于新架构的统一类型系统，负责管理UnifiedTimelineItemData的WebAV动画
 */

import type { UnifiedTimelineItemData } from '../timelineitem/TimelineItemData'
import { isReady } from '../timelineitem/TimelineItemQueries'

// ==================== 统一WebAV动画管理器 ====================

/**
 * 统一WebAV动画管理器类
 * 管理单个UnifiedTimelineItemData的WebAV动画
 */
export class UnifiedWebAVAnimationManager {
  private timelineItem: UnifiedTimelineItemData
  private isDestroyed: boolean = false

  constructor(timelineItem: UnifiedTimelineItemData) {
    this.timelineItem = timelineItem
  }

  /**
   * 更新WebAV动画
   * 将UnifiedTimelineItemData的动画配置应用到WebAV sprite
   */
  public async updateAnimation(): Promise<void> {
    if (this.isDestroyed) return

    // 只有就绪状态的时间轴项目才有sprite
    if (!isReady(this.timelineItem) || !this.timelineItem.runtime.sprite) {
      console.warn('🎬 [Unified WebAV Animation] No sprite found or item not ready:', this.timelineItem.id)
      return
    }

    try {
      // TODO: 新架构中暂时不支持动画，直接清除
      await this.clearAnimation()
    } catch (error) {
      console.error('🎬 [Unified WebAV Animation] Failed to update animation:', error)
    }
  }

  /**
   * 清除WebAV动画
   */
  public async clearAnimation(): Promise<void> {
    if (this.isDestroyed) return

    if (!isReady(this.timelineItem) || !this.timelineItem.runtime.sprite) {
      return
    }

    const sprite = this.timelineItem.runtime.sprite

    try {
      // 清除WebAV动画（传入空的关键帧）
      sprite.setAnimation({}, { duration: 0, iterCount: 1 })

      console.log('🎬 [Unified WebAV Animation] Animation cleared for:', this.timelineItem.id)
    } catch (error) {
      console.error('🎬 [Unified WebAV Animation] Failed to clear animation:', error)
    }
  }

  /**
   * 销毁管理器
   */
  public destroy(): void {
    this.isDestroyed = true
    console.log('🎬 [Unified WebAV Animation] Manager destroyed for:', this.timelineItem.id)
  }
}

// ==================== 全局动画管理器 ====================

/**
 * 全局统一WebAV动画管理器
 * 管理所有UnifiedTimelineItemData的动画
 */
class GlobalUnifiedWebAVAnimationManager {
  private managers = new Map<string, UnifiedWebAVAnimationManager>()

  /**
   * 添加动画管理器
   */
  public addManager(timelineItem: UnifiedTimelineItemData): UnifiedWebAVAnimationManager {
    const manager = new UnifiedWebAVAnimationManager(timelineItem)
    this.managers.set(timelineItem.id, manager)
    return manager
  }

  /**
   * 移除动画管理器
   */
  public removeManager(itemId: string): void {
    const manager = this.managers.get(itemId)
    if (manager) {
      manager.destroy()
      this.managers.delete(itemId)
    }
  }

  /**
   * 获取动画管理器
   */
  public getManager(itemId: string): UnifiedWebAVAnimationManager | undefined {
    return this.managers.get(itemId)
  }

  /**
   * 清理所有管理器
   */
  public clearAll(): void {
    this.managers.forEach((manager) => {
      manager.destroy()
    })
    this.managers.clear()
  }

  /**
   * 获取管理器数量
   */
  public getManagerCount(): number {
    return this.managers.size
  }
}

// 导出全局实例
export const globalUnifiedWebAVAnimationManager = new GlobalUnifiedWebAVAnimationManager()

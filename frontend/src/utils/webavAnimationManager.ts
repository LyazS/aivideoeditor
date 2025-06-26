/**
 * WebAV动画管理器
 * 负责将关键帧动画配置应用到WebAV sprite，并管理动画的生命周期
 */

import type { TimelineItem, AnimationConfig, CustomSprite } from '../types'
import { convertToWebAVAnimation, isValidAnimationConfig } from './animationConverter'
import { hasAnimation, isAnimationEnabled } from './keyframeUtils'

// ==================== WebAV动画管理器 ====================

/**
 * WebAV动画管理器类
 * 管理单个TimelineItem的WebAV动画
 */
export class WebAVAnimationManager {
  private timelineItem: TimelineItem
  private isDestroyed: boolean = false

  constructor(timelineItem: TimelineItem) {
    this.timelineItem = timelineItem
  }

  /**
   * 更新WebAV动画
   * 将TimelineItem的动画配置应用到WebAV sprite
   */
  public async updateAnimation(): Promise<void> {
    if (this.isDestroyed) return

    const sprite = this.timelineItem.sprite
    if (!sprite) {
      console.warn('🎬 [WebAV Animation] No sprite found for TimelineItem:', this.timelineItem.id)
      return
    }

    try {
      // 检查是否有有效的动画配置
      if (!hasAnimation(this.timelineItem) || !isAnimationEnabled(this.timelineItem)) {
        // 清除现有动画
        await this.clearAnimation()
        return
      }

      const animationConfig = this.timelineItem.animation!
      
      // 验证动画配置
      if (!isValidAnimationConfig(animationConfig)) {
        console.warn('🎬 [WebAV Animation] Invalid animation config for:', this.timelineItem.id)
        return
      }

      // 获取画布和精灵尺寸信息
      const sprite = this.timelineItem.sprite
      // 动态导入videoStore来获取画布尺寸
      const { useVideoStore } = await import('../stores/videoStore')
      const videoStore = useVideoStore()
      const canvasWidth = videoStore.videoResolution.width
      const canvasHeight = videoStore.videoResolution.height
      const spriteWidth = this.timelineItem.width
      const spriteHeight = this.timelineItem.height

      // 转换为WebAV格式
      const webavConfig = convertToWebAVAnimation(
        animationConfig,
        this.timelineItem.timeRange,
        canvasWidth,
        canvasHeight,
        spriteWidth,
        spriteHeight
      )

      // 检查是否有关键帧
      if (Object.keys(webavConfig.keyframes).length === 0) {
        console.warn('🎬 [WebAV Animation] No keyframes to apply for:', this.timelineItem.id)
        await this.clearAnimation()
        return
      }

      // 应用动画到WebAV sprite
      sprite.setAnimation(webavConfig.keyframes, webavConfig.options)

      console.log('🎬 [WebAV Animation] Animation applied successfully:', {
        itemId: this.timelineItem.id,
        keyframeCount: Object.keys(webavConfig.keyframes).length,
        duration: webavConfig.options.duration,
        keyframes: webavConfig.keyframes
      })

    } catch (error) {
      console.error('🎬 [WebAV Animation] Failed to update animation:', error)
    }
  }

  /**
   * 清除WebAV动画
   */
  public async clearAnimation(): Promise<void> {
    if (this.isDestroyed) return

    const sprite = this.timelineItem.sprite
    if (!sprite) return

    try {
      // 清除WebAV动画（传入空的关键帧）
      sprite.setAnimation({}, { duration: 0, iterCount: 1 })
      
      console.log('🎬 [WebAV Animation] Animation cleared for:', this.timelineItem.id)
    } catch (error) {
      console.error('🎬 [WebAV Animation] Failed to clear animation:', error)
    }
  }

  /**
   * 强制同步当前属性值到sprite
   * 用于在没有动画时确保sprite属性与TimelineItem一致
   */
  public syncPropertiesToSprite(): void {
    if (this.isDestroyed) return

    const sprite = this.timelineItem.sprite
    if (!sprite) return

    try {
      // 同步位置和尺寸
      sprite.rect = {
        x: this.timelineItem.x,
        y: this.timelineItem.y,
        w: this.timelineItem.width,
        h: this.timelineItem.height,
        angle: this.timelineItem.rotation
      }

      // 同步透明度
      sprite.opacity = this.timelineItem.opacity

      // 同步层级
      sprite.zIndex = this.timelineItem.zIndex

      console.log('🎬 [WebAV Animation] Properties synced to sprite:', {
        itemId: this.timelineItem.id,
        rect: sprite.rect,
        opacity: sprite.opacity,
        zIndex: sprite.zIndex
      })

    } catch (error) {
      console.error('🎬 [WebAV Animation] Failed to sync properties:', error)
    }
  }

  /**
   * 销毁管理器
   */
  public destroy(): void {
    this.isDestroyed = true
    console.log('🎬 [WebAV Animation] Manager destroyed for:', this.timelineItem.id)
  }

  /**
   * 检查管理器是否已销毁
   */
  public isDestroyed_(): boolean {
    return this.isDestroyed
  }
}

// ==================== 全局动画管理器 ====================

/**
 * 全局WebAV动画管理器
 * 管理所有TimelineItem的动画
 */
class GlobalWebAVAnimationManager {
  private managers = new Map<string, WebAVAnimationManager>()

  /**
   * 添加动画管理器
   */
  public addManager(timelineItem: TimelineItem): WebAVAnimationManager {
    const manager = new WebAVAnimationManager(timelineItem)
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
  public getManager(itemId: string): WebAVAnimationManager | undefined {
    return this.managers.get(itemId)
  }

  /**
   * 更新指定项目的动画
   */
  public async updateAnimation(itemId: string): Promise<void> {
    const manager = this.managers.get(itemId)
    if (manager) {
      await manager.updateAnimation()
    }
  }

  /**
   * 更新所有动画
   */
  public async updateAllAnimations(): Promise<void> {
    const updatePromises = Array.from(this.managers.values()).map(manager => 
      manager.updateAnimation()
    )
    await Promise.all(updatePromises)
  }

  /**
   * 清除所有动画管理器
   */
  public clearAll(): void {
    this.managers.forEach(manager => {
      manager.destroy()
    })
    this.managers.clear()
  }

  /**
   * 获取管理器数量
   */
  public getCount(): number {
    return this.managers.size
  }
}

// 导出全局实例
export const globalWebAVAnimationManager = new GlobalWebAVAnimationManager()

// ==================== 便捷函数 ====================

/**
 * 为TimelineItem创建或获取动画管理器
 */
export function getOrCreateAnimationManager(timelineItem: TimelineItem): WebAVAnimationManager {
  let manager = globalWebAVAnimationManager.getManager(timelineItem.id)
  if (!manager) {
    manager = globalWebAVAnimationManager.addManager(timelineItem)
  }
  return manager
}

/**
 * 更新TimelineItem的WebAV动画
 */
export async function updateWebAVAnimation(timelineItem: TimelineItem): Promise<void> {
  const manager = getOrCreateAnimationManager(timelineItem)
  await manager.updateAnimation()
}

/**
 * 清除TimelineItem的WebAV动画
 */
export async function clearWebAVAnimation(timelineItem: TimelineItem): Promise<void> {
  const manager = globalWebAVAnimationManager.getManager(timelineItem.id)
  if (manager) {
    await manager.clearAnimation()
  }
}

/**
 * 同步TimelineItem属性到WebAV sprite
 */
export function syncPropertiesToWebAV(timelineItem: TimelineItem): void {
  const manager = globalWebAVAnimationManager.getManager(timelineItem.id)
  if (manager) {
    manager.syncPropertiesToSprite()
  }
}

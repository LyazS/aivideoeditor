/**
 * 响应式Sprite生命周期管理器
 * 基于数据驱动的Sprite管理，与响应式时间轴项目数据配合
 */

import type { Raw } from 'vue'
import { generateUUID4 } from '@/utils/idGenerator'
import type { UnifiedMediaItemData } from '../mediaitem'
import type { UnifiedTimelineItemData, TransformData } from './TimelineItemData'

// 临时类型定义，实际应该从WebAV相关模块导入
interface CustomSprite {
  setTimeRange(range: { timelineStartTime: number; timelineEndTime: number }): void
  setTransform(transform: TransformData): void
  setOpacity(opacity: number): void
  destroy(): void
}

interface AVCanvas {
  addSprite(sprite: Raw<CustomSprite>): Promise<void>
  removeSprite(sprite: Raw<CustomSprite>): Promise<void>
}

// 临时Sprite类定义，实际应该从相应模块导入
class VideoVisibleSprite implements CustomSprite {
  constructor(private clip: any) {}
  setTimeRange(range: { timelineStartTime: number; timelineEndTime: number }): void {
    console.log('VideoSprite setTimeRange:', range)
  }
  setTransform(transform: TransformData): void {
    console.log('VideoSprite setTransform:', transform)
  }
  setOpacity(opacity: number): void {
    console.log('VideoSprite setOpacity:', opacity)
  }
  destroy(): void {
    console.log('VideoSprite destroyed')
  }
}

class ImageVisibleSprite implements CustomSprite {
  constructor(private clip: any) {}
  setTimeRange(range: { timelineStartTime: number; timelineEndTime: number }): void {
    console.log('ImageSprite setTimeRange:', range)
  }
  setTransform(transform: TransformData): void {
    console.log('ImageSprite setTransform:', transform)
  }
  setOpacity(opacity: number): void {
    console.log('ImageSprite setOpacity:', opacity)
  }
  destroy(): void {
    console.log('ImageSprite destroyed')
  }
}

class AudioVisibleSprite implements CustomSprite {
  constructor(private clip: any) {}
  setTimeRange(range: { timelineStartTime: number; timelineEndTime: number }): void {
    console.log('AudioSprite setTimeRange:', range)
  }
  setTransform(transform: TransformData): void {
    console.log('AudioSprite setTransform:', transform)
  }
  setOpacity(opacity: number): void {
    console.log('AudioSprite setOpacity:', opacity)
  }
  destroy(): void {
    console.log('AudioSprite destroyed')
  }
}

/**
 * 响应式Sprite生命周期管理器
 * 基于数据驱动的Sprite管理，与响应式时间轴项目数据配合
 */
export class SpriteLifecycleManager {
  private static instance: SpriteLifecycleManager
  private avCanvas?: AVCanvas
  private spriteRegistry = new Map<string, Raw<CustomSprite>>() // spriteId -> sprite映射

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): SpriteLifecycleManager {
    if (!SpriteLifecycleManager.instance) {
      SpriteLifecycleManager.instance = new SpriteLifecycleManager()
    }
    return SpriteLifecycleManager.instance
  }

  /**
   * 初始化管理器
   */
  initialize(avCanvas: AVCanvas): void {
    this.avCanvas = avCanvas
    console.log('✅ SpriteLifecycleManager 已初始化')
  }

  /**
   * 创建并添加 Sprite 到 AVCanvas
   * 返回spriteId供时间轴项目数据引用
   */
  static async createAndAddSprite(
    mediaData: UnifiedMediaItemData,
    timelineData: UnifiedTimelineItemData,
    context: any = null
  ): Promise<string> {
    const manager = SpriteLifecycleManager.getInstance()
    return manager.createSprite(mediaData, timelineData, context)
  }

  /**
   * 从 AVCanvas 移除 Sprite（AVCanvas 会自动销毁）
   */
  static async removeSprite(spriteId: string): Promise<void> {
    const manager = SpriteLifecycleManager.getInstance()
    return manager.destroySprite(spriteId)
  }

  /**
   * 更新Sprite属性（响应式更新）
   */
  static async updateSpriteProperties(
    spriteId: string,
    updates: Partial<{
      timeRange: { timelineStartTime: number; timelineEndTime: number }
      transform: TransformData
      opacity: number
    }>
  ): Promise<void> {
    const manager = SpriteLifecycleManager.getInstance()
    return manager.updateSprite(spriteId, updates)
  }

  /**
   * 获取Sprite实例（用于直接操作）
   */
  static getSprite(spriteId: string): Raw<CustomSprite> | undefined {
    const manager = SpriteLifecycleManager.getInstance()
    return manager.spriteRegistry.get(spriteId)
  }

  /**
   * 内部方法：创建Sprite
   */
  private async createSprite(
    mediaData: UnifiedMediaItemData,
    timelineData: UnifiedTimelineItemData,
    context: any = null
  ): Promise<string> {
    if (!this.avCanvas) {
      throw new Error('SpriteLifecycleManager 未初始化，请先调用 initialize()')
    }

    const { mediaType, webav } = mediaData

    if (!webav) {
      throw new Error('媒体项目WebAV对象未就绪')
    }

    // 生成唯一的spriteId
    const spriteId = generateUUID4()

    // 检查是否已存在 Sprite
    if (timelineData.spriteId && this.spriteRegistry.has(timelineData.spriteId)) {
      console.warn(`时间轴项目 ${timelineData.id} 的 Sprite 已存在，先移除旧的`)
      await this.destroySprite(timelineData.spriteId)
    }

    let sprite: Raw<CustomSprite>

    // 根据媒体类型创建对应的 Sprite
    switch (mediaType) {
      case 'video':
        if (!webav.mp4Clip) throw new Error('视频WebAV对象缺失')
        sprite = new VideoVisibleSprite(webav.mp4Clip) as Raw<CustomSprite>
        break

      case 'image':
        if (!webav.imgClip) throw new Error('图片WebAV对象缺失')
        sprite = new ImageVisibleSprite(webav.imgClip) as Raw<CustomSprite>
        break

      case 'audio':
        if (!webav.audioClip) throw new Error('音频WebAV对象缺失')
        sprite = new AudioVisibleSprite(webav.audioClip) as Raw<CustomSprite>
        break

      default:
        throw new Error(`不支持的媒体类型: ${mediaType}`)
    }

    // 设置 Sprite 的基础属性
    await this.setupSpriteProperties(sprite, timelineData)

    // 添加到 AVCanvas
    await this.avCanvas.addSprite(sprite)

    // 注册到管理器
    this.spriteRegistry.set(spriteId, sprite)

    console.log(`✅ Sprite 已创建并添加到 AVCanvas: ${spriteId} (${mediaType})`)

    return spriteId
  }

  /**
   * 内部方法：销毁Sprite
   */
  private async destroySprite(spriteId: string): Promise<void> {
    const sprite = this.spriteRegistry.get(spriteId)
    if (!sprite) {
      console.warn(`未找到 Sprite: ${spriteId}`)
      return
    }

    if (!this.avCanvas) {
      console.warn('AVCanvas 未初始化，无法移除 Sprite')
      return
    }

    try {
      // 从 AVCanvas 移除（AVCanvas 会自动销毁 Sprite）
      await this.avCanvas.removeSprite(sprite)

      // 从注册表移除
      this.spriteRegistry.delete(spriteId)

      console.log(`🗑️ Sprite 已从 AVCanvas 移除: ${spriteId}`)
    } catch (error) {
      console.error(`❌ Sprite 移除失败: ${spriteId}`, error)
      throw error
    }
  }

  /**
   * 内部方法：更新Sprite属性
   */
  private async updateSprite(
    spriteId: string,
    updates: Partial<{
      timeRange: { timelineStartTime: number; timelineEndTime: number }
      transform: TransformData
      opacity: number
    }>
  ): Promise<void> {
    const sprite = this.spriteRegistry.get(spriteId)
    if (!sprite) {
      console.warn(`未找到 Sprite: ${spriteId}`)
      return
    }

    try {
      if (updates.timeRange) {
        sprite.setTimeRange(updates.timeRange)
      }

      if (updates.transform) {
        sprite.setTransform(updates.transform)
      }

      if (updates.opacity !== undefined) {
        sprite.setOpacity(updates.opacity)
      }

      console.log(`✅ Sprite 属性已更新: ${spriteId}`, updates)
    } catch (error) {
      console.error(`❌ Sprite 属性更新失败: ${spriteId}`, error)
      throw error
    }
  }

  /**
   * 设置Sprite基础属性
   */
  private async setupSpriteProperties(
    sprite: Raw<CustomSprite>,
    timelineData: UnifiedTimelineItemData
  ): Promise<void> {
    // 设置时间范围
    sprite.setTimeRange({
      timelineStartTime: timelineData.timeRange.timelineStartTime,
      timelineEndTime: timelineData.timeRange.timelineEndTime
    })

    // 设置基础变换属性
    const config = timelineData.config
    if (config.transform) {
      sprite.setTransform(config.transform)
    }

    // 设置透明度
    if (config.transform?.opacity !== undefined) {
      sprite.setOpacity(config.transform.opacity)
    }
  }

  /**
   * 清理所有Sprite（用于组件卸载时）
   */
  async cleanup(): Promise<void> {
    const spriteIds = Array.from(this.spriteRegistry.keys())
    
    for (const spriteId of spriteIds) {
      try {
        await this.destroySprite(spriteId)
      } catch (error) {
        console.error(`清理Sprite失败: ${spriteId}`, error)
      }
    }

    console.log('🧹 SpriteLifecycleManager 已清理所有Sprite')
  }

  /**
   * 获取当前管理的Sprite数量
   */
  getSpriteCount(): number {
    return this.spriteRegistry.size
  }

  /**
   * 获取所有Sprite ID列表
   */
  getAllSpriteIds(): string[] {
    return Array.from(this.spriteRegistry.keys())
  }
}

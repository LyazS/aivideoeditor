import type { VideoVisibleSprite } from './VideoVisibleSprite'
import type { ImageVisibleSprite } from './ImageVisibleSprite'
import type { TimelineItem } from '../types/videoTypes'

/**
 * Sprite事件同步管理器
 * 负责监听sprite的propsChange事件，并同步到store
 * 实现数据流：UI变化 → Sprite属性更新 → propsChange事件 → Store同步 → UI反馈
 */
export class SpriteEventSyncManager {
  /**
   * 事件监听器映射，用于清理
   */
  private static eventListeners = new Map<string, () => void>()

  /**
   * 为TimelineItem设置sprite事件监听
   * @param timelineItem 时间轴项目
   * @param onPropsChange 属性变化回调函数
   */
  static setupSpriteEventListeners(
    timelineItem: TimelineItem,
    onPropsChange: (timelineItemId: string, changes: any) => void
  ): void {
    const sprite = timelineItem.sprite
    const timelineItemId = timelineItem.id

    // 创建属性变化监听器
    const propsChangeListener = (changes: any) => {
      console.log(`🔄 [SpriteSync] Props changed for ${timelineItemId}:`, changes)

      // 将sprite属性变化同步到store
      onPropsChange(timelineItemId, changes)
    }

    // 🆕 使用原生VisibleSprite的事件系统
    const removeListener = sprite.on('propsChange', propsChangeListener)

    // 保存移除函数引用，用于后续清理
    this.eventListeners.set(timelineItemId, removeListener)

    console.log(`✅ [SpriteSync] Event listeners setup for ${timelineItemId}`)
  }

  /**
   * 移除TimelineItem的sprite事件监听
   * @param timelineItemId 时间轴项目ID
   */
  static removeSpriteEventListeners(timelineItemId: string): void {
    const removeListener = this.eventListeners.get(timelineItemId)
    if (removeListener) {
      removeListener()
      this.eventListeners.delete(timelineItemId)
      console.log(`🗑️ [SpriteSync] Event listeners removed for ${timelineItemId}`)
    }
  }

  /**
   * 移除TimelineItem的sprite事件监听（带sprite引用）
   * @param timelineItem 时间轴项目
   */
  static removeSpriteEventListenersWithSprite(timelineItem: TimelineItem): void {
    const timelineItemId = timelineItem.id
    this.removeSpriteEventListeners(timelineItemId)
  }

  /**
   * 清理所有事件监听器
   */
  static clearAllEventListeners(): void {
    this.eventListeners.clear()
    console.log('🧹 [SpriteSync] All event listeners cleared')
  }

  /**
   * 获取当前监听器数量（用于调试）
   */
  static getListenerCount(): number {
    return this.eventListeners.size
  }
}

/**
 * 属性变化数据转换器
 * 将sprite的原始属性变化转换为TimelineItem可用的格式
 */
export class PropsChangeTransformer {
  /**
   * 转换sprite属性变化为TimelineItem属性格式
   * @param changes sprite属性变化
   * @param videoResolution 视频分辨率（用于坐标转换）
   * @returns 转换后的属性变化
   */
  static transformSpriteChangesToTimelineItem(
    changes: any,
    videoResolution: { width: number; height: number }
  ): any {
    const transformed: any = {}

    // 处理rect变化（位置、尺寸、旋转）
    if (changes.rect) {
      const rect = changes.rect
      
      // 位置变化需要坐标系转换
      if (rect.x !== undefined || rect.y !== undefined) {
        // 这里需要导入坐标转换函数
        // 暂时直接传递，后续完善
        transformed.x = rect.x
        transformed.y = rect.y
      }

      // 尺寸变化直接映射
      if (rect.w !== undefined) {
        transformed.width = rect.w
      }
      if (rect.h !== undefined) {
        transformed.height = rect.h
      }

      // 旋转变化直接映射
      if (rect.angle !== undefined) {
        transformed.rotation = rect.angle
      }
    }

    // 处理其他属性变化
    if (changes.opacity !== undefined) {
      transformed.opacity = changes.opacity
    }
    if (changes.zIndex !== undefined) {
      transformed.zIndex = changes.zIndex
    }
    if (changes.volume !== undefined) {
      transformed.volume = changes.volume
    }
    if (changes.isMuted !== undefined) {
      transformed.isMuted = changes.isMuted
    }

    return transformed
  }
}

import { AtomicOperation } from '../../base'
import type { OperationResult, OperationContext } from '../../types'
import type { TransformData } from '../../context'
import type { TransformTimelineItemData } from './TimelineItemTypes'
import { ValidationUtils, OperationUtils } from '../../utils'

/**
 * 变换时间轴项目操作
 * 支持时间轴项目变换属性的撤销/重做操作
 * 包括位置、大小、旋转、透明度、层级、音量等属性
 */
export class TransformTimelineItemOperation extends AtomicOperation {
  constructor(
    private transformData: TransformTimelineItemData,
    private context: OperationContext
  ) {
    super(
      'timeline.item.transform',
      OperationUtils.formatOperationDescription('timeline.item.transform', { 
        itemName: transformData.itemId 
      }),
      {
        itemId: transformData.itemId,
        hasPositionChange: !!transformData.newTransform.position,
        hasSizeChange: !!transformData.newTransform.size,
        hasRotationChange: transformData.newTransform.rotation !== undefined,
        hasOpacityChange: transformData.newTransform.opacity !== undefined,
        hasVolumeChange: transformData.newTransform.volume !== undefined
      }
    )
  }

  async validate(): Promise<boolean> {
    // 验证时间轴项目是否存在
    if (!ValidationUtils.validateTimelineItemExists(this.transformData.itemId, this.context.timeline.getItem.bind(this.context.timeline))) {
      return false
    }

    // 验证新的变换属性是否有效
    if (!ValidationUtils.validateTransform(this.transformData.newTransform)) {
      return false
    }

    // 验证音频属性是否有效
    if (!ValidationUtils.validateAudioProperties({
      volume: this.transformData.newTransform.volume,
      isMuted: this.transformData.newTransform.isMuted
    })) {
      return false
    }

    return true
  }

  async execute(): Promise<OperationResult> {
    try {
      console.log(`🔄 执行变换操作：更新时间轴项目属性...`)

      const timelineItem = this.context.timeline.getItem(this.transformData.itemId)
      if (!timelineItem) {
        throw new Error(`Timeline item not found: ${this.transformData.itemId}`)
      }

      // 应用变换属性到时间轴项目
      this.applyTransformToTimelineItem(timelineItem, this.transformData.newTransform)

      // 同步到sprite
      this.applyTransformToSprite(timelineItem.sprite, this.transformData.newTransform)

      console.log(`✅ 已更新时间轴项目变换属性: ${this.transformData.itemId}`)

      return {
        success: true,
        data: { timelineItem },
        affectedEntities: [this.transformData.itemId],
        metadata: { operation: 'transform', changedProperties: Object.keys(this.transformData.newTransform) }
      }
    } catch (error) {
      console.error(`❌ 更新时间轴项目变换属性失败: ${this.transformData.itemId}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async undo(): Promise<OperationResult> {
    try {
      console.log(`🔄 撤销变换操作：恢复时间轴项目属性...`)

      const timelineItem = this.context.timeline.getItem(this.transformData.itemId)
      if (!timelineItem) {
        throw new Error(`Timeline item not found: ${this.transformData.itemId}`)
      }

      // 恢复原始变换属性到时间轴项目
      this.applyTransformToTimelineItem(timelineItem, this.transformData.oldTransform)

      // 同步到sprite
      this.applyTransformToSprite(timelineItem.sprite, this.transformData.oldTransform)

      console.log(`↩️ 已撤销时间轴项目变换属性: ${this.transformData.itemId}`)

      return {
        success: true,
        data: { timelineItem },
        affectedEntities: [this.transformData.itemId],
        metadata: { operation: 'undo_transform' }
      }
    } catch (error) {
      console.error(`❌ 撤销时间轴项目变换属性失败: ${this.transformData.itemId}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 应用变换属性到时间轴项目
   */
  private applyTransformToTimelineItem(timelineItem: any, transform: TransformData): void {
    if (transform.position) {
      timelineItem.position = { ...transform.position }
    }
    if (transform.size) {
      timelineItem.size = { ...transform.size }
    }
    if (transform.rotation !== undefined) {
      timelineItem.rotation = transform.rotation
    }
    if (transform.opacity !== undefined) {
      timelineItem.opacity = transform.opacity
    }
    if (transform.zIndex !== undefined) {
      timelineItem.zIndex = transform.zIndex
    }
    if (transform.volume !== undefined) {
      timelineItem.volume = transform.volume
    }
    if (transform.isMuted !== undefined) {
      timelineItem.isMuted = transform.isMuted
    }
    if (transform.duration !== undefined) {
      // 更新时间范围
      const startTime = timelineItem.timeRange.timelineStartTime
      timelineItem.timeRange.timelineEndTime = startTime + (transform.duration * 1000000) // 转换为微秒
    }
  }

  /**
   * 应用变换属性到sprite
   */
  private applyTransformToSprite(sprite: any, transform: TransformData): void {
    if (!sprite) return

    // 更新sprite的rect属性
    if (transform.position || transform.size) {
      const rect = sprite.rect
      if (transform.position) {
        rect.x = transform.position.x
        rect.y = transform.position.y
      }
      if (transform.size) {
        rect.w = transform.size.width
        rect.h = transform.size.height
      }
      sprite.rect = rect
    }

    // 更新其他属性
    if (transform.rotation !== undefined) {
      sprite.rotation = transform.rotation
    }
    if (transform.opacity !== undefined) {
      sprite.opacity = transform.opacity
    }
    if (transform.zIndex !== undefined) {
      sprite.zIndex = transform.zIndex
    }

    // 更新音频属性（如果是视频sprite）
    if (sprite.setVolume && transform.volume !== undefined) {
      sprite.setVolume(transform.volume)
    }
    if (sprite.setMuted && transform.isMuted !== undefined) {
      sprite.setMuted(transform.isMuted)
    }

    // 更新播放速度（如果是视频sprite）
    if (sprite.setPlaybackRate && transform.playbackRate !== undefined) {
      sprite.setPlaybackRate(transform.playbackRate)
    }

    // 更新时间范围（如果需要）
    if (transform.duration !== undefined && sprite.setTimeRange) {
      const currentRange = sprite.getTimeRange ? sprite.getTimeRange() : sprite.timeRange
      if (currentRange) {
        const newRange = {
          ...currentRange,
          timelineEndTime: currentRange.timelineStartTime + (transform.duration * 1000000)
        }
        sprite.setTimeRange(newRange)
      }
    }
  }

  /**
   * 检查是否可以与其他操作合并
   */
  canMerge(other: any): boolean {
    // 只能与相同项目的变换操作合并
    return other instanceof TransformTimelineItemOperation && 
           other.transformData.itemId === this.transformData.itemId
  }

  /**
   * 合并操作
   */
  merge(other: any): TransformTimelineItemOperation {
    if (!this.canMerge(other)) {
      throw new Error('Cannot merge operations')
    }

    // 合并变换数据：保持原始的oldTransform，使用新的newTransform
    const mergedTransformData: TransformTimelineItemData = {
      itemId: this.transformData.itemId,
      oldTransform: this.transformData.oldTransform, // 保持最初的状态
      newTransform: other.transformData.newTransform // 使用最新的状态
    }

    return new TransformTimelineItemOperation(mergedTransformData, this.context)
  }
}

import { AtomicOperation } from '../../base'
import type { OperationResult, OperationContext } from '../../types'
import type { TimelineItemData, TransformData, Position } from '../../context'
import type { AddTimelineItemData, MoveTimelineItemData, TransformTimelineItemData } from './TimelineItemTypes'
import { ValidationUtils, OperationUtils } from '../../utils'
import { generateId } from '../../utils/OperationUtils'

/**
 * 添加时间轴项目操作
 * 支持添加时间轴项目的撤销/重做操作
 * 采用"从源头重建"原则：每次执行都从原始素材重新创建sprite
 */
export class AddTimelineItemOperation extends AtomicOperation {
  constructor(
    private itemData: AddTimelineItemData,
    private context: OperationContext
  ) {
    super(
      'timeline.item.add',
      OperationUtils.formatOperationDescription('timeline.item.add', { 
        itemName: itemData.id 
      }),
      {
        itemId: itemData.id,
        itemType: itemData.mediaType,
        trackId: itemData.trackId
      }
    )
  }

  async validate(): Promise<boolean> {
    // 验证媒体项目是否存在且已准备就绪
    if (!ValidationUtils.validateMediaItemReady(this.itemData.mediaItemId, this.context.media.getItem.bind(this.context.media))) {
      return false
    }

    // 验证轨道是否存在
    if (!ValidationUtils.validateTrackExists(this.itemData.trackId, this.context.tracks.getTrack.bind(this.context.tracks))) {
      return false
    }

    // 验证时间范围是否有效
    if (!ValidationUtils.validateTimeRange(this.itemData.timeRange)) {
      return false
    }

    // 验证变换属性是否有效
    if (!ValidationUtils.validateTransform({
      position: this.itemData.position,
      size: this.itemData.size,
      rotation: this.itemData.rotation,
      opacity: this.itemData.opacity,
      zIndex: this.itemData.zIndex
    })) {
      return false
    }

    return true
  }

  async execute(): Promise<OperationResult> {
    try {
      console.log(`🔄 执行添加操作：从源头重建时间轴项目...`)

      // 从原始素材重新创建sprite
      const sprite = await this.context.createSprite(this.itemData)

      // 创建时间轴项目
      const timelineItem = this.context.createTimelineItem(sprite, this.itemData)

      // 添加到时间轴
      this.context.timeline.addItem(timelineItem)

      // 添加sprite到WebAV画布
      this.context.canvas.addSprite(sprite)

      console.log(`✅ 已添加时间轴项目: ${this.itemData.id}`)

      return {
        success: true,
        data: { timelineItem, sprite },
        affectedEntities: [timelineItem.id],
        metadata: { operation: 'add', itemType: this.itemData.mediaType }
      }
    } catch (error) {
      console.error(`❌ 添加时间轴项目失败: ${this.itemData.id}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async undo(): Promise<OperationResult> {
    try {
      console.log(`🔄 撤销添加操作：删除时间轴项目...`)

      // 获取时间轴项目
      const timelineItem = this.context.timeline.getItem(this.itemData.id)
      if (timelineItem) {
        // 从WebAV画布移除sprite
        this.context.canvas.removeSprite(timelineItem.sprite)

        // 从时间轴移除
        this.context.timeline.removeItem(this.itemData.id)

        // 清理sprite资源
        if (timelineItem.sprite && typeof timelineItem.sprite.destroy === 'function') {
          timelineItem.sprite.destroy()
        }
      }

      console.log(`↩️ 已撤销添加时间轴项目: ${this.itemData.id}`)

      return {
        success: true,
        affectedEntities: [this.itemData.id],
        metadata: { operation: 'undo_add' }
      }
    } catch (error) {
      console.error(`❌ 撤销添加时间轴项目失败: ${this.itemData.id}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

/**
 * 删除时间轴项目操作
 * 支持删除时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始素材重新创建
 */
export class RemoveTimelineItemOperation extends AtomicOperation {
  private originalItemData: TimelineItemData

  constructor(
    private itemId: string,
    private context: OperationContext
  ) {
    // 获取要删除的项目数据
    const item = context.timeline.getItem(itemId)
    if (!item) {
      throw new Error(`Timeline item not found: ${itemId}`)
    }

    // 保存原始数据用于重建
    const originalItemData: TimelineItemData = {
      id: item.id,
      mediaItemId: item.mediaItemId,
      trackId: item.trackId,
      mediaType: item.mediaType,
      timeRange: { ...item.timeRange },
      position: { ...item.position },
      size: { ...item.size },
      rotation: item.rotation,
      zIndex: item.zIndex,
      opacity: item.opacity,
      thumbnailUrl: item.thumbnailUrl,
      volume: item.volume,
      isMuted: item.isMuted
    }

    super(
      'timeline.item.remove',
      OperationUtils.formatOperationDescription('timeline.item.remove', { 
        itemName: itemId 
      }),
      {
        itemId: itemId,
        itemType: item.mediaType,
        trackId: item.trackId
      }
    )

    this.originalItemData = originalItemData
  }

  async execute(): Promise<OperationResult> {
    try {
      console.log(`🔄 执行删除操作：删除时间轴项目...`)

      // 获取时间轴项目
      const timelineItem = this.context.timeline.getItem(this.itemId)
      if (timelineItem) {
        // 从WebAV画布移除sprite
        this.context.canvas.removeSprite(timelineItem.sprite)

        // 从时间轴移除
        this.context.timeline.removeItem(this.itemId)

        // 清理sprite资源
        if (timelineItem.sprite && typeof timelineItem.sprite.destroy === 'function') {
          timelineItem.sprite.destroy()
        }
      }

      console.log(`✅ 已删除时间轴项目: ${this.itemId}`)

      return {
        success: true,
        affectedEntities: [this.itemId],
        metadata: { operation: 'remove' }
      }
    } catch (error) {
      console.error(`❌ 删除时间轴项目失败: ${this.itemId}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async undo(): Promise<OperationResult> {
    try {
      console.log(`🔄 撤销删除操作：重建时间轴项目...`)

      // 从原始素材重新创建sprite
      const sprite = await this.context.createSprite(this.originalItemData)

      // 创建时间轴项目
      const timelineItem = this.context.createTimelineItem(sprite, this.originalItemData)

      // 添加到时间轴
      this.context.timeline.addItem(timelineItem)

      // 添加sprite到WebAV画布
      this.context.canvas.addSprite(sprite)

      console.log(`↩️ 已撤销删除时间轴项目: ${this.itemId}`)

      return {
        success: true,
        data: { timelineItem, sprite },
        affectedEntities: [this.itemId],
        metadata: { operation: 'undo_remove' }
      }
    } catch (error) {
      console.error(`❌ 撤销删除时间轴项目失败: ${this.itemId}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

/**
 * 移动时间轴项目操作
 * 支持时间轴项目位置移动的撤销/重做操作
 * 包括时间位置移动和轨道间移动
 */
export class MoveTimelineItemOperation extends AtomicOperation {
  constructor(
    private moveData: MoveTimelineItemData,
    private context: OperationContext
  ) {
    super(
      'timeline.item.move',
      OperationUtils.formatOperationDescription('timeline.item.move', {
        itemName: moveData.itemId
      }),
      {
        itemId: moveData.itemId,
        fromTime: moveData.from.time,
        toTime: moveData.to.time,
        fromTrack: moveData.from.trackId,
        toTrack: moveData.to.trackId
      }
    )
  }

  async validate(): Promise<boolean> {
    // 验证时间轴项目是否存在
    if (!ValidationUtils.validateTimelineItemExists(this.moveData.itemId, this.context.timeline.getItem.bind(this.context.timeline))) {
      return false
    }

    // 验证目标轨道是否存在（如果指定了轨道）
    if (this.moveData.to.trackId && !ValidationUtils.validateTrackExists(this.moveData.to.trackId, this.context.tracks.getTrack.bind(this.context.tracks))) {
      return false
    }

    return true
  }

  async execute(): Promise<OperationResult> {
    try {
      console.log(`🔄 执行移动操作：移动时间轴项目...`)

      const timelineItem = this.context.timeline.getItem(this.moveData.itemId)
      if (!timelineItem) {
        throw new Error(`Timeline item not found: ${this.moveData.itemId}`)
      }

      // 更新时间位置
      const timeDiff = this.moveData.to.time - this.moveData.from.time
      const duration = timelineItem.timeRange.timelineEndTime - timelineItem.timeRange.timelineStartTime

      timelineItem.timeRange.timelineStartTime = this.moveData.to.time * 1000000 // 转换为微秒
      timelineItem.timeRange.timelineEndTime = timelineItem.timeRange.timelineStartTime + duration

      // 更新轨道（如果指定了新轨道）
      if (this.moveData.to.trackId && this.moveData.to.trackId !== timelineItem.trackId) {
        timelineItem.trackId = this.moveData.to.trackId
      }

      // 同步到sprite的时间范围
      if (timelineItem.sprite && typeof timelineItem.sprite.setTimeRange === 'function') {
        timelineItem.sprite.setTimeRange(timelineItem.timeRange)
      }

      console.log(`✅ 已移动时间轴项目: ${this.moveData.itemId}`)

      return {
        success: true,
        data: { timelineItem },
        affectedEntities: [this.moveData.itemId],
        metadata: { operation: 'move', timeDiff, trackChanged: !!this.moveData.to.trackId }
      }
    } catch (error) {
      console.error(`❌ 移动时间轴项目失败: ${this.moveData.itemId}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async undo(): Promise<OperationResult> {
    try {
      console.log(`🔄 撤销移动操作：恢复时间轴项目位置...`)

      const timelineItem = this.context.timeline.getItem(this.moveData.itemId)
      if (!timelineItem) {
        throw new Error(`Timeline item not found: ${this.moveData.itemId}`)
      }

      // 恢复时间位置
      const timeDiff = this.moveData.from.time - this.moveData.to.time
      const duration = timelineItem.timeRange.timelineEndTime - timelineItem.timeRange.timelineStartTime

      timelineItem.timeRange.timelineStartTime = this.moveData.from.time * 1000000 // 转换为微秒
      timelineItem.timeRange.timelineEndTime = timelineItem.timeRange.timelineStartTime + duration

      // 恢复轨道（如果之前改变了轨道）
      if (this.moveData.from.trackId && this.moveData.from.trackId !== timelineItem.trackId) {
        timelineItem.trackId = this.moveData.from.trackId
      }

      // 同步到sprite的时间范围
      if (timelineItem.sprite && typeof timelineItem.sprite.setTimeRange === 'function') {
        timelineItem.sprite.setTimeRange(timelineItem.timeRange)
      }

      console.log(`↩️ 已撤销移动时间轴项目: ${this.moveData.itemId}`)

      return {
        success: true,
        data: { timelineItem },
        affectedEntities: [this.moveData.itemId],
        metadata: { operation: 'undo_move' }
      }
    } catch (error) {
      console.error(`❌ 撤销移动时间轴项目失败: ${this.moveData.itemId}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

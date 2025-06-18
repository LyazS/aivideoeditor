import { AtomicOperation } from '../../base'
import type { OperationResult, OperationContext } from '../../types'
import type { AddTrackData, RemoveTrackData, RenameTrackData, ToggleTrackVisibilityData, ToggleTrackMuteData } from './TrackTypes'
import { ValidationUtils, OperationUtils } from '../../utils'

/**
 * 添加轨道操作
 * 支持添加轨道的撤销/重做操作
 */
export class AddTrackOperation extends AtomicOperation {
  private createdTrackId: number = 0

  constructor(
    private trackData: AddTrackData,
    private context: OperationContext
  ) {
    super(
      'track.add',
      OperationUtils.formatOperationDescription('track.add', { 
        trackName: trackData.name || '新轨道' 
      }),
      {
        trackName: trackData.name
      }
    )
  }

  async execute(): Promise<OperationResult> {
    try {
      console.log(`🔄 执行添加轨道操作...`)

      const track = this.context.tracks.createTrack({
        id: this.context.tracks.getNextTrackNumber(),
        name: this.trackData.name || `轨道 ${this.context.tracks.getNextTrackNumber()}`,
        isVisible: this.trackData.isVisible ?? true,
        isMuted: this.trackData.isMuted ?? false
      })

      this.createdTrackId = track.id

      console.log(`✅ 已添加轨道: ${track.name} (ID: ${track.id})`)

      return {
        success: true,
        data: { track },
        affectedEntities: [track.id.toString()],
        metadata: { operation: 'add_track', trackName: track.name }
      }
    } catch (error) {
      console.error(`❌ 添加轨道失败`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async undo(): Promise<OperationResult> {
    try {
      console.log(`🔄 撤销添加轨道操作...`)

      if (this.createdTrackId > 0) {
        this.context.tracks.removeTrack(this.createdTrackId)
        console.log(`↩️ 已撤销添加轨道 (ID: ${this.createdTrackId})`)
      }

      return {
        success: true,
        affectedEntities: [this.createdTrackId.toString()],
        metadata: { operation: 'undo_add_track' }
      }
    } catch (error) {
      console.error(`❌ 撤销添加轨道失败`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 获取创建的轨道ID
   */
  getCreatedTrackId(): number {
    return this.createdTrackId
  }
}

/**
 * 删除轨道操作
 * 支持删除轨道的撤销/重做操作
 * 注意：删除轨道会同时删除该轨道上的所有时间轴项目
 */
export class RemoveTrackOperation extends AtomicOperation {
  private removeData: RemoveTrackData

  constructor(
    private trackId: number,
    private context: OperationContext
  ) {
    const track = context.tracks.getTrack(trackId)
    if (!track) {
      throw new Error(`Track not found: ${trackId}`)
    }

    // 获取该轨道上的所有时间轴项目
    const affectedItems = context.timeline.getItemsInTrack(trackId)

    const removeData: RemoveTrackData = {
      trackId,
      trackData: {
        id: track.id,
        name: track.name,
        isVisible: track.isVisible,
        isMuted: track.isMuted
      },
      affectedItemIds: affectedItems.map(item => item.id)
    }

    super(
      'track.remove',
      OperationUtils.formatOperationDescription('track.remove', { 
        trackName: track.name 
      }),
      {
        trackId,
        trackName: track.name,
        affectedItemCount: affectedItems.length
      }
    )

    this.removeData = removeData
  }

  async validate(): Promise<boolean> {
    // 验证轨道是否存在
    if (!ValidationUtils.validateTrackExists(this.trackId, this.context.tracks.getTrack.bind(this.context.tracks))) {
      return false
    }

    return true
  }

  async execute(): Promise<OperationResult> {
    try {
      console.log(`🔄 执行删除轨道操作: ${this.removeData.trackData.name}...`)

      // 删除该轨道上的所有时间轴项目
      for (const itemId of this.removeData.affectedItemIds) {
        const timelineItem = this.context.timeline.getItem(itemId)
        if (timelineItem) {
          // 从WebAV画布移除sprite
          this.context.canvas.removeSprite(timelineItem.sprite)
          
          // 从时间轴移除
          this.context.timeline.removeItem(itemId)

          // 清理sprite资源
          if (timelineItem.sprite && typeof timelineItem.sprite.destroy === 'function') {
            timelineItem.sprite.destroy()
          }
        }
      }

      // 删除轨道
      this.context.tracks.removeTrack(this.trackId)

      console.log(`✅ 已删除轨道: ${this.removeData.trackData.name} 及其 ${this.removeData.affectedItemIds.length} 个项目`)

      return {
        success: true,
        affectedEntities: [
          this.trackId.toString(),
          ...this.removeData.affectedItemIds
        ],
        metadata: {
          operation: 'remove_track',
          trackName: this.removeData.trackData.name,
          removedItemCount: this.removeData.affectedItemIds.length
        }
      }
    } catch (error) {
      console.error(`❌ 删除轨道失败: ${this.removeData.trackData.name}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async undo(): Promise<OperationResult> {
    try {
      console.log(`🔄 撤销删除轨道操作: ${this.removeData.trackData.name}...`)

      // 重新创建轨道
      const track = this.context.tracks.createTrack(this.removeData.trackData)

      // 重新创建该轨道上的所有时间轴项目
      // 注意：这里需要从原始素材重建，但由于我们没有保存完整的重建数据，
      // 这个实现可能需要在实际使用时进一步完善
      console.log(`⚠️ 轨道已恢复，但时间轴项目需要手动重新添加`)

      console.log(`↩️ 已撤销删除轨道: ${this.removeData.trackData.name}`)

      return {
        success: true,
        data: { track },
        affectedEntities: [this.trackId.toString()],
        metadata: { operation: 'undo_remove_track' }
      }
    } catch (error) {
      console.error(`❌ 撤销删除轨道失败: ${this.removeData.trackData.name}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

/**
 * 重命名轨道操作
 * 支持轨道重命名的撤销/重做操作
 */
export class RenameTrackOperation extends AtomicOperation {
  constructor(
    private renameData: RenameTrackData,
    private context: OperationContext
  ) {
    super(
      'track.rename',
      OperationUtils.formatOperationDescription('track.rename', { 
        trackName: `${renameData.oldName} → ${renameData.newName}` 
      }),
      {
        trackId: renameData.trackId,
        oldName: renameData.oldName,
        newName: renameData.newName
      }
    )
  }

  async validate(): Promise<boolean> {
    // 验证轨道是否存在
    if (!ValidationUtils.validateTrackExists(this.renameData.trackId, this.context.tracks.getTrack.bind(this.context.tracks))) {
      return false
    }

    return true
  }

  async execute(): Promise<OperationResult> {
    try {
      console.log(`🔄 执行重命名轨道操作: ${this.renameData.oldName} → ${this.renameData.newName}`)

      this.context.tracks.updateTrack(this.renameData.trackId, { 
        name: this.renameData.newName 
      })

      console.log(`✅ 已重命名轨道: ${this.renameData.oldName} → ${this.renameData.newName}`)

      return {
        success: true,
        affectedEntities: [this.renameData.trackId.toString()],
        metadata: { operation: 'rename_track' }
      }
    } catch (error) {
      console.error(`❌ 重命名轨道失败`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async undo(): Promise<OperationResult> {
    try {
      console.log(`🔄 撤销重命名轨道操作: ${this.renameData.newName} → ${this.renameData.oldName}`)

      this.context.tracks.updateTrack(this.renameData.trackId, { 
        name: this.renameData.oldName 
      })

      console.log(`↩️ 已撤销重命名轨道: ${this.renameData.newName} → ${this.renameData.oldName}`)

      return {
        success: true,
        affectedEntities: [this.renameData.trackId.toString()],
        metadata: { operation: 'undo_rename_track' }
      }
    } catch (error) {
      console.error(`❌ 撤销重命名轨道失败`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

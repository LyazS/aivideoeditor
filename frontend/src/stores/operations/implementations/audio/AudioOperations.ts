import { AtomicOperation } from '../../base'
import type { OperationResult, OperationContext } from '../../types'
import { ValidationUtils, OperationUtils } from '../../utils'

/**
 * 音量变化操作数据
 */
export interface VolumeChangeData {
  itemId: string
  oldVolume: number
  newVolume: number
}

/**
 * 静音切换操作数据
 */
export interface MuteToggleData {
  itemId: string
  oldMuteState: boolean
  newMuteState: boolean
}

/**
 * 音量变化操作
 * 支持音量调整的撤销/重做操作
 */
export class VolumeChangeOperation extends AtomicOperation {
  constructor(
    private volumeData: VolumeChangeData,
    private context: OperationContext
  ) {
    super(
      'audio.volume.change',
      OperationUtils.formatOperationDescription('audio.volume.change', { 
        itemName: volumeData.itemId,
        volumeChange: `${Math.round(volumeData.oldVolume * 100)}% → ${Math.round(volumeData.newVolume * 100)}%`
      }),
      {
        itemId: volumeData.itemId,
        oldVolume: volumeData.oldVolume,
        newVolume: volumeData.newVolume
      }
    )
  }

  async validate(): Promise<boolean> {
    // 验证时间轴项目是否存在
    if (!ValidationUtils.validateTimelineItemExists(this.volumeData.itemId, this.context.timeline.getItem.bind(this.context.timeline))) {
      return false
    }

    // 验证音量值是否有效
    if (!ValidationUtils.validateAudioProperties({
      volume: this.volumeData.newVolume
    })) {
      return false
    }

    return true
  }

  async execute(): Promise<OperationResult> {
    try {
      console.log(`🔄 执行音量变化操作: ${this.volumeData.itemId}`)

      const timelineItem = this.context.timeline.getItem(this.volumeData.itemId)
      if (!timelineItem) {
        throw new Error(`Timeline item not found: ${this.volumeData.itemId}`)
      }

      // 更新时间轴项目的音量
      timelineItem.volume = this.volumeData.newVolume

      // 同步到sprite（如果是视频）
      if (timelineItem.sprite && typeof timelineItem.sprite.setVolume === 'function') {
        timelineItem.sprite.setVolume(this.volumeData.newVolume)
      }

      console.log(`✅ 已更新音量: ${this.volumeData.itemId} (${Math.round(this.volumeData.newVolume * 100)}%)`)

      return {
        success: true,
        data: { timelineItem },
        affectedEntities: [this.volumeData.itemId],
        metadata: { operation: 'volume_change', newVolume: this.volumeData.newVolume }
      }
    } catch (error) {
      console.error(`❌ 音量变化操作失败: ${this.volumeData.itemId}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async undo(): Promise<OperationResult> {
    try {
      console.log(`🔄 撤销音量变化操作: ${this.volumeData.itemId}`)

      const timelineItem = this.context.timeline.getItem(this.volumeData.itemId)
      if (!timelineItem) {
        throw new Error(`Timeline item not found: ${this.volumeData.itemId}`)
      }

      // 恢复原始音量
      timelineItem.volume = this.volumeData.oldVolume

      // 同步到sprite（如果是视频）
      if (timelineItem.sprite && typeof timelineItem.sprite.setVolume === 'function') {
        timelineItem.sprite.setVolume(this.volumeData.oldVolume)
      }

      console.log(`↩️ 已撤销音量变化: ${this.volumeData.itemId} (${Math.round(this.volumeData.oldVolume * 100)}%)`)

      return {
        success: true,
        data: { timelineItem },
        affectedEntities: [this.volumeData.itemId],
        metadata: { operation: 'undo_volume_change' }
      }
    } catch (error) {
      console.error(`❌ 撤销音量变化操作失败: ${this.volumeData.itemId}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 检查是否可以与其他操作合并
   */
  canMerge(other: any): boolean {
    // 只能与相同项目的音量操作合并
    return other instanceof VolumeChangeOperation && 
           other.volumeData.itemId === this.volumeData.itemId
  }

  /**
   * 合并操作
   */
  merge(other: any): VolumeChangeOperation {
    if (!this.canMerge(other)) {
      throw new Error('Cannot merge operations')
    }

    // 合并音量数据：保持原始的oldVolume，使用新的newVolume
    const mergedVolumeData: VolumeChangeData = {
      itemId: this.volumeData.itemId,
      oldVolume: this.volumeData.oldVolume, // 保持最初的音量
      newVolume: other.volumeData.newVolume // 使用最新的音量
    }

    return new VolumeChangeOperation(mergedVolumeData, this.context)
  }
}

/**
 * 静音切换操作
 * 支持静音/取消静音的撤销/重做操作
 */
export class MuteToggleOperation extends AtomicOperation {
  constructor(
    private muteData: MuteToggleData,
    private context: OperationContext
  ) {
    super(
      'audio.mute.toggle',
      OperationUtils.formatOperationDescription('audio.mute.toggle', { 
        itemName: muteData.itemId,
        muteAction: muteData.newMuteState ? '静音' : '取消静音'
      }),
      {
        itemId: muteData.itemId,
        oldMuteState: muteData.oldMuteState,
        newMuteState: muteData.newMuteState
      }
    )
  }

  async validate(): Promise<boolean> {
    // 验证时间轴项目是否存在
    if (!ValidationUtils.validateTimelineItemExists(this.muteData.itemId, this.context.timeline.getItem.bind(this.context.timeline))) {
      return false
    }

    return true
  }

  async execute(): Promise<OperationResult> {
    try {
      console.log(`🔄 执行静音切换操作: ${this.muteData.itemId}`)

      const timelineItem = this.context.timeline.getItem(this.muteData.itemId)
      if (!timelineItem) {
        throw new Error(`Timeline item not found: ${this.muteData.itemId}`)
      }

      // 更新时间轴项目的静音状态
      timelineItem.isMuted = this.muteData.newMuteState

      // 同步到sprite（如果是视频）
      if (timelineItem.sprite && typeof timelineItem.sprite.setMuted === 'function') {
        timelineItem.sprite.setMuted(this.muteData.newMuteState)
      }

      console.log(`✅ 已${this.muteData.newMuteState ? '静音' : '取消静音'}: ${this.muteData.itemId}`)

      return {
        success: true,
        data: { timelineItem },
        affectedEntities: [this.muteData.itemId],
        metadata: { operation: 'mute_toggle', newMuteState: this.muteData.newMuteState }
      }
    } catch (error) {
      console.error(`❌ 静音切换操作失败: ${this.muteData.itemId}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async undo(): Promise<OperationResult> {
    try {
      console.log(`🔄 撤销静音切换操作: ${this.muteData.itemId}`)

      const timelineItem = this.context.timeline.getItem(this.muteData.itemId)
      if (!timelineItem) {
        throw new Error(`Timeline item not found: ${this.muteData.itemId}`)
      }

      // 恢复原始静音状态
      timelineItem.isMuted = this.muteData.oldMuteState

      // 同步到sprite（如果是视频）
      if (timelineItem.sprite && typeof timelineItem.sprite.setMuted === 'function') {
        timelineItem.sprite.setMuted(this.muteData.oldMuteState)
      }

      console.log(`↩️ 已撤销静音切换: ${this.muteData.itemId}`)

      return {
        success: true,
        data: { timelineItem },
        affectedEntities: [this.muteData.itemId],
        metadata: { operation: 'undo_mute_toggle' }
      }
    } catch (error) {
      console.error(`❌ 撤销静音切换操作失败: ${this.muteData.itemId}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

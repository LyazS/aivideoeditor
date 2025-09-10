import type { MediaType } from '@/unified'
import type { Ref } from 'vue'
import type { SimpleCommand } from '@/unified/modules/commands/types'
import type { VisibleSprite } from '@webav/av-cliper'
import type {
  UnifiedTimelineItemData,
  VideoMediaConfig,
  AudioMediaConfig,
} from '@/unified/timelineitem'
import type { AudioVisibleSprite, VideoVisibleSprite } from '@/unified/visiblesprite'
import type { UnifiedTimeRange } from '@/unified/types/timeRange'
import type { UnifiedTrackType, UnifiedTrackData } from '@/unified/track/TrackTypes'
import type { UnifiedMediaItemData } from '@/unified/mediaitem/types'
import type { VideoResolution } from '@/unified/types'
import {
  AddTimelineItemCommand,
  RemoveTimelineItemCommand,
  MoveTimelineItemCommand,
  UpdateTransformCommand,
  SplitTimelineItemCommand,
  ResizeTimelineItemCommand,
  AddTrackCommand,
  RemoveTrackCommand,
  RenameTrackCommand,
  ToggleTrackVisibilityCommand,
  ToggleTrackMuteCommand,
} from '@/unified/modules/commands/timelineCommands'
import { BatchAutoArrangeTrackCommand } from '@/unified/modules/commands/batchCommands'
import { TimelineItemQueries } from '@/unified/timelineitem/'
import { duplicateTimelineItem } from '@/unified/timelineitem/TimelineItemFactory'

// 模块接口类型定义
interface UnifiedHistoryModule {
  executeCommand: (command: SimpleCommand) => Promise<void>
}

interface UnifiedTimelineModule {
  timelineItems: Ref<UnifiedTimelineItemData<MediaType>[]>
  addTimelineItem: (item: UnifiedTimelineItemData<MediaType>) => Promise<void>
  removeTimelineItem: (timelineItemId: string) => void
  getTimelineItem: (timelineItemId: string) => UnifiedTimelineItemData<MediaType> | undefined
  setupTimelineItemSprite: (item: UnifiedTimelineItemData<MediaType>) => Promise<void>
  updateTimelineItemPosition: (
    timelineItemId: string,
    newPositionFrames: number,
    newTrackId?: string,
  ) => void
  updateTimelineItemTransform: (timelineItemId: string, transform: TransformProperties) => void
  updateTimelineItemPlaybackRate: (timelineItemId: string, newRate: number) => void
}

interface UnifiedWebavModule {
  addSprite: (sprite: VisibleSprite) => Promise<boolean>
  removeSprite: (sprite: VisibleSprite) => boolean
}

interface UnifiedMediaModule {
  getMediaItem: (id: string) => UnifiedMediaItemData | undefined
}

interface UnifiedConfigModule {
  videoResolution: Ref<VideoResolution>
}

interface UnifiedTrackModule {
  tracks: Ref<UnifiedTrackData[]>
  addTrack: (trackData: UnifiedTrackData, position?: number) => UnifiedTrackData
  removeTrack: (
    trackId: string,
    timelineItems: Ref<UnifiedTimelineItemData<MediaType>[]>,
    removeTimelineItemCallback?: (timelineItemId: string) => void,
  ) => void
  getTrack: (trackId: string) => UnifiedTrackData | undefined
  renameTrack: (trackId: string, newName: string) => void
  toggleTrackVisibility: (
    trackId: string,
    timelineItems?: Ref<UnifiedTimelineItemData<MediaType>[]>,
  ) => void
  toggleTrackMute: (
    trackId: string,
    timelineItems?: Ref<UnifiedTimelineItemData<MediaType>[]>,
  ) => void
}

// 变换属性类型定义
interface TransformProperties {
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  opacity?: number
  zIndex?: number
  duration?: number // 时长（帧数）
  playbackRate?: number // 倍速
  volume?: number // 音量（0-1之间）
  isMuted?: boolean // 静音状态
  gain?: number // 音频增益（dB）
}

/**
 * 历史记录操作相关方法
 * 包括时间轴项目和轨道相关的历史记录操作方法
 */
export function createHistoryOperations(
  unifiedHistoryModule: UnifiedHistoryModule,
  unifiedTimelineModule: UnifiedTimelineModule,
  unifiedWebavModule: UnifiedWebavModule,
  unifiedMediaModule: UnifiedMediaModule,
  unifiedConfigModule: UnifiedConfigModule,
  unifiedTrackModule?: UnifiedTrackModule,
) {
  // ==================== 辅助函数 ====================

  /**
   * 检查变换属性是否有实际变化
   */
  function checkTransformChanges(
    oldTransform: TransformProperties,
    newTransform: TransformProperties,
  ): boolean {
    // 检查位置变化
    if (
      (newTransform.x !== undefined && oldTransform.x !== undefined) ||
      (newTransform.y !== undefined && oldTransform.y !== undefined)
    ) {
      const xChanged =
        newTransform.x !== undefined &&
        oldTransform.x !== undefined &&
        Math.abs(oldTransform.x - newTransform.x) > 0.1
      const yChanged =
        newTransform.y !== undefined &&
        oldTransform.y !== undefined &&
        Math.abs(oldTransform.y - newTransform.y) > 0.1
      if (xChanged || yChanged) return true
    }

    // 检查大小变化
    if (
      (newTransform.width !== undefined && oldTransform.width !== undefined) ||
      (newTransform.height !== undefined && oldTransform.height !== undefined)
    ) {
      const widthChanged =
        newTransform.width !== undefined &&
        oldTransform.width !== undefined &&
        Math.abs(oldTransform.width - newTransform.width) > 0.1
      const heightChanged =
        newTransform.height !== undefined &&
        oldTransform.height !== undefined &&
        Math.abs(oldTransform.height - newTransform.height) > 0.1
      if (widthChanged || heightChanged) return true
    }

    // 检查旋转变化
    if (newTransform.rotation !== undefined && oldTransform.rotation !== undefined) {
      const rotationChanged = Math.abs(oldTransform.rotation - newTransform.rotation) > 0.001 // 约0.06度
      if (rotationChanged) return true
    }

    // 检查透明度变化
    if (newTransform.opacity !== undefined && oldTransform.opacity !== undefined) {
      const opacityChanged = Math.abs(oldTransform.opacity - newTransform.opacity) > 0.001
      if (opacityChanged) return true
    }

    // 检查层级变化
    if (newTransform.zIndex !== undefined && oldTransform.zIndex !== undefined) {
      const zIndexChanged = oldTransform.zIndex !== newTransform.zIndex
      if (zIndexChanged) return true
    }

    // 检查时长变化
    if (newTransform.duration !== undefined && oldTransform.duration !== undefined) {
      const durationChanged = Math.abs(oldTransform.duration - newTransform.duration) > 0.1 // 0.1秒误差容忍
      if (durationChanged) return true
    }

    // 检查倍速变化
    if (newTransform.playbackRate !== undefined && oldTransform.playbackRate !== undefined) {
      const playbackRateChanged =
        Math.abs(oldTransform.playbackRate - newTransform.playbackRate) > 0.01 // 0.01倍速误差容忍
      if (playbackRateChanged) return true
    }

    // 检查音量变化
    if (newTransform.volume !== undefined && oldTransform.volume !== undefined) {
      const volumeChanged = Math.abs(oldTransform.volume - newTransform.volume) > 0.01 // 0.01音量误差容忍
      if (volumeChanged) return true
    }

    // 检查静音状态变化
    if (newTransform.isMuted !== undefined && oldTransform.isMuted !== undefined) {
      const muteChanged = oldTransform.isMuted !== newTransform.isMuted
      if (muteChanged) return true
    }

    // 检查增益变化
    if (newTransform.gain !== undefined && oldTransform.gain !== undefined) {
      const gainChanged = Math.abs(oldTransform.gain - newTransform.gain) > 0.1 // 0.1dB误差容忍
      if (gainChanged) return true
    }

    return false
  }

  // ==================== 时间轴项目历史记录方法 ====================

  /**
   * 带历史记录的添加时间轴项目方法
   * @param timelineItem 要添加的时间轴项目
   */
  async function addTimelineItemWithHistory(timelineItem: UnifiedTimelineItemData<MediaType>) {
    const command = new AddTimelineItemCommand(
      timelineItem,
      {
        addTimelineItem: unifiedTimelineModule.addTimelineItem,
        removeTimelineItem: unifiedTimelineModule.removeTimelineItem,
        getTimelineItem: unifiedTimelineModule.getTimelineItem,
        setupTimelineItemSprite: unifiedTimelineModule.setupTimelineItemSprite,
      },
      {
        addSprite: unifiedWebavModule.addSprite,
        removeSprite: unifiedWebavModule.removeSprite,
      },
      {
        getMediaItem: unifiedMediaModule.getMediaItem,
      },
      {
        videoResolution: unifiedConfigModule.videoResolution,
      },
    )
    await unifiedHistoryModule.executeCommand(command)
  }

  /**
   * 带历史记录的删除时间轴项目方法
   * @param timelineItemId 要删除的时间轴项目ID
   */
  async function removeTimelineItemWithHistory(timelineItemId: string) {
    const command = new RemoveTimelineItemCommand(
      timelineItemId,
      {
        addTimelineItem: unifiedTimelineModule.addTimelineItem,
        removeTimelineItem: unifiedTimelineModule.removeTimelineItem,
        getTimelineItem: unifiedTimelineModule.getTimelineItem,
        setupTimelineItemSprite: unifiedTimelineModule.setupTimelineItemSprite,
      },
      {
        addSprite: unifiedWebavModule.addSprite,
        removeSprite: unifiedWebavModule.removeSprite,
      },
      {
        getMediaItem: unifiedMediaModule.getMediaItem,
      },
      {
        videoResolution: unifiedConfigModule.videoResolution,
      },
    )
    await unifiedHistoryModule.executeCommand(command)
  }

  /**
   * 带历史记录的移动时间轴项目方法
   * @param timelineItemId 要移动的时间轴项目ID
   * @param newPositionFrames 新的时间位置（帧数）
   * @param newTrackId 新的轨道ID（可选）
   */
  async function moveTimelineItemWithHistory(
    timelineItemId: string,
    newPositionFrames: number,
    newTrackId?: string,
  ) {
    // 获取要移动的时间轴项目
    const timelineItem = unifiedTimelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法移动: ${timelineItemId}`)
      return
    }

    // 获取当前位置和轨道
    const oldPositionFrames = timelineItem.timeRange.timelineStartTime // 帧数
    const oldTrackId = timelineItem.trackId || 'default-track' // 提供默认值
    const finalNewTrackId = newTrackId !== undefined ? newTrackId : oldTrackId

    // 检查是否有实际变化
    const positionChanged = Math.abs(oldPositionFrames - newPositionFrames) >= 1 // 允许1帧及以上的变化
    const trackChanged = oldTrackId !== finalNewTrackId

    if (!positionChanged && !trackChanged) {
      console.log('⚠️ 位置和轨道都没有变化，跳过移动操作')
      return
    }

    const command = new MoveTimelineItemCommand(
      timelineItemId,
      oldPositionFrames,
      newPositionFrames,
      oldTrackId,
      finalNewTrackId,
      {
        updateTimelineItemPosition: unifiedTimelineModule.updateTimelineItemPosition,
        getTimelineItem: unifiedTimelineModule.getTimelineItem,
      },
      {
        getMediaItem: unifiedMediaModule.getMediaItem,
      },
    )
    await unifiedHistoryModule.executeCommand(command)
  }

  /**
   * 带历史记录的更新变换属性方法（增强版）
   * @param timelineItemId 要更新的时间轴项目ID
   * @param newTransform 新的变换属性
   */
  async function updateTimelineItemTransformWithHistory(
    timelineItemId: string,
    newTransform: TransformProperties,
  ) {
    // 获取要更新的时间轴项目
    const timelineItem = unifiedTimelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法更新变换属性: ${timelineItemId}`)
      return
    }

    // 获取当前的变换属性（类型安全版本）
    const oldTransform: TransformProperties = {}

    // 检查是否具有视觉属性
    if (TimelineItemQueries.hasVisualProperties(timelineItem)) {
      const config = timelineItem.config as VideoMediaConfig
      if (newTransform.x !== undefined) {
        oldTransform.x = config.x
      }
      if (newTransform.y !== undefined) {
        oldTransform.y = config.y
      }
      if (newTransform.width !== undefined) {
        oldTransform.width = config.width
      }
      if (newTransform.height !== undefined) {
        oldTransform.height = config.height
      }
      if (newTransform.rotation !== undefined) {
        oldTransform.rotation = config.rotation
      }
      if (newTransform.opacity !== undefined) {
        oldTransform.opacity = config.opacity
      }
    }

    if (newTransform.zIndex !== undefined) {
      const config = timelineItem.config as VideoMediaConfig
      oldTransform.zIndex = config.zIndex
    }

    if (newTransform.duration !== undefined) {
      // 计算当前时长（帧数）
      const timeRange = timelineItem.timeRange
      const currentDurationFrames = timeRange.timelineEndTime - timeRange.timelineStartTime
      oldTransform.duration = currentDurationFrames
    }

    if (newTransform.playbackRate !== undefined) {
      // 获取当前倍速（对视频和音频有效）
      oldTransform.playbackRate = 1
      if (
        TimelineItemQueries.isVideoTimelineItem(timelineItem) ||
        TimelineItemQueries.isAudioTimelineItem(timelineItem)
      ) {
        const sprite = timelineItem.runtime.sprite as
          | VideoVisibleSprite
          | AudioVisibleSprite
          | undefined
        if (sprite) {
          oldTransform.playbackRate = sprite.getPlaybackRate()
        }
      }
    }

    // 检查是否具有音频属性
    if (TimelineItemQueries.hasAudioProperties(timelineItem)) {
      const config = timelineItem.config as AudioMediaConfig
      if (newTransform.volume !== undefined) {
        oldTransform.volume = config.volume ?? 1
      }
      if (newTransform.isMuted !== undefined) {
        oldTransform.isMuted = config.isMuted ?? false
      }
    }

    if (timelineItem.mediaType === 'audio' && newTransform.gain !== undefined) {
      // 获取当前增益（仅对音频有效）
      const config = timelineItem.config as AudioMediaConfig
      oldTransform.gain = config.gain ?? 0
    }

    // 检查是否有实际变化
    const hasChanges = checkTransformChanges(oldTransform, newTransform)
    if (!hasChanges) {
      console.log('⚠️ 变换属性没有变化，跳过更新操作')
      return
    }

    const command = new UpdateTransformCommand(
      timelineItemId,
      oldTransform,
      newTransform,
      {
        updateTimelineItemTransform: unifiedTimelineModule.updateTimelineItemTransform,
        getTimelineItem: unifiedTimelineModule.getTimelineItem,
        updateTimelineItemPlaybackRate: unifiedTimelineModule.updateTimelineItemPlaybackRate,
      },
      {
        getMediaItem: unifiedMediaModule.getMediaItem,
      },
    )
    await unifiedHistoryModule.executeCommand(command)
  }

  /**
   * 带历史记录的分割时间轴项目方法
   * @param timelineItemId 要分割的时间轴项目ID
   * @param splitTimeFrames 分割时间点（帧数）
   */
  async function splitTimelineItemAtTimeWithHistory(
    timelineItemId: string,
    splitTimeFrames: number,
  ) {
    // 获取要分割的时间轴项目
    const timelineItem = unifiedTimelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法分割: ${timelineItemId}`)
      return
    }

    const command = new SplitTimelineItemCommand(
      timelineItemId,
      timelineItem,
      splitTimeFrames,
      {
        addTimelineItem: unifiedTimelineModule.addTimelineItem,
        removeTimelineItem: unifiedTimelineModule.removeTimelineItem,
        getTimelineItem: unifiedTimelineModule.getTimelineItem,
        setupTimelineItemSprite: unifiedTimelineModule.setupTimelineItemSprite,
      },
      {
        addSprite: unifiedWebavModule.addSprite,
        removeSprite: unifiedWebavModule.removeSprite,
      },
      {
        getMediaItem: unifiedMediaModule.getMediaItem,
      },
    )
    await unifiedHistoryModule.executeCommand(command)
  }

  /**
   * 带历史记录的复制时间轴项目方法
   * @param timelineItemId 要复制的时间轴项目ID
   * @param newPositionFrames 新项目的时间位置（帧数，可选）
   * @param newTrackId 新项目的轨道ID（可选）
   */
  async function duplicateTimelineItemWithHistory(
    timelineItemId: string,
    newPositionFrames?: number,
    newTrackId?: string,
  ) {
    // 获取要复制的时间轴项目
    const timelineItem = unifiedTimelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法复制: ${timelineItemId}`)
      return
    }

    // 计算时间偏移
    const currentPosition = timelineItem.timeRange.timelineStartTime
    const targetPosition = newPositionFrames || timelineItem.timeRange.timelineEndTime
    const timeOffset = targetPosition - currentPosition

    // 使用 TimelineItemFactory 复制项目
    const duplicatedItem = duplicateTimelineItem(
      timelineItem,
      newTrackId || timelineItem.trackId || 'default-track',
      timeOffset,
    )

    // 使用 AddTimelineItemCommand 添加复制后的项目
    const command = new AddTimelineItemCommand(
      duplicatedItem,
      {
        addTimelineItem: unifiedTimelineModule.addTimelineItem,
        removeTimelineItem: unifiedTimelineModule.removeTimelineItem,
        getTimelineItem: unifiedTimelineModule.getTimelineItem,
        setupTimelineItemSprite: unifiedTimelineModule.setupTimelineItemSprite,
      },
      {
        addSprite: unifiedWebavModule.addSprite,
        removeSprite: unifiedWebavModule.removeSprite,
      },
      {
        getMediaItem: unifiedMediaModule.getMediaItem,
      },
      {
        videoResolution: unifiedConfigModule.videoResolution,
      },
    )
    await unifiedHistoryModule.executeCommand(command)
  }

  /**
   * 带历史记录的调整时间轴项目大小方法
   * @param timelineItemId 要调整的时间轴项目ID
   * @param newTimeRange 新的时间范围
   */
  async function resizeTimelineItemWithHistory(
    timelineItemId: string,
    newTimeRange: UnifiedTimeRange,
  ): Promise<boolean> {
    try {
      console.log('🔧 [UnifiedStore] 调整时间轴项目大小:', {
        timelineItemId,
        newTimeRange,
      })

      // 获取当前项目
      const currentItem = unifiedTimelineModule.getTimelineItem(timelineItemId)
      if (!currentItem) {
        console.error('❌ [UnifiedStore] 时间轴项目不存在:', timelineItemId)
        return false
      }

      // 检查时间范围是否有变化
      const currentTimeRange = currentItem.timeRange
      if (
        currentTimeRange.timelineStartTime === newTimeRange.timelineStartTime &&
        currentTimeRange.timelineEndTime === newTimeRange.timelineEndTime
      ) {
        console.log('ℹ️ [UnifiedStore] 时间范围无变化，跳过调整')
        return true
      }

      // 创建调整大小命令
      const command = new ResizeTimelineItemCommand(
        timelineItemId,
        currentTimeRange,
        newTimeRange,
        {
          getTimelineItem: unifiedTimelineModule.getTimelineItem,
        },
        {
          getMediaItem: unifiedMediaModule.getMediaItem,
        },
      )

      // 执行命令
      await unifiedHistoryModule.executeCommand(command)
      console.log('✅ [UnifiedStore] 时间轴项目大小调整成功')
      return true
    } catch (error) {
      console.error('❌ [UnifiedStore] 调整时间轴项目大小时发生错误:', error)
      return false
    }
  }

  /**
   * 带历史记录的添加轨道方法
   * @param type 轨道类型
   * @param position 插入位置（可选）
   */
  async function addTrackWithHistory(type: UnifiedTrackType = 'video', position?: number) {
    if (!unifiedTrackModule) {
      console.warn('⚠️ 轨道模块未初始化，无法添加轨道')
      return
    }
    const command = new AddTrackCommand(type, position, {
      addTrack: unifiedTrackModule.addTrack,
      removeTrack: unifiedTrackModule.removeTrack,
      getTrack: unifiedTrackModule.getTrack,
    })
    await unifiedHistoryModule.executeCommand(command)
  }

  /**
   * 带历史记录的删除轨道方法
   * @param trackId 要删除的轨道ID
   */
  async function removeTrackWithHistory(trackId: string) {
    if (!unifiedTrackModule) {
      console.warn('⚠️ 轨道模块未初始化，无法删除轨道')
      return
    }
    // 获取要删除的轨道
    const track = unifiedTrackModule.getTrack(trackId)
    if (!track) {
      console.warn(`⚠️ 轨道不存在，无法删除: ${trackId}`)
      return
    }

    const command = new RemoveTrackCommand(
      trackId,
      {
        addTrack: unifiedTrackModule.addTrack,
        removeTrack: (id: string) =>
          unifiedTrackModule!.removeTrack(id, unifiedTimelineModule.timelineItems),
        getTrack: unifiedTrackModule.getTrack,
        tracks: unifiedTrackModule.tracks,
      },
      {
        addTimelineItem: unifiedTimelineModule.addTimelineItem,
        removeTimelineItem: unifiedTimelineModule.removeTimelineItem,
        getTimelineItem: unifiedTimelineModule.getTimelineItem,
        setupTimelineItemSprite: unifiedTimelineModule.setupTimelineItemSprite,
        timelineItems: unifiedTimelineModule.timelineItems,
      },
      {
        addSprite: unifiedWebavModule.addSprite,
        removeSprite: unifiedWebavModule.removeSprite,
      },
      {
        getMediaItem: unifiedMediaModule.getMediaItem,
      },
      {
        videoResolution: unifiedConfigModule.videoResolution,
      },
    )
    await unifiedHistoryModule.executeCommand(command)
  }

  /**
   * 带历史记录的重命名轨道方法
   * @param trackId 要重命名的轨道ID
   * @param newName 新名称
   */
  async function renameTrackWithHistory(trackId: string, newName: string) {
    if (!unifiedTrackModule) {
      console.warn('⚠️ 轨道模块未初始化，无法重命名轨道')
      return
    }
    // 获取要重命名的轨道
    const track = unifiedTrackModule.getTrack(trackId)
    if (!track) {
      console.warn(`⚠️ 轨道不存在，无法重命名: ${trackId}`)
      return
    }

    const oldName = track.name

    const command = new RenameTrackCommand(trackId, newName, {
      renameTrack: unifiedTrackModule.renameTrack,
      getTrack: unifiedTrackModule.getTrack,
    })
    await unifiedHistoryModule.executeCommand(command)
  }

  /**
   * 带历史记录的自动排列轨道方法
   * 根据轨道ID自动排列该轨道上的所有时间轴项目
   * @param trackId 要排列的轨道ID
   */
  async function autoArrangeTrackWithHistory(trackId: string) {
    if (!unifiedTrackModule) {
      console.warn('⚠️ 轨道模块未初始化，无法自动排列轨道')
      return
    }
    const command = new BatchAutoArrangeTrackCommand(
      trackId,
      unifiedTimelineModule.timelineItems.value.filter((item) => item.trackId === trackId),
      {
        getTimelineItem: unifiedTimelineModule.getTimelineItem,
        updateTimelineItemPosition: unifiedTimelineModule.updateTimelineItemPosition,
      },
      {
        getMediaItem: unifiedMediaModule.getMediaItem,
      },
      {
        getTrack: unifiedTrackModule.getTrack,
      },
    )
    await unifiedHistoryModule.executeCommand(command)
  }

  /**
   * 带历史记录的切换轨道可见性方法
   * @param trackId 要切换的轨道ID
   */
  async function toggleTrackVisibilityWithHistory(trackId: string) {
    if (!unifiedTrackModule) {
      console.warn('⚠️ 轨道模块未初始化，无法切换轨道可见性')
      return
    }
    // 获取要切换的轨道
    const track = unifiedTrackModule.getTrack(trackId)
    if (!track) {
      console.warn(`⚠️ 轨道不存在，无法切换可见性: ${trackId}`)
      return
    }

    const command = new ToggleTrackVisibilityCommand(
      trackId,
      {
        getTrack: unifiedTrackModule.getTrack,
        toggleTrackVisibility: (id: string) =>
          unifiedTrackModule!.toggleTrackVisibility(id, unifiedTimelineModule.timelineItems),
      },
      {
        timelineItems: unifiedTimelineModule.timelineItems,
      },
    )
    await unifiedHistoryModule.executeCommand(command)
  }

  /**
   * 带历史记录的切换轨道静音方法
   * @param trackId 要切换的轨道ID
   */
  async function toggleTrackMuteWithHistory(trackId: string) {
    if (!unifiedTrackModule) {
      console.warn('⚠️ 轨道模块未初始化，无法切换轨道静音')
      return
    }
    // 获取要切换的轨道
    const track = unifiedTrackModule.getTrack(trackId)
    if (!track) {
      console.warn(`⚠️ 轨道不存在，无法切换静音: ${trackId}`)
      return
    }

    const command = new ToggleTrackMuteCommand(
      trackId,
      {
        getTrack: unifiedTrackModule.getTrack,
        toggleTrackMute: (id: string) =>
          unifiedTrackModule!.toggleTrackMute(id, unifiedTimelineModule.timelineItems),
      },
      {
        timelineItems: unifiedTimelineModule.timelineItems,
      },
    )
    await unifiedHistoryModule.executeCommand(command)
  }

  return {
    addTimelineItemWithHistory,
    removeTimelineItemWithHistory,
    moveTimelineItemWithHistory,
    updateTimelineItemTransformWithHistory,
    splitTimelineItemAtTimeWithHistory,
    duplicateTimelineItemWithHistory,
    resizeTimelineItemWithHistory,
    addTrackWithHistory,
    removeTrackWithHistory,
    renameTrackWithHistory,
    autoArrangeTrackWithHistory,
    toggleTrackVisibilityWithHistory,
    toggleTrackMuteWithHistory,
  }
}

// 导出类型定义供其他模块使用
export type {
  UnifiedHistoryModule,
  UnifiedTimelineModule,
  UnifiedWebavModule,
  UnifiedMediaModule,
  UnifiedConfigModule,
  UnifiedTrackModule,
  TransformProperties,
}

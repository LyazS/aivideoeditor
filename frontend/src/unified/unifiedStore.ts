import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createUnifiedMediaModule } from '@/unified/modules/UnifiedMediaModule'
import { createUnifiedTrackModule } from '@/unified/modules/UnifiedTrackModule'
import { createUnifiedTimelineModule } from '@/unified/modules/UnifiedTimelineModule'
import { createUnifiedProjectModule } from '@/unified/modules/UnifiedProjectModule'
import { createUnifiedViewportModule } from '@/unified/modules/UnifiedViewportModule'
import { createUnifiedSelectionModule } from '@/unified/modules/UnifiedSelectionModule'
import { createUnifiedClipOperationsModule } from '@/unified/modules/UnifiedClipOperationsModule'
import { createUnifiedConfigModule } from '@/unified/modules/UnifiedConfigModule'
import { createUnifiedPlaybackModule } from '@/unified/modules/UnifiedPlaybackModule'
import { createUnifiedWebavModule } from '@/unified/modules/UnifiedWebavModule'
import { createUnifiedNotificationModule } from '@/unified/modules/UnifiedNotificationModule'
import { createUnifiedHistoryModule } from '@/unified/modules/UnifiedHistoryModule'
import { createUnifiedAutoSaveModule } from '@/unified/modules/UnifiedAutoSaveModule'
import { calculateTotalDurationFrames } from '@/unified/utils/durationUtils'
import type { MediaType, MediaTypeOrUnknown } from '@/unified'
import type { UnifiedTrackType } from '@/unified/track/TrackTypes'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem'
// PropertyType 已经在本地定义，不再需要从外部导入
/**
 * 属性类型枚举
 * 用于标识可修改的时间轴项目属性类型
 */
export type PropertyType =
  | 'position'
  | 'size'
  | 'rotation'
  | 'opacity'
  | 'zIndex'
  | 'duration'
  | 'playbackRate'
  | 'volume'
  | 'audioState'
  | 'gain'
  | 'multiple'

import type { UnifiedTimeRange } from '@/unified/types/timeRange'

import { frameToPixel, pixelToFrame } from '@/unified/utils/coordinateUtils'
import {
  expandTimelineIfNeededFrames,
  smartExpandTimelineIfNeeded,
  batchExpandTimelineIfNeeded,
  predictiveExpandTimeline,
  getTimelineExpansionSuggestion,
} from '@/unified/utils/timeUtils'
import {
  getTimelineItemAtFrames,
  getTimelineItemsByTrack,
  findTimelineItemBySprite,
  getTimelineItemsAtFrames,
  getTimelineItemAtTrackAndFrames,
  isPlayheadInTimelineItem,
  getTimelineItemsByMediaType,
  getTimelineItemsByStatus,
  getTimelineItemDuration,
  sortTimelineItemsByTime,
  findOverlappingTimelineItems,
  findOverlappingTimelineItemsOnTrack,
  findOrphanedTimelineItems,
} from '@/unified/utils/timelineSearchUtils'
import { TimelineItemQueries } from '@/unified/timelineitem/'

// 从TimelineItemFactory导入工厂函数
import {
  cloneTimelineItem,
  duplicateTimelineItem,
} from '@/unified/timelineitem/TimelineItemFactory'

// ==================== 命令类导入 ====================
import {
  AddTimelineItemCommand,
  RemoveTimelineItemCommand,
  MoveTimelineItemCommand,
  UpdateTransformCommand,
  SplitTimelineItemCommand,
  AddTrackCommand,
  RemoveTrackCommand,
  RenameTrackCommand,
  ToggleTrackVisibilityCommand,
  ToggleTrackMuteCommand,
  ResizeTimelineItemCommand,
} from '@/unified/modules/commands/timelineCommands'

import {
  BatchDeleteCommand,
  BatchAutoArrangeTrackCommand,
} from '@/unified/modules/commands/batchCommands'

/**
 * 统一视频编辑器存储
 * 基于新的统一类型系统重构的主要状态管理
 *
 * 架构特点：
 * 1. 使用 UnifiedMediaModule 管理统一媒体项目
 * 2. 使用 UnifiedTrackModule 管理统一轨道系统
 * 3. 使用 UnifiedTimelineModule 管理统一时间轴项目
 * 4. 使用 UnifiedProjectModule 管理统一项目配置
 * 5. 使用 UnifiedViewportModule 管理统一视口缩放滚动
 * 6. 使用 UnifiedSelectionModule 管理时间轴项目和媒体项目的选择状态
 * 7. 使用 UnifiedClipOperationsModule 提供片段操作功能
 * 8. 使用 UnifiedConfigModule 管理视频编辑器全局配置
 * 9. 使用 UnifiedPlaybackModule 管理播放控制功能
 * 10. 使用 UnifiedWebavModule 管理WebAV集成和画布操作
 * 11. 集成 UnifiedNotificationModule 提供通知管理功能
 * 12. 集成 UnifiedHistoryModule 提供撤销重做功能
 * 13. 保持模块化设计，各模块职责清晰
 * 14. 提供完整的视频编辑功能支持
 */
export const useUnifiedStore = defineStore('unified', () => {
  // ==================== 核心模块初始化 ====================

  // 创建配置管理模块
  const unifiedConfigModule = createUnifiedConfigModule()

  // 创建播放控制模块
  const unifiedPlaybackModule = createUnifiedPlaybackModule(unifiedConfigModule.frameRate)

  // 创建WebAV集成模块
  const unifiedWebavModule = createUnifiedWebavModule({
    currentFrame: unifiedPlaybackModule.currentFrame,
    currentWebAVFrame: unifiedPlaybackModule.currentWebAVFrame,
    isPlaying: unifiedPlaybackModule.isPlaying,
    setCurrentFrame: unifiedPlaybackModule.setCurrentFrame,
    setPlaying: unifiedPlaybackModule.setPlaying,
  })
  // 创建统一媒体管理模块（替代原有的mediaModule）
  const unifiedMediaModule = createUnifiedMediaModule(unifiedWebavModule)

  // 创建统一轨道管理模块
  const unifiedTrackModule = createUnifiedTrackModule()

  // 创建统一时间轴管理模块（需要依赖其他模块）
  const unifiedTimelineModule = createUnifiedTimelineModule(
    unifiedConfigModule,
    unifiedWebavModule,
    unifiedMediaModule,
    unifiedTrackModule,
  )

  // 创建统一项目管理模块
  const unifiedProjectModule = createUnifiedProjectModule(
    unifiedConfigModule,
    unifiedTimelineModule,
    unifiedTrackModule,
    unifiedMediaModule,
    unifiedWebavModule,
  )

  // ==================== 计算属性 ====================

  /**
   * 总时长（帧数版本）
   */
  const totalDurationFrames = computed(() => {
    return calculateTotalDurationFrames(
      unifiedTimelineModule.timelineItems.value,
      unifiedConfigModule.timelineDurationFrames.value,
    )
  })

  // 创建统一视口管理模块（需要在totalDurationFrames之后创建）
  const unifiedViewportModule = createUnifiedViewportModule(
    unifiedTimelineModule.timelineItems,
    totalDurationFrames,
    unifiedConfigModule.timelineDurationFrames,
  )

  // 创建通知管理模块
  const unifiedNotificationModule = createUnifiedNotificationModule()

  // 创建历史管理模块（需要在unifiedNotificationModule之后创建）
  const unifiedHistoryModule = createUnifiedHistoryModule(unifiedNotificationModule)

  // 创建统一选择管理模块（需要在unifiedHistoryModule之后创建）
  const unifiedSelectionModule = createUnifiedSelectionModule(
    unifiedTimelineModule.getTimelineItem,
    unifiedMediaModule.getMediaItem,
    unifiedHistoryModule.executeCommand,
  )

  // 创建统一片段操作模块（需要在其他模块之后创建）
  const unifiedClipOperationsModule = createUnifiedClipOperationsModule(
    {
      getTimelineItem: unifiedTimelineModule.getTimelineItem,
      updateTimelineItem: (id: string, updates: Partial<UnifiedTimelineItemData>) => {
        // 简单的更新实现：直接修改对象属性
        const item = unifiedTimelineModule.getTimelineItem(id)
        if (item) {
          Object.assign(item, updates)
        }
      },
    },
    unifiedMediaModule,
  )

  // 创建统一自动保存模块（需要在项目模块之后创建）
  const unifiedAutoSaveModule = createUnifiedAutoSaveModule(
    {
      projectModule: {
        saveCurrentProject: unifiedProjectModule.saveCurrentProject,
        isSaving: unifiedProjectModule.isSaving,
      },
      dataWatchers: {
        timelineItems: unifiedTimelineModule.timelineItems,
        tracks: unifiedTrackModule.tracks,
        mediaItems: unifiedMediaModule.mediaItems,
        projectConfig: computed(() => ({
          videoResolution: unifiedConfigModule.videoResolution.value,
          frameRate: unifiedConfigModule.frameRate.value,
          timelineDurationFrames: unifiedConfigModule.timelineDurationFrames.value,
        })),
      },
    },
    {
      // 可以在这里传入自定义配置
      enabled: true,
      debounceTime: 2000,
      throttleTime: 30000,
      maxRetries: 3,
    },
  )

  /**
   * 媒体项目统计信息
   */
  const mediaStats = computed(() => {
    return unifiedMediaModule.getMediaItemsStats()
  })

  /**
   * 就绪的媒体项目数量
   */
  const readyMediaCount = computed(() => {
    return unifiedMediaModule.getReadyMediaItems().length
  })

  /**
   * 是否有正在处理的媒体项目
   */
  const hasProcessingMedia = computed(() => {
    return unifiedMediaModule.getProcessingMediaItems().length > 0
  })

  /**
   * 是否有错误的媒体项目
   */
  const hasErrorMedia = computed(() => {
    return unifiedMediaModule.getErrorMediaItems().length > 0
  })

  /**
   * WebAV是否可用（保留，因为是方法调用的计算属性）
   */
  const isWebAVAvailable = computed(() => {
    return unifiedWebavModule.isWebAVAvailable()
  })

  // ==================== 批量操作方法（带日志） ====================

  /**
   * 批量重试错误的媒体项目
   */
  function retryAllErrorItems() {
    unifiedMediaModule.retryAllErrorItems()
    console.log('🔄 [UnifiedStore] 批量重试错误项目')
  }

  /**
   * 清理已取消的媒体项目
   */
  function clearCancelledItems() {
    unifiedMediaModule.clearCancelledItems()
    console.log('🧹 [UnifiedStore] 清理已取消项目')
  }

  // ==================== 需要特殊处理的方法 ====================

  /**
   * 按类型获取媒体项目（保留类型检查）
   * @param mediaType 媒体类型
   */
  function getMediaItemsByType(mediaType: MediaType | 'unknown') {
    return unifiedMediaModule.getMediaItemsByType(mediaType)
  }

  // ==================== 系统状态方法（带日志） ====================

  /**
   * 重置所有模块到默认状态
   */
  function resetToDefaults() {
    unifiedConfigModule.resetToDefaults()
    unifiedPlaybackModule.resetToDefaults()
    unifiedWebavModule.resetToDefaults()
    unifiedTrackModule.resetTracksToDefaults()
    unifiedProjectModule.resetLoadingState()
    unifiedViewportModule.resetViewport()
    unifiedNotificationModule.clearNotifications(true) // 清空所有通知，包括持久化通知
    unifiedHistoryModule.clear() // 清空历史记录
    unifiedSelectionModule.resetToDefaults() // 重置选择状态
    // 注意：UnifiedMediaModule、UnifiedTimelineModule和UnifiedClipOperationsModule没有resetToDefaults方法
    // 这些统一模块的状态通过清空数组或重置内部状态来实现重置功能
    unifiedAutoSaveModule.resetAutoSaveState() // 重置自动保存状态
    console.log('🔄 [UnifiedStore] 重置所有模块到默认状态')
  }

  /**
   * 销毁所有模块资源
   */
  function destroyAllModules() {
    unifiedAutoSaveModule.destroy() // 销毁自动保存模块
    console.log('🧹 [UnifiedStore] 销毁所有模块资源')
  }

  // ==================== 历史记录包装方法 ====================

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
    newTransform: {
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
    },
  ) {
    // 获取要更新的时间轴项目
    const timelineItem = unifiedTimelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法更新变换属性: ${timelineItemId}`)
      return
    }

    // 获取当前的变换属性（类型安全版本）
    const oldTransform: typeof newTransform = {}

    // 检查是否具有视觉属性
    if (TimelineItemQueries.hasVisualProperties(timelineItem)) {
      const config = timelineItem.config as any
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
      const config = timelineItem.config as any
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
      if (
        (timelineItem.mediaType === 'video' || timelineItem.mediaType === 'audio') &&
        'playbackRate' in timelineItem.timeRange
      ) {
        oldTransform.playbackRate = (timelineItem.timeRange as any).playbackRate || 1
      } else {
        oldTransform.playbackRate = 1 // 图片和文本默认为1
      }
    }

    // 检查是否具有音频属性
    if (TimelineItemQueries.hasAudioProperties(timelineItem)) {
      const config = timelineItem.config as any
      if (newTransform.volume !== undefined) {
        oldTransform.volume = config.volume ?? 1
      }
      if (newTransform.isMuted !== undefined) {
        oldTransform.isMuted = config.isMuted ?? false
      }
    }

    if (timelineItem.mediaType === 'audio' && newTransform.gain !== undefined) {
      // 获取当前增益（仅对音频有效）
      const config = timelineItem.config as any
      oldTransform.gain = config.gain ?? 0
    }

    // 检查是否有实际变化
    const hasChanges = checkTransformChanges(oldTransform, newTransform)
    if (!hasChanges) {
      console.log('⚠️ 变换属性没有变化，跳过更新操作')
      return
    }

    // 确定属性类型
    const propertyType = determinePropertyType(newTransform)

    const command = new UpdateTransformCommand(
      timelineItemId,
      propertyType,
      oldTransform,
      newTransform,
      {
        updateTimelineItemTransform: unifiedTimelineModule.updateTimelineItemTransform,
        getTimelineItem: unifiedTimelineModule.getTimelineItem,
      },
      {
        getMediaItem: unifiedMediaModule.getMediaItem,
      },
      {
        updateTimelineItemPlaybackRate: unifiedClipOperationsModule.updateTimelineItemPlaybackRate,
      },
    )
    await unifiedHistoryModule.executeCommand(command)
  }

  /**
   * 检查变换属性是否有实际变化
   */
  function checkTransformChanges(oldTransform: any, newTransform: any): boolean {
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

  /**
   * 确定属性类型
   */
  function determinePropertyType(transform: any): PropertyType {
    const changedProperties = []

    if (transform.x !== undefined || transform.y !== undefined) changedProperties.push('position')
    if (transform.width !== undefined || transform.height !== undefined)
      changedProperties.push('size')
    if (transform.rotation !== undefined) changedProperties.push('rotation')
    if (transform.opacity !== undefined) changedProperties.push('opacity')
    if (transform.zIndex !== undefined) changedProperties.push('zIndex')
    if (transform.duration !== undefined) changedProperties.push('duration')
    if (transform.playbackRate !== undefined) changedProperties.push('playbackRate')
    if (transform.volume !== undefined) changedProperties.push('volume')
    if (transform.isMuted !== undefined) changedProperties.push('audioState')
    if (transform.gain !== undefined) changedProperties.push('gain')

    // 如果同时有音量和静音状态变化，归类为audioState
    if (transform.volume !== undefined && transform.isMuted !== undefined) {
      return 'audioState'
    }

    return changedProperties.length === 1 ? (changedProperties[0] as PropertyType) : 'multiple'
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
   * 带历史记录的添加轨道方法
   * @param type 轨道类型
   * @param name 轨道名称（可选）
   * @param position 插入位置（可选）
   */
  async function addTrackWithHistory(
    type: UnifiedTrackType = 'video',
    name?: string,
    position?: number,
  ) {
    const command = new AddTrackCommand(type, name, position, {
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
        removeTrack: unifiedTrackModule.removeTrack,
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
   * @param trackId 要排列的轨道ID
   */
  async function autoArrangeTrackWithHistory(trackId: string) {
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
        toggleTrackVisibility: unifiedTrackModule.toggleTrackVisibility,
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
        toggleTrackMute: unifiedTrackModule.toggleTrackMute,
      },
      {
        timelineItems: unifiedTimelineModule.timelineItems,
      },
    )
    await unifiedHistoryModule.executeCommand(command)
  }

  /**
   * 带历史记录的调整时间轴项目大小方法
   * 支持两种调用方式：
   * 1. 新架构方式：resizeTimelineItemWithHistory(timelineItemId, newTimeRange)
   * 2. 兼容旧调用方式：resizeTimelineItemWithHistory(timelineItemId, newDurationFrames, resizeFromEnd)
   */
  async function resizeTimelineItemWithHistory(
    timelineItemId: string,
    newTimeRangeOrDuration: UnifiedTimeRange | number,
    resizeFromEnd?: boolean,
  ): Promise<boolean> {
    try {
      console.log('🔧 [UnifiedStore] 调整时间轴项目大小:', {
        timelineItemId,
        newTimeRangeOrDuration,
        resizeFromEnd,
      })

      // 获取当前项目
      const currentItem = unifiedTimelineModule.getTimelineItem(timelineItemId)
      if (!currentItem) {
        console.error('❌ [UnifiedStore] 时间轴项目不存在:', timelineItemId)
        return false
      }

      let newTimeRange: UnifiedTimeRange

      // 判断调用方式
      if (typeof newTimeRangeOrDuration === 'number') {
        // 兼容旧调用方式：传入的是 newDurationFrames
        const newDurationFrames = newTimeRangeOrDuration
        const currentTimeRange = currentItem.timeRange

        if (resizeFromEnd === false) {
          // 从左侧调整：保持结束时间不变，调整开始时间
          const newStartTime = currentTimeRange.timelineEndTime - newDurationFrames
          newTimeRange = {
            timelineStartTime: Math.max(0, newStartTime),
            timelineEndTime: currentTimeRange.timelineEndTime,
            clipStartTime: currentTimeRange.clipStartTime,
            clipEndTime: currentTimeRange.clipEndTime,
          }
        } else {
          // 从右侧调整（默认）：保持开始时间不变，调整结束时间
          newTimeRange = {
            timelineStartTime: currentTimeRange.timelineStartTime,
            timelineEndTime: currentTimeRange.timelineStartTime + newDurationFrames,
            clipStartTime: currentTimeRange.clipStartTime,
            clipEndTime: currentTimeRange.clipEndTime,
          }
        }
      } else {
        // 新架构方式：直接传入 newTimeRange
        newTimeRange = newTimeRangeOrDuration
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

  // ==================== 导出接口 ====================

  return {
    // ==================== 历史记录包装方法导出 ====================

    // 时间轴项目历史记录方法
    addTimelineItemWithHistory,
    removeTimelineItemWithHistory,
    moveTimelineItemWithHistory,
    updateTimelineItemTransformWithHistory,
    splitTimelineItemAtTimeWithHistory,
    duplicateTimelineItemWithHistory,
    resizeTimelineItemWithHistory,

    // 轨道历史记录方法
    addTrackWithHistory,
    removeTrackWithHistory,
    renameTrackWithHistory,
    autoArrangeTrackWithHistory,
    toggleTrackVisibilityWithHistory,
    toggleTrackMuteWithHistory,

    // ==================== 统一媒体模块状态和方法 ====================

    // 媒体项目状态
    mediaItems: unifiedMediaModule.mediaItems,

    // 媒体项目管理方法
    addMediaItem: unifiedMediaModule.addMediaItem,
    removeMediaItem: unifiedMediaModule.removeMediaItem,
    getMediaItem: unifiedMediaModule.getMediaItem,
    getMediaItemBySourceId: unifiedMediaModule.getMediaItemBySourceId,
    updateMediaItemName: unifiedMediaModule.updateMediaItemName,
    updateMediaItem: unifiedMediaModule.updateMediaItem,
    getAllMediaItems: unifiedMediaModule.getAllMediaItems,

    // 分辨率管理方法
    getVideoOriginalResolution: unifiedMediaModule.getVideoOriginalResolution,
    getImageOriginalResolution: unifiedMediaModule.getImageOriginalResolution,

    // 异步等待方法
    waitForMediaItemReady: unifiedMediaModule.waitForMediaItemReady,

    // 数据源处理方法
    startMediaProcessing: unifiedMediaModule.startMediaProcessing,

    // 便捷查询方法
    getReadyMediaItems: unifiedMediaModule.getReadyMediaItems,
    getProcessingMediaItems: unifiedMediaModule.getProcessingMediaItems,
    getErrorMediaItems: unifiedMediaModule.getErrorMediaItems,
    getMediaItemsByType,
    getMediaItemsBySourceType: unifiedMediaModule.getMediaItemsBySourceType,
    getMediaItemsStats: unifiedMediaModule.getMediaItemsStats,

    // 批量操作方法
    retryAllErrorItems,
    clearCancelledItems,

    // 工厂函数和查询函数
    createUnifiedMediaItemData: unifiedMediaModule.createUnifiedMediaItemData,
    UnifiedMediaItemQueries: unifiedMediaModule.UnifiedMediaItemQueries,
    UnifiedMediaItemActions: unifiedMediaModule.UnifiedMediaItemActions,

    // ==================== 统一轨道模块状态和方法 ====================

    // 轨道状态
    tracks: unifiedTrackModule.tracks,

    // 轨道管理方法
    addTrack: unifiedTrackModule.addTrack,
    removeTrack: (trackId: string) =>
      unifiedTrackModule.removeTrack(trackId, unifiedTimelineModule.timelineItems),
    renameTrack: unifiedTrackModule.renameTrack,
    getTrack: unifiedTrackModule.getTrack,
    setTrackHeight: unifiedTrackModule.setTrackHeight,
    toggleTrackVisibility: unifiedTrackModule.toggleTrackVisibility,
    toggleTrackMute: unifiedTrackModule.toggleTrackMute,
    getTracksSummary: unifiedTrackModule.getTracksSummary,
    resetTracksToDefaults: unifiedTrackModule.resetTracksToDefaults,

    // 轨道恢复方法
    restoreTracks: unifiedTrackModule.restoreTracks,

    // ==================== 统一时间轴模块状态和方法 ====================

    // 时间轴项目状态
    timelineItems: unifiedTimelineModule.timelineItems,

    // 时间轴项目管理方法
    addTimelineItem: unifiedTimelineModule.addTimelineItem,
    removeTimelineItem: unifiedTimelineModule.removeTimelineItem,
    getTimelineItem: unifiedTimelineModule.getTimelineItem,
    getReadyTimelineItem: unifiedTimelineModule.getReadyTimelineItem,
    setupBidirectionalSync: unifiedTimelineModule.setupBidirectionalSync,
    updateTimelineItemPosition: unifiedTimelineModule.updateTimelineItemPosition,
    updateTimelineItemTransform: unifiedTimelineModule.updateTimelineItemTransform,
    setupTimelineItemSprite: unifiedTimelineModule.setupTimelineItemSprite,

    // 时间轴项目工厂函数
    cloneTimelineItemData: cloneTimelineItem,
    duplicateTimelineItem,

    // ==================== 统一项目模块状态和方法 ====================

    // 项目状态
    projectStatus: unifiedProjectModule.projectStatus,
    isProjectSaving: unifiedProjectModule.isSaving,
    isProjectLoading: unifiedProjectModule.isLoading,

    // 项目加载进度状态
    projectLoadingProgress: unifiedProjectModule.loadingProgress,
    projectLoadingStage: unifiedProjectModule.loadingStage,
    projectLoadingDetails: unifiedProjectModule.loadingDetails,
    showProjectLoadingProgress: unifiedProjectModule.showLoadingProgress,
    isProjectSettingsReady: unifiedProjectModule.isProjectSettingsReady,
    isProjectContentReady: unifiedProjectModule.isProjectContentReady,

    // 项目管理方法
    saveCurrentProject: unifiedProjectModule.saveCurrentProject,
    preloadProjectSettings: unifiedProjectModule.preloadProjectSettings,
    loadProjectContent: unifiedProjectModule.loadProjectContent,
    clearCurrentProject: unifiedProjectModule.clearCurrentProject,
    getProjectSummary: unifiedProjectModule.getProjectSummary,

    // 项目加载进度控制
    updateLoadingProgress: unifiedProjectModule.updateLoadingProgress,
    resetLoadingState: unifiedProjectModule.resetLoadingState,

    // ==================== 播放控制模块状态和方法 ====================

    // 播放控制状态
    currentFrame: unifiedPlaybackModule.currentFrame,
    currentWebAVFrame: unifiedPlaybackModule.currentWebAVFrame,
    isPlaying: unifiedPlaybackModule.isPlaying,
    playbackRate: unifiedPlaybackModule.playbackRate,

    // 计算属性
    formattedCurrentTime: unifiedPlaybackModule.formattedCurrentTime,
    playbackRateText: unifiedPlaybackModule.playbackRateText,

    // 帧数控制方法
    setCurrentFrame: unifiedPlaybackModule.setCurrentFrame,
    seekToFrame: unifiedPlaybackModule.seekToFrame,
    seekByFrames: unifiedPlaybackModule.seekByFrames,
    nextFrame: unifiedPlaybackModule.nextFrame,
    previousFrame: unifiedPlaybackModule.previousFrame,

    // 播放控制方法
    setPlaying: unifiedPlaybackModule.setPlaying,
    play: unifiedPlaybackModule.play,
    pause: unifiedPlaybackModule.pause,
    togglePlayPause: unifiedPlaybackModule.togglePlayPause,
    stop: unifiedPlaybackModule.stop,
    setPlaybackRate: unifiedPlaybackModule.setPlaybackRate,
    resetPlaybackRate: unifiedPlaybackModule.resetPlaybackRate,
    getPlaybackSummary: unifiedPlaybackModule.getPlaybackSummary,
    resetPlaybackToDefaults: unifiedPlaybackModule.resetToDefaults,

    // ==================== 配置模块状态和方法 ====================

    // 配置
    projectId: unifiedConfigModule.projectId,
    projectName: unifiedConfigModule.projectName,
    projectDescription: unifiedConfigModule.projectDescription,
    projectCreatedAt: unifiedConfigModule.projectCreatedAt,
    projectUpdatedAt: unifiedConfigModule.projectUpdatedAt,
    projectVersion: unifiedConfigModule.projectVersion,
    projectThumbnail: unifiedConfigModule.projectThumbnail,

    // 配置状态
    videoResolution: unifiedConfigModule.videoResolution,
    frameRate: unifiedConfigModule.frameRate,
    timelineDurationFrames: unifiedConfigModule.timelineDurationFrames,

    // 配置管理方法
    setVideoResolution: unifiedConfigModule.setVideoResolution,
    setFrameRate: unifiedConfigModule.setFrameRate,
    getConfigSummary: unifiedConfigModule.getConfigSummary,
    resetConfigToDefaults: unifiedConfigModule.resetToDefaults,
    restoreFromProjectSettings: unifiedConfigModule.restoreFromProjectSettings,

    // ==================== WebAV模块状态和方法 ====================

    // WebAV状态
    avCanvas: unifiedWebavModule.avCanvas,
    isWebAVReady: unifiedWebavModule.isWebAVReady,
    webAVError: unifiedWebavModule.webAVError,

    // WebAV管理方法
    setAVCanvas: unifiedWebavModule.setAVCanvas,
    setWebAVReady: unifiedWebavModule.setWebAVReady,
    setWebAVError: unifiedWebavModule.setWebAVError,
    clearWebAVState: unifiedWebavModule.clearWebAVState,
    getWebAVSummary: unifiedWebavModule.getWebAVSummary,
    resetWebAVToDefaults: unifiedWebavModule.resetToDefaults,
    addSpriteToCanvas: unifiedWebavModule.addSprite,
    removeSpriteFromCanvas: unifiedWebavModule.removeSprite,

    // WebAV画布容器管理
    createCanvasContainer: unifiedWebavModule.createCanvasContainer,
    initializeCanvas: unifiedWebavModule.initializeCanvas,
    getAVCanvas: unifiedWebavModule.getAVCanvas,
    getCanvasContainer: unifiedWebavModule.getCanvasContainer,

    // WebAV播放控制
    webAVPlay: unifiedWebavModule.play,
    webAVPause: unifiedWebavModule.pause,
    webAVSeekTo: unifiedWebavModule.seekTo,

    // WebAV Clip创建和管理
    createMP4Clip: unifiedWebavModule.createMP4Clip,
    createImgClip: unifiedWebavModule.createImgClip,
    createAudioClip: unifiedWebavModule.createAudioClip,
    cloneMP4Clip: unifiedWebavModule.cloneMP4Clip,
    cloneImgClip: unifiedWebavModule.cloneImgClip,
    cloneAudioClip: unifiedWebavModule.cloneAudioClip,

    // WebAV实例管理
    destroyWebAV: unifiedWebavModule.destroy,
    isWebAVReadyGlobal: unifiedWebavModule.isWebAVReadyGlobal,
    waitForWebAVReady: unifiedWebavModule.waitForWebAVReady,

    // WebAV画布销毁和重建
    destroyCanvas: unifiedWebavModule.destroyCanvas,
    recreateCanvas: unifiedWebavModule.recreateCanvas,

    // ==================== Sprite操作工具 ====================

    // 注意：SpriteLifecycleManager已移除，Sprite操作现在通过TimelineItemData直接管理
    // 相关方法已集成到统一时间轴模块中，如：updateTimelineItemSprite, addSpriteToCanvas, removeSpriteFromCanvas等

    // ==================== 计算属性 ====================

    mediaStats,
    readyMediaCount,
    hasProcessingMedia,
    hasErrorMedia,
    isWebAVAvailable,
    totalDurationFrames,

    // ==================== 统一视口模块状态和方法 ====================

    // 视口状态
    zoomLevel: unifiedViewportModule.zoomLevel,
    scrollOffset: unifiedViewportModule.scrollOffset,

    // 视口计算属性
    minZoomLevel: unifiedViewportModule.minZoomLevel,
    visibleDurationFrames: unifiedViewportModule.visibleDurationFrames,
    maxVisibleDurationFrames: unifiedViewportModule.maxVisibleDurationFrames,
    contentEndTimeFrames: unifiedViewportModule.contentEndTimeFrames,

    // 视口管理方法
    getMaxZoomLevelForTimeline: unifiedViewportModule.getMaxZoomLevelForTimeline,
    getMaxScrollOffsetForTimeline: unifiedViewportModule.getMaxScrollOffsetForTimeline,
    setZoomLevel: unifiedViewportModule.setZoomLevel,
    setScrollOffset: unifiedViewportModule.setScrollOffset,
    zoomIn: unifiedViewportModule.zoomIn,
    zoomOut: unifiedViewportModule.zoomOut,
    scrollLeft: unifiedViewportModule.scrollLeft,
    scrollRight: unifiedViewportModule.scrollRight,
    scrollToFrame: unifiedViewportModule.scrollToFrame,
    resetViewport: unifiedViewportModule.resetViewport,
    getViewportSummary: unifiedViewportModule.getViewportSummary,

    // ==================== 通知模块状态和方法 ====================

    // 通知状态
    notifications: unifiedNotificationModule.notifications,

    // 通知管理方法
    showNotification: unifiedNotificationModule.showNotification,
    removeNotification: unifiedNotificationModule.removeNotification,
    clearNotifications: unifiedNotificationModule.clearNotifications,
    removeNotificationsByType: unifiedNotificationModule.removeNotificationsByType,
    getNotificationCountByType: unifiedNotificationModule.getNotificationCountByType,

    // 便捷通知方法
    showSuccess: unifiedNotificationModule.showSuccess,
    showError: unifiedNotificationModule.showError,
    showWarning: unifiedNotificationModule.showWarning,
    showInfo: unifiedNotificationModule.showInfo,

    // ==================== 历史模块状态和方法 ====================

    // 历史状态
    canUndo: unifiedHistoryModule.canUndo,
    canRedo: unifiedHistoryModule.canRedo,

    // 历史操作方法
    executeCommand: unifiedHistoryModule.executeCommand,
    undo: unifiedHistoryModule.undo,
    redo: unifiedHistoryModule.redo,
    clearHistory: unifiedHistoryModule.clear,
    getHistorySummary: unifiedHistoryModule.getHistorySummary,
    getCommand: unifiedHistoryModule.getCommand,
    startBatch: unifiedHistoryModule.startBatch,
    executeBatchCommand: unifiedHistoryModule.executeBatchCommand,

    // ==================== 统一选择模块状态和方法 ====================

    // 选择状态
    selectedTimelineItemId: unifiedSelectionModule.selectedTimelineItemId,
    selectedTimelineItemIds: unifiedSelectionModule.selectedTimelineItemIds,
    isMultiSelectMode: unifiedSelectionModule.isMultiSelectMode,
    hasSelection: unifiedSelectionModule.hasSelection,

    // 统一选择API
    selectTimelineItems: unifiedSelectionModule.selectTimelineItems,
    selectTimelineItemsWithHistory: unifiedSelectionModule.selectTimelineItemsWithHistory,
    syncAVCanvasSelection: unifiedSelectionModule.syncAVCanvasSelection,

    // 兼容性选择方法
    selectTimelineItem: unifiedSelectionModule.selectTimelineItem,
    clearAllSelections: unifiedSelectionModule.clearAllSelections,
    toggleTimelineItemSelection: unifiedSelectionModule.toggleTimelineItemSelection,
    isTimelineItemSelected: unifiedSelectionModule.isTimelineItemSelected,
    getSelectedTimelineItem: unifiedSelectionModule.getSelectedTimelineItem,
    getSelectionSummary: unifiedSelectionModule.getSelectionSummary,
    resetSelectionToDefaults: unifiedSelectionModule.resetToDefaults,

    // 多选兼容性方法
    addToMultiSelection: unifiedSelectionModule.addToMultiSelection,
    removeFromMultiSelection: unifiedSelectionModule.removeFromMultiSelection,
    toggleMultiSelection: unifiedSelectionModule.toggleMultiSelection,
    clearMultiSelection: unifiedSelectionModule.clearMultiSelection,
    isInMultiSelection: unifiedSelectionModule.isInMultiSelection,

    // ==================== 统一片段操作模块方法 ====================

    // 片段操作方法
    updateTimelineItemPlaybackRate: unifiedClipOperationsModule.updateTimelineItemPlaybackRate,

    // ==================== 系统状态方法 ====================

    resetToDefaults, // 保留封装，因为需要重置所有模块

    // ==================== 坐标转换方法 ====================
    frameToPixel: (frames: number, timelineWidth: number) =>
      frameToPixel(
        frames,
        timelineWidth,
        totalDurationFrames.value,
        unifiedViewportModule.zoomLevel.value,
        unifiedViewportModule.scrollOffset.value,
      ),
    pixelToFrame: (pixel: number, timelineWidth: number) =>
      pixelToFrame(
        pixel,
        timelineWidth,
        totalDurationFrames.value,
        unifiedViewportModule.zoomLevel.value,
        unifiedViewportModule.scrollOffset.value,
      ),

    // ==================== 时间轴扩展功能 ====================
    expandTimelineIfNeededFrames: (targetFrames: number) =>
      expandTimelineIfNeededFrames(targetFrames, unifiedConfigModule.timelineDurationFrames),
    smartExpandTimelineIfNeeded: (targetFrames: number, minRatio?: number, maxRatio?: number) =>
      smartExpandTimelineIfNeeded(
        targetFrames,
        unifiedConfigModule.timelineDurationFrames,
        minRatio,
        maxRatio,
      ),
    batchExpandTimelineIfNeeded: (targetFramesList: number[], expansionRatio?: number) =>
      batchExpandTimelineIfNeeded(
        targetFramesList,
        unifiedConfigModule.timelineDurationFrames,
        expansionRatio,
      ),
    predictiveExpandTimeline: (
      currentUsedFrames: number,
      usageThreshold?: number,
      expansionRatio?: number,
    ) =>
      predictiveExpandTimeline(
        currentUsedFrames,
        unifiedConfigModule.timelineDurationFrames,
        usageThreshold,
        expansionRatio,
      ),
    getTimelineExpansionSuggestion: (
      currentDuration: number,
      targetFrames: number,
      currentUsedFrames: number,
    ) => getTimelineExpansionSuggestion(currentDuration, targetFrames, currentUsedFrames),

    // ==================== 时间轴搜索工具函数 ====================
    getTimelineItemAtFrames: (frames: number) =>
      getTimelineItemAtFrames(frames, unifiedTimelineModule.timelineItems.value),
    getTimelineItemsByTrack: (trackId: string) =>
      getTimelineItemsByTrack(trackId, unifiedTimelineModule.timelineItems.value),
    findTimelineItemBySprite: (sprite: any) =>
      findTimelineItemBySprite(sprite, unifiedTimelineModule.timelineItems.value),
    getTimelineItemsAtFrames: (frames: number) =>
      getTimelineItemsAtFrames(frames, unifiedTimelineModule.timelineItems.value),
    getTimelineItemAtTrackAndFrames: (trackId: string, frames: number) =>
      getTimelineItemAtTrackAndFrames(trackId, frames, unifiedTimelineModule.timelineItems.value),
    isPlayheadInTimelineItem: (item: UnifiedTimelineItemData, currentFrame: number) =>
      isPlayheadInTimelineItem(item, currentFrame),
    getTimelineItemsByMediaType: (mediaType: MediaTypeOrUnknown) =>
      getTimelineItemsByMediaType(mediaType, unifiedTimelineModule.timelineItems.value),
    getTimelineItemsByStatus: (status: 'ready' | 'loading' | 'error') =>
      getTimelineItemsByStatus(status, unifiedTimelineModule.timelineItems.value),
    findOverlappingTimelineItems: (startTime: number, endTime: number, excludeItemId?: string) =>
      findOverlappingTimelineItems(
        startTime,
        endTime,
        unifiedTimelineModule.timelineItems.value,
        excludeItemId,
      ),
    findOverlappingTimelineItemsOnTrack: (
      trackId: string,
      startTime: number,
      endTime: number,
      excludeItemId?: string,
    ) =>
      findOverlappingTimelineItemsOnTrack(
        trackId,
        startTime,
        endTime,
        unifiedTimelineModule.timelineItems.value,
        excludeItemId,
      ),
    findOrphanedTimelineItems: () =>
      findOrphanedTimelineItems(
        unifiedTimelineModule.timelineItems.value,
        unifiedMediaModule.mediaItems.value,
      ),

    // ==================== 统一自动保存模块状态和方法 ====================

    // 自动保存状态
    autoSaveState: unifiedAutoSaveModule.autoSaveState,
    autoSaveConfig: unifiedAutoSaveModule.config,

    // 自动保存方法
    enableAutoSave: unifiedAutoSaveModule.enableAutoSave,
    disableAutoSave: unifiedAutoSaveModule.disableAutoSave,
    manualSave: unifiedAutoSaveModule.manualSave,
    triggerAutoSave: unifiedAutoSaveModule.triggerAutoSave,
    resetAutoSaveState: unifiedAutoSaveModule.resetAutoSaveState,

    // ==================== 模块生命周期管理 ====================

    destroyAllModules, // 新增：销毁所有模块资源的方法
  }
})

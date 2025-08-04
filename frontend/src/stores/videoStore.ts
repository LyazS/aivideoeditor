import { computed, markRaw, type Raw } from 'vue'
import { defineStore } from 'pinia'
import { hasVisualProps, hasAudioProps, type TextMediaConfig } from '../types'
import { VideoVisibleSprite } from '../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../utils/ImageVisibleSprite'
import { AudioVisibleSprite } from '../utils/AudioVisibleSprite'
import { expandTimelineIfNeededFrames } from './utils/timeUtils'
import { autoArrangeTimelineItems, autoArrangeTrackItems } from './utils/timelineArrangementUtils'
import { calculateTotalDurationFrames } from './utils/durationUtils'
import {
  findTimelineItemBySprite,
  getTimelineItemsByTrack,
  getTimelineItemAtFrames,
} from './utils/timelineSearchUtils'
import { frameToPixel, pixelToFrame } from './utils/coordinateUtils'
import { microsecondsToFrames, secondsToFrames } from './utils/timeUtils'
import { createMediaModule } from './modules/mediaModule'
import { createConfigModule } from './modules/configModule'
import { createTrackModule } from './modules/trackModule'
import { createPlaybackModule } from './modules/playbackModule'
import { createWebAVModule } from './modules/webavModule'
import { createViewportModule } from './modules/viewportModule'
import { createSelectionModule } from './modules/selectionModule'
import { createTimelineModule } from './modules/timelineModule'
import { createClipOperationsModule } from './modules/clipOperationsModule'
import { createHistoryModule } from './modules/historyModule'
import { createNotificationModule } from './modules/notificationModule'
import { createProjectModule } from './modules/projectModule'
import {
  AddTimelineItemCommand,
  RemoveTimelineItemCommand,
  MoveTimelineItemCommand,
  UpdateTransformCommand,
  SplitTimelineItemCommand,
  DuplicateTimelineItemCommand,
  AddTrackCommand,
  RemoveTrackCommand,
  RenameTrackCommand,
  ToggleTrackVisibilityCommand,
  ToggleTrackMuteCommand,
  ResizeTimelineItemCommand,
} from './modules/commands/timelineCommands'
import { BatchDeleteCommand, BatchAutoArrangeTrackCommand } from './modules/commands/batchCommands'
import { AddTextItemCommand } from './modules/commands/textCommands'
import type {
  LocalMediaItem,
  LocalTimelineItem,
  LocalTimelineItemData,
  Track,
  TransformData,
  VideoTimeRange,
  ImageTimeRange,
  PropertyType,
  TrackType,
  AudioMediaConfig,
} from '../types'
import {
  getVisualPropsFromData,
  getAudioPropsFromData,
  isAsyncProcessingTimelineItem,
} from '../types'

export const useVideoStore = defineStore('video', () => {
  // 创建媒体管理模块
  const mediaModule = createMediaModule()

  // 创建配置管理模块
  const configModule = createConfigModule()

  // 创建轨道管理模块
  const trackModule = createTrackModule()

  // 创建播放控制模块
  const playbackModule = createPlaybackModule(configModule.frameRate)

  // 创建WebAV集成模块
  const webavModule = createWebAVModule()

  // 创建项目管理模块
  const projectModule = createProjectModule()

  // 创建时间轴核心管理模块
  const timelineModule = createTimelineModule(configModule, webavModule, mediaModule, trackModule)

  // 总时长（帧数版本）
  const totalDurationFrames = computed(() => {
    return calculateTotalDurationFrames(
      timelineModule.timelineItems.value,
      configModule.timelineDurationFrames.value,
    )
  })

  // 创建视口管理模块（需要在totalDurationFrames之后创建）
  const viewportModule = createViewportModule(
    timelineModule.timelineItems,
    totalDurationFrames,
    configModule.timelineDurationFrames,
  )

  // 创建通知管理模块
  const notificationModule = createNotificationModule()

  // 创建历史管理模块
  const historyModule = createHistoryModule(notificationModule)

  // 创建选择管理模块（需要在historyModule之后创建）
  const selectionModule = createSelectionModule(
    timelineModule.getTimelineItem,
    mediaModule.getLocalMediaItem,
    historyModule.executeCommand,
  )

  // 创建视频片段操作模块（需要在其他模块之后创建）
  const clipOperationsModule = createClipOperationsModule(timelineModule)

  // ==================== 双向数据同步函数 ====================

  // ==================== 素材管理方法 ====================
  // 使用媒体模块的方法，但需要包装以提供额外的依赖
  function addLocalMediaItem(mediaItem: LocalMediaItem) {
    mediaModule.addLocalMediaItem(mediaItem, timelineModule.timelineItems, trackModule.tracks)
  }

  // ==================== 历史记录包装方法 ====================

  /**
   * 带历史记录的添加时间轴项目方法
   * @param timelineItem 要添加的时间轴项目
   */
  async function addTimelineItemWithHistory(timelineItem: LocalTimelineItem) {
    // 检查是否是文本项目，使用专门的文本命令
    if (timelineItem.mediaType === 'text') {
      // 类型检查确保这是文本项目
      await addTextItemWithHistory(timelineItem as LocalTimelineItem<'text'>)
      return
    }

    const command = new AddTimelineItemCommand(
      timelineItem,
      {
        addTimelineItem: timelineModule.addTimelineItem,
        removeTimelineItem: timelineModule.removeTimelineItem,
        getTimelineItem: timelineModule.getTimelineItem,
      },
      {
        addSprite: webavModule.addSprite,
        removeSprite: webavModule.removeSprite,
      },
      {
        getLocalMediaItem: mediaModule.getLocalMediaItem,
      },
    )
    await historyModule.executeCommand(command)
  }

  /**
   * 带历史记录的添加文本项目方法
   * @param textItem 要添加的文本时间轴项目
   */
  async function addTextItemWithHistory(textItem: LocalTimelineItem<'text'>) {
    const command = new AddTextItemCommand(
      textItem.config.text,
      textItem.config.style,
      textItem.timeRange.timelineStartTime,
      textItem.trackId,
      textItem.timeRange.displayDuration,
      configModule.videoResolution.value,
      {
        addTimelineItem: timelineModule.addTimelineItem,
        removeTimelineItem: timelineModule.removeTimelineItem,
      },
      {
        addSprite: webavModule.addSprite,
        removeSprite: webavModule.removeSprite,
      },
    )
    await historyModule.executeCommand(command)
  }

  /**
   * 带历史记录的删除时间轴项目方法
   * @param timelineItemId 要删除的时间轴项目ID
   */
  async function removeTimelineItemWithHistory(timelineItemId: string) {
    // 获取要删除的时间轴项目
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法删除: ${timelineItemId}`)
      return
    }

    const command = new RemoveTimelineItemCommand(
      timelineItemId,
      timelineItem, // 传入完整的timelineItem用于保存重建数据
      {
        addTimelineItem: timelineModule.addTimelineItem,
        removeTimelineItem: timelineModule.removeTimelineItem,
        getTimelineItem: timelineModule.getTimelineItem,
      },
      {
        addSprite: webavModule.addSprite,
        removeSprite: webavModule.removeSprite,
      },
      {
        getLocalMediaItem: mediaModule.getLocalMediaItem,
      },
    )
    await historyModule.executeCommand(command)
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
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法移动: ${timelineItemId}`)
      return
    }

    // 获取当前位置和轨道
    const oldPositionFrames = timelineItem.timeRange.timelineStartTime // 帧数
    const oldTrackId = timelineItem.trackId
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
        updateTimelineItemPosition: timelineModule.updateTimelineItemPosition,
        getTimelineItem: timelineModule.getTimelineItem,
      },
      {
        getLocalMediaItem: mediaModule.getLocalMediaItem,
      },
    )
    await historyModule.executeCommand(command)
  }

  /**
   * 带历史记录的更新变换属性方法
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
    // 获取要更新的时间轴项目（只处理本地项目）
    const timelineItem = timelineModule.getLocalTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 本地时间轴项目不存在，无法更新变换属性: ${timelineItemId}`)
      return
    }

    // 获取当前的变换属性（类型安全版本）
    const oldTransform: typeof newTransform = {}

    if (hasVisualProps(timelineItem)) {
      // hasVisualProps 类型守卫确保了 config 具有视觉属性
      const config = timelineItem.config
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
      oldTransform.zIndex = timelineItem.config.zIndex
    }

    if (newTransform.duration !== undefined) {
      // 计算当前时长（帧数）
      const timeRange = timelineItem.timeRange
      const currentDurationFrames = microsecondsToFrames(
        timeRange.timelineEndTime - timeRange.timelineStartTime,
      )
      oldTransform.duration = currentDurationFrames
    }

    if (newTransform.playbackRate !== undefined) {
      // 获取当前倍速（对视频和音频有效）
      if (
        (timelineItem.mediaType === 'video' || timelineItem.mediaType === 'audio') &&
        'playbackRate' in timelineItem.timeRange
      ) {
        oldTransform.playbackRate = timelineItem.timeRange.playbackRate || 1
      } else {
        oldTransform.playbackRate = 1 // 图片和文本默认为1
      }
    }

    if (hasAudioProps(timelineItem)) {
      // hasAudioProps 类型守卫确保了 config 具有音频属性
      const config = timelineItem.config
      if (newTransform.volume !== undefined) {
        // 获取当前音量（对视频和音频有效）
        oldTransform.volume = config.volume ?? 1
      }

      if (newTransform.isMuted !== undefined) {
        // 获取当前静音状态（对视频和音频有效）
        oldTransform.isMuted = config.isMuted ?? false
      }
    }

    if (timelineItem.mediaType === 'audio' && newTransform.gain !== undefined) {
      // 获取当前增益（仅对音频有效）
      // 类型检查确保这是音频项目，配置应该有 gain 属性
      const audioConfig = timelineItem.config as AudioMediaConfig
      oldTransform.gain = audioConfig.gain ?? 0
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
        updateLocalTimelineItemTransform: timelineModule.updateLocalTimelineItemTransform,
        getLocalTimelineItem: timelineModule.getLocalTimelineItem,
      },
      {
        getLocalMediaItem: mediaModule.getLocalMediaItem,
      },
      {
        updateTimelineItemPlaybackRate: clipOperationsModule.updateTimelineItemPlaybackRate,
      },
    )
    await historyModule.executeCommand(command)
  }

  // 使用统一类型文件中的 TransformData 接口

  /**
   * 检查变换属性是否有实际变化
   */
  function checkTransformChanges(
    oldTransform: TransformData,
    newTransform: TransformData,
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

  // PropertyType 类型已移动到统一类型文件 src/types/index.ts

  /**
   * 确定属性类型
   */
  function determinePropertyType(transform: TransformData): PropertyType {
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
    // 获取要分割的时间轴项目（只处理本地项目）
    const timelineItem = timelineModule.getLocalTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 本地时间轴项目不存在，无法分割: ${timelineItemId}`)
      return
    }

    // 检查是否为支持分割的类型（图片和文本不支持分割）
    if (timelineItem.mediaType !== 'video' && timelineItem.mediaType !== 'audio') {
      console.error('❌ 只有视频和音频片段支持分割操作')
      return
    }

    // 检查分割时间是否在项目范围内（使用帧数）
    const timelineStartTimeFrames = timelineItem.timeRange.timelineStartTime // 帧数
    const timelineEndTimeFrames = timelineItem.timeRange.timelineEndTime // 帧数

    if (splitTimeFrames <= timelineStartTimeFrames || splitTimeFrames >= timelineEndTimeFrames) {
      console.error('❌ 分割时间不在项目范围内')
      return
    }

    // 直接传递帧数给命令（避免不必要的转换）
    const command = new SplitTimelineItemCommand(
      timelineItemId,
      timelineItem, // 传入完整的timelineItem用于保存重建数据
      splitTimeFrames,
      {
        addTimelineItem: timelineModule.addTimelineItem,
        removeTimelineItem: timelineModule.removeTimelineItem,
        getTimelineItem: timelineModule.getLocalTimelineItem,
      },
      {
        addSprite: webavModule.addSprite,
        removeSprite: webavModule.removeSprite,
      },
      {
        getLocalMediaItem: mediaModule.getLocalMediaItem,
      },
    )
    await historyModule.executeCommand(command)
  }

  /**
   * 带历史记录的复制时间轴项目方法
   * @param timelineItemId 要复制的时间轴项目ID
   * @returns 新创建的时间轴项目ID，失败时返回null
   */
  async function duplicateTimelineItemWithHistory(timelineItemId: string): Promise<string | null> {
    // 获取要复制的时间轴项目（只处理本地项目）
    const timelineItem = timelineModule.getLocalTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 本地时间轴项目不存在，无法复制: ${timelineItemId}`)
      return null
    }

    // 计算新位置（在原项目后面，避免重叠）
    const originalEndTimeFrames = timelineItem.timeRange.timelineEndTime // 帧数
    const newPositionFrames = originalEndTimeFrames

    const command = new DuplicateTimelineItemCommand(
      timelineItemId,
      timelineItem, // 传入完整的timelineItem用于保存重建数据
      newPositionFrames,
      {
        addTimelineItem: timelineModule.addTimelineItem,
        removeTimelineItem: timelineModule.removeTimelineItem,
        getTimelineItem: timelineModule.getLocalTimelineItem,
        setupBidirectionalSync: timelineModule.setupBidirectionalSync,
      },
      {
        addSprite: webavModule.addSprite,
        removeSprite: webavModule.removeSprite,
      },
      {
        getLocalMediaItem: mediaModule.getLocalMediaItem,
      },
      configModule.videoResolution.value, // 传入画布分辨率
    )

    try {
      await historyModule.executeCommand(command)
      // 返回新创建的项目ID
      return command.newTimelineItemId
    } catch (error) {
      console.error('❌ 复制时间轴项目失败:', error)
      return null
    }
  }

  /**
   * 带历史记录的添加轨道方法
   * @param type 轨道类型
   * @param name 轨道名称（可选）
   * @param position 插入位置（可选，默认为末尾）
   * @returns 新创建的轨道ID，失败时返回null
   */
  async function addTrackWithHistory(
    type: TrackType = 'video',
    name?: string,
    position?: number,
  ): Promise<string | null> {
    const command = new AddTrackCommand(type, name, position, {
      addTrack: trackModule.addTrack,
      removeTrack: trackModule.removeTrack,
      getTrack: trackModule.getTrack,
    })

    try {
      await historyModule.executeCommand(command)
      // 返回新创建的轨道ID
      return command.createdTrackId
    } catch (error) {
      console.error('❌ 添加轨道失败:', error)
      return null
    }
  }

  /**
   * 带历史记录的删除轨道方法
   * @param trackId 要删除的轨道ID
   * @returns 是否成功删除
   */
  async function removeTrackWithHistory(trackId: string): Promise<boolean> {
    // 检查是否为最后一个轨道
    if (trackModule.tracks.value.length <= 1) {
      console.warn('⚠️ 不能删除最后一个轨道')
      return false
    }

    // 检查轨道是否存在
    const track = trackModule.getTrack(trackId)
    if (!track) {
      console.warn(`⚠️ 轨道不存在，无法删除: ${trackId}`)
      return false
    }

    const command = new RemoveTrackCommand(
      trackId,
      {
        addTrack: (type: TrackType, name?: string) => trackModule.addTrack(type, name),
        removeTrack: trackModule.removeTrack,
        getTrack: trackModule.getTrack,
        tracks: trackModule.tracks,
      },
      {
        addTimelineItem: timelineModule.addTimelineItem,
        removeTimelineItem: timelineModule.removeTimelineItem,
        getTimelineItem: timelineModule.getTimelineItem,
        setupBidirectionalSync: timelineModule.setupBidirectionalSync,
        timelineItems: timelineModule.timelineItems,
      },
      {
        addSprite: webavModule.addSprite,
        removeSprite: webavModule.removeSprite,
      },
      {
        getLocalMediaItem: mediaModule.getLocalMediaItem,
      },
    )

    try {
      await historyModule.executeCommand(command)
      return true
    } catch (error) {
      console.error('❌ 删除轨道失败:', error)
      return false
    }
  }

  /**
   * 带历史记录的重命名轨道方法
   * @param trackId 要重命名的轨道ID
   * @param newName 新的轨道名称
   * @returns 是否成功重命名
   */
  async function renameTrackWithHistory(trackId: string, newName: string): Promise<boolean> {
    // 检查轨道是否存在
    const track = trackModule.getTrack(trackId)
    if (!track) {
      console.warn(`⚠️ 轨道不存在，无法重命名: ${trackId}`)
      return false
    }

    // 检查新名称是否有效
    if (!newName.trim()) {
      console.warn('⚠️ 轨道名称不能为空')
      return false
    }

    // 如果名称没有变化，直接返回成功
    if (track.name === newName.trim()) {
      console.log('⚠️ 轨道名称没有变化，无需重命名')
      return true
    }

    const command = new RenameTrackCommand(trackId, newName.trim(), {
      renameTrack: trackModule.renameTrack,
      getTrack: trackModule.getTrack,
    })

    try {
      await historyModule.executeCommand(command)
      return true
    } catch (error) {
      console.error('❌ 重命名轨道失败:', error)
      return false
    }
  }

  /**
   * 带历史记录的自动排列轨道方法（使用批量操作架构）
   * @param trackId 要自动排列的轨道ID
   * @returns 是否成功排列
   */
  async function autoArrangeTrackWithHistory(trackId: string): Promise<boolean> {
    // 检查轨道是否存在
    const track = trackModule.getTrack(trackId)
    if (!track) {
      console.warn(`⚠️ 轨道不存在，无法自动排列: ${trackId}`)
      return false
    }

    // 检查轨道是否有项目
    const trackItems = timelineModule.timelineItems.value.filter((item) => item.trackId === trackId)
    if (trackItems.length === 0) {
      console.log(`⚠️ 轨道 ${trackId} 没有片段需要整理`)
      return false
    }

    // 使用新的批量自动排列命令
    const batchCommand = new BatchAutoArrangeTrackCommand(
      trackId,
      trackItems,
      {
        getTimelineItem: timelineModule.getTimelineItem,
        updateTimelineItemPosition: timelineModule.updateTimelineItemPosition,
      },
      {
        getLocalMediaItem: mediaModule.getLocalMediaItem,
      },
      {
        getTrack: trackModule.getTrack,
      },
    )

    try {
      await historyModule.executeBatchCommand(batchCommand)
      return true
    } catch (error) {
      console.error('❌ 自动排列轨道失败:', error)
      return false
    }
  }

  /**
   * 带历史记录的切换轨道可见性方法
   * @param trackId 要切换可见性的轨道ID
   * @returns 是否成功切换
   */
  async function toggleTrackVisibilityWithHistory(trackId: string): Promise<boolean> {
    // 检查轨道是否存在
    const track = trackModule.getTrack(trackId)
    if (!track) {
      console.warn(`⚠️ 轨道不存在，无法切换可见性: ${trackId}`)
      return false
    }

    const command = new ToggleTrackVisibilityCommand(
      trackId,
      {
        getTrack: trackModule.getTrack,
        toggleTrackVisibility: trackModule.toggleTrackVisibility,
      },
      {
        timelineItems: timelineModule.timelineItems,
      },
    )

    try {
      await historyModule.executeCommand(command)
      return true
    } catch (error) {
      console.error('❌ 切换轨道可见性失败:', error)
      return false
    }
  }

  /**
   * 带历史记录的切换轨道静音状态方法
   * @param trackId 要切换静音状态的轨道ID
   * @returns 是否成功切换
   */
  async function toggleTrackMuteWithHistory(trackId: string): Promise<boolean> {
    // 检查轨道是否存在
    const track = trackModule.getTrack(trackId)
    if (!track) {
      console.warn(`⚠️ 轨道不存在，无法切换静音状态: ${trackId}`)
      return false
    }

    const command = new ToggleTrackMuteCommand(
      trackId,
      {
        getTrack: trackModule.getTrack,
        toggleTrackMute: trackModule.toggleTrackMute,
      },
      {
        timelineItems: timelineModule.timelineItems,
      },
    )

    try {
      await historyModule.executeCommand(command)
      return true
    } catch (error) {
      console.error('❌ 切换轨道静音状态失败:', error)
      return false
    }
  }

  /**
   * 带历史记录的调整时间范围方法
   * @param timelineItemId 时间轴项目ID
   * @param newTimeRange 新的时间范围
   * @returns 是否成功调整
   */
  // 使用统一类型文件中的 VideoTimeRange 接口

  async function resizeTimelineItemWithHistory(
    timelineItemId: string,
    newTimeRange: VideoTimeRange | ImageTimeRange,
  ): Promise<boolean> {
    // 获取时间轴项目（只处理本地项目）
    const timelineItem = timelineModule.getLocalTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 本地时间轴项目不存在，无法调整时间范围: ${timelineItemId}`)
      return false
    }

    // 获取原始时间范围
    const originalTimeRange = timelineItem.sprite.getTimeRange()

    // 检查是否有实际变化
    const startTimeChanged =
      Math.abs(originalTimeRange.timelineStartTime - newTimeRange.timelineStartTime) > 0.5 // 允许0.5帧的误差
    const endTimeChanged =
      Math.abs(originalTimeRange.timelineEndTime - newTimeRange.timelineEndTime) > 0.5

    if (!startTimeChanged && !endTimeChanged) {
      console.log('⚠️ 时间范围没有变化，跳过调整操作')
      return false
    }

    const command = new ResizeTimelineItemCommand(
      timelineItemId,
      originalTimeRange,
      newTimeRange,
      {
        getTimelineItem: timelineModule.getLocalTimelineItem,
      },
      {
        getLocalMediaItem: mediaModule.getLocalMediaItem,
      },
    )

    try {
      await historyModule.executeCommand(command)
      return true
    } catch (error) {
      console.error('❌ 调整时间范围失败:', error)
      return false
    }
  }

  /**
   * 批量删除选中的时间轴项目
   * @param timelineItemIds 要删除的时间轴项目ID数组
   * @returns 是否成功删除
   */
  async function batchDeleteTimelineItems(timelineItemIds: string[]): Promise<boolean> {
    if (timelineItemIds.length === 0) {
      console.warn('⚠️ 没有选中要删除的时间轴项目')
      return false
    }

    // 验证所有项目是否存在
    const validItemIds = timelineItemIds.filter((id) => timelineModule.getTimelineItem(id))
    if (validItemIds.length === 0) {
      console.warn('⚠️ 所有选中的时间轴项目都不存在')
      return false
    }

    if (validItemIds.length !== timelineItemIds.length) {
      console.warn(
        `⚠️ ${timelineItemIds.length - validItemIds.length} 个时间轴项目不存在，将删除其余 ${validItemIds.length} 个项目`,
      )
    }

    // 创建批量删除命令
    const batchCommand = new BatchDeleteCommand(
      validItemIds,
      {
        getTimelineItem: timelineModule.getLocalTimelineItem,
        addTimelineItem: timelineModule.addTimelineItem,
        removeTimelineItem: timelineModule.removeTimelineItem,
      },
      {
        addSprite: webavModule.addSprite,
        removeSprite: webavModule.removeSprite,
      },
      {
        getLocalMediaItem: mediaModule.getLocalMediaItem,
      },
    )

    try {
      await historyModule.executeBatchCommand(batchCommand)
      return true
    } catch (error) {
      console.error('❌ 批量删除时间轴项目失败:', error)
      return false
    }
  }

  async function removeLocalMediaItem(mediaItemId: string) {
    // 获取媒体引用信息，用于删除本地文件
    const mediaReference = projectModule.getMediaReference(mediaItemId)

    // 先从内存中删除
    mediaModule.removeLocalMediaItem(
      mediaItemId,
      timelineModule.timelineItems,
      trackModule.tracks,
      webavModule,
      () => {}, // 清理回调，目前为空
    )

    // 删除媒体引用
    projectModule.removeMediaReference(mediaItemId)

    // 删除本地文件（如果有引用信息且有当前项目）
    if (mediaReference && projectModule.currentProject.value?.id) {
      try {
        const { MediaManager } = await import('../utils/MediaManager')
        const mediaManager = MediaManager.getInstance()
        await mediaManager.deleteMediaFromProject(
          projectModule.currentProject.value.id,
          mediaReference,
        )
        console.log(`✅ 本地媒体文件已删除: ${mediaReference.originalFileName}`)
      } catch (error) {
        console.error(`❌ 删除本地媒体文件失败: ${mediaReference.originalFileName}`, error)
        // 本地文件删除失败不应该阻止内存清理，只记录错误
      }
    }
  }

  function getLocalMediaItem(mediaItemId: string): LocalMediaItem | undefined {
    return mediaModule.getLocalMediaItem(mediaItemId)
  }

  function removeAsyncProcessingItem(itemId: string) {
    // 调用mediaModule的removeAsyncProcessingItem，传入时间轴项目引用和删除回调
    mediaModule.removeAsyncProcessingItem(
      itemId,
      timelineModule.timelineItems,
      timelineModule.removeTimelineItem,
    )
  }

  // ==================== 素材名称管理 ====================
  function updateLocalMediaItemName(mediaItemId: string, newName: string) {
    mediaModule.updateLocalMediaItemName(mediaItemId, newName)
  }

  function updateLocalMediaItem(mediaItem: LocalMediaItem) {
    mediaModule.updateLocalMediaItem(mediaItem)
  }

  // ==================== 分辨率管理方法 ====================
  function getVideoOriginalResolution(mediaItemId: string): { width: number; height: number } {
    return mediaModule.getVideoOriginalResolution(mediaItemId)
  }

  function getImageOriginalResolution(mediaItemId: string): { width: number; height: number } {
    return mediaModule.getImageOriginalResolution(mediaItemId)
  }

  // ==================== 项目恢复方法 ====================

  /**
   * 恢复媒体项目列表（用于项目加载）
   */
  function restoreMediaItems(restoredMediaItems: LocalMediaItem[]) {
    console.log(`📁 开始恢复媒体项目: ${restoredMediaItems.length}个文件`)

    // 清空现有的媒体项目
    mediaModule.mediaItems.value = []

    // 添加恢复的媒体项目
    for (const mediaItem of restoredMediaItems) {
      mediaModule.mediaItems.value.push(mediaItem)
      console.log(`📁 恢复媒体项目: ${mediaItem.name} (${mediaItem.mediaType})`)
    }

    console.log(`✅ 媒体项目恢复完成: ${mediaModule.mediaItems.value.length}个文件`)
  }

  /**
   * 恢复轨道结构（用于项目加载）
   */
  function restoreTracks(restoredTracks: Track[]) {
    trackModule.restoreTracks(restoredTracks)
  }

  /**
   * 恢复时间轴项目（用于项目加载）
   * 这是一个异步方法，需要等待WebAV画布准备好后重建sprite
   */
  async function restoreTimelineItems(restoredTimelineItems: LocalTimelineItemData[]) {
    console.log(`⏰ 开始恢复时间轴项目: ${restoredTimelineItems.length}个项目`)

    // 清空现有的时间轴项目
    timelineModule.timelineItems.value = []

    // 首先恢复时间轴项目数据（不包含sprite）
    for (const itemData of restoredTimelineItems) {
      // 基本验证：必须有ID
      if (!itemData.id) {
        console.warn('⚠️ 跳过无效的时间轴项目数据（缺少ID）:', itemData)
        continue
      }

      // 特殊处理文本类型（文本类型没有对应的媒体项目，mediaItemId可以为空）
      if (itemData.mediaType === 'text') {
        // 文本类型验证通过
      } else {
        // 非文本类型：必须有mediaItemId且对应的媒体项目必须存在
        if (!itemData.mediaItemId) {
          console.warn('⚠️ 跳过无效的时间轴项目数据（缺少mediaItemId）:', itemData)
          continue
        }

        const mediaItem = mediaModule.getLocalMediaItem(itemData.mediaItemId)
        if (!mediaItem) {
          console.warn(`⚠️ 跳过时间轴项目，对应的媒体项目不存在: ${itemData.mediaItemId}`)
          continue
        }
      }

      // 创建时间轴项目（不包含sprite和thumbnailUrl，都将在后续重建）
      const timelineItem: Partial<LocalTimelineItem> = {
        id: itemData.id,
        mediaItemId: itemData.mediaItemId,
        trackId: itemData.trackId,
        mediaType: itemData.mediaType,
        timeRange: itemData.timeRange,
        config: itemData.config,
        animation: itemData.animation ? { ...itemData.animation } : undefined, // 恢复动画配置
        mediaName: itemData.mediaName, // 恢复媒体名称
        // thumbnailUrl: undefined // 将在重建sprite后重新生成
        // sprite: null // 将在后续重建
      }

      // 暂时添加到数组中（不完整的项目）
      timelineModule.timelineItems.value.push(timelineItem as LocalTimelineItem)

      console.log(`📋 恢复时间轴项目数据: ${itemData.id} (${itemData.mediaType})`)
    }

    console.log(`✅ 时间轴项目数据恢复完成: ${timelineModule.timelineItems.value.length}个项目`)

    // 然后等待WebAV画布准备好，重建所有sprite
    await rebuildTimelineItemSprites()
  }

  /**
   * 重建所有时间轴项目的sprite（从原始素材重新创建）
   */
  async function rebuildTimelineItemSprites() {
    console.log(`🔄 开始重建时间轴项目的sprite...`)

    const items = timelineModule.timelineItems.value
    if (items.length === 0) {
      console.log(`ℹ️ 没有时间轴项目需要重建sprite`)
      return
    }

    // 等待WebAV画布准备好
    await webavModule.waitForWebAVReady()

    // 导入sprite工厂函数和缩略图生成函数
    const { createSpriteFromMediaItem } = await import('../utils/spriteFactory')
    const { regenerateThumbnailForTimelineItem } = await import('../utils/thumbnailGenerator')

    let rebuiltCount = 0
    for (const timelineItem of items) {
      try {
        if (isAsyncProcessingTimelineItem(timelineItem)) {
          continue
        }
        console.log(`🔄 重建sprite: ${timelineItem.id} (${rebuiltCount + 1}/${items.length})`)

        // 特殊处理文本类型的时间轴项目
        let newSprite: any
        if (timelineItem.mediaType === 'text') {
          // 文本类型：从配置中重新创建TextVisibleSprite
          // 类型检查确保这是文本项目，配置应该有文本属性
          const textConfig = timelineItem.config as TextMediaConfig
          const { TextVisibleSprite } = await import('../utils/TextVisibleSprite')
          newSprite = await TextVisibleSprite.create(textConfig.text, textConfig.style)
        } else {
          // 其他类型：从媒体项目创建sprite
          const mediaItem = mediaModule.getLocalMediaItem(timelineItem.mediaItemId)
          if (!mediaItem) {
            console.warn(`⚠️ 跳过时间轴项目，对应的媒体项目不存在: ${timelineItem.mediaItemId}`)
            continue
          }

          if (mediaItem.status !== 'ready') {
            console.warn(`⚠️ 跳过时间轴项目，媒体项目尚未准备好: ${mediaItem.name}`)
            continue
          }

          // 从原始素材重新创建sprite
          newSprite = await createSpriteFromMediaItem(mediaItem)
        }

        // 恢复时间范围设置
        newSprite.setTimeRange(timelineItem.timeRange)

        // 恢复配置设置
        if (timelineItem.config) {
          // 根据媒体类型应用配置
          if (timelineItem.mediaType === 'video') {
            // VideoVisibleSprite：应用视觉和音频属性
            const videoSprite = newSprite as VideoVisibleSprite
            const visualProps = getVisualPropsFromData(timelineItem)
            const audioProps = getAudioPropsFromData(timelineItem)

            // 应用坐标转换（位置和尺寸）
            if (visualProps) {
              const { projectToWebavCoords } = await import('../utils/coordinateTransform')
              const webavCoords = projectToWebavCoords(
                visualProps.x,
                visualProps.y,
                visualProps.width,
                visualProps.height,
                configModule.videoResolution.value.width,
                configModule.videoResolution.value.height,
              )
              videoSprite.rect.x = webavCoords.x
              videoSprite.rect.y = webavCoords.y
              videoSprite.rect.w = visualProps.width
              videoSprite.rect.h = visualProps.height
              videoSprite.rect.angle = visualProps.rotation
              videoSprite.opacity = visualProps.opacity
              videoSprite.zIndex = visualProps.zIndex
            }

            // 应用音频属性
            if (audioProps) {
              videoSprite.setAudioState({
                volume: audioProps.volume,
                isMuted: audioProps.isMuted,
              })
            }
          } else if (timelineItem.mediaType === 'audio') {
            // AudioVisibleSprite：应用音频属性
            const audioSprite = newSprite as AudioVisibleSprite
            const audioProps = getAudioPropsFromData(timelineItem)

            // 应用音频状态
            if (audioProps) {
              audioSprite.setAudioState({
                volume: audioProps.volume,
                isMuted: audioProps.isMuted,
              })
            }

            // 应用增益设置（AudioMediaConfig特有属性）
            const config = timelineItem.config as AudioMediaConfig
            if (config.gain !== undefined) {
              audioSprite.setGain(config.gain)
            }

            // 应用zIndex
            audioSprite.zIndex = config.zIndex
          } else if (timelineItem.mediaType === 'image') {
            // ImageVisibleSprite：应用视觉属性
            const imageSprite = newSprite as ImageVisibleSprite
            const visualProps = getVisualPropsFromData(timelineItem)

            // 应用坐标转换（位置和尺寸）
            if (visualProps) {
              const { projectToWebavCoords } = await import('../utils/coordinateTransform')
              const webavCoords = projectToWebavCoords(
                visualProps.x,
                visualProps.y,
                visualProps.width,
                visualProps.height,
                configModule.videoResolution.value.width,
                configModule.videoResolution.value.height,
              )
              imageSprite.rect.x = webavCoords.x
              imageSprite.rect.y = webavCoords.y
              imageSprite.rect.w = visualProps.width
              imageSprite.rect.h = visualProps.height
              imageSprite.rect.angle = visualProps.rotation
              imageSprite.opacity = visualProps.opacity
              imageSprite.zIndex = visualProps.zIndex
            }
          } else if (timelineItem.mediaType === 'text') {
            // TextVisibleSprite：应用视觉属性
            // 类型检查确保这是文本精灵，应该有视觉属性方法
            const textSprite = newSprite as import('../utils/TextVisibleSprite').TextVisibleSprite
            const visualProps = getVisualPropsFromData(timelineItem)

            // 应用坐标转换（位置和尺寸）
            if (visualProps) {
              const { projectToWebavCoords } = await import('../utils/coordinateTransform')
              const webavCoords = projectToWebavCoords(
                visualProps.x,
                visualProps.y,
                visualProps.width,
                visualProps.height,
                configModule.videoResolution.value.width,
                configModule.videoResolution.value.height,
              )

              textSprite.rect.x = webavCoords.x
              textSprite.rect.y = webavCoords.y
              textSprite.rect.w = visualProps.width
              textSprite.rect.h = visualProps.height
              textSprite.rect.angle = visualProps.rotation
              textSprite.opacity = visualProps.opacity
              textSprite.zIndex = visualProps.zIndex
            }
          }
        }

        // 添加到画布
        await webavModule.addSprite(newSprite)

        // 更新store中的sprite引用
        timelineModule.updateLocalTimelineItemSprite(timelineItem.id, markRaw(newSprite))

        // 重新设置双向数据同步
        timelineModule.setupBidirectionalSync(timelineItem)

        // 如果有动画配置，重新应用动画
        if (timelineItem.animation && timelineItem.animation.isEnabled) {
          try {
            console.log(`🎬 重新应用动画配置: ${timelineItem.id}`)
            const { updateWebAVAnimation } = await import('../utils/webavAnimationManager')
            await updateWebAVAnimation(timelineItem)
            console.log(`✅ 动画配置重新应用完成: ${timelineItem.id}`)
          } catch (animationError) {
            console.error(`❌ 动画配置重新应用失败: ${timelineItem.id}`, animationError)
          }
        }

        // 重新生成缩略图（因为之前的blob URL可能已失效）
        // 文本类型不需要缩略图，音频类型也不需要缩略图
        if (timelineItem.mediaType !== 'audio' && timelineItem.mediaType !== 'text') {
          const mediaItem = mediaModule.getLocalMediaItem(timelineItem.mediaItemId)
          if (mediaItem) {
            console.log(`🖼️ 重新生成缩略图: ${timelineItem.id}`)
            const newThumbnailUrl = await regenerateThumbnailForTimelineItem(
              timelineItem,
              mediaItem,
            )
            if (newThumbnailUrl) {
              timelineItem.thumbnailUrl = newThumbnailUrl
              console.log(`✅ 缩略图重新生成完成: ${timelineItem.id}`)
            }
          }
        }

        rebuiltCount++
        console.log(`✅ sprite重建完成: ${timelineItem.id} (${rebuiltCount}/${items.length})`)
      } catch (error) {
        console.error(`❌ sprite重建失败: ${timelineItem.id}`, error)
      }
    }

    console.log(`✅ 所有sprite重建完成: 成功${rebuiltCount}/${items.length}个`)
  }

  return {
    // 新的两层数据结构
    mediaItems: mediaModule.mediaItems,
    asyncProcessingItems: mediaModule.asyncProcessingItems,
    timelineItems: timelineModule.timelineItems,
    tracks: trackModule.tracks,
    currentFrame: playbackModule.currentFrame,
    isPlaying: playbackModule.isPlaying,
    timelineDurationFrames: configModule.timelineDurationFrames,
    totalDurationFrames,
    contentEndTimeFrames: viewportModule.contentEndTimeFrames,
    playbackRate: playbackModule.playbackRate,
    selectedTimelineItemId: selectionModule.selectedTimelineItemId,
    // 多选状态
    selectedTimelineItemIds: selectionModule.selectedTimelineItemIds,
    isMultiSelectMode: selectionModule.isMultiSelectMode,
    // 编辑设置（已废弃：等比缩放现在是每个clip独立状态）
    // proportionalScale: configModule.proportionalScale,
    // 缩放和滚动状态
    zoomLevel: viewportModule.zoomLevel,
    scrollOffset: viewportModule.scrollOffset,
    frameRate: configModule.frameRate,
    minZoomLevel: viewportModule.minZoomLevel,
    visibleDurationFrames: viewportModule.visibleDurationFrames,
    maxVisibleDurationFrames: viewportModule.maxVisibleDurationFrames,
    getMaxZoomLevel: (timelineWidth: number) =>
      viewportModule.getMaxZoomLevelForTimeline(timelineWidth),
    getMaxScrollOffset: viewportModule.getMaxScrollOffsetForTimeline,
    // 素材管理方法
    addLocalMediaItem,
    removeLocalMediaItem,
    getLocalMediaItem,
    updateLocalMediaItemName,
    updateLocalMediaItem,
    getAllMediaItems: mediaModule.getAllMediaItems,
    waitForMediaItemReady: mediaModule.waitForMediaItemReady,
    // 异步处理素材管理方法
    addAsyncProcessingItem: mediaModule.addAsyncProcessingItem,
    updateAsyncProcessingItem: mediaModule.updateAsyncProcessingItem,
    removeAsyncProcessingItem,
    getAsyncProcessingItem: mediaModule.getAsyncProcessingItem,
    // 时间轴管理方法
    addTimelineItem: timelineModule.addTimelineItem,
    removeTimelineItem: timelineModule.removeTimelineItem,
    getTimelineItem: timelineModule.getTimelineItem,
    getLocalTimelineItem: timelineModule.getLocalTimelineItem,
    getTimelineItemsForTrack: (trackId: string) =>
      getTimelineItemsByTrack(trackId, timelineModule.timelineItems.value),
    updateTimelineItemPosition: timelineModule.updateTimelineItemPosition,
    updateLocalTimelineItemSprite: timelineModule.updateLocalTimelineItemSprite,
    setupBidirectionalSync: timelineModule.setupBidirectionalSync,
    updateLocalTimelineItemTransform: timelineModule.updateLocalTimelineItemTransform,
    // 统一选择管理API
    selectTimelineItems: selectionModule.selectTimelineItems,
    selectTimelineItemsWithHistory: selectionModule.selectTimelineItemsWithHistory,
    syncAVCanvasSelection: selectionModule.syncAVCanvasSelection,
    hasSelection: selectionModule.hasSelection,
    // 兼容性选择方法
    selectTimelineItem: selectionModule.selectTimelineItem,
    clearAllSelections: selectionModule.clearAllSelections,
    toggleTimelineItemSelection: selectionModule.toggleTimelineItemSelection,
    isTimelineItemSelected: selectionModule.isTimelineItemSelected,
    getSelectedTimelineItem: selectionModule.getSelectedTimelineItem,
    getSelectionSummary: selectionModule.getSelectionSummary,
    resetSelectionToDefaults: selectionModule.resetToDefaults,
    findTimelineItemBySprite: (sprite: Raw<VideoVisibleSprite>) =>
      findTimelineItemBySprite(sprite, timelineModule.timelineItems.value),
    // 多选兼容性方法
    addToMultiSelection: selectionModule.addToMultiSelection,
    removeFromMultiSelection: selectionModule.removeFromMultiSelection,
    toggleMultiSelection: selectionModule.toggleMultiSelection,
    clearMultiSelection: selectionModule.clearMultiSelection,
    isInMultiSelection: selectionModule.isInMultiSelection,
    // 视频片段操作方法
    updateTimelineItemPlaybackRate: clipOperationsModule.updateTimelineItemPlaybackRate,
    autoArrangeTimelineItems: () => autoArrangeTimelineItems(timelineModule.timelineItems),
    autoArrangeTrackItems: (trackId: string) =>
      autoArrangeTrackItems(timelineModule.timelineItems, trackId),
    // 播放控制方法
    setCurrentFrame: playbackModule.setCurrentFrame,
    seekToFrame: playbackModule.seekToFrame,
    seekByFrames: playbackModule.seekByFrames,
    setPlaybackRate: playbackModule.setPlaybackRate,
    nextFrame: playbackModule.nextFrame,
    previousFrame: playbackModule.previousFrame,
    setPlaying: playbackModule.setPlaying,
    play: playbackModule.play,
    pause: playbackModule.pause,
    togglePlayPause: playbackModule.togglePlayPause,
    stop: playbackModule.stop,
    resetPlaybackRate: playbackModule.resetPlaybackRate,
    formattedCurrentTime: playbackModule.formattedCurrentTime,
    playbackRateText: playbackModule.playbackRateText,
    getPlaybackSummary: playbackModule.getPlaybackSummary,
    resetPlaybackToDefaults: playbackModule.resetToDefaults,
    // 轨道管理方法
    addTrack: (type: TrackType = 'video', name?: string) => trackModule.addTrack(type, name),
    removeTrack: (trackId: string) =>
      trackModule.removeTrack(
        trackId,
        timelineModule.timelineItems,
        timelineModule.removeTimelineItem,
      ),
    toggleTrackVisibility: (trackId: string) =>
      trackModule.toggleTrackVisibility(trackId, timelineModule.timelineItems),
    toggleTrackMute: (trackId: string) =>
      trackModule.toggleTrackMute(trackId, timelineModule.timelineItems),
    renameTrack: trackModule.renameTrack,
    setTrackHeight: trackModule.setTrackHeight,
    getTrack: trackModule.getTrack,
    getTracksSummary: trackModule.getTracksSummary,
    resetTracksToDefaults: trackModule.resetTracksToDefaults,
    // 缩放和滚动方法
    setZoomLevel: (newZoomLevel: number, timelineWidth: number = 800) =>
      viewportModule.setZoomLevel(newZoomLevel, timelineWidth, configModule.frameRate.value),
    setScrollOffset: viewportModule.setScrollOffset,
    zoomIn: (factor: number = 1.2, timelineWidth: number = 800) =>
      viewportModule.zoomIn(factor, timelineWidth, configModule.frameRate.value),
    zoomOut: (factor: number = 1.2, timelineWidth: number = 800) =>
      viewportModule.zoomOut(factor, timelineWidth, configModule.frameRate.value),
    scrollLeft: viewportModule.scrollLeft,
    scrollRight: viewportModule.scrollRight,
    scrollToFrame: viewportModule.scrollToFrame,
    resetViewport: viewportModule.resetViewport,
    getViewportSummary: viewportModule.getViewportSummary,

    // 帧数坐标转换（新增）
    frameToPixel: (frames: number, timelineWidth: number) =>
      frameToPixel(
        frames,
        timelineWidth,
        totalDurationFrames.value,
        viewportModule.zoomLevel.value,
        viewportModule.scrollOffset.value,
      ),
    pixelToFrame: (pixel: number, timelineWidth: number) =>
      pixelToFrame(
        pixel,
        timelineWidth,
        totalDurationFrames.value,
        viewportModule.zoomLevel.value,
        viewportModule.scrollOffset.value,
      ),

    expandTimelineIfNeededFrames: (targetFrames: number) =>
      expandTimelineIfNeededFrames(targetFrames, configModule.timelineDurationFrames),
    // 分辨率相关
    videoResolution: configModule.videoResolution,
    setVideoResolution: configModule.setVideoResolution,
    // 配置管理
    setTimelineDurationFrames: configModule.setTimelineDurationFrames,
    setFrameRate: configModule.setFrameRate,
    setProportionalScale: configModule.setProportionalScale,
    getConfigSummary: configModule.getConfigSummary,
    resetConfigToDefaults: configModule.resetToDefaults,
    restoreFromProjectSettings: configModule.restoreFromProjectSettings,
    // 分辨率管理（从Clip获取）
    getVideoOriginalResolution,
    getImageOriginalResolution,
    // WebAV 相关状态和方法
    avCanvas: webavModule.avCanvas,
    isWebAVReady: webavModule.isWebAVReady,
    webAVError: webavModule.webAVError,
    setAVCanvas: webavModule.setAVCanvas,
    setWebAVReady: webavModule.setWebAVReady,
    setWebAVError: webavModule.setWebAVError,
    clearWebAVState: webavModule.clearWebAVState,
    isWebAVAvailable: webavModule.isWebAVAvailable,
    getWebAVSummary: webavModule.getWebAVSummary,
    resetWebAVToDefaults: webavModule.resetToDefaults,
    addSpriteToCanvas: webavModule.addSprite,
    removeSpriteFromCanvas: webavModule.removeSprite,

    // WebAV 画布容器管理
    createCanvasContainer: webavModule.createCanvasContainer,
    initializeCanvas: webavModule.initializeCanvas,
    getAVCanvas: webavModule.getAVCanvas,
    getCanvasContainer: webavModule.getCanvasContainer,

    // WebAV 播放控制
    webAVPlay: webavModule.play,
    webAVPause: webavModule.pause,
    webAVSeekTo: webavModule.seekTo,

    // WebAV Clip创建和管理
    createMP4Clip: webavModule.createMP4Clip,
    createImgClip: webavModule.createImgClip,
    createAudioClip: webavModule.createAudioClip,
    cloneMP4Clip: webavModule.cloneMP4Clip,
    cloneImgClip: webavModule.cloneImgClip,
    cloneAudioClip: webavModule.cloneAudioClip,

    // WebAV 实例管理
    destroyWebAV: webavModule.destroy,
    isWebAVReadyGlobal: webavModule.isWebAVReadyGlobal,
    waitForWebAVReady: webavModule.waitForWebAVReady,

    // WebAV 画布销毁和重建
    destroyCanvas: webavModule.destroyCanvas,
    recreateCanvas: webavModule.recreateCanvas,
    // 历史管理方法
    canUndo: historyModule.canUndo,
    canRedo: historyModule.canRedo,
    undo: historyModule.undo,
    redo: historyModule.redo,
    clearHistory: historyModule.clear,
    getHistorySummary: historyModule.getHistorySummary,
    executeCommand: historyModule.executeCommand,
    // 通知管理方法和状态
    notifications: notificationModule.notifications,
    showNotification: notificationModule.showNotification,
    removeNotification: notificationModule.removeNotification,
    clearNotifications: notificationModule.clearNotifications,
    showSuccess: notificationModule.showSuccess,
    showError: notificationModule.showError,
    showWarning: notificationModule.showWarning,
    showInfo: notificationModule.showInfo,
    addTimelineItemWithHistory,
    removeTimelineItemWithHistory,
    moveTimelineItemWithHistory,
    updateTimelineItemTransformWithHistory,
    splitTimelineItemAtTimeWithHistory,
    duplicateTimelineItemWithHistory,
    addTrackWithHistory,
    removeTrackWithHistory,
    renameTrackWithHistory,
    autoArrangeTrackWithHistory,
    toggleTrackVisibilityWithHistory,
    toggleTrackMuteWithHistory,
    resizeTimelineItemWithHistory,
    batchDeleteTimelineItems,
    // 批量操作方法
    startBatch: historyModule.startBatch,
    executeBatchCommand: historyModule.executeBatchCommand,

    // 项目管理
    currentProject: projectModule.currentProject,
    currentProjectId: projectModule.currentProjectId,
    currentProjectName: projectModule.currentProjectName,
    projectStatus: projectModule.projectStatus,
    hasCurrentProject: projectModule.hasCurrentProject,
    isSaving: projectModule.isSaving,
    isLoading: projectModule.isLoading,
    lastSaved: projectModule.lastSaved,
    mediaReferences: projectModule.mediaReferences,

    // 加载进度状态
    loadingProgress: projectModule.loadingProgress,
    loadingStage: projectModule.loadingStage,
    loadingDetails: projectModule.loadingDetails,
    showLoadingProgress: projectModule.showLoadingProgress,

    // 项目加载状态
    isProjectSettingsReady: projectModule.isProjectSettingsReady,
    isProjectContentReady: projectModule.isProjectContentReady,

    createProject: projectModule.createProject,
    saveCurrentProject: projectModule.saveCurrentProject,
    preloadProjectSettings: projectModule.preloadProjectSettings,
    loadProjectContent: projectModule.loadProjectContent,
    clearCurrentProject: projectModule.clearCurrentProject,
    addMediaReference: projectModule.addMediaReference,
    removeMediaReference: projectModule.removeMediaReference,
    getMediaReference: projectModule.getMediaReference,
    getMediaReferences: () => projectModule.mediaReferences.value,
    getProjectSummary: projectModule.getProjectSummary,
    updateLoadingProgress: projectModule.updateLoadingProgress,
    resetLoadingState: projectModule.resetLoadingState,

    // 项目恢复方法
    restoreMediaItems,
    restoreTracks,
    restoreTimelineItems,
  }
})

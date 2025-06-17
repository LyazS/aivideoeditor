import { computed, type Raw } from 'vue'
import { defineStore } from 'pinia'
import { CustomVisibleSprite } from '../utils/VideoVisibleSprite'
import {
  alignTimeToFrame,
  timeToPixel,
  pixelToTime,
  expandTimelineIfNeeded,
  getTimelineItemAtTime,
  autoArrangeTimelineItems,
  autoArrangeTrackItems,
  calculateTotalDuration,
  findTimelineItemBySprite,
  getTimelineItemsByTrack,
} from './utils/storeUtils'
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
import { AddTimelineItemCommand, RemoveTimelineItemCommand, MoveTimelineItemCommand, UpdateTransformCommand } from './modules/commands/timelineCommands'
import type { MediaItem, TimelineItem } from '../types/videoTypes'

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

  // 创建时间轴核心管理模块
  const timelineModule = createTimelineModule(configModule, webavModule as any, mediaModule, trackModule)

  const totalDuration = computed(() => {
    return calculateTotalDuration(
      timelineModule.timelineItems.value,
      configModule.timelineDuration.value,
    )
  })

  // 创建视口管理模块（需要在totalDuration之后创建）
  const viewportModule = createViewportModule(
    timelineModule.timelineItems,
    totalDuration,
    configModule.timelineDuration,
  )

  // 创建选择管理模块（需要在webavModule之后创建）
  const selectionModule = createSelectionModule(timelineModule.timelineItems, webavModule.avCanvas)

  // 创建视频片段操作模块（需要在其他模块之后创建）
  const clipOperationsModule = createClipOperationsModule(
    webavModule as any,
    mediaModule,
    timelineModule,
    selectionModule,
    trackModule,
  )

  // 创建历史管理模块
  const historyModule = createHistoryModule()

  // ==================== 双向数据同步函数 ====================

  // ==================== 素材管理方法 ====================
  // 使用媒体模块的方法，但需要包装以提供额外的依赖
  function addMediaItem(mediaItem: MediaItem) {
    mediaModule.addMediaItem(mediaItem, timelineModule.timelineItems, trackModule.tracks)
  }

  // ==================== 历史记录包装方法 ====================

  /**
   * 带历史记录的添加时间轴项目方法
   * @param timelineItem 要添加的时间轴项目
   */
  async function addTimelineItemWithHistory(timelineItem: TimelineItem) {
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
        getMediaItem: mediaModule.getMediaItem,
      }
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
        getMediaItem: mediaModule.getMediaItem,
      }
    )
    await historyModule.executeCommand(command)
  }

  /**
   * 带历史记录的移动时间轴项目方法
   * @param timelineItemId 要移动的时间轴项目ID
   * @param newPosition 新的时间位置（秒）
   * @param newTrackId 新的轨道ID（可选）
   */
  async function moveTimelineItemWithHistory(
    timelineItemId: string,
    newPosition: number,
    newTrackId?: number
  ) {
    // 获取要移动的时间轴项目
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法移动: ${timelineItemId}`)
      return
    }

    // 获取当前位置和轨道
    const oldPosition = timelineItem.timeRange.timelineStartTime / 1000000 // 转换为秒
    const oldTrackId = timelineItem.trackId
    const finalNewTrackId = newTrackId !== undefined ? newTrackId : oldTrackId

    // 检查是否有实际变化
    const positionChanged = Math.abs(oldPosition - newPosition) > 0.001 // 允许1毫秒的误差
    const trackChanged = oldTrackId !== finalNewTrackId

    if (!positionChanged && !trackChanged) {
      console.log('⚠️ 位置和轨道都没有变化，跳过移动操作')
      return
    }

    const command = new MoveTimelineItemCommand(
      timelineItemId,
      oldPosition,
      newPosition,
      oldTrackId,
      finalNewTrackId,
      {
        updateTimelineItemPosition: timelineModule.updateTimelineItemPosition,
        getTimelineItem: timelineModule.getTimelineItem,
      },
      {
        getMediaItem: mediaModule.getMediaItem,
      }
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
      position?: { x: number; y: number }
      size?: { width: number; height: number }
      rotation?: number
      opacity?: number
      zIndex?: number
      duration?: number // 时长（秒）
      playbackRate?: number // 倍速
    }
  ) {
    // 获取要更新的时间轴项目
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ 时间轴项目不存在，无法更新变换属性: ${timelineItemId}`)
      return
    }

    // 获取当前的变换属性
    const oldTransform: typeof newTransform = {}

    if (newTransform.position) {
      oldTransform.position = {
        x: timelineItem.position.x,
        y: timelineItem.position.y,
      }
    }

    if (newTransform.size) {
      oldTransform.size = {
        width: timelineItem.size.width,
        height: timelineItem.size.height,
      }
    }

    if (newTransform.rotation !== undefined) {
      oldTransform.rotation = timelineItem.rotation
    }

    if (newTransform.opacity !== undefined) {
      oldTransform.opacity = timelineItem.opacity
    }

    if (newTransform.zIndex !== undefined) {
      oldTransform.zIndex = timelineItem.zIndex
    }

    if (newTransform.duration !== undefined) {
      // 计算当前时长
      const timeRange = timelineItem.timeRange
      const currentDuration = (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000 // 转换为秒
      oldTransform.duration = currentDuration
    }

    if (newTransform.playbackRate !== undefined) {
      // 获取当前倍速（仅对视频有效）
      if (timelineItem.mediaType === 'video' && 'playbackRate' in timelineItem.timeRange) {
        oldTransform.playbackRate = timelineItem.timeRange.playbackRate || 1
      } else {
        oldTransform.playbackRate = 1 // 图片默认为1
      }
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
        updateTimelineItemTransform: timelineModule.updateTimelineItemTransform,
        getTimelineItem: timelineModule.getTimelineItem,
      },
      {
        getMediaItem: mediaModule.getMediaItem,
      },
      {
        updateTimelineItemPlaybackRate: clipOperationsModule.updateTimelineItemPlaybackRate,
      }
    )
    await historyModule.executeCommand(command)
  }

  /**
   * 检查变换属性是否有实际变化
   */
  function checkTransformChanges(
    oldTransform: any,
    newTransform: any
  ): boolean {
    // 检查位置变化
    if (newTransform.position && oldTransform.position) {
      const positionChanged =
        Math.abs(oldTransform.position.x - newTransform.position.x) > 0.1 ||
        Math.abs(oldTransform.position.y - newTransform.position.y) > 0.1
      if (positionChanged) return true
    }

    // 检查大小变化
    if (newTransform.size && oldTransform.size) {
      const sizeChanged =
        Math.abs(oldTransform.size.width - newTransform.size.width) > 0.1 ||
        Math.abs(oldTransform.size.height - newTransform.size.height) > 0.1
      if (sizeChanged) return true
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
      const playbackRateChanged = Math.abs(oldTransform.playbackRate - newTransform.playbackRate) > 0.01 // 0.01倍速误差容忍
      if (playbackRateChanged) return true
    }

    return false
  }

  /**
   * 确定属性类型
   */
  function determinePropertyType(transform: any): 'position' | 'size' | 'rotation' | 'opacity' | 'zIndex' | 'duration' | 'playbackRate' | 'multiple' {
    const changedProperties = []

    if (transform.position) changedProperties.push('position')
    if (transform.size) changedProperties.push('size')
    if (transform.rotation !== undefined) changedProperties.push('rotation')
    if (transform.opacity !== undefined) changedProperties.push('opacity')
    if (transform.zIndex !== undefined) changedProperties.push('zIndex')
    if (transform.duration !== undefined) changedProperties.push('duration')
    if (transform.playbackRate !== undefined) changedProperties.push('playbackRate')

    return changedProperties.length === 1 ? changedProperties[0] as any : 'multiple'
  }

  function removeMediaItem(mediaItemId: string) {
    mediaModule.removeMediaItem(
      mediaItemId,
      timelineModule.timelineItems,
      trackModule.tracks,
      webavModule.avCanvas.value as any,
      () => {}, // 清理回调，目前为空
    )
  }

  function getMediaItem(mediaItemId: string): MediaItem | undefined {
    return mediaModule.getMediaItem(mediaItemId)
  }

  // ==================== 素材名称管理 ====================
  function updateMediaItemName(mediaItemId: string, newName: string) {
    mediaModule.updateMediaItemName(mediaItemId, newName)
  }

  function updateMediaItem(mediaItem: MediaItem) {
    mediaModule.updateMediaItem(mediaItem)
  }

  // ==================== 视频元素管理方法 ====================
  // 使用媒体模块的视频元素管理方法
  function setVideoElement(clipId: string, videoElement: HTMLVideoElement | null) {
    mediaModule.setVideoElement(clipId, videoElement)
  }

  function getVideoOriginalResolution(clipId: string): { width: number; height: number } {
    return mediaModule.getVideoOriginalResolution(clipId)
  }

  // ==================== 图片元素管理方法 ====================
  // 使用媒体模块的图片元素管理方法
  function setImageElement(clipId: string, imageElement: HTMLImageElement | null) {
    mediaModule.setImageElement(clipId, imageElement)
  }

  function getImageOriginalResolution(clipId: string): { width: number; height: number } {
    return mediaModule.getImageOriginalResolution(clipId)
  }

  return {
    // 新的两层数据结构
    mediaItems: mediaModule.mediaItems,
    timelineItems: timelineModule.timelineItems,
    tracks: trackModule.tracks,
    currentTime: playbackModule.currentTime,
    isPlaying: playbackModule.isPlaying,
    timelineDuration: configModule.timelineDuration,
    totalDuration,
    contentEndTime: viewportModule.contentEndTime,
    playbackRate: playbackModule.playbackRate,
    selectedTimelineItemId: selectionModule.selectedTimelineItemId,
    selectedAVCanvasSprite: selectionModule.selectedAVCanvasSprite,
    // 编辑设置
    proportionalScale: configModule.proportionalScale,
    // 缩放和滚动状态
    zoomLevel: viewportModule.zoomLevel,
    scrollOffset: viewportModule.scrollOffset,
    frameRate: configModule.frameRate,
    minZoomLevel: viewportModule.minZoomLevel,
    visibleDuration: viewportModule.visibleDuration,
    maxVisibleDuration: viewportModule.maxVisibleDuration,
    getMaxZoomLevel: (timelineWidth: number) =>
      viewportModule.getMaxZoomLevelForTimeline(timelineWidth, configModule.frameRate.value),
    getMaxScrollOffset: viewportModule.getMaxScrollOffsetForTimeline,
    // 素材管理方法
    addMediaItem,
    removeMediaItem,
    getMediaItem,
    updateMediaItemName,
    updateMediaItem,
    // 时间轴管理方法
    addTimelineItem: timelineModule.addTimelineItem,
    removeTimelineItem: timelineModule.removeTimelineItem,
    getTimelineItem: timelineModule.getTimelineItem,
    getTimelineItemsForTrack: (trackId: number) =>
      getTimelineItemsByTrack(trackId, timelineModule.timelineItems.value),
    updateTimelineItemPosition: timelineModule.updateTimelineItemPosition,
    updateTimelineItemSprite: timelineModule.updateTimelineItemSprite,
    setupBidirectionalSync: timelineModule.setupBidirectionalSync,
    updateTimelineItemTransform: timelineModule.updateTimelineItemTransform,
    // 选择管理方法
    selectTimelineItem: selectionModule.selectTimelineItem,
    selectAVCanvasSprite: selectionModule.selectAVCanvasSprite,
    handleAVCanvasSpriteChange: selectionModule.handleAVCanvasSpriteChange,
    clearAllSelections: selectionModule.clearAllSelections,
    toggleTimelineItemSelection: selectionModule.toggleTimelineItemSelection,
    isTimelineItemSelected: selectionModule.isTimelineItemSelected,
    isSpriteSelected: selectionModule.isSpriteSelected,
    getSelectedTimelineItem: selectionModule.getSelectedTimelineItem,
    getSelectionSummary: selectionModule.getSelectionSummary,
    resetSelectionToDefaults: selectionModule.resetToDefaults,
    findTimelineItemBySprite: (sprite: Raw<CustomVisibleSprite>) =>
      findTimelineItemBySprite(sprite, timelineModule.timelineItems.value),
    // 视频片段操作方法
    duplicateTimelineItem: clipOperationsModule.duplicateTimelineItem,
    splitTimelineItemAtTime: clipOperationsModule.splitTimelineItemAtTime,
    updateTimelineItemPlaybackRate: clipOperationsModule.updateTimelineItemPlaybackRate,
    getTimelineItemAtTime: (time: number) =>
      getTimelineItemAtTime(time, timelineModule.timelineItems.value),
    autoArrangeTimelineItems: () => autoArrangeTimelineItems(timelineModule.timelineItems),
    autoArrangeTrackItems: (trackId: number) => autoArrangeTrackItems(timelineModule.timelineItems, trackId),
    // 播放控制方法
    setCurrentTime: playbackModule.setCurrentTime,
    setPlaybackRate: playbackModule.setPlaybackRate,
    seekTo: playbackModule.seekTo,
    seekBy: playbackModule.seekBy,
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
    addTrack: (name?: string) => trackModule.addTrack(name),
    removeTrack: (trackId: number) =>
      trackModule.removeTrack(trackId, timelineModule.timelineItems),
    toggleTrackVisibility: trackModule.toggleTrackVisibility,
    toggleTrackMute: trackModule.toggleTrackMute,
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
    scrollToTime: viewportModule.scrollToTime,
    resetViewport: viewportModule.resetViewport,
    getViewportSummary: viewportModule.getViewportSummary,
    timeToPixel: (time: number, timelineWidth: number) =>
      timeToPixel(
        time,
        timelineWidth,
        totalDuration.value,
        viewportModule.zoomLevel.value,
        viewportModule.scrollOffset.value,
      ),
    pixelToTime: (pixel: number, timelineWidth: number) =>
      pixelToTime(
        pixel,
        timelineWidth,
        totalDuration.value,
        viewportModule.zoomLevel.value,
        viewportModule.scrollOffset.value,
      ),
    alignTimeToFrame: (time: number) => alignTimeToFrame(time, configModule.frameRate.value),
    expandTimelineIfNeeded: (targetTime: number) =>
      expandTimelineIfNeeded(targetTime, configModule.timelineDuration),
    // 分辨率相关
    videoResolution: configModule.videoResolution,
    setVideoResolution: configModule.setVideoResolution,
    // 配置管理
    setTimelineDuration: configModule.setTimelineDuration,
    setFrameRate: configModule.setFrameRate,
    setProportionalScale: configModule.setProportionalScale,
    getConfigSummary: configModule.getConfigSummary,
    resetConfigToDefaults: configModule.resetToDefaults,
    // 视频元素管理
    setVideoElement,
    getVideoOriginalResolution,
    // 图片元素管理
    setImageElement,
    getImageOriginalResolution,
    // WebAV 相关状态和方法
    avCanvas: webavModule.avCanvas,
    isWebAVReady: webavModule.isWebAVReady,
    webAVError: webavModule.webAVError,
    setAVCanvas: webavModule.setAVCanvas,
    setWebAVReady: webavModule.setWebAVReady,
    setWebAVError: webavModule.setWebAVError,
    initializeWebAV: webavModule.initializeWebAV,
    destroyWebAV: webavModule.destroyWebAV,
    rebuildWebAV: webavModule.rebuildWebAV,
    isWebAVAvailable: webavModule.isWebAVAvailable,
    getWebAVSummary: webavModule.getWebAVSummary,
    resetWebAVToDefaults: webavModule.resetToDefaults,
    addSpriteToCanvas: webavModule.addSprite,
    removeSpriteFromCanvas: webavModule.removeSprite,
    // 历史管理方法
    canUndo: historyModule.canUndo,
    canRedo: historyModule.canRedo,
    undo: historyModule.undo,
    redo: historyModule.redo,
    clearHistory: historyModule.clear,
    getHistorySummary: historyModule.getHistorySummary,
    addTimelineItemWithHistory,
    removeTimelineItemWithHistory,
    moveTimelineItemWithHistory,
    updateTimelineItemTransformWithHistory,
  }
})

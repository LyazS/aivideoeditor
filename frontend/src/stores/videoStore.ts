import { ref, computed, markRaw, reactive, type Raw } from 'vue'
import { defineStore } from 'pinia'
import { CustomVisibleSprite } from '../utils/customVisibleSprite'
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
import type { MediaItem } from '../types/videoTypes'

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
  const timelineModule = createTimelineModule(configModule, webavModule, mediaModule, trackModule)

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
    webavModule,
    mediaModule,
    timelineModule,
    selectionModule,
    trackModule,
  )

  // ==================== 双向数据同步函数 ====================

  // ==================== 素材管理方法 ====================
  // 使用媒体模块的方法，但需要包装以提供额外的依赖
  function addMediaItem(mediaItem: MediaItem) {
    mediaModule.addMediaItem(mediaItem, timelineModule.timelineItems, trackModule.tracks)
  }

  function removeMediaItem(mediaItemId: string) {
    mediaModule.removeMediaItem(
      mediaItemId,
      timelineModule.timelineItems,
      trackModule.tracks,
      webavModule.avCanvas.value,
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

  function getMediaOriginalResolution(mediaItemId: string): { width: number; height: number } {
    return mediaModule.getMediaOriginalResolution(mediaItemId)
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
    getMediaOriginalResolution,
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
  }
})

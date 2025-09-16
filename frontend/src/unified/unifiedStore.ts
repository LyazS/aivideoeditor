import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createUnifiedMediaModule } from '@/unified/modules/UnifiedMediaModule'
import { createUnifiedTrackModule } from '@/unified/modules/UnifiedTrackModule'
import { createUnifiedTimelineModule } from '@/unified/modules/UnifiedTimelineModule'
import { createUnifiedProjectModule } from '@/unified/modules/UnifiedProjectModule'
import { createUnifiedViewportModule } from '@/unified/modules/UnifiedViewportModule'
import { createUnifiedSelectionModule } from '@/unified/modules/UnifiedSelectionModule'
import { createUnifiedConfigModule } from '@/unified/modules/UnifiedConfigModule'
import { createUnifiedPlaybackModule } from '@/unified/modules/UnifiedPlaybackModule'
import { createUnifiedWebavModule } from '@/unified/modules/UnifiedWebavModule'
import { createUnifiedNotificationModule } from '@/unified/modules/UnifiedNotificationModule'
import { createUnifiedHistoryModule } from '@/unified/modules/UnifiedHistoryModule'
import { createUnifiedAutoSaveModule } from '@/unified/modules/UnifiedAutoSaveModule'
import { createUnifiedVideoThumbnailModule } from '@/unified/modules/UnifiedVideoThumbnailModule'
import { createUnifiedSnapModule } from '@/unified/modules/UnifiedSnapModule'
import { useHistoryOperations } from '@/unified/composables/useHistoryOperations'
import { calculateTotalDurationFrames } from '@/unified/utils/durationUtils'
import type { MediaType, MediaTypeOrUnknown } from '@/unified'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem'
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
 * 7. 使用 UnifiedConfigModule 管理视频编辑器全局配置
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
  const unifiedMediaModule = createUnifiedMediaModule()

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
  const unifiedSelectionModule = createUnifiedSelectionModule(unifiedTimelineModule.getTimelineItem)

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

  // 创建视频缩略图模块
  const unifiedVideoThumbnailModule = createUnifiedVideoThumbnailModule(
    unifiedTimelineModule,
    unifiedMediaModule,
  )

  // 创建统一吸附管理模块
  const unifiedSnapModule = createUnifiedSnapModule(
    unifiedTimelineModule.timelineItems,
    unifiedPlaybackModule.currentFrame,
    unifiedConfigModule,
  )

  // 创建历史记录操作模块
  const historyOperations = useHistoryOperations(
    unifiedHistoryModule,
    unifiedTimelineModule,
    unifiedWebavModule,
    unifiedMediaModule,
    unifiedConfigModule,
    unifiedTrackModule,
    unifiedSelectionModule,
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
    // 注意：UnifiedMediaModule和UnifiedTimelineModule没有resetToDefaults方法
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

  // ==================== 导出接口 ====================

  return {
    // ==================== 历史记录包装方法导出 ====================

    // 时间轴项目历史记录方法
    addTimelineItemWithHistory: historyOperations.addTimelineItemWithHistory,
    removeTimelineItemWithHistory: historyOperations.removeTimelineItemWithHistory,
    moveTimelineItemWithHistory: historyOperations.moveTimelineItemWithHistory,
    updateTimelineItemTransformWithHistory:
      historyOperations.updateTimelineItemTransformWithHistory,
    splitTimelineItemAtTimeWithHistory: historyOperations.splitTimelineItemAtTimeWithHistory,
    duplicateTimelineItemWithHistory: historyOperations.duplicateTimelineItemWithHistory,
    resizeTimelineItemWithHistory: historyOperations.resizeTimelineItemWithHistory,
    // 轨道历史记录方法
    addTrackWithHistory: historyOperations.addTrackWithHistory,
    removeTrackWithHistory: historyOperations.removeTrackWithHistory,
    renameTrackWithHistory: historyOperations.renameTrackWithHistory,
    autoArrangeTrackWithHistory: historyOperations.autoArrangeTrackWithHistory,
    toggleTrackVisibilityWithHistory: historyOperations.toggleTrackVisibilityWithHistory,
    toggleTrackMuteWithHistory: historyOperations.toggleTrackMuteWithHistory,
    updateTextContentWithHistory: historyOperations.updateTextContentWithHistory,
    updateTextStyleWithHistory: historyOperations.updateTextStyleWithHistory,
    selectTimelineItemsWithHistory: historyOperations.selectTimelineItemsWithHistory,
    // 关键帧历史记录方法
    createKeyframeWithHistory: historyOperations.createKeyframeWithHistory,
    deleteKeyframeWithHistory: historyOperations.deleteKeyframeWithHistory,
    updatePropertyWithHistory: historyOperations.updatePropertyWithHistory,
    clearAllKeyframesWithHistory: historyOperations.clearAllKeyframesWithHistory,
    toggleKeyframeWithHistory: historyOperations.toggleKeyframeWithHistory,

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
    removeTrack: unifiedTrackModule.removeTrack,
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
    undo: unifiedHistoryModule.undo,
    redo: unifiedHistoryModule.redo,
    clearHistory: unifiedHistoryModule.clear,
    getHistorySummary: unifiedHistoryModule.getHistorySummary,
    getCommand: unifiedHistoryModule.getCommand,
    startBatch: unifiedHistoryModule.startBatch,
    executeBatchCommand: unifiedHistoryModule.executeBatchCommand,

    // ==================== 统一选择模块状态和方法 ====================
    selectedMediaItemIds: unifiedSelectionModule.selectedMediaItemIds,
    hasMediaSelection: unifiedSelectionModule.hasMediaSelection,
    isMediaMultiSelectMode: unifiedSelectionModule.isMediaMultiSelectMode,
    selectMediaItems: unifiedSelectionModule.selectMediaItems,
    isMediaItemSelected: unifiedSelectionModule.isMediaItemSelected,
    clearMediaSelection: unifiedSelectionModule.clearMediaSelection,

    // 选择状态
    selectedTimelineItemId: unifiedSelectionModule.selectedTimelineItemId,
    selectedTimelineItemIds: unifiedSelectionModule.selectedTimelineItemIds,
    isMultiSelectMode: unifiedSelectionModule.isMultiSelectMode,
    hasSelection: unifiedSelectionModule.hasSelection,

    // 统一选择API
    selectTimelineItems: unifiedSelectionModule.selectTimelineItems,

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

    // ==================== 视频缩略图方法 ====================
    requestThumbnails: unifiedVideoThumbnailModule.requestThumbnails,
    cancelThumbnailTasks: unifiedVideoThumbnailModule.cancelTasks,
    cleanupThumbnailScheduler: unifiedVideoThumbnailModule.cleanup,

    // ==================== 工具函数导出 ====================
    getThumbnailUrl: unifiedVideoThumbnailModule.getThumbnailUrl,

    // ==================== 统一吸附模块状态和方法 ====================

    // 吸附功能状态
    snapConfig: unifiedSnapModule.snapConfig,
    isSnapCalculating: unifiedSnapModule.isCalculating,
    isSnapCacheUpdating: unifiedSnapModule.isCacheUpdating,

    // 吸附功能方法
    updateSnapConfig: unifiedSnapModule.updateSnapConfig,
    calculateSnapPosition: unifiedSnapModule.calculateSnapPosition,
    collectSnapTargets: unifiedSnapModule.collectSnapTargets,
    clearSnapCache: unifiedSnapModule.clearCache,
    isSnapCacheValid: unifiedSnapModule.isCacheValid,
    getSnapSummary: unifiedSnapModule.getSnapSummary,

    // 拖拽集成方法
    startSnapDrag: unifiedSnapModule.startDrag,
    endSnapDrag: unifiedSnapModule.endDrag,
  }
})

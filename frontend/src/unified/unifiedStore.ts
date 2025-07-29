import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createUnifiedMediaModule } from './modules/UnifiedMediaModule'
import { createUnifiedTrackModule } from './modules/UnifiedTrackModule'
import { createUnifiedTimelineModule } from './modules/UnifiedTimelineModule'
import { createUnifiedProjectModule } from './modules/UnifiedProjectModule'
import { createUnifiedViewportModule } from './modules/UnifiedViewportModule'
import { createUnifiedSelectionModule } from './modules/UnifiedSelectionModule'
import { createUnifiedClipOperationsModule } from './modules/UnifiedClipOperationsModule'
import { createUnifiedConfigModule } from './modules/UnifiedConfigModule'
import { createUnifiedPlaybackModule } from './modules/UnifiedPlaybackModule'
import { createUnifiedWebavModule } from './modules/UnifiedWebavModule'
import { createUnifiedNotificationModule } from './modules/UnifiedNotificationModule'
import { createUnifiedHistoryModule } from './modules/UnifiedHistoryModule'
import { calculateTotalDurationFrames } from './utils/UnifiedDurationUtils'
import type { UnifiedMediaItemData, MediaType } from '@/unified'
import type { UnifiedTrackType } from './track/TrackTypes'
import type { UnifiedTimelineItemData } from './timelineitem/TimelineItemData'

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

  // 创建统一媒体管理模块（替代原有的mediaModule）
  const unifiedMediaModule = createUnifiedMediaModule()

  // 创建统一轨道管理模块
  const unifiedTrackModule = createUnifiedTrackModule()

  // 创建配置管理模块
  const unifiedConfigModule = createUnifiedConfigModule()

  // 创建播放控制模块
  const unifiedPlaybackModule = createUnifiedPlaybackModule(unifiedConfigModule.frameRate)

  // 创建WebAV集成模块
  const unifiedWebavModule = createUnifiedWebavModule()

  // 创建统一时间轴管理模块（需要依赖其他模块）
  const unifiedTimelineModule = createUnifiedTimelineModule(
    unifiedConfigModule,
    unifiedWebavModule,
    unifiedMediaModule,
    unifiedTrackModule
  )

  // 创建统一项目管理模块
  const unifiedProjectModule = createUnifiedProjectModule()

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
      }
    },
    unifiedMediaModule,
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

  // ==================== 媒体管理方法 ====================

  /**
   * 添加媒体项目
   * @param mediaItem 统一媒体项目数据
   */
  function addMediaItem(mediaItem: UnifiedMediaItemData) {
    unifiedMediaModule.addMediaItem(mediaItem)
    console.log('📚 [UnifiedStore] 添加媒体项目:', mediaItem.name)
  }

  /**
   * 移除媒体项目（带日志）
   * @param mediaItemId 媒体项目ID
   */
  function removeMediaItem(mediaItemId: string) {
    const mediaItem = unifiedMediaModule.getMediaItem(mediaItemId)
    if (mediaItem) {
      unifiedMediaModule.removeMediaItem(mediaItemId)
      console.log('🗑️ [UnifiedStore] 移除媒体项目:', mediaItem.name)
    }
  }

  // ==================== 轨道管理方法 ====================

  /**
   * 添加轨道（带日志）
   * @param type 轨道类型
   * @param name 轨道名称（可选）
   * @param position 插入位置（可选）
   */
  function addTrack(type: UnifiedTrackType = 'video', name?: string, position?: number) {
    const newTrack = unifiedTrackModule.addTrack(type, name, position)
    console.log('🎵 [UnifiedStore] 添加轨道:', newTrack.name)
    return newTrack
  }

  /**
   * 移除轨道（带日志）
   * @param trackId 轨道ID
   */
  function removeTrack(trackId: string) {
    const track = unifiedTrackModule.getTrack(trackId)
    if (track) {
      // 注意：这里应该传入时间轴项目引用，但为了保持代码简洁
      // 暂时传入空的引用，后续可以直接使用unifiedTimelineModule.timelineItems
      const emptyTimelineItems = ref([])
      unifiedTrackModule.removeTrack(trackId, emptyTimelineItems)
      console.log('🗑️ [UnifiedStore] 移除轨道:', track.name)
    }
  }

  /**
   * 重命名轨道（带日志）
   * @param trackId 轨道ID
   * @param newName 新名称
   */
  function renameTrack(trackId: string, newName: string) {
    const track = unifiedTrackModule.getTrack(trackId)
    if (track) {
      const oldName = track.name
      unifiedTrackModule.renameTrack(trackId, newName)
      console.log('✏️ [UnifiedStore] 重命名轨道:', { oldName, newName })
    }
  }

  // ==================== 播放控制方法 ====================

  // 移除不必要的播放控制封装，直接在导出部分使用底层模块方法

  // 移除不必要的配置管理封装，直接在导出部分使用底层模块方法

  // ==================== WebAV管理方法（直接导出底层方法） ====================
  // 这些方法都是简单的代理调用，直接在导出部分使用底层模块方法

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
    console.log('🔄 [UnifiedStore] 重置所有模块到默认状态')
  }

  // ==================== 导出接口 ====================

  return {
    // ==================== 统一媒体模块状态和方法 ====================

    // 媒体项目状态
    mediaItems: unifiedMediaModule.mediaItems,

    // 媒体项目管理方法
    addMediaItem,
    removeMediaItem,
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
    handleSourceStatusChange: unifiedMediaModule.handleSourceStatusChange,
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
    addTrack,
    removeTrack,
    renameTrack,
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
    updateTimelineItemSprite: unifiedTimelineModule.updateTimelineItemSprite,
    updateTimelineItemTransform: unifiedTimelineModule.updateTimelineItemTransform,

    // 时间轴项目工厂函数
    createTimelineItemData: unifiedTimelineModule.createTimelineItemData,
    createVideoTimelineItem: unifiedTimelineModule.createVideoTimelineItem,
    createAudioTimelineItem: unifiedTimelineModule.createAudioTimelineItem,
    createImageTimelineItem: unifiedTimelineModule.createImageTimelineItem,
    cloneTimelineItemData: unifiedTimelineModule.cloneTimelineItemData,
    duplicateTimelineItem: unifiedTimelineModule.duplicateTimelineItem,

    // 时间轴项目状态转换函数
    transitionTimelineStatus: unifiedTimelineModule.transitionTimelineStatus,
    setTimelineItemLoading: unifiedTimelineModule.setLoading,
    setTimelineItemReady: unifiedTimelineModule.setReady,
    setTimelineItemError: unifiedTimelineModule.setError,

    // 时间轴项目查询函数
    isTimelineItemReady: unifiedTimelineModule.isReady,
    isTimelineItemLoading: unifiedTimelineModule.isLoading,
    hasTimelineItemError: unifiedTimelineModule.hasError,
    getTimelineItemDuration: unifiedTimelineModule.getDuration,
    getTimelineItemStatusText: unifiedTimelineModule.getStatusText,
    filterTimelineItemsByStatus: unifiedTimelineModule.filterByStatus,
    filterTimelineItemsByTrack: unifiedTimelineModule.filterByTrack,
    sortTimelineItemsByTime: unifiedTimelineModule.sortByTime,

    // 时间轴项目辅助函数
    timelineItemHasVisualProps: unifiedTimelineModule.hasVisualProps,
    timelineItemHasAudioProps: unifiedTimelineModule.hasAudioProps,

    // ==================== 统一项目模块状态和方法 ====================

    // 项目状态
    currentProject: unifiedProjectModule.currentProject,
    currentProjectId: unifiedProjectModule.currentProjectId,
    currentProjectName: unifiedProjectModule.currentProjectName,
    projectStatus: unifiedProjectModule.projectStatus,
    hasCurrentProject: unifiedProjectModule.hasCurrentProject,
    isProjectSaving: unifiedProjectModule.isSaving,
    isProjectLoading: unifiedProjectModule.isLoading,
    lastProjectSaved: unifiedProjectModule.lastSaved,

    // 项目加载进度状态
    projectLoadingProgress: unifiedProjectModule.loadingProgress,
    projectLoadingStage: unifiedProjectModule.loadingStage,
    projectLoadingDetails: unifiedProjectModule.loadingDetails,
    showProjectLoadingProgress: unifiedProjectModule.showLoadingProgress,
    isProjectSettingsReady: unifiedProjectModule.isProjectSettingsReady,
    isProjectContentReady: unifiedProjectModule.isProjectContentReady,

    // 项目管理方法
    createProject: unifiedProjectModule.createProject,
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

    // 配置状态
    videoResolution: unifiedConfigModule.videoResolution,
    frameRate: unifiedConfigModule.frameRate,
    timelineDurationFrames: unifiedConfigModule.timelineDurationFrames,
    proportionalScale: unifiedConfigModule.proportionalScale,

    // 配置管理方法
    setVideoResolution: unifiedConfigModule.setVideoResolution,
    setFrameRate: unifiedConfigModule.setFrameRate,
    setTimelineDurationFrames: unifiedConfigModule.setTimelineDurationFrames,
    setProportionalScale: unifiedConfigModule.setProportionalScale,
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

    resetToDefaults,  // 保留封装，因为需要重置所有模块
  }
})
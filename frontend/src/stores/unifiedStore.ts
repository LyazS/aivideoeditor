import { defineStore } from 'pinia'
import { computed } from 'vue'
import { createUnifiedMediaModule } from './modules/UnifiedMediaModule'
import { createUnifiedTrackModule } from './modules/UnifiedTrackModule'
import { createUnifiedTimelineModule } from './modules/UnifiedTimelineModule'
import { createUnifiedProjectModule } from './modules/UnifiedProjectModule'
import { createConfigModule } from './modules/configModule'
import { createPlaybackModule } from './modules/playbackModule'
import { createWebAVModule } from './modules/webavModule'
import { calculateContentEndTimeFrames, calculateTotalDurationFrames } from './utils/durationUtils'
import type { UnifiedMediaItemData, MediaType } from '@/unified'
import type { UnifiedTrackConfig } from '@/unified/track'
import type { UnifiedTimelineItem } from '@/unified/timelineitem'
import type { ProjectConfig } from '@/types'

/**
 * 统一视频编辑器存储
 * 基于新的统一类型系统重构的主要状态管理
 *
 * 架构特点：
 * 1. 使用 UnifiedProjectModule 管理统一项目状态和持久化
 * 2. 使用 UnifiedMediaModule 管理统一媒体项目
 * 3. 使用 UnifiedTrackModule 管理轨道系统
 * 4. 使用 UnifiedTimelineModule 管理时间轴项目
 * 5. 保持模块化设计，各模块职责清晰
 * 6. 兼容现有的配置、播放控制和WebAV集成
 * 7. 提供完整的项目生命周期管理（创建、保存、加载、清理）
 */
export const useUnifiedStore = defineStore('unified', () => {
  // ==================== 核心模块初始化 ====================

  // 创建统一媒体管理模块（替代原有的mediaModule）
  const unifiedMediaModule = createUnifiedMediaModule()

  // 创建统一轨道管理模块
  const unifiedTrackModule = createUnifiedTrackModule()

  // 创建统一时间轴管理模块
  const unifiedTimelineModule = createUnifiedTimelineModule()

  // 创建统一项目管理模块（替代原有的projectModule）
  const unifiedProjectModule = createUnifiedProjectModule()

  // 创建配置管理模块
  const configModule = createConfigModule()

  // 创建播放控制模块
  const playbackModule = createPlaybackModule(configModule.frameRate)

  // 创建WebAV集成模块
  const webavModule = createWebAVModule()

  // ==================== 计算属性 ====================

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
    return webavModule.isWebAVAvailable()
  })

  /**
   * 轨道统计信息
   */
  const trackStats = computed(() => {
    return unifiedTrackModule.getTracksSummary()
  })

  /**
   * 活跃轨道数量
   */
  const activeTrackCount = computed(() => {
    return unifiedTrackModule.getActiveTracks().length
  })

  /**
   * 时间轴项目统计信息
   */
  const timelineStats = computed(() => {
    return unifiedTimelineModule.getTimelineStats()
  })

  /**
   * 时间轴总时长
   */
  const totalTimelineDuration = computed(() => {
    return unifiedTimelineModule.getTotalDuration()
  })

  /**
   * 内容结束时间（帧数）
   */
  const contentEndTimeFrames = computed(() => {
    // 需要将UnifiedTimelineItem转换为兼容的类型
    const items = unifiedTimelineModule.timelineItems.value.map(item => ({
      timeRange: item.timeRange
    }))
    return calculateContentEndTimeFrames(items as any)
  })

  /**
   * 总时长（帧数）
   */
  const totalDurationFrames = computed(() => {
    // 需要将UnifiedTimelineItem转换为兼容的类型
    const items = unifiedTimelineModule.timelineItems.value.map(item => ({
      timeRange: item.timeRange
    }))
    return calculateTotalDurationFrames(items as any, configModule.timelineDurationFrames.value)
  })

  /**
   * 项目状态相关计算属性
   */
  const projectStats = computed(() => {
    return unifiedProjectModule.getUnifiedProjectSummary()
  })

  /**
   * 是否有当前项目
   */
  const hasCurrentProject = computed(() => {
    return unifiedProjectModule.hasCurrentProject.value
  })

  /**
   * 项目是否正在保存
   */
  const isProjectSaving = computed(() => {
    return unifiedProjectModule.isSaving.value
  })

  /**
   * 项目是否正在加载
   */
  const isProjectLoading = computed(() => {
    return unifiedProjectModule.isLoading.value
  })

  /**
   * 项目设置是否就绪
   */
  const isProjectSettingsReady = computed(() => {
    return unifiedProjectModule.isProjectSettingsReady.value
  })

  /**
   * 项目内容是否就绪
   */
  const isProjectContentReady = computed(() => {
    return unifiedProjectModule.isProjectContentReady.value
  })

  // ==================== 项目管理方法 ====================

  /**
   * 创建新项目
   * @param name 项目名称
   * @param template 项目模板（可选）
   */
  async function createProject(name: string, template?: Partial<ProjectConfig>) {
    const result = await unifiedProjectModule.createProject(name, template)
    console.log('📁 [UnifiedStore] 创建项目:', name)
    return result
  }

  /**
   * 保存当前项目
   * @param projectData 项目数据（可选）
   */
  async function saveCurrentProject(projectData?: Partial<ProjectConfig>) {
    await unifiedProjectModule.saveCurrentProject(projectData)
    console.log('💾 [UnifiedStore] 保存项目完成')
  }

  /**
   * 预加载项目设置
   * @param projectId 项目ID
   */
  async function preloadProjectSettings(projectId: string) {
    await unifiedProjectModule.preloadProjectSettings(projectId)
    console.log('🔧 [UnifiedStore] 预加载项目设置完成:', projectId)
  }

  /**
   * 加载统一项目内容
   * @param projectId 项目ID
   */
  async function loadUnifiedProjectContent(projectId: string) {
    await unifiedProjectModule.loadUnifiedProjectContent(projectId)
    console.log('📂 [UnifiedStore] 加载统一项目内容完成:', projectId)
  }

  /**
   * 清除当前项目
   */
  function clearCurrentProject() {
    unifiedProjectModule.clearCurrentProject()
    console.log('🧹 [UnifiedStore] 清除当前项目')
  }

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
   * 添加轨道
   * @param config 轨道配置
   */
  function addTrack(config: UnifiedTrackConfig) {
    const result = unifiedTrackModule.addTrack(config)
    console.log('🛤️ [UnifiedStore] 添加轨道:', config.name || `${config.type}轨道`)
    return { success: true, data: result }
  }

  /**
   * 移除轨道（带日志）
   * @param trackId 轨道ID
   */
  function removeTrack(trackId: string) {
    const track = unifiedTrackModule.getTrack(trackId)
    if (track) {
      const result = unifiedTrackModule.removeTrack(trackId)
      if (result) {
        console.log('🗑️ [UnifiedStore] 移除轨道:', track.name)
        return { success: true }
      } else {
        return { success: false, message: '移除轨道失败' }
      }
    }
    return { success: false, message: '轨道不存在' }
  }

  /**
   * 重命名轨道（带日志）
   * @param trackId 轨道ID
   * @param newName 新名称
   */
  function renameTrack(trackId: string, newName: string) {
    const track = unifiedTrackModule.getTrack(trackId)
    if (track) {
      const result = unifiedTrackModule.renameTrack(trackId, newName)
      if (result) {
        console.log('✏️ [UnifiedStore] 重命名轨道:', `${track.name} -> ${newName}`)
        return { success: true }
      } else {
        return { success: false, message: '重命名轨道失败' }
      }
    }
    return { success: false, message: '轨道不存在' }
  }

  // ==================== 时间轴项目管理方法 ====================

  /**
   * 添加时间轴项目
   * @param timelineItem 时间轴项目
   */
  function addTimelineItem(timelineItem: UnifiedTimelineItem) {
    const result = unifiedTimelineModule.addTimelineItem(timelineItem)
    if (result.success) {
      console.log('⏱️ [UnifiedStore] 添加时间轴项目:', timelineItem.config.name)
    }
    return result
  }

  /**
   * 移除时间轴项目（带日志）
   * @param itemId 时间轴项目ID
   */
  function removeTimelineItem(itemId: string) {
    const item = unifiedTimelineModule.getTimelineItem(itemId)
    if (item) {
      const result = unifiedTimelineModule.removeTimelineItem(itemId)
      if (result.success) {
        console.log('🗑️ [UnifiedStore] 移除时间轴项目:', item.config.name)
      }
      return result
    }
    return { success: false, message: '时间轴项目不存在' }
  }

  /**
   * 更新时间轴项目位置（带日志）
   * @param itemId 时间轴项目ID
   * @param position 新位置
   */
  function updateTimelineItemPosition(itemId: string, position: { timelineStartTime: number; timelineEndTime: number }) {
    const item = unifiedTimelineModule.getTimelineItem(itemId)
    if (item) {
      const result = unifiedTimelineModule.updateTimelineItemPosition(itemId, position)
      if (result.success) {
        console.log('📍 [UnifiedStore] 更新时间轴项目位置:', item.config.name)
      }
      return result
    }
    return { success: false, message: '时间轴项目不存在' }
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
    unifiedProjectModule.clearCurrentProject()
    unifiedTrackModule.resetTracksToDefaults()
    unifiedTimelineModule.clearAllTimelineItems()
    configModule.resetToDefaults()
    playbackModule.resetToDefaults()
    webavModule.resetToDefaults()
    console.log('🔄 [UnifiedStore] 重置所有模块到默认状态')
  }

  // ==================== 导出接口 ====================

  return {
    // ==================== 统一项目模块状态和方法 ====================

    // 项目状态
    currentProject: unifiedProjectModule.currentProject,
    currentProjectId: unifiedProjectModule.currentProjectId,
    currentProjectName: unifiedProjectModule.currentProjectName,
    projectStatus: unifiedProjectModule.projectStatus,
    hasCurrentProject: unifiedProjectModule.hasCurrentProject,
    isSaving: unifiedProjectModule.isSaving,
    isLoading: unifiedProjectModule.isLoading,
    lastSaved: unifiedProjectModule.lastSaved,
    unifiedMediaReferences: unifiedProjectModule.unifiedMediaReferences,

    // 项目加载进度状态
    loadingProgress: unifiedProjectModule.loadingProgress,
    loadingStage: unifiedProjectModule.loadingStage,
    loadingDetails: unifiedProjectModule.loadingDetails,
    showLoadingProgress: unifiedProjectModule.showLoadingProgress,
    isProjectSettingsReady: unifiedProjectModule.isProjectSettingsReady,
    isProjectContentReady: unifiedProjectModule.isProjectContentReady,

    // 项目管理方法
    createProject,
    saveCurrentProject,
    preloadProjectSettings,
    loadUnifiedProjectContent,
    clearCurrentProject,
    getUnifiedProjectSummary: unifiedProjectModule.getUnifiedProjectSummary,

    // 统一媒体引用管理方法
    addUnifiedMediaReference: unifiedProjectModule.addUnifiedMediaReference,
    removeUnifiedMediaReference: unifiedProjectModule.removeUnifiedMediaReference,
    getUnifiedMediaReference: unifiedProjectModule.getUnifiedMediaReference,
    cleanupInvalidUnifiedMediaReferences: unifiedProjectModule.cleanupInvalidUnifiedMediaReferences,

    // 统一内容恢复方法
    restoreUnifiedMediaItems: unifiedProjectModule.restoreUnifiedMediaItems,
    restoreUnifiedTracks: unifiedProjectModule.restoreUnifiedTracks,
    restoreUnifiedTimelineItems: unifiedProjectModule.restoreUnifiedTimelineItems,

    // 项目加载进度方法
    updateLoadingProgress: unifiedProjectModule.updateLoadingProgress,
    resetLoadingState: unifiedProjectModule.resetLoadingState,

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
    toggleTrackVisibility: unifiedTrackModule.toggleTrackVisibility,
    toggleTrackMute: unifiedTrackModule.toggleTrackMute,
    renameTrack,
    setTrackHeight: unifiedTrackModule.setTrackHeight,
    setTrackStatus: unifiedTrackModule.setTrackStatus,
    reorderTrack: unifiedTrackModule.reorderTrack,

    // 轨道查询方法
    getTrack: unifiedTrackModule.getTrack,
    getTracksByType: unifiedTrackModule.getTracksByType,
    getActiveTracks: unifiedTrackModule.getActiveTracks,
    getTracksSummary: unifiedTrackModule.getTracksSummary,
    isTrackNameExists: unifiedTrackModule.isTrackNameExists,

    // 轨道批量操作方法
    resetTracksToDefaults: unifiedTrackModule.resetTracksToDefaults,
    restoreTracks: unifiedTrackModule.restoreTracks,
    clearAllTracks: unifiedTrackModule.clearAllTracks,

    // 轨道工具函数
    createDefaultTrack: unifiedTrackModule.createDefaultTrack,
    generateTrackName: unifiedTrackModule.generateTrackName,

    // ==================== 统一时间轴模块状态和方法 ====================

    // 时间轴项目状态
    timelineItems: unifiedTimelineModule.timelineItems,

    // 时间轴项目管理方法
    addTimelineItem,
    removeTimelineItem,
    getTimelineItem: unifiedTimelineModule.getTimelineItem,
    updateTimelineItemPosition,
    updateTimelineItemTransform: unifiedTimelineModule.updateTimelineItemTransform,
    updateTimelineItemStatus: unifiedTimelineModule.updateTimelineItemStatus,

    // 时间轴查询方法
    getTimelineItemsByTrack: unifiedTimelineModule.getTimelineItemsByTrack,
    getTimelineItemsByMediaType: unifiedTimelineModule.getTimelineItemsByMediaType,
    getTimelineItemsByStatus: unifiedTimelineModule.getTimelineItemsByStatus,
    getTimelineItemsInRange: unifiedTimelineModule.getTimelineItemsInRange,
    isTimelineItemOverlapping: unifiedTimelineModule.isTimelineItemOverlapping,
    getTotalDuration: unifiedTimelineModule.getTotalDuration,
    getTimelineStats: unifiedTimelineModule.getTimelineStats,

    // 时间轴批量操作方法
    addTimelineItems: unifiedTimelineModule.addTimelineItems,
    removeTimelineItems: unifiedTimelineModule.removeTimelineItems,
    clearAllTimelineItems: unifiedTimelineModule.clearAllTimelineItems,
    restoreTimelineItems: unifiedTimelineModule.restoreTimelineItems,
    sortTimelineItemsByTrack: unifiedTimelineModule.sortTimelineItemsByTrack,

    // 时间轴工具函数
    validateTimelineItem: unifiedTimelineModule.validateTimelineItem,
    findAvailableTrack: unifiedTimelineModule.findAvailableTrack,

    // ==================== 播放控制模块状态和方法 ====================

    // 播放控制状态
    currentFrame: playbackModule.currentFrame,
    isPlaying: playbackModule.isPlaying,
    playbackRate: playbackModule.playbackRate,

    // 计算属性
    formattedCurrentTime: playbackModule.formattedCurrentTime,
    playbackRateText: playbackModule.playbackRateText,

    // 帧数控制方法
    setCurrentFrame: playbackModule.setCurrentFrame,
    seekToFrame: playbackModule.seekToFrame,
    seekByFrames: playbackModule.seekByFrames,
    nextFrame: playbackModule.nextFrame,
    previousFrame: playbackModule.previousFrame,

    // 播放控制方法
    setPlaying: playbackModule.setPlaying,
    play: playbackModule.play,
    pause: playbackModule.pause,
    togglePlayPause: playbackModule.togglePlayPause,
    stop: playbackModule.stop,
    setPlaybackRate: playbackModule.setPlaybackRate,
    resetPlaybackRate: playbackModule.resetPlaybackRate,
    getPlaybackSummary: playbackModule.getPlaybackSummary,
    resetPlaybackToDefaults: playbackModule.resetToDefaults,

    // ==================== 配置模块状态和方法 ====================

    // 配置状态
    videoResolution: configModule.videoResolution,
    frameRate: configModule.frameRate,
    timelineDurationFrames: configModule.timelineDurationFrames,
    proportionalScale: configModule.proportionalScale,

    // 配置管理方法
    setVideoResolution: configModule.setVideoResolution,
    setFrameRate: configModule.setFrameRate,
    setTimelineDurationFrames: configModule.setTimelineDurationFrames,
    setProportionalScale: configModule.setProportionalScale,
    getConfigSummary: configModule.getConfigSummary,
    resetConfigToDefaults: configModule.resetToDefaults,
    restoreFromProjectSettings: configModule.restoreFromProjectSettings,

    // ==================== WebAV模块状态和方法 ====================

    // WebAV状态
    avCanvas: webavModule.avCanvas,
    isWebAVReady: webavModule.isWebAVReady,
    webAVError: webavModule.webAVError,

    // WebAV管理方法
    setAVCanvas: webavModule.setAVCanvas,
    setWebAVReady: webavModule.setWebAVReady,
    setWebAVError: webavModule.setWebAVError,
    clearWebAVState: webavModule.clearWebAVState,
    getWebAVSummary: webavModule.getWebAVSummary,
    resetWebAVToDefaults: webavModule.resetToDefaults,
    addSpriteToCanvas: webavModule.addSprite,
    removeSpriteFromCanvas: webavModule.removeSprite,

    // WebAV画布容器管理
    createCanvasContainer: webavModule.createCanvasContainer,
    initializeCanvas: webavModule.initializeCanvas,
    getAVCanvas: webavModule.getAVCanvas,
    getCanvasContainer: webavModule.getCanvasContainer,

    // WebAV播放控制
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

    // WebAV实例管理
    destroyWebAV: webavModule.destroy,
    isWebAVReadyGlobal: webavModule.isWebAVReadyGlobal,
    waitForWebAVReady: webavModule.waitForWebAVReady,

    // WebAV画布销毁和重建
    destroyCanvas: webavModule.destroyCanvas,
    recreateCanvas: webavModule.recreateCanvas,

    // ==================== 计算属性 ====================

    // 项目相关计算属性
    projectStats,
    isProjectSaving,
    isProjectLoading,

    // 媒体相关计算属性
    mediaStats,
    readyMediaCount,
    hasProcessingMedia,
    hasErrorMedia,

    // WebAV相关计算属性
    isWebAVAvailable,

    // 轨道相关计算属性
    trackStats,
    activeTrackCount,

    // 时间轴相关计算属性
    timelineStats,
    totalTimelineDuration,
    contentEndTimeFrames,
    totalDurationFrames,

    // ==================== 系统状态方法 ====================

    resetToDefaults,  // 保留封装，因为需要重置所有模块
  }
})
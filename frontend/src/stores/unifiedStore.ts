import { defineStore } from 'pinia'
import { computed } from 'vue'
import { createUnifiedMediaModule } from './modules/UnifiedMediaModule'
import { createConfigModule } from './modules/configModule'
import { createPlaybackModule } from './modules/playbackModule'
import { createWebAVModule } from './modules/webavModule'
import type { UnifiedMediaItemData, MediaType } from '@/unified'

/**
 * 统一视频编辑器存储
 * 基于新的统一类型系统重构的主要状态管理
 *
 * 架构特点：
 * 1. 使用 UnifiedMediaModule 管理统一媒体项目
 * 2. 保持模块化设计，各模块职责清晰
 * 3. 兼容现有的配置、播放控制和WebAV集成
 * 4. 为未来的时间轴和轨道管理预留接口
 */
export const useUnifiedStore = defineStore('unified', () => {
  // ==================== 核心模块初始化 ====================

  // 创建统一媒体管理模块（替代原有的mediaModule）
  const unifiedMediaModule = createUnifiedMediaModule()

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
    configModule.resetToDefaults()
    playbackModule.resetToDefaults()
    webavModule.resetToDefaults()
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

    mediaStats,
    readyMediaCount,
    hasProcessingMedia,
    hasErrorMedia,
    isWebAVAvailable,

    // ==================== 系统状态方法 ====================

    resetToDefaults,  // 保留封装，因为需要重置所有模块
  }
})
import { computed } from 'vue'
import { defineStore } from 'pinia'
import { createUnifiedMediaModule } from './modules/UnifiedMediaModule'
import { createConfigModule } from '../../stores/modules/configModule'
import { createPlaybackModule } from '../../stores/modules/playbackModule'
import { createWebAVModule } from '../../stores/modules/webavModule'
import { UnifiedMediaItem } from '../UnifiedMediaItem'
import type { VideoResolution } from '../../types'

/**
 * 统一视频编辑器Store
 *
 * 基于统一异步源架构的新一代Store，整合了：
 * - UnifiedMediaModule: 统一媒体项目管理
 * - ConfigModule: 项目配置管理
 * - PlaybackModule: 播放控制管理
 * - WebAVModule: WebAV集成管理
 *
 * 设计理念：
 * - 渐进式重构：逐步替换原有的videoStore
 * - 模块化架构：每个模块专注单一职责
 * - 统一异步源：所有媒体都走统一的异步处理流程
 * - 类型安全：完整的TypeScript支持
 */
export const useUnifiedStore = defineStore('unified', () => {

  // ==================== 核心模块创建 ====================

  /**
   * 统一媒体管理模块
   * 负责管理所有类型的媒体项目（本地、远程、工程文件等）
   */
  const mediaModule = createUnifiedMediaModule()

  /**
   * 项目配置管理模块
   * 负责管理项目级别的配置和设置
   */
  const configModule = createConfigModule()

  /**
   * 播放控制管理模块
   * 负责管理播放状态和时间控制
   */
  const playbackModule = createPlaybackModule(configModule.frameRate)

  /**
   * WebAV集成管理模块
   * 负责管理WebAV相关的状态和方法
   */
  const webavModule = createWebAVModule()

  // ==================== 计算属性 ====================

  /**
   * 媒体项目统计信息
   */
  const mediaStats = computed(() => {
    return mediaModule.getMediaItemsStats()
  })

  /**
   * 按类型分组的媒体统计
   */
  const mediaStatsByType = computed(() => {
    return mediaModule.getMediaItemsStatsByType()
  })

  /**
   * 按数据源分组的媒体统计
   */
  const mediaStatsBySource = computed(() => {
    return mediaModule.getMediaItemsStatsBySource()
  })

  /**
   * 是否有正在处理的媒体项目
   */
  const hasProcessingMedia = computed(() => {
    return mediaModule.getProcessingMediaItems().length > 0
  })

  /**
   * 是否有错误状态的媒体项目
   */
  const hasErrorMedia = computed(() => {
    return mediaModule.getErrorMediaItems().length > 0
  })

  /**
   * 当前播放时间的格式化显示
   */
  const formattedCurrentTime = computed(() => {
    return playbackModule.formattedCurrentTime.value
  })

  /**
   * 播放速度的显示文本
   */
  const playbackRateText = computed(() => {
    return playbackModule.playbackRateText.value
  })

  // ==================== 媒体管理方法 ====================

  /**
   * 添加统一媒体项目
   * @param mediaItem 统一媒体项目
   */
  function addMediaItem(mediaItem: UnifiedMediaItem) {
    mediaModule.addUnifiedMediaItem(mediaItem)
    console.log('🎬 [UnifiedStore] 添加媒体项目:', mediaItem.name)
  }

  /**
   * 删除媒体项目
   * @param mediaItemId 媒体项目ID
   */
  function removeMediaItem(mediaItemId: string) {
    const mediaItem = mediaModule.getUnifiedMediaItem(mediaItemId)
    if (mediaItem) {
      mediaModule.removeUnifiedMediaItem(mediaItemId)
      console.log('🗑️ [UnifiedStore] 删除媒体项目:', mediaItem.name)
    }
  }

  /**
   * 批量添加媒体项目
   * @param mediaItems 媒体项目数组
   */
  function addMediaItemsBatch(mediaItems: UnifiedMediaItem[]) {
    mediaModule.addUnifiedMediaItemsBatch(mediaItems)
    console.log('📦 [UnifiedStore] 批量添加媒体项目:', mediaItems.length)
  }

  /**
   * 清理所有媒体项目
   */
  function clearAllMedia() {
    mediaModule.clearAllUnifiedMediaItems()
    console.log('🧹 [UnifiedStore] 清理所有媒体项目')
  }

  /**
   * 重试错误的媒体项目
   * @param mediaItemId 媒体项目ID（可选，不传则重试所有错误项目）
   */
  function retryMedia(mediaItemId?: string) {
    if (mediaItemId) {
      const success = mediaModule.retryUnifiedMediaItem(mediaItemId)
      if (success) {
        console.log('🔄 [UnifiedStore] 重试媒体项目:', mediaItemId)
      }
    } else {
      const retryCount = mediaModule.retryAllErrorMediaItems()
      console.log('🔄 [UnifiedStore] 批量重试错误媒体项目:', retryCount)
    }
  }

  /**
   * 取消处理中的媒体项目
   * @param mediaItemId 媒体项目ID（可选，不传则取消所有处理中项目）
   */
  function cancelMedia(mediaItemId?: string) {
    if (mediaItemId) {
      const success = mediaModule.cancelUnifiedMediaItem(mediaItemId)
      if (success) {
        console.log('❌ [UnifiedStore] 取消媒体项目:', mediaItemId)
      }
    } else {
      const cancelCount = mediaModule.cancelAllProcessingMediaItems()
      console.log('❌ [UnifiedStore] 批量取消处理中媒体项目:', cancelCount)
    }
  }

  // ==================== 播放控制方法（直接从videoStore复制） ====================

  // 播放控制方法
  const setCurrentFrame = playbackModule.setCurrentFrame
  const seekToFrame = playbackModule.seekToFrame
  const seekByFrames = playbackModule.seekByFrames
  const setPlaybackRate = playbackModule.setPlaybackRate
  const nextFrame = playbackModule.nextFrame
  const previousFrame = playbackModule.previousFrame
  const setPlaying = playbackModule.setPlaying
  const play = playbackModule.play
  const pause = playbackModule.pause
  const togglePlayPause = playbackModule.togglePlayPause
  const stop = playbackModule.stop
  const resetPlaybackRate = playbackModule.resetPlaybackRate
  const getPlaybackSummary = playbackModule.getPlaybackSummary
  const resetPlaybackToDefaults = playbackModule.resetToDefaults

  // ==================== 配置管理方法（直接从videoStore复制） ====================

  // 分辨率相关
  const videoResolution = configModule.videoResolution
  const setVideoResolution = configModule.setVideoResolution

  // 配置管理
  const setTimelineDurationFrames = configModule.setTimelineDurationFrames
  const setFrameRate = configModule.setFrameRate
  const setProportionalScale = configModule.setProportionalScale
  const getConfigSummary = configModule.getConfigSummary
  const resetConfigToDefaults = configModule.resetToDefaults
  const restoreFromProjectSettings = configModule.restoreFromProjectSettings

  // ==================== WebAV集成方法（直接从videoStore复制） ====================

  // WebAV 相关状态和方法
  const avCanvas = webavModule.avCanvas
  const isWebAVReady = webavModule.isWebAVReady
  const webAVError = webavModule.webAVError
  const setAVCanvas = webavModule.setAVCanvas
  const setWebAVReady = webavModule.setWebAVReady
  const setWebAVError = webavModule.setWebAVError
  const clearWebAVState = webavModule.clearWebAVState
  const isWebAVAvailable = webavModule.isWebAVAvailable
  const getWebAVSummary = webavModule.getWebAVSummary
  const resetWebAVToDefaults = webavModule.resetToDefaults
  const addSpriteToCanvas = webavModule.addSprite
  const removeSpriteFromCanvas = webavModule.removeSprite

  // WebAV 画布容器管理
  const createCanvasContainer = webavModule.createCanvasContainer
  const initializeCanvas = webavModule.initializeCanvas
  const getAVCanvas = webavModule.getAVCanvas
  const getCanvasContainer = webavModule.getCanvasContainer

  // WebAV 播放控制
  const webAVPlay = webavModule.play
  const webAVPause = webavModule.pause
  const webAVSeekTo = webavModule.seekTo

  // WebAV Clip创建和管理
  const createMP4Clip = webavModule.createMP4Clip
  const createImgClip = webavModule.createImgClip
  const createAudioClip = webavModule.createAudioClip
  const cloneMP4Clip = webavModule.cloneMP4Clip
  const cloneImgClip = webavModule.cloneImgClip
  const cloneAudioClip = webavModule.cloneAudioClip

  // WebAV 实例管理
  const destroyWebAV = webavModule.destroy
  const isWebAVReadyGlobal = webavModule.isWebAVReadyGlobal
  const waitForWebAVReady = webavModule.waitForWebAVReady

  // WebAV 画布销毁和重建
  const destroyCanvas = webavModule.destroyCanvas
  const recreateCanvas = webavModule.recreateCanvas

  // ==================== 调试和工具方法 ====================

  /**
   * 打印调试信息
   * @param title 调试标题
   */
  function printDebugInfo(title: string = '当前状态') {
    console.group(`🔍 [UnifiedStore] ${title}`)

    // 媒体统计
    console.log('📊 媒体统计:', mediaStats.value)
    console.log('📁 按类型统计:', mediaStatsByType.value)
    console.log('🔗 按数据源统计:', mediaStatsBySource.value)

    // 播放状态
    console.log('▶️ 播放状态:', {
      isPlaying: playbackModule.isPlaying.value,
      currentFrame: playbackModule.currentFrame.value,
      playbackRate: playbackModule.playbackRate.value,
      formattedTime: formattedCurrentTime.value
    })

    // 配置信息
    console.log('⚙️ 配置信息:', {
      videoResolution: configModule.videoResolution.value,
      frameRate: configModule.frameRate.value,
      timelineDuration: configModule.timelineDurationFrames.value
    })

    // WebAV状态
    console.log('🎨 WebAV状态:', {
      isWebAVReady: webavModule.isWebAVReady.value,
      hasCanvas: !!webavModule.avCanvas.value,
      webAVError: webavModule.webAVError.value
    })

    console.groupEnd()
  }

  // ==================== 导出接口 ====================

  return {
    // 模块实例
    mediaModule,
    configModule,
    playbackModule,
    webavModule,

    // 计算属性
    mediaStats,
    mediaStatsByType,
    mediaStatsBySource,
    hasProcessingMedia,
    hasErrorMedia,
    formattedCurrentTime,
    playbackRateText,

    // 媒体管理方法
    addMediaItem,
    removeMediaItem,
    addMediaItemsBatch,
    clearAllMedia,
    retryMedia,
    cancelMedia,

    // 播放控制方法（从videoStore复制）
    setCurrentFrame,
    seekToFrame,
    seekByFrames,
    setPlaybackRate,
    nextFrame,
    previousFrame,
    setPlaying,
    play,
    pause,
    togglePlayPause,
    stop,
    resetPlaybackRate,
    getPlaybackSummary,
    resetPlaybackToDefaults,

    // 配置管理方法（从videoStore复制）
    videoResolution,
    setVideoResolution,
    setTimelineDurationFrames,
    setFrameRate,
    setProportionalScale,
    getConfigSummary,
    resetConfigToDefaults,
    restoreFromProjectSettings,

    // WebAV集成方法（从videoStore复制）
    avCanvas,
    isWebAVReady,
    webAVError,
    setAVCanvas,
    setWebAVReady,
    setWebAVError,
    clearWebAVState,
    isWebAVAvailable,
    getWebAVSummary,
    resetWebAVToDefaults,
    addSpriteToCanvas,
    removeSpriteFromCanvas,
    createCanvasContainer,
    initializeCanvas,
    getAVCanvas,
    getCanvasContainer,
    webAVPlay,
    webAVPause,
    webAVSeekTo,
    createMP4Clip,
    createImgClip,
    createAudioClip,
    cloneMP4Clip,
    cloneImgClip,
    cloneAudioClip,
    destroyWebAV,
    isWebAVReadyGlobal,
    waitForWebAVReady,
    destroyCanvas,
    recreateCanvas,

    // 调试和工具方法
    printDebugInfo,
  }
})

// 导出类型定义
export type UnifiedStore = ReturnType<typeof useUnifiedStore>
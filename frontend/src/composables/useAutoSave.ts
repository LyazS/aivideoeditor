import { ref, watch, onUnmounted } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import type { AutoSaveConfig, AutoSaveState } from '../types'

/**
 * 自动保存 Composable
 * 提供防抖+节流的自动保存策略
 */
export function useAutoSave(config: Partial<AutoSaveConfig> = {}) {
  const videoStore = useVideoStore()

  // 默认配置
  const defaultConfig: AutoSaveConfig = {
    debounceTime: 2000, // 2秒防抖
    throttleTime: 30000, // 30秒强制保存
    maxRetries: 3,
    enabled: true
  }

  const finalConfig = { ...defaultConfig, ...config }

  // 自动保存状态
  const autoSaveState = ref<AutoSaveState>({
    isEnabled: finalConfig.enabled,
    lastSaveTime: null,
    saveCount: 0,
    errorCount: 0,
    isDirty: false
  })

  // 定时器引用
  let debounceTimer: number | null = null
  let throttleTimer: number | null = null
  let retryCount = 0

  /**
   * 清除所有定时器
   */
  function clearTimers() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (throttleTimer) {
      clearTimeout(throttleTimer)
      throttleTimer = null
    }
  }

  /**
   * 执行保存操作
   */
  async function performSave(): Promise<boolean> {
    if (!videoStore.hasCurrentProject) {
      console.log('🔄 [AutoSave] 没有当前项目，跳过自动保存')
      return false
    }

    if (videoStore.isSaving) {
      console.log('🔄 [AutoSave] 正在保存中，跳过此次自动保存')
      return false
    }

    try {
      console.log('💾 [AutoSave] 开始自动保存...')

      // 清理媒体引用：只保留当前存在的媒体项目的引用
      const currentMediaIds = new Set(videoStore.mediaItems.map(item => item.id))
      const cleanedMediaReferences: Record<string, any> = {}

      // 获取当前的媒体引用
      const currentReferences = videoStore.getMediaReferences()
      for (const [mediaId, reference] of Object.entries(currentReferences)) {
        if (currentMediaIds.has(mediaId)) {
          cleanedMediaReferences[mediaId] = reference
        } else {
          console.log(`🧹 [MEDIA-CLEANUP] [AutoSave] 跳过无效媒体引用: ${mediaId}`)
        }
      }

      // 构建项目数据
      const projectData = {
        timeline: {
          tracks: videoStore.tracks,
          timelineItems: videoStore.timelineItems.map(item => ({
            id: item.id,
            mediaItemId: item.mediaItemId,
            trackId: item.trackId,
            mediaType: item.mediaType,
            timeRange: item.timeRange,
            config: item.config,
            animation: item.animation, // 保存动画配置
            // 注意：不保存 thumbnailUrl，这是运行时生成的blob URL
            // 对于文本类型，使用item.mediaName；对于其他类型，从MediaItem获取
            mediaName: item.mediaType === 'text'
              ? item.mediaName || `文本: ${('text' in item.config) ? item.config.text?.substring(0, 10) || '未知' : '未知'}...`
              : videoStore.getMediaItem(item.mediaItemId)?.name || 'Unknown'
          })),
          mediaItems: videoStore.mediaItems.map(item => ({
            id: item.id,
            name: item.name,
            type: item.type,
            mediaType: item.mediaType,
            duration: item.duration
            // 注意：不保存 isReady, status, thumbnailUrl 等运行时状态
            // 这些状态在重新加载时会重新生成
          }))
        },
        settings: {
          videoResolution: videoStore.videoResolution,
          frameRate: videoStore.frameRate,
          timelineDurationFrames: videoStore.timelineDurationFrames
        },
        // 使用清理后的媒体引用
        mediaReferences: cleanedMediaReferences
      }

      await videoStore.saveCurrentProject(projectData)
      
      // 更新状态
      autoSaveState.value.lastSaveTime = new Date()
      autoSaveState.value.saveCount++
      autoSaveState.value.isDirty = false
      retryCount = 0

      console.log('✅ [AutoSave] 自动保存成功')
      return true
    } catch (error) {
      console.error('❌ [AutoSave] 自动保存失败:', error)
      autoSaveState.value.errorCount++
      
      // 重试机制
      if (retryCount < finalConfig.maxRetries) {
        retryCount++
        console.log(`🔄 [AutoSave] 准备重试 (${retryCount}/${finalConfig.maxRetries})`)
        
        // 延迟重试
        setTimeout(() => {
          performSave()
        }, 5000 * retryCount) // 递增延迟
      } else {
        console.error('❌ [AutoSave] 达到最大重试次数，停止自动保存')
        retryCount = 0
      }
      
      return false
    }
  }

  /**
   * 触发自动保存（防抖+节流）
   */
  function triggerAutoSave() {
    if (!autoSaveState.value.isEnabled) {
      return
    }

    // 标记为有未保存的更改
    autoSaveState.value.isDirty = true

    // 清除之前的防抖定时器
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    // 设置防抖定时器
    debounceTimer = setTimeout(() => {
      performSave()
    }, finalConfig.debounceTime)

    // 如果没有节流定时器，设置一个
    if (!throttleTimer) {
      throttleTimer = setTimeout(() => {
        // 强制保存（节流）
        if (autoSaveState.value.isDirty) {
          console.log('⏰ [AutoSave] 节流触发强制保存')
          performSave()
        }
        throttleTimer = null
      }, finalConfig.throttleTime)
    }
  }

  /**
   * 启用自动保存
   */
  function enableAutoSave() {
    autoSaveState.value.isEnabled = true
    console.log('✅ [AutoSave] 自动保存已启用')
  }

  /**
   * 禁用自动保存
   */
  function disableAutoSave() {
    autoSaveState.value.isEnabled = false
    clearTimers()
    console.log('⏸️ [AutoSave] 自动保存已禁用')
  }

  /**
   * 手动触发保存
   */
  async function manualSave(): Promise<boolean> {
    clearTimers() // 清除自动保存定时器
    return await performSave()
  }

  /**
   * 重置自动保存状态
   */
  function resetAutoSaveState() {
    autoSaveState.value = {
      isEnabled: finalConfig.enabled,
      lastSaveTime: null,
      saveCount: 0,
      errorCount: 0,
      isDirty: false
    }
    retryCount = 0
    clearTimers()
  }

  // 监听关键状态变化
  if (finalConfig.enabled) {
    // 监听时间轴项目变化
    watch(
      () => videoStore.timelineItems,
      () => {
        console.log('🔄 [AutoSave] 检测到时间轴项目变化')
        triggerAutoSave()
      },
      { deep: true }
    )

    // 监听轨道变化
    watch(
      () => videoStore.tracks,
      () => {
        console.log('🔄 [AutoSave] 检测到轨道变化')
        triggerAutoSave()
      },
      { deep: true }
    )

    // 监听媒体项目变化
    watch(
      () => videoStore.mediaItems,
      () => {
        console.log('🔄 [AutoSave] 检测到媒体项目变化')
        triggerAutoSave()
      },
      { deep: true }
    )

    // 监听项目配置变化
    watch(
      () => ({
        videoResolution: videoStore.videoResolution,
        frameRate: videoStore.frameRate,
        timelineDurationFrames: videoStore.timelineDurationFrames
      }),
      () => {
        console.log('🔄 [AutoSave] 检测到项目配置变化')
        triggerAutoSave()
      },
      { deep: true }
    )
  }

  // 清理函数
  onUnmounted(() => {
    clearTimers()
  })

  return {
    // 状态
    autoSaveState,
    
    // 方法
    enableAutoSave,
    disableAutoSave,
    manualSave,
    triggerAutoSave,
    resetAutoSaveState,
    
    // 配置
    config: finalConfig
  }
}

import { ref, watch, type Ref } from 'vue'
import { debounce, throttle } from 'lodash'
import { globalProjectMediaManager } from '@/unified/utils/ProjectMediaManager'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem'
import type { UnifiedTrackData } from '@/unified/track'
import type { UnifiedMediaItemData } from '@/unified/mediaitem'

/**
 * 视频分辨率类型定义 (来自 UnifiedProjectConfig)
 */
interface VideoResolution {
  name: string
  width: number
  height: number
  aspectRatio: string
}

/**
 * 自动保存配置
 */
interface AutoSaveConfig {
  debounceTime: number // 防抖时间（毫秒）
  throttleTime: number // 节流时间（毫秒）
  maxRetries: number // 最大重试次数
  enabled: boolean // 是否启用自动保存
}

/**
 * 自动保存状态
 */
interface AutoSaveState {
  isEnabled: boolean
  lastSaveTime: Date | null
  saveCount: number
  errorCount: number
  isDirty: boolean // 是否有未保存的更改
}

/**
 * 自动保存模块依赖接口
 */
interface AutoSaveDependencies {
  /** 项目模块 */
  projectModule: {
    saveCurrentProject: (options?: {
      configChanged?: boolean
      contentChanged?: boolean
    }) => Promise<void>
    isSaving: Ref<boolean>
  }
  /** 需要监听的数据源 */
  dataWatchers: {
    timelineItems: Ref<UnifiedTimelineItemData[]>
    tracks: Ref<UnifiedTrackData[]>
    mediaItems: Ref<UnifiedMediaItemData[]>
    projectConfig: Ref<{
      videoResolution: VideoResolution
      frameRate: number
      timelineDurationFrames: number
    }>
  }
}

/**
 * 统一自动保存模块
 * 提供防抖+节流的自动保存策略，适配新架构的模块化设计
 */
export function createUnifiedAutoSaveModule(
  dependencies: AutoSaveDependencies,
  config: Partial<AutoSaveConfig> = {},
) {
  const { projectModule, dataWatchers } = dependencies

  // ==================== 配置管理 ====================

  // 默认配置
  const defaultConfig: AutoSaveConfig = {
    debounceTime: 2000, // 2秒防抖
    throttleTime: 30000, // 30秒强制保存
    maxRetries: 3,
    enabled: true,
  }

  const finalConfig = { ...defaultConfig, ...config }

  // ==================== 状态管理 ====================

  // 自动保存状态
  const autoSaveState = ref<AutoSaveState>({
    isEnabled: finalConfig.enabled,
    lastSaveTime: null,
    saveCount: 0,
    errorCount: 0,
    isDirty: false,
  })

  // lodash 节流防抖函数引用
  let debouncedSave: ReturnType<typeof debounce> | null = null
  let throttledSave: ReturnType<typeof throttle> | null = null
  let retryCount = 0

  // 监听器清理函数数组
  const unwatchFunctions: (() => void)[] = []

  // ==================== 内部方法 ====================

  /**
   * 初始化节流防抖函数
   */
  function initializeDebounceThrottle() {
    // 清除现有的函数
    clearTimers()

    // 创建新的防抖函数
    debouncedSave = debounce(
      (saveOptions?: { configChanged?: boolean; contentChanged?: boolean }) => {
        performSave(saveOptions)
      },
      finalConfig.debounceTime,
    )

    // 创建新的节流函数
    throttledSave = throttle(
      (saveOptions?: { configChanged?: boolean; contentChanged?: boolean }) => {
        if (autoSaveState.value.isDirty) {
          console.log('⏰ [AutoSave] 节流触发强制保存')
          performSave(saveOptions)
        }
      },
      finalConfig.throttleTime,
      { leading: false, trailing: true },
    )
  }

  /**
   * 清除所有定时器
   */
  function clearTimers() {
    debouncedSave?.cancel()
    throttledSave?.cancel()
    debouncedSave = null
    throttledSave = null
  }

  /**
   * 执行保存操作
   * @param options 保存选项，用于区分保存配置还是内容
   */
  async function performSave(options?: {
    configChanged?: boolean
    contentChanged?: boolean
  }): Promise<boolean> {
    if (projectModule.isSaving.value) {
      console.log('🔄 [AutoSave] 正在保存中，跳过此次自动保存')
      return false
    }

    try {
      console.log('💾 [AutoSave] 开始自动保存...', options)

      await projectModule.saveCurrentProject(options)

      // 更新状态
      autoSaveState.value.lastSaveTime = new Date()
      autoSaveState.value.saveCount++
      autoSaveState.value.isDirty = false
      retryCount = 0

      console.log('✅ [AutoSave] 自动保存成功')

      // 后台自动清理未使用的媒体文件（静默执行，不影响用户体验）
      globalProjectMediaManager.cleanupUnusedMediaFiles()

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
          performSave(options)
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
   * @param options 保存选项，用于区分保存配置还是内容
   */
  function triggerAutoSave(options?: { configChanged?: boolean; contentChanged?: boolean }) {
    if (!autoSaveState.value.isEnabled) {
      return
    }

    // 标记为有未保存的更改
    autoSaveState.value.isDirty = true

    // 使用防抖函数（传递 options 参数）
    debouncedSave?.(options)

    // 使用节流函数（传递 options 参数）
    throttledSave?.(options)
  }

  // ==================== 公共方法 ====================

  /**
   * 启用自动保存
   */
  function enableAutoSave() {
    autoSaveState.value.isEnabled = true
    initializeDebounceThrottle() // 重新初始化节流防抖函数
    setupWatchers() // 重新设置监听器
    console.log('✅ [AutoSave] 自动保存已启用')
  }

  /**
   * 禁用自动保存
   */
  function disableAutoSave() {
    autoSaveState.value.isEnabled = false
    clearTimers()
    clearWatchers() // 清除监听器
    console.log('⏸️ [AutoSave] 自动保存已禁用')
  }

  /**
   * 手动触发保存
   */
  async function manualSave(): Promise<boolean> {
    clearTimers() // 清除自动保存定时器
    return await performSave({
      configChanged: true,
      contentChanged: true,
    })
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
      isDirty: false,
    }
    retryCount = 0
    clearTimers()
  }

  /**
   * 销毁模块，清理所有资源
   */
  function destroy() {
    clearTimers()
    clearWatchers()
    console.log('🧹 [AutoSave] 模块已销毁')
  }

  // ==================== 数据监听设置 ====================

  /**
   * 设置数据监听器
   */
  function setupWatchers() {
    if (!finalConfig.enabled || !autoSaveState.value.isEnabled) {
      return
    }

    // 清除现有监听器
    clearWatchers()

    // 监听时间轴项目变化 - 内容变化
    const unwatchTimelineItems = watch(
      () => dataWatchers.timelineItems.value,
      () => {
        if (autoSaveState.value.isEnabled) {
          console.log('🔄 [AutoSave] 检测到时间轴项目变化')
          triggerAutoSave({ configChanged: true, contentChanged: true })
        }
      },
      { deep: true },
    )
    unwatchFunctions.push(unwatchTimelineItems)

    // 监听轨道变化 - 内容变化
    const unwatchTracks = watch(
      () => dataWatchers.tracks.value,
      () => {
        if (autoSaveState.value.isEnabled) {
          console.log('🔄 [AutoSave] 检测到轨道变化')
          triggerAutoSave({ contentChanged: true })
        }
      },
      { deep: true },
    )
    unwatchFunctions.push(unwatchTracks)

    // 监听媒体项目变化 - 内容变化
    const unwatchMediaItems = watch(
      () => dataWatchers.mediaItems.value,
      () => {
        if (autoSaveState.value.isEnabled) {
          console.log('🔄 [AutoSave] 检测到媒体项目变化')
          triggerAutoSave({ contentChanged: true })
        }
      },
      { deep: true },
    )
    unwatchFunctions.push(unwatchMediaItems)

    // 监听项目配置变化 - 配置变化
    const unwatchProjectConfig = watch(
      () => dataWatchers.projectConfig.value,
      () => {
        if (autoSaveState.value.isEnabled) {
          console.log('🔄 [AutoSave] 检测到项目配置变化')
          triggerAutoSave({ configChanged: true })
        }
      },
      { deep: true },
    )
    unwatchFunctions.push(unwatchProjectConfig)
  }

  /**
   * 清除所有监听器
   */
  function clearWatchers() {
    unwatchFunctions.forEach((unwatch) => unwatch())
    unwatchFunctions.length = 0
  }

  // ==================== 初始化 ====================

  // 初始化节流防抖函数
  initializeDebounceThrottle()

  // 只有在启用状态下才设置监听器
  if (finalConfig.enabled && autoSaveState.value.isEnabled) {
    setupWatchers()
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    autoSaveState,

    // 配置
    config: finalConfig,

    // 方法
    enableAutoSave,
    disableAutoSave,
    manualSave,
    triggerAutoSave,
    resetAutoSaveState,
    destroy,
  }
}

// 导出类型定义
export type UnifiedAutoSaveModule = ReturnType<typeof createUnifiedAutoSaveModule>

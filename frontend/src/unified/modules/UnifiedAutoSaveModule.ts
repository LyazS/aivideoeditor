import { ref, watch, type Ref } from 'vue'
import type { AutoSaveConfig, AutoSaveState } from '@/types'

/**
 * 自动保存模块依赖接口
 */
interface AutoSaveDependencies {
  /** 项目模块 */
  projectModule: {
    saveCurrentProject: () => Promise<void>
    isSaving: Ref<boolean>
  }
  /** 需要监听的数据源 */
  dataWatchers: {
    timelineItems: Ref<any[]>
    tracks: Ref<any[]>
    mediaItems: Ref<any[]>
    projectConfig: Ref<{
      videoResolution: any
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
  config: Partial<AutoSaveConfig> = {}
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

  // 定时器引用
  let debounceTimer: number | null = null
  let throttleTimer: number | null = null
  let retryCount = 0

  // 监听器清理函数数组
  const unwatchFunctions: (() => void)[] = []

  // ==================== 内部方法 ====================

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
    if (projectModule.isSaving.value) {
      console.log('🔄 [AutoSave] 正在保存中，跳过此次自动保存')
      return false
    }

    try {
      console.log('💾 [AutoSave] 开始自动保存...')

      await projectModule.saveCurrentProject()

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

  // ==================== 公共方法 ====================

  /**
   * 启用自动保存
   */
  function enableAutoSave() {
    autoSaveState.value.isEnabled = true
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

    // 监听时间轴项目变化
    const unwatchTimelineItems = watch(
      () => dataWatchers.timelineItems.value,
      () => {
        console.log('🔄 [AutoSave] 检测到时间轴项目变化')
        triggerAutoSave()
      },
      { deep: true }
    )
    unwatchFunctions.push(unwatchTimelineItems)

    // 监听轨道变化
    const unwatchTracks = watch(
      () => dataWatchers.tracks.value,
      () => {
        console.log('🔄 [AutoSave] 检测到轨道变化')
        triggerAutoSave()
      },
      { deep: true }
    )
    unwatchFunctions.push(unwatchTracks)

    // 监听媒体项目变化
    const unwatchMediaItems = watch(
      () => dataWatchers.mediaItems.value,
      () => {
        console.log('🔄 [AutoSave] 检测到媒体项目变化')
        triggerAutoSave()
      },
      { deep: true }
    )
    unwatchFunctions.push(unwatchMediaItems)

    // 监听项目配置变化
    const unwatchProjectConfig = watch(
      () => dataWatchers.projectConfig.value,
      () => {
        console.log('🔄 [AutoSave] 检测到项目配置变化')
        triggerAutoSave()
      },
      { deep: true }
    )
    unwatchFunctions.push(unwatchProjectConfig)
  }

  /**
   * 清除所有监听器
   */
  function clearWatchers() {
    unwatchFunctions.forEach(unwatch => unwatch())
    unwatchFunctions.length = 0
  }

  // ==================== 初始化 ====================

  // 初始化监听器
  setupWatchers()

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
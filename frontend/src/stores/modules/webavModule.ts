import { ref, markRaw } from 'vue'
import { AVCanvas } from '@webav/av-canvas'

/**
 * WebAV集成管理模块
 * 负责管理WebAV相关的状态和方法
 */
export function createWebAVModule() {
  // ==================== 状态定义 ====================

  // WebAV核心对象 - 使用markRaw避免Vue响应式包装
  const avCanvas = ref<AVCanvas | null>(null)
  const isWebAVReady = ref(false)
  const webAVError = ref<string | null>(null)

  // ==================== WebAV管理方法 ====================

  /**
   * 设置AVCanvas实例
   * @param canvas AVCanvas实例或null
   */
  function setAVCanvas(canvas: AVCanvas | null) {
    console.log('🏪 [WebAVModule] setAVCanvas:', {
      hasCanvas: !!canvas,
      canvasType: canvas?.constructor.name,
      previousState: !!avCanvas.value,
    })

    avCanvas.value = canvas ? markRaw(canvas) : null

    // 如果设置了新的canvas，自动设置为ready状态
    if (canvas) {
      setWebAVReady(true)
      setWebAVError(null)
    } else {
      setWebAVReady(false)
    }
  }

  /**
   * 设置WebAV就绪状态
   * @param ready 是否就绪
   */
  function setWebAVReady(ready: boolean) {
    console.log('🏪 [WebAVModule] setWebAVReady:', {
      ready,
      previousReady: isWebAVReady.value,
      stateChange: ready !== isWebAVReady.value,
    })

    isWebAVReady.value = ready

    // 如果设置为未就绪，清除错误状态
    if (!ready) {
      setWebAVError(null)
    }
  }

  /**
   * 设置WebAV错误信息
   * @param error 错误信息或null
   */
  function setWebAVError(error: string | null) {
    console.log('🏪 [WebAVModule] setWebAVError:', {
      error,
      hasError: !!error,
      previousError: webAVError.value,
    })

    webAVError.value = error

    // 如果有错误，自动设置为未就绪状态
    if (error) {
      setWebAVReady(false)
    }
  }

  /**
   * 初始化WebAV
   * @param canvasElement HTML Canvas元素
   * @param options 初始化选项
   */
  async function initializeWebAV(
    canvasElement: HTMLCanvasElement,
    options: { width?: number; height?: number } = {},
  ): Promise<boolean> {
    try {
      console.log('🚀 [WebAVModule] 开始初始化WebAV:', options)

      // 清除之前的错误状态
      setWebAVError(null)

      // 创建AVCanvas实例
      const canvas = new AVCanvas(canvasElement, {
        width: options.width || 1920,
        height: options.height || 1080,
        bgColor: '#000000', // 添加必需的背景色参数
      })

      // 设置canvas实例
      setAVCanvas(canvas)

      console.log('✅ [WebAVModule] WebAV初始化成功')
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ [WebAVModule] WebAV初始化失败:', errorMessage)
      setWebAVError(`WebAV初始化失败: ${errorMessage}`)
      return false
    }
  }

  /**
   * 销毁WebAV实例
   */
  function destroyWebAV() {
    try {
      console.log('🗑️ [WebAVModule] 开始销毁WebAV')

      if (avCanvas.value) {
        // 如果AVCanvas有destroy方法，调用它
        if (typeof avCanvas.value.destroy === 'function') {
          avCanvas.value.destroy()
        }
      }

      // 清除状态
      setAVCanvas(null)
      setWebAVReady(false)
      setWebAVError(null)

      console.log('✅ [WebAVModule] WebAV销毁完成')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ [WebAVModule] WebAV销毁失败:', errorMessage)
      setWebAVError(`WebAV销毁失败: ${errorMessage}`)
    }
  }

  /**
   * 重建WebAV画布（用于分辨率变更等场景）
   * @param canvasElement HTML Canvas元素
   * @param options 重建选项
   */
  async function rebuildWebAV(
    canvasElement: HTMLCanvasElement,
    options: { width?: number; height?: number } = {},
  ): Promise<boolean> {
    console.log('🔄 [WebAVModule] 开始重建WebAV画布:', options)

    // 先销毁现有实例
    destroyWebAV()

    // 重新初始化
    return await initializeWebAV(canvasElement, options)
  }

  /**
   * 检查WebAV是否可用
   * @returns 是否可用
   */
  function isWebAVAvailable(): boolean {
    return !!(avCanvas.value && isWebAVReady.value && !webAVError.value)
  }

  /**
   * 获取WebAV状态摘要
   * @returns WebAV状态摘要对象
   */
  function getWebAVSummary() {
    return {
      hasCanvas: !!avCanvas.value,
      isReady: isWebAVReady.value,
      hasError: !!webAVError.value,
      error: webAVError.value,
      isAvailable: isWebAVAvailable(),
      canvasInfo: avCanvas.value
        ? {
            width: (avCanvas.value as any).width || 'unknown',
            height: (avCanvas.value as any).height || 'unknown',
            constructor: avCanvas.value.constructor.name,
          }
        : null,
    }
  }

  /**
   * 重置WebAV状态为默认值
   */
  function resetToDefaults() {
    destroyWebAV()
    console.log('🔄 [WebAVModule] WebAV状态已重置为默认值')
  }

  /**
   * 添加sprite到画布
   * @param sprite 要添加的sprite
   */
  function addSprite(sprite: unknown) {
    if (!isWebAVAvailable()) {
      console.warn('⚠️ [WebAVModule] WebAV不可用，无法添加sprite')
      return false
    }

    try {
      avCanvas.value!.addSprite(sprite as any)
      console.log('✅ [WebAVModule] 添加sprite成功')
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ [WebAVModule] 添加sprite失败:', errorMessage)
      setWebAVError(`添加sprite失败: ${errorMessage}`)
      return false
    }
  }

  /**
   * 从画布移除sprite
   * @param sprite 要移除的sprite
   */
  function removeSprite(sprite: unknown) {
    if (!isWebAVAvailable()) {
      console.warn('⚠️ [WebAVModule] WebAV不可用，无法移除sprite')
      return false
    }

    try {
      avCanvas.value!.removeSprite(sprite as any)
      console.log('✅ [WebAVModule] 移除sprite成功')
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ [WebAVModule] 移除sprite失败:', errorMessage)
      setWebAVError(`移除sprite失败: ${errorMessage}`)
      return false
    }
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    avCanvas,
    isWebAVReady,
    webAVError,

    // 方法
    setAVCanvas,
    setWebAVReady,
    setWebAVError,
    initializeWebAV,
    destroyWebAV,
    rebuildWebAV,
    isWebAVAvailable,
    getWebAVSummary,
    resetToDefaults,
    addSprite,
    removeSprite,
  }
}

// 导出类型定义
export type WebAVModule = ReturnType<typeof createWebAVModule>

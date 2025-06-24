import { ref, markRaw } from 'vue'
import { AVCanvas } from '@webav/av-canvas'
import type { VisibleSprite } from '@webav/av-cliper'
import type { ExtendedAVCanvas } from '../../types/webavTypes'

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
   * 清除WebAV状态（由useWebAVControls调用）
   * 注意：实际的销毁逻辑由useWebAVControls处理
   */
  function clearWebAVState() {
    console.log('🗑️ [WebAVModule] 清除WebAV状态')

    // 只清除状态，不执行实际的销毁逻辑
    setAVCanvas(null)
    setWebAVReady(false)
    setWebAVError(null)

    console.log('✅ [WebAVModule] WebAV状态已清除')
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
    clearWebAVState()
    console.log('🔄 [WebAVModule] WebAV状态已重置为默认值')
  }

  /**
   * 添加sprite到画布
   * @param sprite 要添加的sprite
   */
  function addSprite(sprite: VisibleSprite) {
    if (!isWebAVAvailable()) {
      console.warn('⚠️ [WebAVModule] WebAV不可用，无法添加sprite')
      return false
    }

    try {
      avCanvas.value!.addSprite(sprite)
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
  function removeSprite(sprite: VisibleSprite) {
    if (!isWebAVAvailable()) {
      console.warn('⚠️ [WebAVModule] WebAV不可用，无法移除sprite')
      return false
    }

    try {
      avCanvas.value!.removeSprite(sprite)
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

    // 状态管理方法
    setAVCanvas,
    setWebAVReady,
    setWebAVError,
    clearWebAVState,

    // 工具方法
    isWebAVAvailable,
    getWebAVSummary,
    resetToDefaults,
    addSprite,
    removeSprite,
  }
}

// 导出类型定义
export type WebAVModule = ReturnType<typeof createWebAVModule>

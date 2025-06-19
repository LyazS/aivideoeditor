import { useVideoStore } from '../stores/videoStore'
import { useWebAVControls, isWebAVReady } from './useWebAVControls'

/**
 * 统一的播放控制工具函数
 * 提供可复用的播放控制逻辑，避免代码重复
 */
export function usePlaybackControls() {
  const videoStore = useVideoStore()
  const webAVControls = useWebAVControls()

  /**
   * 安全地暂停播放
   * 在需要暂停播放进行编辑操作时调用
   * @param reason 暂停原因，用于调试日志
   */
  function pauseForEditing(reason: string = '编辑操作') {
    if (isWebAVReady() && videoStore.isPlaying) {
      console.log(`⏸️ 因${reason}暂停播放`)
      webAVControls.pause()
      return true // 返回是否实际执行了暂停
    }
    return false
  }

  /**
   * 检查WebAV是否就绪，如果未就绪则显示警告
   * @param operation 操作名称，用于错误日志
   * @returns 是否就绪
   */
  function ensureWebAVReady(operation: string = '操作'): boolean {
    if (!isWebAVReady()) {
      console.warn(`⚠️ WebAV canvas not ready for ${operation}`)
      return false
    }
    return true
  }

  /**
   * 安全地执行播放控制操作
   * @param operation 要执行的操作函数
   * @param operationName 操作名称，用于日志
   * @returns 操作是否成功执行
   */
  function safePlaybackOperation(operation: () => void, operationName: string): boolean {
    if (!ensureWebAVReady(operationName)) {
      return false
    }
    
    try {
      operation()
      return true
    } catch (error) {
      console.error(`❌ ${operationName}执行失败:`, error)
      return false
    }
  }

  /**
   * 重启播放（用于播放速度变更等场景）
   * @param delay 重启延迟时间（毫秒）
   */
  function restartPlayback(delay: number = 50) {
    if (!ensureWebAVReady('重启播放')) return

    const wasPlaying = videoStore.isPlaying
    if (wasPlaying) {
      console.log('🔄 重启播放以应用新设置')
      webAVControls.pause()
      setTimeout(() => {
        if (isWebAVReady()) {
          webAVControls.play()
        }
      }, delay)
    }
  }

  return {
    pauseForEditing,
    ensureWebAVReady,
    safePlaybackOperation,
    restartPlayback,
  }
}

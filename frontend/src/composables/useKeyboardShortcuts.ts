import { onMounted, onUnmounted } from 'vue'
import { useVideoStore } from '../stores/videoStore'

/**
 * 键盘快捷键处理组合式函数
 * 提供全局快捷键支持，包括撤销/重做等操作
 */
export function useKeyboardShortcuts() {
  const videoStore = useVideoStore()

  /**
   * 处理键盘事件
   * @param event 键盘事件
   */
  const handleKeyDown = async (event: KeyboardEvent) => {
    // 检查是否在输入框中，如果是则不处理快捷键
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }

    // 检查修饰键组合
    const isCtrl = event.ctrlKey || event.metaKey // 支持 Mac 的 Cmd 键
    const isShift = event.shiftKey
    const isAlt = event.altKey

    // 撤销/重做快捷键
    if (isCtrl && !isShift && !isAlt) {
      switch (event.key.toLowerCase()) {
        case 'z':
          event.preventDefault()
          if (videoStore.canUndo) {
            console.log('🎹 快捷键触发: 撤销 (Ctrl+Z)')
            await videoStore.undo()
          }
          break

        case 'y':
          event.preventDefault()
          if (videoStore.canRedo) {
            console.log('🎹 快捷键触发: 重做 (Ctrl+Y)')
            await videoStore.redo()
          }
          break
      }
    }

    // Ctrl+Shift+Z 也可以触发重做（常见的替代快捷键）
    if (isCtrl && isShift && !isAlt && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (videoStore.canRedo) {
        console.log('🎹 快捷键触发: 重做 (Ctrl+Shift+Z)')
        await videoStore.redo()
      }
    }
  }

  /**
   * 注册快捷键监听器
   */
  const registerShortcuts = () => {
    document.addEventListener('keydown', handleKeyDown)
    console.log('✅ 快捷键监听器已注册')
  }

  /**
   * 注销快捷键监听器
   */
  const unregisterShortcuts = () => {
    document.removeEventListener('keydown', handleKeyDown)
    console.log('🗑️ 快捷键监听器已注销')
  }

  // 在组件挂载时注册，卸载时注销
  onMounted(() => {
    registerShortcuts()
  })

  onUnmounted(() => {
    unregisterShortcuts()
  })

  return {
    registerShortcuts,
    unregisterShortcuts,
  }
}

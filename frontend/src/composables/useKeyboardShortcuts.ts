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
    // 添加调试日志
    // console.log('🎹 键盘事件:', {
    //   key: event.key,
    //   ctrlKey: event.ctrlKey,
    //   shiftKey: event.shiftKey,
    //   altKey: event.altKey,
    //   target: (event.target as HTMLElement).tagName
    // })

    // 检查是否在输入框中，如果是则不处理快捷键
    const target = event.target as HTMLElement

    // 更智能的输入元素检查：
    // 1. TEXTAREA 和可编辑元素：总是阻止快捷键（用户正在输入文本）
    // 2. INPUT 元素：根据类型判断
    //    - text, password, email, number 等输入框：阻止快捷键（用户可能想撤销输入内容）
    //    - range 滑块：允许快捷键（实时更新，用户希望能快速撤销调整）
    if (target.tagName === 'TEXTAREA' || target.isContentEditable) {
      console.log('🚫 在文本输入区域，跳过快捷键处理')
      return
    }

    if (target.tagName === 'INPUT') {
      const inputElement = target as HTMLInputElement
      const inputType = inputElement.type.toLowerCase()

      // 只有滑块类型允许快捷键，其他输入类型都阻止
      if (inputType !== 'range') {
        console.log('🚫 在输入框中，跳过快捷键处理')
        return
      }

      // 对于 range 滑块，允许快捷键（用户希望能快速撤销调整）
    }

    // 检查修饰键组合
    const isCtrl = event.ctrlKey || event.metaKey // 支持 Mac 的 Cmd 键
    const isShift = event.shiftKey
    const isAlt = event.altKey

    // 只处理实际的字符键，忽略修饰键本身
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
      return
    }

    // Ctrl+Shift+Z 重做（优先处理，避免被 Ctrl+Z 拦截）
    if (isCtrl && isShift && !isAlt && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      console.log('🎹 快捷键触发: 重做 (Ctrl+Shift+Z)')
      await videoStore.redo()
      return
    }

    // 撤销/重做快捷键
    if (isCtrl && !isShift && !isAlt) {
      switch (event.key.toLowerCase()) {
        case 'z':
          event.preventDefault()
          console.log('🎹 快捷键触发: 撤销 (Ctrl+Z)')
          await videoStore.undo()
          break

        case 'y':
          event.preventDefault()
          console.log('🎹 快捷键触发: 重做 (Ctrl+Y)')
          await videoStore.redo()
          break
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

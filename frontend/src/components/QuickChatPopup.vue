<template>
  <div v-show="show" class="chat-popup" :style="popupStyle" @click.stop>
    <div class="chat-header" @mousedown="startResize">
      <h3 class="chat-title">快速聊天</h3>
      <button class="close-btn" @click="closeChat">
        <RemixIcon name="close-line" size="sm" />
      </button>
    </div>
    <div class="chat-body">
      <div class="input-output-container">
        <textarea
          ref="textInput"
          v-model="message"
          class="message-input"
          placeholder="请输入JavaScript代码，例如：addTrack('video')"
          :style="{ flex: inputHeightRatio }"
        ></textarea>
        <div
          class="panel-resize-handle"
          :class="{ dragging: isResizingPanels }"
          @mousedown="startPanelResize"
          :style="{
            transform: isResizingPanels ? 'scaleY(2)' : '',
            background: isResizingPanels ? 'var(--color-accent-primary)' : '',
          }"
        ></div>
        <textarea
          v-model="outputMessage"
          class="output-textarea"
          placeholder="执行结果将显示在这里..."
          readonly
          :style="{ flex: 1 - inputHeightRatio }"
        ></textarea>
      </div>
    </div>
    <div class="chat-footer">
      <button class="send-btn" @click="executeCode" :disabled="!message.trim() || isExecuting">
        {{ isExecuting ? '执行中...' : '执行代码' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useUnifiedStore } from '@/unified/unifiedStore'
import RemixIcon from './icons/RemixIcon.vue'

const props = defineProps<{
  show: boolean
  anchorX: number
  anchorY: number
}>()

const emit = defineEmits<{
  close: []
  send: [message: string]
}>()

const message = ref('')
const outputMessage = ref('')
const textInput = ref<HTMLTextAreaElement>()

// 添加执行状态
const isExecuting = ref(false)

// 拖拽状态管理
const isResizing = ref(false)
const popupHeight = ref(Math.max(250, Math.floor(window.innerHeight * 0.4))) // 默认占屏幕高度40%，最小250px
const startY = ref(0)
const startHeight = ref(0)

// 输入框和显示框的高度比例管理
const inputHeightRatio = ref(0.6) // 输入框占总高度的60%
const isResizingPanels = ref(false)
const panelStartY = ref(0)
const panelStartInputRatio = ref(0)
const panelHandlePosition = ref(0) // 分割条跟随鼠标的位置

// 获取统一存储实例
const unifiedStore = useUnifiedStore()

const popupStyle = computed(() => {
  // 计算弹出窗口位置，避免超出屏幕边界
  const popupWidth = 300
  const margin = 10
  const buttonSize = 50

  let left = props.anchorX + buttonSize + margin
  let top = props.anchorY - popupHeight.value / 2

  // 检查右边界
  if (left + popupWidth > window.innerWidth) {
    left = props.anchorX - popupWidth - margin
  }

  // 检查上边界
  if (top < margin) {
    top = margin
  }

  // 检查下边界
  if (top + popupHeight.value > window.innerHeight - margin) {
    top = window.innerHeight - popupHeight.value - margin
  }

  return {
    left: left + 'px',
    top: top + 'px',
    height: popupHeight.value + 'px',
  }
})

watch(
  () => props.show,
  (newValue) => {
    if (newValue) {
      // 对话框显示时聚焦到输入框
      nextTick(() => {
        textInput.value?.focus()
      })
    }
    // 不再在关闭时清空消息，保持输入内容
  },
)

const closeChat = () => {
  emit('close')
}

// 拖拽相关函数
const startResize = (event: MouseEvent) => {
  // 如果点击的是关闭按钮，不触发拖拽
  if ((event.target as HTMLElement).closest('.close-btn')) {
    return
  }

  isResizing.value = true
  startY.value = event.clientY
  startHeight.value = popupHeight.value

  // 添加全局事件监听器
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)

  // 阻止默认行为
  event.preventDefault()
}

const handleResize = (event: MouseEvent) => {
  if (!isResizing.value) return

  const deltaY = startY.value - event.clientY // 向上拖拽增加高度，向下拖拽减少高度
  const newHeight = Math.max(200, Math.min(window.innerHeight * 0.8, startHeight.value + deltaY)) // 最小200px，最大80%屏幕高度

  popupHeight.value = newHeight
}

const stopResize = () => {
  isResizing.value = false

  // 移除全局事件监听器
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

// 面板之间的拖拽调整
const startPanelResize = (event: MouseEvent) => {
  isResizingPanels.value = true
  panelStartY.value = event.clientY
  panelStartInputRatio.value = inputHeightRatio.value
  panelHandlePosition.value = event.clientY // 初始化手柄位置

  // 添加全局事件监听器
  document.addEventListener('mousemove', handlePanelResize)
  document.addEventListener('mouseup', stopPanelResize)

  // 阻止默认行为
  event.preventDefault()
  event.stopPropagation()
}

const handlePanelResize = (event: MouseEvent) => {
  if (!isResizingPanels.value) return

  // 更新手柄位置跟随鼠标
  panelHandlePosition.value = event.clientY

  // 直接计算拖拽方向和距离
  const dragUp = event.clientY < panelStartY.value // 是否向上拖拽

  const sensitivity = 0.001
  const dragDistance = Math.abs(event.clientY - panelStartY.value)

  // 向上拖拽：减少输入框比例（增加输出框比例）
  let newRatio = dragUp
    ? panelStartInputRatio.value - dragDistance * sensitivity // 向上拖拽减少输入框
    : panelStartInputRatio.value + dragDistance * sensitivity // 向下拖拽增加输入框

  // 限制比例范围：输入框最小30%，最大80%
  newRatio = Math.max(0.3, Math.min(0.8, newRatio))

  inputHeightRatio.value = newRatio
}

const stopPanelResize = () => {
  isResizingPanels.value = false

  // 移除全局事件监听器
  document.removeEventListener('mousemove', handlePanelResize)
  document.removeEventListener('mouseup', stopPanelResize)
}

async function executeCode() {
  const trimmedCode = message.value.trim()
  if (!trimmedCode || isExecuting.value) return

  isExecuting.value = true
  outputMessage.value = '' // 清空之前的输出

  try {
    const report = await unifiedStore.executeUserScript(trimmedCode, 5000)
    outputMessage.value = report
  } catch (error) {
    outputMessage.value = `❌ 执行异常: ${error instanceof Error ? error.message : String(error)}`
  } finally {
    isExecuting.value = false
  }
}

// 组件卸载时清理事件监听器
onUnmounted(() => {
  if (isResizing.value) {
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', stopResize)
  }
  if (isResizingPanels.value) {
    document.removeEventListener('mousemove', handlePanelResize)
    document.removeEventListener('mouseup', stopPanelResize)
  }
})
</script>

<style scoped>
.chat-popup {
  position: fixed;
  z-index: 9999;
  width: 300px;
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--border-radius-medium);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(10px);
  min-height: 200px; /* 最小高度 */
  max-height: 80vh; /* 最大高度为屏幕高度的80% */
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-border-primary);
  background-color: var(--color-bg-tertiary);
  flex-shrink: 0;
  cursor: ns-resize; /* 整个顶部区域都可以拖拽 */
}

.chat-title {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.125rem;
  border-radius: var(--border-radius-small);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.chat-body {
  flex: 1;
  padding: var(--spacing-md);
  min-height: 0;
  display: flex;
}

.input-output-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.panel-resize-handle {
  height: 4px;
  background: var(--color-border-secondary);
  cursor: ns-resize;
  transition: all 0.2s ease;
  position: relative;
  margin: 2px 0; /* 添加上下间距 */
}

.panel-resize-handle:hover {
  background: var(--color-accent-primary);
  height: 6px;
  margin: 1px 0; /* 调整间距 */
}

.panel-resize-handle:active,
.panel-resize-handle.dragging {
  background: var(--color-accent-primary-hover);
  height: 8px;
  margin: 0; /* 拖拽时充满空间 */
  box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
}

/* 拖拽时的视觉增强效果 */
.panel-resize-handle.dragging::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(76, 175, 80, 0.1);
  z-index: 9998;
  pointer-events: none;
}

.message-input {
  width: 100%;
  min-height: 80px; /* 最小高度 */
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-medium);
  background-color: var(--color-bg-quaternary);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  resize: none;
  font-family: inherit;
}

.message-input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
}

.output-textarea {
  width: 100%;
  min-height: 60px; /* 最小高度 */
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-medium);
  background-color: var(--color-bg-quaternary);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  resize: none;
  font-family: inherit;
  cursor: default;
}

.output-textarea:focus {
  outline: none;
  border-color: var(--color-border-secondary);
}

.output-textarea::placeholder {
  color: var(--color-text-hint);
}

.message-input::placeholder {
  color: var(--color-text-hint);
}

.chat-footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--color-border-primary);
  flex-shrink: 0;
}

.send-btn {
  background-color: var(--color-accent-primary);
  color: var(--color-text-primary);
  border: none;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--border-radius-medium);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: all 0.2s ease;
}

.send-btn:hover:not(:disabled) {
  background-color: var(--color-accent-primary-hover);
}

.send-btn:disabled {
  background-color: var(--color-bg-quaternary);
  color: var(--color-text-muted);
  cursor: not-allowed;
}
</style>

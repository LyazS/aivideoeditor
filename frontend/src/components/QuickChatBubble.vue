<template>
  <div v-show="show" class="chat-bubble-popup" :style="popupStyle" @click.stop>
    <div class="chat-header" @mousedown="startResizeHeight">
      <h3 class="chat-title">快速聊天</h3>
      <button class="close-btn" @click="closeChat">
        <RemixIcon name="close-line" size="sm" />
      </button>
    </div>
    
    <div class="chat-history" ref="historyContainer">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="['message-bubble', message.type]"
      >
        <div class="message-content">
          <pre v-if="message.type === 'code'">{{ message.content }}</pre>
          <span v-else>{{ message.content }}</span>
        </div>
        <div class="message-time">
          {{ formatTime(message.timestamp) }}
        </div>
        <div v-if="message.isExecuting" class="executing-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
        <div v-if="message.executionResult" class="execution-result">
          <pre>{{ message.executionResult }}</pre>
        </div>
      </div>
    </div>
    
    <!-- 右侧宽度调整手柄 - 透明化处理 -->
    <div
      v-if="chatPosition === 'right'"
      class="width-resize-handle right-handle"
      :class="{ dragging: isResizingRight }"
      @mousedown="startResizeRight"
    ></div>
    
    <!-- 左侧宽度调整手柄 - 透明化处理 -->
    <div
      v-if="chatPosition === 'left'"
      class="width-resize-handle left-handle"
      :class="{ dragging: isResizingLeft }"
      @mousedown="startResizeLeft"
    ></div>
    
    <div class="chat-input-area">
      <textarea
        ref="textInput"
        v-model="currentInput"
        class="message-input"
        placeholder="请输入消息或代码..."
        @keydown.enter="handleEnter"
        rows="1"
      ></textarea>
      <button
        class="send-btn"
        @click="sendMessage"
        :disabled="!currentInput.trim() || isSending"
      >
        <RemixIcon name="send-plane-fill" size="sm" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useUnifiedStore } from '@/unified/unifiedStore'
import RemixIcon from './icons/RemixIcon.vue'

interface ChatMessage {
  id: string
  type: 'user' | 'system' | 'code' | 'error'
  content: string
  timestamp: Date
  isExecuting?: boolean
  executionResult?: string
}

const props = defineProps<{
  show: boolean
  anchorX: number
  anchorY: number
}>()

const emit = defineEmits<{
  close: []
  send: [message: string]
}>()

// 模拟数据 - 初始消息
const messages = ref<ChatMessage[]>([
  {
    id: '1',
    type: 'system',
    content: '欢迎使用快速聊天！请输入JavaScript代码或普通消息。',
    timestamp: new Date(Date.now() - 300000), // 5分钟前
  },
  {
    id: '2',
    type: 'user',
    content: 'addTrack("video")',
    timestamp: new Date(Date.now() - 120000), // 2分钟前
  },
  {
    id: '3',
    type: 'code',
    content: 'addTrack("video")',
    timestamp: new Date(Date.now() - 115000),
    executionResult: '✅ 视频轨道添加成功！\n轨道ID: video_track_001'
  },
  {
    id: '4',
    type: 'user',
    content: '你好，这个功能很棒！',
    timestamp: new Date(Date.now() - 60000), // 1分钟前
  },
  {
    id: '5',
    type: 'system',
    content: '谢谢！我可以帮您执行JavaScript代码来控制视频编辑器。',
    timestamp: new Date(Date.now() - 55000),
  }
])

const currentInput = ref('')
const isSending = ref(false)
const textInput = ref<HTMLTextAreaElement>()
const historyContainer = ref<HTMLDivElement>()

// 拖拽调整尺寸相关状态
const isResizingHeight = ref(false)
const isResizingRight = ref(false) // 右侧宽度调整
const isResizingLeft = ref(false)  // 左侧宽度调整
const popupHeight = ref(Math.max(300, Math.floor(window.innerHeight * 0.4)))
const popupWidth = ref(350) // 可调整的宽度
const startY = ref(0)
const startHeight = ref(0)
const startX = ref(0)
const startWidth = ref(0)
const startLeft = ref(0) // 左侧调整时的起始left位置

const popupStyle = computed(() => {
  const margin = 10
  const buttonSize = 50

  let left = props.anchorX + buttonSize + margin
  let top = props.anchorY - popupHeight.value / 2

  // 边界检查
  if (left + popupWidth.value > window.innerWidth) {
    left = props.anchorX - popupWidth.value - margin
  }
  if (top < margin) {
    top = margin
  }
  if (top + popupHeight.value > window.innerHeight - margin) {
    top = window.innerHeight - popupHeight.value - margin
  }

  return {
    left: left + 'px',
    top: top + 'px',
    height: popupHeight.value + 'px',
    width: popupWidth.value + 'px'
  }
})

// 检测聊天窗口相对于按钮的位置
const chatPosition = computed(() => {
  const buttonSize = 50
  const margin = 10
  const popupWidthValue = popupWidth.value
  
  // 计算聊天窗口的left位置
  let left = props.anchorX + buttonSize + margin
  
  // 检查是否会超出右边界
  if (left + popupWidthValue > window.innerWidth) {
    return 'left' // 聊天窗口在按钮左侧
  } else {
    return 'right' // 聊天窗口在按钮右侧
  }
})

// 自动滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (historyContainer.value) {
      historyContainer.value.scrollTop = historyContainer.value.scrollHeight
    }
  })
}

// 格式化时间显示
const formatTime = (date: Date) => {
  return date.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 发送消息
const sendMessage = async () => {
  const content = currentInput.value.trim()
  if (!content || isSending.value) return

  isSending.value = true

  // 添加用户消息
  const userMessage: ChatMessage = {
    id: Date.now().toString(),
    type: 'user',
    content,
    timestamp: new Date()
  }
  messages.value.push(userMessage)
  scrollToBottom()

  // 检查是否为代码
  const isCode = content.includes('(') && content.includes(')') || 
                content.startsWith('const ') || 
                content.startsWith('let ') || 
                content.startsWith('var ')

  if (isCode) {
    // 添加代码执行中的消息
    const executingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'code',
      content,
      timestamp: new Date(),
      isExecuting: true
    }
    messages.value.push(executingMessage)
    scrollToBottom()

    // 模拟代码执行
    setTimeout(() => {
      // 移除执行中状态
      executingMessage.isExecuting = false
      
      // 模拟执行结果
      executingMessage.executionResult = `✅ 代码执行成功！\n执行时间: ${new Date().toLocaleTimeString()}\n结果: 操作已完成`
      
      scrollToBottom()
      isSending.value = false
    }, 1500)
  } else {
    // 普通消息，添加系统回复
    setTimeout(() => {
      const systemMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        type: 'system',
        content: '收到您的消息！如果需要执行代码，请输入JavaScript语法。',
        timestamp: new Date()
      }
      messages.value.push(systemMessage)
      scrollToBottom()
      isSending.value = false
    }, 500)
  }

  currentInput.value = ''
  emit('send', content)
}

// 处理Enter键
const handleEnter = (event: KeyboardEvent) => {
  if (event.shiftKey) {
    // Shift+Enter 换行
    return
  }
  event.preventDefault()
  sendMessage()
}

const closeChat = () => {
  emit('close')
}

// 拖拽调整高度
const startResizeHeight = (event: MouseEvent) => {
  if ((event.target as HTMLElement).closest('.close-btn')) {
    return
  }

  isResizingHeight.value = true
  startY.value = event.clientY
  startHeight.value = popupHeight.value

  const onMouseMove = (e: MouseEvent) => {
    if (!isResizingHeight.value) return
    const deltaY = startY.value - e.clientY
    const newHeight = Math.max(250, Math.min(window.innerHeight * 0.8, startHeight.value + deltaY))
    popupHeight.value = newHeight
  }

  const onMouseUp = () => {
    isResizingHeight.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  event.preventDefault()
}

// 右侧拖拽调整宽度
const startResizeRight = (event: MouseEvent) => {
  isResizingRight.value = true
  startX.value = event.clientX
  startWidth.value = popupWidth.value

  const onMouseMove = (e: MouseEvent) => {
    if (!isResizingRight.value) return
    const deltaX = e.clientX - startX.value
    const newWidth = Math.max(300, Math.min(window.innerWidth * 0.6, startWidth.value + deltaX))
    popupWidth.value = newWidth
  }

  const onMouseUp = () => {
    isResizingRight.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  event.preventDefault()
}

// 左侧拖拽调整宽度
const startResizeLeft = (event: MouseEvent) => {
  isResizingLeft.value = true
  startX.value = event.clientX
  startWidth.value = popupWidth.value
  // 计算当前left位置
  const currentLeft = parseInt(popupStyle.value.left)

  const onMouseMove = (e: MouseEvent) => {
    if (!isResizingLeft.value) return
    const deltaX = startX.value - e.clientX // 向左拖拽增加宽度
    const newWidth = Math.max(300, Math.min(window.innerWidth * 0.6, startWidth.value + deltaX))
    popupWidth.value = newWidth
  }

  const onMouseUp = () => {
    isResizingLeft.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  event.preventDefault()
}

watch(() => props.show, (newValue) => {
  if (newValue) {
    nextTick(() => {
      textInput.value?.focus()
      scrollToBottom()
    })
  }
})

// 组件卸载时清理
onMounted(() => {
  scrollToBottom()
})
</script>

<style scoped>
.chat-bubble-popup {
  position: fixed;
  z-index: 9999;
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--border-radius-medium);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(10px);
  min-height: 250px;
  max-height: 80vh;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-border-primary);
  background-color: var(--color-bg-tertiary);
  flex-shrink: 0;
  cursor: ns-resize;
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

.chat-history {
  flex: 1;
  padding: var(--spacing-md);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-height: 0;
}

.message-bubble {
  max-width: 85%;
  border-radius: 18px;
  padding: 12px 16px;
  position: relative;
  word-wrap: break-word;
  animation: fadeInUp 0.3s ease;
}

.message-bubble.user {
  align-self: flex-end;
  background-color: var(--color-accent-primary);
  color: white;
}

.message-bubble.system {
  align-self: flex-start;
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-secondary);
}

.message-bubble.code {
  align-self: flex-start;
  background-color: #2d2d2d;
  color: #f8f8f2;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9em;
  border: 1px solid #444;
}

.message-bubble.error {
  align-self: flex-start;
  background-color: #ffebee;
  color: #c62828;
  border: 1px solid #ef5350;
}

.message-content pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
}

.message-time {
  font-size: 0.75em;
  opacity: 0.7;
  margin-top: 4px;
  text-align: right;
}

.message-bubble.system .message-time,
.message-bubble.code .message-time,
.message-bubble.error .message-time {
  text-align: left;
}

.executing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
}

.executing-indicator .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
  animation: pulse 1.5s infinite;
}

.executing-indicator .dot:nth-child(2) {
  animation-delay: 0.2s;
}

.executing-indicator .dot:nth-child(3) {
  animation-delay: 0.4s;
}

.execution-result {
  margin-top: 8px;
  padding: 8px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 0.9em;
}

.execution-result pre {
  margin: 0;
  white-space: pre-wrap;
}

/* 宽度调整手柄 - 透明化处理 */
.width-resize-handle {
  position: absolute;
  top: 0;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: 10000;
  background: transparent; /* 完全透明 */
  transition: background 0.2s ease;
}

/* 右侧手柄 */
.width-resize-handle.right-handle {
  right: -4px;
}

/* 左侧手柄 */
.width-resize-handle.left-handle {
  left: -4px;
}

/* 悬停时保持透明，不显示绿色 */
.width-resize-handle:hover {
  background: transparent;
}

/* 拖拽时保持透明 */
.width-resize-handle.dragging {
  background: transparent;
  width: 12px;
}

.width-resize-handle.right-handle.dragging {
  right: -6px;
}

.width-resize-handle.left-handle.dragging {
  left: -6px;
}

/* 拖拽时的视觉增强效果 - 移除绿色背景 */
.width-resize-handle.dragging::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent; /* 移除绿色半透明背景 */
  z-index: 9998;
  pointer-events: none;
}

.chat-input-area {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-top: 1px solid var(--color-border-primary);
  background-color: var(--color-bg-tertiary);
  flex-shrink: 0;
}

.message-input {
  flex: 1;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-medium);
  background-color: var(--color-bg-quaternary);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  resize: none;
  font-family: inherit;
  min-height: 40px;
  max-height: 120px;
}

.message-input:focus {
  outline: none;
  border-color: var(--color-border-focus);
}

.send-btn {
  background-color: var(--color-accent-primary);
  color: white;
  border: none;
  padding: var(--spacing-sm);
  border-radius: var(--border-radius-medium);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 40px;
}

.send-btn:hover:not(:disabled) {
  background-color: var(--color-accent-primary-hover);
}

.send-btn:disabled {
  background-color: var(--color-bg-quaternary);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
<template>
  <div
    v-show="show"
    class="chat-popup"
    :style="popupStyle"
    @click.stop
  >
    <div class="chat-header">
      <h3 class="chat-title">快速聊天</h3>
      <button class="close-btn" @click="closeChat">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
        </svg>
      </button>
    </div>
    <div class="chat-body">
      <textarea
        ref="textInput"
        v-model="message"
        class="message-input"
        placeholder="请输入JavaScript代码，例如：addTrack('video')"
        @keydown.enter.prevent="handleEnterKey"
      ></textarea>
    </div>
    <div class="chat-footer">
      <button class="send-btn" @click="executeCode" :disabled="!message.trim() || isExecuting">
        {{ isExecuting ? '执行中...' : '执行代码' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useUnifiedStore } from '@/unified/unifiedStore'

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
const textInput = ref<HTMLTextAreaElement>()

// 添加执行状态
const isExecuting = ref(false)

// 获取统一存储实例
const unifiedStore = useUnifiedStore()

const popupStyle = computed(() => {
  // 计算弹出窗口位置，避免超出屏幕边界
  const popupWidth = 300
  const popupHeight = 200
  const margin = 10
  const buttonSize = 50

  let left = props.anchorX + buttonSize + margin
  let top = props.anchorY - popupHeight / 2

  // 检查右边界
  if (left + popupWidth > window.innerWidth) {
    left = props.anchorX - popupWidth - margin
  }

  // 检查上边界
  if (top < margin) {
    top = margin
  }

  // 检查下边界
  if (top + popupHeight > window.innerHeight - margin) {
    top = window.innerHeight - popupHeight - margin
  }

  return {
    left: left + 'px',
    top: top + 'px'
  }
})

watch(() => props.show, (newValue) => {
  if (newValue) {
    // 对话框显示时聚焦到输入框
    nextTick(() => {
      textInput.value?.focus()
    })
  }
  // 不再在关闭时清空消息，保持输入内容
})

const closeChat = () => {
  emit('close')
}

async function executeCode() {
  const trimmedCode = message.value.trim()
  if (!trimmedCode || isExecuting.value) return

  isExecuting.value = true
  try {
    const result = await unifiedStore.executeUserScript(trimmedCode, 5000, true)
    
    // 简单反馈显示在输入框中
    if (result.success) {
      message.value = `✅ 成功执行 ${result.executedCount} 个操作`
    } else {
      message.value = `❌ 失败: ${result.errorCount} 个错误`
    }
    
    // 2秒后清空，方便重新输入
    setTimeout(() => {
      if (!isExecuting.value) message.value = ''
    }, 2000)
  } catch (error) {
    message.value = `❌ 执行异常: ${error instanceof Error ? error.message : String(error)}`
  } finally {
    isExecuting.value = false
  }
}

const handleEnterKey = (event: KeyboardEvent) => {
  if (event.ctrlKey && event.key === 'Enter') {
    event.preventDefault()
    executeCode()
  }
  // Enter保持换行功能（原有逻辑）
}
</script>

<style scoped>
.chat-popup {
  position: fixed;
  z-index: 9999;
  width: 300px;
  height: 200px;
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--border-radius-medium);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(10px);
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-border-primary);
  background-color: var(--color-bg-tertiary);
  flex-shrink: 0;
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

.message-input {
  width: 100%;
  height: 100%;
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
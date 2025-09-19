<template>
  <div class="panel">
    <!-- 顶部标题栏 -->
    <div class="panel-header">
      <div class="header-left">
        <RemixIcon name="sparkling-2-fill" size="md" />
        <h3>{{ t('common.chat.agent') }}</h3>
      </div>
      <HoverButton @click="$emit('close')" :title="t('common.close')">
        <template #icon>
          <RemixIcon name="close-line" size="lg" />
        </template>
      </HoverButton>
    </div>

    <!-- 消息列表 -->
    <div class="panel-content chat-messages-container" ref="messagesContainer">
      <div 
        v-for="message in messages" 
        :key="message.id"
        class="chat-message"
        :class="message.type"
      >
        <div class="message-bubble">
          <div class="message-content">{{ message.content }}</div>
          <div class="message-timestamp">{{ message.timestamp }}</div>
        </div>
      </div>
    </div>

    <!-- 底部输入框 -->
    <div class="chat-input-container">
      <div class="chat-input-wrapper">
        <input
          v-model="inputMessage"
          type="text"
          class="chat-input"
          :placeholder="t('common.chat.inputPlaceholder')"
          @keyup.enter="sendMessage"
        />
        <button 
          class="send-button" 
          @click="sendMessage"
          :disabled="!inputMessage.trim()"
          :title="t('common.chat.send')"
        >
          <RemixIcon name="send-plane-line" size="sm" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import RemixIcon from '@/components/icons/RemixIcon.vue'
import HoverButton from '@/components/HoverButton.vue'
import { useAppI18n } from '@/unified/composables/useI18n'

const { t } = useAppI18n()

// 消息数据结构
interface ChatMessage {
  id: string
  type: 'user' | 'ai'
  content: string
  timestamp: string
}

// 定义事件
const emit = defineEmits<{
  close: []
}>()

// 消息列表
const messages = ref<ChatMessage[]>([
  {
    id: '1',
    type: 'ai',
    content: '你好！我是AI助手，可以帮助你分析视频内容、提供编辑建议等。有什么可以帮助你的吗？',
    timestamp: '10:00'
  },
  {
    id: '2',
    type: 'user',
    content: '请帮我分析这个视频的主要内容',
    timestamp: '10:01'
  },
  {
    id: '3',
    type: 'ai',
    content: '我看到这是一个关于城市风景的视频，包含了多个场景切换。建议你可以添加一些过渡效果来让场景转换更加自然。',
    timestamp: '10:02'
  }
])

// 输入框内容
const inputMessage = ref('')

// 消息容器引用
const messagesContainer = ref<HTMLElement>()

// 滚动到最新消息
const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 发送消息
const sendMessage = () => {
  if (!inputMessage.value.trim()) return

  // 添加用户消息
  const userMessage: ChatMessage = {
    id: Date.now().toString(),
    type: 'user',
    content: inputMessage.value.trim(),
    timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  
  messages.value.push(userMessage)
  
  // 清空输入框
  const userInput = inputMessage.value
  inputMessage.value = ''
  
  // 模拟AI回复
  setTimeout(() => {
    const aiMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'ai',
      content: getAIResponse(userInput),
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    messages.value.push(aiMessage)
    scrollToBottom()
  }, 1000)
  
  scrollToBottom()
}

// 简单的AI回复逻辑
const getAIResponse = (userInput: string): string => {
  const responses = [
    '这是一个很好的问题！让我为你分析一下...',
    '根据视频内容，我建议你可以尝试添加一些特效来增强视觉效果。',
    '我注意到视频的节奏很好，可以考虑添加背景音乐来提升观看体验。',
    '这个视频的画面质量很不错，建议你可以调整一下色彩饱和度让画面更生动。',
    '看起来你在视频编辑方面很有经验！有什么具体的编辑需求吗？'
  ]
  
  // 根据输入内容返回相关回复
  if (userInput.includes('分析') || userInput.includes('内容')) {
    return '我已经分析了你的视频内容。这是一个制作精良的视频，包含了丰富的视觉元素。建议你可以添加一些文字说明来帮助观众更好地理解内容。'
  } else if (userInput.includes('效果') || userInput.includes('特效')) {
    return '我建议你可以尝试添加一些过渡效果，比如淡入淡出或者滑动效果，这样可以让场景切换更加自然流畅。'
  } else if (userInput.includes('音乐') || userInput.includes('音频')) {
    return '音频是视频的重要组成部分。你可以考虑添加一些背景音乐来增强视频的氛围，但要注意音量平衡，确保不会盖过主要内容。'
  } else {
    return responses[Math.floor(Math.random() * responses.length)]
  }
}

// 监听消息变化，自动滚动到底部
watch(messages, () => {
  scrollToBottom()
}, { deep: true })

// 初始化时滚动到底部
scrollToBottom()
</script>

<style scoped>
/* 确保聊天面板占满整个高度 */
.panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}


.chat-messages-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.chat-message {
  display: flex;
  margin-bottom: var(--spacing-sm);
}

.chat-message.user {
  justify-content: flex-end;
}

.chat-message.ai {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 70%;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius-large);
  position: relative;
}

.chat-message.user .message-bubble {
  background-color: var(--color-primary);
  color: white;
  border-bottom-right-radius: var(--border-radius-small);
}

.chat-message.ai .message-bubble {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border-bottom-left-radius: var(--border-radius-small);
}

.message-content {
  font-size: var(--font-size-base);
  line-height: 1.4;
  margin-bottom: var(--spacing-xs);
}

.message-timestamp {
  font-size: var(--font-size-xs);
  opacity: 0.7;
  text-align: right;
}

.chat-input-container {
  padding: var(--spacing-md);
  border-top: 1px solid var(--color-border-primary);
  background-color: var(--color-bg-tertiary);
  flex-shrink: 0;
}

.chat-input-wrapper {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.chat-input {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--border-radius-medium);
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  outline: none;
  transition: border-color var(--transition-fast);
}

.chat-input:focus {
  border-color: var(--color-primary);
}

.chat-input::placeholder {
  color: var(--color-text-secondary);
}

.send-button {
  background-color: var(--color-primary);
  color: white;
  border: none;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius-medium);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.send-button:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.send-button:disabled {
  background-color: var(--color-bg-quaternary);
  color: var(--color-text-secondary);
  cursor: not-allowed;
}

/* 滚动条样式 */
.chat-messages-container::-webkit-scrollbar {
  width: 6px;
}

.chat-messages-container::-webkit-scrollbar-track {
  background: var(--color-bg-primary);
  border-radius: 3px;
}

.chat-messages-container::-webkit-scrollbar-thumb {
  background: var(--color-border-secondary);
  border-radius: 3px;
}

.chat-messages-container::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-primary);
}
</style>
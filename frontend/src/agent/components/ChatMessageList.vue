<template>
  <div class="chat-messages-container" ref="messagesContainer">
    <component
      :is="getMessageComponent(message.type)"
      v-for="message in messages"
      :key="message.id"
      :message="message"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, provide } from 'vue'
import MarkdownIt from 'markdown-it'
import UserChatMessage from '@/agent/components/UserChatMessage.vue'
import AIChatMessage from '@/agent/components/AIChatMessage.vue'
import type { ChatMessage } from './types'

// 根据消息类型返回对应的组件
const getMessageComponent = (type: 'user' | 'ai') => {
  return type === 'user' ? UserChatMessage : AIChatMessage
}

// 创建共享的markdown-it实例
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
})

// 提供markdown渲染函数给子组件
const renderMarkdown = (content: string) => {
  return md.render(content)
}

provide('renderMarkdown', renderMarkdown)

const props = defineProps<{
  messages: ChatMessage[]
}>()

const messagesContainer = ref<HTMLElement>()

// 滚动到最新消息
const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 监听消息变化，自动滚动到底部
watch(() => props.messages, () => {
  scrollToBottom()
}, { deep: true })

// 初始化时滚动到底部
scrollToBottom()
</script>

<style scoped>
.chat-messages-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
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
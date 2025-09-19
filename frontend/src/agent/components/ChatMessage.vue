<template>
  <div class="chat-message" :class="message.type">
    <div class="message-bubble">
      <div v-if="message.type === 'ai'" class="message-header">
        <RemixIcon name="robot-2-fill" size="xl" class="agent-icon" />
        <span class="agent-label">Agent</span>
      </div>
      <div
        class="message-content markdown-body"
        v-html="renderedContent"
      ></div>
      <div class="message-timestamp">{{ message.timestamp }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import 'github-markdown-css'
import type { ChatMessage } from './types'
import RemixIcon from '@/components/icons/RemixIcon.vue'

const props = defineProps<{
  message: ChatMessage
}>()

// 创建markdown-it实例
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
})

// 计算属性：渲染markdown内容
const renderedContent = computed(() => {
  if (props.message.type === 'ai') {
    return md.render(props.message.content)
  }
  // 用户消息保持纯文本
  return props.message.content
})
</script>

<style scoped>
.chat-message {
  display: flex;
  margin-bottom: var(--spacing-sm);
}

.chat-message.user {
  justify-content: flex-end;
}

.chat-message.ai {
  justify-content: flex-start;
  width: 100%;
}

.message-bubble {
  max-width: 70%;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius-large);
  position: relative;
  word-wrap: break-word;
}

.chat-message.ai .message-bubble {
  max-width: 100%;
}

.chat-message.user .message-bubble {
  background-color: #3b82f6;
  color: white;
  border-bottom-right-radius: var(--border-radius-small);
}

.message-header {
  display: flex;
  align-items: center;
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.agent-icon {
  margin-right: var(--spacing-sm);
}

.agent-label {
  font-weight: 600;
  font-size: var(--font-size-lg);
}

.chat-message.ai .message-bubble {
  max-width: 85%;
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: transparent;
  color: var(--color-text-primary);
  border-radius: var(--border-radius-large);
}

.message-content {
  font-size: var(--font-size-base);
  line-height: 1.4;
  margin-bottom: var(---spacing-xs);
}

.message-timestamp {
  font-size: var(--font-size-xs);
  opacity: 0.7;
  text-align: right;
}

/* 仅保留最必要的自定义样式 */
.markdown-body {
  color: var(--color-text-primary);
  background-color: transparent;
}

/* 确保表格在小屏幕上可滚动 */
.markdown-body table {
  display: block;
  overflow-x: auto;
}
</style>
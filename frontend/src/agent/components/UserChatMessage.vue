<template>
  <div class="chat-message user">
    <div class="message-bubble">
      <div class="message-content">
        <div class="markdown-body" v-html="renderMarkdown(props.message.content)"></div>
      </div>
      <div class="message-timestamp">{{ message.timestamp }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import 'github-markdown-css'
import type { ChatMessage } from './types'

// 注入markdown渲染函数
const renderMarkdown = inject<(content: string) => string>('renderMarkdown', (content: string) => {
  // 如果没有注入，返回原始内容（降级处理）
  return content
})

const props = defineProps<{
  message: ChatMessage
}>()
</script>

<style scoped>
.chat-message {
  display: flex;
  margin-bottom: var(--spacing-sm);
}

.chat-message.user {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 70%;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius-large);
  position: relative;
  word-wrap: break-word;
}

.chat-message.user .message-bubble {
  background-color: #3b82f6;
  color: white;
  border-bottom-right-radius: var(--border-radius-small);
  position: relative;
}

/* 添加气泡小角 */
.chat-message.user .message-bubble::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: -8px;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 10px 0 0 10px;
  border-color: transparent transparent transparent #3b82f6;
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

/* 仅保留最必要的自定义样式 */
.markdown-body {
  color: white;
  background-color: transparent;
}

/* 确保表格在小屏幕上可滚动 */
.markdown-body table {
  display: block;
  overflow-x: auto;
}
</style>
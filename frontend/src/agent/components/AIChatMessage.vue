<template>
  <div class="chat-message ai">
    <div class="message-bubble">
      <div class="message-header">
        <RemixIcon name="robot-2-fill" size="xl" class="agent-icon" />
        <span class="agent-label">Agent</span>
      </div>
      <div class="message-content">
        <template v-for="(item, index) in parsedContent" :key="index">
          <div v-if="item.type === 'text'"
               class="markdown-body"
               v-html="renderMarkdown(item.content)">
          </div>
          <component v-else-if="item.type === 'tool'"
                     :is="getToolComponent(item.toolName!)"
                     :toolType="item.toolName!"
                     :attributes="item.params || {}"
                     :content="item.toolContent || ''"
                     :validationErrors="item.validationErrors || []"
                     :onExecute="() => handleToolExecute(item.toolName!, item.toolContent || '')">
          </component>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import 'github-markdown-css'
import type { ChatMessage } from './types'
import RemixIcon from '@/components/icons/RemixIcon.vue'
import { parseXmlToolTags } from '@/agent/utils/xmlParser'
import { getToolComponent as getToolComponentFn, isValidToolName } from './toolComponents/index'

// 注入markdown渲染函数
const renderMarkdown = inject<(content: string) => string>('renderMarkdown', (content: string) => {
  // 如果没有注入，返回原始内容（降级处理）
  return content
})

const props = defineProps<{
  message: ChatMessage
}>()

// 解析AI消息内容，分离文本和工具标签
const parsedContent = computed(() => {
  return parseXmlToolTags(props.message.content)
})

// 获取工具组件
const getToolComponent = (toolName: string) => {
  if (isValidToolName(toolName)) {
    return getToolComponentFn(toolName)
  }
  return null
}

// 处理工具执行
const handleToolExecute = async (toolName: string, content: string) => {
  console.log(`执行工具: ${toolName}`, content)
  // 这里可以添加实际的工具执行逻辑
  // 例如调用后端API或执行相应的操作
}
</script>

<style scoped>
.chat-message {
  display: flex;
  margin-bottom: var(--spacing-sm);
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
  max-width: 95%;
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: transparent;
  color: var(--color-text-primary);
  border-radius: var(--border-radius-large);
}

.message-content {
  font-size: var(--font-size-base);
  line-height: 1.4;
  margin-bottom: var(--spacing-xs);
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

/* 工具组件样式 */
.tool-component {
  margin: 2px 0;
  font-size: 13px;
}

/* 工具组件与普通文本的间距 */
.message-content > *:first-child {
  margin-top: 0;
}

.message-content > *:last-child {
  margin-bottom: 0;
}

/* 工具组件之间的间距 */
.message-content > .tool-component + .tool-component {
  margin-top: 4px;
}

.message-content > .markdown-body + .tool-component,
.message-content > .tool-component + .markdown-body {
  margin-top: 8px;
}
</style>
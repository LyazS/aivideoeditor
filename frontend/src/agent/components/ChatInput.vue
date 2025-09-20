<template>
  <div class="chat-input-wrapper">
    <textarea
      ref="textareaRef"
      v-model="inputMessage"
      class="chat-textarea"
      :placeholder="placeholder"
      :style="textareaStyle"
      @input="adjustTextareaHeight"
      @keydown.enter="handleEnterKey"
    />
    <div class="chat-actions">
      <HoverButton
        variant="primary"
        :disabled="!inputMessage.trim()"
        :title="sendTitle"
        @click="handleSend"
      >
        <template #icon>
          <RemixIcon name="send-plane-fill" size="lg" />
        </template>
      </HoverButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import RemixIcon from '@/components/icons/RemixIcon.vue'
import HoverButton from '@/components/HoverButton.vue'

const props = defineProps<{
  placeholder?: string
  sendTitle?: string
}>()

const emit = defineEmits<{
  send: [message: string]
}>()

const inputMessage = ref('')
const textareaRef = ref<HTMLTextAreaElement>()
const textareaHeight = ref(72) // 初始高度 72px (3行 × 24px)

// 基础行高（字体大小 + 行间距）
const LINE_HEIGHT = 24 // px
const MIN_LINES = 3
const MAX_LINES = 10

const textareaStyle = computed(() => ({
  overflowY:
    textareaHeight.value >= MAX_LINES * LINE_HEIGHT ? ('auto' as const) : ('hidden' as const),
  resize: 'none' as const,
  height: `${textareaHeight.value}px`,
  minHeight: `${MIN_LINES * LINE_HEIGHT}px`,
  maxHeight: `${MAX_LINES * LINE_HEIGHT}px`,
}))

const adjustTextareaHeight = () => {
  nextTick(() => {
    if (textareaRef.value) {
      // 简单计算行数：根据换行符数量 + 1
      const lineBreaks = (inputMessage.value.match(/\n/g) || []).length
      const estimatedLines = lineBreaks + 1

      // 根据行数计算高度
      const newHeight = Math.min(
        Math.max(estimatedLines * LINE_HEIGHT, MIN_LINES * LINE_HEIGHT),
        MAX_LINES * LINE_HEIGHT,
      )

      textareaHeight.value = newHeight
    }
  })
}

const handleEnterKey = (event: KeyboardEvent) => {
  if (!event.shiftKey) {
    event.preventDefault() // 只有普通Enter才阻止默认行为
    handleSend()
  } else {
    // Shift+Enter 换行，允许默认行为，然后调整高度
    nextTick(() => {
      adjustTextareaHeight()
    })
  }
}

const handleSend = () => {
  if (!inputMessage.value.trim()) return
  emit('send', inputMessage.value.trim())
  inputMessage.value = ''
  textareaHeight.value = MIN_LINES * LINE_HEIGHT // 重置为最小高度(3行)
}
</script>

<style scoped>
.chat-input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  background-color: var(--color-bg-primary);
  border-radius: 12px;
  padding: 8px 8px;
  border: 1px solid var(--color-border-primary);
  transition: border-color 0.2s ease;
  margin: 8px 16px 12px 16px;
  border-top: 1px solid var(--color-border-primary);
}

.chat-input-wrapper:focus-within {
  border-color: #3b82f6;
}

.chat-textarea {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 14px;
  line-height: 1.5;
  font-family: inherit;
  overflow-y: hidden;
  resize: none;
}

.chat-textarea::placeholder {
  color: var(--color-text-secondary);
}

.chat-actions {
  display: flex;
  align-items: flex-end;
  padding-bottom: 0px;
}
</style>

<template>
  <div class="chat-input-container">
    <div class="chat-input-wrapper">
      <input
        v-model="inputMessage"
        type="text"
        class="chat-input"
        :placeholder="placeholder"
        @keyup.enter="handleSend"
      />
      <button 
        class="send-button" 
        @click="handleSend"
        :disabled="!inputMessage.trim()"
        :title="sendTitle"
      >
        <RemixIcon name="send-plane-line" size="sm" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import RemixIcon from '@/components/icons/RemixIcon.vue'

const props = defineProps<{
  placeholder?: string
  sendTitle?: string
}>()

const emit = defineEmits<{
  send: [message: string]
}>()

const inputMessage = ref('')

const handleSend = () => {
  if (!inputMessage.value.trim()) return
  emit('send', inputMessage.value.trim())
  inputMessage.value = ''
}
</script>

<style scoped>
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
</style>
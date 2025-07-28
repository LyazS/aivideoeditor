<template>
  <!-- 编辑项目对话框 -->
  <div v-if="show" class="dialog-overlay" @click="handleOverlayClick">
    <div class="dialog-content" @click.stop>
      <div class="dialog-header">
        <h3>编辑项目</h3>
        <button class="close-btn" @click="closeDialog">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
          </svg>
        </button>
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label for="project-name">项目名称</label>
          <input
            id="project-name"
            v-model="form.name"
            type="text"
            class="form-input"
            placeholder="请输入项目名称"
            maxlength="100"
            @keydown.enter="saveProject"
          />
        </div>
        <div class="form-group">
          <label for="project-description">项目描述</label>
          <textarea
            id="project-description"
            v-model="form.description"
            class="form-textarea"
            placeholder="请输入项目描述（可选）"
            rows="4"
            maxlength="500"
          ></textarea>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" @click="closeDialog">取消</button>
        <button 
          class="btn btn-primary" 
          @click="saveProject" 
          :disabled="!form.name.trim() || isSaving"
        >
          {{ isSaving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { UnifiedProjectConfig } from '@/unified/project/types'

interface Props {
  show: boolean
  project: UnifiedProjectConfig | null
  isSaving?: boolean
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'save', data: { name: string; description: string }): void
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  isSaving: false
})

const emit = defineEmits<Emits>()

// 表单数据
const form = ref({
  name: '',
  description: ''
})

// 监听项目变化，更新表单数据
watch(() => props.project, (newProject) => {
  if (newProject) {
    form.value.name = newProject.name
    form.value.description = newProject.description || ''
  }
}, { immediate: true })

// 监听显示状态，重置表单
watch(() => props.show, (newShow) => {
  if (newShow && props.project) {
    form.value.name = props.project.name
    form.value.description = props.project.description || ''
  }
})

// 关闭对话框
function closeDialog() {
  emit('update:show', false)
  emit('close')
}

// 处理遮罩点击
function handleOverlayClick() {
  closeDialog()
}

// 保存项目
function saveProject() {
  if (!form.value.name.trim() || props.isSaving) {
    return
  }

  emit('save', {
    name: form.value.name.trim(),
    description: form.value.description.trim()
  })
}
</script>

<style scoped>
/* 编辑项目对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.dialog-content {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-large);
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--border-radius-small);
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.dialog-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-medium);
  color: var(--color-text-primary);
  font-size: 0.875rem;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-accent-secondary);
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  line-height: 1.5;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--border-radius-medium);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-secondary {
  background: var(--color-bg-active);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: var(--color-border-hover);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.btn-primary {
  background: var(--color-accent-secondary);
  border: 1px solid var(--color-accent-secondary);
  color: var(--color-text-primary);
  transition: all 0.2s ease;
}

.btn-primary:hover:not(:disabled) {
  background: #1976d2;
  border-color: #1976d2;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
</style>

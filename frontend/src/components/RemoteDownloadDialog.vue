<template>
  <div v-if="show" class="dialog-overlay" @click="handleOverlayClick">
    <div class="dialog-container" @click.stop>
      <div class="dialog-header">
        <h3>远程下载</h3>
        <button class="close-btn" @click="closeDialog">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"
            />
          </svg>
        </button>
      </div>

      <div class="dialog-content">
        <form @submit.prevent="handleSubmit">
          <!-- URL输入 -->
          <div class="form-group">
            <label for="url">远程文件URL *</label>
            <input
              id="url"
              v-model="form.url"
              type="url"
              placeholder="https://example.com/video.mp4"
              required
              :disabled="isProcessing"
            />
            <div v-if="urlError" class="error-message">{{ urlError }}</div>
          </div>

          <!-- 预计时长 -->
          <div class="form-group">
            <label for="duration">预计时长（秒）*</label>
            <input
              id="duration"
              v-model.number="form.duration"
              type="number"
              min="0.1"
              step="0.1"
              placeholder="5.0"
              required
              :disabled="isProcessing"
            />
            <div class="help-text">用于在时间轴上创建占位符，实际时长以下载后的文件为准</div>
          </div>

          <!-- 素材名称 -->
          <div class="form-group">
            <label for="name">素材名称（可选）</label>
            <input
              id="name"
              v-model="form.name"
              type="text"
              placeholder="自动从URL提取"
              :disabled="isProcessing"
            />
          </div>

          <!-- 超时设置 -->
          <div class="form-group">
            <label for="timeout">超时时间（秒）</label>
            <input
              id="timeout"
              v-model.number="form.timeout"
              type="number"
              min="10"
              max="300"
              step="10"
              :disabled="isProcessing"
            />
            <div class="help-text">下载超时时间，默认30秒</div>
          </div>

          <!-- 支持格式提示 -->
          <div class="format-info">
            <h4>支持的文件格式：</h4>
            <div class="format-list">
              <span class="format-tag">MP4</span>
              <span class="format-tag">WebM</span>
              <span class="format-tag">MP3</span>
              <span class="format-tag">WAV</span>
              <span class="format-tag">JPG</span>
              <span class="format-tag">PNG</span>
              <span class="format-tag">GIF</span>
            </div>
          </div>

          <!-- 按钮组 -->
          <div class="dialog-actions">
            <button
              type="button"
              class="btn btn-secondary"
              @click="closeDialog"
              :disabled="isProcessing"
            >
              取消
            </button>
            <button type="submit" class="btn btn-primary" :disabled="!isFormValid || isProcessing">
              <span v-if="isProcessing">处理中...</span>
              <span v-else>开始下载</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

/**
 * 远程下载配置
 */
interface RemoteDownloadConfig {
  type: 'remote-download'
  url: string // 远程URL
  headers?: Record<string, string> // 自定义请求头
  timeout?: number // 超时时间（毫秒）
}

interface Props {
  show: boolean
  isProcessing?: boolean
}

interface Emits {
  (e: 'update:show', value: boolean): void
  (e: 'close'): void
  (e: 'submit', config: RemoteDownloadConfig, expectedDuration: number, name?: string): void
}

const props = withDefaults(defineProps<Props>(), {
  isProcessing: false,
})

const emit = defineEmits<Emits>()

// 表单数据
const form = ref({
  url: '',
  duration: 5.0,
  name: '',
  timeout: 30,
})

// URL验证错误
const urlError = ref('')

// 表单验证
const isFormValid = computed(() => {
  return form.value.url.trim() !== '' && form.value.duration > 0 && !urlError.value
})

// 监听URL变化进行验证
watch(
  () => form.value.url,
  (newUrl) => {
    urlError.value = ''
    if (newUrl.trim()) {
      try {
        const url = new URL(newUrl)
        if (!['http:', 'https:'].includes(url.protocol)) {
          urlError.value = '只支持 HTTP 和 HTTPS 协议'
        }
      } catch {
        urlError.value = '请输入有效的URL地址'
      }
    }
  },
)

// 监听显示状态，重置表单
watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      resetForm()
    }
  },
)

// 重置表单
function resetForm() {
  form.value = {
    url: '',
    duration: 5.0,
    name: '',
    timeout: 30,
  }
  urlError.value = ''
}

// 关闭对话框
function closeDialog() {
  emit('update:show', false)
  emit('close')
}

// 处理遮罩点击
function handleOverlayClick() {
  if (!props.isProcessing) {
    closeDialog()
  }
}

// 提交表单
function handleSubmit() {
  if (!isFormValid.value || props.isProcessing) {
    return
  }

  const config: RemoteDownloadConfig = {
    type: 'remote-download',
    url: form.value.url.trim(),
    timeout: form.value.timeout * 1000, // 转换为毫秒
  }

  const expectedDurationFrames = Math.round(form.value.duration * 30) // 假设30fps
  const name = form.value.name.trim() || undefined

  emit('submit', config, expectedDurationFrames, name)
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-container {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--border-radius-xlarge);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xxl) var(--spacing-xxl) var(--spacing-xl);
  border-bottom: 1px solid var(--color-border-primary);
}

.dialog-header h3 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--spacing-xs);
  border-radius: var(--border-radius-medium);
  transition: all var(--transition-fast);
}

.close-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.dialog-content {
  padding: var(--spacing-xxl);
}

.form-group {
  margin-bottom: var(--spacing-xxl);
}

.form-group label {
  display: block;
  margin-bottom: var(--spacing-sm);
  color: var(--color-text-primary);
  font-weight: 500;
  font-size: var(--font-size-lg);
}

.form-group input {
  width: 100%;
  padding: var(--spacing-lg) var(--spacing-lg);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--border-radius-medium);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
  transition: border-color var(--transition-fast);
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-accent-primary);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  color: var(--color-accent-error);
  font-size: var(--font-size-base);
  margin-top: var(--spacing-xs);
}

.help-text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  margin-top: var(--spacing-xs);
}

.format-info {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-xxl);
}

.format-info h4 {
  margin: 0 0 var(--spacing-md) 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
  font-weight: 500;
}

.format-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.format-tag {
  background: var(--color-accent-primary);
  color: white;
  padding: 2px var(--spacing-md);
  border-radius: 12px;
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.dialog-actions {
  display: flex;
  gap: var(--spacing-lg);
  justify-content: flex-end;
  margin-top: var(--spacing-xxl);
}

.btn {
  padding: var(--spacing-lg) var(--spacing-xxl);
  border: none;
  border-radius: var(--border-radius-medium);
  font-size: var(--font-size-lg);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-primary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-hover);
}

.btn-primary {
  background: var(--color-accent-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-accent-primary-hover);
}
</style>

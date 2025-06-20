<template>
  <!-- 分辨率按钮 -->
  <button class="aspect-ratio-btn" @click="openModal" title="设置视频分辨率">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M19,12H22L18,8L14,12H17V16H7V12H10L6,8L2,12H5V16A2,2 0 0,0 7,18H17A2,2 0 0,0 19,16V12Z"
      />
    </svg>
    <span class="aspect-ratio-text">{{ currentResolutionText }}</span>
  </button>

  <!-- 分辨率选择弹窗 -->
  <div v-if="showModal" class="modal-overlay" @click="cancelSelection">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>选择视频分辨率</h3>
        <button class="close-btn" @click="cancelSelection">&times;</button>
      </div>
      <div class="modal-content">
        <!-- 预设分辨率网格 -->
        <div class="resolution-grid">
          <div
            v-for="resolution in resolutionOptions"
            :key="`${resolution.width}x${resolution.height}`"
            class="resolution-option"
            :class="{ selected: isSelected(resolution) }"
            @click="selectPresetResolution(resolution)"
          >
            <div class="resolution-preview" :style="getPreviewStyle(resolution)"></div>
            <div class="resolution-info">
              <div class="resolution-name">{{ resolution.name }}</div>
              <div class="resolution-details">
                {{ resolution.width }}×{{ resolution.height }}
              </div>
              <div class="resolution-ratio">{{ resolution.aspectRatio }}</div>
            </div>
          </div>

          <!-- 自定义分辨率选项 -->
          <div
            class="resolution-option custom-option"
            :class="{ selected: showCustomResolution }"
            @click="selectCustomResolution"
          >
            <div class="resolution-preview custom-preview">
              <span>自定义</span>
            </div>
            <div class="resolution-info">
              <div class="resolution-name">自定义分辨率</div>
              <div class="resolution-details">设置自定义尺寸</div>
            </div>
          </div>
        </div>

        <!-- 自定义分辨率输入 -->
        <div v-if="showCustomResolution" class="custom-resolution-inputs">
          <h4>自定义分辨率</h4>
          <div class="input-group">
            <label>宽度:</label>
            <input
              v-model.number="customWidth"
              type="number"
              min="1"
              max="7680"
              class="resolution-input"
            />
            <span>px</span>
          </div>
          <div class="input-group">
            <label>高度:</label>
            <input
              v-model.number="customHeight"
              type="number"
              min="1"
              max="4320"
              class="resolution-input"
            />
            <span>px</span>
          </div>
          <div class="aspect-ratio-display">
            比例: {{ customResolutionText }}
          </div>
        </div>

        <!-- 确认按钮 -->
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="cancelSelection">取消</button>
          <button class="btn btn-primary" @click="confirmSelection">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useVideoStore } from '../stores/videoStore'

const videoStore = useVideoStore()

// ==================== 状态定义 ====================

const showModal = ref(false)
const showCustomResolution = ref(false)

// 当前分辨率
const currentResolution = ref({
  name: '1080p',
  width: 1920,
  height: 1080,
  aspectRatio: '16:9',
  category: '横屏',
})

// 临时选择的分辨率（在弹窗中选择但未确认）
const tempSelectedResolution = ref(currentResolution.value)

// 自定义分辨率
const customWidth = ref(1920)
const customHeight = ref(1080)

// ==================== 预设分辨率选项 ====================

const resolutionOptions = [
  // 横屏 16:9
  { name: '4K', width: 3840, height: 2160, aspectRatio: '16:9', category: '横屏' },
  { name: '1440p', width: 2560, height: 1440, aspectRatio: '16:9', category: '横屏' },
  { name: '1080p', width: 1920, height: 1080, aspectRatio: '16:9', category: '横屏' },
  { name: '720p', width: 1280, height: 720, aspectRatio: '16:9', category: '横屏' },
  { name: '480p', width: 854, height: 480, aspectRatio: '16:9', category: '横屏' },

  // 竖屏 9:16
  { name: '4K 竖屏', width: 2160, height: 3840, aspectRatio: '9:16', category: '竖屏' },
  { name: '1440p 竖屏', width: 1440, height: 2560, aspectRatio: '9:16', category: '竖屏' },
  { name: '1080p 竖屏', width: 1080, height: 1920, aspectRatio: '9:16', category: '竖屏' },
  { name: '720p 竖屏', width: 720, height: 1280, aspectRatio: '9:16', category: '竖屏' },

  // 正方形 1:1
  { name: '1080×1080', width: 1080, height: 1080, aspectRatio: '1:1', category: '正方形' },
  { name: '720×720', width: 720, height: 720, aspectRatio: '1:1', category: '正方形' },

  // 超宽屏
  { name: '超宽屏 21:9', width: 2560, height: 1080, aspectRatio: '21:9', category: '超宽屏' },
  { name: '超宽屏 32:9', width: 3840, height: 1080, aspectRatio: '32:9', category: '超宽屏' },
]

// ==================== 计算属性 ====================

const currentResolutionText = computed(() => {
  return `${currentResolution.value.aspectRatio}`
})

const customResolutionText = computed(() => {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const divisor = gcd(customWidth.value, customHeight.value)
  const ratioW = customWidth.value / divisor
  const ratioH = customHeight.value / divisor
  return `${ratioW}:${ratioH}`
})

// ==================== 监听器 ====================

// 监听自定义分辨率输入变化，实时更新临时选择
watch([customWidth, customHeight], () => {
  if (showCustomResolution.value) {
    tempSelectedResolution.value = {
      name: '自定义',
      width: customWidth.value,
      height: customHeight.value,
      aspectRatio: customResolutionText.value,
      category: '自定义',
    }
  }
})

// ==================== 方法 ====================

function openModal() {
  // 初始化临时选择为当前分辨率
  tempSelectedResolution.value = currentResolution.value
  showCustomResolution.value = false

  // 如果当前分辨率是自定义的，显示自定义输入
  if (currentResolution.value.category === '自定义') {
    showCustomResolution.value = true
    customWidth.value = currentResolution.value.width
    customHeight.value = currentResolution.value.height
  }

  showModal.value = true
}

function confirmSelection() {
  if (showCustomResolution.value) {
    // 使用自定义分辨率
    const customResolution = {
      name: '自定义',
      width: customWidth.value,
      height: customHeight.value,
      aspectRatio: customResolutionText.value,
      category: '自定义',
    }
    currentResolution.value = customResolution
    videoStore.setVideoResolution(customResolution)
  } else {
    // 使用预设分辨率
    currentResolution.value = tempSelectedResolution.value
    videoStore.setVideoResolution(tempSelectedResolution.value)
  }

  showModal.value = false
  showCustomResolution.value = false
  console.log('确认选择分辨率:', currentResolution.value)
}

function cancelSelection() {
  showModal.value = false
  showCustomResolution.value = false
  // 重置临时选择
  tempSelectedResolution.value = currentResolution.value
}

function selectPresetResolution(resolution: (typeof resolutionOptions)[0]) {
  showCustomResolution.value = false
  tempSelectedResolution.value = resolution
}

function selectCustomResolution() {
  showCustomResolution.value = true
  tempSelectedResolution.value = {
    name: '自定义',
    width: customWidth.value,
    height: customHeight.value,
    aspectRatio: customResolutionText.value,
    category: '自定义',
  }
}

function isSelected(resolution: (typeof resolutionOptions)[0]) {
  return !showCustomResolution.value && 
         tempSelectedResolution.value.width === resolution.width &&
         tempSelectedResolution.value.height === resolution.height
}

// 获取预览样式（根据分辨率比例）
function getPreviewStyle(resolution: { width: number; height: number }) {
  const aspectRatio = resolution.width / resolution.height
  const maxWidth = 60 // 最大宽度
  const maxHeight = 40 // 最大高度

  let width, height
  if (aspectRatio > maxWidth / maxHeight) {
    // 宽度受限
    width = maxWidth
    height = maxWidth / aspectRatio
  } else {
    // 高度受限
    height = maxHeight
    width = maxHeight * aspectRatio
  }

  return {
    width: `${width}px`,
    height: `${height}px`,
  }
}
</script>

<style scoped>
/* 按钮样式 */
.aspect-ratio-btn {
  background: none;
  border: 1px solid var(--color-border-primary);
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--border-radius-medium);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
}

.aspect-ratio-btn:hover {
  background-color: var(--color-bg-quaternary);
  border-color: var(--color-border-secondary);
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-large);
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background-color: var(--color-bg-tertiary);
  border-bottom: 1px solid var(--color-border-primary);
}

.modal-header h3 {
  margin: 0;
  color: white;
  font-size: 16px;
}

.close-btn {
  background: none;
  border: none;
  color: #ccc;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background-color: #444;
  color: white;
}

.modal-content {
  padding: 20px;
  max-height: calc(80vh - 80px);
  overflow-y: auto;
}

.resolution-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.resolution-option {
  background-color: var(--color-bg-tertiary);
  border: 2px solid var(--color-border-primary);
  border-radius: var(--border-radius-medium);
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.resolution-option:hover {
  border-color: var(--color-border-secondary);
  background-color: var(--color-bg-hover);
}

.resolution-option.selected {
  border-color: var(--color-accent-primary);
  background-color: var(--color-bg-active);
}

.resolution-preview {
  background-color: var(--color-bg-primary);
  border: 1px solid var(--color-border-secondary);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-preview {
  width: 60px;
  height: 40px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.resolution-info {
  text-align: center;
}

.resolution-name {
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 4px;
}

.resolution-details {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 2px;
}

.resolution-ratio {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.custom-resolution-inputs {
  margin-top: 20px;
  padding: 16px;
  background-color: var(--color-bg-tertiary);
  border-radius: var(--border-radius-medium);
}

.custom-resolution-inputs h4 {
  margin: 0 0 16px 0;
  color: var(--color-text-primary);
}

.input-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.input-group label {
  min-width: 50px;
  color: var(--color-text-secondary);
}

.resolution-input {
  flex: 1;
  max-width: 100px;
  padding: 6px 8px;
  background-color: var(--color-bg-quaternary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-small);
  color: var(--color-text-primary);
}

.aspect-ratio-display {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-top: 8px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border-primary);
}

.btn {
  padding: 8px 16px;
  border-radius: var(--border-radius-medium);
  border: none;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-secondary {
  background-color: var(--color-bg-quaternary);
  color: var(--color-text-secondary);
}

.btn-secondary:hover {
  background-color: var(--color-bg-hover);
}

.btn-primary {
  background-color: var(--color-accent-primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--color-accent-primary-hover);
}
</style>

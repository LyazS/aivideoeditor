<template>
  <div v-if="show" class="modal-overlay" @click="closeModal">
    <div class="resolution-modal" @click.stop>
      <div class="modal-header">
        <h3>{{ t('editor.selectVideoResolution') }}</h3>
        <button class="close-btn" @click="closeModal">×</button>
      </div>
      <div class="modal-content">
        <!-- 预设分辨率 -->
        <div class="resolution-grid">
          <div
            v-for="resolution in resolutionOptions"
            :key="resolution.name"
            class="resolution-option"
            :class="{
              active:
                tempSelectedResolution.name === resolution.name &&
                tempSelectedResolution.category !== '自定义',
            }"
            @click="selectPresetResolution(resolution)"
          >
            <div class="resolution-preview" :style="getPreviewStyle(resolution)"></div>
            <div class="resolution-info">
              <div class="resolution-name">{{ resolution.name }}</div>
              <div class="resolution-size">{{ resolution.width }} × {{ resolution.height }}</div>
              <div class="resolution-ratio">{{ resolution.aspectRatio }}</div>
            </div>
          </div>

          <!-- 自定义分辨率选项 -->
          <div
            class="resolution-option custom-option"
            :class="{ active: tempSelectedResolution.category === '自定义' }"
            @click="selectCustomResolution"
          >
            <div
              class="resolution-preview"
              :style="getPreviewStyle({ width: customWidth, height: customHeight })"
            ></div>
            <div class="resolution-info">
              <div class="resolution-name">{{ t('editor.custom') }}</div>
              <div v-if="!showCustomInput" class="resolution-size">
                {{ customWidth }} × {{ customHeight }}
              </div>
              <div v-if="!showCustomInput" class="resolution-ratio">
                {{ customResolutionText }}
              </div>

              <!-- 自定义分辨率输入（集成在选项内） -->
              <div v-if="showCustomInput" class="custom-inputs">
                <div class="input-row">
                  <input
                    type="number"
                    v-model.number="customWidth"
                    min="1"
                    max="7680"
                    class="custom-input"
                    :placeholder="t('editor.width')"
                    @click.stop
                  />
                  <span class="input-separator">×</span>
                  <input
                    type="number"
                    v-model.number="customHeight"
                    min="1"
                    max="4320"
                    class="custom-input"
                    :placeholder="t('editor.height')"
                    @click.stop
                  />
                </div>
                <div class="custom-ratio">{{ customResolutionText }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 确认按钮 -->
        <div class="modal-actions">
          <button class="cancel-btn" @click="cancelSelection">{{ t('editor.cancel') }}</button>
          <button class="confirm-btn" @click="confirmSelection">{{ t('editor.confirm') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { useAppI18n } from '@/unified/composables/useI18n'

const props = defineProps<{
  show: boolean
  currentResolution: {
    name: string
    width: number
    height: number
    aspectRatio: string
    category: string
  }
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'confirm', resolution: { name: string; width: number; height: number; aspectRatio: string }): void
}>()

const { t } = useAppI18n()
const unifiedStore = useUnifiedStore()

// 分辨率选项
const resolutionOptions = computed(() => [
  // 横屏 16:9
  { name: t('editor.resolution.4K'), width: 3840, height: 2160, aspectRatio: '16:9', category: t('editor.landscape') },
  { name: t('editor.resolution.1440p'), width: 2560, height: 1440, aspectRatio: '16:9', category: t('editor.landscape') },
  { name: t('editor.resolution.1080p'), width: 1920, height: 1080, aspectRatio: '16:9', category: t('editor.landscape') },
  { name: t('editor.resolution.720p'), width: 1280, height: 720, aspectRatio: '16:9', category: t('editor.landscape') },
  { name: t('editor.resolution.480p'), width: 854, height: 480, aspectRatio: '16:9', category: t('editor.landscape') },

  // 竖屏 9:16
  { name: t('editor.resolution.4KPortrait'), width: 2160, height: 3840, aspectRatio: '9:16', category: t('editor.portrait') },
  { name: t('editor.resolution.1440pPortrait'), width: 1440, height: 2560, aspectRatio: '9:16', category: t('editor.portrait') },
  { name: t('editor.resolution.1080pPortrait'), width: 1080, height: 1920, aspectRatio: '9:16', category: t('editor.portrait') },
  { name: t('editor.resolution.720pPortrait'), width: 720, height: 1280, aspectRatio: '9:16', category: t('editor.portrait') },
  { name: t('editor.resolution.480pPortrait'), width: 480, height: 854, aspectRatio: '9:16', category: t('editor.portrait') },

  // 正方形 1:1
  { name: t('editor.resolution.1080x1080'), width: 1080, height: 1080, aspectRatio: '1:1', category: t('editor.square') },
  { name: t('editor.resolution.720x720'), width: 720, height: 720, aspectRatio: '1:1', category: t('editor.square') },

  // 超宽屏
  { name: t('editor.resolution.ultrawide21x9'), width: 2560, height: 1080, aspectRatio: '21:9', category: t('editor.ultrawide') },
  { name: t('editor.resolution.ultrawide32x9'), width: 3840, height: 1080, aspectRatio: '32:9', category: t('editor.ultrawide') },
])

// 临时选择的分辨率
const tempSelectedResolution = ref({
  name: '1080p',
  width: 1920,
  height: 1080,
  aspectRatio: '16:9',
  category: t('editor.landscape'),
})

// 自定义分辨率
const showCustomInput = ref(false)
const customWidth = ref(1920)
const customHeight = ref(1080)

const customResolutionText = computed(() => {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const divisor = gcd(customWidth.value, customHeight.value)
  const ratioW = customWidth.value / divisor
  const ratioH = customHeight.value / divisor
  return `${ratioW}:${ratioH}`
})

// 监听自定义分辨率输入变化，实时更新临时选择
watch([customWidth, customHeight], () => {
  if (showCustomInput.value) {
    tempSelectedResolution.value = {
      name: t('editor.custom'),
      width: customWidth.value,
      height: customHeight.value,
      aspectRatio: customResolutionText.value,
      category: t('editor.custom'),
    }
  }
})

// 监听props变化，初始化状态
watch(() => props.show, (show) => {
  if (show) {
    initializeModal()
  }
}, { immediate: true })

function initializeModal() {
  // 初始化临时选择为当前分辨率
  tempSelectedResolution.value = {
    name: props.currentResolution.name,
    width: props.currentResolution.width,
    height: props.currentResolution.height,
    aspectRatio: props.currentResolution.aspectRatio,
    category: props.currentResolution.category,
  }
  
  showCustomInput.value = false

  // 如果当前分辨率是自定义的，显示自定义输入
  if (props.currentResolution.category === t('editor.custom')) {
    showCustomInput.value = true
    customWidth.value = props.currentResolution.width
    customHeight.value = props.currentResolution.height
  }
}

function closeModal() {
  emit('update:show', false)
}

function confirmSelection() {
  let selectedResolution

  if (showCustomInput.value) {
    // 使用自定义分辨率
    selectedResolution = {
      name: t('editor.custom'),
      width: customWidth.value,
      height: customHeight.value,
      aspectRatio: customResolutionText.value,
    }
  } else {
    // 使用预设分辨率，转换为VideoResolution格式
    selectedResolution = {
      name: tempSelectedResolution.value.name,
      width: tempSelectedResolution.value.width,
      height: tempSelectedResolution.value.height,
      aspectRatio: tempSelectedResolution.value.aspectRatio,
    }
  }

  emit('confirm', selectedResolution)
  closeModal()
}

function cancelSelection() {
  closeModal()
  // 重置临时选择为当前分辨率
  tempSelectedResolution.value = {
    name: props.currentResolution.name,
    width: props.currentResolution.width,
    height: props.currentResolution.height,
    aspectRatio: props.currentResolution.aspectRatio,
    category: props.currentResolution.category,
  }
  showCustomInput.value = false
}

function selectPresetResolution(resolution: { name: string; width: number; height: number; aspectRatio: string; category: string }) {
  showCustomInput.value = false
  tempSelectedResolution.value = resolution
}

function selectCustomResolution() {
  showCustomInput.value = true
  tempSelectedResolution.value = {
    name: t('editor.custom'),
    width: customWidth.value,
    height: customHeight.value,
    aspectRatio: customResolutionText.value,
    category: t('editor.custom'),
  }
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
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.resolution-modal {
  background-color: #2a2a2a;
  border-radius: 8px;
  padding: 0;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #444;
  background-color: #2a2a2a;
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
  background-color: #333;
  border: 2px solid #444;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.resolution-option:hover {
  border-color: #666;
  background-color: #3a3a3a;
}

.resolution-option.active {
  border-color: #ff4444;
  background-color: #4a2a2a;
}

.resolution-preview {
  background-color: #555;
  border: 1px solid #666;
  border-radius: 3px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.resolution-option:hover .resolution-preview {
  background-color: #666;
  border-color: #777;
}

.resolution-option.active .resolution-preview {
  background-color: #ff4444;
  border-color: #ff6666;
}

.resolution-info {
  text-align: center;
  flex: 1;
}

.resolution-name {
  font-weight: bold;
  color: white;
  margin-bottom: 4px;
  font-size: 13px;
}

.resolution-size {
  color: #ccc;
  font-size: 11px;
  margin-bottom: 2px;
}

.resolution-ratio {
  color: #999;
  font-size: 10px;
  font-family: monospace;
}

/* 自定义分辨率输入（集成在选项内） */
.custom-inputs {
  width: 100%;
  margin-top: 4px;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.custom-input {
  flex: 1;
  padding: 4px 6px;
  background-color: #444;
  border: 1px solid #555;
  border-radius: 3px;
  color: white;
  font-size: 11px;
  text-align: center;
  min-width: 0;
}

.custom-input:focus {
  outline: none;
  border-color: #ff4444;
}

.input-separator {
  color: #ccc;
  font-size: 12px;
  font-weight: bold;
}

.custom-ratio {
  color: #999;
  font-size: 10px;
  font-family: monospace;
  text-align: center;
}

/* 模态框按钮 */
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #444;
}

.cancel-btn,
.confirm-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.cancel-btn {
  background-color: #555;
  color: #ccc;
}

.cancel-btn:hover {
  background-color: #666;
  color: white;
}

.confirm-btn {
  background-color: #ff4444;
  color: white;
}

.confirm-btn:hover {
  background-color: #ff6666;
}

/* 滚动条样式已在全局样式中定义 */
</style>
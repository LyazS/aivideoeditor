<template>
  <div class="video-preview-engine">
    <!-- 状态栏 -->
    <div class="status-bar-container">
      <div class="status-bar">
        <div class="status-content">
          <span class="app-title">AI编辑器</span>
        </div>
      </div>
    </div>

    <div class="main-content">
      <!-- 预览区域：三列布局 -->
      <div class="preview-section" :style="{ height: previewHeight + '%' }">
        <!-- 左侧：素材库 -->
        <div class="media-library-panel" :style="{ width: leftPanelWidth + 'px' }">
          <MediaLibrary />
        </div>

        <!-- 左侧分割器 -->
        <div
          class="splitter vertical left-splitter"
          @mousedown="startLeftResize"
          :class="{ dragging: isLeftDragging }"
        >
          <div class="splitter-handle"></div>
        </div>

        <!-- 中间：预览窗口和控制面板 -->
        <div class="preview-center">
          <PreviewWindow />
          <!-- 播放控制面板紧贴在预览窗口下方 -->
          <div class="controls-section">
            <!-- 时间显示 -->
            <div class="time-display">
              {{ formatTime(videoStore.currentTime) }} /
              {{ formatTime(videoStore.contentEndTime || videoStore.totalDuration) }}
            </div>
            <!-- 中间播放控制 -->
            <div class="center-controls">
              <PlaybackControls />
            </div>
            <!-- 右侧比例按钮 -->
            <div class="right-controls">
              <button class="aspect-ratio-btn" @click="openResolutionModal" title="设置视频分辨率">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M19,12H22L18,8L14,12H17V16H7V12H10L6,8L2,12H5V16A2,2 0 0,0 7,18H17A2,2 0 0,0 19,16V12Z"
                  />
                </svg>
                <span class="aspect-ratio-text">{{ currentResolutionText }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 右侧分割器 -->
        <div
          class="splitter vertical right-splitter"
          @mousedown="startRightResize"
          :class="{ dragging: isRightDragging }"
        >
          <div class="splitter-handle"></div>
        </div>

        <!-- 右侧：属性面板 -->
        <div class="properties-panel-container" :style="{ width: rightPanelWidth + 'px' }">
          <PropertiesPanel />
        </div>
      </div>

      <!-- 可拖动的分割器 -->
      <div class="splitter horizontal" @mousedown="startResize" :class="{ dragging: isDragging }">
        <div class="splitter-handle"></div>
      </div>

      <!-- 时间轴区域 -->
      <div class="timeline-section" :style="{ height: timelineHeight + '%' }">
        <!-- 片段管理工具栏在时间刻度上方 -->
        <div class="clip-management-toolbar">
          <ClipManagementToolbar />
        </div>
        <!-- 只有WebAV初始化完成后才显示Timeline -->
        <Timeline v-if="videoStore.isWebAVReady" />
        <div v-else class="timeline-loading">
          <div class="loading-spinner"></div>
          <p>正在初始化WebAV引擎...</p>
        </div>
      </div>
    </div>

    <!-- 分辨率选择弹窗 -->
    <div v-if="showResolutionModal" class="modal-overlay" @click="showResolutionModal = false">
      <div class="resolution-modal" @click.stop>
        <div class="modal-header">
          <h3>选择视频分辨率</h3>
          <button class="close-btn" @click="showResolutionModal = false">×</button>
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
                <div class="resolution-name">自定义</div>
                <div v-if="!showCustomResolution" class="resolution-size">
                  {{ customWidth }} × {{ customHeight }}
                </div>
                <div v-if="!showCustomResolution" class="resolution-ratio">
                  {{ customResolutionText }}
                </div>

                <!-- 自定义分辨率输入（集成在选项内） -->
                <div v-if="showCustomResolution" class="custom-inputs">
                  <div class="input-row">
                    <input
                      type="number"
                      v-model.number="customWidth"
                      min="1"
                      max="7680"
                      class="custom-input"
                      placeholder="宽度"
                      @click.stop
                    />
                    <span class="input-separator">×</span>
                    <input
                      type="number"
                      v-model.number="customHeight"
                      min="1"
                      max="4320"
                      class="custom-input"
                      placeholder="高度"
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
            <button class="cancel-btn" @click="cancelSelection">取消</button>
            <button class="confirm-btn" @click="confirmSelection">确认</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import PreviewWindow from './PreviewWindow.vue'
import Timeline from './Timeline.vue'
import PlaybackControls from './PlaybackControls.vue'
import ClipManagementToolbar from './ClipManagementToolbar.vue'
import MediaLibrary from './MediaLibrary.vue'
import PropertiesPanel from './PropertiesPanel.vue'
import { useVideoStore } from '../stores/videoStore'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts'
import { logWebAVReadyStateChange, logComponentLifecycle } from '../utils/webavDebug'

const videoStore = useVideoStore()

// 注册全局快捷键
useKeyboardShortcuts()

// 添加WebAV就绪状态监听
watch(
  () => videoStore.isWebAVReady,
  (isReady, wasReady) => {
    logWebAVReadyStateChange(isReady, wasReady)
  },
  { immediate: true },
)

onMounted(async () => {
  logComponentLifecycle('VideoPreviewEngine', 'mounted', {
    isWebAVReady: videoStore.isWebAVReady,
    hasAVCanvas: !!videoStore.avCanvas,
  })

  // 初始化现代化操作系统
  try {
    console.log('🚀 初始化现代化操作系统...')
    const success = await videoStore.initializeOperationSystem()
    if (success) {
      console.log('✅ 现代化操作系统初始化成功')
    } else {
      console.warn('⚠️ 现代化操作系统初始化失败')
    }
  } catch (error) {
    console.error('❌ 现代化操作系统初始化出错:', error)
  }
})

// 响应式数据
const previewHeight = ref(60) // 默认预览窗口占60%
const timelineHeight = ref(40) // 默认时间轴占40%
const isDragging = ref(false)

// 分辨率相关
const showResolutionModal = ref(false)
const currentResolution = ref({
  name: '1080p',
  width: 1920,
  height: 1080,
  aspectRatio: '16:9',
  category: '横屏',
})

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
  { name: '480p 竖屏', width: 480, height: 854, aspectRatio: '9:16', category: '竖屏' },

  // 正方形 1:1
  { name: '1080×1080', width: 1080, height: 1080, aspectRatio: '1:1', category: '正方形' },
  { name: '720×720', width: 720, height: 720, aspectRatio: '1:1', category: '正方形' },

  // 超宽屏
  { name: '超宽屏 21:9', width: 2560, height: 1080, aspectRatio: '21:9', category: '超宽屏' },
  { name: '超宽屏 32:9', width: 3840, height: 1080, aspectRatio: '32:9', category: '超宽屏' },
]

const currentResolutionText = computed(() => {
  return `${currentResolution.value.aspectRatio}`
})

// 临时选择的分辨率（在弹窗中选择但未确认）
const tempSelectedResolution = ref(currentResolution.value)

// 自定义分辨率
const showCustomResolution = ref(false)
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

// 垂直分割器相关
const leftPanelWidth = ref(400) // 左侧素材库宽度
const rightPanelWidth = ref(400) // 右侧属性面板宽度
const isLeftDragging = ref(false)
const isRightDragging = ref(false)

let startY = 0
let startPreviewHeight = 0
let startX = 0
let startLeftWidth = 0
let startRightWidth = 0

// 开始拖动
const startResize = (event: MouseEvent) => {
  isDragging.value = true
  startY = event.clientY
  startPreviewHeight = previewHeight.value

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
}

// 处理拖动
const handleResize = (event: MouseEvent) => {
  if (!isDragging.value) return

  const deltaY = event.clientY - startY
  const containerHeight = document.querySelector('.main-content')?.clientHeight || 600
  const deltaPercent = (deltaY / containerHeight) * 100

  let newPreviewHeight = startPreviewHeight + deltaPercent

  // 限制最小和最大高度
  newPreviewHeight = Math.max(20, Math.min(80, newPreviewHeight))

  previewHeight.value = newPreviewHeight
  timelineHeight.value = 100 - newPreviewHeight
}

// 停止拖动
const stopResize = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// 左侧分割器拖拽
const startLeftResize = (event: MouseEvent) => {
  isLeftDragging.value = true
  startX = event.clientX
  startLeftWidth = leftPanelWidth.value

  document.addEventListener('mousemove', handleLeftResize)
  document.addEventListener('mouseup', stopLeftResize)
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
}

const handleLeftResize = (event: MouseEvent) => {
  if (!isLeftDragging.value) return

  const deltaX = event.clientX - startX
  let newWidth = startLeftWidth + deltaX

  // 限制最小宽度，允许更大的最大宽度
  newWidth = Math.max(100, Math.min(600, newWidth))

  leftPanelWidth.value = newWidth
}

const stopLeftResize = () => {
  isLeftDragging.value = false
  document.removeEventListener('mousemove', handleLeftResize)
  document.removeEventListener('mouseup', stopLeftResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// 右侧分割器拖拽
const startRightResize = (event: MouseEvent) => {
  isRightDragging.value = true
  startX = event.clientX
  startRightWidth = rightPanelWidth.value

  document.addEventListener('mousemove', handleRightResize)
  document.addEventListener('mouseup', stopRightResize)
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
}

const handleRightResize = (event: MouseEvent) => {
  if (!isRightDragging.value) return

  const deltaX = event.clientX - startX
  let newWidth = startRightWidth - deltaX // 注意：右侧是反向的

  // 限制最小宽度，允许更大的最大宽度
  newWidth = Math.max(100, Math.min(600, newWidth))

  rightPanelWidth.value = newWidth
}

const stopRightResize = () => {
  isRightDragging.value = false
  document.removeEventListener('mousemove', handleRightResize)
  document.removeEventListener('mouseup', stopRightResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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

  showResolutionModal.value = false
  showCustomResolution.value = false
  console.log('确认选择分辨率:', currentResolution.value)
}

function cancelSelection() {
  showResolutionModal.value = false
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

function openResolutionModal() {
  // 初始化临时选择为当前分辨率
  tempSelectedResolution.value = currentResolution.value
  showCustomResolution.value = false

  // 如果当前分辨率是自定义的，显示自定义输入
  if (currentResolution.value.category === '自定义') {
    showCustomResolution.value = true
    customWidth.value = currentResolution.value.width
    customHeight.value = currentResolution.value.height
  }

  showResolutionModal.value = true
}

// 清理事件监听器
onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('mousemove', handleLeftResize)
  document.removeEventListener('mouseup', stopLeftResize)
  document.removeEventListener('mousemove', handleRightResize)
  document.removeEventListener('mouseup', stopRightResize)
})
</script>

<style scoped>
.video-preview-engine {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.status-bar-container {
  padding: var(--spacing-sm) var(--spacing-sm) 0 var(--spacing-sm);
  flex-shrink: 0;
}

.status-bar {
  height: 30px;
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-medium);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0 var(--spacing-lg);
}

.status-content {
  display: flex;
  align-items: center;
  width: 100%;
}

.app-title {
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  font-weight: 500;
  letter-spacing: 0.5px;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--spacing-sm);
  height: calc(100vh - 48px);
  overflow: hidden;
}

.preview-section {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  min-height: 20%;
}

.media-library-panel {
  flex-shrink: 0;
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-medium);
  min-width: 100px;
  max-width: 600px;
}

/* 使用通用的 splitter 样式 */

.preview-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  min-width: 200px;
  overflow: hidden;
  background-color: var(--color-bg-primary);
}

.properties-panel-container {
  flex-shrink: 0;
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-medium);
  min-width: 100px;
  max-width: 600px;
}

/* 使用通用的 splitter 样式 */

.timeline-section {
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-xs);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 20%;
}

.timeline-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  gap: var(--spacing-lg);
}

.timeline-loading .loading-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--color-bg-tertiary);
  border-top: 3px solid var(--color-accent-warning);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.timeline-loading p {
  font-size: var(--font-size-lg);
  margin: 0;
}

.clip-management-toolbar {
  /* 片段管理工具栏 */
  flex-shrink: 0;
}

.controls-section {
  height: 50px;
  width: 100%;
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-large);
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-md);
  flex-shrink: 0;
  min-width: 200px;
  overflow: hidden;
}

.time-display {
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  font-family: monospace;
  flex-shrink: 0;
  min-width: 80px;
}

.center-controls {
  flex: 1;
  display: flex;
  justify-content: center;
  background-color: var(--color-bg-secondary);
}

.right-controls {
  min-width: 80px;
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-xs);
}

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
  color: var(--color-text-primary);
}

.aspect-ratio-text {
  font-family: monospace;
}

/* 分辨率选择弹窗样式 */
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

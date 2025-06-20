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
            <!-- 右侧分辨率选择器 -->
            <div class="right-controls">
              <ResolutionSelector />
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
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import PreviewWindow from './PreviewWindow.vue'
import Timeline from './Timeline.vue'
import PlaybackControls from './PlaybackControls.vue'
import ClipManagementToolbar from './ClipManagementToolbar.vue'
import MediaLibrary from './MediaLibrary.vue'
import PropertiesPanel from './PropertiesPanel.vue'
import ResolutionSelector from './ResolutionSelector.vue'
import { useVideoStore } from '../stores/videoStore'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts'
import { logWebAVReadyStateChange, logComponentLifecycle } from '../utils/webavDebug'
import { formatTime as formatTimeUtil } from '../stores/utils/storeUtils'

const videoStore = useVideoStore()

// 注册全局快捷键
useKeyboardShortcuts()

// 响应式数据
const previewHeight = ref(50) // 默认预览窗口占50%
const timelineHeight = ref(50) // 默认时间轴占50%
const isDragging = ref(false)

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

// 添加WebAV就绪状态监听
watch(
  () => videoStore.isWebAVReady,
  (isReady, wasReady) => {
    logWebAVReadyStateChange(isReady, wasReady)
  },
  { immediate: true },
)

onMounted(() => {
  logComponentLifecycle('VideoPreviewEngine', 'mounted', {
    isWebAVReady: videoStore.isWebAVReady,
    hasAVCanvas: !!videoStore.avCanvas,
  })
})

// ==================== 拖拽处理方法 ====================

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
  newWidth = Math.max(100, Math.min(800, newWidth))

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
  newWidth = Math.max(100, Math.min(800, newWidth))

  rightPanelWidth.value = newWidth
}

const stopRightResize = () => {
  isRightDragging.value = false
  document.removeEventListener('mousemove', handleRightResize)
  document.removeEventListener('mouseup', stopRightResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// ==================== 工具方法 ====================

function formatTime(seconds: number): string {
  // 使用统一的时间格式化工具函数
  return formatTimeUtil(seconds, 'seconds')
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
  max-width: 800px;
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
  max-width: 800px;
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

/* 分割器样式 */
.splitter {
  background-color: var(--color-bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--transition-fast);
  position: relative;
  z-index: 10;
}

.splitter.horizontal {
  height: 8px;
  cursor: ns-resize;
  flex-direction: row;
}

.splitter.vertical {
  width: 8px;
  cursor: ew-resize;
  flex-direction: column;
}

.splitter:hover {
  background-color: var(--color-bg-hover);
}

.splitter.dragging {
  background-color: var(--color-accent-primary);
}

.splitter-handle {
  background-color: var(--color-border-secondary);
  border-radius: 2px;
  transition: background-color var(--transition-fast);
}

.horizontal .splitter-handle {
  width: 40px;
  height: 2px;
}

.vertical .splitter-handle {
  width: 2px;
  height: 40px;
}

.splitter:hover .splitter-handle,
.splitter.dragging .splitter-handle {
  background-color: var(--color-accent-primary);
}

/* 动画 */
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>

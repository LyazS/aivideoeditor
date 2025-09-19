<template>
  <div class="video-preview-engine">
    <!-- 预览区域：三列布局 -->
    <div class="preview-section" :style="{ height: previewHeight + '%' }">
      <!-- 左侧：素材库 -->
      <div class="media-library-panel" :style="{ width: leftPanelWidth + 'px' }">
        <UnifiedMediaLibrary />
      </div>

      <!-- 左侧分割器 -->
      <div
        class="splitter vertical left-splitter"
        @mousedown="startLeftResize"
        :class="{ dragging: isLeftDragging }"
      ></div>

      <!-- 中间：预览窗口（包含控制面板和分辨率弹窗） -->
      <div class="preview-center">
        <PreviewWindow />
      </div>

      <!-- 右侧分割器 -->
      <div
        class="splitter vertical right-splitter"
        @mousedown="startRightResize"
        :class="{ dragging: isRightDragging }"
      ></div>

      <!-- 右侧：属性面板 -->
      <div class="properties-panel-container" :style="{ width: rightPanelWidth + 'px' }">
        <UnifiedPropertiesPanel />
      </div>
    </div>

    <!-- 可拖动的分割器 -->
    <div
      class="splitter horizontal"
      @mousedown="startResize"
      :class="{ dragging: isDragging }"
    ></div>

    <!-- 时间轴区域 -->
    <div class="timeline-section" :style="{ height: timelineHeight + '%' }">
      <!-- 片段管理工具栏在时间刻度上方 -->
      <div class="clip-management-toolbar">
        <UnifiedClipManagementToolbar />
      </div>
      <!-- 只有WebAV初始化完成后才显示Timeline -->
      <UnifiedTimeline v-if="unifiedStore.isWebAVReady" />
      <div v-else class="timeline-loading">
        <div class="loading-spinner"></div>
        <p>{{ t('editor.initializingWebAV') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import PreviewWindow from './PreviewWindow.vue'
import UnifiedMediaLibrary from '@/unified/components/UnifiedMediaLibrary.vue'
import UnifiedTimeline from '@/unified/components/UnifiedTimeline.vue'
import UnifiedPlaybackControls from '@/unified/components/UnifiedPlaybackControls.vue'
import UnifiedClipManagementToolbar from '@/unified/components/UnifiedClipManagementToolbar.vue'
import UnifiedPropertiesPanel from '@/unified/components/UnifiedPropertiesPanel.vue'
import RemixIcon from './icons/RemixIcon.vue'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { useKeyboardShortcuts } from '@/unified/composables'
import { logWebAVReadyStateChange, logComponentLifecycle } from '@/unified/utils/webavDebug'
import { framesToTimecode } from '@/unified/utils/timeUtils'
import { useAppI18n } from '@/unified/composables/useI18n'

const unifiedStore = useUnifiedStore()
const { t } = useAppI18n()

// 注册全局快捷键
useKeyboardShortcuts()

// 添加WebAV就绪状态监听
watch(
  () => unifiedStore.isWebAVReady,
  (isReady, wasReady) => {
    logWebAVReadyStateChange(isReady, wasReady)
  },
  { immediate: true },
)

// 窗口大小变化时调整面板宽度
const adjustPanelWidths = () => {
  const container = document.querySelector('.video-preview-engine')
  const containerWidth = container ? container.clientWidth : window.innerWidth

  // 计算最大允许宽度
  const totalPanelWidth = leftPanelWidth.value + rightPanelWidth.value
  const availableWidth = containerWidth - 220 // 减去分割器和最小预览区域宽度

  if (totalPanelWidth > availableWidth) {
    // 按比例缩小两个面板
    const ratio = availableWidth / totalPanelWidth
    leftPanelWidth.value = Math.max(100, leftPanelWidth.value * ratio)
    rightPanelWidth.value = Math.max(100, rightPanelWidth.value * ratio)
  }
}

onMounted(() => {
  logComponentLifecycle('VideoPreviewEngine', 'mounted', {
    isWebAVReady: unifiedStore.isWebAVReady,
    hasAVCanvas: !!unifiedStore.avCanvas,
  })

  // 添加窗口大小变化监听器
  window.addEventListener('resize', adjustPanelWidths)
})

// 响应式数据
const previewHeight = ref(45) // 默认预览窗口占45%
const timelineHeight = ref(55) // 默认时间轴占55%
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
  const container = document.querySelector('.video-preview-engine')
  const containerHeight = container ? container.clientHeight : 600
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

  // 获取容器宽度
  const container = document.querySelector('.video-preview-engine')
  const containerWidth = container ? container.clientWidth : window.innerWidth

  // 计算可用宽度（总宽度减去右侧面板宽度和分割器宽度）
  const availableWidth = containerWidth - rightPanelWidth.value - 20 // 20px为分割器宽度

  // 限制最小宽度和最大宽度，确保不超出可用空间
  const maxAllowedWidth = Math.min(800, availableWidth - 200) // 至少保留200px给中间预览区域
  newWidth = Math.max(100, Math.min(maxAllowedWidth, newWidth))

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

  // 获取容器宽度
  const container = document.querySelector('.video-preview-engine')
  const containerWidth = container ? container.clientWidth : window.innerWidth

  // 计算可用宽度（总宽度减去左侧面板宽度和分割器宽度）
  const availableWidth = containerWidth - leftPanelWidth.value - 20 // 20px为分割器宽度

  // 限制最小宽度和最大宽度，确保不超出可用空间
  const maxAllowedWidth = Math.min(800, availableWidth - 200) // 至少保留200px给中间预览区域
  newWidth = Math.max(100, Math.min(maxAllowedWidth, newWidth))

  rightPanelWidth.value = newWidth
}

const stopRightResize = () => {
  isRightDragging.value = false
  document.removeEventListener('mousemove', handleRightResize)
  document.removeEventListener('mouseup', stopRightResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// 清理事件监听器
onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('mousemove', handleLeftResize)
  document.removeEventListener('mouseup', stopLeftResize)
  document.removeEventListener('mousemove', handleRightResize)
  document.removeEventListener('mouseup', stopRightResize)
  window.removeEventListener('resize', adjustPanelWidths)
})
</script>

<style scoped>
.video-preview-engine {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  padding: var(--spacing-sm);
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

/* 分割器样式 - 从 common.css 迁移 */
.splitter {
  background-color: transparent;
  cursor: ew-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: background-color var(--transition-fast);
  flex-shrink: 0;
}

.splitter.vertical {
  width: 8px;
  cursor: ew-resize;
}

.splitter.horizontal {
  height: 8px;
  cursor: ns-resize;
}

.splitter:hover {
  background-color: transparent;
}

.splitter.dragging {
  background-color: transparent;
}

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

.timeline-section {
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-medium);
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
</style>

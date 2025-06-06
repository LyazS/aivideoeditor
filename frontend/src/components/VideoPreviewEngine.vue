<template>
  <div class="video-preview-engine">
    <div class="main-content">
      <!-- 预览区域：三列布局 -->
      <div class="preview-section" :style="{ height: previewHeight + '%' }">
        <!-- 左侧：素材库 -->
        <div class="media-library-panel" :style="{ width: leftPanelWidth + 'px' }">
          <MediaLibrary />
        </div>

        <!-- 左侧分割器 -->
        <div
          class="vertical-splitter left-splitter"
          @mousedown="startLeftResize"
          :class="{ 'dragging': isLeftDragging }"
        >
          <div class="vertical-splitter-handle"></div>
        </div>

        <!-- 中间：预览窗口和控制面板 -->
        <div class="preview-center">
          <PreviewWindow />
          <!-- 播放控制面板紧贴在预览窗口下方 -->
          <div class="controls-section">
            <!-- 时间显示 -->
            <div class="time-display">
              {{ formatTime(videoStore.currentTime) }} / {{ formatTime(videoStore.contentEndTime || videoStore.totalDuration) }}
            </div>
            <!-- 中间播放控制 -->
            <div class="center-controls">
              <PlaybackControls />
            </div>
            <!-- 右侧占位 -->
            <div class="right-spacer"></div>
          </div>
        </div>

        <!-- 右侧分割器 -->
        <div
          class="vertical-splitter right-splitter"
          @mousedown="startRightResize"
          :class="{ 'dragging': isRightDragging }"
        >
          <div class="vertical-splitter-handle"></div>
        </div>

        <!-- 右侧：属性面板 -->
        <div class="properties-panel-container" :style="{ width: rightPanelWidth + 'px' }">
          <PropertiesPanel />
        </div>
      </div>

      <!-- 可拖动的分割器 -->
      <div
        class="resizable-splitter"
        @mousedown="startResize"
        :class="{ 'dragging': isDragging }"
      >
        <div class="splitter-handle"></div>
      </div>

      <!-- 时间轴区域 -->
      <div class="timeline-section" :style="{ height: timelineHeight + '%' }">
        <!-- 片段管理工具栏在时间刻度上方 -->
        <div class="clip-management-toolbar">
          <ClipManagementToolbar />
        </div>
        <Timeline />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import PreviewWindow from './PreviewWindow.vue'
import Timeline from './Timeline.vue'
import PlaybackControls from './PlaybackControls.vue'
import ClipManagementToolbar from './ClipManagementToolbar.vue'
import MediaLibrary from './MediaLibrary.vue'
import PropertiesPanel from './PropertiesPanel.vue'
import { useVideoStore } from '../stores/counter'

const videoStore = useVideoStore()

// 响应式数据
const previewHeight = ref(60) // 默认预览窗口占60%
const timelineHeight = ref(40) // 默认时间轴占40%
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
  background-color: #1a1a1a;
  color: white;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  height: calc(100vh - 40px); /* 减去padding */
  overflow: hidden;
}

.preview-section {
  /* 三列布局容器 */
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  min-height: 20%; /* 最小高度 */
}

.media-library-panel {
  flex-shrink: 0;
  background-color: #2a2a2a;
  border-radius: 8px;
  min-width: 100px;
  max-width: 600px;
}

.vertical-splitter {
  width: 8px;
  background-color: transparent;
  cursor: ew-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: background-color 0.2s ease;
  flex-shrink: 0;
}

.vertical-splitter:hover {
  background-color: transparent;
}

.vertical-splitter.dragging {
  background-color: transparent;
}

.vertical-splitter-handle {
  width: 4px;
  height: 40px;
  background-color: #666;
  border-radius: 2px;
  transition: background-color 0.2s ease;
}

.vertical-splitter:hover .vertical-splitter-handle {
  background-color: #888;
}

.vertical-splitter.dragging .vertical-splitter-handle {
  background-color: #fff;
}

.preview-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  min-width: 200px; /* 减小最小宽度，允许更多压缩 */
  overflow: hidden;
  background-color: #1a1a1a;
}

.properties-panel-container {
  flex-shrink: 0;
  background-color: #2a2a2a;
  border-radius: 8px;
  min-width: 100px;
  max-width: 600px;
}

.resizable-splitter {
  height: 8px;
  background-color: transparent;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: background-color 0.2s ease;
  flex-shrink: 0;
}

.resizable-splitter:hover {
  background-color: transparent;
}

.resizable-splitter.dragging {
  background-color: transparent;
}

.splitter-handle {
  width: 40px;
  height: 4px;
  background-color: #666;
  border-radius: 2px;
  transition: background-color 0.2s ease;
}

.resizable-splitter:hover .splitter-handle {
  background-color: #888;
}

.resizable-splitter.dragging .splitter-handle {
  background-color: #fff;
}

.timeline-section {
  background-color: #2a2a2a;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 20%; /* 最小高度 */
}

.clip-management-toolbar {
  /* 片段管理工具栏 */
  flex-shrink: 0;
}

.controls-section {
  /* 可压缩的控制面板 */
  height: 50px;
  width: 100%;
  background-color: #333;
  border-radius: 6px;
  display: flex;
  align-items: center;
  padding: 0 8px; /* 减小内边距以适应压缩 */
  flex-shrink: 0;
  min-width: 200px; /* 设置最小宽度 */
  overflow: hidden; /* 防止内容溢出 */
}

.time-display {
  color: #ccc;
  font-size: 12px;
  font-family: monospace;
  flex-shrink: 0; /* 防止时间显示被压缩 */
  min-width: 80px; /* 确保有足够空间显示时间 */
}

.center-controls {
  flex: 1; /* 占据中间剩余空间 */
  display: flex;
  justify-content: center; /* 中间对齐 */
}

.right-spacer {
  min-width: 80px; /* 与左侧时间显示对称 */
  flex-shrink: 0;
}
</style>

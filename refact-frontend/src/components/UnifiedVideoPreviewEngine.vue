<template>
  <div class="video-preview-engine">
    <div class="main-content">
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
        >
          <div class="splitter-handle"></div>
        </div>

        <!-- 中间：预览窗口和控制面板 -->
        <div class="preview-center">
          <UnifiedPreviewWindow />
          <!-- 播放控制面板紧贴在预览窗口下方 -->
          <div class="controls-section">
            <!-- 时间显示 -->
            <div class="time-display">
              00:00:00 / 00:00:00
            </div>
            <!-- 中间播放控制 -->
            <div class="center-controls">
              <UnifiedPlaybackControls />
            </div>
            <!-- 右侧比例按钮 -->
            <div class="right-controls">
              <button class="aspect-ratio-btn" @click="openResolutionModal" title="设置视频分辨率">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M19,12H22L18,8L14,12H17V16H7V12H10L6,8L2,12H5V16A2,2 0 0,0 7,18H17A2,2 0 0,0 19,16V12Z"
                  />
                </svg>
                <span class="aspect-ratio-text">1920×1080</span>
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
          <UnifiedPropertiesPanel />
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
          <UnifiedClipManagementToolbar />
        </div>
        <!-- 时间轴组件 -->
        <UnifiedTimeline />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import UnifiedMediaLibrary from './UnifiedMediaLibrary.vue'
import UnifiedPreviewWindow from './UnifiedPreviewWindow.vue'
import UnifiedPlaybackControls from './UnifiedPlaybackControls.vue'
import UnifiedPropertiesPanel from './UnifiedPropertiesPanel.vue'
import UnifiedTimeline from './UnifiedTimeline.vue'
import UnifiedClipManagementToolbar from './UnifiedClipManagementToolbar.vue'

// 布局状态
const previewHeight = ref(60) // 预览区域高度百分比
const timelineHeight = ref(40) // 时间轴区域高度百分比
const leftPanelWidth = ref(280) // 左侧面板宽度
const rightPanelWidth = ref(280) // 右侧面板宽度

// 拖拽状态
const isDragging = ref(false)
const isLeftDragging = ref(false)
const isRightDragging = ref(false)

// 空壳方法 - 分割器拖拽
const startResize = (event: MouseEvent) => {
  isDragging.value = true
  const startY = event.clientY
  const startPreviewHeight = previewHeight.value
  
  const handleMouseMove = (e: MouseEvent) => {
    const deltaY = e.clientY - startY
    const containerHeight = window.innerHeight - 48 // 减去状态栏高度
    const deltaPercent = (deltaY / containerHeight) * 100
    
    const newPreviewHeight = Math.max(30, Math.min(80, startPreviewHeight + deltaPercent))
    previewHeight.value = newPreviewHeight
    timelineHeight.value = 100 - newPreviewHeight
  }
  
  const handleMouseUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const startLeftResize = (event: MouseEvent) => {
  isLeftDragging.value = true
  const startX = event.clientX
  const startWidth = leftPanelWidth.value
  
  const handleMouseMove = (e: MouseEvent) => {
    const deltaX = e.clientX - startX
    const newWidth = Math.max(200, Math.min(500, startWidth + deltaX))
    leftPanelWidth.value = newWidth
  }
  
  const handleMouseUp = () => {
    isLeftDragging.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const startRightResize = (event: MouseEvent) => {
  isRightDragging.value = true
  const startX = event.clientX
  const startWidth = rightPanelWidth.value
  
  const handleMouseMove = (e: MouseEvent) => {
    const deltaX = startX - e.clientX
    const newWidth = Math.max(200, Math.min(500, startWidth + deltaX))
    rightPanelWidth.value = newWidth
  }
  
  const handleMouseUp = () => {
    isRightDragging.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const openResolutionModal = () => {
  console.log('Resolution modal (empty shell)')
}
</script>

<style scoped>
.video-preview-engine {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-primary);
}

.main-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.preview-section {
  display: flex;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border-primary);
}

.media-library-panel {
  flex-shrink: 0;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border-primary);
}

.preview-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 400px;
}

.properties-panel-container {
  flex-shrink: 0;
  background: var(--color-bg-secondary);
  border-left: 1px solid var(--color-border-primary);
}

.controls-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border-primary);
  height: 48px;
  flex-shrink: 0;
}

.time-display {
  font-family: monospace;
  font-size: 14px;
  color: var(--color-text-primary);
  min-width: 120px;
}

.center-controls {
  flex: 1;
  display: flex;
  justify-content: center;
}

.right-controls {
  min-width: 120px;
  display: flex;
  justify-content: flex-end;
}

.aspect-ratio-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: 4px;
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.aspect-ratio-btn:hover {
  background: var(--color-bg-secondary);
}

.splitter {
  background: var(--color-border-primary);
  cursor: col-resize;
  position: relative;
  transition: background-color 0.2s ease;
}

.splitter.horizontal {
  height: 4px;
  cursor: row-resize;
}

.splitter.vertical {
  width: 4px;
}

.splitter:hover,
.splitter.dragging {
  background: var(--color-accent-primary);
}

.splitter-handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--color-text-secondary);
  border-radius: 2px;
}

.splitter.horizontal .splitter-handle {
  width: 40px;
  height: 2px;
}

.splitter.vertical .splitter-handle {
  width: 2px;
  height: 40px;
}

.timeline-section {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
}

.clip-management-toolbar {
  flex-shrink: 0;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-primary);
  height: 40px;
}
</style>

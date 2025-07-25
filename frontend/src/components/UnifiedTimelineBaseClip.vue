<template>
  <div
    :class="clipClasses"
    :style="clipStyle"
    :data-media-type="timelineItem.mediaType"
    :data-timeline-item-id="timelineItem.id"
    :draggable="true"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @click="selectClip"
    @mouseenter="showTooltip"
    @mousemove="updateTooltipPosition"
    @mouseleave="hideTooltip"
  >
    <!-- 左侧调整把手 -->
    <div
      class="resize-handle resize-handle-left"
      @mousedown.stop="startResize('left', $event)"
    ></div>

    <!-- 内容区域 - 由子组件定义 -->
    <div class="clip-content">
      <slot name="content" />
    </div>

    <!-- 右侧调整把手 -->
    <div
      class="resize-handle resize-handle-right"
      @mousedown.stop="startResize('right', $event)"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { useDragUtils } from '../composables/useDragUtils'
import { usePlaybackControls } from '../composables/usePlaybackControls'
import { alignFramesToFrame } from '../stores/utils/timeUtils'
import type { Track } from '../types'
import type { UnifiedTimelineItem } from '../unified/timelineitem'
import { UnifiedTimelineItemQueries } from '../unified/timelineitem'

// 统一时间轴基础组件接口
interface Props {
  timelineItem: UnifiedTimelineItem
  track?: Track
  timelineWidth: number
  totalDurationFrames: number
}

interface Emits {
  (e: 'select', itemId: string): void
  (e: 'update-position', timelineItemId: string, newPosition: number, newTrackId?: string): void
  (e: 'remove', timelineItemId: string): void
  (e: 'resize-update', timelineItemId: string, newStartTime: number, newEndTime: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const videoStore = useVideoStore()
const dragUtils = useDragUtils()
const { pauseForEditing } = usePlaybackControls()

// 状态管理
const isDragging = ref(false)
const isResizing = ref(false)
const isSelected = ref(false)
const tempResizePositionFrames = ref(0)
const tempDurationFrames = ref(0)

// 计算属性
const isOverlapping = computed(() => {
  // 这里可以添加重叠检测逻辑
  return false
})

const isTrackVisible = computed(() => {
  return props.track?.isVisible ?? true
})

const clipClasses = computed(() => ({
  'unified-base-clip': true,
  'overlapping': isOverlapping.value,
  'selected': isSelected.value,
  'dragging': isDragging.value,
  'resizing': isResizing.value,
  'track-hidden': !isTrackVisible.value,
  [`clip-status-${props.timelineItem.timelineStatus}`]: true,
  [`clip-media-${props.timelineItem.mediaType}`]: true,
}))

const clipStyle = computed(() => {
  const timeRange = props.timelineItem.timeRange

  // 在调整大小时使用临时值，否则使用实际值
  const positionFrames = isResizing.value
    ? tempResizePositionFrames.value
    : timeRange.timelineStartTime
  const durationFrames = isResizing.value
    ? tempDurationFrames.value
    : timeRange.timelineEndTime - timeRange.timelineStartTime

  const leftPixels = videoStore.frameToPixel(positionFrames, props.timelineWidth)
  const widthPixels = videoStore.frameToPixel(durationFrames, props.timelineWidth)

  return {
    left: `${leftPixels}px`,
    width: `${Math.max(20, widthPixels)}px`, // 最小宽度20px
    height: `${(props.track?.height || 60) - 4}px`, // 减去边距
    zIndex: isSelected.value ? 10 : 1,
  }
})

// 事件处理
function selectClip(event: MouseEvent) {
  event.stopPropagation()
  isSelected.value = !isSelected.value
  emit('select', props.timelineItem.id)
}

function handleDragStart(event: DragEvent) {
  if (!event.dataTransfer) return

  pauseForEditing('开始拖拽统一时间轴项目')
  isDragging.value = true

  // 设置拖拽数据
  const dragData = {
    itemId: props.timelineItem.id,
    startTime: props.timelineItem.timeRange.timelineStartTime,
    selectedItems: [props.timelineItem.id], // 简化处理，只拖拽当前项目
    dragOffset: {
      x: event.offsetX,
      y: event.offsetY
    }
  }

  event.dataTransfer.setData('application/timeline-item', JSON.stringify(dragData))
  event.dataTransfer.effectAllowed = 'move'

  // 设置拖拽工具的当前数据
  dragUtils.setTimelineItemDragData(
    event,
    props.timelineItem.id,
    props.timelineItem.trackId || '',
    props.timelineItem.timeRange.timelineStartTime,
    [props.timelineItem.id],
    dragData.dragOffset
  )

  console.log('🎯 [UnifiedBaseClip] 开始拖拽统一时间轴项目:', dragData)
}

function handleDragEnd() {
  isDragging.value = false
  dragUtils.clearDragData()
  console.log('🎯 [UnifiedBaseClip] 结束拖拽统一时间轴项目')
}

function startResize(direction: 'left' | 'right', event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()

  pauseForEditing('开始调整统一时间轴项目大小')
  isResizing.value = true

  const startX = event.clientX
  const originalStartTime = props.timelineItem.timeRange.timelineStartTime
  const originalEndTime = props.timelineItem.timeRange.timelineEndTime
  const originalDuration = originalEndTime - originalStartTime

  tempResizePositionFrames.value = originalStartTime
  tempDurationFrames.value = originalDuration

  function handleMouseMove(e: MouseEvent) {
    const deltaX = e.clientX - startX
    const deltaFrames = videoStore.pixelToFrame(Math.abs(deltaX), props.timelineWidth) * (deltaX >= 0 ? 1 : -1)

    if (direction === 'left') {
      // 调整开始时间
      const newStartTime = Math.max(0, originalStartTime + deltaFrames)
      const newDuration = originalEndTime - newStartTime
      
      if (newDuration > 1) { // 最小1帧
        tempResizePositionFrames.value = newStartTime
        tempDurationFrames.value = newDuration
      }
    } else {
      // 调整结束时间
      const newDuration = Math.max(1, originalDuration + deltaFrames)
      tempDurationFrames.value = newDuration
    }
  }

  function handleMouseUp() {
    isResizing.value = false

    // 对齐到帧
    const alignedStartTime = alignFramesToFrame(tempResizePositionFrames.value)
    const alignedEndTime = alignFramesToFrame(tempResizePositionFrames.value + tempDurationFrames.value)

    // 发出调整事件
    emit('resize-update', props.timelineItem.id, alignedStartTime, alignedEndTime)

    // 清理事件监听器
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// Tooltip事件
function showTooltip() {
  // 由父组件处理
}

function updateTooltipPosition(event: MouseEvent) {
  // 由父组件处理
}

function hideTooltip() {
  // 由父组件处理
}

// 清理
onUnmounted(() => {
  // 确保清理所有事件监听器
  document.removeEventListener('mousemove', () => {})
  document.removeEventListener('mouseup', () => {})
})
</script>

<style scoped>
.unified-base-clip {
  position: absolute;
  top: 2px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  transition: all 0.1s ease;
  border: 1px solid transparent;
  overflow: hidden;
  display: flex;
  align-items: stretch;
}

/* 状态样式 */
.unified-base-clip.clip-status-loading {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1));
  border-color: rgba(59, 130, 246, 0.4);
}

.unified-base-clip.clip-status-ready {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1));
  border-color: rgba(34, 197, 94, 0.4);
}

.unified-base-clip.clip-status-error {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1));
  border-color: rgba(239, 68, 68, 0.4);
}

/* 媒体类型样式 */
.unified-base-clip.clip-media-video {
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3);
}

.unified-base-clip.clip-media-audio {
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.3);
}

.unified-base-clip.clip-media-text {
  box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.3);
}

.unified-base-clip.clip-media-image {
  box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.3);
}

/* 交互状态 */
.unified-base-clip:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.unified-base-clip.selected {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
  z-index: 10;
}

.unified-base-clip.dragging {
  opacity: 0.7;
  transform: rotate(2deg);
  z-index: 1000;
}

.unified-base-clip.resizing {
  z-index: 100;
}

.unified-base-clip.overlapping {
  border-color: #ef4444;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3);
}

.unified-base-clip.track-hidden {
  opacity: 0.3;
}

/* 内容区域 */
.clip-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 4px;
  overflow: hidden;
}

/* 调整把手 */
.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  background: transparent;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.resize-handle-left {
  left: 0;
}

.resize-handle-right {
  right: 0;
}

.unified-base-clip:hover .resize-handle {
  opacity: 1;
  background: rgba(59, 130, 246, 0.6);
}

.resize-handle:hover {
  background: rgba(59, 130, 246, 0.8) !important;
}
</style>

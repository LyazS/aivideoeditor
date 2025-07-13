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
    <!-- 异步处理clip内容区域 -->
    <div class="async-processing-content">
      <!-- 状态指示器 -->
      <div class="status-indicator" :class="`status-${timelineItem.processingStatus}`">
        <!-- 处理类型图标 -->
        <div class="processing-icon" :class="`type-${timelineItem.processingType}`">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path :d="getProcessingTypeIcon(timelineItem.processingType)" />
          </svg>
        </div>

        <!-- 状态内容 -->
        <div class="status-content">
          <!-- 等待状态 -->
          <div v-if="timelineItem.processingStatus === 'pending'" class="status-pending">
            <span class="status-text">等待中</span>
          </div>

          <!-- 处理中状态 -->
          <div v-else-if="timelineItem.processingStatus === 'processing'" class="status-processing">
            <!-- 进度圆环 -->
            <div class="progress-ring">
              <svg width="32" height="32" class="progress-svg">
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.3)"
                  stroke-width="2"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="12"
                  fill="none"
                  stroke="white"
                  stroke-width="2"
                  stroke-linecap="round"
                  :stroke-dasharray="progressCircumference"
                  :stroke-dashoffset="progressOffset"
                  transform="rotate(-90 16 16)"
                />
              </svg>
              <span class="progress-text">{{ Math.round(timelineItem.processingProgress) }}%</span>
            </div>
          </div>

          <!-- 完成状态 -->
          <div v-else-if="timelineItem.processingStatus === 'completed'" class="status-completed">
            <span class="status-text">已完成</span>
          </div>

          <!-- 错误状态 -->
          <div v-else-if="timelineItem.processingStatus === 'error'" class="status-error">
            <span class="status-text">错误</span>
          </div>

          <!-- 不支持状态 -->
          <div v-else-if="timelineItem.processingStatus === 'unsupported'" class="status-unsupported">
            <span class="status-text">不支持</span>
          </div>

          <!-- 取消状态 -->
          <div v-else-if="timelineItem.processingStatus === 'cancelled'" class="status-cancelled">
            <span class="status-text">已取消</span>
          </div>
        </div>
      </div>

      <!-- 素材名称 -->
      <div class="clip-name">
        {{ timelineItem.config.name }}
      </div>
    </div>

  <!-- Tooltip组件 -->
  <ClipTooltip
    :visible="showTooltipFlag"
    :title="timelineItem.config.name"
    :media-type="timelineItem.mediaType === 'unknown' ? 'video' : timelineItem.mediaType"
    :duration="framesToTimecode(timelineItem.timeRange.timelineEndTime - timelineItem.timeRange.timelineStartTime)"
    :position="framesToTimecode(timelineItem.timeRange.timelineStartTime)"
    :mouse-x="tooltipMouseX"
    :mouse-y="tooltipMouseY"
    :clip-top="tooltipClipTop"
  />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { useDragUtils } from '../composables/useDragUtils'
import { usePlaybackControls } from '../composables/usePlaybackControls'
import { framesToTimecode } from '../stores/utils/timeUtils'
import ClipTooltip from './ClipTooltip.vue'
import type { AsyncProcessingTimelineItem, Track, AsyncProcessingType } from '../types'

interface Props {
  timelineItem: AsyncProcessingTimelineItem
  track?: Track
  timelineWidth: number
  totalDurationFrames: number
}

interface Emits {
  (e: 'select', itemId: string): void
  (e: 'update-position', timelineItemId: string, newPosition: number, newTrackId?: string): void
  (e: 'remove', timelineItemId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const videoStore = useVideoStore()
const dragUtils = useDragUtils()
const { pauseForEditing } = usePlaybackControls()

// Tooltip相关状态
const showTooltipFlag = ref(false)
const tooltipMouseX = ref(0)
const tooltipMouseY = ref(0)
const tooltipClipTop = ref(0)

// 拖拽状态
const isDragging = ref(false)

// 计算clip的样式类
const clipClasses = computed(() => [
  'timeline-async-processing-clip',
  `status-${props.timelineItem.processingStatus}`,
  `type-${props.timelineItem.processingType}`,
  {
    'selected': videoStore.selectedTimelineItemIds.has(props.timelineItem.id),
    'disabled': ['error', 'unsupported', 'cancelled'].includes(props.timelineItem.processingStatus),
    'dragging': isDragging.value
  }
])

// 计算clip的位置和大小样式
const clipStyle = computed(() => {
  const timeRange = props.timelineItem.timeRange
  const startPixel = videoStore.frameToPixel(timeRange.timelineStartTime, props.timelineWidth)
  const endPixel = videoStore.frameToPixel(timeRange.timelineEndTime, props.timelineWidth)
  const width = Math.max(endPixel - startPixel, 20) // 最小宽度20px

  return {
    left: `${startPixel}px`,
    width: `${width}px`,
    height: `${props.track?.height || 60}px`
  }
})

// 进度圆环计算
const progressCircumference = computed(() => 2 * Math.PI * 12) // r=12的圆周长
const progressOffset = computed(() => {
  const progress = props.timelineItem.processingProgress / 100
  return progressCircumference.value * (1 - progress)
})



// 获取处理类型图标
function getProcessingTypeIcon(type: AsyncProcessingType): string {
  switch (type) {
    case 'remote-download':
      return 'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,19.93C7.05,19.44 4,16.08 4,12C4,11.38 4.08,10.78 4.21,10.21L9,15V16A1,1 0 0,0 10,17H11V19.93M17.9,17.39C17.64,16.58 16.9,16 16,16H15V13A1,1 0 0,0 14,12H8V10H10A1,1 0 0,0 11,9V7H13A2,2 0 0,0 15,5V4.59C17.93,5.77 20,8.64 20,12C20,14.08 19.2,15.97 17.9,17.39Z'
    default:
      return 'M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z' // 默认加载图标
  }
}

// 获取处理类型标签
function getProcessingTypeLabel(type: AsyncProcessingType): string {
  switch (type) {
    case 'remote-download':
      return '远程下载'
    default:
      return '异步处理'
  }
}

// 获取状态标签
function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return '等待中'
    case 'processing':
      return '处理中'
    case 'completed':
      return '已完成'
    case 'error':
      return '错误'
    case 'unsupported':
      return '不支持'
    case 'cancelled':
      return '已取消'
    default:
      return status
  }
}

// 选择clip
function selectClip() {
  emit('select', props.timelineItem.id)
}

// 拖拽开始
function handleDragStart(event: DragEvent) {
  console.log('🎯 [AsyncProcessingClip拖拽] dragstart事件触发:', props.timelineItem.id)

  // 检查是否应该启动拖拽
  if (event.ctrlKey) {
    console.log('🚫 [AsyncProcessingClip拖拽] Ctrl+拖拽被禁用')
    event.preventDefault()
    return
  }

  // 暂停播放并处理拖拽
  pauseForEditing('异步处理时间轴项目拖拽')
  hideTooltip()
  dragUtils.ensureItemSelected(props.timelineItem.id)

  // 设置拖拽状态
  isDragging.value = true

  // 设置拖拽数据
  const dragOffset = { x: event.offsetX, y: event.offsetY }
  const dragData = dragUtils.setTimelineItemDragData(
    event,
    props.timelineItem.id,
    props.timelineItem.trackId,
    props.timelineItem.timeRange.timelineStartTime,
    Array.from(videoStore.selectedTimelineItemIds),
    dragOffset,
  )

  console.log('📦 [AsyncProcessingClip拖拽] 拖拽数据已设置:', dragData)
}

// 拖拽结束
function handleDragEnd(event: DragEvent) {
  console.log('🏁 [AsyncProcessingClip拖拽] dragend事件触发')

  // 清除拖拽状态
  isDragging.value = false
  dragUtils.clearDragData()
}

// 显示tooltip
function showTooltip(event: MouseEvent) {
  showTooltipFlag.value = true

  // 获取clip元素的位置信息
  const clipElement = event.currentTarget as HTMLElement
  const clipRect = clipElement.getBoundingClientRect()

  // 更新tooltip位置数据
  tooltipMouseX.value = event.clientX
  tooltipMouseY.value = event.clientY
  tooltipClipTop.value = clipRect.top
}

// 更新tooltip位置
function updateTooltipPosition(event: MouseEvent) {
  // 只有在tooltip显示时才更新位置
  if (!showTooltipFlag.value) return

  // 获取clip元素的位置信息
  const clipElement = event.currentTarget as HTMLElement
  const clipRect = clipElement.getBoundingClientRect()

  // 更新tooltip位置数据
  tooltipMouseX.value = event.clientX
  tooltipMouseY.value = event.clientY
  tooltipClipTop.value = clipRect.top
}

// 隐藏tooltip
function hideTooltip() {
  showTooltipFlag.value = false
}

// 清理
onUnmounted(() => {
  hideTooltip()
})
</script>

<style scoped>
.timeline-async-processing-clip {
  position: absolute;
  top: 0;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  overflow: hidden;
}

/* 在拖拽时禁用过渡效果，避免延迟 */
.timeline-async-processing-clip.dragging {
  transition: none !important;
}

/* 选中状态 */
.timeline-async-processing-clip.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

/* 禁用状态 */
.timeline-async-processing-clip.disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 状态样式 */
.timeline-async-processing-clip.status-pending {
  background: linear-gradient(135deg, #f39c12, #e67e22);
  border-color: #e67e22;
}

.timeline-async-processing-clip.status-processing {
  background: linear-gradient(135deg, #3498db, #2980b9);
  border-color: #2980b9;
}

.timeline-async-processing-clip.status-completed {
  background: linear-gradient(135deg, #27ae60, #229954);
  border-color: #229954;
}

.timeline-async-processing-clip.status-error,
.timeline-async-processing-clip.status-unsupported {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  border-color: #c0392b;
}

.timeline-async-processing-clip.status-cancelled {
  background: linear-gradient(135deg, #95a5a6, #7f8c8d);
  border-color: #7f8c8d;
}

/* 处理类型图标颜色 */
.timeline-async-processing-clip.type-remote-download .processing-icon {
  color: rgba(255, 255, 255, 0.9);
}

/* 内容区域 */
.async-processing-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 8px;
  color: white;
  text-align: center;
}

/* 状态指示器 */
.status-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.processing-icon {
  opacity: 0.9;
}

.status-content {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.status-text {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

/* 进度圆环 */
.progress-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-svg {
  transform: rotate(-90deg);
}

.progress-text {
  position: absolute;
  font-size: 10px;
  font-weight: bold;
  color: white;
}

/* 素材名称 */
.clip-name {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  margin-top: 4px;
}

/* 悬停效果 */
.timeline-async-processing-clip:hover:not(.disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
</style>

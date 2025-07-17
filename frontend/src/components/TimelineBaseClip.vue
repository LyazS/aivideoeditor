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
      <slot name="content" :timeline-item="timelineItem" />
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
import { useWebAVControls } from '../composables/useWebAVControls'
import { useDragUtils } from '../composables/useDragUtils'
import { usePlaybackControls } from '../composables/usePlaybackControls'
import { framesToTimecode, alignFramesToFrame } from '../stores/utils/timeUtils'
import { hasOverlapInTrack } from '../utils/timeOverlapUtils'
import type { TimelineItem, Track, VideoTimeRange, ImageTimeRange } from '../types'
import { isVideoTimeRange } from '../types'

// TimelineBaseClip通用接口
interface Props {
  timelineItem: TimelineItem
  track?: Track
  timelineWidth: number
  totalDurationFrames: number
}

interface Emits {
  (e: 'select', itemId: string): void
  (e: 'drag-start', itemId: string, event: DragEvent): void
  (e: 'drag-end', itemId: string, event: DragEvent): void
  (e: 'resize-start', itemId: string, direction: 'left' | 'right'): void
  (e: 'resize-end', itemId: string, direction: 'left' | 'right'): void
  (e: 'update-position', timelineItemId: string, newPosition: number, newTrackId?: string): void
  (e: 'remove', timelineItemId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 依赖注入
const videoStore = useVideoStore()
const webAVControls = useWebAVControls()
const dragUtils = useDragUtils()
const { pauseForEditing } = usePlaybackControls()

// 导入吸附管理器
import { useSnapManager } from '../composables/useSnapManager'
import { getSnapIndicatorManager } from '../composables/useSnapIndicator'
const snapManager = useSnapManager()
const snapIndicatorManager = getSnapIndicatorManager()

// 通用状态
const isDragging = ref(false)
const isResizing = ref(false)
const resizeDirection = ref<'left' | 'right' | null>(null)
const resizeStartX = ref(0)
const resizeStartDurationFrames = ref(0)
const resizeStartPositionFrames = ref(0)
const tempDurationFrames = ref(0)
const tempResizePositionFrames = ref(0)

// Tooltip相关状态
const showTooltipFlag = ref(false)
const tooltipMouseX = ref(0)
const tooltipMouseY = ref(0)
const tooltipClipTop = ref(0)

// 通用计算属性
const clipClasses = computed(() => ({
  'base-clip': true,
  'overlapping': isOverlapping.value,
  'selected': isSelected.value,
  'dragging': isDragging.value,
  'resizing': isResizing.value,
  'track-hidden': !isTrackVisible.value,
}))

const clipStyle = computed(() => {
  const timeRange = props.timelineItem.timeRange

  // 在调整大小时使用临时值，否则使用实际值（帧数）
  const positionFrames = isResizing.value
    ? tempResizePositionFrames.value
    : timeRange.timelineStartTime
  const durationFrames = isResizing.value
    ? tempDurationFrames.value
    : timeRange.timelineEndTime - timeRange.timelineStartTime

  const left = videoStore.frameToPixel(positionFrames, props.timelineWidth)
  const endFrames = positionFrames + durationFrames
  const right = videoStore.frameToPixel(endFrames, props.timelineWidth)
  const width = right - left

  // 计算垂直居中位置
  const clipHeight = parseInt(getClipHeight())
  const trackHeight = props.track?.height || 60 // 默认轨道高度60px
  const topOffset = Math.max(5, (trackHeight - clipHeight) / 2) // 至少5px的上边距

  return {
    left: `${left - 3}px`, // 补偿track-content的border-left宽度（3px）
    width: `${Math.max(width, 20)}px`, // 最小宽度20px
    top: `${topOffset}px`, // 动态计算垂直居中位置
    height: getClipHeight(),
    position: 'absolute' as const,
  }
})

// 检查当前时间轴项目是否与同轨道的其他项目重叠
const isOverlapping = computed(() => {
  const currentItem = props.timelineItem
  const trackItems = videoStore.getTimelineItemsForTrack(currentItem.trackId)
  return hasOverlapInTrack(currentItem, trackItems)
})

// 统一的选择状态计算
const isSelected = computed(() => {
  return videoStore.selectedTimelineItemIds.has(props.timelineItem.id)
})

// 检查轨道是否可见
const isTrackVisible = computed(() => {
  const track = videoStore.getTrack(props.timelineItem.trackId)
  return track ? track.isVisible : true
})

// 计算clip高度的辅助方法
function getClipHeight(): string {
  // 统一所有类型的clip高度为50px
  return '50px' // 所有clip统一高度50px，轨道高度60px，上下各留5px间距
}

// ==================== 原生拖拽API事件处理 ====================

function handleDragStart(event: DragEvent) {
  console.log('🎯 [BaseClip拖拽] dragstart事件触发:', props.timelineItem.id)

  // 检查是否应该启动拖拽
  if (event.ctrlKey) {
    console.log('🚫 [BaseClip拖拽] Ctrl+拖拽被禁用')
    event.preventDefault()
    return
  }

  // 暂停播放并处理拖拽
  pauseForEditing('时间轴项目拖拽')
  hideTooltip()
  dragUtils.ensureItemSelected(props.timelineItem.id)

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

  console.log('📦 [BaseClip拖拽] 设置拖拽数据:', dragData)

  // 创建简单的拖拽预览图像
  const dragImage = createSimpleDragPreview()
  event.dataTransfer!.setDragImage(dragImage, dragOffset.x, dragOffset.y)

  // 设置拖拽状态
  isDragging.value = true
  emit('drag-start', props.timelineItem.id, event)
}

function handleDragEnd(event: DragEvent) {
  console.log('🏁 [BaseClip拖拽] dragend事件触发:', props.timelineItem.id)

  // 清理拖拽状态
  isDragging.value = false
  dragUtils.clearDragData()
  removeSimpleDragPreview()

  // 隐藏吸附指示器
  snapIndicatorManager.hide(true)

  emit('drag-end', props.timelineItem.id, event)
}

/**
 * 创建简单的拖拽预览图像
 */
function createSimpleDragPreview(): HTMLElement {
  const selectedCount = videoStore.selectedTimelineItemIds.size
  const preview = document.createElement('div')

  preview.className = 'simple-drag-preview'

  // 获取当前clip的实际尺寸
  const clipElement = dragUtils.getTimelineItemElement(props.timelineItem.id)
  const { width: clipWidth, height: clipHeight } = dragUtils.getElementDimensions(clipElement)

  // 简单的预览样式
  preview.style.cssText = `
    position: fixed;
    top: -1000px;
    left: -1000px;
    width: ${clipWidth}px;
    height: ${clipHeight}px;
    background: rgba(255, 107, 53, 0.8);
    border: 1px solid var(--color-clip-selected);
    border-radius: 4px;
    pointer-events: none;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 10px;
    font-weight: bold;
  `

  // 简单的文本内容
  if (selectedCount > 1) {
    preview.textContent = `${selectedCount} 项目`
  } else {
    const mediaItem = videoStore.getMediaItem(props.timelineItem.mediaItemId)
    const clipName = mediaItem?.name || 'Clip'
    preview.textContent = clipName.length > 8 ? clipName.substring(0, 6) + '..' : clipName
  }

  document.body.appendChild(preview)

  // 设置清理定时器
  setTimeout(() => {
    removeSimpleDragPreview()
  }, 100)

  return preview
}

function removeSimpleDragPreview() {
  const preview = document.querySelector('.simple-drag-preview')
  if (preview && document.body.contains(preview)) {
    document.body.removeChild(preview)
  }
}

// ==================== 点击选择事件处理 ====================

async function selectClip(event: MouseEvent) {
  // 如果正在拖拽或调整大小，不处理选中
  if (isDragging.value || isResizing.value) return

  console.log('🖱️ [TimelineBaseClip] selectClip被调用:', {
    ctrlKey: event.ctrlKey,
    itemId: props.timelineItem.id,
    currentSelections: Array.from(videoStore.selectedTimelineItemIds),
  })

  try {
    if (event.ctrlKey) {
      // Ctrl+点击：切换选择状态（带历史记录）
      await videoStore.selectTimelineItemsWithHistory([props.timelineItem.id], 'toggle')
    } else {
      // 普通点击：替换选择（带历史记录）
      await videoStore.selectTimelineItemsWithHistory([props.timelineItem.id], 'replace')
    }
  } catch (error) {
    console.error('❌ [TimelineBaseClip] 选择操作失败:', error)
    // 如果历史记录选择失败，回退到普通选择
    if (event.ctrlKey) {
      videoStore.selectTimelineItems([props.timelineItem.id], 'toggle')
    } else {
      videoStore.selectTimelineItems([props.timelineItem.id], 'replace')
    }
  }

  emit('select', props.timelineItem.id)
  event.stopPropagation()
}

// ==================== 调整大小事件处理 ====================

function startResize(direction: 'left' | 'right', event: MouseEvent) {
  // 暂停播放以便进行编辑
  pauseForEditing('片段大小调整')
  hideTooltip()

  isResizing.value = true
  resizeDirection.value = direction
  resizeStartX.value = event.clientX

  const timeRange = props.timelineItem.timeRange

  // 使用帧数进行精确计算
  resizeStartDurationFrames.value = timeRange.timelineEndTime - timeRange.timelineStartTime
  resizeStartPositionFrames.value = timeRange.timelineStartTime

  // 初始化临时值
  tempDurationFrames.value = resizeStartDurationFrames.value
  tempResizePositionFrames.value = resizeStartPositionFrames.value

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)

  emit('resize-start', props.timelineItem.id, direction)
  event.preventDefault()
}

function handleResize(event: MouseEvent) {
  if (!isResizing.value || !resizeDirection.value) return

  const deltaX = event.clientX - resizeStartX.value

  // 使用帧数进行精确计算
  let newDurationFrames = resizeStartDurationFrames.value
  let newTimelinePositionFrames = resizeStartPositionFrames.value

  if (resizeDirection.value === 'left') {
    // 拖拽左边把柄：调整开始时间和时长
    const currentLeftPixel = videoStore.frameToPixel(
      resizeStartPositionFrames.value,
      props.timelineWidth,
    )
    const newLeftPixel = currentLeftPixel + deltaX
    let newLeftFrames = videoStore.pixelToFrame(newLeftPixel, props.timelineWidth)
    newLeftFrames = Math.max(0, alignFramesToFrame(newLeftFrames))

    // 应用吸附计算（左边界调整）
    const snapResult = snapManager.calculateClipResizeSnap(
      newLeftFrames,
      props.timelineWidth,
      props.timelineItem.id // 排除当前片段
    )

    if (snapResult.snapped) {
      newLeftFrames = snapResult.frame
      // 显示吸附指示器
      if (snapResult.snapPoint) {
        snapIndicatorManager.show(snapResult.snapPoint, props.timelineWidth, {
          timelineOffset: { x: 150, y: 0 },
          lineHeight: 400
        })
      }
    } else {
      snapIndicatorManager.hide(true) // 立即隐藏，不延迟
    }

    newTimelinePositionFrames = newLeftFrames
    newDurationFrames =
      resizeStartDurationFrames.value +
      (resizeStartPositionFrames.value - newTimelinePositionFrames)
  } else if (resizeDirection.value === 'right') {
    // 拖拽右边把柄：只调整时长
    const endFrames = resizeStartPositionFrames.value + resizeStartDurationFrames.value
    const currentRightPixel = videoStore.frameToPixel(endFrames, props.timelineWidth)
    const newRightPixel = currentRightPixel + deltaX
    let newRightFrames = videoStore.pixelToFrame(newRightPixel, props.timelineWidth)
    newRightFrames = alignFramesToFrame(newRightFrames)

    // 应用吸附计算（右边界调整）
    const snapResult = snapManager.calculateClipResizeSnap(
      newRightFrames,
      props.timelineWidth,
      props.timelineItem.id // 排除当前片段
    )

    if (snapResult.snapped) {
      newRightFrames = snapResult.frame
      // 显示吸附指示器
      if (snapResult.snapPoint) {
        snapIndicatorManager.show(snapResult.snapPoint, props.timelineWidth, {
          timelineOffset: { x: 150, y: 0 },
          lineHeight: 400
        })
      }
    } else {
      snapIndicatorManager.hide(true) // 立即隐藏，不延迟
    }

    newDurationFrames = newRightFrames - resizeStartPositionFrames.value
  }

  // 设置时长限制：最小1帧，用户可以自由调整时长
  const minDurationFrames = 1
  newDurationFrames = Math.max(minDurationFrames, newDurationFrames)

  // 更新临时值（帧数）
  tempDurationFrames.value = newDurationFrames
  tempResizePositionFrames.value = newTimelinePositionFrames
}

async function stopResize() {
  if (isResizing.value) {
    // 使用帧数计算新的时间范围
    const newTimelineStartTimeFrames = tempResizePositionFrames.value
    const newTimelineEndTimeFrames = tempResizePositionFrames.value + tempDurationFrames.value

    // 验证时间范围的有效性
    if (newTimelineEndTimeFrames <= newTimelineStartTimeFrames) {
      console.error('❌ [TimelineBaseClip] 无效的时间范围:', {
        startFrames: newTimelineStartTimeFrames,
        endFrames: newTimelineEndTimeFrames,
      })
      return
    }

    console.log('🔧 [TimelineBaseClip] 调整大小 - 设置时间范围:', {
      mediaType: props.timelineItem.mediaType,
      timelineStartTimeFrames: newTimelineStartTimeFrames,
      timelineEndTimeFrames: newTimelineEndTimeFrames,
      durationFrames: tempDurationFrames.value,
    })

    // 所有媒体类型都支持时长调整，不需要依赖MediaItem
    // 构建新的时间范围对象
    const currentTimeRange = props.timelineItem.timeRange
    let newTimeRange: VideoTimeRange | ImageTimeRange

    if ((props.timelineItem.mediaType === 'video' || props.timelineItem.mediaType === 'audio') && isVideoTimeRange(currentTimeRange)) {
      // 视频和音频都使用 VideoTimeRange 结构
      newTimeRange = {
        timelineStartTime: newTimelineStartTimeFrames,
        timelineEndTime: newTimelineEndTimeFrames,
        clipStartTime: currentTimeRange.clipStartTime,
        clipEndTime: currentTimeRange.clipEndTime,
        effectiveDuration: newTimelineEndTimeFrames - newTimelineStartTimeFrames,
        playbackRate: currentTimeRange.playbackRate || 1.0,
      }
    } else {
      // 图片和文本类型都使用 ImageTimeRange 结构
      newTimeRange = {
        timelineStartTime: newTimelineStartTimeFrames,
        timelineEndTime: newTimelineEndTimeFrames,
        displayDuration: newTimelineEndTimeFrames - newTimelineStartTimeFrames,
      }
    }

    try {
      // 关键帧位置调整
      const oldDurationFrames = currentTimeRange.timelineEndTime - currentTimeRange.timelineStartTime
      const newDurationFrames = newTimeRange.timelineEndTime - newTimeRange.timelineStartTime

      if (props.timelineItem.animation && props.timelineItem.animation.keyframes.length > 0) {
        const { adjustKeyframesForDurationChange } = await import('../utils/unifiedKeyframeUtils')
        adjustKeyframesForDurationChange(props.timelineItem, oldDurationFrames, newDurationFrames)
        console.log('🎬 [TimelineBaseClip] Keyframes adjusted for duration change')
      }

      // 使用带历史记录的调整方法
      const success = await videoStore.resizeTimelineItemWithHistory(
        props.timelineItem.id,
        newTimeRange,
      )

      if (success) {
        console.log('✅ [TimelineBaseClip] 时间范围调整成功')

        // 如果有动画，需要重新设置WebAV动画时长
        if (props.timelineItem.animation && props.timelineItem.animation.isEnabled) {
          const { updateWebAVAnimation } = await import('../utils/webavAnimationManager')
          await updateWebAVAnimation(props.timelineItem)
          console.log('🎬 [TimelineBaseClip] Animation duration updated after clip resize')
        }
      } else {
        console.error('❌ [TimelineBaseClip] 时间范围调整失败')
      }
    } catch (error) {
      console.error('❌ [TimelineBaseClip] 调整时间范围时出错:', error)
    }
  }

  isResizing.value = false
  resizeDirection.value = null
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)

  // 隐藏吸附指示器
  snapIndicatorManager.hide(true)

  emit('resize-end', props.timelineItem.id, resizeDirection.value!)
}

// ==================== Tooltip相关方法 ====================

function showTooltip(event: MouseEvent) {
  // 如果正在拖拽或调整大小，不显示tooltip
  if (isDragging.value || isResizing.value) return

  showTooltipFlag.value = true

  // 获取clip元素的位置信息
  const clipElement = event.currentTarget as HTMLElement
  const clipRect = clipElement.getBoundingClientRect()

  // 更新tooltip位置数据
  tooltipMouseX.value = event.clientX
  tooltipMouseY.value = event.clientY
  tooltipClipTop.value = clipRect.top
}

function updateTooltipPosition(event: MouseEvent) {
  // 只有在tooltip显示时才更新位置
  if (!showTooltipFlag.value) return
  // 如果正在拖拽或调整大小，不更新tooltip位置
  if (isDragging.value || isResizing.value) return

  // 获取clip元素的位置信息
  const clipElement = event.currentTarget as HTMLElement
  const clipRect = clipElement.getBoundingClientRect()

  // 更新tooltip位置数据
  tooltipMouseX.value = event.clientX
  tooltipMouseY.value = event.clientY
  tooltipClipTop.value = clipRect.top
}

function hideTooltip() {
  showTooltipFlag.value = false
}

// ==================== 生命周期 ====================

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
})

// ==================== 暴露给父组件的数据 ====================

// 暴露tooltip相关状态，供子组件使用
defineExpose({
  showTooltipFlag,
  tooltipMouseX,
  tooltipMouseY,
  tooltipClipTop,
  hideTooltip,
})
</script>

<style scoped>
/* TimelineBaseClip通用样式 */
.base-clip {
  position: absolute;
  border-radius: 4px;
  cursor: move;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 10;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

/* 在拖拽或调整大小时禁用过渡效果，避免延迟 */
.base-clip.dragging,
.base-clip.resizing {
  transition: none !important;
}

.base-clip:hover {
  border-color: var(--color-text-primary);
}

.base-clip.selected {
  border-color: var(--color-clip-selected);
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.3);
}

.base-clip.overlapping {
  border-color: #f44336;
  box-shadow: 0 0 0 2px rgba(244, 67, 54, 0.3);
  animation: pulse-warning 2s infinite;
}

.base-clip.dragging {
  opacity: 0.8;
  transform: scale(1.02);
}

.base-clip.track-hidden {
  opacity: 0.5;
}

@keyframes pulse-warning {
  0%,
  100% {
    box-shadow: 0 2px 12px rgba(231, 76, 60, 0.4);
  }
  50% {
    box-shadow: 0 2px 16px rgba(231, 76, 60, 0.6);
  }
}

.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  background: rgba(255, 255, 255, 0.3);
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 5;
}

.base-clip:hover .resize-handle {
  opacity: 1;
}

.resize-handle-left {
  left: 0;
  border-radius: 4px 0 0 4px;
}

.resize-handle-right {
  right: 0;
  border-radius: 0 4px 4px 0;
}

.clip-content {
  height: 100%;
  padding: 0 8px; /* 为把手留出空间 */
  overflow: hidden;
  display: flex;
  align-items: center;
  position: relative;
}

/* 简单拖拽预览样式 */
:global(.simple-drag-preview) {
  position: fixed !important;
  background: rgba(255, 107, 53, 0.8) !important;
  border: 1px solid var(--color-clip-selected) !important;
  border-radius: 4px !important;
  pointer-events: none !important;
  z-index: 9999 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: white !important;
  font-size: 10px !important;
  font-weight: bold !important;
}
</style>

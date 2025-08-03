<template>
  <div
    :class="clipClasses"
    :style="clipStyles"
    :data-media-type="data.mediaType"
    :data-timeline-item-id="data.id"
    :data-timeline-status="data.timelineStatus"
    :draggable="true"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @click="handleSelect"
    @dblclick="handleDoubleClick"
    @contextmenu="handleContextMenu"
    @mouseenter="showTooltip"
    @mousemove="updateTooltipPosition"
    @mouseleave="hideTooltip"
  >
    <!-- 左侧调整把手 -->
    <div
      class="resize-handle resize-handle-left"
      @mousedown.stop="handleResizeStart('left', $event)"
    ></div>

    <!-- 动态渲染的内容区域 -->
    <div class="clip-content">
      <component :is="renderedContent" />
    </div>

    <!-- 右侧调整把手 -->
    <div
      class="resize-handle resize-handle-right"
      @mousedown.stop="handleResizeStart('right', $event)"
    ></div>

    <!-- 状态指示器（如果渲染器提供） -->
    <div v-if="statusIndicator" class="status-indicator">
      <component :is="statusIndicator" />
    </div>

    <!-- 进度条（如果渲染器提供） -->
    <div v-if="progressBar" class="progress-bar-container">
      <component :is="progressBar" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted, h } from 'vue'
import type {
  UnifiedTimelineClipProps,
  UnifiedTimelineClipEvents,
  ContentRenderContext
} from '../types/clipRenderer'
import type { MediaTypeOrUnknown } from '../mediaitem/types'
import type { VideoTimeRange, ImageTimeRange } from '../../types/index'
import type { UnifiedTimeRange } from '../types/timeRange'
import { ContentRendererFactory } from './renderers/ContentRendererFactory'
import { useUnifiedStore } from '../unifiedStore'
import { useDragUtils } from '../composables/useDragUtils'
import { getSnapIndicatorManager } from '../composables/useSnapIndicator'
import { usePlaybackControls } from '../composables/usePlaybackControls'
import { useSnapManager } from '../composables/useSnapManager'
import { alignFramesToFrame } from '../../stores/utils/timeUtils'

// ==================== 组件定义 ====================

// 定义组件属性
const props = withDefaults(defineProps<UnifiedTimelineClipProps>(), {
  isSelected: false,
  isDragging: false,
  isResizing: false,
  currentFrame: 0,
  scale: 1,
  trackHeight: 60,
  timelineWidth: 1000
})

// 获取统一store实例
const unifiedStore = useUnifiedStore()
const dragUtils = useDragUtils()
const snapIndicatorManager = getSnapIndicatorManager()
const snapManager = useSnapManager()
const { pauseForEditing } = usePlaybackControls()

// 拖拽状态
const isDragging = ref(false)

// Resize状态管理变量
const isResizing = ref(false)
const resizeDirection = ref<'left' | 'right' | null>(null)
const resizeStartX = ref(0)
const resizeStartDurationFrames = ref(0)
const resizeStartPositionFrames = ref(0)
const tempDurationFrames = ref(0)
const tempResizePositionFrames = ref(0)

// 定义组件事件
const emit = defineEmits<{
  select: [id: string]
  doubleClick: [id: string]
  contextMenu: [event: MouseEvent, id: string]
  dragStart: [event: DragEvent, id: string]
  resizeStart: [event: MouseEvent, id: string, direction: 'left' | 'right']
}>()

// ==================== 响应式状态 ====================

// 工具提示相关状态
const showTooltipFlag = ref(false)
const tooltipPosition = ref({ x: 0, y: 0 })

// ==================== 计算属性 ====================

/**
 * 构建渲染上下文
 */
const renderContext = computed<ContentRenderContext>(() => ({
  data: props.data,
  isSelected: props.isSelected,
  isDragging: props.isDragging,
  isResizing: props.isResizing,
  currentFrame: props.currentFrame,
  scale: props.scale,
  trackHeight: props.trackHeight,
  callbacks: {
    onSelect: (id: string) => emit('select', id),
    onDoubleClick: (id: string) => emit('doubleClick', id),
    onContextMenu: (event: MouseEvent, id: string) => emit('contextMenu', event, id),
    onDragStart: (event: DragEvent, id: string) => emit('dragStart', event, id),
    onResizeStart: (event: MouseEvent, id: string, direction: 'left' | 'right') => 
      emit('resizeStart', event, id, direction)
  }
}))

/**
 * 动态选择渲染器
 */
const renderer = computed(() => {
  // 如果提供了自定义渲染器，优先使用
  if (props.customRenderer) {
    return props.customRenderer
  }

  // 使用渲染器工厂获取合适的渲染器
  return ContentRendererFactory.getRenderer(props.data)
})

/**
 * 渲染内容
 */
const renderedContent = computed(() => {
  return () => renderer.value.renderContent(renderContext.value)
})

/**
 * 状态指示器
 */
const statusIndicator = computed(() => {
  if (!renderer.value.renderStatusIndicator) {
    return null
  }

  return () => renderer.value.renderStatusIndicator!(renderContext.value)
})

/**
 * 进度条
 */
const progressBar = computed(() => {
  if (!renderer.value.renderProgressBar) {
    return null
  }

  return () => renderer.value.renderProgressBar!(renderContext.value)
})

/**
 * 动态样式类
 */
const clipClasses = computed(() => {
  const baseClasses = [
    'unified-timeline-clip',
    `media-type-${props.data.mediaType}`,
    `status-${props.data.timelineStatus}`,
    {
      'selected': props.isSelected,
      'dragging': isDragging.value || props.isDragging,
      'resizing': isResizing.value || props.isResizing
    }
  ]
  
  // 添加渲染器提供的自定义类
  const customClasses = renderer.value.getCustomClasses?.(renderContext.value) || []

  return [...baseClasses, ...customClasses]
})

/**
 * 动态样式（包含位置和尺寸计算，与旧架构TimelineBaseClip保持一致）
 */
const clipStyles = computed(() => {
  // 计算clip的位置和尺寸
  const timeRange = props.data.timeRange

  // 在调整大小时使用临时值，否则使用实际值（帧数）
  const positionFrames = isResizing.value
    ? tempResizePositionFrames.value
    : timeRange.timelineStartTime
  const durationFrames = isResizing.value
    ? tempDurationFrames.value
    : timeRange.timelineEndTime - timeRange.timelineStartTime

  // 使用统一store的坐标转换方法
  const left = unifiedStore.frameToPixel(positionFrames, props.timelineWidth)
  const endFrames = positionFrames + durationFrames
  const right = unifiedStore.frameToPixel(endFrames, props.timelineWidth)
  const width = Math.max(right - left, 20) // 最小宽度20px

  const baseStyles = {
    left: `${left}px`,
    width: `${width}px`,
    // 其他样式在CSS中定义
  }

  // 添加渲染器提供的自定义样式
  const customStyles = renderer.value.getCustomStyles?.(renderContext.value) || {}

  return { ...baseStyles, ...customStyles }
})

// ==================== 事件处理 ====================

/**
 * 处理选中事件
 */
function handleSelect(event: MouseEvent) {
  event.stopPropagation()
  emit('select', props.data.id)
}

/**
 * 处理双击事件
 */
function handleDoubleClick(event: MouseEvent) {
  event.stopPropagation()
  emit('doubleClick', props.data.id)
}

/**
 * 处理右键菜单事件
 */
function handleContextMenu(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  emit('contextMenu', event, props.data.id)
}

/**
 * 处理拖拽开始事件
 */
function handleDragStart(event: DragEvent) {
  console.log('🎯 [UnifiedTimelineClip] dragstart事件触发:', props.data.id)

  // 检查是否应该启动拖拽
  if (event.ctrlKey) {
    console.log('🚫 [UnifiedTimelineClip] Ctrl+拖拽被禁用')
    event.preventDefault()
    return
  }

  // 暂停播放并处理拖拽
  pauseForEditing('时间轴项目拖拽')
  hideTooltip()
  dragUtils.ensureItemSelected(props.data.id)

  // 设置拖拽数据
  const dragOffset = { x: event.offsetX, y: event.offsetY }
  const dragData = dragUtils.setTimelineItemDragData(
    event,
    props.data.id,
    props.data.trackId || '',
    props.data.timeRange.timelineStartTime,
    Array.from(unifiedStore.selectedTimelineItemIds),
    dragOffset,
  )

  console.log('📦 [UnifiedTimelineClip] 设置拖拽数据:', dragData)

  // 创建简单的拖拽预览图像
  const dragImage = createSimpleDragPreview()
  event.dataTransfer!.setDragImage(dragImage, dragOffset.x, dragOffset.y)

  // 设置拖拽状态
  isDragging.value = true
  emit('dragStart', event, props.data.id)
}

/**
 * 处理拖拽结束事件
 */
function handleDragEnd(_event: DragEvent) {
  console.log('🏁 [UnifiedTimelineClip] 拖拽结束:', props.data.id)

  // 清理拖拽状态
  isDragging.value = false
  dragUtils.clearDragData()
  removeSimpleDragPreview()

  // 隐藏吸附指示器
  snapIndicatorManager.hide(true)
}

/**
 * 创建简单的拖拽预览图像
 */
function createSimpleDragPreview(): HTMLElement {
  const selectedCount = unifiedStore.selectedTimelineItemIds.size
  const preview = document.createElement('div')

  preview.className = 'simple-drag-preview'

  // 获取当前clip的实际尺寸
  const clipElement = dragUtils.getTimelineItemElement(props.data.id)
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
    const mediaItem = unifiedStore.getMediaItem(props.data.mediaItemId)
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

/**
 * 处理调整大小开始事件
 */
function handleResizeStart(direction: 'left' | 'right', event: MouseEvent) {
  console.log('🔧 [UnifiedTimelineClip] 开始调整大小:', direction, props.data.id)
  
  // 暂停播放以便进行编辑
  pauseForEditing('片段大小调整')
  hideTooltip()

  isResizing.value = true
  resizeDirection.value = direction
  resizeStartX.value = event.clientX

  const timeRange = props.data.timeRange

  // 使用帧数进行精确计算
  resizeStartDurationFrames.value = timeRange.timelineEndTime - timeRange.timelineStartTime
  resizeStartPositionFrames.value = timeRange.timelineStartTime

  // 初始化临时值
  tempDurationFrames.value = resizeStartDurationFrames.value
  tempResizePositionFrames.value = resizeStartPositionFrames.value

  // 添加全局事件监听器
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)

  emit('resizeStart', event, props.data.id, direction)
  event.preventDefault()
}

/**
 * 处理调整大小过程中的鼠标移动事件
 */
function handleResize(event: MouseEvent) {
  if (!isResizing.value || !resizeDirection.value) return

  const deltaX = event.clientX - resizeStartX.value

  // 使用帧数进行精确计算
  let newDurationFrames = resizeStartDurationFrames.value
  let newTimelinePositionFrames = resizeStartPositionFrames.value

  if (resizeDirection.value === 'left') {
    // 拖拽左边把柄：调整开始时间和时长
    const currentLeftPixel = unifiedStore.frameToPixel(
      resizeStartPositionFrames.value,
      props.timelineWidth,
    )
    const newLeftPixel = currentLeftPixel + deltaX
    let newLeftFrames = unifiedStore.pixelToFrame(newLeftPixel, props.timelineWidth)
    newLeftFrames = Math.max(0, alignFramesToFrame(newLeftFrames))

    // 应用吸附计算（左边界调整）
    const snapResult = snapManager.calculateClipResizeSnap(
      newLeftFrames,
      props.timelineWidth,
      props.data.id, // 排除当前片段
    )

    if (snapResult.snapped) {
      newLeftFrames = snapResult.frame
      // 显示吸附指示器
      if (snapResult.snapPoint) {
        snapIndicatorManager.show(snapResult.snapPoint, props.timelineWidth, {
          timelineOffset: { x: 150, y: 0 },
          lineHeight: 400,
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
    const currentRightPixel = unifiedStore.frameToPixel(endFrames, props.timelineWidth)
    const newRightPixel = currentRightPixel + deltaX
    let newRightFrames = unifiedStore.pixelToFrame(newRightPixel, props.timelineWidth)
    newRightFrames = alignFramesToFrame(newRightFrames)

    // 应用吸附计算（右边界调整）
    const snapResult = snapManager.calculateClipResizeSnap(
      newRightFrames,
      props.timelineWidth,
      props.data.id, // 排除当前片段
    )

    if (snapResult.snapped) {
      newRightFrames = snapResult.frame
      // 显示吸附指示器
      if (snapResult.snapPoint) {
        snapIndicatorManager.show(snapResult.snapPoint, props.timelineWidth, {
          timelineOffset: { x: 150, y: 0 },
          lineHeight: 400,
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

/**
 * 处理调整大小结束事件
 */
async function stopResize() {
  if (!isResizing.value) return

  console.log('🛑 [UnifiedTimelineClip] 停止调整大小')

  // 计算最终的时间范围
  const newTimelineStartTimeFrames = tempResizePositionFrames.value
  const newTimelineEndTimeFrames = tempResizePositionFrames.value + tempDurationFrames.value

  // 验证时间范围的有效性
  if (newTimelineStartTimeFrames < 0 || tempDurationFrames.value <= 0) {
    console.warn('⚠️ [UnifiedTimelineClip] 无效的时间范围，取消调整')
    cleanupResize()
    return
  }

  // 检查是否有实际的变化
  if (tempDurationFrames.value !== resizeStartDurationFrames.value ||
      tempResizePositionFrames.value !== resizeStartPositionFrames.value) {

    console.log('🔧 [UnifiedTimelineClip] 调整大小 - 应用新的时间范围:', {
      itemId: props.data.id,
      newStartTime: newTimelineStartTimeFrames,
      newEndTime: newTimelineEndTimeFrames,
      direction: resizeDirection.value,
    })

    // 使用统一架构的resize命令来更新时间范围
    try {
      // 构建完整的newTimeRange对象，参考旧架构的实现模式
      const currentTimeRange = props.data.timeRange
      let newTimeRange: UnifiedTimeRange

      // 统一使用UnifiedTimeRange结构
      newTimeRange = {
        timelineStartTime: newTimelineStartTimeFrames,
        timelineEndTime: newTimelineEndTimeFrames,
        clipStartTime: currentTimeRange.clipStartTime,
        clipEndTime: currentTimeRange.clipEndTime,
      }

      // 调用统一store的resize方法，传入完整的newTimeRange对象
      const success = await unifiedStore.resizeTimelineItemWithHistory(
        props.data.id,
        newTimeRange,
      )
    } catch (error) {
      console.error('❌ [UnifiedTimelineClip] 调整大小失败:', error)
    }
  }

  cleanupResize()
}

/**
 * 清理resize状态
 */
function cleanupResize() {
  // 清理resize状态
  isResizing.value = false
  const direction = resizeDirection.value
  resizeDirection.value = null
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  snapIndicatorManager.hide(true)
  
  if (direction) {
    // 这里可以发出resize-end事件，但新架构可能不需要
    console.log('🏁 [UnifiedTimelineClip] resize结束:', direction)
  }
}

/**
 * 显示工具提示
 */
function showTooltip(event: MouseEvent) {
  showTooltipFlag.value = true
  updateTooltipPosition(event)
}

/**
 * 更新工具提示位置
 */
function updateTooltipPosition(event: MouseEvent) {
  tooltipPosition.value = {
    x: event.clientX,
    y: event.clientY
  }
}

/**
 * 隐藏工具提示
 */
function hideTooltip() {
  showTooltipFlag.value = false
}

// ==================== 生命周期 ====================

onUnmounted(() => {
  // 清理工作
})


</script>

<style scoped>
.unified-timeline-clip {
  position: absolute;
  /* 固定高度50px，与旧架构保持一致 */
  height: 50px;
  /* 垂直居中定位（轨道高度60px，clip高度50px，上下各留5px） */
  top: 5px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  /* 确保时间轴项目在网格线之上 */
  z-index: 10;

  /* 基础边框和背景 - 与旧架构保持一致 */
  border: 2px solid transparent;
  background: #fafafa;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  color: white;
}

/* 悬停状态 */
.unified-timeline-clip:hover {
  border-color: var(--color-text-primary);
}

/* 拖拽和调整大小状态 - 与旧架构保持一致 */
.unified-timeline-clip.dragging {
  opacity: 0.8;
  transform: scale(0.98);
  z-index: 1000;
  transition: none !important;
}

.unified-timeline-clip.resizing {
  cursor: col-resize;
  border-color: var(--color-primary);
  transition: none !important;
}

/* 媒体类型特定样式 - 与旧架构保持一致 */
.unified-timeline-clip.media-type-video,
.unified-timeline-clip.media-type-image,
.unified-timeline-clip.media-type-audio,
.unified-timeline-clip.media-type-text,
.unified-timeline-clip.media-type-unknown {
  /* 统一使用与旧架构相同的灰色背景 */
  background: linear-gradient(135deg, #666666, #555555);
}

/* 状态特定样式 - 与旧架构保持一致 */
.unified-timeline-clip.selected {
  background: linear-gradient(135deg, var(--color-clip-selected), var(--color-clip-selected-dark)) !important;
  border-color: var(--color-clip-selected);
  box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.3);
}

.unified-timeline-clip.overlapping {
  background: linear-gradient(135deg, var(--color-clip-overlapping), var(--color-clip-overlapping-dark)) !important;
}

.unified-timeline-clip.track-hidden {
  background: linear-gradient(135deg, var(--color-clip-hidden), var(--color-clip-hidden-dark)) !important;
}

.unified-timeline-clip.track-hidden.selected {
  background: linear-gradient(135deg, var(--color-clip-hidden-selected), var(--color-clip-hidden-selected-dark)) !important;
}

/* 隐藏轨道上的clip内容也要调整透明度 */
.unified-timeline-clip.track-hidden .clip-content {
  opacity: 0.8;
}

.unified-timeline-clip.status-loading {
  border-style: dashed;
  animation: loading-pulse 2s infinite;
}

.unified-timeline-clip.status-error {
  border-color: #ff4d4f;
  background: linear-gradient(135deg, #fff2f0 0%, #ffccc7 100%);
}

@keyframes loading-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* 内容区域 */
.clip-content {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 4px 8px;
  overflow: hidden;
}

/* 调整把手 */
.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: col-resize;
  background: transparent;
  z-index: 10;
}

.resize-handle:hover {
  background: rgba(24, 144, 255, 0.3);
}

.resize-handle-left {
  left: 0;
}

.resize-handle-right {
  right: 0;
}

/* 状态指示器 */
.status-indicator {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 5;
}

/* 进度条容器 */
.progress-bar-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  z-index: 5;
}

/* 默认内容样式 */
.default-content {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 12px;
  color: #666;
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

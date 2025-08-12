<template>
  <div
    class="unified-timeline-clip-container"
    :style="containerStyles"
  >
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
        v-if="data.timelineStatus === 'ready'"
        class="resize-handle resize-handle-left"
        @mousedown.stop="handleResizeStart('left', $event)"
      ></div>

      <!-- 动态渲染的内容区域 -->
      <div class="clip-content">
        <component :is="renderedContent" />
      </div>

      <!-- 右侧调整把手 -->
      <div
        v-if="data.timelineStatus === 'ready'"
        class="resize-handle resize-handle-right"
        @mousedown.stop="handleResizeStart('right', $event)"
      ></div>


      <!-- 进度条（如果渲染器提供） -->
      <div v-if="progressBar" class="progress-bar-container">
        <component :is="progressBar" />
      </div>

      <!-- 关键帧标记容器 -->
      <div v-if="hasKeyframes" class="keyframes-container">
        <div
          v-for="keyframe in visibleKeyframes"
          :key="keyframe.framePosition"
          class="keyframe-marker"
          :style="getKeyframeMarkerStyles(keyframe.pixelPosition)"
          :title="`关键帧 - 帧 ${keyframe.absoluteFrame} (点击跳转)`"
          @click.stop="jumpToKeyframe(keyframe.absoluteFrame)"
        >
          <div class="keyframe-diamond"></div>
        </div>
      </div>
    </div>

    <!-- Tooltip 组件 -->
    <UnifiedClipTooltip
      :visible="showTooltipFlag"
      :title="clipName"
      :media-type="props.data.mediaType"
      :duration="formattedDuration"
      :position="formattedPosition"
      :mouse-x="tooltipPosition.x"
      :mouse-y="tooltipPosition.y"
      :clip-top="clipTopPosition"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted, h } from 'vue'
import type {
  UnifiedTimelineClipProps,
  UnifiedTimelineClipEvents,
  ContentRenderContext,
} from '../types/clipRenderer'
import type { VideoTimeRange, ImageTimeRange } from '../../types/index'
import type { UnifiedTimeRange } from '../types/timeRange'
import { ContentRendererFactory } from './renderers/ContentRendererFactory'
import { useUnifiedStore } from '../unifiedStore'
import { useDragUtils, usePlaybackControls } from '../composables'
import { alignFramesToFrame } from '../../stores/utils/timeUtils'
import UnifiedClipTooltip from './UnifiedClipTooltip.vue'
import type { RemoteFileSourceData } from '../sources/RemoteFileSource'
import { relativeFrameToAbsoluteFrame } from '../utils/unifiedKeyframeUtils'

// ==================== 组件定义 ====================

// 定义组件属性
const props = withDefaults(defineProps<UnifiedTimelineClipProps>(), {
  isSelected: false,
  isDragging: false,
  isResizing: false,
  currentFrame: 0,
  scale: 1,
  trackHeight: 60,
  timelineWidth: 1000,
})

// 获取统一store实例
const unifiedStore = useUnifiedStore()
const dragUtils = useDragUtils()
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
 * Clip进度信息计算属性
 */
const clipProgress = computed(() => {
  // 获取当前clip关联的媒体项目
  const mediaItem = unifiedStore.getMediaItem(props.data.mediaItemId)
  if (!mediaItem || !mediaItem.source) {
    return {
      hasProgress: false,
      percent: 0,
      speed: undefined
    }
  }

  const source = mediaItem.source
  
  // 根据数据源类型获取进度信息
  if (source.type === 'remote') {
    // 远程文件源：使用下载字节数计算进度
    const remoteSource = source as RemoteFileSourceData
    if (remoteSource.totalBytes === 0) {
      return {
        hasProgress: false,
        percent: 0,
        speed: undefined
      }
    }
    const percent = (remoteSource.downloadedBytes / remoteSource.totalBytes) * 100
    return {
      hasProgress: true,
      percent,
      speed: remoteSource.downloadSpeed
    }
  } else {
    // 其他类型：使用基础进度值
    return {
      hasProgress: source.progress > 0,
      percent: source.progress,
      speed: undefined
    }
  }
})

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
  progressInfo: clipProgress.value, // 添加进度信息
  callbacks: {
    onSelect: (id: string) => emit('select', id),
    onDoubleClick: (id: string) => emit('doubleClick', id),
    onContextMenu: (event: MouseEvent, id: string) => emit('contextMenu', event, id),
    onDragStart: (event: DragEvent, id: string) => emit('dragStart', event, id),
    onResizeStart: (event: MouseEvent, id: string, direction: 'left' | 'right') =>
      emit('resizeStart', event, id, direction),
  },
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
      selected: props.isSelected,
      dragging: isDragging.value || props.isDragging,
      resizing: isResizing.value || props.isResizing,
    },
  ]

  // 添加渲染器提供的自定义类
  const customClasses = renderer.value.getCustomClasses?.(renderContext.value) || []

  return [...baseClasses, ...customClasses]
})

/**
 * 动态样式（只包含渲染器提供的自定义样式，位置和尺寸由容器处理）
 */
const clipStyles = computed(() => {
  // 添加渲染器提供的自定义样式
  const customStyles = renderer.value.getCustomStyles?.(renderContext.value) || {}

  return { ...customStyles }
})

/**
 * 容器样式（将位置和尺寸应用到容器上）
 */
const containerStyles = computed(() => {
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

  return {
    left: `${left}px`,
    width: `${width}px`,
    height: '60px', // 轨道高度
    top: '0px',
  }
})

// ==================== Tooltip 计算属性 ====================

/**
 * 获取clip名称
 */
const clipName = computed(() => {
  const mediaItem = unifiedStore.getMediaItem(props.data.mediaItemId)
  return mediaItem?.name || '未知片段'
})

/**
 * 格式化时长
 */
const formattedDuration = computed(() => {
  const durationFrames =
    props.data.timeRange.timelineEndTime - props.data.timeRange.timelineStartTime
  const seconds = durationFrames / unifiedStore.frameRate
  return `${seconds.toFixed(2)}秒`
})

/**
 * 格式化位置
 */
const formattedPosition = computed(() => {
  const startFrame = props.data.timeRange.timelineStartTime
  const seconds = startFrame / unifiedStore.frameRate
  return `${seconds.toFixed(2)}秒`
})

/**
 * 获取clip元素的顶部位置
 */
const clipTopPosition = ref(0)

// ==================== 关键帧标记相关计算属性 ====================

/**
 * 检查是否有关键帧
 */
const hasKeyframes = computed(() => {
  return !!(
    props.data.animation &&
    props.data.animation.isEnabled &&
    props.data.animation.keyframes.length > 0
  )
})

/**
 * 计算可见的关键帧
 */
const visibleKeyframes = computed(() => {
  if (!hasKeyframes.value) return []

  const keyframes = props.data.animation!.keyframes
  const timeRange = props.data.timeRange
  const clipStartFrame = timeRange.timelineStartTime
  const clipEndFrame = timeRange.timelineEndTime

  // 计算clip在时间轴上的像素位置和宽度（使用统一store的坐标转换）
  const clipLeft = unifiedStore.frameToPixel(clipStartFrame, props.timelineWidth)
  const clipRight = unifiedStore.frameToPixel(clipEndFrame, props.timelineWidth)
  const clipWidth = clipRight - clipLeft

  return keyframes
    .map((keyframe) => {
      // 将相对帧数转换为绝对帧数
      const absoluteFrame = relativeFrameToAbsoluteFrame(keyframe.framePosition, timeRange)

      // 计算关键帧在整个时间轴上的像素位置（考虑缩放级别）
      const absolutePixelPosition = unifiedStore.frameToPixel(absoluteFrame, props.timelineWidth)

      // 关键帧标记应该使用相对于clip容器的位置
      const relativePixelPosition = absolutePixelPosition - clipLeft

      return {
        framePosition: keyframe.framePosition,
        absoluteFrame,
        pixelPosition: relativePixelPosition,
        isVisible: relativePixelPosition >= 0 && relativePixelPosition <= clipWidth,
      }
    })
    .filter((kf) => kf.isVisible)
})

/**
 * 获取关键帧标记样式
 */
function getKeyframeMarkerStyles(pixelPosition: number): Record<string, string> {
  // 根据媒体类型使用不同的偏移量
  let offset = -6.5 // 视频/图片/音频的默认偏移
  if (props.data.mediaType === 'text') {
    offset = -6.5 // 文本的偏移量与旧架构保持一致
  }

  return {
    left: `${pixelPosition + offset}px`,
  }
}

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

  // 吸附指示器已禁用
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

    // 吸附功能已禁用，直接使用计算的帧数

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

    // 吸附功能已禁用，直接使用计算的帧数

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
  if (
    tempDurationFrames.value !== resizeStartDurationFrames.value ||
    tempResizePositionFrames.value !== resizeStartPositionFrames.value
  ) {
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
      const success = await unifiedStore.resizeTimelineItemWithHistory(props.data.id, newTimeRange)
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
  // 吸附指示器已禁用

  if (direction) {
    // 这里可以发出resize-end事件，但新架构可能不需要
    console.log('🏁 [UnifiedTimelineClip] resize结束:', direction)
  }
}

/**
 * 显示工具提示
 */
function showTooltip(event: MouseEvent) {
  // 如果正在拖拽或调整大小，不显示tooltip
  if (isDragging.value || isResizing.value) return

  showTooltipFlag.value = true

  // 获取clip元素的位置信息
  const clipElement = event.currentTarget as HTMLElement
  const clipRect = clipElement.getBoundingClientRect()

  // 更新tooltip位置数据
  tooltipPosition.value = {
    x: event.clientX,
    y: event.clientY,
  }
  clipTopPosition.value = clipRect.top
}

/**
 * 更新工具提示位置
 */
function updateTooltipPosition(event: MouseEvent) {
  // 只有在tooltip显示时才更新位置
  if (!showTooltipFlag.value) return
  // 如果正在拖拽或调整大小，不更新tooltip位置
  if (isDragging.value || isResizing.value) return

  // 获取clip元素的位置信息
  const clipElement = event.currentTarget as HTMLElement
  const clipRect = clipElement.getBoundingClientRect()

  // 更新tooltip位置数据
  tooltipPosition.value = {
    x: event.clientX,
    y: event.clientY,
  }
  clipTopPosition.value = clipRect.top
}

/**
 * 隐藏工具提示
 */
function hideTooltip() {
  showTooltipFlag.value = false
}

/**
 * 跳转到指定关键帧
 */
function jumpToKeyframe(absoluteFrame: number) {
  console.log('🎯 [UnifiedTimelineClip] 关键帧跳转:', {
    itemId: props.data.id,
    targetFrame: absoluteFrame,
  })

  // 暂停播放以便进行时间跳转
  pauseForEditing('关键帧跳转')
  
  // 通过WebAV进行时间跳转，这会触发画布渲染更新
  try {
    // 使用webAVSeekTo方法，确保画布渲染得到更新
    unifiedStore.webAVSeekTo(absoluteFrame)
  } catch (error) {
    console.error('❌ [UnifiedTimelineClip] 关键帧跳转失败:', error)
  }
}

// ==================== 生命周期 ====================

onUnmounted(() => {
  // 清理工作
})
</script>

<style scoped>
/* 容器样式 - 位置和尺寸由动态样式控制 */
.unified-timeline-clip-container {
  position: absolute;
  width: auto;
  height: auto;
  /* 移除max-width限制，允许clip在高缩放级别下正常拉伸 */
  max-height: 100%;
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

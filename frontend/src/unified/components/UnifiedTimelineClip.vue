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
import { ContentRendererFactory } from './renderers/ContentRendererFactory'

// ==================== 组件定义 ====================

// 定义组件属性
const props = withDefaults(defineProps<UnifiedTimelineClipProps>(), {
  isSelected: false,
  isDragging: false,
  isResizing: false,
  currentFrame: 0,
  scale: 1,
  trackHeight: 60
})

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
      'dragging': props.isDragging,
      'resizing': props.isResizing
    }
  ]
  
  // 添加渲染器提供的自定义类
  const customClasses = renderer.value.getCustomClasses?.(renderContext.value) || []

  return [...baseClasses, ...customClasses]
})

/**
 * 动态样式
 */
const clipStyles = computed(() => {
  const baseStyles = {
    // 基础样式将在CSS中定义
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
  emit('dragStart', event, props.data.id)
}

/**
 * 处理拖拽结束事件
 */
function handleDragEnd(event: DragEvent) {
  // 拖拽结束的处理逻辑
}

/**
 * 处理调整大小开始事件
 */
function handleResizeStart(direction: 'left' | 'right', event: MouseEvent) {
  emit('resizeStart', event, props.data.id, direction)
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
  position: relative;
  height: 100%;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  
  /* 基础边框和背景 */
  border: 1px solid #d9d9d9;
  background: #fafafa;
}

.unified-timeline-clip.selected {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.unified-timeline-clip.dragging {
  opacity: 0.8;
  transform: rotate(2deg);
}

.unified-timeline-clip.resizing {
  cursor: col-resize;
}

/* 媒体类型特定样式 */
.unified-timeline-clip.media-type-video {
  background: linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%);
}

.unified-timeline-clip.media-type-image {
  background: linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%);
}

.unified-timeline-clip.media-type-audio {
  background: linear-gradient(135deg, #fff7e6 0%, #ffd591 100%);
}

.unified-timeline-clip.media-type-text {
  background: linear-gradient(135deg, #f9f0ff 0%, #d3adf7 100%);
}

.unified-timeline-clip.media-type-unknown {
  background: linear-gradient(135deg, #f5f5f5 0%, #d9d9d9 100%);
}

/* 状态特定样式 */
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
</style>

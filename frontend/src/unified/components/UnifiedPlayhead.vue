<template>
  <div
    class="playhead-container"
    ref="playheadContainer"
    @mousedown="handleContainerMouseDown"
    @wheel="handleWheel"
    :class="{
      'container-interactive': enableContainerClick,
      dragging: isDragging && enableContainerClick,
    }"
  >
    <!-- 播放头手柄 -->
    <div
      class="playhead-handle"
      :style="{ left: playheadPosition + 'px' }"
      @mousedown="startDragPlayhead"
      :class="{ dragging: isDragging }"
    >
      <!-- 白色倒三角 -->
      <div class="playhead-triangle"></div>
    </div>

    <!-- 播放竖线 - 覆盖整个时间轴 -->
    <div class="playhead-line" :style="{ left: playheadLinePosition + 'px' }"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useUnifiedStore } from '../unifiedStore'
import { usePlaybackControls } from '../composables/usePlaybackControls'
import { useSnapManager } from '../composables/useSnapManager'
import { alignFramesToFrame, framesToMicroseconds } from '../utils/timeUtils'

interface PlayheadProps {
  /** 时间轴容器宽度 */
  timelineWidth: number
  /** 轨道控制区域宽度（左侧偏移） */
  trackControlWidth?: number
  /** 播放头手柄的容器元素（用于计算相对位置） */
  handleContainer?: HTMLElement | null
  /** 滚轮事件的目标容器元素 */
  wheelContainer?: HTMLElement | null
  /** 是否启用整个容器区域的点击交互 */
  enableContainerClick?: boolean
  /** 是否启用吸附功能 */
  enableSnapping?: boolean
}

const props = withDefaults(defineProps<PlayheadProps>(), {
  trackControlWidth: 150,
  handleContainer: null,
  wheelContainer: null,
  enableContainerClick: false,
  enableSnapping: true,
})

const unifiedStore = useUnifiedStore()
const { pauseForEditing } = usePlaybackControls()
const snapManager = useSnapManager()

const playheadContainer = ref<HTMLElement>()
const isDragging = ref(false)

// 用于检测边界点变化的缓存
let lastBoundariesString = ''

/**
 * 计算所有clip的边界帧数（开始和结束帧）- 使用computed自动缓存
 */
const clipBoundaryFrames = computed(() => {
  const boundaries: number[] = []

  // 添加时间轴开始位置（0帧）
  boundaries.push(0)

  // 遍历所有时间轴项目，收集开始和结束帧
  unifiedStore.timelineItems.forEach((item) => {
    const timeRange = item.timeRange
    boundaries.push(timeRange.timelineStartTime)
    boundaries.push(timeRange.timelineEndTime)
  })

  // 去重并排序
  const result = [...new Set(boundaries)].sort((a, b) => a - b)

  // 只在边界点发生变化时输出调试信息
  const currentBoundariesString = result.join(',')
  if (currentBoundariesString !== lastBoundariesString) {
    console.log('🔄 更新clip边界点缓存:', {
      边界点数量: result.length,
      边界点: result,
      时间轴项目数: unifiedStore.timelineItems.length,
    })
    lastBoundariesString = currentBoundariesString
  }

  return result
})

/**
 * 应用吸附逻辑到目标帧数（使用新的吸附管理器）
 */
function applySnapToClips(targetFrames: number): number {
  // 如果未启用吸附，直接返回原始帧数
  if (!props.enableSnapping) {
    return targetFrames
  }

  // 使用新的吸附管理器计算吸附结果
  const snapResult = snapManager.calculatePlayheadSnap(
    targetFrames,
    props.timelineWidth,
    {
      temporaryDisabled: !props.enableSnapping
    }
  )

  // 调试信息：如果发生了吸附，输出日志
  // if (snapResult.snapped && snapResult.snapPoint) {
  //   console.log('🧲 播放头吸附:', {
  //     原始帧数: targetFrames,
  //     吸附到: snapResult.frame,
  //     吸附类型: snapResult.snapPoint.type,
  //     吸附距离: snapResult.distance,
  //     微秒数: framesToMicroseconds(snapResult.frame),
  //   })
  // }

  return snapResult.frame
}

// 播放头手柄位置（相对于时间刻度区域）
const playheadPosition = computed(() => {
  const currentFrame = unifiedStore.currentFrame
  const pixelPosition = unifiedStore.frameToPixel(currentFrame, props.timelineWidth)
  // 如果是在 TimeScale 中使用（trackControlWidth = 0），直接返回像素位置
  // 如果是在 Timeline 中使用，需要加上偏移
  return props.trackControlWidth + pixelPosition
})

// 播放竖线位置（与播放头手柄位置保持一致）
const playheadLinePosition = computed(() => {
  return playheadPosition.value
})

/**
 * 处理容器区域的鼠标按下事件（用于整个时间刻度区域的交互）
 */
function handleContainerMouseDown(event: MouseEvent) {
  if (!props.enableContainerClick) return

  // 如果点击的是播放头手柄，让播放头手柄自己处理
  const target = event.target as HTMLElement
  if (target.closest('.playhead-handle')) {
    return
  }

  // 如果已经在拖拽，不处理
  if (isDragging.value) return

  // 立即跳转到点击位置并开始拖拽
  jumpToClickPosition(event)
  startDragFromClick(event)
}

/**
 * 跳转到点击位置
 */
function jumpToClickPosition(event: MouseEvent) {
  const container = props.handleContainer || playheadContainer.value
  if (!container) return

  // 暂停播放以便进行时间跳转
  pauseForEditing('时间轴点击')

  const rect = container.getBoundingClientRect()
  const clickX = event.clientX - rect.left

  // 减去轨道控制区域的偏移，得到实际的时间轴像素位置
  const timelinePixelX = clickX - props.trackControlWidth

  // 转换为帧数
  const clickFrames = unifiedStore.pixelToFrame(timelinePixelX, props.timelineWidth)
  const clampedFrames = Math.max(0, clickFrames)

  // 应用吸附逻辑
  const snappedFrames = applySnapToClips(clampedFrames)
  const alignedFrames = alignFramesToFrame(snappedFrames)

  // 通过WebAV设置帧数
  unifiedStore.webAVSeekTo(alignedFrames)
}

/**
 * 从点击位置开始拖拽
 */
function startDragFromClick(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()

  isDragging.value = true

  document.addEventListener('mousemove', handleDragPlayhead)
  document.addEventListener('mouseup', stopDragPlayhead)
}

/**
 * 开始拖拽播放头（从播放头手柄开始）
 */
function startDragPlayhead(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()

  // 暂停播放以便进行播放头拖拽
  pauseForEditing('播放头拖拽')

  isDragging.value = true

  document.addEventListener('mousemove', handleDragPlayhead)
  document.addEventListener('mouseup', stopDragPlayhead)
}

/**
 * 处理播放头拖拽
 */
function handleDragPlayhead(event: MouseEvent) {
  if (!isDragging.value) return

  const container = props.handleContainer || playheadContainer.value
  if (!container) return

  const rect = container.getBoundingClientRect()
  const mouseX = event.clientX - rect.left

  // 减去轨道控制区域的偏移，得到实际的时间轴像素位置
  const timelinePixelX = mouseX - props.trackControlWidth

  // 转换为帧数
  const dragFrames = unifiedStore.pixelToFrame(timelinePixelX, props.timelineWidth)
  const clampedFrames = Math.max(0, dragFrames)

  // 应用吸附逻辑
  const snappedFrames = applySnapToClips(clampedFrames)
  const alignedFrames = alignFramesToFrame(snappedFrames)

  // 通过WebAV设置帧数
  unifiedStore.webAVSeekTo(alignedFrames)
}

/**
 * 停止拖拽播放头
 */
function stopDragPlayhead() {
  isDragging.value = false

  document.removeEventListener('mousemove', handleDragPlayhead)
  document.removeEventListener('mouseup', stopDragPlayhead)

  // 防止拖拽结束后触发意外的点击事件
  const preventClick = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    document.removeEventListener('click', preventClick, true)
  }

  document.addEventListener('click', preventClick, true)
  setTimeout(() => {
    document.removeEventListener('click', preventClick, true)
  }, 50)
}

/**
 * 处理时间轴点击跳转
 */
function handleTimelineClick(event: MouseEvent) {
  if (isDragging.value) return

  const container = props.handleContainer || playheadContainer.value
  if (!container) return

  // 暂停播放以便进行时间跳转
  pauseForEditing('时间轴点击')

  const rect = container.getBoundingClientRect()
  const clickX = event.clientX - rect.left

  // 减去轨道控制区域的偏移，得到实际的时间轴像素位置
  const timelinePixelX = clickX - props.trackControlWidth

  // 转换为帧数
  const clickFrames = unifiedStore.pixelToFrame(timelinePixelX, props.timelineWidth)
  const clampedFrames = Math.max(0, clickFrames)

  // 应用吸附逻辑
  const snappedFrames = applySnapToClips(clampedFrames)
  const alignedFrames = alignFramesToFrame(snappedFrames)

  // 通过WebAV设置帧数
  unifiedStore.webAVSeekTo(alignedFrames)
}

/**
 * 处理滚轮事件 - 将事件传播给父组件处理
 */
function handleWheel(event: WheelEvent) {
  if (!props.wheelContainer) {
    return
  }

  // 阻止当前事件的默认行为和冒泡
  event.preventDefault()
  event.stopPropagation()

  // 创建一个新的滚轮事件并在目标容器上触发
  const newEvent = new WheelEvent('wheel', {
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    deltaZ: event.deltaZ,
    deltaMode: event.deltaMode,
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    bubbles: true,
    cancelable: true,
  })

  props.wheelContainer.dispatchEvent(newEvent)
}

// 暴露方法给父组件
defineExpose({
  handleTimelineClick,
  isDragging: computed(() => isDragging.value),
})

onUnmounted(() => {
  // 清理事件监听器
  document.removeEventListener('mousemove', handleDragPlayhead)
  document.removeEventListener('mouseup', stopDragPlayhead)
})
</script>

<style scoped>
.playhead-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none; /* 默认容器本身不接收事件 */
}

.playhead-container.container-interactive {
  pointer-events: auto; /* 启用容器交互时允许接收事件 */
  cursor: pointer;
}

.playhead-container.container-interactive.dragging {
  cursor: grabbing !important;
}

.playhead-handle {
  position: absolute;
  top: 0;
  height: 100%;
  width: 20px; /* 增加点击区域 */
  margin-left: -10px; /* 居中对齐 */
  pointer-events: auto; /* 允许交互 */
  z-index: 25; /* 确保在播放竖线之上，但在clip tooltip之下 */
  cursor: grab;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 0; /* 移除顶部间距，让三角形紧贴顶端 */
}

.playhead-handle:hover {
  cursor: grab;
}

.playhead-handle.dragging {
  cursor: grabbing;
}

.playhead-triangle {
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 10px solid white; /* 白色倒三角，稍微大一些 */
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.playhead-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: white; /* 白色竖线 */
  pointer-events: none;
  z-index: 20; /* 确保在所有内容之上，但在clip tooltip之下 */
  margin-left: -1px; /* 居中对齐 */
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
}
</style>
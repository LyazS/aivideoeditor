<template>
  <div class="time-scale">
    <div class="scale-container" ref="scaleContainer">
      <!-- 时间刻度标记 -->
      <div
        v-for="mark in timeMarks"
        :key="mark.time"
        class="time-mark"
        :style="{ left: mark.position + 'px' }"
      >
        <div class="mark-line" :class="{ major: mark.isMajor }"></div>
        <div v-if="mark.isMajor" class="mark-label">
          {{ formatTime(mark.time) }}
        </div>
      </div>

      <!-- 播放头 -->
      <div
        class="playhead"
        :style="{ left: playheadPosition + 'px' }"
        @mousedown="startDragPlayhead"
      >
        <div class="playhead-line"></div>
        <div class="playhead-handle"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { useWebAVControls } from '../composables/useWebAVControls'
import { usePlaybackControls } from '../composables/usePlaybackControls'

import { calculateVisibleFrameRange } from '../stores/utils/coordinateUtils'
import { framesToTimecode, alignFramesToFrame } from '../stores/utils/timeUtils'
import type { TimeMark } from '../types'

const videoStore = useVideoStore()
const webAVControls = useWebAVControls()
const { pauseForEditing } = usePlaybackControls()
const scaleContainer = ref<HTMLElement>()
const containerWidth = ref(800)

// 播放头拖拽状态
const isDraggingPlayhead = ref(false)

// TimeMark 接口已移动到统一类型文件 src/types/index.ts

// 计算时间刻度标记（基于帧数）
const timeMarks = computed((): TimeMark[] => {
  const marks: TimeMark[] = []
  const durationFrames = videoStore.totalDurationFrames
  const pixelsPerFrame = (containerWidth.value * videoStore.zoomLevel) / durationFrames

  // 根据缩放级别决定刻度间隔（基于帧数）
  let majorIntervalFrames = 300 // 主刻度间隔（帧）- 默认10秒
  let minorIntervalFrames = 30 // 次刻度间隔（帧）- 默认1秒

  // 在高缩放级别下，显示更精细的刻度
  let isFrameLevel = false

  // 基于每帧像素数决定刻度间隔
  if (pixelsPerFrame >= 3.33) {
    // 相当于100 pixels/second
    // 帧级别显示
    majorIntervalFrames = 30 // 1秒间隔
    minorIntervalFrames = 1 // 每帧
    isFrameLevel = true
  } else if (pixelsPerFrame >= 1.67) {
    // 相当于50 pixels/second
    // 每0.1秒显示刻度
    majorIntervalFrames = 30 // 1秒
    minorIntervalFrames = 3 // 0.1秒
  } else if (pixelsPerFrame >= 0.67) {
    // 相当于20 pixels/second
    // 每0.5秒显示刻度
    majorIntervalFrames = 150 // 5秒
    minorIntervalFrames = 15 // 0.5秒
  } else if (pixelsPerFrame >= 0.33) {
    // 相当于10 pixels/second
    majorIntervalFrames = 300 // 10秒
    minorIntervalFrames = 30 // 1秒
  } else if (pixelsPerFrame >= 0.17) {
    // 相当于5 pixels/second
    majorIntervalFrames = 900 // 30秒
    minorIntervalFrames = 150 // 5秒
  } else if (pixelsPerFrame >= 0.067) {
    // 相当于2 pixels/second
    majorIntervalFrames = 1800 // 60秒
    minorIntervalFrames = 300 // 10秒
  } else if (pixelsPerFrame >= 0.033) {
    // 相当于1 pixel/second
    // 极低缩放：每2分钟主刻度，30秒次刻度
    majorIntervalFrames = 3600 // 120秒
    minorIntervalFrames = 900 // 30秒
  } else if (pixelsPerFrame >= 0.017) {
    // 相当于0.5 pixels/second
    // 超低缩放：每5分钟主刻度，1分钟次刻度
    majorIntervalFrames = 9000 // 300秒
    minorIntervalFrames = 1800 // 60秒
  } else {
    // 最低缩放：每10分钟主刻度，2分钟次刻度
    majorIntervalFrames = 18000 // 600秒
    minorIntervalFrames = 3600 // 120秒
  }

  // 计算可见帧数范围
  const maxVisibleDurationFrames = videoStore.maxVisibleDurationFrames
  const { startFrames, endFrames } = calculateVisibleFrameRange(
    containerWidth.value,
    durationFrames,
    videoStore.zoomLevel,
    videoStore.scrollOffset,
    maxVisibleDurationFrames,
  )

  // 生成刻度标记（基于帧数范围）

  // 计算刻度线的最小像素间距，确保不会过于密集
  const minPixelSpacing = 15 // 最小15像素间距
  const actualMinorPixelSpacing = minorIntervalFrames * pixelsPerFrame

  // 如果计算出的间距太小，动态调整间隔
  let adjustedMinorIntervalFrames = minorIntervalFrames
  let adjustedMajorIntervalFrames = majorIntervalFrames

  if (actualMinorPixelSpacing < minPixelSpacing) {
    const scaleFactor = Math.ceil(minPixelSpacing / actualMinorPixelSpacing)
    adjustedMinorIntervalFrames = minorIntervalFrames * scaleFactor
    adjustedMajorIntervalFrames = majorIntervalFrames * scaleFactor
  }

  // 重新计算起始和结束标记（基于帧数）
  const adjustedStartFrames =
    Math.floor(startFrames / adjustedMinorIntervalFrames) * adjustedMinorIntervalFrames
  const adjustedEndFrames =
    Math.ceil(endFrames / adjustedMinorIntervalFrames) * adjustedMinorIntervalFrames

  // 生成帧数刻度标记
  for (
    let frames = adjustedStartFrames;
    frames <= adjustedEndFrames;
    frames += adjustedMinorIntervalFrames
  ) {
    if (frames < 0) continue

    const isMajor = Math.abs(frames % adjustedMajorIntervalFrames) < 0.5 // 使用小的容差来处理整数精度问题
    const position = videoStore.frameToPixel(frames, containerWidth.value)

    // 只添加在可见范围内的刻度
    if (position >= -50 && position <= containerWidth.value + 50) {
      // 直接使用帧数
      marks.push({
        time: frames, // 帧数
        position,
        isMajor,
        isFrame: isFrameLevel && Math.abs(frames % adjustedMinorIntervalFrames) < 0.5,
      })
    }
  }

  return marks
})

// 播放头位置 - 使用帧数精确计算
const playheadPosition = computed(() => {
  const currentFrame = videoStore.currentFrame
  const position = videoStore.frameToPixel(currentFrame, containerWidth.value)

  return position
})

function formatTime(frames: number): string {
  return framesToTimecode(frames)
}

function updateContainerWidth() {
  if (scaleContainer.value) {
    containerWidth.value = scaleContainer.value.clientWidth
  }
}

function handleClick(event: MouseEvent) {
  // 如果正在拖拽播放头，不处理点击事件
  if (isDraggingPlayhead.value) return
  if (!scaleContainer.value) return

  // 暂停播放以便进行时间跳转
  pauseForEditing('时间刻度点击')

  const rect = scaleContainer.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left

  // 直接转换为帧数
  const clickFrames = videoStore.pixelToFrame(clickX, containerWidth.value)
  const clampedFrames = Math.max(0, clickFrames)
  const alignedFrames = alignFramesToFrame(clampedFrames)

  // 统一时间控制：通过WebAV设置帧数
  webAVControls.seekTo(alignedFrames)

  console.log('🎯 时间轴点击跳转:', {
    clickFrames: alignedFrames,
    timecode: framesToTimecode(alignedFrames),
  })
}

function handleMouseDown(event: MouseEvent) {
  // 如果点击的是播放头，让播放头自己的mousedown处理
  const target = event.target as HTMLElement
  if (target.closest('.playhead')) {
    return
  }

  // 如果正在拖拽播放头，不处理鼠标按下事件
  if (isDraggingPlayhead.value) return
  if (!scaleContainer.value) return

  // 暂停播放以便进行播放头拖拽
  pauseForEditing('时间轴拖拽')

  const rect = scaleContainer.value.getBoundingClientRect()
  const mouseX = event.clientX - rect.left

  // 直接转换为帧数
  const mouseFrames = videoStore.pixelToFrame(mouseX, containerWidth.value)
  const clampedFrames = Math.max(0, mouseFrames)
  const alignedFrames = alignFramesToFrame(clampedFrames)

  // 立即跳转播放头到鼠标位置
  webAVControls.seekTo(alignedFrames)

  // 开始拖拽播放头
  isDraggingPlayhead.value = true

  // 添加拖拽样式类
  if (scaleContainer.value) {
    scaleContainer.value.classList.add('dragging')
  }

  document.addEventListener('mousemove', handleDragPlayhead)
  document.addEventListener('mouseup', stopDragPlayhead)

  event.preventDefault()
  event.stopPropagation()
}

function startDragPlayhead(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()

  // 暂停播放以便进行播放头拖拽
  pauseForEditing('播放头拖拽')

  isDraggingPlayhead.value = true

  // 添加拖拽样式类
  if (scaleContainer.value) {
    scaleContainer.value.classList.add('dragging')
  }

  document.addEventListener('mousemove', handleDragPlayhead)
  document.addEventListener('mouseup', stopDragPlayhead)
}

function handleDragPlayhead(event: MouseEvent) {
  if (!isDraggingPlayhead.value || !scaleContainer.value) return

  const rect = scaleContainer.value.getBoundingClientRect()
  const mouseX = event.clientX - rect.left

  // 直接转换为帧数
  const dragFrames = videoStore.pixelToFrame(mouseX, containerWidth.value)
  const clampedFrames = Math.max(0, dragFrames)
  const alignedFrames = alignFramesToFrame(clampedFrames)

  // 统一时间控制：通过WebAV设置帧数
  webAVControls.seekTo(alignedFrames)
}

function stopDragPlayhead() {
  isDraggingPlayhead.value = false

  // 移除拖拽样式类
  if (scaleContainer.value) {
    scaleContainer.value.classList.remove('dragging')
  }

  document.removeEventListener('mousemove', handleDragPlayhead)
  document.removeEventListener('mouseup', stopDragPlayhead)
}

function handleWheel(event: WheelEvent) {
  event.preventDefault()

  if (event.altKey) {
    // Alt + 滚轮：缩放
    const zoomFactor = 1.2 // 增加缩放因子，让缩放更快
    const rect = scaleContainer.value?.getBoundingClientRect()
    if (!rect) {
      if (window.DEBUG_TIMELINE_ZOOM) {
        console.error('❌ 无法获取时间刻度容器边界')
      }
      return
    }

    // 获取鼠标在时间轴上的位置（使用帧数版本）
    const mouseX = event.clientX - rect.left
    const mouseFrames = videoStore.pixelToFrame(mouseX, containerWidth.value)

    // 缩放操作（精简调试信息）

    if (event.deltaY < 0) {
      // 向上滚动：放大
      videoStore.zoomIn(zoomFactor, containerWidth.value)
    } else {
      // 向下滚动：缩小
      videoStore.zoomOut(zoomFactor, containerWidth.value)
    }

    // 调整滚动偏移量，使鼠标位置保持在相同的帧数点
    const newMousePixel = videoStore.frameToPixel(mouseFrames, containerWidth.value)
    const offsetAdjustment = newMousePixel - mouseX
    const newScrollOffset = videoStore.scrollOffset + offsetAdjustment

    videoStore.setScrollOffset(newScrollOffset, containerWidth.value)
  } else if (event.shiftKey) {
    // Shift + 滚轮：水平滚动
    const scrollAmount = 50

    if (event.deltaY < 0) {
      // 向上滚动：向左滚动
      videoStore.scrollLeft(scrollAmount, containerWidth.value)
    } else {
      // 向下滚动：向右滚动
      videoStore.scrollRight(scrollAmount, containerWidth.value)
    }
  }
}

onMounted(() => {
  updateContainerWidth()
  window.addEventListener('resize', updateContainerWidth)

  if (scaleContainer.value) {
    scaleContainer.value.addEventListener('click', handleClick)
    scaleContainer.value.addEventListener('mousedown', handleMouseDown)
    scaleContainer.value.addEventListener('wheel', handleWheel, { passive: false })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerWidth)

  if (scaleContainer.value) {
    scaleContainer.value.removeEventListener('click', handleClick)
    scaleContainer.value.removeEventListener('mousedown', handleMouseDown)
    scaleContainer.value.removeEventListener('wheel', handleWheel)
  }

  // 清理播放头拖拽事件监听器
  document.removeEventListener('mousemove', handleDragPlayhead)
  document.removeEventListener('mouseup', stopDragPlayhead)
})
</script>

<style scoped>
.time-scale {
  height: 40px;
  background-color: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-bg-quaternary);
  position: relative;
  overflow: hidden;
}

.scale-container {
  width: 100%;
  height: 100%;
  position: relative;
  cursor: pointer;
}

.scale-container.dragging {
  cursor: grabbing !important;
}

.scale-container.dragging .playhead {
  pointer-events: none; /* 拖拽时禁用播放头的指针事件 */
}

.time-mark {
  position: absolute;
  top: 0;
  height: 100%;
  pointer-events: none;
}

.mark-line {
  width: 1px;
  background-color: var(--color-border-secondary);
  height: 20px;
  margin-top: 20px;
}

.mark-line.major {
  background-color: var(--color-text-hint);
  height: 30px;
  margin-top: 10px;
}

.mark-label {
  position: absolute;
  top: 5px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: #ccc;
  white-space: nowrap;
  font-family: monospace;
}

.playhead {
  position: absolute;
  top: 0;
  height: 100%;
  pointer-events: auto; /* 允许交互 */
  z-index: 10;
  cursor: grab; /* 显示可拖拽的光标 */
}

.playhead:active {
  cursor: grabbing; /* 拖拽时的光标 */
}

.playhead-line {
  width: 2px;
  height: 100%;
  background-color: #ff4444;
  margin-left: -1px;
}

.playhead-handle {
  width: 14px;
  height: 14px;
  background-color: #ff4444;
  border-radius: 50%;
  position: absolute;
  top: -7px;
  left: -7px;
  border: 2px solid white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  transition: all 0.2s ease;
}

.playhead:hover .playhead-handle {
  width: 16px;
  height: 16px;
  top: -8px;
  left: -8px;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5);
}
</style>

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
import { useVideoStore } from '../stores/videostore'

const videoStore = useVideoStore()
const scaleContainer = ref<HTMLElement>()
const containerWidth = ref(800)

// 播放头拖拽状态
const isDraggingPlayhead = ref(false)

interface TimeMark {
  time: number
  position: number
  isMajor: boolean
  isFrame?: boolean // 标记是否为帧级别的刻度
}

// 计算时间刻度标记
const timeMarks = computed((): TimeMark[] => {
  const marks: TimeMark[] = []
  const duration = videoStore.totalDuration
  const pixelsPerSecond = (containerWidth.value * videoStore.zoomLevel) / duration

  // 根据缩放级别决定刻度间隔
  let majorInterval = 10 // 主刻度间隔（秒）
  let minorInterval = 1 // 次刻度间隔（秒）

  // 在高缩放级别下，显示更精细的刻度
  let isFrameLevel = false

  if (pixelsPerSecond >= 100) {
    // 降低帧级别的阈值
    // 每帧显示刻度（假设30fps）
    majorInterval = 1
    minorInterval = 1 / videoStore.frameRate
    isFrameLevel = true
  } else if (pixelsPerSecond >= 50) {
    // 每0.1秒显示刻度
    majorInterval = 1
    minorInterval = 0.1
  } else if (pixelsPerSecond >= 20) {
    // 每0.5秒显示刻度
    majorInterval = 5
    minorInterval = 0.5
  } else if (pixelsPerSecond >= 10) {
    majorInterval = 10
    minorInterval = 1
  } else if (pixelsPerSecond >= 5) {
    majorInterval = 30
    minorInterval = 5
  } else if (pixelsPerSecond >= 2) {
    majorInterval = 60
    minorInterval = 10
  } else if (pixelsPerSecond >= 1) {
    // 极低缩放：每2分钟主刻度，30秒次刻度
    majorInterval = 120
    minorInterval = 30
  } else if (pixelsPerSecond >= 0.5) {
    // 超低缩放：每5分钟主刻度，1分钟次刻度
    majorInterval = 300
    minorInterval = 60
  } else {
    // 最低缩放：每10分钟主刻度，2分钟次刻度
    majorInterval = 600
    minorInterval = 120
  }

  // 计算可见时间范围（受最大可见范围限制）
  const startTime = videoStore.scrollOffset / pixelsPerSecond
  const calculatedEndTime = startTime + containerWidth.value / pixelsPerSecond
  const endTime = Math.min(calculatedEndTime, videoStore.maxVisibleDuration)

  // 生成刻度标记（基于可见范围，不受当前内容长度限制）

  // 计算刻度线的最小像素间距，确保不会过于密集
  const minPixelSpacing = 15 // 最小15像素间距
  const actualMinorPixelSpacing = minorInterval * pixelsPerSecond

  // 如果计算出的间距太小，动态调整间隔
  let adjustedMinorInterval = minorInterval
  let adjustedMajorInterval = majorInterval

  if (actualMinorPixelSpacing < minPixelSpacing) {
    const scaleFactor = Math.ceil(minPixelSpacing / actualMinorPixelSpacing)
    adjustedMinorInterval = minorInterval * scaleFactor
    adjustedMajorInterval = majorInterval * scaleFactor
  }

  // 重新计算起始和结束标记
  const adjustedStartMark = Math.floor(startTime / adjustedMinorInterval) * adjustedMinorInterval
  const adjustedEndMark = Math.ceil(endTime / adjustedMinorInterval) * adjustedMinorInterval

  // 当缩小时间轴时，允许刻度线扩展到可见范围的末尾，而不是被内容长度限制
  // 这样用户就可以看到1分钟之后的刻度线，并且可以拖拽视频到那些位置
  for (let time = adjustedStartMark; time <= adjustedEndMark; time += adjustedMinorInterval) {
    if (time < 0) continue

    const isMajor = Math.abs(time % adjustedMajorInterval) < 0.001 // 使用小的容差来处理浮点数精度问题
    const position = videoStore.timeToPixel(time, containerWidth.value)

    // 只添加在可见范围内的刻度
    if (position >= -50 && position <= containerWidth.value + 50) {
      marks.push({
        time,
        position,
        isMajor,
        isFrame: isFrameLevel && Math.abs(time % adjustedMinorInterval) < 0.001,
      })
    }
  }

  return marks
})

// 将时间对齐到帧边界
function alignTimeToFrame(time: number): number {
  const frameDuration = 1 / videoStore.frameRate
  return Math.floor(time / frameDuration) * frameDuration
}

// 播放头位置 - 始终对齐到帧的左边界
const playheadPosition = computed(() => {
  const originalTime = videoStore.currentTime
  const alignedTime = alignTimeToFrame(originalTime)
  const position = videoStore.timeToPixel(alignedTime, containerWidth.value)

  return position
})

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const frames = Math.floor((seconds % 1) * videoStore.frameRate)

  // 根据缩放级别决定显示精度
  const pixelsPerSecond = (containerWidth.value * videoStore.zoomLevel) / videoStore.totalDuration

  if (pixelsPerSecond >= 300) {
    // 高缩放级别：显示帧
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`
  } else if (pixelsPerSecond >= 100) {
    // 中等缩放级别：显示毫秒
    const ms = Math.floor((seconds % 1) * 100)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  } else {
    // 低缩放级别：只显示分秒
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
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

  const rect = scaleContainer.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const newTime = videoStore.pixelToTime(clickX, containerWidth.value)

  // 限制在有效范围内并对齐到帧边界
  const clampedTime = Math.max(0, Math.min(newTime, videoStore.totalDuration))
  const alignedTime = alignTimeToFrame(clampedTime)

  videoStore.setCurrentTime(alignedTime)
}

function startDragPlayhead(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()

  isDraggingPlayhead.value = true

  document.addEventListener('mousemove', handleDragPlayhead)
  document.addEventListener('mouseup', stopDragPlayhead)
}

function handleDragPlayhead(event: MouseEvent) {
  if (!isDraggingPlayhead.value || !scaleContainer.value) return

  const rect = scaleContainer.value.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const newTime = videoStore.pixelToTime(mouseX, containerWidth.value)

  // 限制在有效范围内并对齐到帧边界
  const clampedTime = Math.max(0, Math.min(newTime, videoStore.totalDuration))
  const alignedTime = alignTimeToFrame(clampedTime)

  videoStore.setCurrentTime(alignedTime)
}

function stopDragPlayhead() {
  isDraggingPlayhead.value = false

  document.removeEventListener('mousemove', handleDragPlayhead)
  document.removeEventListener('mouseup', stopDragPlayhead)
}

function handleWheel(event: WheelEvent) {
  event.preventDefault()

  if (event.altKey) {
    // Alt + 滚轮：缩放
    const zoomFactor = 1.2 // 增加缩放因子，让缩放更快
    const rect = scaleContainer.value?.getBoundingClientRect()
    if (!rect) return

    // 获取鼠标在时间轴上的位置
    const mouseX = event.clientX - rect.left
    const mouseTime = videoStore.pixelToTime(mouseX, containerWidth.value)

    if (event.deltaY < 0) {
      // 向上滚动：放大
      videoStore.zoomIn(zoomFactor, containerWidth.value)
    } else {
      // 向下滚动：缩小
      videoStore.zoomOut(zoomFactor, containerWidth.value)
    }

    // 调整滚动偏移量，使鼠标位置保持在相同的时间点
    const newMousePixel = videoStore.timeToPixel(mouseTime, containerWidth.value)
    const offsetAdjustment = newMousePixel - mouseX
    videoStore.setScrollOffset(videoStore.scrollOffset + offsetAdjustment, containerWidth.value)
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
    scaleContainer.value.addEventListener('wheel', handleWheel, { passive: false })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerWidth)

  if (scaleContainer.value) {
    scaleContainer.value.removeEventListener('click', handleClick)
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
  background-color: #1a1a1a;
  border-bottom: 1px solid #444;
  position: relative;
  overflow: hidden;
}

.scale-container {
  width: 100%;
  height: 100%;
  position: relative;
  cursor: pointer;
}

.time-mark {
  position: absolute;
  top: 0;
  height: 100%;
  pointer-events: none;
}

.mark-line {
  width: 1px;
  background-color: #666;
  height: 20px;
  margin-top: 20px;
}

.mark-line.major {
  background-color: #999;
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

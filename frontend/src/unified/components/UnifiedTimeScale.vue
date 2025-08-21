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

      <!-- 播放头组件 -->
      <UnifiedPlayhead
        ref="playheadRef"
        :timeline-width="containerWidth"
        :track-control-width="0"
        :handle-container="scaleContainer"
        :wheel-container="scaleContainer"
        :enable-container-click="true"
        :enable-snapping="true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { calculateVisibleFrameRange } from '@/unified/utils/coordinateUtils'
import { framesToTimecode } from '@/unified/utils/timeUtils'
import type { TimeMark } from '@/types'
import UnifiedPlayhead from './UnifiedPlayhead.vue'

const unifiedStore = useUnifiedStore()
const scaleContainer = ref<HTMLElement>()
const playheadRef = ref<InstanceType<typeof UnifiedPlayhead>>()
const containerWidth = ref(800)

// 计算时间刻度标记（基于帧数）
const timeMarks = computed((): TimeMark[] => {
  const marks: TimeMark[] = []
  const durationFrames = unifiedStore.totalDurationFrames
  const pixelsPerFrame = (containerWidth.value * unifiedStore.zoomLevel) / durationFrames

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
  const maxVisibleDurationFrames = unifiedStore.maxVisibleDurationFrames
  const { startFrames, endFrames } = calculateVisibleFrameRange(
    containerWidth.value,
    durationFrames,
    unifiedStore.zoomLevel,
    unifiedStore.scrollOffset,
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
    const position = unifiedStore.frameToPixel(frames, containerWidth.value)

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

function formatTime(frames: number): string {
  return framesToTimecode(frames)
}

function updateContainerWidth() {
  if (scaleContainer.value) {
    containerWidth.value = scaleContainer.value.clientWidth
  }
}

function handleWheel(event: WheelEvent) {
  event.preventDefault()

  if (event.altKey) {
    // Alt + 滚轮：缩放
    const zoomFactor = 1.2 // 增加缩放因子，让缩放更快
    const rect = scaleContainer.value?.getBoundingClientRect()
    if (!rect) {
      // if (window.DEBUG_TIMELINE_ZOOM) {
      //   console.error('❌ 无法获取时间刻度容器边界')
      // }
      return
    }

    // 获取鼠标在时间轴上的位置（使用帧数版本）
    const mouseX = event.clientX - rect.left
    const mouseFrames = unifiedStore.pixelToFrame(mouseX, containerWidth.value)

    // 缩放操作（精简调试信息）

    if (event.deltaY < 0) {
      // 向上滚动：放大
      unifiedStore.zoomIn(zoomFactor, containerWidth.value)
    } else {
      // 向下滚动：缩小
      unifiedStore.zoomOut(zoomFactor, containerWidth.value)
    }

    // 调整滚动偏移量，使鼠标位置保持在相同的帧数点
    const newMousePixel = unifiedStore.frameToPixel(mouseFrames, containerWidth.value)
    const offsetAdjustment = newMousePixel - mouseX
    const newScrollOffset = unifiedStore.scrollOffset + offsetAdjustment

    unifiedStore.setScrollOffset(newScrollOffset, containerWidth.value)
  } else if (event.shiftKey) {
    // Shift + 滚轮：水平滚动
    const scrollAmount = 50

    if (event.deltaY < 0) {
      // 向上滚动：向左滚动
      unifiedStore.scrollLeft(scrollAmount, containerWidth.value)
    } else {
      // 向下滚动：向右滚动
      unifiedStore.scrollRight(scrollAmount, containerWidth.value)
    }
  }
}

onMounted(() => {
  updateContainerWidth()
  window.addEventListener('resize', updateContainerWidth)

  if (scaleContainer.value) {
    scaleContainer.value.addEventListener('wheel', handleWheel, { passive: false })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerWidth)

  if (scaleContainer.value) {
    scaleContainer.value.removeEventListener('wheel', handleWheel)
  }
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
</style>

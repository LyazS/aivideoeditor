<template>
  <div class="timeline">

    <div
      class="timeline-container"
      ref="timelineContainer"
      @dragover="handleDragOver"
      @drop="handleDrop"
      @click="handleTimelineClick"
      @wheel="handleWheel"
    >
      <!-- 拖拽提示 -->
      <div v-if="clips.length === 0" class="drop-zone">
        <div class="drop-hint">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
          <p>拖拽视频文件到此处</p>
          <p class="hint">支持 MP4, WebM, AVI 等格式</p>
        </div>
      </div>
      
      <!-- 视频片段 -->
      <VideoClip
        v-for="clip in clips"
        :key="clip.id"
        :clip="clip"
        :timeline-width="timelineWidth"
        :total-duration="videoStore.totalDuration"
        @update-position="handleClipPositionUpdate"
        @update-timing="handleClipTimingUpdate"
        @remove="handleClipRemove"
      />
      
      <!-- 时间轴背景网格 -->
      <div class="timeline-grid">
        <div
          v-for="line in gridLines"
          :key="line.time"
          class="grid-line"
          :class="{ 'frame-line': line.isFrame }"
          :style="{ left: videoStore.timeToPixel(line.time, timelineWidth) + 'px' }"
        >

        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVideoStore, type VideoClip as VideoClipType } from '../stores/counter'
import VideoClip from './VideoClip.vue'

const videoStore = useVideoStore()
const timelineContainer = ref<HTMLElement>()
const timelineWidth = ref(800)

const clips = computed(() => videoStore.clips)

// 网格线
const gridLines = computed(() => {
  const lines = []
  const pixelsPerSecond = (timelineWidth.value * videoStore.zoomLevel) / videoStore.totalDuration

  // 根据缩放级别决定网格间隔
  let interval = 5 // 默认每5秒一条网格线
  let frameInterval = 0 // 帧间隔
  let isFrameLevel = false

  if (pixelsPerSecond >= 100) { // 降低帧级别的阈值
    interval = 1 // 高缩放：每秒一条线
    frameInterval = 1 / videoStore.frameRate // 同时显示帧级别的线
    isFrameLevel = true
  } else if (pixelsPerSecond >= 50) {
    interval = 2 // 中等缩放：每2秒一条线
  } else if (pixelsPerSecond >= 50) {
    interval = 5 // 正常缩放：每5秒一条线
  } else {
    interval = 10 // 低缩放：每10秒一条线
  }

  // 计算可见时间范围
  const startTime = videoStore.scrollOffset / pixelsPerSecond
  const endTime = startTime + (timelineWidth.value / pixelsPerSecond)

  // 生成主网格线（秒级别）
  const startLine = Math.floor(startTime / interval) * interval
  const endLine = Math.ceil(endTime / interval) * interval

  for (let i = startLine; i <= Math.min(endLine, videoStore.totalDuration); i += interval) {
    if (i >= 0) {
      lines.push({ time: i, isFrame: false })
    }
  }

  // 在帧级别缩放时，添加帧网格线
  if (isFrameLevel && frameInterval > 0) {
    const frameStartTime = Math.floor(startTime / frameInterval) * frameInterval
    const frameEndTime = Math.ceil(endTime / frameInterval) * frameInterval

    for (let i = frameStartTime; i <= Math.min(frameEndTime, videoStore.totalDuration); i += frameInterval) {
      if (i >= 0 && Math.abs(i % interval) > 0.001) { // 避免与主网格线重复
        lines.push({ time: i, isFrame: true })
      }
    }
  }

  return lines.sort((a, b) => a.time - b.time)
})



function updateTimelineWidth() {
  if (timelineContainer.value) {
    timelineWidth.value = timelineContainer.value.clientWidth
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'copy'
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()
  
  const files = Array.from(event.dataTransfer?.files || [])
  const videoFiles = files.filter(file => file.type.startsWith('video/'))
  
  if (videoFiles.length === 0) {
    alert('请拖拽视频文件')
    return
  }
  
  // 计算拖拽位置对应的时间（考虑缩放和滚动偏移量）
  const rect = timelineContainer.value!.getBoundingClientRect()
  const dropX = event.clientX - rect.left
  const dropTime = videoStore.pixelToTime(dropX, timelineWidth.value)

  // 如果拖拽位置超出当前时间轴长度，动态扩展时间轴
  videoStore.expandTimelineIfNeeded(dropTime + 10) // 预留10秒缓冲
  
  for (const file of videoFiles) {
    await createVideoClip(file, dropTime)
  }
}

async function createVideoClip(file: File, startTime: number): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    
    video.onloadedmetadata = () => {
      const clip: VideoClipType = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        file,
        url,
        duration: video.duration, // 初始时间轴显示时长等于原始时长
        originalDuration: video.duration,
        startTime: 0,
        endTime: video.duration,
        timelinePosition: Math.max(0, startTime),
        name: file.name,
        playbackRate: 1.0 // 初始播放速度为正常速度
      }

      videoStore.addClip(clip)
      resolve()
    }
    
    video.src = url
  })
}

function handleClipPositionUpdate(clipId: string, newPosition: number) {
  videoStore.updateClipPosition(clipId, newPosition)
}

function handleClipTimingUpdate(clipId: string, newDuration: number, timelinePosition?: number) {
  videoStore.updateClipDuration(clipId, newDuration, timelinePosition)
}

function handleClipRemove(clipId: string) {
  videoStore.removeClip(clipId)
}

function handleTimelineClick(event: MouseEvent) {
  // 点击空白区域取消选中
  if (event.target === timelineContainer.value) {
    videoStore.selectClip(null)
  }
}

function handleWheel(event: WheelEvent) {
  event.preventDefault()

  if (event.altKey) {
    // Alt + 滚轮：缩放
    const zoomFactor = 1.1
    const rect = timelineContainer.value?.getBoundingClientRect()
    if (!rect) return

    // 获取鼠标在时间轴上的位置
    const mouseX = event.clientX - rect.left
    const mouseTime = videoStore.pixelToTime(mouseX, timelineWidth.value)

    if (event.deltaY < 0) {
      // 向上滚动：放大
      videoStore.zoomIn(zoomFactor, timelineWidth.value)
    } else {
      // 向下滚动：缩小
      videoStore.zoomOut(zoomFactor, timelineWidth.value)
    }

    // 调整滚动偏移量，使鼠标位置保持在相同的时间点
    const newMousePixel = videoStore.timeToPixel(mouseTime, timelineWidth.value)
    const offsetAdjustment = newMousePixel - mouseX
    videoStore.setScrollOffset(videoStore.scrollOffset + offsetAdjustment, timelineWidth.value)

  } else if (event.shiftKey) {
    // Shift + 滚轮：水平滚动
    const scrollAmount = 50
    if (event.deltaY < 0) {
      // 向上滚动：向左滚动
      videoStore.scrollLeft(scrollAmount, timelineWidth.value)
    } else {
      // 向下滚动：向右滚动
      videoStore.scrollRight(scrollAmount, timelineWidth.value)
    }
  }
}



function handleKeyDown(event: KeyboardEvent) {
  // 按 Escape 键取消选中
  if (event.key === 'Escape') {
    videoStore.selectClip(null)
  }
}



onMounted(() => {
  updateTimelineWidth()
  window.addEventListener('resize', updateTimelineWidth)
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateTimelineWidth)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.timeline {
  flex: 1;
  background-color: #2a2a2a;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}



.timeline-container {
  width: 100%;
  flex: 1;
  position: relative;
  min-height: 90px; /* 压缩轨道高度 */
}

.drop-zone {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #555;
  border-radius: 4px;
  margin: 10px;
}

.drop-hint {
  text-align: center;
  color: #888;
}

.drop-hint svg {
  margin-bottom: 12px;
  opacity: 0.6;
}

.drop-hint p {
  margin: 4px 0;
}

.hint {
  font-size: 14px;
  opacity: 0.7;
}

.timeline-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1; /* 确保网格线在视频片段下方 */
}

.grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background-color: #444;
  opacity: 0.5;
}

.grid-line.frame-line {
  background-color: #666;
  opacity: 0.3;
  width: 1px;
}


</style>

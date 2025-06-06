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
      >
        <div class="playhead-line"></div>
        <div class="playhead-handle"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVideoStore } from '../stores/counter'

const videoStore = useVideoStore()
const scaleContainer = ref<HTMLElement>()
const containerWidth = ref(800)

interface TimeMark {
  time: number
  position: number
  isMajor: boolean
}

// 计算时间刻度标记
const timeMarks = computed((): TimeMark[] => {
  const marks: TimeMark[] = []
  const duration = videoStore.totalDuration
  const pixelsPerSecond = containerWidth.value / duration
  
  // 根据缩放级别决定刻度间隔
  let majorInterval = 10 // 主刻度间隔（秒）
  let minorInterval = 1  // 次刻度间隔（秒）
  
  if (pixelsPerSecond < 5) {
    majorInterval = 60
    minorInterval = 10
  } else if (pixelsPerSecond < 20) {
    majorInterval = 30
    minorInterval = 5
  }
  
  // 生成刻度标记
  for (let time = 0; time <= duration; time += minorInterval) {
    const isMajor = time % majorInterval === 0
    marks.push({
      time,
      position: (time / duration) * containerWidth.value,
      isMajor
    })
  }
  
  return marks
})

// 播放头位置
const playheadPosition = computed(() => {
  const progress = videoStore.currentTime / videoStore.totalDuration
  return progress * containerWidth.value
})

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function updateContainerWidth() {
  if (scaleContainer.value) {
    containerWidth.value = scaleContainer.value.clientWidth
  }
}

function handleClick(event: MouseEvent) {
  if (!scaleContainer.value) return
  
  const rect = scaleContainer.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const progress = clickX / containerWidth.value
  const newTime = progress * videoStore.totalDuration
  
  videoStore.setCurrentTime(Math.max(0, Math.min(newTime, videoStore.totalDuration)))
}

onMounted(() => {
  updateContainerWidth()
  window.addEventListener('resize', updateContainerWidth)
  
  if (scaleContainer.value) {
    scaleContainer.value.addEventListener('click', handleClick)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerWidth)
  
  if (scaleContainer.value) {
    scaleContainer.value.removeEventListener('click', handleClick)
  }
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
  pointer-events: none;
  z-index: 10;
}

.playhead-line {
  width: 2px;
  height: 100%;
  background-color: #ff4444;
  margin-left: -1px;
}

.playhead-handle {
  width: 12px;
  height: 12px;
  background-color: #ff4444;
  border-radius: 50%;
  position: absolute;
  top: -6px;
  left: -6px;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}
</style>

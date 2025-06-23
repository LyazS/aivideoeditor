<template>
  <div class="timecode-seek-bar">
    <div class="seek-controls">
      <!-- 当前时间显示和输入 -->
      <div class="time-input-group">
        <label>当前时间:</label>
        <TimecodeInput 
          v-model="currentTimeMicroseconds"
          :frame-rate="frameRate"
          @change="handleTimeChange"
          placeholder="00:00.00"
        />
      </div>

      <!-- 快速跳转按钮 -->
      <div class="quick-seek-buttons">
        <button @click="seekToStart" title="跳转到开始">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6,18V6H8V18H6M9.5,12L18,6V18L9.5,12Z" />
          </svg>
        </button>
        
        <button @click="seekBackward" title="后退10秒">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.5,12L20,18V6M11,18V6L2.5,12L11,18Z" />
          </svg>
          <span class="seek-label">-10s</span>
        </button>
        
        <button @click="seekForward" title="前进10秒">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13,6V18L21.5,12M4,18L12.5,12L4,6V18Z" />
          </svg>
          <span class="seek-label">+10s</span>
        </button>
        
        <button @click="seekToEnd" title="跳转到结束">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16,18H18V6H16M6,18L14.5,12L6,6V18Z" />
          </svg>
        </button>
      </div>

      <!-- 总时长显示 -->
      <div class="duration-display">
        <label>总时长:</label>
        <TimecodeDisplay 
          :value="totalDurationMicroseconds"
          :frame-rate="frameRate"
          size="normal"
        />
      </div>
    </div>

    <!-- 进度条 -->
    <div class="progress-bar-container">
      <div class="progress-bar" ref="progressBarRef" @click="handleProgressClick">
        <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
        <div class="progress-handle" :style="{ left: progressPercentage + '%' }"></div>
      </div>
      
      <!-- 时间码标记 -->
      <div class="timecode-markers">
        <div 
          v-for="marker in timecodeMarkers" 
          :key="marker.time"
          class="timecode-marker"
          :style="{ left: marker.position + '%' }"
          :title="marker.timecode"
        >
          <div class="marker-line"></div>
          <div class="marker-label">{{ marker.timecode }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { useWebAVControls } from '../composables/useWebAVControls'
import { TimecodeUtils } from '../utils/TimecodeUtils'
import TimecodeInput from './TimecodeInput.vue'
import TimecodeDisplay from './TimecodeDisplay.vue'

const videoStore = useVideoStore()
const webAVControls = useWebAVControls()

const progressBarRef = ref<HTMLElement>()

// 帧率
const frameRate = computed(() => videoStore.frameRate)

// 当前时间（微秒）
const currentTimeMicroseconds = computed({
  get: () => Math.round(videoStore.currentTime * 1000000),
  set: (value: number) => {
    // 通过WebAV设置时间
    const seconds = value / 1000000
    webAVControls.seekTo(seconds)
  }
})

// 总时长（微秒）
const totalDurationMicroseconds = computed(() => {
  const duration = videoStore.contentEndTime || videoStore.totalDuration
  return Math.round(duration * 1000000)
})

// 进度百分比
const progressPercentage = computed(() => {
  const total = totalDurationMicroseconds.value
  if (total === 0) return 0
  return (currentTimeMicroseconds.value / total) * 100
})

// 时间码标记点
const timecodeMarkers = computed(() => {
  const total = totalDurationMicroseconds.value
  if (total === 0) return []
  
  const markers = []
  const duration = total / 1000000 // 转换为秒
  
  // 每30秒一个标记
  const interval = 30
  for (let i = 0; i <= duration; i += interval) {
    const timeMicroseconds = i * 1000000
    const position = (timeMicroseconds / total) * 100
    const timecode = TimecodeUtils.webAVToTimecode(timeMicroseconds, frameRate.value)
    
    markers.push({
      time: i,
      position,
      timecode
    })
  }
  
  return markers
})

// 处理时间变化
const handleTimeChange = (microseconds: number) => {
  console.log('时间码输入变化:', {
    microseconds,
    seconds: microseconds / 1000000,
    timecode: TimecodeUtils.webAVToTimecode(microseconds, frameRate.value)
  })
}

// 进度条点击
const handleProgressClick = (event: MouseEvent) => {
  if (!progressBarRef.value) return
  
  const rect = progressBarRef.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const percentage = (clickX / rect.width) * 100
  
  // 计算目标时间
  const targetMicroseconds = (percentage / 100) * totalDurationMicroseconds.value
  
  // 对齐到帧边界
  const alignedMicroseconds = TimecodeUtils.alignToFrame(targetMicroseconds, frameRate.value)
  
  // 跳转
  const seconds = alignedMicroseconds / 1000000
  webAVControls.seekTo(seconds)
}

// 快速跳转功能
const seekToStart = () => {
  webAVControls.seekTo(0)
}

const seekToEnd = () => {
  const endTime = (videoStore.contentEndTime || videoStore.totalDuration)
  webAVControls.seekTo(endTime)
}

const seekBackward = () => {
  const currentSeconds = videoStore.currentTime
  const newTime = Math.max(0, currentSeconds - 10)
  webAVControls.seekTo(newTime)
}

const seekForward = () => {
  const currentSeconds = videoStore.currentTime
  const maxTime = videoStore.contentEndTime || videoStore.totalDuration
  const newTime = Math.min(maxTime, currentSeconds + 10)
  webAVControls.seekTo(newTime)
}
</script>

<style scoped>
.timecode-seek-bar {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--color-border-primary);
}

.seek-controls {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.time-input-group,
.duration-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-input-group label,
.duration-display label {
  font-size: 14px;
  color: var(--color-text-secondary);
  min-width: 60px;
}

.quick-seek-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.quick-seek-buttons button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-primary);
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.quick-seek-buttons button:hover {
  background: var(--color-bg-quaternary);
  color: var(--color-text-primary);
}

.seek-label {
  font-size: 12px;
  font-weight: 500;
}

.progress-bar-container {
  position: relative;
  margin-top: 8px;
}

.progress-bar {
  height: 8px;
  background: var(--color-bg-tertiary);
  border-radius: 4px;
  position: relative;
  cursor: pointer;
  border: 1px solid var(--color-border-primary);
}

.progress-fill {
  height: 100%;
  background: var(--color-accent-primary);
  border-radius: 4px;
  transition: width 0.1s ease;
}

.progress-handle {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 16px;
  background: var(--color-accent-primary);
  border: 2px solid white;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.timecode-markers {
  position: relative;
  height: 20px;
  margin-top: 4px;
}

.timecode-marker {
  position: absolute;
  transform: translateX(-50%);
}

.marker-line {
  width: 1px;
  height: 8px;
  background: var(--color-text-tertiary);
  margin: 0 auto;
}

.marker-label {
  font-size: 10px;
  color: var(--color-text-tertiary);
  text-align: center;
  margin-top: 2px;
  white-space: nowrap;
  font-family: monospace;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .seek-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .time-input-group,
  .duration-display {
    justify-content: space-between;
  }
  
  .quick-seek-buttons {
    justify-content: center;
  }
}
</style>

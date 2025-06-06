<template>
  <div class="playback-controls">
    <!-- 播放控制按钮 -->
    <div class="control-buttons">
      <button class="control-btn" @click="skipToStart" title="跳转到开始">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6,18V6H8V18H6M9.5,12L18,6V18L9.5,12Z" />
        </svg>
      </button>
      
      <button class="control-btn" @click="skipBackward" title="后退10秒">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.5,12L20,18V6M11,18V6L2.5,12L11,18Z" />
        </svg>
      </button>
      
      <button class="control-btn primary" @click="togglePlayPause" :title="isPlaying ? '暂停' : '播放'">
        <svg v-if="!isPlaying" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8,5.14V19.14L19,12.14L8,5.14Z" />
        </svg>
        <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14,19H18V5H14M6,19H10V5H6V19Z" />
        </svg>
      </button>
      
      <button class="control-btn" @click="skipForward" title="前进10秒">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13,6V18L21.5,12M4,18L12.5,12L4,6V18Z" />
        </svg>
      </button>
      
      <button class="control-btn" @click="skipToEnd" title="跳转到结束">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16,18H18V6H16M6,18L14.5,12L6,6V18Z" />
        </svg>
      </button>
      
      <button class="control-btn" @click="stop" title="停止">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18,18H6V6H18V18Z" />
        </svg>
      </button>
    </div>
    
    <!-- 时间显示和进度条 -->
    <div class="time-section">
      <span class="time-display">{{ formatTime(currentTime) }}</span>
      
      <div class="progress-container">
        <input
          type="range"
          class="progress-slider"
          :min="0"
          :max="totalDuration"
          :value="currentTime"
          @input="handleProgressChange"
          @mousedown="startSeeking"
          @mouseup="stopSeeking"
        />
        <div class="progress-track">
          <div 
            class="progress-fill"
            :style="{ width: progressPercentage + '%' }"
          ></div>
        </div>
      </div>
      
      <span class="time-display">{{ formatTime(totalDuration) }}</span>
    </div>
    
    <!-- 音量控制 -->
    <div class="volume-section">
      <button class="control-btn" @click="toggleMute" :title="isMuted ? '取消静音' : '静音'">
        <svg v-if="!isMuted && volume > 0.5" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18.01,19.86 21,16.28 21,12C21,7.72 18.01,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z" />
        </svg>
        <svg v-else-if="!isMuted && volume > 0" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5,9V15H9L14,20V4L9,9M18.5,12C18.5,10.23 17.5,8.71 16,7.97V16C17.5,15.29 18.5,13.76 18.5,12Z" />
        </svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z" />
        </svg>
      </button>
      
      <div class="volume-container">
        <input
          type="range"
          class="volume-slider"
          :min="0"
          :max="1"
          :step="0.1"
          :value="volume"
          @input="handleVolumeChange"
        />
      </div>
    </div>
    
    <!-- 播放速度控制 -->
    <div class="speed-section">
      <select class="speed-select" :value="playbackRate" @change="handleSpeedChange">
        <option value="0.25">0.25x</option>
        <option value="0.5">0.5x</option>
        <option value="0.75">0.75x</option>
        <option value="1">1x</option>
        <option value="1.25">1.25x</option>
        <option value="1.5">1.5x</option>
        <option value="2">2x</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVideoStore } from '../stores/counter'

const videoStore = useVideoStore()

const volume = ref(1)
const isMuted = ref(false)
const isSeeking = ref(false)

const isPlaying = computed(() => videoStore.isPlaying)
const currentTime = computed(() => videoStore.currentTime)
const totalDuration = computed(() => videoStore.totalDuration)
const contentEndTime = computed(() => videoStore.contentEndTime)
const playbackRate = computed(() => videoStore.playbackRate)

const progressPercentage = computed(() => {
  if (totalDuration.value === 0) return 0
  return (currentTime.value / totalDuration.value) * 100
})

function togglePlayPause() {
  if (isPlaying.value) {
    videoStore.pause()
  } else {
    videoStore.play()
  }
}

function stop() {
  videoStore.stop()
}

function skipToStart() {
  videoStore.setCurrentTime(0)
}

function skipToEnd() {
  // 跳转到最后一个视频片段的结束，如果没有片段则跳转到时间轴结束
  const endTime = contentEndTime.value > 0 ? contentEndTime.value : totalDuration.value
  videoStore.setCurrentTime(endTime)
}

function skipBackward() {
  const newTime = Math.max(0, currentTime.value - 10)
  videoStore.setCurrentTime(newTime)
}

function skipForward() {
  // 快进时不超过内容结束时间
  const endTime = contentEndTime.value > 0 ? contentEndTime.value : totalDuration.value
  const newTime = Math.min(endTime, currentTime.value + 10)
  videoStore.setCurrentTime(newTime)
}

function handleProgressChange(event: Event) {
  if (isSeeking.value) {
    const target = event.target as HTMLInputElement
    const newTime = parseFloat(target.value)
    videoStore.setCurrentTime(newTime)
  }
}

function startSeeking() {
  isSeeking.value = true
}

function stopSeeking() {
  isSeeking.value = false
}

function toggleMute() {
  isMuted.value = !isMuted.value
  // TODO: 实际的静音功能需要在视频元素上实现
}

function handleVolumeChange(event: Event) {
  const target = event.target as HTMLInputElement
  volume.value = parseFloat(target.value)
  isMuted.value = volume.value === 0
  // TODO: 实际的音量控制需要在视频元素上实现
}

function handleSpeedChange(event: Event) {
  const target = event.target as HTMLSelectElement
  const newRate = parseFloat(target.value)
  videoStore.setPlaybackRate(newRate)
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.playback-controls {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 20px;
  background-color: #333;
  border-radius: 8px;
  height: 100%;
}

.control-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-btn {
  background: none;
  border: none;
  color: #ccc;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.control-btn:hover {
  background-color: #444;
  color: white;
}

.control-btn.primary {
  background-color: #ff4444;
  color: white;
  padding: 12px;
}

.control-btn.primary:hover {
  background-color: #ff6666;
}

.time-section {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.time-display {
  font-family: monospace;
  font-size: 14px;
  color: #ccc;
  min-width: 50px;
}

.progress-container {
  flex: 1;
  position: relative;
  height: 20px;
  display: flex;
  align-items: center;
}

.progress-slider {
  width: 100%;
  height: 4px;
  background: transparent;
  outline: none;
  position: absolute;
  z-index: 2;
  cursor: pointer;
}

.progress-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: #ff4444;
  border-radius: 50%;
  cursor: pointer;
}

.progress-track {
  width: 100%;
  height: 4px;
  background-color: #555;
  border-radius: 2px;
  position: relative;
}

.progress-fill {
  height: 100%;
  background-color: #ff4444;
  border-radius: 2px;
  transition: width 0.1s;
}

.volume-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-container {
  width: 80px;
}

.volume-slider {
  width: 100%;
  height: 4px;
  background: #555;
  outline: none;
  border-radius: 2px;
}

.volume-slider::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  background: #ccc;
  border-radius: 50%;
  cursor: pointer;
}

.speed-section {
  display: flex;
  align-items: center;
}

.speed-select {
  background-color: #444;
  color: white;
  border: 1px solid #555;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}

.speed-select:focus {
  outline: none;
  border-color: #ff4444;
}
</style>

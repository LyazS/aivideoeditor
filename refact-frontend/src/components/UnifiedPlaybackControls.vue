<template>
  <div class="playback-controls">
    <!-- 播放控制按钮 -->
    <div class="control-buttons">
      <HoverButton
        variant="primary"
        @click="togglePlayPause"
        :title="isPlaying ? '暂停' : '播放'"
        :disabled="true"
      >
        <template #icon>
          <svg v-if="!isPlaying" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8,5.14V19.14L19,12.14L8,5.14Z" />
          </svg>
          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,19H18V5H14M6,19H10V5H6V19Z" />
          </svg>
        </template>
      </HoverButton>

      <HoverButton @click="stop" title="停止" :disabled="true">
        <template #icon>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18,18H6V6H18V18Z" />
          </svg>
        </template>
      </HoverButton>
    </div>

    <!-- 播放速度控制 -->
    <div class="speed-section">
      <select class="speed-select" :value="playbackRate" @change="handleSpeedChange" disabled>
        <option value="0.25">0.25x</option>
        <option value="0.5">0.5x</option>
        <option value="0.75">0.75x</option>
        <option value="1">1x</option>
        <option value="1.25">1.25x</option>
        <option value="1.5">1.5x</option>
        <option value="2">2x</option>
        <option value="3">3x</option>
        <option value="4">4x</option>
        <option value="5">5x</option>
      </select>
    </div>

    <!-- 时间显示 -->
    <div class="time-display">
      <span class="current-time">00:00</span>
      <span class="separator">/</span>
      <span class="total-time">00:00</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import HoverButton from './HoverButton.vue'

// 空壳状态
const isPlaying = ref(false)
const playbackRate = ref(1)

// 空壳方法 - 不执行实际操作
const togglePlayPause = () => {
  console.log('Play/Pause clicked (empty shell)')
  // 在空壳状态下不改变播放状态
}

const stop = () => {
  console.log('Stop clicked (empty shell)')
  isPlaying.value = false
}

const handleSpeedChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  playbackRate.value = parseFloat(target.value)
  console.log('Speed changed to:', playbackRate.value, '(empty shell)')
}
</script>

<style scoped>
.playback-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border-primary);
  border-radius: 0 0 8px 8px;
}

.control-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-select {
  padding: 4px 8px;
  border: 1px solid var(--color-border-primary);
  border-radius: 4px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 12px;
  cursor: pointer;
}

.speed-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.time-display {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-soft);
  font-family: monospace;
  margin-left: auto;
}

.separator {
  opacity: 0.5;
}

.current-time {
  color: var(--color-text-primary);
}

.total-time {
  opacity: 0.7;
}
</style>

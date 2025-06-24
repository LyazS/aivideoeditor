<template>
  <div class="playback-controls">
    <!-- 播放控制按钮 -->
    <div class="control-buttons">
      <button
        class="control-btn primary"
        @click="togglePlayPause"
        :title="isPlaying ? '暂停' : '播放'"
      >
        <svg v-if="!isPlaying" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8,5.14V19.14L19,12.14L8,5.14Z" />
        </svg>
        <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14,19H18V5H14M6,19H10V5H6V19Z" />
        </svg>
      </button>

      <button class="control-btn" @click="stop" title="停止">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18,18H6V6H18V18Z" />
        </svg>
      </button>
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
        <option value="3">3x</option>
        <option value="4">4x</option>
        <option value="5">5x</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { useWebAVControls } from '../composables/useWebAVControls'
import { usePlaybackControls } from '../composables/usePlaybackControls'
import { Timecode } from '@/utils/Timecode'

const videoStore = useVideoStore()
const webAVControls = useWebAVControls()
const { safePlaybackOperation, restartPlayback } = usePlaybackControls()

const isPlaying = computed(() => videoStore.isPlaying)
const playbackRate = computed(() => videoStore.playbackRate)

// WebAV作为播放状态的主控
function togglePlayPause() {
  safePlaybackOperation(() => {
    if (isPlaying.value) {
      // 通过WebAV暂停，WebAV会触发事件更新store状态
      webAVControls.pause()
    } else {
      // 通过WebAV播放，WebAV会触发事件更新store状态
      webAVControls.play()
    }
  }, '播放/暂停切换')
}

function stop() {
  safePlaybackOperation(() => {
    // 暂停播放并跳转到开始位置
    webAVControls.pause()
    // 只通过WebAV设置时间，WebAV会触发timeupdate事件更新Store
    webAVControls.seekTo(Timecode.zero(videoStore.frameRate))
  }, '停止播放')
}

function handleSpeedChange(event: Event) {
  const target = event.target as HTMLSelectElement
  const newRate = parseFloat(target.value)

  // 更新store中的播放速度
  videoStore.setPlaybackRate(newRate)

  // 如果正在播放，重新开始播放以应用新的播放速度
  restartPlayback()
}
</script>

<style scoped>
.playback-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 0 var(--spacing-md);
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-large);
  height: 100%;
  min-height: 50px;
  min-width: 200px;
  overflow: hidden;
  justify-content: center;
}

.control-buttons {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.control-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--spacing-xs);
  border-radius: var(--border-radius-medium);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.control-btn:hover {
  background-color: var(--color-bg-quaternary);
  color: var(--color-text-primary);
}

.control-btn.primary {
  background: none;
  color: var(--color-text-secondary);
  padding: var(--spacing-md);
}

.control-btn.primary:hover {
  background-color: var(--color-bg-quaternary);
  color: var(--color-text-primary);
}

.speed-section {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.speed-select {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: var(--font-size-md);
  cursor: pointer;
  min-width: 65px;
}

.speed-select:focus {
  outline: none;
  border-color: var(--color-accent-warning);
}
</style>

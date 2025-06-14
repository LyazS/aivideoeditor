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
import { useVideoStore } from '../stores/videostore'
import { useWebAVControls, isWebAVReady } from '../composables/useWebAVControls'

const videoStore = useVideoStore()
const webAVControls = useWebAVControls()

const isPlaying = computed(() => videoStore.isPlaying)
const playbackRate = computed(() => videoStore.playbackRate)

// WebAV作为播放状态的主控
function togglePlayPause() {
  if (!isWebAVReady()) {
    console.warn('WebAV canvas not ready')
    return
  }

  if (isPlaying.value) {
    // 通过WebAV暂停，WebAV会触发事件更新store状态
    webAVControls.pause()
  } else {
    // 通过WebAV播放，WebAV会触发事件更新store状态
    webAVControls.play()
  }
}

function stop() {
  if (!isWebAVReady()) {
    console.warn('WebAV canvas not ready')
    return
  }

  // 暂停播放并跳转到开始位置
  webAVControls.pause()
  webAVControls.seekTo(0)

  // 更新store状态
  videoStore.setCurrentTime(0)
}

function handleSpeedChange(event: Event) {
  const target = event.target as HTMLSelectElement
  const newRate = parseFloat(target.value)

  // 更新store中的播放速度
  videoStore.setPlaybackRate(newRate)

  // 如果正在播放，重新开始播放以应用新的播放速度
  if (isPlaying.value && isWebAVReady()) {
    webAVControls.pause()
    setTimeout(() => {
      webAVControls.play()
    }, 50)
  }
}
</script>

<style scoped>
.playback-controls {
  display: flex;
  align-items: center;
  gap: 8px; /* 进一步减小间距以适应压缩 */
  padding: 0 8px; /* 减小内边距以适应压缩 */
  background-color: #2a2a2a;
  border-radius: 6px;
  height: 100%;
  min-height: 50px; /* 确保最小高度 */
  min-width: 200px; /* 设置最小宽度 */
  overflow: hidden; /* 防止内容溢出 */
  justify-content: center; /* 居中对齐 */
}

.control-buttons {
  display: flex;
  align-items: center;
  gap: 4px; /* 进一步减小按钮间距 */
  flex-shrink: 0; /* 防止按钮被压缩 */
}

.control-btn {
  background: none;
  border: none;
  color: #ccc;
  cursor: pointer;
  padding: 4px; /* 进一步减小按钮内边距 */
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0; /* 防止按钮被压缩 */
}

.control-btn:hover {
  background-color: #444;
  color: white;
}

.control-btn.primary {
  background: none;
  color: #ccc;
  padding: 8px; /* 进一步减小主按钮内边距 */
}

.control-btn.primary:hover {
  background-color: #444;
  color: white;
}

.speed-section {
  display: flex;
  align-items: center;
  flex-shrink: 0; /* 防止速度选择器被压缩 */
}

.speed-select {
  background-color: #2a2a2a;
  color: white;
  border: 1px solid #555;
  border-radius: 4px;
  padding: 4px 8px; /* 增加内边距 */
  font-size: 13px; /* 增加字体大小 */
  cursor: pointer;
  min-width: 65px; /* 增加最小宽度 */
}

.speed-select:focus {
  outline: none;
  border-color: #ff4444;
}
</style>

<template>
  <div class="preview-window">
    <div class="video-container">
      <video
        ref="videoElement"
        class="video-player"
        :src="currentVideoSrc"
        @loadedmetadata="onVideoLoaded"
        @timeupdate="onTimeUpdate"
        @ended="onVideoEnded"
        preload="metadata"
      />
      <!-- 空白区域显示（播放时显示黑屏，非播放时显示提示） -->
      <div v-if="!currentVideoSrc" class="placeholder" :class="{ 'playing-blank': isPlayingBlankArea }">
        <div v-if="!isPlayingBlankArea" class="placeholder-content">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <p>预览窗口</p>
          <p class="hint">将视频文件导入到素材库开始编辑</p>
        </div>
        <div v-else class="blank-area-indicator">
          <div class="time-indicator">{{ formatTime(videoStore.currentTime) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useVideoStore } from '../stores/counter'

const videoStore = useVideoStore()
const videoElement = ref<HTMLVideoElement>()

const currentVideoSrc = computed(() => {
  return videoStore.currentClip?.url || undefined
})



// 判断是否在播放空白区域
const isPlayingBlankArea = computed(() => {
  return videoStore.isPlaying && !videoStore.currentClip
})

// 监听播放状态变化
watch(() => videoStore.isPlaying, async (isPlaying) => {
  if (!videoElement.value || !videoStore.currentClip) return

  if (isPlaying) {
    try {
      await videoElement.value.play()
    } catch (error) {
      // 忽略播放被中断的错误，这通常发生在视频源切换时
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('Video play error:', error)
      }
    }
  } else {
    videoElement.value.pause()
  }
})

// 监听当前时间变化，同步视频播放位置
watch(() => videoStore.currentTime, (newTime) => {
  if (!videoElement.value || !videoStore.currentClip) return

  const clipTime = newTime - videoStore.currentClip.timelinePosition
  // 确保视频时间在片段范围内
  if (clipTime >= 0 && clipTime <= videoStore.currentClip.duration) {
    // 计算在原始视频中的实际时间位置
    const actualVideoTime = videoStore.currentClip.startTime + (clipTime * (videoStore.currentClip.playbackRate || 1.0))
    if (Math.abs(videoElement.value.currentTime - actualVideoTime) > 0.2) {
      videoElement.value.currentTime = Math.max(videoStore.currentClip.startTime, Math.min(actualVideoTime, videoStore.currentClip.endTime))
    }
  }
})

// 监听音量变化，同步视频元素音量
watch(() => videoStore.volume, (newVolume) => {
  if (videoElement.value) {
    videoElement.value.volume = newVolume
  }
})

// 监听静音状态变化，同步视频元素静音
watch(() => videoStore.isMuted, (muted) => {
  if (videoElement.value) {
    videoElement.value.muted = muted
  }
})

// 监听当前片段变化，切换视频源
watch(() => videoStore.currentClip, async (newClip, oldClip) => {
  if (!videoElement.value) return

  if (newClip && newClip !== oldClip) {
    // 切换到新的视频片段，等待视频加载完成
    const clipTime = videoStore.currentTime - newClip.timelinePosition

    // 等待下一个tick，确保视频源已经更新
    await nextTick()

    if (videoElement.value && videoElement.value.readyState >= 1) {
      // 设置播放速度
      videoElement.value.playbackRate = newClip.playbackRate || 1.0

      // 计算在原始视频中的实际时间位置
      const actualVideoTime = newClip.startTime + (clipTime * (newClip.playbackRate || 1.0))
      videoElement.value.currentTime = Math.max(newClip.startTime, Math.min(actualVideoTime, newClip.endTime))

      // 如果正在播放，确保新视频也开始播放
      if (videoStore.isPlaying) {
        try {
          await videoElement.value.play()
        } catch (error) {
          if (error instanceof Error && error.name !== 'AbortError') {
            console.warn('Video play error on clip change:', error)
          }
        }
      }
    }
  } else if (!newClip && videoStore.isPlaying) {
    // 进入空白区域，暂停视频但保持播放状态
    videoElement.value.pause()
  }
})

async function onVideoLoaded() {
  if (!videoElement.value || !videoStore.currentClip) return

  // 设置播放速度
  videoElement.value.playbackRate = videoStore.currentClip.playbackRate || 1.0

  // 设置音量和静音状态
  videoElement.value.volume = videoStore.volume
  videoElement.value.muted = videoStore.isMuted

  const clipTime = videoStore.currentTime - videoStore.currentClip.timelinePosition
  // 计算在原始视频中的实际时间位置
  const actualVideoTime = videoStore.currentClip.startTime + (clipTime * (videoStore.currentClip.playbackRate || 1.0))
  videoElement.value.currentTime = Math.max(videoStore.currentClip.startTime, Math.min(actualVideoTime, videoStore.currentClip.endTime))

  // 如果应该播放，启动播放
  if (videoStore.isPlaying) {
    try {
      await videoElement.value.play()
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('Video play error on load:', error)
      }
    }
  }
}

function onTimeUpdate() {
  // 不再由视频元素驱动全局时间，而是由全局时间控制器驱动
  // 这里只做同步检查，确保视频播放位置正确
  if (!videoElement.value || !videoStore.currentClip) return

  const expectedClipTime = videoStore.currentTime - videoStore.currentClip.timelinePosition
  const expectedActualVideoTime = videoStore.currentClip.startTime + (expectedClipTime * (videoStore.currentClip.playbackRate || 1.0))
  const actualVideoTime = videoElement.value.currentTime

  // 如果时间差异太大，进行同步
  if (Math.abs(expectedActualVideoTime - actualVideoTime) > 0.5) {
    videoElement.value.currentTime = Math.max(videoStore.currentClip.startTime, Math.min(expectedActualVideoTime, videoStore.currentClip.endTime))
  }
}

function onVideoEnded() {
  // 视频片段播放结束，但不停止全局播放
  // 全局时间控制器会继续推进时间，可能进入空白区域或下一个片段
  console.log('Video clip ended, continuing timeline playback')
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

onMounted(() => {
  // 初始化视频元素
  if (videoElement.value) {
    videoElement.value.volume = videoStore.volume
    videoElement.value.muted = videoStore.isMuted
  }
})
</script>

<style scoped>
.preview-window {
  width: 100%;
  flex: 1;
  background-color: #444; /* 改为灰色背景 */
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  border: 2px solid #333;
  box-sizing: border-box;
  /* 允许极大压缩，适应任何大小 */
  min-width: 150px;
  min-height: 100px;
}

.video-container {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: #333; /* 与控制条一致的背景色 */
  /* 允许极小尺寸 */
  min-height: 80px;
}

.video-player {
  /* 视频保持原始比例，在容器内居中显示 */
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain; /* 保持比例，可能会有黑边 */
  display: block;
  box-sizing: border-box;
}

.placeholder {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent; /* 透明背景，使用父容器的灰色背景 */
  transition: background-color 0.3s ease;
}

.placeholder.playing-blank {
  background-color: transparent; /* 播放空白区域时也使用透明背景 */
}

.placeholder-content {
  text-align: center;
  color: #666;
}

.placeholder-content svg {
  margin-bottom: 16px;
  opacity: 0.5;
}

.placeholder-content p {
  margin: 8px 0;
}

.hint {
  font-size: 14px;
  opacity: 0.7;
}

.blank-area-indicator {
  text-align: center;
  color: #666;
}

.time-indicator {
  font-size: 18px;
  font-family: monospace;
  color: #888;
  background-color: rgba(0, 0, 0, 0.8);
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid #333;
}


</style>

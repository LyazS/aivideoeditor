<template>
  <div class="multi-track-video-renderer">
    <canvas
      ref="canvasRef"
      :width="canvasWidth"
      :height="canvasHeight"
      class="video-canvas"
    />
    
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>正在加载视频...</p>
    </div>
    
    <!-- 性能信息 -->
    <div v-if="showPerformanceInfo" class="performance-info">
      <span>FPS: {{ fps }}</span>
      <span>活跃片段: {{ activeClipsCount }}</span>
      <button @click="debugStatus" style="margin-left: 10px; padding: 2px 6px; font-size: 10px;">调试</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useVideoStore } from '@/stores/counter'
import { SingleVideoRenderer } from '@/utils/multiTrackRenderer'
import { createVideoElement, createVideoElementFromURL, loadVideoAtTime } from '@/utils/videoHelper'

const videoStore = useVideoStore()

// 组件引用
const canvasRef = ref<HTMLCanvasElement>()

// 状态
const isLoading = ref(false)
const fps = ref(0)
const showPerformanceInfo = ref(true)

// 渲染器和视频元素
let renderer: SingleVideoRenderer | null = null
let videoElement: HTMLVideoElement | null = null

// 性能监控
let animationId: number | null = null
let frameCount = 0
let lastFrameTime = 0
let fpsUpdateTime = 0



// 计算属性
const canvasWidth = computed(() => videoStore.videoResolution.width)
const canvasHeight = computed(() => videoStore.videoResolution.height)

// 获取第一个轨道的第一个视频片段
const firstClip = computed(() => {
  const track1Clips = videoStore.clips.filter(clip => clip.trackId === 1)
  if (track1Clips.length === 0) return null

  // 按时间轴位置排序，取第一个
  const sortedClips = track1Clips.sort((a, b) => a.timelinePosition - b.timelinePosition)
  return sortedClips[0]
})

// 检查第一个片段是否在当前时间活跃
const isFirstClipActive = computed(() => {
  if (!firstClip.value) return false
  const currentTime = videoStore.currentTime
  return currentTime >= firstClip.value.timelinePosition &&
         currentTime < firstClip.value.timelinePosition + firstClip.value.duration
})

const activeClipsCount = computed(() => isFirstClipActive.value ? 1 : 0)

// 监听第一个片段变化，加载视频
watch(() => firstClip.value, async (newClip, oldClip) => {
  console.log('First clip changed:', {
    newClip: newClip ? { id: newClip.id, name: newClip.name, trackId: newClip.trackId, timelinePosition: newClip.timelinePosition } : null,
    oldClip: oldClip ? { id: oldClip.id, name: oldClip.name } : null
  })

  // 如果有新的第一个片段且与之前不同，加载它
  if (newClip && (!oldClip || newClip.id !== oldClip.id)) {
    console.log('Loading new first clip:', newClip.id)
    await loadVideoForClip(newClip.id, newClip.file)

    // 如果当前时间不在片段范围内，跳转到片段开始时间
    if (videoStore.currentTime < newClip.timelinePosition ||
        videoStore.currentTime >= newClip.timelinePosition + newClip.duration) {
      console.log('Jumping to clip start time:', newClip.timelinePosition)
      videoStore.setCurrentTime(newClip.timelinePosition)
    }
  }

  // 如果没有第一个片段了，清理视频
  if (!newClip && videoElement) {
    console.log('No first clip, cleaning up')
    cleanup()
  }
}, { deep: true, immediate: true })

// 监听当前时间变化 - 只在暂停时或用户拖拽时手动同步视频时间
watch(() => videoStore.currentTime, () => {
  if (!videoStore.isPlaying && videoElement && firstClip.value) {
    // 暂停时手动同步视频时间
    updateVideoTime()
    renderFrame()
  }
})

// 监听播放状态变化
watch(() => videoStore.isPlaying, (isPlaying) => {
  if (videoElement) {
    if (isPlaying) {
      videoElement.play()
    } else {
      videoElement.pause()
    }
  }
})

// 加载视频片段
const loadVideoForClip = async (clipId: string, file: File) => {
  // 如果已经加载了相同的片段，跳过
  if (videoElement && firstClip.value?.id === clipId && videoElement.src) return

  try {
    isLoading.value = true
    console.log('Loading video for first clip:', clipId, file.name)

    // 清理之前的视频
    if (videoElement) {
      videoElement.pause()
      URL.revokeObjectURL(videoElement.src)
    }

    // 检查是否是从时间轴创建的片段（有现成的URL）
    const clip = videoStore.clips.find(c => c.id === clipId)
    let video: HTMLVideoElement

    if (clip && clip.url && file.size === 0) {
      // 使用现有的URL创建视频元素（用于从媒体库拖拽的片段）
      console.log('Using existing URL for clip:', clipId, clip.url)
      video = await createVideoElementFromURL(clip.url)
    } else {
      // 使用文件创建视频元素（用于直接上传的文件）
      video = await createVideoElement(file)
    }

    // 等待视频完全加载
    await new Promise<void>((resolve) => {
      const checkReady = () => {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          console.log('Video loaded successfully:', {
            clipId,
            readyState: video.readyState,
            dimensions: { width: video.videoWidth, height: video.videoHeight },
            duration: video.duration
          })
          resolve()
        } else {
          setTimeout(checkReady, 100)
        }
      }
      checkReady()
    })

    videoElement = video
    renderer?.setVideo(video)

    // 添加视频事件监听器 - 参考项目策略
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleVideoEnded)
    video.addEventListener('error', (e) => console.error('Video error:', e))

    // 设置视频元素引用到store
    videoStore.setVideoElement(clipId, video)

  } catch (error) {
    console.error(`Failed to load video for clip ${clipId}:`, error)
  } finally {
    isLoading.value = false
  }
}

// 更新视频时间 - 参考项目策略
const updateVideoTime = async () => {
  if (!videoElement || !firstClip.value) return

  try {
    const currentTime = videoStore.currentTime
    const clipRelativeTime = currentTime - firstClip.value.timelinePosition
    const targetVideoTime = firstClip.value.startTime + clipRelativeTime * (firstClip.value.playbackRate || 1)

    // 使用 loadVideoAtTime 进行精确的时间设置
    await loadVideoAtTime(videoElement, targetVideoTime)
  } catch (error) {
    console.error('Error updating video time:', error)
  }
}

// 处理视频时间更新 - 参考项目策略
const handleTimeUpdate = () => {
  if (videoElement && videoStore.isPlaying && firstClip.value) {
    // 将视频时间转换为时间轴时间
    const videoTime = videoElement.currentTime
    const clipRelativeTime = (videoTime - firstClip.value.startTime) / (firstClip.value.playbackRate || 1)
    const timelineTime = firstClip.value.timelinePosition + clipRelativeTime

    // 更新时间轴时间
    videoStore.setCurrentTime(timelineTime)
  }
}

// 处理视频结束
const handleVideoEnded = () => {
  videoStore.pause()
}

// 渲染帧 - 参考项目策略：只渲染，不强制同步时间
const renderFrame = () => {
  if (!renderer) return

  // 只渲染第一个活跃的片段
  const clipToRender = isFirstClipActive.value ? firstClip.value : null

  renderer.drawVideoFrame(clipToRender)

  // 计算FPS
  frameCount++
  const currentTime = performance.now()
  if (currentTime - fpsUpdateTime >= 1000) {
    fps.value = frameCount
    frameCount = 0
    fpsUpdateTime = currentTime
  }
}

// 开始渲染循环 - 智能渲染策略
const startRenderLoop = () => {
  let lastRenderTime = 0

  const render = (currentTime: number) => {
    // 根据播放状态调整渲染频率
    const isPlaying = videoStore.isPlaying
    const renderInterval = isPlaying ? 33 : 100 // 播放时30fps，暂停时10fps

    // 控制渲染频率
    if (currentTime - lastRenderTime >= renderInterval) {
      renderFrame()
      lastRenderTime = currentTime
    }

    animationId = requestAnimationFrame(render)
  }

  animationId = requestAnimationFrame(render)
}

// 停止渲染循环
const stopRenderLoop = () => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}



// 初始化
const initRenderer = () => {
  if (!canvasRef.value) return

  renderer = new SingleVideoRenderer(canvasRef.value)
  startRenderLoop()
}

// 清理资源
const cleanup = () => {
  stopRenderLoop()

  if (videoElement) {
    videoElement.pause()
    URL.revokeObjectURL(videoElement.src)
    videoElement = null
  }

  renderer?.destroy()
  renderer = null
}

// 生命周期
onMounted(() => {
  nextTick(() => {
    console.log('MultiTrackVideoRenderer mounted, clips count:', videoStore.clips.length)
    initRenderer()
    // 立即加载现有的视频片段
    loadExistingClips()
  })
})

// 加载现有的第一个视频片段
const loadExistingClips = async () => {
  console.log('Loading existing clips:', videoStore.clips.length)
  if (firstClip.value && !videoElement) {
    console.log('Loading first clip:', firstClip.value.id, firstClip.value.name)
    await loadVideoForClip(firstClip.value.id, firstClip.value.file)
  }
}

onUnmounted(() => {
  cleanup()
})

// 监听画布尺寸变化
watch([canvasWidth, canvasHeight], () => {
  nextTick(() => {
    renderer?.resize(canvasWidth.value, canvasHeight.value)
    renderFrame()
  })
})

// 调试方法
const debugStatus = () => {
  console.group('🎬 视频渲染器调试信息')
  console.log('总片段数:', videoStore.clips.length)
  console.log('所有片段:', videoStore.clips.map(c => ({
    id: c.id,
    name: c.name,
    trackId: c.trackId,
    timelinePosition: c.timelinePosition,
    duration: c.duration
  })))
  console.log('第一个片段:', firstClip.value ? {
    id: firstClip.value.id,
    name: firstClip.value.name,
    timelinePosition: firstClip.value.timelinePosition,
    duration: firstClip.value.duration
  } : null)
  console.log('当前时间:', videoStore.currentTime)
  console.log('第一个片段是否活跃:', isFirstClipActive.value)
  console.log('视频元素状态:', videoElement ? {
    readyState: videoElement.readyState,
    currentTime: videoElement.currentTime,
    duration: videoElement.duration,
    videoWidth: videoElement.videoWidth,
    videoHeight: videoElement.videoHeight
  } : '无视频元素')
  console.log('渲染器状态:', !!renderer)
  console.groupEnd()
}
</script>

<style scoped>
.multi-track-video-renderer {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #2a2a2a;
}

.video-canvas {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  background-color: #000;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.performance-info {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: monospace;
  display: flex;
  gap: 1rem;
}
</style>

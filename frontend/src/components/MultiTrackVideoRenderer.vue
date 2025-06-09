<template>
  <div class="multi-track-video-renderer">
    <canvas 
      ref="canvasRef" 
      :width="canvasWidth" 
      :height="canvasHeight" 
      class="video-canvas"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseLeave"
      @wheel="onWheel"
      @click="onClick"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useVideoStore } from '@/stores/counter'
import { MultiTrackVideoRenderer } from '@/utils/multiTrackRenderer'
import { createVideoElement, createVideoElementFromURL, loadVideoAtTime } from '@/utils/ffmpegHelper'

const videoStore = useVideoStore()

// 组件引用
const canvasRef = ref<HTMLCanvasElement>()

// 状态
const isLoading = ref(false)
const fps = ref(0)
const showPerformanceInfo = ref(true)

// 渲染器和视频元素
let renderer: MultiTrackVideoRenderer | null = null
const videoElements = new Map<string, HTMLVideoElement>()
const loadedVideos = new Set<string>()

// 性能监控
let animationId: number | null = null
let frameCount = 0
let lastFrameTime = 0
let fpsUpdateTime = 0

// 鼠标交互
const isDragging = ref(false)
const lastMousePos = ref({ x: 0, y: 0 })

// 计算属性
const canvasWidth = computed(() => videoStore.videoResolution.width)
const canvasHeight = computed(() => videoStore.videoResolution.height)

const activeClips = computed(() => {
  const currentTime = videoStore.currentTime
  return videoStore.clips.filter(clip => 
    currentTime >= clip.timelinePosition && 
    currentTime < clip.timelinePosition + clip.duration
  )
})

const activeClipsCount = computed(() => activeClips.value.length)

// 监听片段变化，加载视频
watch(() => videoStore.clips, async (newClips, oldClips) => {
  console.log('Clips changed:', {
    newCount: newClips.length,
    oldCount: oldClips?.length || 0,
    clips: newClips.map(c => ({ id: c.id, name: c.name }))
  })

  // 找出需要加载的片段（还没有视频元素的片段）
  const clipsToLoad = newClips.filter(clip => !videoElements.has(clip.id))

  console.log('Clips to load:', clipsToLoad.length)
  console.log('Clips to load IDs:', clipsToLoad.map(c => c.id))

  // 加载新片段的视频
  for (const clip of clipsToLoad) {
    console.log('Loading clip:', clip.id, clip.name)
    await loadVideoForClip(clip.id, clip.file)
  }

  // 清理已删除的片段
  const currentClipIds = new Set(newClips.map(c => c.id))
  for (const [clipId, video] of videoElements) {
    if (!currentClipIds.has(clipId)) {
      console.log('Cleaning up clip:', clipId)
      video.pause()
      URL.revokeObjectURL(video.src)
      videoElements.delete(clipId)
      loadedVideos.delete(clipId)
      renderer?.setVideoElement(clipId, null)
    }
  }
}, { deep: true, immediate: false })

// 监听当前时间变化
watch(() => videoStore.currentTime, () => {
  renderFrame()
})

// 监听播放状态变化
watch(() => videoStore.isPlaying, (isPlaying) => {
  for (const video of videoElements.values()) {
    if (isPlaying) {
      video.play().catch(() => {}) // 忽略播放错误
    } else {
      video.pause()
    }
  }
})

// 加载视频片段
const loadVideoForClip = async (clipId: string, file: File) => {
  if (videoElements.has(clipId)) return

  try {
    isLoading.value = true
    console.log('Loading video for clip:', clipId, file.name)

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

    videoElements.set(clipId, video)
    loadedVideos.add(clipId)
    renderer?.setVideoElement(clipId, video)

    // 设置视频元素引用到store
    videoStore.setVideoElement(clipId, video)

  } catch (error) {
    console.error(`Failed to load video for clip ${clipId}:`, error)
  } finally {
    isLoading.value = false
  }
}

// 渲染帧
const renderFrame = () => {
  if (!renderer) return
  
  renderer.drawMultiTrackFrame(videoStore.clips, videoStore.currentTime)
  
  // 计算FPS
  frameCount++
  const currentTime = performance.now()
  if (currentTime - fpsUpdateTime >= 1000) {
    fps.value = frameCount
    frameCount = 0
    fpsUpdateTime = currentTime
  }
}

// 开始渲染循环
const startRenderLoop = () => {
  const render = (currentTime: number) => {
    renderFrame()
    animationId = requestAnimationFrame(render)
  }
  render(performance.now())
}

// 停止渲染循环
const stopRenderLoop = () => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}

// 鼠标事件处理
const onMouseDown = (event: MouseEvent) => {
  isDragging.value = true
  lastMousePos.value = { x: event.clientX, y: event.clientY }
}

const onMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) return
  
  const deltaX = event.clientX - lastMousePos.value.x
  const deltaY = event.clientY - lastMousePos.value.y
  
  // 这里可以实现拖拽功能，比如移动选中的片段
  lastMousePos.value = { x: event.clientX, y: event.clientY }
}

const onMouseUp = () => {
  isDragging.value = false
}

const onMouseLeave = () => {
  isDragging.value = false
}

const onWheel = (event: WheelEvent) => {
  event.preventDefault()
  // 这里可以实现缩放功能
}

const onClick = (event: MouseEvent) => {
  // 这里可以实现点击选择片段功能
}

// 初始化
const initRenderer = () => {
  if (!canvasRef.value) return
  
  renderer = new MultiTrackVideoRenderer(canvasRef.value)
  startRenderLoop()
}

// 清理资源
const cleanup = () => {
  stopRenderLoop()
  
  for (const [clipId, video] of videoElements) {
    video.pause()
    URL.revokeObjectURL(video.src)
  }
  videoElements.clear()
  loadedVideos.clear()
  
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

// 加载现有的视频片段
const loadExistingClips = async () => {
  console.log('Loading existing clips:', videoStore.clips.length)
  for (const clip of videoStore.clips) {
    if (!videoElements.has(clip.id)) {
      console.log('Loading existing clip:', clip.id, clip.name)
      await loadVideoForClip(clip.id, clip.file)
    }
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
  cursor: grab;
}

.video-canvas:active {
  cursor: grabbing;
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

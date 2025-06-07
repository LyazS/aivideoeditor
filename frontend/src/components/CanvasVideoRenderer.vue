<template>
  <div class="canvas-video-renderer">
    <canvas 
      ref="canvasRef"
      :width="canvasWidth"
      :height="canvasHeight"
      class="video-canvas"
    />
    <!-- 隐藏的视频元素用于渲染 -->
    <div class="hidden-videos">
      <video
        v-for="clip in activeClips"
        :key="clip.id"
        :ref="el => setVideoRef(clip.id, el)"
        :src="clip.url"
        muted
        preload="metadata"
        @loadedmetadata="onVideoLoaded(clip.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useVideoStore, type VideoClip } from '../stores/counter'

const videoStore = useVideoStore()

// Canvas引用
const canvasRef = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null

// 视频元素引用映射
const videoElements = new Map<string, HTMLVideoElement>()
const loadedVideos = new Set<string>()

// Canvas尺寸
const canvasWidth = computed(() => videoStore.videoResolution.width)
const canvasHeight = computed(() => videoStore.videoResolution.height)

// 当前时间的活跃片段
const activeClips = computed(() => {
  const currentTime = videoStore.currentTime
  return videoStore.clips
    .filter(clip => {
      const clipStart = clip.timelinePosition
      const clipEnd = clip.timelinePosition + clip.duration
      return currentTime >= clipStart && currentTime < clipEnd
    })
    .sort((a, b) => a.zIndex - b.zIndex) // 按层级排序
})

// 设置视频元素引用
const setVideoRef = (clipId: string, el: HTMLVideoElement | null) => {
  if (el) {
    videoElements.set(clipId, el)
  } else {
    videoElements.delete(clipId)
  }
}

// 视频加载完成
const onVideoLoaded = (clipId: string) => {
  loadedVideos.add(clipId)
  console.log(`视频 ${clipId} 加载完成`)
}

// 渲染帧
const renderFrame = () => {
  if (!ctx || !canvasRef.value) return

  // 清空画布
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)

  // 渲染每个活跃的视频片段
  for (const clip of activeClips.value) {
    const videoElement = videoElements.get(clip.id)
    if (!videoElement || !loadedVideos.has(clip.id)) continue

    // 计算视频在片段中的当前时间
    const clipRelativeTime = videoStore.currentTime - clip.timelinePosition
    const videoTime = clip.startTime + (clipRelativeTime * (clip.playbackRate || 1))
    
    // 设置视频时间
    if (Math.abs(videoElement.currentTime - videoTime) > 0.1) {
      videoElement.currentTime = videoTime
    }

    // 应用变换并渲染
    renderVideoWithTransform(videoElement, clip)
  }
}

// 应用变换并渲染视频
const renderVideoWithTransform = (video: HTMLVideoElement, clip: VideoClip) => {
  if (!ctx) return

  const { transform } = clip
  const centerX = canvasWidth.value / 2
  const centerY = canvasHeight.value / 2

  // 保存当前状态
  ctx.save()

  // 设置透明度
  ctx.globalAlpha = transform.opacity

  // 移动到画布中心
  ctx.translate(centerX, centerY)

  // 应用位置偏移
  ctx.translate(transform.x, transform.y)

  // 应用旋转
  ctx.rotate((transform.rotation * Math.PI) / 180)

  // 计算视频尺寸
  const videoWidth = video.videoWidth * transform.scaleX
  const videoHeight = video.videoHeight * transform.scaleY

  // 绘制视频（以中心为原点）
  ctx.drawImage(
    video,
    -videoWidth / 2,
    -videoHeight / 2,
    videoWidth,
    videoHeight
  )

  // 恢复状态
  ctx.restore()
}

// 动画循环
let animationId: number | null = null

const startRenderLoop = () => {
  const render = () => {
    renderFrame()
    animationId = requestAnimationFrame(render)
  }
  render()
}

const stopRenderLoop = () => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}

// 监听当前时间变化
watch(() => videoStore.currentTime, () => {
  renderFrame()
})

// 监听活跃片段变化
watch(activeClips, () => {
  renderFrame()
}, { deep: true })

// 监听画布尺寸变化
watch([canvasWidth, canvasHeight], () => {
  nextTick(() => {
    renderFrame()
  })
})

// 组件挂载
onMounted(() => {
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d')
    startRenderLoop()
  }
})

// 组件卸载
onUnmounted(() => {
  stopRenderLoop()
})
</script>

<style scoped>
.canvas-video-renderer {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #1a1a1a;
}

.video-canvas {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border: 2px dashed #ff4444;
  background-color: #000;
}

.hidden-videos {
  position: absolute;
  top: -9999px;
  left: -9999px;
  visibility: hidden;
  pointer-events: none;
}

.hidden-videos video {
  width: 1px;
  height: 1px;
}
</style>

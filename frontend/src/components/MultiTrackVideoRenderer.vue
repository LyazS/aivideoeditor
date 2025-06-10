<template>
  <div class="multi-track-video-renderer">
    <!-- WebAV Canvas容器 -->
    <div
      ref="canvasContainer"
      class="webav-canvas-container"
    />

    <!-- 浏览器兼容性提示 -->
    <div class="compatibility-warning" v-if="!isSupported">
      <div class="warning-content">
        <div class="warning-icon">⚠️</div>
        <h3>浏览器不支持</h3>
        <p>此应用需要支持 WebCodecs API 的现代浏览器</p>
        <p>请使用 Chrome 94+ 或 Edge 94+ 浏览器</p>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>正在加载视频...</p>
    </div>

    <!-- 性能信息 -->
    <div v-if="showPerformanceInfo" class="performance-info">
      <span>引擎: WebAV</span>
      <span>活跃片段: {{ activeClipsCount }}</span>
      <button @click="debugStatus" style="margin-left: 10px; padding: 2px 6px; font-size: 10px;">调试</button>
    </div>

    <!-- 错误信息 -->
    <div v-if="errorMessage" class="error-message">
      <div class="error-content">
        <div class="error-icon">❌</div>
        <h3>加载失败</h3>
        <p>{{ errorMessage }}</p>
        <button @click="clearError" class="retry-btn">重试</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useVideoStore } from '@/stores/counter'
import { WebAVRenderer } from '@/utils/webavRenderer'

const videoStore = useVideoStore()

// 组件引用
const canvasContainer = ref<HTMLDivElement>()

// 状态
const isLoading = ref(false)
const showPerformanceInfo = ref(true)
const isSupported = ref(true)
const errorMessage = ref('')

// WebAV渲染器
let renderer: WebAVRenderer | null = null

// 性能监控
let animationId: number | null = null



// 检查浏览器兼容性
const checkBrowserSupport = () => {
  console.log('检查浏览器兼容性...')

  // 检查 WebCodecs API 支持
  if (typeof VideoDecoder === 'undefined' || typeof VideoEncoder === 'undefined') {
    console.warn('WebCodecs API 不支持')
    isSupported.value = false
    return false
  }

  // 检查其他必要的 API
  if (typeof OffscreenCanvas === 'undefined') {
    console.warn('OffscreenCanvas 不支持')
    isSupported.value = false
    return false
  }

  console.log('浏览器兼容性检查通过')
  return true
}

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
  if (!isSupported.value) return

  console.log('First clip changed:', {
    newClip: newClip ? { id: newClip.id, name: newClip.name, trackId: newClip.trackId, timelinePosition: newClip.timelinePosition } : null,
    oldClip: oldClip ? { id: oldClip.id, name: oldClip.name } : null
  })

  // 如果有新的第一个片段且与之前不同，加载它
  if (newClip && (!oldClip || newClip.id !== oldClip.id)) {
    console.log('Loading new first clip with WebAV:', newClip.id)
    await loadVideoClip(newClip)

    // 如果当前时间不在片段范围内，跳转到片段开始时间
    if (videoStore.currentTime < newClip.timelinePosition ||
        videoStore.currentTime >= newClip.timelinePosition + newClip.duration) {
      console.log('Jumping to clip start time:', newClip.timelinePosition)
      videoStore.setCurrentTime(newClip.timelinePosition)
    }
  }

  // 如果没有第一个片段了，清理视频
  if (!newClip && renderer) {
    console.log('No first clip, cleaning up WebAV renderer')
    renderer.clear()
  }
}, { deep: true, immediate: true })

// 监听第一个片段的属性变化，实时更新WebAV
watch(() => firstClip.value ? {
  transform: firstClip.value.transform,
  playbackRate: firstClip.value.playbackRate,
  zIndex: firstClip.value.zIndex
} : null, (newProps) => {
  if (newProps && renderer && firstClip.value) {
    console.log('First clip properties changed, updating WebAV:', newProps)
    renderer.updateClipProperties(firstClip.value)
  }
}, { deep: true })

// 监听时间轴选中状态变化，同步到WebAV画布
watch(() => videoStore.selectedClipId, (selectedClipId) => {
  if (renderer && firstClip.value) {
    // 如果选中的是当前显示的片段，在WebAV中选中它
    const shouldSelect = selectedClipId === firstClip.value.id
    console.log('时间轴选中状态变化，同步到WebAV:', { selectedClipId, firstClipId: firstClip.value.id, shouldSelect })
    renderer.setCurrentSpriteSelected(shouldSelect)
  }
})

// 监听当前时间变化 - WebAV版本
watch(() => videoStore.currentTime, () => {
  if (!videoStore.isPlaying && renderer && firstClip.value) {
    // 暂停时预览指定时间的帧
    const currentTime = videoStore.currentTime
    const clipRelativeTime = currentTime - firstClip.value.timelinePosition
    const playbackRate = firstClip.value.playbackRate || 1
    const targetVideoTime = (firstClip.value.startTime + clipRelativeTime * playbackRate) * 1e6 // 转换为微秒

    console.log('WebAV预览帧:', {
      currentTime,
      clipRelativeTime,
      playbackRate,
      targetVideoTime: targetVideoTime / 1e6
    })

    renderer.previewFrame(Math.max(0, targetVideoTime))
  }
})

// 监听播放状态变化 - WebAV版本
watch(() => videoStore.isPlaying, async (isPlaying) => {
  if (!renderer || !firstClip.value) return

  if (isPlaying) {
    const currentTime = videoStore.currentTime
    const clipRelativeTime = currentTime - firstClip.value.timelinePosition
    const playbackRate = firstClip.value.playbackRate || 1

    // 计算视频内的实际播放时间（考虑播放速度）
    const videoStartTime = firstClip.value.startTime + clipRelativeTime * playbackRate
    const videoEndTime = firstClip.value.startTime + firstClip.value.duration * playbackRate

    // 转换为微秒
    const startTime = videoStartTime * 1e6
    const endTime = videoEndTime * 1e6

    console.log('WebAV播放参数:', {
      currentTime,
      clipRelativeTime,
      playbackRate,
      videoStartTime,
      videoEndTime,
      startTimeMicros: startTime,
      endTimeMicros: endTime
    })

    await renderer.play({ start: Math.max(0, startTime), end: endTime })
  } else {
    renderer.pause()
  }
})

// 事件监听器是否已设置的标志
let eventListenersSet = false

// 使用WebAV加载视频片段
const loadVideoClip = async (clip: VideoClip) => {
  if (!renderer || !isSupported.value) return

  try {
    isLoading.value = true
    errorMessage.value = ''
    console.log('WebAV: Loading video clip:', clip.name)

    // 设置属性变化回调，实现从WebAV到属性面板的同步
    renderer.setPropsChangeCallback((transform) => {
      console.log('WebAV属性变化，同步到store:', transform)
      if (firstClip.value) {
        videoStore.updateClipTransform(firstClip.value.id, transform)
      }
    })

    // 设置sprite选中状态变化回调，实现从WebAV到时间轴的选中同步
    renderer.setSpriteSelectCallback((clipId) => {
      console.log('WebAV选中状态变化，同步到时间轴:', clipId)
      videoStore.selectClip(clipId)
    })

    // 设置视频元数据回调，保存原始分辨率信息
    renderer.setVideoMetaCallback((clipId, width, height) => {
      console.log('WebAV视频元数据获取，保存原始分辨率:', { clipId, width, height })
      videoStore.updateClipOriginalResolution(clipId, width, height)
    })

    // 使用WebAV渲染器加载视频片段
    await renderer.loadVideoClip(clip)

    // 只在第一次加载时设置事件监听器，避免重复监听
    const avCanvas = renderer.getAVCanvas()
    if (avCanvas && !eventListenersSet) {
      // 监听时间更新
      avCanvas.on('timeupdate', (time: number) => {
        if (videoStore.isPlaying && firstClip.value) {
          // 将WebAV时间转换为时间轴时间
          const videoTime = time / 1e6 // 转换为秒
          const clipRelativeTime = (videoTime - firstClip.value.startTime) / (firstClip.value.playbackRate || 1)
          const timelineTime = firstClip.value.timelinePosition + clipRelativeTime

          videoStore.setCurrentTime(timelineTime)
        }
      })

      // 监听播放状态
      avCanvas.on('playing', () => {
        // WebAV播放状态已在watch中处理
        console.log('WebAV: 播放开始')
      })

      avCanvas.on('paused', () => {
        // WebAV暂停状态已在watch中处理
        console.log('WebAV: 播放暂停')
      })

      eventListenersSet = true
      console.log('WebAV: 事件监听器已设置')
    }

    console.log('WebAV: Video clip loaded successfully')
  } catch (error) {
    console.error('WebAV: Failed to load video clip:', error)
    if (error instanceof Error) {
      errorMessage.value = error.message
    } else {
      errorMessage.value = '加载视频失败，请检查文件格式是否支持'
    }
  } finally {
    isLoading.value = false
  }
}

// 清除错误信息
const clearError = () => {
  errorMessage.value = ''
}

// WebAV不需要手动渲染循环，它会自动处理渲染



// 初始化WebAV渲染器
const initRenderer = async () => {
  if (!canvasContainer.value || !isSupported.value) return

  try {
    console.log('初始化WebAV渲染器...')
    renderer = new WebAVRenderer(canvasContainer.value)

    // 设置画布尺寸为当前视频分辨率
    renderer.setCanvasSize(canvasWidth.value, canvasHeight.value)

    await renderer.initAVCanvas()
    console.log('WebAV渲染器初始化成功')
  } catch (error) {
    console.error('WebAV渲染器初始化失败:', error)
    errorMessage.value = '渲染器初始化失败，请刷新页面重试'
  }
}

// 清理资源
const cleanup = () => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  renderer?.destroy()
  renderer = null
  eventListenersSet = false // 重置事件监听器标志
}

// 生命周期
onMounted(() => {
  console.log('WebAV MultiTrackVideoRenderer mounted')

  // 检查浏览器兼容性
  checkBrowserSupport()

  if (isSupported.value) {
    nextTick(async () => {
      await initRenderer()
      // 立即加载现有的视频片段
      loadExistingClips()
    })
  }

  // 添加窗口resize监听器
  window.addEventListener('resize', handleWindowResize)
})

// 加载现有的第一个视频片段
const loadExistingClips = async () => {
  console.log('Loading existing clips:', videoStore.clips.length)
  if (firstClip.value && renderer) {
    console.log('Loading first clip with WebAV:', firstClip.value.id, firstClip.value.name)
    await loadVideoClip(firstClip.value)
  }
}

onUnmounted(() => {
  // 移除窗口resize监听器
  window.removeEventListener('resize', handleWindowResize)
  cleanup()
})

// 监听画布尺寸变化
watch([canvasWidth, canvasHeight], () => {
  nextTick(() => {
    if (renderer) {
      // 更新渲染器的画布尺寸
      renderer.setCanvasSize(canvasWidth.value, canvasHeight.value)
      renderer.resize(canvasWidth.value, canvasHeight.value)
    }
  })
})

// 监听窗口大小变化
const handleWindowResize = () => {
  if (renderer) {
    // 延迟调整，避免频繁调用
    setTimeout(() => {
      renderer?.resize(canvasWidth.value, canvasHeight.value)
    }, 100)
  }
}

// 调试方法
const debugStatus = () => {
  console.group('🎬 WebAV视频渲染器调试信息')
  console.log('浏览器兼容性:', isSupported.value)
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
  console.log('WebAV渲染器状态:', !!renderer)
  console.log('AVCanvas状态:', renderer?.getAVCanvas() ? '已初始化' : '未初始化')
  console.log('错误信息:', errorMessage.value || '无')

  // 输出WebAV的详细状态信息
  if (renderer) {
    console.log('📊 WebAV详细状态:')
    const detailedStatus = renderer.getDetailedStatus()
    console.log(detailedStatus)

    // 输出当前设置的画布分辨率
    console.log('🎯 当前画布分辨率设置:')
    console.log('  - 项目分辨率:', { width: canvasWidth.value, height: canvasHeight.value })
    console.log('  - 视频分辨率设置:', videoStore.videoResolution)
  }

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

.webav-canvas-container {
  width: 100%;
  height: 100%;
  background-color: #2a2a2a;
  /* WebAV渲染器内部会处理尺寸和比例 */
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

.compatibility-warning {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  padding: 40px;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 8px;
  z-index: 10;
}

.warning-content {
  max-width: 500px;
  margin: 0 auto;
}

.warning-icon {
  font-size: 3rem;
  margin-bottom: 15px;
}

.compatibility-warning h3 {
  color: #856404;
  margin: 0 0 15px 0;
  font-size: 1.5rem;
}

.compatibility-warning p {
  color: #856404;
  margin: 8px 0;
  line-height: 1.5;
}

.error-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  padding: 30px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 8px;
  z-index: 10;
}

.error-content {
  max-width: 500px;
  margin: 0 auto;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 15px;
}

.error-message h3 {
  color: #721c24;
  margin: 0 0 15px 0;
  font-size: 1.5rem;
}

.error-message p {
  color: #721c24;
  margin: 8px 0 20px 0;
  line-height: 1.5;
}

.retry-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.3s ease;
}

.retry-btn:hover {
  background: #c82333;
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

<template>
  <div class="webav-renderer" ref="rendererContainer">
    <!-- WebAV画布容器 -->
    <div
      ref="canvasContainer"
      class="canvas-container"
      :style="canvasContainerStyle"
    >
      <!-- WebAV会在这里创建canvas元素 -->
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useVideoStore } from '../stores/videostore'
import { useWebAVControls, isWebAVReady } from '../composables/useWebAVControls'

const videoStore = useVideoStore()
const webAVControls = useWebAVControls()

// 组件引用
const canvasContainer = ref<HTMLElement>()
const rendererContainer = ref<HTMLElement>()

// 计算属性
const error = computed(() => webAVControls.error.value)

// 画布原始尺寸（基于视频分辨率）
const canvasWidth = computed(() => videoStore.videoResolution.width)
const canvasHeight = computed(() => videoStore.videoResolution.height)

// 容器尺寸
const containerWidth = ref(800)
const containerHeight = ref(600)

// 计算画布显示尺寸（保持比例，适应容器）
const canvasDisplaySize = computed(() => {
  const aspectRatio = canvasWidth.value / canvasHeight.value
  const containerAspectRatio = containerWidth.value / containerHeight.value

  let displayWidth: number
  let displayHeight: number

  if (aspectRatio > containerAspectRatio) {
    // 画布更宽，以宽度为准
    displayWidth = Math.min(containerWidth.value * 0.95, canvasWidth.value) // 留5%边距
    displayHeight = displayWidth / aspectRatio
  } else {
    // 画布更高，以高度为准
    displayHeight = Math.min(containerHeight.value * 0.95, canvasHeight.value) // 留5%边距
    displayWidth = displayHeight * aspectRatio
  }

  return {
    width: Math.round(displayWidth),
    height: Math.round(displayHeight)
  }
})

// 画布容器样式
const canvasContainerStyle = computed(() => ({
  width: canvasDisplaySize.value.width + 'px',
  height: canvasDisplaySize.value.height + 'px'
}))

/**
 * 初始化WebAV画布到当前容器
 */
const initializeWebAVCanvas = async (): Promise<void> => {
  if (!canvasContainer.value) {
    console.error('Canvas container not found')
    return
  }

  // 检查是否已经初始化
  const existingCanvas = webAVControls.getAVCanvas()
  if (existingCanvas) {
    console.log('WebAV Canvas已存在')
    return
  }

  try {
    await webAVControls.initializeCanvas(canvasContainer.value, {
      width: canvasWidth.value,
      height: canvasHeight.value,
      bgColor: '#000000'
    })

    console.log('WebAV画布初始化成功')
  } catch (err) {
    console.error('初始化WebAV canvas失败:', err)
  }
}

/**
 * 重新创建画布（当尺寸变化时）
 */
const recreateCanvasWithNewSize = async (newResolution: any): Promise<void> => {
  if (!canvasContainer.value) {
    console.error('Canvas container not found')
    return
  }

  try {
    console.log('开始销毁旧画布并备份内容...')

    // 销毁旧画布并备份内容
    const backup = await webAVControls.destroyCanvas()

    console.log('开始重新创建画布...')

    // 重新创建画布
    await webAVControls.recreateCanvas(canvasContainer.value, {
      width: newResolution.width,
      height: newResolution.height,
      bgColor: '#000000'
    }, backup)

    console.log('画布重新创建完成')
  } catch (err) {
    console.error('重新创建画布失败:', err)
    // 如果重新创建失败，尝试简单的重新初始化
    try {
      await webAVControls.initializeCanvas(canvasContainer.value, {
        width: newResolution.width,
        height: newResolution.height,
        bgColor: '#000000'
      })
      console.log('使用简单初始化作为备用方案')
    } catch (fallbackErr) {
      console.error('备用初始化也失败:', fallbackErr)
    }
  }
}

/**
 * 监听分辨率变化并重新创建画布
 */
watch(
  () => videoStore.videoResolution,
  async (newResolution, oldResolution) => {
    console.log('Video resolution changed:', newResolution)

    // 检查是否真的需要重新创建画布
    if (!oldResolution ||
        newResolution.width !== oldResolution.width ||
        newResolution.height !== oldResolution.height) {

      console.log('画布尺寸发生变化，开始重新创建画布...')
      await recreateCanvasWithNewSize(newResolution)
    }
  },
  { deep: true }
)

/**
 * 监听播放状态变化，同步到WebAV
 */
watch(
  () => videoStore.isPlaying,
  (isPlaying) => {
    // 注意：这里我们不直接控制WebAV播放，因为WebAV应该是播放状态的主控
    // 这个监听主要用于调试和状态同步检查
    console.log('Video store playing state changed:', isPlaying)
  }
)

/**
 * 监听当前时间变化，同步到WebAV
 */
watch(
  () => videoStore.currentTime,
  (currentTime) => {
    // 只有当不是播放状态时才手动跳转（避免播放时的冲突）
    if (!videoStore.isPlaying && isWebAVReady()) {
      webAVControls.seekTo(currentTime)
    }
  }
)

/**
 * 更新容器尺寸
 */
const updateContainerSize = (): void => {
  if (!rendererContainer.value) return

  const rect = rendererContainer.value.getBoundingClientRect()
  containerWidth.value = rect.width
  containerHeight.value = rect.height

  console.log('Container size updated:', {
    width: containerWidth.value,
    height: containerHeight.value,
    canvasDisplay: canvasDisplaySize.value
  })
}

/**
 * 设置ResizeObserver监听容器尺寸变化
 */
const setupResizeObserver = (): void => {
  if (!rendererContainer.value) return

  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      containerWidth.value = width
      containerHeight.value = height
    }
  })

  resizeObserver.observe(rendererContainer.value)

  // 保存observer引用以便清理
  ;(rendererContainer.value as any)._resizeObserver = resizeObserver
}

/**
 * 清理ResizeObserver
 */
const cleanupResizeObserver = (): void => {
  if (rendererContainer.value && (rendererContainer.value as any)._resizeObserver) {
    ;(rendererContainer.value as any)._resizeObserver.disconnect()
    delete (rendererContainer.value as any)._resizeObserver
  }
}

// 生命周期
onMounted(async () => {
  // 初始化容器尺寸
  await nextTick()
  updateContainerSize()

  // 设置尺寸监听
  setupResizeObserver()

  // 初始化WebAV画布到容器
  await initializeWebAVCanvas()
})

onUnmounted(() => {
  // 清理ResizeObserver
  cleanupResizeObserver()

  // 注意：不要在这里销毁WebAV，因为它是全局单例
  // webAVControls.destroy()
})

// 暴露方法给父组件
defineExpose({
  initializeWebAVCanvas,
  recreateCanvasWithNewSize,
  getAVCanvas: webAVControls.getAVCanvas,
  captureFrame: webAVControls.captureFrame
})
</script>

<style scoped>
.webav-renderer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #1a1a1a;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  /* 确保容器可以被ResizeObserver正确监听 */
  box-sizing: border-box;
}

.canvas-container {
  position: relative;
  background-color: #000;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  /* 画布容器会根据计算的尺寸动态调整 */
  flex-shrink: 0;
  box-sizing: border-box;
}

/* WebAV会在canvas-container中创建canvas元素，我们为其设置样式 */
.canvas-container :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.error-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(244, 67, 54, 0.9);
  color: white;
  padding: 16px 24px;
  border-radius: 8px;
  font-size: 14px;
  text-align: center;
  max-width: 80%;
  word-wrap: break-word;
  z-index: 10;
}

.loading-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 16px 24px;
  border-radius: 8px;
  font-size: 14px;
  text-align: center;
  z-index: 10;
}

.success-indicator {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(76, 175, 80, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 10;
  animation: fadeInOut 3s ease-in-out;
}

@keyframes fadeInOut {
  0% { opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .canvas-container {
    max-width: 100%;
    max-height: 100%;
  }
}
</style>

<template>
  <div class="webav-renderer">
    <!-- WebAV画布容器 -->
    <div 
      ref="canvasContainer" 
      class="canvas-container"
      :style="{ 
        width: canvasWidth + 'px', 
        height: canvasHeight + 'px' 
      }"
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useVideoStore } from '../stores/counter'
import { useWebAVControls, isWebAVReady } from '../composables/useWebAVControls'

const videoStore = useVideoStore()
const webAVControls = useWebAVControls()

// 组件引用
const canvasContainer = ref<HTMLElement>()

// 计算属性
const error = computed(() => webAVControls.error.value)

// 画布尺寸
const canvasWidth = computed(() => videoStore.videoResolution.width)
const canvasHeight = computed(() => videoStore.videoResolution.height)

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
 * 监听分辨率变化
 */
watch(
  () => videoStore.videoResolution,
  (newResolution) => {
    console.log('Video resolution changed:', newResolution)
    // 如果需要，可以在这里重新初始化画布
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

// 生命周期
onMounted(async () => {
  // 初始化WebAV画布到容器
  await initializeWebAVCanvas()
})

onUnmounted(() => {
  // 注意：不要在这里销毁WebAV，因为它是全局单例
  // webAVControls.destroy()
})

// 暴露方法给父组件
defineExpose({
  initializeWebAVCanvas,
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
}

.canvas-container {
  position: relative;
  background-color: #000;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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

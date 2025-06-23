<template>
  <div class="fps-display">
    <div class="fps-value" :class="fpsColorClass">{{ displayFPS }}</div>
    <div class="fps-label">FPS</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { useWebAVControls } from '../composables/useWebAVControls'

const videoStore = useVideoStore()
const webAVControls = useWebAVControls()

// FPS计算相关状态
const fps = ref(0)
const frameCount = ref(0)
const lastTime = ref(0)
const timeUpdateListener = ref<((time: number) => void) | null>(null)
const isMonitoring = ref(false)

// 显示的FPS值（保留一位小数）
const displayFPS = computed(() => {
  if (!isMonitoring.value) {
    return '--'
  }
  return fps.value.toFixed(1)
})

// 根据FPS值确定颜色类
const fpsColorClass = computed(() => {
  if (!isMonitoring.value) {
    return 'fps-inactive' // 灰色 - 未监控状态
  }

  const fpsValue = fps.value
  if (fpsValue >= 55) {
    return 'fps-high' // 绿色 - 高帧率
  } else if (fpsValue >= 25) {
    return 'fps-medium' // 橙色 - 中等帧率
  } else {
    return 'fps-low' // 红色 - 低帧率
  }
})

/**
 * 监听AVCanvas的timeupdate事件来计算渲染帧率
 */
const onTimeUpdate = (timeMicroseconds: number) => {
  const currentTime = performance.now()
  frameCount.value++

  // 每秒更新一次FPS显示
  if (currentTime - lastTime.value >= 1000) {
    // 计算FPS：帧数 / 时间间隔（秒）
    fps.value = (frameCount.value * 1000) / (currentTime - lastTime.value)

    // 重置计数器
    frameCount.value = 0
    lastTime.value = currentTime
  }
}

/**
 * 开始监控AVCanvas的渲染帧率
 */
const startAVCanvasFPSMonitoring = () => {
  const avCanvas = webAVControls.getAVCanvas()
  if (!avCanvas) {
    console.warn('⚠️ [FPS Display] AVCanvas not ready, waiting...')
    return
  }

  // 避免重复监控
  if (isMonitoring.value) {
    return
  }

  // 重置计数器
  lastTime.value = performance.now()
  frameCount.value = 0
  fps.value = 0
  isMonitoring.value = true

  // 创建timeupdate事件监听器
  timeUpdateListener.value = onTimeUpdate
  avCanvas.on('timeupdate', timeUpdateListener.value)

  console.log('✅ [FPS Display] Started monitoring AVCanvas FPS')
}

/**
 * 停止监控AVCanvas的渲染帧率
 */
const stopAVCanvasFPSMonitoring = () => {
  if (!isMonitoring.value) {
    return
  }

  const avCanvas = webAVControls.getAVCanvas()
  if (avCanvas && timeUpdateListener.value) {
    // WebAV的AVCanvas可能没有removeEventListener方法，直接设置为null即可
    // 因为监听器是通过WebAV内部管理的，我们只需要清理引用
    timeUpdateListener.value = null
  }

  isMonitoring.value = false
  fps.value = 0
  frameCount.value = 0
  console.log('🛑 [FPS Display] Stopped monitoring AVCanvas FPS')
}

// 监听WebAV就绪状态，当WebAV准备好时开始监控
watch(
  () => videoStore.isWebAVReady,
  (isReady) => {
    if (isReady) {
      startAVCanvasFPSMonitoring()
    } else {
      stopAVCanvasFPSMonitoring()
    }
  },
  { immediate: true }
)

// 组件挂载时检查WebAV状态
onMounted(() => {
  if (videoStore.isWebAVReady) {
    startAVCanvasFPSMonitoring()
  }
})

// 组件卸载时停止监控
onUnmounted(() => {
  stopAVCanvasFPSMonitoring()
})
</script>

<style scoped>
.fps-display {
  position: absolute;
  top: 12px;
  right: 12px;
  background-color: rgba(0, 0, 0, 0.8);
  color: #ffffff;
  padding: 8px 12px;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  font-weight: bold;
  text-align: center;
  z-index: 10;
  min-width: 50px;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  user-select: none;
  pointer-events: none;
}

.fps-value {
  font-size: 16px;
  line-height: 1;
  transition: color 0.3s ease;
}

.fps-label {
  font-size: 10px;
  line-height: 1;
  color: #cccccc;
  margin-top: 2px;
  opacity: 0.8;
}

/* FPS颜色类 */
.fps-high {
  color: #00ff88; /* 绿色 - 高帧率 */
  text-shadow: 0 0 4px rgba(0, 255, 136, 0.3);
}

.fps-medium {
  color: #ffaa00; /* 橙色 - 中等帧率 */
  text-shadow: 0 0 4px rgba(255, 170, 0, 0.3);
}

.fps-low {
  color: #ff4444; /* 红色 - 低帧率 */
  text-shadow: 0 0 4px rgba(255, 68, 68, 0.3);
}

.fps-inactive {
  color: #888888; /* 灰色 - 未监控状态 */
  text-shadow: 0 0 4px rgba(136, 136, 136, 0.3);
}
</style>

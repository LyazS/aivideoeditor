<template>
  <div
    class="playhead-container"
    ref="playheadContainer"
    @mousedown="handleContainerMouseDown"
    @wheel="handleWheel"
    :class="{
      'container-interactive': enableContainerClick,
      dragging: isDragging && enableContainerClick,
    }"
  >
    <!-- 播放头手柄 -->
    <div
      class="playhead-handle"
      :style="{ left: playheadPosition + 'px' }"
      @mousedown="startDragPlayhead"
      :class="{ dragging: isDragging }"
    >
      <!-- 白色倒三角 -->
      <div class="playhead-triangle"></div>
    </div>

    <!-- 播放竖线 - 覆盖整个时间轴 -->
    <div class="playhead-line" :style="{ left: playheadLinePosition + 'px' }"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'

interface PlayheadProps {
  /** 时间轴容器宽度 */
  timelineWidth: number
  /** 轨道控制区域宽度（左侧偏移） */
  trackControlWidth?: number
  /** 播放头手柄的容器元素（用于计算相对位置） */
  handleContainer?: HTMLElement | null
  /** 滚轮事件的目标容器元素 */
  wheelContainer?: HTMLElement | null
  /** 是否启用整个容器区域的点击交互 */
  enableContainerClick?: boolean
  /** 是否启用吸附功能 */
  enableSnapping?: boolean
}

const props = withDefaults(defineProps<PlayheadProps>(), {
  trackControlWidth: 0,
  handleContainer: null,
  wheelContainer: null,
  enableContainerClick: false,
  enableSnapping: false
})

const playheadContainer = ref<HTMLElement>()
const isDragging = ref(false)
const currentTime = ref(0) // 当前时间（秒）

// 播放头位置计算 - 空状态下固定在开始位置
const playheadPosition = computed(() => {
  const totalSeconds = 10 // 空状态总时长10秒
  const pixelsPerSecond = props.timelineWidth / totalSeconds
  return currentTime.value * pixelsPerSecond
})

// 播放头竖线位置（相对于整个时间轴）
const playheadLinePosition = computed(() => {
  return playheadPosition.value + props.trackControlWidth
})

// 空壳方法 - 不执行实际操作
const handleContainerMouseDown = (event: MouseEvent) => {
  if (!props.enableContainerClick) return
  
  // 计算点击位置对应的时间
  const rect = playheadContainer.value?.getBoundingClientRect()
  if (!rect) return
  
  const clickX = event.clientX - rect.left
  const totalSeconds = 10
  const pixelsPerSecond = props.timelineWidth / totalSeconds
  const newTime = Math.max(0, Math.min(totalSeconds, clickX / pixelsPerSecond))
  
  currentTime.value = newTime
  console.log('Playhead moved to:', newTime, 'seconds (empty shell)')
}

const startDragPlayhead = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()
  
  isDragging.value = true
  
  const startX = event.clientX
  const startTime = currentTime.value
  
  const handleMouseMove = (e: MouseEvent) => {
    const deltaX = e.clientX - startX
    const totalSeconds = 10
    const pixelsPerSecond = props.timelineWidth / totalSeconds
    const deltaTime = deltaX / pixelsPerSecond
    
    const newTime = Math.max(0, Math.min(totalSeconds, startTime + deltaTime))
    currentTime.value = newTime
  }
  
  const handleMouseUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    console.log('Playhead drag ended at:', currentTime.value, 'seconds (empty shell)')
  }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleWheel = (event: WheelEvent) => {
  // 空壳方法 - 不执行缩放操作
  console.log('Wheel event (empty shell):', event.deltaY)
}

onUnmounted(() => {
  // 清理事件监听器
})
</script>

<style scoped>
.playhead-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.playhead-container.container-interactive {
  pointer-events: all;
  cursor: pointer;
}

.playhead-container.dragging {
  cursor: grabbing;
}

.playhead-handle {
  position: absolute;
  top: 0;
  width: 20px;
  height: 20px;
  margin-left: -10px;
  pointer-events: all;
  cursor: grab;
  z-index: 10;
}

.playhead-handle.dragging {
  cursor: grabbing;
}

.playhead-triangle {
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 12px solid white;
  margin: 4px auto 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.playhead-line {
  position: absolute;
  top: 0;
  width: 2px;
  height: 100vh;
  background: white;
  pointer-events: none;
  z-index: 5;
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
}
</style>

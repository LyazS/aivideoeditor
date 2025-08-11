<template>
  <div 
    v-if="isVisible"
    class="snap-points-overlay"
    :style="{ 
      left: trackControlWidth + 'px',
      width: timelineWidth + 'px' 
    }"
  >
    <div
      v-for="point in snapPoints"
      :key="`${point.type}-${point.frame}`"
      class="snap-point-marker"
      :style="{ left: getSnapPointPosition(point.frame) + 'px' }"
    >
      <div class="snap-point-line"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSnapManager } from '../composables/useSnapManager'
import { useUnifiedStore } from '../unifiedStore'
import { UnifiedSnapCalculator } from '../utils/snapCalculator'
import type { SnapPoint } from '../../types/snap'

interface Props {
  /** 时间轴容器宽度 */
  timelineWidth: number
  /** 轨道控制区域宽度 */
  trackControlWidth: number
}

const props = defineProps<Props>()

const snapManager = useSnapManager()
const unifiedStore = useUnifiedStore()

const isVisible = ref(false)
const snapPoints = ref<SnapPoint[]>([])

/**
 * 获取吸附点在时间轴上的像素位置
 */
function getSnapPointPosition(frame: number): number {
  return unifiedStore.frameToPixel(frame, props.timelineWidth)
}

/**
 * 刷新吸附点数据
 */
function refreshSnapPoints() {
  if (!isVisible.value) return
  
  const collectionOptions = {
    includeClipBoundaries: snapManager.snapConfig.isClipBoundariesEnabled.value,
    includeKeyframes: snapManager.snapConfig.isKeyframesEnabled.value,
    includePlayhead: snapManager.snapConfig.isPlayheadEnabled.value,
    includeTimelineStart: snapManager.snapConfig.isTimelineStartEnabled.value,
  }

  const calculator = new UnifiedSnapCalculator()
  const newSnapPoints = calculator.collectSnapPoints(collectionOptions)
  
  snapPoints.value = newSnapPoints
}

// 监听时间轴项目变化，自动刷新
watch(() => unifiedStore.timelineItems, () => {
  if (isVisible.value) {
    refreshSnapPoints()
  }
}, { deep: true })

// 监听全局事件，响应吸附点显示状态的改变
const handleSnapPointsVisibilityChanged = (event: CustomEvent) => {
  isVisible.value = event.detail.visible
  if (isVisible.value) {
    refreshSnapPoints()
  } else {
    snapPoints.value = []
  }
}

// 组件挂载时添加事件监听器
onMounted(() => {
  window.addEventListener('snap-points-visibility-changed', handleSnapPointsVisibilityChanged as EventListener)
})

// 组件卸载时移除事件监听器
onUnmounted(() => {
  window.removeEventListener('snap-points-visibility-changed', handleSnapPointsVisibilityChanged as EventListener)
})
</script>

<style scoped>
.snap-points-overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 999;
}

.snap-point-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  pointer-events: none;
}

.snap-point-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background-color: rgba(255, 255, 255, 0.6);
}
</style>
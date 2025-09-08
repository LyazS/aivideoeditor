<template>
  <div class="snap-indicators" v-if="visibleSnapLines.length > 0">
    <div
      v-for="line in visibleSnapLines"
      :key="line.id"
      class="snap-line"
      :class="`snap-line-${line.type}`"
      :style="{
        left: line.position + 'px',
        opacity: line.opacity
      }"
    >
      <div class="snap-line-content"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SnapPoint } from '@/types/snap'

interface SnapLine {
  id: string
  position: number
  type: string
  opacity: number
}

interface Props {
  snapPoints: SnapPoint[]
  frameToPixel: (frames: number, timelineWidth: number) => number
  timelineWidth: number
  enabled: boolean
  trackControlWidth?: number // 轨道控制区域宽度
}

const props = withDefaults(defineProps<Props>(), {
  enabled: true
})

const visibleSnapLines = ref<SnapLine[]>([])

// 吸附线颜色映射
const SNAP_LINE_COLORS = {
  'clip-start': '#4CAF50', // 绿色 - 片段边界
  'clip-end': '#4CAF50',   // 绿色 - 片段边界
  'keyframe': '#2196F3',   // 蓝色 - 关键帧
  'timeline-start': '#9C27B0' // 紫色 - 时间轴起始
}

// 计算吸附线位置（考虑轨道控制区域偏移）
const calculateSnapLines = computed(() => {
  if (!props.enabled || !props.snapPoints.length || !props.timelineWidth) {
    return []
  }

  return props.snapPoints.map((point, index) => {
    const basePosition = props.frameToPixel(point.frame, props.timelineWidth)
    const adjustedPosition = basePosition + (props.trackControlWidth || 0)
    
    console.log(`📐 [ SnapIndicator ] 计算吸附线位置: frame=${point.frame}, base=${basePosition}, adjusted=${adjustedPosition}, trackControlWidth=${props.trackControlWidth}`)
    
    return {
      id: `snap-line-${point.type}-${index}`,
      position: adjustedPosition,
      type: point.type,
      opacity: 1
    }
  })
})

// 监听吸附点变化，更新可见线条
watch(
  () => calculateSnapLines.value,
  (newLines) => {
    visibleSnapLines.value = newLines
    
    // 如果没有新的吸附线，清除所有线条
    if (newLines.length === 0) {
      visibleSnapLines.value = []
      return
    }

    // 为每条线添加渐隐效果
    newLines.forEach((line, index) => {
      setTimeout(() => {
        const targetLine = visibleSnapLines.value.find(l => l.id === line.id)
        if (targetLine) {
          targetLine.opacity = 0
        }
      }, 1000 + (index * 100)) // 每条线延迟100ms开始渐隐
    })

    // 完全清除线条
    setTimeout(() => {
      visibleSnapLines.value = []
    }, 2000)
  }
)

// 暴露方法给父组件
const showSnapIndicator = (snapPoint: SnapPoint) => {
  if (!props.enabled) return
  
  const basePosition = props.frameToPixel(snapPoint.frame, props.timelineWidth)
  const adjustedPosition = basePosition + (props.trackControlWidth || 0)
  
  console.log(`📐 [ SnapIndicator ] showSnapIndicator: frame=${snapPoint.frame}, base=${basePosition}, adjusted=${adjustedPosition}, trackControlWidth=${props.trackControlWidth}`)
  
  const newLine: SnapLine = {
    id: `snap-line-${snapPoint.type}-${Date.now()}`,
    position: adjustedPosition,
    type: snapPoint.type,
    opacity: 1
  }
  
  visibleSnapLines.value = [newLine]
  
  // 2秒后清除
  setTimeout(() => {
    visibleSnapLines.value = []
  }, 2000)
}

const hideAllIndicators = () => {
  visibleSnapLines.value = []
}

defineExpose({
  showSnapIndicator,
  hideAllIndicators
})
</script>

<style scoped>
.snap-indicators {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 100;
  margin-left: 0; /* 将由父组件通过track-control-width控制 */
}

.snap-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  transition: opacity 0.3s ease;
}

.snap-line-content {
  width: 100%;
  height: 100%;
  background-color: currentColor;
  box-shadow: 0 0 4px currentColor;
}

/* 片段边界吸附线 - 绿色 */
.snap-line-clip-start,
.snap-line-clip-end {
  color: #4CAF50;
}

/* 关键帧吸附线 - 蓝色 */
.snap-line-keyframe {
  color: #2196F3;
}

/* 时间轴起始吸附线 - 紫色 */
.snap-line-timeline-start {
  color: #9C27B0;
}

/* 添加脉冲动画效果 */
.snap-line {
  animation: snapPulse 0.6s ease-out;
}

@keyframes snapPulse {
  0% {
    transform: scaleY(0.8);
    opacity: 0.8;
  }
  50% {
    transform: scaleY(1.1);
    opacity: 1;
  }
  100% {
    transform: scaleY(1);
    opacity: 1;
  }
}
</style>
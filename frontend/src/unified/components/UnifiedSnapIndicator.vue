<template>
  <div class="snap-indicator-container">
    <!-- 吸附指示线 -->
    <div
      v-if="props.show && indicatorPosition !== null"
      class="snap-indicator-line"
      :class="indicatorClass"
      :style="indicatorStyle"
    >
      <!-- 吸附信息提示 -->
      <div v-if="showTooltip && snapInfo" class="snap-tooltip" :style="tooltipStyle">
        <div class="snap-tooltip-content">
          <div class="snap-type">{{ snapInfo.typeLabel }}</div>
          <div class="snap-position">{{ snapInfo.positionLabel }}</div>
          <div v-if="snapInfo.timecode" class="snap-timecode">{{ snapInfo.timecode }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { SnapPoint } from '../../types/snap'
import { framesToTimecode } from '../utils/timeUtils'
import { useUnifiedStore } from '../unifiedStore'

interface Props {
  // 是否显示指示器
  show: boolean
  // 吸附点信息
  snapPoint?: SnapPoint
  // 时间轴宽度
  timelineWidth: number
  // 时间轴容器的偏移量
  timelineOffset?: { x: number; y: number }
  // 是否显示工具提示
  showTooltip?: boolean
  // 指示线高度
  lineHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  timelineOffset: () => ({ x: 0, y: 0 }),
  showTooltip: true,
  lineHeight: 400,
})

const unifiedStore = useUnifiedStore()

// 内部状态
const indicatorPosition = ref<number | null>(null)

// 计算属性
const indicatorClass = computed(() => {
  if (!props.snapPoint) return ''

  switch (props.snapPoint.type) {
    case 'clip-start':
    case 'clip-end':
      return 'snap-indicator-clip'
    case 'keyframe':
      return 'snap-indicator-keyframe'
    case 'playhead':
      return 'snap-indicator-playhead'
    case 'timeline-start':
      return 'snap-indicator-timeline'
    default:
      return ''
  }
})

const indicatorStyle = computed(() => {
  if (indicatorPosition.value === null) return {}

  return {
    left: `${indicatorPosition.value + props.timelineOffset.x}px`,
    top: `${props.timelineOffset.y}px`,
    height: `${props.lineHeight}px`,
  }
})

const tooltipStyle = computed(() => {
  if (indicatorPosition.value === null) return {}

  // 工具提示位置在指示线上方
  return {
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: '100%',
    marginBottom: '8px',
  }
})

const snapInfo = computed(() => {
  if (!props.snapPoint) return null

  const frame = props.snapPoint.frame
  const timecode = framesToTimecode(frame)

  let typeLabel = ''
  let positionLabel = `帧: ${frame}`

  switch (props.snapPoint.type) {
    case 'clip-start':
      typeLabel = '片段开始'
      if ('clipName' in props.snapPoint) {
        positionLabel = `${props.snapPoint.clipName} - 开始`
      }
      break
    case 'clip-end':
      typeLabel = '片段结束'
      if ('clipName' in props.snapPoint) {
        positionLabel = `${props.snapPoint.clipName} - 结束`
      }
      break
    case 'keyframe':
      typeLabel = '关键帧'
      if ('keyframeId' in props.snapPoint) {
        positionLabel = `关键帧 - 帧: ${frame}`
      }
      break
    case 'playhead':
      typeLabel = '播放头'
      positionLabel = `播放头位置`
      break
    case 'timeline-start':
      typeLabel = '时间轴起始'
      positionLabel = '起始位置'
      break
  }

  return {
    typeLabel,
    positionLabel,
    timecode,
  }
})

// 监听props变化，更新指示器状态
watch(
  () => [props.show, props.snapPoint, props.timelineWidth],
  ([show, snapPoint, timelineWidth]) => {
    if (
      show &&
      snapPoint &&
      typeof snapPoint === 'object' &&
      'frame' in snapPoint &&
      typeof timelineWidth === 'number' &&
      timelineWidth > 0
    ) {
      // 计算指示线的像素位置
      const pixelPosition = unifiedStore.frameToPixel(snapPoint.frame, timelineWidth)
      indicatorPosition.value = pixelPosition
    } else {
      indicatorPosition.value = null
    }
  },
  { immediate: true },
)

// 暴露方法给父组件
defineExpose({
  updatePosition: (frame: number) => {
    if (props.timelineWidth > 0) {
      const pixelPosition = unifiedStore.frameToPixel(frame, props.timelineWidth)
      indicatorPosition.value = pixelPosition
    }
  },
})
</script>

<style scoped>
.snap-indicator-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
}

.snap-indicator-line {
  position: absolute;
  width: 2px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  animation: snap-fade-in 0.15s ease-out;
}

/* 不同类型的吸附指示线颜色 */
.snap-indicator-clip {
  background: #2196f3; /* 蓝色：片段边界吸附 */
  box-shadow: 0 0 6px rgba(33, 150, 243, 0.6);
}

.snap-indicator-keyframe {
  background: #4caf50; /* 绿色：关键帧吸附 */
  box-shadow: 0 0 6px rgba(76, 175, 80, 0.6);
}

.snap-indicator-playhead {
  background: #f44336; /* 红色：播放头吸附 */
  box-shadow: 0 0 6px rgba(244, 67, 54, 0.6);
}

.snap-indicator-timeline {
  background: #9e9e9e; /* 灰色：时间轴起始位置吸附 */
  box-shadow: 0 0 6px rgba(158, 158, 158, 0.6);
}

.snap-tooltip {
  position: absolute;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  animation: snap-tooltip-fade-in 0.2s ease-out;
}

.snap-tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.snap-type {
  font-weight: 600;
  color: #fff;
}

.snap-position {
  font-size: 11px;
  color: #ccc;
}

.snap-timecode {
  font-size: 11px;
  color: #aaa;
  font-family: 'Courier New', monospace;
}

/* 动画效果 */
@keyframes snap-fade-in {
  from {
    opacity: 0;
    transform: scaleY(0.8);
  }
  to {
    opacity: 1;
    transform: scaleY(1);
  }
}

@keyframes snap-tooltip-fade-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>

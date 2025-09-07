<!-- AudioContentTemplate.vue -->
<template>
  <div class="audio-content" :class="{ selected: isSelected }">
    <!-- 波形Canvas容器 -->
    <canvas
      ref="waveformCanvas"
      :height="DEFAULT_TRACK_HEIGHTS.audio - 2 * DEFAULT_TRACK_PADDING"
      class="waveform-canvas"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { throttle } from 'lodash'
import type { ContentTemplateProps } from '@/unified/types/clipRenderer'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { calculateClipWidthPixels } from '@/unified/utils/thumbnailAlgorithms'
import { renderWaveformDirectly } from '@/unified/utils/audioWaveformUtils'
import { DEFAULT_TRACK_HEIGHTS, DEFAULT_TRACK_PADDING } from '@/unified/constants/TrackConstants'

const props = defineProps<ContentTemplateProps<'audio'>>()
const unifiedStore = useUnifiedStore()

const waveformCanvas = ref<HTMLCanvasElement>()

// 视口变化检测优化
const lastViewportParams = ref({ start: 0, end: 0, width: 0 })

// 采样波形计算属性
const sampleWaveform = computed(() => {
  const clipTLStartFrame = props.data.timeRange.timelineStartTime
  const clipTLEndFrame = props.data.timeRange.timelineEndTime
  const clipTLDurationFrames = clipTLEndFrame - clipTLStartFrame

  // 计算clip的像素宽度
  const clipWidthPixels = calculateClipWidthPixels(
    clipTLDurationFrames,
    props.timelineWidth,
    unifiedStore.totalDurationFrames,
    unifiedStore.zoomLevel,
  )

  // 检查是否在视口范围内
  const viewportStartFrame = props.viewportFrameRange.startFrames
  const viewportEndFrame = props.viewportFrameRange.endFrames

  if (clipTLStartFrame >= viewportEndFrame || clipTLEndFrame <= viewportStartFrame) {
    return null
  }

  const viewportTLStartFrame = Math.max(viewportStartFrame, clipTLStartFrame)
  const viewportTLEndFrame = Math.min(viewportEndFrame, clipTLEndFrame)

  return {
    viewportTLStartFrame,
    viewportTLEndFrame,
    clipWidthPixels: Math.floor(clipWidthPixels),
  }
})

// 核心渲染逻辑
function renderWaveformInComponent() {
  if (!waveformCanvas.value || !sampleWaveform.value) {
    return
  }

  const { viewportTLStartFrame, viewportTLEndFrame, clipWidthPixels } = sampleWaveform.value

  if (waveformCanvas.value) {
    renderWaveformDirectly(
      waveformCanvas.value,
      props.data,
      viewportTLStartFrame,
      viewportTLEndFrame,
      clipWidthPixels,
      {
        waveColor: '#eeeeee',
        amplitude: 0.8,
        height: DEFAULT_TRACK_HEIGHTS.audio - 2 * DEFAULT_TRACK_PADDING,
        lineWidth: 3,
      },
    )
  }
}

// 节流渲染函数（333ms，与视频缩略图一致）
const throttledRenderWaveform = throttle(renderWaveformInComponent, 333, {
  leading: false,
  trailing: true,
})

// 监听sampleWaveform变化（主要触发条件）
watch(
  () => sampleWaveform.value,
  (newValue) => {
    if (newValue && waveformCanvas.value) {
      const currentParams = {
        start: newValue.viewportTLStartFrame,
        end: newValue.viewportTLEndFrame,
        width: newValue.clipWidthPixels,
      }

      // 只在视口发生显著变化时重新渲染
      const shouldRender =
        Math.abs(currentParams.start - lastViewportParams.value.start) > 10 ||
        Math.abs(currentParams.end - lastViewportParams.value.end) > 10 ||
        Math.abs(currentParams.width - lastViewportParams.value.width) > 5

      if (shouldRender) {
        lastViewportParams.value = currentParams
        throttledRenderWaveform()
      }
    }
  },
  { deep: true },
)

// 组件挂载时初始渲染
onMounted(() => {
  if (sampleWaveform.value) {
    throttledRenderWaveform()
  }
})

// 组件卸载时清理
onUnmounted(() => {
  throttledRenderWaveform.cancel()
})
</script>

<style scoped>
.audio-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center; /* 保持居中显示 */
}

.waveform-canvas {
  /* 使用固定尺寸避免缩放问题 */
  width: auto;
  /* height: 40px; */
  background: rgba(0, 0, 0, 0); /* 添加背景以便调试 */
  display: block; /* 确保正确显示 */
}

/* 保持向后兼容的样式 */
.sample-number {
  font-size: 12px;
  color: white;
  font-weight: bold;
}
</style>

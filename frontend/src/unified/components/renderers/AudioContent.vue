<!-- AudioContentTemplate.vue -->
<template>
  <div class="audio-content" :class="{ selected: isSelected }">
    <div v-if="sampleWaveform" class="sample-number">
      {{ sampleWaveform.viewportTLStartFrame }} | {{ sampleWaveform.clipWidthPixels }} |
      {{ sampleWaveform.viewportTLEndFrame }}
    </div>
    <div v-else class="sample-number">No sample waveform available</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ContentTemplateProps } from '@/unified/types/clipRenderer'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { calculateClipWidthPixels } from '@/unified/utils/thumbnailAlgorithms'

const props = defineProps<ContentTemplateProps<'audio'>>()
const unifiedStore = useUnifiedStore()

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
</script>

<style scoped>
.audio-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sample-number {
  font-size: 12px;
  color: white;
  font-weight: bold;
}
</style>

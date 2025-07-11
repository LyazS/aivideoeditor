<template>
  <TimelineBaseClip
    ref="baseClipRef"
    :timeline-item="timelineItem"
    :track="track"
    :timeline-width="timelineWidth"
    :total-duration-frames="totalDurationFrames"
    class="audio-clip"
    @select="$emit('select', $event)"
    @update-position="(timelineItemId, newPosition, newTrackId) => $emit('update-position', timelineItemId, newPosition, newTrackId)"
    @remove="$emit('remove', $event)"
  >
    <template #content="{ timelineItem }">
      <!-- 音频内容显示区域 -->
      <div class="audio-content">
        <!-- 音频波形显示 -->
        <div v-if="showWaveform" class="audio-waveform">
          <svg 
            :width="clipWidth" 
            :height="clipHeight - 20"
            class="waveform-svg"
          >
            <!-- 波形路径 -->
            <path 
              :d="waveformPath" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="1"
              opacity="0.7"
            />
          </svg>
        </div>
        
        <!-- 音频信息显示 -->
        <div class="audio-info">
          <div class="audio-name">{{ audioDisplayName }}</div>
          <div class="audio-duration">{{ formatDurationFromFrames(audioDurationFrames) }}</div>
        </div>
        
        <!-- 音频控制指示器 -->
        <div class="audio-controls">
          <div v-if="audioConfig.isMuted" class="mute-indicator">🔇</div>
          <div class="volume-indicator">{{ Math.round(audioConfig.volume * 100) }}%</div>
        </div>
      </div>
      
      <!-- 工具提示 -->
      <ClipTooltip
        v-if="showTooltip"
        :visible="showTooltip"
        :title="audioDisplayName"
        :media-type="'audio'"
        :duration="formatDurationFromFrames(audioDurationFrames)"
        :position="formatDurationFromFrames(props.timelineItem.timeRange.timelineStartTime)"
        :mouse-x="tooltipPosition.x"
        :mouse-y="tooltipPosition.y"
        :clip-top="0"
      />
    </template>
  </TimelineBaseClip>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { framesToTimecode } from '../stores/utils/timeUtils'
import TimelineBaseClip from './TimelineBaseClip.vue'
import ClipTooltip from './ClipTooltip.vue'
import type { LocalTimelineItem, Track, AudioMediaConfig } from '../types'

interface Props {
  timelineItem: TimelineItem<'audio'>
  track?: Track
  timelineWidth: number
  totalDurationFrames: number
}

interface Emits {
  (e: 'select', itemId: string): void
  (e: 'update-position', timelineItemId: string, newPosition: number, newTrackId?: string): void
  (e: 'remove', timelineItemId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const videoStore = useVideoStore()

// TimelineBaseClip组件引用
const baseClipRef = ref<InstanceType<typeof TimelineBaseClip>>()

// 获取对应的MediaItem
const mediaItem = computed(() => {
  return videoStore.getMediaItem(props.timelineItem.mediaItemId)
})

// 音频配置
const audioConfig = computed(() => props.timelineItem.config as AudioMediaConfig)

// 音频显示名称
const audioDisplayName = computed(() => {
  return mediaItem.value?.name || '音频文件'
})

// 音频时长（帧数）
const audioDurationFrames = computed(() => {
  const timeRange = props.timelineItem.timeRange
  return timeRange.effectiveDuration || 0
})

// 计算clip的尺寸
const clipWidth = computed(() => {
  const timeRange = props.timelineItem.timeRange
  const durationFrames = timeRange.timelineEndTime - timeRange.timelineStartTime
  return videoStore.frameToPixel(durationFrames, props.timelineWidth)
})

const clipHeight = computed(() => {
  return props.track?.height || 60
})

// 是否显示波形
const showWaveform = computed(() => {
  return clipWidth.value > 100 // 只有在clip足够宽时才显示波形
})

// 简化的波形路径（实际应该从音频数据生成）
const waveformPath = computed(() => {
  if (!showWaveform.value) return ''
  
  // 生成简单的示例波形
  const width = clipWidth.value
  const height = clipHeight.value - 20
  const centerY = height / 2
  
  let path = `M 0 ${centerY}`
  const samples = Math.min(width / 2, 200) // 控制采样点数量
  
  for (let i = 1; i < samples; i++) {
    const x = (i / samples) * width
    const amplitude = Math.sin(i * 0.1) * Math.random() * 0.3 + 0.1
    const y = centerY + amplitude * centerY * (Math.random() > 0.5 ? 1 : -1)
    path += ` L ${x} ${y}`
  }
  
  return path
})

// 工具提示相关
const showTooltip = ref(false)
const tooltipPosition = ref({ x: 0, y: 0 })

function formatDurationFromFrames(frames: number): string {
  return framesToTimecode(frames)
}

onMounted(() => {
  console.log('TimelineAudioClip组件挂载完成:', props.timelineItem.id)
})
</script>

<style scoped>
/* TimelineAudioClip特有样式 */
.audio-clip {
  background: linear-gradient(135deg, #666666, #555555);
  color: white;
}

.audio-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 4px 8px;
}

.audio-waveform {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
}

.waveform-svg {
  width: 100%;
  height: 100%;
}

.audio-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  margin-top: 2px;
}

.audio-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60%;
}

.audio-duration {
  font-size: 10px;
  opacity: 0.9;
}

.audio-controls {
  position: absolute;
  top: 2px;
  right: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
}

.mute-indicator {
  color: #ff6b6b;
}

.volume-indicator {
  opacity: 0.8;
}

/* 选中状态的特殊样式 */
.audio-clip.selected {
  background: linear-gradient(135deg, var(--color-clip-selected), var(--color-clip-selected-dark)) !important;
}

/* 重叠状态的特殊样式 */
.audio-clip.overlapping {
  background: linear-gradient(135deg, var(--color-clip-overlapping), var(--color-clip-overlapping-dark)) !important;
}

/* 隐藏轨道上的clip样式 */
.audio-clip.track-hidden {
  background: linear-gradient(135deg, var(--color-clip-hidden), var(--color-clip-hidden-dark)) !important;
}

.audio-clip.track-hidden.selected {
  background: linear-gradient(135deg, var(--color-clip-hidden-selected), var(--color-clip-hidden-selected-dark)) !important;
}

/* 隐藏轨道上的clip内容也要调整透明度 */
.audio-clip.track-hidden .audio-content,
.audio-clip.track-hidden .audio-name,
.audio-clip.track-hidden .audio-duration,
.audio-clip.track-hidden .audio-controls {
  opacity: 0.8;
}
</style>

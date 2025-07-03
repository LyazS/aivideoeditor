<template>
  <BaseClip
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
      <!-- 音频信息显示区域 -->
      <div class="audio-content">
        <!-- 音频文件信息 -->
        <div class="audio-info">
          <div class="audio-name">{{ audioName }}</div>
          <div class="audio-duration">{{ formatDurationFromFrames(audioDuration) }}</div>
        </div>
        
        <!-- 音频状态指示器 -->
        <div class="audio-indicators">
          <!-- 音量指示器 -->
          <div v-if="!(timelineItem.config as AudioMediaConfig).isMuted" class="volume-indicator">
            <div class="volume-bar" :style="volumeBarStyle"></div>
          </div>

          <!-- 静音指示器 -->
          <div v-if="(timelineItem.config as AudioMediaConfig).isMuted" class="muted-indicator">
            🔇
          </div>
          
          <!-- 播放速度指示器 -->
          <div v-if="showSpeedIndicator" class="speed-indicator">
            {{ formatSpeed(playbackRate) }}
          </div>
          
          <!-- 效果指示器（预留） -->
          <div v-if="hasEffects" class="effects-indicator">
            ✨
          </div>
        </div>
      </div>
    </template>
  </BaseClip>
  
  <!-- Tooltip组件 -->
  <ClipTooltip
    :visible="baseClipRef?.showTooltipFlag || false"
    :title="audioLabel"
    :media-type="'audio'"
    :duration="formatDurationFromFrames(timelineDurationFrames)"
    :position="formatDurationFromFrames(props.timelineItem.timeRange.timelineStartTime)"
    :speed="formatSpeed(playbackRate)"
    :show-speed="showSpeedIndicator"
    :mouse-x="baseClipRef?.tooltipMouseX || 0"
    :mouse-y="baseClipRef?.tooltipMouseY || 0"
    :clip-top="baseClipRef?.tooltipClipTop || 0"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { framesToTimecode } from '../stores/utils/timeUtils'
import BaseClip from './BaseClip.vue'
import ClipTooltip from './ClipTooltip.vue'
import type { TimelineItem, Track, VideoTimeRange, AudioMediaConfig } from '../types'

interface Props {
  timelineItem: TimelineItem<'audio'>
  track?: Track
  timelineWidth: number
  totalDurationFrames: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'select': [itemId: string]
  'update-position': [timelineItemId: string, newPosition: number, newTrackId?: string]
  'remove': [timelineItemId: string]
}>()

const videoStore = useVideoStore()
const baseClipRef = ref<InstanceType<typeof BaseClip>>()

// 计算属性
const audioName = computed(() => {
  const mediaItem = videoStore.getMediaItem(props.timelineItem.mediaItemId)
  return mediaItem?.name || '音频文件'
})

const audioDuration = computed(() => {
  const timeRange = props.timelineItem.timeRange as VideoTimeRange
  return timeRange.timelineEndTime - timeRange.timelineStartTime
})

const timelineDurationFrames = computed(() => {
  const timeRange = props.timelineItem.timeRange as VideoTimeRange
  return timeRange.timelineEndTime - timeRange.timelineStartTime
})

const playbackRate = computed(() => {
  const timeRange = props.timelineItem.timeRange as VideoTimeRange
  return timeRange.playbackRate || 1
})

const volumeBarStyle = computed(() => ({
  width: `${(props.timelineItem.config as AudioMediaConfig).volume * 100}%`
}))

const showSpeedIndicator = computed(() => {
  return Math.abs(playbackRate.value - 1) > 0.001
})

const hasEffects = computed(() => {
  // 预留：检查是否有音频效果
  return false
})

const audioLabel = computed(() => {
  return audioName.value
})

// 工具函数
const formatDurationFromFrames = (frames: number): string => {
  return framesToTimecode(frames)
}

const formatSpeed = (speed: number): string => {
  return `${speed.toFixed(1)}x`
}
</script>

<style scoped>
.audio-clip {
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: white;
  min-height: 50px;
}

.audio-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  padding: 4px 8px;
}

.audio-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.audio-name {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.audio-duration {
  font-size: 9px;
  opacity: 0.8;
}

.audio-indicators {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.volume-indicator {
  width: 30px;
  height: 3px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 1px;
  overflow: hidden;
}

.volume-bar {
  height: 100%;
  background: #fff;
  transition: width 0.2s ease;
}

.muted-indicator,
.speed-indicator,
.effects-indicator {
  font-size: 10px;
  opacity: 0.9;
}

.speed-indicator {
  background: rgba(255, 255, 255, 0.2);
  padding: 1px 3px;
  border-radius: 2px;
  font-size: 8px;
}

/* 轨道隐藏时的样式 */
.audio-clip.track-hidden {
  opacity: 0.5;
}

/* 选中状态样式 */
.audio-clip.selected {
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.5);
}
</style>

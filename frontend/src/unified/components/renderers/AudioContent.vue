<!-- AudioContentTemplate.vue -->
<template>
  <div class="audio-content" :class="{ selected: isSelected }">
    <!-- 音频信息显示 -->
    <div class="audio-info">
      <div class="audio-name">{{ displayName }}</div>
      <div class="audio-duration">{{ formattedDuration }}</div>
    </div>

    <!-- 音频控制指示器 -->
    <div class="audio-controls">
      <!-- 静音指示器 -->
      <div v-if="isMuted" class="mute-indicator" style="color: #ff6b6b">🔇</div>
      <!-- 音量指示器 -->
      <div class="volume-indicator" style="opacity: 0.8">{{ volumePercent }}%</div>
    </div>

    <!-- 波形显示（如果有波形数据） -->
    <div v-if="showWaveform" class="waveform-container">
      <div 
        v-for="(bar, index) in waveformBars" 
        :key="index"
        class="waveform-bar"
        :style="{
          height: `${bar.height}%`,
          width: `${bar.width}%`,
        } as any"
      />
    </div>

    <!-- 音频覆盖层（简化信息时显示） -->
    <div v-else class="audio-overlay">
      <div class="audio-icon">🎵</div>
      <div class="time-display">
        <span class="time-text">{{ formattedDuration }}</span>
      </div>
      <div class="file-name">
        <span class="name-text">{{ shortName }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ContentTemplateProps } from '@/unified/types/clipRenderer'
import { getTimelineItemDisplayName } from '@/unified/utils/clipUtils'

const props = defineProps<ContentTemplateProps<'audio'>>()

// 计算属性
const displayName = computed(() => getTimelineItemDisplayName(props.data))

const shortName = computed(() => {
  const name = displayName.value
  return name.length > 15 ? name.substring(0, 15) + '...' : name
})

const formattedDuration = computed(() => {
  const durationFrames = props.data.timeRange.timelineEndTime - props.data.timeRange.timelineStartTime
  const seconds = durationFrames / 30 // 假设30fps

  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
})

const volume = computed(() => {
  // 从配置中获取音量设置
  return (props.data.config as any)?.volume || 1.0
})

const volumePercent = computed(() => Math.round(volume.value * 100))

const isMuted = computed(() => {
  // 从配置中获取静音设置
  return (props.data.config as any)?.isMuted || false
})

const showWaveform = computed(() => {
  const durationFrames = props.data.timeRange.timelineEndTime - props.data.timeRange.timelineStartTime
  const width = durationFrames * props.scale
  return width >= 150 // 宽度大于150px时显示波形
})

// 模拟波形数据（实际实现需要从store或管理器中获取）
const waveformBars = computed(() => {
  const barCount = 50
  const bars = []

  for (let i = 0; i < barCount; i++) {
    // 生成随机高度，模拟音频波形
    const height = Math.random() * 80 + 10 // 10-90%的高度
    bars.push({
      height,
      width: 100 / barCount
    })
  }

  return bars
})

</script>

<style scoped>
.audio-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 4px 8px;
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
  color: white;
}

.audio-duration {
  font-size: 10px;
  opacity: 0.9;
  color: white;
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

.waveform-container {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 20px;
  margin-top: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.waveform-bar {
  background: linear-gradient(to top, var(--color-audio-waveform), var(--color-audio-waveform-highlight));
  border-radius: 1px;
  transition: height 0.1s ease;
}

.audio-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.audio-icon {
  font-size: 16px;
  margin-bottom: 2px;
}

.time-display .time-text {
  font-size: 10px;
  color: white;
  font-weight: bold;
}

.file-name .name-text {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.8);
  max-width: 80px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
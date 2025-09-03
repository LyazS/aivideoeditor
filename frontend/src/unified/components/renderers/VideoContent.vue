<!-- VideoContentTemplate.vue -->
<template>
  <div class="video-content" :class="{ selected: isSelected }">
    <!-- 缩略图区域 -->
    <div v-if="showDetails" class="clip-thumbnail">
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        :alt="displayName"
        class="thumbnail-image"
      />
      <div v-else class="thumbnail-placeholder">
        <div class="loading-spinner"></div>
      </div>
    </div>

    <!-- 信息区域 -->
    <div class="clip-info" v-if="showDetails">
      <div class="clip-name">{{ displayName }}</div>
      <div class="clip-duration">{{ formattedDuration }}</div>
      <div v-if="hasSpeedAdjustment" class="clip-speed">{{ speedText }}</div>
    </div>

    <!-- 简化信息 -->
    <div v-else class="clip-simple">
      <div class="simple-duration">{{ formattedDuration }}</div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ContentTemplateProps } from '@/unified/types/clipRenderer'
import { getTimelineItemDisplayName } from '@/unified/utils/clipUtils'

const props = defineProps<ContentTemplateProps<'video' | 'image'>>()

// 计算属性 - 使用时间轴宽度和帧率来计算显示详细程度
const showDetails = computed(() => {
  const durationFrames = props.data.timeRange.timelineEndTime - props.data.timeRange.timelineStartTime
  // 使用固定阈值，后续可以根据需要调整为基于缩放级别的动态计算
  return durationFrames >= 30 // 大约1秒的片段显示详细信息
})

const displayName = computed(() => getTimelineItemDisplayName(props.data))

const thumbnailUrl = computed(() => {
  // 优先从runtime中获取缩略图URL
  if (props.data.runtime.thumbnailUrl) {
    return props.data.runtime.thumbnailUrl
  }

  // 兼容性检查
  const config = props.data.config as any
  if (config && config.thumbnailUrl) {
    return config.thumbnailUrl
  }

  // 兼容性检查：检查是否有直接的thumbnailUrl属性
  if ('thumbnailUrl' in props.data && (props.data as any).thumbnailUrl) {
    return (props.data as any).thumbnailUrl
  }

  return null
})

const formattedDuration = computed(() => {
  const durationFrames = props.data.timeRange.timelineEndTime - props.data.timeRange.timelineStartTime
  const fps = 30 // 假设30fps
  const totalSeconds = Math.floor(durationFrames / fps)
  const remainingFrames = durationFrames % fps

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${remainingFrames.toString().padStart(2, '0')}`
  } else {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${remainingFrames.toString().padStart(2, '0')}`
  }
})

const hasSpeedAdjustment = computed(() => {
  if (props.data.mediaType !== 'video') return false
  if (props.data.runtime.sprite && 'getPlaybackRate' in props.data.runtime.sprite) {
    try {
      const sprite = props.data.runtime.sprite as any
      const playbackRate = sprite.getPlaybackRate()
      return Math.abs(playbackRate - 1.0) > 0.01
    } catch (error) {
      console.warn(`获取播放速度失败: ${props.data.id}`, error)
      return false
    }
  }
  return false
})

const speedText = computed(() => {
  if (props.data.mediaType !== 'video') return '正常速度'
  if (props.data.runtime.sprite && 'getPlaybackRate' in props.data.runtime.sprite) {
    try {
      const sprite = props.data.runtime.sprite as any
      const playbackRate = sprite.getPlaybackRate()
      if (Math.abs(playbackRate - 1.0) <= 0.01) {
        return '正常速度'
      } else {
        return `${playbackRate.toFixed(1)}x`
      }
    } catch (error) {
      console.warn(`获取播放速度失败: ${props.data.id}`, error)
      return '正常速度'
    }
  }
  return '正常速度'
})
</script>

<style scoped>
/* 样式保持与现有渲染器一致 */
.video-content {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 4px 8px;
  overflow: hidden;
}

.clip-thumbnail {
  width: 50px;
  height: 32px;
  background-color: var(--color-bg-primary);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}

.thumbnail-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.3);
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid var(--color-text-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.clip-info {
  flex: 1;
  margin-left: 6px;
  min-width: 0;
}

.clip-name {
  font-size: 11px;
  font-weight: bold;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clip-duration {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 1px;
}

.clip-speed {
  font-size: 9px;
  color: var(--color-speed-indicator);
  margin-top: 1px;
  font-weight: bold;
}

.clip-simple {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.simple-duration {
  font-size: 10px;
  font-weight: bold;
  color: white;
  background-color: rgba(0, 0, 0, 0.3);
  padding: 2px 4px;
  border-radius: 2px;
  white-space: nowrap;
}

.clip-indicators {
  position: absolute;
  top: 2px;
  right: 2px;
  display: flex;
  gap: 2px;
}

.clip-indicator {
  font-size: 8px;
  color: var(--color-warning);
  background: rgba(0, 0, 0, 0.7);
  border-radius: 2px;
  padding: 1px 2px;
  line-height: 1;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
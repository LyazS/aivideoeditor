<!-- VideoContentTemplate.vue - 多缩略图版本 -->
<template>
  <div class="video-content" :class="{ selected: isSelected }">
    <!-- 多缩略图容器 -->
    <div class="multi-thumbnails-container">
      <div
        v-for="item in thumbnailLayout"
        :key="item.index"
        class="thumbnail-slot"
        :style="getThumbnailSlotStyle(item)"
      >
        <!-- 第一步实验：显示帧索引文本而非实际图片 -->
        <div class="thumbnail-frame-index" v-if="item.isVisible">
          {{ item.framePosition }}
        </div>
        <div v-else class="thumbnail-placeholder"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import type { ContentTemplateProps } from '@/unified/types/clipRenderer'
import { getTimelineItemDisplayName } from '@/unified/utils/clipUtils'
import { useUnifiedStore } from '@/unified/unifiedStore'
import {
  calculateThumbnailLayout,
  updateThumbnailVisibility,
  calculateViewportFrameRange,
  calculateClipWidthPixels,
} from '@/unified/utils/thumbnailAlgorithms'
import type { ThumbnailLayoutItem } from '@/unified/types/thumbnail'
import { THUMBNAIL_CONSTANTS } from '@/unified/constants/ThumbnailConstants'

const props = defineProps<ContentTemplateProps<'video' | 'image'>>()
const unifiedStore = useUnifiedStore()

// 缩略图布局数组
const thumbnailLayout = computed<ThumbnailLayoutItem[]>(() => {
  if (!props.data.timeRange) return []

  const clipTLStartFrame = props.data.timeRange.timelineStartTime
  const clipTLDurationFrames = props.data.timeRange.timelineEndTime - clipTLStartFrame
  const clipStartFrame = props.data.timeRange.clipStartTime
  const clipDurationFrames = props.data.timeRange.clipEndTime - clipStartFrame

  // 计算clip的像素宽度
  const clipWidthPixels = calculateClipWidthPixels(
    clipTLDurationFrames,
    props.timelineWidth,
    unifiedStore.totalDurationFrames,
    unifiedStore.zoomLevel,
  )

  // 计算视口帧范围
  const { startFrames: viewportStartFrame, endFrames: viewportEndFrame } =
    calculateViewportFrameRange(
      props.timelineWidth,
      unifiedStore.totalDurationFrames,
      unifiedStore.zoomLevel,
      unifiedStore.scrollOffset,
      unifiedStore.maxVisibleDurationFrames,
    )

  // 计算初始布局
  const layout = calculateThumbnailLayout(
    clipStartFrame,
    clipDurationFrames,
    clipWidthPixels,
    clipTLStartFrame,
    clipTLDurationFrames,
    THUMBNAIL_CONSTANTS.WIDTH, // 固定缩略图宽度
  )

  // 更新可见性
  return updateThumbnailVisibility(
    layout,
    clipTLStartFrame,
    clipTLDurationFrames,
    viewportStartFrame,
    viewportEndFrame,
  )
})

// 获取缩略图槽位样式
function getThumbnailSlotStyle(item: ThumbnailLayoutItem) {
  return {
    left: `${item.pixelPosition}px`,
    width: `${THUMBNAIL_CONSTANTS.WIDTH}px`,
    height: `${THUMBNAIL_CONSTANTS.HEIGHT}px`,
  }
}

// 监听视口变化，更新缩略图可见性
watch(
  [() => unifiedStore.scrollOffset, () => unifiedStore.zoomLevel, () => props.timelineWidth],
  () => {
    // 缩略图可见性会在computed中自动更新
  },
  { deep: true },
)

// 保持原有的计算属性（向后兼容）
const showDetails = computed(() => {
  const durationFrames =
    props.data.timeRange.timelineEndTime - props.data.timeRange.timelineStartTime
  return durationFrames >= 30
})

const displayName = computed(() => getTimelineItemDisplayName(props.data))

const formattedDuration = computed(() => {
  const durationFrames =
    props.data.timeRange.timelineEndTime - props.data.timeRange.timelineStartTime
  const fps = 30
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

// 生命周期钩子
onMounted(() => {
  console.log('🎬 VideoContent mounted with multi-thumbnail support')
})

onUnmounted(() => {
  console.log('🧹 VideoContent unmounted')
})
</script>

<style scoped>
/* 多缩略图容器样式 */
.multi-thumbnails-container {
  position: relative;
  width: 100%;
  height: 30px;
  overflow: hidden;
}

.thumbnail-slot {
  position: absolute;
  width: 50px;
  height: 30px;
  top: 0;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.3);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.thumbnail-slot:last-child {
  border-right: none;
}

.thumbnail-frame-index {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: bold;
  color: white;
  background-color: rgba(0, 0, 0, 0.5);
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.514);
}

/* 保持原有样式（向后兼容） */
.video-content {
  display: flex;
  align-items: center;
  height: 100%;
  overflow: hidden;
}

.overlay-info {
  position: absolute;
  top: 4px;
  left: 8px;
  right: 8px;
  pointer-events: none;
  z-index: 10;
}

.clip-name {
  font-size: 11px;
  font-weight: bold;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.clip-duration {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.8);
}

.clip-speed {
  font-size: 9px;
  color: var(--color-speed-indicator);
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

/* 选中状态样式 */
.video-content.selected {
  outline: 2px solid var(--color-clip-selected);
  outline-offset: -2px;
}

.video-content.selected .multi-thumbnails-container {
  opacity: 0.9;
}
</style>

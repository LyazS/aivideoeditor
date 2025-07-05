<template>
  <TimelineBaseClip
    ref="baseClipRef"
    :timeline-item="timelineItem"
    :track="track"
    :timeline-width="timelineWidth"
    :total-duration-frames="totalDurationFrames"
    class="video-clip"
    :class="{
      [`video-clip--${mediaItem?.mediaType}`]: mediaItem?.mediaType,
    }"
    @select="$emit('select', $event)"
    @update-position="(timelineItemId, newPosition, newTrackId) => $emit('update-position', timelineItemId, newPosition, newTrackId)"
    @remove="$emit('remove', $event)"
  >
    <template #content="{ timelineItem }">
      <!-- 缩略图容器 - 只在showDetails时显示 -->
      <div v-if="showDetails" class="clip-thumbnail">
        <!-- 显示已生成的缩略图 -->
        <img
          v-if="timelineItem.thumbnailUrl"
          :src="timelineItem.thumbnailUrl"
          class="thumbnail-image"
          alt="缩略图"
        />
        <!-- 缩略图加载中的占位符 -->
        <div v-else class="thumbnail-placeholder">
          <div class="loading-spinner"></div>
        </div>
      </div>

      <!-- 详细信息 - 只在片段足够宽时显示 -->
      <div v-if="showDetails" class="clip-info">
        <div class="clip-name">{{ mediaItem?.name || 'Unknown' }}</div>
        <!-- 时长信息 - 视频和图片都显示（时间码格式） -->
        <div class="clip-duration">{{ formatDurationFromFrames(timelineDurationFrames) }}</div>
        <!-- 倍速信息 - 只有视频显示 -->
        <div
          class="clip-speed"
          v-if="mediaItem?.mediaType === 'video' && Math.abs(playbackSpeed - 1) > 0.001"
        >
          {{ formatSpeed(playbackSpeed) }}
        </div>
      </div>

      <!-- 简化显示 - 片段较窄时只显示时长（时间码格式） -->
      <div v-if="!showDetails" class="clip-simple">
        <div class="simple-duration">{{ formatDurationFromFrames(timelineDurationFrames) }}</div>
      </div>

      <!-- 关键帧标记 -->
      <div v-if="hasKeyframes" class="keyframes-container">
        <div
          v-for="keyframe in visibleKeyframes"
          :key="keyframe.framePosition"
          class="keyframe-marker"
          :style="{ left: keyframe.pixelPosition - 6.5 + 'px', transform: 'translateY(-50%)' }"
          :title="`关键帧 - 帧 ${keyframe.absoluteFrame} (点击跳转)`"
          @click.stop="jumpToKeyframe(keyframe.absoluteFrame)"
        >
          <div class="keyframe-diamond"></div>
        </div>
      </div>
    </template>
  </TimelineBaseClip>

  <!-- Tooltip组件 -->
  <ClipTooltip
    :visible="baseClipRef?.showTooltipFlag || false"
    :title="mediaItem?.name || 'Unknown'"
    :media-type="mediaItem?.mediaType || 'video'"
    :duration="formatDurationFromFrames(timelineDurationFrames)"
    :position="formatDurationFromFrames(props.timelineItem.timeRange.timelineStartTime)"
    :speed="formatSpeed(playbackSpeed)"
    :show-speed="mediaItem?.mediaType === 'video' && Math.abs(playbackSpeed - 1) > 0.001"
    :mouse-x="baseClipRef?.tooltipMouseX || 0"
    :mouse-y="baseClipRef?.tooltipMouseY || 0"
    :clip-top="baseClipRef?.tooltipClipTop || 0"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { useWebAVControls } from '../composables/useWebAVControls'
import { usePlaybackControls } from '../composables/usePlaybackControls'
import { regenerateThumbnailForTimelineItem } from '../utils/thumbnailGenerator'
import TimelineBaseClip from './TimelineBaseClip.vue'
import ClipTooltip from './ClipTooltip.vue'

import { framesToTimecode } from '../stores/utils/timeUtils'
import { relativeFrameToAbsoluteFrame } from '../utils/unifiedKeyframeUtils'
import type { TimelineItem, Track } from '../types'

interface Props {
  timelineItem: TimelineItem
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
const webAVControls = useWebAVControls()
const { pauseForEditing } = usePlaybackControls()

// TimelineBaseClip组件引用
const baseClipRef = ref<InstanceType<typeof TimelineBaseClip>>()

// 获取对应的MediaItem
const mediaItem = computed(() => {
  return videoStore.getMediaItem(props.timelineItem.mediaItemId)
})

// 获取时间轴时长（帧数）
const timelineDurationFrames = computed(() => {
  const timeRange = props.timelineItem.timeRange
  return timeRange.timelineEndTime - timeRange.timelineStartTime
})

// 获取播放速度（仅对视频有效）
const playbackSpeed = computed(() => {
  // 图片没有播放速度概念，直接返回1
  if (mediaItem.value?.mediaType === 'image') {
    return 1
  }
  // 直接从timelineItem.timeRange获取
  const timeRange = props.timelineItem.timeRange
  return 'playbackRate' in timeRange ? timeRange.playbackRate || 1 : 1
})

// 判断是否应该显示详细信息（当片段足够宽时）
const showDetails = computed(() => {
  const timeRange = props.timelineItem.timeRange
  const positionFrames = timeRange.timelineStartTime
  const durationFrames = timeRange.timelineEndTime - timeRange.timelineStartTime

  const endFrames = positionFrames + durationFrames
  const left = videoStore.frameToPixel(positionFrames, props.timelineWidth)
  const right = videoStore.frameToPixel(endFrames, props.timelineWidth)
  const width = right - left
  return width >= 100 // 宽度大于100px时显示详细信息
})

// 关键帧相关计算
const hasKeyframes = computed(() => {
  return !!(
    props.timelineItem.animation &&
    props.timelineItem.animation.isEnabled &&
    props.timelineItem.animation.keyframes.length > 0
  )
})

// 计算在clip上可见的关键帧
const visibleKeyframes = computed(() => {
  if (!hasKeyframes.value) return []

  const keyframes = props.timelineItem.animation!.keyframes
  const timeRange = props.timelineItem.timeRange
  const clipStartFrame = timeRange.timelineStartTime
  const clipEndFrame = timeRange.timelineEndTime

  // 计算clip在时间轴上的像素位置和宽度
  const clipLeft = videoStore.frameToPixel(clipStartFrame, props.timelineWidth)
  const clipRight = videoStore.frameToPixel(clipEndFrame, props.timelineWidth)
  const clipWidth = clipRight - clipLeft

  return keyframes
    .map((keyframe) => {
      // 将相对帧数转换为绝对帧数
      const absoluteFrame = relativeFrameToAbsoluteFrame(keyframe.framePosition, timeRange)

      // 计算关键帧在整个时间轴上的像素位置
      const absolutePixelPosition = videoStore.frameToPixel(absoluteFrame, props.timelineWidth)

      // 关键帧标记应该使用相对于clip容器的位置
      // 但是要考虑到clip容器本身在时间轴上的偏移
      const relativePixelPosition = absolutePixelPosition - clipLeft

      return {
        framePosition: keyframe.framePosition,
        absoluteFrame,
        pixelPosition: relativePixelPosition,
        isVisible: relativePixelPosition >= 0 && relativePixelPosition <= clipWidth,
      }
    })
    .filter((kf) => kf.isVisible)
})

function formatDurationFromFrames(frames: number): string {
  // 直接使用帧数格式化为时间码
  return framesToTimecode(frames)
}

function formatSpeed(rate: number): string {
  // 使用容差来处理浮点数精度问题，避免显示1.00x快速
  const tolerance = 0.001

  if (rate > 1 + tolerance) {
    return `${rate.toFixed(1)}x 快速`
  } else if (rate < 1 - tolerance) {
    return `${rate.toFixed(1)}x 慢速`
  }
  return '正常速度'
}

// ==================== 关键帧交互 ====================

/**
 * 跳转到指定关键帧
 */
function jumpToKeyframe(absoluteFrame: number) {
  // 暂停播放以便进行时间跳转
  pauseForEditing('关键帧跳转')

  // 通过WebAV控制器跳转到指定帧
  webAVControls.seekTo(absoluteFrame)

  console.log('🎯 [关键帧跳转] 跳转到关键帧:', {
    itemId: props.timelineItem.id,
    targetFrame: absoluteFrame,
    timecode: framesToTimecode(absoluteFrame),
  })
}









/**
 * 调整大小后重新生成缩略图
 */
async function regenerateThumbnailAfterResize() {
  const mediaItem = videoStore.getMediaItem(props.timelineItem.mediaItemId)
  if (!mediaItem) {
    console.error('❌ 无法找到对应的MediaItem，跳过缩略图重新生成')
    return
  }

  try {
    console.log('🔄 开始重新生成调整大小后的缩略图...')
    const newThumbnailUrl = await regenerateThumbnailForTimelineItem(props.timelineItem, mediaItem)

    if (newThumbnailUrl) {
      // 清理旧的缩略图URL
      if (props.timelineItem.thumbnailUrl) {
        URL.revokeObjectURL(props.timelineItem.thumbnailUrl)
      }

      // 更新缩略图URL
      // eslint-disable-next-line vue/no-mutating-props
      props.timelineItem.thumbnailUrl = newThumbnailUrl
      console.log('✅ 缩略图重新生成完成')
    }
  } catch (error) {
    console.error('❌ 重新生成缩略图失败:', error)
  }
}

onMounted(() => {
  // TimelineVideoClip组件挂载完成
  console.log('TimelineVideoClip组件挂载完成:', props.timelineItem.id)
})
</script>

<style scoped>
/* TimelineVideoClip特有样式 - 基于TimelineBaseClip */
.video-clip {
  /* 视频/图片clip的背景色 - 统一灰色 */
  background: linear-gradient(135deg, #666666, #555555);
}

/* 图片片段使用与视频相同的背景色 */
.video-clip--image {
  background: linear-gradient(135deg, #666666, #555555);
}

/* 重叠状态的特殊样式 */
.video-clip.overlapping {
  background: linear-gradient(135deg, var(--color-clip-overlapping), var(--color-clip-overlapping-dark)) !important;
}

/* 选中状态的特殊样式 */
.video-clip.selected {
  background: linear-gradient(135deg, var(--color-clip-selected), var(--color-clip-selected-dark)) !important;
}

/* 隐藏轨道上的clip样式 */
.video-clip.track-hidden {
  background: linear-gradient(135deg, var(--color-clip-hidden), var(--color-clip-hidden-dark)) !important;
}

.video-clip.track-hidden.selected {
  background: linear-gradient(135deg, var(--color-clip-hidden-selected), var(--color-clip-hidden-selected-dark)) !important;
}

/* 隐藏轨道上的clip内容也要调整透明度 */
.video-clip.track-hidden .clip-name,
.video-clip.track-hidden .clip-duration,
.video-clip.track-hidden .clip-speed,
.video-clip.track-hidden .simple-duration {
  opacity: 0.8;
}

/* TimelineVideoClip内容样式 */

.clip-thumbnail {
  width: 50px; /* 压缩缩略图宽度 */
  height: 32px; /* 压缩缩略图高度 */
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

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.clip-info {
  flex: 1;
  margin-left: 6px; /* 压缩左边距 */
  min-width: 0;
}

.clip-name {
  font-size: 11px; /* 稍微减小字体 */
  font-weight: bold;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clip-duration {
  font-size: 9px; /* 减小时长文字 */
  color: rgba(255, 255, 255, 0.8);
  margin-top: 1px; /* 减小上边距 */
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



/* 关键帧标记样式 */
.keyframes-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none; /* 不阻挡clip的交互 */
  z-index: 8; /* 在调整手柄之上 */
}

.keyframe-marker {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  z-index: 10; /* 在调整手柄之上，确保关键帧标记可见性最高 */
  pointer-events: auto; /* 允许点击 */
  cursor: pointer;
}

.keyframe-diamond {
  width: 10px;
  height: 10px;
  background-color: var(--color-keyframe-primary);
  border: 2px solid var(--color-text-primary);
  border-radius: 2px;
  transform: rotate(45deg);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  transition: all 0.2s ease;
}

.keyframe-marker:hover .keyframe-diamond {
  background-color: var(--color-keyframe-hover);
  transform: rotate(45deg) scale(1.3);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5);
  border-color: var(--color-text-primary);
}

.keyframe-marker:active .keyframe-diamond {
  background-color: var(--color-keyframe-active);
  transform: rotate(45deg) scale(1.1);
}
</style>

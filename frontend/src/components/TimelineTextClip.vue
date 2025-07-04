<template>
  <BaseClip
    ref="baseClipRef"
    :timeline-item="timelineItem"
    :track="track"
    :timeline-width="timelineWidth"
    :total-duration-frames="totalDurationFrames"
    class="text-clip"
    @select="$emit('select', $event)"
    @update-position="(timelineItemId, newPosition, newTrackId) => $emit('update-position', timelineItemId, newPosition, newTrackId)"
    @remove="$emit('remove', $event)"
  >
    <template #content="{ timelineItem }">
      <!-- 文本内容显示区域 -->
      <div class="text-content">
        <!-- 文本预览 -->
        <div class="text-preview">
          <span class="text-preview-content" :style="textPreviewStyle">
            {{ textPreview }}
          </span>
        </div>
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
  </BaseClip>

  <!-- Tooltip组件 -->
  <ClipTooltip
    :visible="baseClipRef?.showTooltipFlag || false"
    :title="textLabel"
    :media-type="'text'"
    :duration="formatDurationFromFrames(timelineDurationFrames)"
    :position="formatDurationFromFrames(props.timelineItem.timeRange.timelineStartTime)"
    :show-speed="false"
    :mouse-x="baseClipRef?.tooltipMouseX || 0"
    :mouse-y="baseClipRef?.tooltipMouseY || 0"
    :clip-top="baseClipRef?.tooltipClipTop || 0"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { framesToTimecode } from '../stores/utils/timeUtils'
import { relativeFrameToAbsoluteFrame } from '../utils/unifiedKeyframeUtils'
import { useWebAVControls } from '../composables/useWebAVControls'
import { usePlaybackControls } from '../composables/usePlaybackControls'
import BaseClip from './BaseClip.vue'
import ClipTooltip from './ClipTooltip.vue'
import type { TimelineItem, Track } from '../types'
import { getTextItemDisplayName } from '../utils/textTimelineUtils'

interface Props {
  timelineItem: TimelineItem<'text'>
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

// WebAV控制器
const webAVControls = useWebAVControls()
const { pauseForEditing } = usePlaybackControls()

// BaseClip组件引用
const baseClipRef = ref<InstanceType<typeof BaseClip>>()

// 获取时间轴时长（帧数）
const timelineDurationFrames = computed(() => {
  const timeRange = props.timelineItem.timeRange
  return timeRange.timelineEndTime - timeRange.timelineStartTime
})

// 文本预览内容
const textPreview = computed(() => {
  const text = props.timelineItem.config.text || ''
  // 根据clip宽度动态调整显示长度
  const maxLength = Math.max(8, Math.floor(timelineDurationFrames.value / 10))
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
})

// 文本标签（用于tooltip和标识）
const textLabel = computed(() => {
  return getTextItemDisplayName(props.timelineItem, 15)
})

// 文本预览样式 - 只显示纯白色文本，不应用渲染样式
const textPreviewStyle = computed(() => {
  return {
    fontSize: '11px', // 固定小字体用于预览
    color: '#ffffff', // 固定白色
    fontWeight: 'normal', // 固定正常字重
    fontStyle: 'normal', // 固定正常样式
    fontFamily: 'Arial, sans-serif', // 固定字体
  }
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
    .filter((keyframe) => keyframe.isVisible)
})

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

// 格式化时长显示
function formatDurationFromFrames(frames: number): string {
  return framesToTimecode(frames)
}
</script>

<style scoped>
/* TimelineTextClip专用样式 */
.text-clip {
  /* 未选中状态：与视频clip保持一致 */
  background: linear-gradient(135deg, var(--color-clip-primary), var(--color-clip-primary-dark));
  border: 2px solid transparent;
}

.text-clip:hover {
  /* 悬停状态：稍微亮一点的蓝色 */
  background: linear-gradient(135deg, #5ba3f0, var(--color-clip-primary));
}

.text-clip.selected {
  /* 选中状态：保持现在的绿色背景和绿色边框 */
  background: linear-gradient(135deg, #4CAF50, #45a049);
  border-color: #4CAF50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.3);
}

/* 文本内容区域 */
.text-content {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 4px 8px;
  overflow: hidden;
}

/* 文本预览 */
.text-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.text-preview-content {
  display: block;
  text-align: center;
  line-height: 1.2;
  word-break: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}



/* 重叠时的样式 */
.text-clip.overlapping {
  background: linear-gradient(135deg, var(--color-clip-overlapping), var(--color-clip-overlapping-dark)) !important;
}

/* 轨道隐藏时的样式 */
.text-clip.track-hidden {
  background: linear-gradient(135deg, var(--color-clip-hidden), var(--color-clip-hidden-dark)) !important;
}

.text-clip.track-hidden.selected {
  background: linear-gradient(135deg, var(--color-clip-hidden-selected), var(--color-clip-hidden-selected-dark)) !important;
}

/* 隐藏轨道上的文本内容也要调整透明度 */
.text-clip.track-hidden .text-preview {
  opacity: 0.8;
}

/* 拖拽状态样式 */
.text-clip.dragging {
  opacity: 0.8;
  transform: scale(0.98);
  z-index: 1000;
}

/* 调整大小状态样式 */
.text-clip.resizing {
  border-color: var(--color-primary);
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

/* 响应式调整 */
@media (max-width: 768px) {
  .text-content {
    padding: 2px 4px;
  }

  .text-preview-content {
    font-size: 10px;
  }
}
</style>

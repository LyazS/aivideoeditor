<template>
  <div
    class="video-clip"
    :class="{
      overlapping: isOverlapping,
      selected: isSelected,
      dragging: isDragging,
      resizing: isResizing,
      'track-hidden': !isTrackVisible,
    }"
    :style="clipStyle"
    :data-media-type="mediaItem?.mediaType"
    :data-timeline-item-id="timelineItem.id"
    :draggable="true"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @click="selectClip"
    @mouseenter="showTooltip"
    @mousemove="updateTooltipPosition"
    @mouseleave="hideTooltip"
  >
    <div class="clip-content">
      <!-- 缩略图容器 - 只在showDetails时显示 -->
      <div v-if="showDetails" class="clip-thumbnail">
        <!-- 显示已生成的缩略图 -->
        <img
          v-if="props.timelineItem.thumbnailUrl"
          :src="props.timelineItem.thumbnailUrl"
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
          :style="{ left: keyframe.pixelPosition - 10.0 + 'px', transform: 'translateY(-50%)' }"
          :title="`关键帧 - 帧 ${keyframe.absoluteFrame} (点击跳转)`"
          @click.stop="jumpToKeyframe(keyframe.absoluteFrame)"
        >
          <div class="keyframe-diamond"></div>
        </div>
      </div>

      <!-- 调整手柄 -->
      <div class="resize-handle left" @mousedown.stop="startResize('left', $event)"></div>
      <div class="resize-handle right" @mousedown.stop="startResize('right', $event)"></div>
    </div>
  </div>

  <!-- Tooltip组件 -->
  <ClipTooltip
    :visible="showTooltipFlag"
    :title="mediaItem?.name || 'Unknown'"
    :media-type="mediaItem?.mediaType || 'video'"
    :duration="formatDurationFromFrames(timelineDurationFrames)"
    :position="formatDurationFromFrames(props.timelineItem.timeRange.timelineStartTime)"
    :speed="formatSpeed(playbackSpeed)"
    :show-speed="mediaItem?.mediaType === 'video' && Math.abs(playbackSpeed - 1) > 0.001"
    :mouse-x="tooltipMouseX"
    :mouse-y="tooltipMouseY"
    :clip-top="tooltipClipTop"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { useWebAVControls } from '../composables/useWebAVControls'
import { regenerateThumbnailForTimelineItem } from '../utils/thumbnailGenerator'
import { useDragUtils } from '../composables/useDragUtils'
import { usePlaybackControls } from '../composables/usePlaybackControls'
import { getDragPreviewManager } from '../composables/useDragPreview'
import ClipTooltip from './ClipTooltip.vue'

import { framesToTimecode, alignFramesToFrame } from '../stores/utils/timeUtils'
import { hasOverlapInTrack } from '../utils/timeOverlapUtils'
import { relativeFrameToAbsoluteFrame } from '../utils/unifiedKeyframeUtils'
import type { TimelineItem, Track, VideoTimeRange, ImageTimeRange } from '../types'
import { isVideoTimeRange } from '../types'

interface Props {
  timelineItem: TimelineItem
  track?: Track
  timelineWidth: number
  totalDurationFrames: number
}

interface Emits {
  (e: 'update-position', timelineItemId: string, newPosition: number, newTrackId?: number): void
  (e: 'remove', timelineItemId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const videoStore = useVideoStore()
const webAVControls = useWebAVControls()
const dragUtils = useDragUtils()
const { pauseForEditing } = usePlaybackControls()
const dragPreviewManager = getDragPreviewManager()

// 获取对应的MediaItem
const mediaItem = computed(() => {
  return videoStore.getMediaItem(props.timelineItem.mediaItemId)
})

// 获取时间轴时长（帧数）
const timelineDurationFrames = computed(() => {
  const timeRange = props.timelineItem.timeRange
  return timeRange.timelineEndTime - timeRange.timelineStartTime // 已经是帧数，不需要转换
})

// 获取播放速度（仅对视频有效）
const playbackSpeed = computed(() => {
  // 图片没有播放速度概念，直接返回1
  if (mediaItem.value?.mediaType === 'image') {
    return 1
  }
  // 直接从timelineItem.timeRange获取，与videostore的同步机制保持一致
  // 使用类型守卫确保timeRange有playbackRate属性（只有TimeRange接口有，ImageTimeRange没有）
  const timeRange = props.timelineItem.timeRange
  return 'playbackRate' in timeRange ? timeRange.playbackRate || 1 : 1
})

// Tooltip相关状态
const showTooltipFlag = ref(false)
const tooltipMouseX = ref(0)
const tooltipMouseY = ref(0)
const tooltipClipTop = ref(0)

const isDragging = ref(false) // 保留用于原生拖拽状态
const isResizing = ref(false)
const resizeDirection = ref<'left' | 'right' | null>(null)
const resizeStartX = ref(0)
// 调整大小相关变量（帧数）
const resizeStartDurationFrames = ref(0)
const resizeStartPositionFrames = ref(0)
const tempDurationFrames = ref(0) // 临时时长（帧数）
const tempResizePositionFrames = ref(0) // 临时调整位置（帧数）

// 计算片段样式
const clipStyle = computed(() => {
  const videoStore = useVideoStore()
  const timeRange = props.timelineItem.timeRange

  // 在调整大小时使用临时值，否则使用实际值（帧数）
  const positionFrames = isResizing.value
    ? tempResizePositionFrames.value
    : timeRange.timelineStartTime // 已经是帧数，不需要转换
  const durationFrames = isResizing.value
    ? tempDurationFrames.value
    : timeRange.timelineEndTime - timeRange.timelineStartTime // 已经是帧数，不需要转换

  const left = videoStore.frameToPixel(positionFrames, props.timelineWidth)
  const endFrames = positionFrames + durationFrames
  const right = videoStore.frameToPixel(endFrames, props.timelineWidth)
  const width = right - left

  return {
    left: `${left}px`,
    width: `${Math.max(width, 20)}px`, // 最小宽度20px，确保可见但不影响时间准确性
    top: '10px', // 相对于轨道的顶部间距
    height: '60px', // 片段高度
    position: 'absolute' as const,
  }
})

// 判断是否应该显示详细信息（当片段足够宽时）
const showDetails = computed(() => {
  const timeRange = props.timelineItem.timeRange

  // 在调整大小时使用临时值，否则使用实际值（帧数）
  const positionFrames = isResizing.value
    ? tempResizePositionFrames.value
    : timeRange.timelineStartTime // 已经是帧数，不需要转换
  const durationFrames = isResizing.value
    ? tempDurationFrames.value
    : timeRange.timelineEndTime - timeRange.timelineStartTime // 已经是帧数，不需要转换

  const endFrames = positionFrames + durationFrames
  const left = videoStore.frameToPixel(positionFrames, props.timelineWidth)
  const right = videoStore.frameToPixel(endFrames, props.timelineWidth)
  const width = right - left
  return width >= 100 // 宽度大于100px时显示详细信息
})

// 检查当前时间轴项目是否与同轨道的其他项目重叠
const isOverlapping = computed(() => {
  const currentItem = props.timelineItem
  const trackItems = videoStore.getTimelineItemsForTrack(currentItem.trackId)

  // 使用统一的重叠检测工具
  return hasOverlapInTrack(currentItem, trackItems)
})

// 统一的选择状态计算
const isSelected = computed(() => {
  return videoStore.selectedTimelineItemIds.has(props.timelineItem.id)
})

// 检查轨道是否可见
const isTrackVisible = computed(() => {
  const track = videoStore.getTrack(props.timelineItem.trackId)
  return track ? track.isVisible : true
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

// ==================== 原生拖拽API事件处理 ====================

function handleDragStart(event: DragEvent) {
  console.log('🎯 [原生拖拽] dragstart事件触发:', props.timelineItem.id)

  // 检查是否应该启动拖拽
  if (event.ctrlKey) {
    // Ctrl+拖拽暂时禁用，避免与多选冲突
    console.log('🚫 [原生拖拽] Ctrl+拖拽被禁用')
    event.preventDefault()
    return
  }

  // 暂停播放并处理拖拽
  pauseForEditing('时间轴项目拖拽')
  hideTooltip()
  dragUtils.ensureItemSelected(props.timelineItem.id)

  // 设置拖拽数据
  const dragOffset = { x: event.offsetX, y: event.offsetY }
  const dragData = dragUtils.setTimelineItemDragData(
    event,
    props.timelineItem.id,
    props.timelineItem.trackId,
    props.timelineItem.timeRange.timelineStartTime, // 直接使用帧数，不需要转换
    Array.from(videoStore.selectedTimelineItemIds),
    dragOffset,
  )

  console.log('📦 [原生拖拽] 设置拖拽数据:', dragData)

  // 创建简单的拖拽预览图像（浏览器原生预览）
  const dragImage = createSimpleDragPreview()
  event.dataTransfer!.setDragImage(dragImage, dragOffset.x, dragOffset.y)

  // 设置拖拽状态
  isDragging.value = true
}

function handleDragEnd(event: DragEvent) {
  console.log('🏁 [原生拖拽] dragend事件触发:', props.timelineItem.id)

  // 清理拖拽状态
  isDragging.value = false

  // 使用统一的拖拽工具清理数据
  dragUtils.clearDragData()

  // 移除拖拽预览元素（如果还存在）
  removeSimpleDragPreview()
}

/**
 * 创建简单的拖拽预览图像（用于浏览器原生拖拽）
 * 真正的拖拽预览由Timeline组件的dragPreviewManager处理
 */
function createSimpleDragPreview(): HTMLElement {
  const selectedCount = videoStore.selectedTimelineItemIds.size
  const preview = document.createElement('div')

  preview.className = 'simple-drag-preview'

  // 获取当前clip的实际尺寸
  const clipElement = dragUtils.getTimelineItemElement(props.timelineItem.id)
  const { width: clipWidth, height: clipHeight } = dragUtils.getElementDimensions(clipElement)

  // 简单的预览样式 - 使用与实际clip相同的尺寸
  preview.style.cssText = `
    position: fixed;
    top: -1000px;
    left: -1000px;
    width: ${clipWidth}px;
    height: ${clipHeight}px;
    background: rgba(255, 107, 53, 0.8);
    border: 1px solid #ff6b35;
    border-radius: 4px;
    pointer-events: none;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 10px;
    font-weight: bold;
  `

  // 简单的文本内容
  if (selectedCount > 1) {
    preview.textContent = `${selectedCount} 项目`
  } else {
    const clipName = mediaItem.value?.name || 'Clip'
    preview.textContent = clipName.length > 8 ? clipName.substring(0, 6) + '..' : clipName
  }

  document.body.appendChild(preview)

  // 设置清理定时器
  setTimeout(() => {
    removeSimpleDragPreview()
  }, 100)

  return preview
}

function removeSimpleDragPreview() {
  const preview = document.querySelector('.simple-drag-preview')
  if (preview && document.body.contains(preview)) {
    document.body.removeChild(preview)
  }
}

// ==================== 点击选择事件处理 ====================

async function selectClip(event: MouseEvent) {
  // 如果正在拖拽或调整大小，不处理选中
  if (isDragging.value || isResizing.value) return

  console.log('🖱️ selectClip被调用:', {
    ctrlKey: event.ctrlKey,
    itemId: props.timelineItem.id,
    currentSelections: Array.from(videoStore.selectedTimelineItemIds),
  })

  try {
    if (event.ctrlKey) {
      // Ctrl+点击：切换选择状态（带历史记录）
      console.log('🔄 执行toggle选择（带历史记录）')
      await videoStore.selectTimelineItemsWithHistory([props.timelineItem.id], 'toggle')
    } else {
      // 普通点击：替换选择（带历史记录）
      console.log('🔄 执行replace选择（带历史记录）')
      await videoStore.selectTimelineItemsWithHistory([props.timelineItem.id], 'replace')
    }
  } catch (error) {
    console.error('❌ 选择操作失败:', error)
    // 如果历史记录选择失败，回退到普通选择
    if (event.ctrlKey) {
      videoStore.selectTimelineItems([props.timelineItem.id], 'toggle')
    } else {
      videoStore.selectTimelineItems([props.timelineItem.id], 'replace')
    }
  }

  event.stopPropagation()
}

function startResize(direction: 'left' | 'right', event: MouseEvent) {
  // 暂停播放以便进行编辑
  pauseForEditing('片段大小调整')

  // 隐藏tooltip
  hideTooltip()

  isResizing.value = true
  resizeDirection.value = direction
  resizeStartX.value = event.clientX

  const timeRange = props.timelineItem.timeRange

  // 使用帧数进行精确计算
  resizeStartDurationFrames.value = timeRange.timelineEndTime - timeRange.timelineStartTime // 已经是帧数，不需要转换
  resizeStartPositionFrames.value = timeRange.timelineStartTime // 已经是帧数，不需要转换

  // 初始化临时值
  tempDurationFrames.value = resizeStartDurationFrames.value
  tempResizePositionFrames.value = resizeStartPositionFrames.value

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)

  event.preventDefault()
}

function handleResize(event: MouseEvent) {
  if (!isResizing.value || !resizeDirection.value) return

  const deltaX = event.clientX - resizeStartX.value
  const mediaItem = videoStore.getMediaItem(props.timelineItem.mediaItemId)

  if (!mediaItem) return

  // 使用帧数进行精确计算
  let newDurationFrames = resizeStartDurationFrames.value
  let newTimelinePositionFrames = resizeStartPositionFrames.value

  if (resizeDirection.value === 'left') {
    // 拖拽左边把柄：调整开始时间和时长
    const currentLeftPixel = videoStore.frameToPixel(
      resizeStartPositionFrames.value,
      props.timelineWidth,
    )
    const newLeftPixel = currentLeftPixel + deltaX
    const newLeftFrames = videoStore.pixelToFrame(newLeftPixel, props.timelineWidth)

    newTimelinePositionFrames = Math.max(0, alignFramesToFrame(newLeftFrames))
    newDurationFrames =
      resizeStartDurationFrames.value +
      (resizeStartPositionFrames.value - newTimelinePositionFrames)
  } else if (resizeDirection.value === 'right') {
    // 拖拽右边把柄：只调整时长
    const endFrames = resizeStartPositionFrames.value + resizeStartDurationFrames.value
    const currentRightPixel = videoStore.frameToPixel(endFrames, props.timelineWidth)
    const newRightPixel = currentRightPixel + deltaX
    const newRightFrames = videoStore.pixelToFrame(newRightPixel, props.timelineWidth)

    newDurationFrames = alignFramesToFrame(newRightFrames) - resizeStartPositionFrames.value
  }

  // 确保最小时长（1帧）和最大时长（原始素材时长的10倍）
  const minDurationFrames = 1
  const maxDurationFrames = mediaItem.duration * 10 // mediaItem.duration 已经是帧数，直接使用
  newDurationFrames = Math.max(minDurationFrames, Math.min(newDurationFrames, maxDurationFrames))

  // 更新临时值（帧数）
  tempDurationFrames.value = newDurationFrames
  tempResizePositionFrames.value = newTimelinePositionFrames
}

async function stopResize() {
  if (isResizing.value) {
    const mediaItem = videoStore.getMediaItem(props.timelineItem.mediaItemId)

    if (mediaItem) {
      // 使用帧数计算新的时间范围（更精确）
      const newTimelineStartTimeFrames = tempResizePositionFrames.value
      const newTimelineEndTimeFrames = tempResizePositionFrames.value + tempDurationFrames.value

      // 验证时间范围的有效性
      if (newTimelineEndTimeFrames <= newTimelineStartTimeFrames) {
        console.error('❌ 无效的时间范围:', {
          startFrames: newTimelineStartTimeFrames,
          endFrames: newTimelineEndTimeFrames,
          durationFrames: tempDurationFrames.value,
          positionFrames: tempResizePositionFrames.value,
        })
        return
      }

      console.log('🔧 调整大小 - 设置时间范围:', {
        mediaType: mediaItem.mediaType,
        timelineStartTimeFrames: newTimelineStartTimeFrames,
        timelineEndTimeFrames: newTimelineEndTimeFrames,
        durationFrames: tempDurationFrames.value,
        positionFrames: tempResizePositionFrames.value,
        timecode: framesToTimecode(tempDurationFrames.value),
      })

      // 构建新的时间范围对象（帧数版本）
      // 🔧 关键修复：保持原有的clipStartTime和clipEndTime，只更新timeline时间
      const currentTimeRange = props.timelineItem.timeRange

      let newTimeRange: VideoTimeRange | ImageTimeRange

      if (props.timelineItem.mediaType === 'video' && isVideoTimeRange(currentTimeRange)) {
        newTimeRange = {
          timelineStartTime: newTimelineStartTimeFrames, // 帧数
          timelineEndTime: newTimelineEndTimeFrames, // 帧数
          clipStartTime: currentTimeRange.clipStartTime, // 保持原有的素材开始时间
          clipEndTime: currentTimeRange.clipEndTime, // 保持原有的素材结束时间
          effectiveDuration: newTimelineEndTimeFrames - newTimelineStartTimeFrames, // 帧数
          playbackRate: currentTimeRange.playbackRate || 1.0, // 保持原有的播放速度
        }
      } else {
        // 图片类型
        newTimeRange = {
          timelineStartTime: newTimelineStartTimeFrames, // 帧数
          timelineEndTime: newTimelineEndTimeFrames, // 帧数
          displayDuration: newTimelineEndTimeFrames - newTimelineStartTimeFrames, // 帧数
        }
      }

      try {
        // 🎯 关键帧位置调整：在调整时间范围之前先调整关键帧位置
        const oldDurationFrames =
          currentTimeRange.timelineEndTime - currentTimeRange.timelineStartTime
        const newDurationFrames = newTimeRange.timelineEndTime - newTimeRange.timelineStartTime

        if (props.timelineItem.animation && props.timelineItem.animation.keyframes.length > 0) {
          const { adjustKeyframesForDurationChange } = await import('../utils/unifiedKeyframeUtils')
          adjustKeyframesForDurationChange(props.timelineItem, oldDurationFrames, newDurationFrames)
          console.log('🎬 [Resize] Keyframes adjusted for duration change:', {
            oldDuration: oldDurationFrames,
            newDuration: newDurationFrames,
          })
        }

        // 使用带历史记录的调整方法
        const success = await videoStore.resizeTimelineItemWithHistory(
          props.timelineItem.id,
          newTimeRange,
        )
        if (success) {
          console.log('✅ 时间范围调整成功')

          // 如果有动画，需要重新设置WebAV动画时长
          if (props.timelineItem.animation && props.timelineItem.animation.isEnabled) {
            const { updateWebAVAnimation } = await import('../utils/webavAnimationManager')
            await updateWebAVAnimation(props.timelineItem)
            console.log('🎬 [Resize] Animation duration updated after clip resize')
          }

          // 重新生成缩略图（异步执行，不阻塞UI）
          regenerateThumbnailAfterResize()
        } else {
          console.error('❌ 时间范围调整失败')
        }
      } catch (error) {
        console.error('❌ 调整时间范围时出错:', error)
      }
    }
  }

  isResizing.value = false
  resizeDirection.value = null
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
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

// Tooltip相关方法
function showTooltip(event: MouseEvent) {
  // 如果正在拖拽或调整大小，不显示tooltip
  if (isDragging.value || isResizing.value) return

  showTooltipFlag.value = true

  // 获取clip元素的位置信息
  const clipElement = event.currentTarget as HTMLElement
  const clipRect = clipElement.getBoundingClientRect()

  // 更新tooltip位置数据
  tooltipMouseX.value = event.clientX
  tooltipMouseY.value = event.clientY
  tooltipClipTop.value = clipRect.top
}

function updateTooltipPosition(event: MouseEvent) {
  // 只有在tooltip显示时才更新位置
  if (!showTooltipFlag.value) return
  // 如果正在拖拽或调整大小，不更新tooltip位置
  if (isDragging.value || isResizing.value) return

  // 获取clip元素的位置信息
  const clipElement = event.currentTarget as HTMLElement
  const clipRect = clipElement.getBoundingClientRect()

  // 更新tooltip位置数据
  tooltipMouseX.value = event.clientX
  tooltipMouseY.value = event.clientY
  tooltipClipTop.value = clipRect.top
}

function hideTooltip() {
  showTooltipFlag.value = false
}

onMounted(() => {
  // VideoClip组件挂载完成
  console.log('VideoClip组件挂载完成:', props.timelineItem.id)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<style scoped>
.video-clip {
  position: absolute;
  background: linear-gradient(135deg, #4a90e2, #357abd);
  border-radius: 4px;
  cursor: move;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 10; /* 确保视频片段在网格线上方 */
  border: 2px solid transparent;
}

/* 图片片段使用与视频相同的背景色 */
.video-clip[data-media-type='image'] {
  background: linear-gradient(135deg, #4a90e2, #357abd);
}

/* 在拖拽或调整大小时禁用过渡效果，避免延迟 */
.video-clip.dragging,
.video-clip.resizing {
  transition: none !important;
}

.video-clip:hover {
  border-color: #fff;
}

.video-clip.overlapping {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  border-color: #ff6b6b;
  box-shadow: 0 2px 12px rgba(231, 76, 60, 0.4);
  animation: pulse-warning 2s infinite;
}

.video-clip.selected {
  background: linear-gradient(135deg, #ff6b35, #f7931e);
  border-color: #ff6b35;
  box-shadow: 0 2px 12px rgba(255, 107, 53, 0.6);
}

/* 移除多选特定样式，现在使用统一的选择样式 */

/* 隐藏轨道上的clip样式 */
.video-clip.track-hidden {
  opacity: 0.4;
  background: linear-gradient(135deg, #666, #555);
  border-color: #777;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.video-clip.track-hidden:hover {
  opacity: 0.6;
  border-color: #999;
}

.video-clip.track-hidden.selected {
  opacity: 0.7;
  background: linear-gradient(135deg, #cc5529, #c4741a);
  border-color: #cc5529;
  box-shadow: 0 2px 12px rgba(204, 85, 41, 0.4);
}

/* 隐藏轨道上的选择样式现在统一使用 .selected 类 */

/* 隐藏轨道上的clip内容也要调整透明度 */
.video-clip.track-hidden .clip-name,
.video-clip.track-hidden .clip-duration,
.video-clip.track-hidden .clip-speed,
.video-clip.track-hidden .simple-duration {
  opacity: 0.8;
}

@keyframes pulse-warning {
  0%,
  100% {
    box-shadow: 0 2px 12px rgba(231, 76, 60, 0.4);
  }
  50% {
    box-shadow: 0 2px 16px rgba(231, 76, 60, 0.6);
  }
}

.clip-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 6px; /* 压缩内边距 */
  position: relative;
  overflow: hidden;
}

.clip-thumbnail {
  width: 50px; /* 压缩缩略图宽度 */
  height: 32px; /* 压缩缩略图高度 */
  background-color: #000;
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
  border-top: 2px solid #fff;
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
  color: #ffd700;
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

.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  background-color: rgba(255, 255, 255, 0.2);
  opacity: 0;
  transition: opacity 0.2s;
}

.resize-handle.left {
  left: 0;
  border-radius: 4px 0 0 4px;
}

.resize-handle.right {
  right: 0;
  border-radius: 0 4px 4px 0;
}

.video-clip:hover .resize-handle {
  opacity: 1;
}

/* 关键帧标记样式 */
.keyframes-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none; /* 不阻挡clip的交互 */
  z-index: 5; /* 在clip内容之上，但在调整手柄之下 */
}

.keyframe-marker {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  z-index: 6;
  pointer-events: auto; /* 允许点击 */
  cursor: pointer;
}

.keyframe-diamond {
  width: 10px;
  height: 10px;
  background-color: #00ff88; /* 明亮的绿色 */
  border: 2px solid #ffffff;
  border-radius: 2px;
  transform: rotate(45deg);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  transition: all 0.2s ease;
}

.keyframe-marker:hover .keyframe-diamond {
  background-color: #00cc6a; /* 悬停时稍微深一点的绿色 */
  transform: rotate(45deg) scale(1.3);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5);
  border-color: #ffffff;
}

.keyframe-marker:active .keyframe-diamond {
  background-color: #00aa55; /* 点击时更深的绿色 */
  transform: rotate(45deg) scale(1.1);
}
</style>

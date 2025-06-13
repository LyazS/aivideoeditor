<template>
  <div
    class="video-clip"
    :class="{
      overlapping: isOverlapping,
      selected: isSelected,
      dragging: isDragging,
      resizing: isResizing,
    }"
    :style="clipStyle"
    @mousedown="startDrag"
    @click="selectClip"
    @contextmenu="showContextMenu"
  >
    <div class="clip-content">
      <!-- 缩略图 - 总是显示 -->
      <div v-if="showDetails" class="clip-thumbnail">
        <video
          ref="thumbnailVideo"
          :src="mediaItem?.url"
          @loadedmetadata="generateThumbnail"
          muted
          preload="metadata"
        />
        <canvas ref="thumbnailCanvas" class="thumbnail-canvas"></canvas>
      </div>

      <!-- 详细信息 - 只在片段足够宽时显示 -->
      <div v-if="showDetails" class="clip-info">
        <div class="clip-name">{{ mediaItem?.name || 'Unknown' }}</div>
        <div class="clip-duration">{{ formatDuration(timelineDuration) }}</div>
        <div class="clip-speed" v-if="playbackSpeed !== 1">
          {{ formatSpeed(playbackSpeed) }}
        </div>
      </div>

      <!-- 简化显示 - 片段较窄时只显示时长 -->
      <div v-if="!showDetails" class="clip-simple">
        <div class="simple-duration">{{ formatDuration(timelineDuration) }}</div>
      </div>

      <!-- 调整手柄 -->
      <div class="resize-handle left" @mousedown.stop="startResize('left', $event)"></div>
      <div class="resize-handle right" @mousedown.stop="startResize('right', $event)"></div>
    </div>

    <!-- 右键菜单 -->
    <div v-if="showMenu" class="context-menu" :style="menuStyle" @click.stop>
      <div class="menu-item" @click="removeClip">删除</div>
      <div class="menu-item" @click="duplicateClip">复制</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { TimelineItem, Track } from '../stores/videostore'
import { useVideoStore } from '../stores/videostore'
import { useWebAVControls, isWebAVReady } from '../composables/useWebAVControls'

interface Props {
  timelineItem: TimelineItem
  track?: Track
  timelineWidth: number
  totalDuration: number
}

interface Emits {
  (e: 'update-position', timelineItemId: string, newPosition: number, newTrackId?: number): void
  (e: 'remove', timelineItemId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const videoStore = useVideoStore()
const webAVControls = useWebAVControls()

// 获取对应的MediaItem
const mediaItem = computed(() => {
  return videoStore.getMediaItem(props.timelineItem.mediaItemId)
})

// 获取时间轴时长
const timelineDuration = computed(() => {
  const sprite = props.timelineItem.sprite
  const timeRange = sprite.getTimeRange()

  // 依赖强制更新计数器，确保在sprite内部状态变化时重新计算
  videoStore.forceUpdateCounter

  return (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000 // 转换为秒
})

// 获取播放速度
const playbackSpeed = computed(() => {
  // 依赖强制更新计数器，确保在sprite内部状态变化时重新计算
  videoStore.forceUpdateCounter

  return props.timelineItem.sprite.getPlaybackSpeed() || 1
})

const thumbnailVideo = ref<HTMLVideoElement>()
const thumbnailCanvas = ref<HTMLCanvasElement>()
const showMenu = ref(false)
const menuStyle = ref({})

const isDragging = ref(false)
const isResizing = ref(false)
const resizeDirection = ref<'left' | 'right' | null>(null)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragStartPosition = ref(0)
const tempPosition = ref(0) // 临时位置，用于拖拽过程中的视觉反馈
const tempTrackId = ref(0) // 临时轨道ID，用于拖拽过程中的视觉反馈
const resizeStartX = ref(0)
const resizeStartDuration = ref(0)
const resizeStartPosition = ref(0)
const tempDuration = ref(0) // 临时时长，用于调整大小过程中的视觉反馈
const tempResizePosition = ref(0) // 临时调整位置

// 计算片段样式
const clipStyle = computed(() => {
  const videoStore = useVideoStore()
  const sprite = props.timelineItem.sprite
  const timeRange = sprite.getTimeRange()

  // 依赖强制更新计数器，确保在sprite内部状态变化时重新计算
  videoStore.forceUpdateCounter

  // 在拖拽或调整大小时使用临时值，否则使用实际值
  const position = isDragging.value
    ? tempPosition.value
    : isResizing.value
      ? tempResizePosition.value
      : timeRange.timelineStartTime / 1000000 // 转换为秒
  const duration = isResizing.value
    ? tempDuration.value
    : (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000 // 转换为秒

  const left = videoStore.timeToPixel(position, props.timelineWidth)
  const endTime = position + duration
  const right = videoStore.timeToPixel(endTime, props.timelineWidth)
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
  const sprite = props.timelineItem.sprite
  const timeRange = sprite.getTimeRange()

  // 依赖强制更新计数器，确保在sprite内部状态变化时重新计算
  videoStore.forceUpdateCounter

  // 在拖拽或调整大小时使用临时值，否则使用实际值
  const position = isDragging.value
    ? tempPosition.value
    : isResizing.value
      ? tempResizePosition.value
      : timeRange.timelineStartTime / 1000000 // 转换为秒
  const duration = isResizing.value
    ? tempDuration.value
    : (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000 // 转换为秒

  const endTime = position + duration
  const left = videoStore.timeToPixel(position, props.timelineWidth)
  const right = videoStore.timeToPixel(endTime, props.timelineWidth)
  const width = right - left
  return width >= 100 // 宽度大于100px时显示详细信息
})

// 检查当前时间轴项目是否与同轨道的其他项目重叠
const isOverlapping = computed(() => {
  const currentItem = props.timelineItem
  const currentSprite = currentItem.sprite
  const currentRange = currentSprite.getTimeRange()
  const currentStart = currentRange.timelineStartTime / 1000000 // 转换为秒
  const currentEnd = currentRange.timelineEndTime / 1000000

  // 依赖强制更新计数器，确保在sprite内部状态变化时重新计算
  videoStore.forceUpdateCounter

  return videoStore.timelineItems.some((otherItem) => {
    if (otherItem.id === currentItem.id || otherItem.trackId !== currentItem.trackId) {
      return false // 跳过自己和不同轨道的项目
    }

    const otherSprite = otherItem.sprite
    const otherRange = otherSprite.getTimeRange()
    const otherStart = otherRange.timelineStartTime / 1000000
    const otherEnd = otherRange.timelineEndTime / 1000000

    // 检查是否重叠
    return !(currentEnd <= otherStart || otherEnd <= currentStart)
  })
})

// 检查当前片段是否被选中
const isSelected = computed(() => {
  return videoStore.selectedTimelineItemId === props.timelineItem.id
})

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatSpeed(rate: number): string {
  if (rate > 1) {
    return `${rate.toFixed(1)}x 快速`
  } else if (rate < 1) {
    return `${rate.toFixed(1)}x 慢速`
  }
  return '正常速度'
}

function generateThumbnail() {
  if (!thumbnailVideo.value || !thumbnailCanvas.value) return

  const video = thumbnailVideo.value
  const canvas = thumbnailCanvas.value
  const ctx = canvas.getContext('2d')

  if (!ctx) return

  // 设置画布尺寸
  canvas.width = 60
  canvas.height = 40

  // 跳转到视频中间帧
  video.currentTime = video.duration / 2

  video.onseeked = () => {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  }
}

function selectClip(event: MouseEvent) {
  // 如果正在拖拽或调整大小，不处理选中
  if (isDragging.value || isResizing.value) return

  videoStore.selectTimelineItem(props.timelineItem.id)
  event.stopPropagation()
}

function startDrag(event: MouseEvent) {
  if (isResizing.value) return

  // 暂停播放以便进行编辑
  if (isWebAVReady() && videoStore.isPlaying) {
    webAVControls.pause()
  }

  // 选中当前片段
  videoStore.selectTimelineItem(props.timelineItem.id)

  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartY.value = event.clientY
  dragStartPosition.value = props.timelineItem.timelinePosition
  tempPosition.value = props.timelineItem.timelinePosition // 初始化临时位置
  tempTrackId.value = props.timelineItem.trackId // 初始化临时轨道ID

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)

  event.preventDefault()
}

function handleDrag(event: MouseEvent) {
  if (!isDragging.value) return

  const deltaX = event.clientX - dragStartX.value
  const deltaY = event.clientY - dragStartY.value

  // 计算新的时间位置
  const currentPixel = videoStore.timeToPixel(dragStartPosition.value, props.timelineWidth)
  const newPixel = currentPixel + deltaX
  const newTime = videoStore.pixelToTime(newPixel, props.timelineWidth)

  const newPosition = Math.max(0, newTime)
  const maxPosition = props.totalDuration - timelineDuration.value

  // 计算新的轨道ID（基于Y坐标变化）
  const newTrackId = getTrackIdFromDelta(deltaY)

  // 只更新临时位置和轨道，不触发 store 更新
  tempPosition.value = Math.min(newPosition, maxPosition)
  tempTrackId.value = newTrackId
}

// 根据Y坐标变化确定目标轨道
function getTrackIdFromDelta(deltaY: number): number {
  const tracks = videoStore.tracks
  const currentTrackIndex = tracks.findIndex((t) => t.id === props.timelineItem.trackId)

  if (currentTrackIndex === -1) return props.timelineItem.trackId

  // 计算轨道变化（每80px为一个轨道高度）
  const trackChange = Math.round(deltaY / 80)
  const newTrackIndex = Math.max(0, Math.min(currentTrackIndex + trackChange, tracks.length - 1))

  return tracks[newTrackIndex].id
}

function stopDrag() {
  if (isDragging.value) {
    // 只在拖拽结束时更新 store，避免拖拽过程中的频繁更新
    const newTrackId = tempTrackId.value !== props.timelineItem.trackId ? tempTrackId.value : undefined
    emit('update-position', props.timelineItem.id, tempPosition.value, newTrackId)
  }

  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function startResize(direction: 'left' | 'right', event: MouseEvent) {
  // 暂停播放以便进行编辑
  if (isWebAVReady() && videoStore.isPlaying) {
    webAVControls.pause()
  }

  isResizing.value = true
  resizeDirection.value = direction
  resizeStartX.value = event.clientX

  const sprite = props.timelineItem.sprite
  const timeRange = sprite.getTimeRange()

  resizeStartDuration.value = (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000 // 转换为秒
  resizeStartPosition.value = timeRange.timelineStartTime / 1000000 // 转换为秒

  // 初始化临时值
  tempDuration.value = resizeStartDuration.value
  tempResizePosition.value = resizeStartPosition.value

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)

  event.preventDefault()
}

function handleResize(event: MouseEvent) {
  if (!isResizing.value || !resizeDirection.value) return

  const deltaX = event.clientX - resizeStartX.value
  const mediaItem = videoStore.getMediaItem(props.timelineItem.mediaItemId)

  if (!mediaItem) return

  let newDuration = resizeStartDuration.value
  let newTimelinePosition = resizeStartPosition.value

  if (resizeDirection.value === 'left') {
    // 拖拽左边把柄：调整开始时间和时长
    const currentLeftPixel = videoStore.timeToPixel(resizeStartPosition.value, props.timelineWidth)
    const newLeftPixel = currentLeftPixel + deltaX
    const newLeftTime = videoStore.pixelToTime(newLeftPixel, props.timelineWidth)

    newTimelinePosition = Math.max(0, newLeftTime)
    newDuration = resizeStartDuration.value + (resizeStartPosition.value - newTimelinePosition)
  } else if (resizeDirection.value === 'right') {
    // 拖拽右边把柄：只调整时长
    const endTime = resizeStartPosition.value + resizeStartDuration.value
    const currentRightPixel = videoStore.timeToPixel(endTime, props.timelineWidth)
    const newRightPixel = currentRightPixel + deltaX
    const newRightTime = videoStore.pixelToTime(newRightPixel, props.timelineWidth)

    newDuration = newRightTime - resizeStartPosition.value
  }

  // 确保最小时长（0.01秒）和最大时长（原始素材时长的10倍）
  const minDuration = 0.01
  const maxDuration = mediaItem.duration * 10
  newDuration = Math.max(minDuration, Math.min(newDuration, maxDuration))

  // 只更新临时值，不触发 store 更新
  tempDuration.value = newDuration
  tempResizePosition.value = newTimelinePosition
}

function stopResize() {
  if (isResizing.value) {
    // 更新CustomVisibleSprite的时间范围
    const sprite = props.timelineItem.sprite
    const mediaItem = videoStore.getMediaItem(props.timelineItem.mediaItemId)

    if (mediaItem) {
      // 计算新的时间范围
      const newTimelineStartTime = tempResizePosition.value * 1000000 // 转换为微秒
      const newTimelineEndTime = (tempResizePosition.value + tempDuration.value) * 1000000 // 转换为微秒

      // 验证时间范围的有效性
      if (newTimelineEndTime <= newTimelineStartTime) {
        console.error('❌ 无效的时间范围:', {
          start: newTimelineStartTime,
          end: newTimelineEndTime,
          duration: tempDuration.value,
          position: tempResizePosition.value
        })
        return
      }

      console.log('🔧 调整大小 - 设置时间范围:', {
        clipStartTime: 0,
        clipEndTime: mediaItem.duration * 1000000,
        timelineStartTime: newTimelineStartTime,
        timelineEndTime: newTimelineEndTime,
        duration: tempDuration.value
      })

      sprite.setTimeRange({
        clipStartTime: 0,
        clipEndTime: mediaItem.duration * 1000000,
        timelineStartTime: newTimelineStartTime,
        timelineEndTime: newTimelineEndTime
      })

      // 直接更新TimelineItem的位置，不调用updateTimelineItemPosition避免重复设置时间范围
      props.timelineItem.timelinePosition = tempResizePosition.value
    }
  }

  isResizing.value = false
  resizeDirection.value = null
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

function showContextMenu(event: MouseEvent) {
  event.preventDefault()
  showMenu.value = true

  menuStyle.value = {
    left: `${event.offsetX}px`,
    top: `${event.offsetY}px`,
  }

  // 点击其他地方关闭菜单
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu, { once: true })
  }, 0)
}

function hideContextMenu() {
  showMenu.value = false
}

function removeClip() {
  emit('remove', props.timelineItem.id)
  hideContextMenu()
}

async function duplicateClip() {
  console.log('Duplicate timeline item:', props.timelineItem.id)
  hideContextMenu()

  try {
    const newItemId = await videoStore.duplicateTimelineItem(props.timelineItem.id)
    if (newItemId) {
      console.log('✅ 时间轴项目复制成功，新项目ID:', newItemId)
    } else {
      console.error('❌ 时间轴项目复制失败')
    }
  } catch (error) {
    console.error('❌ 复制时间轴项目时出错:', error)
  }
}

onMounted(() => {
  if (thumbnailVideo.value) {
    thumbnailVideo.value.load()
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
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
  transition: all 0.2s;
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

.thumbnail-canvas {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.clip-thumbnail video {
  display: none;
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

.context-menu {
  position: absolute;
  background-color: #333;
  border: 1px solid #555;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  min-width: 120px;
}

.menu-item {
  padding: 8px 12px;
  cursor: pointer;
  color: white;
  font-size: 14px;
  border-bottom: 1px solid #555;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:hover {
  background-color: #444;
}
</style>

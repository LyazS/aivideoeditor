<template>
  <div
    class="video-clip"
    :class="{ 'overlapping': isOverlapping, 'selected': isSelected }"
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
          :src="clip.url"
          @loadedmetadata="generateThumbnail"
          muted
          preload="metadata"
        />
        <canvas ref="thumbnailCanvas" class="thumbnail-canvas"></canvas>
      </div>

      <!-- 详细信息 - 只在片段足够宽时显示 -->
      <div v-if="showDetails" class="clip-info">
        <div class="clip-name">{{ clip.name }}</div>
        <div class="clip-duration">{{ formatDuration(clip.duration) }}</div>
        <div class="clip-speed" v-if="clip.playbackRate && clip.playbackRate !== 1">{{ formatSpeed(clip.playbackRate) }}</div>
      </div>

      <!-- 简化显示 - 片段较窄时只显示时长 -->
      <div v-if="!showDetails" class="clip-simple">
        <div class="simple-duration">{{ formatDuration(clip.duration) }}</div>
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
import type { VideoClip } from '../stores/counter'
import { useVideoStore } from '../stores/counter'

interface Props {
  clip: VideoClip
  timelineWidth: number
  totalDuration: number
}

interface Emits {
  (e: 'update-position', clipId: string, newPosition: number): void
  (e: 'update-timing', clipId: string, newDuration: number, timelinePosition?: number): void
  (e: 'remove', clipId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const videoStore = useVideoStore()

const thumbnailVideo = ref<HTMLVideoElement>()
const thumbnailCanvas = ref<HTMLCanvasElement>()
const showMenu = ref(false)
const menuStyle = ref({})

const isDragging = ref(false)
const isResizing = ref(false)
const resizeDirection = ref<'left' | 'right' | null>(null)
const dragStartX = ref(0)
const dragStartPosition = ref(0)
const resizeStartX = ref(0)
const resizeStartDuration = ref(0)
const resizeStartPosition = ref(0)

// 计算片段样式
const clipStyle = computed(() => {
  const pixelsPerSecond = props.timelineWidth / props.totalDuration
  const left = props.clip.timelinePosition * pixelsPerSecond
  const width = props.clip.duration * pixelsPerSecond

  return {
    left: `${left}px`,
    width: `${Math.max(width, 20)}px`, // 最小宽度20px，确保可见但不影响时间准确性
    top: '20px',
    height: '80px'
  }
})

// 判断是否应该显示详细信息（当片段足够宽时）
const showDetails = computed(() => {
  const pixelsPerSecond = props.timelineWidth / props.totalDuration
  const width = props.clip.duration * pixelsPerSecond
  return width >= 100 // 宽度大于100px时显示详细信息
})

// 检查当前片段是否与其他片段重叠
const isOverlapping = computed(() => {
  return videoStore.clips.some(otherClip =>
    otherClip.id !== props.clip.id &&
    videoStore.isOverlapping(props.clip, otherClip)
  )
})

// 检查当前片段是否被选中
const isSelected = computed(() => {
  return videoStore.selectedClipId === props.clip.id
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

  videoStore.selectClip(props.clip.id)
  event.stopPropagation()
}

function startDrag(event: MouseEvent) {
  if (isResizing.value) return

  // 选中当前片段
  videoStore.selectClip(props.clip.id)

  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartPosition.value = props.clip.timelinePosition

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)

  event.preventDefault()
}

function handleDrag(event: MouseEvent) {
  if (!isDragging.value) return
  
  const deltaX = event.clientX - dragStartX.value
  const pixelsPerSecond = props.timelineWidth / props.totalDuration
  const deltaTime = deltaX / pixelsPerSecond
  
  const newPosition = Math.max(0, dragStartPosition.value + deltaTime)
  const maxPosition = props.totalDuration - props.clip.duration
  
  emit('update-position', props.clip.id, Math.min(newPosition, maxPosition))
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function startResize(direction: 'left' | 'right', event: MouseEvent) {
  isResizing.value = true
  resizeDirection.value = direction
  resizeStartX.value = event.clientX
  resizeStartDuration.value = props.clip.duration
  resizeStartPosition.value = props.clip.timelinePosition

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)

  event.preventDefault()
}

function handleResize(event: MouseEvent) {
  if (!isResizing.value || !resizeDirection.value) return

  const deltaX = event.clientX - resizeStartX.value
  const pixelsPerSecond = props.timelineWidth / props.totalDuration
  const deltaTime = deltaX / pixelsPerSecond

  let newDuration = resizeStartDuration.value
  let newTimelinePosition = resizeStartPosition.value

  if (resizeDirection.value === 'left') {
    // 拖拽左边把柄：调整时长和时间轴位置
    // 向左拖拽增加时长，向右拖拽减少时长
    newDuration = resizeStartDuration.value - deltaTime
    newTimelinePosition = resizeStartPosition.value + deltaTime

    // 确保不会拖拽到负位置
    if (newTimelinePosition < 0) {
      const adjustment = -newTimelinePosition
      newTimelinePosition = 0
      newDuration = newDuration + adjustment
    }
  } else if (resizeDirection.value === 'right') {
    // 拖拽右边把柄：只调整时长
    // 向右拖拽增加时长，向左拖拽减少时长
    newDuration = resizeStartDuration.value + deltaTime
  }

  // 确保最小时长（0.1秒）和最大时长
  const minDuration = 0.1
  const maxDuration = props.clip.originalDuration * 10 // 最多可以拉伸到10倍长度
  newDuration = Math.max(minDuration, Math.min(newDuration, maxDuration))

  emit('update-timing', props.clip.id, newDuration, newTimelinePosition)
}

function stopResize() {
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
    top: `${event.offsetY}px`
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
  emit('remove', props.clip.id)
  hideContextMenu()
}

function duplicateClip() {
  // TODO: 实现片段复制功能
  console.log('Duplicate clip:', props.clip.id)
  hideContextMenu()
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
  border: 2px solid transparent;
  transition: all 0.2s;
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
  background: linear-gradient(135deg, #ffd700, #ffb347);
  border-color: #ffd700;
  box-shadow: 0 2px 12px rgba(255, 215, 0, 0.6);
}

@keyframes pulse-warning {
  0%, 100% {
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
  padding: 8px;
  position: relative;
  overflow: hidden;
}

.clip-thumbnail {
  width: 60px;
  height: 40px;
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
  margin-left: 8px;
  min-width: 0;
}

.clip-name {
  font-size: 12px;
  font-weight: bold;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clip-duration {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 2px;
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

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
    @contextmenu="showContextMenu"
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
        <div
          v-else
          class="thumbnail-placeholder"
        >
          <div class="loading-spinner"></div>
        </div>
      </div>

      <!-- 详细信息 - 只在片段足够宽时显示 -->
      <div v-if="showDetails" class="clip-info">
        <div class="clip-name">{{ mediaItem?.name || 'Unknown' }}</div>
        <!-- 时长信息 - 视频和图片都显示 -->
        <div class="clip-duration">{{ formatDuration(timelineDuration) }}</div>
        <!-- 倍速信息 - 只有视频显示 -->
        <div
          class="clip-speed"
          v-if="mediaItem?.mediaType === 'video' && Math.abs(playbackSpeed - 1) > 0.001"
        >
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

    <!-- Tooltip -->
    <div v-if="showTooltipFlag" class="clip-tooltip" :style="tooltipStyle">
      <div class="tooltip-content">
        <div class="tooltip-title">{{ mediaItem?.name || 'Unknown' }}</div>
        <div class="tooltip-info">
          <div class="tooltip-row">
            <span class="tooltip-label">类型:</span>
            <span class="tooltip-value">{{ mediaItem?.mediaType === 'video' ? '视频' : '图片' }}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">时长:</span>
            <span class="tooltip-value">{{ formatDuration(timelineDuration) }}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">位置:</span>
            <span class="tooltip-value">{{ formatDuration(props.timelineItem.timeRange.timelineStartTime / 1000000) }}</span>
          </div>
          <div v-if="mediaItem?.mediaType === 'video' && Math.abs(playbackSpeed - 1) > 0.001" class="tooltip-row">
            <span class="tooltip-label">倍速:</span>
            <span class="tooltip-value">{{ formatSpeed(playbackSpeed) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { useWebAVControls } from '../composables/useWebAVControls'
import { regenerateThumbnailForTimelineItem } from '../utils/thumbnailGenerator'
import { useDragUtils } from '../composables/useDragUtils'
import { usePlaybackControls } from '../composables/usePlaybackControls'
import { getDragPreviewManager } from '../composables/useDragPreview'
import { formatTime as formatTimeUtil } from '../stores/utils/storeUtils'
import type { TimelineItem, Track } from '../types/videoTypes'

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
const dragUtils = useDragUtils()
const { pauseForEditing } = usePlaybackControls()
const dragPreviewManager = getDragPreviewManager()

// 获取对应的MediaItem
const mediaItem = computed(() => {
  return videoStore.getMediaItem(props.timelineItem.mediaItemId)
})

// 获取时间轴时长
const timelineDuration = computed(() => {
  // 直接从timelineItem.timeRange获取，与videostore的同步机制保持一致
  const timeRange = props.timelineItem.timeRange

  return (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000 // 转换为秒
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

const showMenu = ref(false)
const menuStyle = ref({})

// Tooltip相关状态
const showTooltipFlag = ref(false)
const tooltipStyle = ref({})

const isDragging = ref(false) // 保留用于原生拖拽状态
const isResizing = ref(false)
const resizeDirection = ref<'left' | 'right' | null>(null)
const resizeStartX = ref(0)
const resizeStartDuration = ref(0)
const resizeStartPosition = ref(0)
const tempDuration = ref(0) // 临时时长，用于调整大小过程中的视觉反馈
const tempResizePosition = ref(0) // 临时调整位置

// 计算片段样式
const clipStyle = computed(() => {
  const videoStore = useVideoStore()
  // 直接从timelineItem.timeRange获取，与videostore的同步机制保持一致
  const timeRange = props.timelineItem.timeRange

  // 在调整大小时使用临时值，否则使用实际值
  const position = isResizing.value
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
  // 直接从timelineItem.timeRange获取，与videostore的同步机制保持一致
  const timeRange = props.timelineItem.timeRange

  // 在调整大小时使用临时值，否则使用实际值
  const position = isResizing.value
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
  // 直接从timelineItem.timeRange获取，与videostore的同步机制保持一致
  const currentRange = currentItem.timeRange
  const currentStart = currentRange.timelineStartTime / 1000000 // 转换为秒
  const currentEnd = currentRange.timelineEndTime / 1000000

  return videoStore.timelineItems.some((otherItem) => {
    if (otherItem.id === currentItem.id || otherItem.trackId !== currentItem.trackId) {
      return false // 跳过自己和不同轨道的项目
    }

    // 同样从timelineItem.timeRange获取其他项目的时间范围
    const otherRange = otherItem.timeRange
    const otherStart = otherRange.timelineStartTime / 1000000
    const otherEnd = otherRange.timelineEndTime / 1000000

    // 检查是否重叠
    return !(currentEnd <= otherStart || otherEnd <= currentStart)
  })
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

function formatDuration(seconds: number): string {
  // 使用统一的时间格式化工具函数
  return formatTimeUtil(seconds, 'seconds')
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
    props.timelineItem.timeRange.timelineStartTime / 1000000,
    Array.from(videoStore.selectedTimelineItemIds),
    dragOffset
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
    currentSelections: Array.from(videoStore.selectedTimelineItemIds)
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

  // 直接从timelineItem.timeRange获取，与videostore的同步机制保持一致
  const timeRange = props.timelineItem.timeRange

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

async function stopResize() {
  if (isResizing.value) {
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
          position: tempResizePosition.value,
        })
        return
      }

      console.log('🔧 调整大小 - 设置时间范围:', {
        mediaType: mediaItem.mediaType,
        timelineStartTime: newTimelineStartTime,
        timelineEndTime: newTimelineEndTime,
        duration: tempDuration.value,
      })

      // 构建新的时间范围对象
      const newTimeRange = {
        timelineStartTime: newTimelineStartTime,
        timelineEndTime: newTimelineEndTime,
        clipStartTime: mediaItem.mediaType === 'video' ? 0 : 0,
        clipEndTime: mediaItem.mediaType === 'video' ? mediaItem.duration * 1000000 : 0,
        effectiveDuration: newTimelineEndTime - newTimelineStartTime,
        playbackRate: 1.0,
      }

      try {
        // 使用带历史记录的调整方法
        const success = await videoStore.resizeTimelineItemWithHistory(props.timelineItem.id, newTimeRange)
        if (success) {
          console.log('✅ 时间范围调整成功')
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
    const newItemId = await videoStore.duplicateTimelineItemWithHistory(props.timelineItem.id)
    if (newItemId) {
      console.log('✅ 时间轴项目复制成功，新项目ID:', newItemId)
    } else {
      console.error('❌ 时间轴项目复制失败')
    }
  } catch (error) {
    console.error('❌ 复制时间轴项目时出错:', error)
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

  // 将tooltip定位在鼠标位置的上方
  tooltipStyle.value = {
    position: 'fixed',
    left: `${event.clientX}px`, // 使用鼠标的X坐标
    bottom: `${window.innerHeight - clipRect.top + 10}px`, // 在clip上方10px
    transform: 'translateX(-50%)', // 水平居中对齐鼠标位置
    zIndex: 1001,
  }
}

function updateTooltipPosition(event: MouseEvent) {
  // 只有在tooltip显示时才更新位置
  if (!showTooltipFlag.value) return
  // 如果正在拖拽或调整大小，不更新tooltip位置
  if (isDragging.value || isResizing.value) return

  // 获取clip元素的位置信息
  const clipElement = event.currentTarget as HTMLElement
  const clipRect = clipElement.getBoundingClientRect()

  // 更新tooltip位置，跟随鼠标的横向位置
  tooltipStyle.value = {
    position: 'fixed',
    left: `${event.clientX}px`, // 使用鼠标的X坐标
    bottom: `${window.innerHeight - clipRect.top + 10}px`, // 在clip上方10px
    transform: 'translateX(-50%)', // 水平居中对齐鼠标位置
    zIndex: 1001,
  }
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
  transition: all 0.2s;
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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

/* Tooltip样式 */
.clip-tooltip {
  position: fixed;
  background-color: rgba(0, 0, 0, 0.9);
  border: 1px solid #555;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 1001;
  pointer-events: none; /* 防止tooltip阻挡鼠标事件 */
  max-width: 250px;
  min-width: 180px;
}

.tooltip-content {
  padding: 12px;
}

.tooltip-title {
  font-size: 14px;
  font-weight: bold;
  color: white;
  margin-bottom: 8px;
  word-break: break-word;
}

.tooltip-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.tooltip-label {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
  min-width: 40px;
}

.tooltip-value {
  color: white;
  font-weight: 600;
  text-align: right;
}

/* 添加一个小箭头指向clip */
.clip-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.9);
}
</style>

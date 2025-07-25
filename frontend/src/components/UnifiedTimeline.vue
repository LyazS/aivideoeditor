<template>
  <div class="timeline" @click="handleTimelineContainerClick" @contextmenu="handleContextMenu">
    <!-- 顶部区域：轨道管理器头部 + 时间刻度 -->
    <div class="timeline-header">
      <div class="track-manager-header">
        <h3>轨道</h3>
        <HoverButton variant="small" @click="showAddTrackMenu($event)" title="添加新轨道">
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
            </svg>
          </template>
        </HoverButton>
      </div>
      <div class="timeline-scale">
        <TimeScale />
      </div>
    </div>

    <!-- 主体区域：每个轨道一行，包含左侧控制和右侧内容 -->
    <div class="timeline-body" ref="timelineBody" @wheel="handleWheel">
      <!-- 每个轨道一行 -->
      <div
        v-for="track in tracks"
        :key="track.id"
        class="track-row"
        :style="{ height: track.height + 'px' }"
      >
        <!-- 左侧轨道控制 -->
        <div class="track-controls">
          <!-- 轨道颜色标识 -->
          <div class="track-color-indicator" :class="`track-color-${track.type}`"></div>

          <!-- 轨道名称 -->
          <div class="track-name">
            <!-- 轨道类型图标和片段数量 -->
            <div class="track-type-info" :title="`${getTrackTypeLabel(track.type)}轨道，共 ${getClipsForTrack(track.id).length} 个片段`">
              <div class="track-type-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path :d="getTrackTypeIcon(track.type)" />
                </svg>
              </div>
              <div class="clip-count">
                {{ getClipsForTrack(track.id).length }}
              </div>
            </div>

            <input
              v-if="editingTrackId === track.id"
              v-model="editingTrackName"
              @blur="finishRename"
              @keyup.enter="finishRename"
              @keyup.escape="cancelRename"
              class="track-name-input"
              :ref="
                (el) => {
                  /* @ts-ignore */
                  if (editingTrackId === track.id) nameInput = el as HTMLInputElement
                }
              "
            />
            <span
              v-else
              @dblclick="startRename(track)"
              class="track-name-text"
              :title='track.name'
            >
              {{ track.name }}
            </span>
          </div>

          <!-- 控制按钮已移至右键菜单 -->
          <div class="track-buttons">
            <!-- 轨道快捷操作按钮 -->
            <div class="track-status">
              <!-- 可见性切换按钮 - 音频轨道不显示 -->
              <HoverButton
                v-if="track.type !== 'audio'"
                variant="small"
                :class="track.isVisible ? 'active' : ''"
                :title="track.isVisible ? '隐藏轨道' : '显示轨道'"
                @click="toggleVisibility(track.id)"
              >
                <template #icon>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      v-if="track.isVisible"
                      d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"
                    />
                    <path
                      v-else
                      d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.09L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.76,7.13 11.37,7 12,7Z"
                    />
                  </svg>
                </template>
              </HoverButton>

              <!-- 静音切换按钮 - 文本轨道不显示 -->
              <HoverButton
                v-if="track.type !== 'text'"
                variant="small"
                :class="!track.isMuted ? 'active' : ''"
                :title="track.isMuted ? '取消静音' : '静音轨道'"
                @click="toggleMute(track.id)"
              >
                <template #icon>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      v-if="!track.isMuted"
                      d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"
                    />
                    <path
                      v-else
                      d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z"
                    />
                  </svg>
                </template>
              </HoverButton>
            </div>
          </div>
        </div>

        <!-- 右侧轨道内容区域 -->
        <div
          class="track-content"
          :class="{
            'track-hidden': !track.isVisible,
            [`track-type-${track.type}`]: true,
          }"
          :data-track-id="track.id"
          @dragover="handleDragOver"
          @drop="handleDrop"
          @click="handleTimelineClick"
          @wheel="handleWheel"
        >
          <!-- 该轨道的时间轴项目 -->
          <component
            v-for="item in getClipsForTrack(track.id)"
            :key="item.id"
            :is="renderTimelineItem(item, track)"
          />
        </div>
      </div>

      <!-- 时间轴背景网格 -->
      <div class="timeline-grid">
        <div
          v-for="line in gridLines"
          :key="line.time"
          class="grid-line"
          :class="{ 'frame-line': line.isFrame }"
          :style="{ left: 150 + videoStore.frameToPixel(line.time, timelineWidth) + 'px' }"
        ></div>
      </div>
    </div>

    <!-- 全局播放头组件 - 覆盖整个时间轴 -->
    <Playhead
      :timeline-width="timelineWidth"
      :track-control-width="150"
      :wheel-container="timelineBody"
      :enable-snapping="true"
    />

    <!-- 吸附指示器组件 - 覆盖整个时间轴 -->
    <SnapIndicator
      :show="snapIndicatorManager.visible"
      :snap-point="snapIndicatorManager.data.snapPoint"
      :timeline-width="snapIndicatorManager.data.timelineWidth"
      :timeline-offset="{ x: 150, y: 0 }"
      :show-tooltip="snapIndicatorManager.data.showTooltip"
      :line-height="snapIndicatorManager.data.lineHeight"
    />
  </div>

  <!-- 统一右键菜单 -->
  <ContextMenu v-model:show="showContextMenu" :options="contextMenuOptions">
    <template v-for="(item, index) in currentMenuItems" :key="index">
      <ContextMenuSeparator v-if="'type' in item && item.type === 'separator'" />
      <ContextMenuItem
        v-else-if="'label' in item && 'onClick' in item"
        :label="item.label"
        @click="item.onClick"
      >
        <template #icon>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            :fill="item.label.includes('删除') ? '#ff6b6b' : 'currentColor'"
          >
            <path :d="item.icon" />
          </svg>
        </template>
      </ContextMenuItem>
      <ContextMenuGroup
        v-else-if="'label' in item && 'children' in item"
        :label="item.label"
      >
        <template #icon>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path :d="item.icon" />
          </svg>
        </template>
        <template v-for="(child, childIndex) in item.children" :key="childIndex">
          <ContextMenuSeparator v-if="'type' in child && child.type === 'separator'" />
          <ContextMenuItem
            v-else-if="'label' in child && 'onClick' in child"
            :label="child.label"
            @click="child.onClick"
          >
            <template #icon>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path :d="child.icon" />
              </svg>
            </template>
          </ContextMenuItem>
        </template>
      </ContextMenuGroup>
    </template>
  </ContextMenu>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, markRaw, reactive, h } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { usePlaybackControls } from '../composables/usePlaybackControls'
import { getDragPreviewManager } from '../composables/useDragPreview'
import { useDragUtils } from '../composables/useDragUtils'
import { useDialogs } from '../composables/useDialogs'
import { getSnapIndicatorManager } from '../composables/useSnapIndicator'
import { calculatePixelsPerFrame } from '../stores/utils/timeUtils'
import { calculateVisibleFrameRange } from '../stores/utils/coordinateUtils'
import { detectTrackConflicts } from '../utils/timeOverlapUtils'

import Playhead from './Playhead.vue'
import SnapIndicator from './SnapIndicator.vue'
import UnifiedTimelineClip from './UnifiedTimelineClip.vue'
import TimeScale from './TimeScale.vue'
import HoverButton from './HoverButton.vue'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, ContextMenuGroup } from '@imengyu/vue3-context-menu'

// 统一时间轴项目相关导入
import type {
  UnifiedTimelineItem,
  CreateTimelineItemParams
} from '../unified/timelineitem'
import {
  createUnifiedTimelineItem,
  createVideoTimelineItem,
  createImageTimelineItem,
  createAudioTimelineItem,
  createTextTimelineItem,
  UnifiedTimelineItemActions,
  UnifiedTimelineItemQueries,
  TIMELINE_CONTEXT_TEMPLATES
} from '../unified/timelineitem'

import type {
  TrackType,
  MediaType,
  Track,
  TimelineItemDragData,
  MediaItemDragData,
  ConflictInfo
} from '../types'

// 菜单项类型定义
type MenuItem =
  | {
      label: string
      icon: string
      onClick: () => void
    }
  | {
      label: string
      icon: string
      children: MenuItem[]
    }
  | {
      type: 'separator'
    }

// Component name for Vue DevTools
defineOptions({
  name: 'UnifiedTimelineEditor',
})

const videoStore = useVideoStore()
const { pauseForEditing } = usePlaybackControls()
const dragPreviewManager = getDragPreviewManager()
const dragUtils = useDragUtils()
const dialogs = useDialogs()
const snapIndicatorManager = getSnapIndicatorManager()

const timelineBody = ref<HTMLElement>()
const timelineWidth = ref(800)

const tracks = computed(() => videoStore.tracks)

// 编辑轨道名称相关
const editingTrackId = ref<string | null>(null)
const editingTrackName = ref('')
let nameInput: HTMLInputElement | null = null

// 右键菜单相关
const showContextMenu = ref(false)
const contextMenuType = ref<'clip' | 'track' | 'empty'>('empty')
const contextMenuTarget = ref<{
  clipId?: string
  trackId?: string
  element?: HTMLElement
}>({})

const contextMenuOptions = ref({
  x: 0,
  y: 0,
  theme: 'mac dark',
  zIndex: 1000,
})

// 获取指定轨道的统一时间轴项目
function getClipsForTrack(trackId: string): UnifiedTimelineItem[] {
  // 暂时使用现有的时间轴项目，后续需要转换为统一时间轴项目
  const existingItems = videoStore.getTimelineItemsForTrack(trackId)

  // 将现有时间轴项目转换为统一时间轴项目（临时方案）
  return existingItems.map(item => convertToUnifiedTimelineItem(item))
}

// 临时转换函数：将现有时间轴项目转换为统一时间轴项目
function convertToUnifiedTimelineItem(item: any): UnifiedTimelineItem {
  return createUnifiedTimelineItem({
    id: item.id,
    mediaItemId: item.mediaItemId,
    trackId: item.trackId,
    mediaType: item.mediaType,
    name: item.mediaName || item.config?.name || '未命名项目',
    startTime: item.timeRange.timelineStartTime,
    endTime: item.timeRange.timelineEndTime,
    initialStatus: item.sprite ? 'ready' : 'loading',
    mediaConfig: item.config
  })
}

// 轨道管理方法
async function addNewTrack(type: TrackType = 'video') {
  try {
    const newTrackId = await videoStore.addTrackWithHistory(type)
    if (newTrackId) {
      console.log('✅ 轨道添加成功，新轨道ID:', newTrackId, '类型:', type)

      if (type === 'text') {
        dialogs.showSuccess('文本轨道创建成功！现在可以右键点击轨道添加文本内容。')
      } else if (type === 'audio') {
        dialogs.showSuccess('音频轨道创建成功！现在可以拖拽音频文件到轨道中。')
      }
    } else {
      console.error('❌ 轨道添加失败')
    }
  } catch (error) {
    console.error('❌ 添加轨道时出错:', error)
    dialogs.showOperationError('添加轨道', (error as Error).message)
  }
}

// 在指定轨道后添加新轨道
async function addNewTrackAfter(type: TrackType, afterTrackId: string) {
  try {
    const afterTrackIndex = tracks.value.findIndex(track => track.id === afterTrackId)
    if (afterTrackIndex === -1) {
      console.error('❌ 找不到目标轨道:', afterTrackId)
      return
    }

    const newTrackId = await videoStore.addTrackWithHistory(type, undefined, afterTrackIndex + 1)
    if (newTrackId) {
      console.log('✅ 轨道添加成功，新轨道ID:', newTrackId, '类型:', type, '位置:', afterTrackIndex + 1)

      if (type === 'text') {
        dialogs.showSuccess('文本轨道创建成功！现在可以右键点击轨道添加文本内容。')
      } else if (type === 'audio') {
        dialogs.showSuccess('音频轨道创建成功！现在可以拖拽音频文件到轨道中。')
      } else if (type === 'video') {
        dialogs.showSuccess('视频轨道创建成功！现在可以拖拽视频文件到轨道中。')
      }
    } else {
      console.error('❌ 轨道添加失败')
    }
  } catch (error) {
    console.error('❌ 添加轨道时出错:', error)
    dialogs.showOperationError('添加轨道', (error as Error).message)
  }
}

// 显示添加轨道菜单
function showAddTrackMenu(event?: MouseEvent) {
  if (event) {
    const button = event.currentTarget as HTMLElement
    const rect = button.getBoundingClientRect()
    contextMenuOptions.value.x = rect.left
    contextMenuOptions.value.y = rect.bottom + 5
  } else {
    contextMenuOptions.value.x = 100
    contextMenuOptions.value.y = 100
  }

  contextMenuType.value = 'empty'
  contextMenuTarget.value = {}
  showContextMenu.value = true
}

// 获取轨道类型图标
function getTrackTypeIcon(type: TrackType): string {
  const icons = {
    video: 'M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z',
    audio: 'M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12Z',
    text: 'M18,11H16.5V10.5H14.5V13.5H16.5V13H18V14A1,1 0 0,1 17,15H14A1,1 0 0,1 13,14V10A1,1 0 0,1 14,9H17A1,1 0 0,1 18,10V11M11,15H9V9H11V15M8,9H6V15H8V9Z',
  }
  return icons[type] || icons.video
}

// 获取轨道类型标签
function getTrackTypeLabel(type: TrackType): string {
  const labels = {
    video: '视频',
    audio: '音频',
    text: '文本',
  }
  return labels[type] || '视频'
}

// 事件处理函数
function handleTimelineContainerClick(event: MouseEvent) {
  // 处理时间轴容器点击事件
  console.log('Timeline container clicked')
}

function handleContextMenu(event: MouseEvent) {
  event.preventDefault()
  // 处理右键菜单
  contextMenuOptions.value.x = event.clientX
  contextMenuOptions.value.y = event.clientY
  contextMenuType.value = 'empty'
  contextMenuTarget.value = {}
  showContextMenu.value = true
}

function handleWheel(event: WheelEvent) {
  // 处理滚轮事件
  if (event.ctrlKey || event.metaKey) {
    // 缩放
    event.preventDefault()
    const delta = event.deltaY > 0 ? -0.1 : 0.1
    const newZoomLevel = Math.max(0.1, Math.min(5, videoStore.zoomLevel + delta))
    videoStore.setZoomLevel(newZoomLevel)
  } else {
    // 水平滚动
    const delta = event.deltaY
    const newScrollOffset = Math.max(0, videoStore.scrollOffset + delta)
    videoStore.setScrollOffset(newScrollOffset)
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  // 处理拖拽悬停
  const dragType = dragUtils.getDragDataType(event)

  switch (dragType) {
    case 'timeline-item':
      event.dataTransfer!.dropEffect = 'move'
      handleTimelineItemDragOver(event)
      break
    case 'media-item':
      event.dataTransfer!.dropEffect = 'copy'
      handleMediaItemDragOver(event)
      break
    default:
      event.dataTransfer!.dropEffect = 'none'
      dragPreviewManager.hidePreview()
      snapIndicatorManager.hide(true)
      break
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  console.log('🎯 [UnifiedTimeline] 接收到拖拽事件')

  // 清理预览和指示器
  dragPreviewManager.hidePreview()
  snapIndicatorManager.hide(true)

  // 暂停播放
  pauseForEditing('统一时间轴拖拽放置')

  const dragType = dragUtils.getDragDataType(event)

  switch (dragType) {
    case 'timeline-item': {
      const timelineItemData = event.dataTransfer?.getData('application/timeline-item')
      if (timelineItemData) {
        console.log('📦 [UnifiedTimeline] 处理时间轴项目拖拽')
        handleTimelineItemDrop(event, JSON.parse(timelineItemData))
      }
      break
    }
    case 'media-item': {
      const mediaItemData = event.dataTransfer?.getData('application/media-item')
      if (mediaItemData) {
        console.log('📦 [UnifiedTimeline] 处理素材库拖拽')
        handleMediaItemDrop(event, JSON.parse(mediaItemData))
      }
      break
    }
    default:
      console.log('❌ [UnifiedTimeline] 没有检测到有效的拖拽数据')
      dialogs.showInvalidDragWarning()
      break
  }

  dragUtils.clearDragData()
}

function handleTimelineClick(event: MouseEvent) {
  // 处理时间轴点击事件
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const framePosition = videoStore.pixelToFrame(clickX, timelineWidth.value)

  // 设置播放头位置
  videoStore.setCurrentFrame(framePosition)
}

// 拖拽处理函数
function handleTimelineItemDragOver(event: DragEvent) {
  // 处理时间轴项目拖拽悬停
  const currentDragData = dragUtils.getCurrentTimelineItemDragData()
  if (!currentDragData) {
    dragPreviewManager.hidePreview()
    snapIndicatorManager.hide(true)
    return
  }

  const dropPosition = dragUtils.calculateDropPosition(
    event,
    timelineWidth.value,
    currentDragData.dragOffset,
  )

  if (!dropPosition) {
    dragPreviewManager.hidePreview()
    snapIndicatorManager.hide(true)
    return
  }

  const { dropTime: clipStartTime, targetTrackId, snapResult } = dropPosition

  // 显示吸附指示器
  if (snapResult && snapResult.snapped && snapResult.snapPoint) {
    snapIndicatorManager.show(snapResult.snapPoint, timelineWidth.value, {
      timelineOffset: { x: 150, y: 0 },
      lineHeight: 400
    })
  } else {
    snapIndicatorManager.hide(true)
  }

  // 创建预览数据
  const previewData = dragUtils.createDragPreviewData(
    '拖拽项目',
    100, // 默认持续时间
    clipStartTime,
    targetTrackId,
    false,
    currentDragData.selectedItems.length > 1,
    currentDragData.selectedItems.length,
    'video'
  )

  dragPreviewManager.updatePreview(previewData, timelineWidth.value)
}

function handleMediaItemDragOver(event: DragEvent) {
  // 处理素材库拖拽悬停
  const dropPosition = dragUtils.calculateDropPosition(event, timelineWidth.value)

  if (!dropPosition) {
    dragPreviewManager.hidePreview()
    snapIndicatorManager.hide(true)
    return
  }

  const { dropTime, targetTrackId, snapResult } = dropPosition

  // 显示吸附指示器
  if (snapResult && snapResult.snapped && snapResult.snapPoint) {
    snapIndicatorManager.show(snapResult.snapPoint, timelineWidth.value, {
      timelineOffset: { x: 150, y: 0 },
      lineHeight: 400
    })
  } else {
    snapIndicatorManager.hide(true)
  }

  // 获取素材拖拽数据
  const mediaDragData = dragUtils.getCurrentMediaItemDragData()
  if (mediaDragData) {
    const previewData = dragUtils.createDragPreviewData(
      mediaDragData.name,
      mediaDragData.duration,
      dropTime,
      targetTrackId,
      false,
      false,
      undefined,
      mediaDragData.mediaType,
    )

    dragPreviewManager.updatePreview(previewData, timelineWidth.value)
  }
}

function handleTimelineItemDrop(event: DragEvent, dragData: TimelineItemDragData) {
  console.log('🎯 [UnifiedTimeline] 处理时间轴项目拖拽放置:', dragData)

  const dropPosition = dragUtils.calculateDropPosition(
    event,
    timelineWidth.value,
    dragData.dragOffset,
  )

  if (!dropPosition) {
    console.error('❌ [UnifiedTimeline] 无法找到目标轨道')
    return
  }

  const { dropTime, targetTrackId } = dropPosition

  // 这里应该调用统一时间轴项目的移动方法
  // 暂时使用现有的方法
  console.log('📍 [UnifiedTimeline] 拖拽目标位置:', {
    dropTime,
    targetTrackId,
    selectedItems: dragData.selectedItems,
  })
}

function handleMediaItemDrop(event: DragEvent, mediaDragData: MediaItemDragData) {
  console.log('🎯 [UnifiedTimeline] 处理素材库拖拽放置:', mediaDragData)

  const dropPosition = dragUtils.calculateDropPosition(event, timelineWidth.value)

  if (!dropPosition) {
    console.error('无法获取轨道区域信息')
    return
  }

  const { dropTime, targetTrackId } = dropPosition

  // 这里应该创建新的统一时间轴项目
  console.log('📍 [UnifiedTimeline] 素材拖拽目标位置:', {
    dropTime,
    targetTrackId,
    mediaItem: mediaDragData,
  })
}

// 轨道操作函数
async function removeTrack(trackId: string) {
  if (tracks.value.length <= 1) {
    dialogs.showMinTrackWarning()
    return
  }

  try {
    const success = await videoStore.removeTrackWithHistory(trackId)
    if (success) {
      console.log('✅ 轨道删除成功')
    } else {
      console.error('❌ 轨道删除失败')
    }
  } catch (error) {
    console.error('❌ 删除轨道时出错:', error)
  }
}

async function toggleVisibility(trackId: string) {
  try {
    const success = await videoStore.toggleTrackVisibilityWithHistory(trackId)
    if (success) {
      console.log('✅ 轨道可见性切换成功')
    } else {
      console.error('❌ 轨道可见性切换失败')
    }
  } catch (error) {
    console.error('❌ 切换轨道可见性时出错:', error)
  }
}

async function toggleMute(trackId: string) {
  try {
    const success = await videoStore.toggleTrackMuteWithHistory(trackId)
    if (success) {
      console.log('✅ 轨道静音状态切换成功')
    } else {
      console.error('❌ 轨道静音状态切换失败')
    }
  } catch (error) {
    console.error('❌ 切换轨道静音状态时出错:', error)
  }
}

async function autoArrangeTrack(trackId: string) {
  try {
    const success = await videoStore.autoArrangeTrackWithHistory(trackId)
    if (success) {
      console.log('✅ 轨道自动排列成功')
    } else {
      console.error('❌ 轨道自动排列失败')
    }
  } catch (error) {
    console.error('❌ 自动排列轨道时出错:', error)
  }
}

async function startRename(track: { id: string; name: string }) {
  editingTrackId.value = track.id
  editingTrackName.value = track.name
  await nextTick()
  nameInput?.focus()
  nameInput?.select()
}

async function finishRename() {
  if (editingTrackId.value && editingTrackName.value.trim()) {
    try {
      const success = await videoStore.renameTrackWithHistory(
        editingTrackId.value,
        editingTrackName.value.trim(),
      )
      if (success) {
        console.log('✅ 轨道重命名成功')
      } else {
        console.error('❌ 轨道重命名失败')
      }
    } catch (error) {
      console.error('❌ 重命名轨道时出错:', error)
    }
  }
  editingTrackId.value = null
  editingTrackName.value = ''
}

function cancelRename() {
  editingTrackId.value = null
  editingTrackName.value = ''
}

// 时间轴项目操作
function handleSelectClip(itemId: string) {
  console.log('选中时间轴项目:', itemId)
  // 这里可以添加选中逻辑
}

function handleTimelineItemPositionUpdate(
  timelineItemId: string,
  newPositionFrames: number,
  newTrackId?: string,
) {
  console.log('更新时间轴项目位置:', {
    timelineItemId,
    newPositionFrames,
    newTrackId
  })
  // 这里应该更新统一时间轴项目的位置
}

function handleTimelineItemRemove(timelineItemId: string) {
  console.log('删除时间轴项目:', timelineItemId)
  // 这里应该删除统一时间轴项目
}

// 时间轴项目渲染函数
function renderTimelineItem(item: UnifiedTimelineItem, track: Track) {
  const commonProps = {
    track: track,
    timelineWidth: timelineWidth.value,
    totalDurationFrames: videoStore.totalDurationFrames,
    onSelect: handleSelectClip,
    'onUpdate-position': handleTimelineItemPositionUpdate,
    onRemove: handleTimelineItemRemove
  }

  // 使用统一时间轴项目组件
  return h(UnifiedTimelineClip, {
    timelineItem: item,
    ...commonProps
  })
}

// 网格线计算
const gridLines = computed(() => {
  const lines = []
  const totalDurationFrames = videoStore.totalDurationFrames
  const pixelsPerFrame = calculatePixelsPerFrame(
    timelineWidth.value,
    totalDurationFrames,
    videoStore.zoomLevel,
  )
  const pixelsPerSecond = pixelsPerFrame * videoStore.frameRate

  // 根据缩放级别决定网格间隔
  let intervalFrames = 150 // 默认每5秒一条网格线
  let frameIntervalFrames = 0
  let isFrameLevel = false

  if (pixelsPerSecond >= 100) {
    intervalFrames = 30 // 高缩放：每秒一条线
    frameIntervalFrames = 1
    isFrameLevel = true
  } else if (pixelsPerSecond >= 50) {
    intervalFrames = 60 // 中等缩放：每2秒一条线
  } else if (pixelsPerSecond >= 20) {
    intervalFrames = 150 // 正常缩放：每5秒一条线
  } else {
    intervalFrames = 300 // 低缩放：每10秒一条线
  }

  // 计算可见时间范围
  const { startFrames, endFrames } = calculateVisibleFrameRange(
    timelineWidth.value,
    totalDurationFrames,
    videoStore.zoomLevel,
    videoStore.scrollOffset,
  )

  // 生成主网格线
  const startLineFrames = Math.floor(startFrames / intervalFrames) * intervalFrames
  const endLineFrames = Math.ceil(endFrames / intervalFrames) * intervalFrames

  for (
    let i = startLineFrames;
    i <= Math.min(endLineFrames, totalDurationFrames);
    i += intervalFrames
  ) {
    if (i >= 0) {
      lines.push({ time: i, isFrame: false })
    }
  }

  // 在帧级别缩放时，添加帧网格线
  if (isFrameLevel && frameIntervalFrames > 0) {
    const frameStartFrames = Math.floor(startFrames / frameIntervalFrames) * frameIntervalFrames
    const frameEndFrames = Math.ceil(endFrames / frameIntervalFrames) * frameIntervalFrames

    for (
      let i = frameStartFrames;
      i <= Math.min(frameEndFrames, totalDurationFrames);
      i += frameIntervalFrames
    ) {
      if (i >= 0 && Math.abs(i % intervalFrames) > 0.5) {
        lines.push({ time: i, isFrame: true })
      }
    }
  }

  return lines.sort((a, b) => a.time - b.time)
})

// 菜单配置
const menuConfigs: Record<string, MenuItem[]> = {
  track: [],
  empty: [
    {
      label: '添加视频轨道',
      icon: 'M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z',
      onClick: () => addNewTrack('video'),
    },
    {
      label: '添加音频轨道',
      icon: 'M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12Z',
      onClick: () => addNewTrack('audio'),
    },
    {
      label: '添加文本轨道',
      icon: 'M18,11H16.5V10.5H14.5V13.5H16.5V13H18V14A1,1 0 0,1 17,15H14A1,1 0 0,1 13,14V10A1,1 0 0,1 14,9H17A1,1 0 0,1 18,10V11M11,15H9V9H11V15M8,9H6V15H8V9Z',
      onClick: () => addNewTrack('text'),
    },
  ],
}

// 当前菜单项配置
const currentMenuItems = computed(() => {
  return menuConfigs[contextMenuType.value] || []
})

// 更新时间轴宽度
function updateTimelineWidth() {
  if (timelineBody.value) {
    timelineWidth.value = timelineBody.value.clientWidth - 150
  }
}

// 生命周期
onMounted(() => {
  updateTimelineWidth()
  window.addEventListener('resize', updateTimelineWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateTimelineWidth)
})
</script>

<style scoped>
.timeline {
  flex: 1;
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-medium);
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.timeline-header {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border-primary);
}

.track-manager-header {
  width: 150px;
  padding: var(--spacing-md);
  background-color: var(--color-bg-tertiary);
  border-right: 1px solid var(--color-border-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.track-manager-header h3 {
  margin: 0;
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
}

/* 旧的添加轨道按钮样式已移除，现在使用 HoverButton 组件 */

.timeline-scale {
  flex: 1;
  background-color: var(--color-bg-primary);
}

.timeline-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.track-row {
  display: flex;
  border-bottom: 1px solid var(--color-border-primary);
  /* 移除固定的min-height，让轨道高度由track.height动态控制 */
}

.track-controls {
  width: 150px;
  background-color: var(--color-bg-tertiary);
  border-right: 1px solid var(--color-border-primary);
  padding: var(--spacing-sm) var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

/* 轨道颜色标识 */
.track-color-indicator {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  border-radius: 0 2px 2px 0;
}

.track-color-indicator.track-color-video {
  background: linear-gradient(135deg, #5a6d90, #4a5d80);
}

.track-color-indicator.track-color-audio {
  background: linear-gradient(135deg, #5d905d, #4d804d);
}

.track-color-indicator.track-color-text {
  background: linear-gradient(135deg, #805b90, #704b80);
}

.track-content {
  flex: 1;
  position: relative;
  background-color: var(--color-bg-secondary);
  overflow: hidden;
}

.track-content:hover {
  background-color: var(--color-bg-tertiary);
}

/* 隐藏轨道样式 */
.track-content.track-hidden {
  background-color: var(--color-bg-quaternary);
  opacity: 0.6;
  position: relative;
}

.track-content.track-hidden::before {
  content: '轨道已隐藏';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  pointer-events: none;
  z-index: 1;
  background-color: rgba(0, 0, 0, 0.7);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius-small);
  white-space: nowrap;
}

.track-content.track-hidden:hover {
  background-color: var(--color-bg-quaternary);
  opacity: 0.8;
}

/* 轨道类型样式 - 移除边框，颜色标识已移至左侧控制区域 */
.track-content.track-type-video,
.track-content.track-type-audio,
.track-content.track-type-text {
  /* 统一使用默认背景色 */
}

.track-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.track-type-info {
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
  border-radius: var(--border-radius-small);
  border: 1px solid rgba(156, 163, 175, 0.3);
  overflow: hidden;
}

.track-type-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 0;
  background-color: rgba(156, 163, 175, 0.15);
  color: #9ca3af;
  flex-shrink: 0;
  border: none;
}

.track-name-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  cursor: pointer;
  display: block;
  padding: 2px var(--spacing-xs);
  border-radius: 2px;
  transition: background-color var(--transition-fast);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-name-text:hover {
  background-color: var(--color-bg-quaternary);
}

.track-name-input {
  background: var(--color-bg-quaternary);
  border: 1px solid var(--color-border-secondary);
  border-radius: 2px;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  padding: 2px var(--spacing-xs);
  width: 100%;
}

.track-buttons {
  display: flex;
  gap: var(--spacing-xs);
  justify-content: flex-start;
}

.track-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.status-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid transparent;
  border-radius: var(--border-radius-small);
  background-color: transparent;
  color: #9ca3af; /* 银灰色 */
  cursor: pointer;
  transition: all var(--transition-fast);
}

.status-btn:hover {
  background-color: rgba(156, 163, 175, 0.15); /* 悬停时的银色背景 */
  border-color: rgba(156, 163, 175, 0.3);
  color: #d1d5db; /* 悬停时更亮的银色 */
}

.status-btn.active {
  background-color: rgba(156, 163, 175, 0.25); /* 激活状态的银色背景 */
  border-color: rgba(156, 163, 175, 0.4);
  color: #f3f4f6; /* 激活状态的亮银色 */
}

.status-btn.active:hover {
  background-color: rgba(156, 163, 175, 0.35); /* 激活状态悬停时更亮 */
  border-color: rgba(156, 163, 175, 0.5);
  color: #ffffff; /* 最亮的银色 */
}

.clip-count {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 0;
  background-color: rgba(156, 163, 175, 0.15); /* 与图标相同的背景色 */
  color: #9ca3af; /* 与图标相同的文字颜色 */
  font-size: 11px;
  font-weight: 600;
  border: none;
}

/* track-btn 相关样式已清理 - 未在组件中使用 */

.timeline-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 0;
}

.grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background-color: var(--color-bg-quaternary);
  opacity: 0.5;
}

.grid-line.frame-line {
  background-color: var(--color-border-secondary);
  opacity: 0.3;
  width: 1px;
}
</style>

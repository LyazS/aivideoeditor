<template>
  <div
    class="timeline"
    @click="handleTimelineContainerClick"
    @contextmenu="handleContextMenu"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- 顶部区域：轨道管理器头部 + 时间刻度 -->
    <div class="timeline-header">
      <div class="track-manager-header">
        <h3>轨道</h3>
        <HoverButton variant="small" @click="showAddTrackMenu($event)" title="添加新轨道">
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path :d="CONTROL_ICONS.add" />
            </svg>
          </template>
        </HoverButton>
      </div>
      <div class="timeline-scale">
        <UnifiedTimeScale />
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
            <div
              class="track-type-info"
              :title="`${getTrackTypeLabel(track.type)}轨道，共 ${getClipsForTrack(track.id).length} 个片段`"
            >
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
              :ref="(el) => { if (el) nameInputs[track.id] = el as HTMLInputElement }"
            />
            <span v-else @dblclick="startRename(track)" class="track-name-text" :title="track.name">
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
                    <path :d="getVisibilityIcon(track.isVisible)" />
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
                    <path :d="getMuteIcon(track.isMuted)" />
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
          :style="{ left: 150 + unifiedStore.frameToPixel(line.time, timelineWidth) + 'px' }"
        ></div>
      </div>
    </div>

    <!-- 全局播放头组件 - 覆盖整个时间轴 -->
    <UnifiedPlayhead
      :timeline-width="timelineWidth"
      :track-control-width="150"
      :wheel-container="timelineBody"
      :enable-snapping="true"
    />

    <!-- 吸附指示器组件已禁用 -->

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
      <ContextMenuGroup v-else-if="'label' in item && 'children' in item" :label="item.label">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
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
import { ref, computed, onMounted, onUnmounted, nextTick, h } from 'vue'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { usePlaybackControls, getDragPreviewManager, useDragUtils, useDialogs } from '@/unified/composables'
import { calculateVisibleFrameRange } from '@/unified/utils/coordinateUtils'
import type { UnifiedTrackType } from '@/unified/track/TrackTypes'
import type { MediaType } from '@/unified/mediaitem/types'
import type {
  UnifiedTimelineItemData,
  GetTimelineItemConfig,
  TimelineItemStatus,
} from '../timelineitem/TimelineItemData'
import type { TimelineItemDragData, MediaItemDragData, ConflictInfo } from '@/unified/types'
import type {
  VideoMediaConfig,
  ImageMediaConfig,
  AudioMediaConfig,
  TextMediaConfig,
} from '../timelineitem/TimelineItemData'

import UnifiedPlayhead from './UnifiedPlayhead.vue'
import UnifiedTimelineClip from './UnifiedTimelineClip.vue'
import UnifiedTimeScale from './UnifiedTimeScale.vue'
import HoverButton from '@/components/HoverButton.vue'
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuGroup,
} from '@imengyu/vue3-context-menu'
import { UnifiedMediaItemQueries } from '@/unified/mediaitem'
import { generateId } from '@/unified/utils/idGenerator'
import {
  getTrackTypeIcon,
  getTrackTypeLabel,
  getVisibilityIcon,
  getMuteIcon,
  CONTROL_ICONS,
  MENU_ICONS,
} from '@/unified/constants/timelineIcons'
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

const unifiedStore = useUnifiedStore()
const { pauseForEditing } = usePlaybackControls()
const dragPreviewManager = getDragPreviewManager()
const dragUtils = useDragUtils()
const dialogs = useDialogs()

const timelineBody = ref<HTMLElement>()
const timelineWidth = ref(800)

const tracks = computed(() => unifiedStore.tracks)

// 编辑轨道名称相关
const editingTrackId = ref<string | null>(null)
const editingTrackName = ref('')
// 为每个轨道使用单独的ref，避免多轨道间引用冲突
const nameInputs = ref<Record<string, HTMLInputElement>>({})

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

// 计算当前菜单项
const currentMenuItems = computed(() => {
  switch (contextMenuType.value) {
    case 'clip':
      return getClipMenuItems()
    case 'track':
      return getTrackMenuItems()
    case 'empty':
    default:
      return getEmptyMenuItems()
  }
})

// 获取指定轨道的时间轴项目
function getClipsForTrack(trackId: string) {
  return unifiedStore.getTimelineItemsByTrack(trackId)
}

// 轨道管理方法
async function addNewTrack(type: UnifiedTrackType = 'video', afterTrackId?: string) {
  try {
    if (afterTrackId) {
      // 找到目标轨道的位置
      const afterTrackIndex = tracks.value.findIndex((track) => track.id === afterTrackId)
      if (afterTrackIndex === -1) {
        console.error('❌ 找不到目标轨道:', afterTrackId)
        return
      }

      // 在目标轨道后插入新轨道（位置为 afterTrackIndex + 1）
      await unifiedStore.addTrackWithHistory(type, undefined, afterTrackIndex + 1)
      console.log('✅ 轨道添加成功，类型:', type, '位置:', afterTrackIndex + 1)
    } else {
      // 在末尾添加新轨道
      await unifiedStore.addTrackWithHistory(type)
      console.log('✅ 轨道添加成功，类型:', type)
    }

    // 显示成功提示
    if (type === 'text') {
      dialogs.showSuccess('文本轨道创建成功！现在可以右键点击轨道添加文本内容。')
    } else if (type === 'audio') {
      dialogs.showSuccess('音频轨道创建成功！现在可以拖拽音频文件到轨道中。')
    } else if (type === 'video') {
      dialogs.showSuccess('视频轨道创建成功！现在可以拖拽视频文件到轨道中。')
    }
  } catch (error) {
    console.error('❌ 添加轨道时出错:', error)
    dialogs.showOperationError('添加轨道', (error as Error).message)
  }
}

// 显示添加轨道菜单
function showAddTrackMenu(event?: MouseEvent) {
  // 如果是点击按钮触发，获取按钮位置
  if (event) {
    const button = event.currentTarget as HTMLElement
    const rect = button.getBoundingClientRect()
    contextMenuOptions.value.x = rect.left
    contextMenuOptions.value.y = rect.bottom + 5
  } else {
    // 默认位置
    contextMenuOptions.value.x = 100
    contextMenuOptions.value.y = 100
  }

  contextMenuType.value = 'empty'
  contextMenuTarget.value = {}
  showContextMenu.value = true
}


async function toggleVisibility(trackId: string) {
  try {
    await unifiedStore.toggleTrackVisibilityWithHistory(trackId)
    console.log('✅ 轨道可见性切换成功')
  } catch (error) {
    console.error('❌ 切换轨道可见性时出错:', error)
  }
}

async function toggleMute(trackId: string) {
  try {
    await unifiedStore.toggleTrackMuteWithHistory(trackId)
    console.log('✅ 轨道静音状态切换成功')
  } catch (error) {
    console.error('❌ 切换轨道静音状态时出错:', error)
  }
}

async function autoArrangeTrack(trackId: string) {
  try {
    await unifiedStore.autoArrangeTrackWithHistory(trackId)
    console.log('✅ 轨道自动排列成功')
  } catch (error) {
    console.error('❌ 自动排列轨道时出错:', error)
  }
}

async function startRename(track: { id: string; name: string }) {
  editingTrackId.value = track.id
  editingTrackName.value = track.name
  await nextTick()
  
  // 使用轨道ID作为key获取对应的输入框
  const input = nameInputs.value[track.id]
  if (input && typeof input.focus === 'function') {
    input.focus()
    input.select()
  } else {
    console.warn(`无法获取到轨道 ${track.id} 的输入框引用`)
  }
}

async function finishRename() {
  if (editingTrackId.value && editingTrackName.value.trim()) {
    try {
      await unifiedStore.renameTrackWithHistory(editingTrackId.value, editingTrackName.value.trim())
      console.log('✅ 轨道重命名成功')
    } catch (error) {
      console.error('❌ 重命名轨道时出错:', error)
    }
  }
  // 清理输入框引用
  if (editingTrackId.value) {
    delete nameInputs.value[editingTrackId.value]
  }
  editingTrackId.value = null
  editingTrackName.value = ''
}

function cancelRename() {
  // 清理输入框引用
  if (editingTrackId.value) {
    delete nameInputs.value[editingTrackId.value]
  }
  editingTrackId.value = null
  editingTrackName.value = ''
}

// 菜单项生成函数
function getEmptyMenuItems(): MenuItem[] {
  return [
    {
      label: '添加视频轨道',
      icon: getTrackTypeIcon('video'),
      onClick: () => addNewTrack('video'),
    },
    {
      label: '添加音频轨道',
      icon: getTrackTypeIcon('audio'),
      onClick: () => addNewTrack('audio'),
    },
    {
      label: '添加文本轨道',
      icon: getTrackTypeIcon('text'),
      onClick: () => addNewTrack('text'),
    },
  ]
}

function getClipMenuItems(): MenuItem[] {
  const clipId = contextMenuTarget.value.clipId
  if (!clipId) return []

  const timelineItem = unifiedStore.getTimelineItem(clipId)
  if (!timelineItem) return []

  const menuItems: MenuItem[] = []

  // 复制片段 - 所有类型都支持
  menuItems.push({
    label: '复制片段',
    icon: MENU_ICONS.copy,
    onClick: () => duplicateClip(),
  })

  // 重新生成缩略图 - 只有视频和图片支持
  if (timelineItem.mediaType === 'video' || timelineItem.mediaType === 'image') {
    menuItems.push({
      label: '重新生成缩略图',
      icon: MENU_ICONS.refresh,
      onClick: () => regenerateThumbnail(),
    })
  }

  // 分隔符
  menuItems.push({ type: 'separator' } as MenuItem)

  // 删除片段 - 所有类型都支持
  menuItems.push({
    label: '删除片段',
    icon: MENU_ICONS.delete,
    onClick: () => removeClip(),
  })

  return menuItems
}

function getTrackMenuItems(): MenuItem[] {
  const trackId = contextMenuTarget.value.trackId
  if (!trackId) return []

  const track = tracks.value.find((t) => t.id === trackId)
  if (!track) return []

  const hasClips = getClipsForTrack(trackId).length > 0
  const canDelete = tracks.value.length > 1

  const menuItems: MenuItem[] = []

  // 文本轨道专用菜单项
  if (track.type === 'text') {
    menuItems.push({
      label: '添加文本',
      icon: MENU_ICONS.addText,
      onClick: () => createTextAtPosition(trackId),
    })

    if (hasClips) {
      menuItems.push({ type: 'separator' } as MenuItem)
    }
  }

  // 通用菜单项
  menuItems.push(
    {
      label: hasClips ? '自动排列片段' : '自动排列片段（无片段）',
      icon: MENU_ICONS.autoArrange,
      onClick: hasClips ? () => autoArrangeTrack(trackId) : () => {},
    },
    {
      label: '重命名轨道',
      icon: MENU_ICONS.rename,
      onClick: () => renameTrack(),
    },
  )

  // 可见性控制 - 音频轨道不显示
  if (track.type !== 'audio') {
    menuItems.push({
      label: track.isVisible ? '隐藏轨道' : '显示轨道',
      icon: getVisibilityIcon(track.isVisible),
      onClick: () => toggleVisibility(trackId),
    })
  }

  // 静音控制 - 文本轨道不显示
  if (track.type !== 'text') {
    menuItems.push({
      label: track.isMuted ? '取消静音' : '静音轨道',
      icon: getMuteIcon(track.isMuted),
      onClick: () => toggleMute(trackId),
    })
  }

  // 添加新轨道子菜单
  menuItems.push({ type: 'separator' } as MenuItem, {
    label: '添加新轨道',
    icon: MENU_ICONS.addTrack,
    children: [
      {
        label: '视频轨道',
        icon: getTrackTypeIcon('video'),
        onClick: () => addNewTrack('video', trackId),
      },
      {
        label: '音频轨道',
        icon: getTrackTypeIcon('audio'),
        onClick: () => addNewTrack('audio', trackId),
      },
      {
        label: '文本轨道',
        icon: getTrackTypeIcon('text'),
        onClick: () => addNewTrack('text', trackId),
      },
    ],
  })

  // 删除轨道选项
  if (canDelete) {
    menuItems.push({
      label: '删除轨道',
      icon: MENU_ICONS.delete,
      onClick: () => removeTrack(trackId),
    })
  }

  return menuItems
}

// 网格线
const gridLines = computed(() => {
  const lines = []
  const totalDurationFrames = unifiedStore.totalDurationFrames
  const pixelsPerFrame = (timelineWidth.value * unifiedStore.zoomLevel) / totalDurationFrames
  const pixelsPerSecond = pixelsPerFrame * unifiedStore.frameRate

  // 根据缩放级别决定网格间隔（基于帧数）
  let intervalFrames = 150 // 默认每5秒一条网格线（150帧）
  let frameIntervalFrames = 0 // 帧间隔
  let isFrameLevel = false

  if (pixelsPerSecond >= 100) {
    // 降低帧级别的阈值
    intervalFrames = 30 // 高缩放：每秒一条线（30帧）
    frameIntervalFrames = 1 // 同时显示帧级别的线
    isFrameLevel = true
  } else if (pixelsPerSecond >= 50) {
    intervalFrames = 60 // 中等缩放：每2秒一条线（60帧）
  } else if (pixelsPerSecond >= 20) {
    intervalFrames = 150 // 正常缩放：每5秒一条线（150帧）
  } else {
    intervalFrames = 300 // 低缩放：每10秒一条线（300帧）
  }

  // 计算可见时间范围（使用帧数版本）
  const { startFrames, endFrames } = calculateVisibleFrameRange(
    timelineWidth.value,
    totalDurationFrames,
    unifiedStore.zoomLevel,
    unifiedStore.scrollOffset,
  )

  // 生成主网格线（基于帧数）
  const startLineFrames = Math.floor(startFrames / intervalFrames) * intervalFrames
  const endLineFrames = Math.ceil(endFrames / intervalFrames) * intervalFrames

  for (
    let i = startLineFrames;
    i <= Math.min(endLineFrames, totalDurationFrames);
    i += intervalFrames
  ) {
    if (i >= 0) {
      lines.push({ time: i, isFrame: false }) // 直接使用帧数
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
        // 避免与主网格线重复（使用帧数容差）
        lines.push({ time: i, isFrame: true }) // 直接使用帧数
      }
    }
  }

  return lines.sort((a, b) => a.time - b.time)
})

function updateTimelineWidth() {
  if (timelineBody.value) {
    // 计算轨道内容区域的宽度（总宽度减去轨道控制区域的150px）
    timelineWidth.value = timelineBody.value.clientWidth - 150
  }
}

// ==================== 拖拽处理系统 ====================

function handleDragOver(event: DragEvent) {
  event.preventDefault()

  // 使用统一的拖拽工具检查数据类型
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
    case 'files':
      // 文件拖拽，但我们不再支持直接文件拖拽
      event.dataTransfer!.dropEffect = 'none'
      dragPreviewManager.hidePreview()
      break
    default:
      event.dataTransfer!.dropEffect = 'copy'
      dragPreviewManager.hidePreview()
      break
  }
}

// 处理素材库拖拽悬停
function handleMediaItemDragOver(event: DragEvent) {
  // 使用统一的拖拽工具计算目标位置
  const dropPosition = dragUtils.calculateDropPosition(event, timelineWidth.value)

  if (!dropPosition) {
    dragPreviewManager.hidePreview()
    return
  }

  const { dropTime, targetTrackId } = dropPosition

  // 吸附指示器已禁用

  // 使用统一的拖拽工具获取素材拖拽数据
  const mediaDragData = dragUtils.getCurrentMediaItemDragData()
  if (mediaDragData) {
    // 获取素材项目以检查状态
    const mediaItem = unifiedStore.getMediaItem(mediaDragData.mediaItemId)
    const isReady = mediaItem ? UnifiedMediaItemQueries.isReady(mediaItem) : false
    const isLoading = mediaItem ? UnifiedMediaItemQueries.isProcessing(mediaItem) : false
    const hasError = mediaItem ? UnifiedMediaItemQueries.hasError(mediaItem) : false

    // 检测素材库拖拽的重叠冲突
    const conflicts = detectMediaItemConflicts(dropTime, targetTrackId, mediaDragData.duration)
    const isConflict = conflicts.length > 0

    // 使用统一的拖拽工具创建预览数据，包含状态信息
    const previewData = dragUtils.createDragPreviewData(
      mediaDragData.name,
      mediaDragData.duration,
      dropTime,
      targetTrackId,
      isConflict,
      false,
      undefined,
      mediaDragData.mediaType,
      { isReady, isLoading, hasError }, // 新增状态信息
    )

    dragPreviewManager.updatePreview(previewData, timelineWidth.value)
  } else {
    // 显示默认预览
    const previewData = dragUtils.createDragPreviewData(
      '素材预览',
      5,
      dropTime,
      targetTrackId,
      false,
      false,
      undefined,
      'video', // 默认使用视频类型
    )

    dragPreviewManager.updatePreview(previewData, timelineWidth.value)
  }
}

// 处理时间轴项目拖拽悬停
function handleTimelineItemDragOver(event: DragEvent) {
  // 使用统一的拖拽工具获取当前拖拽数据
  const currentDragData = dragUtils.getCurrentTimelineItemDragData()
  if (!currentDragData) {
    dragPreviewManager.hidePreview()
    return
  }

  // 使用统一的拖拽工具计算目标位置（考虑拖拽偏移量）
  const dropPosition = dragUtils.calculateDropPosition(
    event,
    timelineWidth.value,
    currentDragData.dragOffset,
  )

  if (!dropPosition) {
    dragPreviewManager.hidePreview()
    return
  }

  const { dropTime: clipStartTime, targetTrackId } = dropPosition

  // 吸附指示器已禁用

  // 获取拖拽项目信息
  const draggedItem = unifiedStore.getTimelineItem(currentDragData.itemId)
  if (draggedItem) {
    const duration = draggedItem.timeRange.timelineEndTime - draggedItem.timeRange.timelineStartTime // 帧数

    // 检测冲突
    const conflicts = detectTimelineConflicts(clipStartTime, targetTrackId, currentDragData)
    const isConflict = conflicts.length > 0

    // 获取显示名称
    let name = 'Clip'
    if ('config' in draggedItem && draggedItem.config && 'name' in draggedItem.config) {
      // 异步处理时间轴项目：从配置中获取名称
      name = draggedItem.config.name as string
    } else if ('mediaItemId' in draggedItem) {
      // 本地时间轴项目：从媒体项目中获取名称
      const mediaItem = unifiedStore.getMediaItem(draggedItem.mediaItemId)
      name = mediaItem?.name || 'Clip'
    }

    // 使用统一的拖拽工具创建预览数据
    const previewData = dragUtils.createDragPreviewData(
      name,
      duration,
      clipStartTime,
      targetTrackId,
      isConflict,
      currentDragData.selectedItems.length > 1,
      currentDragData.selectedItems.length,
      draggedItem.mediaType,
    )

    dragPreviewManager.updatePreview(previewData, timelineWidth.value)
  } else {
    dragPreviewManager.hidePreview()
  }
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()
  console.log('🎯 [UnifiedTimeline] 时间轴接收到拖拽事件')

  // 清理统一预览
  dragPreviewManager.hidePreview()

  // 暂停播放以便进行拖拽操作
  pauseForEditing('时间轴拖拽放置')

  // 使用统一的拖拽工具检查数据类型
  const dragType = dragUtils.getDragDataType(event)

  switch (dragType) {
    case 'timeline-item': {
      const timelineItemData = event.dataTransfer?.getData('application/timeline-item')
      if (timelineItemData) {
        console.log('📦 [UnifiedTimeline] 处理时间轴项目拖拽')
        await handleTimelineItemDrop(event, JSON.parse(timelineItemData))
      }
      break
    }
    case 'media-item': {
      const mediaItemData = event.dataTransfer?.getData('application/media-item')
      if (mediaItemData) {
        console.log('📦 [UnifiedTimeline] 处理素材库拖拽')
        await handleMediaItemDrop(event, JSON.parse(mediaItemData))
      }
      break
    }
    default:
      console.log('❌ [UnifiedTimeline] 没有检测到有效的拖拽数据')
      dialogs.showInvalidDragWarning()
      break
  }

  // 使用统一的拖拽工具清理全局拖拽状态
  dragUtils.clearDragData()
}

// 处理时间轴项目拖拽放置
async function handleTimelineItemDrop(event: DragEvent, dragData: TimelineItemDragData) {
  console.log('🎯 [UnifiedTimeline] 处理时间轴项目拖拽放置:', dragData)

  // 使用统一的拖拽工具计算目标位置（考虑拖拽偏移量）
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

  // 验证轨道类型兼容性
  const draggedItem = unifiedStore.getTimelineItem(dragData.itemId)
  if (draggedItem) {
    const targetTrack = tracks.value.find((t) => t.id === targetTrackId)
    // unknown类型的素材不能拖拽到任何轨道
    if (
      targetTrack &&
      !isMediaCompatibleWithTrack(draggedItem.mediaType as MediaType, targetTrack.type)
    ) {
      // 获取媒体类型标签
      const mediaTypeLabels = {
        video: '视频',
        image: '图片',
        audio: '音频',
        text: '文本',
      }
      const mediaTypeLabel = mediaTypeLabels[draggedItem.mediaType as MediaType] || '未知'
      const trackTypeLabel = getTrackTypeLabel(targetTrack.type)

      // 根据媒体类型提供合适的建议
      let suggestion = ''
      switch (draggedItem.mediaType) {
        case 'video':
        case 'image':
          suggestion = '请将该片段拖拽到视频轨道。'
          break
        case 'audio':
          suggestion = '请将该片段拖拽到音频轨道。'
          break
        case 'text':
          suggestion = '请将该片段拖拽到文本轨道。'
          break
        default:
          suggestion = '请将该片段拖拽到兼容的轨道。'
      }

      dialogs.showOperationError(
        '拖拽失败',
        `${mediaTypeLabel}片段不能拖拽到${trackTypeLabel}轨道上。\n${suggestion}`,
      )
      return
    }
  }

  console.log('📍 [UnifiedTimeline] 拖拽目标位置:', {
    dragOffsetX: dragData.dragOffset.x,
    dropTime: dropTime.toFixed(2),
    targetTrackId,
    selectedItems: dragData.selectedItems,
  })

  // 执行移动操作
  try {
    if (dragData.selectedItems.length > 1) {
      // 多选拖拽
      console.log('🔄 [UnifiedTimeline] 执行多选项目移动')
      await moveMultipleItems(dragData.selectedItems, dropTime, targetTrackId, dragData.startTime)
    } else {
      // 单个拖拽
      console.log('🔄 [UnifiedTimeline] 执行单个项目移动')
      await moveSingleItem(dragData.itemId, dropTime, targetTrackId)
    }
    console.log('✅ [UnifiedTimeline] 时间轴项目移动完成')
  } catch (error) {
    console.error('❌ [UnifiedTimeline] 时间轴项目移动失败:', error)
  }
}

// 处理素材库拖拽放置
async function handleMediaItemDrop(event: DragEvent, mediaDragData: MediaItemDragData) {
  try {
    console.log('解析的素材拖拽数据:', mediaDragData)

    // 从store中获取完整的MediaItem信息
    const mediaItem = unifiedStore.getMediaItem(mediaDragData.mediaItemId)

    if (!mediaItem) {
      console.error('❌ 找不到对应的素材项目:', mediaDragData.mediaItemId)
      return
    }

    // 使用统一的拖拽工具计算目标位置
    const dropPosition = dragUtils.calculateDropPosition(event, timelineWidth.value)

    if (!dropPosition) {
      console.error('无法获取轨道区域信息')
      return
    }

    // 验证轨道类型兼容性
    const targetTrack = tracks.value.find((t) => t.id === dropPosition.targetTrackId)
    if (!targetTrack) {
      console.error('❌ 目标轨道不存在:', dropPosition.targetTrackId)
      return
    }

    // 文本类型不支持从素材库拖拽创建
    if (mediaItem.mediaType === 'text') {
      dialogs.showOperationError(
        '拖拽失败',
        '文本内容不能通过拖拽创建。\n请在文本轨道中右键选择"添加文本"。',
      )
      return
    }

    // 检查素材类型与轨道类型的兼容性
    if (
      !isMediaCompatibleWithTrack(mediaItem.mediaType as MediaType, targetTrack.type)
    ) {
      // 获取媒体类型标签
      const mediaTypeLabels: Record<MediaType, string> = {
        video: '视频',
        image: '图片',
        audio: '音频',
        text: '文本',
      }
      const mediaTypeLabel = mediaTypeLabels[mediaItem.mediaType as MediaType] || '未知'
      const trackTypeLabel = getTrackTypeLabel(targetTrack.type)

      // 根据媒体类型提供合适的建议
      let suggestion = ''
      switch (mediaItem.mediaType) {
        case 'video':
        case 'image':
          suggestion = '请将该素材拖拽到视频轨道。'
          break
        case 'audio':
          suggestion = '请将该素材拖拽到音频轨道。'
          break
        default:
          suggestion = '请将该素材拖拽到兼容的轨道。'
      }

      dialogs.showOperationError(
        '拖拽失败',
        `${mediaTypeLabel}素材不能拖拽到${trackTypeLabel}轨道上。\n${suggestion}`,
      )
      return
    }

    const { dropTime, targetTrackId } = dropPosition

    console.log(`🎯 拖拽素材到时间轴: ${mediaDragData.name}`)
    console.log(`📍 拖拽位置: 对应帧数: ${dropTime}, 目标轨道: ${targetTrackId}`)

    // 如果拖拽位置超出当前时间轴长度，动态扩展时间轴
    const bufferFrames = 300 // 预留10秒缓冲（300帧）
    unifiedStore.expandTimelineIfNeededFrames(dropTime + bufferFrames)

    await createMediaClipFromMediaItem(mediaItem.id, dropTime, targetTrackId)
  } catch (error) {
    console.error('Failed to parse media item data:', error)
    dialogs.showDragDataError()
  }
}

// ==================== 其他事件处理方法 ====================

function handleTimelineContainerClick(event: MouseEvent) {
  // 点击时间轴容器的空白区域取消所有选中
  const target = event.target as HTMLElement

  // 检查点击的是否是时间轴容器本身或其他空白区域
  // 排除点击在VideoClip、按钮、输入框等交互元素上的情况
  if (
    target.classList.contains('timeline') ||
    target.classList.contains('timeline-header') ||
    target.classList.contains('timeline-body') ||
    target.classList.contains('timeline-grid') ||
    target.classList.contains('grid-line') ||
    target.classList.contains('track-row')
  ) {
    try {
      // 使用带历史记录的清除选择
      unifiedStore.selectTimelineItemsWithHistory([], 'replace')
    } catch (error) {
      console.error('❌ 清除选择操作失败:', error)
      // 如果历史记录清除失败，回退到普通清除
      unifiedStore.clearAllSelections()
    }
  }
}

function handleContextMenu(event: MouseEvent) {
  event.preventDefault()

  // 更新菜单位置
  contextMenuOptions.value.x = event.clientX
  contextMenuOptions.value.y = event.clientY

  // 判断右键点击的目标类型
  const target = event.target as HTMLElement

  // 查找最近的片段元素
  const clipElement = target.closest('[data-timeline-item-id]') as HTMLElement
  if (clipElement) {
    // 点击在片段上
    const clipId = clipElement.getAttribute('data-timeline-item-id')
    if (clipId) {
      contextMenuType.value = 'clip'
      contextMenuTarget.value = { clipId, element: clipElement }
      showContextMenu.value = true
      return
    }
  }

  // 查找最近的轨道控制元素
  const trackControlElement = target.closest('.track-controls') as HTMLElement
  if (trackControlElement) {
    // 点击在轨道控制区域
    const trackRow = trackControlElement.closest('.track-row') as HTMLElement
    if (trackRow) {
      const trackIndex = Array.from(trackRow.parentElement?.children || []).indexOf(trackRow)
      const track = tracks.value[trackIndex]
      if (track) {
        contextMenuType.value = 'track'
        contextMenuTarget.value = { trackId: track.id, element: trackControlElement }
        showContextMenu.value = true
        return
      }
    }
  }

  // 查找轨道内容区域
  const trackContentElement = target.closest('.track-content') as HTMLElement
  if (trackContentElement) {
    // 点击在轨道内容区域（空白处）
    const trackRow = trackContentElement.closest('.track-row') as HTMLElement
    if (trackRow) {
      const trackIndex = Array.from(trackRow.parentElement?.children || []).indexOf(trackRow)
      const track = tracks.value[trackIndex]
      if (track) {
        contextMenuType.value = 'track'
        contextMenuTarget.value = { trackId: track.id, element: trackContentElement }
        showContextMenu.value = true
        return
      }
    }
  }

  // 默认情况：点击在空白区域
  contextMenuType.value = 'empty'
  contextMenuTarget.value = { element: target }
  showContextMenu.value = true
}

function handleWheel(event: WheelEvent) {
  if (event.altKey) {
    // Alt + 滚轮：缩放
    event.preventDefault()
    const zoomFactor = 1.1
    const rect = timelineBody.value?.getBoundingClientRect()
    if (!rect) {
      console.error('❌ 无法获取时间轴主体边界')
      return
    }

    // 获取鼠标在时间轴上的位置（减去轨道控制区域的150px）
    const mouseX = event.clientX - rect.left - 150
    const mouseFrames = unifiedStore.pixelToFrame(mouseX, timelineWidth.value)

    if (event.deltaY < 0) {
      // 向上滚动：放大
      unifiedStore.zoomIn(zoomFactor, timelineWidth.value)
    } else {
      // 向下滚动：缩小
      unifiedStore.zoomOut(zoomFactor, timelineWidth.value)
    }

    // 调整滚动偏移量，使鼠标位置保持在相同的帧数点
    const newMousePixel = unifiedStore.frameToPixel(mouseFrames, timelineWidth.value)
    const offsetAdjustment = newMousePixel - mouseX
    const newScrollOffset = unifiedStore.scrollOffset + offsetAdjustment

    unifiedStore.setScrollOffset(newScrollOffset, timelineWidth.value)
  } else if (event.shiftKey) {
    // Shift + 滚轮：水平滚动
    event.preventDefault()
    const scrollAmount = 50

    if (event.deltaY < 0) {
      // 向上滚动：向左滚动
      unifiedStore.scrollLeft(scrollAmount, timelineWidth.value)
    } else {
      // 向下滚动：向右滚动
      unifiedStore.scrollRight(scrollAmount, timelineWidth.value)
    }
  } else {
    // 普通滚轮：垂直滚动（让浏览器处理默认的滚动行为）
    // 不阻止默认行为，允许正常的垂直滚动
  }
}

async function handleTimelineClick(event: MouseEvent) {
  // 点击轨道内容空白区域取消所有选中（包括单选和多选）
  const target = event.target as HTMLElement
  if (target.classList.contains('track-content')) {
    // 阻止事件冒泡，避免触发容器的点击事件
    event.stopPropagation()

    try {
      // 使用带历史记录的清除选择
      await unifiedStore.selectTimelineItemsWithHistory([], 'replace')
    } catch (error) {
      console.error('❌ 清除选择操作失败:', error)
      // 如果历史记录清除失败，回退到普通清除
      unifiedStore.clearAllSelections()
    }
  }
}

function handleSelectClip(clipId: string) {
  console.log('🎯 [UnifiedTimeline] 选中clip:', clipId)
  try {
    // 使用unifiedStore的选择方法
    unifiedStore.selectTimelineItem(clipId)
  } catch (error) {
    console.error('❌ 选中clip失败:', error)
  }
}

function handleTimelineItemDoubleClick(id: string) {
  // 处理时间轴项目双击
  console.log('Timeline item double click:', id)
}

function handleTimelineItemContextMenu(event: MouseEvent, id: string) {
  // 处理时间轴项目右键菜单
  event.preventDefault()
  contextMenuOptions.value.x = event.clientX
  contextMenuOptions.value.y = event.clientY
  contextMenuType.value = 'clip'
  contextMenuTarget.value = { clipId: id }
  showContextMenu.value = true
}

// 拖拽开始处理现在由UnifiedTimelineClip内部处理

function handleTimelineItemResizeStart(
  event: MouseEvent,
  itemId: string,
  direction: 'left' | 'right',
) {
  // 处理时间轴项目调整大小开始
  console.log('🔧 [UnifiedTimeline] 时间轴项目开始调整大小:', {
    itemId,
    direction,
    clientX: event.clientX,
    clientY: event.clientY,
  })

  // 暂停播放以便进行编辑
  pauseForEditing('片段大小调整')

  // 确保项目被选中（如果还没有选中的话）
  if (!unifiedStore.isTimelineItemSelected(itemId)) {
    unifiedStore.selectTimelineItem(itemId)
  }

  // 隐藏任何活动的工具提示
  // 这里可以添加隐藏工具提示的逻辑，如果需要的话

  // 可以在这里添加全局resize状态管理，比如：
  // - 设置全局resize状态标志
  // - 添加全局鼠标事件监听器（如果需要在timeline级别处理）
  // - 显示resize指导线或其他UI反馈

  // 注意：实际的resize逻辑已经在UnifiedTimelineClip组件内部处理
  // 这个函数主要用于timeline级别的状态管理和UI反馈
}

// 拖拽预览现在由UnifiedTimelineClip内部处理

// ==================== 辅助函数 ====================

// 使用统一的拖拽工具中的兼容性检查函数
function isMediaCompatibleWithTrack(mediaType: MediaType, trackType: UnifiedTrackType): boolean {
  return dragUtils.isMediaCompatibleWithTrack(mediaType, trackType)
}

// 检测素材库拖拽的重叠冲突
function detectMediaItemConflicts(
  dropTime: number,
  targetTrackId: string,
  duration: number,
): ConflictInfo[] {
  // 获取目标轨道上的所有项目
  const trackItems = unifiedStore.getTimelineItemsByTrack(targetTrackId)
  const dragEndTime = dropTime + duration

  // 使用统一的冲突检测工具
  return detectTrackConflicts(
    dropTime,
    dragEndTime,
    trackItems,
    [], // 没有需要排除的项目
  )
}

function detectTimelineConflicts(
  dropTime: number,
  targetTrackId: string,
  dragData: TimelineItemDragData,
): ConflictInfo[] {
  // 获取目标轨道上的所有项目
  const trackItems = unifiedStore.getTimelineItemsByTrack(targetTrackId)

  // 计算拖拽项目的时长
  const draggedItem = unifiedStore.getTimelineItem(dragData.itemId)
  if (!draggedItem) return []

  const dragDuration =
    draggedItem.timeRange.timelineEndTime - draggedItem.timeRange.timelineStartTime // 帧数
  const dragEndTime = dropTime + dragDuration

  // 使用统一的冲突检测工具
  return detectTrackConflicts(
    dropTime,
    dragEndTime,
    trackItems,
    dragData.selectedItems, // 排除正在拖拽的项目
  )
}

// 统一的冲突检测工具
function detectTrackConflicts(
  startTime: number,
  endTime: number,
  trackItems: UnifiedTimelineItemData[],
  excludeItems: string[] = [],
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = []

  for (const item of trackItems) {
    // 跳过被排除的项目
    if (excludeItems.includes(item.id)) {
      continue
    }

    const itemStart = item.timeRange.timelineStartTime
    const itemEnd = item.timeRange.timelineEndTime

    // 检查时间重叠
    if (startTime < itemEnd && endTime > itemStart) {
      conflicts.push({
        itemId: item.id,
        startTime: Math.max(startTime, itemStart),
        endTime: Math.min(endTime, itemEnd),
      } as ConflictInfo)
    }
  }

  return conflicts
}

// 移动单个项目
async function moveSingleItem(itemId: string, newTimeFrames: number, newTrackId: string) {
  // newTimeFrames 是帧数，直接传给 handleTimelineItemPositionUpdate
  await handleTimelineItemPositionUpdate(itemId, newTimeFrames, newTrackId)
}

// 移动多个项目（保持相对位置）
async function moveMultipleItems(
  itemIds: string[],
  newTimeFrames: number,
  newTrackId: string,
  originalStartTimeFrames: number,
) {
  console.log('🔄 [UnifiedTimeline] 开始批量移动项目:', {
    itemIds,
    newTimeFrames,
    newTrackId,
    originalStartTimeFrames,
  })

  // 计算时间偏移量（帧数）
  const timeOffsetFrames = newTimeFrames - originalStartTimeFrames

  // 批量移动所有选中的项目
  for (const itemId of itemIds) {
    const item = unifiedStore.getTimelineItem(itemId)
    if (item) {
      const currentStartTimeFrames = item.timeRange.timelineStartTime // 帧数
      const newStartTimeFrames = currentStartTimeFrames + timeOffsetFrames

      // 确保新位置不为负数（防止多选拖拽时某些项目被拖到负数时间轴）
      const clampedNewStartTimeFrames = Math.max(0, newStartTimeFrames)

      // 对于第一个项目，使用目标轨道；其他项目保持相对轨道关系
      const targetTrack = itemId === itemIds[0] ? newTrackId : item.trackId

      // 直接传递帧数给 handleTimelineItemPositionUpdate
      await handleTimelineItemPositionUpdate(itemId, clampedNewStartTimeFrames, targetTrack)
    }
  }
}

async function handleTimelineItemPositionUpdate(
  timelineItemId: string,
  newPositionFrames: number,
  newTrackId?: string,
) {
  // 使用带历史记录的移动方法
  await unifiedStore.moveTimelineItemWithHistory(timelineItemId, newPositionFrames, newTrackId)
}

// 从素材库项创建时间轴项目 - 适配统一架构
async function createMediaClipFromMediaItem(
  mediaItemId: string,
  startTimeFrames: number, // 帧数
  trackId?: string,
): Promise<void> {
  console.log('🔧 [UnifiedTimeline] 创建时间轴项目从素材库:', mediaItemId)

  // 如果没有指定轨道ID，使用第一个轨道
  if (!trackId) {
    const firstTrack = tracks.value[0]
    if (firstTrack) {
      trackId = firstTrack.id
    } else {
      throw new Error('没有可用的轨道')
    }
  }

  try {
    // 等待WebAV初始化完成
    console.log('等待WebAV初始化完成...')
    await unifiedStore.waitForWebAVReady() // 阻塞直到WebAV初始化完成

    // 获取对应的MediaItem
    const storeMediaItem = unifiedStore.getMediaItem(mediaItemId)
    if (!storeMediaItem) {
      throw new Error('找不到对应的素材项目')
    }

    // 检查素材状态和拖拽条件
    const isReady = UnifiedMediaItemQueries.isReady(storeMediaItem)
    const hasError = UnifiedMediaItemQueries.hasError(storeMediaItem)

    // 只阻止错误状态的素材
    if (hasError) {
      throw new Error('素材解析失败，无法添加到时间轴')
    }

    // 检查媒体类型是否已知 - 阻止未知类型素材创建时间轴项目
    if (storeMediaItem.mediaType === 'unknown') {
      throw new Error('素材类型未确定，请等待检测完成')
    }

    // 现在 mediaType 已经确定不是 'unknown'，可以安全地转换为 MediaType
    const knownMediaType = storeMediaItem.mediaType as MediaType

    // 检查是否有可用的时长信息
    const availableDuration = storeMediaItem.duration
    if (!availableDuration || availableDuration <= 0) {
      throw new Error('素材时长信息不可用，请等待解析完成')
    }

    // 根据素材状态确定时间轴项目状态
    const timelineStatus: TimelineItemStatus = isReady ? 'ready' : 'loading'

    console.log(
      '🎬 [UnifiedTimeline] 创建时间轴项目 for mediaItem:',
      storeMediaItem.id,
      'type:',
      knownMediaType,
    )

    // 获取媒体的原始分辨率（仅对视觉媒体有效）
    let originalResolution: { width: number; height: number } | null = null
    if (UnifiedMediaItemQueries.isVideo(storeMediaItem)) {
      originalResolution = unifiedStore.getVideoOriginalResolution(storeMediaItem.id) || null
      console.log('📐 [UnifiedTimeline] 视频原始分辨率:', originalResolution)
    } else if (UnifiedMediaItemQueries.isImage(storeMediaItem)) {
      originalResolution = unifiedStore.getImageOriginalResolution(storeMediaItem.id) || null
      console.log('📐 [UnifiedTimeline] 图片原始分辨率:', originalResolution)
    } else if (UnifiedMediaItemQueries.isAudio(storeMediaItem)) {
      console.log('🎵 [UnifiedTimeline] 音频类型，无需设置分辨率')
    }

    // 创建增强的默认配置
    const config = createEnhancedDefaultConfig(
      knownMediaType,
      originalResolution,
    )

    // 创建时间轴项目数据
    const timelineItemData: UnifiedTimelineItemData = {
      id: generateId(),
      mediaItemId: storeMediaItem.id,
      trackId: trackId,
      mediaType: knownMediaType,
      timeRange: {
        timelineStartTime: startTimeFrames,
        timelineEndTime: startTimeFrames + availableDuration,
        clipStartTime: 0,
        clipEndTime: availableDuration,
      },
      config: config,
      animation: undefined, // 新创建的项目默认没有动画
      timelineStatus: timelineStatus, // 根据素材状态设置时间轴项目状态
      runtime: {}, // 添加必需的 runtime 字段
      // 如果统一架构支持，添加媒体名称
      ...(storeMediaItem.name && { mediaName: storeMediaItem.name }),
    }

    console.log('🔄 [UnifiedTimeline] 时间轴项目数据:', {
      id: timelineItemData.id,
      mediaType: timelineItemData.mediaType,
      timeRange: timelineItemData.timeRange,
      config: Object.keys(config),
    })

    // 添加到store（使用带历史记录的方法）
    console.log(
      `📝 [UnifiedTimeline] 添加时间轴项目: ${storeMediaItem.name} -> 轨道${trackId}, 位置${Math.max(0, startTimeFrames)}帧`,
    )
    await unifiedStore.addTimelineItemWithHistory(timelineItemData)

    console.log(`✅ [UnifiedTimeline] 时间轴项目创建完成: ${timelineItemData.id}`)
  } catch (error) {
    console.error('❌ [UnifiedTimeline] 创建时间轴项目失败:', error)
    dialogs.showOperationError('创建时间轴项目', (error as Error).message)
  }
}

// 创建增强的默认配置 - 考虑原始分辨率
function createEnhancedDefaultConfig(
  mediaType: MediaType,
  originalResolution: { width: number; height: number } | null,
): GetTimelineItemConfig<MediaType> {
  // 根据媒体类型创建对应的默认配置
  switch (mediaType) {
    case 'video': {
      const defaultWidth = originalResolution?.width || 1920
      const defaultHeight = originalResolution?.height || 1080

      return {
        // 视觉属性
        x: 0, // 居中位置（项目坐标系，中心原点）
        y: 0, // 居中位置
        width: defaultWidth,
        height: defaultHeight,
        rotation: 0,
        opacity: 1,
        // 原始尺寸
        originalWidth: defaultWidth,
        originalHeight: defaultHeight,
        // 等比缩放状态（默认开启）
        proportionalScale: true,
        // 音频属性
        volume: 1,
        isMuted: false,
        // 基础属性
        zIndex: 0,
      } as VideoMediaConfig
    }

    case 'image': {
      const defaultWidth = originalResolution?.width || 1920
      const defaultHeight = originalResolution?.height || 1080

      return {
        // 视觉属性
        x: 0, // 居中位置（项目坐标系，中心原点）
        y: 0, // 居中位置
        width: defaultWidth,
        height: defaultHeight,
        rotation: 0,
        opacity: 1,
        // 原始尺寸
        originalWidth: defaultWidth,
        originalHeight: defaultHeight,
        // 等比缩放状态（默认开启）
        proportionalScale: true,
        // 基础属性
        zIndex: 0,
      } as ImageMediaConfig
    }

    case 'audio':
      return {
        // 音频属性
        volume: 1,
        isMuted: false,
        gain: 0, // 默认增益为0dB
        // 基础属性
        zIndex: 0,
      } as AudioMediaConfig

    case 'text':
      return {
        // 文本属性
        text: '新文本',
        style: {
          fontSize: 48,
          fontFamily: 'Arial, sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#ffffff',
          textAlign: 'center',
          lineHeight: 1.2,
        },
        // 视觉属性
        x: 0, // 居中位置
        y: 0, // 居中位置
        width: 400,
        height: 100,
        rotation: 0,
        opacity: 1,
        originalWidth: 400,
        originalHeight: 100,
        proportionalScale: true,
        // 基础属性
        zIndex: 0,
      } as TextMediaConfig

    default:
      // 由于类型系统已经约束为 MediaType，不应该到达这里
      throw new Error(`不支持的媒体类型: ${mediaType}`)
  }
}

// 类型安全的时间轴项目渲染函数
function renderTimelineItem(item: UnifiedTimelineItemData | any, track: any) {
  // 统一架构使用 UnifiedTimelineClip 组件，它内部通过 ContentRendererFactory 动态选择渲染器
  const commonProps = {
    // UnifiedTimelineClip 需要的属性
    data: item,
    'is-selected': unifiedStore.isTimelineItemSelected(item.id),
    'current-frame': unifiedStore.currentFrame,
    scale: 1,
    'track-height': track.height,
    'timeline-width': timelineWidth.value, // 传递时间轴宽度用于坐标转换
    // 事件处理
    onSelect: handleSelectClip,
    onDoubleClick: (id: string) => handleTimelineItemDoubleClick(id),
    onContextMenu: (event: MouseEvent, id: string) => handleTimelineItemContextMenu(event, id),
    // 拖拽现在由UnifiedTimelineClip内部处理，不需要事件监听器
    onResizeStart: handleTimelineItemResizeStart,
  }

  // 统一使用 UnifiedTimelineClip，它会根据 mediaType 自动选择合适的渲染器
  return h(UnifiedTimelineClip, commonProps)
}

async function handleTimelineItemRemove(timelineItemId: string) {
  const item = unifiedStore.getTimelineItem(timelineItemId)
  if (item) {
    const mediaItem = unifiedStore.getMediaItem(item.mediaItemId)
    console.log(`🗑️ 准备从时间轴删除项目: ${mediaItem?.name || '未知'} (ID: ${timelineItemId})`)

    // 使用统一架构的删除方法
    await unifiedStore.removeTimelineItemWithHistory(timelineItemId)
    console.log(`✅ 时间轴项目删除完成: ${timelineItemId}`)
  }
}

// ==================== 右键菜单操作函数 ====================

async function removeClip() {
  if (contextMenuTarget.value.clipId) {
    await handleTimelineItemRemove(contextMenuTarget.value.clipId)
    showContextMenu.value = false
  }
}

async function duplicateClip() {
  if (contextMenuTarget.value.clipId) {
    try {
      await unifiedStore.duplicateTimelineItemWithHistory(contextMenuTarget.value.clipId)
      console.log('✅ 时间轴项目复制成功')
    } catch (error) {
      console.error('❌ 复制时间轴项目时出错:', error)
    }
    showContextMenu.value = false
  }
}

async function regenerateThumbnail() {
  if (contextMenuTarget.value.clipId) {
    try {
      const timelineItem = unifiedStore.getTimelineItem(contextMenuTarget.value.clipId)
      const mediaItem = timelineItem ? unifiedStore.getMediaItem(timelineItem.mediaItemId) : null

      // 只对本地时间轴项目进行缩略图重新生成
      if (timelineItem && mediaItem) {
        // 尝试使用统一架构的缩略图重新生成功能
        if ((unifiedStore as any).regenerateThumbnailForTimelineItem) {
          const newThumbnailUrl = await (unifiedStore as any).regenerateThumbnailForTimelineItem(
            timelineItem,
            mediaItem,
          )
          if (newThumbnailUrl) {
            console.log('✅ 缩略图重新生成成功')
          }
        } else {
          // 回退到导入缩略图生成器
          const { generateThumbnailForUnifiedMediaItem } = await import(
            '../../unified/utils/thumbnailGenerator'
          )
          const newThumbnailUrl = await generateThumbnailForUnifiedMediaItem(mediaItem)

          if (newThumbnailUrl) {
            // 更新缩略图URL（如果统一架构支持）
            if ('thumbnailUrl' in timelineItem) {
              // 清理旧的缩略图URL
              if ((timelineItem as any).thumbnailUrl) {
                URL.revokeObjectURL((timelineItem as any).thumbnailUrl)
              }
              // 更新缩略图URL
              ;(timelineItem as any).thumbnailUrl = newThumbnailUrl
            }
            console.log('✅ 缩略图重新生成成功')
          }
        }
      }
    } catch (error) {
      console.error('❌ 重新生成缩略图失败:', error)
    }
    showContextMenu.value = false
  }
}

function renameTrack() {
  if (contextMenuTarget.value.trackId) {
    const track = tracks.value.find((t) => t.id === contextMenuTarget.value.trackId)
    if (track) {
      startRename(track)
    }
    showContextMenu.value = false
  }
}

async function removeTrack(trackId: string) {
  try {
    // 检查轨道是否存在
    const track = tracks.value.find((t) => t.id === trackId)
    if (!track) {
      console.error('❌ 找不到要删除的轨道:', trackId)
      return
    }

    // 使用带历史记录的删除方法
    await unifiedStore.removeTrackWithHistory(trackId)
    console.log('✅ 轨道删除成功:', trackId)
  } catch (error) {
    console.error('❌ 删除轨道时出错:', error)
    dialogs.showOperationError('删除轨道', (error as Error).message)
  } finally {
    showContextMenu.value = false
  }
}

// 在指定位置创建文本项目
async function createTextAtPosition(trackId: string) {
  try {
    console.log('🔄 [UnifiedTimeline] 开始创建文本项目:', { trackId })

    // 计算时间位置（使用右键点击的位置）
    const timePosition = getTimePositionFromContextMenu()

    // 导入统一架构的文本时间轴工具函数
    const { createTextTimelineItem } = await import('../utils/textTimelineUtils')

    // 创建文本时间轴项目（使用工具函数，对齐旧架构）
    const textItem = await createTextTimelineItem(
      '默认文本', // 默认文本内容
      { fontSize: 48, color: '#ffffff' }, // 默认样式
      timePosition, // 开始时间（帧数）
      trackId, // 轨道ID
      150, // 默认时长（5秒@30fps）
      unifiedStore.videoResolution, // 视频分辨率
    )

    // 添加到时间轴（带历史记录）
    await unifiedStore.addTimelineItemWithHistory(textItem)

    console.log('✅ [UnifiedTimeline] 文本项目创建成功:', {
      id: textItem.id,
      text: textItem.config.text,
      position: timePosition,
    })

    // 选中新创建的文本项目
    unifiedStore.selectTimelineItem(textItem.id)
  } catch (error) {
    console.error('❌ [UnifiedTimeline] 创建文本项目失败:', error)
    dialogs.showOperationError('创建文本项目', (error as Error).message)
  } finally {
    showContextMenu.value = false
  }
}

// 从右键菜单上下文获取时间位置
function getTimePositionFromContextMenu(): number {
  // 获取右键点击的位置
  const clickX = contextMenuOptions.value.x

  // 计算相对于时间轴内容区域的位置
  const timelineBodyRect = timelineBody.value?.getBoundingClientRect()
  if (!timelineBodyRect) {
    console.warn('⚠️ 无法获取时间轴主体边界，使用默认位置')
    return 0
  }

  // 减去轨道控制区域的宽度（150px）
  const relativeX = clickX - timelineBodyRect.left - 150

  // 转换为帧数
  const timeFrames = unifiedStore.pixelToFrame(relativeX, timelineWidth.value)

  // 确保时间位置不为负数
  return Math.max(0, Math.round(timeFrames))
}

// ==================== 键盘事件处理 ====================

function handleKeyDown(event: KeyboardEvent) {
  // 检查是否有修饰键，如果有则不处理（让全局快捷键处理）
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
    return
  }

  // 按 Escape 键取消选中
  if (event.key === 'Escape') {
    unifiedStore.selectTimelineItem(null)
  }

  // 按 Delete 键删除选中的项目
  if (event.key === 'Delete') {
    const selectedItems = unifiedStore.selectedTimelineItemIds
    if (selectedItems.size > 0) {
      selectedItems.forEach((itemId: string) => {
        handleTimelineItemRemove(itemId)
      })
    }
  }
}

// ==================== 冲突检测和视觉反馈增强 ====================

// 处理拖拽离开事件
function handleDragLeave(event: DragEvent) {
  // 只有当真正离开时间轴区域时才隐藏预览
  const relatedTarget = event.relatedTarget as Element
  const timelineElement = event.currentTarget as Element

  if (!timelineElement.contains(relatedTarget)) {
    dragPreviewManager.hidePreview()
  }
}

// 生命周期钩子
onMounted(() => {
  updateTimelineWidth()
  window.addEventListener('resize', updateTimelineWidth)
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateTimelineWidth)
  window.removeEventListener('keydown', handleKeyDown)
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

<template>
  <div class="timeline" @click="handleTimelineContainerClick" @contextmenu="handleContextMenu">
    <!-- 顶部区域：轨道管理器头部 + 时间刻度 -->
    <div class="timeline-header">
      <div class="track-manager-header">
        <h3>轨道</h3>
        <button class="add-track-btn" @click="addNewTrack" title="添加新轨道">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
          </svg>
        </button>
      </div>
      <div class="timeline-scale">
        <TimeScale />
      </div>
    </div>

    <!-- 主体区域：每个轨道一行，包含左侧控制和右侧内容 -->
    <div class="timeline-body" ref="timelineBody">
      <!-- 每个轨道一行 -->
      <div
        v-for="track in tracks"
        :key="track.id"
        class="track-row"
        :style="{ height: track.height + 'px' }"
      >
        <!-- 左侧轨道控制 -->
        <div class="track-controls">
          <!-- 轨道名称 -->
          <div class="track-name">
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
              :title="'双击编辑轨道名称'"
            >
              {{ track.name }}
            </span>
          </div>

          <!-- 控制按钮已移至右键菜单 -->
          <div class="track-buttons">
            <!-- 轨道快捷操作按钮 -->
            <div class="track-status">
              <!-- 可见性切换按钮 -->
              <button
                class="status-btn"
                :class="{ active: track.isVisible }"
                :title="track.isVisible ? '隐藏轨道' : '显示轨道'"
                @click="toggleVisibility(track.id)"
              >
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
              </button>

              <!-- 静音切换按钮 -->
              <button
                class="status-btn"
                :class="{ active: !track.isMuted }"
                :title="track.isMuted ? '取消静音' : '静音轨道'"
                @click="toggleMute(track.id)"
              >
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
              </button>

              <!-- 片段数量指示器 -->
              <div
                class="clip-count"
                :title="`该轨道有 ${getClipsForTrack(track.id).length} 个片段`"
              >
                {{ getClipsForTrack(track.id).length }}
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧轨道内容区域 -->
        <div
          class="track-content"
          :class="{ 'track-hidden': !track.isVisible }"
          :data-track-id="track.id"
          @dragover="handleDragOver"
          @drop="handleDrop"
          @click="handleTimelineClick"
          @wheel="handleWheel"
        >
          <!-- 该轨道的时间轴项目 -->
          <VideoClip
            v-for="item in getClipsForTrack(track.id)"
            :key="item.id"
            :timeline-item="item"
            :track="track"
            :timeline-width="timelineWidth"
            :total-duration-frames="videoStore.totalDurationFrames"
            @update-position="handleTimelineItemPositionUpdate"
            @remove="handleTimelineItemRemove"
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
  </div>

  <!-- 统一右键菜单 -->
  <ContextMenu v-model:show="showContextMenu" :options="contextMenuOptions">
    <template v-for="(item, index) in currentMenuItems" :key="index">
      <ContextMenuSeparator v-if="'type' in item && item.type === 'separator'" />
      <ContextMenuItem v-else-if="'label' in item" :label="item.label" @click="item.onClick">
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
    </template>
  </ContextMenu>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, markRaw, reactive } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { useWebAVControls, waitForWebAVReady, isWebAVReady } from '../composables/useWebAVControls'
import { usePlaybackControls } from '../composables/usePlaybackControls'
import { getDragPreviewManager } from '../composables/useDragPreview'
import { useDragUtils } from '../composables/useDragUtils'
import { useDialogs } from '../composables/useDialogs'
import { VideoVisibleSprite } from '../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../utils/ImageVisibleSprite'
import { createSpriteFromMediaItem } from '../utils/spriteFactory'
import { webavToProjectCoords } from '../utils/coordinateTransform'
import { calculatePixelsPerFrame } from '../stores/utils/timeUtils'
import { calculateVisibleFrameRange } from '../stores/utils/coordinateUtils'

import { generateThumbnailForMediaItem } from '../utils/thumbnailGenerator'
import type { TimelineItem, TimelineItemDragData, MediaItemDragData, ConflictInfo } from '../types'
import VideoClip from './VideoClip.vue'
import TimeScale from './TimeScale.vue'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '@imengyu/vue3-context-menu'

// 菜单项类型定义
type MenuItem =
  | {
      label: string
      icon: string
      onClick: () => void
    }
  | {
      type: 'separator'
    }

// Component name for Vue DevTools
defineOptions({
  name: 'TimelineEditor',
})

const videoStore = useVideoStore()
const webAVControls = useWebAVControls()
const { pauseForEditing } = usePlaybackControls()
const dragPreviewManager = getDragPreviewManager()
const dragUtils = useDragUtils()
const dialogs = useDialogs()

const timelineBody = ref<HTMLElement>()
const timelineWidth = ref(800)

const tracks = computed(() => videoStore.tracks)

// 编辑轨道名称相关
const editingTrackId = ref<number | null>(null)
const editingTrackName = ref('')
let nameInput: HTMLInputElement | null = null

// 右键菜单相关
const showContextMenu = ref(false)
const contextMenuType = ref<'clip' | 'track' | 'empty'>('empty')
const contextMenuTarget = ref<{
  clipId?: string
  trackId?: number
  element?: HTMLElement
}>({})

const contextMenuOptions = ref({
  x: 0,
  y: 0,
  theme: 'mac dark',
  zIndex: 1000,
})

// 菜单配置 - 预定义避免每次渲染重新创建
const menuConfigs: Record<string, MenuItem[]> = {
  clip: [
    {
      label: '复制片段',
      icon: 'M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z',
      onClick: () => duplicateClip(),
    },
    {
      label: '重新生成缩略图',
      icon: 'M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z',
      onClick: () => regenerateThumbnail(),
    },
    { type: 'separator' },
    {
      label: '删除片段',
      icon: 'M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z',
      onClick: () => removeClip(),
    },
  ],
  track: [], // 轨道菜单使用动态配置
  empty: [
    {
      label: '添加新轨道',
      icon: 'M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z',
      onClick: () => addNewTrack(),
    },
  ],
}

// 动态轨道菜单配置
const getTrackMenuItems = (): MenuItem[] => {
  const trackId = contextMenuTarget.value.trackId
  if (!trackId) return []

  const track = tracks.value.find((t) => t.id === trackId)
  if (!track) return []

  const hasClips = getClipsForTrack(trackId).length > 0
  const canDelete = tracks.value.length > 1

  return [
    {
      label: '重命名轨道',
      icon: 'M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z',
      onClick: () => renameTrack(),
    },
    {
      label: hasClips ? '自动排列片段' : '自动排列片段（无片段）',
      icon: 'M3,3H21V5H3V3M3,7H15V9H3V7M3,11H21V13H3V11M3,15H15V17H3V15M3,19H21V21H3V19Z',
      onClick: hasClips ? () => autoArrangeTrack(trackId) : () => {},
    },
    {
      label: track.isVisible ? '隐藏轨道' : '显示轨道',
      icon: track.isVisible
        ? 'M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z'
        : 'M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.09L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.76,7.13 11.37,7 12,7Z',
      onClick: () => toggleVisibility(trackId),
    },
    {
      label: track.isMuted ? '取消静音' : '静音轨道',
      icon: track.isMuted
        ? 'M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z'
        : 'M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z',
      onClick: () => toggleMute(trackId),
    },
    ...(canDelete
      ? [
          { type: 'separator' } as MenuItem,
          {
            label: '删除轨道',
            icon: 'M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z',
            onClick: () => removeTrack(trackId),
          } as MenuItem,
        ]
      : []),
  ]
}

// 当前菜单项配置
const currentMenuItems = computed(() => {
  if (contextMenuType.value === 'track') {
    return getTrackMenuItems()
  }
  return menuConfigs[contextMenuType.value] || []
})

// 获取指定轨道的时间轴项目
function getClipsForTrack(trackId: number) {
  return videoStore.getTimelineItemsForTrack(trackId)
}

// 轨道管理方法
async function addNewTrack() {
  try {
    const newTrackId = await videoStore.addTrackWithHistory()
    if (newTrackId) {
      console.log('✅ 轨道添加成功，新轨道ID:', newTrackId)
    } else {
      console.error('❌ 轨道添加失败')
    }
  } catch (error) {
    console.error('❌ 添加轨道时出错:', error)
  }
}

async function removeTrack(trackId: number) {
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

async function toggleVisibility(trackId: number) {
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

async function toggleMute(trackId: number) {
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

async function autoArrangeTrack(trackId: number) {
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

async function startRename(track: { id: number; name: string }) {
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

// 网格线
const gridLines = computed(() => {
  const lines = []
  const totalDurationFrames = videoStore.totalDurationFrames
  const pixelsPerFrame = calculatePixelsPerFrame(
    timelineWidth.value,
    totalDurationFrames,
    videoStore.zoomLevel,
  )
  const pixelsPerSecond = pixelsPerFrame * videoStore.frameRate

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
    videoStore.zoomLevel,
    videoStore.scrollOffset,
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

  // 使用统一的拖拽工具获取素材拖拽数据
  const mediaDragData = dragUtils.getCurrentMediaItemDragData()
  if (mediaDragData) {
    // 检测素材库拖拽的重叠冲突
    const conflicts = detectMediaItemConflicts(dropTime, targetTrackId, mediaDragData.duration)
    const isConflict = conflicts.length > 0

    // 使用统一的拖拽工具创建预览数据
    const previewData = dragUtils.createDragPreviewData(
      mediaDragData.name,
      mediaDragData.duration,
      dropTime,
      targetTrackId,
      isConflict,
      false,
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

  // 获取拖拽项目信息
  const draggedItem = videoStore.getTimelineItem(currentDragData.itemId)
  if (draggedItem) {
    const duration = draggedItem.timeRange.timelineEndTime - draggedItem.timeRange.timelineStartTime // 帧数

    // 检测冲突
    const conflicts = detectTimelineConflicts(clipStartTime, targetTrackId, currentDragData)
    const isConflict = conflicts.length > 0

    // 获取显示名称
    const mediaItem = videoStore.getMediaItem(draggedItem.mediaItemId)
    const name = mediaItem?.name || 'Clip'

    // 使用统一的拖拽工具创建预览数据
    const previewData = dragUtils.createDragPreviewData(
      name,
      duration,
      clipStartTime,
      targetTrackId,
      isConflict,
      currentDragData.selectedItems.length > 1,
      currentDragData.selectedItems.length,
    )

    dragPreviewManager.updatePreview(previewData, timelineWidth.value)
  } else {
    dragPreviewManager.hidePreview()
  }
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()
  console.log('🎯 [Timeline] 时间轴接收到拖拽事件')

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
        console.log('📦 [Timeline] 处理时间轴项目拖拽')
        await handleTimelineItemDrop(event, JSON.parse(timelineItemData))
      }
      break
    }
    case 'media-item': {
      const mediaItemData = event.dataTransfer?.getData('application/media-item')
      if (mediaItemData) {
        console.log('📦 [Timeline] 处理素材库拖拽')
        await handleMediaItemDrop(event, JSON.parse(mediaItemData))
      }
      break
    }
    default:
      console.log('❌ [Timeline] 没有检测到有效的拖拽数据')
      dialogs.showInvalidDragWarning()
      break
  }

  // 使用统一的拖拽工具清理全局拖拽状态
  dragUtils.clearDragData()
}

// 处理时间轴项目拖拽放置
async function handleTimelineItemDrop(event: DragEvent, dragData: TimelineItemDragData) {
  console.log('🎯 [Timeline] 处理时间轴项目拖拽放置:', dragData)

  // 使用统一的拖拽工具计算目标位置（考虑拖拽偏移量）
  const dropPosition = dragUtils.calculateDropPosition(
    event,
    timelineWidth.value,
    dragData.dragOffset,
  )

  if (!dropPosition) {
    console.error('❌ [Timeline] 无法找到目标轨道')
    return
  }

  const { dropTime, targetTrackId } = dropPosition

  console.log('📍 [Timeline] 拖拽目标位置:', {
    dragOffsetX: dragData.dragOffset.x,
    dropTime: dropTime.toFixed(2),
    targetTrackId,
    selectedItems: dragData.selectedItems,
  })

  // 执行移动操作
  try {
    if (dragData.selectedItems.length > 1) {
      // 多选拖拽
      console.log('🔄 [Timeline] 执行多选项目移动')
      await moveMultipleItems(dragData.selectedItems, dropTime, targetTrackId, dragData.startTime)
    } else {
      // 单个拖拽
      console.log('🔄 [Timeline] 执行单个项目移动')
      await moveSingleItem(dragData.itemId, dropTime, targetTrackId)
    }
    console.log('✅ [Timeline] 时间轴项目移动完成')
  } catch (error) {
    console.error('❌ [Timeline] 时间轴项目移动失败:', error)
  }
}

// 处理素材库拖拽放置（使用统一的精简格式）
async function handleMediaItemDrop(event: DragEvent, mediaDragData: MediaItemDragData) {
  try {
    console.log('解析的素材拖拽数据:', mediaDragData)

    // 从store中获取完整的MediaItem信息
    const mediaItem = videoStore.getMediaItem(mediaDragData.mediaItemId)
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

    const { dropTime, targetTrackId } = dropPosition

    console.log(`🎯 拖拽素材到时间轴: ${mediaDragData.name}`)
    console.log(`📍 拖拽位置: 对应帧数: ${dropTime}, 目标轨道: ${targetTrackId}`)

    // 如果拖拽位置超出当前时间轴长度，动态扩展时间轴
    const bufferFrames = 300 // 预留10秒缓冲（300帧）
    videoStore.expandTimelineIfNeededFrames(dropTime + bufferFrames)

    // 构建createMediaClipFromMediaItem需要的参数格式
    const mediaItemForCreation = {
      id: mediaItem.id,
      url: mediaItem.url,
      name: mediaItem.name,
      duration: mediaItem.duration,
      mediaType: mediaItem.mediaType,
      fileInfo: {
        name: mediaItem.file.name,
        type: mediaItem.file.type,
        lastModified: mediaItem.file.lastModified,
      },
    }

    // 从素材库项创建媒体片段（视频或图片）
    await createMediaClipFromMediaItem(mediaItemForCreation, dropTime, targetTrackId)
  } catch (error) {
    console.error('Failed to parse media item data:', error)
    dialogs.showDragDataError()
  }
}

// 移动单个项目
async function moveSingleItem(itemId: string, newTimeFrames: number, newTrackId: number) {
  // newTimeFrames 是帧数，直接传给 handleTimelineItemPositionUpdate
  await handleTimelineItemPositionUpdate(itemId, newTimeFrames, newTrackId)
}

// 移动多个项目（保持相对位置）
async function moveMultipleItems(
  itemIds: string[],
  newTimeFrames: number,
  newTrackId: number,
  originalStartTimeFrames: number,
) {
  console.log('🔄 [Timeline] 开始批量移动项目:', {
    itemIds,
    newTimeFrames,
    newTrackId,
    originalStartTimeFrames,
  })

  // 计算时间偏移量（帧数）
  const timeOffsetFrames = newTimeFrames - originalStartTimeFrames

  // 批量移动所有选中的项目
  for (const itemId of itemIds) {
    const item = videoStore.getTimelineItem(itemId)
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

// 从素材库项创建时间轴项目
async function createMediaClipFromMediaItem(
  mediaItem: {
    id: string
    url: string
    name: string
    duration: number // 帧数
    mediaType: 'video' | 'image'
    fileInfo: {
      name: string
      type: string
      lastModified: number
    }
  },
  startTimeFrames: number, // 帧数
  trackId: number = 1,
): Promise<void> {
  console.log('创建时间轴项目从素材库:', mediaItem)

  try {
    // 等待WebAV初始化完成
    console.log('等待WebAV初始化完成...')
    const isReady = await waitForWebAVReady(10000) // 等待最多10秒
    if (!isReady) {
      throw new Error('WebAV初始化超时，请稍后重试')
    }

    // 获取对应的MediaItem
    const storeMediaItem = videoStore.getMediaItem(mediaItem.id)
    if (!storeMediaItem) {
      throw new Error('找不到对应的素材项目')
    }

    // 检查素材是否已经解析完成
    if (!storeMediaItem.isReady) {
      throw new Error('素材还在解析中，请稍后再试')
    }

    console.log('创建sprite for mediaItem:', mediaItem.id, 'type:', mediaItem.mediaType)
    const sprite = await createSpriteFromMediaItem(storeMediaItem)

    // 获取媒体的原始分辨率
    let originalResolution: { width: number; height: number }
    if (mediaItem.mediaType === 'video') {
      originalResolution = videoStore.getVideoOriginalResolution(mediaItem.id)
      console.log('视频原始分辨率:', originalResolution)
    } else {
      originalResolution = videoStore.getImageOriginalResolution(mediaItem.id)
      console.log('图片原始分辨率:', originalResolution)
    }

    // 设置初始尺寸为视频原始分辨率（缩放系数1.0）
    // sprite.rect.w/h 是在画布上的实际显示像素尺寸
    sprite.rect.w = originalResolution.width
    sprite.rect.h = originalResolution.height

    // 设置初始位置为画布中心
    // 使用WebAV坐标系（左上角原点），让视频居中显示
    const canvasWidth = videoStore.videoResolution.width
    const canvasHeight = videoStore.videoResolution.height
    sprite.rect.x = (canvasWidth - originalResolution.width) / 2
    sprite.rect.y = (canvasHeight - originalResolution.height) / 2

    console.log('初始化sprite尺寸和位置:', {
      原始分辨率: originalResolution,
      显示尺寸: { w: sprite.rect.w, h: sprite.rect.h },
      WebAV位置: { x: sprite.rect.x, y: sprite.rect.y },
      画布尺寸: { w: canvasWidth, h: canvasHeight },
    })

    // 设置时间范围 - 根据媒体类型使用不同的方法
    // 现在 mediaItem.duration 和 startTimeFrames 都是帧数，直接使用
    if (mediaItem.mediaType === 'video') {
      const timeRangeConfig = {
        clipStartTime: 0, // 帧数
        clipEndTime: mediaItem.duration, // 帧数
        timelineStartTime: startTimeFrames, // 帧数
        timelineEndTime: startTimeFrames + mediaItem.duration, // 帧数
      }

      console.log('设置视频时间范围:', {
        ...timeRangeConfig,
        clipDurationFrames: mediaItem.duration,
        startTimeFrames,
        endTimeFrames: startTimeFrames + mediaItem.duration,
      })
      ;(sprite as VideoVisibleSprite).setTimeRange(timeRangeConfig)
    } else {
      // 图片使用不同的时间范围设置
      const imageTimeRangeConfig = {
        timelineStartTime: startTimeFrames, // 帧数
        timelineEndTime: startTimeFrames + mediaItem.duration, // 帧数
        displayDuration: mediaItem.duration, // 帧数
      }

      console.log('设置图片时间范围:', {
        ...imageTimeRangeConfig,
        displayDurationFrames: mediaItem.duration,
        startTimeFrames,
        endTimeFrames: startTimeFrames + mediaItem.duration,
      })
      ;(sprite as ImageVisibleSprite).setTimeRange(imageTimeRangeConfig)
    }

    // 注意：不再直接添加sprite到画布，让AddTimelineItemCommand统一处理

    // 生成时间轴clip的缩略图
    console.log('🖼️ 生成时间轴clip缩略图...')
    const thumbnailUrl = await generateThumbnailForMediaItem({
      mediaType: mediaItem.mediaType,
      mp4Clip: storeMediaItem.mp4Clip,
      imgClip: storeMediaItem.imgClip,
    })

    // 创建TimelineItem - 使用markRaw包装VideoVisibleSprite
    const timelineItemId = Date.now().toString() + Math.random().toString(36).substring(2, 11)

    // 将WebAV坐标系转换为项目坐标系（中心原点）
    const projectCoords = webavToProjectCoords(
      sprite.rect.x,
      sprite.rect.y,
      sprite.rect.w,
      sprite.rect.h,
      videoStore.videoResolution.width,
      videoStore.videoResolution.height,
    )

    const timelineItem: TimelineItem = reactive({
      id: timelineItemId,
      mediaItemId: mediaItem.id,
      trackId: trackId,
      mediaType: mediaItem.mediaType,
      timeRange: sprite.getTimeRange(), // 从sprite获取完整的timeRange（已经通过setTimeRange设置）
      sprite: markRaw(sprite), // 使用markRaw避免Vue响应式包装
      thumbnailUrl, // 添加缩略图URL
      // Sprite位置和大小属性（使用项目坐标系）
      x: Math.round(projectCoords.x),
      y: Math.round(projectCoords.y),
      width: sprite.rect.w,
      height: sprite.rect.h,
      // 其他sprite属性
      rotation: sprite.rect.angle || 0, // 从sprite获取旋转角度（弧度），默认为0
      zIndex: sprite.zIndex,
      opacity: sprite.opacity,
      // 音频属性（仅对视频有效）
      volume: mediaItem.mediaType === 'video' ? 1 : 1, // 默认音量为1
      isMuted: false, // 默认不静音
    })

    console.log('🔄 坐标系转换:', {
      WebAV坐标: { x: sprite.rect.x, y: sprite.rect.y },
      项目坐标: { x: timelineItem.x, y: timelineItem.y },
      尺寸: { w: sprite.rect.w, h: sprite.rect.h },
    })

    // 添加到store（使用带历史记录的方法）
    console.log(
      `📝 添加时间轴项目: ${mediaItem.name} -> 轨道${trackId}, 位置${Math.max(0, startTimeFrames)}帧`,
    )
    await videoStore.addTimelineItemWithHistory(timelineItem)

    console.log(`✅ 时间轴项目创建完成: ${timelineItem.id}`)
  } catch (error) {
    console.error('创建时间轴项目失败:', error)
    dialogs.showOperationError('创建时间轴项目', (error as Error).message)
  }
}

async function handleTimelineItemPositionUpdate(
  timelineItemId: string,
  newPositionFrames: number,
  newTrackId?: number,
) {
  try {
    // 使用带历史记录的移动方法
    await videoStore.moveTimelineItemWithHistory(timelineItemId, newPositionFrames, newTrackId)
    console.log('✅ 时间轴项目移动成功')
  } catch (error) {
    console.error('❌ 移动时间轴项目失败:', error)
    // 如果历史记录移动失败，回退到直接移动
    videoStore.updateTimelineItemPosition(timelineItemId, newPositionFrames, newTrackId)
  }
}

async function handleTimelineItemRemove(timelineItemId: string) {
  try {
    const item = videoStore.getTimelineItem(timelineItemId)
    if (item) {
      const mediaItem = videoStore.getMediaItem(item.mediaItemId)
      console.log(`🗑️ 准备从时间轴删除项目: ${mediaItem?.name || '未知'} (ID: ${timelineItemId})`)

      // 使用带历史记录的删除方法
      await videoStore.removeTimelineItemWithHistory(timelineItemId)
      console.log(`✅ 时间轴项目删除完成: ${timelineItemId}`)
    }
  } catch (error) {
    console.error('❌ 删除时间轴项目失败:', error)
    // 如果历史记录删除失败，回退到直接删除
    try {
      const item = videoStore.getTimelineItem(timelineItemId)
      if (item) {
        // 从WebAV画布移除VideoVisibleSprite
        const avCanvas = webAVControls.getAVCanvas()
        if (avCanvas) {
          avCanvas.removeSprite(item.sprite)
        }
        // 从store中移除TimelineItem
        videoStore.removeTimelineItem(timelineItemId)
      }
    } catch (fallbackError) {
      console.error('❌ 回退删除也失败:', fallbackError)
    }
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
      await videoStore.selectTimelineItemsWithHistory([], 'replace')
    } catch (error) {
      console.error('❌ 清除选择操作失败:', error)
      // 如果历史记录清除失败，回退到普通清除
      videoStore.clearAllSelections()
    }
  }
}

async function handleTimelineContainerClick(event: MouseEvent) {
  // 点击时间轴容器的空白区域取消所有选中
  const target = event.target as HTMLElement

  // 检查点击的是否是时间轴容器本身或其他空白区域
  // 排除点击在VideoClip、按钮、输入框等交互元素上的情况
  // 注意：不包括 track-content，因为它由 handleTimelineClick 处理
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
      await videoStore.selectTimelineItemsWithHistory([], 'replace')
    } catch (error) {
      console.error('❌ 清除选择操作失败:', error)
      // 如果历史记录清除失败，回退到普通清除
      videoStore.clearAllSelections()
    }
  }
}

function handleWheel(event: WheelEvent) {
  if (event.altKey) {
    // Alt + 滚轮：缩放
    event.preventDefault()
    const zoomFactor = 1.1
    const rect = timelineBody.value?.getBoundingClientRect()
    if (!rect) {
      if (window.DEBUG_TIMELINE_ZOOM) {
        console.error('❌ 无法获取时间轴主体边界')
      }
      return
    }

    // 获取鼠标在时间轴上的位置（减去轨道控制区域的150px）
    const mouseX = event.clientX - rect.left - 150
    const mouseFrames = videoStore.pixelToFrame(mouseX, timelineWidth.value)

    // 缩放操作（精简调试信息）

    if (event.deltaY < 0) {
      // 向上滚动：放大
      videoStore.zoomIn(zoomFactor, timelineWidth.value)
    } else {
      // 向下滚动：缩小
      videoStore.zoomOut(zoomFactor, timelineWidth.value)
    }

    // 调整滚动偏移量，使鼠标位置保持在相同的帧数点
    const newMousePixel = videoStore.frameToPixel(mouseFrames, timelineWidth.value)
    const offsetAdjustment = newMousePixel - mouseX
    const newScrollOffset = videoStore.scrollOffset + offsetAdjustment

    videoStore.setScrollOffset(newScrollOffset, timelineWidth.value)
  } else if (event.shiftKey) {
    // Shift + 滚轮：水平滚动
    event.preventDefault()
    const scrollAmount = 50

    if (event.deltaY < 0) {
      // 向上滚动：向左滚动
      videoStore.scrollLeft(scrollAmount, timelineWidth.value)
    } else {
      // 向下滚动：向右滚动
      videoStore.scrollRight(scrollAmount, timelineWidth.value)
    }
  } else {
    // 普通滚轮：垂直滚动（让浏览器处理默认的滚动行为）
    // 不阻止默认行为，允许正常的垂直滚动
  }
}

function handleKeyDown(event: KeyboardEvent) {
  // 检查是否有修饰键，如果有则不处理（让全局快捷键处理）
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
    return
  }

  // 按 Escape 键取消选中
  if (event.key === 'Escape') {
    videoStore.selectTimelineItem(null)
  }
}

// ==================== 视觉反馈系统 ====================
// 注意：拖拽预览现在统一使用 DragPreviewManager (useDragPreview.ts)

// ConflictInfo 接口已移动到统一类型文件 src/types/index.ts

// 检测素材库拖拽的重叠冲突
function detectMediaItemConflicts(
  dropTime: number,
  targetTrackId: number,
  duration: number,
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = []

  // 获取目标轨道上的所有项目
  const trackItems = videoStore.getTimelineItemsForTrack(targetTrackId)

  const dragEndTime = dropTime + duration

  // 检查与其他项目的冲突
  for (const item of trackItems) {
    const itemStartTime = item.timeRange.timelineStartTime // 帧数
    const itemEndTime = item.timeRange.timelineEndTime // 帧数

    // 检查时间重叠
    const overlapStart = Math.max(dropTime, itemStartTime)
    const overlapEnd = Math.min(dragEndTime, itemEndTime)

    if (overlapStart < overlapEnd) {
      const mediaItem = videoStore.getMediaItem(item.mediaItemId)
      conflicts.push({
        itemId: item.id,
        itemName: mediaItem?.name || 'Unknown',
        startTime: itemStartTime,
        endTime: itemEndTime,
        overlapStart,
        overlapEnd,
      })
    }
  }

  return conflicts
}

function detectTimelineConflicts(
  dropTime: number,
  targetTrackId: number,
  dragData: TimelineItemDragData,
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = []

  // 获取目标轨道上的所有项目
  const trackItems = videoStore.getTimelineItemsForTrack(targetTrackId)

  // 计算拖拽项目的时长
  const draggedItem = videoStore.getTimelineItem(dragData.itemId)
  if (!draggedItem) return conflicts

  const dragDuration =
    draggedItem.timeRange.timelineEndTime - draggedItem.timeRange.timelineStartTime // 帧数
  const dragEndTime = dropTime + dragDuration

  // 检查与其他项目的冲突
  for (const item of trackItems) {
    // 跳过正在拖拽的项目
    if (dragData.selectedItems.includes(item.id)) continue

    const itemStartTime = item.timeRange.timelineStartTime // 帧数
    const itemEndTime = item.timeRange.timelineEndTime // 帧数

    // 检查时间重叠
    const overlapStart = Math.max(dropTime, itemStartTime)
    const overlapEnd = Math.min(dragEndTime, itemEndTime)

    if (overlapStart < overlapEnd) {
      const mediaItem = videoStore.getMediaItem(item.mediaItemId)
      conflicts.push({
        itemId: item.id,
        itemName: mediaItem?.name || 'Unknown',
        startTime: itemStartTime,
        endTime: itemEndTime,
        overlapStart,
        overlapEnd,
      })
    }
  }

  return conflicts
}

// 处理拖拽离开事件
function handleDragLeave(event: DragEvent) {
  // 只有当真正离开时间轴区域时才隐藏预览
  const relatedTarget = event.relatedTarget as Element
  const timelineElement = event.currentTarget as Element

  if (!timelineElement.contains(relatedTarget)) {
    dragPreviewManager.hidePreview()
  }
}

// 右键菜单相关方法
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

function removeClip() {
  if (contextMenuTarget.value.clipId) {
    videoStore.removeTimelineItemWithHistory(contextMenuTarget.value.clipId)
    showContextMenu.value = false
  }
}

async function duplicateClip() {
  if (contextMenuTarget.value.clipId) {
    try {
      const newItemId = await videoStore.duplicateTimelineItemWithHistory(
        contextMenuTarget.value.clipId,
      )
      if (newItemId) {
        console.log('✅ 时间轴项目复制成功，新项目ID:', newItemId)
      } else {
        console.error('❌ 时间轴项目复制失败')
      }
    } catch (error) {
      console.error('❌ 复制时间轴项目时出错:', error)
    }
    showContextMenu.value = false
  }
}

async function regenerateThumbnail() {
  if (contextMenuTarget.value.clipId) {
    try {
      const timelineItem = videoStore.getTimelineItem(contextMenuTarget.value.clipId)
      const mediaItem = timelineItem ? videoStore.getMediaItem(timelineItem.mediaItemId) : null

      if (timelineItem && mediaItem) {
        const { regenerateThumbnailForTimelineItem } = await import('../utils/thumbnailGenerator')
        const newThumbnailUrl = await regenerateThumbnailForTimelineItem(timelineItem, mediaItem)

        if (newThumbnailUrl) {
          // 清理旧的缩略图URL
          if (timelineItem.thumbnailUrl) {
            URL.revokeObjectURL(timelineItem.thumbnailUrl)
          }
          // 更新缩略图URL
          timelineItem.thumbnailUrl = newThumbnailUrl
          console.log('✅ 缩略图重新生成成功')
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

onMounted(() => {
  updateTimelineWidth()
  window.addEventListener('resize', updateTimelineWidth)
  window.addEventListener('keydown', handleKeyDown)

  // 添加拖拽离开事件监听
  if (timelineBody.value) {
    timelineBody.value.addEventListener('dragleave', handleDragLeave)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateTimelineWidth)
  window.removeEventListener('keydown', handleKeyDown)

  // 清理统一预览
  dragPreviewManager.hidePreview()

  // 移除拖拽离开事件监听
  if (timelineBody.value) {
    timelineBody.value.removeEventListener('dragleave', handleDragLeave)
  }
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

.add-track-btn {
  background: rgba(156, 163, 175, 0.2); /* 银色背景 */
  border: 1px solid rgba(156, 163, 175, 0.4); /* 银色边框 */
  border-radius: var(--border-radius-medium);
  color: #d1d5db; /* 亮银色 */
  padding: var(--spacing-xs);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.add-track-btn:hover {
  background: rgba(156, 163, 175, 0.3); /* 悬停时更亮的银色 */
  border-color: rgba(156, 163, 175, 0.6);
  color: #f3f4f6; /* 更亮的银色 */
}

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
  min-height: 80px;
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
  min-width: 24px;
  height: 24px;
  padding: 0 var(--spacing-xs);
  border-radius: var(--border-radius-small);
  background-color: rgba(156, 163, 175, 0.15); /* 淡银色背景 */
  color: #9ca3af; /* 银灰色文字 */
  font-size: var(--font-size-sm);
  font-weight: 500;
  border: 1px solid rgba(156, 163, 175, 0.3); /* 银色边框 */
}

/* 使用通用的 track-btn 样式 */

.track-btn.arrange-btn {
  background: var(--color-accent-secondary);
  color: var(--color-text-primary);
}

.track-btn.arrange-btn:hover:not(:disabled) {
  background: var(--color-accent-secondary-hover);
}

.track-btn.arrange-btn:disabled {
  background: var(--color-bg-quaternary);
  color: var(--color-text-tertiary);
  cursor: not-allowed;
  opacity: 0.5;
}

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

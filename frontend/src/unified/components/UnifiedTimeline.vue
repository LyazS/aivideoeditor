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
import { ref, computed, onMounted, onUnmounted, h } from 'vue'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { usePlaybackControls, getDragPreviewManager, useDragUtils, useDialogs } from '@/unified/composables'
import type { UnifiedTimelineItemData } from '../timelineitem/TimelineItemData'

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
import {
  getTrackTypeIcon,
  getTrackTypeLabel,
  getVisibilityIcon,
  getMuteIcon,
  CONTROL_ICONS,
} from '@/unified/constants/timelineIcons'

// 导入创建的模块
import { useTimelineTrackManagement } from '../composables/useTimelineTrackManagement'
import { useTimelineDragHandling } from '../composables/useTimelineDragHandling'
import { useTimelineContextMenu } from '../composables/useTimelineContextMenu'
import { useTimelineItemOperations } from '../composables/useTimelineItemOperations'
import { useTimelineConflictDetection } from '../composables/useTimelineConflictDetection'
import { useTimelineEventHandlers } from '../composables/useTimelineEventHandlers'
import { useTimelineGridLines } from '../composables/useTimelineGridLines'
import { useTimelineCoordinateUtils } from '../composables/useTimelineCoordinateUtils'
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
const dragPreviewManager = getDragPreviewManager()
const dragUtils = useDragUtils()
const dialogs = useDialogs()

const timelineBody = ref<HTMLElement>()
const timelineWidth = ref(800)

// 首先初始化基础工具模块
const {
  updateTimelineWidth,
  getTimePositionFromContextMenu,
} = useTimelineCoordinateUtils(timelineBody, timelineWidth)

// 初始化项目操作模块
const {
  createMediaClipFromMediaItem,
  moveSingleItem,
  moveMultipleItems,
  handleTimelineItemRemove,
  createTextAtPosition,
} = useTimelineItemOperations()

// 初始化轨道管理模块
const {
  tracks,
  editingTrackId,
  editingTrackName,
  nameInputs,
  addNewTrack,
  toggleVisibility,
  toggleMute,
  autoArrangeTrack,
  startRename,
  finishRename,
  cancelRename,
  removeTrack,
  getClipsForTrack,
} = useTimelineTrackManagement()

// 初始化冲突检测模块
const {
  detectMediaItemConflicts,
  detectTimelineConflicts,
} = useTimelineConflictDetection()

// 初始化拖拽处理模块
const {
  handleDragOver,
  handleMediaItemDragOver,
  handleTimelineItemDragOver,
  handleDrop,
  handleTimelineItemDrop,
  handleMediaItemDrop,
  handleDragLeave,
} = useTimelineDragHandling(
  timelineBody,
  timelineWidth,
  dragPreviewManager,
  detectMediaItemConflicts,
  detectTimelineConflicts,
  createMediaClipFromMediaItem,
  moveSingleItem,
  moveMultipleItems,
)

// 初始化右键菜单模块
const {
  showContextMenu,
  contextMenuType,
  contextMenuTarget,
  contextMenuOptions,
  currentMenuItems,
  handleContextMenu,
  handleTimelineItemContextMenu,
  removeClip,
  duplicateClip,
  regenerateThumbnail,
  renameTrack,
  showAddTrackMenu,
} = useTimelineContextMenu(
  addNewTrack,
  toggleVisibility,
  toggleMute,
  autoArrangeTrack,
  startRename,
  removeTrack,
  handleTimelineItemRemove,
  createTextAtPosition,
  tracks,
  getClipsForTrack,
  getTimePositionFromContextMenu,
)

// 初始化事件处理模块
const {
  handleTimelineContainerClick,
  handleWheel,
  handleTimelineClick,
  handleSelectClip,
  handleTimelineItemDoubleClick,
  handleTimelineItemResizeStart,
  handleKeyDown,
} = useTimelineEventHandlers(
  timelineBody,
  timelineWidth,
  handleTimelineItemRemove,
)

// 初始化网格线模块
const { gridLines } = useTimelineGridLines(timelineWidth)

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

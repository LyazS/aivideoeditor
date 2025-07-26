<template>
  <UnifiedTimelineBaseClip
    ref="baseClipRef"
    :timeline-item="timelineItem"
    :track="track"
    :timeline-width="timelineWidth"
    :total-duration-frames="totalDurationFrames"
    :class="clipClasses"
    @select="$emit('select', $event)"
    @update-position="handleUpdatePosition"
    @remove="$emit('remove', $event)"
    @resize-update="handleResizeUpdate"
  >
    <template #content>
      <!-- 根据状态显示不同内容 -->
      <div class="unified-clip-content">
        <!-- 加载状态 -->
        <div v-if="isLoading" class="loading-state">
          <div class="loading-indicator">
            <div class="spinner"></div>
            <div class="loading-text">
              {{ statusMessage }}
            </div>
            <!-- 进度条 -->
            <div v-if="hasProgress" class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: `${progress.percent}%` }"
              ></div>
            </div>
          </div>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="hasError" class="error-state">
          <div class="error-indicator">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2Z" />
            </svg>
            <div class="error-text">
              {{ errorInfo.message }}
            </div>
            <button 
              v-if="errorInfo.recoverable" 
              class="retry-button"
              @click="handleRetry"
            >
              重试
            </button>
          </div>
        </div>

        <!-- 就绪状态 - 根据媒体类型显示内容 -->
        <div v-else-if="isReady" class="ready-state">
          <!-- 视频/图片内容 -->
          <div v-if="isVisualMedia" class="visual-content">
            <img
              v-if="thumbnailUrl"
              :src="thumbnailUrl"
              class="thumbnail-image"
              alt="缩略图"
            />
            <div v-else class="thumbnail-placeholder">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path :d="getMediaTypeIcon()" />
              </svg>
            </div>
          </div>

          <!-- 音频内容 -->
          <div v-else-if="mediaType === 'audio'" class="audio-content">
            <div class="audio-waveform">
              <svg 
                :width="clipWidth" 
                :height="clipHeight - 20"
                class="waveform-svg"
              >
                <!-- 简化的波形显示 -->
                <path 
                  :d="generateSimpleWaveform()" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="1"
                  opacity="0.7"
                />
              </svg>
            </div>
          </div>

          <!-- 文本内容 -->
          <div v-else-if="mediaType === 'text'" class="text-content">
            <div class="text-preview">
              <span class="text-preview-content" :style="textPreviewStyle">
                {{ textPreview }}
              </span>
            </div>
          </div>

          <!-- 未知类型 -->
          <div v-else class="unknown-content">
            <div class="unknown-placeholder">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,17A1.5,1.5 0 0,1 10.5,15.5A1.5,1.5 0 0,1 12,14A1.5,1.5 0 0,1 13.5,15.5A1.5,1.5 0 0,1 12,17M12,10.5C10.07,10.5 8.5,8.93 8.5,7C8.5,5.07 10.07,3.5 12,3.5C13.93,3.5 15.5,5.07 15.5,7C15.5,8.93 13.93,10.5 12,10.5Z" />
              </svg>
              <span>未知类型</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UnifiedTimelineBaseClip>

  <!-- 工具提示 -->
  <UnifiedClipTooltip
    v-if="showTooltipFlag"
    :timeline-item="timelineItem"
    :mouse-x="tooltipMouseX"
    :mouse-y="tooltipMouseY"
    :clip-top="tooltipClipTop"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { useUnifiedStore } from '../stores/unifiedStore'
import { framesToTimecode } from '../stores/utils/timeUtils'
import UnifiedTimelineBaseClip from './UnifiedTimelineBaseClip.vue'
import UnifiedClipTooltip from './UnifiedClipTooltip.vue'
import type { Track } from '../types'
import type {
  UnifiedTimelineItem,
  TextMediaConfig
} from '../unified/timelineitem'
import {
  UnifiedTimelineItemQueries as Queries,
  UnifiedTimelineItemActions as Actions,
  getTimelineItemProgress,
  getTimelineItemError,
  getTimelineItemDisplayStatus
} from '../unified/timelineitem'

interface Props {
  timelineItem: UnifiedTimelineItem
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

const unifiedStore = useUnifiedStore()
const baseClipRef = ref<InstanceType<typeof UnifiedTimelineBaseClip>>()

// Tooltip相关状态
const showTooltipFlag = ref(false)
const tooltipMouseX = ref(0)
const tooltipMouseY = ref(0)
const tooltipClipTop = ref(0)

// 状态查询
const isLoading = computed(() => Queries.isLoading(props.timelineItem))
const isReady = computed(() => Queries.isReady(props.timelineItem))
const hasError = computed(() => Queries.hasError(props.timelineItem))

// 状态信息
const statusMessage = computed(() => getTimelineItemDisplayStatus(props.timelineItem))
const progress = computed(() => getTimelineItemProgress(props.timelineItem))
const hasProgress = computed(() => progress.value.hasProgress)
const errorInfo = computed(() => getTimelineItemError(props.timelineItem))

// 媒体类型相关
const mediaType = computed(() => props.timelineItem.mediaType)
const isVisualMedia = computed(() => 
  mediaType.value === 'video' || mediaType.value === 'image'
)

// 缩略图URL
const thumbnailUrl = computed(() => {
  const config = props.timelineItem.config.mediaConfig as any
  return config?.thumbnailUrl
})

// 文本预览
const textPreview = computed(() => {
  if (mediaType.value !== 'text') return ''
  const config = props.timelineItem.config.mediaConfig as TextMediaConfig
  return config.text || '文本'
})

const textPreviewStyle = computed(() => {
  if (mediaType.value !== 'text') return {}
  const config = props.timelineItem.config.mediaConfig as TextMediaConfig
  return {
    fontSize: '12px',
    color: config.style?.color || '#ffffff',
    fontFamily: config.style?.fontFamily || 'Arial, sans-serif',
    fontWeight: config.style?.fontWeight || 'normal'
  }
})

// 样式类
const clipClasses = computed(() => ({
  'unified-clip': true,
  [`unified-clip--${mediaType.value}`]: true,
  [`unified-clip--${props.timelineItem.timelineStatus}`]: true
}))

// 尺寸计算
const clipWidth = computed(() => {
  const duration = props.timelineItem.timeRange.timelineEndTime - props.timelineItem.timeRange.timelineStartTime
  return unifiedStore.frameToPixel(duration, props.timelineWidth)
})

const clipHeight = computed(() => props.track?.height || 60)

// 事件处理
function handleUpdatePosition(timelineItemId: string, newPosition: number, newTrackId?: string) {
  emit('update-position', timelineItemId, newPosition, newTrackId)
}

function handleResizeUpdate(timelineItemId: string, newStartTime: number, newEndTime: number) {
  // 更新时间范围
  Actions.updateTimeRange(props.timelineItem, {
    timelineStartTime: newStartTime,
    timelineEndTime: newEndTime
  })
}

function handleRetry() {
  Actions.retry(props.timelineItem)
}

// 媒体类型图标
function getMediaTypeIcon(): string {
  const icons = {
    video: 'M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z',
    image: 'M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z',
    audio: 'M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12Z',
    text: 'M18,11H16.5V10.5H14.5V13.5H16.5V13H18V14A1,1 0 0,1 17,15H14A1,1 0 0,1 13,14V10A1,1 0 0,1 14,9H17A1,1 0 0,1 18,10V11M11,15H9V9H11V15M8,9H6V15H8V9Z'
  }
  return icons[mediaType.value as keyof typeof icons] || icons.video
}

// 简化的波形生成
function generateSimpleWaveform(): string {
  const width = clipWidth.value
  const height = clipHeight.value - 20
  const centerY = height / 2
  
  let path = `M 0 ${centerY}`
  
  // 生成简单的波形路径
  for (let x = 0; x < width; x += 4) {
    const amplitude = Math.sin(x * 0.1) * (height * 0.3)
    path += ` L ${x} ${centerY + amplitude}`
  }
  
  return path
}

// Tooltip事件
function showTooltip() {
  showTooltipFlag.value = true
}

function updateTooltipPosition(event: MouseEvent) {
  tooltipMouseX.value = event.clientX
  tooltipMouseY.value = event.clientY
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  tooltipClipTop.value = rect.top
}

function hideTooltip() {
  showTooltipFlag.value = false
}
</script>

<style scoped>
.unified-clip {
  position: relative;
}

.unified-clip-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* 加载状态样式 */
.loading-state {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: 10px;
  color: #3b82f6;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.progress-bar {
  width: 60px;
  height: 3px;
  background: rgba(59, 130, 246, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s ease;
}

/* 错误状态样式 */
.error-state {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.error-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
}

.error-text {
  font-size: 10px;
  color: #ef4444;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.retry-button {
  font-size: 9px;
  padding: 2px 6px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.retry-button:hover {
  background: #dc2626;
}

/* 就绪状态样式 */
.ready-state {
  width: 100%;
  height: 100%;
}

.visual-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumbnail-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
  border-radius: 2px;
}

.thumbnail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: rgba(156, 163, 175, 0.1);
  color: #9ca3af;
}

.audio-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.waveform-svg {
  width: 100%;
  height: 100%;
  color: #10b981;
}

.text-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

.text-preview {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.text-preview-content {
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.unknown-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.unknown-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #9ca3af;
}

.unknown-placeholder span {
  font-size: 10px;
}

/* 状态特定样式 */
.unified-clip--loading {
  opacity: 0.8;
}

.unified-clip--error {
  opacity: 0.7;
}

.unified-clip--ready {
  opacity: 1;
}
</style>

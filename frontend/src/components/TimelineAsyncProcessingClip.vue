<template>
  <TimelineBaseClip
    ref="baseClipRef"
    :timeline-item="timelineItem"
    :track="track"
    :timeline-width="timelineWidth"
    :total-duration-frames="totalDurationFrames"
    class="async-processing-clip"
    :class="asyncClipClasses"
    @select="$emit('select', $event)"
    @update-position="
      (timelineItemId, newPosition, newTrackId) =>
        $emit('update-position', timelineItemId, newPosition, newTrackId)
    "
    @remove="$emit('remove', $event)"
    @resize-update="handleResizeUpdate"
  >
    <template #content>
      <!-- 异步处理clip内容区域 -->
      <div class="async-processing-content">
        <!-- 状态指示器 -->
        <div class="status-indicator" :class="`status-${currentProcessingStatus}`">
          <!-- 处理类型图标 -->
          <div class="processing-icon" :class="`type-${currentProcessingType}`">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path :d="getProcessingTypeIcon(currentProcessingType)" />
            </svg>
          </div>

          <!-- 状态内容 -->
          <div class="status-content">
            <!-- 等待状态 -->
            <div v-if="currentProcessingStatus === 'pending'" class="status-pending">
              <span class="status-text">等待中</span>
            </div>

            <!-- 处理中状态 -->
            <div v-else-if="currentProcessingStatus === 'processing'" class="status-processing">
              <!-- 进度圆环 -->
              <div class="progress-ring">
                <svg width="32" height="32" class="progress-svg">
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.3)"
                    stroke-width="2"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    fill="none"
                    stroke="white"
                    stroke-width="2"
                    stroke-linecap="round"
                    :stroke-dasharray="progressCircumference"
                    :stroke-dashoffset="progressOffset"
                    transform="rotate(-90 16 16)"
                  />
                </svg>
                <span class="progress-text">{{ Math.round(currentProcessingProgress) }}%</span>
              </div>
            </div>

            <!-- 完成状态 -->
            <div v-else-if="currentProcessingStatus === 'completed'" class="status-completed">
              <span class="status-text">已完成</span>
            </div>

            <!-- 错误状态 -->
            <div v-else-if="currentProcessingStatus === 'error'" class="status-error">
              <span class="status-text">错误</span>
            </div>

            <!-- 不支持状态 -->
            <div v-else-if="currentProcessingStatus === 'unsupported'" class="status-unsupported">
              <span class="status-text">不支持</span>
            </div>

            <!-- 取消状态 -->
            <div v-else-if="currentProcessingStatus === 'cancelled'" class="status-cancelled">
              <span class="status-text">已取消</span>
            </div>
          </div>
        </div>

        <!-- 素材名称 -->
        <div class="clip-name">
          {{ props.timelineItem.config.name }}
        </div>
      </div>

      <!-- Tooltip组件 -->
      <ClipTooltip
        v-if="baseClipRef?.showTooltipFlag"
        :visible="baseClipRef?.showTooltipFlag || false"
        :title="props.timelineItem.config.name"
        :media-type="
          props.timelineItem.mediaType === 'unknown' ? 'video' : props.timelineItem.mediaType
        "
        :duration="
          formatDurationFromFrames(
            props.timelineItem.timeRange.timelineEndTime -
              props.timelineItem.timeRange.timelineStartTime,
          )
        "
        :position="formatDurationFromFrames(props.timelineItem.timeRange.timelineStartTime)"
        :mouse-x="baseClipRef?.tooltipMouseX || 0"
        :mouse-y="baseClipRef?.tooltipMouseY || 0"
        :clip-top="baseClipRef?.tooltipClipTop || 0"
      />
    </template>
  </TimelineBaseClip>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { framesToTimecode } from '../stores/utils/timeUtils'
import TimelineBaseClip from './TimelineBaseClip.vue'
import ClipTooltip from './ClipTooltip.vue'
import type {
  AsyncProcessingTimelineItem,
  Track,
  AsyncProcessingType,
  ImageTimeRange,
} from '../types'

interface Props {
  timelineItem: AsyncProcessingTimelineItem
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

// TimelineBaseClip组件引用
const baseClipRef = ref<InstanceType<typeof TimelineBaseClip>>()

// 实时获取素材区的最新异步处理状态
const currentAsyncItem = computed(() => {
  return videoStore.getAsyncProcessingItem(props.timelineItem.mediaItemId)
})

// 实时状态计算属性 - 完全依赖素材区的状态，提供合理的默认值
const currentProcessingType = computed(() => {
  return currentAsyncItem.value?.processingType || 'remote-download'
})

const currentProcessingStatus = computed(() => {
  return currentAsyncItem.value?.processingStatus || 'pending'
})

const currentProcessingProgress = computed(() => {
  return currentAsyncItem.value?.processingProgress ?? 0
})

const currentErrorMessage = computed(() => {
  return currentAsyncItem.value?.errorMessage
})

// 异步clip特有的样式类 - 使用实时状态
const asyncClipClasses = computed(() => [
  `status-${currentProcessingStatus.value}`,
  `type-${currentProcessingType.value}`,
  {
    disabled: ['error', 'unsupported', 'cancelled'].includes(currentProcessingStatus.value),
  },
])

// 进度圆环计算 - 使用实时进度
const progressCircumference = computed(() => 2 * Math.PI * 12) // r=12的圆周长
const progressOffset = computed(() => {
  const progress = currentProcessingProgress.value / 100
  return progressCircumference.value * (1 - progress)
})

// 获取处理类型图标
function getProcessingTypeIcon(type: AsyncProcessingType): string {
  switch (type) {
    case 'remote-download':
      return 'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,19.93C7.05,19.44 4,16.08 4,12C4,11.38 4.08,10.78 4.21,10.21L9,15V16A1,1 0 0,0 10,17H11V19.93M17.9,17.39C17.64,16.58 16.9,16 16,16H15V13A1,1 0 0,0 14,12H8V10H10A1,1 0 0,0 11,9V7H13A2,2 0 0,0 15,5V4.59C17.93,5.77 20,8.64 20,12C20,14.08 19.2,15.97 17.9,17.39Z'
    default:
      return 'M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z' // 默认加载图标
  }
}

// 获取处理类型标签
function getProcessingTypeLabel(type: AsyncProcessingType): string {
  switch (type) {
    case 'remote-download':
      return '远程下载'
    default:
      return '异步处理'
  }
}

// 获取状态标签
function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return '等待中'
    case 'processing':
      return '处理中'
    case 'completed':
      return '已完成'
    case 'error':
      return '错误'
    case 'unsupported':
      return '不支持'
    case 'cancelled':
      return '已取消'
    default:
      return status
  }
}

/**
 * 处理来自BaseClip的resize-update事件
 */
async function handleResizeUpdate(
  itemId: string,
  newStartTime: number,
  newEndTime: number,
  direction: 'left' | 'right',
) {
  console.log('🔧 [AsyncProcessingClip] 处理resize-update事件:', {
    itemId,
    newStartTime,
    newEndTime,
    direction,
  })

  // 构建新的时间范围对象（异步处理clip使用ImageTimeRange结构）
  const newTimeRange: ImageTimeRange = {
    timelineStartTime: newStartTime,
    timelineEndTime: newEndTime,
    displayDuration: newEndTime - newStartTime,
  }

  try {
    // 使用带历史记录的调整方法
    const success = await videoStore.resizeTimelineItemWithHistory(
      props.timelineItem.id,
      newTimeRange,
    )

    if (success) {
      console.log('✅ [AsyncProcessingClip] 时间范围调整成功')
    } else {
      console.error('❌ [AsyncProcessingClip] 时间范围调整失败')
    }
  } catch (error) {
    console.error('❌ [AsyncProcessingClip] 调整时间范围时出错:', error)
  }
}

// 格式化时长显示
function formatDurationFromFrames(frames: number): string {
  return framesToTimecode(frames)
}
</script>

<style scoped>
/* 异步处理clip特有样式 - 基础样式由TimelineBaseClip提供 */

/* 禁用状态 */
.async-processing-clip.disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 状态样式 */
.async-processing-clip.status-pending {
  background: linear-gradient(135deg, #f39c12, #e67e22) !important;
}

.async-processing-clip.status-processing {
  background: linear-gradient(135deg, #3498db, #2980b9) !important;
}

.async-processing-clip.status-completed {
  background: linear-gradient(135deg, #27ae60, #229954) !important;
}

.async-processing-clip.status-error,
.async-processing-clip.status-unsupported {
  background: linear-gradient(135deg, #e74c3c, #c0392b) !important;
}

.async-processing-clip.status-cancelled {
  background: linear-gradient(135deg, #95a5a6, #7f8c8d) !important;
}

/* 处理类型图标颜色 */
.async-processing-clip.type-remote-download .processing-icon {
  color: rgba(255, 255, 255, 0.9);
}

/* 内容区域 */
.async-processing-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 8px;
  color: white;
  text-align: center;
}

/* 状态指示器 */
.status-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.processing-icon {
  opacity: 0.9;
}

.status-content {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.status-text {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

/* 进度圆环 */
.progress-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-svg {
  transform: rotate(-90deg);
}

.progress-text {
  position: absolute;
  font-size: 10px;
  font-weight: bold;
  color: white;
}

/* 素材名称 */
.clip-name {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  margin-top: 4px;
}

/* 悬停效果 */
.timeline-async-processing-clip:hover:not(.disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
</style>

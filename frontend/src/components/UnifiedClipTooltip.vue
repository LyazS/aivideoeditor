<template>
  <Teleport to="body">
    <div v-if="visible" class="unified-clip-tooltip" :style="tooltipStyle">
      <div class="tooltip-content">
        <div class="tooltip-title">{{ title }}</div>
        <div class="tooltip-info">
          <div class="tooltip-row">
            <span class="tooltip-label">状态:</span>
            <span class="tooltip-value" :class="`status-${timelineItem.timelineStatus}`">
              {{ getStatusDisplayText() }}
            </span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">类型:</span>
            <span class="tooltip-value">{{ getMediaTypeLabel() }}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">时长:</span>
            <span class="tooltip-value">{{ formatDuration() }}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">位置:</span>
            <span class="tooltip-value">{{ formatPosition() }}</span>
          </div>
          <div v-if="hasProgress" class="tooltip-row">
            <span class="tooltip-label">进度:</span>
            <span class="tooltip-value">{{ progress.percent }}%</span>
          </div>
          <div v-if="hasError" class="tooltip-row">
            <span class="tooltip-label">错误:</span>
            <span class="tooltip-value error-text">{{ errorInfo.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import { framesToTimecode } from '../stores/utils/timeUtils'
import { useVideoStore } from '../stores/videoStore'
import type { UnifiedTimelineItem } from '../unified/timelineitem'
import { 
  UnifiedTimelineItemQueries as Queries,
  getTimelineItemProgress,
  getTimelineItemError,
  getTimelineItemDisplayStatus
} from '../unified/timelineitem'

interface Props {
  timelineItem: UnifiedTimelineItem
  mouseX: number
  mouseY: number
  clipTop: number
}

const props = defineProps<Props>()
const videoStore = useVideoStore()

// 计算属性
const visible = computed(() => true) // 由父组件控制显示

const title = computed(() => props.timelineItem.config.name)

const progress = computed(() => getTimelineItemProgress(props.timelineItem))
const hasProgress = computed(() => progress.value.hasProgress)

const errorInfo = computed(() => getTimelineItemError(props.timelineItem))
const hasError = computed(() => errorInfo.value.hasError)

const tooltipStyle = computed((): CSSProperties => {
  const offsetX = 10
  const offsetY = -10
  
  return {
    position: 'fixed',
    left: `${props.mouseX + offsetX}px`,
    top: `${props.mouseY + offsetY}px`,
    zIndex: '9999',
    pointerEvents: 'none',
  }
})

// 方法
function getStatusDisplayText(): string {
  return getTimelineItemDisplayStatus(props.timelineItem)
}

function getMediaTypeLabel(): string {
  const labels = {
    video: '视频',
    image: '图片',
    audio: '音频',
    text: '文本',
    unknown: '未知'
  }
  return labels[props.timelineItem.mediaType as keyof typeof labels] || '未知'
}

function formatDuration(): string {
  const durationFrames = props.timelineItem.timeRange.timelineEndTime - props.timelineItem.timeRange.timelineStartTime
  return framesToTimecode(durationFrames)
}

function formatPosition(): string {
  const startFrames = props.timelineItem.timeRange.timelineStartTime
  return framesToTimecode(startFrames)
}
</script>

<style scoped>
.unified-clip-tooltip {
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.4;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-width: 250px;
  white-space: nowrap;
}

.tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tooltip-title {
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 4px;
}

.tooltip-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.tooltip-label {
  color: #d1d5db;
  font-weight: 500;
  min-width: 40px;
}

.tooltip-value {
  color: #ffffff;
  font-weight: 400;
  text-align: right;
}

/* 状态颜色 */
.tooltip-value.status-loading {
  color: #3b82f6;
}

.tooltip-value.status-ready {
  color: #22c55e;
}

.tooltip-value.status-error {
  color: #ef4444;
}

.error-text {
  color: #ef4444 !important;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .unified-clip-tooltip {
    font-size: 11px;
    padding: 6px 10px;
    max-width: 200px;
  }
}
</style>

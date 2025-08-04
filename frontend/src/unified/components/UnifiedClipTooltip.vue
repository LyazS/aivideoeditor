<template>
  <Teleport to="body">
    <div v-if="visible" class="clip-tooltip" :style="tooltipStyle">
      <div class="tooltip-content">
        <div class="tooltip-title">{{ title }}</div>
        <div class="tooltip-info">
          <div class="tooltip-row">
            <span class="tooltip-label">类型:</span>
            <span class="tooltip-value">{{ getMediaTypeLabel(mediaType) }}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">时长:</span>
            <span class="tooltip-value">{{ duration }}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">位置:</span>
            <span class="tooltip-value">{{ position }}</span>
          </div>
          <div v-if="showSpeed" class="tooltip-row">
            <span class="tooltip-label">倍速:</span>
            <span class="tooltip-value">{{ speed }}</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, type CSSProperties } from 'vue'
import type { MediaType } from '../../types'
import type { MediaTypeOrUnknown } from '../mediaitem/types'

interface ClipTooltipProps {
  /** 是否显示tooltip */
  visible: boolean
  /** 标题 */
  title: string
  /** 媒体类型 */
  mediaType: MediaTypeOrUnknown
  /** 时长 */
  duration: string
  /** 位置 */
  position: string
  /** 倍速（可选） */
  speed?: string
  /** 是否显示倍速信息 */
  showSpeed?: boolean
  /** 鼠标X坐标 */
  mouseX: number
  /** 鼠标Y坐标 */
  mouseY: number
  /** clip元素的顶部位置 */
  clipTop: number
}

const props = withDefaults(defineProps<ClipTooltipProps>(), {
  speed: '1.0x',
  showSpeed: false,
})

// 获取媒体类型的中文标签
function getMediaTypeLabel(mediaType: MediaTypeOrUnknown): string {
  switch (mediaType) {
    case 'video':
      return '视频'
    case 'image':
      return '图片'
    case 'audio':
      return '音频'
    case 'text':
      return '文本'
    case 'unknown':
      return '未知'
    default:
      return '未知'
  }
}

// 计算tooltip样式
const tooltipStyle = computed((): CSSProperties => {
  return {
    position: 'fixed',
    left: `${props.mouseX}px`,
    bottom: `${window.innerHeight - props.clipTop + 10}px`, // 在clip上方10px
    transform: 'translateX(-50%)', // 水平居中对齐鼠标位置
    zIndex: 1001,
  }
})
</script>

<style scoped>
/* Tooltip样式 */
.clip-tooltip {
  position: fixed;
  background-color: rgba(0, 0, 0, 0.9);
  border: 1px solid var(--color-border-primary);
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
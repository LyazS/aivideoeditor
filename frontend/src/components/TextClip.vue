<template>
  <div
    class="text-clip"
    :class="{
      'selected': isSelected,
      'dragging': isDragging
    }"
    :style="clipStyle"
    :data-timeline-item-id="timelineItem.id"
    @click="selectClip"
    @mousedown="startDrag"
  >
    <!-- 文本内容显示 -->
    <div class="text-content">
      <span class="text-preview">{{ textContent }}</span>
    </div>

    <!-- 调整手柄 -->
    <div 
      v-if="isSelected"
      class="resize-handle left" 
      @mousedown.stop="startResize('left', $event)"
    ></div>
    <div 
      v-if="isSelected"
      class="resize-handle right" 
      @mousedown.stop="startResize('right', $event)"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TextTimelineItem } from '../types'

interface Props {
  timelineItem: TextTimelineItem
  isSelected: boolean
  pixelsPerFrame: number
}

interface Emits {
  (e: 'select', timelineItemId: string): void
  (e: 'drag', data: { event: MouseEvent; timelineItem: TextTimelineItem }): void
  (e: 'resize', data: { event: MouseEvent; timelineItem: TextTimelineItem; direction: 'left' | 'right' }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 拖拽状态
const isDragging = ref(false)

// 文本内容（截断显示）
const textContent = computed(() => {
  const text = props.timelineItem.config.text
  return text.length > 20 ? text.substring(0, 20) + '...' : text
})

// Clip样式
const clipStyle = computed(() => {
  const { timeRange } = props.timelineItem
  const width = timeRange.displayDuration * props.pixelsPerFrame
  const left = timeRange.timelineStartTime * props.pixelsPerFrame

  return {
    width: `${Math.max(width, 60)}px`, // 最小宽度60px
    left: `${left}px`,
    height: '40px', // 文本clip高度较低
  }
})

// 事件处理
function selectClip(event: MouseEvent) {
  event.stopPropagation()
  emit('select', props.timelineItem.id)
}

function startDrag(event: MouseEvent) {
  // 只有在非调整手柄区域才开始拖拽
  const target = event.target as HTMLElement
  if (target.classList.contains('resize-handle')) {
    return
  }
  
  isDragging.value = true
  emit('drag', { event, timelineItem: props.timelineItem })
  
  // 监听鼠标释放事件来结束拖拽状态
  const handleMouseUp = () => {
    isDragging.value = false
    document.removeEventListener('mouseup', handleMouseUp)
  }
  document.addEventListener('mouseup', handleMouseUp)
}

function startResize(direction: 'left' | 'right', event: MouseEvent) {
  emit('resize', { event, timelineItem: props.timelineItem, direction })
}
</script>

<style scoped>
.text-clip {
  position: absolute;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: 2px solid #5a67d8;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  padding: 0 8px;
  min-width: 60px;
  transition: all 0.2s ease;
}

.text-clip:hover {
  border-color: #4c51bf;
  box-shadow: 0 2px 8px rgba(90, 103, 216, 0.3);
}

.text-clip.selected {
  border-color: #3182ce;
  box-shadow: 0 0 0 2px rgba(49, 130, 206, 0.3);
}

.text-clip.dragging {
  opacity: 0.8;
  transform: scale(1.02);
  z-index: 1000;
}

.text-content {
  flex: 1;
  overflow: hidden;
  pointer-events: none; /* 防止文本选择干扰拖拽 */
}

.text-preview {
  color: white;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4px;
  background: rgba(255, 255, 255, 0.6);
  cursor: ew-resize;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.text-clip:hover .resize-handle,
.text-clip.selected .resize-handle {
  opacity: 1;
}

.resize-handle:hover {
  background: rgba(255, 255, 255, 0.9);
  width: 6px;
}

.resize-handle.left {
  left: -2px;
  border-radius: 2px 0 0 2px;
}

.resize-handle.right {
  right: -2px;
  border-radius: 0 2px 2px 0;
}

/* 文本clip特有的视觉标识 */
.text-clip::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 8px;
  height: 8px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  font-size: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .text-clip {
    min-width: 50px;
    padding: 0 6px;
  }
  
  .text-preview {
    font-size: 11px;
  }
  
  .resize-handle {
    width: 6px;
  }
}

/* 无障碍支持 */
.text-clip:focus {
  outline: 2px solid #3182ce;
  outline-offset: 2px;
}

/* 深色主题支持 */
@media (prefers-color-scheme: dark) {
  .text-clip {
    background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
    border-color: #4a5568;
  }
  
  .text-clip:hover {
    border-color: #718096;
  }
  
  .text-clip.selected {
    border-color: #63b3ed;
    box-shadow: 0 0 0 2px rgba(99, 179, 237, 0.3);
  }
}
</style>

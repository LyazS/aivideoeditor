# BaseClip基础组件设计方案

## 1. 概述

BaseClip是时间轴clip组件的基础组件，提取了所有clip类型（VideoClip、TextClip、AudioClip等）的通用功能和交互逻辑。通过继承BaseClip，各种具体的clip组件可以专注于内容渲染，而无需重复实现拖拽、调整时长、选中状态等通用功能。

### 1.1 设计目标

- **代码复用**：所有clip共享拖拽、调整时长、选中等通用逻辑
- **一致性**：确保所有clip的交互行为完全一致
- **可维护性**：通用功能的修改只需在BaseClip中进行
- **扩展性**：新增clip类型时只需关注内容显示，无需重复实现交互逻辑
- **插槽设计**：通过slot机制让子组件专注于内容渲染

### 1.2 通用功能

BaseClip提供以下通用功能：

- **拖拽移动**：在时间轴上拖拽移动clip位置
- **时长调整**：左右把手拖拽调整clip时长
- **选中状态**：点击选中，显示选中样式
- **重叠检测**：与其他clip重叠时的视觉反馈
- **轨道可见性**：轨道隐藏时的样式变化
- **拖拽状态**：拖拽过程中的视觉反馈

## 2. 组件设计

### 2.1 BaseClip组件实现

```vue
<!-- BaseClip.vue -->
<template>
  <div
    :class="clipClasses"
    :style="clipStyle"
    :data-media-type="timelineItem.mediaType"
    :data-timeline-item-id="timelineItem.id"
    :draggable="true"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @click="selectClip"
  >
    <!-- 左侧调整把手 -->
    <div 
      class="resize-handle resize-handle-left"
      @mousedown="startResize('left')"
    ></div>
    
    <!-- 内容区域 - 由子组件定义 -->
    <div class="clip-content">
      <slot name="content" :timeline-item="timelineItem" />
    </div>
    
    <!-- 右侧调整把手 -->
    <div 
      class="resize-handle resize-handle-right"
      @mousedown="startResize('right')"
    ></div>
  </div>
</template>

<script setup lang="ts">
// BaseClip通用逻辑
interface Props {
  timelineItem: TimelineItem
  timelineWidth: number
  // 其他通用属性...
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'select': [itemId: string]
  'drag-start': [itemId: string, event: DragEvent]
  'drag-end': [itemId: string, event: DragEvent]
  'resize-start': [itemId: string, direction: 'left' | 'right']
  'resize-end': [itemId: string, direction: 'left' | 'right']
}>()

// 通用状态
const isDragging = ref(false)
const isResizing = ref(false)
const resizeDirection = ref<'left' | 'right' | null>(null)

// 通用计算属性
const clipClasses = computed(() => ({
  'base-clip': true,
  'overlapping': isOverlapping.value,
  'selected': isSelected.value,
  'dragging': isDragging.value,
  'resizing': isResizing.value,
  'track-hidden': !isTrackVisible.value,
}))

const clipStyle = computed(() => ({
  left: `${getClipLeftPosition()}px`,
  width: `${getClipWidth()}px`,
  height: `${getClipHeight()}px`,
}))

// 通用方法
function handleDragStart(event: DragEvent) {
  isDragging.value = true
  emit('drag-start', props.timelineItem.id, event)
}

function handleDragEnd(event: DragEvent) {
  isDragging.value = false
  emit('drag-end', props.timelineItem.id, event)
}

function selectClip() {
  emit('select', props.timelineItem.id)
}

function startResize(direction: 'left' | 'right') {
  isResizing.value = true
  resizeDirection.value = direction
  emit('resize-start', props.timelineItem.id, direction)
  
  // 添加全局鼠标事件监听
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', endResize)
}

function handleResize(event: MouseEvent) {
  // 处理调整时长逻辑
}

function endResize() {
  isResizing.value = false
  emit('resize-end', props.timelineItem.id, resizeDirection.value!)
  resizeDirection.value = null
  
  // 移除全局事件监听
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', endResize)
}

// 计算位置和尺寸的辅助方法
function getClipLeftPosition(): number {
  // 根据时间轴位置计算clip的左侧位置
}

function getClipWidth(): number {
  // 根据时长计算clip的宽度
}

function getClipHeight(): number {
  // 返回clip的高度
}
</script>

<style scoped>
/* BaseClip通用样式 */
.base-clip {
  position: absolute;
  border-radius: 4px;
  cursor: move;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 10;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.base-clip.selected {
  border-color: #2196F3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.3);
}

.base-clip.overlapping {
  border-color: #f44336;
  box-shadow: 0 0 0 2px rgba(244, 67, 54, 0.3);
}

.base-clip.dragging {
  opacity: 0.8;
  transform: scale(1.02);
}

.base-clip.track-hidden {
  opacity: 0.5;
}

.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  background: rgba(255, 255, 255, 0.3);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.base-clip:hover .resize-handle {
  opacity: 1;
}

.resize-handle-left {
  left: 0;
  border-radius: 4px 0 0 4px;
}

.resize-handle-right {
  right: 0;
  border-radius: 0 4px 4px 0;
}

.clip-content {
  height: 100%;
  padding: 0 8px; /* 为把手留出空间 */
  overflow: hidden;
  display: flex;
  align-items: center;
}
</style>
```

## 3. 使用示例

### 3.1 TimelineTextClip使用BaseClip

```vue
<!-- TimelineTextClip.vue -->
<template>
  <BaseClip
    :timeline-item="timelineItem"
    :timeline-width="timelineWidth"
    class="text-clip"
    @select="$emit('select', $event)"
  >
    <template #content="{ timelineItem }">
      <!-- 文本内容显示 -->
      <div class="text-content">
        <span class="text-preview">{{ textPreview }}</span>
      </div>
      <!-- 文本标签 -->
      <div class="clip-label">
        {{ timelineItem.config.text || '文本' }}
      </div>
    </template>
  </BaseClip>
</template>

<script setup lang="ts">
import BaseClip from './BaseClip.vue'

interface Props {
  timelineItem: TextTimelineItem
  timelineWidth: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'select': [itemId: string]
}>()

// TextClip专用逻辑
const textPreview = computed(() => {
  const text = props.timelineItem.config.text || ''
  return text.length > 20 ? text.substring(0, 20) + '...' : text
})
</script>

<style scoped>
.text-clip {
  background: linear-gradient(135deg, #4CAF50, #45a049);
}

.text-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  font-size: 12px;
  color: white;
  height: 100%;
}

.clip-label {
  font-size: 10px;
  opacity: 0.8;
  margin-top: 2px;
}
</style>
```

### 3.2 TimelineVideoClip使用BaseClip

```vue
<!-- TimelineVideoClip.vue -->
<template>
  <BaseClip
    :timeline-item="timelineItem"
    :timeline-width="timelineWidth"
    class="video-clip"
    @select="$emit('select', $event)"
  >
    <template #content="{ timelineItem }">
      <!-- 视频/图片缩略图 -->
      <div class="media-thumbnail">
        <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="缩略图" />
      </div>
      <!-- 媒体标签 -->
      <div class="clip-label">
        {{ getMediaLabel(timelineItem) }}
      </div>
    </template>
  </BaseClip>
</template>

<script setup lang="ts">
import BaseClip from './BaseClip.vue'

// TimelineVideoClip专用逻辑...
const thumbnailUrl = computed(() => {
  // 获取缩略图URL逻辑
})

function getMediaLabel(item: TimelineItem): string {
  // 获取媒体标签逻辑
}
</script>

<style scoped>
.video-clip {
  background: linear-gradient(135deg, #2196F3, #1976D2);
}

.media-thumbnail {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-thumbnail img {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
}
</style>
```

## 4. 扩展性

### 4.1 新增clip类型

基于BaseClip，可以轻松创建新的clip类型：

```vue
<!-- AudioClip.vue -->
<template>
  <BaseClip
    :timeline-item="timelineItem"
    :timeline-width="timelineWidth"
    class="audio-clip"
    @select="$emit('select', $event)"
  >
    <template #content="{ timelineItem }">
      <!-- 音频波形显示 -->
      <div class="audio-waveform">
        <canvas ref="waveformCanvas"></canvas>
      </div>
      <!-- 音频标签 -->
      <div class="clip-label">
        {{ timelineItem.config.name }}
      </div>
    </template>
  </BaseClip>
</template>
```

### 4.2 自定义事件处理

子组件可以监听BaseClip的事件并添加自定义逻辑：

```vue
<BaseClip
  @select="handleCustomSelect"
  @drag-start="handleCustomDragStart"
  @resize-start="handleCustomResizeStart"
>
  <!-- 内容 -->
</BaseClip>
```

## 5. 优势总结

1. **代码复用**：减少90%以上的重复代码
2. **一致性**：所有clip的交互行为完全一致
3. **可维护性**：通用功能集中管理，易于维护和调试
4. **扩展性**：新增clip类型只需几十行代码
5. **测试友好**：通用逻辑集中测试，提高测试覆盖率
6. **性能优化**：统一的事件处理和状态管理

---

*本文档描述了BaseClip基础组件的设计和实现方案*

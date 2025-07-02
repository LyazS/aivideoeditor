# 文本轨道支持设计方案

## 1. 概述

本文档描述了为视频编辑器添加文本轨道支持的完整设计方案。该方案基于现有的 `TextVisibleSprite` 实现，扩展轨道系统以支持文本内容的创建、编辑和管理。

### 1.1 设计目标

- **完整集成**：文本轨道与现有视频/音频轨道系统无缝集成
- **用户友好**：提供直观的文本编辑和样式控制界面
- **性能优化**：复用现有缓存机制，确保流畅的编辑体验
- **扩展性强**：为未来的文本动画和高级功能预留接口

### 1.2 核心架构

```
文本轨道系统
├── 类型系统扩展
│   ├── TextTimelineItem (新增)
│   ├── TextMediaConfig (新增)
│   └── 现有类型扩展
├── 文本轨道管理
│   ├── 轨道创建和管理 (已有基础)
│   ├── 文本项目创建流程 (新增)
│   └── 文本项目生命周期管理 (新增)
├── UI组件扩展
│   ├── 文本Clip组件 (新增TextClip.vue)
│   ├── 文本属性组件 (新增TextProperties.vue)
│   └── 右键菜单扩展 (扩展ContextMenu)
└── 命令系统扩展
    ├── 文本项目操作命令 (新增)
    └── 文本样式更新命令 (新增)
```

## 2. 类型系统扩展

### 2.1 文本媒体配置类型

```typescript
// 在 frontend/src/types/index.ts 中新增
export interface TextMediaConfig {
  // 文本内容
  text: string

  // 文本样式
  style: TextStyleConfig

  // 基础视觉属性
  x: number
  y: number
  width: number
  height: number
  opacity: number
  zIndex: number

  // 动画配置
  animation?: AnimationConfig<'text'>
}

// 扩展现有的 MediaType 类型
export type MediaType = 'video' | 'image' | 'audio' | 'text'  // 添加 'text'

// 扩展现有的 GetMediaConfig 类型
export type GetMediaConfig<T extends MediaType> =
  T extends 'video' ? VideoMediaConfig :
  T extends 'image' ? ImageMediaConfig :
  T extends 'audio' ? AudioMediaConfig :
  T extends 'text' ? TextMediaConfig :  // 新增
  never

// 同时需要扩展 CustomVisibleSprite 类型以包含 TextVisibleSprite
export type CustomVisibleSprite =
  | VideoVisibleSprite
  | ImageVisibleSprite
  | TextVisibleSprite  // 新增
```

### 2.2 文本时间轴项目类型

```typescript
// 使用泛型方式定义文本时间轴项目（与现有系统保持一致）
export type TextTimelineItem = TimelineItem<'text'>

// 展开后的完整类型定义（用于理解）
export interface TextTimelineItemExpanded {
  /** 唯一标识符 */
  id: string
  /** 引用MediaItem的ID - 文本项目通常为空字符串，因为不来自媒体库 */
  mediaItemId: string
  /** 轨道ID */
  trackId: string
  /** 媒体类型 */
  mediaType: 'text'
  /** 时间范围信息 - 文本使用与图片相同的时间范围 */
  timeRange: ImageTimeRange
  /** 文本精灵实例 */
  sprite: Raw<TextVisibleSprite>
  /** 时间轴clip的缩略图URL - 文本项目通常不需要 */
  thumbnailUrl?: string
  /** 文本媒体配置 */
  config: TextMediaConfig
  /** 动画配置（可选） */
  animation?: AnimationConfig<'text'>
}

// 确保类型系统正确推断
// TimelineItem<'text'> 会自动推断出：
// - timeRange: ImageTimeRange (因为 'text' 不是 'video' 或 'audio')
// - config: TextMediaConfig (通过 GetMediaConfig<'text'>)
// - sprite: Raw<CustomSprite> (包含 TextVisibleSprite)
```

### 2.3 文本Clip操作限制配置

```typescript
// 文本clip的操作限制常量配置
// 位置：frontend/src/utils/clipConstraints.ts
export const TEXT_CLIP_CONSTRAINTS = {
  // 轨道兼容性：只能在文本轨道上
  compatibleTracks: ['text'] as const,

  // 不支持的操作
  unsupportedOperations: [
    'crop',    // 不能裁剪
    'split',   // 不能分割
    'trim'     // 不能修剪
  ] as const,

  // 支持的操作
  supportedOperations: [
    'move',           // 可以移动位置
    'resize',         // 可以调整时长
    'copy',           // 可以复制
    'delete',         // 可以删除
    'style-edit'      // 可以编辑样式
  ] as const
} as const

// 操作检查工具函数
// 位置：frontend/src/utils/clipConstraints.ts
export function isOperationAllowed(
  operation: string,
  mediaType: MediaType
): boolean {
  if (mediaType === 'text') {
    return !TEXT_CLIP_CONSTRAINTS.unsupportedOperations.includes(operation as any)
  }
  return true
}

// 轨道兼容性检查
// 位置：frontend/src/utils/clipConstraints.ts
export function isTrackCompatible(
  mediaType: MediaType,
  trackType: TrackType
): boolean {
  if (mediaType === 'text') {
    return TEXT_CLIP_CONSTRAINTS.compatibleTracks.includes(trackType as any)
  }

  // 其他媒体类型的兼容性
  switch (trackType) {
    case 'video':
      return mediaType === 'video' || mediaType === 'image'
    case 'audio':
      return mediaType === 'audio'
    default:
      return false
  }
}

// 在组件中的使用示例
// 位置：frontend/src/components/Timeline.vue
function handleClipDrop(event: DragEvent, targetTrackId: string) {
  const draggedItem = getDraggedTimelineItem()
  const targetTrack = tracks.value.find(t => t.id === targetTrackId)

  // 使用限制检查
  if (!isTrackCompatible(draggedItem.mediaType, targetTrack.type)) {
    showDropError(`${draggedItem.mediaType}类型不能放置在${targetTrack.type}轨道上`)
    return
  }

  // 执行拖拽操作...
}

// 在右键菜单中的使用示例
// 位置：frontend/src/components/ContextMenu.vue
const availableOperations = computed(() => {
  if (!selectedItem.value) return []

  return ALL_OPERATIONS.filter(op =>
    isOperationAllowed(op, selectedItem.value.mediaType)
  )
})
```

### 2.4 自定义Sprite类型扩展

```typescript
// 更新 CustomVisibleSprite 类型
export type CustomVisibleSprite =
  | VideoVisibleSprite
  | ImageVisibleSprite
  | TextVisibleSprite

// 更新 CustomSprite 类型别名
export type CustomSprite = CustomVisibleSprite
```

## 3. 文本轨道管理流程

### 3.1 文本项目创建流程

```typescript
// 新增文本项目创建函数
async function createTextTimelineItem(
  text: string,
  style: Partial<TextStyleConfig>,
  startTimeFrames: number,
  trackId: string,
  duration: number = TextVisibleSprite.DEFAULT_DURATION
): Promise<TextTimelineItem> {
  
  // 1. 创建文本精灵
  const textSprite = await TextVisibleSprite.create(text, style)
  
  // 2. 设置时间范围
  textSprite.setTimelineStartTime(startTimeFrames)
  textSprite.setDisplayDuration(duration)
  
  // 3. 设置默认位置（画布中心）
  textSprite.rect.x = 400  // 画布宽度的一半
  textSprite.rect.y = 300  // 画布高度的一半
  
  // 4. 创建时间轴项目
  const timelineItem: TextTimelineItem = {
    id: generateTimelineItemId(),
    mediaItemId: '', // 文本项目不需要媒体库项目
    trackId,
    mediaType: 'text',
    timeRange: textSprite.getTimeRange(),
    sprite: markRaw(textSprite),
    config: {
      text,
      style: textSprite.getTextStyle(),
      x: textSprite.rect.x,
      y: textSprite.rect.y,
      width: textSprite.rect.w,
      height: textSprite.rect.h,
      opacity: textSprite.getOpacityValue(),
      zIndex: textSprite.zIndex,
    }
  }
  
  return timelineItem
}
```

### 3.2 文本项目创建流程（右键菜单）

```typescript
// 通过右键菜单创建文本项目
async function addTextAtPosition(trackId: string, timePosition: number) {
  const textItem = await createTextTimelineItem(
    '点击编辑文本',  // 默认文本内容
    { fontSize: 48, color: 'white' },  // 默认样式
    timePosition,   // 右键点击的时间位置
    trackId,
    TextVisibleSprite.DEFAULT_DURATION  // 默认时长
  )

  await videoStore.addTimelineItemWithHistory(textItem)

  // 自动选中新创建的文本项目，方便用户立即编辑
  selectTimelineItem(textItem.id)
}

// 扩展现有的 addNewTrack 函数
async function addNewTrack(type: TrackType = 'video') {
  if (type === 'text') {
    // 创建文本轨道（不自动添加文本项目）
    const newTrackId = await videoStore.addTrackWithHistory(type)
    return newTrackId
  }

  // 其他轨道类型的现有逻辑...
}
```

## 4. UI组件扩展

### 4.1 新增TextClip组件

```vue
<!-- 新增 TextClip.vue 组件，专门用于文本项目显示 -->
<template>
  <div
    class="text-clip"
    :class="{
      'selected': isSelected,
      'dragging': isDragging
    }"
    :style="clipStyle"
    @click="selectClip"
    @mousedown="startDrag"
  >
    <!-- 文本内容显示 -->
    <div class="text-content">
      <span class="text-preview">{{ textContent }}</span>
    </div>

    <!-- 调整手柄 -->
    <div class="resize-handle left" @mousedown.stop="startResize('left')"></div>
    <div class="resize-handle right" @mousedown.stop="startResize('right')"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TextTimelineItem } from '../types'

interface Props {
  timelineItem: TextTimelineItem
  isSelected: boolean
  pixelsPerFrame: number
}

const props = defineProps<Props>()

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
    width: `${width}px`,
    left: `${left}px`,
    height: '40px', // 文本clip高度较低
  }
})

// 事件处理
const emit = defineEmits(['select', 'drag', 'resize'])

function selectClip() {
  emit('select', props.timelineItem.id)
}

function startDrag(event: MouseEvent) {
  emit('drag', { event, timelineItem: props.timelineItem })
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
}

.text-clip.selected {
  border-color: #3182ce;
  box-shadow: 0 0 0 2px rgba(49, 130, 206, 0.3);
}

.text-content {
  flex: 1;
  overflow: hidden;
}

.text-preview {
  color: white;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4px;
  background: rgba(255, 255, 255, 0.3);
  cursor: ew-resize;
  opacity: 0;
  transition: opacity 0.2s;
}

.text-clip:hover .resize-handle {
  opacity: 1;
}

.resize-handle.left {
  left: 0;
}

.resize-handle.right {
  right: 0;
}
</style>
```

### 4.2 Timeline组件中集成TextClip

```typescript
// 在 Timeline.vue 中集成 TextClip 组件
<template>
  <div class="timeline">
    <!-- 轨道渲染 -->
    <div v-for="track in tracks" :key="track.id" class="track">
      <!-- 轨道头部 -->
      <div class="track-header">{{ track.name }}</div>

      <!-- 轨道内容区域 -->
      <div class="track-content" @contextmenu="handleTrackRightClick($event, track)">
        <!-- 渲染该轨道上的所有项目 -->
        <template v-for="item in getTrackItems(track.id)" :key="item.id">
          <!-- 文本项目使用 TextClip 组件 -->
          <TextClip
            v-if="item.mediaType === 'text'"
            :timeline-item="item"
            :is-selected="selectedItemId === item.id"
            :pixels-per-frame="pixelsPerFrame"
            @select="selectItem"
            @drag="handleDrag"
            @resize="handleResize"
          />

          <!-- 其他类型项目使用 VideoClip 组件 -->
          <VideoClip
            v-else
            :timeline-item="item"
            :is-selected="selectedItemId === item.id"
            :pixels-per-frame="pixelsPerFrame"
            @select="selectItem"
            @drag="handleDrag"
            @resize="handleResize"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import TextClip from './TextClip.vue'
import VideoClip from './VideoClip.vue'
// ... 其他导入
</script>
```

### 4.3 右键菜单扩展

```typescript
// 在轨道右键菜单中添加文本创建选项
<template>
  <ContextMenu>
    <!-- 现有菜单项... -->

    <!-- 文本轨道专用菜单 -->
    <ContextMenuItem
      v-if="trackType === 'text'"
      @click="addTextAtCurrentPosition"
    >
      <Icon name="plus" />
      添加文本
    </ContextMenuItem>

    <!-- 文本clip专用菜单（限制操作） -->
    <template v-if="selectedItem?.mediaType === 'text'">
      <ContextMenuItem @click="copyClip">复制</ContextMenuItem>
      <ContextMenuItem @click="deleteClip">删除</ContextMenuItem>
      <!-- 注意：没有分割、裁剪等选项 -->
    </template>
  </ContextMenu>
</template>
```

### 4.4 新增TextProperties组件

```vue
<!-- 新增 TextProperties.vue 组件，专门处理文本属性编辑 -->
<template>
  <div class="text-properties">
    <!-- 文本内容编辑 -->
    <div class="property-section">
      <h4 class="section-title">文本内容</h4>
      <div class="property-group">
        <label>内容</label>
        <textarea
          v-model="localConfig.text"
          @input="handleTextChange"
          placeholder="输入文本内容..."
          class="text-input"
          rows="3"
        />
      </div>
    </div>

    <!-- 字体样式 -->
    <div class="property-section">
      <h4 class="section-title">字体样式</h4>

      <div class="property-group">
        <label>字体族</label>
        <select v-model="localConfig.style.fontFamily" @change="handleStyleChange">
          <option value="Arial">Arial</option>
          <option value="微软雅黑">微软雅黑</option>
          <option value="宋体">宋体</option>
          <option value="黑体">黑体</option>
        </select>
      </div>

      <div class="property-group">
        <label>字体大小</label>
        <div class="range-input">
          <input
            type="range"
            v-model="localConfig.style.fontSize"
            min="12" max="120"
            @input="handleStyleChange"
          />
          <span class="value">{{ localConfig.style.fontSize }}px</span>
        </div>
      </div>

      <div class="property-group">
        <label>字重</label>
        <select v-model="localConfig.style.fontWeight" @change="handleStyleChange">
          <option value="normal">正常</option>
          <option value="bold">粗体</option>
          <option value="lighter">细体</option>
        </select>
      </div>

      <div class="property-group">
        <label>对齐方式</label>
        <div class="align-buttons">
          <button
            v-for="align in ['left', 'center', 'right']"
            :key="align"
            :class="{ active: localConfig.style.textAlign === align }"
            @click="setTextAlign(align)"
          >
            {{ alignLabels[align] }}
          </button>
        </div>
      </div>
    </div>

    <!-- 颜色和效果 -->
    <div class="property-section">
      <h4 class="section-title">颜色和效果</h4>

      <div class="property-group">
        <label>文字颜色</label>
        <div class="color-input">
          <input
            type="color"
            v-model="localConfig.style.color"
            @change="handleStyleChange"
          />
          <span class="color-value">{{ localConfig.style.color }}</span>
        </div>
      </div>

      <div class="property-group">
        <label>背景颜色</label>
        <div class="color-input">
          <input
            type="color"
            v-model="localConfig.style.backgroundColor"
            @change="handleStyleChange"
          />
          <input
            type="checkbox"
            v-model="hasBackground"
            @change="toggleBackground"
          />
          <span>启用背景</span>
        </div>
      </div>
    </div>

    <!-- 位置和变换 - 复用通用关键帧动画组件 -->
    <div class="property-section">
      <h4 class="section-title">位置和变换</h4>

      <!-- 复用现有的关键帧动画组件 -->
      <KeyframeAnimationControls
        :timeline-item="timelineItem"
        :supported-properties="['x', 'y', 'opacity', 'zIndex']"
        @update="handleAnimationUpdate"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { TextMediaConfig, TimelineItem } from '../types'
import KeyframeAnimationControls from './KeyframeAnimationControls.vue'

interface Props {
  config: TextMediaConfig
  timelineItem: TimelineItem<'text'>  // 用于关键帧动画组件
}

interface Emits {
  (e: 'update:config', config: TextMediaConfig): void
  (e: 'update:animation', animationData: any): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 本地配置状态
const localConfig = ref<TextMediaConfig>({ ...props.config })

// 对齐方式标签
const alignLabels = {
  left: '左对齐',
  center: '居中',
  right: '右对齐'
}

// 背景颜色开关
const hasBackground = computed({
  get: () => !!localConfig.value.style.backgroundColor,
  set: (value: boolean) => {
    if (!value) {
      localConfig.value.style.backgroundColor = undefined
    } else {
      localConfig.value.style.backgroundColor = '#000000'
    }
  }
})

// 监听外部配置变化
watch(() => props.config, (newConfig) => {
  localConfig.value = { ...newConfig }
}, { deep: true })

// 事件处理函数
function handleTextChange() {
  emit('update:config', { ...localConfig.value })
}

function handleStyleChange() {
  emit('update:config', { ...localConfig.value })
}

function handleAnimationUpdate(animationData: any) {
  // 处理关键帧动画组件的更新
  emit('update:animation', animationData)
}

function setTextAlign(align: 'left' | 'center' | 'right') {
  localConfig.value.style.textAlign = align
  handleStyleChange()
}

function toggleBackground() {
  handleStyleChange()
}
</script>

<style scoped>
.text-properties {
  padding: 16px;
  max-height: 600px;
  overflow-y: auto;
}

.property-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 12px;
  padding-bottom: 4px;
  border-bottom: 1px solid #e2e8f0;
}

.property-group {
  margin-bottom: 16px;
}

.property-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #4a5568;
  margin-bottom: 4px;
}

.text-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 12px;
  resize: vertical;
}

.range-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.range-input input[type="range"] {
  flex: 1;
}

.value {
  font-size: 12px;
  color: #6b7280;
  min-width: 40px;
}

.color-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-value {
  font-size: 12px;
  color: #6b7280;
}

.align-buttons {
  display: flex;
  gap: 4px;
}

.align-buttons button {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  background: white;
  font-size: 12px;
  cursor: pointer;
}

.align-buttons button.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.position-controls {
  display: flex;
  gap: 8px;
}

.input-group {
  flex: 1;
}

.input-group label {
  margin-bottom: 2px;
}

.input-group input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 12px;
}

/* 关键帧动画组件的样式会自动继承 */
</style>
```

## 5. 命令系统扩展

### 5.1 文本项目操作命令（遵循从源头重建原则）

```typescript
// 在 timelineCommands.ts 中新增
export class AddTextItemCommand implements Command {
  private originalTextData: TextTimelineItemData

  constructor(
    private text: string,
    private style: Partial<TextStyleConfig>,
    private startTimeFrames: number,
    private trackId: string,
    private timelineModule: TimelineModule,
    private webavModule: WebAVModule
  ) {
    // 保存原始文本数据用于重建
    this.originalTextData = {
      id: generateTimelineItemId(),
      mediaItemId: '', // 文本项目不来自媒体库
      trackId: this.trackId,
      mediaType: 'text',
      timeRange: {
        timelineStartTime: this.startTimeFrames,
        timelineEndTime: this.startTimeFrames + TextVisibleSprite.DEFAULT_DURATION,
        displayDuration: TextVisibleSprite.DEFAULT_DURATION
      },
      config: {
        text: this.text,
        style: TextHelper.validateTextStyle(this.style),
        x: 400, // 默认位置
        y: 300,
        width: 0, // 将由TextVisibleSprite自动计算
        height: 0,
        opacity: 1,
        zIndex: 0
      }
    }
  }

  /**
   * 从原始数据重建文本项目
   * 遵循"从源头重建"原则
   */
  private async rebuildTextItem(): Promise<TextTimelineItem> {
    console.log('🔄 从源头重建文本项目...')

    // 1. 创建新的文本精灵
    const textSprite = await TextVisibleSprite.create(
      this.originalTextData.config.text,
      this.originalTextData.config.style
    )

    // 2. 设置时间范围
    textSprite.setTimeRange(this.originalTextData.timeRange)

    // 3. 设置位置和属性
    textSprite.rect.x = this.originalTextData.config.x
    textSprite.rect.y = this.originalTextData.config.y
    textSprite.setOpacityValue(this.originalTextData.config.opacity)
    textSprite.zIndex = this.originalTextData.config.zIndex

    // 4. 创建时间轴项目
    const timelineItem: TextTimelineItem = reactive({
      id: this.originalTextData.id,
      mediaItemId: this.originalTextData.mediaItemId,
      trackId: this.originalTextData.trackId,
      mediaType: 'text',
      timeRange: textSprite.getTimeRange(),
      sprite: markRaw(textSprite),
      config: { ...this.originalTextData.config }
    })

    return timelineItem
  }

  async execute(): Promise<void> {
    try {
      console.log('🔄 执行添加文本项目操作：从源头重建...')

      // 从原始数据重新创建文本项目
      const textItem = await this.rebuildTextItem()

      // 添加到时间轴
      this.timelineModule.addTimelineItem(textItem)

      // 设置双向数据同步
      this.timelineModule.setupBidirectionalSync(textItem)

      // 添加到WebAV画布
      this.webavModule.addSprite(textItem.sprite)

      console.log('✅ 文本项目添加成功')
    } catch (error) {
      console.error('❌ 添加文本项目失败:', error)
      throw error
    }
  }

  async undo(): Promise<void> {
    try {
      console.log('🔄 撤销添加文本项目操作...')

      // 移除时间轴项目（会自动清理sprite）
      this.timelineModule.removeTimelineItem(this.originalTextData.id)

      console.log('↩️ 文本项目删除成功')
    } catch (error) {
      console.error('❌ 撤销添加文本项目失败:', error)
      throw error
    }
  }
}

export class UpdateTextCommand implements Command {
  private originalTextData: TextTimelineItemData
  private oldTextData: TextTimelineItemData | null = null

  constructor(
    private timelineItemId: string,
    private newText: string,
    private newStyle: Partial<TextStyleConfig>,
    private timelineModule: TimelineModule,
    private webavModule: WebAVModule
  ) {}

  /**
   * 从原始数据重建文本项目
   * 遵循"从源头重建"原则
   */
  private async rebuildTextItem(textData: TextTimelineItemData): Promise<TextTimelineItem> {
    console.log('🔄 从源头重建文本项目...')

    // 1. 创建新的文本精灵
    const textSprite = await TextVisibleSprite.create(
      textData.config.text,
      textData.config.style
    )

    // 2. 设置时间范围
    textSprite.setTimeRange(textData.timeRange)

    // 3. 设置位置和属性
    textSprite.rect.x = textData.config.x
    textSprite.rect.y = textData.config.y
    textSprite.setOpacityValue(textData.config.opacity)
    textSprite.zIndex = textData.config.zIndex

    // 4. 创建时间轴项目
    const timelineItem: TextTimelineItem = reactive({
      id: textData.id,
      mediaItemId: textData.mediaItemId,
      trackId: textData.trackId,
      mediaType: 'text',
      timeRange: textSprite.getTimeRange(),
      sprite: markRaw(textSprite),
      config: { ...textData.config }
    })

    return timelineItem
  }

  async execute(): Promise<void> {
    try {
      console.log('🔄 执行更新文本操作：从源头重建...')

      // 1. 获取当前项目并保存旧数据
      const currentItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!currentItem || currentItem.mediaType !== 'text') {
        throw new Error('找不到文本项目或类型不匹配')
      }

      // 保存旧数据用于撤销
      this.oldTextData = {
        id: currentItem.id,
        mediaItemId: currentItem.mediaItemId,
        trackId: currentItem.trackId,
        mediaType: 'text',
        timeRange: currentItem.timeRange,
        config: { ...currentItem.config }
      }

      // 2. 创建新的文本数据
      const newTextData: TextTimelineItemData = {
        ...this.oldTextData,
        config: {
          ...this.oldTextData.config,
          text: this.newText,
          style: { ...this.oldTextData.config.style, ...this.newStyle }
        }
      }

      // 3. 移除旧项目
      this.timelineModule.removeTimelineItem(this.timelineItemId)

      // 4. 从新数据重建项目
      const newTextItem = await this.rebuildTextItem(newTextData)

      // 5. 添加新项目
      this.timelineModule.addTimelineItem(newTextItem)
      this.timelineModule.setupBidirectionalSync(newTextItem)
      this.webavModule.addSprite(newTextItem.sprite)

      console.log('✅ 文本更新成功')
    } catch (error) {
      console.error('❌ 更新文本失败:', error)
      throw error
    }
  }

  async undo(): Promise<void> {
    try {
      console.log('🔄 撤销更新文本操作：从源头重建...')

      if (!this.oldTextData) {
        throw new Error('没有保存的旧数据')
      }

      // 1. 移除当前项目
      this.timelineModule.removeTimelineItem(this.timelineItemId)

      // 2. 从旧数据重建项目
      const oldTextItem = await this.rebuildTextItem(this.oldTextData)

      // 3. 添加旧项目
      this.timelineModule.addTimelineItem(oldTextItem)
      this.timelineModule.setupBidirectionalSync(oldTextItem)
      this.webavModule.addSprite(oldTextItem.sprite)

      console.log('↩️ 文本更新撤销成功')
    } catch (error) {
      console.error('❌ 撤销文本更新失败:', error)
      throw error
    }
  }
}

// 文本时间轴项目数据接口
interface TextTimelineItemData {
  id: string
  mediaItemId: string
  trackId: string
  mediaType: 'text'
  timeRange: ImageTimeRange
  config: TextMediaConfig
}
```

## 6. 集成点和扩展点

### 6.1 轨道类型检查扩展

```typescript
// 在 Timeline.vue 中扩展轨道兼容性检查
function isMediaCompatibleWithTrack(mediaType: MediaType, trackType: TrackType): boolean {
  switch (trackType) {
    case 'video':
      return mediaType === 'video' || mediaType === 'image'
    case 'audio':
      return mediaType === 'audio'
    case 'text':
      return mediaType === 'text'  // 文本只能在文本轨道
    default:
      return false
  }
}

// 拖拽限制检查
function handleClipDrop(event: DragEvent, targetTrackId: string) {
  const draggedItem = getDraggedTimelineItem()
  const targetTrack = tracks.value.find(t => t.id === targetTrackId)

  // 检查兼容性
  if (!isMediaCompatibleWithTrack(draggedItem.mediaType, targetTrack.type)) {
    // 显示错误提示
    showDropError(`${draggedItem.mediaType}类型不能放置在${targetTrack.type}轨道上`)
    return
  }

  // 执行拖拽操作...
}
```

### 6.2 操作限制的具体应用

```typescript
// 在工具栏中的应用
// 位置：frontend/src/components/Toolbar.vue
<template>
  <div class="toolbar">
    <button
      :disabled="!isOperationAllowed('crop', selectedItem?.mediaType)"
      @click="cropClip"
    >
      裁剪
    </button>

    <button
      :disabled="!isOperationAllowed('split', selectedItem?.mediaType)"
      @click="splitClip"
    >
      分割
    </button>

    <!-- 其他工具按钮... -->
  </div>
</template>

<script setup>
import { isOperationAllowed } from '../utils/clipConstraints'
</script>

// 在右键菜单中的应用
// 位置：frontend/src/components/ContextMenu.vue
<template>
  <div class="context-menu">
    <div
      v-for="operation in availableOperations"
      :key="operation"
      @click="executeOperation(operation)"
    >
      {{ operationLabels[operation] }}
    </div>
  </div>
</template>

<script setup>
import { TEXT_CLIP_CONSTRAINTS, isOperationAllowed } from '../utils/clipConstraints'

const availableOperations = computed(() => {
  if (!selectedItem.value) return []

  return TEXT_CLIP_CONSTRAINTS.supportedOperations.filter(op =>
    isOperationAllowed(op, selectedItem.value.mediaType)
  )
})
</script>

// 在拖拽处理中的应用
// 位置：frontend/src/components/Timeline.vue
function handleClipDrop(event: DragEvent, targetTrackId: string) {
  const draggedItem = getDraggedTimelineItem()
  const targetTrack = tracks.value.find(t => t.id === targetTrackId)

  // 使用限制检查
  if (!isTrackCompatible(draggedItem.mediaType, targetTrack.type)) {
    showDropError(`${draggedItem.mediaType}类型不能放置在${targetTrack.type}轨道上`)
    return
  }

  // 执行拖拽操作...
}
```

## 7. 实现优先级和阶段

### 阶段1：基础文本轨道支持
1. ✅ 扩展类型定义（添加 'text' 到 MediaType）
2. ✅ 实现文本项目创建流程（右键菜单）
3. ✅ 扩展VideoClip组件显示文本项目
4. ✅ 基础的文本轨道操作和限制

### 阶段2：文本编辑功能
1. 🔄 TextClip组件实现（专用文本clip显示）
2. 🔄 TextProperties组件实现（独立文本属性编辑）
3. 🔄 轨道兼容性检查和操作限制
4. 🔄 实时预览和更新

### 阶段3：高级功能
1. ⏳ 文本动画支持
2. ⏳ 文本模板系统
3. ⏳ 字体管理
4. ⏳ 文本效果（阴影、描边等）

## 8. 关键技术考虑

### 8.1 性能优化
- **缓存复用**：利用现有的TextVisibleSprite缓存机制
- **防抖处理**：文本渲染的300ms防抖延迟
- **虚拟化渲染**：大量文本项目的性能优化

### 8.2 用户体验
- **一致性编辑**：通过属性面板编辑，与其他媒体类型保持一致
- **操作限制**：清晰的视觉反馈显示文本clip的操作限制
- **实时预览**：文本效果的即时预览
- **轨道专用**：文本只能在文本轨道上操作，避免混淆

### 8.3 数据一致性
- **同步更新**：文本内容与样式的实时同步
- **历史记录**：撤销/重做系统的完整支持
- **项目兼容**：保存和加载的向后兼容性

## 9. 文件结构

```
frontend/src/
├── types/index.ts                    # 类型定义扩展（添加 'text' MediaType）
├── components/
│   ├── Timeline.vue                  # 轨道管理和TextClip集成
│   ├── VideoClip.vue                 # 保持现有功能（视频/图片）
│   ├── TextClip.vue                  # 新增：专用文本clip组件
│   ├── TextProperties.vue            # 新增：文本属性编辑组件
│   ├── PropertiesPanel.vue           # 扩展：集成TextProperties
│   ├── ContextMenu.vue               # 扩展：右键菜单文本选项和操作限制
│   └── Toolbar.vue                   # 扩展：工具栏按钮状态控制
├── stores/modules/
│   ├── trackModule.ts                # 文本轨道支持
│   ├── timelineModule.ts             # 文本项目管理
│   └── commands/
│       └── timelineCommands.ts       # 文本操作命令
├── utils/
│   ├── TextVisibleSprite.ts          # 已有：文本精灵
│   ├── TextHelper.ts                 # 已有：文本渲染工具
│   ├── clipConstraints.ts            # 新增：文本clip操作限制配置
│   └── textTimelineUtils.ts          # 新增：文本时间轴工具

└── docs/
    └── text-track-support-design.md  # 本设计文档
```

## 10. UI操作流程总结

### 完整的用户操作流程

1. **创建文本轨道**
   - 点击时间轴"添加轨道"按钮
   - 选择"文本轨道"类型

2. **添加文本项目**
   - 右键点击文本轨道空白区域
   - 选择"添加文本"菜单项
   - 系统在右键位置创建默认文本项目（使用TextClip组件显示）

3. **编辑文本内容和样式**
   - 点击选中文本项目
   - 在右侧属性面板中显示TextProperties组件
   - 编辑文本内容、样式、位置等，修改实时生效

4. **调整和操作**
   - 拖拽移动：调整文本出现时间
   - 拖拽边缘：调整文本显示时长
   - 复制/删除：标准操作
   - **限制**：不能拖到其他轨道，不能裁剪/分割

5. **预览和完成**
   - 播放时间轴查看文本效果
   - 继续调整直到满意

### 设计优势

- **专用性**：TextClip组件专门为文本设计，高度较低，只显示文本内容
- **模块化**：TextProperties组件独立，便于扩展和维护
- **一致性**：操作方式与其他媒体类型保持一致
- **直观性**：操作限制有清晰的视觉反馈
- **高效性**：实时编辑，无需额外确认步骤

## 11. 下一步行动

1. **类型系统扩展**：首先扩展类型定义，确保类型安全
2. **操作限制系统实现**：创建 clipConstraints.ts 工具模块
3. **轨道兼容性实现**：实现文本轨道的操作限制
4. **TextClip组件开发**：专用文本clip显示组件
5. **TextProperties组件开发**：独立文本属性编辑组件
6. **UI限制集成**：在工具栏、右键菜单中应用操作限制
7. **右键菜单扩展**：添加文本创建功能
8. **集成测试**：确保与现有系统的无缝集成

---

*本文档将随着实现进度持续更新*

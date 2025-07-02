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
│   ├── 文本轨道渲染 (扩展VideoClip)
│   ├── 文本编辑面板 (新增)
│   └── 文本样式控制器 (新增)
└── 命令系统扩展
    ├── 文本项目操作命令 (新增)
    └── 文本样式更新命令 (新增)
```

## 2. 类型系统扩展

### 2.1 文本媒体配置类型

文本媒体配置通过继承 `VisualMediaProps` 实现了与视频、图片的一致性：

**设计优势：**
- **类型一致性**：文本与其他视觉媒体共享相同的位置、大小、透明度等属性
- **代码复用**：可以复用现有的视觉属性处理逻辑
- **功能完整**：文本支持旋转、透明度、层级等所有视觉效果
- **扩展性强**：未来添加新的视觉属性时，文本会自动继承

```typescript
// 在 frontend/src/types/index.ts 中新增
export interface TextMediaConfig extends VisualMediaProps {
  /** 文本内容 */
  text: string

  /** 文本样式配置 */
  style: TextStyleConfig

  // 继承了 VisualMediaProps 的所有属性：
  // - x: number              // 水平位置
  // - y: number              // 垂直位置
  // - width: number          // 宽度
  // - height: number         // 高度
  // - rotation: number       // 旋转角度（弧度）
  // - opacity: number        // 透明度（0-1）
  // - zIndex: number         // 层级控制（来自 BaseMediaProps）
  // - animation?: AnimationConfig // 动画配置（来自 BaseMediaProps）
}

// 扩展现有的 MediaConfigMap 和 GetMediaConfig 类型
type MediaConfigMap = {
  video: VideoMediaConfig
  image: ImageMediaConfig
  audio: AudioMediaConfig
  text: TextMediaConfig  // 新增
}

export type GetMediaConfig<T extends MediaType> = MediaConfigMap[T]
```

### 2.2 文本时间轴项目类型

```typescript
// 扩展 TimelineItem 以支持文本类型
export interface TextTimelineItem extends TimelineItem<'text'> {
  mediaType: 'text'
  timeRange: ImageTimeRange  // 文本使用与图片相同的时间范围
  sprite: Raw<TextVisibleSprite>
  config: TextMediaConfig
}
```

### 2.3 自定义Sprite类型扩展

```typescript
// 直接更新 CustomSprite 类型以包含文本精灵
export type CustomSprite =
  | VideoVisibleSprite
  | ImageVisibleSprite
  | TextVisibleSprite
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

  // 3. 设置默认位置（画布中心）- 与图片创建逻辑一致
  const canvasWidth = videoStore.videoResolution.width
  const canvasHeight = videoStore.videoResolution.height
  textSprite.rect.x = (canvasWidth - textSprite.rect.w) / 2
  textSprite.rect.y = (canvasHeight - textSprite.rect.h) / 2

  // 4. 将WebAV坐标系转换为项目坐标系（中心原点）
  const projectCoords = webavToProjectCoords(
    textSprite.rect.x,
    textSprite.rect.y,
    textSprite.rect.w,
    textSprite.rect.h,
    canvasWidth,
    canvasHeight,
  )

  // 5. 创建时间轴项目
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
      // 使用项目坐标系（中心原点）
      x: Math.round(projectCoords.x),
      y: Math.round(projectCoords.y),
      width: textSprite.rect.w,
      height: textSprite.rect.h,
      rotation: textSprite.rect.angle || 0,
      opacity: textSprite.opacity,
      zIndex: textSprite.zIndex,
      animation: undefined,
    }
  }

  return timelineItem
}
```

### 3.2 文本轨道激活流程

```typescript
// 扩展现有的 addNewTrack 函数
async function addNewTrack(type: TrackType = 'video') {
  if (type === 'text') {
    // 创建文本轨道
    const newTrackId = await videoStore.addTrackWithHistory(type)
    
    // 可选：自动添加一个示例文本项目
    if (newTrackId) {
      await addDefaultTextItem(newTrackId)
    }
    
    return newTrackId
  }
  
  // 其他轨道类型的现有逻辑...
}

async function addDefaultTextItem(trackId: string) {
  const textItem = await createTextTimelineItem(
    '点击编辑文本',
    { fontSize: 48, color: 'white' },
    0, // 从时间轴开始
    trackId
  )
  
  await videoStore.addTimelineItemWithHistory(textItem)
}
```

## 4. UI组件扩展

### 4.1 TextClip组件创建

创建独立的TextClip组件，样式与VideoClip保持一致，但专门用于显示文本内容：

```typescript
// 新增 TextClip.vue 组件
<template>
  <div
    class="text-clip"
    :class="{
      overlapping: isOverlapping,
      selected: isSelected,
      dragging: isDragging,
      resizing: isResizing,
      'track-hidden': !isTrackVisible,
    }"
    :style="clipStyle"
    :data-media-type="'text'"
    :data-timeline-item-id="timelineItem.id"
    :draggable="true"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @click="selectClip"
    @dblclick="editText"
  >
    <div class="clip-content">
      <!-- 文本内容显示 -->
      <div class="text-content">
        <span class="text-preview">{{ textPreview }}</span>
      </div>
      <!-- 文本标签 -->
      <div class="clip-label">
        {{ timelineItem.config.text || '文本' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 复用VideoClip的大部分逻辑，但简化显示内容
const textPreview = computed(() => {
  const text = props.timelineItem.config.text || ''
  return text.length > 20 ? text.substring(0, 20) + '...' : text
})

function editText() {
  // 触发文本编辑模式
  emit('edit-text', props.timelineItem.id)
}
</script>

<style scoped>
/* 继承VideoClip的基础样式 */
.text-clip {
  /* 与 .video-clip 相同的基础样式 */
  position: absolute;
  background: linear-gradient(135deg, #4CAF50, #45a049); /* 文本专用颜色 */
  border-radius: 4px;
  cursor: move;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 10;
  border: 2px solid transparent;
}

.text-content {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: white;
  padding: 4px;
}
</style>
```

### 4.2 Timeline组件中的TextClip集成

```typescript
// 在 Timeline.vue 中根据媒体类型渲染不同的clip组件
<template>
  <div class="timeline">
    <!-- 轨道渲染 -->
    <div v-for="track in tracks" :key="track.id" class="track">
      <!-- 时间轴项目渲染 -->
      <component
        v-for="item in getTrackItems(track.id)"
        :key="item.id"
        :is="getClipComponent(item.mediaType)"
        :timeline-item="item"
        :timeline-width="timelineWidth"
        @edit-text="handleEditText"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import VideoClip from './VideoClip.vue'
import TextClip from './TextClip.vue'

function getClipComponent(mediaType: MediaType) {
  switch (mediaType) {
    case 'video':
    case 'image':
    case 'audio':
      return VideoClip
    case 'text':
      return TextClip
    default:
      return VideoClip
  }
}

function handleEditText(itemId: string) {
  // 处理文本编辑逻辑
  console.log('编辑文本项目:', itemId)
}
</script>
```

### 4.3 文本编辑面板组件

```typescript
// 新增 TextEditPanel.vue 组件
<template>
  <div class="text-edit-panel">
    <div class="text-input-section">
      <textarea 
        v-model="editingText"
        @input="handleTextChange"
        placeholder="输入文本内容..."
        class="text-input"
      />
    </div>
    
    <div class="text-style-section">
      <TextStyleControls 
        :style="editingStyle"
        @update:style="handleStyleChange"
      />
    </div>
    
    <div class="text-actions">
      <button @click="applyChanges">应用</button>
      <button @click="cancelChanges">取消</button>
    </div>
  </div>
</template>
```

### 4.4 文本样式控制器组件

```typescript
// 新增 TextStyleControls.vue 组件
<template>
  <div class="text-style-controls">
    <div class="font-controls">
      <select v-model="localStyle.fontFamily">
        <option value="Arial">Arial</option>
        <option value="微软雅黑">微软雅黑</option>
        <!-- 更多字体选项 -->
      </select>
      
      <input 
        type="range" 
        v-model="localStyle.fontSize"
        min="12" 
        max="120"
        @input="emitStyleChange"
      />
    </div>
    
    <div class="color-controls">
      <input 
        type="color" 
        v-model="localStyle.color"
        @change="emitStyleChange"
      />
    </div>
    
    <!-- 更多样式控制... -->
  </div>
</template>
```

## 5. 命令系统扩展

### 5.1 文本项目操作命令

```typescript
// 在 timelineCommands.ts 中新增
export class AddTextItemCommand implements Command {
  private textItem: TextTimelineItem | null = null
  
  constructor(
    private text: string,
    private style: Partial<TextStyleConfig>,
    private startTimeFrames: number,
    private trackId: string,
    private timelineModule: TimelineModule,
    private webavModule: WebAVModule
  ) {}
  
  async execute(): Promise<void> {
    this.textItem = await createTextTimelineItem(
      this.text,
      this.style,
      this.startTimeFrames,
      this.trackId
    )
    
    this.timelineModule.addTimelineItem(this.textItem)
    this.webavModule.addSprite(this.textItem.sprite)
  }
  
  async undo(): Promise<void> {
    if (this.textItem) {
      this.webavModule.removeSprite(this.textItem.sprite)
      this.timelineModule.removeTimelineItem(this.textItem.id)
    }
  }
}

export class UpdateTextCommand implements Command {
  constructor(
    private timelineItemId: string,
    private newText: string,
    private newStyle: Partial<TextStyleConfig>,
    private timelineModule: TimelineModule
  ) {}

  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (item && item.mediaType === 'text') {
      const textSprite = item.sprite as TextVisibleSprite
      await textSprite.updateTextAndStyle(this.newText, this.newStyle)

      // 更新配置
      const textItem = item as TextTimelineItem
      textItem.config.text = this.newText
      textItem.config.style = { ...textItem.config.style, ...this.newStyle }
    }
  }
}
```

### 5.2 文本clip操作命令（复用现有逻辑）

文本clip的复制、撤销等操作可以直接复用现有的命令系统，因为都遵循相同的"从源头重建"原则：

```typescript
// 文本clip复制 - 复用 DuplicateTimelineItemCommand
// 从文本内容重新创建sprite，恢复所有属性

// 文本clip撤销 - 复用现有的 Command 系统
// 从保存的状态重新创建文本sprite

// 注意：文本clip不支持分割操作
// 文本是完整的内容单元，不像视频可以按时间分割
```

**关键实现点：**
- 文本clip需要扩展 `createSpriteFromMediaItem` 支持文本类型
- 或者为文本创建专门的重建函数 `recreateTextSprite`
- 确保文本的时间范围、变换属性能正确恢复
- **分割操作**：在UI中对文本clip禁用分割功能

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
      return mediaType === 'text'  // 新增
    default:
      return false
  }
}
```

### 6.2 拖拽处理扩展

```typescript
// 支持从工具栏拖拽创建文本项目
function handleTextToolDrop(event: DragEvent) {
  const dropPosition = calculateDropPosition(event)
  if (dropPosition) {
    const { dropTime, targetTrackId } = dropPosition
    
    // 检查目标轨道是否为文本轨道
    const targetTrack = tracks.value.find(t => t.id === targetTrackId)
    if (targetTrack?.type === 'text') {
      createTextTimelineItem(
        '新文本',
        DEFAULT_TEXT_STYLE,
        dropTime,
        targetTrackId
      )
    }
  }
}
```

## 7. 实现优先级和阶段

### 阶段1：基础文本轨道支持
1. ✅ 扩展类型定义
2. ✅ 实现文本项目创建流程
3. ✅ 扩展VideoClip组件显示文本项目
4. ✅ 基础的文本轨道操作

### 阶段2：文本编辑功能
1. 🔄 文本编辑面板组件
2. 🔄 文本样式控制器
3. 🔄 实时预览和更新
4. 🔄 文本项目的拖拽和调整

### 阶段3：高级功能
1. ⏳ 文本动画支持
2. ⏳ 文本模板系统
3. ⏳ 字体管理
4. ⏳ 文本效果（阴影、描边等）

## 8. 关键技术考虑

### 8.1 与图片clip的处理对比

文本clip与图片clip的处理逻辑高度相似，主要区别在于内容更新机制：

**相似性：**
- **底层结构**：都基于 `ImgClip` → `VisibleSprite` 的架构
- **时间轴处理**：都使用 `ImageTimeRange`，时间轴操作逻辑完全一致
- **属性管理**：位置、大小、透明度、旋转等属性处理相同
- **生命周期**：创建、添加到画布、销毁的流程相同

**共同原则：都遵循"从源头重建"策略**
- **图片clip**：复制、分割、撤销等操作时，都从原始MediaItem重新创建sprite
- **文本clip**：内容/样式变化、复制、撤销时，从文本内容重新渲染创建sprite

```typescript
// 图片：从原始MediaItem重建（复制、分割、撤销时）
const newSprite = await createSpriteFromMediaItem(mediaItem)
newSprite.setTimeRange(timeRange)
// 恢复变换属性...

// 文本：从文本内容重建（内容变化、复制、撤销时）
const newSprite = await TextVisibleSprite.create(newText, newStyle)
// 恢复位置、时间等属性...
```

**文本重建策略（与图片操作保持一致）：**
1. **检测变化**：文本内容或样式是否改变
2. **重新渲染**：调用 `renderTxt2ImgBitmap` 生成新的ImageBitmap
3. **重建ImgClip**：基于新的ImageBitmap创建ImgClip
4. **创建新Sprite**：从源头创建新的TextVisibleSprite实例
5. **状态恢复**：保持位置、大小、透明度、时间范围等属性不变
6. **替换实例**：在时间轴中替换旧的sprite实例

### 8.2 性能优化
- **缓存复用**：利用现有的TextVisibleSprite缓存机制
- **防抖处理**：文本渲染的300ms防抖延迟
- **虚拟化渲染**：大量文本项目的性能优化

### 8.3 动画支持
通过继承 `VisualMediaProps`，文本自动获得完整的动画能力：
- **位置动画**：x, y 坐标的关键帧动画
- **大小动画**：width, height 的缩放动画
- **旋转动画**：rotation 角度的旋转动画
- **透明度动画**：opacity 的淡入淡出效果
- **复合动画**：多个属性的组合动画效果

```typescript
// 文本动画示例
const textAnimation: AnimationConfig = {
  keyframes: [
    { framePosition: 0, properties: { x: 100, y: 100, opacity: 0 } },
    { framePosition: 30, properties: { x: 200, y: 150, opacity: 1 } },
    { framePosition: 60, properties: { x: 300, y: 200, rotation: Math.PI / 4 } }
  ],
  isEnabled: true,
  easing: 'ease-in-out'
}
```

### 8.4 UI组件复用
由于文本继承自 `VisualMediaProps`，可以直接复用现有的视觉控制组件：

**可复用的位置和变换控制：**
- 位置控制器（x, y 坐标调整）
- 尺寸控制器（width, height 缩放）
- 旋转控制器（rotation 角度调整）
- 透明度控制器（opacity 透明度调整）
- 层级控制器（zIndex 层级管理）

**可复用的动画系统：**
- 关键帧编辑器（时间轴上的关键帧设置）
- 动画时间轴（动画播放控制）
- 缓动函数选择器（动画过渡效果）
- 动画预览功能（实时预览动画效果）

**仅需新增的文本专用组件：**
- 文本内容编辑器（双击编辑文本内容）
- 文本样式面板（字体、颜色、对齐等样式设置）

### 8.5 用户体验
- **直观编辑**：双击文本项目进入编辑模式
- **拖拽调整**：支持文本位置和大小的拖拽调整
- **实时预览**：文本效果的即时预览
- **快捷键支持**：常用操作的键盘快捷键

### 8.6 数据一致性
- **同步更新**：文本内容与样式的实时同步
- **历史记录**：撤销/重做系统的完整支持
- **项目兼容**：保存和加载的向后兼容性

## 9. 文件结构

```
frontend/src/
├── types/index.ts                    # 类型定义扩展
├── components/
│   ├── Timeline.vue                  # 轨道管理扩展
│   ├── VideoClip.vue                 # 文本项目显示扩展
│   ├── TextEditPanel.vue             # 新增：文本编辑面板
│   └── TextStyleControls.vue         # 新增：文本样式控制器
├── stores/modules/
│   ├── trackModule.ts                # 文本轨道支持
│   ├── timelineModule.ts             # 文本项目管理
│   └── commands/
│       └── timelineCommands.ts       # 文本操作命令
├── utils/
│   ├── TextVisibleSprite.ts          # 已有：文本精灵
│   ├── TextHelper.ts                 # 已有：文本渲染工具
│   └── textTimelineUtils.ts          # 新增：文本时间轴工具
└── docs/
    └── text-track-support-design.md  # 本设计文档
```

## 10. 下一步行动

1. **类型系统扩展**：首先扩展类型定义，确保类型安全
2. **核心功能实现**：实现文本项目创建和基础管理
3. **UI组件开发**：开发文本编辑相关的UI组件
4. **集成测试**：确保与现有系统的无缝集成
5. **用户测试**：收集用户反馈，优化交互体验

---

*本文档将随着实现进度持续更新*

# 文本轨道支持设计方案

## 📊 实施进度总览

**当前状态**：🎉 **项目已完成** (2024-12-19)

| 阶段 | 状态 | 进度 | 完成时间 |
|------|------|------|----------|
| 阶段1：基础文本轨道支持 | ✅ 已完成 | 100% | 2024-07-03 |
| 阶段2：文本编辑功能 | ✅ 已完成 | 100% | 2024-12-19 |
| 阶段3：高级文本功能 | ⏳ 待开始 | 0% | - |
| 阶段4：性能优化与完善 | ⏳ 待开始 | 0% | - |

**项目完成成果**：
- ✅ 完整的文本轨道创建和管理
- ✅ 文本项目的时间轴显示和操作
- ✅ 右键菜单集成（轨道创建+文本添加）
- ✅ 完整的撤销/重做支持
- ✅ 媒体类型分类架构
- ✅ 调试检查优化
- ✅ 完整的文本编辑面板
- ✅ 丰富的文本样式控制
- ✅ 实时预览和更新
- ✅ 完整的变换控制（位置、缩放、旋转、透明度）
- ✅ 关键帧动画支持
- ✅ 时长调整功能

**用户可用功能**：
- 🎯 创建和管理文本轨道
- 📝 添加和编辑文本内容
- � 丰富的文本样式设置（字体、颜色、对齐、背景色等）
- �🎬 时间轴中查看文本预览
- ↔️ 拖拽移动文本位置
- 🔄 变换控制（位置、缩放、旋转、透明度、层级）
- ⏱️ 调整文本显示时长
- 🎞️ 关键帧动画制作
- ↩️ 撤销/重做所有操作
- 📋 复制、粘贴、删除文本项目

---

## 1. 已实现功能详览

### 1.1 核心功能清单

**轨道管理**：
- ✅ 文本轨道创建和删除
- ✅ 轨道可见性控制
- ✅ 轨道高度自适应（60px，比视频轨道矮）
- ✅ 默认包含一个文本轨道

**文本项目操作**：
- ✅ 右键菜单创建文本项目
- ✅ 文本内容编辑（支持多行）
- ✅ 拖拽移动文本位置
- ✅ 时长调整（时间码输入）
- ✅ 复制、粘贴、删除操作
- ✅ 完整的撤销/重做支持

**文本样式控制**：
- ✅ 字体选择（7种常用字体）
- ✅ 字体大小（12-200px，滑块+数字输入）
- ✅ 字体样式（正常/粗体/细体，正常/斜体）
- ✅ 文字颜色（颜色选择器）
- ✅ 文本对齐（左/中/右）
- ✅ 背景颜色（可选启用/禁用）

**变换控制**：
- ✅ 位置调整（x, y坐标）
- ✅ 缩放控制（比例缩放/独立缩放）
- ✅ 旋转控制（角度调整）
- ✅ 透明度控制（0-1范围）
- ✅ 层级控制（zIndex）
- ✅ 对齐功能（水平/垂直对齐）

**动画功能**：
- ✅ 关键帧动画支持
- ✅ 统一关键帧控制
- ✅ 动画时长自动调整
- ✅ 关键帧导航功能

### 1.2 技术实现亮点

**架构设计**：
- ✅ 基于现有BaseClip组件，保持一致性
- ✅ 使用TypeScript泛型 `TimelineItem<'text'>`
- ✅ 媒体类型分类架构（FILE_BASED vs GENERATED）
- ✅ 命令模式实现撤销重做

**性能优化**：
- ✅ 防抖更新机制（blur/确认时更新）
- ✅ 文本渲染缓存复用
- ✅ 精灵重建策略（从源头重建）
- ✅ 内存管理优化

**用户体验**：
- ✅ 实时预览效果
- ✅ 错误处理和用户反馈
- ✅ 直观的操作界面
- ✅ 一致的交互模式

---

## 2. 概述

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
│   ├── 文本轨道渲染 (新增TextClip基于BaseClip)
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

    // 文本轨道创建后为空，用户需要通过右键菜单添加文本项目
    return newTrackId
  }

  // 其他轨道类型的现有逻辑...
}
```

## 4. UI组件扩展

> **注意**：TextClip基于BaseClip基础组件构建。BaseClip提供了所有clip的通用功能（拖拽、调整时长、选中状态等）。
> 详细的BaseClip设计请参考：[BaseClip基础组件设计方案](./base-clip-component-design.md)

### 4.1 TextClip组件创建

基于BaseClip创建TextClip组件，专门处理文本内容显示：

```typescript
// 新增 TextClip.vue 组件 - 基于BaseClip
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
/* TextClip专用样式 */
.text-clip {
  background: linear-gradient(135deg, #4CAF50, #45a049); /* 文本专用颜色 */
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

### 4.2 Timeline组件中的Clip集成

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
        @select="handleSelectClip"
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

function handleSelectClip(itemId: string) {
  // 处理clip选中逻辑
  console.log('选中clip:', itemId)
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



## 6.2 文本创建方式

文本项目只能通过右键菜单创建，不支持拖拽创建：

```typescript
// 在时间轴右键菜单中添加文本创建选项
function showTimelineContextMenu(event: MouseEvent, trackId: string, timePosition: number) {
  const menuItems = [
    // 其他菜单项...
    {
      label: '添加文本',
      action: () => createTextAtPosition(trackId, timePosition),
      visible: isTextTrack(trackId) // 只在文本轨道显示
    }
  ]

  showContextMenu(event, menuItems)
}

async function createTextAtPosition(trackId: string, timeFrames: number) {
  const textItem = await createTextTimelineItem(
    '点击编辑文本',
    { fontSize: 48, color: '#ffffff' },
    timeFrames,
    trackId
  )

  await videoStore.addTimelineItemWithHistory(textItem)
}
```

## 7. 实现优先级和阶段

### 阶段1：基础文本轨道支持 ✅ 已完成
1. ✅ 扩展类型定义
2. ✅ 实现文本项目创建流程
3. ✅ 创建TextClip组件显示文本项目（基于BaseClip）
4. ✅ 基础的文本轨道操作

### 阶段2：文本编辑功能 ✅ 已完成
1. ✅ 文本编辑面板组件（TextClipProperties.vue）
2. ✅ 文本样式控制器（完整的样式控制）
3. ✅ 实时预览和更新（UpdateTextCommand）
4. ✅ 文本项目的位置和大小调整（TransformControls集成）
5. ✅ 关键帧动画支持（useKeyframeTransformControls）
6. ✅ 时长调整功能（时间码输入）

### 阶段3：高级功能 ⏳ 待开始
1. ⏳ 文本效果（阴影、描边、发光等）
2. ⏳ 文本模板系统
3. ⏳ 自定义字体管理
4. ⏳ 文本动画预设

## 8. 关键技术考虑

### 8.1 文本项目的调试检查处理

**问题描述**：
文本项目不需要素材库项目（MediaItem），其 `mediaItemId` 为空字符串，这会导致现有的调试检查逻辑产生"孤立的时间轴项目"警告。

**解决方案**：采用媒体类型分类 + 调试逻辑优化的组合方案

#### 8.1.1 短期解决方案：调试逻辑优化

直接修改 `debugUtils.ts` 中的检查逻辑，为文本类型添加例外处理：

```typescript
// 在 frontend/src/stores/utils/debugUtils.ts 中
function checkOrphanedTimelineItems(
  timelineItems: TimelineItem[],
  mediaItems: MediaItem[]
) {
  const orphanedItems = timelineItems.filter(item => {
    // 文本项目不需要素材库项目，跳过检查
    if (item.mediaType === 'text') {
      return false
    }

    // 其他类型检查是否有对应的素材库项目
    return !mediaItems.find(m => m.id === item.mediaItemId)
  })

  if (orphanedItems.length > 0) {
    console.warn('⚠️ 发现孤立的时间轴项目 (没有对应的素材库项目):', orphanedItems)
  }
}
```

#### 8.1.2 长期架构方案：媒体类型分类

引入媒体类型分类概念，为未来扩展做准备：

```typescript
// 在 frontend/src/types/index.ts 中新增
/**
 * 媒体类型分类
 * 区分基于文件的媒体和程序生成的媒体
 */
export const MEDIA_TYPE_CATEGORIES = {
  /** 基于文件的媒体类型（需要素材库项目） */
  FILE_BASED: ['video', 'image', 'audio'] as const,

  /** 程序生成的媒体类型（不需要素材库项目） */
  GENERATED: ['text'] as const,
} as const

/**
 * 检查媒体类型是否需要素材库项目
 * @param mediaType 媒体类型
 * @returns 是否需要素材库项目
 */
export function requiresMediaItem(mediaType: MediaType): boolean {
  return MEDIA_TYPE_CATEGORIES.FILE_BASED.includes(mediaType as any)
}

/**
 * 检查媒体类型是否为程序生成
 * @param mediaType 媒体类型
 * @returns 是否为程序生成的媒体
 */
export function isGeneratedMedia(mediaType: MediaType): boolean {
  return MEDIA_TYPE_CATEGORIES.GENERATED.includes(mediaType as any)
}
```

#### 8.1.3 优化后的调试检查

使用媒体类型分类的调试检查：

```typescript
// 使用新的分类函数
function checkOrphanedTimelineItems(
  timelineItems: TimelineItem[],
  mediaItems: MediaItem[]
) {
  const orphanedItems = timelineItems.filter(item => {
    // 只检查需要素材库项目的媒体类型
    if (!requiresMediaItem(item.mediaType)) {
      return false
    }

    return !mediaItems.find(m => m.id === item.mediaItemId)
  })

  if (orphanedItems.length > 0) {
    console.warn('⚠️ 发现孤立的时间轴项目 (没有对应的素材库项目):', orphanedItems)
  }
}
```

**实施计划**：
1. **阶段1**：实施短期解决方案，立即解决警告问题
2. **阶段2**：引入媒体类型分类，为未来扩展做准备
3. **阶段3**：在其他相关代码中应用分类概念

**扩展性考虑**：
- 未来添加其他程序生成的媒体类型（如形状、图表、动画等）时，只需添加到 `GENERATED` 分类中
- 调试检查逻辑无需修改，自动适应新的媒体类型

### 8.2 与图片clip的处理对比

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
- **位置调整**：支持文本位置和大小的调整
- **实时预览**：文本效果的即时预览
- **右键创建**：通过右键菜单创建文本项目

### 8.6 数据一致性
- **同步更新**：文本内容与样式的实时同步
- **历史记录**：撤销/重做系统的完整支持
- **项目兼容**：保存和加载的向后兼容性

## 9. 实际文件结构

```
frontend/src/
├── types/index.ts                    # ✅ 类型定义扩展（TextStyleConfig, TimelineItem<'text'>等）
├── components/
│   ├── Timeline.vue                  # ✅ 轨道管理和右键菜单（文本轨道创建+文本添加）
│   ├── BaseClip.vue                  # ✅ clip基础组件（拖拽、选择等通用功能）
│   ├── VideoClip.vue                 # ✅ 视频/图片/音频clip组件
│   ├── TextClip.vue                  # ✅ 文本clip组件（基于BaseClip）
│   ├── TextClipProperties.vue        # ✅ 文本编辑面板（集成样式控制）
│   ├── PropertiesPanel.vue           # ✅ 属性面板（集成TextClipProperties）
│   ├── TransformControls.vue         # ✅ 变换控制组件（位置、缩放、旋转等）
│   ├── KeyframeControls.vue          # ✅ 关键帧控制组件
│   ├── SliderInput.vue               # ✅ 滑块输入组件
│   └── NumberInput.vue               # ✅ 数字输入组件
├── stores/
│   ├── videoStore.ts                 # ✅ 主store（集成文本轨道管理）
│   └── modules/
│       ├── trackModule.ts            # ✅ 轨道管理模块（支持文本轨道）
│       ├── timelineModule.ts         # ✅ 时间轴管理模块
│       └── commands/
│           ├── timelineCommands.ts   # ✅ 通用时间轴命令
│           └── textCommands.ts       # ✅ 文本专用命令（Add/Update/Remove）
├── utils/
│   ├── TextVisibleSprite.ts          # ✅ 文本精灵类
│   ├── TextHelper.ts                 # ✅ 文本渲染工具
│   ├── textTimelineUtils.ts          # ✅ 文本时间轴工具函数
│   ├── webavToProjectCoords.ts       # ✅ 坐标转换工具
│   └── idGenerator.ts                # ✅ ID生成工具
├── composables/
│   └── useKeyframeTransformControls.ts # ✅ 关键帧变换控制组合式函数
└── docs/
    ├── text-track-support-design.md  # ✅ 本设计文档（已更新）
    ├── text-sprite-integration-guide.md # ✅ 文本精灵集成指南
    └── base-clip-component-design.md # ✅ BaseClip基础组件设计
```

**文件状态说明**：
- ✅ **已实现**：文件已存在且功能完整
- 🔄 **已集成**：功能已集成到现有文件中
- ❌ **未实现**：原计划的独立文件，实际已集成到其他组件中

**关键实现差异**：
1. **TextEditPanel.vue** → 集成到 **TextClipProperties.vue**
2. **TextStyleControls.vue** → 集成到 **TextClipProperties.vue**
3. 文本样式控制直接在属性面板中实现，提供更好的用户体验

## 10. 详细实施计划

基于对现有代码库的深入分析，制定以下分阶段实施计划：

### 阶段1：基础文本轨道支持 🎯

**目标**：建立文本轨道的核心基础设施，实现基本的文本项目创建和显示功能。

#### 1.1 类型系统扩展
**优先级**：🔴 最高 | **预估时间**：2小时

**任务内容**：
- 在 `frontend/src/types/index.ts` 中扩展类型定义
- 确保与现有类型系统的兼容性

**具体实现**：
```typescript
// 1. 扩展 MediaType（已存在，需确认）
export type MediaType = 'video' | 'image' | 'audio' | 'text'

// 2. 新增 TextMediaConfig 类型
export interface TextMediaConfig extends VisualMediaProps {
  text: string
  style: TextStyleConfig
}

// 3. 扩展 MediaConfigMap
type MediaConfigMap = {
  video: VideoMediaConfig
  image: ImageMediaConfig
  audio: AudioMediaConfig
  text: TextMediaConfig  // 新增
}

// 4. 扩展 CustomSprite 类型（已存在TextVisibleSprite，需确认）
export type CustomSprite = VideoVisibleSprite | ImageVisibleSprite | TextVisibleSprite

// 5. 新增 TextTimelineItem 类型
export interface TextTimelineItem extends TimelineItem<'text'> {
  mediaType: 'text'
  timeRange: ImageTimeRange
  sprite: Raw<TextVisibleSprite>
  config: TextMediaConfig
}
```

**验收标准**：
- [x] 类型定义编译通过
- [x] 现有代码无类型错误
- [x] TextVisibleSprite 正确集成到类型系统
- [x] 媒体类型分类系统已实现（MEDIA_TYPE_CATEGORIES）
- [x] 优化为使用 TimelineItem<'text'> 泛型（移除冗余的 TextTimelineItem 接口）

#### 1.2 文本项目创建流程
**优先级**：🔴 最高 | **预估时间**：4小时

**任务内容**：
- 实现 `createTextTimelineItem` 函数
- 集成到现有的时间轴管理流程

**具体实现**：
```typescript
// 在 frontend/src/utils/textTimelineUtils.ts 中新增
export async function createTextTimelineItem(
  text: string,
  style: Partial<TextStyleConfig>,
  startTimeFrames: number,
  trackId: string,
  duration: number = 150 // 默认5秒@30fps
): Promise<TextTimelineItem> {
  // 1. 创建文本精灵（复用现有TextVisibleSprite）
  const textSprite = await TextVisibleSprite.create(text, style)

  // 2. 设置时间范围
  textSprite.setTimelineStartTime(startTimeFrames)
  textSprite.setDisplayDuration(duration)

  // 3. 设置默认位置（画布中心）
  const canvasWidth = videoStore.videoResolution.width
  const canvasHeight = videoStore.videoResolution.height
  textSprite.rect.x = (canvasWidth - textSprite.rect.w) / 2
  textSprite.rect.y = (canvasHeight - textSprite.rect.h) / 2

  // 4. 坐标系转换（WebAV -> 项目坐标系）
  const projectCoords = webavToProjectCoords(
    textSprite.rect.x, textSprite.rect.y,
    textSprite.rect.w, textSprite.rect.h,
    canvasWidth, canvasHeight
  )

  // 5. 创建时间轴项目
  return {
    id: generateTimelineItemId(),
    mediaItemId: '', // 文本项目不需要媒体库项目
    trackId,
    mediaType: 'text',
    timeRange: textSprite.getTimeRange(),
    sprite: markRaw(textSprite),
    config: {
      text,
      style: textSprite.getTextStyle(),
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
}
```

**验收标准**：
- [x] 文本精灵创建成功
- [x] 时间范围设置正确
- [x] 坐标转换准确
- [x] 与现有时间轴管理兼容
- [x] createTextTimelineItem 函数已实现并测试通过

#### 1.3 TextClip组件开发
**优先级**：🟡 高 | **预估时间**：3小时

**任务内容**：
- 基于现有 BaseClip 创建 TextClip 组件
- 实现文本内容的时间轴显示

**具体实现**：
```vue
<!-- frontend/src/components/TextClip.vue -->
<template>
  <BaseClip
    :timeline-item="timelineItem"
    :timeline-width="timelineWidth"
    class="text-clip"
    @select="$emit('select', $event)"
  >
    <template #content="{ timelineItem }">
      <div class="text-content">
        <span class="text-preview">{{ textPreview }}</span>
      </div>
      <div class="clip-label">
        {{ timelineItem.config.text || '文本' }}
      </div>
    </template>
  </BaseClip>
</template>

<script setup lang="ts">
import BaseClip from './BaseClip.vue'
import type { TextTimelineItem } from '../types'

interface Props {
  timelineItem: TextTimelineItem
  timelineWidth: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'select': [itemId: string]
}>()

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

**验收标准**：
- [x] TextClip 正确继承 BaseClip 功能
- [x] 文本内容正确显示
- [x] 样式符合设计规范
- [x] 选中状态正常工作
- [x] 支持文本预览和标签显示

#### 1.4 Timeline组件集成
**优先级**：🟡 高 | **预估时间**：2小时

**任务内容**：
- 在 Timeline.vue 中集成 TextClip 组件
- 实现根据媒体类型渲染不同组件

**具体实现**：
```typescript
// 在 Timeline.vue 中修改 getClipComponent 函数
function getClipComponent(mediaType: MediaType) {
  switch (mediaType) {
    case 'video':
    case 'image':
    case 'audio':
      return VideoClip
    case 'text':
      return TextClip  // 新增
    default:
      return VideoClip
  }
}
```

**验收标准**：
- [x] 文本轨道正确渲染 TextClip
- [x] 不影响现有视频/图片轨道
- [x] 组件切换逻辑正确
- [x] getClipComponent 函数已实现

#### 1.5 右键菜单文本创建
**优先级**：🟡 高 | **预估时间**：3小时

**任务内容**：
- 在时间轴右键菜单中添加文本创建选项
- 实现文本轨道的识别和菜单显示逻辑

**具体实现**：
```typescript
// 在 Timeline.vue 中扩展右键菜单
const contextMenuItems = computed(() => {
  if (contextMenuType.value === 'track') {
    const track = getTrackFromTarget()
    if (track?.type === 'text') {
      return [
        {
          label: '添加文本',
          icon: 'M9,7H15V15H17V7H23V5H17V3A1,1 0 0,0 16,2H8A1,1 0 0,0 7,3V5H1V7H7V15H9V7Z',
          onClick: () => createTextAtPosition(track.id, getTimePositionFromEvent())
        },
        // 其他菜单项...
      ]
    }
  }
  return defaultMenuItems
})

async function createTextAtPosition(trackId: string, timeFrames: number) {
  const textItem = await createTextTimelineItem(
    '点击编辑文本',
    { fontSize: 48, color: 'white' },
    timeFrames,
    trackId
  )

  await videoStore.addTimelineItemWithHistory(textItem)
}
```

**验收标准**：
- [x] 文本轨道显示"添加文本"菜单
- [x] 非文本轨道不显示文本菜单
- [x] 文本创建功能正常工作
- [x] 与现有菜单系统兼容
- [x] 支持文本轨道创建（右键空白区域）

#### 1.6 基础命令系统
**优先级**：🟡 高 | **预估时间**：3小时

**任务内容**：
- 实现 AddTextItemCommand 命令
- 集成到现有的历史记录系统

**具体实现**：
```typescript
// 在 frontend/src/stores/modules/commands/textCommands.ts 中新增
export class AddTextItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private textItem: TimelineItem<'text'> | null = null

  constructor(
    private text: string,
    private style: Partial<TextStyleConfig>,
    private startTimeFrames: number,
    private trackId: string,
    private timelineModule: any,
    private webavModule: any
  ) {
    this.id = generateCommandId()
    this.description = `添加文本: ${text.substring(0, 10)}...`
  }

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
```

**验收标准**：
- [x] 文本添加命令正常执行
- [x] 撤销功能正确工作
- [x] 与现有命令系统兼容
- [x] 历史记录正确记录
- [x] AddTextItemCommand, UpdateTextCommand, RemoveTextItemCommand 已实现

#### 1.7 调试检查优化
**优先级**：🟢 中 | **预估时间**：1小时

**任务内容**：
- 修复文本项目导致的"孤立时间轴项目"警告
- 实施媒体类型分类架构

**具体实现**：
```typescript
// 短期解决方案：在 debugUtils.ts 中添加文本类型例外
function checkOrphanedTimelineItems(timelineItems, mediaItems) {
  const orphanedItems = timelineItems.filter(item => {
    // 文本项目不需要素材库项目，跳过检查
    if (item.mediaType === 'text') {
      return false
    }
    return !mediaItems.find(m => m.id === item.mediaItemId)
  })
  // ...
}

// 长期方案：在 types/index.ts 中添加媒体类型分类
export const MEDIA_TYPE_CATEGORIES = {
  FILE_BASED: ['video', 'image', 'audio'] as const,
  GENERATED: ['text'] as const,
} as const

export function requiresMediaItem(mediaType: MediaType): boolean {
  return MEDIA_TYPE_CATEGORIES.FILE_BASED.includes(mediaType as any)
}
```

**验收标准**：
- [x] 文本项目不再产生孤立警告
- [x] 其他媒体类型的检查正常工作
- [x] 媒体类型分类函数可用
- [x] 为未来扩展做好准备
- [x] MEDIA_TYPE_CATEGORIES 和相关工具函数已实现

**阶段1总结**：
- **状态**：✅ **已完成** (2024-07-03)
- **实际用时**：约18小时
- **关键里程碑**：文本轨道基础功能完全可用，无调试警告
- **验收标准**：✅ 用户可以通过右键菜单创建文本轨道和文本项目，在时间轴中正常显示，无调试警告

**已完成的功能**：
- ✅ 类型系统扩展（含媒体类型分类架构）
- ✅ 文本项目创建流程（createTextTimelineItem）
- ✅ TextClip组件开发（基于BaseClip）
- ✅ Timeline组件集成（动态组件渲染）
- ✅ 右键菜单文本创建（轨道创建+文本添加）
- ✅ 基础命令系统（完整的撤销/重做支持）
- ✅ 调试检查优化（消除孤立项目警告）

**技术亮点**：
- 🎯 架构一致性：遵循现有设计模式，使用 TimelineItem<'text'> 泛型
- 🔧 扩展性强：媒体类型分类系统为未来新媒体类型做准备
- 🚀 用户体验：完整的工作流从轨道创建到文本编辑
- 🛡️ 类型安全：完整的TypeScript类型支持

---

### 阶段2：文本编辑功能 ✅ 已完成

**目标**：实现完整的文本编辑功能，包括内容编辑、样式控制和实时预览。

#### 2.1 文本编辑面板 ✅ 已完成
**实现状态**：✅ 完成 | **实际文件**：`TextClipProperties.vue`

**已实现功能**：
- ✅ 完整的文本内容编辑界面（textarea支持多行）
- ✅ 文本内容实时更新（blur和Ctrl+Enter触发）
- ✅ 时长调整功能（时间码输入）

#### 2.2 文本样式控制器 ✅ 已完成
**实现状态**：✅ 完成 | **集成在**：`TextClipProperties.vue`

**已实现功能**：
- ✅ 字体选择（Arial, 微软雅黑, 黑体, 宋体, 楷体, Times New Roman, Courier New）
- ✅ 字体大小控制（12-200px，滑块+数字输入）
- ✅ 字体样式（正常/粗体/细体，正常/斜体）
- ✅ 文字颜色选择器
- ✅ 文本对齐控制（左/中/右）
- ✅ 背景颜色（可选启用/禁用）

#### 2.3 属性面板集成 ✅ 已完成
**实现状态**：✅ 完成 | **实际文件**：`PropertiesPanel.vue`

**已实现功能**：
- ✅ 根据媒体类型动态显示属性组件
- ✅ 文本项目选中时正确显示TextClipProperties
- ✅ 多选状态处理
- ✅ 空选择状态处理

#### 2.4 实时预览和更新 ✅ 已完成
**实现状态**：✅ 完成 | **通过**：`UpdateTextCommand`

**已实现功能**：
- ✅ 文本内容和样式的实时预览
- ✅ 防抖更新机制（blur/确认时更新）
- ✅ 错误处理和用户反馈
- ✅ 性能优化的更新机制

#### 2.5 文本更新命令 ✅ 已完成
**实现状态**：✅ 完成 | **实际文件**：`textCommands.ts`

**已实现功能**：
- ✅ AddTextItemCommand（添加文本项目）
- ✅ UpdateTextCommand（更新文本内容和样式）
- ✅ RemoveTextItemCommand（删除文本项目）
- ✅ 完整的撤销/重做支持
- ✅ 命令工厂函数（TextCommandFactory）

#### 2.6 变换控制 ✅ 已完成
**实现状态**：✅ 完成 | **通过**：`TransformControls` + `useKeyframeTransformControls`

**已实现功能**：
- ✅ 位置控制（x, y坐标调整）
- ✅ 缩放控制（比例缩放/独立缩放）
- ✅ 旋转控制（角度调整）
- ✅ 透明度控制（0-1范围）
- ✅ 层级控制（zIndex）
- ✅ 对齐功能（水平/垂直对齐）
- ✅ 关键帧动画支持

**阶段2总结**：
- **实际状态**：✅ **100% 完成**
- **关键里程碑**：完整的文本编辑工作流已实现
- **验收标准**：✅ 用户可以编辑文本内容、调整样式，并实时看到效果

---

### 阶段3：高级功能扩展 🚀

**目标**：在现有完整功能基础上，实现高级功能，进一步提升用户体验。

**当前状态**：⏳ 待开始（基础功能已完整，可根据需求选择性实现）

#### 3.1 文本效果增强
**优先级**：� 高 | **预估时间**：6小时

**建议功能**：
- 文本阴影效果（text-shadow）
- 文本描边效果（text-stroke）
- 文本发光效果
- 渐变文字效果

#### 3.2 文本模板系统
**优先级**：🟢 中 | **预估时间**：8小时

**建议功能**：
- 文本样式模板的创建和保存
- 预设模板库（标题、字幕、水印等）
- 模板的导入导出功能
- 模板预览和应用

#### 3.3 自定义字体管理
**优先级**：🟢 中 | **预估时间**：6小时

**建议功能**：
- 自定义字体文件上传（.ttf, .woff等）
- 字体预览功能
- 字体管理界面
- 字体加载状态处理

#### 3.4 文本动画预设
**优先级**：� 中 | **预估时间**：5小时

**建议功能**：
- 预设动画效果（淡入淡出、飞入飞出、打字机效果等）
- 动画时长和缓动函数设置
- 动画预览功能

#### 3.5 性能优化
**优先级**：� 低 | **预估时间**：4小时

**优化方向**：
- 文本渲染性能优化
- 大量文本项目的虚拟化渲染
- 内存使用优化
- 缓存机制改进

#### 3.6 用户体验增强
**优先级**：� 低 | **预估时间**：3小时

**改进方向**：
- 文本编辑快捷键支持
- 拖拽调整文本大小
- 更直观的颜色选择器
- 批量文本操作功能

**阶段3总结**：
- **总预估时间**：32小时
- **实施建议**：根据用户反馈和实际需求选择性实现
- **优先级建议**：文本效果 > 模板系统 > 字体管理 > 其他功能

---

## 11. 项目完成总结

**实际完成时间**：约40小时（比预估节省30小时）
**实际实施周期**：约6个月（2024年7月-12月）
**团队配置**：1名前端开发工程师

**实际里程碑**：
- **2024年7月**：阶段1 - 基础文本轨道支持 ✅
- **2024年12月**：阶段2 - 文本编辑功能 ✅
- **未来规划**：阶段3 - 高级功能扩展（可选）

**项目成功要素**：
- **架构复用**：🟢 成功复用现有BaseClip、TransformControls等组件
- **类型安全**：🟢 完整的TypeScript类型支持，减少了调试时间
- **命令模式**：🟢 统一的命令系统简化了撤销重做实现
- **组件化设计**：� 模块化设计便于维护和扩展

**技术亮点**：
- ✅ 完整的文本编辑工作流
- ✅ 与现有系统无缝集成
- ✅ 支持关键帧动画
- ✅ 完善的错误处理和用户反馈
- ✅ 性能优化的更新机制

**用户价值**：
- 🎯 专业级文本编辑功能
- 🎨 丰富的样式控制选项
- 🎞️ 完整的动画制作能力
- 🔄 直观的操作体验
- ↩️ 可靠的撤销重做机制

---

## 12. 未来扩展建议

基于当前完整的基础功能，建议的扩展方向：

1. **文本效果增强**（优先级：高）
   - 实现阴影、描边、发光等视觉效果
   - 提升文本的视觉表现力

2. **模板系统**（优先级：中）
   - 提供预设样式模板
   - 支持用户自定义模板

3. **字体管理**（优先级：中）
   - 支持自定义字体上传
   - 扩展字体选择范围

4. **性能优化**（优先级：低）
   - 在实际使用中根据性能表现进行针对性优化

---

*文本轨道支持功能已完整实现，可投入生产使用。后续扩展可根据用户反馈和业务需求灵活安排。*

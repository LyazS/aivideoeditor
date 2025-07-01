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

// 扩展现有的 GetMediaConfig 类型
export type GetMediaConfig<T extends MediaType> = 
  T extends 'video' ? VideoMediaConfig :
  T extends 'image' ? ImageMediaConfig :
  T extends 'audio' ? AudioMediaConfig :
  T extends 'text' ? TextMediaConfig :  // 新增
  never
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

### 4.1 VideoClip组件扩展

```typescript
// 在 VideoClip.vue 中添加文本项目支持
const isTextItem = computed(() => props.timelineItem.mediaType === 'text')

const textContent = computed(() => {
  if (isTextItem.value) {
    const textItem = props.timelineItem as TextTimelineItem
    return textItem.config.text
  }
  return ''
})

// 在模板中添加文本显示
<template>
  <div class="video-clip" :class="{ 'text-clip': isTextItem }">
    <!-- 现有内容... -->
    
    <!-- 文本项目特殊显示 -->
    <div v-if="isTextItem" class="text-clip-content">
      <div class="text-preview">{{ textContent }}</div>
      <div class="text-duration">{{ formatDurationFromFrames(timelineDurationFrames) }}</div>
    </div>
  </div>
</template>
```

### 4.2 文本编辑面板组件

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

### 4.3 文本样式控制器组件

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

### 8.1 性能优化
- **缓存复用**：利用现有的TextVisibleSprite缓存机制
- **防抖处理**：文本渲染的300ms防抖延迟
- **虚拟化渲染**：大量文本项目的性能优化

### 8.2 用户体验
- **直观编辑**：双击文本项目进入编辑模式
- **拖拽调整**：支持文本位置和大小的拖拽调整
- **实时预览**：文本效果的即时预览
- **快捷键支持**：常用操作的键盘快捷键

### 8.3 数据一致性
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

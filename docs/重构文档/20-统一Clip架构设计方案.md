# 统一Clip架构设计方案

## 1. 设计背景与目标

### 1.1 当前架构问题
当前项目中存在四种不同类型的Clip组件：
- `TimelineVideoClip.vue` - 处理视频和图片
- `TimelineTextClip.vue` - 处理文本
- `TimelineAudioClip.vue` - 处理音频
- `TimelineAsyncProcessingClip.vue` - 处理异步处理状态

这些组件都继承自`TimelineBaseClip.vue`，但存在以下问题：
1. **代码重复**：各组件间有大量相似的逻辑和样式
2. **维护困难**：修改共享功能需要在多个文件中同步更新
3. **类型安全性不够**：缺乏编译时的类型检查
4. **扩展性有限**：添加新的媒体类型需要创建新的组件文件

### 1.2 设计目标
1. **统一架构**：使用单一的`UnifiedTimelineClip`组件处理所有类型
2. **类型安全**：基于泛型接口确保编译时类型安全
3. **策略模式**：通过内容渲染策略分离不同类型的渲染逻辑
4. **易于扩展**：新增媒体类型只需添加对应的渲染器
5. **向后兼容**：保持与现有API的兼容性

## 2. 核心架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Timeline.vue                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │            renderTimelineItem()                         ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │          UnifiedTimelineClip                        │││
│  │  │  ┌─────────────────────────────────────────────────┐│││
│  │  │  │         ContentRenderer Strategy                ││││
│  │  │  │  ┌─────────────────────────────────────────────┐│││
│  │  │  │  │  VideoContentRenderer                       ││││
│  │  │  │  │  TextContentRenderer                        ││││
│  │  │  │  │  AudioContentRenderer                       ││││
│  │  │  │  │  AsyncProcessingContentRenderer             ││││
│  │  │  │  └─────────────────────────────────────────────┘│││
│  │  │  └─────────────────────────────────────────────────┘││
│  │  └─────────────────────────────────────────────────────┘│
│  └─────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件关系

```typescript
// 数据层：已有的统一时间轴项目数据
UnifiedTimelineItemData<T extends MediaTypeOrUnknown>

// 渲染策略层：新增的内容渲染器接口
ContentRenderer<T extends MediaTypeOrUnknown>

// 组件层：新的统一Clip组件
UnifiedTimelineClip<T extends MediaTypeOrUnknown>

// 使用层：Timeline.vue中的渲染函数
renderTimelineItem(item: UnifiedTimelineItemData)
```

## 3. 详细设计方案

### 3.1 内容渲染策略接口设计

#### 3.1.1 渲染上下文接口
```typescript
/**
 * 内容渲染上下文
 * 包含渲染所需的所有信息和回调函数
 */
export interface ContentRenderContext<T extends MediaTypeOrUnknown = MediaTypeOrUnknown> {
  /** 时间轴项目数据 */
  data: UnifiedTimelineItemData<T>
  
  /** 是否被选中 */
  isSelected: boolean
  
  /** 是否正在拖拽 */
  isDragging: boolean
  
  /** 是否正在调整大小 */
  isResizing: boolean
  
  /** 当前播放时间（帧数） */
  currentFrame: number
  
  /** 缩放比例 */
  scale: number
  
  /** 轨道高度 */
  trackHeight: number
  
  /** 事件回调 */
  callbacks: {
    onSelect: (id: string) => void
    onDoubleClick: (id: string) => void
    onContextMenu: (event: MouseEvent, id: string) => void
    onDragStart: (event: DragEvent, id: string) => void
    onResizeStart: (event: MouseEvent, id: string, direction: 'left' | 'right') => void
  }
}
```

#### 3.1.2 内容渲染器接口
```typescript
/**
 * 内容渲染器基础接口
 * 定义所有内容渲染器必须实现的方法
 */
export interface ContentRenderer<T extends MediaTypeOrUnknown = MediaTypeOrUnknown> {
  /** 渲染器类型标识 */
  readonly type: T
  
  /** 
   * 渲染内容区域
   * @param context 渲染上下文
   * @returns Vue虚拟节点
   */
  renderContent(context: ContentRenderContext<T>): VNode | VNode[]
  
  /** 
   * 渲染状态指示器（可选）
   * @param context 渲染上下文
   * @returns Vue虚拟节点或null
   */
  renderStatusIndicator?(context: ContentRenderContext<T>): VNode | null
  
  /** 
   * 渲染进度条（可选）
   * @param context 渲染上下文
   * @returns Vue虚拟节点或null
   */
  renderProgressBar?(context: ContentRenderContext<T>): VNode | null
  
  /** 
   * 获取自定义样式类（可选）
   * @param context 渲染上下文
   * @returns CSS类名数组
   */
  getCustomClasses?(context: ContentRenderContext<T>): string[]
  
  /** 
   * 获取自定义样式（可选）
   * @param context 渲染上下文
   * @returns CSS样式对象
   */
  getCustomStyles?(context: ContentRenderContext<T>): Record<string, string | number>
}
```

### 3.2 UnifiedTimelineClip组件设计

#### 3.2.1 组件接口
```typescript
/**
 * UnifiedTimelineClip组件属性
 */
export interface UnifiedTimelineClipProps<T extends MediaTypeOrUnknown = MediaTypeOrUnknown> {
  /** 时间轴项目数据 */
  data: UnifiedTimelineItemData<T>
  
  /** 是否被选中 */
  isSelected?: boolean
  
  /** 是否正在拖拽 */
  isDragging?: boolean
  
  /** 是否正在调整大小 */
  isResizing?: boolean
  
  /** 当前播放时间（帧数） */
  currentFrame?: number
  
  /** 缩放比例 */
  scale?: number
  
  /** 轨道高度 */
  trackHeight?: number
  
  /** 自定义内容渲染器（可选，用于扩展） */
  customRenderer?: ContentRenderer<T>
}
```

#### 3.2.2 组件事件
```typescript
/**
 * UnifiedTimelineClip组件事件
 */
export interface UnifiedTimelineClipEvents {
  /** 选中事件 */
  select: (id: string) => void
  
  /** 双击事件 */
  doubleClick: (id: string) => void
  
  /** 右键菜单事件 */
  contextMenu: (event: MouseEvent, id: string) => void
  
  /** 拖拽开始事件 */
  dragStart: (event: DragEvent, id: string) => void
  
  /** 调整大小开始事件 */
  resizeStart: (event: MouseEvent, id: string, direction: 'left' | 'right') => void
}
```

### 3.3 具体内容渲染器设计

#### 3.3.1 VideoContentRenderer
```typescript
/**
 * 视频内容渲染器
 * 处理视频和图片类型的内容渲染
 */
export class VideoContentRenderer implements ContentRenderer<'video' | 'image'> {
  readonly type = 'video' as const
  
  renderContent(context: ContentRenderContext<'video' | 'image'>): VNode {
    const { data, isSelected, currentFrame } = context
    
    return h('div', {
      class: ['video-content', { selected: isSelected }]
    }, [
      // 缩略图显示
      this.renderThumbnail(data, currentFrame),
      // 视频特有的时间显示
      this.renderTimeDisplay(data),
      // 裁剪指示器
      this.renderClipIndicators(data)
    ])
  }
  
  renderStatusIndicator(context: ContentRenderContext<'video' | 'image'>): VNode | null {
    const { data } = context
    if (data.timelineStatus === 'loading') {
      return h('div', { class: 'loading-spinner' })
    }
    if (data.timelineStatus === 'error') {
      return h('div', { class: 'error-icon' })
    }
    return null
  }
  
  private renderThumbnail(data: UnifiedTimelineItemData<'video' | 'image'>, currentFrame: number): VNode {
    // 实现缩略图渲染逻辑
  }
  
  private renderTimeDisplay(data: UnifiedTimelineItemData<'video' | 'image'>): VNode {
    // 实现时间显示逻辑
  }
  
  private renderClipIndicators(data: UnifiedTimelineItemData<'video' | 'image'>): VNode {
    // 实现裁剪指示器逻辑
  }
}
```

#### 3.3.2 AudioContentRenderer
```typescript
/**
 * 音频内容渲染器
 * 处理音频类型的内容渲染
 */
export class AudioContentRenderer implements ContentRenderer<'audio'> {
  readonly type = 'audio' as const
  
  renderContent(context: ContentRenderContext<'audio'>): VNode {
    const { data, isSelected, scale } = context
    
    return h('div', {
      class: ['audio-content', { selected: isSelected }]
    }, [
      // 波形显示
      this.renderWaveform(data, scale),
      // 音量指示器
      this.renderVolumeIndicator(data),
      // 静音指示器
      this.renderMuteIndicator(data)
    ])
  }
  
  private renderWaveform(data: UnifiedTimelineItemData<'audio'>, scale: number): VNode {
    // 实现波形渲染逻辑
  }
  
  private renderVolumeIndicator(data: UnifiedTimelineItemData<'audio'>): VNode {
    // 实现音量指示器逻辑
  }
  
  private renderMuteIndicator(data: UnifiedTimelineItemData<'audio'>): VNode {
    // 实现静音指示器逻辑
  }
}
```

#### 3.3.3 TextContentRenderer
```typescript
/**
 * 文本内容渲染器
 * 处理文本类型的内容渲染
 */
export class TextContentRenderer implements ContentRenderer<'text'> {
  readonly type = 'text' as const
  
  renderContent(context: ContentRenderContext<'text'>): VNode {
    const { data, isSelected } = context
    
    return h('div', {
      class: ['text-content', { selected: isSelected }]
    }, [
      // 文本预览
      this.renderTextPreview(data),
      // 字体信息
      this.renderFontInfo(data)
    ])
  }
  
  private renderTextPreview(data: UnifiedTimelineItemData<'text'>): VNode {
    // 实现文本预览逻辑
  }
  
  private renderFontInfo(data: UnifiedTimelineItemData<'text'>): VNode {
    // 实现字体信息显示逻辑
  }
}
```

#### 3.3.4 AsyncProcessingContentRenderer
```typescript
/**
 * 异步处理内容渲染器
 * 处理异步处理状态的内容渲染
 */
export class AsyncProcessingContentRenderer implements ContentRenderer<'unknown'> {
  readonly type = 'unknown' as const
  
  renderContent(context: ContentRenderContext<'unknown'>): VNode {
    const { data, isSelected } = context
    
    return h('div', {
      class: ['async-processing-content', { selected: isSelected }]
    }, [
      // 处理状态显示
      this.renderProcessingStatus(data),
      // 进度条
      this.renderProgressBar(context)
    ])
  }
  
  renderProgressBar(context: ContentRenderContext<'unknown'>): VNode {
    const { data } = context
    // 实现进度条渲染逻辑
    return h('div', { class: 'progress-bar' }, [
      h('div', { 
        class: 'progress-fill',
        style: { width: `${this.getProgress(data)}%` }
      })
    ])
  }
  
  private renderProcessingStatus(data: UnifiedTimelineItemData<'unknown'>): VNode {
    // 实现处理状态显示逻辑
  }
  
  private getProgress(data: UnifiedTimelineItemData<'unknown'>): number {
    // 实现进度计算逻辑
  }
}
```

### 3.4 渲染器工厂设计

```typescript
/**
 * 内容渲染器工厂
 * 根据媒体类型创建对应的渲染器
 */
export class ContentRendererFactory {
  private static renderers = new Map<MediaTypeOrUnknown, ContentRenderer>([
    ['video', new VideoContentRenderer()],
    ['image', new VideoContentRenderer()], // 视频和图片使用同一个渲染器
    ['audio', new AudioContentRenderer()],
    ['text', new TextContentRenderer()],
    ['unknown', new AsyncProcessingContentRenderer()]
  ])
  
  /**
   * 获取指定类型的内容渲染器
   */
  static getRenderer<T extends MediaTypeOrUnknown>(type: T): ContentRenderer<T> {
    const renderer = this.renderers.get(type)
    if (!renderer) {
      throw new Error(`No renderer found for media type: ${type}`)
    }
    return renderer as ContentRenderer<T>
  }
  
  /**
   * 注册自定义渲染器
   */
  static registerRenderer<T extends MediaTypeOrUnknown>(
    type: T, 
    renderer: ContentRenderer<T>
  ): void {
    this.renderers.set(type, renderer)
  }
}
```

## 4. 实施计划

### 4.1 实施步骤

1. **第一阶段：基础架构搭建**
   - [ ] 创建内容渲染策略接口定义文件
   - [ ] 实现UnifiedTimelineClip基础组件
   - [ ] 创建渲染器工厂

2. **第二阶段：内容渲染器实现**
   - [ ] 实现VideoContentRenderer
   - [ ] 实现AudioContentRenderer  
   - [ ] 实现TextContentRenderer
   - [ ] 实现AsyncProcessingContentRenderer

3. **第三阶段：集成与迁移**
   - [ ] 修改Timeline.vue中的renderTimelineItem函数
   - [ ] 更新相关类型定义
   - [ ] 创建迁移工具函数

4. **第四阶段：测试与优化**
   - [ ] 单元测试
   - [ ] 集成测试
   - [ ] 性能优化
   - [ ] 文档完善

### 4.2 文件结构

```
frontend/src/unified/
├── types/
│   └── clipRenderer.ts              # 渲染策略接口定义
├── components/
│   ├── UnifiedTimelineClip.vue      # 统一Clip组件
│   └── renderers/                   # 内容渲染器目录
│       ├── index.ts                 # 渲染器导出
│       ├── ContentRendererFactory.ts # 渲染器工厂
│       ├── VideoContentRenderer.ts  # 视频渲染器
│       ├── AudioContentRenderer.ts  # 音频渲染器
│       ├── TextContentRenderer.ts   # 文本渲染器
│       └── AsyncProcessingContentRenderer.ts # 异步处理渲染器
└── utils/
    └── clipMigration.ts             # 迁移工具函数
```

## 5. 优势与特点

### 5.1 技术优势

1. **类型安全**：基于TypeScript泛型，编译时确保类型正确性
2. **策略模式**：内容渲染逻辑完全分离，易于维护和扩展
3. **组合优于继承**：避免了深层继承带来的复杂性
4. **单一职责**：每个渲染器只负责特定类型的渲染逻辑

### 5.2 维护优势

1. **代码复用**：共享逻辑集中在UnifiedTimelineClip中
2. **易于测试**：每个渲染器可以独立测试
3. **易于扩展**：新增媒体类型只需实现对应渲染器
4. **向后兼容**：保持现有API不变

### 5.3 性能优势

1. **按需渲染**：只渲染当前需要的内容
2. **渲染器复用**：渲染器实例可以复用
3. **虚拟DOM优化**：利用Vue3的虚拟DOM优化

## 6. 迁移指南

### 6.1 现有组件迁移

#### 6.1.1 Timeline.vue迁移
```typescript
// 旧版本
function renderTimelineItem(item: TimelineItem) {
  switch (item.mediaType) {
    case 'video':
    case 'image':
      return h(TimelineVideoClip, { data: item, ...props })
    case 'audio':
      return h(TimelineAudioClip, { data: item, ...props })
    case 'text':
      return h(TimelineTextClip, { data: item, ...props })
    default:
      return h(TimelineAsyncProcessingClip, { data: item, ...props })
  }
}

// 新版本
function renderTimelineItem(item: UnifiedTimelineItemData) {
  return h(UnifiedTimelineClip, { data: item, ...props })
}
```

#### 6.1.2 组件属性迁移
```typescript
// 旧版本的组件属性会自动映射到新版本
// 无需修改现有的属性传递代码
```

### 6.2 自定义扩展迁移

如果有自定义的Clip组件，可以通过实现ContentRenderer接口来迁移：

```typescript
// 自定义渲染器
class CustomContentRenderer implements ContentRenderer<'custom'> {
  readonly type = 'custom' as const
  
  renderContent(context: ContentRenderContext<'custom'>): VNode {
    // 自定义渲染逻辑
  }
}

// 注册自定义渲染器
ContentRendererFactory.registerRenderer('custom', new CustomContentRenderer())
```

## 7. 总结

统一Clip架构设计通过以下核心理念解决了现有架构的问题：

1. **统一数据模型**：基于已有的`UnifiedTimelineItemData`泛型接口
2. **策略模式分离**：将渲染逻辑分离到独立的渲染器中
3. **类型安全保障**：利用TypeScript泛型确保编译时类型安全
4. **组合式设计**：通过组合而非继承实现功能扩展

这个设计既保持了向后兼容性，又为未来的扩展提供了良好的基础，是一个可持续发展的架构方案。
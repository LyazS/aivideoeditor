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
│  │  │  │  ┌─────────────────────────────────────────────┐│││|
│  │  │  │  │  状态优先渲染器:                            ││││|
│  │  │  │  │  - LoadingContentRenderer                   ││││|
│  │  │  │  │  - ErrorContentRenderer                     ││││|
│  │  │  │  │  媒体类型渲染器(ready状态):                  ││││|
│  │  │  │  │  - VideoContentRenderer                     ││││|
│  │  │  │  │  - AudioContentRenderer                     ││││|
│  │  │  │  │  - TextContentRenderer                      ││││|
│  │  │  │  └─────────────────────────────────────────────┘│││|
│  │  │  └─────────────────────────────────────────────────┘││|
│  │  └─────────────────────────────────────────────────────┘│|
│  └─────────────────────────────────────────────────────────┘|
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

#### 3.3.1 状态优先渲染器

##### LoadingContentRenderer
```typescript
/**
 * 加载状态内容渲染器
 * 处理所有loading状态的内容渲染，包括异步处理和普通加载
 */
export class LoadingContentRenderer implements ContentRenderer<MediaTypeOrUnknown> {
  readonly type = 'loading' as const

  renderContent(context: ContentRenderContext<MediaTypeOrUnknown>): VNode {
    const { data, isSelected } = context

    return h('div', {
      class: ['loading-content', { selected: isSelected }]
    }, [
      // 根据媒体类型和具体状态渲染不同内容
      data.mediaType === 'unknown'
        ? this.renderAsyncProcessing(context)
        : this.renderNormalLoading(context)
    ])
  }

  renderStatusIndicator(context: ContentRenderContext<MediaTypeOrUnknown>): VNode {
    return h('div', { class: 'loading-spinner' })
  }

  renderProgressBar(context: ContentRenderContext<MediaTypeOrUnknown>): VNode | null {
    const { data } = context

    // 异步处理状态显示进度条
    if (data.mediaType === 'unknown') {
      return h('div', { class: 'progress-bar' }, [
        h('div', {
          class: 'progress-fill',
          style: { width: `${this.getAsyncProgress(data)}%` }
        })
      ])
    }

    return null
  }

  private renderAsyncProcessing(context: ContentRenderContext<'unknown'>): VNode {
    const { data } = context
    return h('div', { class: 'async-processing-content' }, [
      // 处理类型图标
      this.renderProcessingTypeIcon(data),
      // 处理状态文本
      this.renderProcessingStatus(data),
      // 进度圆环
      this.renderProgressRing(context)
    ])
  }

  private renderNormalLoading(context: ContentRenderContext<MediaTypeOrUnknown>): VNode {
    return h('div', { class: 'normal-loading-content' }, [
      h('div', { class: 'loading-spinner' }),
      h('div', { class: 'loading-text' }, '加载中...')
    ])
  }

  private renderProcessingTypeIcon(data: UnifiedTimelineItemData<'unknown'>): VNode {
    // 实现处理类型图标逻辑
  }

  private renderProcessingStatus(data: UnifiedTimelineItemData<'unknown'>): VNode {
    // 实现处理状态显示逻辑
  }

  private renderProgressRing(context: ContentRenderContext<'unknown'>): VNode {
    // 实现进度圆环逻辑
  }

  private getAsyncProgress(data: UnifiedTimelineItemData<'unknown'>): number {
    // 实现进度计算逻辑
    return 0
  }
}
```

##### ErrorContentRenderer
```typescript
/**
 * 错误状态内容渲染器
 * 处理所有error状态的内容渲染
 */
export class ErrorContentRenderer implements ContentRenderer<MediaTypeOrUnknown> {
  readonly type = 'error' as const

  renderContent(context: ContentRenderContext<MediaTypeOrUnknown>): VNode {
    const { data, isSelected } = context

    return h('div', {
      class: ['error-content', { selected: isSelected }]
    }, [
      // 错误图标
      this.renderErrorIcon(data),
      // 错误信息
      this.renderErrorMessage(data),
      // 重试按钮（如果支持）
      this.renderRetryButton(data)
    ])
  }

  renderStatusIndicator(context: ContentRenderContext<MediaTypeOrUnknown>): VNode {
    return h('div', { class: 'error-icon' })
  }

  getCustomClasses(context: ContentRenderContext<MediaTypeOrUnknown>): string[] {
    return ['error-state']
  }

  private renderErrorIcon(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): VNode {
    return h('div', { class: 'error-icon-large' }, '⚠️')
  }

  private renderErrorMessage(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): VNode {
    // 从关联的媒体项目获取错误信息
    return h('div', { class: 'error-message' }, '加载失败')
  }

  private renderRetryButton(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): VNode | null {
    // 根据错误类型决定是否显示重试按钮
    return h('button', {
      class: 'retry-button',
      onClick: () => this.handleRetry(data)
    }, '重试')
  }

  private handleRetry(data: UnifiedTimelineItemData<MediaTypeOrUnknown>): void {
    // 实现重试逻辑
  }
}
```

#### 3.3.2 媒体类型渲染器（仅用于ready状态）

##### VideoContentRenderer
```typescript
/**
 * 视频内容渲染器
 * 处理ready状态下视频和图片类型的内容渲染
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

##### AudioContentRenderer
```typescript
/**
 * 音频内容渲染器
 * 处理ready状态下音频类型的内容渲染
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

##### TextContentRenderer
```typescript
/**
 * 文本内容渲染器
 * 处理ready状态下文本类型的内容渲染
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



### 3.4 渲染器工厂设计

```typescript
/**
 * 内容渲染器工厂
 * 基于状态优先的渲染策略选择合适的渲染器
 */
export class ContentRendererFactory {
  // 状态优先渲染器
  private static statusRenderers = new Map<TimelineItemStatus, ContentRenderer>([
    ['loading', new LoadingContentRenderer()],
    ['error', new ErrorContentRenderer()]
  ])

  // 媒体类型渲染器（仅用于ready状态）
  private static mediaTypeRenderers = new Map<MediaTypeOrUnknown, ContentRenderer>([
    ['video', new VideoContentRenderer()],
    ['image', new VideoContentRenderer()], // 视频和图片使用同一个渲染器
    ['audio', new AudioContentRenderer()],
    ['text', new TextContentRenderer()]
  ])

  // 默认渲染器
  private static defaultRenderer = new LoadingContentRenderer()

  /**
   * 获取指定数据的内容渲染器
   * 优先基于状态选择，然后基于媒体类型选择
   */
  static getRenderer<T extends MediaTypeOrUnknown>(
    data: UnifiedTimelineItemData<T>
  ): ContentRenderer<T> {
    // 优先基于状态选择渲染器
    if (data.timelineStatus !== 'ready') {
      const statusRenderer = this.statusRenderers.get(data.timelineStatus)
      if (statusRenderer) {
        return statusRenderer as ContentRenderer<T>
      }
    }

    // ready状态下基于媒体类型选择渲染器
    if (data.timelineStatus === 'ready') {
      const mediaTypeRenderer = this.mediaTypeRenderers.get(data.mediaType)
      if (mediaTypeRenderer) {
        return mediaTypeRenderer as ContentRenderer<T>
      }
    }

    // 兜底渲染器
    return this.defaultRenderer as ContentRenderer<T>
  }



  /**
   * 注册状态渲染器
   */
  static registerStatusRenderer(
    status: TimelineItemStatus,
    renderer: ContentRenderer
  ): void {
    this.statusRenderers.set(status, renderer)
  }

  /**
   * 注册媒体类型渲染器
   */
  static registerMediaTypeRenderer<T extends MediaTypeOrUnknown>(
    type: T,
    renderer: ContentRenderer<T>
  ): void {
    this.mediaTypeRenderers.set(type, renderer)
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
   - [ ] 实现状态优先渲染器
     - [ ] 实现LoadingContentRenderer（处理loading状态）
     - [ ] 实现ErrorContentRenderer（处理error状态）
   - [ ] 实现媒体类型渲染器（仅用于ready状态）
     - [ ] 实现VideoContentRenderer（处理video/image类型）
     - [ ] 实现AudioContentRenderer（处理audio类型）
     - [ ] 实现TextContentRenderer（处理text类型）

3. **第三阶段：集成到UnifiedTimelineClip**
   - [ ] 在UnifiedTimelineClip组件中集成渲染器工厂
   - [ ] 实现渲染器的动态选择和切换逻辑
   - [ ] 集成渲染上下文的构建和传递
   - [ ] 处理渲染器的生命周期管理
   - [ ] 更新Timeline.vue使用UnifiedTimelineClip组件

4. **第四阶段：测试与优化**
   - [ ] 单元测试各个渲染器
   - [ ] 集成测试UnifiedTimelineClip组件
   - [ ] 性能优化和内存管理
   - [ ] 文档完善和使用示例



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
│       ├── status/                  # 状态优先渲染器
│       │   ├── LoadingContentRenderer.ts    # 加载状态渲染器
│       │   └── ErrorContentRenderer.ts     # 错误状态渲染器
│       └── mediatype/               # 媒体类型渲染器（ready状态）
│           ├── VideoContentRenderer.ts     # 视频渲染器
│           ├── AudioContentRenderer.ts     # 音频渲染器
│           └── TextContentRenderer.ts      # 文本渲染器
└── utils/
    └── clipUtils.ts                 # Clip相关工具函数
```

## 5. 优势与特点

### 5.1 技术优势

1. **类型安全**：基于TypeScript泛型，编译时确保类型正确性
2. **策略模式**：内容渲染逻辑完全分离，易于维护和扩展
3. **状态优先**：优先基于状态选择渲染器，确保状态显示的一致性
4. **组合优于继承**：避免了深层继承带来的复杂性
5. **单一职责**：每个渲染器只负责特定状态或类型的渲染逻辑

### 5.2 维护优势

1. **代码复用**：共享逻辑集中在UnifiedTimelineClip中
2. **易于测试**：每个渲染器可以独立测试
3. **易于扩展**：新增媒体类型或状态只需实现对应渲染器
4. **职责清晰**：状态渲染器和媒体类型渲染器职责分离

### 5.3 性能优势

1. **按需渲染**：只渲染当前需要的内容
2. **渲染器复用**：渲染器实例可以复用
3. **虚拟DOM优化**：利用Vue3的虚拟DOM优化

## 6. 使用示例

### 6.1 UnifiedTimelineClip组件内部集成

```typescript
// UnifiedTimelineClip.vue 内部实现
<template>
  <div class="unified-timeline-clip" :class="clipClasses" :style="clipStyles">
    <!-- 渲染器动态内容 -->
    <component :is="renderedContent" />
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { ContentRendererFactory } from './renderers/ContentRendererFactory'

const props = defineProps<UnifiedTimelineClipProps>()

// 动态选择渲染器
const renderer = computed(() => {
  return ContentRendererFactory.getRenderer(props.data)
})

// 构建渲染上下文
const renderContext = computed(() => ({
  data: props.data,
  isSelected: props.isSelected || false,
  isDragging: props.isDragging || false,
  isResizing: props.isResizing || false,
  currentFrame: props.currentFrame || 0,
  scale: props.scale || 1,
  trackHeight: props.trackHeight || 60,
  callbacks: {
    onSelect: (id: string) => emit('select', id),
    onDoubleClick: (id: string) => emit('doubleClick', id),
    // ... 其他回调
  }
}))

// 渲染内容
const renderedContent = computed(() => {
  return renderer.value.renderContent(renderContext.value)
})

// 动态样式类
const clipClasses = computed(() => {
  const baseClasses = ['unified-timeline-clip']
  const customClasses = renderer.value.getCustomClasses?.(renderContext.value) || []
  return [...baseClasses, ...customClasses]
})

// 动态样式
const clipStyles = computed(() => {
  return renderer.value.getCustomStyles?.(renderContext.value) || {}
})
</script>
```

### 6.2 Timeline.vue中的使用

```typescript
// Timeline.vue中简化的使用
function renderTimelineItem(item: UnifiedTimelineItemData) {
  return h(UnifiedTimelineClip, {
    data: item,
    isSelected: selectedItems.includes(item.id),
    currentFrame: currentFrame.value,
    scale: timelineScale.value,
    trackHeight: TRACK_HEIGHT,
    onSelect: handleSelectClip,
    onDoubleClick: handleDoubleClickClip
  })
}
```

### 6.3 自定义渲染器扩展

```typescript
// 创建自定义渲染器
class CustomContentRenderer implements ContentRenderer<'custom'> {
  readonly type = 'custom' as const

  renderContent(context: ContentRenderContext<'custom'>): VNode {
    const { data, isSelected } = context
    return h('div', {
      class: ['custom-content', { selected: isSelected }]
    }, [
      h('span', '自定义内容')
    ])
  }
}

// 注册自定义渲染器
ContentRendererFactory.registerMediaTypeRenderer('custom', new CustomContentRenderer())
```

### 6.4 状态处理示例

```typescript
// 渲染器工厂会自动根据状态选择合适的渲染器
const data: UnifiedTimelineItemData = {
  id: 'item-1',
  mediaType: 'video',
  timelineStatus: 'loading', // 会自动使用LoadingContentRenderer
  // ... 其他属性
}

const renderer = ContentRendererFactory.getRenderer(data)
// 返回 LoadingContentRenderer 实例
```

## 7. 总结

统一Clip架构设计通过以下核心理念解决了现有架构的问题：

1. **统一数据模型**：基于已有的`UnifiedTimelineItemData`泛型接口
2. **状态优先策略**：优先基于状态选择渲染器，确保状态显示的一致性
3. **策略模式分离**：将渲染逻辑分离到独立的渲染器中
4. **类型安全保障**：利用TypeScript泛型确保编译时类型安全
5. **组合式设计**：通过组合而非继承实现功能扩展

### 核心改进点

1. **重命名 AsyncProcessingContentRenderer → LoadingContentRenderer**：使其更通用，处理所有loading状态
2. **新增 ErrorContentRenderer**：专门处理错误状态，提供统一的错误显示和重试机制
3. **状态优先选择策略**：渲染器工厂优先基于状态选择，然后基于媒体类型选择
4. **清晰的职责分离**：状态渲染器处理状态相关显示，媒体类型渲染器专注于ready状态的内容渲染

这个设计为未来的扩展提供了良好的基础，是一个可持续发展的架构方案。通过状态优先的渲染策略，确保了不同状态下的一致性体验，同时保持了代码的可维护性和扩展性。
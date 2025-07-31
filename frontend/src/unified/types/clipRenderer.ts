/**
 * 统一Clip架构 - 内容渲染策略接口定义
 * 
 * 设计理念：
 * - 基于策略模式分离不同类型和状态的渲染逻辑
 * - 状态优先：优先基于状态选择渲染器，然后基于媒体类型选择
 * - 类型安全：使用泛型确保编译时类型安全
 * - 组合优于继承：通过组合实现功能扩展
 */

import type { VNode } from 'vue'
import type { UnifiedTimelineItemData } from '../timelineitem/TimelineItemData'
import type { MediaTypeOrUnknown } from '../mediaitem/types'

// ==================== 渲染上下文接口 ====================

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

// ==================== 内容渲染器接口 ====================

/**
 * 内容渲染器基础接口
 * 定义所有内容渲染器必须实现的方法
 */
export interface ContentRenderer<T extends MediaTypeOrUnknown = MediaTypeOrUnknown> {
  /** 渲染器类型标识 */
  readonly type: T | string
  
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

// ==================== 渲染器类型定义 ====================

/**
 * 状态渲染器类型（优先级最高）
 */
export type StatusRendererType = 'loading' | 'error'

/**
 * 媒体类型渲染器类型（仅用于ready状态）
 */
export type MediaTypeRendererType = 'video' | 'image' | 'audio' | 'text'

/**
 * 所有渲染器类型的联合
 */
export type RendererType = StatusRendererType | MediaTypeRendererType

// ==================== 工厂接口 ====================

/**
 * 渲染器工厂接口
 */
export interface ContentRendererFactory {
  /**
   * 获取指定数据的内容渲染器
   * 优先基于状态选择，然后基于媒体类型选择
   */
  getRenderer<T extends MediaTypeOrUnknown>(
    data: UnifiedTimelineItemData<T>
  ): ContentRenderer<T>
  
  /**
   * 注册状态渲染器
   */
  registerStatusRenderer(
    status: StatusRendererType,
    renderer: ContentRenderer
  ): void
  
  /**
   * 注册媒体类型渲染器
   */
  registerMediaTypeRenderer<T extends MediaTypeOrUnknown>(
    type: T,
    renderer: ContentRenderer<T>
  ): void
}

// ==================== 组件属性接口 ====================

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

  /** 时间轴宽度（用于坐标转换） */
  timelineWidth?: number

  /** 自定义内容渲染器（可选，用于扩展） */
  customRenderer?: ContentRenderer<T>
}

// ==================== 组件事件接口 ====================

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

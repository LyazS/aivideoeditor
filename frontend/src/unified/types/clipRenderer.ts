/**
 * 统一Clip架构 - 内容渲染类型定义
 *
 * 模板组件架构：使用Vue SFC模板组件替代类渲染器
 * 注意：模板组件直接定义props接口，不再使用这里的类型
 */

import type { VNode, Component } from 'vue'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import type { MediaType } from '@/unified/mediaitem/types'

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
 * 渲染器工厂接口（模板组件架构）
 */
export interface ContentRendererFactory {
  /**
   * 获取指定数据的模板组件
   * 优先基于状态选择，然后基于媒体类型选择
   */
  getTemplateComponent<T extends MediaType>(data: UnifiedTimelineItemData<T>): Component

  /**
   * 注册状态模板组件
   */
  registerStatusTemplate(status: StatusRendererType, component: Component): void

  /**
   * 注册媒体类型模板组件
   */
  registerMediaTypeTemplate<T extends MediaType>(type: T, component: Component): void
}

// ==================== 组件属性接口 ====================

/**
 * UnifiedTimelineClip组件属性
 */
export interface UnifiedTimelineClipProps<T extends MediaType = MediaType> {
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

// ==================== 模板组件公共接口 ====================

/**
 * 模板组件公共属性接口
 * 所有内容模板组件都应该使用这个接口作为基础
 */
export interface ContentTemplateProps<T extends MediaType = MediaType> {
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
  
  /** 轨道高度 */
  trackHeight: number
  
  /** 时间轴宽度（用于坐标转换） */
  timelineWidth: number
}


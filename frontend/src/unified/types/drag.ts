/**
 * 统一架构下的拖拽相关类型定义
 * 从旧架构的 types/index.ts 中迁移而来
 */

// ==================== 拖拽相关接口 ====================

/**
 * 时间轴项目拖拽数据结构
 */
export interface TimelineItemDragData {
  type: 'timeline-item'
  itemId: string
  trackId: string
  startTime: number // 开始时间（帧数）
  selectedItems: string[] // 多选支持
  dragOffset: { x: number; y: number } // 拖拽偏移
}

/**
 * 素材库拖拽数据结构
 */
export interface MediaItemDragData {
  type: 'media-item'
  mediaItemId: string
  name: string
  duration: number // 素材时长（帧数）- 来自MediaItem.duration
  mediaType: 'video' | 'image' | 'audio' | 'text'
}

/**
 * 拖拽预览数据结构
 */
export interface DragPreviewData {
  name: string
  duration: number // 预览时长（帧数）- 来自MediaItem.duration
  startTime: number // 开始时间（帧数）
  trackId: string
  isConflict?: boolean
  isMultiple?: boolean
  count?: number
  height?: number // 预览高度（像素）- 与被拖拽clip的高度一致
  mediaType?: 'video' | 'image' | 'audio' | 'text' // 媒体类型，用于确定默认高度
}

/**
 * 拖拽数据类型枚举
 */
export type DragDataType = 'timeline-item' | 'media-item' | 'files' | 'unknown'

/**
 * 拖拽偏移量
 */
export interface DragOffset {
  x: number
  y: number
}

/**
 * 拖拽位置计算结果
 */
export interface DropPositionResult {
  dropTime: number // 放置时间（帧数）
  targetTrackId: string // 目标轨道ID
  trackContent: HTMLElement // 轨道内容DOM元素
  snapResult?: any // 吸附结果
}

/**
 * 拖拽帧数计算结果
 */
export interface DropFramesResult {
  frame: number // 帧数
  snapResult?: any // 吸附结果
}
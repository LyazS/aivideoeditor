import type { TimelineItemData, TransformData, Position } from '../../context'

/**
 * 时间轴项目操作相关的类型定义
 */

/**
 * 添加时间轴项目的数据
 */
export interface AddTimelineItemData extends TimelineItemData {
  // 继承所有TimelineItemData属性
}

/**
 * 移动时间轴项目的数据
 */
export interface MoveTimelineItemData {
  itemId: string
  from: Position
  to: Position
  oldTrackId?: number
  newTrackId?: number
}

/**
 * 变换时间轴项目的数据
 */
export interface TransformTimelineItemData {
  itemId: string
  oldTransform: TransformData
  newTransform: TransformData
}

/**
 * 分割时间轴项目的数据
 */
export interface SplitTimelineItemData {
  originalItemId: string
  splitTime: number // 分割时间点（秒）
  firstItemId: string
  secondItemId: string
}

/**
 * 复制时间轴项目的数据
 */
export interface DuplicateTimelineItemData {
  originalItemId: string
  newItemId: string
  offsetTime?: number // 时间偏移（秒）
}

/**
 * 调整时间轴项目大小的数据
 */
export interface ResizeTimelineItemData {
  itemId: string
  oldTimeRange: {
    timelineStartTime: number
    timelineEndTime: number
  }
  newTimeRange: {
    timelineStartTime: number
    timelineEndTime: number
  }
}

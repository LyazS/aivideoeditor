/**
 * 统一架构下的类型定义索引文件
 */

// ==================== 时间重叠检测相关类型 ====================
export {
  // 时间重叠检测接口
  type OverlapTimeRange,
  type OverlapResult,
  type ConflictInfo,
} from './timeOverlap'

// ==================== 拖拽相关类型 ====================
export {
  // 拖拽数据结构
  type TimelineItemDragData,
  type MediaItemDragData,
  type DragPreviewData,
  
  // 拖拽类型和工具
  type DragDataType,
  type DragOffset,
  type DropPositionResult,
  type DropFramesResult,
} from './drag'
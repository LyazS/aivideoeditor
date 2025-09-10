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

// ==================== Clip渲染器相关类型 ====================
export {
  // 渲染器工厂接口
  type ContentRendererFactory,

  // 渲染器类型定义
  type StatusRendererType,
  type MediaTypeRendererType,
  type RendererType,

  // 组件接口
  type UnifiedTimelineClipProps,
  type UnifiedTimelineClipEvents,

  // 模板组件接口
  type ContentTemplateProps,
} from './clipRenderer'

/**
 * 视频分辨率接口
 */
export interface VideoResolution {
  name: string
  width: number
  height: number
  aspectRatio: string
  category?: string
}

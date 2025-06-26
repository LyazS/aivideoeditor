/**
 * Store Utils 工具函数统一导出
 * 重新导出所有拆分的模块，提供统一的导入接口
 */

// 调试工具
export { printDebugInfo } from './debugUtils'

// 时间计算工具
export { calculatePixelsPerFrame, expandTimelineIfNeededFrames, formatFileSize } from './timeUtils'

// 坐标转换工具
export { calculateVisibleFrameRange, frameToPixel, pixelToFrame } from './coordinateUtils'

// 查找工具
export {
  getTimelineItemAtFrames,
  getTimelineItemsAtFrames,
  getTimelineItemAtTrackAndFrames,
  getTimelineItemsByTrack,
  findOrphanedTimelineItems,
  findTimelineItemBySprite,
} from './timelineSearchUtils'

// 自动整理工具
export { autoArrangeTrackItems, autoArrangeTimelineItems } from './timelineArrangementUtils'

// 缩放计算工具
export { getMaxZoomLevelFrames, getMinZoomLevelFrames, getMaxScrollOffsetFrames } from './zoomUtils'

// 时长计算工具
export {
  calculateContentEndTimeFrames,
  calculateTotalDurationFrames,
  calculateMaxVisibleDurationFrames,
} from './durationUtils'

// 时间范围工具
export { syncTimeRange, validateTimeRange, calculateTimeRangeOverlap } from './timeRangeUtils'

// 数据验证工具
export { validateDataIntegrity, cleanupInvalidReferences } from './dataValidationUtils'

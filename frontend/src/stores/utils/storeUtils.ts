// ==================== 过渡期索引文件 ====================
// 此文件重新导出所有拆分的模块，保持向后兼容性
// 建议直接从具体模块导入以获得更好的tree-shaking效果

// 调试工具
export { printDebugInfo } from './debugUtils'

// 时间计算工具（仅保留有效函数）
export {
  calculatePixelsPerSecond,
  expandTimelineIfNeeded,
  formatFileSize,
} from './timeUtils'

// 坐标转换工具（仅帧数版本）
export {
  calculateVisibleFrameRange,
  frameToPixel,
  pixelToFrame,
} from './coordinateUtils'

// 查找工具
export {
  getTimelineItemAtTime,
  getTimelineItemsByTrack,
  findOrphanedTimelineItems,
  findTimelineItemBySprite,
  getTimelineItemsAtTime,
  getTimelineItemAtTrackAndTime,
} from './timelineSearchUtils'

// 自动整理工具
export {
  autoArrangeTrackItems,
  autoArrangeTimelineItems,
} from './timelineArrangementUtils'

// 缩放计算工具（仅帧数版本）
export {
  getMaxZoomLevelFrames,
  getMinZoomLevelFrames,
  getMaxScrollOffsetFrames,
} from './zoomUtils'

// 时长计算工具（仅帧数版本）
export {
  calculateContentEndTimeFrames,
  calculateTotalDurationFrames,
  calculateMaxVisibleDurationFrames,
} from './durationUtils'

// 时间范围工具
export {
  syncTimeRange,
  validateTimeRange,
  calculateTimeRangeOverlap,
} from './timeRangeUtils'

// 数据验证工具
export {
  validateDataIntegrity,
  cleanupInvalidReferences,
} from './dataValidationUtils'


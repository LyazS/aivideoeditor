/**
 * 统一工具函数导出
 * 提供基于新架构统一类型的工具函数
 */

// ==================== 媒体类型检测工具 ====================
export {
  // 类型定义
  type DetectedMediaType,

  // 配置常量
  SUPPORTED_MEDIA_TYPES,
  FILE_SIZE_LIMITS,

  // 检测函数
  detectFileMediaType,
  isSupportedMediaType,
  isSupportedMimeType,
  getMediaTypeFromMimeType,
  getMediaTypeDisplayName,
  getMediaTypeIcon
} from './mediaTypeDetector'

// ==================== 统一时间范围工具 ====================
export {
  // 同步工具
  syncTimeRange,
  
  // 验证工具
  validateBaseTimeRange,
  validateTimelineItemTimeRange,
  
  // 计算工具
  calculateDuration,
  containsFrame,
  isTimeRangeOverlapping,
  calculateOverlapDuration,
  
  // 操作工具
  moveTimelineItem,
  resizeTimelineItem,
  trimTimelineItem,
  
  // 工具集合
  UnifiedTimeRangeUtils
} from './UnifiedTimeRangeUtils'

// ==================== 统一WebAV动画管理器 ====================
export {
  // 管理器类
  UnifiedWebAVAnimationManager,

  // 全局管理器
  globalUnifiedWebAVAnimationManager
} from './UnifiedWebAVAnimationManager'

// ==================== 统一Sprite工厂 ====================
export {
  // 主要工厂函数
  createSpriteFromUnifiedMediaItem,
  
  // 辅助函数
  canCreateSpriteFromUnifiedMediaItem,
  getSpriteTypeFromUnifiedMediaItem,
  batchCheckCanCreateSprite
} from './UnifiedSpriteFactory'

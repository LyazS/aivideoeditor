/**
 * 统一轨道模块主入口
 *
 * 基于重构文档的统一类型设计理念
 *
 * 核心设计理念：
 * - 状态驱动的统一架构：与UnifiedTimelineItem完美集成
 * - 响应式数据结构：核心数据 + 行为函数 + 查询函数
 * - 类型安全：完整的TypeScript类型定义
 */

// ==================== 核心类型导出 ====================

export type {
  // 核心接口
  UnifiedTrack,
  UnifiedTrackType,
  UnifiedTrackStatus,

  // 配置类型
  UnifiedTrackConfig,
  UnifiedTrackSummary,
  UnifiedTrackOperationResult,
  UnifiedTrackValidationResult,
  UnifiedTrackCapabilities,

  // 事件类型
  UnifiedTrackEventType,
  UnifiedTrackEventData,
} from './types'

// ==================== 常量导出 ====================

export {
  DEFAULT_UNIFIED_TRACK_CONFIGS,
  UNIFIED_TRACK_TYPE_NAMES,
  UNIFIED_TRACK_STATUS_NAMES,
  UNIFIED_TRACK_TYPE_ICONS,
  UNIFIED_TRACK_STATUS_COLORS,
  UNIFIED_TRACK_TYPE_CAPABILITIES,
} from './types'

// ==================== 类型守卫导出 ====================

export {
  isValidUnifiedTrackType,
  isValidUnifiedTrackStatus,
  isUnifiedTrack,
} from './utils'

// ==================== 工具函数导出 ====================

export {
  getUnifiedTrackCapabilities,
  supportsVisibility,
  supportsMute,
  isUnifiedTrackEditable,
  isUnifiedTrackUsable,
  getUnifiedTrackTypeIcon,
  getUnifiedTrackStatusLabel,
  getUnifiedTrackStatusColor,
  getUnifiedTrackTypeName,
  validateUnifiedTrackConfig,
  cloneUnifiedTrackConfig,
  cloneUnifiedTrack,
  areUnifiedTracksEqual,
  generateUnifiedTrackName,
  createDefaultUnifiedTrackConfig,
  mergeUnifiedTrackConfig,
  filterUnifiedTracks,
  sortUnifiedTracks,
  getUnifiedTrackStats,
  getUnifiedTrackDebugInfo,
  debugUnifiedTrack,
  debugUnifiedTrackList,
} from './utils'



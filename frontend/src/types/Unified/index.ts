/**
 * 统一类型导出文件
 *
 * 统一导出所有Unified*类型，便于在项目中使用
 * 基于重构文档的统一异步源架构设计
 */

// ==================== 数据源相关类型 ====================

// 基础数据源类型
export type { DataSourceStatus, DataSourceManager } from './sources/BaseDataSource'

export {
  BaseDataSource,
  DATA_SOURCE_TO_MEDIA_STATUS_MAP,
  isValidDataSourceTransition,
  mapDataSourceStatusToMediaStatus,
} from './sources/BaseDataSource'

// 扩展数据源类型
export type {
  UnifiedDataSource,
  ProjectFileInfo,
  RemoteFileConfig,
  DownloadStats,
} from './sources'

export {
  UserSelectedFileSource,
  ProjectFileSource,
  RemoteFileSource,
  isUserSelectedSource,
  isProjectFileSource,
  isRemoteSource,
  createUserSelectedFileSource,
  createProjectFileSource,
  createRemoteFileSource,
} from './sources'



// ==================== 媒体项目相关类型 ====================

export type {
  MediaType,
  MediaStatus,
  TransitionContext,
  WebAVObjects,
  UnifiedMediaItem,
  CreateUnifiedMediaItemOptions,
} from './UnifiedMediaItem'

export {
  VALID_MEDIA_TRANSITIONS,
  isValidMediaTransition,
  createUnifiedMediaItem,
  isUnifiedMediaItem,
} from './UnifiedMediaItem'
// ==================== 时间轴项目相关类型 ====================

export type {
  TimelineItemStatus,
  TimelineStatusContext,
  TimeRange,
  VisualMediaProps,
  VideoMediaConfig,
  ImageMediaConfig,
  AudioMediaConfig,
  TextMediaConfig,
  GetMediaConfig,
  AnimationConfig,
  BasicTimelineConfig,
  CustomSprite,
  ExtendedPropsChangeEvent,
  UnifiedTimelineItem,
  CreateUnifiedTimelineItemOptions,
} from './UnifiedTimelineItem'

export {
  VALID_TIMELINE_TRANSITIONS,
  isValidTimelineTransition,
  MEDIA_TO_TIMELINE_STATUS_MAP,
  mapMediaStatusToTimelineStatus,
  createUnifiedTimelineItem,
  createTimelineStatusContext,
  createLoadingContext,
  createErrorContext,
  createReadyContext,
  isUnifiedTimelineItem,
} from './UnifiedTimelineItem'

// ==================== 命令系统相关类型 ====================

export type {
  UnifiedCommand,
  StateSnapshot,
  TimelineItemSnapshot,
  MediaItemSnapshot,
  BatchSnapshot,
  CommandTransitionContext,
  BatchCommand,
} from './UnifiedCommand'

export {
  TimelineItemCommand,
  MoveTimelineItemCommand,
  DeleteTimelineItemCommand,
  BatchCommandImpl,
  isUnifiedCommand,
} from './UnifiedCommand'

// ==================== 管理器相关类型 ====================

export type {
  DataSourceManager as IDataSourceManager,
  UserSelectedFileManager,
  ProjectFileManager,
  RemoteFileManager,
  UnifiedMediaManager,
  UnifiedTimelineManager,
  SpriteLifecycleManager,
  CommandHistoryManager,
  NotificationManager,
  ManagerFactory,
} from './UnifiedManagers'

// ==================== 类型守卫函数 ====================

// 从各自的文件中导入类型守卫函数
export { isUnifiedDataSource } from './sources'

// ==================== 工具函数 ====================

/**
 * 生成时间戳
 */
export function generateTimestamp(): number {
  return Date.now()
}

/**
 * 创建基础转换上下文
 */
export function createBaseTransitionContext(
  source: string,
  reason: string,
  metadata?: Record<string, any>,
): { timestamp: number; source: string; reason: string; metadata?: Record<string, any> } {
  return {
    timestamp: generateTimestamp(),
    source,
    reason,
    metadata,
  }
}

// ==================== 常量定义 ====================

/**
 * 默认配置常量
 */
export const UNIFIED_DEFAULTS = {
  // 数据源默认配置
  DATA_SOURCE: {
    RETRY_COUNT: 3,
    RETRY_DELAY: 1000,
    TIMEOUT: 30000,
  },

  // 媒体项目默认配置
  MEDIA_ITEM: {
    PROCESSING_TIMEOUT: 60000,
    PROGRESS_UPDATE_INTERVAL: 100,
  },

  // 时间轴项目默认配置
  TIMELINE_ITEM: {
    DEFAULT_DURATION: 300, // 5秒 @ 60fps
    MIN_DURATION: 1,
    MAX_DURATION: 36000, // 10分钟 @ 60fps
  },

  // 命令系统默认配置
  COMMAND: {
    HISTORY_LIMIT: 100,
    MERGE_TIMEOUT: 1000,
    BATCH_SIZE: 50,
  },
} as const

/**
 * 错误代码常量
 */
export const UNIFIED_ERROR_CODES = {
  // 数据源错误
  DATA_SOURCE_NOT_FOUND: 'DATA_SOURCE_NOT_FOUND',
  DATA_SOURCE_INVALID: 'DATA_SOURCE_INVALID',
  DATA_SOURCE_TIMEOUT: 'DATA_SOURCE_TIMEOUT',

  // 媒体项目错误
  MEDIA_ITEM_NOT_FOUND: 'MEDIA_ITEM_NOT_FOUND',
  MEDIA_ITEM_PROCESSING_FAILED: 'MEDIA_ITEM_PROCESSING_FAILED',
  MEDIA_ITEM_INVALID_STATE: 'MEDIA_ITEM_INVALID_STATE',

  // 时间轴项目错误
  TIMELINE_ITEM_NOT_FOUND: 'TIMELINE_ITEM_NOT_FOUND',
  TIMELINE_ITEM_INVALID_RANGE: 'TIMELINE_ITEM_INVALID_RANGE',
  TIMELINE_ITEM_SPRITE_ERROR: 'TIMELINE_ITEM_SPRITE_ERROR',

  // 命令系统错误
  COMMAND_EXECUTION_FAILED: 'COMMAND_EXECUTION_FAILED',
  COMMAND_UNDO_FAILED: 'COMMAND_UNDO_FAILED',
  COMMAND_INVALID_STATE: 'COMMAND_INVALID_STATE',
} as const


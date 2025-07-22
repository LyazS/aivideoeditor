/**
 * 统一类型导出文件
 *
 * 统一导出所有Unified*类型，便于在项目中使用
 * 基于重构文档的统一异步源架构设计
 */

// ==================== 数据源相关类型 ====================

// 基础数据源类型
export type { DataSourceStatus } from './sources/BaseDataSource'

export {
  BaseDataSource,
  DATA_SOURCE_TO_MEDIA_STATUS_MAP,
  isValidDataSourceTransition,
  mapDataSourceStatusToMediaStatus,
} from './sources/BaseDataSource'

// 数据源管理器类型
export type {
  AcquisitionTask,
  AcquisitionTaskStatus,
  ManagerStats,
  ManagerConfig,
  GlobalManagerStats,
} from './managers'

export {
  BaseDataSourceManager,
  DataSourceManagerRegistry,
  UserSelectedFileManager,
  getManagerRegistry,
  registerManager,
  getManager,
  initializeDataSourceManagers,
  getRegisteredManagerTypes,
  cleanupAllManagerTasks,
  printGlobalManagerStats,
} from './managers'

// 扩展数据源类型
export type { UnifiedDataSource, RemoteFileConfig, DownloadStats } from './sources'

export {
  UserSelectedFileSource,
  RemoteFileSource,
  isUserSelectedSource,
  isRemoteSource,
} from './sources'

// ==================== 媒体项目相关类型 ====================

export type { MediaType, WebAVObjects } from './UnifiedMediaItem'
export { UnifiedMediaItem } from './UnifiedMediaItem'

// 媒体项目工厂
export type {
  BaseCreateOptions,
  UserFileCreateOptions,
  RemoteFileCreateOptions,
  BatchCreateOptions,
} from './UnifiedMediaItemFactory'
export { UnifiedMediaItemFactory } from './UnifiedMediaItemFactory'

// ==================== 状态转换相关类型 ====================

// 媒体状态相关
export type { MediaStatus } from './contexts/MediaTransitionContext'

// 时间轴状态相关
export type { TimelineItemStatus } from './contexts/TimelineStatusContext'

// 状态转换历史记录
export type { StateTransitionRecord } from './contexts/BaseTransitionContext'

// ==================== 转换上下文相关类型 ====================

// 通用基础上下文
export type {
  BaseTransitionContext,
  ProgressInfo,
  ErrorInfo,
  FileInfo,
  NetworkInfo,
  BaseProgressContext,
  BaseErrorContext,
  BaseFileContext,
  BaseNetworkContext,
} from './contexts/BaseTransitionContext'

// 媒体项目转换上下文
export type {
  AsyncProcessingContext,
  ProgressUpdateContext,
  DownloadCompletedContext,
  ParseCompletedContext,
  ErrorContext,
  CancelledContext,
  RetryContext,
  MissingContext,
  UserInputContext,
  ServerMetadataContext,
  BatchProcessingContext,
  MediaTransitionContext,
} from './contexts/MediaTransitionContext'

// 时间轴项目状态上下文
export type {
  TimelineStatusContext,
  DownloadContext,
  ParseContext,
  ProcessingContext,
  ReadyContext,
  ErrorContext as TimelineErrorContext,
  ProgressExtension,
  ErrorExtension,
  TimelineStatusContextUnion,
} from './contexts/TimelineStatusContext'
// ==================== 时间轴项目相关类型 ====================

export type {
  UnifiedBaseTimeRange as TimeRange,
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
} from './UnifiedTimelineItem'

export { MEDIA_TO_TIMELINE_STATUS_MAP } from './UnifiedTimelineItem'

// ==================== 命令系统相关类型 ====================

export type {
  UnifiedCommand,
  StateSnapshot,
  TimelineItemSnapshot,
  BatchSnapshot,
  CommandTransitionContext,
  BatchCommand,
} from './UnifiedCommand'

// ==================== 管理器相关类型 ====================

export type {
  UnifiedMediaManager,
  UnifiedTimelineManager,
  SpriteLifecycleManager,
  CommandHistoryManager,
  NotificationManager,
} from './UnifiedManagers'

// ==================== 工具函数 ====================

/**
 * 生成时间戳
 */
export function generateTimestamp(): number {
  return Date.now()
}

/**
 * 数据源管理器初始化相关工具函数
 */
export {
  initDataSourceManagers,
  isDataSourceManagersInitialized,
  getDataSourceManagersStatus,
} from './utils/dataSourceManagerInit'

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

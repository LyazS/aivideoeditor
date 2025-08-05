/**
 * 统一数据源系统导出文件
 * 基于"核心数据与行为分离"的响应式重构方案
 */

// ==================== 基础类型和接口 ====================
export {
  // 基础类型定义
  type BaseDataSourceData,
  type DataSourceStatus,

  // 常量
  DATA_SOURCE_TO_MEDIA_STATUS_MAP,

  // 通用行为函数
  UnifiedDataSourceActions,

  // 基础查询函数
  DataSourceQueries as BaseDataSourceQueries,
} from './sources/BaseDataSource'

// ==================== 统一数据源类型系统 ====================
export {
  // 统一类型定义
  type UnifiedDataSourceData,

  // 工厂函数
  DataSourceFactory,

  // 扩展查询函数（包含类型查询功能）
  DataSourceQueries,
} from './sources/DataSourceTypes'

// ==================== 用户选择文件数据源 ====================
export {
  // 类型定义
  type UserSelectedFileSourceData,
  type FileValidationResult,

  // 工厂函数
  UserSelectedFileSourceFactory,

  // 类型守卫
  UserSelectedFileTypeGuards,

  // 查询函数
  UserSelectedFileQueries,
} from './sources/UserSelectedFileSource'

// ==================== 远程文件数据源 ====================
export {
  // 类型定义
  type RemoteFileSourceData,
  type RemoteFileConfig,
  type DownloadStats,
  type DownloadProgress,

  // 配置常量
  DEFAULT_REMOTE_CONFIG,

  // 工厂函数
  RemoteFileSourceFactory,

  // 类型守卫
  RemoteFileTypeGuards,

  // 查询函数
  RemoteFileQueries,
} from './sources/RemoteFileSource'

// ==================== 管理器基础类 ====================
export {
  // 接口
  type AcquisitionTaskStatus,
  type AcquisitionTask,
  type ManagerStats,

  // 基础管理器类
  DataSourceManager,
} from './managers/BaseDataSourceManager'

// ==================== 具体管理器实现 ====================
export {
  // 用户选择文件管理器
  UserSelectedFileManager,
} from './managers/UserSelectedFileManager'

export {
  // 远程文件管理器
  RemoteFileManager,
  type RemoteFileManagerConfig,
  DEFAULT_MANAGER_CONFIG,
} from './managers/RemoteFileManager'

// ==================== 管理器注册中心 ====================
export {
  // 注册中心类
  DataSourceManagerRegistry,

  // 便捷函数
  getManagerRegistry,
  startDataSourceAcquisition,
  cancelDataSourceAcquisition,
  retryDataSourceAcquisition,
} from './managers/DataSourceManagerRegistry'

// ==================== 统一媒体项目 ====================
export {
  // 基础类型定义
  type UnifiedMediaItemData,
  type MediaStatus,
  type MediaType,
  type MediaTypeOrUnknown,
  type WebAVObjects,

  // 状态专门类型定义
  type ReadyMediaItem,
  type ProcessingMediaItem,
  type ErrorMediaItem,
  type PendingMediaItem,

  // 媒体类型专门状态定义
  type VideoMediaItem,
  type ImageMediaItem,
  type AudioMediaItem,
  type TextMediaItem,
  type UnknownMediaItem,
  type KnownMediaItem,
  type VisualMediaItem,
  type AudioCapableMediaItem,

  // 工厂函数
  createUnifiedMediaItemData,

  // 查询函数
  UnifiedMediaItemQueries,

  // 行为函数
  UnifiedMediaItemActions,
} from './mediaitem'

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
  getMediaTypeIcon,
} from './utils/mediaTypeDetector'

// ==================== 统一轨道系统 ====================
export {
  // 轨道类型定义
  type UnifiedTrackData,
  type UnifiedTrackType,

  // 工厂函数和类型守卫
  createUnifiedTrackData,
  isVideoTrack,
  isAudioTrack,
  isTextTrack,
  isSubtitleTrack,
  isEffectTrack,
  generateTrackId,
} from './track'

// ==================== 统一时间轴项目系统 ====================
export {
  // 时间轴项目类型定义
  type UnifiedTimelineItemData,
  type TimelineItemStatus,
  type TransformData,
  type CreateTimelineItemOptions,

  // 工厂函数集合
  TimelineItemFactory,

  // 状态转换函数
  transitionTimelineStatus,
  setLoading,
  setReady,
  setError,

  // 类型守卫函数
  isKnownTimelineItem,
  isUnknownTimelineItem,
  isVideoTimelineItem,
  isImageTimelineItem,
  isAudioTimelineItem,
  isTextTimelineItem,
  hasVisualProperties,
  hasAudioProperties,

  // 查询函数
  isReady,
  isLoading,
  hasError,
  getDuration,
  getStatusText,

  // 管理器
  TimelineMediaSyncManager,
} from './timelineitem'

// ==================== 统一模块系统 ====================
export {
  // 统一轨道模块
  createUnifiedTrackModule,
  type UnifiedTrackModule,
} from './modules/UnifiedTrackModule'

export {
  // 统一媒体模块
  createUnifiedMediaModule,
  type UnifiedMediaModule,
} from './modules/UnifiedMediaModule'

export {
  // 统一时间轴模块
  createUnifiedTimelineModule,
  type UnifiedTimelineModule,
} from './modules/UnifiedTimelineModule'

export {
  // 统一视口模块
  createUnifiedViewportModule,
  type UnifiedViewportModule,
} from './modules/UnifiedViewportModule'

export {
  // 统一选择模块
  createUnifiedSelectionModule,
  type UnifiedSelectionModule,
} from './modules/UnifiedSelectionModule'

export {
  // 统一片段操作模块
  createUnifiedClipOperationsModule,
  type UnifiedClipOperationsModule,
} from './modules/UnifiedClipOperationsModule'

// ==================== 统一工具函数 ====================
export {
  // 时间范围工具
  syncTimeRange,
  validateBaseTimeRange,
  validateTimelineItemTimeRange,
  calculateDuration,
  containsFrame,
  isTimeRangeOverlapping,
  calculateOverlapDuration,
  moveTimelineItem,
  resizeTimelineItem,
  trimTimelineItem,
  UnifiedTimeRangeUtils,

  // WebAV动画管理器
  UnifiedWebAVAnimationManager,
  globalUnifiedWebAVAnimationManager,

  // 吸附计算器
  UnifiedSnapCalculator,
} from './utils'

// ==================== 统一Composables ====================
export {
  // 吸附配置
  useSnapConfig,

  // 吸附管理器
  useSnapManager,

  // 拖拽预览管理器
  getDragPreviewManager,

  // 播放控制
  usePlaybackControls,
} from './composables'

// ==================== 统一类型定义 ====================
export {
  // 拖拽相关类型
  type TimelineItemDragData,
  type MediaItemDragData,
  type DragPreviewData,
  type DragDataType,
  type DragOffset,
  type DropPositionResult,
  type DropFramesResult,
} from './types'

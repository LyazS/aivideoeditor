/**
 * 统一异步源架构 - 类型定义统一导出
 */

// 数据源相关类型
export * from './DataSource'

// 媒体项目相关类型
export * from './MediaItem'

// 时间轴项目相关类型
export * from './TimelineItem'

// 命令系统相关类型
export * from './Command'

// 常用类型别名
export type {
  BaseDataSource,
  DataSourceStatus,
  DataSourceManager,
  DataSourceUpdateEvent
} from './DataSource'

export type {
  UnifiedMediaItem,
  UnifiedMediaType,
  MediaSourceType,
  UnifiedMediaManager
} from './MediaItem'

export type {
  UnifiedTimelineItem,
  TimelineItemType,
  TrackType,
  UnifiedTrack,
  UnifiedTimelineManager
} from './TimelineItem'

export type {
  UnifiedCommand,
  CommandType,
  CommandStatus,
  CommandHistoryManager,
  UnifiedCommandManager
} from './Command'

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
  DataSourceQueries as BaseDataSourceQueries
} from './sources/BaseDataSource'

// ==================== 统一数据源类型系统 ====================
export {
  // 统一类型定义
  type UnifiedDataSourceData,

  // 工厂函数
  DataSourceFactory,

  // 扩展查询函数（包含类型查询功能）
  DataSourceQueries
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
  UserSelectedFileQueries
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
  RemoteFileQueries
} from './sources/RemoteFileSource'

// ==================== 管理器基础类 ====================
export {
  // 接口
  type AcquisitionTaskStatus,
  type AcquisitionTask,
  type ManagerStats,
  
  // 基础管理器类
  DataSourceManager
} from './managers/BaseDataSourceManager'

// ==================== 具体管理器实现 ====================
export {
  // 用户选择文件管理器
  UserSelectedFileManager
} from './managers/UserSelectedFileManager'

export {
  // 远程文件管理器
  RemoteFileManager,
  type RemoteFileManagerConfig,
  DEFAULT_MANAGER_CONFIG
} from './managers/RemoteFileManager'

// ==================== 管理器注册中心 ====================
export {
  // 注册中心类
  DataSourceManagerRegistry,

  // 便捷函数
  getManagerRegistry,
  startDataSourceAcquisition,
  cancelDataSourceAcquisition,
  retryDataSourceAcquisition
} from './managers/DataSourceManagerRegistry'

// ==================== 统一媒体项目 ====================
export {
  // 类型定义
  type UnifiedMediaItemData,
  type MediaStatus,
  type MediaType,
  type WebAVObjects,

  // 工厂函数
  createUnifiedMediaItemData,

  // 查询函数
  UnifiedMediaItemQueries,

  // 行为函数
  UnifiedMediaItemActions
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
  getMediaTypeIcon
} from './utils/mediaTypeDetector'

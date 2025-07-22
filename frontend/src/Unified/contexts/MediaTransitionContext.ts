/**
 * 媒体项目转换上下文类型定义
 *
 * 专门用于UnifiedMediaItem状态转换时传递附加信息的上下文类型。
 * 包含媒体处理、下载、解析等相关的上下文定义，以及媒体状态转换规则。
 */

// ==================== 媒体状态定义 ====================

/**
 * 媒体处理状态（抽象层）
 *
 * 统一异步源：所有媒体都经过相同的状态转换路径
 * - 本地文件：瞬间完成获取阶段，但仍走完整的异步流程
 * - 远程文件：正常的异步下载和处理流程
 * - 工程文件：检查存在性后走异步流程
 */
export type MediaStatus =
  | 'pending' // 等待开始处理
  | 'asyncprocessing' // 异步获取中（抽象状态，对应各种数据源的获取阶段）
  | 'webavdecoding' // WebAV解析中
  | 'ready' // 就绪
  | 'error' // 错误
  | 'cancelled' // 取消
  | 'missing' // 缺失（加载工程时本地文件不存在）

// ==================== 基础转换上下文 ====================

/**
 * 基础转换上下文 - 所有转换都包含的通用信息
 */
export interface BaseTransitionContext {
  timestamp: number // 转换时间戳
  source: string // 触发转换的来源
  reason: string // 转换原因
  metadata?: Record<string, any> // 其他元数据
}

// ==================== 媒体处理相关上下文 ====================

/**
 * 开始异步处理的上下文
 */
export interface AsyncProcessingContext extends BaseTransitionContext {
  type: 'async_processing'
  initialProgress?: number // 初始进度
  estimatedDuration?: number // 预估总耗时
}

/**
 * 进度更新上下文
 */
export interface ProgressUpdateContext extends BaseTransitionContext {
  type: 'progress_update'
  progress: number // 当前进度 (0-100)
  progressMessage: string // 进度描述
  estimatedTime?: number // 预估剩余时间(ms)
  downloadSpeed?: string // 下载速度
  downloadedBytes?: number // 已下载字节数
  totalBytes?: number // 总字节数
}

/**
 * 下载完成转换上下文
 */
export interface DownloadCompletedContext extends BaseTransitionContext {
  type: 'download_completed'
  downloadedFile: File // 已下载的文件对象
  downloadedUrl: string // 本地blob URL
  fileSize: number // 文件大小
  downloadDuration: number // 下载耗时(ms)
  averageSpeed?: string // 平均下载速度
}

/**
 * WebAV解析完成上下文
 */
export interface ParseCompletedContext extends BaseTransitionContext {
  type: 'parse_completed'
  parsedMetadata: {
    // 解析得到的元数据
    duration: number
    resolution?: string
    format: string
    bitrate?: number
    codecInfo?: {
      video?: string
      audio?: string
    }
  }
  thumbnailGenerated: boolean // 是否生成了缩略图
  webavObjects: any // WebAV解析结果
  parseTime: number // 解析耗时(ms)
}

// ==================== 错误和控制相关上下文 ====================

/**
 * 错误转换上下文
 */
export interface ErrorContext extends BaseTransitionContext {
  type: 'error'
  errorMessage: string // 错误描述
  errorCode: string // 错误代码
  errorDetails?: any // 详细错误信息
  retryable: boolean // 是否可重试
  retryCount?: number // 重试次数
  lastAttemptTime?: number // 上次尝试时间
}

/**
 * 取消转换上下文
 */
export interface CancelledContext extends BaseTransitionContext {
  type: 'cancelled'
  cancelReason: string // 取消原因
  partialProgress?: number // 取消时的进度
  canResume?: boolean // 是否可恢复
}

/**
 * 重试转换上下文
 */
export interface RetryContext extends BaseTransitionContext {
  type: 'retry'
  retryCount: number // 重试次数
  previousError?: string // 上次错误信息
  retryDelay?: number // 重试延迟(ms)
}

/**
 * 文件缺失上下文
 */
export interface MissingContext extends BaseTransitionContext {
  type: 'missing'
  originalPath?: string // 原始文件路径
  lastModified?: number // 文件最后修改时间
  expectedSize?: number // 预期文件大小
}

// ==================== 用户交互相关上下文 ====================

/**
 * 用户输入上下文
 */
export interface UserInputContext extends BaseTransitionContext {
  type: 'user_input'
  userDuration?: number // 用户输入的时长
  userDescription?: string // 用户描述
}

/**
 * 服务器元数据上下文
 */
export interface ServerMetadataContext extends BaseTransitionContext {
  type: 'server_metadata'
  serverDuration?: number // 服务器提供的时长
  serverWidth?: number // 服务器提供的宽度
  serverHeight?: number // 服务器提供的高度
  serverResolution?: string // 服务器提供的分辨率
  serverFormat?: string // 服务器提供的格式
  serverFileSize?: number // 服务器提供的文件大小
}

// ==================== 批量处理相关上下文 ====================

/**
 * 批量处理上下文（扩展支持）
 */
export interface BatchProcessingContext extends BaseTransitionContext {
  type: 'batch_processing'
  batchId: string
  currentIndex: number
  totalCount: number
  batchProgress: number
  failedItems: string[]
}

// ==================== 媒体转换上下文联合类型 ====================

/**
 * 媒体项目转换上下文联合类型
 * 
 * 包含所有媒体项目可能的转换上下文类型，提供类型安全的状态转换信息传递
 */
export type MediaTransitionContext =
  | AsyncProcessingContext
  | ProgressUpdateContext
  | DownloadCompletedContext
  | ParseCompletedContext
  | ErrorContext
  | CancelledContext
  | RetryContext
  | MissingContext
  | UserInputContext
  | ServerMetadataContext
  | BatchProcessingContext





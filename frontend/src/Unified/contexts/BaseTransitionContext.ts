/**
 * 通用基础转换上下文类型定义
 * 
 * 定义所有转换上下文的基础接口和通用工具函数。
 * 这些类型和函数被媒体项目和时间轴项目共同使用。
 */

// ==================== 基础转换上下文接口 ====================

/**
 * 基础转换上下文 - 所有转换都包含的通用信息
 * 
 * 这是所有具体上下文类型的基础接口，提供转换的基本信息
 */
export interface BaseTransitionContext {
  timestamp: number // 转换时间戳
  source: string // 触发转换的来源
  reason: string // 转换原因
  metadata?: Record<string, any> // 其他元数据
}

// ==================== 通用上下文扩展接口 ====================

/**
 * 进度信息扩展接口
 * 
 * 为需要显示进度的上下文提供标准的进度信息结构
 */
export interface ProgressInfo {
  percent: number        // 进度百分比 (0-100)
  detail?: string       // 进度详细描述
  estimatedTime?: number // 预估剩余时间(ms)
  startTime?: number    // 开始时间戳
}

/**
 * 错误信息扩展接口
 * 
 * 为错误相关的上下文提供标准的错误信息结构
 */
export interface ErrorInfo {
  code: string          // 错误代码
  message: string       // 错误消息
  details?: any         // 详细错误信息
  recoverable: boolean  // 是否可恢复
  retryCount?: number   // 重试次数
  lastAttemptTime?: number // 上次尝试时间
}

/**
 * 文件信息扩展接口
 * 
 * 为涉及文件操作的上下文提供标准的文件信息结构
 */
export interface FileInfo {
  name: string          // 文件名
  size: number          // 文件大小(bytes)
  type: string          // 文件类型
  url?: string          // 文件URL
  path?: string         // 文件路径
  lastModified?: number // 最后修改时间
}

/**
 * 网络信息扩展接口
 * 
 * 为网络相关操作的上下文提供标准的网络信息结构
 */
export interface NetworkInfo {
  url: string           // 请求URL
  method?: string       // HTTP方法
  status?: number       // HTTP状态码
  headers?: Record<string, string> // 响应头
  speed?: string        // 传输速度
  timeout?: number      // 超时时间
}

// ==================== 通用上下文类型 ====================

/**
 * 带进度的基础上下文
 */
export interface BaseProgressContext extends BaseTransitionContext {
  progress: ProgressInfo
}

/**
 * 带错误信息的基础上下文
 */
export interface BaseErrorContext extends BaseTransitionContext {
  error: ErrorInfo
}

/**
 * 带文件信息的基础上下文
 */
export interface BaseFileContext extends BaseTransitionContext {
  file: FileInfo
}

/**
 * 带网络信息的基础上下文
 */
export interface BaseNetworkContext extends BaseTransitionContext {
  network: NetworkInfo
}



// ==================== 常用常量 ====================

/**
 * 常用的上下文来源
 */
export const CONTEXT_SOURCES = {
  USER: 'user',
  SYSTEM: 'system',
  NETWORK: 'network',
  FILE_SYSTEM: 'file_system',
  WEBAV: 'webav',
  DOWNLOAD_MANAGER: 'download_manager',
  PROJECT_MANAGER: 'project_manager',
  TIMELINE_MANAGER: 'timeline_manager'
} as const

/**
 * 常用的错误代码
 */
export const ERROR_CODES = {
  // 网络相关
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  
  // 文件相关
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_ACCESS_ERROR: 'FILE_ACCESS_ERROR',
  FILE_FORMAT_ERROR: 'FILE_FORMAT_ERROR',
  
  // 解析相关
  PARSE_ERROR: 'PARSE_ERROR',
  WEBAV_ERROR: 'WEBAV_ERROR',
  CODEC_ERROR: 'CODEC_ERROR',
  
  // 系统相关
  MEMORY_ERROR: 'MEMORY_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const

/**
 * 常用的转换原因
 */
export const TRANSITION_REASONS = {
  USER_ACTION: 'User action',
  SYSTEM_EVENT: 'System event',
  NETWORK_RESPONSE: 'Network response',
  FILE_CHANGE: 'File change',
  TIMER_EXPIRED: 'Timer expired',
  ERROR_OCCURRED: 'Error occurred',
  RETRY_ATTEMPT: 'Retry attempt',
  INITIALIZATION: 'Initialization',
  CLEANUP: 'Cleanup'
} as const

// ==================== 状态转换历史记录 ====================

/**
 * 状态转换记录
 */
export interface StateTransitionRecord {
  id: string
  itemId: string
  itemType: 'media' | 'timeline'
  fromStatus: string // 使用string类型以支持不同的状态类型
  toStatus: string
  timestamp: number
  source: string
  reason: string
  contextType?: string
  success: boolean
  errorMessage?: string
}



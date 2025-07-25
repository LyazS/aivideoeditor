/**
 * 统一时间轴项目状态上下文模板
 * 提供常用场景的默认上下文配置
 */

import type {
  TimelineStatusContext,
  DownloadContext,
  ParseContext,
  ProcessingContext,
  ReadyContext,
  ErrorContext
} from './types'

// ==================== 预定义的状态上下文模板 ====================

/**
 * 预定义的状态上下文模板
 *
 * 提供常用场景的默认上下文配置
 */
export const TIMELINE_CONTEXT_TEMPLATES = {
  // ==================== 下载相关 ====================
  downloadStart: (): DownloadContext => ({
    stage: 'downloading',
    message: '正在下载文件...',
    progress: { percent: 0 },
    timestamp: Date.now()
  }),

  downloadProgress: (percent: number, speed?: string): DownloadContext => ({
    stage: 'downloading',
    message: '正在下载文件...',
    progress: { percent, detail: speed },
    downloadSpeed: speed,
    timestamp: Date.now()
  }),

  downloadCompleted: (): DownloadContext => ({
    stage: 'downloading',
    message: '下载完成',
    progress: { percent: 100 },
    timestamp: Date.now()
  }),

  // ==================== 解析相关 ====================
  parseStart: (): ParseContext => ({
    stage: 'parsing',
    message: '正在解析媒体文件...',
    progress: { percent: 0 },
    timestamp: Date.now()
  }),

  parseProgress: (percent: number, currentStep?: string): ParseContext => ({
    stage: 'parsing',
    message: '正在解析媒体文件...',
    progress: { percent, detail: currentStep },
    currentStep,
    timestamp: Date.now()
  }),

  parseCompleted: (): ParseContext => ({
    stage: 'parsing',
    message: '解析完成',
    progress: { percent: 100 },
    timestamp: Date.now()
  }),

  // ==================== 处理相关 ====================
  processingStart: (operation?: string): ProcessingContext => ({
    stage: 'processing',
    message: `正在处理${operation ? ` - ${operation}` : ''}...`,
    progress: { percent: 0 },
    operation,
    timestamp: Date.now()
  }),

  processingProgress: (percent: number, operation?: string): ProcessingContext => ({
    stage: 'processing',
    message: `正在处理${operation ? ` - ${operation}` : ''}...`,
    progress: { percent },
    operation,
    timestamp: Date.now()
  }),

  processingCompleted: (operation?: string): ProcessingContext => ({
    stage: 'processing',
    message: `处理完成${operation ? ` - ${operation}` : ''}`,
    progress: { percent: 100 },
    operation,
    timestamp: Date.now()
  }),

  // ==================== 就绪相关 ====================
  ready: (metadata?: ReadyContext['metadata']): ReadyContext => ({
    stage: 'ready',
    message: '已就绪',
    metadata,
    timestamp: Date.now()
  }),

  // ==================== 错误相关 ====================
  error: (message: string, code: string = 'UNKNOWN_ERROR', recoverable: boolean = true): ErrorContext => ({
    stage: 'error',
    message: `错误: ${message}`,
    error: {
      code,
      message,
      recoverable
    },
    timestamp: Date.now()
  }),

  networkError: (message: string = '网络连接失败'): ErrorContext => ({
    stage: 'error',
    message: `网络错误: ${message}`,
    error: {
      code: 'NETWORK_ERROR',
      message,
      recoverable: true
    },
    timestamp: Date.now()
  }),

  parseError: (message: string = '文件解析失败'): ErrorContext => ({
    stage: 'error',
    message: `解析错误: ${message}`,
    error: {
      code: 'PARSE_ERROR',
      message,
      recoverable: true
    },
    timestamp: Date.now()
  }),

  fileNotFound: (message: string = '文件不存在'): ErrorContext => ({
    stage: 'error',
    message: `文件错误: ${message}`,
    error: {
      code: 'FILE_NOT_FOUND',
      message,
      recoverable: false
    },
    timestamp: Date.now()
  }),

  unsupportedFormat: (format?: string): ErrorContext => ({
    stage: 'error',
    message: `不支持的文件格式${format ? `: ${format}` : ''}`,
    error: {
      code: 'UNSUPPORTED_FORMAT',
      message: `不支持的文件格式${format ? `: ${format}` : ''}`,
      recoverable: false
    },
    timestamp: Date.now()
  }),

  cancelled: (): ErrorContext => ({
    stage: 'error',
    message: '操作已取消',
    error: {
      code: 'CANCELLED',
      message: '用户取消了操作',
      recoverable: true
    },
    timestamp: Date.now()
  })
}

// ==================== 上下文工厂函数 ====================

/**
 * 创建自定义下载上下文
 */
export function createDownloadContext(
  percent: number,
  options?: {
    speed?: string
    downloadedBytes?: number
    totalBytes?: number
    message?: string
  }
): DownloadContext {
  return {
    stage: 'downloading',
    message: options?.message || '正在下载文件...',
    progress: { percent, detail: options?.speed },
    downloadSpeed: options?.speed,
    downloadedBytes: options?.downloadedBytes,
    totalBytes: options?.totalBytes,
    timestamp: Date.now()
  }
}

/**
 * 创建自定义解析上下文
 */
export function createParseContext(
  percent: number,
  options?: {
    currentStep?: string
    totalSteps?: number
    message?: string
  }
): ParseContext {
  return {
    stage: 'parsing',
    message: options?.message || '正在解析媒体文件...',
    progress: { percent, detail: options?.currentStep },
    currentStep: options?.currentStep,
    totalSteps: options?.totalSteps,
    timestamp: Date.now()
  }
}

/**
 * 创建自定义处理上下文
 */
export function createProcessingContext(
  percent: number,
  options?: {
    operation?: string
    message?: string
  }
): ProcessingContext {
  return {
    stage: 'processing',
    message: options?.message || `正在处理${options?.operation ? ` - ${options.operation}` : ''}...`,
    progress: { percent },
    operation: options?.operation,
    timestamp: Date.now()
  }
}

/**
 * 创建自定义就绪上下文
 */
export function createReadyContext(
  metadata?: ReadyContext['metadata'],
  message?: string
): ReadyContext {
  return {
    stage: 'ready',
    message: message || '已就绪',
    metadata,
    timestamp: Date.now()
  }
}

/**
 * 创建自定义错误上下文
 */
export function createErrorContext(
  message: string,
  code: string = 'UNKNOWN_ERROR',
  recoverable: boolean = true
): ErrorContext {
  return {
    stage: 'error',
    message: `错误: ${message}`,
    error: {
      code,
      message,
      recoverable
    },
    timestamp: Date.now()
  }
}

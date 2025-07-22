/**
 * 时间轴项目状态上下文类型定义
 *
 * 专门用于UnifiedTimelineItem状态转换时传递附加信息的上下文类型。
 * 基于3状态极简核心设计，通过上下文承载详细的状态信息和UI展示数据，
 * 包含时间轴状态转换规则和工具函数。
 */

// ==================== 时间轴状态定义 ====================

/**
 * 时间轴项目状态（3状态极简核心）
 *
 * 基于重构文档的3状态设计，简化状态管理复杂度
 */
export type TimelineItemStatus =
  | 'loading' // 加载中（包含下载、解析、处理等所有异步操作）
  | 'ready'   // 就绪（可以正常使用和渲染）
  | 'error'   // 错误（需要用户干预或重试）

// ==================== 基础状态上下文 ====================

/**
 * 时间轴项目状态上下文 - 承载当前状态的详细信息和UI展示数据
 * 
 * 设计理念：状态作为基础，上下文承载细节
 * - 3个基础状态：ready|loading|error
 * - 上下文承载：进度、错误信息、用户操作等详细信息
 */
export interface TimelineStatusContext {
  stage: string           // 当前阶段标识
  message: string         // 用户友好的状态描述
  progress?: number       // 进度百分比 (0-100)
  canRetry?: boolean      // 是否可以重试
  canCancel?: boolean     // 是否可以取消
  errorCode?: string      // 错误代码
  timestamp?: number      // 时间戳
  
  // 扩展字段 - 用于特定场景的额外信息
  downloadSpeed?: string  // 下载速度
  downloadedBytes?: number // 已下载字节数
  totalBytes?: number     // 总字节数
  currentStep?: string    // 当前步骤描述
  totalSteps?: number     // 总步骤数
  operation?: string      // 当前操作类型
  metadata?: Record<string, any> // 其他元数据
}

// ==================== 具体的上下文类型定义 ====================

/**
 * 下载上下文
 */
export interface DownloadContext extends TimelineStatusContext {
  stage: 'downloading'
  downloadSpeed?: string
  downloadedBytes?: number
  totalBytes?: number
}

/**
 * 解析上下文
 */
export interface ParseContext extends TimelineStatusContext {
  stage: 'parsing'
  currentStep?: string     // '解析视频轨道' | '解析音频轨道' 等
  totalSteps?: number
}

/**
 * 处理上下文
 */
export interface ProcessingContext extends TimelineStatusContext {
  stage: 'processing'
  operation?: string       // 'thumbnail' | 'compress' | 'convert' 等
}

/**
 * 就绪上下文
 */
export interface ReadyContext extends TimelineStatusContext {
  stage: 'ready'
  metadata?: {
    duration?: number
    resolution?: string
    format?: string
  }
}

/**
 * 错误上下文
 */
export interface ErrorContext extends TimelineStatusContext {
  stage: 'error'
  errorCode: string
  canRetry: boolean
}

// ==================== 进度和错误扩展接口 ====================

/**
 * 进度相关的扩展接口
 */
export interface ProgressExtension {
  progress: {
    percent: number        // 0-100
    detail?: string       // 额外描述
  }
}

/**
 * 错误相关的扩展接口
 */
export interface ErrorExtension {
  error: {
    code: string
    message: string
    recoverable: boolean
  }
}

// ==================== 类型安全的上下文联合类型 ====================

/**
 * 时间轴状态上下文联合类型
 * 
 * 提供类型安全的状态上下文，支持TypeScript的类型推断
 */
export type TimelineStatusContextUnion =
  | DownloadContext
  | ParseContext
  | ProcessingContext
  | ReadyContext
  | ErrorContext









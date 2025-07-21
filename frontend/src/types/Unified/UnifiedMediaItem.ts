/**
 * 统一媒体项目类型设计
 * 
 * 基于统一异步源架构，将LocalMediaItem和AsyncProcessingMediaItem
 * 统一为单一的UnifiedMediaItem，采用状态机模式管理媒体处理流程
 */

import type { Raw } from 'vue'
import type { MP4Clip, ImgClip, AudioClip } from '@webav/av-cliper'
import type { UnifiedDataSource } from './sources'

// ==================== 基础类型定义 ====================

/**
 * 核心媒体类型 - 支持视频、图片、音频和文本
 */
export type MediaType = 'video' | 'image' | 'audio' | 'text'

/**
 * 媒体处理状态（抽象层）
 * 
 * 统一异步源：所有媒体都经过相同的状态转换路径
 * - 本地文件：瞬间完成获取阶段，但仍走完整的异步流程
 * - 远程文件：正常的异步下载和处理流程
 * - 工程文件：检查存在性后走异步流程
 */
export type MediaStatus =
  | 'pending'         // 等待开始处理
  | 'asyncprocessing' // 异步获取中（抽象状态，对应各种数据源的获取阶段）
  | 'webavdecoding'   // WebAV解析中
  | 'ready'           // 就绪
  | 'error'           // 错误
  | 'cancelled'       // 取消
  | 'missing'         // 缺失（加载工程时本地文件不存在）

// ==================== 转换上下文类型 ====================

/**
 * 基础转换上下文 - 所有转换都包含的通用信息
 */
interface BaseTransitionContext {
  timestamp: number         // 转换时间戳
  source: string           // 触发转换的来源
  reason: string           // 转换原因
  metadata?: Record<string, any> // 其他元数据
}

/**
 * 开始异步处理的上下文
 */
interface AsyncProcessingContext extends BaseTransitionContext {
  type: 'async_processing'
  initialProgress?: number  // 初始进度
  estimatedDuration?: number // 预估总耗时
}

/**
 * 进度更新上下文
 */
interface ProgressUpdateContext extends BaseTransitionContext {
  type: 'progress_update'
  progress: number          // 当前进度 (0-100)
  progressMessage: string   // 进度描述
  estimatedTime?: number    // 预估剩余时间(ms)
  downloadSpeed?: string    // 下载速度
  downloadedBytes?: number  // 已下载字节数
  totalBytes?: number       // 总字节数
}

/**
 * 下载完成转换上下文
 */
interface DownloadCompletedContext extends BaseTransitionContext {
  type: 'download_completed'
  downloadedFile: File      // 已下载的文件对象
  downloadedUrl: string     // 本地blob URL
  fileSize: number          // 文件大小
  downloadDuration: number  // 下载耗时(ms)
  averageSpeed?: string     // 平均下载速度
}

/**
 * WebAV解析完成上下文
 */
interface ParseCompletedContext extends BaseTransitionContext {
  type: 'parse_completed'
  parsedMetadata: {         // 解析得到的元数据
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
  webavObjects: any          // WebAV解析结果
  parseTime: number          // 解析耗时(ms)
}

/**
 * 错误转换上下文
 */
interface ErrorContext extends BaseTransitionContext {
  type: 'error'
  errorMessage: string      // 错误描述
  errorCode: string         // 错误代码
  errorDetails?: any        // 详细错误信息
  retryable: boolean        // 是否可重试
  retryCount?: number       // 重试次数
  lastAttemptTime?: number  // 上次尝试时间
}

/**
 * 取消转换上下文
 */
interface CancelledContext extends BaseTransitionContext {
  type: 'cancelled'
  cancelReason: string      // 取消原因
  partialProgress?: number  // 取消时的进度
  canResume?: boolean       // 是否可恢复
}

/**
 * 重试转换上下文
 */
interface RetryContext extends BaseTransitionContext {
  type: 'retry'
  retryCount: number        // 重试次数
  previousError?: string    // 上次错误信息
  retryDelay?: number       // 重试延迟(ms)
}

/**
 * 文件缺失上下文
 */
interface MissingContext extends BaseTransitionContext {
  type: 'missing'
  originalPath?: string     // 原始文件路径
  lastModified?: number     // 文件最后修改时间
  expectedSize?: number     // 预期文件大小
}

/**
 * 用户输入上下文
 */
interface UserInputContext extends BaseTransitionContext {
  type: 'user_input'
  userDuration?: number     // 用户输入的时长
  userDescription?: string  // 用户描述
}

/**
 * 服务器元数据上下文
 */
interface ServerMetadataContext extends BaseTransitionContext {
  type: 'server_metadata'
  serverDuration?: number   // 服务器提供的时长
  serverWidth?: number      // 服务器提供的宽度
  serverHeight?: number     // 服务器提供的高度
  serverResolution?: string // 服务器提供的分辨率
  serverFormat?: string     // 服务器提供的格式
  serverFileSize?: number   // 服务器提供的文件大小
}

/**
 * 转换上下文联合类型
 */
export type TransitionContext =
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

// ==================== WebAV对象接口 ====================

/**
 * WebAV解析结果接口
 */
export interface WebAVObjects {
  mp4Clip?: Raw<MP4Clip>
  imgClip?: Raw<ImgClip>
  audioClip?: Raw<AudioClip>
  thumbnailUrl?: string
  // WebAV解析得到的原始尺寸信息
  originalWidth?: number  // 原始宽度（视频和图片）
  originalHeight?: number // 原始高度（视频和图片）
}

// ==================== 统一媒体项目接口 ====================

/**
 * 统一的媒体项目接口 - 采用状态机模式
 *
 * 核心理念：统一异步源 (Unified Async Source)
 * 所有媒体项目都是异步源，无论是本地文件、远程文件还是工程文件，
 * 都通过统一的异步状态机进行处理，差异仅体现在处理速度上
 */
export interface UnifiedMediaItem {
  // ==================== 类型标识 ====================
  readonly __type__: 'UnifiedMediaItem'

  // ==================== 核心属性 ====================
  id: string
  name: string
  createdAt: string
  mediaType: MediaType | 'unknown'
  mediaStatus: MediaStatus // 独立状态字段，不是计算属性

  // ==================== 数据源（包含获取状态） ====================
  source: UnifiedDataSource // 使用统一的数据源联合类型

  // ==================== WebAV对象（状态相关） ====================
  webav?: WebAVObjects

  // ==================== 元数据（状态相关） ====================
  duration?: number // 媒体时长（帧数），可能在不同阶段获得

  // ==================== 状态机方法 ====================

  /**
   * 状态转换方法 - 由数据源管理器调用
   * @param newStatus 目标状态
   * @param context 转换上下文（可选）- 用于传递状态转换的附加信息
   */
  transitionTo(newStatus: MediaStatus, context?: TransitionContext): void

  /**
   * 检查是否可以转换到指定状态
   * @param newStatus 目标状态
   */
  canTransitionTo(newStatus: MediaStatus): boolean

  /**
   * 状态转换钩子 - 用于副作用处理
   * @param oldStatus 原状态
   * @param newStatus 新状态
   * @param context 转换上下文 - 包含状态转换的详细信息
   */
  onStatusChanged?(oldStatus: MediaStatus, newStatus: MediaStatus, context?: TransitionContext): void

  // ==================== 用户控制方法 ====================

  /**
   * 取消处理
   * 如果正在异步获取中，则取消获取任务
   */
  cancel(): void

  /**
   * 重试处理
   * 仅在错误状态下可用，重新开始处理流程
   */
  retry(): void

  // ==================== 只读查询方法 ====================

  /**
   * 获取文件URL（如果可用）
   */
  getUrl(): string | undefined

  /**
   * 获取媒体时长（如果已解析）
   */
  getDuration(): number | undefined

  /**
   * 获取处理进度（0-1）
   */
  getProgress(): number | undefined

  /**
   * 获取原始宽度（视频和图片）
   */
  getOriginalWidth(): number | undefined

  /**
   * 获取原始高度（视频和图片）
   */
  getOriginalHeight(): number | undefined

  /**
   * 获取原始尺寸对象
   */
  getOriginalSize(): { width: number; height: number } | undefined

  // ==================== 状态查询方法 ====================

  /**
   * 是否已就绪
   */
  isReady(): boolean

  /**
   * 是否正在处理中
   */
  isProcessing(): boolean

  /**
   * 是否有错误
   */
  hasError(): boolean

  /**
   * 获取错误信息（如果有）
   */
  getError(): string | undefined

  /**
   * 是否有尺寸信息
   */
  hasSize(): boolean
}

// ==================== 状态转换规则 ====================

/**
 * 合法的状态转换映射表
 */
export const VALID_MEDIA_TRANSITIONS: Record<MediaStatus, MediaStatus[]> = {
  'pending': ['asyncprocessing', 'webavdecoding', 'error', 'missing'],
  'asyncprocessing': ['webavdecoding', 'error', 'cancelled'],
  'webavdecoding': ['ready', 'error'],
  'ready': ['error'], // 运行时可能出错
  'error': ['pending'], // 支持重试
  'cancelled': ['pending'], // 支持重新开始
  'missing': ['pending', 'error'] // 重新选择文件或确认错误
}

/**
 * 验证状态转换是否合法
 */
export function isValidMediaTransition(from: MediaStatus, to: MediaStatus): boolean {
  return VALID_MEDIA_TRANSITIONS[from]?.includes(to) ?? false
}

// ==================== 工厂函数 ====================

/**
 * 创建统一媒体项目的基础数据
 */
export interface CreateUnifiedMediaItemOptions {
  id: string
  name: string
  source: UnifiedDataSource
  mediaType?: MediaType | 'unknown'
  duration?: number
  onStatusChanged?: (oldStatus: MediaStatus, newStatus: MediaStatus, context?: TransitionContext) => void
}

/**
 * 媒体项目创建工厂函数
 */
export function createUnifiedMediaItem(options: CreateUnifiedMediaItemOptions): UnifiedMediaItem {
  const {
    id,
    name,
    source,
    mediaType = 'unknown',
    duration,
    onStatusChanged
  } = options

  const mediaItem: UnifiedMediaItem = {
    __type__: 'UnifiedMediaItem',
    id,
    name,
    createdAt: new Date().toISOString(),
    mediaType,
    mediaStatus: 'pending',
    source,
    duration,

    // 状态机方法实现
    transitionTo(newStatus: MediaStatus, context?: TransitionContext): void {
      if (!this.canTransitionTo(newStatus)) {
        throw new Error(`Invalid transition from ${this.mediaStatus} to ${newStatus}`)
      }

      const oldStatus = this.mediaStatus
      this.mediaStatus = newStatus

      // 触发状态变化钩子
      this.onStatusChanged?.(oldStatus, newStatus, context)
    },

    canTransitionTo(newStatus: MediaStatus): boolean {
      return isValidMediaTransition(this.mediaStatus, newStatus)
    },

    onStatusChanged,

    // 用户控制方法
    cancel(): void {
      if (this.mediaStatus === 'asyncprocessing') {
        this.source.cancel()
      }
    },

    retry(): void {
      if (this.mediaStatus === 'error' || this.mediaStatus === 'cancelled') {
        this.source.retry()
      }
    },

    // 查询方法
    getUrl(): string | undefined {
      return this.source.getUrl() || undefined
    },

    getDuration(): number | undefined {
      return this.duration
    },

    getProgress(): number | undefined {
      if (this.mediaStatus === 'asyncprocessing') {
        return this.source.getProgress() / 100 // 转换为0-1范围
      }
      return undefined
    },

    getOriginalWidth(): number | undefined {
      return this.webav?.originalWidth
    },

    getOriginalHeight(): number | undefined {
      return this.webav?.originalHeight
    },

    getOriginalSize(): { width: number; height: number } | undefined {
      const width = this.getOriginalWidth()
      const height = this.getOriginalHeight()
      return width !== undefined && height !== undefined ? { width, height } : undefined
    },

    // 状态查询方法
    isReady(): boolean {
      return this.mediaStatus === 'ready'
    },

    isProcessing(): boolean {
      return this.mediaStatus === 'asyncprocessing' || this.mediaStatus === 'webavdecoding'
    },

    hasError(): boolean {
      return this.mediaStatus === 'error'
    },

    getError(): string | undefined {
      return this.source.getError()
    },

    hasSize(): boolean {
      return this.getOriginalWidth() !== undefined && this.getOriginalHeight() !== undefined
    }
  }

  return mediaItem
}

// ==================== 类型守卫函数 ====================

/**
 * 检查是否为统一媒体项目
 */
export function isUnifiedMediaItem(item: any): item is UnifiedMediaItem {
  return item && item.__type__ === 'UnifiedMediaItem'
}

/**
 * 统一媒体项目类型设计
 *
 * 基于统一异步源架构，将LocalMediaItem和AsyncProcessingMediaItem
 * 统一为单一的UnifiedMediaItem，采用状态机模式管理媒体处理流程
 */

import type { Raw } from 'vue'
import type { MP4Clip, ImgClip, AudioClip } from '@webav/av-cliper'
import type { UnifiedDataSource } from './sources'
import type { MediaTransitionContext, MediaStatus } from './contexts/MediaTransitionContext'

// ==================== 基础类型定义 ====================

/**
 * 核心媒体类型 - 支持视频、图片、音频和文本
 */
export type MediaType = 'video' | 'image' | 'audio' | 'text'

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
  originalWidth?: number // 原始宽度（视频和图片）
  originalHeight?: number // 原始高度（视频和图片）
}

// ==================== 统一媒体项目接口 ====================

/**
 * 统一的媒体项目类 - 采用状态机模式
 *
 * 核心理念：统一异步源 (Unified Async Source)
 * 所有媒体项目都是异步源，无论是本地文件、远程文件还是工程文件，
 * 都通过统一的异步状态机进行处理，差异仅体现在处理速度上
 */
export class UnifiedMediaItem {
  // ==================== 类型标识 ====================
  readonly __type__ = 'UnifiedMediaItem' as const

  // ==================== 核心属性 ====================
  public id: string
  public name: string
  public createdAt: string
  public mediaType: MediaType | 'unknown'
  public mediaStatus: MediaStatus // 独立状态字段，不是计算属性

  // ==================== 数据源（包含获取状态） ====================
  public source: UnifiedDataSource // 使用统一的数据源联合类型

  // ==================== WebAV对象（状态相关） ====================
  public webav?: WebAVObjects

  // ==================== 元数据（状态相关） ====================
  public duration?: number // 媒体时长（帧数），可能在不同阶段获得

  // ==================== 构造函数 ====================
  constructor(
    id: string,
    name: string,
    source: UnifiedDataSource,
    options?: {
      mediaType?: MediaType | 'unknown'
      createdAt?: string
      onStatusChanged?: (
        oldStatus: MediaStatus,
        newStatus: MediaStatus,
        context?: MediaTransitionContext,
      ) => void
    },
  ) {
    console.log(`📦 [UNIFIED-MEDIA] UnifiedMediaItem 构造函数开始: ${name} (ID: ${id})`)

    this.id = id
    this.name = name
    this.source = source
    this.mediaType = options?.mediaType || 'unknown'
    this.mediaStatus = 'pending'
    this.createdAt = options?.createdAt || new Date().toISOString()

    // 设置状态变化回调
    if (options?.onStatusChanged) {
      this.onStatusChanged = options.onStatusChanged
    }

    console.log(`📦 [UNIFIED-MEDIA] UnifiedMediaItem 构造完成: ${name} (ID: ${id}, 状态: ${this.mediaStatus})`)
  }

  // ==================== 状态机方法 ====================

  /**
   * 处理数据源状态变化
   */
  public handleSourceStatusChange(source: UnifiedDataSource): void {
    console.log(`🔗 [UNIFIED-MEDIA] 数据源状态变化: ${this.name} (ID: ${this.id}) 数据源状态=${source.getStatus()}`)

    const sourceStatus = source.getStatus()

    // 根据数据源状态转换媒体项目状态
    switch (sourceStatus) {
      case 'acquiring':
        this.transitionTo('asyncprocessing')
        break
      case 'acquired':
        // 数据源获取完成，开始WebAV处理
        this.transitionTo('webavdecoding')
        this.startWebAVProcessing()
        break
      case 'error':
        this.transitionTo('error', {
          type: 'error',
          errorMessage: source.getError() || '数据源获取失败',
          errorCode: 'SOURCE_ERROR',
          retryable: false,
          timestamp: Date.now(),
          source: 'data_source',
          reason: '数据源获取失败'
        })
        break
      case 'cancelled':
        this.transitionTo('cancelled')
        break
      default:
        console.log(`🔗 [UNIFIED-MEDIA] 未处理的数据源状态: ${sourceStatus}`)
    }
  }

  /**
   * 开始WebAV处理
   */
  private async startWebAVProcessing(): Promise<void> {
    console.log(`🎬 [UNIFIED-MEDIA] 开始WebAV处理: ${this.name} (ID: ${this.id})`)

    try {
      // TODO: 实现WebAV处理逻辑
      // 这里应该创建对应的WebAV Clip对象

      // 暂时直接设置为ready状态
      setTimeout(() => {
        this.transitionTo('ready')
      }, 100)

    } catch (error) {
      console.error(`❌ [UNIFIED-MEDIA] WebAV处理失败: ${this.name}`, error)
      this.transitionTo('error', {
        type: 'error',
        errorMessage: error instanceof Error ? error.message : '未知错误',
        errorCode: 'WEBAV_ERROR',
        retryable: false,
        timestamp: Date.now(),
        source: 'webav_processing',
        reason: 'WebAV处理失败'
      })
    }
  }

  /**
   * 状态转换方法 - 由数据源管理器调用
   * @param newStatus 目标状态
   * @param context 转换上下文（可选）- 用于传递状态转换的附加信息
   */
  transitionTo(newStatus: MediaStatus, context?: MediaTransitionContext): void {
    console.log(`🔄 [UNIFIED-MEDIA] 状态转换请求: ${this.name} (ID: ${this.id}) ${this.mediaStatus} → ${newStatus}`)

    if (!this.canTransitionTo(newStatus)) {
      console.warn(`❌ [UNIFIED-MEDIA] 无效的状态转换: ${this.name} (ID: ${this.id}) ${this.mediaStatus} → ${newStatus}`)
      return
    }

    const oldStatus = this.mediaStatus
    this.mediaStatus = newStatus

    console.log(`✅ [UNIFIED-MEDIA] 状态转换成功: ${this.name} (ID: ${this.id}) ${oldStatus} → ${newStatus}`)

    // 调用状态变化钩子
    if (this.onStatusChanged) {
      console.log(`📞 [UNIFIED-MEDIA] 调用状态变化回调: ${this.name} (ID: ${this.id})`)
      this.onStatusChanged(oldStatus, newStatus, context)
    }
  }

  /**
   * 检查是否可以转换到指定状态
   * @param newStatus 目标状态
   */
  canTransitionTo(newStatus: MediaStatus): boolean {
    const currentStatus = this.mediaStatus

    // 定义有效的状态转换规则
    const validTransitions: Record<MediaStatus, MediaStatus[]> = {
      pending: ['asyncprocessing', 'error', 'cancelled'],
      asyncprocessing: ['webavdecoding', 'error', 'cancelled'],
      webavdecoding: ['ready', 'error', 'cancelled'],
      ready: ['error'], // 就绪状态只能转到错误
      error: ['pending', 'cancelled'], // 错误状态可以重试或取消
      cancelled: ['pending'], // 取消状态可以重新开始
      missing: ['pending', 'cancelled'], // 缺失状态可以重试或取消
    }

    return validTransitions[currentStatus]?.includes(newStatus) || false
  }

  /**
   * 状态转换钩子 - 用于副作用处理
   * @param oldStatus 原状态
   * @param newStatus 新状态
   * @param context 转换上下文 - 包含状态转换的详细信息
   */
  public onStatusChanged?: (
    oldStatus: MediaStatus,
    newStatus: MediaStatus,
    context?: MediaTransitionContext,
  ) => void

  // ==================== 用户控制方法 ====================

  /**
   * 取消处理
   * 如果正在异步获取中，则取消获取任务
   */
  cancel(): void {
    if (this.mediaStatus === 'asyncprocessing' || this.mediaStatus === 'webavdecoding') {
      // 取消数据源的获取任务
      if (this.source && typeof this.source.cancel === 'function') {
        this.source.cancel()
      }
      this.transitionTo('cancelled')
    }
  }

  /**
   * 重试处理
   * 仅在错误状态下可用，重新开始处理流程
   */
  retry(): void {
    if (
      this.mediaStatus === 'error' ||
      this.mediaStatus === 'cancelled' ||
      this.mediaStatus === 'missing'
    ) {
      // 重置状态并重新开始处理
      this.transitionTo('pending')
      // 这里应该触发重新处理的逻辑，具体实现依赖于数据源管理器
    }
  }

  // ==================== 只读查询方法 ====================

  /**
   * 获取文件URL（如果可用）
   */
  getUrl(): string | undefined {
    const url = this.source?.getUrl?.()
    return url || undefined
  }

  /**
   * 获取媒体时长（如果已解析）
   */
  getDuration(): number | undefined {
    return this.duration
  }

  /**
   * 获取处理进度（0-1）
   */
  getProgress(): number | undefined {
    return this.source?.getProgress?.()
  }

  /**
   * 获取原始宽度（视频和图片）
   */
  getOriginalWidth(): number | undefined {
    return this.webav?.originalWidth
  }

  /**
   * 获取原始高度（视频和图片）
   */
  getOriginalHeight(): number | undefined {
    return this.webav?.originalHeight
  }

  /**
   * 获取原始尺寸对象
   */
  getOriginalSize(): { width: number; height: number } | undefined {
    const width = this.getOriginalWidth()
    const height = this.getOriginalHeight()

    if (width !== undefined && height !== undefined) {
      return { width, height }
    }

    return undefined
  }

  // ==================== 状态查询方法 ====================

  /**
   * 是否已就绪
   */
  isReady(): boolean {
    return this.mediaStatus === 'ready'
  }

  /**
   * 是否正在处理中
   */
  isProcessing(): boolean {
    return this.mediaStatus === 'asyncprocessing' || this.mediaStatus === 'webavdecoding'
  }

  /**
   * 是否有错误
   */
  hasError(): boolean {
    return this.mediaStatus === 'error'
  }

  /**
   * 获取错误信息（如果有）
   */
  getError(): string | undefined {
    return this.source?.getError?.()
  }

  /**
   * 是否有尺寸信息
   */
  hasSize(): boolean {
    return this.webav?.originalWidth !== undefined && this.webav?.originalHeight !== undefined
  }
}

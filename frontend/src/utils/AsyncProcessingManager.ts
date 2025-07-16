/**
 * 异步处理管理器
 * 负责管理所有异步处理任务，包括网络下载、格式转换等
 */

import type {
  AsyncProcessingType,
  AsyncProcessingConfig,
  AsyncProcessingMediaItem,
  RemoteDownloadConfig
} from '../types'
import { RemoteDownloadProcessor } from './RemoteDownloadProcessor'

/**
 * 异步处理器接口 - 所有处理器的基础接口
 */
export interface AsyncProcessor {
  readonly type: AsyncProcessingType

  /**
   * 开始处理
   * @param config 处理配置
   * @param onProgress 进度回调
   * @returns 处理结果
   */
  process(
    config: AsyncProcessingConfig,
    onProgress: (progress: number) => void
  ): Promise<File>

  /**
   * 取消处理
   */
  cancel(): void

  /**
   * 验证配置
   * @param config 处理配置
   * @returns 是否有效
   */
  validateConfig(config: AsyncProcessingConfig): boolean
}

/**
 * 异步处理管理器
 * 单例模式，管理所有异步处理任务
 */
export class AsyncProcessingManager {
  private static instance: AsyncProcessingManager
  private processingTasks = new Map<string, AbortController>()
  private asyncProcessingMediaItems = new Map<string, AsyncProcessingMediaItem>()
  private processors = new Map<AsyncProcessingType, AsyncProcessor>()

  private constructor() {
    console.log('🔧 [AsyncProcessingManager] 初始化异步处理管理器')

    // 注册默认处理器
    this.registerProcessor(new RemoteDownloadProcessor())
  }

  /**
   * 获取单例实例
   */
  static getInstance(): AsyncProcessingManager {
    if (!AsyncProcessingManager.instance) {
      AsyncProcessingManager.instance = new AsyncProcessingManager()
    }
    return AsyncProcessingManager.instance
  }

  /**
   * 注册处理器
   * @param processor 处理器实例
   */
  registerProcessor(processor: AsyncProcessor): void {
    console.log('🔧 [AsyncProcessingManager] 注册处理器:', processor.type)
    this.processors.set(processor.type, processor)
  }

  /**
   * 获取处理器
   * @param type 处理器类型
   * @returns 处理器实例或undefined
   */
  getProcessor(type: AsyncProcessingType): AsyncProcessor | undefined {
    return this.processors.get(type)
  }

  /**
   * 创建异步处理素材项目
   * @param processingType 处理类型
   * @param config 处理配置
   * @param expectedDuration 预计时长（帧数）
   * @param name 素材名称
   * @returns 异步处理素材项目
   */
  createAsyncProcessingMediaItem(
    processingType: AsyncProcessingType,
    config: AsyncProcessingConfig,
    expectedDuration: number,
    name?: string
  ): AsyncProcessingMediaItem {
    const id = `async_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    
    // 根据配置生成默认名称
    const defaultName = this.generateDefaultName(processingType, config)
    
    const mediaItem: AsyncProcessingMediaItem = {
      id,
      name: name || defaultName,
      mediaType: 'unknown', // 处理前为unknown
      isAsyncProcessing: true,
      processingType,
      processingStatus: 'pending',
      processingProgress: 0,
      expectedDuration,
      processingConfig: config,
      startedAt: new Date().toISOString(),
      thumbnailUrl: this.getDefaultThumbnail(processingType),
      createdAt: new Date().toISOString()
    }

    this.asyncProcessingMediaItems.set(id, mediaItem)
    
    console.log('🔧 [AsyncProcessingManager] 创建异步处理素材:', {
      id,
      type: processingType,
      name: mediaItem.name,
      expectedDuration
    })

    return mediaItem
  }

  /**
   * 开始异步处理
   * @param asyncProcessingMediaItem 异步处理素材项目
   * @param onStatusUpdate 状态更新回调（可选）
   * @returns Promise<void>
   */
  async startProcessing(
    asyncProcessingMediaItem: AsyncProcessingMediaItem,
    onStatusUpdate?: (updatedItem: AsyncProcessingMediaItem) => void
  ): Promise<void> {
    const { id, processingType, processingConfig } = asyncProcessingMediaItem
    
    console.log('🔧 [AsyncProcessingManager] 开始异步处理:', {
      id,
      type: processingType,
      config: processingConfig
    })

    // 获取对应的处理器
    const processor = this.getProcessor(processingType)
    if (!processor) {
      this.updateProcessingStatus(id, 'error', 0, `不支持的处理类型: ${processingType}`)
      return
    }

    // 验证配置
    if (!processor.validateConfig(processingConfig)) {
      this.updateProcessingStatus(id, 'error', 0, '处理配置无效')
      return
    }

    // 创建取消控制器
    const abortController = new AbortController()
    this.processingTasks.set(id, abortController)

    try {
      // 更新状态为处理中
      this.updateProcessingStatus(id, 'processing', 0, undefined, onStatusUpdate)

      // 开始处理
      const processedFile = await processor.process(
        processingConfig,
        (progress: number) => {
          this.updateProcessingStatus(id, 'processing', progress, undefined, onStatusUpdate)
        }
      )

      // 处理完成
      this.updateProcessingStatus(id, 'completed', 100, undefined, onStatusUpdate)
      this.setProcessedFile(id, processedFile)
      
      console.log('✅ [AsyncProcessingManager] 处理完成:', {
        id,
        fileName: processedFile.name,
        fileSize: processedFile.size
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'

      // 区分取消操作和真正的错误
      if (errorMessage === '下载已取消') {
        console.log('🔄 [AsyncProcessingManager] 处理已取消:', id)
        this.updateProcessingStatus(id, 'cancelled', 0, errorMessage, onStatusUpdate)
      } else {
        console.error('❌ [AsyncProcessingManager] 处理失败:', error)
        this.updateProcessingStatus(id, 'error', 0, errorMessage, onStatusUpdate)
      }
    } finally {
      // 清理取消控制器
      this.processingTasks.delete(id)
    }
  }

  /**
   * 取消异步处理
   * @param mediaItemId 媒体项目ID
   */
  cancelProcessing(mediaItemId: string): void {
    console.log('🔧 [AsyncProcessingManager] 取消处理:', mediaItemId)
    
    const abortController = this.processingTasks.get(mediaItemId)
    if (abortController) {
      abortController.abort()
      this.processingTasks.delete(mediaItemId)
    }

    // 获取对应的处理器并调用取消方法
    const mediaItem = this.asyncProcessingMediaItems.get(mediaItemId)
    if (mediaItem) {
      const processor = this.getProcessor(mediaItem.processingType)
      if (processor) {
        processor.cancel()
      }
      
      this.updateProcessingStatus(mediaItemId, 'cancelled', 0)
    }
  }

  /**
   * 更新处理状态
   * @param mediaItemId 媒体项目ID
   * @param status 新状态
   * @param progress 进度
   * @param errorMessage 错误信息
   * @param onStatusUpdate 状态更新回调
   */
  private updateProcessingStatus(
    mediaItemId: string,
    status: AsyncProcessingMediaItem['processingStatus'],
    progress: number,
    errorMessage?: string,
    onStatusUpdate?: (updatedItem: AsyncProcessingMediaItem) => void
  ): void {
    const mediaItem = this.asyncProcessingMediaItems.get(mediaItemId)
    if (!mediaItem) return

    // 更新原始对象
    mediaItem.processingStatus = status
    mediaItem.processingProgress = progress

    if (errorMessage) {
      mediaItem.errorMessage = errorMessage
    }

    if (status === 'completed') {
      mediaItem.completedAt = new Date().toISOString()
    }

    // console.log('🔧 [AsyncProcessingManager] 状态更新:', {
    //   id: mediaItemId,
    //   status,
    //   progress,
    //   errorMessage
    // })

    // 调用状态更新回调，传递一个新的对象副本以确保Vue响应式更新
    if (onStatusUpdate) {
      onStatusUpdate({ ...mediaItem })
    }
  }

  /**
   * 设置处理完成的文件
   * @param mediaItemId 媒体项目ID
   * @param file 处理完成的文件
   */
  private setProcessedFile(mediaItemId: string, file: File): void {
    const mediaItem = this.asyncProcessingMediaItems.get(mediaItemId)
    if (!mediaItem) return

    mediaItem.processedFile = file
    
    // 根据文件类型更新媒体类型
    const detectedType = this.detectMediaType(file)
    mediaItem.mediaType = detectedType
  }

  /**
   * 生成默认名称
   * @param processingType 处理类型
   * @param config 处理配置
   * @returns 默认名称
   */
  private generateDefaultName(processingType: AsyncProcessingType, config: AsyncProcessingConfig): string {
    switch (processingType) {
      case 'remote-download':
        const downloadConfig = config as RemoteDownloadConfig
        try {
          const url = new URL(downloadConfig.url)
          const pathname = url.pathname
          const filename = pathname.split('/').pop() || 'download'
          return filename.includes('.') ? filename : `${filename}.mp4`
        } catch {
          return `远程下载_${Date.now()}.mp4`
        }
      default:
        return `异步处理_${Date.now()}`
    }
  }

  /**
   * 获取默认缩略图
   * @param processingType 处理类型
   * @returns 缩略图URL
   */
  private getDefaultThumbnail(processingType: AsyncProcessingType): string {
    switch (processingType) {
      case 'remote-download':
        return '/icons/download-placeholder.svg'
      default:
        return '/icons/processing-placeholder.svg'
    }
  }

  /**
   * 检测媒体类型
   * @param file 文件对象
   * @returns 媒体类型
   */
  private detectMediaType(file: File): AsyncProcessingMediaItem['mediaType'] {
    const mimeType = file.type.toLowerCase()
    
    if (mimeType.startsWith('video/')) {
      return 'video'
    } else if (mimeType.startsWith('audio/')) {
      return 'audio'
    } else if (mimeType.startsWith('image/')) {
      return 'image'
    } else {
      // 根据文件扩展名进行二次检测
      const extension = file.name.toLowerCase().split('.').pop() || ''
      
      const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm', 'm4v', '3gp']
      const audioExtensions = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma']
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff']
      
      if (videoExtensions.includes(extension)) {
        return 'video'
      } else if (audioExtensions.includes(extension)) {
        return 'audio'
      } else if (imageExtensions.includes(extension)) {
        return 'image'
      }
      
      return 'unknown'
    }
  }

  /**
   * 获取异步处理素材项目
   * @param mediaItemId 媒体项目ID
   * @returns 异步处理素材项目或undefined
   */
  getAsyncProcessingMediaItem(mediaItemId: string): AsyncProcessingMediaItem | undefined {
    return this.asyncProcessingMediaItems.get(mediaItemId)
  }

  /**
   * 获取所有异步处理素材项目
   * @returns 异步处理素材项目数组
   */
  getAllAsyncProcessingMediaItems(): AsyncProcessingMediaItem[] {
    return Array.from(this.asyncProcessingMediaItems.values())
  }

  /**
   * 删除异步处理素材项目
   * @param mediaItemId 媒体项目ID
   */
  removeAsyncProcessingMediaItem(mediaItemId: string): void {
    console.log('🔧 [AsyncProcessingManager] 删除异步处理素材:', mediaItemId)
    
    // 先取消处理（如果正在进行）
    this.cancelProcessing(mediaItemId)
    
    // 删除记录
    this.asyncProcessingMediaItems.delete(mediaItemId)
  }
}

// 导出单例实例
export const asyncProcessingManager = AsyncProcessingManager.getInstance()

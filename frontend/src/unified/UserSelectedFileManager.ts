/**
 * 用户选择文件管理器（响应式重构版）
 * 专注于文件验证和格式检查，支持高并发处理
 */

import { DataSourceManager, type AcquisitionTask } from './BaseDataSourceManager'
import type { UserSelectedFileSourceData } from './UserSelectedFileSource'
import { UserSelectedFileActions, SUPPORTED_MEDIA_TYPES, FILE_SIZE_LIMITS } from './UserSelectedFileSource'

// ==================== 用户选择文件管理器 ====================

/**
 * 用户选择文件管理器 - 适配响应式数据源
 */
export class UserSelectedFileManager extends DataSourceManager<UserSelectedFileSourceData> {
  private static instance: UserSelectedFileManager

  /**
   * 获取单例实例
   */
  static getInstance(): UserSelectedFileManager {
    if (!this.instance) {
      this.instance = new UserSelectedFileManager()
    }
    return this.instance
  }

  /**
   * 私有构造函数，确保单例模式
   */
  private constructor() {
    super()
    // 用户选择文件处理速度快，可以支持更高的并发数
    this.maxConcurrentTasks = 10
  }

  // ==================== 实现抽象方法 ====================

  /**
   * 执行具体的获取任务
   */
  protected async executeTask(task: AcquisitionTask<UserSelectedFileSourceData>): Promise<void> {
    // 用户选择文件是同步操作，包装为Promise以保持接口一致
    return new Promise<void>((resolve, reject) => {
      try {
        // 使用行为函数执行获取
        UserSelectedFileActions.executeAcquisition(task.source)
        
        // 检查执行结果
        if (task.source.status === 'acquired') {
          resolve()
        } else if (task.source.status === 'error') {
          reject(new Error(task.source.errorMessage || '文件处理失败'))
        } else {
          reject(new Error('文件处理状态异常'))
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 获取管理器类型
   */
  getManagerType(): string {
    return 'user-selected'
  }

  /**
   * 获取最大重试次数
   * 用户选择文件通常不需要重试，因为文件验证失败通常是永久性的
   */
  protected getMaxRetries(source: UserSelectedFileSourceData): number {
    return 1
  }

  // ==================== 特定功能方法 ====================

  /**
   * 批量处理用户选择的文件
   */
  async processBatchFiles(files: File[]): Promise<{
    successful: UserSelectedFileSourceData[]
    failed: { file: File, error: string }[]
  }> {
    const results = {
      successful: [] as UserSelectedFileSourceData[],
      failed: [] as { file: File, error: string }[]
    }

    // 为每个文件创建数据源
    const { DataSourceFactory } = await import('./DataSourceTypes')
    const sources = files.map(file => {
      return DataSourceFactory.createUserSelectedSource(file)
    })

    // 并发处理所有文件
    const promises = sources.map(async (source, index) => {
      const taskId = `batch_${Date.now()}_${index}`
      
      return new Promise<void>((resolve) => {
        // 监听状态变化
        const checkStatus = () => {
          if (source.status === 'acquired') {
            results.successful.push(source)
            resolve()
          } else if (source.status === 'error') {
            results.failed.push({
              file: files[index],
              error: source.errorMessage || '处理失败'
            })
            resolve()
          } else {
            // 继续等待状态变化
            setTimeout(checkStatus, 10)
          }
        }

        // 开始处理
        this.startAcquisition(source, taskId)
        checkStatus()
      })
    })

    // 等待所有文件处理完成
    await Promise.all(promises)

    return results
  }

  /**
   * 验证文件列表
   */
  validateFiles(files: File[]): {
    valid: File[]
    invalid: { file: File, error: string }[]
  } {
    const results = {
      valid: [] as File[],
      invalid: [] as { file: File, error: string }[]
    }

    for (const file of files) {
      const validationResult = UserSelectedFileActions.validateFile(file)
      if (validationResult.isValid) {
        results.valid.push(file)
      } else {
        results.invalid.push({
          file,
          error: validationResult.errorMessage || '验证失败'
        })
      }
    }

    return results
  }

  /**
   * 获取支持的文件类型信息
   */
  getSupportedFileTypes(): {
    video: string[]
    audio: string[]
    image: string[]
  } {
    return {
      video: [...SUPPORTED_MEDIA_TYPES.video],
      audio: [...SUPPORTED_MEDIA_TYPES.audio],
      image: [...SUPPORTED_MEDIA_TYPES.image]
    }
  }

  /**
   * 获取文件大小限制信息
   */
  getFileSizeLimits(): {
    video: number
    audio: number
    image: number
  } {
    return {
      video: FILE_SIZE_LIMITS.video,
      audio: FILE_SIZE_LIMITS.audio,
      image: FILE_SIZE_LIMITS.image
    }
  }

  /**
   * 检查文件是否超出大小限制
   */
  checkFileSizeLimit(file: File): {
    isValid: boolean
    mediaType?: 'video' | 'audio' | 'image'
    currentSize: number
    maxSize?: number
    errorMessage?: string
  } {
    const mediaType = UserSelectedFileActions.getMediaType(file.type)
    if (!mediaType) {
      return {
        isValid: false,
        currentSize: file.size,
        errorMessage: '不支持的文件类型'
      }
    }

    const maxSize = FILE_SIZE_LIMITS[mediaType]
    const isValid = file.size <= maxSize

    return {
      isValid,
      mediaType,
      currentSize: file.size,
      maxSize,
      errorMessage: isValid ? undefined : `文件过大，最大支持 ${Math.round(maxSize / (1024 * 1024))}MB`
    }
  }

  /**
   * 获取文件处理统计信息
   */
  getFileProcessingStats(): {
    totalProcessed: number
    byMediaType: {
      video: number
      audio: number
      image: number
      unknown: number
    }
    averageFileSize: number
    totalFileSize: number
  } {
    const tasks = this.getAllTasks().filter(task => task.status === 'completed')
    
    const stats = {
      totalProcessed: tasks.length,
      byMediaType: {
        video: 0,
        audio: 0,
        image: 0,
        unknown: 0
      },
      averageFileSize: 0,
      totalFileSize: 0
    }

    let totalSize = 0
    
    for (const task of tasks) {
      const file = task.source.selectedFile
      totalSize += file.size
      
      const mediaType = UserSelectedFileActions.getMediaType(file.type)
      if (mediaType) {
        stats.byMediaType[mediaType]++
      } else {
        stats.byMediaType.unknown++
      }
    }

    stats.totalFileSize = totalSize
    stats.averageFileSize = tasks.length > 0 ? Math.round(totalSize / tasks.length) : 0

    return stats
  }

  /**
   * 清理所有已完成任务的资源
   */
  cleanupAllResources(): void {
    const tasks = this.getAllTasks()
    
    for (const task of tasks) {
      if (task.status === 'completed' || task.status === 'cancelled') {
        // 清理URL资源
        if (task.source.url) {
          URL.revokeObjectURL(task.source.url)
        }
      }
    }

    // 调用父类的清理方法
    this.cleanupCompletedTasks()
  }
}

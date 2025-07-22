/**
 * 用户选择文件管理器
 * 
 * 专门处理用户通过文件选择器或拖拽选择的本地文件的验证和处理
 * 特点：文件验证快速，主要检查文件有效性和格式支持
 */

import { BaseDataSourceManager, type AcquisitionTask } from './BaseDataSourceManager'
import type { BaseDataSource } from '../sources/BaseDataSource'

// 前向声明，避免循环导入
interface UserSelectedFileSource extends BaseDataSource {
  getSelectedFile(): File
}

/**
 * 支持的媒体文件类型
 */
const SUPPORTED_MEDIA_TYPES = {
  video: [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/avi',
    'video/mov',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv'
  ],
  audio: [
    'audio/mp3',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/aac',
    'audio/flac',
    'audio/x-wav'
  ],
  image: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml'
  ]
} as const

/**
 * 文件验证结果
 */
interface FileValidationResult {
  isValid: boolean
  mediaType: 'video' | 'audio' | 'image' | 'unknown'
  error?: string
  fileUrl?: string
}

/**
 * 用户选择文件管理器
 * 
 * 采用单例模式，统一管理所有用户选择文件的验证任务
 * 主要职责：
 * 1. 验证文件有效性
 * 2. 检查文件格式支持
 * 3. 创建文件URL
 * 4. 快速处理，支持高并发
 */
export class UserSelectedFileManager extends BaseDataSourceManager<UserSelectedFileSource> {
  private static instance: UserSelectedFileManager

  /**
   * 获取管理器单例实例
   */
  static getInstance(): UserSelectedFileManager {
    if (!this.instance) {
      this.instance = new UserSelectedFileManager()
    }
    return this.instance
  }

  private constructor() {
    super()
    // 用户选择文件验证速度快，可以支持更高的并发数
    this.maxConcurrentTasks = 10
  }

  /**
   * 获取管理器类型名称
   */
  getManagerType(): string {
    return 'user-selected'
  }

  /**
   * 执行文件验证任务
   */
  protected async executeTask(task: AcquisitionTask<UserSelectedFileSource>): Promise<void> {
    const source = task.source
    const selectedFile = source.getSelectedFile()

    console.log(`🔍 [UNIFIED-MEDIA] UserSelectedFileManager.executeTask 开始: ${selectedFile.name} (任务ID: ${task.id})`)

    try {
      // 验证文件
      console.log(`🔍 [UNIFIED-MEDIA] 开始验证文件: ${selectedFile.name}`)
      const validationResult = await this.validateFile(selectedFile, task.abortController?.signal)

      if (task.abortController?.signal?.aborted) {
        throw new Error('任务已取消')
      }

      if (!validationResult.isValid) {
        throw new Error(validationResult.error || '文件验证失败')
      }

      // 验证成功，设置数据源状态
      console.log(`🔍 [UNIFIED-MEDIA] 文件验证成功，设置为acquired状态: ${selectedFile.name} (类型: ${validationResult.mediaType})`)
      source.setAcquired(selectedFile, validationResult.fileUrl!)

      console.log(`✅ [UNIFIED-MEDIA] 用户选择文件验证成功: ${selectedFile.name} (${validationResult.mediaType})`)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`❌ [UNIFIED-MEDIA] 用户选择文件验证失败: ${selectedFile.name} - ${errorMessage}`)
      throw error
    }
  }

  /**
   * 验证文件有效性
   */
  private async validateFile(file: File, signal?: AbortSignal): Promise<FileValidationResult> {
    // 检查文件是否存在
    if (!file) {
      return {
        isValid: false,
        mediaType: 'unknown',
        error: '文件对象无效'
      }
    }

    // 检查文件大小
    if (file.size === 0) {
      return {
        isValid: false,
        mediaType: 'unknown',
        error: '文件大小为0'
      }
    }

    // 检查文件大小限制（例如：2GB）
    const maxFileSize = 2 * 1024 * 1024 * 1024 // 2GB
    if (file.size > maxFileSize) {
      return {
        isValid: false,
        mediaType: 'unknown',
        error: `文件过大，最大支持 ${Math.round(maxFileSize / 1024 / 1024 / 1024)}GB`
      }
    }

    // 检查取消信号
    if (signal?.aborted) {
      throw new Error('验证已取消')
    }

    // 确定媒体类型
    const mediaType = this.determineMediaType(file)
    
    if (mediaType === 'unknown') {
      return {
        isValid: false,
        mediaType: 'unknown',
        error: `不支持的文件类型: ${file.type || '未知'}`
      }
    }

    // 创建文件URL
    let fileUrl: string
    try {
      fileUrl = URL.createObjectURL(file)
    } catch (error) {
      return {
        isValid: false,
        mediaType,
        error: '无法创建文件URL'
      }
    }

    // 对于图片文件，进行额外的验证
    if (mediaType === 'image') {
      const imageValidation = await this.validateImageFile(file, fileUrl, signal)
      if (!imageValidation.isValid) {
        URL.revokeObjectURL(fileUrl) // 清理URL
        return imageValidation
      }
    }

    return {
      isValid: true,
      mediaType,
      fileUrl
    }
  }

  /**
   * 确定文件的媒体类型
   */
  private determineMediaType(file: File): 'video' | 'audio' | 'image' | 'unknown' {
    const mimeType = file.type.toLowerCase()
    
    // 检查视频类型
    if (SUPPORTED_MEDIA_TYPES.video.includes(mimeType as any)) {
      return 'video'
    }
    
    // 检查音频类型
    if (SUPPORTED_MEDIA_TYPES.audio.includes(mimeType as any)) {
      return 'audio'
    }
    
    // 检查图片类型
    if (SUPPORTED_MEDIA_TYPES.image.includes(mimeType as any)) {
      return 'image'
    }

    // 如果MIME类型不可用，尝试从文件扩展名判断
    if (!mimeType) {
      const extension = this.getFileExtension(file.name).toLowerCase()
      
      const videoExtensions = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'wmv']
      const audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'flac']
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']
      
      if (videoExtensions.includes(extension)) return 'video'
      if (audioExtensions.includes(extension)) return 'audio'
      if (imageExtensions.includes(extension)) return 'image'
    }
    
    return 'unknown'
  }

  /**
   * 验证图片文件
   */
  private async validateImageFile(
    _file: File,
    fileUrl: string,
    signal?: AbortSignal
  ): Promise<FileValidationResult> {
    return new Promise((resolve) => {
      const img = new Image()
      
      const cleanup = () => {
        img.onload = null
        img.onerror = null
      }

      img.onload = () => {
        cleanup()
        
        // 检查图片尺寸
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          resolve({
            isValid: false,
            mediaType: 'image',
            error: '图片尺寸无效'
          })
          return
        }

        resolve({
          isValid: true,
          mediaType: 'image',
          fileUrl
        })
      }

      img.onerror = () => {
        cleanup()
        resolve({
          isValid: false,
          mediaType: 'image',
          error: '图片文件损坏或格式不支持'
        })
      }

      // 检查取消信号
      if (signal?.aborted) {
        cleanup()
        resolve({
          isValid: false,
          mediaType: 'image',
          error: '验证已取消'
        })
        return
      }

      img.src = fileUrl
    })
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.')
    return lastDotIndex > 0 ? filename.substring(lastDotIndex + 1) : ''
  }

  /**
   * 获取支持的文件类型列表
   */
  static getSupportedFileTypes(): typeof SUPPORTED_MEDIA_TYPES {
    return SUPPORTED_MEDIA_TYPES
  }

  /**
   * 检查文件类型是否支持
   */
  static isFileTypeSupported(mimeType: string): boolean {
    const allTypes = [
      ...SUPPORTED_MEDIA_TYPES.video,
      ...SUPPORTED_MEDIA_TYPES.audio,
      ...SUPPORTED_MEDIA_TYPES.image
    ]
    return allTypes.includes(mimeType as any)
  }

  /**
   * 获取最大重试次数（用户选择文件通常不需要重试）
   */
  protected getMaxRetries(): number {
    return 1 // 用户选择文件验证失败通常不需要重试
  }
}

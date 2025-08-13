/**
 * 用户选择文件管理器（响应式重构版）
 * 专注于文件验证和格式检查，支持高并发处理
 * 包含所有用户选择文件相关的业务逻辑和操作行为
 */

import { DataSourceManager, type AcquisitionTask } from '@/unified/managers/BaseDataSourceManager'
import type {
  UserSelectedFileSourceData,
  FileValidationResult,
} from '@/unified/sources/UserSelectedFileSource'
import {
  SUPPORTED_MEDIA_TYPES,
  FILE_SIZE_LIMITS,
  getMediaTypeFromMimeType,
} from '@/unified/utils/mediaTypeDetector'
import {
  DataSourceBusinessActions,
  DataSourceDataActions,
  DataSourceQueries,
} from '@/unified/sources/BaseDataSource'
import { nextTick } from 'vue'

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
    try {
      // 直接执行获取逻辑
      await this.executeAcquisition(task.source)

      // 检查执行结果
      if (task.source.status === 'acquired') {
        // 成功完成（媒体类型检测已在获取过程中完成）
        return
      } else if (task.source.status === 'error') {
        throw new Error(task.source.errorMessage || '文件处理失败')
      } else {
        throw new Error('文件处理状态异常')
      }
    } catch (error) {
      // 重新抛出错误，让基类处理
      throw error
    }
  }

  // ==================== 用户选择文件特定行为方法 ====================

  /**
   * 执行文件获取
   */
  private async executeAcquisition(source: UserSelectedFileSourceData): Promise<void> {
    try {
      // 设置为获取中状态
      DataSourceBusinessActions.startAcquisition(source)
      // 针对这种瞬间就能完成异步获取的操作，需要nextTick来等待DOM更新
      await nextTick()
      // 验证文件有效性
      const validationResult = this.validateFile(source.selectedFile)
      if (!validationResult.isValid) {
        console.error(
          `❌ [UserSelectedFile] 文件验证失败: ${source.selectedFile.name} - ${validationResult.errorMessage}`,
        )
        DataSourceBusinessActions.setError(source, validationResult.errorMessage || '文件验证失败')
        return
      }

      // 创建URL
      const url = URL.createObjectURL(source.selectedFile)

      // 使用新的业务协调层方法，包含媒体类型检测
      await DataSourceBusinessActions.completeAcquisitionWithTypeDetection(
        source,
        source.selectedFile,
        url,
        async (src) => await this.detectAndSetMediaType(src as UserSelectedFileSourceData),
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '文件处理失败'
      console.error(
        `❌ [UserSelectedFile] 文件获取失败: ${source.selectedFile.name} - ${errorMessage}`,
      )
      DataSourceBusinessActions.setError(source, errorMessage)
    }
  }

  /**
   * 验证文件
   */
  private validateFile(file: File): FileValidationResult {
    // 检查文件是否存在
    if (!file) {
      return {
        isValid: false,
        errorMessage: '文件不存在',
      }
    }

    // 检查文件大小
    if (file.size === 0) {
      return {
        isValid: false,
        errorMessage: '文件为空',
      }
    }

    // 检查文件类型
    const mediaType = this.getMediaType(file.type)
    if (!mediaType) {
      console.error(`❌ [UserSelectedFile] 不支持的文件类型: ${file.type || '未知'} (${file.name})`)
      return {
        isValid: false,
        errorMessage: this.getUnsupportedFileTypeMessage(file.type, file.name),
      }
    }

    // 检查文件大小限制
    const sizeLimit = FILE_SIZE_LIMITS[mediaType]
    if (file.size > sizeLimit) {
      const sizeMB = Math.round(file.size / (1024 * 1024))
      const limitMB = Math.round(sizeLimit / (1024 * 1024))
      return {
        isValid: false,
        errorMessage: this.getFileSizeExceededMessage(sizeMB, limitMB, mediaType),
      }
    }

    // 检查文件名
    if (!this.isValidFileName(file.name)) {
      return {
        isValid: false,
        errorMessage: this.getInvalidFileNameMessage(file.name),
      }
    }

    return {
      isValid: true,
      mediaType,
      fileSize: file.size,
    }
  }

  /**
   * 获取媒体类型
   */
  private getMediaType(mimeType: string): 'video' | 'audio' | 'image' | null {
    const detectedType = getMediaTypeFromMimeType(mimeType)
    return detectedType === 'unknown' ? null : detectedType
  }

  /**
   * 验证文件名
   */
  private isValidFileName(fileName: string): boolean {
    // 检查文件名长度
    if (!fileName || fileName.length === 0 || fileName.length > 255) {
      return false
    }

    // 检查非法字符
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/
    if (invalidChars.test(fileName)) {
      return false
    }

    // 检查保留名称（Windows）
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i
    if (reservedNames.test(fileName)) {
      return false
    }

    return true
  }

  /**
   * 生成不支持文件类型的详细错误信息
   */
  private getUnsupportedFileTypeMessage(fileType: string, fileName: string): string {
    const fileExtension = fileName.toLowerCase().split('.').pop() || ''
    const displayType = fileType || '未知'

    // 根据文件扩展名提供更具体的建议
    const suggestions = this.getSupportedFormatSuggestions(fileExtension)

    return `不支持的文件类型: ${displayType}${fileExtension ? ` (.${fileExtension})` : ''}。${suggestions}`
  }

  /**
   * 生成文件大小超限的详细错误信息
   */
  private getFileSizeExceededMessage(
    actualSizeMB: number,
    limitMB: number,
    mediaType: 'video' | 'audio' | 'image',
  ): string {
    const typeNames = {
      video: '视频',
      audio: '音频',
      image: '图片',
    }

    return `${typeNames[mediaType]}文件过大: ${actualSizeMB}MB，最大支持 ${limitMB}MB。请选择较小的文件或使用压缩工具减小文件大小。`
  }

  /**
   * 生成无效文件名的详细错误信息
   */
  private getInvalidFileNameMessage(fileName: string): string {
    if (!fileName || fileName.length === 0) {
      return '文件名为空，请选择有效的文件。'
    }

    if (fileName.length > 255) {
      return `文件名过长（${fileName.length}字符），最大支持255字符。请重命名文件后重试。`
    }

    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/
    if (invalidChars.test(fileName)) {
      return '文件名包含非法字符（如 < > : " / \\ | ? *），请重命名文件后重试。'
    }

    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i
    if (reservedNames.test(fileName)) {
      return '文件名使用了系统保留名称，请重命名文件后重试。'
    }

    return '文件名格式无效，请检查文件名是否符合规范。'
  }

  /**
   * 根据文件扩展名提供支持格式建议
   */
  private getSupportedFormatSuggestions(fileExtension: string): string {
    // 常见的不支持格式及其建议
    const suggestions: Record<string, string> = {
      // 视频格式建议
      rmvb: '建议转换为 MP4、WebM 或 MOV 格式',
      rm: '建议转换为 MP4、WebM 或 MOV 格式',
      asf: '建议转换为 MP4、WebM 或 MOV 格式',
      vob: '建议转换为 MP4、WebM 或 MOV 格式',
      ts: '建议转换为 MP4、WebM 或 MOV 格式',

      // 音频格式建议
      wma: '建议转换为 MP3、WAV 或 AAC 格式',
      ra: '建议转换为 MP3、WAV 或 AAC 格式',
      amr: '建议转换为 MP3、WAV 或 AAC 格式',

      // 图片格式建议
      tiff: '建议转换为 JPG、PNG 或 WebP 格式',
      tif: '建议转换为 JPG、PNG 或 WebP 格式',
      psd: '建议导出为 JPG、PNG 或 WebP 格式',
      ai: '建议导出为 JPG、PNG 或 WebP 格式',

      // 文档格式
      pdf: '这是文档格式，请选择媒体文件',
      doc: '这是文档格式，请选择媒体文件',
      docx: '这是文档格式，请选择媒体文件',
      txt: '这是文本格式，请选择媒体文件',

      // 压缩格式
      zip: '这是压缩文件，请解压后选择媒体文件',
      rar: '这是压缩文件，请解压后选择媒体文件',
      '7z': '这是压缩文件，请解压后选择媒体文件',
    }

    if (suggestions[fileExtension]) {
      return suggestions[fileExtension] + '。'
    }

    // 默认建议
    return '支持的格式：视频(MP4、WebM、MOV、AVI、MKV、FLV)、音频(MP3、WAV、AAC、FLAC、OGG、M4A)、图片(JPG、PNG、GIF、WebP、BMP)。'
  }

  /**
   * 重试获取
   */
  async retryAcquisition(source: UserSelectedFileSourceData): Promise<void> {
    if (!DataSourceQueries.canRetry(source)) {
      return
    }

    // 清理之前的状态
    DataSourceBusinessActions.cleanup(source)

    // 重新执行获取
    await this.executeAcquisition(source)
  }

  /**
   * 取消获取
   */
  cancelAcquisition(source: UserSelectedFileSourceData): void {
    if (!DataSourceQueries.canCancel(source)) {
      return
    }

    // 清理资源
    DataSourceBusinessActions.cleanup(source)

    // 设置为取消状态
    DataSourceBusinessActions.cancel(source)
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
  protected getMaxRetries(_source: UserSelectedFileSourceData): number {
    return 1
  }

  // ==================== 特定功能方法 ====================

  /**
   * 检测并设置媒体类型
   */
  private async detectAndSetMediaType(source: UserSelectedFileSourceData): Promise<void> {
    if (!source.file) {
      console.warn('文件不存在，无法检测媒体类型')
      return
    }

    try {
      // 使用工具函数检测媒体类型
      const { detectFileMediaType } = await import('@/unified/utils/mediaTypeDetector')
      const detectedType = detectFileMediaType(source.file)

      // 使用媒体模块方法查找对应的媒体项目
      const { useUnifiedStore } = await import('@/unified/unifiedStore')
      const unifiedStore = useUnifiedStore()
      const mediaItem = unifiedStore.getMediaItemBySourceId(source.id)

      if (mediaItem && mediaItem.mediaType === 'unknown') {
        mediaItem.mediaType = detectedType
        console.log(
          `🔍 [UserSelectedFileManager] 媒体类型检测并设置完成: ${source.file.name} -> ${detectedType}`,
        )
      } else if (!mediaItem) {
        console.warn(`找不到数据源ID为 ${source.id} 的媒体项目`)
      } else {
        console.log(`媒体项目 ${mediaItem.name} 的类型已经是 ${mediaItem.mediaType}，跳过设置`)
      }
    } catch (error) {
      console.error('媒体类型检测失败:', error)
    }
  }

  /**
   * 批量处理用户选择的文件
   */
  async processBatchFiles(files: File[]): Promise<{
    successful: UserSelectedFileSourceData[]
    failed: { file: File; error: string }[]
  }> {
    const results = {
      successful: [] as UserSelectedFileSourceData[],
      failed: [] as { file: File; error: string }[],
    }

    // 为每个文件创建数据源
    const { DataSourceFactory } = await import('@/unified/sources/DataSourceTypes')
    const sources = files.map((file) => {
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
              error: source.errorMessage || '处理失败',
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
    invalid: { file: File; error: string }[]
  } {
    const results = {
      valid: [] as File[],
      invalid: [] as { file: File; error: string }[],
    }

    for (const file of files) {
      const validationResult = this.validateFile(file)
      if (validationResult.isValid) {
        results.valid.push(file)
      } else {
        results.invalid.push({
          file,
          error: validationResult.errorMessage || '验证失败',
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
      image: [...SUPPORTED_MEDIA_TYPES.image],
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
      image: FILE_SIZE_LIMITS.image,
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
    const mediaType = this.getMediaType(file.type)
    if (!mediaType) {
      return {
        isValid: false,
        currentSize: file.size,
        errorMessage: '不支持的文件类型',
      }
    }

    const maxSize = FILE_SIZE_LIMITS[mediaType]
    const isValid = file.size <= maxSize

    return {
      isValid,
      mediaType,
      currentSize: file.size,
      maxSize,
      errorMessage: isValid
        ? undefined
        : `文件过大，最大支持 ${Math.round(maxSize / (1024 * 1024))}MB`,
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
    const tasks = this.getAllTasks().filter((task) => task.status === 'completed')

    const stats = {
      totalProcessed: tasks.length,
      byMediaType: {
        video: 0,
        audio: 0,
        image: 0,
        unknown: 0,
      },
      averageFileSize: 0,
      totalFileSize: 0,
    }

    let totalSize = 0

    for (const task of tasks) {
      const file = task.source.selectedFile
      totalSize += file.size

      const mediaType = this.getMediaType(file.type)
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

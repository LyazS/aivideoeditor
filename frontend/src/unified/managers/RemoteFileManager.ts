/**
 * 远程文件管理器（响应式重构版）
 * 专注于下载管理和并发控制，限制并发数，支持进度报告
 * 包含所有远程文件相关的业务逻辑和操作行为
 */

import { DataSourceManager, type AcquisitionTask } from '@/unified/managers/BaseDataSourceManager'
import type { RemoteFileSourceData, DownloadProgress } from '@/unified/sources/RemoteFileSource'
import { RemoteFileQueries, DEFAULT_REMOTE_CONFIG } from '@/unified/sources/RemoteFileSource'
import {
  RuntimeStateBusinessActions,
  RuntimeStateActions,
  RuntimeStateQueries,
} from '@/unified/sources/BaseDataSource'
import type { DetectedMediaType } from '@/unified/utils/mediaTypeDetector'
import type { UnifiedMediaItemData, MediaStatus } from '@/unified/mediaitem/types'

// ==================== 下载管理器配置 ====================

/**
 * 下载管理器配置
 */
export interface RemoteFileManagerConfig {
  maxConcurrentDownloads: number
  defaultTimeout: number
  defaultRetryCount: number
  defaultRetryDelay: number
  maxRetryDelay: number
}

/**
 * 默认配置
 */
export const DEFAULT_MANAGER_CONFIG: RemoteFileManagerConfig = {
  maxConcurrentDownloads: 3, // 限制并发下载数
  defaultTimeout: 30000, // 30秒超时
  defaultRetryCount: 3, // 重试3次
  defaultRetryDelay: 1000, // 重试延迟1秒
  maxRetryDelay: 30000, // 最大重试延迟30秒
}

// ==================== 远程文件管理器 ====================

/**
 * 远程文件管理器 - 适配响应式数据源
 */
export class RemoteFileManager extends DataSourceManager<RemoteFileSourceData> {
  private static instance: RemoteFileManager
  private config: RemoteFileManagerConfig
  private downloadControllers: Map<string, AbortController> = new Map()

  /**
   * 获取单例实例
   */
  static getInstance(): RemoteFileManager {
    if (!this.instance) {
      this.instance = new RemoteFileManager()
    }
    return this.instance
  }

  /**
   * 私有构造函数，确保单例模式
   */
  private constructor() {
    super()
    this.config = { ...DEFAULT_MANAGER_CONFIG }
    // 远程文件下载需要限制并发数，避免网络拥塞
    this.maxConcurrentTasks = this.config.maxConcurrentDownloads
  }

  // ==================== 实现抽象方法 ====================

  /**
   * 执行具体的获取任务
   */
  protected async executeTask(task: AcquisitionTask<RemoteFileSourceData>): Promise<void> {
    // 创建下载控制器
    const controller = new AbortController()
    this.downloadControllers.set(task.id, controller)

    try {
      // 直接执行下载逻辑
      await this.executeAcquisition(task.source)

      // 检查执行结果 - 通过检查文件和错误信息来判断状态
      if (task.source.file && task.source.url && !task.source.errorMessage) {
        // 下载成功（媒体类型检测已在下载过程中完成）
        return
      } else if (task.source.errorMessage) {
        throw new Error(task.source.errorMessage)
      } else {
        throw new Error('下载状态异常')
      }
    } finally {
      // 清理下载控制器
      this.downloadControllers.delete(task.id)
    }
  }

  // ==================== 远程文件特定行为方法 ====================

  /**
   * 执行文件获取
   */
  private async executeAcquisition(source: RemoteFileSourceData): Promise<void> {
    try {
      // 设置为获取中状态
      RuntimeStateBusinessActions.startAcquisition(source)

      // 验证URL
      if (!this.isValidUrl(source.remoteUrl)) {
        RuntimeStateBusinessActions.setError(source, '无效的URL地址')
        return
      }

      // 预先检测媒体类型
      const predictedType = await this.detectMediaTypeFromUrl(source.remoteUrl)
      if (predictedType === 'unknown') {
        // 如果通过HEAD请求无法确定，尝试通过文件扩展名
        const extensionType = this.detectMediaTypeFromUrlExtension(source.remoteUrl)
        await this.setPredictedMediaType(source, extensionType)
      } else {
        await this.setPredictedMediaType(source, predictedType)
      }

      // 合并配置
      const config = {
        ...DEFAULT_REMOTE_CONFIG,
        headers: source.headers || DEFAULT_REMOTE_CONFIG.headers,
        timeout: source.timeout || DEFAULT_REMOTE_CONFIG.timeout,
        retryCount: source.retryCount || DEFAULT_REMOTE_CONFIG.retryCount,
        retryDelay: source.retryDelay || DEFAULT_REMOTE_CONFIG.retryDelay,
      }

      // 开始下载
      await this.downloadFile(source, config)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '下载失败'
      RuntimeStateBusinessActions.setError(source, errorMessage)
    }
  }

  /**
   * 下载文件
   */
  private async downloadFile(
    source: RemoteFileSourceData,
    config: Required<
      Pick<RemoteFileSourceData, 'headers' | 'timeout' | 'retryCount' | 'retryDelay'>
    >,
  ): Promise<void> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.timeout)

    try {
      // 记录开始时间
      source.startTime = Date.now()

      // 发起请求
      const response = await fetch(source.remoteUrl, {
        headers: config.headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // 获取文件大小
      const contentLength = response.headers.get('content-length')
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0
      source.totalBytes = totalBytes

      // 获取文件名和MIME类型
      const fileName = this.extractFileName(source.remoteUrl, response)
      const contentType = response.headers.get('content-type') || 'application/octet-stream'

      // 读取响应流
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应流')
      }

      const chunks: BlobPart[] = []
      let downloadedBytes = 0

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        chunks.push(value)
        downloadedBytes += value.length

        // 更新下载进度
        this.updateDownloadProgress(source, downloadedBytes, totalBytes)
      }

      // 创建文件对象，包含正确的MIME类型
      const blob = new Blob(chunks)
      const file = new File([blob], fileName, { type: contentType })
      const url = URL.createObjectURL(file)

      // 使用新的业务协调层方法，包含媒体类型检测
      await RuntimeStateBusinessActions.completeAcquisitionWithTypeDetection(
        source,
        file,
        url,
        async (src) => await this.detectAndSetMediaType(src as RemoteFileSourceData),
      )

      // 更新媒体项目名称为实际的文件名
      await this.updateMediaItemNameWithFileName(source, fileName)
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('下载超时')
        }
        throw error
      }
      throw new Error('下载失败')
    }
  }

  /**
   * 更新下载进度
   */
  private updateDownloadProgress(
    source: RemoteFileSourceData,
    downloadedBytes: number,
    totalBytes: number,
  ): void {
    source.downloadedBytes = downloadedBytes

    // 计算进度百分比
    const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0
    RuntimeStateActions.setProgress(source, progress)

    // 计算下载速度
    if (source.startTime) {
      const elapsedTime = (Date.now() - source.startTime) / 1000 // 秒
      if (elapsedTime > 0) {
        const speed = downloadedBytes / elapsedTime // 字节/秒
        source.downloadSpeed = this.formatSpeed(speed)
      }
    }
  }

  /**
   * 格式化下载速度
   */
  private formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond < 1024) {
      return `${bytesPerSecond.toFixed(0)} B/s`
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
    } else {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
    }
  }

  /**
   * 从URL预提取文件名（静态方法，用于创建媒体项目时）
   */
  static extractFileNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const fileName = pathname.split('/').pop()
      if (fileName && fileName.includes('.')) {
        // 解码URL编码的文件名
        try {
          return decodeURIComponent(fileName)
        } catch {
          return fileName
        }
      }
    } catch (error) {
      // URL解析失败，使用默认名称
    }

    // 生成默认文件名
    const timestamp = Date.now()
    return `remote_file_${timestamp}`
  }

  /**
   * 提取文件名（完整版，包含HTTP响应头信息）
   */
  private extractFileName(url: string, response: Response): string {
    // 尝试从Content-Disposition头获取文件名
    const contentDisposition = response.headers.get('content-disposition')
    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (match && match[1]) {
        let filename = match[1].replace(/['"]/g, '')
        // 解码URL编码的文件名
        try {
          filename = decodeURIComponent(filename)
        } catch {
          // 解码失败，使用原始文件名
        }
        return filename
      }
    }

    // 从URL中提取文件名
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const fileName = pathname.split('/').pop()
      if (fileName && fileName.includes('.')) {
        // 解码URL编码的文件名
        try {
          return decodeURIComponent(fileName)
        } catch {
          return fileName
        }
      }
    } catch (error) {
      // URL解析失败，使用默认名称
    }

    // 根据Content-Type生成默认文件名
    const contentType = response.headers.get('content-type')
    const extension = this.getExtensionFromContentType(contentType)
    const timestamp = Date.now()

    return `download_${timestamp}${extension}`
  }

  /**
   * 根据Content-Type获取文件扩展名
   */
  private getExtensionFromContentType(contentType: string | null): string {
    if (!contentType) {
      return '.bin'
    }

    const mimeType = contentType.toLowerCase().split(';')[0].trim()

    const mimeToExtension: Record<string, string> = {
      // 视频格式
      'video/mp4': '.mp4',
      'video/avi': '.avi',
      'video/quicktime': '.mov',
      'video/x-matroska': '.mkv',
      'video/x-ms-wmv': '.wmv',
      'video/x-flv': '.flv',
      'video/webm': '.webm',
      'video/3gpp': '.3gp',

      // 音频格式
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/aac': '.aac',
      'audio/flac': '.flac',
      'audio/ogg': '.ogg',
      'audio/mp4': '.m4a',
      'audio/x-ms-wma': '.wma',

      // 图片格式
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/bmp': '.bmp',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/tiff': '.tiff',

      // 其他常见格式
      'application/octet-stream': '.bin',
      'text/plain': '.txt',
      'application/json': '.json',
      'application/xml': '.xml',
      'text/html': '.html',
    }

    return mimeToExtension[mimeType] || '.bin'
  }

  /**
   * 验证URL
   */
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch (error) {
      return false
    }
  }

  /**
   * 重试获取
   */
  async retryAcquisition(source: RemoteFileSourceData): Promise<void> {
    // 检查是否可以重试 - 通过检查错误信息和是否有文件来判断
    if (!source.errorMessage || (source.file && source.url)) {
      return
    }

    // 清理之前的状态
    RuntimeStateBusinessActions.cleanup(source)

    // 重置下载统计
    source.downloadedBytes = 0
    source.totalBytes = 0
    source.downloadSpeed = undefined
    source.startTime = undefined

    // 重新执行获取
    await this.executeAcquisition(source)
  }

  /**
   * 取消获取
   */
  cancelAcquisition(source: RemoteFileSourceData): void {
    // 检查是否可以取消 - 通过检查是否正在下载中（有进度但未完成）
    if (source.progress > 0 && source.progress < 100 && !source.file) {
      return
    }

    // 清理资源
    RuntimeStateBusinessActions.cleanup(source)

    // 重置下载统计
    source.downloadedBytes = 0
    source.totalBytes = 0
    source.downloadSpeed = undefined
    source.startTime = undefined

    // 设置为取消状态
    RuntimeStateBusinessActions.cancel(source)
  }

  /**
   * 获取管理器类型
   */
  getManagerType(): string {
    return 'remote'
  }

  // ==================== 新增：实现统一媒体项目处理 ====================

  /**
   * 处理完整的媒体项目生命周期
   * @param mediaItem 媒体项目
   */
  async processMediaItem(mediaItem: UnifiedMediaItemData): Promise<void> {
    try {
      console.log(`🚀 [RemoteFileManager] 开始处理媒体项目: ${mediaItem.name}`)

      // 1. 设置为处理中状态
      this.transitionMediaStatus(mediaItem, 'asyncprocessing')

      // 2. 执行下载
      await this.downloadFileForMediaItem(mediaItem)

      // 3. 确保数据源已获取
      if (!mediaItem.source.file || !mediaItem.source.url) {
        throw new Error('数据源未准备好')
      }

      // 4. 设置为WebAV解析状态
      this.transitionMediaStatus(mediaItem, 'webavdecoding')

      // 5. WebAV处理器负责具体处理
      const webavResult = await this.webavProcessor.processMedia(mediaItem)

      // 6. 文件管理器负责保存文件和设置引用
      if (mediaItem.source.file) {
        try {
          // 检查媒体类型是否有效
          if (mediaItem.mediaType === 'unknown') {
            throw new Error(`无法保存未知类型的媒体: ${mediaItem.name}`)
          }

          const saveResult = await this.fileManager.saveMediaToProject(
            mediaItem.source.file,
            mediaItem.mediaType,
            // 注意：这里需要传递clip对象，但由于WebAVProcessor内部处理，我们需要调整
            // 暂时先不传递clip，后续可以优化
          )

          if (saveResult.success && saveResult.mediaReference) {
            this.fileManager.setMediaReferenceId(mediaItem, saveResult.mediaReference.id)
          }

          console.log(`💾 [RemoteFileManager] 媒体文件保存成功: ${mediaItem.name}`)
        } catch (saveError) {
          console.error(`❌ [RemoteFileManager] 媒体文件保存失败: ${mediaItem.name}`, saveError)
          console.warn(`媒体文件保存失败，但WebAV解析继续: ${mediaItem.name}`, saveError)
        }
      }

      // 7. 元数据管理器负责设置元数据
      const metadataResult = this.metadataManager.batchSetMetadata(mediaItem, webavResult)
      if (!metadataResult.success) {
        throw new Error(metadataResult.error || '设置元数据失败')
      }

      // 8. 设置为就绪状态
      this.transitionMediaStatus(mediaItem, 'ready')

      console.log(`✅ [RemoteFileManager] 媒体项目处理完成: ${mediaItem.name}`)
    } catch (error) {
      console.error(`❌ [RemoteFileManager] 媒体项目处理失败: ${mediaItem.name}`, {
        mediaType: mediaItem.mediaType,
        sourceType: mediaItem.source.type,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      this.transitionMediaStatus(mediaItem, 'error')
      mediaItem.source.errorMessage = error instanceof Error ? error.message : '处理失败'
    }
  }

  /**
   * 为媒体项目下载文件
   * @param mediaItem 媒体项目
   */
  private async downloadFileForMediaItem(mediaItem: UnifiedMediaItemData): Promise<void> {
    const source = mediaItem.source as RemoteFileSourceData
    
    try {
      // 设置为获取中状态
      RuntimeStateBusinessActions.startAcquisition(source)

      // 验证URL
      if (!this.isValidUrl(source.remoteUrl)) {
        RuntimeStateBusinessActions.setError(source, '无效的URL地址')
        throw new Error('无效的URL地址')
      }

      // 预先检测媒体类型
      const predictedType = await this.detectMediaTypeFromUrl(source.remoteUrl)
      if (predictedType === 'unknown') {
        // 如果通过HEAD请求无法确定，尝试通过文件扩展名
        const extensionType = this.detectMediaTypeFromUrlExtension(source.remoteUrl)
        await this.setPredictedMediaType(source, extensionType)
      } else {
        await this.setPredictedMediaType(source, predictedType)
      }

      // 合并配置
      const config = {
        ...DEFAULT_REMOTE_CONFIG,
        headers: source.headers || DEFAULT_REMOTE_CONFIG.headers,
        timeout: source.timeout || DEFAULT_REMOTE_CONFIG.timeout,
        retryCount: source.retryCount || DEFAULT_REMOTE_CONFIG.retryCount,
        retryDelay: source.retryDelay || DEFAULT_REMOTE_CONFIG.retryDelay,
      }

      // 开始下载
      await this.downloadFile(source, config)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '下载失败'
      RuntimeStateBusinessActions.setError(source, errorMessage)
      throw error
    }
  }


  /**
   * 获取最大重试次数
   */
  protected getMaxRetries(source: RemoteFileSourceData): number {
    return source.retryCount || this.config.defaultRetryCount
  }

  // ==================== 重写父类方法 ====================

  /**
   * 取消任务（重写以支持下载中断）
   */
  cancelTask(taskId: string): boolean {
    // 中断下载
    const controller = this.downloadControllers.get(taskId)
    if (controller) {
      controller.abort()
    }

    // 调用父类方法
    return super.cancelTask(taskId)
  }

  // ==================== 配置管理 ====================

  /**
   * 更新管理器配置
   */
  updateConfig(newConfig: Partial<RemoteFileManagerConfig>): void {
    this.config = { ...this.config, ...newConfig }

    // 更新并发数
    if (newConfig.maxConcurrentDownloads) {
      this.setMaxConcurrentTasks(newConfig.maxConcurrentDownloads)
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): RemoteFileManagerConfig {
    return { ...this.config }
  }

  // ==================== 特定功能方法 ====================

  /**
   * 从URL检测媒体类型（通过HEAD请求获取Content-Type）
   */
  private async detectMediaTypeFromUrl(url: string): Promise<DetectedMediaType> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000), // 5秒超时
      })

      if (!response.ok) {
        return 'unknown'
      }

      const contentType = response.headers.get('content-type')
      if (!contentType) {
        return 'unknown'
      }

      // 使用 mediaTypeDetector 中的方法
      const { getMediaTypeFromMimeType } = await import('@/unified/utils/mediaTypeDetector')
      return getMediaTypeFromMimeType(contentType)
    } catch (error) {
      console.error('通过HEAD请求检测媒体类型失败:', error)
      return 'unknown'
    }
  }

  /**
   * 从URL扩展名检测媒体类型
   */
  private detectMediaTypeFromUrlExtension(url: string): DetectedMediaType {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const extension = pathname.toLowerCase().split('.').pop() || ''

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
    } catch (error) {
      return 'unknown'
    }
  }

  /**
   * 设置预测的媒体类型
   */
  private async setPredictedMediaType(
    source: RemoteFileSourceData,
    mediaType: DetectedMediaType,
  ): Promise<void> {
    try {
      // 使用媒体模块方法查找对应的媒体项目
      const { useUnifiedStore } = await import('@/unified/unifiedStore')
      const unifiedStore = useUnifiedStore()
      const mediaItem = unifiedStore.getMediaItemBySourceId(source.id)

      if (mediaItem && mediaItem.mediaType === 'unknown') {
        mediaItem.mediaType = mediaType
        console.log(
          `🔍 [RemoteFileManager] 预测媒体类型设置完成: ${source.remoteUrl} -> ${mediaType}`,
        )
      }
    } catch (error) {
      console.error('设置预测媒体类型失败:', error)
    }
  }

  /**
   * 检测并设置媒体类型（下载完成后验证）
   */
  private async detectAndSetMediaType(source: RemoteFileSourceData): Promise<void> {
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

      if (mediaItem) {
        // 检查预测的类型是否与实际类型一致
        if (mediaItem.mediaType !== 'unknown' && mediaItem.mediaType !== detectedType) {
          console.log(
            `🔍 [RemoteFileManager] 媒体类型修正: ${source.file.name} ${mediaItem.mediaType} -> ${detectedType}`,
          )
          mediaItem.mediaType = detectedType
        } else if (mediaItem.mediaType === 'unknown') {
          mediaItem.mediaType = detectedType
          console.log(
            `🔍 [RemoteFileManager] 媒体类型检测并设置完成: ${source.file.name} -> ${detectedType}`,
          )
        } else {
          console.log(`媒体项目 ${mediaItem.name} 的类型已经是 ${mediaItem.mediaType}，跳过设置`)
        }
      } else {
        console.warn(`找不到数据源ID为 ${source.id} 的媒体项目`)
      }
    } catch (error) {
      console.error('媒体类型检测失败:', error)
    }
  }

  /**
   * 更新媒体项目名称为实际的文件名（从HTTP响应头获取的更准确的文件名）
   */
  private async updateMediaItemNameWithFileName(
    source: RemoteFileSourceData,
    fileName: string,
  ): Promise<void> {
    try {
      // 使用媒体模块方法查找对应的媒体项目
      const { useUnifiedStore } = await import('@/unified/unifiedStore')
      const unifiedStore = useUnifiedStore()
      const mediaItem = unifiedStore.getMediaItemBySourceId(source.id)

      if (mediaItem) {
        // 从URL提取的文件名（用于比较）
        const urlFileName = RemoteFileManager.extractFileNameFromUrl(source.remoteUrl)

        // 如果当前名称是从URL提取的文件名，或者是默认的"远程文件"，则更新为更准确的文件名
        if (
          mediaItem.name === urlFileName ||
          mediaItem.name === '远程文件' ||
          mediaItem.name.startsWith('remote_file_')
        ) {
          const { UnifiedMediaItemActions } = await import('@/unified/mediaitem')
          UnifiedMediaItemActions.updateName(mediaItem, fileName)
          console.log(
            `📝 [RemoteFileManager] 媒体项目名称已更新为更准确的文件名: ${mediaItem.name} -> ${fileName}`,
          )
        } else {
          console.log(`📝 [RemoteFileManager] 媒体项目已有自定义名称，跳过更新: ${mediaItem.name}`)
        }
      } else {
        console.warn(`找不到数据源ID为 ${source.id} 的媒体项目`)
      }
    } catch (error) {
      console.error('更新媒体项目名称失败:', error)
    }
  }

  /**
   * 获取下载统计信息
   */
  getDownloadStats(): {
    totalDownloads: number
    activeDownloads: number
    completedDownloads: number
    failedDownloads: number
    totalBytesDownloaded: number
    averageDownloadSpeed: number
    averageDownloadTime: number
  } {
    const tasks = this.getAllTasks()
    const completedTasks = tasks.filter((task) => task.status === 'completed')
    const activeTasks = tasks.filter((task) => task.status === 'running')
    const failedTasks = tasks.filter((task) => task.status === 'failed')

    let totalBytesDownloaded = 0
    let totalDownloadTime = 0
    const speedSamples: number[] = []

    for (const task of completedTasks) {
      const source = task.source
      totalBytesDownloaded += source.downloadedBytes

      if (task.startedAt && task.completedAt) {
        const downloadTime = task.completedAt - task.startedAt
        totalDownloadTime += downloadTime

        // 计算下载速度
        if (downloadTime > 0) {
          const speed = source.downloadedBytes / (downloadTime / 1000) // 字节/秒
          speedSamples.push(speed)
        }
      }
    }

    const averageDownloadSpeed =
      speedSamples.length > 0
        ? speedSamples.reduce((sum, speed) => sum + speed, 0) / speedSamples.length
        : 0

    const averageDownloadTime =
      completedTasks.length > 0 ? totalDownloadTime / completedTasks.length : 0

    return {
      totalDownloads: tasks.length,
      activeDownloads: activeTasks.length,
      completedDownloads: completedTasks.length,
      failedDownloads: failedTasks.length,
      totalBytesDownloaded,
      averageDownloadSpeed,
      averageDownloadTime,
    }
  }

  /**
   * 获取活跃下载的进度信息
   */
  getActiveDownloadProgress(): Array<{
    taskId: string
    url: string
    progress: number
    downloadedBytes: number
    totalBytes: number
    speed?: string
    timeRemaining?: string
  }> {
    const activeTasks = this.getAllTasks().filter((task) => task.status === 'running')

    return activeTasks.map((task) => {
      const source = task.source
      const progressInfo = RemoteFileQueries.getFormattedProgress(source)

      return {
        taskId: task.id,
        url: source.remoteUrl,
        progress: progressInfo.percentage,
        downloadedBytes: progressInfo.loaded,
        totalBytes: progressInfo.total,
        speed: progressInfo.speed,
        timeRemaining: progressInfo.timeRemaining,
      }
    })
  }

  /**
   * 暂停所有下载
   */
  pauseAllDownloads(): void {
    const activeTasks = this.getAllTasks().filter((task) => task.status === 'running')

    for (const task of activeTasks) {
      this.cancelTask(task.id)
    }
  }

  /**
   * 清理所有下载资源
   */
  cleanupAllDownloads(): void {
    // 取消所有活跃的下载
    this.pauseAllDownloads()

    // 清理所有下载控制器
    for (const controller of this.downloadControllers.values()) {
      controller.abort()
    }
    this.downloadControllers.clear()

    // 清理已完成的任务
    this.cleanupCompletedTasks()
  }

  /**
   * 检查URL的可访问性
   */
  async checkUrlAccessibility(url: string): Promise<{
    accessible: boolean
    contentLength?: number
    contentType?: string
    error?: string
  }> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000), // 5秒超时
      })

      if (!response.ok) {
        return {
          accessible: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      const contentLength = response.headers.get('content-length')
      const contentType = response.headers.get('content-type')

      return {
        accessible: true,
        contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
        contentType: contentType || undefined,
      }
    } catch (error) {
      return {
        accessible: false,
        error: error instanceof Error ? error.message : '检查失败',
      }
    }
  }
}

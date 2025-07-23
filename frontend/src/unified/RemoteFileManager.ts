/**
 * 远程文件管理器（响应式重构版）
 * 专注于下载管理和并发控制，限制并发数，支持进度报告
 */

import { DataSourceManager, type AcquisitionTask } from './BaseDataSourceManager'
import type { RemoteFileSourceData } from './RemoteFileSource'
import { RemoteFileActions, RemoteFileQueries } from './RemoteFileSource'

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
  maxConcurrentDownloads: 3,    // 限制并发下载数
  defaultTimeout: 30000,        // 30秒超时
  defaultRetryCount: 3,         // 重试3次
  defaultRetryDelay: 1000,      // 重试延迟1秒
  maxRetryDelay: 30000          // 最大重试延迟30秒
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
      // 使用行为函数执行下载
      await RemoteFileActions.executeAcquisition(task.source)
      
      // 检查执行结果
      if (task.source.status === 'acquired') {
        // 下载成功
        return
      } else if (task.source.status === 'error') {
        throw new Error(task.source.errorMessage || '下载失败')
      } else if (task.source.status === 'cancelled') {
        throw new Error('下载被取消')
      } else {
        throw new Error('下载状态异常')
      }
    } finally {
      // 清理下载控制器
      this.downloadControllers.delete(task.id)
    }
  }

  /**
   * 获取管理器类型
   */
  getManagerType(): string {
    return 'remote'
  }

  /**
   * 获取最大重试次数
   */
  protected getMaxRetries(source: RemoteFileSourceData): number {
    return source.config.retryCount || this.config.defaultRetryCount
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
   * 批量下载远程文件
   */
  async downloadBatchFiles(urls: string[]): Promise<{
    successful: RemoteFileSourceData[]
    failed: { url: string, error: string }[]
  }> {
    const results = {
      successful: [] as RemoteFileSourceData[],
      failed: [] as { url: string, error: string }[]
    }

    // 为每个URL创建数据源
    const { DataSourceFactory } = await import('./DataSourceTypes')
    const sources = urls.map(url => {
      return DataSourceFactory.createRemoteSource(url, {
        timeout: this.config.defaultTimeout,
        retryCount: this.config.defaultRetryCount,
        retryDelay: this.config.defaultRetryDelay
      })
    })

    // 并发处理所有下载
    const promises = sources.map(async (source, index) => {
      const taskId = `batch_${Date.now()}_${index}`
      
      return new Promise<void>((resolve) => {
        // 监听状态变化
        const checkStatus = () => {
          if (source.status === 'acquired') {
            results.successful.push(source)
            resolve()
          } else if (source.status === 'error' || source.status === 'cancelled') {
            results.failed.push({
              url: urls[index],
              error: source.errorMessage || '下载失败'
            })
            resolve()
          } else {
            // 继续等待状态变化
            setTimeout(checkStatus, 100)
          }
        }

        // 开始下载
        this.startAcquisition(source, taskId)
        checkStatus()
      })
    })

    // 等待所有下载完成
    await Promise.all(promises)

    return results
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
    const completedTasks = tasks.filter(task => task.status === 'completed')
    const activeTasks = tasks.filter(task => task.status === 'running')
    const failedTasks = tasks.filter(task => task.status === 'failed')

    let totalBytesDownloaded = 0
    let totalDownloadTime = 0
    let speedSamples: number[] = []

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

    const averageDownloadSpeed = speedSamples.length > 0 
      ? speedSamples.reduce((sum, speed) => sum + speed, 0) / speedSamples.length
      : 0

    const averageDownloadTime = completedTasks.length > 0
      ? totalDownloadTime / completedTasks.length
      : 0

    return {
      totalDownloads: tasks.length,
      activeDownloads: activeTasks.length,
      completedDownloads: completedTasks.length,
      failedDownloads: failedTasks.length,
      totalBytesDownloaded,
      averageDownloadSpeed,
      averageDownloadTime
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
    const activeTasks = this.getAllTasks().filter(task => task.status === 'running')
    
    return activeTasks.map(task => {
      const source = task.source
      const progressInfo = RemoteFileQueries.getFormattedProgress(source)
      
      return {
        taskId: task.id,
        url: source.remoteUrl,
        progress: progressInfo.percentage,
        downloadedBytes: progressInfo.loaded,
        totalBytes: progressInfo.total,
        speed: progressInfo.speed,
        timeRemaining: progressInfo.timeRemaining
      }
    })
  }

  /**
   * 暂停所有下载
   */
  pauseAllDownloads(): void {
    const activeTasks = this.getAllTasks().filter(task => task.status === 'running')
    
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
        signal: AbortSignal.timeout(5000) // 5秒超时
      })

      if (!response.ok) {
        return {
          accessible: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      const contentLength = response.headers.get('content-length')
      const contentType = response.headers.get('content-type')

      return {
        accessible: true,
        contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
        contentType: contentType || undefined
      }
    } catch (error) {
      return {
        accessible: false,
        error: error instanceof Error ? error.message : '检查失败'
      }
    }
  }
}

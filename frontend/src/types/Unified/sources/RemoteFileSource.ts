/**
 * 远程文件数据源
 *
 * 场景：需要从网络下载的远程文件
 * 特点：需要下载，支持进度跟踪和并发控制
 */

import { BaseDataSource } from './BaseDataSource'
import type { DataSourceManager } from '../UnifiedManagers'

/**
 * 远程文件配置接口
 */
export interface RemoteFileConfig {
  headers?: Record<string, string> // 自定义请求头
  timeout?: number // 超时时间（毫秒）
  retryCount?: number // 重试次数
  retryDelay?: number // 重试延迟（毫秒）
}

/**
 * 下载统计信息接口
 */
export interface DownloadStats {
  downloadedBytes: number // 已下载字节数
  totalBytes: number // 总字节数
  downloadSpeed?: string // 下载速度
  startTime?: number // 开始时间
}

/**
 * 远程文件数据源
 *
 * 场景：需要从网络下载的远程文件
 * 特点：需要下载，支持进度跟踪和并发控制
 */
export class RemoteFileSource extends BaseDataSource {
  private downloadedBytes: number = 0
  private totalBytes: number = 0
  private downloadSpeed?: string
  private startTime?: number

  constructor(
    private remoteUrl: string,
    private config: RemoteFileConfig = {},
    onUpdate?: (source: RemoteFileSource) => void,
  ) {
    super('remote', onUpdate)
  }

  /**
   * 获取远程URL
   */
  getRemoteUrl(): string {
    return this.remoteUrl
  }

  /**
   * 获取配置
   */
  getConfig(): RemoteFileConfig {
    return this.config
  }

  /**
   * 获取下载统计信息
   */
  getDownloadStats(): DownloadStats {
    return {
      downloadedBytes: this.downloadedBytes,
      totalBytes: this.totalBytes,
      downloadSpeed: this.downloadSpeed,
      startTime: this.startTime,
    }
  }

  protected getManager(): DataSourceManager<RemoteFileSource> {
    // 这里应该返回RemoteFileManager的单例实例
    throw new Error('RemoteFileManager not implemented yet')
  }

  protected executeAcquisition(): void {
    this.getManager().startAcquisition(this, this.taskId!)
  }

  // ==================== 远程文件特有方法 ====================

  /**
   * 更新下载进度
   */
  updateDownloadProgress(progress: number, stats?: Partial<DownloadStats>): void {
    this.updateProgress(progress)

    if (stats) {
      this.downloadedBytes = stats.downloadedBytes || this.downloadedBytes
      this.totalBytes = stats.totalBytes || this.totalBytes
      this.downloadSpeed = stats.downloadSpeed
    }
  }

  /**
   * 设置下载开始状态
   */
  setDownloadStarted(): void {
    this.setAcquiring()
    this.startTime = Date.now()
  }

  /**
   * 重置下载状态
   */
  protected reset(): void {
    super.reset()
    this.downloadedBytes = 0
    this.totalBytes = 0
    this.downloadSpeed = undefined
    this.startTime = undefined
  }
}

// ==================== 类型守卫函数 ====================

/**
 * 判断是否为远程文件数据源
 */
export function isRemoteSource(source: any): source is RemoteFileSource {
  return source?.getType?.() === 'remote'
}

// ==================== 工厂函数 ====================

/**
 * 创建远程文件数据源
 */
export function createRemoteFileSource(
  url: string,
  config?: RemoteFileConfig,
  onUpdate?: (source: RemoteFileSource) => void,
): RemoteFileSource {
  return new RemoteFileSource(url, config, onUpdate)
}

/**
 * 远程文件数据源类型定义和查询函数
 * 基于"核心数据与行为分离"的重构方案
 * 行为函数已移动到 RemoteFileManager 中
 */

import type {
  BaseDataSourceData
} from './BaseDataSource'
import { reactive } from 'vue'
import { generateUUID4 } from '@/utils/idGenerator'

// ==================== 远程文件数据源类型定义 ====================

/**
 * 远程文件配置接口
 */
export interface RemoteFileConfig {
  headers?: Record<string, string>
  timeout?: number
  retryCount?: number
  retryDelay?: number
}

/**
 * 远程文件数据源
 */
export interface RemoteFileSourceData extends BaseDataSourceData {
  type: 'remote'
  remoteUrl: string
  config: RemoteFileConfig
  downloadedBytes: number
  totalBytes: number
  downloadSpeed?: string
  startTime?: number
}

/**
 * 下载统计信息
 */
export interface DownloadStats {
  downloadedBytes: number
  totalBytes: number
  downloadSpeed?: string
  startTime?: number
}

// ==================== 工厂函数 ====================

/**
 * 远程文件数据源工厂函数
 */
export const RemoteFileSourceFactory = {
  createRemoteSource(
    remoteUrl: string,
    config: RemoteFileConfig = {}
  ): RemoteFileSourceData {
    return reactive({
      id: generateUUID4(),
      type: 'remote',
      status: 'pending',
      progress: 0,
      file: null,
      url: null,
      remoteUrl,
      config,
      downloadedBytes: 0,
      totalBytes: 0
    }) as RemoteFileSourceData
  }
}

// ==================== 类型守卫 ====================

/**
 * 远程文件类型守卫
 */
export const RemoteFileTypeGuards = {
  isRemoteSource(source: BaseDataSourceData): source is RemoteFileSourceData {
    return source.type === 'remote'
  }
}

// ==================== 下载配置 ====================

/**
 * 默认下载配置
 */
export const DEFAULT_REMOTE_CONFIG: Required<RemoteFileConfig> = {
  headers: {},
  timeout: 30000,      // 30秒超时
  retryCount: 3,       // 重试3次
  retryDelay: 1000     // 重试延迟1秒
}

/**
 * 下载状态接口
 */
export interface DownloadProgress {
  loaded: number
  total: number
  percentage: number
  speed?: string
  timeRemaining?: string
}



// ==================== 远程文件特定查询函数 ====================

/**
 * 远程文件特定查询函数
 */
export const RemoteFileQueries = {
  /**
   * 获取远程URL
   */
  getRemoteUrl(source: BaseDataSourceData): string | null {
    return RemoteFileTypeGuards.isRemoteSource(source) ? source.remoteUrl : null
  },

  /**
   * 获取下载统计
   */
  getDownloadStats(source: BaseDataSourceData): DownloadStats | null {
    if (!RemoteFileTypeGuards.isRemoteSource(source)) return null

    return {
      downloadedBytes: source.downloadedBytes,
      totalBytes: source.totalBytes,
      downloadSpeed: source.downloadSpeed,
      startTime: source.startTime
    }
  },

  /**
   * 获取下载进度百分比
   */
  getDownloadPercentage(source: RemoteFileSourceData): number {
    if (source.totalBytes === 0) return 0
    return (source.downloadedBytes / source.totalBytes) * 100
  },

  /**
   * 获取格式化的下载进度
   */
  getFormattedProgress(source: RemoteFileSourceData): DownloadProgress {
    const loaded = source.downloadedBytes
    const total = source.totalBytes
    const percentage = this.getDownloadPercentage(source)

    return {
      loaded,
      total,
      percentage,
      speed: source.downloadSpeed,
      timeRemaining: this.calculateTimeRemaining(source)
    }
  },

  /**
   * 计算剩余时间
   */
  calculateTimeRemaining(source: RemoteFileSourceData): string | undefined {
    if (!source.startTime || !source.downloadSpeed || source.totalBytes === 0) {
      return undefined
    }

    const remainingBytes = source.totalBytes - source.downloadedBytes
    if (remainingBytes <= 0) return '0s'

    // 从速度字符串中提取数值
    const speedMatch = source.downloadSpeed.match(/^([\d.]+)\s*([KMGT]?B)\/s$/)
    if (!speedMatch) return undefined

    const speedValue = parseFloat(speedMatch[1])
    const speedUnit = speedMatch[2]

    // 转换为字节/秒
    let bytesPerSecond = speedValue
    switch (speedUnit) {
      case 'KB': bytesPerSecond *= 1024; break
      case 'MB': bytesPerSecond *= 1024 * 1024; break
      case 'GB': bytesPerSecond *= 1024 * 1024 * 1024; break
    }

    const remainingSeconds = Math.ceil(remainingBytes / bytesPerSecond)
    
    if (remainingSeconds < 60) {
      return `${remainingSeconds}s`
    } else if (remainingSeconds < 3600) {
      return `${Math.ceil(remainingSeconds / 60)}m`
    } else {
      return `${Math.ceil(remainingSeconds / 3600)}h`
    }
  },

  /**
   * 获取格式化的文件大小
   */
  getFormattedSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }
  },

  /**
   * 获取下载配置
   */
  getConfig(source: RemoteFileSourceData): RemoteFileConfig {
    return source.config
  },

  /**
   * 检查是否支持断点续传
   */
  supportsResume(_source: RemoteFileSourceData): boolean {
    // 这里可以根据服务器响应头判断是否支持断点续传
    // 目前简单返回false，后续可以扩展
    return false
  }
}

/**
 * 远程文件数据源特定行为函数和查询函数
 * 基于"核心数据与行为分离"的重构方案
 */

import type {
  BaseDataSourceData
} from './BaseDataSource'
import {
  UnifiedDataSourceActions,
  DataSourceQueries
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

// ==================== 远程文件特定行为函数 ====================

/**
 * 远程文件特定行为函数
 */
export const RemoteFileActions = {
  /**
   * 执行文件获取
   */
  async executeAcquisition(source: RemoteFileSourceData): Promise<void> {
    try {
      // 设置为获取中状态
      UnifiedDataSourceActions.setAcquiring(source)
      
      // 验证URL
      if (!this.isValidUrl(source.remoteUrl)) {
        UnifiedDataSourceActions.setError(source, '无效的URL地址')
        return
      }

      // 合并配置
      const config = { ...DEFAULT_REMOTE_CONFIG, ...source.config }
      
      // 开始下载
      await this.downloadFile(source, config)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '下载失败'
      UnifiedDataSourceActions.setError(source, errorMessage)
    }
  },

  /**
   * 下载文件
   */
  async downloadFile(source: RemoteFileSourceData, config: Required<RemoteFileConfig>): Promise<void> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.timeout)

    try {
      // 记录开始时间
      source.startTime = Date.now()

      // 发起请求
      const response = await fetch(source.remoteUrl, {
        headers: config.headers,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // 获取文件大小
      const contentLength = response.headers.get('content-length')
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0
      source.totalBytes = totalBytes

      // 获取文件名
      const fileName = this.extractFileName(source.remoteUrl, response)

      // 读取响应流
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应流')
      }

      const chunks: Uint8Array[] = []
      let downloadedBytes = 0

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        chunks.push(value)
        downloadedBytes += value.length
        
        // 更新下载进度
        this.updateDownloadProgress(source, downloadedBytes, totalBytes)
      }

      // 创建文件对象
      const blob = new Blob(chunks)
      const file = new File([blob], fileName)
      const url = URL.createObjectURL(file)

      // 设置为已获取状态
      UnifiedDataSourceActions.setAcquired(source, file, url)

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
  },

  /**
   * 更新下载进度
   */
  updateDownloadProgress(source: RemoteFileSourceData, downloadedBytes: number, totalBytes: number): void {
    source.downloadedBytes = downloadedBytes
    
    // 计算进度百分比
    const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0
    UnifiedDataSourceActions.setProgress(source, progress)
    
    // 计算下载速度
    if (source.startTime) {
      const elapsedTime = (Date.now() - source.startTime) / 1000 // 秒
      if (elapsedTime > 0) {
        const speed = downloadedBytes / elapsedTime // 字节/秒
        source.downloadSpeed = this.formatSpeed(speed)
      }
    }
  },

  /**
   * 格式化下载速度
   */
  formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond < 1024) {
      return `${bytesPerSecond.toFixed(0)} B/s`
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
    } else {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
    }
  },

  /**
   * 提取文件名
   */
  extractFileName(url: string, response: Response): string {
    // 尝试从Content-Disposition头获取文件名
    const contentDisposition = response.headers.get('content-disposition')
    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (match && match[1]) {
        return match[1].replace(/['"]/g, '')
      }
    }

    // 从URL中提取文件名
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const fileName = pathname.split('/').pop()
      if (fileName && fileName.includes('.')) {
        return fileName
      }
    } catch (error) {
      // URL解析失败，使用默认名称
    }

    // 使用默认文件名
    return `download_${Date.now()}`
  },

  /**
   * 验证URL
   */
  isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch (error) {
      return false
    }
  },

  /**
   * 重试获取
   */
  async retryAcquisition(source: RemoteFileSourceData): Promise<void> {
    if (!DataSourceQueries.canRetry(source)) {
      return
    }

    // 清理之前的状态
    UnifiedDataSourceActions.cleanup(source)
    
    // 重置下载统计
    source.downloadedBytes = 0
    source.totalBytes = 0
    source.downloadSpeed = undefined
    source.startTime = undefined
    
    // 重新执行获取
    await this.executeAcquisition(source)
  },

  /**
   * 取消获取
   */
  cancelAcquisition(source: RemoteFileSourceData): void {
    if (!DataSourceQueries.canCancel(source)) {
      return
    }

    // 清理资源
    UnifiedDataSourceActions.cleanup(source)
    
    // 重置下载统计
    source.downloadedBytes = 0
    source.totalBytes = 0
    source.downloadSpeed = undefined
    source.startTime = undefined
    
    // 设置为取消状态
    UnifiedDataSourceActions.setCancelled(source)
  }
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
  supportsResume(source: RemoteFileSourceData): boolean {
    // 这里可以根据服务器响应头判断是否支持断点续传
    // 目前简单返回false，后续可以扩展
    return false
  }
}

/**
 * 统一媒体项目工厂类
 *
 * 负责创建 UnifiedMediaItem 实例的各种工厂方法
 * 支持多种数据源类型和创建方式，便于扩展新的创建逻辑
 */

import { generateUUID4 } from '../utils/idGenerator'
import { UnifiedMediaItem } from './UnifiedMediaItem'
import type { MediaStatus, MediaTransitionContext } from './contexts/MediaTransitionContext'

// ==================== 创建选项类型 ====================

/**
 * 基础创建选项
 */
export interface BaseCreateOptions {
  onStatusChanged?: (
    oldStatus: MediaStatus,
    newStatus: MediaStatus,
    context?: MediaTransitionContext,
  ) => void
}

/**
 * 用户文件创建选项
 */
export interface UserFileCreateOptions extends BaseCreateOptions {
  // 可以添加用户文件特有的选项
}

/**
 * 远程文件创建选项
 */
export interface RemoteFileCreateOptions extends BaseCreateOptions {
  timeout?: number
  headers?: Record<string, string>
  retryCount?: number
}



/**
 * 批量创建选项
 */
export interface BatchCreateOptions extends BaseCreateOptions {
  concurrency?: number
  onProgress?: (completed: number, total: number) => void
  onItemCreated?: (item: UnifiedMediaItem, index: number) => void
}

// ==================== 工厂类 ====================

/**
 * 统一媒体项目工厂类
 *
 * 提供多种创建 UnifiedMediaItem 的方法，支持：
 * - 用户选择文件
 * - 远程URL文件
 * - 批量创建
 * - 自定义数据源
 */
export class UnifiedMediaItemFactory {
  
  // ==================== 用户文件创建 ====================

  /**
   * 从用户选择的文件创建媒体项目
   */
  static async fromUserSelectedFile(
    file: File,
    options?: UserFileCreateOptions
  ): Promise<UnifiedMediaItem> {
    console.log(`🏭 [UNIFIED-MEDIA] Factory.fromUserSelectedFile 开始创建: ${file.name}`)
    console.log(`🏭 [UNIFIED-MEDIA] 文件信息: 大小=${(file.size / 1024 / 1024).toFixed(2)}MB, 类型=${file.type}`)

    // 动态导入以避免循环依赖
    const { UserSelectedFileSource } = await import('./sources/UserSelectedFileSource')

    const itemId = generateUUID4()
    console.log(`🏭 [UNIFIED-MEDIA] 创建 UnifiedMediaItem: ${file.name} (ID: ${itemId})`)
    const item = new UnifiedMediaItem(
      itemId,
      file.name,
      null as any, // 临时占位，稍后设置
      {
        mediaType: 'unknown', // 将在处理过程中确定
        onStatusChanged: options?.onStatusChanged,
      }
    )

    console.log(`🏭 [UNIFIED-MEDIA] 创建 UserSelectedFileSource: ${file.name}`)
    const source = new UserSelectedFileSource(file, (source) => {
      console.log(`🔗 [UNIFIED-MEDIA] 数据源回调触发: ${file.name}`)
      item['handleSourceStatusChange'](source)
    })

    // 设置数据源
    item.source = source

    // 自动启动数据源获取过程
    console.log(`🏭 [UNIFIED-MEDIA] 启动数据源获取: ${file.name} (ID: ${itemId})`)
    source.startAcquisition()

    console.log(`🏭 [UNIFIED-MEDIA] Factory.fromUserSelectedFile 完成: ${file.name} (ID: ${itemId})`)
    return item
  }

  /**
   * 从文件列表批量创建媒体项目
   */
  static async fromFileList(
    files: FileList | File[],
    options?: BatchCreateOptions
  ): Promise<UnifiedMediaItem[]> {
    const fileArray = Array.from(files)
    const total = fileArray.length
    const concurrency = options?.concurrency || 5
    const results: UnifiedMediaItem[] = []
    
    // 分批处理以控制并发
    for (let i = 0; i < fileArray.length; i += concurrency) {
      const batch = fileArray.slice(i, i + concurrency)
      const batchPromises = batch.map(async (file, batchIndex) => {
        const item = await this.fromUserSelectedFile(file, {
          onStatusChanged: options?.onStatusChanged
        })
        
        const globalIndex = i + batchIndex
        options?.onItemCreated?.(item, globalIndex)
        
        return item
      })
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      // 报告进度
      options?.onProgress?.(results.length, total)
    }
    
    return results
  }

  // ==================== 远程文件创建 ====================

  /**
   * 从远程URL创建媒体项目
   */
  static async fromRemoteUrl(
    url: string,
    options?: RemoteFileCreateOptions
  ): Promise<UnifiedMediaItem> {
    // 动态导入以避免循环依赖
    const { RemoteFileSource } = await import('./sources/RemoteFileSource')
    
    const source = new RemoteFileSource(url, {
      timeout: options?.timeout || 30000,
      headers: options?.headers,
      retryCount: options?.retryCount || 3,
    })
    
    // 从URL提取文件名
    const fileName = this.extractFileNameFromUrl(url)
    
    const item = new UnifiedMediaItem(
      generateUUID4(),
      fileName,
      source,
      {
        mediaType: 'unknown', // 将在处理过程中确定
        onStatusChanged: options?.onStatusChanged,
      }
    )

    // 自动启动数据源获取过程
    source.startAcquisition()

    return item
  }

  /**
   * 从URL列表批量创建媒体项目
   */
  static async fromUrlList(
    urls: string[],
    options?: BatchCreateOptions & RemoteFileCreateOptions
  ): Promise<UnifiedMediaItem[]> {
    const total = urls.length
    const concurrency = options?.concurrency || 3 // 远程文件并发数较低
    const results: UnifiedMediaItem[] = []
    
    // 分批处理以控制并发
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency)
      const batchPromises = batch.map(async (url, batchIndex) => {
        const item = await this.fromRemoteUrl(url, {
          timeout: options?.timeout,
          headers: options?.headers,
          retryCount: options?.retryCount,
          onStatusChanged: options?.onStatusChanged
        })
        
        const globalIndex = i + batchIndex
        options?.onItemCreated?.(item, globalIndex)
        
        return item
      })
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      // 报告进度
      options?.onProgress?.(results.length, total)
    }
    
    return results
  }



  // ==================== 工具方法 ====================

  /**
   * 从URL提取文件名
   */
  private static extractFileNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const fileName = pathname.split('/').pop() || 'remote-file'
      
      // 如果没有扩展名，尝试从查询参数中获取
      if (!fileName.includes('.')) {
        const contentDisposition = urlObj.searchParams.get('filename')
        if (contentDisposition) {
          return contentDisposition
        }
      }
      
      return fileName
    } catch {
      // URL解析失败，使用默认名称
      return 'remote-file'
    }
  }

  /**
   * 验证文件类型是否支持
   */
  static isSupportedFileType(file: File): boolean {
    const supportedTypes = [
      // 视频类型
      'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov',
      // 音频类型
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac',
      // 图片类型
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'
    ]
    
    return supportedTypes.includes(file.type)
  }

  /**
   * 根据文件类型推断媒体类型
   */
  static inferMediaType(file: File): 'video' | 'audio' | 'image' | 'unknown' {
    if (file.type.startsWith('video/')) return 'video'
    if (file.type.startsWith('audio/')) return 'audio'
    if (file.type.startsWith('image/')) return 'image'
    return 'unknown'
  }
}

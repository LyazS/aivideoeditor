/**
 * 远程下载处理器
 * 负责处理网络文件下载，支持进度回调和取消操作
 */

import type { AsyncProcessor } from './AsyncProcessingManager'
import type { AsyncProcessingConfig, RemoteDownloadConfig } from '../types'

/**
 * 远程下载处理器实现
 */
export class RemoteDownloadProcessor implements AsyncProcessor {
  readonly type = 'remote-download' as const
  private abortController?: AbortController

  /**
   * 开始下载处理
   * @param config 下载配置
   * @param onProgress 进度回调
   * @returns 下载的文件对象
   */
  async process(
    config: AsyncProcessingConfig,
    onProgress: (progress: number) => void,
  ): Promise<File> {
    if (config.type !== 'remote-download') {
      throw new Error('Invalid config type for RemoteDownloadProcessor')
    }

    const downloadConfig = config as RemoteDownloadConfig
    console.log('🌐 [RemoteDownloadProcessor] 开始下载:', {
      url: downloadConfig.url,
      timeout: downloadConfig.timeout,
    })

    // 创建新的取消控制器
    this.abortController = new AbortController()

    try {
      // 设置超时
      const timeoutId = setTimeout(() => {
        if (this.abortController) {
          this.abortController.abort()
        }
      }, downloadConfig.timeout || 30000)

      // 发起网络请求
      const response = await fetch(downloadConfig.url, {
        signal: this.abortController.signal,
        method: 'GET',
        headers: {
          'User-Agent': 'AI Video Editor/1.0',
        },
      })

      // 清除超时定时器
      clearTimeout(timeoutId)

      // 检查响应状态
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // 获取内容长度
      const contentLength = response.headers.get('Content-Length')
      const totalSize = contentLength ? parseInt(contentLength, 10) : 0

      console.log('🌐 [RemoteDownloadProcessor] 响应信息:', {
        status: response.status,
        contentType: response.headers.get('Content-Type'),
        contentLength: totalSize,
        hasContentLength: !!contentLength,
      })

      // 获取文件名
      const filename = this.extractFilename(downloadConfig.url, response)

      // 读取响应流
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应流')
      }

      const chunks: Uint8Array[] = []
      let receivedSize = 0

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          if (value) {
            chunks.push(value)
            receivedSize += value.length

            // 计算并报告进度
            if (totalSize > 0) {
              const progress = Math.round((receivedSize / totalSize) * 100)
              onProgress(Math.min(progress, 99)) // 保留1%给文件创建
            } else {
              // 没有总大小信息时，使用模拟进度
              const simulatedProgress = Math.min(
                Math.round((receivedSize / (1024 * 1024)) * 10),
                90,
              )
              onProgress(simulatedProgress)
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      // 创建文件对象
      const blob = new Blob(chunks)
      const file = new File([blob], filename, {
        type: response.headers.get('Content-Type') || 'application/octet-stream',
      })

      console.log('✅ [RemoteDownloadProcessor] 下载完成:', {
        filename: file.name,
        size: file.size,
        type: file.type,
        receivedSize,
      })

      // 最终进度100%
      onProgress(100)

      return file
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          // 取消操作是正常行为，不需要打印错误日志
          console.log('🔄 [RemoteDownloadProcessor] 下载已取消')
          throw new Error('下载已取消')
        } else {
          // 只有真正的错误才打印错误日志
          console.error('❌ [RemoteDownloadProcessor] 下载失败:', error)

          if (error.message.includes('Failed to fetch')) {
            throw new Error('网络连接失败，请检查URL是否正确或网络连接')
          } else if (error.message.includes('HTTP')) {
            throw new Error(`服务器响应错误: ${error.message}`)
          } else {
            throw new Error(`下载失败: ${error.message}`)
          }
        }
      } else {
        console.error('❌ [RemoteDownloadProcessor] 下载失败:', error)
        throw new Error('下载过程中发生未知错误')
      }
    } finally {
      this.abortController = undefined
    }
  }

  /**
   * 取消下载
   */
  cancel(): void {
    console.log('🌐 [RemoteDownloadProcessor] 取消下载')

    if (this.abortController) {
      this.abortController.abort()
      this.abortController = undefined
    }
  }

  /**
   * 验证下载配置
   * @param config 处理配置
   * @returns 是否有效
   */
  validateConfig(config: AsyncProcessingConfig): boolean {
    if (config.type !== 'remote-download') {
      return false
    }

    const downloadConfig = config as RemoteDownloadConfig

    // 验证URL
    if (!downloadConfig.url || typeof downloadConfig.url !== 'string') {
      return false
    }

    try {
      const url = new URL(downloadConfig.url)
      // 只支持HTTP和HTTPS协议
      if (!['http:', 'https:'].includes(url.protocol)) {
        return false
      }
    } catch {
      return false
    }

    // 验证超时设置
    if (downloadConfig.timeout !== undefined) {
      if (typeof downloadConfig.timeout !== 'number' || downloadConfig.timeout <= 0) {
        return false
      }
    }

    return true
  }

  /**
   * 从URL和响应头中提取文件名
   * @param url 下载URL
   * @param response 响应对象
   * @returns 文件名
   */
  private extractFilename(url: string, response: Response): string {
    // 1. 尝试从Content-Disposition头获取文件名
    const contentDisposition = response.headers.get('Content-Disposition')
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (filenameMatch && filenameMatch[1]) {
        let filename = filenameMatch[1].replace(/['"]/g, '')
        // 解码URL编码的文件名
        try {
          filename = decodeURIComponent(filename)
        } catch {
          // 解码失败，使用原始文件名
        }
        if (filename) {
          return filename
        }
      }
    }

    // 2. 从URL路径中提取文件名
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const segments = pathname.split('/')
      const lastSegment = segments[segments.length - 1]

      if (lastSegment && lastSegment.includes('.')) {
        // 解码URL编码的文件名
        try {
          return decodeURIComponent(lastSegment)
        } catch {
          return lastSegment
        }
      }
    } catch {
      // URL解析失败
    }

    // 3. 根据Content-Type生成默认文件名
    const contentType = response.headers.get('Content-Type')
    const extension = this.getExtensionFromContentType(contentType)
    const timestamp = Date.now()

    return `download_${timestamp}${extension}`
  }

  /**
   * 根据Content-Type获取文件扩展名
   * @param contentType MIME类型
   * @returns 文件扩展名
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
}

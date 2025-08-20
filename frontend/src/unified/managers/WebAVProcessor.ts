/**
 * WebAV处理器
 * 专门负责WebAV相关的处理逻辑
 */

import type { UnifiedMediaItemData, MediaType, WebAVObjects } from '@/unified/mediaitem/types'
import { microsecondsToFrames, secondsToFrames } from '@/stores/utils/timeUtils'

/**
 * WebAV处理结果
 */
export interface WebAVProcessingResult {
  webavObjects: WebAVObjects
  duration: number
  thumbnailUrl: string
  metadata: {
    width: number
    height: number
    duration: number // 微秒
  }
}

/**
 * WebAV处理器
 * 负责处理WebAV相关的所有操作
 */
export class WebAVProcessor {
  /**
   * 处理媒体项目
   * @param mediaItem 媒体项目
   * @returns 处理结果
   */
  async processMedia(mediaItem: UnifiedMediaItemData): Promise<WebAVProcessingResult> {
    console.log(`🚀 [WebAVProcessor] 开始处理媒体: ${mediaItem.name} (${mediaItem.mediaType})`)

    if (!mediaItem.source.file || !mediaItem.source.url) {
      throw new Error('数据源未准备好')
    }

    // 使用工具函数
    const { createMP4Clip, createImgClip, createAudioClip } = await import('@/unified/utils/webavClipUtils')

    // 根据媒体类型创建对应的WebAV Clip
    let clip: any
    let thumbnailUrl: string

    switch (mediaItem.mediaType) {
      case 'video':
        clip = await createMP4Clip(mediaItem.source.file)
        thumbnailUrl = await this.generateVideoThumbnail(mediaItem.source.file)
        break
      case 'image':
        clip = await createImgClip(mediaItem.source.file)
        thumbnailUrl = mediaItem.source.url
        break
      case 'audio':
        clip = await createAudioClip(mediaItem.source.file)
        thumbnailUrl = await this.getAudioThumbnailUrl()
        break
      default:
        throw new Error(`不支持的媒体类型: ${mediaItem.mediaType}`)
    }

    // 等待clip准备完成
    const meta = await clip.ready

    // 创建WebAV对象
    const webavObjects: WebAVObjects = {
      thumbnailUrl,
      originalWidth: meta.width,
      originalHeight: meta.height,
    }

    // 根据媒体类型设置对应的clip
    if (mediaItem.mediaType === 'video') {
      webavObjects.mp4Clip = clip
    } else if (mediaItem.mediaType === 'image') {
      webavObjects.imgClip = clip
    } else if (mediaItem.mediaType === 'audio') {
      webavObjects.audioClip = clip
    }

    // 计算时长（帧数）
    let durationFrames: number
    if (mediaItem.mediaType === 'audio' || mediaItem.mediaType === 'video') {
      durationFrames = microsecondsToFrames(meta.duration)
    } else if (mediaItem.mediaType === 'image') {
      durationFrames = secondsToFrames(5) // 图片固定5秒
    } else {
      throw new Error(`无法计算时长: ${mediaItem.mediaType}`)
    }

    const result: WebAVProcessingResult = {
      webavObjects,
      duration: durationFrames,
      thumbnailUrl,
      metadata: {
        width: meta.width,
        height: meta.height,
        duration: meta.duration,
      },
    }

    console.log(`✅ [WebAVProcessor] 媒体处理完成: ${mediaItem.name}`)
    return result
  }

  /**
   * 创建指定类型的Clip
   * @param file 文件对象
   * @param mediaType 媒体类型
   * @returns Clip对象
   */
  async createClip(file: File, mediaType: MediaType): Promise<any> {
    const { createMP4Clip, createImgClip, createAudioClip } = await import('@/unified/utils/webavClipUtils')

    switch (mediaType) {
      case 'video':
        return createMP4Clip(file)
      case 'image':
        return createImgClip(file)
      case 'audio':
        return createAudioClip(file)
      default:
        throw new Error(`不支持的媒体类型: ${mediaType}`)
    }
  }

  /**
   * 生成视频缩略图
   * @param file 视频文件
   * @returns 缩略图URL
   */
  async generateVideoThumbnail(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        video.currentTime = 1 // 获取第1秒的帧
      }

      video.onseeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(URL.createObjectURL(blob))
              } else {
                reject(new Error('生成缩略图失败'))
              }
            },
            'image/jpeg',
            0.8,
          )
        }
      }

      video.onerror = () => reject(new Error('视频加载失败'))
      video.src = URL.createObjectURL(file)
    })
  }

  /**
   * 获取音频缩略图URL（使用默认图标）
   * @returns 音频缩略图URL
   */
  private async getAudioThumbnailUrl(): Promise<string> {
    const { AUDIO_DEFAULT_THUMBNAIL_URL } = await import('@/unified/constants/audioIcon')
    return AUDIO_DEFAULT_THUMBNAIL_URL
  }

  /**
   * 获取媒体元数据
   * @param file 文件对象
   * @param mediaType 媒体类型
   * @returns 媒体元数据
   */
  async getMediaMetadata(file: File, mediaType: MediaType): Promise<{
    width: number
    height: number
    duration: number
  }> {
    const clip = await this.createClip(file, mediaType)
    const meta = await clip.ready
    return {
      width: meta.width,
      height: meta.height,
      duration: meta.duration,
    }
  }

  /**
   * 验证媒体文件是否可以被WebAV处理
   * @param file 文件对象
   * @param mediaType 媒体类型
   * @returns 验证结果
   */
  async validateMediaFile(file: File, mediaType: MediaType): Promise<{
    isValid: boolean
    error?: string
    metadata?: {
      width: number
      height: number
      duration: number
    }
  }> {
    try {
      const clip = await this.createClip(file, mediaType)
      const meta = await clip.ready
      
      return {
        isValid: true,
        metadata: {
          width: meta.width,
          height: meta.height,
          duration: meta.duration,
        },
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : '未知错误',
      }
    }
  }

  /**
   * 清理WebAV资源
   * @param webavObjects WebAV对象
   */
  cleanupWebAVResources(webavObjects: WebAVObjects): void {
    // 清理缩略图URL
    if (webavObjects.thumbnailUrl) {
      URL.revokeObjectURL(webavObjects.thumbnailUrl)
    }

    // 清理Clip对象（如果需要）
    // 注意：WebAV Clip对象可能需要特定的清理方法
    console.log(`🧹 [WebAVProcessor] WebAV资源已清理`)
  }
}
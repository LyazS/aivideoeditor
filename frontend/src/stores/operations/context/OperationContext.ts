import type {
  TimelineService,
  CanvasService,
  TrackService,
  MediaService,
  WebAVService,
  ConfigService,
  TimelineItemData
} from './ServiceInterfaces'
import type { TimelineItem } from '../../../types/videoTypes'
import { VideoVisibleSprite } from '../../../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../../../utils/ImageVisibleSprite'
import { generateVideoThumbnail, generateImageThumbnail, canvasToBlob } from '../../../utils/thumbnailGenerator'
import { markRaw } from 'vue'

/**
 * 操作上下文
 * 提供操作执行所需的所有依赖和服务
 */
export class OperationContext {
  constructor(
    public readonly timeline: TimelineService,
    public readonly canvas: CanvasService,
    public readonly tracks: TrackService,
    public readonly media: MediaService,
    public readonly webav: WebAVService,
    public readonly config: ConfigService
  ) {}

  /**
   * 从原始素材创建sprite
   * 注意：这里的"原始素材"指的是已经解析好的MP4Clip/ImgClip，而不是二进制文件
   * 通过克隆已有的Clip来避免重复解析，大大提升性能
   */
  async createSprite(itemData: TimelineItemData): Promise<VideoVisibleSprite | ImageVisibleSprite> {
    const mediaItem = this.media.getItem(itemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`Media item not found: ${itemData.mediaItemId}`)
    }

    // 检查素材是否已经解析完成
    if (!mediaItem.isReady) {
      throw new Error(`Media item is not ready: ${itemData.mediaItemId}`)
    }

    let sprite: VideoVisibleSprite | ImageVisibleSprite

    if (mediaItem.mediaType === 'video') {
      if (!mediaItem.mp4Clip) {
        throw new Error(`MP4Clip not found for video: ${itemData.mediaItemId}`)
      }
      // 使用克隆方法，避免重新解析文件（性能优化）
      const clonedClip = await this.webav.cloneMP4Clip(mediaItem.mp4Clip)
      sprite = new VideoVisibleSprite(clonedClip)
    } else if (mediaItem.mediaType === 'image') {
      if (!mediaItem.imgClip) {
        throw new Error(`ImgClip not found for image: ${itemData.mediaItemId}`)
      }
      // 使用克隆方法，避免重新解析文件（性能优化）
      const clonedClip = await this.webav.cloneImgClip(mediaItem.imgClip)
      sprite = new ImageVisibleSprite(clonedClip)
    } else {
      throw new Error(`Unsupported media type: ${mediaItem.mediaType}`)
    }

    // 初始化sprite的默认属性（原始分辨率、初始位置等）
    this.initializeSpriteDefaults(sprite, itemData)

    // 应用变换属性（会覆盖默认属性）
    this.applyTransformToSprite(sprite, itemData)

    return sprite
  }

  /**
   * 创建时间轴项目
   */
  createTimelineItem(sprite: any, itemData: TimelineItemData): TimelineItem {
    const timelineItem: TimelineItem = {
      id: itemData.id,
      mediaItemId: itemData.mediaItemId,
      sprite: markRaw(sprite),
      trackId: itemData.trackId,
      mediaType: itemData.mediaType,
      timeRange: { ...itemData.timeRange },
      position: { ...itemData.position },
      size: { ...itemData.size },
      rotation: itemData.rotation,
      zIndex: itemData.zIndex,
      opacity: itemData.opacity,
      thumbnailUrl: itemData.thumbnailUrl,
      volume: itemData.volume || 1.0,
      isMuted: itemData.isMuted || false
    }

    return timelineItem
  }

  /**
   * 生成时间轴项目的缩略图
   */
  async generateThumbnail(itemData: TimelineItemData): Promise<string | undefined> {
    try {
      const mediaItem = this.media.getItem(itemData.mediaItemId)
      if (!mediaItem) {
        console.error('❌ 媒体项目不存在，无法生成缩略图')
        return undefined
      }

      console.log('🖼️ 生成时间轴clip缩略图...')
      let thumbnailCanvas: HTMLCanvasElement

      if (mediaItem.mediaType === 'video' && mediaItem.mp4Clip) {
        thumbnailCanvas = await generateVideoThumbnail(mediaItem.mp4Clip)
        console.log('✅ 时间轴视频缩略图生成成功')
      } else if (mediaItem.mediaType === 'image' && mediaItem.imgClip) {
        thumbnailCanvas = await generateImageThumbnail(mediaItem.imgClip)
        console.log('✅ 时间轴图片缩略图生成成功')
      } else {
        console.error('❌ 不支持的媒体类型或缺少对应的clip')
        return undefined
      }

      // 转换为Blob URL
      const thumbnailUrl = await canvasToBlob(thumbnailCanvas)
      return thumbnailUrl
    } catch (error) {
      console.error('❌ 时间轴缩略图生成失败:', error)
      // 缩略图生成失败不影响TimelineItem创建
      return undefined
    }
  }

  /**
   * 应用变换属性到sprite
   */
  private applyTransformToSprite(sprite: any, itemData: TimelineItemData): void {
    // 设置时间范围
    sprite.setTimeRange(itemData.timeRange)

    // 设置位置和大小 - 逐个设置属性而不是替换整个rect对象
    sprite.rect.x = itemData.position.x
    sprite.rect.y = itemData.position.y
    sprite.rect.w = itemData.size.width
    sprite.rect.h = itemData.size.height

    // 设置其他属性
    sprite.rotation = itemData.rotation
    sprite.opacity = itemData.opacity
    sprite.zIndex = itemData.zIndex

    // 设置音频属性（如果是视频）
    if (itemData.mediaType === 'video' && 'setVolume' in sprite) {
      sprite.setVolume(itemData.volume || 1.0)
      sprite.setMuted(itemData.isMuted || false)
    }
  }

  /**
   * 初始化新创建sprite的默认属性
   * 包括原始分辨率获取、初始位置设置等
   */
  private initializeSpriteDefaults(sprite: any, itemData: TimelineItemData): void {
    const mediaItem = this.media.getItem(itemData.mediaItemId)
    if (!mediaItem) return

    // 获取媒体的原始分辨率
    let originalResolution: { width: number; height: number }
    if (mediaItem.mediaType === 'video') {
      originalResolution = this.media.getVideoOriginalResolution(mediaItem.id)
    } else {
      originalResolution = this.media.getImageOriginalResolution(mediaItem.id)
    }

    // 设置初始尺寸为原始分辨率（缩放系数1.0）
    sprite.rect.w = originalResolution.width
    sprite.rect.h = originalResolution.height

    // 设置初始位置为画布中心
    const canvasWidth = this.config.videoResolution.value.width
    const canvasHeight = this.config.videoResolution.value.height
    sprite.rect.x = (canvasWidth - originalResolution.width) / 2
    sprite.rect.y = (canvasHeight - originalResolution.height) / 2

    console.log('初始化sprite默认属性:', {
      原始分辨率: originalResolution,
      显示尺寸: { w: sprite.rect.w, h: sprite.rect.h },
      WebAV位置: { x: sprite.rect.x, y: sprite.rect.y },
      画布尺寸: { w: canvasWidth, h: canvasHeight },
    })
  }
}

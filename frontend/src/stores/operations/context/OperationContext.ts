import type { 
  TimelineService, 
  CanvasService, 
  TrackService, 
  MediaService, 
  WebAVService,
  TimelineItemData
} from './ServiceInterfaces'
import type { TimelineItem } from '../../../types/videoTypes'
import { VideoVisibleSprite } from '../../../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../../../utils/ImageVisibleSprite'
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
    public readonly webav: WebAVService
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

    // 应用变换属性
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
   * 应用变换属性到sprite
   */
  private applyTransformToSprite(sprite: any, itemData: TimelineItemData): void {
    // 设置时间范围
    sprite.setTimeRange(itemData.timeRange)

    // 设置位置和大小
    sprite.rect = {
      x: itemData.position.x,
      y: itemData.position.y,
      w: itemData.size.width,
      h: itemData.size.height
    }

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
}

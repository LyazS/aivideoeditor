import type { MediaItem } from '../types'
import { VideoVisibleSprite } from './VideoVisibleSprite'
import { ImageVisibleSprite } from './ImageVisibleSprite'
import { useWebAVControls } from '../composables/useWebAVControls'
import { AudioVisibleSprite } from '../utils/AudioVisibleSprite'

/**
 * 从媒体项目创建对应的 Sprite 实例
 * 统一的工厂函数，避免在多个地方重复相同的创建逻辑
 *
 * @param mediaItem 媒体项目
 * @returns 创建的 Sprite 实例
 * @throws 当媒体项目未准备好或类型不支持时抛出错误
 */
export async function createSpriteFromMediaItem(
  mediaItem: MediaItem,
): Promise<VideoVisibleSprite | ImageVisibleSprite | AudioVisibleSprite> {
  // 检查媒体项目是否已准备好
  if (!mediaItem.isReady) {
    throw new Error(`素材尚未解析完成: ${mediaItem.name}`)
  }

  const webAVControls = useWebAVControls()

  if (mediaItem.mediaType === 'video') {
    if (!mediaItem.mp4Clip) {
      throw new Error(`视频素材解析失败，无法创建sprite: ${mediaItem.name}`)
    }
    const clonedMP4Clip = await webAVControls.cloneMP4Clip(mediaItem.mp4Clip)
    return new VideoVisibleSprite(clonedMP4Clip)
  } else if (mediaItem.mediaType === 'image') {
    if (!mediaItem.imgClip) {
      throw new Error(`图片素材解析失败，无法创建sprite: ${mediaItem.name}`)
    }
    const clonedImgClip = await webAVControls.cloneImgClip(mediaItem.imgClip)
    return new ImageVisibleSprite(clonedImgClip)
  } else if (mediaItem.mediaType === 'audio') {
    if (!mediaItem.audioClip) {
      throw new Error(`音频素材解析失败，无法创建sprite: ${mediaItem.name}`)
    }
    const clonedAudioClip = await webAVControls.cloneAudioClip(mediaItem.audioClip)
    return new AudioVisibleSprite(clonedAudioClip)
  } else {
    throw new Error(`不支持的媒体类型: ${mediaItem.mediaType}`)
  }
}

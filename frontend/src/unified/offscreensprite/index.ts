// ==================== 基础类和类型 ====================

// 导出基础 OffscreenSprite 类
export { BaseOffscreenSprite } from './BaseOffscreenSprite'

// ==================== 具体实现类 ====================

// 导出视频 OffscreenSprite 类和相关类型
export { VideoOffscreenSprite } from './VideoOffscreenSprite'
import { VideoOffscreenSprite } from './VideoOffscreenSprite'
export type { TAnimationKeyFrame } from './VideoOffscreenSprite'

// 导出图片 OffscreenSprite 类
export { ImageOffscreenSprite } from './ImageOffscreenSprite'
import { ImageOffscreenSprite } from './ImageOffscreenSprite'

// 导出文本 OffscreenSprite 类
export { TextOffscreenSprite } from './TextOffscreenSprite'
import { TextOffscreenSprite } from './TextOffscreenSprite'

// 导出音频 OffscreenSprite 类
export { AudioOffscreenSprite } from './AudioOffscreenSprite'
import { AudioOffscreenSprite } from './AudioOffscreenSprite'

// 导出统一的精灵类型
export type UnifiedOffscreenSprite =
  | VideoOffscreenSprite
  | ImageOffscreenSprite
  | TextOffscreenSprite
  | AudioOffscreenSprite

// ==================== 共享类型定义 ====================

// 导出所有类型接口
export type { 
  AudioState, 
  OffscreenSpriteCreateOptions, 
  OffscreenSpriteAnimationConfig 
} from './types'

// ==================== 工具函数 ====================

/**
 * 检查精灵是否为视频类型
 */
export function isVideoOffscreenSprite(sprite: UnifiedOffscreenSprite): sprite is VideoOffscreenSprite {
  return sprite instanceof VideoOffscreenSprite
}

/**
 * 检查精灵是否为图片类型
 */
export function isImageOffscreenSprite(sprite: UnifiedOffscreenSprite): sprite is ImageOffscreenSprite {
  return sprite instanceof ImageOffscreenSprite
}

/**
 * 检查精灵是否为文本类型
 */
export function isTextOffscreenSprite(sprite: UnifiedOffscreenSprite): sprite is TextOffscreenSprite {
  return sprite instanceof TextOffscreenSprite
}

/**
 * 检查精灵是否为音频类型
 */
export function isAudioOffscreenSprite(sprite: UnifiedOffscreenSprite): sprite is AudioOffscreenSprite {
  return sprite instanceof AudioOffscreenSprite
}

/**
 * 获取精灵的类型名称
 */
export function getOffscreenSpriteType(sprite: UnifiedOffscreenSprite): string {
  if (isVideoOffscreenSprite(sprite)) return 'video'
  if (isImageOffscreenSprite(sprite)) return 'image'
  if (isTextOffscreenSprite(sprite)) return 'text'
  if (isAudioOffscreenSprite(sprite)) return 'audio'
  return 'unknown'
}

/**
 * 批量设置精灵的时间范围
 */
export function setSpritesTimeRange(
  sprites: UnifiedOffscreenSprite[],
  timeRange: Partial<import('@/unified/types/timeRange').UnifiedTimeRange>
): void {
  sprites.forEach(sprite => {
    sprite.setTimeRange(timeRange)
  })
}

/**
 * 批量设置精灵的音频状态
 */
export function setSpritesAudioState(
  sprites: (VideoOffscreenSprite | AudioOffscreenSprite)[],
  audioState: Partial<import('./types').AudioState>
): void {
  sprites.forEach(sprite => {
    if ('setAudioState' in sprite) {
      // 确保传入完整的AudioState对象
      const fullAudioState: import('./types').AudioState = {
        volume: audioState.volume ?? 1,
        isMuted: audioState.isMuted ?? false
      }
      sprite.setAudioState(fullAudioState)
    }
  })
}
import { VideoVisibleSprite } from '../../utils/VideoVisibleSprite'
import { AudioVisibleSprite } from '../../utils/AudioVisibleSprite'
import { ImageVisibleSprite } from '../../utils/ImageVisibleSprite'
import { TextVisibleSprite } from '../../utils/TextVisibleSprite'
import type { CustomSprite } from '../../types'

/**
 * 类型守卫：检查 sprite 是否是 VideoVisibleSprite 类型
 * 替代 'setVolume' in sprite 或 'setMuted' in sprite 的属性检查
 *
 * @param sprite 要检查的 sprite 对象
 * @returns 如果是 VideoVisibleSprite 类型则返回 true
 */
export function isVideoVisibleSprite(sprite: CustomSprite): sprite is VideoVisibleSprite {
  return sprite instanceof VideoVisibleSprite
}

/**
 * 类型守卫：检查 sprite 是否是 AudioVisibleSprite 类型
 * 替代 'setGain' in sprite 的属性检查
 *
 * @param sprite 要检查的 sprite 对象
 * @returns 如果是 AudioVisibleSprite 类型则返回 true
 */
export function isAudioVisibleSprite(sprite: CustomSprite): sprite is AudioVisibleSprite {
  return sprite instanceof AudioVisibleSprite
}

/**
 * 类型守卫：检查 sprite 是否是 ImageVisibleSprite 类型
 *
 * @param sprite 要检查的 sprite 对象
 * @returns 如果是 ImageVisibleSprite 类型则返回 true
 */
export function isImageVisibleSprite(sprite: CustomSprite): sprite is ImageVisibleSprite {
  return sprite instanceof ImageVisibleSprite
}

/**
 * 类型守卫：检查 sprite 是否是 TextVisibleSprite 类型
 *
 * @param sprite 要检查的 sprite 对象
 * @returns 如果是 TextVisibleSprite 类型则返回 true
 */
export function isTextVisibleSprite(sprite: CustomSprite): sprite is TextVisibleSprite {
  return sprite instanceof TextVisibleSprite
}

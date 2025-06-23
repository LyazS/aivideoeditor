import { reactive, markRaw } from 'vue'
import { VideoVisibleSprite } from './VideoVisibleSprite'
import { ImageVisibleSprite } from './ImageVisibleSprite'
import { webavToProjectCoords, projectToWebavCoords } from './coordinateTransform'
import type {
  TimelineItem,
  TimelineItemBaseData,
  TimelineItemFactoryOptions
} from '../types/videoTypes'
import type { AnimationConfig } from '../types/animationTypes'

/**
 * 创建响应式TimelineItem的工厂函数
 * 🆕 实现双向数据流：UI ↔ Sprite ↔ Store
 * TimelineItem作为Sprite属性的响应式代理，支持propsChange事件同步
 *
 * @param baseData TimelineItem基础数据
 * @param sprite WebAV Sprite实例
 * @param options 工厂函数选项
 * @returns 响应式TimelineItem对象
 */
export function createReactiveTimelineItem(
  baseData: TimelineItemBaseData,
  sprite: VideoVisibleSprite | ImageVisibleSprite,
  options: TimelineItemFactoryOptions
): TimelineItem {
  const { videoResolution } = options

  // 🆕 简化架构：直接存储项目坐标系的值，通过propsChange事件同步
  const initialRect = sprite.rect
  const initialProjectCoords = webavToProjectCoords(
    initialRect.x,
    initialRect.y,
    initialRect.w,
    initialRect.h,
    videoResolution.width,
    videoResolution.height
  )

  return reactive({
    // 基础属性（不可变）
    ...baseData,
    sprite: markRaw(sprite), // 使用markRaw避免Vue响应式包装

    // 🆕 直接存储的响应式属性（项目坐标系）
    x: initialProjectCoords.x,
    y: initialProjectCoords.y,
    width: initialRect.w,
    height: initialRect.h,
    rotation: initialRect.angle || 0,
    opacity: sprite.opacity,
    zIndex: sprite.zIndex,

    // 音量属性（仅对视频有效）
    volume: baseData.mediaType === 'video' && sprite instanceof VideoVisibleSprite
      ? sprite.getVolume()
      : 1,

    // 静音属性（仅对视频有效）
    isMuted: baseData.mediaType === 'video' && sprite instanceof VideoVisibleSprite
      ? sprite.isMuted()
      : false,

    // 🆕 动画配置属性
    animationConfig: undefined as AnimationConfig | undefined
  }) as TimelineItem
}
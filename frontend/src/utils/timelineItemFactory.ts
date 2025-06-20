import { reactive, markRaw } from 'vue'
import { VideoVisibleSprite } from './VideoVisibleSprite'
import { ImageVisibleSprite } from './ImageVisibleSprite'
import { webavToProjectCoords, projectToWebavCoords } from './coordinateTransform'
import type {
  TimelineItem,
  TimelineItemBaseData,
  TimelineItemFactoryOptions
} from '../types/videoTypes'

/**
 * 创建响应式TimelineItem的工厂函数
 * 实现单向数据流：TimelineItem属性 → Sprite属性
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

  return reactive({
    // 基础属性（不可变）
    ...baseData,
    sprite: markRaw(sprite), // 使用markRaw避免Vue响应式包装

    // 位置属性（项目坐标系，中心为原点）
    get x(): number {
      const rect = sprite.rect
      return webavToProjectCoords(
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        videoResolution.width,
        videoResolution.height
      ).x
    },
    set x(value: number) {
      const currentY = this.y
      const webavCoords = projectToWebavCoords(
        value,
        currentY,
        sprite.rect.w,
        sprite.rect.h,
        videoResolution.width,
        videoResolution.height
      )
      sprite.rect.x = webavCoords.x
      sprite.rect.y = webavCoords.y
    },

    get y(): number {
      const rect = sprite.rect
      return webavToProjectCoords(
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        videoResolution.width,
        videoResolution.height
      ).y
    },
    set y(value: number) {
      const currentX = this.x
      const webavCoords = projectToWebavCoords(
        currentX,
        value,
        sprite.rect.w,
        sprite.rect.h,
        videoResolution.width,
        videoResolution.height
      )
      sprite.rect.x = webavCoords.x
      sprite.rect.y = webavCoords.y
    },

    // 尺寸属性（WebAV坐标系，直接映射）
    get width(): number {
      return sprite.rect.w
    },
    set width(value: number) {
      // 保持中心点不变的缩放
      const currentX = this.x
      const currentY = this.y
      sprite.rect.w = value
      
      // 重新计算位置以保持中心点
      const webavCoords = projectToWebavCoords(
        currentX,
        currentY,
        value,
        sprite.rect.h,
        videoResolution.width,
        videoResolution.height
      )
      sprite.rect.x = webavCoords.x
      sprite.rect.y = webavCoords.y
    },

    get height(): number {
      return sprite.rect.h
    },
    set height(value: number) {
      // 保持中心点不变的缩放
      const currentX = this.x
      const currentY = this.y
      sprite.rect.h = value
      
      // 重新计算位置以保持中心点
      const webavCoords = projectToWebavCoords(
        currentX,
        currentY,
        sprite.rect.w,
        value,
        videoResolution.width,
        videoResolution.height
      )
      sprite.rect.x = webavCoords.x
      sprite.rect.y = webavCoords.y
    },

    // 旋转属性（弧度）
    get rotation(): number {
      return sprite.rect.angle || 0
    },
    set rotation(value: number) {
      sprite.rect.angle = value
    },

    // 透明度属性
    get opacity(): number {
      return sprite.opacity
    },
    set opacity(value: number) {
      sprite.opacity = Math.max(0, Math.min(1, value))
    },

    // 层级属性
    get zIndex(): number {
      return sprite.zIndex
    },
    set zIndex(value: number) {
      sprite.zIndex = value
    },

    // 音量属性（仅对视频有效）
    get volume(): number {
      if (baseData.mediaType === 'video' && sprite instanceof VideoVisibleSprite) {
        return sprite.getVolume()
      }
      return 1
    },
    set volume(value: number) {
      if (baseData.mediaType === 'video' && sprite instanceof VideoVisibleSprite) {
        sprite.setVolume(Math.max(0, Math.min(1, value)))
      }
    },

    // 静音属性（仅对视频有效）
    get isMuted(): boolean {
      if (baseData.mediaType === 'video' && sprite instanceof VideoVisibleSprite) {
        return sprite.isMuted()
      }
      return false
    },
    set isMuted(value: boolean) {
      if (baseData.mediaType === 'video' && sprite instanceof VideoVisibleSprite) {
        sprite.setMuted(value)
      }
    }
  }) as TimelineItem
}
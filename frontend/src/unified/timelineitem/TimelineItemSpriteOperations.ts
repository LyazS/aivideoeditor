/**
 * 时间轴项目的Sprite操作方法
 *
 * 职责：
 * 1. 为时间轴项目提供Sprite的创建、销毁、更新操作
 * 2. 管理时间轴项目与Sprite的生命周期绑定
 * 3. 提供高级的Sprite操作接口
 * 4. 包含底层的数据转换和适配逻辑
 */

import type { Raw } from 'vue'
import type { AVCanvas } from '@webav/av-canvas'
import type { UnifiedMediaItemData } from '../mediaitem'
import type { UnifiedTimelineItemData, TransformData } from './TimelineItemData'
import type { BaseTimeRange, CustomSprite } from '../../types'
import { hasVisualProperties } from './TimelineItemQueries'

// 从旧架构导入Sprite类
import { VideoVisibleSprite } from '../../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../../utils/ImageVisibleSprite'
import { AudioVisibleSprite } from '../../utils/AudioVisibleSprite'

// ==================== 底层工具函数 ====================

/**
 * 为时间轴项目创建对应的Sprite
 * @param mediaData 媒体项目数据
 * @param timelineData 时间轴项目数据
 * @returns 创建的Sprite实例
 */
export function createSpriteForTimelineItem(
  mediaData: UnifiedMediaItemData,
  timelineData: UnifiedTimelineItemData
): Raw<CustomSprite> {
  const { mediaType, webav } = mediaData

  if (!webav) {
    throw new Error('媒体项目WebAV对象未就绪')
  }

  let sprite: Raw<CustomSprite>

  // 根据媒体类型创建对应的Sprite
  switch (mediaType) {
    case 'video':
      if (!webav.mp4Clip) throw new Error('视频WebAV对象缺失')
      sprite = new VideoVisibleSprite(webav.mp4Clip) as Raw<CustomSprite>
      break

    case 'image':
      if (!webav.imgClip) throw new Error('图片WebAV对象缺失')
      sprite = new ImageVisibleSprite(webav.imgClip) as Raw<CustomSprite>
      break

    case 'audio':
      if (!webav.audioClip) throw new Error('音频WebAV对象缺失')
      sprite = new AudioVisibleSprite(webav.audioClip) as Raw<CustomSprite>
      break

    default:
      throw new Error(`不支持的媒体类型: ${mediaType}`)
  }

  // 设置Sprite的基础属性
  setupSpriteProperties(sprite, timelineData)

  return sprite
}

/**
 * 设置Sprite的基础属性
 * @param sprite Sprite实例
 * @param timelineData 时间轴项目数据
 */
function setupSpriteProperties(
  sprite: Raw<CustomSprite>,
  timelineData: UnifiedTimelineItemData
): void {
  // 设置时间范围
  updateSpriteTimeRange(sprite, {
    timelineStartTime: timelineData.timeRange.timelineStartTime,
    timelineEndTime: timelineData.timeRange.timelineEndTime
  })

  // 设置基础变换属性（使用类型守卫）
  if (hasVisualProperties(timelineData)) {
    // 类型守卫确保了timelineData.config具有视觉属性
    const config = timelineData.config
    updateSpriteTransform(sprite, {
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      rotation: config.rotation
    })

    // 设置透明度
    sprite.opacity = config.opacity
  }
}

/**
 * 更新Sprite时间范围
 * @param sprite Sprite实例
 * @param timeRange 时间范围数据
 */
export function updateSpriteTimeRange(
  sprite: Raw<CustomSprite>,
  timeRange: BaseTimeRange
): void {
  // 根据Sprite类型调用相应的时间设置方法
  if (sprite instanceof VideoVisibleSprite) {
    sprite.setTimelineStartTime(timeRange.timelineStartTime)
    sprite.setTimelineEndTime(timeRange.timelineEndTime)
  } else if (sprite instanceof ImageVisibleSprite) {
    sprite.setTimelineStartTime(timeRange.timelineStartTime)
    // 图片需要计算显示时长
    const duration = timeRange.timelineEndTime - timeRange.timelineStartTime
    sprite.setDisplayDuration(duration)
  } else if (sprite instanceof AudioVisibleSprite) {
    sprite.setTimelineStartTime(timeRange.timelineStartTime)
    sprite.setTimelineEndTime(timeRange.timelineEndTime)
  }
}

/**
 * 更新Sprite变换属性
 * @param sprite Sprite实例
 * @param transform 变换数据
 */
export function updateSpriteTransform(
  sprite: Raw<CustomSprite>,
  transform: TransformData
): void {
  // 直接设置rect属性
  if (transform.x !== undefined) sprite.rect.x = transform.x
  if (transform.y !== undefined) sprite.rect.y = transform.y
  if (transform.width !== undefined) sprite.rect.w = transform.width
  if (transform.height !== undefined) sprite.rect.h = transform.height
  if (transform.rotation !== undefined) sprite.rect.angle = transform.rotation
}

/**
 * 更新Sprite透明度
 * @param sprite Sprite实例
 * @param opacity 透明度值 (0-1)
 */
export function updateSpriteOpacity(
  sprite: Raw<CustomSprite>,
  opacity: number
): void {
  sprite.opacity = opacity
}

/**
 * 批量更新Sprite属性
 * @param sprite Sprite实例
 * @param updates 要更新的属性
 */
export function updateSpriteProperties(
  sprite: Raw<CustomSprite>,
  updates: Partial<{
    timeRange: BaseTimeRange
    transform: TransformData
    opacity: number
  }>
): void {
  try {
    // 更新时间范围
    if (updates.timeRange) {
      updateSpriteTimeRange(sprite, updates.timeRange)
    }

    // 更新变换属性
    if (updates.transform) {
      updateSpriteTransform(sprite, updates.transform)
    }

    // 更新透明度
    if (updates.opacity !== undefined) {
      updateSpriteOpacity(sprite, updates.opacity)
    }

    console.log('✅ Sprite 属性已更新', updates)
  } catch (error) {
    console.error('❌ Sprite 属性更新失败', error)
    throw error
  }
}

/**
 * 将Sprite添加到AVCanvas
 * @param sprite Sprite实例
 * @param avCanvas AVCanvas实例
 */
export async function addSpriteToCanvas(
  sprite: Raw<CustomSprite>,
  avCanvas: Raw<AVCanvas>
): Promise<void> {
  await avCanvas.addSprite(sprite)
  console.log('✅ Sprite 已添加到 AVCanvas')
}

/**
 * 从AVCanvas移除Sprite
 * @param sprite Sprite实例
 * @param avCanvas AVCanvas实例
 */
export function removeSpriteFromCanvas(
  sprite: Raw<CustomSprite>,
  avCanvas: Raw<AVCanvas>
): void {
  avCanvas.removeSprite(sprite)
  console.log('🗑️ Sprite 已从 AVCanvas 移除')
}

// ==================== 高级操作接口 ====================

/**
 * 创建并设置Sprite
 * @param timelineData 时间轴项目数据
 * @param mediaData 媒体项目数据
 * @param avCanvas AVCanvas实例
 */
export async function createSpriteForTimelineData(
  timelineData: UnifiedTimelineItemData,
  mediaData: UnifiedMediaItemData,
  avCanvas: Raw<AVCanvas>
): Promise<void> {
  // 如果已有Sprite，先清理
  if (timelineData.sprite) {
    await destroySpriteForTimelineData(timelineData, avCanvas)
  }
  
  // 创建新的Sprite
  const sprite = createSpriteForTimelineItem(mediaData, timelineData)
  
  // 添加到AVCanvas
  await addSpriteToCanvas(sprite, avCanvas)
  
  // 设置引用
  timelineData.sprite = sprite
  
  console.log(`✅ 为时间轴项目 ${timelineData.id} 创建了Sprite`)
}

/**
 * 销毁Sprite
 * @param timelineData 时间轴项目数据
 * @param avCanvas AVCanvas实例
 */
export async function destroySpriteForTimelineData(
  timelineData: UnifiedTimelineItemData,
  avCanvas: Raw<AVCanvas>
): Promise<void> {
  if (!timelineData.sprite) return
  
  // 从AVCanvas移除
  removeSpriteFromCanvas(timelineData.sprite, avCanvas)
  
  // 清除引用
  timelineData.sprite = undefined
  
  console.log(`🗑️ 销毁了时间轴项目 ${timelineData.id} 的Sprite`)
}

/**
 * 更新Sprite属性
 * @param timelineData 时间轴项目数据
 * @param updates 要更新的属性
 */
export async function updateSpriteForTimelineData(
  timelineData: UnifiedTimelineItemData,
  updates: Partial<{
    timeRange: BaseTimeRange
    transform: TransformData
    opacity: number
  }>
): Promise<void> {
  if (!timelineData.sprite) return
  
  // 更新属性
  updateSpriteProperties(timelineData.sprite, updates)
  
  console.log(`✅ 更新了时间轴项目 ${timelineData.id} 的Sprite属性`)
}

/**
 * 检查时间轴项目是否有Sprite
 * @param timelineData 时间轴项目数据
 * @returns 是否有Sprite
 */
export function hasSprite(timelineData: UnifiedTimelineItemData): boolean {
  return !!timelineData.sprite
}

/**
 * 获取时间轴项目的Sprite
 * @param timelineData 时间轴项目数据
 * @returns Sprite实例或undefined
 */
export function getSprite(timelineData: UnifiedTimelineItemData) {
  return timelineData.sprite
}

/**
 * 批量创建多个时间轴项目的Sprite
 * @param timelineItems 时间轴项目数组
 * @param getMediaData 获取媒体数据的函数
 * @param avCanvas AVCanvas实例
 */
export async function createSpritesForTimelineItems(
  timelineItems: UnifiedTimelineItemData[],
  getMediaData: (mediaItemId: string) => UnifiedMediaItemData | undefined,
  avCanvas: Raw<AVCanvas>
): Promise<void> {
  for (const timelineItem of timelineItems) {
    const mediaData = getMediaData(timelineItem.mediaItemId)
    if (mediaData) {
      try {
        await createSpriteForTimelineData(timelineItem, mediaData, avCanvas)
      } catch (error) {
        console.error(`创建时间轴项目 ${timelineItem.id} 的Sprite失败:`, error)
      }
    }
  }
}

/**
 * 批量销毁多个时间轴项目的Sprite
 * @param timelineItems 时间轴项目数组
 * @param avCanvas AVCanvas实例
 */
export async function destroySpritesForTimelineItems(
  timelineItems: UnifiedTimelineItemData[],
  avCanvas: Raw<AVCanvas>
): Promise<void> {
  for (const timelineItem of timelineItems) {
    try {
      await destroySpriteForTimelineData(timelineItem, avCanvas)
    } catch (error) {
      console.error(`销毁时间轴项目 ${timelineItem.id} 的Sprite失败:`, error)
    }
  }
}

/**
 * 同步时间轴项目配置到Sprite
 * @param timelineData 时间轴项目数据
 */
export async function syncConfigToSprite(
  timelineData: UnifiedTimelineItemData
): Promise<void> {
  if (!timelineData.sprite) return
  
  const updates: Parameters<typeof updateSpriteForTimelineData>[1] = {}
  
  // 同步时间范围
  updates.timeRange = timelineData.timeRange
  
  // 同步变换属性（使用类型守卫）
  if (hasVisualProperties(timelineData)) {
    // 类型守卫确保了timelineData.config具有视觉属性
    const config = timelineData.config
    updates.transform = {
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
      rotation: config.rotation
    }

    // 同步透明度
    updates.opacity = config.opacity
  }
  
  await updateSpriteForTimelineData(timelineData, updates)
}

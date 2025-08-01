/**
 * 分割时间轴项目命令
 * 支持分割已知时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始素材重新创建
 */

import { generateCommandId } from '../../../utils/idGenerator'
import { framesToTimecode } from '../../utils/UnifiedTimeUtils'
import { cloneDeep } from 'lodash'
import { reactive, markRaw } from 'vue'
import type { VisibleSprite } from '@webav/av-cliper'
import type { SimpleCommand } from './types'

// ==================== 新架构类型导入 ====================
import type {
  UnifiedTimelineItemData,
  KnownTimelineItem,
  UnknownTimelineItem,
  TimelineItemStatus,
} from '../../timelineitem/TimelineItemData'

import type {
  UnifiedMediaItemData,
  MediaType,
  MediaTypeOrUnknown,
} from '../../mediaitem/types'

import type {
  VideoTimeRange,
  ImageTimeRange,
  VideoMediaConfig,
  ImageMediaConfig,
  TextMediaConfig,
  BaseMediaProps,
} from '../../../types'

// ==================== 新架构工具导入 ====================
import {
  createSpriteFromUnifiedMediaItem,
} from '../../utils/UnifiedSpriteFactory'

import { regenerateThumbnailForUnifiedTimelineItem } from '../../utils/thumbnailGenerator'

import {
  isKnownTimelineItem,
  isUnknownTimelineItem,
  hasVisualProperties,
  TimelineItemFactory,
} from '../../timelineitem'

import { UnifiedMediaItemQueries } from '../../mediaitem'

/**
 * 分割时间轴项目命令
 * 支持分割已知时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始素材重新创建
 */
export class SplitTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: UnifiedTimelineItemData<MediaTypeOrUnknown> // 保存原始项目的重建数据
  private firstItemId: string // 分割后第一个项目的ID
  private secondItemId: string // 分割后第二个项目的ID

  constructor(
    private originalTimelineItemId: string,
    originalTimelineItem: UnifiedTimelineItemData<MediaTypeOrUnknown>, // 要分割的原始时间轴项目
    private splitTimeFrames: number, // 分割时间点（帧数）
    private timelineModule: {
      addTimelineItem: (item: UnifiedTimelineItemData<MediaTypeOrUnknown>) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
    },
    private webavModule: {
      addSprite: (sprite: VisibleSprite) => Promise<boolean>
      removeSprite: (sprite: VisibleSprite) => boolean
    },
    private mediaModule: {
      getMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
  ) {
    this.id = generateCommandId()

    // 使用类型守卫来区分已知和未知项目
    if (isKnownTimelineItem(originalTimelineItem)) {
      // 已知项目处理逻辑
      const mediaItem = this.mediaModule.getMediaItem(originalTimelineItem.mediaItemId)
      this.description = `分割时间轴项目: ${mediaItem?.name || '未知素材'} (在 ${framesToTimecode(splitTimeFrames)})`

      // 保存原始项目的完整重建元数据 - 明确传入原始ID以避免重新生成
      this.originalTimelineItemData = TimelineItemFactory.clone(originalTimelineItem, { id: originalTimelineItem.id })
    } else if (isUnknownTimelineItem(originalTimelineItem)) {
      // 未知项目处理逻辑
      this.description = `分割未知处理项目: ${originalTimelineItem.config.name || '未知素材'} (在 ${framesToTimecode(splitTimeFrames)})`

      // 保存未知项目的完整数据（使用 lodash 深拷贝避免引用问题）
      this.originalTimelineItemData = cloneDeep(originalTimelineItem)
    } else {
      throw new Error('不支持的时间轴项目类型')
    }

    // 生成分割后项目的ID
    this.firstItemId = `timeline_item_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    this.secondItemId = `timeline_item_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    console.log('💾 保存分割项目的重建数据:', {
      originalId: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      mediaType: this.originalTimelineItemData.mediaType,
      splitTimeFrames: this.splitTimeFrames,
      timeRange: this.originalTimelineItemData.timeRange,
      firstItemId: this.firstItemId,
      secondItemId: this.secondItemId,
    })
  }

  /**
   * 从原始素材重建分割后的两个sprite和timelineItem
   * 遵循"从源头重建"原则，每次都完全重新创建
   */
  private async rebuildSplitItems(): Promise<{
    firstItem: UnifiedTimelineItemData<MediaTypeOrUnknown>
    secondItem: UnifiedTimelineItemData<MediaTypeOrUnknown>
  }> {
    console.log('🔄 开始从源头重建分割后的时间轴项目...')

    // 1. 获取原始素材
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`原始素材不存在: ${this.originalTimelineItemData.mediaItemId}`)
    }

    // 检查素材是否已准备好并且是支持分割的类型
    if (!UnifiedMediaItemQueries.isReady(mediaItem)) {
      throw new Error(`素材尚未解析完成: ${mediaItem.name}`)
    }

    // 2. 计算分割点的时间信息（直接使用帧数）
    const originalTimeRange = this.originalTimelineItemData.timeRange
    const timelineStartTimeFrames = originalTimeRange.timelineStartTime
    const timelineEndTimeFrames = originalTimeRange.timelineEndTime
    const splitTimeFrames = this.splitTimeFrames // 分割时间点（帧数）

    // 计算分割点在素材中的相对位置（使用帧数）
    const timelineDurationFrames = timelineEndTimeFrames - timelineStartTimeFrames
    const relativeTimelineFrames = splitTimeFrames - timelineStartTimeFrames
    const relativeRatio = relativeTimelineFrames / timelineDurationFrames

    // 3. 从原始素材重新创建两个sprite
    const firstSprite = await createSpriteFromUnifiedMediaItem(mediaItem)
    const secondSprite = await createSpriteFromUnifiedMediaItem(mediaItem)

    // 4. 设置时间范围
    if ('clipStartTime' in originalTimeRange) {
      // 视频和音频类型（使用 clipStartTime 和 clipEndTime）
      const videoTimeRange = originalTimeRange as VideoTimeRange
      const clipStartTimeFrames = videoTimeRange.clipStartTime || 0
      const clipEndTimeFrames = videoTimeRange.clipEndTime || mediaItem.duration || 0
      const clipDurationFrames = clipEndTimeFrames - clipStartTimeFrames
      const splitClipTimeFrames =
        clipStartTimeFrames + Math.round(clipDurationFrames * relativeRatio)

      firstSprite.setTimeRange({
        clipStartTime: clipStartTimeFrames,
        clipEndTime: splitClipTimeFrames,
        timelineStartTime: timelineStartTimeFrames,
        timelineEndTime: splitTimeFrames,
      })

      secondSprite.setTimeRange({
        clipStartTime: splitClipTimeFrames,
        clipEndTime: clipEndTimeFrames,
        timelineStartTime: splitTimeFrames,
        timelineEndTime: timelineEndTimeFrames,
      })
    } else {
      // 图片和文本类型（使用 displayDuration）
      const imageTimeRange = originalTimeRange as ImageTimeRange
      const displayDuration = imageTimeRange.displayDuration || timelineDurationFrames
      const firstDisplayDuration = Math.round(displayDuration * relativeRatio)
      const secondDisplayDuration = displayDuration - firstDisplayDuration

      firstSprite.setTimeRange({
        timelineStartTime: timelineStartTimeFrames,
        timelineEndTime: splitTimeFrames,
        displayDuration: firstDisplayDuration,
      })

      secondSprite.setTimeRange({
        timelineStartTime: splitTimeFrames,
        timelineEndTime: timelineEndTimeFrames,
        displayDuration: secondDisplayDuration,
      })
    }

    // 5. 应用变换属性
    if (hasVisualProperties(this.originalTimelineItemData)) {
      const config = this.originalTimelineItemData.config as
        | VideoMediaConfig
        | ImageMediaConfig
        | TextMediaConfig
      
      // 应用到第一个sprite
      if (config.x !== undefined) firstSprite.rect.x = config.x
      if (config.y !== undefined) firstSprite.rect.y = config.y
      if (config.width !== undefined) firstSprite.rect.w = config.width
      if (config.height !== undefined) firstSprite.rect.h = config.height
      if (config.rotation !== undefined) firstSprite.rect.angle = config.rotation
      if (config.opacity !== undefined) firstSprite.opacity = config.opacity

      // 应用到第二个sprite
      if (config.x !== undefined) secondSprite.rect.x = config.x
      if (config.y !== undefined) secondSprite.rect.y = config.y
      if (config.width !== undefined) secondSprite.rect.w = config.width
      if (config.height !== undefined) secondSprite.rect.h = config.height
      if (config.rotation !== undefined) secondSprite.rect.angle = config.rotation
      if (config.opacity !== undefined) secondSprite.opacity = config.opacity
    }

    // 安全地获取 zIndex，所有媒体类型的配置都应该有 zIndex 属性
    const config = this.originalTimelineItemData.config as BaseMediaProps
    firstSprite.zIndex = config.zIndex
    secondSprite.zIndex = config.zIndex

    // 6. 创建新的TimelineItem
    const firstItem = reactive({
      id: this.firstItemId,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: firstSprite.getTimeRange(),
      sprite: markRaw(firstSprite),
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation
        ? { ...this.originalTimelineItemData.animation }
        : undefined,
      timelineStatus: 'ready' as TimelineItemStatus,
    }) as KnownTimelineItem

    const secondItem = reactive({
      id: this.secondItemId,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: secondSprite.getTimeRange(),
      sprite: markRaw(secondSprite),
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation
        ? { ...this.originalTimelineItemData.animation }
        : undefined,
      timelineStatus: 'ready' as TimelineItemStatus,
    }) as KnownTimelineItem

    // 7. 重新生成缩略图（异步执行，不阻塞重建过程）
    this.regenerateThumbnailsForSplitItems(firstItem, secondItem, mediaItem)

    console.log('🔄 重建分割项目完成:', {
      firstItemId: firstItem.id,
      secondItemId: secondItem.id,
      splitTimeFrames: this.splitTimeFrames,
      firstTimeRange: firstItem.timeRange,
      secondTimeRange: secondItem.timeRange,
    })

    return { firstItem, secondItem }
  }

  /**
   * 从原始素材重建原始项目
   * 用于撤销分割操作
   */
  private async rebuildOriginalItem(): Promise<UnifiedTimelineItemData<MediaTypeOrUnknown>> {
    console.log('🔄 开始从源头重建原始时间轴项目...')

    // 1. 获取原始素材
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`原始素材不存在: ${this.originalTimelineItemData.mediaItemId}`)
    }

    // 确保素材已准备好
    if (!UnifiedMediaItemQueries.isReady(mediaItem)) {
      throw new Error(`素材尚未解析完成: ${mediaItem.name}`)
    }

    // 2. 从原始素材重新创建sprite
    const newSprite = await createSpriteFromUnifiedMediaItem(mediaItem)

    // 3. 设置原始时间范围
    newSprite.setTimeRange(this.originalTimelineItemData.timeRange)

    // 4. 应用变换属性
    if (hasVisualProperties(this.originalTimelineItemData)) {
      const config = this.originalTimelineItemData.config as
        | VideoMediaConfig
        | ImageMediaConfig
        | TextMediaConfig
      if (config.x !== undefined) newSprite.rect.x = config.x
      if (config.y !== undefined) newSprite.rect.y = config.y
      if (config.width !== undefined) newSprite.rect.w = config.width
      if (config.height !== undefined) newSprite.rect.h = config.height
      if (config.rotation !== undefined) newSprite.rect.angle = config.rotation
      if (config.opacity !== undefined) newSprite.opacity = config.opacity
    }

    // 安全地获取 zIndex，所有媒体类型的配置都应该有 zIndex 属性
    const config = this.originalTimelineItemData.config as BaseMediaProps
    newSprite.zIndex = config.zIndex

    // 5. 创建新的TimelineItem
    const newTimelineItem = reactive({
      id: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: newSprite.getTimeRange(),
      sprite: markRaw(newSprite),
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation
        ? { ...this.originalTimelineItemData.animation }
        : undefined,
      timelineStatus: 'ready' as TimelineItemStatus,
    }) as KnownTimelineItem

    // 6. 重新生成缩略图（异步执行，不阻塞重建过程）
    this.regenerateThumbnailForOriginalItem(newTimelineItem, mediaItem)

    console.log('🔄 重建原始项目完成:', {
      id: newTimelineItem.id,
      mediaType: mediaItem.mediaType,
      timeRange: this.originalTimelineItemData.timeRange,
    })

    return newTimelineItem
  }

  /**
   * 执行命令：分割时间轴项目
   */
  async execute(): Promise<void> {
    try {
      // 检查原始项目是否存在
      const originalItem = this.timelineModule.getTimelineItem(this.originalTimelineItemId)
      if (!originalItem) {
        console.warn(`⚠️ 原始时间轴项目不存在，无法分割: ${this.originalTimelineItemId}`)
        return
      }

      // 从原始素材重新创建分割后的两个项目
      const { firstItem, secondItem } = await this.rebuildSplitItems()

      // 1. 删除原始项目
      this.timelineModule.removeTimelineItem(this.originalTimelineItemId)

      // 2. 添加分割后的两个项目
      this.timelineModule.addTimelineItem(firstItem)
      this.timelineModule.addTimelineItem(secondItem)

      // 3. 添加sprite到WebAV画布
      if (isKnownTimelineItem(firstItem) && firstItem.sprite) {
        await this.webavModule.addSprite(firstItem.sprite)
      }
      if (isKnownTimelineItem(secondItem) && secondItem.sprite) {
        await this.webavModule.addSprite(secondItem.sprite)
      }

      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.log(
        `🔪 已分割时间轴项目: ${mediaItem?.name || '未知素材'} 在 ${framesToTimecode(this.splitTimeFrames)}`,
      )
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.error(`❌ 分割时间轴项目失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复原始项目，删除分割后的项目
   * 遵循"从源头重建"原则，从原始素材完全重新创建
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销分割操作：重建原始时间轴项目...`)

      // 1. 删除分割后的两个项目
      this.timelineModule.removeTimelineItem(this.firstItemId)
      this.timelineModule.removeTimelineItem(this.secondItemId)

      // 2. 从原始素材重新创建原始项目
      const originalItem = await this.rebuildOriginalItem()

      // 3. 添加原始项目到时间轴
      this.timelineModule.addTimelineItem(originalItem)

      // 4. 添加sprite到WebAV画布
      if (isKnownTimelineItem(originalItem) && originalItem.sprite) {
        await this.webavModule.addSprite(originalItem.sprite)
      }

      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.log(`↩️ 已撤销分割时间轴项目: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.error(`❌ 撤销分割时间轴项目失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }

  /**
   * 为重建的原始项目重新生成缩略图
   * @param timelineItem 重建的时间轴项目
   * @param mediaItem 对应的媒体项目
   */
  private async regenerateThumbnailForOriginalItem(
    timelineItem: KnownTimelineItem,
    mediaItem: UnifiedMediaItemData,
  ) {
    // 音频不需要缩略图
    if (mediaItem.mediaType === 'audio') {
      console.log('🎵 音频不需要缩略图，跳过生成')
      return
    }

    try {
      console.log('🖼️ 开始为重建的原始项目重新生成缩略图...')

      const thumbnailUrl = await regenerateThumbnailForUnifiedTimelineItem(timelineItem, mediaItem)

      if (thumbnailUrl) {
        // 在新架构中，缩略图可能存储在不同的位置
        // 这里暂时保留原有逻辑，需要根据实际实现调整
        console.log('✅ 重建原始项目缩略图生成完成')
      }
    } catch (error) {
      console.error('❌ 重建原始项目缩略图生成失败:', error)
    }
  }

  /**
   * 为分割后的两个项目重新生成缩略图
   * @param firstItem 第一个分割片段
   * @param secondItem 第二个分割片段
   * @param mediaItem 对应的媒体项目
   */
  private async regenerateThumbnailsForSplitItems(
    firstItem: KnownTimelineItem,
    secondItem: KnownTimelineItem,
    mediaItem: UnifiedMediaItemData,
  ) {
    // 音频不需要缩略图
    if (mediaItem.mediaType === 'audio') {
      console.log('🎵 音频不需要缩略图，跳过生成')
      return
    }

    try {
      console.log('🖼️ 开始为分割后的项目重新生成缩略图...')

      // 为第一个片段生成缩略图
      const firstThumbnailUrl = await regenerateThumbnailForUnifiedTimelineItem(
        firstItem,
        mediaItem,
      )
      if (firstThumbnailUrl) {
        console.log('✅ 第一个分割片段缩略图生成完成')
      }

      // 为第二个片段生成缩略图
      const secondThumbnailUrl = await regenerateThumbnailForUnifiedTimelineItem(
        secondItem,
        mediaItem,
      )
      if (secondThumbnailUrl) {
        console.log('✅ 第二个分割片段缩略图生成完成')
      }
    } catch (error) {
      console.error('❌ 分割项目缩略图生成失败:', error)
    }
  }
}
/**
 * 添加时间轴项目命令
 * 支持添加已知和未知时间轴项目的撤销/重做操作
 * 采用统一重建逻辑：每次执行都从原始素材重新创建sprite（已知项目）或重建占位符（未知项目）
 */

import { cloneDeep } from 'lodash'
import { reactive, markRaw } from 'vue'
import type { VisibleSprite } from '@webav/av-cliper'

// ==================== 新架构类型导入 ====================
import type { SimpleCommand } from './types'
import type {
  UnifiedTimelineItemData,
  KnownTimelineItem,
  UnknownTimelineItem,
  TimelineItemStatus,
} from '../../timelineitem/TimelineItemData'

import type { UnifiedMediaItemData, MediaType, MediaTypeOrUnknown } from '../../mediaitem/types'

// ==================== 新架构工具导入 ====================
import { createSpriteFromUnifiedMediaItem } from '../../utils/UnifiedSpriteFactory'

import { regenerateThumbnailForUnifiedTimelineItem } from '../../utils/thumbnailGenerator'

import {
  isKnownTimelineItem,
  isUnknownTimelineItem,
  isVideoTimelineItem,
  isImageTimelineItem,
  isTextTimelineItem,
  hasVisualProperties,
  TimelineItemFactory,
} from '../../timelineitem'

import { UnifiedMediaItemQueries } from '../../mediaitem'

// ==================== 旧架构类型工具导入 ====================
import type {
  VideoMediaConfig,
  ImageMediaConfig,
  AudioMediaConfig,
  TextMediaConfig,
  BaseMediaProps,
} from '../../../types'
import { generateCommandId } from '../../../utils/idGenerator'

/**
 * 添加时间轴项目命令
 * 支持添加已知和未知时间轴项目的撤销/重做操作
 * 采用统一重建逻辑：每次执行都从原始素材重新创建sprite（已知项目）或重建占位符（未知项目）
 */
export class AddTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: UnifiedTimelineItemData<MediaTypeOrUnknown> | null = null // 保存原始项目的重建数据

  constructor(
    timelineItem: UnifiedTimelineItemData<MediaTypeOrUnknown>,
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
    if (isKnownTimelineItem(timelineItem)) {
      // 已知项目处理逻辑
      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      this.description = `添加时间轴项目: ${mediaItem?.name || '未知素材'}`

      // 保存原始数据用于重建sprite - 明确传入原始ID以避免重新生成
      this.originalTimelineItemData = TimelineItemFactory.clone(timelineItem, {
        id: timelineItem.id,
      })
    } else if (isUnknownTimelineItem(timelineItem)) {
      // 未知项目处理逻辑
      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      this.description = `添加异步处理项目: ${mediaItem?.name || '未知素材'}`

      // 保存未知项目的完整数据（使用 lodash 深拷贝避免引用问题）
      this.originalTimelineItemData = cloneDeep(timelineItem)
    } else {
      throw new Error('不支持的时间轴项目类型')
    }
  }

  /**
   * 从原始素材重建完整的已知TimelineItem
   * 统一重建逻辑：每次都从原始素材完全重新创建
   */
  private async rebuildKnownTimelineItem(): Promise<KnownTimelineItem> {
    if (!this.originalTimelineItemData || !isKnownTimelineItem(this.originalTimelineItemData)) {
      throw new Error('已知时间轴项目数据不存在')
    }

    console.log('🔄 开始从源头重建已知时间轴项目...')

    // 1. 获取原始素材
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`原始素材不存在: ${this.originalTimelineItemData.mediaItemId}`)
    }

    // 确保素材已经解析完成
    if (!UnifiedMediaItemQueries.isReady(mediaItem)) {
      throw new Error(`素材尚未解析完成: ${mediaItem.name}`)
    }

    // 2. 从原始素材重新创建sprite
    const newSprite = await createSpriteFromUnifiedMediaItem(mediaItem)

    // 3. 设置时间范围
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

    // 5. 创建新的TimelineItem（先不设置缩略图）
    const newTimelineItem = reactive({
      id: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: newSprite.getTimeRange(),
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation
        ? { ...this.originalTimelineItemData.animation }
        : undefined,
      timelineStatus: 'ready' as TimelineItemStatus,
      runtime: {
        sprite: markRaw(newSprite)
      },
    }) as KnownTimelineItem

    // 6. 重新生成缩略图（异步执行，不阻塞重建过程）
    await this.regenerateThumbnailForAddedItem(newTimelineItem, mediaItem)

    console.log('🔄 重建已知时间轴项目完成:', {
      id: newTimelineItem.id,
      mediaType: mediaItem.mediaType,
      timeRange: this.originalTimelineItemData.timeRange,
      position: { x: newSprite.rect.x, y: newSprite.rect.y },
      size: { w: newSprite.rect.w, h: newSprite.rect.h },
    })

    return newTimelineItem
  }

  /**
   * 重建未知处理时间轴项目占位符
   * 不需要创建sprite，只需要重建占位符数据
   */
  private rebuildUnknownTimelineItem(): UnknownTimelineItem {
    if (!this.originalTimelineItemData || !isUnknownTimelineItem(this.originalTimelineItemData)) {
      throw new Error('未知时间轴项目数据不存在')
    }

    console.log('🔄 开始重建未知处理时间轴项目占位符...')

    // 使用 lodash 深拷贝确保完全独立的数据副本
    const newUnknownTimelineItem: UnknownTimelineItem = cloneDeep(this.originalTimelineItemData)

    console.log('🔄 重建未知处理时间轴项目完成:', {
      id: newUnknownTimelineItem.id,
      mediaType: newUnknownTimelineItem.mediaType,
      mediaItemId: newUnknownTimelineItem.mediaItemId,
      timeRange: newUnknownTimelineItem.timeRange,
    })

    return newUnknownTimelineItem
  }

  /**
   * 执行命令：添加时间轴项目
   * 统一重建逻辑：每次执行都从原始素材重新创建（已知项目）或重建占位符（未知项目）
   */
  async execute(): Promise<void> {
    try {
      if (this.originalTimelineItemData && isKnownTimelineItem(this.originalTimelineItemData)) {
        // 已知项目处理逻辑
        console.log(`🔄 执行添加操作：从源头重建已知时间轴项目...`)

        // 从原始素材重新创建TimelineItem和sprite
        const newTimelineItem = await this.rebuildKnownTimelineItem()

        // 1. 添加到时间轴
        this.timelineModule.addTimelineItem(newTimelineItem)

        // 2. 添加sprite到WebAV画布
        if (newTimelineItem.runtime.sprite) {
          await this.webavModule.addSprite(newTimelineItem.runtime.sprite)
        }

        console.log(`✅ 已添加已知时间轴项目: ${this.originalTimelineItemData.mediaItemId}`)
      } else if (
        this.originalTimelineItemData &&
        isUnknownTimelineItem(this.originalTimelineItemData)
      ) {
        // 未知项目处理逻辑
        console.log(`🔄 执行添加操作：重建未知处理时间轴项目占位符...`)

        // 重建未知处理时间轴项目占位符
        const newUnknownTimelineItem = this.rebuildUnknownTimelineItem()

        // 1. 添加到时间轴（未知项目不需要添加sprite到WebAV画布）
        this.timelineModule.addTimelineItem(newUnknownTimelineItem)

        console.log(`✅ 已添加未知处理时间轴项目: ${newUnknownTimelineItem.config.name}`)
      } else {
        throw new Error('没有有效的时间轴项目数据')
      }
    } catch (error) {
      const itemName = this.originalTimelineItemData?.mediaItemId || '未知项目'
      console.error(`❌ 添加时间轴项目失败: ${itemName}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：移除时间轴项目
   */
  async undo(): Promise<void> {
    try {
      if (this.originalTimelineItemData && isKnownTimelineItem(this.originalTimelineItemData)) {
        // 已知项目撤销逻辑
        const existingItem = this.timelineModule.getTimelineItem(this.originalTimelineItemData.id)
        if (!existingItem) {
          console.warn(`⚠️ 已知时间轴项目不存在，无法撤销: ${this.originalTimelineItemData.id}`)
          return
        }

        // 移除时间轴项目（这会自动处理sprite的清理）
        this.timelineModule.removeTimelineItem(this.originalTimelineItemData.id)
        const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
        console.log(`↩️ 已撤销添加已知时间轴项目: ${mediaItem?.name || '未知素材'}`)
      } else if (
        this.originalTimelineItemData &&
        isUnknownTimelineItem(this.originalTimelineItemData)
      ) {
        // 未知项目撤销逻辑
        const existingItem = this.timelineModule.getTimelineItem(this.originalTimelineItemData.id)
        if (!existingItem) {
          console.warn(`⚠️ 未知处理时间轴项目不存在，无法撤销: ${this.originalTimelineItemData.id}`)
          return
        }

        // 移除未知处理时间轴项目
        this.timelineModule.removeTimelineItem(this.originalTimelineItemData.id)
        const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
        console.log(`↩️ 已撤销添加未知处理时间轴项目: ${mediaItem?.name || '未知素材'}`)
      } else {
        console.warn('⚠️ 没有有效的时间轴项目数据，无法撤销')
      }
    } catch (error) {
      const itemName = this.originalTimelineItemData?.mediaItemId || '未知项目'
      console.error(`❌ 撤销添加时间轴项目失败: ${itemName}`, error)
      throw error
    }
  }

  /**
   * 为添加的项目重新生成缩略图
   * @param timelineItem 添加的时间轴项目
   * @param mediaItem 对应的媒体项目
   */
  private async regenerateThumbnailForAddedItem(
    timelineItem: KnownTimelineItem,
    mediaItem: UnifiedMediaItemData,
  ) {
    // 音频不需要缩略图
    if (mediaItem.mediaType === 'audio') {
      console.log('🎵 音频不需要缩略图，跳过生成')
      return
    }

    // 检查是否已经有缩略图，避免重复生成
    // 缩略图URL存储在runtime中
    if (timelineItem.runtime.thumbnailUrl) {
      console.log('✅ 项目已有缩略图，跳过重新生成')
      return
    }

    try {
      console.log('🖼️ 开始为添加的项目重新生成缩略图...')

      const thumbnailUrl = await regenerateThumbnailForUnifiedTimelineItem(timelineItem, mediaItem)

      if (thumbnailUrl) {
        console.log('✅ 添加项目缩略图生成完成，已存储到runtime')
      }
    } catch (error) {
      console.error('❌ 添加项目缩略图生成失败:', error)
    }
  }
}

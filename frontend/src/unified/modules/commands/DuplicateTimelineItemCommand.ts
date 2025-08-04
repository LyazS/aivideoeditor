/**
 * 复制时间轴项目命令
 * 支持复制已知和未知时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时删除复制的项目
 */

import { generateCommandId } from '../../../utils/idGenerator'
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
  isVideoTimelineItem,
  isAudioTimelineItem,
  hasVisualProperties,
  TimelineItemFactory,
} from '../../timelineitem'

import { UnifiedMediaItemQueries } from '../../mediaitem'

/**
 * 复制时间轴项目命令
 * 支持复制已知和未知时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时删除复制的项目
 */
export class DuplicateTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: UnifiedTimelineItemData<MediaTypeOrUnknown> | null = null // 保存原始项目的重建数据
  public readonly newTimelineItemId: string // 新创建的项目ID

  constructor(
    private originalTimelineItemId: string,
    originalTimelineItem: UnifiedTimelineItemData<MediaTypeOrUnknown>, // 支持已知和未知项目
    private newPositionFrames: number, // 新项目的时间位置（帧数）
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
      this.description = `复制时间轴项目: ${mediaItem?.name || '未知素材'}`

      // 保存原始项目的完整重建元数据 - 明确传入原始ID以避免重新生成
      this.originalTimelineItemData = TimelineItemFactory.clone(originalTimelineItem, { id: originalTimelineItem.id })
    } else if (isUnknownTimelineItem(originalTimelineItem)) {
      // 未知项目处理逻辑
      this.description = `复制未知处理项目: ${originalTimelineItem.config.name || '未知素材'}`

      // 保存未知项目的完整数据（使用 lodash 深拷贝避免引用问题）
      this.originalTimelineItemData = cloneDeep(originalTimelineItem)
    } else {
      throw new Error('不支持的时间轴项目类型')
    }

    // 生成新项目的ID
    this.newTimelineItemId = `timeline_item_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * 从原始素材重建复制的时间轴项目
   */
  private async rebuildDuplicatedItem(): Promise<UnifiedTimelineItemData<MediaTypeOrUnknown>> {
    if (this.originalTimelineItemData && isKnownTimelineItem(this.originalTimelineItemData)) {
      // 已知项目重建逻辑
      return this.rebuildKnownDuplicatedItem()
    } else if (
      this.originalTimelineItemData &&
      isUnknownTimelineItem(this.originalTimelineItemData)
    ) {
      // 未知项目重建逻辑
      return this.rebuildUnknownDuplicatedItem()
    } else {
      throw new Error('没有有效的时间轴项目数据')
    }
  }

  /**
   * 重建已知时间轴项目的复制
   */
  private async rebuildKnownDuplicatedItem(): Promise<KnownTimelineItem> {
    if (!this.originalTimelineItemData || !isKnownTimelineItem(this.originalTimelineItemData)) {
      throw new Error('已知时间轴项目数据不存在')
    }

    console.log('🔄 [DuplicateTimelineItemCommand] 重建已知时间轴项目...')

    // 1. 获取原始素材
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`找不到素材项目: ${this.originalTimelineItemData.mediaItemId}`)
    }

    // 确保素材已经解析完成
    if (!UnifiedMediaItemQueries.isReady(mediaItem)) {
      throw new Error('素材还在解析中，无法复制')
    }

    // 2. 从原始素材重新创建sprite
    const newSprite = await createSpriteFromUnifiedMediaItem(mediaItem)

    // 3. 设置时间范围（调整到新位置）
    const originalTimeRange = this.originalTimelineItemData.timeRange
    const originalDurationFrames =
      originalTimeRange.timelineEndTime - originalTimeRange.timelineStartTime
    const newTimelineStartTimeFrames = this.newPositionFrames
    const newTimelineEndTimeFrames = newTimelineStartTimeFrames + originalDurationFrames

    // 根据媒体类型设置时间范围
    if (
      isVideoTimelineItem(this.originalTimelineItemData) ||
      isAudioTimelineItem(this.originalTimelineItemData)
    ) {
      // 视频和音频类型：保持原有的clip时间范围
      newSprite.setTimeRange({
        ...originalTimeRange,
        timelineStartTime: newTimelineStartTimeFrames,
        timelineEndTime: newTimelineEndTimeFrames,
      })
    } else {
      // 图片和文本类型：clipStartTime和clipEndTime设置为-1
      newSprite.setTimeRange({
        timelineStartTime: newTimelineStartTimeFrames,
        timelineEndTime: newTimelineEndTimeFrames,
        clipStartTime: -1,
        clipEndTime: -1,
      })
    }

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
      id: this.newTimelineItemId,
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
    this.regenerateThumbnailForDuplicatedItem(newTimelineItem, mediaItem)

    console.log('✅ [DuplicateTimelineItemCommand] 已知时间轴项目重建完成')
    return newTimelineItem
  }

  /**
   * 重建未知处理时间轴项目的复制
   */
  private rebuildUnknownDuplicatedItem(): UnknownTimelineItem {
    if (!this.originalTimelineItemData || !isUnknownTimelineItem(this.originalTimelineItemData)) {
      throw new Error('未知时间轴项目数据不存在')
    }

    console.log('🔄 [DuplicateTimelineItemCommand] 重建未知处理时间轴项目...')

    // 使用 lodash 深拷贝确保完全独立的数据副本
    const newUnknownTimelineItem: UnknownTimelineItem = cloneDeep(this.originalTimelineItemData)

    // 更新新项目的属性
    // 注意：在统一架构中，我们需要创建一个新的对象而不是修改只读属性
    const updatedUnknownTimelineItem: UnknownTimelineItem = {
      ...newUnknownTimelineItem,
      id: this.newTimelineItemId,
      timeRange: {
        ...newUnknownTimelineItem.timeRange,
        timelineStartTime: this.newPositionFrames,
        timelineEndTime:
          this.newPositionFrames +
          (this.originalTimelineItemData.timeRange.timelineEndTime -
            this.originalTimelineItemData.timeRange.timelineStartTime),
      },
    }

    console.log('🔄 重建未知处理时间轴项目完成:', {
      id: newUnknownTimelineItem.id,
      mediaType: newUnknownTimelineItem.mediaType,
      mediaItemId: newUnknownTimelineItem.mediaItemId,
      timeRange: newUnknownTimelineItem.timeRange,
    })

    return updatedUnknownTimelineItem
  }

  /**
   * 执行命令：创建复制的时间轴项目
   * 遵循"从源头重建"原则，从原始素材完全重新创建
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行复制操作：从源头重建时间轴项目...`)

      // 从原始素材重新创建复制的TimelineItem和sprite
      const newTimelineItem = await this.rebuildDuplicatedItem()

      // 1. 添加到时间轴
      this.timelineModule.addTimelineItem(newTimelineItem)

      if (isKnownTimelineItem(newTimelineItem)) {
        // 已知项目处理逻辑
        // 2. 添加sprite到WebAV画布
        if (newTimelineItem.runtime.sprite) {
          await this.webavModule.addSprite(newTimelineItem.runtime.sprite)
        }

        console.log(
          `✅ 已复制已知时间轴项目: ${this.originalTimelineItemData?.mediaItemId || '未知素材'}`,
        )
      } else if (isUnknownTimelineItem(newTimelineItem)) {
        // 未知项目处理逻辑（不需要添加sprite）
        console.log(`✅ 已复制未知处理时间轴项目: ${newTimelineItem.config.name || '未知素材'}`)
      }
    } catch (error) {
      const itemName =
        this.originalTimelineItemData?.mediaItemId ||
        (this.originalTimelineItemData && isUnknownTimelineItem(this.originalTimelineItemData)
          ? this.originalTimelineItemData.config.name
          : '未知项目')
      console.error(`❌ 复制时间轴项目失败: ${itemName}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：删除复制的时间轴项目
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销复制操作：删除复制的时间轴项目...`)

      // 删除复制的时间轴项目
      this.timelineModule.removeTimelineItem(this.newTimelineItemId)

      if (this.originalTimelineItemData && isKnownTimelineItem(this.originalTimelineItemData)) {
        // 已知项目撤销日志
        const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
        console.log(`↩️ 已撤销复制已知时间轴项目: ${mediaItem?.name || '未知素材'}`)
      } else if (
        this.originalTimelineItemData &&
        isUnknownTimelineItem(this.originalTimelineItemData)
      ) {
        // 未知项目撤销日志
        console.log(
          `↩️ 已撤销复制未知处理时间轴项目: ${this.originalTimelineItemData.config.name || '未知素材'}`,
        )
      }
    } catch (error) {
      const itemName =
        this.originalTimelineItemData?.mediaItemId ||
        (this.originalTimelineItemData && isUnknownTimelineItem(this.originalTimelineItemData)
          ? this.originalTimelineItemData.config.name
          : '未知项目')
      console.error(`❌ 撤销复制时间轴项目失败: ${itemName}`, error)
      throw error
    }
  }

  /**
   * 为复制的项目重新生成缩略图
   * @param timelineItem 复制的时间轴项目
   * @param mediaItem 对应的媒体项目
   */
  private async regenerateThumbnailForDuplicatedItem(
    timelineItem: KnownTimelineItem,
    mediaItem: UnifiedMediaItemData,
  ) {
    // 音频不需要缩略图
    if (mediaItem.mediaType === 'audio') {
      console.log('🎵 音频不需要缩略图，跳过生成')
      return
    }

    try {
      console.log('🖼️ 开始为复制的项目重新生成缩略图...')

      const thumbnailUrl = await regenerateThumbnailForUnifiedTimelineItem(timelineItem, mediaItem)

      if (thumbnailUrl) {
        // 缩略图已存储到runtime.thumbnailUrl中
        // 这里暂时保留原有逻辑，需要根据实际实现调整
        console.log('✅ 复制项目缩略图生成完成')
      }
    } catch (error) {
      console.error('❌ 复制项目缩略图生成失败:', error)
    }
  }
}
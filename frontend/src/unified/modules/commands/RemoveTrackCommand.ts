import { generateCommandId } from '../../../utils/idGenerator'
import { reactive, markRaw, ref, type Ref } from 'vue'
import type { VisibleSprite } from '@webav/av-cliper'
import type { SimpleCommand } from './types'
import { cloneTimelineItem } from '../../timelineitem/TimelineItemFactory'

// 类型导入
import type {
  UnifiedTimelineItemData,
  KnownTimelineItem,
  UnknownTimelineItem,
  TimelineItemStatus,
  TransformData,
  TextMediaConfig,
} from '../../timelineitem/TimelineItemData'

import type {
  UnifiedMediaItemData,
  MediaStatus,
  MediaType,
  MediaTypeOrUnknown,
} from '../../mediaitem/types'

import type { UnifiedTrackData, UnifiedTrackType } from '../../track/TrackTypes'


// 工具导入
import {
  createSpriteFromUnifiedMediaItem,
  canCreateSpriteFromUnifiedMediaItem,
  createSpriteFromUnifiedTimelineItem,
} from '../../utils/UnifiedSpriteFactory'

import { regenerateThumbnailForUnifiedTimelineItem } from '../../utils/thumbnailGenerator'

import {
  isKnownTimelineItem,
  isUnknownTimelineItem,
  isReady,
  isLoading,
  hasError,
  getDuration,
  TimelineItemFactory,
} from '../../timelineitem'

import { UnifiedMediaItemQueries } from '../../mediaitem'
import { useTimelineMediaSync } from '../../composables/useTimelineMediaSync'

/**
 * 删除轨道命令
 * 支持删除轨道的撤销/重做操作，兼容已知和未知时间轴项目
 * 遵循"从源头重建"原则：保存轨道信息和所有受影响的时间轴项目信息，撤销时完全重建
 */
export class RemoveTrackCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private trackData: UnifiedTrackData // 保存被删除的轨道数据
  private affectedTimelineItems: UnifiedTimelineItemData<MediaType>[] = [] // 保存被删除的时间轴项目的重建元数据

  constructor(
    private trackId: string,
    private trackModule: {
      addTrack: (type: UnifiedTrackType, name?: string) => UnifiedTrackData
      removeTrack: (
        trackId: string,
        timelineItems: Ref<UnifiedTimelineItemData<MediaType>[]>,
        removeTimelineItemCallback?: (id: string) => void,
      ) => void
      getTrack: (trackId: string) => UnifiedTrackData | undefined
      tracks: { value: UnifiedTrackData[] }
    },
    private timelineModule: {
      addTimelineItem: (item: UnifiedTimelineItemData<MediaType>) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaType> | undefined
      timelineItems: Ref<UnifiedTimelineItemData<MediaType>[]>
    },
    private webavModule: {
      addSprite: (sprite: VisibleSprite) => Promise<boolean>
      removeSprite: (sprite: VisibleSprite) => boolean
    },
    private mediaModule: {
      getMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
    private configModule: {
      videoResolution: { value: { width: number; height: number } }
    },
  ) {
    this.id = generateCommandId()

    // 获取要删除的轨道信息
    const track = this.trackModule.getTrack(trackId)
    if (!track) {
      throw new Error(`找不到要删除的轨道: ${trackId}`)
    }

    this.trackData = { ...track }
    this.description = `删除轨道: ${track.name}`

    // 保存该轨道上所有时间轴项目的重建元数据
    const affectedItems = this.timelineModule.timelineItems.value.filter(
      (item) => item.trackId === trackId,
    )

    // 保存所有受影响的时间轴项目（新架构只支持已知类型）
    for (const item of affectedItems) {
      this.affectedTimelineItems.push(TimelineItemFactory.clone(item))
    }

    console.log(
      `📋 准备删除轨道: ${track.name}, 受影响的项目: ${this.affectedTimelineItems.length}个`,
    )
  }

  /**
   * 从原始素材重建时间轴项目
   */
  private async rebuildTimelineItem(
    itemData: UnifiedTimelineItemData<MediaType>,
  ): Promise<KnownTimelineItem> {
    // 特殊处理文本类型的时间轴项目
    if (itemData.mediaType === 'text') {
      return await this.rebuildTextTimelineItem(itemData as UnifiedTimelineItemData<'text'>)
    }

    // 使用新的统一函数从时间轴项目数据创建sprite
    const newSprite = await createSpriteFromUnifiedTimelineItem(itemData)

    // 创建新的TimelineItem
    const newTimelineItem = reactive({
      id: itemData.id,
      mediaItemId: itemData.mediaItemId,
      trackId: itemData.trackId,
      mediaType: itemData.mediaType,
      timeRange: newSprite.getTimeRange(),
      config: { ...itemData.config },
      animation: itemData.animation ? { ...itemData.animation } : undefined,
      timelineStatus: 'ready' as TimelineItemStatus,
      runtime: {
        sprite: markRaw(newSprite),
      },
    }) as KnownTimelineItem

    // 重新生成缩略图（异步执行，不阻塞重建过程）
    const mediaItem = this.mediaModule.getMediaItem(itemData.mediaItemId)
    if (mediaItem) {
      await this.regenerateThumbnailForRebuiltItem(newTimelineItem, mediaItem)
    }

    return newTimelineItem
  }

  /**
   * 为重建的项目重新生成缩略图
   * @param timelineItem 重建的时间轴项目
   * @param mediaItem 对应的媒体项目
   */
  private async regenerateThumbnailForRebuiltItem(
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
      console.log('🖼️ 开始为重建的项目重新生成缩略图...')

      const thumbnailUrl = await regenerateThumbnailForUnifiedTimelineItem(timelineItem, mediaItem)

      if (thumbnailUrl) {
        console.log('✅ 重建项目缩略图生成完成，已存储到runtime')
      }
    } catch (error) {
      console.error('❌ 重建项目缩略图生成失败:', error)
    }
  }

  /**
   * 重建文本时间轴项目
   */
  private async rebuildTextTimelineItem(
    itemData: UnifiedTimelineItemData<'text'>,
  ): Promise<KnownTimelineItem> {
    console.log('🔄 [RemoveTrackCommand] 重建文本时间轴项目...')

    // 从保存的配置中获取文本内容和样式
    const textConfig = itemData.config as TextMediaConfig
    const text = textConfig.text
    const style = textConfig.style

    console.log('📝 [RemoveTrackCommand] 文本重建参数:', {
      text: text.substring(0, 20) + '...',
      style,
      timeRange: itemData.timeRange,
    })

    // 动态导入TextVisibleSprite
    const { TextVisibleSprite } = await import('../../visiblesprite/TextVisibleSprite')

    // 重新创建文本精灵
    const newSprite = await TextVisibleSprite.create(text, style)

    // 设置时间范围
    newSprite.setTimeRange(itemData.timeRange)

    // 设置变换属性
    const rect = newSprite.rect
    rect.x = textConfig.x
    rect.y = textConfig.y
    rect.w = textConfig.width
    rect.h = textConfig.height
    rect.angle = textConfig.rotation
    newSprite.opacity = textConfig.opacity

    // 设置其他属性
    newSprite.zIndex = textConfig.zIndex

    // 创建新的TimelineItem
    const newTimelineItem = reactive({
      id: itemData.id,
      mediaItemId: '', // 文本项目不需要媒体库项目
      trackId: itemData.trackId,
      mediaType: 'text',
      timeRange: { ...itemData.timeRange },
      config: { ...itemData.config },
      animation: itemData.animation ? { ...itemData.animation } : undefined,
      timelineStatus: 'ready' as TimelineItemStatus,
      runtime: {
        sprite: markRaw(newSprite),
      },
    }) as KnownTimelineItem

    console.log('✅ [RemoveTrackCommand] 文本时间轴项目重建完成')
    return newTimelineItem
  }

  /**
   * 执行命令：删除轨道及其上的所有时间轴项目
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行删除轨道操作: ${this.trackData.name}...`)

      // 检查是否为最后一个轨道
      if (this.trackModule.tracks.value.length <= 1) {
        throw new Error('不能删除最后一个轨道')
      }

      // 检查轨道是否存在
      const track = this.trackModule.getTrack(this.trackId)
      if (!track) {
        console.warn(`⚠️ 轨道不存在，无法删除: ${this.trackId}`)
        return
      }

      // 删除轨道（这会自动删除轨道上的所有时间轴项目）
      this.trackModule.removeTrack(
        this.trackId,
        this.timelineModule.timelineItems,
        this.timelineModule.removeTimelineItem,
      )

      console.log(
        `✅ 已删除轨道: ${this.trackData.name}, 删除了 ${this.affectedTimelineItems.length} 个时间轴项目`,
      )
    } catch (error) {
      console.error(`❌ 删除轨道失败: ${this.trackData.name}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：重建轨道和所有受影响的时间轴项目
   * 遵循"从源头重建"原则，从原始素材完全重新创建所有项目
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销删除轨道操作：重建轨道 ${this.trackData.name}...`)

      // 1. 重建轨道
      // 注意：我们需要手动重建轨道，保持原有的ID和属性
      // 找到正确的插入位置（按ID排序）
      const tracks = this.trackModule.tracks.value
      const insertIndex = tracks.findIndex((track) => track.id > this.trackData.id)
      if (insertIndex === -1) {
        tracks.push({ ...this.trackData })
      } else {
        tracks.splice(insertIndex, 0, { ...this.trackData })
      }

      // 2. 重建所有受影响的时间轴项目
      for (const itemData of this.affectedTimelineItems) {
        console.log(`🔄 重建时间轴项目: ${itemData.id}`)

        const newTimelineItem = await this.rebuildTimelineItem(itemData)

        // 添加到时间轴
        this.timelineModule.addTimelineItem(newTimelineItem)

        // 添加sprite到WebAV画布
        if (newTimelineItem.runtime.sprite) {
          await this.webavModule.addSprite(newTimelineItem.runtime.sprite)
        }

        // 为loading状态的项目设置媒体同步
        const mediaItem = this.mediaModule.getMediaItem(newTimelineItem.mediaItemId)
        if (mediaItem) {
          const { setupMediaSyncIfNeeded } = useTimelineMediaSync()
          setupMediaSyncIfNeeded(newTimelineItem, mediaItem)
        }
      }

      console.log(
        `↩️ 已撤销删除轨道: ${this.trackData.name}, 恢复了 ${this.affectedTimelineItems.length} 个时间轴项目`,
      )
    } catch (error) {
      console.error(`❌ 撤销删除轨道失败: ${this.trackData.name}`, error)
      throw error
    }
  }
}

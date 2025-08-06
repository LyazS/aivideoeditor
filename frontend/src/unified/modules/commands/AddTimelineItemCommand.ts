/**
 * 添加时间轴项目命令
 * 支持添加已知和未知时间轴项目的撤销/重做操作
 * 采用统一重建逻辑：每次执行都从原始素材重新创建sprite（已知项目）或重建占位符（未知项目）
 */

import { reactive, markRaw } from 'vue'
import type { VisibleSprite } from '@webav/av-cliper'
import { cloneTimelineItem } from '../../timelineitem/TimelineItemFactory'

// ==================== 新架构类型导入 ====================
import type { SimpleCommand } from './types'
import type {
  UnifiedTimelineItemData,
  KnownTimelineItem,
  TimelineItemStatus,
  VideoMediaConfig,
  ImageMediaConfig,
  AudioMediaConfig,
  TextMediaConfig,
} from '../../timelineitem/TimelineItemData'

import type { UnifiedMediaItemData, MediaType, MediaTypeOrUnknown } from '../../mediaitem/types'

// ==================== 新架构工具导入 ====================
import {
  createSpriteFromUnifiedMediaItem,
  createSpriteFromUnifiedTimelineItem,
} from '../../utils/UnifiedSpriteFactory'
import { useTimelineMediaSync } from '../../composables/useTimelineMediaSync'

import { regenerateThumbnailForUnifiedTimelineItem } from '../../utils/thumbnailGenerator'

import { isKnownTimelineItem, isUnknownTimelineItem, TimelineItemFactory } from '../../timelineitem'

import { UnifiedMediaItemQueries } from '../../mediaitem'

// ==================== 旧架构类型工具导入 ====================
import { generateCommandId } from '../../../utils/idGenerator'

/**
 * 添加时间轴项目命令
 * 支持添加已知和未知时间轴项目的撤销/重做操作
 * 采用统一重建逻辑：每次执行都从原始素材重新创建sprite（已知项目）或重建占位符（未知项目）
 */
export class AddTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: UnifiedTimelineItemData<MediaType> | null = null // 保存原始项目的重建数据

  constructor(
    timelineItem: UnifiedTimelineItemData<MediaType>,
    private timelineModule: {
      addTimelineItem: (item: UnifiedTimelineItemData<MediaType>) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaType> | undefined
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

    // 新架构只支持已知媒体类型
    const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
    this.description = `添加时间轴项目: ${mediaItem?.name || '未知素材'}`

    // 保存原始数据用于重建sprite
    this.originalTimelineItemData = TimelineItemFactory.clone(timelineItem)
  }

  /**
   * 从原始素材重建完整的已知TimelineItem
   * 统一重建逻辑：每次都从原始素材完全重新创建
   */
  private async rebuildKnownTimelineItem(): Promise<KnownTimelineItem> {
    if (!this.originalTimelineItemData) {
      throw new Error('时间轴项目数据不存在')
    }

    console.log('🔄 开始从源头重建已知时间轴项目...')

    // 1. 获取原始素材
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`原始素材不存在: ${this.originalTimelineItemData.mediaItemId}`)
    }

    // 检查素材状态和重建条件
    const isReady = UnifiedMediaItemQueries.isReady(mediaItem)
    const hasError = UnifiedMediaItemQueries.hasError(mediaItem)

    // 只阻止错误状态的素材
    if (hasError) {
      throw new Error(`素材解析失败，无法重建时间轴项目: ${mediaItem.name}`)
    }

    // 检查媒体类型和时长
    if (mediaItem.mediaType === 'unknown') {
      throw new Error(`素材类型未确定，无法重建时间轴项目: ${mediaItem.name}`)
    }

    const availableDuration = mediaItem.duration
    if (!availableDuration || availableDuration <= 0) {
      throw new Error(`素材时长信息不可用，无法重建时间轴项目: ${mediaItem.name}`)
    }

    // 根据素材状态确定时间轴项目状态
    const timelineStatus: TimelineItemStatus = isReady ? 'ready' : 'loading'

    if (isReady) {
      // Ready素材：创建包含sprite的完整时间轴项目
      console.log('✅ [AddTimelineItemCommand] 重建ready状态时间轴项目')

      // 2. 使用新的统一函数从时间轴项目数据创建sprite
      const newSprite = await createSpriteFromUnifiedTimelineItem(this.originalTimelineItemData)

      // 3. 创建新的TimelineItem（先不设置缩略图）
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
        timelineStatus: timelineStatus,
        runtime: {
          sprite: markRaw(newSprite),
        },
      }) as KnownTimelineItem

      // 4. 重新生成缩略图（异步执行，不阻塞重建过程）
      await this.regenerateThumbnailForAddedItem(newTimelineItem, mediaItem)

      console.log('🔄 重建ready状态时间轴项目完成:', {
        id: newTimelineItem.id,
        mediaType: mediaItem.mediaType,
        timeRange: this.originalTimelineItemData.timeRange,
        position: { x: newSprite.rect.x, y: newSprite.rect.y },
        size: { w: newSprite.rect.w, h: newSprite.rect.h },
      })

      return newTimelineItem
    } else {
      // 未Ready素材：创建loading状态的时间轴项目
      console.log('⏳ [AddTimelineItemCommand] 重建loading状态时间轴项目')

      // 创建loading状态的时间轴项目
      const newTimelineItem = reactive({
        id: this.originalTimelineItemData.id,
        mediaItemId: this.originalTimelineItemData.mediaItemId,
        trackId: this.originalTimelineItemData.trackId,
        mediaType: this.originalTimelineItemData.mediaType,
        timeRange: { ...this.originalTimelineItemData.timeRange },
        config: { ...this.originalTimelineItemData.config },
        animation: this.originalTimelineItemData.animation
          ? { ...this.originalTimelineItemData.animation }
          : undefined,
        timelineStatus: timelineStatus,
        runtime: {}, // loading状态暂时没有sprite
      }) as KnownTimelineItem

      // 注意：状态同步监听将在execute方法中设置，确保时间轴项目已添加到store

      console.log('🔄 重建loading状态时间轴项目完成:', {
        id: newTimelineItem.id,
        mediaType: mediaItem.mediaType,
        timeRange: this.originalTimelineItemData.timeRange,
        status: 'loading',
      })

      return newTimelineItem
    }
  }

  // 注意：新架构不再支持未知类型的时间轴项目，移除 rebuildUnknownTimelineItem 方法

  /**
   * 执行命令：添加时间轴项目
   * 统一重建逻辑：每次执行都从原始素材重新创建（已知项目）或重建占位符（未知项目）
   */
  async execute(): Promise<void> {
    try {
      if (!this.originalTimelineItemData) {
        throw new Error('没有有效的时间轴项目数据')
      }

      console.log(`🔄 执行添加操作：从源头重建时间轴项目...`)

      // 从原始素材重新创建TimelineItem和sprite
      const newTimelineItem = await this.rebuildKnownTimelineItem()

      // 1. 添加到时间轴
      this.timelineModule.addTimelineItem(newTimelineItem)

      // 2. 添加sprite到WebAV画布
      if (newTimelineItem.runtime.sprite) {
        await this.webavModule.addSprite(newTimelineItem.runtime.sprite)
      }

      // 3. 针对loading状态的项目设置状态同步（确保时间轴项目已添加到store）
      if (newTimelineItem.timelineStatus === 'loading') {
        const mediaItem = this.mediaModule.getMediaItem(newTimelineItem.mediaItemId)
        if (mediaItem) {
          this.setupMediaSyncForLoadingItem(newTimelineItem, mediaItem)
        }
      }

      console.log(`✅ 已添加时间轴项目: ${this.originalTimelineItemData.mediaItemId}`)
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
      if (!this.originalTimelineItemData) {
        console.warn('⚠️ 没有有效的时间轴项目数据，无法撤销')
        return
      }

      const existingItem = this.timelineModule.getTimelineItem(this.originalTimelineItemData.id)
      if (!existingItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法撤销: ${this.originalTimelineItemData.id}`)
        return
      }

      // 先清理监听器
      if (existingItem.runtime.unwatchMediaSync) {
        existingItem.runtime.unwatchMediaSync()
        existingItem.runtime.unwatchMediaSync = undefined
        console.log(`🗑️ [AddTimelineItemCommand.undo] 已清理监听器: ${existingItem.id}`)
      }

      // 移除时间轴项目（这会自动处理sprite的清理）
      this.timelineModule.removeTimelineItem(this.originalTimelineItemData.id)
      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.log(`↩️ 已撤销添加时间轴项目: ${mediaItem?.name || '未知素材'}`)
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

  /**
   * 为loading状态的时间轴项目设置媒体状态同步
   * @param timelineItem loading状态的时间轴项目
   * @param mediaItem 对应的媒体项目
   */
  private setupMediaSyncForLoadingItem(
    timelineItem: KnownTimelineItem,
    mediaItem: UnifiedMediaItemData,
  ): void {
    try {
      const { setupMediaSync } = useTimelineMediaSync()
      // 传递this（命令实例）给setupMediaSync
      const unwatch = setupMediaSync(timelineItem.id, mediaItem.id, this)

      if (unwatch) {
        console.log(
          `🔗 [AddTimelineItemCommand] 已设置状态同步: ${timelineItem.id} <-> ${mediaItem.id}`,
        )

        // 保存监听器清理函数到时间轴项目的runtime中
        timelineItem.runtime.unwatchMediaSync = unwatch
        console.log(`💾 [AddTimelineItemCommand] 已保存监听器到runtime: ${timelineItem.id}`)
      } else {
        console.warn(
          `⚠️ [AddTimelineItemCommand] 无法设置状态同步: ${timelineItem.id} <-> ${mediaItem.id}`,
        )
      }
    } catch (error) {
      console.error(`❌ [AddTimelineItemCommand] 设置状态同步失败:`, error)
    }
  }

  /**
   * 更新保存的原始时间轴项目时长和状态
   * 当素材从loading状态转换为ready状态时，时长可能会发生变化，需要更新保存的时长数据
   * 同时更新timelineStatus为传入的状态，并更新config中的原始分辨率信息
   * @param duration 新的时长
   * @param timelineStatus 新的时间轴状态
   * @param updatedConfig 更新后的配置信息（可选，用于更新原始分辨率等信息）
   */
  public updateOriginalTimelineItemData(
    duration: number,
    timelineStatus: TimelineItemStatus,
    updatedConfig?: Partial<
      VideoMediaConfig | ImageMediaConfig | AudioMediaConfig | TextMediaConfig
    >,
  ): void {
    if (!this.originalTimelineItemData) {
      console.warn('⚠️ [AddTimelineItemCommand] 没有原始时间轴项目数据，无法更新时长')
      return
    }

    const oldDuration =
      this.originalTimelineItemData.timeRange.timelineEndTime -
      this.originalTimelineItemData.timeRange.timelineStartTime

    console.log('🔄 [AddTimelineItemCommand] 更新原始时间轴项目时长和配置', {
      oldDuration,
      newDuration: duration,
      timelineStatus,
      mediaType: this.originalTimelineItemData.mediaType,
      hasUpdatedConfig: !!updatedConfig,
    })

    // 更新时间范围的结束时间，保持开始时间不变
    this.originalTimelineItemData.timeRange.timelineEndTime =
      this.originalTimelineItemData.timeRange.timelineStartTime + duration
    this.originalTimelineItemData.timeRange.clipEndTime = duration

    // 更新状态为传入的状态
    this.originalTimelineItemData.timelineStatus = timelineStatus

    // 如果提供了更新的配置信息，则更新config
    if (updatedConfig) {
      console.log('🔄 [AddTimelineItemCommand] 应用更新的配置信息', updatedConfig)

      // 合并更新的配置到原始配置中
      Object.assign(this.originalTimelineItemData.config, updatedConfig)

      console.log('✅ [AddTimelineItemCommand] 配置信息已更新')
    }

    console.log('✅ [AddTimelineItemCommand] 原始时间轴项目时长、状态和配置更新完成', {
      timelineStatus: this.originalTimelineItemData.timelineStatus,
    })
  }
}

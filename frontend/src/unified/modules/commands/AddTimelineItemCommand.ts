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
import { setupCommandMediaSync, cleanupCommandMediaSync } from '../../composables/useCommandMediaSync'

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
  private _isDisposed = false

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
        setupCommandMediaSync(this.id, newTimelineItem.mediaItemId, newTimelineItem.id)
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
   * 更新媒体数据（由媒体同步调用）
   * @param mediaData 最新的媒体数据
   */
  updateMediaData(mediaData: UnifiedMediaItemData): void {
    if (this.originalTimelineItemData && isKnownTimelineItem(this.originalTimelineItemData)) {
      const config = this.originalTimelineItemData.config as any
      
      // 从 webav 对象中获取原始尺寸信息
      if (mediaData.webav?.originalWidth !== undefined && mediaData.webav?.originalHeight !== undefined) {
        config.width = mediaData.webav.originalWidth
        config.height = mediaData.webav.originalHeight
      }
      
      if (mediaData.duration !== undefined) {
        // 更新timeRange的持续时间，而不是config.duration
        const startTime = this.originalTimelineItemData.timeRange.timelineStartTime
        const clipStartTime = this.originalTimelineItemData.timeRange.clipStartTime
        this.originalTimelineItemData.timeRange = {
          timelineStartTime: startTime,
          timelineEndTime: startTime + mediaData.duration,
          clipStartTime: clipStartTime,
          clipEndTime: clipStartTime + mediaData.duration
        }
      }
      
      console.log(`🔄 [AddTimelineItemCommand] 已更新媒体数据: ${this.id}`, {
        width: config.width,
        height: config.height,
        duration: config.duration,
      })
    }
  }
  
  /**
   * 检查命令是否已被清理
   */
  get isDisposed(): boolean {
    return this._isDisposed
  }
  
  /**
   * 清理命令持有的资源
   */
  dispose(): void {
    if (this._isDisposed) {
      return
    }
    
    this._isDisposed = true
    // 清理媒体同步
    cleanupCommandMediaSync(this.id)
    console.log(`🗑️ [AddTimelineItemCommand] 命令资源已清理: ${this.id}`)
  }
}

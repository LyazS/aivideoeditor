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
import {
  setupCommandMediaSync,
  cleanupCommandMediaSync,
} from '../../composables/useCommandMediaSync'

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
    this.description = `添加时间轴项目: ${timelineItem.id}`

    // 保存原始数据用于重建sprite
    this.originalTimelineItemData = TimelineItemFactory.clone(timelineItem)
  }

  /**
   * 执行命令：添加时间轴项目
   * 统一重建逻辑：每次执行都从原始素材重新创建（已知项目）或重建占位符（未知项目）
   */
  async execute(): Promise<void> {
    if (!this.originalTimelineItemData) {
      throw new Error('没有有效的时间轴项目数据')
    }
    try {
      console.log(`🔄 执行添加操作：从源头重建时间轴项目...`)

      // 从原始素材重新创建TimelineItem和sprite
      const rebuildResult = await TimelineItemFactory.rebuildKnown({
        originalTimelineItemData: this.originalTimelineItemData,
        getMediaItem: (id: string) => this.mediaModule.getMediaItem(id),
        logIdentifier: 'AddTimelineItemCommand',
      })

      if (!rebuildResult.success) {
        throw new Error(`重建时间轴项目失败: ${rebuildResult.error}`)
      }

      const newTimelineItem = rebuildResult.timelineItem

      // 1. 添加到时间轴
      this.timelineModule.addTimelineItem(newTimelineItem)

      // 2. 添加sprite到WebAV画布
      if (newTimelineItem.runtime.sprite) {
        await this.webavModule.addSprite(newTimelineItem.runtime.sprite)
      }

      // 3. 针对loading状态的项目设置状态同步（确保时间轴项目已添加到store）
      if (newTimelineItem.timelineStatus === 'loading') {
        setupCommandMediaSync(
          this.id,
          newTimelineItem.mediaItemId,
          newTimelineItem.id,
          this.description,
        )
      }
      console.log(`✅ 已添加时间轴项目: ${this.originalTimelineItemData.id}`)
    } catch (error) {
      console.error(`❌ 添加时间轴项目失败: ${this.originalTimelineItemData.id}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：移除时间轴项目
   */
  async undo(): Promise<void> {
    if (!this.originalTimelineItemData) {
      console.warn('⚠️ 没有有效的时间轴项目数据，无法撤销')
      return
    }
    try {
      const existingItem = this.timelineModule.getTimelineItem(this.originalTimelineItemData.id)
      if (!existingItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法撤销: ${this.originalTimelineItemData.id}`)
        return
      }

      // 移除时间轴项目（这会自动处理sprite的清理）
      this.timelineModule.removeTimelineItem(this.originalTimelineItemData.id)
      console.log(`↩️ 已撤销添加时间轴项目: ${this.originalTimelineItemData.id}`)
    } catch (error) {
      console.error(`❌ 撤销添加时间轴项目失败: ${this.originalTimelineItemData.id}`, error)
      throw error
    }
  }

  /**
   * 更新媒体数据（由媒体同步调用）
   * @param mediaData 最新的媒体数据
   */
  updateMediaData(mediaData: UnifiedMediaItemData): void {
    if (this.originalTimelineItemData) {
      const config = this.originalTimelineItemData.config as any

      // 从 webav 对象中获取原始尺寸信息
      if (
        mediaData.webav?.originalWidth !== undefined &&
        mediaData.webav?.originalHeight !== undefined
      ) {
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
          clipEndTime: clipStartTime + mediaData.duration,
        }
      }

      console.log(`🔄 [AddTimelineItemCommand] 已更新媒体数据: ${this.id}`, {
        width: config.width,
        height: config.height,
        duration: mediaData.duration,
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

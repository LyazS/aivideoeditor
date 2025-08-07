/**
 * 移除时间轴项目命令
 * 支持移除已知和未知时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始素材重新创建
 */

import { generateCommandId } from '../../../utils/idGenerator'
import { reactive, markRaw } from 'vue'
import type { VisibleSprite } from '@webav/av-cliper'
import type { SimpleCommand } from './types'
import { cloneTimelineItem } from '../../timelineitem/TimelineItemFactory'

// ==================== 新架构类型导入 ====================
import type {
  UnifiedTimelineItemData,
  KnownTimelineItem,
  UnknownTimelineItem,
  TimelineItemStatus,
} from '../../timelineitem/TimelineItemData'

import type { UnifiedMediaItemData, MediaType } from '../../mediaitem/types'

import type {
  VideoMediaConfig,
  ImageMediaConfig,
  AudioMediaConfig,
  TextMediaConfig,
  BaseMediaProps,
} from '../../../types'
import type { UnifiedTimeRange } from '../../types/timeRange'

// ==================== 新架构工具导入 ====================
import {
  createSpriteFromUnifiedMediaItem,
  createSpriteFromUnifiedTimelineItem,
} from '../../utils/UnifiedSpriteFactory'
import { regenerateThumbnailForUnifiedTimelineItem } from '../../utils/thumbnailGenerator'

import {
  isKnownTimelineItem,
  isUnknownTimelineItem,
  hasVisualProperties,
  TimelineItemFactory,
} from '../../timelineitem'

import { UnifiedMediaItemQueries } from '../../mediaitem'

import {
  setupCommandMediaSync,
  cleanupCommandMediaSync,
} from '../../composables/useCommandMediaSync'

/**
 * 移除时间轴项目命令
 * 支持移除已知和未知时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始素材重新创建
 */
export class RemoveTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: UnifiedTimelineItemData<MediaType> | null = null // 保存原始项目的重建数据
  private _isDisposed = false

  constructor(
    private timelineItemId: string,
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

    this.description = `移除时间轴项目: ${timelineItem.id}`

    // 保存重建所需的完整元数据
    this.originalTimelineItemData = TimelineItemFactory.clone(timelineItem)

    console.log('💾 保存删除已知项目的重建数据:', {
      id: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: this.originalTimelineItemData.timeRange,
      config: this.originalTimelineItemData.config,
    })
  }

  /**
   * 执行命令：删除时间轴项目
   */
  async execute(): Promise<void> {
    if (!this.originalTimelineItemData) {
      console.warn('⚠️ 没有有效的时间轴项目数据，无法撤销')
      return
    }
    try {
      // 检查项目是否存在
      const existingItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!existingItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法删除: ${this.timelineItemId}`)
        return
      }

      // 设置媒体同步（只针对loading状态的项目）
      if (existingItem.timelineStatus === 'loading') {
        const mediaItem = this.mediaModule.getMediaItem(existingItem.mediaItemId)
        if (mediaItem) {
          setupCommandMediaSync(this.id, mediaItem.id, undefined, this.description)
        }
      }

      // 删除时间轴项目（这会自动处理sprite的清理和WebAV画布移除）
      this.timelineModule.removeTimelineItem(this.timelineItemId)
      console.log(`↩️ 已删除时间轴项目: ${this.originalTimelineItemData.id}`)
    } catch (error) {
      console.error(`❌ 删除时间轴项目失败: ${this.originalTimelineItemData.id}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：重新创建时间轴项目
   * 遵循"从源头重建"原则，从原始素材完全重新创建
   */
  async undo(): Promise<void> {
    if (!this.originalTimelineItemData) {
      throw new Error('没有有效的时间轴项目数据')
    }
    try {
      console.log(`🔄 执行撤销删除操作：从源头重建时间轴项目...`)

      // 从原始素材重新创建TimelineItem和sprite
      const rebuildResult = await TimelineItemFactory.rebuildKnown({
        originalTimelineItemData: this.originalTimelineItemData,
        getMediaItem: (id: string) => this.mediaModule.getMediaItem(id),
        logIdentifier: 'RemoveTimelineItemCommand',
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
      console.log(`✅ 已撤销删除时间轴项目: ${this.originalTimelineItemData.id}`)
    } catch (error) {
      console.error(`❌ 撤销删除时间轴项目失败: ${this.originalTimelineItemData.id}`, error)
      throw error
    }
  }

  /**
   * 更新媒体数据（由媒体同步调用）
   * @param mediaData 最新的媒体数据
   */
  updateMediaData(mediaData: UnifiedMediaItemData, timelineItemId?: string): void {
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

      console.log(`🔄 [RemoveTimelineItemCommand] 已更新媒体数据: ${this.id}`, {
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
    console.log(`🗑️ [RemoveTimelineItemCommand] 命令资源已清理: ${this.id}`)
  }
}

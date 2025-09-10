/**
 * 分割时间轴项目命令
 * 支持分割已知时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始素材重新创建
 */

import { generateCommandId } from '@/unified/utils/idGenerator'
import { framesToTimecode } from '@/unified/utils/timeUtils'
import { reactive, markRaw } from 'vue'
import type { VisibleSprite } from '@webav/av-cliper'
import type { SimpleCommand } from '@/unified/modules/commands/types'

// ==================== 新架构类型导入 ====================
import type {
  UnifiedTimelineItemData,
  TimelineItemStatus,
} from '@/unified/timelineitem/TimelineItemData'

import type { UnifiedMediaItemData, MediaType } from '@/unified/mediaitem/types'

import type {
  VideoMediaConfig,
  ImageMediaConfig,
  TextMediaConfig,
  BaseMediaProps,
} from '@/unified/timelineitem/TimelineItemData'

import type { UnifiedTimeRange } from '@/unified/types/timeRange'

// ==================== 新架构工具导入 ====================
import { regenerateThumbnailForUnifiedTimelineItem } from '@/unified/utils/thumbnailGenerator'

import { TimelineItemFactory } from '@/unified/timelineitem'

import { UnifiedMediaItemQueries } from '@/unified/mediaitem'

/**
 * 分割时间轴项目命令
 * 支持分割已知时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始素材重新创建
 */
export class SplitTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: UnifiedTimelineItemData<MediaType> // 保存原始项目的重建数据
  private firstItemId: string // 分割后第一个项目的ID
  private secondItemId: string // 分割后第二个项目的ID

  constructor(
    private originalTimelineItemId: string,
    originalTimelineItem: UnifiedTimelineItemData<MediaType>, // 要分割的原始时间轴项目
    private splitTimeFrames: number, // 分割时间点（帧数）
    private timelineModule: {
      addTimelineItem: (item: UnifiedTimelineItemData<MediaType>) => Promise<void>
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaType> | undefined
      setupTimelineItemSprite: (item: UnifiedTimelineItemData<MediaType>) => Promise<void>
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

    // 已知项目处理逻辑
    const mediaItem = this.mediaModule.getMediaItem(originalTimelineItem.mediaItemId)
    this.description = `分割时间轴项目: ${mediaItem?.name || '未知素材'} (在 ${framesToTimecode(splitTimeFrames)})`

    // 保存原始项目的完整重建元数据
    this.originalTimelineItemData = TimelineItemFactory.clone(originalTimelineItem)

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
    firstItem: UnifiedTimelineItemData<MediaType>
    secondItem: UnifiedTimelineItemData<MediaType>
  }> {
    console.log('🔄 开始从源头重建分割后的时间轴项目...')

    // 2. 计算分割点的时间信息（直接使用帧数）
    const originalTimeRange = this.originalTimelineItemData.timeRange
    const timelineStartTimeFrames = originalTimeRange.timelineStartTime
    const timelineEndTimeFrames = originalTimeRange.timelineEndTime
    const splitTimeFrames = this.splitTimeFrames // 分割时间点（帧数）

    // 计算分割点在素材中的相对位置（使用帧数）
    const timelineDurationFrames = timelineEndTimeFrames - timelineStartTimeFrames
    const relativeTimelineFrames = splitTimeFrames - timelineStartTimeFrames
    const relativeRatio = relativeTimelineFrames / timelineDurationFrames

    // 统一使用UnifiedTimeRange，所有类型都有clipStartTime和clipEndTime
    const clipStartTimeFrames = originalTimeRange.clipStartTime || 0
    const clipEndTimeFrames = originalTimeRange.clipEndTime || 0
    const clipDurationFrames = clipEndTimeFrames - clipStartTimeFrames
    const splitClipTimeFrames = clipStartTimeFrames + Math.round(clipDurationFrames * relativeRatio)

    // 创建第一个分割片段的时间范围
    const firstTimeRange: UnifiedTimeRange = {
      clipStartTime: clipStartTimeFrames,
      clipEndTime: splitClipTimeFrames,
      timelineStartTime: timelineStartTimeFrames,
      timelineEndTime: splitTimeFrames,
    }

    // 创建第二个分割片段的时间范围
    const secondTimeRange: UnifiedTimeRange = {
      clipStartTime: splitClipTimeFrames,
      clipEndTime: clipEndTimeFrames,
      timelineStartTime: splitTimeFrames,
      timelineEndTime: timelineEndTimeFrames,
    }

    // 使用 TimelineItemFactory.rebuildForCmd 创建第一个分割片段
    const firstRebuildResult = await TimelineItemFactory.rebuildForCmd({
      originalTimelineItemData: {
        ...this.originalTimelineItemData,
        id: this.firstItemId,
        timeRange: firstTimeRange,
      },
      getMediaItem: this.mediaModule.getMediaItem,
      setupTimelineItemSprite: this.timelineModule.setupTimelineItemSprite,
      logIdentifier: 'SplitTimelineItemCommand rebuildSplitItems first',
    })

    if (!firstRebuildResult.success) {
      throw new Error(`重建第一个分割片段失败: ${firstRebuildResult.error}`)
    }

    // 使用 TimelineItemFactory.rebuildForCmd 创建第二个分割片段
    const secondRebuildResult = await TimelineItemFactory.rebuildForCmd({
      originalTimelineItemData: {
        ...this.originalTimelineItemData,
        id: this.secondItemId,
        timeRange: secondTimeRange,
      },
      getMediaItem: this.mediaModule.getMediaItem,
      setupTimelineItemSprite: this.timelineModule.setupTimelineItemSprite,
      logIdentifier: 'SplitTimelineItemCommand rebuildSplitItems second',
    })

    if (!secondRebuildResult.success) {
      throw new Error(`重建第二个分割片段失败: ${secondRebuildResult.error}`)
    }

    const firstItem = firstRebuildResult.timelineItem
    const secondItem = secondRebuildResult.timelineItem

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
  private async rebuildOriginalItem(): Promise<UnifiedTimelineItemData<MediaType>> {
    console.log('🔄 开始从源头重建原始时间轴项目...')

    // 使用 TimelineItemFactory.rebuildForCmd 重建原始项目
    const rebuildResult = await TimelineItemFactory.rebuildForCmd({
      originalTimelineItemData: this.originalTimelineItemData,
      getMediaItem: this.mediaModule.getMediaItem,
      setupTimelineItemSprite: this.timelineModule.setupTimelineItemSprite,
      logIdentifier: 'SplitTimelineItemCommand rebuildOriginalItem',
    })

    if (!rebuildResult.success) {
      throw new Error(`重建原始项目失败: ${rebuildResult.error}`)
    }

    const newTimelineItem = rebuildResult.timelineItem

    console.log('🔄 重建原始项目完成:', {
      id: newTimelineItem.id,
      mediaType: this.originalTimelineItemData.mediaType,
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
      await this.timelineModule.addTimelineItem(firstItem)
      await this.timelineModule.addTimelineItem(secondItem)

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
      await this.timelineModule.addTimelineItem(originalItem)

      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.log(`↩️ 已撤销分割时间轴项目: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.error(`❌ 撤销分割时间轴项目失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }
}

import { generateCommandId } from '@/utils/idGenerator'
import { type Ref } from 'vue'
import type { VisibleSprite } from '@webav/av-cliper'
import type { SimpleCommand } from '@/unified/modules/commands/types'

// 类型导入
import type {
  UnifiedTimelineItemData,
} from '@/unified/timelineitem/TimelineItemData'

import type {
  UnifiedMediaItemData,
  MediaType,
} from '@/unified/mediaitem/types'

import type { UnifiedTrackData, UnifiedTrackType } from '@/unified/track/TrackTypes'

import {
  TimelineItemFactory,
} from '@/unified/timelineitem'

import {
  setupCommandMediaSync,
} from '@/unified/composables/useCommandMediaSync'

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

      // 为所有处于loading状态的时间轴项目设置媒体同步
      for (const item of this.affectedTimelineItems) {
        if (item.timelineStatus === 'loading') {
          const mediaItem = this.mediaModule.getMediaItem(item.mediaItemId)
          if (mediaItem) {
            setupCommandMediaSync(this.id, mediaItem.id, undefined, this.description)
          }
        }
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
        console.log(`🔄 执行撤销删除轨道操作：从源头重建时间轴项目...`)

        // 从原始素材重新创建TimelineItem和sprite
        const rebuildResult = await TimelineItemFactory.rebuildKnown({
          originalTimelineItemData: itemData,
          getMediaItem: (id: string) => this.mediaModule.getMediaItem(id),
          logIdentifier: 'RemoveTrackCommand',
        })

        if (!rebuildResult.success) {
          throw new Error(`轨道删除撤销重建时间轴项目失败: ${rebuildResult.error}`)
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
        console.log(`✅ 轨道删除撤销已撤销删除时间轴项目: ${itemData.id}`)
      }

      console.log(
        `↩️ 已撤销删除轨道: ${this.trackData.name}, 恢复了 ${this.affectedTimelineItems.length} 个时间轴项目`,
      )
    } catch (error) {
      console.error(`❌ 撤销删除轨道失败: ${this.trackData.name}`, error)
      throw error
    }
  }

  /**
   * 更新媒体数据（由媒体同步调用）
   * @param mediaData 最新的媒体数据
   * @param timelineItemId 可选的时间轴项目ID，用于指定要更新哪个项目
   */
  updateMediaData(mediaData: UnifiedMediaItemData, timelineItemId?: string): void {
    // 遍历所有受影响的时间轴项目
    for (const timelineItem of this.affectedTimelineItems) {
      // 如果指定了timelineItemId，则只更新匹配的项目
      if (timelineItemId && timelineItem.id !== timelineItemId) {
        continue
      }
      
      // 如果没有指定timelineItemId或者项目ID匹配，则更新该项目
      const config = timelineItem.config as any

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
        const startTime = timelineItem.timeRange.timelineStartTime
        const clipStartTime = timelineItem.timeRange.clipStartTime
        timelineItem.timeRange = {
          timelineStartTime: startTime,
          timelineEndTime: startTime + mediaData.duration,
          clipStartTime: clipStartTime,
          clipEndTime: clipStartTime + mediaData.duration,
        }
      }
      timelineItem.timelineStatus = 'ready'

      console.log(`🔄 [RemoveTrackCommand] 已更新媒体数据: ${timelineItem.id}`, {
        width: config.width,
        height: config.height,
        duration: mediaData.duration,
      })
      
      // 如果指定了timelineItemId且已找到并更新了对应项目，则退出循环
      if (timelineItemId && timelineItem.id === timelineItemId) {
        break
      }
    }
  }
}

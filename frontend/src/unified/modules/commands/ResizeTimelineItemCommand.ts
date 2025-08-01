import { generateCommandId } from '../../../utils/idGenerator'
import { framesToTimecode } from '../../utils/UnifiedTimeUtils'
import type { SimpleCommand } from './types'

// 类型导入
import type {
  UnifiedTimelineItemData,
} from '../../timelineitem/TimelineItemData'

import type {
  UnifiedMediaItemData,
  MediaTypeOrUnknown,
} from '../../mediaitem/types'

import type {
  BaseTimeRange,
} from '../../../types'

import {
  isKnownTimelineItem,
  isUnknownTimelineItem,
  isVideoTimelineItem,
  isImageTimelineItem,
  isAudioTimelineItem,
  isTextTimelineItem,
} from '../../timelineitem'

/**
 * 调整时间轴项目大小命令
 * 支持已知和未知时间轴项目时间范围调整（拖拽边缘）的撤销/重做操作
 * 保存调整前的时间范围，撤销时恢复原始时间范围
 */
export class ResizeTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimeRange: BaseTimeRange
  private newTimeRange: BaseTimeRange

  constructor(
    private timelineItemId: string,
    originalTimeRange: BaseTimeRange, // 原始时间范围
    newTimeRange: BaseTimeRange, // 新的时间范围
    private timelineModule: {
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
    },
    private mediaModule: {
      getMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
  ) {
    this.id = generateCommandId()

    // 保存原始和新的时间范围
    this.originalTimeRange = { ...originalTimeRange }
    this.newTimeRange = { ...newTimeRange }

    // 获取时间轴项目信息用于描述
    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    let itemName = '未知素材'

    // 根据项目类型获取名称
    if (timelineItem) {
      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      itemName = mediaItem?.name || '未知素材'
    }

    // 使用帧数计算时长，提供更精确的显示
    const originalDurationFrames =
      this.originalTimeRange.timelineEndTime - this.originalTimeRange.timelineStartTime
    const newDurationFrames =
      this.newTimeRange.timelineEndTime - this.newTimeRange.timelineStartTime
    const originalStartFrames = this.originalTimeRange.timelineStartTime
    const newStartFrames = this.newTimeRange.timelineStartTime

    this.description = `调整时间范围: ${itemName} (${framesToTimecode(originalDurationFrames)} → ${framesToTimecode(newDurationFrames)})`

    console.log(`📋 准备调整时间范围: ${itemName}`, {
      原始时长: framesToTimecode(originalDurationFrames),
      新时长: framesToTimecode(newDurationFrames),
      原始位置: framesToTimecode(originalStartFrames),
      新位置: framesToTimecode(newStartFrames),
    })
  }

  /**
   * 应用时间范围到sprite和timelineItem
   */
  private applyTimeRange(timeRange: BaseTimeRange): void {
    const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!timelineItem) {
      throw new Error(`找不到时间轴项目: ${this.timelineItemId}`)
    }

    if (isKnownTimelineItem(timelineItem)) {
      // 已知项目处理逻辑
      const sprite = timelineItem.sprite
      if (!sprite) {
        throw new Error(`时间轴项目没有sprite: ${this.timelineItemId}`)
      }

      // 根据媒体类型设置时间范围
      if (isVideoTimelineItem(timelineItem) || isAudioTimelineItem(timelineItem)) {
        // 视频和音频类型：保持clipStartTime和clipEndTime，更新timeline时间
        const clipStartTime =
          'clipStartTime' in timeRange
            ? typeof timeRange.clipStartTime === 'number'
              ? timeRange.clipStartTime
              : 0
            : 0
        const clipEndTime =
          'clipEndTime' in timeRange
            ? typeof timeRange.clipEndTime === 'number'
              ? timeRange.clipEndTime
              : 0
            : 0

        sprite.setTimeRange({
          clipStartTime,
          clipEndTime,
          timelineStartTime: timeRange.timelineStartTime,
          timelineEndTime: timeRange.timelineEndTime,
        })
      } else if (isImageTimelineItem(timelineItem) || isTextTimelineItem(timelineItem)) {
        // 图片和文本类型：设置displayDuration
        const displayDuration =
          'displayDuration' in timeRange
            ? typeof timeRange.displayDuration === 'number'
              ? timeRange.displayDuration
              : timeRange.timelineEndTime - timeRange.timelineStartTime
            : timeRange.timelineEndTime - timeRange.timelineStartTime

        sprite.setTimeRange({
          timelineStartTime: timeRange.timelineStartTime,
          timelineEndTime: timeRange.timelineEndTime,
          displayDuration,
        })
      } else {
        throw new Error('不支持的媒体类型')
      }

      // 同步timeRange到TimelineItem
      timelineItem.timeRange = sprite.getTimeRange()
    } else if (isUnknownTimelineItem(timelineItem)) {
      // 未知项目处理逻辑：直接更新timeRange（未知项目没有sprite）
      timelineItem.timeRange = {
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: timeRange.timelineEndTime,
      }
    }
  }

  /**
   * 执行命令：应用新的时间范围
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行调整时间范围操作: ${this.timelineItemId}...`)

      this.applyTimeRange(this.newTimeRange)

      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem
        ? this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        : null
      const newDurationFrames =
        this.newTimeRange.timelineEndTime - this.newTimeRange.timelineStartTime

      console.log(
        `✅ 已调整时间范围: ${mediaItem?.name || '未知素材'} → ${framesToTimecode(newDurationFrames)}`,
      )
    } catch (error) {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem
        ? this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        : null
      console.error(`❌ 调整时间范围失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复原始时间范围
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销调整时间范围操作：恢复 ${this.timelineItemId} 的原始时间范围...`)

      this.applyTimeRange(this.originalTimeRange)

      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem
        ? this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        : null
      const originalDurationFrames =
        this.originalTimeRange.timelineEndTime - this.originalTimeRange.timelineStartTime

      console.log(
        `↩️ 已撤销调整时间范围: ${mediaItem?.name || '未知素材'} → ${framesToTimecode(originalDurationFrames)}`,
      )
    } catch (error) {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem
        ? this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        : null
      console.error(`❌ 撤销调整时间范围失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }
}
import { generateCommandId } from '../../../utils/idGenerator'
import { BaseBatchCommand } from '../historyModule'
import { framesToSeconds, secondsToFrames } from '../../utils/timeUtils'
import type { SimpleCommand, TimelineItem, MediaItem, Track } from '../../../types'
import {
  RemoveTimelineItemCommand,
  MoveTimelineItemCommand
} from './timelineCommands'
import type { VisibleSprite } from '@webav/av-cliper'

/**
 * 批量删除时间轴项目命令
 * 将多个删除操作组合为一个批量操作，统一撤销/重做
 */
export class BatchDeleteCommand extends BaseBatchCommand {
  constructor(
    private timelineItemIds: string[],
    private timelineModule: {
      getTimelineItem: (id: string) => TimelineItem | undefined
      timelineItems: { value: TimelineItem[] }
      addTimelineItem: (item: TimelineItem) => void
      removeTimelineItem: (id: string) => void
    },
    private webavModule: {
      addSprite: (sprite: VisibleSprite) => boolean
      removeSprite: (sprite: VisibleSprite) => boolean
    },
    private mediaModule: {
      getMediaItem: (id: string) => MediaItem | undefined
    }
  ) {
    super(`批量删除 ${timelineItemIds.length} 个时间轴项目`)
    this.buildDeleteCommands()
  }

  /**
   * 构建删除命令列表
   */
  private buildDeleteCommands() {
    for (const itemId of this.timelineItemIds) {
      const item = this.timelineModule.getTimelineItem(itemId)
      if (item) {
        const deleteCommand = new RemoveTimelineItemCommand(
          itemId,
          item,
          this.timelineModule,
          this.webavModule,
          this.mediaModule
        )
        this.addCommand(deleteCommand)
      }
    }

    console.log(`📋 准备批量删除 ${this.subCommands.length} 个时间轴项目`)
  }


}

/**
 * 批量自动排列轨道命令
 * 将自动排列操作分解为多个移动命令，支持统一撤销/重做
 */
export class BatchAutoArrangeTrackCommand extends BaseBatchCommand {
  constructor(
    private trackId: number,
    private timelineItems: TimelineItem[],
    private timelineModule: {
      getTimelineItem: (id: string) => TimelineItem | undefined
      timelineItems: { value: TimelineItem[] }
      updateTimelineItemPosition: (id: string, position: number, trackId?: number) => void
    },
    private mediaModule: {
      getMediaItem: (id: string) => MediaItem | undefined
    },
    private trackModule: {
      getTrack: (trackId: number) => Track | undefined
    }
  ) {
    const track = trackModule.getTrack(trackId)
    super(`自动排列轨道: ${track?.name || `轨道 ${trackId}`}`)
    this.buildMoveCommands()
  }

  /**
   * 构建移动命令列表
   */
  private buildMoveCommands() {
    if (this.timelineItems.length === 0) {
      console.log(`⚠️ 轨道 ${this.trackId} 没有片段需要整理`)
      return
    }

    // 按时间轴开始时间排序
    const sortedItems = [...this.timelineItems].sort((a, b) => {
      const rangeA = a.sprite.getTimeRange()
      const rangeB = b.sprite.getTimeRange()
      return rangeA.timelineStartTime - rangeB.timelineStartTime
    })

    let currentPosition = 0
    for (const item of sortedItems) {
      const sprite = item.sprite
      const timeRange = sprite.getTimeRange()
      // 注意：timeRange 中的时间是帧数，currentPosition 是秒数
      const durationFrames = timeRange.timelineEndTime - timeRange.timelineStartTime // 帧数
      const duration = framesToSeconds(durationFrames) // 转换为秒数

      // 计算新的时间范围（使用帧数）
      const currentPositionFrames = secondsToFrames(currentPosition) // 转换为帧数
      const newTimeRange = {
        ...timeRange,
        timelineStartTime: currentPositionFrames, // 帧数
        timelineEndTime: currentPositionFrames + durationFrames, // 帧数
      }

      // 检查是否需要移动（避免创建无意义的命令）
      const positionChanged = Math.abs(timeRange.timelineStartTime - newTimeRange.timelineStartTime) > 1 // 1帧误差容忍

      if (positionChanged) {
        const moveCommand = new MoveTimelineItemCommand(
          item.id,
          timeRange.timelineStartTime, // 原始位置（帧数）
          currentPositionFrames, // 新位置（帧数）
          this.trackId, // 轨道不变
          this.trackId,
          {
            updateTimelineItemPosition: this.timelineModule.updateTimelineItemPosition,
            getTimelineItem: this.timelineModule.getTimelineItem,
          },
          {
            getMediaItem: this.mediaModule.getMediaItem,
          }
        )
        this.addCommand(moveCommand)
      }

      currentPosition += duration
    }

    const track = this.trackModule.getTrack(this.trackId)
    console.log(`📋 准备自动排列轨道: ${track?.name || `轨道 ${this.trackId}`}, 需要移动 ${this.subCommands.length} 个项目`)
  }


}

/**
 * 批量属性修改命令
 * 将多个属性修改操作组合为一个批量操作
 */
export class BatchUpdatePropertiesCommand extends BaseBatchCommand {
  constructor(
    targetItemIds: string[],
    updateCommands: SimpleCommand[]
  ) {
    super(`批量修改 ${targetItemIds.length} 个项目的属性`)

    // 添加所有更新命令
    updateCommands.forEach(command => this.addCommand(command))

    console.log(`📋 准备批量修改 ${this.subCommands.length} 个属性`)
  }


}

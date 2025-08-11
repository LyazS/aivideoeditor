import { generateCommandId } from '../../../utils/idGenerator'
import { ref, type Ref } from 'vue'
import type { SimpleCommand } from './types'

// 类型导入
import type { UnifiedTimelineItemData } from '../../timelineitem/TimelineItemData'

import type { MediaType, MediaTypeOrUnknown } from '../../mediaitem/types'

import type { UnifiedTrackData } from '../../track/TrackTypes'

/**
 * 切换轨道可见性命令
 * 支持切换轨道可见性的撤销/重做操作
 * 同时同步该轨道上所有时间轴项目的sprite可见性
 */
export class ToggleTrackVisibilityCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private previousVisibility: boolean // 保存切换前的可见性状态

  constructor(
    private trackId: string,
    private trackModule: {
      getTrack: (trackId: string) => UnifiedTrackData | undefined
      toggleTrackVisibility: (
        trackId: string,
        timelineItems?: Ref<UnifiedTimelineItemData<MediaType>[]>,
      ) => void
    },
    private timelineModule: {
      timelineItems: { value: UnifiedTimelineItemData<MediaType>[] }
    },
  ) {
    this.id = generateCommandId()

    // 获取轨道信息
    const track = this.trackModule.getTrack(trackId)
    if (!track) {
      throw new Error(`找不到轨道: ${trackId}`)
    }

    this.previousVisibility = track.isVisible
    this.description = `${track.isVisible ? '隐藏' : '显示'}轨道: ${track.name}`

    console.log(
      `📋 准备切换轨道可见性: ${track.name}, 当前状态: ${track.isVisible ? '可见' : '隐藏'}`,
    )
  }

  /**
   * 执行命令：切换轨道可见性
   */
  async execute(): Promise<void> {
    try {
      const track = this.trackModule.getTrack(this.trackId)
      if (!track) {
        throw new Error(`轨道不存在: ${this.trackId}`)
      }

      console.log(`🔄 执行切换轨道可见性操作: ${track.name}...`)

      // 调用trackModule的toggleTrackVisibility方法
      // 这会自动同步该轨道上所有TimelineItem的sprite可见性
      this.trackModule.toggleTrackVisibility(
        this.trackId,
        ref(this.timelineModule.timelineItems.value),
      )

      const newVisibility = track.isVisible
      console.log(`✅ 已切换轨道可见性: ${track.name}, 新状态: ${newVisibility ? '可见' : '隐藏'}`)
    } catch (error) {
      const track = this.trackModule.getTrack(this.trackId)
      console.error(`❌ 切换轨道可见性失败: ${track?.name || `轨道 ${this.trackId}`}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复轨道的原始可见性状态
   */
  async undo(): Promise<void> {
    try {
      const track = this.trackModule.getTrack(this.trackId)
      if (!track) {
        throw new Error(`轨道不存在: ${this.trackId}`)
      }

      console.log(`🔄 撤销切换轨道可见性操作：恢复轨道 ${track.name} 的原始状态...`)

      // 如果当前状态与原始状态不同，则再次切换
      if (track.isVisible !== this.previousVisibility) {
        this.trackModule.toggleTrackVisibility(
          this.trackId,
          ref(this.timelineModule.timelineItems.value),
        )
      }

      console.log(
        `↩️ 已撤销切换轨道可见性: ${track.name}, 恢复状态: ${this.previousVisibility ? '可见' : '隐藏'}`,
      )
    } catch (error) {
      const track = this.trackModule.getTrack(this.trackId)
      console.error(`❌ 撤销切换轨道可见性失败: ${track?.name || `轨道 ${this.trackId}`}`, error)
      throw error
    }
  }
}

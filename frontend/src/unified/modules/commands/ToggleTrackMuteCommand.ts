import { generateCommandId } from '../../../utils/idGenerator'
import { ref, type Ref } from 'vue'
import type { SimpleCommand } from './types'

// 类型导入
import type { UnifiedTimelineItemData } from '../../timelineitem/TimelineItemData'

import type { MediaTypeOrUnknown } from '../../mediaitem/types'

import type { UnifiedTrackData } from '../../track/TrackTypes'

/**
 * 切换轨道静音命令
 * 支持切换轨道静音状态的撤销/重做操作
 * 同时同步该轨道上所有时间轴项目的音频状态
 */
export class ToggleTrackMuteCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private previousMuteState: boolean // 保存切换前的静音状态

  constructor(
    private trackId: string,
    private trackModule: {
      getTrack: (trackId: string) => UnifiedTrackData | undefined
      toggleTrackMute: (
        trackId: string,
        timelineItems?: Ref<UnifiedTimelineItemData<MediaTypeOrUnknown>[]>,
      ) => void
    },
    private timelineModule: {
      timelineItems: { value: UnifiedTimelineItemData<MediaTypeOrUnknown>[] }
    },
  ) {
    this.id = generateCommandId()

    // 获取轨道信息
    const track = this.trackModule.getTrack(trackId)
    if (!track) {
      throw new Error(`找不到轨道: ${trackId}`)
    }

    this.previousMuteState = track.isMuted
    this.description = `${track.isMuted ? '取消静音' : '静音'}轨道: ${track.name}`

    console.log(
      `📋 准备切换轨道静音状态: ${track.name}, 当前状态: ${track.isMuted ? '静音' : '有声'}`,
    )
  }

  /**
   * 执行命令：切换轨道静音状态
   */
  async execute(): Promise<void> {
    try {
      const track = this.trackModule.getTrack(this.trackId)
      if (!track) {
        throw new Error(`轨道不存在: ${this.trackId}`)
      }

      console.log(`🔄 执行切换轨道静音状态操作: ${track.name}...`)

      // 调用trackModule的toggleTrackMute方法
      // 这会自动同步该轨道上所有TimelineItem的音频状态
      this.trackModule.toggleTrackMute(this.trackId, ref(this.timelineModule.timelineItems.value))

      const newMuteState = track.isMuted
      console.log(`✅ 已切换轨道静音状态: ${track.name}, 新状态: ${newMuteState ? '静音' : '有声'}`)
    } catch (error) {
      const track = this.trackModule.getTrack(this.trackId)
      console.error(`❌ 切换轨道静音状态失败: ${track?.name || `轨道 ${this.trackId}`}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复轨道的原始静音状态
   */
  async undo(): Promise<void> {
    try {
      const track = this.trackModule.getTrack(this.trackId)
      if (!track) {
        throw new Error(`轨道不存在: ${this.trackId}`)
      }

      console.log(`🔄 撤销切换轨道静音状态操作：恢复轨道 ${track.name} 的原始状态...`)

      // 如果当前状态与原始状态不同，则再次切换
      if (track.isMuted !== this.previousMuteState) {
        this.trackModule.toggleTrackMute(this.trackId, ref(this.timelineModule.timelineItems.value))
      }

      console.log(
        `↩️ 已撤销切换轨道静音状态: ${track.name}, 恢复状态: ${this.previousMuteState ? '静音' : '有声'}`,
      )
    } catch (error) {
      const track = this.trackModule.getTrack(this.trackId)
      console.error(`❌ 撤销切换轨道静音状态失败: ${track?.name || `轨道 ${this.trackId}`}`, error)
      throw error
    }
  }
}

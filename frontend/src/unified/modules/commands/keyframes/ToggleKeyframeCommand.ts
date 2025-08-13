/**
 * 切换关键帧命令
 * 根据当前状态智能地创建或删除关键帧
 * 这是最常用的关键帧操作命令，对应关键帧按钮的点击行为
 * 适配新架构的统一类型系统
 */

import type { SimpleCommand } from '@/unified/modules/commands/types'
import {
  type KeyframeSnapshot,
  type TimelineModule,
  type WebAVAnimationManager,
  type PlaybackControls,
  generateCommandId,
  createSnapshot,
  applyKeyframeSnapshot,
  isPlayheadInTimelineItem,
  showUserWarning,
} from './shared'

export class ToggleKeyframeCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private beforeSnapshot: KeyframeSnapshot
  private afterSnapshot: KeyframeSnapshot | null = null

  constructor(
    private timelineItemId: string,
    private frame: number,
    private timelineModule: TimelineModule,
    private webavAnimationManager: WebAVAnimationManager,
    private playbackControls?: PlaybackControls,
  ) {
    this.id = generateCommandId()
    this.description = `切换关键帧 (帧 ${frame})`

    // 保存执行前的状态快照
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${timelineItemId}`)
    }
    this.beforeSnapshot = createSnapshot(item)
  }

  /**
   * 执行命令：切换关键帧
   */
  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    // 检查播放头是否在clip时间范围内
    if (!isPlayheadInTimelineItem(item, this.frame)) {
      await showUserWarning(
        '无法切换关键帧',
        '播放头不在当前视频片段的时间范围内。请将播放头移动到片段内再尝试切换关键帧。',
      )

      console.warn('🎬 [Toggle Keyframe Command] 播放头不在当前clip时间范围内，无法切换关键帧:', {
        itemId: this.timelineItemId,
        frame: this.frame,
        clipTimeRange: {
          start: item.timeRange.timelineStartTime,
          end: item.timeRange.timelineEndTime,
        },
      })
      throw new Error('播放头不在当前clip时间范围内，无法切换关键帧')
    }

    try {
      // 动态导入关键帧工具函数
      const { toggleKeyframe } = await import('@/unified/utils/unifiedKeyframeUtils')

      // 使用统一的关键帧切换逻辑
      toggleKeyframe(item, this.frame)

      // 更新WebAV动画
      await this.webavAnimationManager.updateWebAVAnimation(item)

      // 保存执行后的状态快照
      this.afterSnapshot = createSnapshot(item)

      // 重做关键帧切换操作时，跳转到相关帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('✅ 切换关键帧命令执行成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
      })
    } catch (error) {
      console.error('❌ 切换关键帧命令执行失败:', error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复到切换前的状态
   */
  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    try {
      await applyKeyframeSnapshot(item, this.beforeSnapshot, this.webavAnimationManager)

      // 撤销关键帧切换操作时，跳转到相关帧位置（seekTo会自动触发渲染更新）
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('↩️ 切换关键帧命令撤销成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
      })
    } catch (error) {
      console.error('❌ 切换关键帧命令撤销失败:', error)
      throw error
    }
  }
}
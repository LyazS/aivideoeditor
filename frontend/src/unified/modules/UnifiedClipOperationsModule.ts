import { reactive, markRaw, type Ref } from 'vue'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import type { UnifiedMediaItemData } from '@/unified/mediaitem/types'
import { VideoVisibleSprite } from '@/unified/visiblesprite/VideoVisibleSprite'
import { ImageVisibleSprite } from '@/unified/visiblesprite/ImageVisibleSprite'
import { AudioVisibleSprite } from '@/unified/visiblesprite/AudioVisibleSprite'
import { syncTimeRange } from '@/unified/utils/timeRangeUtils'
import { isReady, isVideoTimelineItem, isAudioTimelineItem } from '@/unified/timelineitem/TimelineItemQueries'
import { adjustKeyframesForDurationChange } from '@/unified/utils/unifiedKeyframeUtils'
import { updateWebAVAnimation } from '@/unified/utils/webavAnimationManager'
import { framesToTimecode, microsecondsToFrames } from '@/unified/utils/timeUtils'

/**
 * 统一片段操作模块
 * 基于新架构的统一类型系统重构的片段编辑功能
 *
 * 主要变化：
 * 1. 使用 UnifiedTimelineItemData 替代原有的 LocalTimelineItem
 * 2. 使用 UnifiedMediaItemData 替代原有的 LocalMediaItem
 * 3. 保持与原有模块相同的API接口，便于迁移
 * 4. 支持统一的播放速度调整、关键帧处理等功能
 */
export function createUnifiedClipOperationsModule(
  timelineModule: {
    getTimelineItem: (id: string) => UnifiedTimelineItemData | undefined
    updateTimelineItem: (id: string, updates: Partial<UnifiedTimelineItemData>) => void
  },
  mediaModule: {
    getMediaItem: (id: string) => UnifiedMediaItemData | undefined
  },
) {
  // ==================== 视频片段操作方法 ====================

  /**
   * 更新时间轴项目播放速度
   * @param timelineItemId 时间轴项目ID
   * @param newRate 新的播放速度
   */
  function updateTimelineItemPlaybackRate(timelineItemId: string, newRate: number) {
    const item = timelineModule.getTimelineItem(timelineItemId)
    if (item) {
      // 确保播放速度在合理范围内（扩展到0.1-100倍）
      const clampedRate = Math.max(0.1, Math.min(100, newRate))

      // 🎯 关键帧位置调整：在更新播放速度之前计算时长变化
      let oldDurationFrames = 0
      let newDurationFrames = 0

      if (isVideoTimelineItem(item)) {
        const clipDurationFrames = item.timeRange.clipEndTime - item.timeRange.clipStartTime
        oldDurationFrames = item.timeRange.timelineEndTime - item.timeRange.timelineStartTime
        newDurationFrames = Math.round(clipDurationFrames / clampedRate)

        // 如果有关键帧，先调整位置
        if (item.animation && item.animation.keyframes.length > 0) {
          adjustKeyframesForDurationChange(item, oldDurationFrames, newDurationFrames)
          console.log('🎬 [Playback Rate] Keyframes adjusted for speed change:', {
            oldRate: clampedRate,
            newRate: clampedRate,
            oldDuration: oldDurationFrames,
            newDuration: newDurationFrames,
          })
        }
      }

      // 更新sprite的播放速度（这会自动更新sprite内部的timeRange）
      // 视频和音频sprite都有setPlaybackRate方法
      if (isReady(item) && item.runtime.sprite) {
        if (isVideoTimelineItem(item)) {
          ;(item.runtime.sprite as VideoVisibleSprite).setPlaybackRate(clampedRate)
        } else if (isAudioTimelineItem(item)) {
          ;(item.runtime.sprite as AudioVisibleSprite).setPlaybackRate(clampedRate)
        }
      }

      // 使用同步函数更新TimelineItem的timeRange
      syncTimeRange(item)

      // 如果有动画，需要重新设置WebAV动画时长
      if (item.animation && item.animation.isEnabled) {
        // 异步更新动画，不阻塞播放速度调整
        updateWebAVAnimation(item)
          .then(() => {
            console.log(
              '🎬 [Playback Rate] Animation duration updated after playback rate change',
            )
          })
          .catch((error) => {
            console.error('🎬 [Playback Rate] Failed to update animation duration:', error)
          })
      }

      // 只有视频才记录详细的时间范围信息
      if (isVideoTimelineItem(item)) {
        const clipDurationFrames = microsecondsToFrames(
          item.timeRange.clipEndTime - item.timeRange.clipStartTime,
        )
        const timelineDurationFrames = microsecondsToFrames(
          item.timeRange.timelineEndTime - item.timeRange.timelineStartTime,
        )

        console.log('🎬 播放速度更新:', {
          timelineItemId,
          newRate: clampedRate,
          timeRange: {
            clipDuration: framesToTimecode(clipDurationFrames),
            timelineDuration: framesToTimecode(timelineDurationFrames),
          },
        })
      } else if (isAudioTimelineItem(item)) {
        console.log('🎬 [ClipOperations] 音频播放速度调整:', {
          timelineItemId,
          newRate: clampedRate
        })
      } else {
        console.log('🎬 [ClipOperations] 图片不支持播放速度调整:', { timelineItemId })
      }
    }
  }


  // ==================== 导出接口 ====================

  return {
    // 方法
    updateTimelineItemPlaybackRate,
  }
}

// 导出类型定义
export type UnifiedClipOperationsModule = ReturnType<typeof createUnifiedClipOperationsModule>

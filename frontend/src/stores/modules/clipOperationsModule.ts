import { reactive, markRaw, type Ref } from 'vue'
import { VideoVisibleSprite } from '../../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../../utils/ImageVisibleSprite'
import { AudioVisibleSprite } from '../../utils/AudioVisibleSprite'
import { createSpriteFromMediaItem } from '../../utils/spriteFactory'
import { regenerateThumbnailForTimelineItem } from '../../utils/thumbnailGenerator'
import { printDebugInfo } from '../utils/debugUtils'
import { syncTimeRange } from '../utils/timeRangeUtils'
import { microsecondsToFrames, framesToTimecode } from '../utils/timeUtils'
import type { LocalTimelineItem, LocalMediaItem, AsyncProcessingMediaItem } from '../../types'
import { isVideoTimeRange, createLocalTimelineItemData } from '../../types'

/**
 * 视频片段操作模块
 * 负责复杂的视频片段编辑操作，包括复制、分割、播放速度调整等
 */
export function createClipOperationsModule(timelineModule: {
  getLocalTimelineItem: (id: string) => LocalTimelineItem | undefined
  setupBidirectionalSync: (item: LocalTimelineItem) => void
}) {
  // ==================== 视频片段操作方法 ====================

  /**
   * 更新时间轴项目播放速度
   * @param timelineItemId 时间轴项目ID
   * @param newRate 新的播放速度
   */
  function updateTimelineItemPlaybackRate(timelineItemId: string, newRate: number) {
    const item = timelineModule.getLocalTimelineItem(timelineItemId)
    if (item) {
      // 确保播放速度在合理范围内（扩展到0.1-100倍）
      const clampedRate = Math.max(0.1, Math.min(100, newRate))

      // 🎯 关键帧位置调整：在更新播放速度之前计算时长变化
      let oldDurationFrames = 0
      let newDurationFrames = 0

      if (item.mediaType === 'video' && isVideoTimeRange(item.timeRange)) {
        const clipDurationFrames = item.timeRange.clipEndTime - item.timeRange.clipStartTime
        oldDurationFrames = item.timeRange.timelineEndTime - item.timeRange.timelineStartTime
        newDurationFrames = Math.round(clipDurationFrames / clampedRate)

        // 如果有关键帧，先调整位置
        if (item.animation && item.animation.keyframes.length > 0) {
          import('../../utils/unifiedKeyframeUtils').then(
            ({ adjustKeyframesForDurationChange }) => {
              adjustKeyframesForDurationChange(item, oldDurationFrames, newDurationFrames)
              console.log('🎬 [Playback Rate] Keyframes adjusted for speed change:', {
                oldRate: isVideoTimeRange(item.timeRange) ? item.timeRange.playbackRate : 1,
                newRate: clampedRate,
                oldDuration: oldDurationFrames,
                newDuration: newDurationFrames,
              })
            },
          )
        }
      }

      // 更新sprite的播放速度（这会自动更新sprite内部的timeRange）
      // 视频和音频sprite都有setPlaybackRate方法
      if (item.mediaType === 'video') {
        ;(item.sprite as VideoVisibleSprite).setPlaybackRate(clampedRate)
      } else if (item.mediaType === 'audio') {
        ;(item.sprite as AudioVisibleSprite).setPlaybackRate(clampedRate)
      }

      // 使用同步函数更新TimelineItem的timeRange
      syncTimeRange(item)

      // 如果有动画，需要重新设置WebAV动画时长
      if (item.animation && item.animation.isEnabled) {
        // 异步更新动画，不阻塞播放速度调整
        import('../../utils/webavAnimationManager').then(({ updateWebAVAnimation }) => {
          updateWebAVAnimation(item)
            .then(() => {
              console.log(
                '🎬 [Playback Rate] Animation duration updated after playback rate change',
              )
            })
            .catch((error) => {
              console.error('🎬 [Playback Rate] Failed to update animation duration:', error)
            })
        })
      }

      // 只有视频才记录详细的时间范围信息
      if (item.mediaType === 'video' && isVideoTimeRange(item.timeRange)) {
        const clipDurationFrames = microsecondsToFrames(
          item.timeRange.clipEndTime - item.timeRange.clipStartTime,
        )
        const timelineDurationFrames = microsecondsToFrames(
          item.timeRange.timelineEndTime - item.timeRange.timelineStartTime,
        )
        const effectiveDurationFrames = microsecondsToFrames(item.timeRange.effectiveDuration)

        console.log('🎬 播放速度更新:', {
          timelineItemId,
          newRate: clampedRate,
          timeRange: {
            clipDuration: framesToTimecode(clipDurationFrames),
            timelineDuration: framesToTimecode(timelineDurationFrames),
            effectiveDuration: framesToTimecode(effectiveDurationFrames),
          },
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
export type ClipOperationsModule = ReturnType<typeof createClipOperationsModule>

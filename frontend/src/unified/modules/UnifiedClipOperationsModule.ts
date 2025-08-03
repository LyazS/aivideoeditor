import { reactive, markRaw, type Ref } from 'vue'
import type { UnifiedTimelineItemData } from '../timelineitem/TimelineItemData'
import type { UnifiedMediaItemData } from '../mediaitem/types'
import { VideoVisibleSprite } from '../visiblesprite/VideoVisibleSprite'
import { ImageVisibleSprite } from '../visiblesprite/ImageVisibleSprite'
import { AudioVisibleSprite } from '../visiblesprite/AudioVisibleSprite'
import { syncTimeRange } from '../utils/UnifiedTimeRangeUtils'
import { isReady } from '../timelineitem/TimelineItemQueries'
import { isVideoTimeRange } from '../../types'

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
    if (!item || !isReady(item)) {
      console.warn('🎬 [UnifiedClipOperations] 时间轴项目不存在或未就绪:', timelineItemId)
      return
    }

    // 确保播放速度在合理范围内（扩展到0.1-100倍）
    const clampedRate = Math.max(0.1, Math.min(100, newRate))

    // 🎯 关键帧位置调整：在更新播放速度之前计算时长变化
    let oldDurationFrames = 0
    let newDurationFrames = 0

    if ((item.mediaType === 'video' || item.mediaType === 'audio') && item.runtime.sprite) {
      const timeRange = item.timeRange
      
      // 计算裁剪时长（对于视频/音频）
      let clipDurationFrames = 0
      if (isVideoTimeRange(timeRange)) {
        clipDurationFrames = timeRange.clipEndTime - timeRange.clipStartTime
      } else {
        // 如果没有裁剪配置，使用当前时间轴时长
        clipDurationFrames = timeRange.timelineEndTime - timeRange.timelineStartTime
      }

      oldDurationFrames = timeRange.timelineEndTime - timeRange.timelineStartTime
      newDurationFrames = Math.round(clipDurationFrames / clampedRate)

      // 如果有关键帧，先调整位置
      if (hasKeyframes(item)) {
        adjustKeyframesForDurationChange(item, oldDurationFrames, newDurationFrames)
          .then(() => {
            console.log('🎬 [UnifiedClipOperations] Keyframes adjusted for speed change:', {
              oldRate: getCurrentPlaybackRate(item),
              newRate: clampedRate,
              oldDuration: oldDurationFrames,
              newDuration: newDurationFrames,
            })
          })
          .catch((error) => {
            console.error('🎬 [UnifiedClipOperations] Failed to adjust keyframes:', error)
          })
      }
    }

    // 更新sprite的播放速度（这会自动更新sprite内部的timeRange）
    if (item.runtime.sprite) {
      if (item.mediaType === 'video' && item.runtime.sprite instanceof VideoVisibleSprite) {
        item.runtime.sprite.setPlaybackRate(clampedRate)
      } else if (item.mediaType === 'audio' && item.runtime.sprite instanceof AudioVisibleSprite) {
        item.runtime.sprite.setPlaybackRate(clampedRate)
      }

      // 使用统一的时间范围同步函数更新TimelineItem的timeRange
      syncTimeRange(item)
    }

    // 更新时间范围中的播放速度（对于视频/音频）
    if (isVideoTimeRange(item.timeRange)) {
      item.timeRange.playbackRate = clampedRate
    }

    // 如果有动画，需要重新设置WebAV动画时长
    if (hasAnimation(item)) {
      // 异步更新动画，不阻塞播放速度调整
      updateWebAVAnimation(item)
        .then(() => {
          console.log('🎬 [UnifiedClipOperations] Animation duration updated after playback rate change')
        })
        .catch((error) => {
          console.error('🎬 [UnifiedClipOperations] Failed to update animation duration:', error)
        })
    }

    // 记录播放速度更新信息
    if (item.mediaType === 'video' || item.mediaType === 'audio') {
      const timeRange = item.timeRange
      const timelineDurationFrames = timeRange.timelineEndTime - timeRange.timelineStartTime

      console.log('🎬 [UnifiedClipOperations] 播放速度更新:', {
        timelineItemId,
        mediaType: item.mediaType,
        newRate: clampedRate,
        timelineDurationFrames,
        oldDurationFrames,
        newDurationFrames,
      })
    } else {
      console.log('🎬 [UnifiedClipOperations] 图片不支持播放速度调整:', { timelineItemId })
    }
  }

  // ==================== 辅助函数 ====================

  /**
   * 获取当前播放速度
   */
  function getCurrentPlaybackRate(item: UnifiedTimelineItemData): number {
    if (isVideoTimeRange(item.timeRange)) {
      return item.timeRange.playbackRate || 1
    }
    return 1
  }

  /**
   * 检查是否有关键帧
   */
  function hasKeyframes(item: UnifiedTimelineItemData): boolean {
    // 在新架构中，关键帧信息可能存储在不同的地方
    // 这里需要根据实际的关键帧存储结构来实现
    return false // 暂时返回false，待实际关键帧系统实现后更新
  }

  /**
   * 检查是否有动画
   */
  function hasAnimation(item: UnifiedTimelineItemData): boolean {
    // 在新架构中，动画信息可能存储在不同的地方
    // 这里需要根据实际的动画存储结构来实现
    return false // 暂时返回false，待实际动画系统实现后更新
  }

  /**
   * 调整关键帧位置（异步）
   */
  async function adjustKeyframesForDurationChange(
    item: UnifiedTimelineItemData,
    oldDurationFrames: number,
    newDurationFrames: number
  ): Promise<void> {
    try {
      // 动态导入关键帧工具函数
      const { adjustKeyframesForDurationChange } = await import('../../utils/unifiedKeyframeUtils')
      
      // 注意：这里需要适配新架构的关键帧系统
      // 暂时保留接口，待关键帧系统实现后更新
      console.log('🎬 [UnifiedClipOperations] Keyframe adjustment placeholder:', {
        itemId: item.id,
        oldDuration: oldDurationFrames,
        newDuration: newDurationFrames,
      })
    } catch (error) {
      console.error('🎬 [UnifiedClipOperations] Failed to import keyframe utils:', error)
    }
  }

  /**
   * 更新WebAV动画（异步）
   */
  async function updateWebAVAnimation(item: UnifiedTimelineItemData): Promise<void> {
    try {
      // 动态导入WebAV动画管理器
      const { updateWebAVAnimation } = await import('../../utils/webavAnimationManager')
      
      // 注意：这里需要适配新架构的动画系统
      // 暂时保留接口，待动画系统实现后更新
      console.log('🎬 [UnifiedClipOperations] WebAV animation update placeholder:', {
        itemId: item.id,
      })
    } catch (error) {
      console.error('🎬 [UnifiedClipOperations] Failed to import animation manager:', error)
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

import { ref, type Raw, type Ref } from 'vue'
import { VideoVisibleSprite } from '../../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../../utils/ImageVisibleSprite'
import { SpriteEventSyncManager } from '../../utils/spriteEventSync'
import { printDebugInfo, syncTimeRange } from '../utils/storeUtils'
import type {
  TimelineItem,
  MediaItem,
  VideoResolution,
} from '../../types/videoTypes'

/**
 * 时间轴核心管理模块
 * 负责时间轴项目的完整生命周期管理，包括CRUD操作、双向数据同步、变换属性更新
 * 🆕 支持sprite事件监听和双向数据同步
 */
export function createTimelineModule(
  configModule: { videoResolution: { value: VideoResolution } },
  webavModule: { avCanvas: { value: { removeSprite: (sprite: unknown) => void } | null } },
  mediaModule: {
    getMediaItem: (id: string) => MediaItem | undefined
    mediaItems: Ref<MediaItem[]>
  },
  trackModule?: { tracks: Ref<{ id: number; name: string; isVisible: boolean; isMuted: boolean }[]> },
  // 🆕 添加sprite属性变化回调
  onSpritePropsChange?: (timelineItemId: string, changes: any) => void
) {
  // ==================== 状态定义 ====================

  const timelineItems = ref<TimelineItem[]>([])

  // ==================== 时间轴管理方法 ====================

  // ==================== 时间轴管理方法 ====================

  /**
   * 添加时间轴项目
   * @param timelineItem 要添加的时间轴项目
   */
  function addTimelineItem(timelineItem: TimelineItem) {
    // 如果没有指定轨道，默认分配到第一个轨道
    if (!timelineItem.trackId) {
      timelineItem.trackId = 1
    }

    // 根据轨道的可见性和静音状态设置sprite属性
    if (trackModule) {
      const track = trackModule.tracks.value.find(t => t.id === timelineItem.trackId)
      if (track && timelineItem.sprite) {
        // 设置可见性
        timelineItem.sprite.visible = track.isVisible

        // 为视频片段设置轨道静音检查函数
        if (timelineItem.mediaType === 'video' && 'setTrackMuteChecker' in timelineItem.sprite) {
          const sprite = timelineItem.sprite as any // VideoVisibleSprite
          sprite.setTrackMuteChecker(() => track.isMuted)
        }
      }
    }



    timelineItems.value.push(timelineItem)

    // 🆕 设置sprite事件监听
    if (onSpritePropsChange) {
      SpriteEventSyncManager.setupSpriteEventListeners(timelineItem, onSpritePropsChange)
    }

    const mediaItem = mediaModule.getMediaItem(timelineItem.mediaItemId)
    printDebugInfo(
      '添加素材到时间轴',
      {
        timelineItemId: timelineItem.id,
        mediaItemId: timelineItem.mediaItemId,
        mediaItemName: mediaItem?.name || '未知',
        trackId: timelineItem.trackId,
        position: timelineItem.timeRange.timelineStartTime / 1000000,
        spriteVisible: timelineItem.sprite?.visible,
      },
      mediaModule.mediaItems.value,
      timelineItems.value,
      trackModule?.tracks.value || [],
    )
  }

  /**
   * 移除时间轴项目
   * @param timelineItemId 要移除的时间轴项目ID
   */
  function removeTimelineItem(timelineItemId: string) {
    const index = timelineItems.value.findIndex((item) => item.id === timelineItemId)
    if (index > -1) {
      const item = timelineItems.value[index]
      const mediaItem = mediaModule.getMediaItem(item.mediaItemId)

      // 🆕 清理sprite事件监听器
      SpriteEventSyncManager.removeSpriteEventListenersWithSprite(item)

      // 清理sprite资源
      try {
        if (item.sprite && typeof item.sprite.destroy === 'function') {
          item.sprite.destroy()
        }
      } catch (error) {
        console.warn('清理sprite资源时出错:', error)
      }

      // 从WebAV画布移除
      try {
        const canvas = webavModule.avCanvas.value
        if (canvas) {
          canvas.removeSprite(item.sprite)
        }
      } catch (error) {
        console.warn('从WebAV画布移除sprite时出错:', error)
      }

      // 从数组中移除
      timelineItems.value.splice(index, 1)

      printDebugInfo(
        '从时间轴删除素材',
        {
          timelineItemId,
          mediaItemId: item.mediaItemId,
          mediaItemName: mediaItem?.name || '未知',
          trackId: item.trackId,
          position: item.timeRange.timelineStartTime / 1000000,
        },
        mediaModule.mediaItems.value,
        timelineItems.value,
        trackModule?.tracks.value || [],
      )
    }
  }

  /**
   * 获取时间轴项目
   * @param timelineItemId 时间轴项目ID
   * @returns 时间轴项目或undefined
   */
  function getTimelineItem(timelineItemId: string): TimelineItem | undefined {
    return timelineItems.value.find((item) => item.id === timelineItemId)
  }

  /**
   * 更新时间轴项目位置
   * @param timelineItemId 时间轴项目ID
   * @param newPosition 新位置（秒）
   * @param newTrackId 新轨道ID（可选）
   */
  function updateTimelineItemPosition(
    timelineItemId: string,
    newPosition: number,
    newTrackId?: number,
  ) {
    const item = timelineItems.value.find((item) => item.id === timelineItemId)
    if (item) {
      const oldPosition = item.timeRange.timelineStartTime / 1000000
      const oldTrackId = item.trackId
      const mediaItem = mediaModule.getMediaItem(item.mediaItemId)

      // 确保新位置不为负数
      const clampedNewPosition = Math.max(0, newPosition)

      // 如果指定了新轨道，更新轨道ID并同步可见性
      if (newTrackId !== undefined) {
        item.trackId = newTrackId

        // 根据新轨道的可见性设置sprite的visible属性
        if (trackModule) {
          const newTrack = trackModule.tracks.value.find(t => t.id === newTrackId)
          if (newTrack && item.sprite) {
            item.sprite.visible = newTrack.isVisible
          }
        }
      }

      // 更新时间轴位置
      const sprite = item.sprite
      const currentTimeRange = sprite.getTimeRange()
      const duration = currentTimeRange.timelineEndTime - currentTimeRange.timelineStartTime

      // 使用同步函数更新timeRange
      syncTimeRange(item, {
        timelineStartTime: clampedNewPosition * 1000000, // 转换为微秒
        timelineEndTime: clampedNewPosition * 1000000 + duration,
      })

      printDebugInfo(
        '更新时间轴项目位置',
        {
          timelineItemId,
          mediaItemName: mediaItem?.name || '未知',
          oldPosition,
          newPosition: clampedNewPosition,
          originalNewPosition: newPosition,
          oldTrackId,
          newTrackId: item.trackId,
          positionChanged: oldPosition !== clampedNewPosition,
          trackChanged: oldTrackId !== item.trackId,
          positionClamped: newPosition !== clampedNewPosition,
        },
        mediaModule.mediaItems.value,
        timelineItems.value,
        trackModule?.tracks.value || [],
      )
    }
  }

  /**
   * 更新时间轴项目的sprite
   * @param timelineItemId 时间轴项目ID
   * @param newSprite 新的sprite实例
   */
  function updateTimelineItemSprite(timelineItemId: string, newSprite: Raw<VideoVisibleSprite | ImageVisibleSprite>) {
    const item = timelineItems.value.find((item) => item.id === timelineItemId)
    if (item) {
      const mediaItem = mediaModule.getMediaItem(item.mediaItemId)

      // 清理旧的sprite资源
      try {
        if (item.sprite && typeof item.sprite.destroy === 'function') {
          item.sprite.destroy()
        }
      } catch (error) {
        console.warn('清理旧sprite资源时出错:', error)
      }

      // 更新sprite引用
      item.sprite = newSprite

      printDebugInfo(
        '更新时间轴项目sprite',
        {
          timelineItemId,
          mediaItemName: mediaItem?.name || '未知',
          trackId: item.trackId,
          position: item.timeRange.timelineStartTime / 1000000,
        },
        mediaModule.mediaItems.value,
        timelineItems.value,
        trackModule?.tracks.value || [],
      )
    }
  }



  // ==================== 导出接口 ====================

  return {
    // 状态
    timelineItems,

    // 方法
    addTimelineItem,
    removeTimelineItem,
    getTimelineItem,
    updateTimelineItemPosition,
    updateTimelineItemSprite,
  }
}

// 导出类型定义
export type TimelineModule = ReturnType<typeof createTimelineModule>

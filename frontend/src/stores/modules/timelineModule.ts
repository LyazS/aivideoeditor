import { ref, type Raw, type Ref } from 'vue'
import { VideoVisibleSprite } from '../../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../../utils/ImageVisibleSprite'
import { webavToProjectCoords, projectToWebavCoords } from '../../utils/coordinateTransform'
import { printDebugInfo, syncTimeRange } from '../utils/storeUtils'
import type {
  TimelineItem,
  MediaItem,
  PropsChangeEvent,
  VideoResolution,
} from '../../types/videoTypes'

/**
 * 时间轴核心管理模块
 * 负责时间轴项目的完整生命周期管理，包括CRUD操作、双向数据同步、变换属性更新
 */
export function createTimelineModule(
  configModule: { videoResolution: { value: VideoResolution } },
  webavModule: { avCanvas: { value: { removeSprite: (sprite: unknown) => void } | null } },
  mediaModule: {
    getMediaItem: (id: string) => MediaItem | undefined
    mediaItems: Ref<MediaItem[]>
  },
  trackModule?: { tracks: Ref<{ id: number; name: string; isVisible: boolean; isMuted: boolean }[]> },
) {
  // ==================== 状态定义 ====================

  const timelineItems = ref<TimelineItem[]>([])

  // ==================== 双向数据同步函数 ====================

  /**
   * 为TimelineItem设置双向数据同步
   * @param timelineItem TimelineItem实例
   */
  function setupBidirectionalSync(timelineItem: TimelineItem) {
    const sprite = timelineItem.sprite

    // 直接使用WebAV原生的propsChange事件监听器
    // 设置VisibleSprite → TimelineItem 的同步
    sprite.on('propsChange', (changedProps: PropsChangeEvent) => {
      if (changedProps.rect) {
        const rect = changedProps.rect

        // 更新位置（坐标系转换）
        // 如果rect.x/rect.y为undefined，说明位置没有变化，使用sprite的当前值
        const currentRect = sprite.rect
        const projectCoords = webavToProjectCoords(
          rect.x !== undefined ? rect.x : currentRect.x,
          rect.y !== undefined ? rect.y : currentRect.y,
          rect.w !== undefined ? rect.w : timelineItem.width,
          rect.h !== undefined ? rect.h : timelineItem.height,
          configModule.videoResolution.value.width,
          configModule.videoResolution.value.height,
        )
        timelineItem.x = Math.round(projectCoords.x)
        timelineItem.y = Math.round(projectCoords.y)

        // 更新尺寸
        if (rect.w !== undefined) timelineItem.width = rect.w
        if (rect.h !== undefined) timelineItem.height = rect.h

        // 更新旋转角度
        if (rect.angle !== undefined) timelineItem.rotation = rect.angle

        // console.log('🔄 VisibleSprite → TimelineItem 同步:', {
        //   webavCoords: { x: rect.x, y: rect.y },
        //   projectCoords: { x: timelineItem.x, y: timelineItem.y },
        //   size: { w: timelineItem.width, h: timelineItem.height },
        //   rotation: timelineItem.rotation
        // })
      }

      // 同步zIndex属性（propsChange事件包含此属性）
      if (changedProps.zIndex !== undefined) {
        timelineItem.zIndex = changedProps.zIndex
        // console.log('🔄 VisibleSprite → TimelineItem 同步 zIndex:', changedProps.zIndex)
      }

      // 注意：opacity属性没有propsChange回调，需要在直接设置sprite.opacity的地方手动同步
    })
  }

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

    // 设置双向数据同步
    setupBidirectionalSync(timelineItem)

    timelineItems.value.push(timelineItem)

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

  // ==================== 属性面板更新方法 ====================

  /**
   * 更新TimelineItem的VisibleSprite变换属性
   * 这会触发propsChange事件，自动同步到TimelineItem，然后更新属性面板显示
   */
  function updateTimelineItemTransform(
    timelineItemId: string,
    transform: {
      position?: { x: number; y: number }
      size?: { width: number; height: number }
      rotation?: number
      opacity?: number
      zIndex?: number
    },
  ) {
    const item = timelineItems.value.find((item) => item.id === timelineItemId)
    if (!item) return

    const sprite = item.sprite

    try {
      // 更新尺寸时使用中心缩放
      if (transform.size) {
        // 获取当前中心位置（项目坐标系）
        const currentCenterX = item.x
        const currentCenterY = item.y
        const newWidth = transform.size.width
        const newHeight = transform.size.height

        // 中心缩放：保持中心位置不变，更新尺寸
        sprite.rect.w = newWidth
        sprite.rect.h = newHeight

        // 根据新尺寸重新计算WebAV坐标（保持中心位置不变）
        const webavCoords = projectToWebavCoords(
          currentCenterX,
          currentCenterY,
          newWidth,
          newHeight,
          configModule.videoResolution.value.width,
          configModule.videoResolution.value.height,
        )
        sprite.rect.x = webavCoords.x
        sprite.rect.y = webavCoords.y

        console.log('🎯 中心缩放:', {
          newSize: { width: newWidth, height: newHeight },
          centerPosition: { x: currentCenterX, y: currentCenterY },
          webavCoords: { x: webavCoords.x, y: webavCoords.y },
        })
      }

      // 更新位置（需要坐标系转换）
      if (transform.position) {
        const webavCoords = projectToWebavCoords(
          transform.position.x,
          transform.position.y,
          item.width,
          item.height,
          configModule.videoResolution.value.width,
          configModule.videoResolution.value.height,
        )
        sprite.rect.x = webavCoords.x
        sprite.rect.y = webavCoords.y
      }

      // 更新其他属性
      if (transform.opacity !== undefined) {
        sprite.opacity = transform.opacity
        // 🔧 手动同步opacity到timelineItem（因为opacity没有propsChange回调）
        item.opacity = transform.opacity
      }
      if (transform.zIndex !== undefined) {
        sprite.zIndex = transform.zIndex
        // zIndex有propsChange回调，会自动同步到timelineItem
      }
      // 更新旋转角度（WebAV的rect.angle支持旋转）
      if (transform.rotation !== undefined) {
        sprite.rect.angle = transform.rotation
      }

      console.log('✅ 属性面板 → VisibleSprite 更新完成:', {
        timelineItemId,
        transform,
        webavRect: {
          x: sprite.rect.x,
          y: sprite.rect.y,
          w: sprite.rect.w,
          h: sprite.rect.h,
          angle: sprite.rect.angle,
        },
      })
    } catch (error) {
      console.error('更新VisibleSprite变换属性失败:', error)
    }
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    timelineItems,

    // 方法
    setupBidirectionalSync,
    addTimelineItem,
    removeTimelineItem,
    getTimelineItem,
    updateTimelineItemPosition,
    updateTimelineItemSprite,
    updateTimelineItemTransform,
  }
}

// 导出类型定义
export type TimelineModule = ReturnType<typeof createTimelineModule>

import { ref, type Ref } from 'vue'
import { printDebugInfo } from '../utils/debugUtils'
import type { MediaItem, TimelineItem, Track } from '../../types'

/**
 * 媒体管理模块
 * 负责管理素材库中的媒体项目
 */
export function createMediaModule() {
  // ==================== 状态定义 ====================

  // 素材库
  const mediaItems = ref<MediaItem[]>([])

  // ==================== 媒体项目管理方法 ====================

  /**
   * 添加媒体项目到素材库
   * @param mediaItem 媒体项目
   * @param timelineItems 时间轴项目引用（用于调试信息）
   * @param tracks 轨道引用（用于调试信息）
   */
  function addMediaItem(
    mediaItem: MediaItem,
    timelineItems: Ref<TimelineItem[]>,
    tracks: Ref<Track[]>,
  ) {
    mediaItems.value.push(mediaItem)
    printDebugInfo(
      '添加素材到素材库',
      {
        mediaItemId: mediaItem.id,
        name: mediaItem.name,
        duration: mediaItem.duration,
        type: mediaItem.type,
      },
      mediaItems.value,
      timelineItems.value,
      tracks.value,
    )
  }

  /**
   * 从素材库删除媒体项目
   * 注意：这个方法需要清理相关的时间轴项目和WebAV资源
   * @param mediaItemId 媒体项目ID
   * @param timelineItems 时间轴项目引用
   * @param tracks 轨道引用
   * @param avCanvas WebAV画布引用
   * @param cleanupTimelineItem 清理时间轴项目的回调函数
   */
  function removeMediaItem(
    mediaItemId: string,
    timelineItems: Ref<TimelineItem[]>,
    tracks: Ref<Track[]>,
    avCanvas: { removeSprite: (sprite: unknown) => void } | null,
    cleanupTimelineItem: (timelineItem: TimelineItem) => void,
  ) {
    const index = mediaItems.value.findIndex((item) => item.id === mediaItemId)
    if (index > -1) {
      const mediaItem = mediaItems.value[index]
      const relatedTimelineItems = timelineItems.value.filter(
        (item) => item.mediaItemId === mediaItemId,
      )

      // 先正确地移除所有相关的时间轴项目（包括WebAV画布清理）
      relatedTimelineItems.forEach((timelineItem) => {
        console.log(`🧹 清理时间轴项目: ${timelineItem.id}`)

        // 清理sprite资源
        try {
          if (timelineItem.sprite && typeof timelineItem.sprite.destroy === 'function') {
            timelineItem.sprite.destroy()
          }
        } catch (error) {
          console.warn('清理sprite资源时出错:', error)
        }

        // 从WebAV画布移除
        try {
          if (avCanvas) {
            avCanvas.removeSprite(timelineItem.sprite)
            console.log(`✅ 从WebAV画布移除sprite: ${timelineItem.id}`)
          }
        } catch (error) {
          console.warn('从WebAV画布移除sprite时出错:', error)
        }

        // 调用外部清理回调
        cleanupTimelineItem(timelineItem)
      })

      // 从时间轴数组中移除相关项目
      timelineItems.value = timelineItems.value.filter((item) => item.mediaItemId !== mediaItemId)

      // 再移除素材项目
      mediaItems.value.splice(index, 1)

      printDebugInfo(
        '从素材库删除素材',
        {
          mediaItemId,
          mediaItemName: mediaItem.name,
          removedTimelineItemsCount: relatedTimelineItems.length,
          removedTimelineItemIds: relatedTimelineItems.map((item) => item.id),
        },
        mediaItems.value,
        timelineItems.value,
        tracks.value,
      )
    }
  }

  /**
   * 根据ID获取媒体项目
   * @param mediaItemId 媒体项目ID
   * @returns 媒体项目或undefined
   */
  function getMediaItem(mediaItemId: string): MediaItem | undefined {
    return mediaItems.value.find((item) => item.id === mediaItemId)
  }

  /**
   * 更新媒体项目名称
   * @param mediaItemId 媒体项目ID
   * @param newName 新名称
   */
  function updateMediaItemName(mediaItemId: string, newName: string) {
    const mediaItem = getMediaItem(mediaItemId)
    if (mediaItem && newName.trim()) {
      mediaItem.name = newName.trim()
      console.log(`素材名称已更新: ${mediaItemId} -> ${newName}`)
    }
  }

  /**
   * 更新媒体项目
   * @param updatedMediaItem 更新后的媒体项目
   */
  function updateMediaItem(updatedMediaItem: MediaItem) {
    const index = mediaItems.value.findIndex((item) => item.id === updatedMediaItem.id)
    if (index !== -1) {
      mediaItems.value[index] = updatedMediaItem
      console.log(`媒体项目已更新: ${updatedMediaItem.id} -> ${updatedMediaItem.name}`)
    }
  }

  // ==================== 视频分辨率管理方法 ====================

  /**
   * 获取视频原始分辨率（从MP4Clip获取）
   * @param mediaItemId 素材ID
   * @returns 视频分辨率对象
   */
  function getVideoOriginalResolution(mediaItemId: string): { width: number; height: number } {
    const mediaItem = getMediaItem(mediaItemId)
    if (mediaItem && mediaItem.mediaType === 'video' && mediaItem.mp4Clip) {
      try {
        // 从MP4Clip的meta信息获取分辨率
        const clip = mediaItem.mp4Clip
        if ('meta' in clip && clip.meta) {
          return {
            width: clip.meta.width,
            height: clip.meta.height,
          }
        }
      } catch (error) {
        console.warn('获取视频分辨率失败:', error)
      }
    }
    // 默认分辨率
    return { width: 1920, height: 1080 }
  }

  /**
   * 设置视频元素引用（已废弃，保留兼容性）
   * @deprecated 现在从MP4Clip直接获取分辨率信息
   */
  function setVideoElement(clipId: string, videoElement: HTMLVideoElement | null) {
    console.warn('setVideoElement已废弃，现在从MP4Clip直接获取分辨率信息')
    // 保留空实现以避免破坏现有代码
  }

  // ==================== 图片分辨率管理方法 ====================

  /**
   * 获取图片原始分辨率（从ImgClip获取）
   * @param mediaItemId 素材ID
   * @returns 图片分辨率对象
   */
  function getImageOriginalResolution(mediaItemId: string): { width: number; height: number } {
    const mediaItem = getMediaItem(mediaItemId)
    if (mediaItem && mediaItem.mediaType === 'image' && mediaItem.imgClip) {
      try {
        // 从ImgClip的meta信息获取分辨率
        const clip = mediaItem.imgClip
        if ('meta' in clip && clip.meta) {
          return {
            width: clip.meta.width,
            height: clip.meta.height,
          }
        }
      } catch (error) {
        console.warn('获取图片分辨率失败:', error)
      }
    }
    // 默认分辨率
    return { width: 1920, height: 1080 }
  }

  /**
   * 设置图片元素引用（已废弃，保留兼容性）
   * @deprecated 现在从ImgClip直接获取分辨率信息
   */
  function setImageElement(clipId: string, imageElement: HTMLImageElement | null) {
    console.warn('setImageElement已废弃，现在从ImgClip直接获取分辨率信息')
    // 保留空实现以避免破坏现有代码
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    mediaItems,

    // 媒体项目管理方法
    addMediaItem,
    removeMediaItem,
    getMediaItem,
    updateMediaItemName,
    updateMediaItem,

    // 视频元素管理方法
    setVideoElement,
    getVideoOriginalResolution,

    // 图片元素管理方法
    setImageElement,
    getImageOriginalResolution,
  }
}

// 导出类型定义
export type MediaModule = ReturnType<typeof createMediaModule>

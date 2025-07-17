import { ref, watch, type Ref } from 'vue'
import { printDebugInfo } from '../utils/debugUtils'
import type {
  LocalMediaItem,
  LocalTimelineItem,
  Track,
  AsyncProcessingMediaItem,
  AsyncProcessingTimelineItem,
} from '../../types'

/**
 * 媒体管理模块
 * 负责管理素材库中的媒体项目
 */
export function createMediaModule() {
  // ==================== 状态定义 ====================

  // 素材库
  const mediaItems = ref<LocalMediaItem[]>([])

  // 异步处理素材库
  const asyncProcessingItems = ref<AsyncProcessingMediaItem[]>([])

  // ==================== 媒体项目管理方法 ====================

  /**
   * 添加媒体项目到素材库
   * @param mediaItem 媒体项目
   * @param timelineItems 时间轴项目引用（用于调试信息）
   * @param tracks 轨道引用（用于调试信息）
   */
  function addLocalMediaItem(
    mediaItem: LocalMediaItem,
    timelineItems: Ref<(LocalTimelineItem | AsyncProcessingTimelineItem)[]>,
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
      getAllMediaItems(),
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
   * @param webavModule WebAV模块引用
   * @param cleanupTimelineItem 清理时间轴项目的回调函数
   */
  function removeLocalMediaItem(
    mediaItemId: string,
    timelineItems: Ref<(LocalTimelineItem | AsyncProcessingTimelineItem)[]>,
    tracks: Ref<Track[]>,
    webavModule: { removeSprite: (sprite: any) => void } | null,
    cleanupTimelineItem: (timelineItem: LocalTimelineItem | AsyncProcessingTimelineItem) => void,
  ) {
    const index = mediaItems.value.findIndex((item: LocalMediaItem) => item.id === mediaItemId)
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
        if (webavModule) {
          webavModule.removeSprite(timelineItem.sprite)
          console.log(`✅ 从WebAV画布移除sprite: ${timelineItem.id}`)
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
        getAllMediaItems(),
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
  function getLocalMediaItem(mediaItemId: string): LocalMediaItem | undefined {
    return mediaItems.value.find((item: LocalMediaItem) => item.id === mediaItemId)
  }

  /**
   * 获取所有媒体项目（包括本地和异步处理）
   * @returns 所有媒体项目的联合数组
   */
  function getAllMediaItems(): (LocalMediaItem | AsyncProcessingMediaItem)[] {
    return [...mediaItems.value, ...asyncProcessingItems.value]
  }

  /**
   * 更新媒体项目名称
   * @param mediaItemId 媒体项目ID
   * @param newName 新名称
   */
  function updateLocalMediaItemName(mediaItemId: string, newName: string) {
    const mediaItem = getLocalMediaItem(mediaItemId)
    if (mediaItem && newName.trim()) {
      mediaItem.name = newName.trim()
      console.log(`素材名称已更新: ${mediaItemId} -> ${newName}`)
    }
  }

  /**
   * 更新媒体项目
   * @param updatedMediaItem 更新后的媒体项目
   */
  function updateLocalMediaItem(updatedMediaItem: LocalMediaItem) {
    const index = mediaItems.value.findIndex(
      (item: LocalMediaItem) => item.id === updatedMediaItem.id,
    )
    if (index !== -1) {
      mediaItems.value[index] = updatedMediaItem
      console.log(`媒体项目已更新: ${updatedMediaItem.id} -> ${updatedMediaItem.name}`)
    }
  }

  // ==================== 异步处理素材管理方法 ====================

  /**
   * 添加异步处理素材项目
   * @param asyncProcessingItem 异步处理素材项目
   */
  function addAsyncProcessingItem(asyncProcessingItem: AsyncProcessingMediaItem) {
    asyncProcessingItems.value.push(asyncProcessingItem)
    console.log('🔄 [MediaModule] 添加异步处理素材:', {
      id: asyncProcessingItem.id,
      name: asyncProcessingItem.name,
      type: asyncProcessingItem.processingType,
      status: asyncProcessingItem.processingStatus,
    })
  }

  /**
   * 更新异步处理素材项目
   * @param updatedItem 更新后的异步处理素材项目
   */
  function updateAsyncProcessingItem(updatedItem: AsyncProcessingMediaItem) {
    const index = asyncProcessingItems.value.findIndex((item) => item.id === updatedItem.id)
    if (index !== -1) {
      // 使用 splice 来确保 Vue 能检测到数组变化
      asyncProcessingItems.value.splice(index, 1, updatedItem)
      // console.log('🔄 [MediaModule] 更新异步处理素材:', {
      //   id: updatedItem.id,
      //   status: updatedItem.processingStatus,
      //   progress: updatedItem.processingProgress
      // })
    } else {
      console.warn('🔄 [MediaModule] 未找到要更新的异步处理素材:', updatedItem.id)
    }
  }

  /**
   * 删除异步处理素材项目
   * @param itemId 异步处理素材项目ID
   * @param timelineItems 时间轴项目引用（可选，用于清理相关时间轴项目）
   * @param removeTimelineItemCallback 删除时间轴项目的回调函数（可选）
   */
  function removeAsyncProcessingItem(
    itemId: string,
    timelineItems?: Ref<(LocalTimelineItem | AsyncProcessingTimelineItem)[]>,
    removeTimelineItemCallback?: (timelineItemId: string) => void
  ) {
    const index = asyncProcessingItems.value.findIndex((item) => item.id === itemId)
    if (index !== -1) {
      const item = asyncProcessingItems.value[index]

      // 如果提供了时间轴项目引用，清理相关的异步处理时间轴项目
      if (timelineItems && removeTimelineItemCallback) {
        const relatedTimelineItems = timelineItems.value.filter(
          (timelineItem) => timelineItem.mediaItemId === itemId
        )

        // 删除相关的时间轴项目
        relatedTimelineItems.forEach((timelineItem) => {
          console.log(`🧹 清理异步处理时间轴项目: ${timelineItem.id}`)
          removeTimelineItemCallback(timelineItem.id)
        })

        console.log('🔄 [MediaModule] 删除异步处理素材及相关时间轴项目:', {
          id: itemId,
          name: item.name,
          removedTimelineItemsCount: relatedTimelineItems.length,
          removedTimelineItemIds: relatedTimelineItems.map((item) => item.id),
        })
      } else {
        console.log('🔄 [MediaModule] 删除异步处理素材:', {
          id: itemId,
          name: item.name,
        })
      }

      // 从异步处理素材数组中移除
      asyncProcessingItems.value.splice(index, 1)
    }
  }

  /**
   * 根据ID获取异步处理素材项目
   * @param itemId 异步处理素材项目ID
   * @returns 异步处理素材项目或undefined
   */
  function getAsyncProcessingItem(itemId: string): AsyncProcessingMediaItem | undefined {
    return asyncProcessingItems.value.find((item) => item.id === itemId)
  }

  /**
   * 将异步处理素材转换为普通素材
   * @param asyncProcessingItem 异步处理素材项目
   * @param localMediaItem 转换后的本地素材项目
   */
  function convertAsyncProcessingToLocalMedia(
    asyncProcessingItem: AsyncProcessingMediaItem,
    localMediaItem: LocalMediaItem,
  ) {
    // 删除异步处理素材
    removeAsyncProcessingItem(asyncProcessingItem.id)

    // 添加到普通素材库
    addLocalMediaItem(localMediaItem, ref([]), ref([]))

    console.log('🔄 [MediaModule] 异步处理素材转换完成:', {
      asyncId: asyncProcessingItem.id,
      localId: localMediaItem.id,
      name: localMediaItem.name,
      type: localMediaItem.mediaType,
    })
  }

  // ==================== 视频分辨率管理方法 ====================

  /**
   * 获取视频原始分辨率（从MP4Clip获取）
   * @param mediaItemId 素材ID
   * @returns 视频分辨率对象
   */
  function getVideoOriginalResolution(mediaItemId: string): { width: number; height: number } {
    const mediaItem = getLocalMediaItem(mediaItemId)
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

  // ==================== 图片分辨率管理方法 ====================

  /**
   * 获取图片原始分辨率（从ImgClip获取）
   * @param mediaItemId 素材ID
   * @returns 图片分辨率对象
   */
  function getImageOriginalResolution(mediaItemId: string): { width: number; height: number } {
    const mediaItem = getLocalMediaItem(mediaItemId)
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

  // ==================== 异步等待方法 ====================

  /**
   * 等待媒体项目解析完成
   * 使用Vue的watch机制监听status状态变化，更符合响应式编程模式
   * @param mediaItemId 媒体项目ID
   * @returns Promise<boolean> 解析成功返回true，解析失败抛出错误
   */
  function waitForMediaItemReady(mediaItemId: string): Promise<boolean> {
    const mediaItem = getLocalMediaItem(mediaItemId)

    if (!mediaItem) {
      return Promise.reject(new Error(`找不到媒体项目: ${mediaItemId}`))
    }

    // 使用 Vue watch 监听状态变化，immediate: true 会立即检查当前状态
    return new Promise((resolve, reject) => {
      const unwatch = watch(
        () => mediaItem.status,
        (newStatus) => {
          if (newStatus === 'ready') {
            unwatch()
            resolve(true)
          } else if (newStatus === 'error') {
            unwatch()
            reject(new Error(`媒体项目解析失败: ${mediaItem.name}`))
          }
          // 如果是 'parsing' 状态，继续等待
        },
        { immediate: true } // 立即执行一次，检查当前状态
      )
    })
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    mediaItems,
    asyncProcessingItems,

    // 本地媒体项目管理方法
    addLocalMediaItem,
    removeLocalMediaItem,
    getLocalMediaItem,
    updateLocalMediaItemName,
    updateLocalMediaItem,

    getAllMediaItems,
    // 异步处理素材管理方法
    addAsyncProcessingItem,
    updateAsyncProcessingItem,
    removeAsyncProcessingItem,
    getAsyncProcessingItem,
    convertAsyncProcessingToLocalMedia,

    // 分辨率管理方法
    getVideoOriginalResolution,
    getImageOriginalResolution,

    // 异步等待方法
    waitForMediaItemReady,
  }
}

// 导出类型定义
export type MediaModule = ReturnType<typeof createMediaModule>

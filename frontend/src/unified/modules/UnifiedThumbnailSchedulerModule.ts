/**
 * 统一缩略图调度器模块
 * 模块化重构版本，替代原有的 ThumbnailScheduler 类
 */

import { ref } from 'vue'
import { throttle } from 'lodash'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import type { UnifiedMediaItemData } from '@/unified/mediaitem'
import type {
  ThumbnailLayoutItem,
  ThumbnailBatchRequest,
  CachedThumbnail,
} from '@/unified/types/thumbnail'
import {
  canvasToBlob,
  calculateThumbnailSize,
  createThumbnailCanvas,
} from '@/unified/utils/thumbnailGenerator'
import { framesToMicroseconds } from '@/unified/utils/timeUtils'
import { ThumbnailMode, THUMBNAIL_CONSTANTS } from '@/unified/constants/ThumbnailConstants'
import { UnifiedMediaItemQueries } from '@/unified/mediaitem/queries'

export function createUnifiedThumbnailSchedulerModule(
  timelineModule: {
    getTimelineItem: (id: string) => UnifiedTimelineItemData | undefined
  },
  mediaModule: {
    getMediaItem: (id: string) => UnifiedMediaItemData | undefined
  },
) {
  // 状态定义
  const pendingRequests = ref(
    new Map<string, Array<{ framePosition: number; timestamp: number }>>(),
  )

  // 缩略图缓存状态（从unifiedStore.ts迁移）
  const thumbnailCache = ref(new Map<string, CachedThumbnail>())

  // 节流处理器
  const throttledProcessor = throttle(() => processAllPendingRequests(), 333, {
    leading: false,
    trailing: true,
  })

  /**
   * 添加缩略图请求（由VideoContent.vue调用）
   */
  async function requestThumbnails(request: ThumbnailBatchRequest): Promise<void> {
    const { timelineItemId, thumbnailLayout, timestamp } = request

    // 1. 将请求按时间轴项目存储
    const requests = pendingRequests.value.get(timelineItemId) || []

    // 2. 将缩略图布局转换为内部请求格式
    const newRequests = thumbnailLayout.map((item) => ({
      framePosition: item.framePosition,
      timestamp,
    }))

    // 合并请求，保留最新的时间戳
    const mergedRequests = [...requests, ...newRequests].reduce(
      (acc, curr) => {
        const existing = acc.find((r) => r.framePosition === curr.framePosition)
        if (existing) {
          // 保留最新的时间戳
          if (curr.timestamp > existing.timestamp) {
            existing.timestamp = curr.timestamp
          }
        } else {
          acc.push(curr)
        }
        return acc
      },
      [] as Array<{ framePosition: number; timestamp: number }>,
    )

    pendingRequests.value.set(timelineItemId, mergedRequests)

    // 3. 触发节流处理器
    throttledProcessor()
  }

  /**
   * 处理所有待处理的请求
   */
  async function processAllPendingRequests(): Promise<void> {
    // 1. 创建当前请求快照并清空队列
    const requestsSnapshot = new Map(pendingRequests.value)
    pendingRequests.value.clear()

    // 2. 按时间轴项目逐个处理
    for (const [timelineItemId, requests] of requestsSnapshot) {
      try {
        console.log('🔍 处理缩略图请求:', timelineItemId)
        await processTimelineItemRequests(timelineItemId, requests)
        console.log('✅ 处理缩略图请求成功:', timelineItemId)
      } catch (error) {
        console.error('❌ 处理缩略图请求失败:', error)
      }
    }
  }

  /**
   * 处理单个时间轴项目的请求
   */
  async function processTimelineItemRequests(
    timelineItemId: string,
    requests: Array<{ framePosition: number; timestamp: number }>,
  ): Promise<void> {
    // 1. 获取时间轴项目数据
    const timelineItem = timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.error('❌ 找不到时间轴项目:', timelineItemId)
      return
    }

    // 2. 构建缩略图布局数组
    const thumbnailLayout: ThumbnailLayoutItem[] = requests.map((request, index) => ({
      index,
      framePosition: request.framePosition,
      timelineFramePosition: 0, // 这个值在批量处理中不重要
      pixelPosition: 0, // 这个值在批量处理中不重要
      thumbnailUrl: null,
    }))

    // 3. 调用批量处理
    await processBatch(timelineItem, thumbnailLayout)
  }

  /**
   * 批量处理缩略图生成
   */
  async function processBatch(
    timelineItem: UnifiedTimelineItemData,
    thumbnailLayout: ThumbnailLayoutItem[],
  ): Promise<void> {
    // 1. 获取媒体项目数据
    const mediaItem = mediaModule.getMediaItem(timelineItem.mediaItemId)
    if (!mediaItem) {
      console.error('❌ 找不到对应的媒体项目:', timelineItem.mediaItemId)
      return
    }

    // 2. 按帧位置排序缩略图布局
    const sortedLayout = [...thumbnailLayout].sort((a, b) => a.framePosition - b.framePosition)

    // 3. 处理视频和图片媒体项目
    if (UnifiedMediaItemQueries.isVideo(mediaItem) && mediaItem.webav?.mp4Clip) {
      // 视频处理逻辑
      let mp4Clip: any = null
      try {
        // 等待MP4Clip准备完成
        const meta = await mediaItem.webav.mp4Clip.ready
        mp4Clip = await mediaItem.webav.mp4Clip.clone()
        // 合并第一步和第二步：在一个循环中执行tick调用并处理缩略图生成
        const thumbnailPromises = []

        for (const item of sortedLayout) {
          let videoFrame: any = null
          try {
            // 计算时间位置
            const timePosition = framesToMicroseconds(item.framePosition)

            // 执行tick调用
            const tickResult = await mp4Clip.tick(timePosition)

            if (tickResult.state !== 'success' || !tickResult.video) {
              console.error(
                `❌ 无法获取视频帧${item.framePosition}: ${tickResult.state} ${tickResult.video}`,
              )
              continue
            }
            videoFrame = tickResult.video

            // 计算缩略图尺寸（使用FILL模式填满容器）
            const sizeInfo = calculateThumbnailSize(
              meta.width,
              meta.height,
              THUMBNAIL_CONSTANTS.WIDTH,
              THUMBNAIL_CONSTANTS.HEIGHT,
              ThumbnailMode.FILL,
            )

            // 创建缩略图canvas
            const canvas = createThumbnailCanvas(videoFrame, sizeInfo)

            // 异步处理canvas转换并设置缓存
            thumbnailPromises.push(
              canvasToBlob(canvas)
                .then((thumbnailUrl) => {
                  // 转换为 Blob URL 并更新模块缓存
                  cacheThumbnail({
                    blobUrl: thumbnailUrl,
                    timestamp: Date.now(),
                    timelineItemId: timelineItem.id,
                    framePosition: item.framePosition,
                    clipStartTime: timelineItem.timeRange.clipStartTime || 0,
                    clipEndTime: timelineItem.timeRange.clipEndTime || 0,
                  })

                  return {
                    framePosition: item.framePosition,
                    thumbnailUrl,
                    canvas,
                  }
                })
                .catch((error) => {
                  console.error('❌ canvas转换失败:', error)
                  return null
                }),
            )
          } catch (error) {
            console.error('❌ mp4Clip.tick调用失败:', error)
          } finally {
            // 清理VideoFrame资源
            if (videoFrame) {
              videoFrame.close()
            }
          }
        }

        // 等待所有缩略图生成完成
        await Promise.all(thumbnailPromises)
      } catch (error) {
        console.error('❌ 批量视频缩略图生成失败:', error)
      } finally {
        if (mp4Clip) {
          mp4Clip.destroy()
        }
      }
    } else if (UnifiedMediaItemQueries.isImage(mediaItem) && mediaItem.webav?.imgClip) {
      // 图片处理逻辑 - 所有帧使用相同的缩略图
      let imgClip: any = null
      try {
        // 等待ImgClip准备完成
        const meta = await mediaItem.webav.imgClip.ready
        imgClip = await mediaItem.webav.imgClip.clone()

        // 使用tick获取图片数据（时间参数对静态图片无意义，传0即可）
        const tickResult = await imgClip.tick(0)

        if (tickResult.state !== 'success' || !tickResult.video) {
          console.error('❌ 无法获取图片数据')
          return
        }

        // 计算缩略图尺寸（使用FILL模式填满容器）
        const sizeInfo = calculateThumbnailSize(
          meta.width,
          meta.height,
          THUMBNAIL_CONSTANTS.WIDTH,
          THUMBNAIL_CONSTANTS.HEIGHT,
          ThumbnailMode.FILL,
        )

        // 创建缩略图canvas
        const canvas = createThumbnailCanvas(tickResult.video, sizeInfo)

        // 生成缩略图URL
        const thumbnailUrl = await canvasToBlob(canvas)

        // 对于图片类型，所有帧使用相同的缩略图，只需要设置一次缓存
        cacheThumbnail({
          blobUrl: thumbnailUrl,
          timestamp: Date.now(),
          timelineItemId: timelineItem.id,
          framePosition: 0, // 图片使用固定帧位置0
          clipStartTime: 0, // 图片使用固定clipStartTime 0
          clipEndTime: 0, // 图片使用固定clipEndTime 0
        })

        // 清理VideoFrame资源
        if ('close' in tickResult.video) {
          tickResult.video.close()
        }
      } catch (error) {
        console.error('❌ 批量图片缩略图生成失败:', error)
      } finally {
        if (imgClip) {
          imgClip.destroy()
        }
      }
    } else {
      console.warn('⚠️ 批量处理器只支持视频和图片媒体项目，跳过非支持项目:', mediaItem.mediaType)
    }
  }

  /**
   * 取消指定项目的待处理任务
   */
  function cancelTasks(timelineItemId: string): void {
    pendingRequests.value.delete(timelineItemId)
  }

  /**
   * 清理所有待处理任务
   */
  function cleanup(): void {
    pendingRequests.value.clear()
  }

  // 缓存管理方法（从unifiedStore.ts迁移）
  function clearThumbnailCacheByTimelineItem(timelineItemId: string): number {
    let removedCount = 0

    for (const [key, cached] of thumbnailCache.value.entries()) {
      if (cached.timelineItemId === timelineItemId) {
        // 释放Blob URL资源
        if (cached.blobUrl.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(cached.blobUrl)
          } catch (error) {
            console.warn('释放Blob URL失败:', error)
          }
        }
        thumbnailCache.value.delete(key)
        removedCount++
      }
    }

    return removedCount
  }

  function cleanupThumbnailCache(maxSize: number = 1000): number {
    if (thumbnailCache.value.size <= maxSize) {
      return 0
    }

    // 按时间戳排序，保留最新的
    const entries = Array.from(thumbnailCache.value.entries()).sort(
      ([, a], [, b]) => b.timestamp - a.timestamp,
    ) // 降序排序，最新的在前

    let removedCount = 0

    // 删除超出限制的最旧项
    for (let i = maxSize; i < entries.length; i++) {
      const [key, cached] = entries[i]

      // 释放Blob URL资源
      if (cached.blobUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(cached.blobUrl)
        } catch (error) {
          console.warn('释放Blob URL失败:', error)
        }
      }

      thumbnailCache.value.delete(key)
      removedCount++
    }

    return removedCount
  }

  function getCachedThumbnail(timelineItemId: string, frame: number): CachedThumbnail | undefined {
    const cacheKey = generateCacheKey(timelineItemId, frame, 0, 0)
    return thumbnailCache.value.get(cacheKey)
  }

  function cacheThumbnail(thumbnail: CachedThumbnail): void {
    const cacheKey = generateCacheKey(
      thumbnail.timelineItemId,
      thumbnail.framePosition,
      thumbnail.clipStartTime,
      thumbnail.clipEndTime,
    )

    // 检查是否已存在相同key的缓存，如果存在则释放旧的Blob URL
    const existing = thumbnailCache.value.get(cacheKey)
    if (existing && existing.blobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(existing.blobUrl)
    }

    thumbnailCache.value.set(cacheKey, thumbnail)
  }

  // 工具函数（从thumbnailCacheUtils.ts迁移）
  function generateCacheKey(
    timelineItemId: string,
    framePosition: number,
    clipStartTime: number,
    clipEndTime: number,
  ): string {
    // 格式: ${timelineItemId}-${framePosition}-${clipStartTime}-${clipEndTime}
    return `${timelineItemId}-${framePosition}-${clipStartTime}-${clipEndTime}`
  }

  function getThumbnailUrl(
    timelineItemId: string,
    framePosition: number,
    clipStartTime: number,
    clipEndTime: number,
  ): string | null {
    const cacheKey = generateCacheKey(timelineItemId, framePosition, clipStartTime, clipEndTime)
    const cached = thumbnailCache.value.get(cacheKey)
    return cached?.blobUrl || null
  }

  return {
    requestThumbnails,
    cancelTasks,
    cleanup,
    pendingRequests, // 可选：用于调试

    // 缓存管理相关导出
    thumbnailCache,
    clearThumbnailCacheByTimelineItem,
    cleanupThumbnailCache,
    getCachedThumbnail,
    cacheThumbnail,

    // 工具函数导出
    generateCacheKey,
    getThumbnailUrl,
  }
}

export type UnifiedThumbnailSchedulerModule = ReturnType<
  typeof createUnifiedThumbnailSchedulerModule
>

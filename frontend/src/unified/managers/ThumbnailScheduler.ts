/**
 * 优化的缩略图调度器类
 * 使用定时触发机制管理缩略图生成任务的调度，包含批量缩略图生成功能
 */

import type { MP4Clip, ImgClip } from '@webav/av-cliper'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import type { ThumbnailLayoutItem, ThumbnailBatchRequest, CachedThumbnail } from '@/unified/types/thumbnail'
import {
  canvasToBlob,
  calculateThumbnailSize,
  createThumbnailCanvas,
} from '@/unified/utils/thumbnailGenerator'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { generateCacheKey } from '@/unified/utils/'
import { framesToMicroseconds } from '@/unified/utils/timeUtils'
import { ThumbnailMode, THUMBNAIL_CONSTANTS } from '@/unified/constants/ThumbnailConstants'
import { UnifiedMediaItemQueries } from '@/unified/mediaitem/queries'
import { throttle } from 'lodash'

export class ThumbnailScheduler {
  private pendingRequests = new Map<string, Array<{framePosition: number, timestamp: number}>>()
  private throttledProcessor: () => void

  constructor() {
    // 使用lodash的throttle函数，333ms间隔
    this.throttledProcessor = throttle(
      () => this.processAllPendingRequests(),
      333,
      { leading: false, trailing: true }
    )
  }

  /**
   * 添加缩略图请求（由VideoContent.vue调用）
   */
  requestThumbnails(request: ThumbnailBatchRequest): void {
    const { timelineItemId, thumbnailLayout, timestamp } = request

    // 1. 将请求按时间轴项目存储
    const requests = this.pendingRequests.get(timelineItemId) || []
    
    // 2. 将缩略图布局转换为内部请求格式
    const newRequests = thumbnailLayout.map(item => ({
      framePosition: item.framePosition,
      timestamp
    }))

    // 合并请求，保留最新的时间戳
    const mergedRequests = [...requests, ...newRequests]
      .reduce((acc, curr) => {
        const existing = acc.find(r => r.framePosition === curr.framePosition)
        if (existing) {
          // 保留最新的时间戳
          if (curr.timestamp > existing.timestamp) {
            existing.timestamp = curr.timestamp
          }
        } else {
          acc.push(curr)
        }
        return acc
      }, [] as Array<{framePosition: number, timestamp: number}>)

    this.pendingRequests.set(timelineItemId, mergedRequests)

    // 3. 触发节流处理器
    this.throttledProcessor()
  }

  /**
   * 处理所有待处理的请求
   */
  private async processAllPendingRequests(): Promise<void> {
    // 1. 创建当前请求快照并清空队列
    const requestsSnapshot = new Map(this.pendingRequests)
    this.pendingRequests.clear()

    // 2. 按时间轴项目逐个处理
    for (const [timelineItemId, requests] of requestsSnapshot) {
      try {
        console.log('🔍 处理缩略图请求:', timelineItemId)
        await this.processTimelineItemRequests(timelineItemId, requests)
        console.log('✅ 处理缩略图请求成功:', timelineItemId)
      } catch (error) {
        console.error('❌ 处理缩略图请求失败:', error)
      }
    }
  }

  /**
   * 处理单个时间轴项目的请求
   */
  private async processTimelineItemRequests(
    timelineItemId: string,
    requests: Array<{framePosition: number, timestamp: number}>
  ): Promise<void> {
    const unifiedStore = useUnifiedStore()

    // 1. 获取时间轴项目数据
    const timelineItem = unifiedStore.getTimelineItem(timelineItemId)
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
      thumbnailUrl: null
    }))

    // 3. 调用批量处理
    await this.processBatch(timelineItem, thumbnailLayout)
  }

  /**
   * 取消指定项目的待处理任务
   */
  cancelTasks(timelineItemId: string): void {
    this.pendingRequests.delete(timelineItemId)
  }

  /**
   * 清理所有待处理任务
   */
  cleanup(): void {
    this.pendingRequests.clear()
  }
  /**
   * 批量处理缩略图生成
   */
  private async processBatch(
    timelineItem: UnifiedTimelineItemData,
    thumbnailLayout: ThumbnailLayoutItem[],
  ): Promise<Map<number, string>> {
    const unifiedStore = useUnifiedStore()
    const results = new Map<number, string>()

    // 1. 获取媒体项目数据
    const mediaItem = unifiedStore.getMediaItem(timelineItem.mediaItemId)
    if (!mediaItem) {
      console.error('❌ 找不到对应的媒体项目:', timelineItem.mediaItemId)
      return results
    }

    // 2. 按帧位置排序缩略图布局
    const sortedLayout = [...thumbnailLayout].sort((a, b) => a.framePosition - b.framePosition)

    // 3. 处理视频和图片媒体项目
    if (UnifiedMediaItemQueries.isVideo(mediaItem) && mediaItem.webav?.mp4Clip) {
      // 视频处理逻辑
      let mp4Clip: MP4Clip | null = null
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
                  // 转换为 Blob URL 并更新全局响应式缓存
                  const cacheKey = generateCacheKey(
                    timelineItem.id,
                    item.framePosition,
                    timelineItem.timeRange.clipStartTime || 0,
                    timelineItem.timeRange.clipEndTime || 0,
                  )

                  // 更新全局缓存
                  unifiedStore.thumbnailCache.set(cacheKey, {
                    blobUrl: thumbnailUrl,
                    timestamp: Date.now(),
                    timelineItemId: timelineItem.id,
                    framePosition: item.framePosition,
                    clipStartTime: timelineItem.timeRange.clipStartTime || 0,
                    clipEndTime: timelineItem.timeRange.clipEndTime || 0,
                  })

                  results.set(item.framePosition, thumbnailUrl)

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
          return results
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

        // 为所有请求的帧设置相同的缩略图URL
        for (const item of sortedLayout) {
          // 对于图片类型，所有帧使用相同的缓存键（帧位置、clipStartTime、clipEndTime都固定为0）
          const cacheKey = generateCacheKey(
            timelineItem.id,
            0, // 图片使用固定帧位置0
            0, // 图片使用固定clipStartTime 0
            0, // 图片使用固定clipEndTime 0
          )

          // 更新全局缓存
          unifiedStore.thumbnailCache.set(cacheKey, {
            blobUrl: thumbnailUrl,
            timestamp: Date.now(),
            timelineItemId: timelineItem.id,
            framePosition: 0, // 图片使用固定帧位置0
            clipStartTime: 0, // 图片使用固定clipStartTime 0
            clipEndTime: 0, // 图片使用固定clipEndTime 0
          })

          results.set(item.framePosition, thumbnailUrl)
        }

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
      return results
    }

    return results
  }
}

// 导出单例实例
export const thumbnailScheduler = new ThumbnailScheduler()
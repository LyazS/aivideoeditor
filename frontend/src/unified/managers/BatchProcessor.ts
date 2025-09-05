/**
 * 批量处理器类
 * 负责批量生成缩略图，优化MP4Clip重用和缓存管理
 */
import type { MP4Clip } from '@webav/av-cliper'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import type { ThumbnailLayoutItem, CachedThumbnail } from '@/unified/types/thumbnail'
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

export class BatchProcessor {
  /**
   * 批量处理缩略图生成
   */
  async processBatch(
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

    // 3. 只处理视频媒体项目
    if (!UnifiedMediaItemQueries.isVideo(mediaItem) || !mediaItem.webav?.mp4Clip) {
      console.warn('⚠️ 批量处理器只支持视频媒体项目，跳过非视频项目:', mediaItem.mediaType)
      return results
    }

    let mp4Clip: MP4Clip | null = null
    // 4. 批量处理所有帧
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
      console.error('❌ 批量缩略图生成失败:', error)
    } finally {
      if (mp4Clip) {
        mp4Clip.destroy()
      }
    }

    return results
  }
}

// 导出单例实例
export const batchProcessor = new BatchProcessor()

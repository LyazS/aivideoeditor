/**
 * 批量处理器类
 * 负责批量生成缩略图，优化MP4Clip重用和缓存管理
 */

import type { UnifiedMediaItemData } from '@/unified/mediaitem/types'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import type { ThumbnailLayoutItem, CachedThumbnail } from '@/unified/types/thumbnail'
import { generateVideoThumbnail, canvasToBlob } from '@/unified/utils/thumbnailGenerator'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { generateCacheKey } from '@/unified/utils/'
import { ThumbnailMode, THUMBNAIL_CONSTANTS } from '@/unified/constants/ThumbnailConstants'

export class BatchProcessor {
  /**
   * 批量处理缩略图生成
   */
  async processBatch(
    timelineItem: UnifiedTimelineItemData,
    thumbnailLayout: ThumbnailLayoutItem[]
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

    // 3. 循环处理每个帧
    for (const item of sortedLayout) {
      try {
        // 计算时间位置
        const timePosition = this.calculateTimePosition(mediaItem, item.framePosition)
        
        // 只处理视频媒体项目，使用专门的视频缩略图生成函数
        if (mediaItem.mediaType === 'video' && mediaItem.webav?.mp4Clip) {
          // 使用 generateVideoThumbnail 生成缩略图canvas
          const canvas = await generateVideoThumbnail(
            mediaItem.webav.mp4Clip,
            timePosition,
            THUMBNAIL_CONSTANTS.WIDTH, // 使用常量中的宽度
            THUMBNAIL_CONSTANTS.HEIGHT, // 使用常量中的高度
            ThumbnailMode.FILL, // 使用填满模式
            false  // 不克隆MP4Clip（批量处理中重用同一个clip）
          )
          
          // 将canvas转换为Blob URL
          const thumbnailUrl = await canvasToBlob(canvas)

          if (thumbnailUrl) {
            // 转换为 Blob URL 并更新全局响应式缓存
            const cacheKey = generateCacheKey(
              timelineItem.id,
              item.framePosition,
              timelineItem.timeRange?.clipStartTime || 0,
              timelineItem.timeRange?.clipEndTime || 0
            )

            // 更新全局缓存
            unifiedStore.thumbnailCache.set(cacheKey, {
              blobUrl: thumbnailUrl,
              timestamp: Date.now(),
              timelineItemId: timelineItem.id,
              framePosition: item.framePosition,
              clipStartTime: timelineItem.timeRange?.clipStartTime || 0,
              clipEndTime: timelineItem.timeRange?.clipEndTime || 0
            })

            results.set(item.framePosition, thumbnailUrl)
          }
        } else {
          console.warn('⚠️ 批量处理器只支持视频媒体项目，跳过非视频项目:', mediaItem.mediaType)
        }
      } catch (error) {
        console.error('❌ 缩略图生成失败:', error)
      }
    }

    return results
  }

  /**
   * 根据帧位置计算时间位置
   */
  private calculateTimePosition(
    mediaItem: UnifiedMediaItemData,
    frame: number
  ): number | undefined {
    if (!mediaItem.duration) return undefined

    // 假设帧率为30fps，计算时间位置（微秒）
    const frameRate = 30
    const timeInSeconds = frame / frameRate
    return timeInSeconds * 1000000 // 转换为微秒
  }
}

// 导出单例实例
export const batchProcessor = new BatchProcessor()
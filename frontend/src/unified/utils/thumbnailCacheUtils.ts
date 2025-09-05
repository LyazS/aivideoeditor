/**
 * 缩略图缓存相关工具函数
 */

import type { CachedThumbnail } from '@/unified/types/thumbnail'
import { useUnifiedStore } from '@/unified/unifiedStore'

/**
 * 缓存键生成函数
 */
export function generateCacheKey(
  timelineItemId: string,
  framePosition: number,
  clipStartTime: number,
  clipEndTime: number
): string {
  // 格式: ${timelineItemId}-${framePosition}-${clipStartTime}-${clipEndTime}
  return `${timelineItemId}-${framePosition}-${clipStartTime}-${clipEndTime}`
}

/**
 * 获取缓存的缩略图URL
 */
export function getThumbnailUrl(
  timelineItemId: string,
  framePosition: number,
  clipStartTime: number,
  clipEndTime: number
): string | null {
  const { thumbnailCache } = useUnifiedStore()
  const cacheKey = generateCacheKey(timelineItemId, framePosition, clipStartTime, clipEndTime)
  const cached = thumbnailCache.get(cacheKey)
  return cached?.blobUrl || null
}

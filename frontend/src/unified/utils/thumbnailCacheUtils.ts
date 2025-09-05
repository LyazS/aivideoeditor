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
 * 从缓存键解析信息
 */
export function parseCacheKey(cacheKey: string): {
  timelineItemId: string
  framePosition: number
  clipStartTime: number
  clipEndTime: number
} | null {
  const parts = cacheKey.split('-')
  if (parts.length !== 4) {
    return null
  }

  try {
    return {
      timelineItemId: parts[0],
      framePosition: parseInt(parts[1], 10),
      clipStartTime: parseInt(parts[2], 10),
      clipEndTime: parseInt(parts[3], 10)
    }
  } catch {
    return null
  }
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

/**
 * 检查缓存是否有效（基于时间戳）
 */
export function isCacheValid(cachedThumbnail: CachedThumbnail, maxAgeMs: number = 300000): boolean {
  return Date.now() - cachedThumbnail.timestamp < maxAgeMs
}

/**
 * 清理过期的缓存项
 */
export function cleanupExpiredCache(maxAgeMs: number = 300000): number {
  const { thumbnailCache } = useUnifiedStore()
  let removedCount = 0

  for (const [key, cached] of thumbnailCache.entries()) {
    if (!isCacheValid(cached, maxAgeMs)) {
      // 释放Blob URL资源
      if (cached.blobUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(cached.blobUrl)
        } catch (error) {
          console.warn('释放Blob URL失败:', error)
        }
      }
      thumbnailCache.delete(key)
      removedCount++
    }
  }

  return removedCount
}

/**
 * 根据时间轴项目ID清理缓存
 */
export function cleanupCacheByTimelineItem(timelineItemId: string): number {
  const { thumbnailCache } = useUnifiedStore()
  let removedCount = 0

  for (const [key, cached] of thumbnailCache.entries()) {
    if (cached.timelineItemId === timelineItemId) {
      // 释放Blob URL资源
      if (cached.blobUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(cached.blobUrl)
        } catch (error) {
          console.warn('释放Blob URL失败:', error)
        }
      }
      thumbnailCache.delete(key)
      removedCount++
    }
  }

  return removedCount
}

/**
 * 实现LRU缓存清理策略
 */
export function cleanupCacheLRU(maxSize: number = 1000): number {
  const { thumbnailCache } = useUnifiedStore()
  
  if (thumbnailCache.size <= maxSize) {
    return 0
  }

  // 按时间戳排序，保留最新的
  const entries = Array.from(thumbnailCache.entries())
    .sort(([, a], [, b]) => b.timestamp - a.timestamp) // 降序排序，最新的在前

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
    
    thumbnailCache.delete(key)
    removedCount++
  }

  return removedCount
}
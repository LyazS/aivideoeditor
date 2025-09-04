/**
 * 实时缩略图生成管理器
 * 用于验证前置方案，无需缓存，直接实时生成
 */

import type { UnifiedMediaItemData } from '@/unified/mediaitem/types'
import { generateThumbnailForUnifiedMediaItem } from '@/unified/utils/thumbnailGenerator'
import { ThumbnailMode,THUMBNAIL_CONSTANTS } from '@/unified/constants/ThumbnailConstants'

export class RealtimeThumbnailManager {
  private generatingTasks = new Map<string, Promise<string | null>>()
  private generationCount = 0
  private successCount = 0
  private totalTime = 0

  /**
   * 实时生成缩略图
   */
  async generateThumbnail(
    timelineItemId: string,
    frame: number,
    mediaItem: UnifiedMediaItemData,
  ): Promise<string | null> {
    const taskKey = `${timelineItemId}-${frame}`

    // 如果正在生成，返回null表示正在处理
    if (this.generatingTasks.has(taskKey)) {
      return null
    }

    const startTime = performance.now()
    this.generationCount++

    try {
      // 创建生成任务
      const generationPromise = this.createThumbnail(mediaItem, frame)
      this.generatingTasks.set(taskKey, generationPromise)

      const thumbnailUrl = await generationPromise
      this.successCount++

      return thumbnailUrl
    } catch (error) {
      console.error('缩略图生成失败:', error)
      return null
    } finally {
      const endTime = performance.now()
      this.totalTime += endTime - startTime
      this.generatingTasks.delete(taskKey)
    }
  }

  /**
   * 创建缩略图（核心生成逻辑）
   */
  private async createThumbnail(
    mediaItem: UnifiedMediaItemData,
    frame: number,
  ): Promise<string | null> {
    // 计算时间位置（微秒）
    const timePosition = this.calculateTimePosition(mediaItem, frame)

    console.log(
      `🔄 生成缩略图: frame=${frame}, time=${timePosition ? timePosition / 1000000 : 'N/A'}s`,
    )

    // 使用现有的缩略图生成器，处理可能的undefined返回值
    const result = await generateThumbnailForUnifiedMediaItem(
      mediaItem,
      timePosition,
      THUMBNAIL_CONSTANTS.WIDTH, // 缩略图宽度
      THUMBNAIL_CONSTANTS.HEIGHT, // 缩略图高度
      ThumbnailMode.FILL,
    )

    return result || null
  }

  /**
   * 根据帧位置计算时间位置
   */
  private calculateTimePosition(
    mediaItem: UnifiedMediaItemData,
    frame: number,
  ): number | undefined {
    if (!mediaItem.duration) return undefined

    // 假设帧率为30fps，计算时间位置（微秒）
    const frameRate = 30
    const timeInSeconds = frame / frameRate
    return timeInSeconds * 1000000 // 转换为微秒
  }

  /**
   * 获取性能统计
   */
  getStats() {
    return {
      totalGenerations: this.generationCount,
      successCount: this.successCount,
      successRate: this.generationCount > 0 ? (this.successCount / this.generationCount) * 100 : 0,
      averageTimeMs: this.generationCount > 0 ? this.totalTime / this.generationCount : 0,
      activeTasks: this.generatingTasks.size,
    }
  }

  /**
   * 清理所有生成任务
   */
  cleanup() {
    this.generatingTasks.clear()
  }
}

// 导出单例实例
export const realtimeThumbnailManager = new RealtimeThumbnailManager()

/**
 * 优化的缩略图调度器类
 * 使用定时触发机制管理缩略图生成任务的调度
 */

import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import type { ThumbnailLayoutItem, ThumbnailBatchRequest } from '@/unified/types/thumbnail'
import { batchProcessor } from './BatchProcessor'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { throttle } from 'lodash'

export class ThumbnailScheduler {
  private pendingRequests = new Map<string, Array<{framePosition: number, timestamp: number}>>()
  private batchProcessor = batchProcessor
  private throttledProcessor: () => void

  constructor() {
    // 使用lodash的throttle函数，1秒间隔
    this.throttledProcessor = throttle(
      () => this.processAllPendingRequests(),
      1000,
      { leading: false, trailing: true }
    )
  }

  /**
   * 添加缩略图请求（由VideoContent.vue调用）
   */
  requestThumbnails(request: ThumbnailBatchRequest): void {
    const { timelineItem, thumbnailLayout, timestamp } = request

    // 1. 将请求按时间轴项目存储
    const requests = this.pendingRequests.get(timelineItem.id) || []
    
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

    this.pendingRequests.set(timelineItem.id, mergedRequests)

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
        await this.processTimelineItemRequests(timelineItemId, requests)
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

    // 3. 调用批量处理器
    await this.batchProcessor.processBatch(timelineItem, thumbnailLayout)
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
}

// 导出单例实例
export const thumbnailScheduler = new ThumbnailScheduler()
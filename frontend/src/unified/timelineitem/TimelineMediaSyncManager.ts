/**
 * 响应式时间轴项目与媒体项目的状态同步管理器
 * 基于Vue3的watch机制实现自动状态同步
 */

import { watch, type WatchStopHandle } from 'vue'
import type { UnifiedMediaItemData } from '../mediaitem'
import type {
  UnifiedTimelineItemData,
  BasicTimelineConfig,
} from './TimelineItemData'
import { MEDIA_TO_TIMELINE_STATUS_MAP } from './TimelineItemData'
import { createTimelineItemData } from './TimelineItemFactory'
import { transitionTimelineStatus } from './TimelineItemBehaviors'


/**
 * 响应式时间轴项目与媒体项目的状态同步管理器
 * 基于Vue3的watch机制实现自动状态同步
 */
export class TimelineMediaSyncManager {
  private static instance: TimelineMediaSyncManager
  private timelineItems = new Map<string, UnifiedTimelineItemData>()
  private mediaItems = new Map<string, UnifiedMediaItemData>()
  private watchStopHandles = new Map<string, WatchStopHandle>() // 用于清理watch

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): TimelineMediaSyncManager {
    if (!TimelineMediaSyncManager.instance) {
      TimelineMediaSyncManager.instance = new TimelineMediaSyncManager()
    }
    return TimelineMediaSyncManager.instance
  }

  /**
   * 注册媒体项目
   */
  registerMediaItem(mediaData: UnifiedMediaItemData): void {
    this.mediaItems.set(mediaData.id, mediaData)
    console.log(`📝 注册媒体项目: ${mediaData.id}`)
  }

  /**
   * 注册时间轴项目，建立与媒体项目的响应式关联
   */
  registerTimelineItem(timelineData: UnifiedTimelineItemData): void {
    this.timelineItems.set(timelineData.id, timelineData)

    // 检查关联媒体项目的状态
    const mediaData = this.mediaItems.get(timelineData.mediaItemId)
    if (mediaData) {
      // 验证MediaItem是否ready
      if (mediaData.mediaStatus !== 'ready') {
        console.warn(`⚠️ TimelineItem ${timelineData.id} 关联的MediaItem ${mediaData.id} 尚未ready`)
      }
      this.setupMediaStatusSync(timelineData, mediaData)
    } else {
      console.error(`❌ TimelineItem ${timelineData.id} 找不到关联的MediaItem ${timelineData.mediaItemId}`)
    }

    console.log(`📝 注册时间轴项目: ${timelineData.id}`)
  }

  /**
   * 建立媒体项目状态到时间轴项目状态的响应式同步
   */
  private setupMediaStatusSync(
    timelineData: UnifiedTimelineItemData,
    mediaData: UnifiedMediaItemData
  ): void {
    // 使用Vue3的watch建立响应式同步
    const stopHandle = watch(
      () => mediaData.mediaStatus,
      async (newStatus, oldStatus) => {
        const targetTimelineStatus = MEDIA_TO_TIMELINE_STATUS_MAP[newStatus]

        if (timelineData.timelineStatus !== targetTimelineStatus) {
          // 直接进行状态转换，不再使用复杂的上下文模板
          await transitionTimelineStatus(timelineData, targetTimelineStatus)

          console.log(`🔄 状态同步: MediaItem(${newStatus}) → TimelineItem(${targetTimelineStatus})`)
        }
      },
      { immediate: true } // 立即执行一次同步当前状态
    )

    // 保存停止句柄，用于清理
    this.watchStopHandles.set(timelineData.id, stopHandle)
  }



  /**
   * 响应式时间轴项目工厂方法
   * 确保只有ready状态的MediaItem才能直接创建ready的TimelineItem
   */
  createTimelineItem(
    mediaItemId: string,
    trackId: string,
    timeRange: { timelineStartTime: number; timelineEndTime: number },
    config: BasicTimelineConfig
  ): UnifiedTimelineItemData | null {
    const mediaData = this.mediaItems.get(mediaItemId)

    if (!mediaData) {
      console.error(`❌ 找不到MediaItem: ${mediaItemId}`)
      return null
    }

    // 创建响应式TimelineItem数据
    const timelineData = createTimelineItemData({
      mediaItemId,
      trackId,
      timeRange,
      config,
      mediaType: mediaData.mediaType
    })

    // 根据MediaItem状态设置初始状态
    const initialStatus = MEDIA_TO_TIMELINE_STATUS_MAP[mediaData.mediaStatus]

    // 同步设置初始状态（不需要await，因为是同步操作）
    timelineData.timelineStatus = initialStatus
    // 不再设置 statusContext，UI组件直接基于媒体数据计算显示信息

    // 注册到管理器（建立响应式同步）
    this.registerTimelineItem(timelineData)

    console.log(`✅ 创建时间轴项目: ${timelineData.id}, 初始状态: ${initialStatus}`)

    return timelineData
  }

  /**
   * 批量创建时间轴项目
   */
  createMultipleTimelineItems(requests: Array<{
    mediaItemId: string
    trackId: string
    timeRange: { timelineStartTime: number; timelineEndTime: number }
    config: BasicTimelineConfig
  }>): UnifiedTimelineItemData[] {
    const results: UnifiedTimelineItemData[] = []

    for (const request of requests) {
      const item = this.createTimelineItem(
        request.mediaItemId,
        request.trackId,
        request.timeRange,
        request.config
      )
      
      if (item) {
        results.push(item)
      }
    }

    console.log(`✅ 批量创建时间轴项目: ${results.length}/${requests.length}`)
    return results
  }

  /**
   * 清理时间轴项目（停止响应式监听）
   */
  unregisterTimelineItem(timelineId: string): void {
    // 停止watch监听
    const stopHandle = this.watchStopHandles.get(timelineId)
    if (stopHandle) {
      stopHandle()
      this.watchStopHandles.delete(timelineId)
    }

    // 从注册表移除
    this.timelineItems.delete(timelineId)
    
    console.log(`🗑️ 清理时间轴项目: ${timelineId}`)
  }

  /**
   * 清理媒体项目
   */
  unregisterMediaItem(mediaId: string): void {
    this.mediaItems.delete(mediaId)
    console.log(`🗑️ 清理媒体项目: ${mediaId}`)
  }

  /**
   * 获取时间轴项目
   */
  getTimelineItem(timelineId: string): UnifiedTimelineItemData | undefined {
    return this.timelineItems.get(timelineId)
  }

  /**
   * 获取媒体项目
   */
  getMediaItem(mediaId: string): UnifiedMediaItemData | undefined {
    return this.mediaItems.get(mediaId)
  }

  /**
   * 获取指定轨道的所有时间轴项目
   */
  getTimelineItemsByTrack(trackId: string): UnifiedTimelineItemData[] {
    return Array.from(this.timelineItems.values())
      .filter(item => item.trackId === trackId)
      .sort((a, b) => a.timeRange.timelineStartTime - b.timeRange.timelineStartTime)
  }

  /**
   * 获取关联到指定媒体项目的所有时间轴项目
   */
  getTimelineItemsByMedia(mediaId: string): UnifiedTimelineItemData[] {
    return Array.from(this.timelineItems.values())
      .filter(item => item.mediaItemId === mediaId)
  }

  /**
   * 清理所有项目（用于组件卸载时）
   */
  cleanup(): void {
    // 停止所有watch监听
    for (const stopHandle of this.watchStopHandles.values()) {
      stopHandle()
    }

    // 清理所有数据
    this.timelineItems.clear()
    this.mediaItems.clear()
    this.watchStopHandles.clear()

    console.log('🧹 TimelineMediaSyncManager 已清理所有数据')
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    timelineItemCount: number
    mediaItemCount: number
    activeWatchCount: number
  } {
    return {
      timelineItemCount: this.timelineItems.size,
      mediaItemCount: this.mediaItems.size,
      activeWatchCount: this.watchStopHandles.size
    }
  }

  /**
   * 强制同步所有时间轴项目状态
   */
  async forceSyncAll(): Promise<void> {
    console.log('🔄 强制同步所有时间轴项目状态...')
    
    for (const timelineData of this.timelineItems.values()) {
      const mediaData = this.mediaItems.get(timelineData.mediaItemId)
      if (mediaData) {
        const targetStatus = MEDIA_TO_TIMELINE_STATUS_MAP[mediaData.mediaStatus]
        if (timelineData.timelineStatus !== targetStatus) {
          await transitionTimelineStatus(timelineData, targetStatus)
        }
      }
    }

    console.log('✅ 所有时间轴项目状态同步完成')
  }
}

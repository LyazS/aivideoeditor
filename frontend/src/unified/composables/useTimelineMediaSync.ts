/**
 * 时间轴素材状态同步组合函数
 * 实现素材状态变化时自动同步时间轴项目状态
 */

import { watch, type WatchStopHandle } from 'vue'
import type { UnifiedTimelineItemData } from '../timelineitem/TimelineItemData'
import type { UnifiedMediaItemData, MediaStatus } from '../mediaitem/types'
import { createSpriteFromUnifiedMediaItem } from '../utils/UnifiedSpriteFactory'
import { useUnifiedStore } from '../unifiedStore'

/**
 * 时间轴素材状态同步组合函数
 */
export function useTimelineMediaSync() {
  const unifiedStore = useUnifiedStore()

  /**
   * 为时间轴项目设置素材状态监听
   * @param timelineItemId 时间轴项目ID
   * @param mediaItemId 媒体项目ID
   * @returns 清理函数，用于停止监听
   */
  function setupMediaSync(timelineItemId: string, mediaItemId: string): WatchStopHandle | null {
    const mediaItem = unifiedStore.getMediaItem(mediaItemId)
    const timelineItem = unifiedStore.getTimelineItem(timelineItemId)

    if (!mediaItem || !timelineItem) {
      console.warn('🚫 [TimelineMediaSync] 无法设置状态同步：找不到对应的项目', {
        mediaItemId,
        timelineItemId,
        hasMediaItem: !!mediaItem,
        hasTimelineItem: !!timelineItem,
      })
      return null
    }

    console.log('🔗 [TimelineMediaSync] 设置状态同步监听', {
      timelineItemId,
      mediaItemId,
      currentMediaStatus: mediaItem.mediaStatus,
      currentTimelineStatus: timelineItem.timelineStatus,
    })

    // 监听素材状态变化
    const unwatch = watch(
      () => mediaItem.mediaStatus,
      async (newStatus, oldStatus) => {
        console.log('🔄 [TimelineMediaSync] 素材状态变化', {
          mediaItemId,
          timelineItemId,
          mediaName: mediaItem.name,
          statusChange: `${oldStatus} → ${newStatus}`,
        })

        await handleMediaStatusChange(timelineItem, mediaItem, newStatus, oldStatus)
      },
      { immediate: false }
    )

    // 返回清理函数
    return unwatch
  }

  /**
   * 处理素材状态变化
   * @param timelineItem 时间轴项目
   * @param mediaItem 媒体项目
   * @param newStatus 新状态
   * @param oldStatus 旧状态
   */
  async function handleMediaStatusChange(
    timelineItem: UnifiedTimelineItemData,
    mediaItem: UnifiedMediaItemData,
    newStatus: MediaStatus,
    oldStatus: MediaStatus
  ): Promise<void> {
    try {
      if (newStatus === 'ready' && timelineItem.timelineStatus === 'loading') {
        // 素材ready了，转换时间轴项目状态
        console.log('✅ [TimelineMediaSync] 素材就绪，开始转换时间轴项目状态', {
          timelineItemId: timelineItem.id,
          mediaItemId: mediaItem.id,
          mediaName: mediaItem.name,
        })
        await transitionToReady(timelineItem, mediaItem)
      } else if (['error', 'cancelled', 'missing'].includes(newStatus)) {
        // 素材出错了，标记时间轴项目为错误
        if (timelineItem.timelineStatus === 'loading') {
          console.log('❌ [TimelineMediaSync] 素材出错，转换时间轴项目为错误状态', {
            timelineItemId: timelineItem.id,
            mediaItemId: mediaItem.id,
            mediaName: mediaItem.name,
            errorStatus: newStatus,
          })
          timelineItem.timelineStatus = 'error'
        }
      }
    } catch (error) {
      console.error('❌ [TimelineMediaSync] 处理状态变化失败', {
        timelineItemId: timelineItem.id,
        mediaItemId: mediaItem.id,
        statusChange: `${oldStatus} → ${newStatus}`,
        error: error instanceof Error ? error.message : String(error),
      })
      
      // 发生错误时，将时间轴项目标记为错误状态
      if (timelineItem.timelineStatus === 'loading') {
        timelineItem.timelineStatus = 'error'
      }
    }
  }

  /**
   * 将loading状态的时间轴项目转换为ready状态
   * @param timelineItem 时间轴项目
   * @param mediaItem 媒体项目
   */
  async function transitionToReady(
    timelineItem: UnifiedTimelineItemData,
    mediaItem: UnifiedMediaItemData
  ): Promise<void> {
    try {
      console.log('🔄 [TimelineMediaSync] 开始转换时间轴项目为ready状态', {
        timelineItemId: timelineItem.id,
        mediaItemId: mediaItem.id,
        mediaName: mediaItem.name,
      })

      // 更新时长（如果有变化）
      const actualDuration = mediaItem.duration
      const currentDuration = timelineItem.timeRange.timelineEndTime - timelineItem.timeRange.timelineStartTime

      if (actualDuration && actualDuration !== currentDuration) {
        // 调整时间轴项目的结束时间
        timelineItem.timeRange.timelineEndTime = timelineItem.timeRange.timelineStartTime + actualDuration
        timelineItem.timeRange.clipEndTime = actualDuration
        console.log('📏 [TimelineMediaSync] 调整时间轴项目时长', {
          timelineItemId: timelineItem.id,
          durationChange: `${currentDuration} → ${actualDuration}`,
        })
      }

      // 更新媒体类型（如果从unknown变为具体类型）
      if (timelineItem.mediaType === 'unknown' && mediaItem.mediaType !== 'unknown') {
        timelineItem.mediaType = mediaItem.mediaType
        console.log('🎭 [TimelineMediaSync] 更新媒体类型', {
          timelineItemId: timelineItem.id,
          typeChange: `unknown → ${mediaItem.mediaType}`,
        })
      }

      // 创建WebAV sprite等运行时对象
      await createRuntimeObjects(timelineItem, mediaItem)

      // 转换状态为ready
      timelineItem.timelineStatus = 'ready'

      console.log('✅ [TimelineMediaSync] 时间轴项目转换为ready状态完成', {
        timelineItemId: timelineItem.id,
        mediaItemId: mediaItem.id,
        mediaName: mediaItem.name,
      })
    } catch (error) {
      console.error('❌ [TimelineMediaSync] 转换时间轴项目状态失败', {
        timelineItemId: timelineItem.id,
        mediaItemId: mediaItem.id,
        error: error instanceof Error ? error.message : String(error),
      })
      timelineItem.timelineStatus = 'error'
      throw error
    }
  }

  /**
   * 创建运行时对象（sprite等）
   * @param timelineItem 时间轴项目
   * @param mediaItem 媒体项目
   */
  async function createRuntimeObjects(
    timelineItem: UnifiedTimelineItemData,
    mediaItem: UnifiedMediaItemData
  ): Promise<void> {
    try {
      console.log('🏗️ [TimelineMediaSync] 开始创建运行时对象', {
        timelineItemId: timelineItem.id,
        mediaItemId: mediaItem.id,
        mediaType: mediaItem.mediaType,
      })

      // 创建sprite
      const sprite = await createSpriteFromUnifiedMediaItem(mediaItem)
      if (sprite) {
        // 设置sprite的时间范围（这很重要！）
        sprite.setTimeRange(timelineItem.timeRange)

        // 获取AVCanvas实例
        const avCanvas = unifiedStore.getAVCanvas()
        if (avCanvas) {
          // 将sprite添加到AVCanvas
          await avCanvas.addSprite(sprite)
          console.log('✅ [TimelineMediaSync] Sprite已添加到AVCanvas', {
            timelineItemId: timelineItem.id,
            spriteType: sprite.constructor.name,
          })
        } else {
          console.warn('⚠️ [TimelineMediaSync] AVCanvas不可用，跳过sprite添加')
        }

        // 设置到时间轴项目
        if (!timelineItem.runtime) {
          timelineItem.runtime = {}
        }
        timelineItem.runtime.sprite = sprite

        console.log('✅ [TimelineMediaSync] 运行时对象创建完成', {
          timelineItemId: timelineItem.id,
          hasSprite: !!timelineItem.runtime.sprite,
        })
      } else {
        console.warn('⚠️ [TimelineMediaSync] 无法创建sprite', {
          timelineItemId: timelineItem.id,
          mediaItemId: mediaItem.id,
        })
      }
    } catch (error) {
      console.error('❌ [TimelineMediaSync] 创建运行时对象失败', {
        timelineItemId: timelineItem.id,
        mediaItemId: mediaItem.id,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  return {
    setupMediaSync,
    handleMediaStatusChange,
    transitionToReady,
    createRuntimeObjects,
  }
}

/**
 * 时间轴素材状态同步组合函数
 * 实现素材状态变化时自动同步时间轴项目状态
 */

import { watch, type WatchStopHandle } from 'vue'
import type { UnifiedTimelineItemData } from '../timelineitem/TimelineItemData'
import type { UnifiedMediaItemData, MediaStatus } from '../mediaitem/types'
import { createSpriteFromUnifiedMediaItem } from '../utils/UnifiedSpriteFactory'
import { regenerateThumbnailForUnifiedTimelineItem } from '../utils/thumbnailGenerator'
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
  function setupMediaSync(timelineItemId: string, mediaItemId: string, command?: any): WatchStopHandle | null {
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

        await handleMediaStatusChange(timelineItem, mediaItem, newStatus, oldStatus, command)
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
    oldStatus: MediaStatus,
    command?: any
  ): Promise<void> {
    try {
      if (newStatus === 'ready' && timelineItem.timelineStatus === 'loading') {
        // 素材ready了，转换时间轴项目状态
        console.log('✅ [TimelineMediaSync] 素材就绪，开始转换时间轴项目状态', {
          timelineItemId: timelineItem.id,
          mediaItemId: mediaItem.id,
          mediaName: mediaItem.name,
        })
        await transitionToReady(timelineItem, mediaItem, command)
      } else if (['error', 'cancelled', 'missing'].includes(newStatus)) {
        // 素材出错了，标记时间轴项目为错误
        if (timelineItem.timelineStatus === 'loading') {
          console.log('❌ [TimelineMediaSync] 素材出错，转换时间轴项目为错误状态', {
            timelineItemId: timelineItem.id,
            mediaItemId: mediaItem.id,
            mediaName: mediaItem.name,
            errorStatus: newStatus,
          })
          
          // 清理监听器
          if (timelineItem.runtime.unwatchMediaSync) {
            timelineItem.runtime.unwatchMediaSync()
            timelineItem.runtime.unwatchMediaSync = undefined
            console.log(`🗑️ [TimelineMediaSync] 已清理监听器(错误状态): ${timelineItem.id}`)
          }
          
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
      
      // 发生错误时，清理监听器并标记时间轴项目为错误状态
      if (timelineItem.runtime.unwatchMediaSync) {
        timelineItem.runtime.unwatchMediaSync()
        timelineItem.runtime.unwatchMediaSync = undefined
        console.log(`🗑️ [TimelineMediaSync] 已清理监听器(异常): ${timelineItem.id}`)
      }
      
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
    mediaItem: UnifiedMediaItemData,
    command?: any
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
        
        // 如果有命令引用，更新命令中的originalTimelineItemData时长
        if (command && command.updateOriginalTimelineItemDuration) {
          command.updateOriginalTimelineItemDuration(actualDuration)
        }
        
        console.log('📏 [TimelineMediaSync] 调整时间轴项目时长', {
          timelineItemId: timelineItem.id,
          durationChange: `${currentDuration} → ${actualDuration}`,
        })
      }

      // 更新媒体类型（如果从unknown变为具体类型）
      // 注意：由于时间轴项目不再支持 unknown 类型，这个检查已不再需要
      // 但为了保持代码的完整性，我们保留这个逻辑结构
      if (false && mediaItem.mediaType !== 'unknown') {
        // 由于时间轴项目不再支持 unknown 类型，这段代码已被禁用
        // timelineItem.mediaType = mediaItem.mediaType
        console.log('🎭 [TimelineMediaSync] 更新媒体类型', {
          timelineItemId: timelineItem.id,
          typeChange: `unknown → ${mediaItem.mediaType}`,
        })
      }

      // 创建WebAV sprite等运行时对象
      await createRuntimeObjects(timelineItem, mediaItem)

      // 生成缩略图（异步执行，不阻塞状态转换）
      await generateThumbnailForTransitionedItem(timelineItem, mediaItem)

      // 转换状态为ready
      timelineItem.timelineStatus = 'ready'

      // 状态转换完成，清理监听器
      if (timelineItem.runtime.unwatchMediaSync) {
        timelineItem.runtime.unwatchMediaSync()
        timelineItem.runtime.unwatchMediaSync = undefined
        console.log(`🗑️ [TimelineMediaSync] 已清理监听器: ${timelineItem.id}`)
      }

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
      
      // 状态转换失败，也要清理监听器
      if (timelineItem.runtime.unwatchMediaSync) {
        timelineItem.runtime.unwatchMediaSync()
        timelineItem.runtime.unwatchMediaSync = undefined
        console.log(`🗑️ [TimelineMediaSync] 已清理监听器(错误状态): ${timelineItem.id}`)
      }
      
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

        // 🆕 先设置到时间轴项目
        if (!timelineItem.runtime) {
          timelineItem.runtime = {}
        }
        timelineItem.runtime.sprite = sprite
        console.log('✅ [TimelineMediaSync] Sprite已设置到时间轴项目', {
          timelineItemId: timelineItem.id,
          spriteType: sprite.constructor.name,
        })

        // 再将sprite添加到AVCanvas
        await unifiedStore.addSpriteToCanvas(sprite)
        console.log('✅ [TimelineMediaSync] Sprite已添加到AVCanvas', {
          timelineItemId: timelineItem.id,
          spriteType: sprite.constructor.name,
        })

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

  /**
   * 为状态转换的时间轴项目生成缩略图
   * @param timelineItem 时间轴项目
   * @param mediaItem 媒体项目
   */
  async function generateThumbnailForTransitionedItem(
    timelineItem: UnifiedTimelineItemData,
    mediaItem: UnifiedMediaItemData
  ): Promise<void> {
    // 音频不需要缩略图
    if (mediaItem.mediaType === 'audio') {
      console.log('🎵 [TimelineMediaSync] 音频不需要缩略图，跳过生成')
      return
    }

    // 检查是否已经有缩略图，避免重复生成
    if (timelineItem.runtime.thumbnailUrl) {
      console.log('✅ [TimelineMediaSync] 项目已有缩略图，跳过重新生成')
      return
    }

    try {
      console.log('🖼️ [TimelineMediaSync] 开始为状态转换的项目生成缩略图...', {
        timelineItemId: timelineItem.id,
        mediaItemId: mediaItem.id,
        mediaType: mediaItem.mediaType,
      })

      const thumbnailUrl = await regenerateThumbnailForUnifiedTimelineItem(timelineItem, mediaItem)

      if (thumbnailUrl) {
        console.log('✅ [TimelineMediaSync] 状态转换项目缩略图生成完成', {
          timelineItemId: timelineItem.id,
          hasThumbnailUrl: !!thumbnailUrl,
        })
      } else {
        console.warn('⚠️ [TimelineMediaSync] 状态转换项目缩略图生成失败，未返回URL', {
          timelineItemId: timelineItem.id,
        })
      }
    } catch (error) {
      console.error('❌ [TimelineMediaSync] 状态转换项目缩略图生成失败', {
        timelineItemId: timelineItem.id,
        mediaItemId: mediaItem.id,
        error: error instanceof Error ? error.message : String(error),
      })
      // 缩略图生成失败不应该影响状态转换，只记录错误
    }
  }

  return {
    setupMediaSync,
    handleMediaStatusChange,
    transitionToReady,
    createRuntimeObjects,
    generateThumbnailForTransitionedItem,
  }
}

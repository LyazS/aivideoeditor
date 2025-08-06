/**
 * 时间轴素材状态同步组合函数
 * 实现素材状态变化时自动同步时间轴项目状态
 */

import { watch, type WatchStopHandle } from 'vue'
import type { UnifiedTimelineItemData } from '../timelineitem/TimelineItemData'
import type { UnifiedMediaItemData, MediaStatus, ReadyMediaItem } from '../mediaitem/types'
import { createSpriteFromUnifiedMediaItem } from '../utils/UnifiedSpriteFactory'
import { regenerateThumbnailForUnifiedTimelineItem } from '../utils/thumbnailGenerator'
import { useUnifiedStore } from '../unifiedStore'
import { hasVisualProperties } from '../timelineitem'
import { UnifiedMediaItemQueries } from '../mediaitem'
import { SimplifiedMediaSyncManager } from '../timelineitem/SimplifiedMediaSyncManager'
import type { SimpleCommand } from '../modules/commands/types'

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
  function setupMediaSync(
    timelineItemId: string,
    mediaItemId: string,
    command?: any,
  ): WatchStopHandle | null {
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

        await handleMediaStatusChange(timelineItem, mediaItem as ReadyMediaItem, newStatus, oldStatus, command)
      },
      { immediate: false },
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
    mediaItem: ReadyMediaItem,
    newStatus: MediaStatus,
    oldStatus: MediaStatus,
    command?: any,
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
    mediaItem: ReadyMediaItem,
    command?: any,
  ): Promise<void> {
    try {
      console.log('🔄 [TimelineMediaSync] 开始转换时间轴项目为ready状态', {
        timelineItemId: timelineItem.id,
        mediaItemId: mediaItem.id,
        mediaName: mediaItem.name,
      })

      // 更新时长（如果有变化）
      const actualDuration = mediaItem.duration
      const currentDuration =
        timelineItem.timeRange.timelineEndTime - timelineItem.timeRange.timelineStartTime

      // 创建WebAV sprite等运行时对象
      await createRuntimeObjects(timelineItem, mediaItem)

      // 生成缩略图（异步执行，不阻塞状态转换）
      await generateThumbnailForTransitionedItem(timelineItem, mediaItem)

      // 转换状态为ready
      timelineItem.timelineStatus = 'ready'

      // 回调更新命令中的原始数据
      if (actualDuration && actualDuration !== currentDuration) {
        // 调整时间轴项目的结束时间
        timelineItem.timeRange.timelineEndTime =
          timelineItem.timeRange.timelineStartTime + actualDuration
        timelineItem.timeRange.clipEndTime = actualDuration

        // 如果有命令引用，更新命令中的originalTimelineItemData时长和状态
        if (command && command.updateOriginalTimelineItemData) {
          // 准备更新的配置信息（包含原始分辨率等）
          let updatedConfig: any = undefined

          // 对于视觉媒体，获取原始分辨率信息并更新配置
          if (hasVisualProperties(timelineItem) && mediaItem.webav) {
            const originalSize = UnifiedMediaItemQueries.getOriginalSize(mediaItem)
            if (originalSize) {
              updatedConfig = {
                originalWidth: originalSize.width,
                originalHeight: originalSize.height,
                // 保持当前的宽高比例，根据新的原始尺寸重新计算
                width: originalSize.width,
                height: originalSize.height,
              }

              console.log('📐 [TimelineMediaSync] 准备更新配置中的原始分辨率', {
                timelineItemId: timelineItem.id,
                originalSize,
                updatedConfig,
              })
            }
          }

          // 更新命令中的原始数据
          command.updateOriginalTimelineItemData(actualDuration, 'ready', updatedConfig)
        }

        console.log('📏 [TimelineMediaSync] 调整时间轴项目时长', {
          timelineItemId: timelineItem.id,
          durationChange: `${currentDuration} → ${actualDuration}`,
        })
      }

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
    mediaItem: ReadyMediaItem,
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
        sprite.setTimeRange({
          clipStartTime: 0,
          clipEndTime: mediaItem.duration,
          timelineStartTime: timelineItem.timeRange.timelineStartTime,
          timelineEndTime: timelineItem.timeRange.timelineStartTime + mediaItem.duration,
        })

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
    mediaItem: UnifiedMediaItemData,
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

  /**
   * 为时间轴项目设置媒体同步（如果需要的话）
   * 自动检测素材和时间轴项目状态，只为loading状态的项目设置同步
   * @param timelineItem 时间轴项目
   * @param mediaItem 媒体项目
   * @param command 可选的命令实例，用于状态转换时更新原始数据
   * @returns 是否成功设置了同步
   */
  function setupMediaSyncIfNeeded(
    timelineItem: UnifiedTimelineItemData,
    mediaItem: UnifiedMediaItemData,
    command?: any,
  ): boolean {
    try {
      // 只为loading状态的时间轴项目设置同步
      if (timelineItem.timelineStatus !== 'loading') {
        console.log(`⏭️ [TimelineMediaSync] 跳过同步设置，时间轴项目状态不是loading: ${timelineItem.timelineStatus}`, {
          timelineItemId: timelineItem.id,
          mediaItemId: mediaItem.id,
        })
        return false
      }

      // 检查媒体项目状态，只有非ready状态才需要设置同步
      const isReady = UnifiedMediaItemQueries.isReady(mediaItem)
      const hasError = UnifiedMediaItemQueries.hasError(mediaItem)

      if (isReady) {
        console.log(`⏭️ [TimelineMediaSync] 跳过同步设置，媒体项目已经ready: ${mediaItem.name}`, {
          timelineItemId: timelineItem.id,
          mediaItemId: mediaItem.id,
        })
        return false
      }

      if (hasError) {
        console.log(`⏭️ [TimelineMediaSync] 跳过同步设置，媒体项目有错误: ${mediaItem.name}`, {
          timelineItemId: timelineItem.id,
          mediaItemId: mediaItem.id,
          mediaStatus: mediaItem.mediaStatus,
        })
        return false
      }

      // 设置媒体状态同步
      const unwatch = setupMediaSync(timelineItem.id, mediaItem.id, command)

      if (unwatch) {
        console.log(`🔗 [TimelineMediaSync] 已设置状态同步: ${timelineItem.id} <-> ${mediaItem.id}`, {
          mediaName: mediaItem.name,
          mediaStatus: mediaItem.mediaStatus,
          timelineStatus: timelineItem.timelineStatus,
        })

        // 保存监听器清理函数到时间轴项目的runtime中
        if (!timelineItem.runtime) {
          timelineItem.runtime = {}
        }
        timelineItem.runtime.unwatchMediaSync = unwatch
        console.log(`💾 [TimelineMediaSync] 已保存监听器到runtime: ${timelineItem.id}`)
        
        return true
      } else {
        console.warn(`⚠️ [TimelineMediaSync] 无法设置状态同步: ${timelineItem.id} <-> ${mediaItem.id}`, {
          mediaName: mediaItem.name,
          mediaStatus: mediaItem.mediaStatus,
        })
        return false
      }
    } catch (error) {
      console.error(`❌ [TimelineMediaSync] 设置状态同步失败:`, {
        timelineItemId: timelineItem.id,
        mediaItemId: mediaItem.id,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * 清理时间轴项目的媒体同步监听器
   * @param timelineItem 时间轴项目
   */
  function cleanupMediaSync(timelineItem: UnifiedTimelineItemData): void {
    try {
      if (timelineItem.runtime?.unwatchMediaSync) {
        timelineItem.runtime.unwatchMediaSync()
        timelineItem.runtime.unwatchMediaSync = undefined
        console.log(`🗑️ [TimelineMediaSync] 已清理监听器: ${timelineItem.id}`)
      }
    } catch (error) {
      console.error(`❌ [TimelineMediaSync] 清理监听器失败:`, {
        timelineItemId: timelineItem.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * 设置命令与媒体项目的直接同步
   * @param commandId 命令ID
   * @param mediaItem 媒体项目
   */
  function setupCommandMediaSync(
    commandId: string,
    mediaItem: UnifiedMediaItemData
  ): boolean {
    try {
      // 检查媒体项目状态，只有非ready状态才需要设置同步
      const isReady = UnifiedMediaItemQueries.isReady(mediaItem)
      const hasError = UnifiedMediaItemQueries.hasError(mediaItem)

      if (isReady) {
        console.log(`⏭️ [TimelineMediaSync] 跳过命令同步设置，媒体项目已经ready: ${mediaItem.name}`, {
          commandId,
          mediaItemId: mediaItem.id,
        })
        return false
      }

      if (hasError) {
        console.log(`⏭️ [TimelineMediaSync] 跳过命令同步设置，媒体项目有错误: ${mediaItem.name}`, {
          commandId,
          mediaItemId: mediaItem.id,
          mediaStatus: mediaItem.mediaStatus,
        })
        return false
      }

      // 设置媒体状态同步
      const unwatch = setupDirectMediaSync(commandId, mediaItem.id)

      if (unwatch) {
        console.log(`🔗 [TimelineMediaSync] 已为命令设置直接状态同步: ${commandId} <-> ${mediaItem.id}`, {
          mediaName: mediaItem.name,
          mediaStatus: mediaItem.mediaStatus,
        })

        // 注册到SimplifiedMediaSyncManager中
        const syncManager = SimplifiedMediaSyncManager.getInstance()
        syncManager.registerCommandMediaSync(commandId, mediaItem.id, unwatch)
        
        console.log(`💾 [TimelineMediaSync] 已注册监听器到简化媒体同步管理器: ${commandId}`)
        
        return true
      } else {
        console.warn(`⚠️ [TimelineMediaSync] 无法为命令设置直接状态同步: ${commandId} <-> ${mediaItem.id}`, {
          mediaName: mediaItem.name,
          mediaStatus: mediaItem.mediaStatus,
        })
        return false
      }
    } catch (error) {
      console.error(`❌ [TimelineMediaSync] 为命令设置直接状态同步失败:`, {
        commandId,
        mediaItemId: mediaItem.id,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * 设置直接的媒体状态同步
   * 不依赖时间轴项目，直接在命令和媒体项目之间建立同步
   */
  function setupDirectMediaSync(
    commandId: string,
    mediaItemId: string
  ): (() => void) | null {
    // 获取媒体项目
    const mediaItem = unifiedStore.getMediaItem(mediaItemId)
    if (!mediaItem) {
      console.error(`❌ [TimelineMediaSync] 无法获取媒体项目: ${mediaItemId}`)
      return null
    }
    
    // 使用Vue的watch监听媒体项目状态变化
    const unwatch = watch(
      () => mediaItem.mediaStatus,
      (newStatus, oldStatus) => {
        // 只在媒体状态为"准备好"时更新命令的媒体数据
        if (newStatus === 'ready') {
          // 获取命令
          const command = unifiedStore.getCommandById(commandId)
          if (command && !command.isDisposed) {
            // 更新命令中保存的媒体数据
            command.updateMediaData?.(mediaItem)
            console.log(`🔄 [TimelineMediaSync] 已更新命令媒体数据: ${commandId} <- ${mediaItemId}`, {
              mediaName: mediaItem.name,
              mediaStatus: newStatus,
              statusChange: `${oldStatus} → ${newStatus}`,
            })
          }
        }
      },
      { immediate: true } // 立即执行一次，以免错过已经准备好的媒体项目
    )
    
    return unwatch
  }

  /**
   * 清理命令的所有媒体同步
   * @param commandId 命令ID
   */
  function cleanupCommandMediaSync(commandId: string): void {
    try {
      const syncManager = SimplifiedMediaSyncManager.getInstance()
      syncManager.cleanupCommandMediaSync(commandId)
      
      console.log(`🗑️ [TimelineMediaSync] 已清理命令所有媒体同步: ${commandId}`)
    } catch (error) {
      console.error(`❌ [TimelineMediaSync] 清理命令媒体同步失败:`, {
        commandId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    setupMediaSync,
    setupMediaSyncIfNeeded,
    cleanupMediaSync,
    handleMediaStatusChange,
    transitionToReady,
    createRuntimeObjects,
    generateThumbnailForTransitionedItem,
    setupCommandMediaSync,
    setupDirectMediaSync,
    cleanupCommandMediaSync,
  }
}

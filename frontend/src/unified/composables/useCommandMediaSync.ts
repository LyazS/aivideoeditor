/**
 * 时间轴媒体同步工具 - 简化版本
 * 实现命令与媒体项目的直接同步，不依赖时间轴项目
 */

import { watch } from 'vue'
import type { UnifiedMediaItemData } from '../mediaitem/types'
import type { UnifiedTimelineItemData } from '../timelineitem/TimelineItemData'
import type { VideoMediaConfig, ImageMediaConfig } from '../timelineitem/TimelineItemData'
import { UnifiedMediaItemQueries } from '../mediaitem'
import { TimelineItemQueries } from '../timelineitem/TimelineItemQueries'
import { SimplifiedMediaSyncManager } from '../timelineitem/SimplifiedMediaSyncManager'
import { useUnifiedStore } from '../unifiedStore'
import { createSpriteFromUnifiedMediaItem } from '../utils/UnifiedSpriteFactory'
import { regenerateThumbnailForUnifiedTimelineItem } from '../utils/thumbnailGenerator'

/**
 * 设置命令与媒体项目的直接同步
 * @param commandId 命令ID
 * @param mediaItem 媒体项目
 */
export function setupCommandMediaSync(
  commandId: string,
  mediaItemId: string,
  timelineItemId?: string,
): boolean {
  try {
    // 设置媒体状态同步
    const unwatch = setupDirectMediaSync(commandId, mediaItemId, timelineItemId)

    if (unwatch) {
      console.log(
        `🔗 [TimelineMediaSync] 已为命令设置直接状态同步: ${commandId} <-> ${mediaItemId}`,
      )

      // 注册到SimplifiedMediaSyncManager中
      const syncManager = SimplifiedMediaSyncManager.getInstance()
      syncManager.registerCommandMediaSync(commandId, mediaItemId, unwatch)

      console.log(`💾 [TimelineMediaSync] 已注册监听器到简化媒体同步管理器: ${commandId}`)

      return true
    } else {
      console.warn(
        `⚠️ [TimelineMediaSync] 无法为命令设置直接状态同步: ${commandId} <-> ${mediaItemId}`,
      )
      return false
    }
  } catch (error) {
    console.error(`❌ [TimelineMediaSync] 为命令设置直接状态同步失败:`, {
      commandId,
      mediaItemId: mediaItemId,
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
  mediaItemId: string,
  timelineItemId?: string,
): (() => void) | null {
  const unifiedStore = useUnifiedStore()

  // 获取媒体项目
  const mediaItem = unifiedStore.getMediaItem(mediaItemId)
  if (!mediaItem) {
    console.error(`❌ [TimelineMediaSync] 找不到媒体项目: ${mediaItemId}`)
    return null
  }

  // 检查媒体项目状态，只有非ready状态才需要设置同步
  const isReady = UnifiedMediaItemQueries.isReady(mediaItem)

  if (isReady) {
    console.log(`⏭️ [TimelineMediaSync] 跳过命令同步设置，媒体项目已经ready: ${mediaItem.name}`, {
      commandId,
      mediaItemId: mediaItem.id,
    })
    return null
  }

  const unwatch = watch(
    () => mediaItem.mediaStatus,
    async (newStatus, oldStatus) => {
      console.log(`🔄 [TimelineMediaSync] 媒体状态变化，通知命令: ${commandId}`, {
        mediaItemId,
        mediaName: mediaItem.name,
        statusChange: `${oldStatus} → ${newStatus}`,
      })

      let shouldCleanup = false

      // 只在状态变为ready时更新命令中的媒体数据
      if (newStatus === 'ready') {
        const command = unifiedStore.getCommand(commandId)
        if (command && !command.isDisposed && command.updateMediaData) {
          command.updateMediaData(mediaItem)
          console.log(`🔄 [TimelineMediaSync] 已更新命令媒体数据: ${commandId} <- ${mediaItemId}`, {
            mediaName: mediaItem.name,
            mediaStatus: mediaItem.mediaStatus,
          })
          if (timelineItemId) {
            // 为时间轴项目创建运行时内容（sprite和缩略图）
            transitionTimelineItemToReady(timelineItemId, mediaItem, commandId)
          }
          // ready是终态，标记为需要清理
          shouldCleanup = true
        } else {
          if (!command) {
            console.warn(`⚠️ [TimelineMediaSync] 找不到命令实例: ${commandId}`)
          } else if (command.isDisposed) {
            console.warn(`⚠️ [TimelineMediaSync] 命令已被清理，跳过更新: ${commandId}`)
            // 命令已被清理，标记为需要清理
            shouldCleanup = true
          } else if (!command.updateMediaData) {
            console.warn(`⚠️ [TimelineMediaSync] 命令不支持媒体数据更新: ${commandId}`)
            // 命令不支持更新，标记为需要清理
            shouldCleanup = true
          }
        }
      } else if (newStatus === 'error' || newStatus === 'cancelled' || newStatus === 'missing') {
        // 媒体状态变为错误、取消或缺失时，更新对应的时间轴项目状态
        if (timelineItemId) {
          const timelineItem = unifiedStore.getTimelineItem(timelineItemId)
          if (timelineItem) {
            // 将时间轴项目状态设置为错误
            timelineItem.timelineStatus = 'error'
            console.log(`❌ [TimelineMediaSync] 时间轴项目状态已设置为错误: ${timelineItemId}`, {
              mediaItemId,
              mediaName: mediaItem.name,
              mediaStatus: newStatus,
            })
          }
        }
        // 错误状态是终态，标记为需要清理
        shouldCleanup = true
      }

      // 如果达到终态，自动清理监听器
      if (shouldCleanup) {
        console.log(
          `🧹 [TimelineMediaSync] 媒体达到终态(${newStatus})，自动清理监听器: ${commandId} <-> ${mediaItemId}`,
        )

        // 从SimplifiedMediaSyncManager中移除（内部会调用unwatch）
        const syncManager = SimplifiedMediaSyncManager.getInstance()
        syncManager.cleanupCommandMediaSync(commandId)

        console.log(`✅ [TimelineMediaSync] 监听器清理完成: ${commandId} <-> ${mediaItemId}`)
      }
    },
    { immediate: true },
  )

  return unwatch
}

/**
 * 为时间轴项目创建运行时内容（sprite和缩略图）
 * @param timelineItemId 时间轴项目ID
 * @param mediaItem 媒体项目
 * @param commandId 命令ID（用于日志）
 */
async function transitionTimelineItemToReady(
  timelineItemId: string,
  mediaItem: UnifiedMediaItemData,
  commandId: string,
): Promise<void> {
  try {
    console.log(`🎨 [TimelineMediaSync] 开始为时间轴项目创建运行时内容: ${timelineItemId}`, {
      commandId,
      mediaItemId: mediaItem.id,
      mediaType: mediaItem.mediaType,
    })

    const unifiedStore = useUnifiedStore()

    // 获取时间轴项目
    const timelineItem = unifiedStore.getTimelineItem(timelineItemId)
    if (!timelineItem) {
      console.warn(`⚠️ [TimelineMediaSync] 找不到时间轴项目: ${timelineItemId}`)
      return
    }

    // 1. 创建Sprite
    try {
      // 先更新timelineItem的timeRange和config配置里的宽高
      updateTimelineItemDimensions(timelineItem, mediaItem)

      console.log(`🔄 [TimelineMediaSync] 为时间轴项目创建Sprite: ${timelineItemId}`)
      const sprite = await createSpriteFromUnifiedMediaItem(mediaItem)

      // 将sprite存储到runtime中，并更新sprite时间
      timelineItem.runtime.sprite = sprite
      timelineItem.runtime.sprite.setTimeRange({...timelineItem.timeRange})
      await unifiedStore.addSpriteToCanvas(timelineItem.runtime.sprite)
      console.log(`✅ [TimelineMediaSync] Sprite创建成功并存储到runtime: ${timelineItemId}`)

    } catch (spriteError) {
      console.error(`❌ [TimelineMediaSync] 创建Sprite失败: ${timelineItemId}`, spriteError)
      // Sprite创建失败不影响后续操作
    }

    // 2. 生成缩略图（仅对视频和图片类型）
    if (UnifiedMediaItemQueries.isVisualMedia(mediaItem)) {
      try {
        console.log(`🖼️ [TimelineMediaSync] 为时间轴项目生成缩略图: ${timelineItemId}`)
        const thumbnailUrl = await regenerateThumbnailForUnifiedTimelineItem(
          timelineItem,
          mediaItem,
        )

        if (thumbnailUrl) {
          timelineItem.runtime.thumbnailUrl = thumbnailUrl
          console.log(`✅ [TimelineMediaSync] 缩略图生成成功: ${timelineItemId}`, {
            thumbnailUrl: thumbnailUrl.substring(0, 50) + '...',
          })
        } else {
          console.log(`⚠️ [TimelineMediaSync] 缩略图生成返回空结果: ${timelineItemId}`)
        }
      } catch (thumbnailError) {
        console.error(`❌ [TimelineMediaSync] 生成缩略图失败: ${timelineItemId}`, thumbnailError)
        // 缩略图生成失败不影响后续操作
      }
    } else {
      console.log(
        `🎵 [TimelineMediaSync] ${mediaItem.mediaType}类型不需要生成缩略图: ${timelineItemId}`,
      )
    }

    timelineItem.timelineStatus = 'ready'

    console.log(`🎉 [TimelineMediaSync] 时间轴项目运行时内容创建完成: ${timelineItemId}`)
  } catch (error) {
    console.error(`❌ [TimelineMediaSync] 创建时间轴项目运行时内容失败: ${timelineItemId}`, {
      commandId,
      mediaItemId: mediaItem.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  /**
   * 更新时间轴项目的尺寸信息
   * @param timelineItem 时间轴项目
   * @param mediaItem 媒体项目
   */
  function updateTimelineItemDimensions(
    timelineItem: UnifiedTimelineItemData<any>,
    mediaItem: UnifiedMediaItemData,
  ): void {
    try {
      // 获取媒体的原始尺寸
      const originalSize = UnifiedMediaItemQueries.getOriginalSize(mediaItem)
      if (!originalSize) {
        console.warn(`⚠️ [TimelineMediaSync] 无法获取媒体原始尺寸: ${mediaItem.id}`)
        return
      }

      console.log(`📐 [TimelineMediaSync] 更新时间轴项目尺寸: ${timelineItem.id}`, {
        originalWidth: originalSize.width,
        originalHeight: originalSize.height,
        mediaType: mediaItem.mediaType,
      })

      // 更新timeRange - 使用媒体项目的duration
      if (mediaItem.duration && timelineItem.timeRange) {
        const duration = mediaItem.duration
        const startTime = timelineItem.timeRange.timelineStartTime

        // 更新时间范围，保持开始时间不变，更新结束时间
        timelineItem.timeRange = {
          ...timelineItem.timeRange,
          timelineEndTime: startTime + duration,
          clipStartTime: 0,
          clipEndTime: duration,
        }

        console.log(`⏱️ [TimelineMediaSync] 已更新时间范围: ${timelineItem.id}`, {
          duration,
          startTime,
          endTime: startTime + duration,
        })
      }

      // 更新config中的宽高 - 仅对视频和图片类型
      if (
        TimelineItemQueries.isVideoTimelineItem(timelineItem) ||
        TimelineItemQueries.isImageTimelineItem(timelineItem)
      ) {
        // 保留现有的配置，只更新尺寸相关字段
        const currentConfig = timelineItem.config

        // 更新宽度和高度
        currentConfig.width = originalSize.width
        currentConfig.height = originalSize.height

        // 更新原始宽度和高度
        currentConfig.originalWidth = originalSize.width
        currentConfig.originalHeight = originalSize.height

        console.log(`🖼️ [TimelineMediaSync] 已更新配置尺寸: ${timelineItem.id}`, {
          width: originalSize.width,
          height: originalSize.height,
        })
      }
    } catch (error) {
      console.error(`❌ [TimelineMediaSync] 更新时间轴项目尺寸失败: ${timelineItem.id}`, {
        mediaItemId: mediaItem.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

/**
 * 清理命令的所有媒体同步
 * @param commandId 命令ID
 */
export function cleanupCommandMediaSync(commandId: string): void {
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

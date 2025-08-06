/**
 * 时间轴媒体同步工具 - 简化版本
 * 实现命令与媒体项目的直接同步，不依赖时间轴项目
 */

import { watch } from 'vue'
import type { UnifiedMediaItemData } from '../mediaitem/types'
import { UnifiedMediaItemQueries } from '../mediaitem'
import { SimplifiedMediaSyncManager } from '../timelineitem/SimplifiedMediaSyncManager'
import { useUnifiedStore } from '../unifiedStore'

/**
 * 设置命令与媒体项目的直接同步
 * @param commandId 命令ID
 * @param mediaItem 媒体项目
 */
export function setupCommandMediaSync(
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
  const unifiedStore = useUnifiedStore()
  
  // 获取媒体项目
  const mediaItem = unifiedStore.getMediaItem(mediaItemId)
  if (!mediaItem) {
    console.error(`❌ [TimelineMediaSync] 找不到媒体项目: ${mediaItemId}`)
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

      // 只在状态变为ready时更新命令中的媒体数据
      if (newStatus === 'ready') {
        const command = unifiedStore.getCommand(commandId)
        if (command && !command.isDisposed && command.updateMediaData) {
          command.updateMediaData(mediaItem)
          console.log(`🔄 [TimelineMediaSync] 已更新命令媒体数据: ${commandId} <- ${mediaItemId}`, {
            mediaName: mediaItem.name,
            mediaStatus: mediaItem.mediaStatus,
          })
        } else {
          if (!command) {
            console.warn(`⚠️ [TimelineMediaSync] 找不到命令实例: ${commandId}`)
          } else if (command.isDisposed) {
            console.warn(`⚠️ [TimelineMediaSync] 命令已被清理，跳过更新: ${commandId}`)
          } else if (!command.updateMediaData) {
            console.warn(`⚠️ [TimelineMediaSync] 命令不支持媒体数据更新: ${commandId}`)
          }
        }
      }
    },
    { immediate: true }
  )
  
  return unwatch
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

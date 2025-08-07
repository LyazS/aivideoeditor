/**
 * 简化的媒体同步管理器
 * 只维护命令与媒体项目之间的同步关系，不涉及时间轴项目
 */

import type { SimpleCommand } from '../modules/commands/types'
import { generateUUID4 } from '@/utils/idGenerator'
/**
 * 命令媒体同步信息
 */
interface CommandMediaSyncInfo {
  id: string // 唯一标识符，用于确保每个注册操作都有唯一的 key
  commandId: string
  mediaItemId: string
  timelineItemId?: string
  unwatch: () => void
  desc?: string
}

/**
 * 简化的媒体同步管理器
 * 只维护命令与媒体项目之间的同步关系，不涉及时间轴项目
 */
export class SimplifiedMediaSyncManager {
  private static instance: SimplifiedMediaSyncManager
  private commandMediaSyncMap = new Map<string, CommandMediaSyncInfo>()

  private constructor() {}

  static getInstance(): SimplifiedMediaSyncManager {
    if (!SimplifiedMediaSyncManager.instance) {
      SimplifiedMediaSyncManager.instance = new SimplifiedMediaSyncManager()
    }
    return SimplifiedMediaSyncManager.instance
  }

  /**
   * 注册命令媒体同步监听器
   * @param commandId 命令ID
   * @param mediaItemId 媒体项目ID
   * @param unwatch 清理函数
   * @param timelineItemId 可选的时间轴项目ID
   */
  registerCommandMediaSync(
    commandId: string,
    mediaItemId: string,
    unwatch: () => void,
    timelineItemId?: string,
    desc?: string,
  ): void {
    // 生成唯一标识符，确保每个注册操作都有唯一的 key
    const uniqueId = generateUUID4()
    const key = `${commandId}:${mediaItemId}:${uniqueId}`

    this.commandMediaSyncMap.set(key, {
      id: uniqueId,
      commandId,
      mediaItemId,
      timelineItemId,
      unwatch,
      desc,
    })

    console.log(
      `🔗 [SimplifiedMediaSyncManager] 已注册命令媒体同步: ${commandId} <-> ${mediaItemId} (唯一ID: ${uniqueId})`,
    )
  }

  /**
   * 清理指定命令的所有媒体同步监听
   * @param commandId 命令ID
   */
  cleanupCommandMediaSync(commandId: string): void {
    const cleanedKeys: string[] = []

    for (const [key, sync] of this.commandMediaSyncMap) {
      if (sync.commandId === commandId) {
        try {
          sync.unwatch()
          cleanedKeys.push(key)
          this.commandMediaSyncMap.delete(key)
          console.log(`❌ [SimplifiedMediaSyncManager] 清理命令 ${sync.desc} ${sync.id}`)
        } catch (error) {
          console.error(
            `❌ [SimplifiedMediaSyncManager] 清理命令媒体同步失败: ${commandId} (唯一ID: ${sync.id})`,
            error,
          )
        }
      }
    }

    if (cleanedKeys.length > 0) {
      console.log(
        `🗑️ [SimplifiedMediaSyncManager] 已清理命令媒体同步: ${commandId} (清理了 ${cleanedKeys.length} 个监听器): ${cleanedKeys.map((k) => k.split(':')[2]).join(', ')}`,
      )
    }
  }

  /**
   * 清理指定媒体项目的所有同步监听
   * @param mediaItemId 媒体项目ID
   */
  cleanupMediaItemSync(mediaItemId: string): void {
    const cleanedKeys: string[] = []

    for (const [key, sync] of this.commandMediaSyncMap) {
      if (sync.mediaItemId === mediaItemId) {
        try {
          sync.unwatch()
          cleanedKeys.push(key)
          this.commandMediaSyncMap.delete(key)
        } catch (error) {
          console.error(
            `❌ [SimplifiedMediaSyncManager] 清理媒体项目同步失败: ${mediaItemId} (唯一ID: ${sync.id})`,
            error,
          )
        }
      }
    }

    if (cleanedKeys.length > 0) {
      console.log(
        `🗑️ [SimplifiedMediaSyncManager] 已清理媒体项目同步: ${mediaItemId} (清理了 ${cleanedKeys.length} 个监听器): ${cleanedKeys.map((k) => k.split(':')[2]).join(', ')}`,
      )
    }
  }

  /**
   * 清理所有同步监听
   */
  cleanup(): void {
    const cleanedKeys: string[] = []
    let errorCount = 0

    for (const [key, sync] of this.commandMediaSyncMap) {
      try {
        sync.unwatch()
        cleanedKeys.push(key)
      } catch (error) {
        errorCount++
        console.error(
          `❌ [SimplifiedMediaSyncManager] 清理命令媒体同步失败: ${key} (唯一ID: ${sync.id})`,
          error,
        )
      }
    }

    this.commandMediaSyncMap.clear()

    console.log(
      `🧹 [SimplifiedMediaSyncManager] 已清理所有同步监听 (成功: ${cleanedKeys.length}, 失败: ${errorCount})`,
    )
    if (cleanedKeys.length > 0) {
      console.debug(
        `🔍 [SimplifiedMediaSyncManager] 清理的监听器唯一IDs: ${cleanedKeys.map((k) => k.split(':')[2]).join(', ')}`,
      )
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    activeSyncCount: number
    commandCount: number
    mediaItemCount: number
    uniqueIds: string[]
  } {
    const commandIds = new Set<string>()
    const mediaItemIds = new Set<string>()
    const uniqueIds: string[] = []

    for (const sync of this.commandMediaSyncMap.values()) {
      commandIds.add(sync.commandId)
      mediaItemIds.add(sync.mediaItemId)
      uniqueIds.push(sync.id)
    }

    return {
      activeSyncCount: this.commandMediaSyncMap.size,
      commandCount: commandIds.size,
      mediaItemCount: mediaItemIds.size,
      uniqueIds,
    }
  }

  /**
   * 获取调试信息
   */
  getDebugInfo(): {
    totalSyncs: number
    syncDetails: Array<{
      key: string
      id: string
      commandId: string
      mediaItemId: string
      timelineItemId?: string
    }>
  } {
    const syncDetails = []

    for (const [key, sync] of this.commandMediaSyncMap) {
      syncDetails.push({
        key,
        id: sync.id,
        commandId: sync.commandId,
        mediaItemId: sync.mediaItemId,
        timelineItemId: sync.timelineItemId,
      })
    }

    return {
      totalSyncs: this.commandMediaSyncMap.size,
      syncDetails,
    }
  }
}

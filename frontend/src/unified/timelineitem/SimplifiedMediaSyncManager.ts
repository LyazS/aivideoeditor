/**
 * 简化的媒体同步管理器
 * 只维护命令与媒体项目之间的同步关系，不涉及时间轴项目
 */

import type { SimpleCommand } from '../modules/commands/types'

/**
 * 简化的媒体同步管理器
 * 只维护命令与媒体项目之间的同步关系，不涉及时间轴项目
 */
export class SimplifiedMediaSyncManager {
  private static instance: SimplifiedMediaSyncManager
  private commandMediaSyncMap = new Map<string, {
    commandId: string
    mediaItemId: string
    unwatch: () => void
  }>()

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
   */
  registerCommandMediaSync(
    commandId: string,
    mediaItemId: string,
    unwatch: () => void
  ): void {
    const key = `${commandId}:${mediaItemId}`
    this.commandMediaSyncMap.set(key, {
      commandId,
      mediaItemId,
      unwatch
    })
    
    console.log(`🔗 [SimplifiedMediaSyncManager] 已注册命令媒体同步: ${commandId} <-> ${mediaItemId}`)
  }

  /**
   * 清理指定命令的所有媒体同步监听
   * @param commandId 命令ID
   */
  cleanupCommandMediaSync(commandId: string): void {
    for (const [key, sync] of this.commandMediaSyncMap) {
      if (sync.commandId === commandId) {
        try {
          sync.unwatch()
          this.commandMediaSyncMap.delete(key)
          console.log(`🗑️ [SimplifiedMediaSyncManager] 已清理命令媒体同步: ${commandId}`)
        } catch (error) {
          console.error(`❌ [SimplifiedMediaSyncManager] 清理命令媒体同步失败: ${commandId}`, error)
        }
      }
    }
  }

  /**
   * 清理指定媒体项目的所有同步监听
   * @param mediaItemId 媒体项目ID
   */
  cleanupMediaItemSync(mediaItemId: string): void {
    for (const [key, sync] of this.commandMediaSyncMap) {
      if (sync.mediaItemId === mediaItemId) {
        try {
          sync.unwatch()
          this.commandMediaSyncMap.delete(key)
          console.log(`🗑️ [SimplifiedMediaSyncManager] 已清理媒体项目同步: ${mediaItemId}`)
        } catch (error) {
          console.error(`❌ [SimplifiedMediaSyncManager] 清理媒体项目同步失败: ${mediaItemId}`, error)
        }
      }
    }
  }

  /**
   * 清理所有同步监听
   */
  cleanup(): void {
    for (const [key, sync] of this.commandMediaSyncMap) {
      try {
        sync.unwatch()
      } catch (error) {
        console.error(`❌ [SimplifiedMediaSyncManager] 清理命令媒体同步失败: ${key}`, error)
      }
    }
    this.commandMediaSyncMap.clear()
  }
}
/**
 * 统一媒体项目行为函数
 * 基于"核心数据与行为分离"的响应式重构方案
 */

import type {
  UnifiedMediaItemData,
  MediaStatus,
  MediaType,
  MediaTypeOrUnknown,
  WebAVObjects,
} from './types'
import { UnifiedMediaItemQueries } from './queries'

// ==================== 行为函数模块 ====================

// 重新导出查询函数以保持向后兼容性
export { UnifiedMediaItemQueries } from './queries'

/**
 * 统一媒体项目行为函数 - 无状态操作函数
 */
export const UnifiedMediaItemActions = {
  // 状态转换
  transitionTo(item: UnifiedMediaItemData, newStatus: MediaStatus, context?: any): boolean {
    if (!UnifiedMediaItemQueries.canTransitionTo(item, newStatus)) {
      console.warn(`无效状态转换: ${item.mediaStatus} → ${newStatus}`)
      return false
    }

    const oldStatus = item.mediaStatus
    item.mediaStatus = newStatus

    console.log(`媒体项目状态转换: ${item.name} ${oldStatus} → ${newStatus}`)

    return true
  },

  // 设置WebAV对象
  setWebAVObjects(item: UnifiedMediaItemData, webav: WebAVObjects): void {
    item.webav = webav
  },

  // 设置时长
  setDuration(item: UnifiedMediaItemData, duration: number): void {
    item.duration = duration
  },

  // 设置媒体类型
  setMediaType(item: UnifiedMediaItemData, mediaType: MediaType): void {
    item.mediaType = mediaType
  },

  // 更新名称
  updateName(item: UnifiedMediaItemData, newName: string): void {
    if (newName.trim()) {
      item.name = newName.trim()
      console.log(`媒体项目名称已更新: ${item.id} -> ${newName}`)
    }
  },

  // 重试
  retry(item: UnifiedMediaItemData): void {
    if (UnifiedMediaItemQueries.hasAnyError(item)) {
      UnifiedMediaItemActions.transitionTo(item, 'pending')
      // 重置数据源状态
      if (item.source.errorMessage) {
        item.source.progress = 0
        item.source.errorMessage = undefined
      }
    }
  },

  // 取消
  cancel(item: UnifiedMediaItemData): void {
    if (UnifiedMediaItemQueries.isProcessing(item)) {
      UnifiedMediaItemActions.transitionTo(item, 'cancelled')
      // 取消数据源获取 - 通过检查进度和错误信息来判断状态
      if (item.source.progress > 0 && item.source.progress < 100 && !item.source.file) {
        item.source.errorMessage = '已取消'
      }
    }
  },
}

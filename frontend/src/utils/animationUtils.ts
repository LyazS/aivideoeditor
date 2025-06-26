/**
 * 动画工具函数
 * 提供动画相关的基础工具函数
 */

import type { TimelineItem } from '../types'
import { clearAllKeyframes } from './keyframeUtils'

// ==================== 动画工具函数 ====================

/**
 * 清除时间轴项目的所有动画
 * @param item 时间轴项目
 */
export function clearItemAnimation(item: TimelineItem): void {
  if (!item) {
    console.error('🎬 [Animation Utils] Invalid item')
    return
  }

  try {
    clearAllKeyframes(item)
    console.log('🎬 [Animation Utils] Cleared all animation for item:', item.id)
  } catch (error) {
    console.error('🎬 [Animation Utils] Failed to clear animation:', error)
  }
}

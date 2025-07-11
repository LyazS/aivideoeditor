/**
 * 关键帧系统调试工具
 * 用于调试和验证关键帧系统的工作状态
 */

import type { LocalTimelineItem } from '../types'
import { isValidAnimationConfig } from './animationConverter'
import { hasAnimation } from './unifiedKeyframeUtils'

// ==================== 调试函数 ====================

/**
 * 获取TimelineItem的关键帧调试信息
 */
export function getKeyframeDebugInfo(item: LocalTimelineItem) {
  const errors: string[] = []

  try {
    const hasAnim = hasAnimation(item)

    if (!item.animation) {
      return { itemId: item.id, hasAnimation: false, errors: ['No animation config'] }
    }

    const clipDurationFrames = item.timeRange.timelineEndTime - item.timeRange.timelineStartTime
    const keyframes = item.animation.keyframes.map((kf) => ({
      framePosition: kf.framePosition,
      percentage: Math.round((kf.framePosition / clipDurationFrames) * 10000) / 100,
      properties: { ...kf.properties },
    }))

    const isValid = isValidAnimationConfig(item.animation)
    if (!isValid) errors.push('Invalid animation config')

    return {
      itemId: item.id,
      hasAnimation: hasAnim,
      isEnabled: item.animation.isEnabled,
      keyframeCount: item.animation.keyframes.length,
      keyframes,
      isValid,
      errors,
    }
  } catch (error) {
    errors.push(`Debug failed: ${error}`)
    return { itemId: item.id, hasAnimation: false, errors }
  }
}

/**
 * 打印关键帧调试信息到控制台
 */
export function logKeyframeDebugInfo(item: LocalTimelineItem): void {
  const debugInfo = getKeyframeDebugInfo(item)

  console.group(`🎬 [Keyframe Debug] ${debugInfo.itemId}`)
  console.log('📊 基本信息:', debugInfo)

  if (debugInfo.keyframes && debugInfo.keyframes.length > 0) {
    console.log('🎯 关键帧列表:')
    debugInfo.keyframes.forEach((kf, index) => {
      console.log(`  ${index + 1}. 帧位置: ${kf.framePosition}, 百分比: ${kf.percentage}%`)
    })
  }

  if (debugInfo.errors.length > 0) {
    console.error('❌ 错误:', debugInfo.errors)
  }

  console.groupEnd()
}

/**
 * 在WebAV动画更新时自动调试
 */
export function debugWebAVAnimationUpdate(item: LocalTimelineItem): void {
  if (import.meta.env.DEV) {
    console.log('🔄 [WebAV Animation Debug] 动画更新触发')
    logKeyframeDebugInfo(item)
  }
}

/**
 * 全局调试开关
 */
let isDebugEnabled = false

export function enableKeyframeDebug(): void {
  isDebugEnabled = true
  console.log('🎬 [Keyframe Debug] 调试模式已启用')
}

export function disableKeyframeDebug(): void {
  isDebugEnabled = false
  console.log('🎬 [Keyframe Debug] 调试模式已禁用')
}

export function isKeyframeDebugEnabled(): boolean {
  return isDebugEnabled
}

/**
 * 快速调试当前选中的TimelineItem
 */
export async function debugCurrentItem(): Promise<void> {
  try {
    const { useVideoStore } = await import('../stores/videoStore')
    const videoStore = useVideoStore()

    // 获取选中的时间轴项目
    const selectedItems: any[] = []

    if (videoStore.isMultiSelectMode) {
      // 多选模式：获取所有选中的项目
      videoStore.selectedTimelineItemIds.forEach((id) => {
        const item = videoStore.getTimelineItem(id)
        if (item) {
          selectedItems.push(item)
        }
      })
    } else if (videoStore.selectedTimelineItemId) {
      // 单选模式：获取单个选中项目
      const item = videoStore.getTimelineItem(videoStore.selectedTimelineItemId)
      if (item) {
        selectedItems.push(item)
      }
    }

    if (selectedItems.length === 0) {
      console.warn('🎬 [Keyframe Debug] 没有选中的时间轴项目')
      return
    }

    selectedItems.forEach((item) => {
      logKeyframeDebugInfo(item)
    })
  } catch (error) {
    console.error('🎬 [Keyframe Debug] 调试失败:', error)
  }
}

// 导出到全局对象以便在控制台中使用
if (typeof window !== 'undefined') {
  ;(window as any).keyframeDebug = {
    debugCurrentItem,
    enableKeyframeDebug,
    disableKeyframeDebug,
    logKeyframeDebugInfo,
  }
}

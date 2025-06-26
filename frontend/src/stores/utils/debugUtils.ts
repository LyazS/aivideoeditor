import type { MediaItem, TimelineItem } from '../../types'
import { framesToTimecode } from './timeUtils'

// ==================== 调试开关 ====================

// 声明全局调试开关类型
declare global {
  interface Window {
    DEBUG_TIMELINE_CONVERSION?: boolean
    DEBUG_TIMELINE_ZOOM?: boolean
    enableTimelineDebug?: () => void
    disableTimelineDebug?: () => void
  }
}

// 设置全局调试开关（默认关闭，需要时可手动开启）
window.DEBUG_TIMELINE_CONVERSION = false
window.DEBUG_TIMELINE_ZOOM = false

// 提供便捷的调试控制函数
window.enableTimelineDebug = () => {
  window.DEBUG_TIMELINE_CONVERSION = true
  window.DEBUG_TIMELINE_ZOOM = true
  console.log('🔧 时间轴调试模式已开启')
  console.log('📝 可用调试开关:')
  console.log('  - window.DEBUG_TIMELINE_CONVERSION: 坐标转换调试（会产生大量日志）')
  console.log('  - window.DEBUG_TIMELINE_ZOOM: 缩放调试（已精简，只显示警告信息）')
}

window.disableTimelineDebug = () => {
  window.DEBUG_TIMELINE_CONVERSION = false
  window.DEBUG_TIMELINE_ZOOM = false
  console.log('🔧 时间轴调试模式已关闭')
}

// ==================== 调试信息工具 ====================

/**
 * 打印调试信息，包括操作详情、素材库状态、时间轴状态等
 * @param operation 操作名称
 * @param details 操作详情
 * @param mediaItems 素材库数据
 * @param timelineItems 时间轴数据
 * @param tracks 轨道数据
 */
export function printDebugInfo(
  operation: string,
  details: unknown,
  mediaItems: MediaItem[],
  timelineItems: TimelineItem[],
  tracks: { id: number; name: string }[],
) {
  const timestamp = new Date().toLocaleTimeString()
  console.group(`🎬 [${timestamp}] ${operation}`)

  if (details) {
    console.log('📋 操作详情:', details)
  }

  console.log('📚 素材库状态 (mediaItems):')
  console.table(
    mediaItems.map((item) => ({
      id: item.id,
      name: item.name,
      duration: `${item.duration.toFixed(2)}s`,
      type: item.type,
      hasMP4Clip: !!item.mp4Clip,
    })),
  )

  console.log('🎞️ 时间轴状态 (timelineItems):')
  console.table(
    timelineItems.map((item) => ({
      id: item.id,
      mediaItemId: item.mediaItemId,
      trackId: item.trackId,
      position: framesToTimecode(item.timeRange.timelineStartTime),
      hasSprite: !!item.sprite,
    })),
  )

  console.log('📊 统计信息:')
  console.log(`- 素材库项目数: ${mediaItems.length}`)
  console.log(`- 时间轴项目数: ${timelineItems.length}`)
  console.log(`- 轨道数: ${tracks.length}`)

  // 检查引用关系
  const orphanedTimelineItems = timelineItems.filter(
    (timelineItem) => !mediaItems.find((mediaItem) => mediaItem.id === timelineItem.mediaItemId),
  )
  if (orphanedTimelineItems.length > 0) {
    console.warn('⚠️ 发现孤立的时间轴项目 (没有对应的素材库项目):', orphanedTimelineItems)
  }

  console.groupEnd()
}

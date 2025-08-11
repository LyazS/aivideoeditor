import type {
  LocalMediaItem,
  LocalTimelineItem,
  AsyncProcessingMediaItem,
  AsyncProcessingTimelineItem,
} from '../../types'
import {
  requiresMediaItem,
  isLocalMediaItem,
  isAsyncProcessingMediaItem,
  isLocalTimelineItem,
  isAsyncProcessingTimelineItem,
} from '../../types'
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
 * @param mediaItems 素材库数据（支持本地和异步处理素材）
 * @param timelineItems 时间轴数据（支持本地和异步处理时间轴项目）
 * @param tracks 轨道数据
 */
export function printDebugInfo(
  operation: string,
  details: unknown,
  mediaItems: (LocalMediaItem | AsyncProcessingMediaItem)[],
  timelineItems: (LocalTimelineItem | AsyncProcessingTimelineItem)[],
  tracks: { id: string; name: string }[],
) {
  const timestamp = new Date().toLocaleTimeString()
  console.group(`🎬 [${timestamp}] ${operation}`)

  if (details) {
    console.log('📋 操作详情:', details)
  }

  console.log('📚 素材库状态 (mediaItems):')
  console.table(
    mediaItems.map((item) => {
      if (isLocalMediaItem(item)) {
        // 本地媒体项目
        return {
          id: item.id,
          name: item.name,
          duration: `${item.duration.toFixed(2)}s`,
          type: item.type,
          mediaType: item.mediaType,
          hasMP4Clip: !!item.mp4Clip,
          status: 'local',
        }
      } else if (isAsyncProcessingMediaItem(item)) {
        // 异步处理媒体项目
        return {
          id: item.id,
          name: item.name,
          duration: `${item.expectedDuration}帧 (预计)`,
          type: item.processingType,
          mediaType: item.mediaType,
          hasMP4Clip: false,
          status: `${item.processingStatus} (${item.processingProgress}%)`,
        }
      } else {
        // 未知类型（理论上不应该到达这里）
        return {
          id: (item as any).id || 'unknown',
          name: (item as any).name || 'unknown',
          duration: 'unknown',
          type: 'unknown',
          mediaType: 'unknown',
          hasMP4Clip: false,
          status: 'unknown',
        }
      }
    }),
  )

  console.log('🎞️ 时间轴状态 (timelineItems):')
  console.table(
    timelineItems.map((item) => {
      if (isLocalTimelineItem(item)) {
        // 本地时间轴项目
        return {
          id: item.id,
          mediaItemId: item.mediaItemId,
          trackId: item.trackId,
          mediaType: item.mediaType,
          position: framesToTimecode(item.timeRange.timelineStartTime),
          hasSprite: !!item.sprite,
          type: 'local',
        }
      } else if (isAsyncProcessingTimelineItem(item)) {
        // 异步处理时间轴项目 - 从对应的素材项目获取状态
        const asyncMediaItem = mediaItems.find(
          (media) => isAsyncProcessingMediaItem(media) && media.id === item.mediaItemId,
        ) as AsyncProcessingMediaItem | undefined

        return {
          id: item.id,
          mediaItemId: item.mediaItemId,
          trackId: item.trackId,
          mediaType: item.mediaType,
          position: framesToTimecode(item.timeRange.timelineStartTime),
          hasSprite: !!item.sprite,
          type: `async-${asyncMediaItem?.processingType || 'unknown'}`,
          status: asyncMediaItem
            ? `${asyncMediaItem.processingStatus} (${asyncMediaItem.processingProgress}%)`
            : 'unknown',
        }
      } else {
        // 未知类型（理论上不应该到达这里）
        return {
          id: (item as any).id || 'unknown',
          mediaItemId: (item as any).mediaItemId || 'unknown',
          trackId: (item as any).trackId || 'unknown',
          mediaType: 'unknown',
          position: 'unknown',
          hasSprite: false,
          type: 'unknown',
        }
      }
    }),
  )

  console.log('📊 统计信息:')
  const localMediaCount = mediaItems.filter(isLocalMediaItem).length
  const asyncMediaCount = mediaItems.filter(isAsyncProcessingMediaItem).length
  const localTimelineCount = timelineItems.filter(isLocalTimelineItem).length
  const asyncTimelineCount = timelineItems.filter(isAsyncProcessingTimelineItem).length

  console.log(
    `- 素材库项目数: ${mediaItems.length} (本地: ${localMediaCount}, 异步处理: ${asyncMediaCount})`,
  )
  console.log(
    `- 时间轴项目数: ${timelineItems.length} (本地: ${localTimelineCount}, 异步处理: ${asyncTimelineCount})`,
  )
  console.log(`- 轨道数: ${tracks.length}`)

  // 检查引用关系（只检查需要素材库项目的媒体类型）
  const orphanedTimelineItems = timelineItems.filter((timelineItem) => {
    // 跳过异步处理时间轴项目，它们有自己的引用逻辑
    if (isAsyncProcessingTimelineItem(timelineItem)) {
      return false
    }

    // 对于本地时间轴项目，检查是否需要素材库项目
    if (isLocalTimelineItem(timelineItem)) {
      // 只检查需要素材库项目的媒体类型
      if (!requiresMediaItem(timelineItem.mediaType)) {
        return false
      }

      // 检查是否有对应的素材库项目
      return !mediaItems.find((mediaItem) => mediaItem.id === timelineItem.mediaItemId)
    }

    // 其他未知类型，跳过检查
    return false
  })

  if (orphanedTimelineItems.length > 0) {
    console.warn('⚠️ 发现孤立的时间轴项目 (没有对应的素材库项目):', orphanedTimelineItems)
  }

  console.groupEnd()
}

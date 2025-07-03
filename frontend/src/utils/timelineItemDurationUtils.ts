/**
 * TimelineItem时长变化处理工具
 * 当TimelineItem的时长发生变化时，自动调整关键帧位置
 */

import type { TimelineItem, VideoTimeRange, ImageTimeRange } from '../types'
import { isVideoTimeRange } from '../types'
import { adjustKeyframesForDurationChange } from './unifiedKeyframeUtils'

// ==================== 时长变化处理 ====================

/**
 * 计算clip的时长（帧数）
 * @param timeRange 时间范围
 * @returns 时长（帧数）
 */
export function getClipDurationFrames(timeRange: VideoTimeRange | ImageTimeRange): number {
  return timeRange.timelineEndTime - timeRange.timelineStartTime
}

/**
 * 处理TimelineItem时长变化，自动调整关键帧位置
 * @param item TimelineItem实例
 * @param newTimeRange 新的时间范围
 */
export function handleTimelineItemDurationChange(
  item: TimelineItem,
  newTimeRange: VideoTimeRange | ImageTimeRange,
): void {
  // 计算旧时长和新时长
  const oldDurationFrames = getClipDurationFrames(item.timeRange)
  const newDurationFrames = getClipDurationFrames(newTimeRange)

  console.log('🔄 [Duration Change] Handling timeline item duration change:', {
    itemId: item.id,
    oldDuration: oldDurationFrames,
    newDuration: newDurationFrames,
    hasAnimation: !!item.animation?.keyframes.length,
  })

  // 如果时长没有变化，直接返回
  if (Math.abs(oldDurationFrames - newDurationFrames) <= 1) {
    console.log('🔄 [Duration Change] Duration unchanged, skipping keyframe adjustment')
    return
  }

  // 调整关键帧位置
  if (item.animation && item.animation.keyframes.length > 0) {
    adjustKeyframesForDurationChange(item, oldDurationFrames, newDurationFrames)
  }

  // 更新TimelineItem的timeRange
  item.timeRange = newTimeRange
}

// ==================== 视频特定处理 ====================

/**
 * 处理视频TimelineItem的倍速变化
 * @param item 视频TimelineItem
 * @param newPlaybackRate 新的播放倍速
 */
export function handleVideoPlaybackRateChange(item: TimelineItem, newPlaybackRate: number): void {
  if (item.mediaType !== 'video' || !isVideoTimeRange(item.timeRange)) {
    console.warn('🔄 [Duration Change] Item is not a video, cannot change playback rate')
    return
  }

  const currentTimeRange = item.timeRange
  const clipDurationFrames = currentTimeRange.clipEndTime - currentTimeRange.clipStartTime

  // 计算新的有效时长（确保是整数帧数）
  const newEffectiveDuration = Math.round(clipDurationFrames / newPlaybackRate)
  const newTimelineEndTime = currentTimeRange.timelineStartTime + newEffectiveDuration

  const newTimeRange: VideoTimeRange = {
    ...currentTimeRange,
    timelineEndTime: newTimelineEndTime,
    effectiveDuration: newEffectiveDuration,
    playbackRate: newPlaybackRate,
  }

  console.log('🔄 [Duration Change] Handling video playback rate change:', {
    itemId: item.id,
    oldRate: currentTimeRange.playbackRate,
    newRate: newPlaybackRate,
    oldEffectiveDuration: currentTimeRange.effectiveDuration,
    newEffectiveDuration,
  })

  handleTimelineItemDurationChange(item, newTimeRange)
}

// ==================== 图片特定处理 ====================

/**
 * 处理图片TimelineItem的显示时长变化
 * @param item 图片TimelineItem
 * @param newDisplayDurationFrames 新的显示时长（帧数）
 */
export function handleImageDisplayDurationChange(
  item: TimelineItem,
  newDisplayDurationFrames: number,
): void {
  if (item.mediaType !== 'image') {
    console.warn('🔄 [Duration Change] Item is not an image, cannot change display duration')
    return
  }

  const currentTimeRange = item.timeRange
  const newTimelineEndTime = currentTimeRange.timelineStartTime + newDisplayDurationFrames

  const newTimeRange: ImageTimeRange = {
    timelineStartTime: currentTimeRange.timelineStartTime,
    timelineEndTime: newTimelineEndTime,
    displayDuration: newDisplayDurationFrames,
  }

  console.log('🔄 [Duration Change] Handling image display duration change:', {
    itemId: item.id,
    oldDuration: getClipDurationFrames(currentTimeRange),
    newDuration: newDisplayDurationFrames,
  })

  handleTimelineItemDurationChange(item, newTimeRange)
}

// ==================== 通用时长调整 ====================

/**
 * 直接设置TimelineItem的时长（保持开始位置不变）
 * @param item TimelineItem实例
 * @param newDurationFrames 新的时长（帧数）
 */
export function setTimelineItemDuration(item: TimelineItem, newDurationFrames: number): void {
  const currentTimeRange = item.timeRange
  const newTimelineEndTime = currentTimeRange.timelineStartTime + newDurationFrames

  let newTimeRange: VideoTimeRange | ImageTimeRange

  if (item.mediaType === 'video' && isVideoTimeRange(currentTimeRange)) {
    // 对于视频，通过调整倍速来实现时长变化
    const clipDurationFrames = currentTimeRange.clipEndTime - currentTimeRange.clipStartTime
    const newPlaybackRate = clipDurationFrames / newDurationFrames

    newTimeRange = {
      ...currentTimeRange,
      timelineEndTime: newTimelineEndTime, // newTimelineEndTime 已经是整数
      effectiveDuration: newDurationFrames, // newDurationFrames 已经是整数
      playbackRate: newPlaybackRate,
    }
  } else if (item.mediaType === 'audio' && isVideoTimeRange(currentTimeRange)) {
    // 对于音频，类似视频，通过调整倍速来实现时长变化
    const clipDurationFrames = currentTimeRange.clipEndTime - currentTimeRange.clipStartTime
    const newPlaybackRate = clipDurationFrames / newDurationFrames

    newTimeRange = {
      ...currentTimeRange,
      timelineEndTime: newTimelineEndTime, // newTimelineEndTime 已经是整数
      effectiveDuration: newDurationFrames, // newDurationFrames 已经是整数
      playbackRate: newPlaybackRate,
    }
  } else {
    // 对于图片，直接设置显示时长
    newTimeRange = {
      timelineStartTime: currentTimeRange.timelineStartTime,
      timelineEndTime: newTimelineEndTime,
      displayDuration: newDurationFrames,
    }
  }

  console.log('🔄 [Duration Change] Setting timeline item duration:', {
    itemId: item.id,
    mediaType: item.mediaType,
    oldDuration: getClipDurationFrames(currentTimeRange),
    newDuration: newDurationFrames,
  })

  handleTimelineItemDurationChange(item, newTimeRange)
}

// ==================== 位置调整 ====================

/**
 * 移动TimelineItem到新位置（保持时长不变）
 * @param item TimelineItem实例
 * @param newStartTimeFrames 新的开始时间（帧数）
 */
export function moveTimelineItem(item: TimelineItem, newStartTimeFrames: number): void {
  const currentTimeRange = item.timeRange
  const durationFrames = getClipDurationFrames(currentTimeRange)
  const newTimelineEndTime = newStartTimeFrames + durationFrames

  let newTimeRange: VideoTimeRange | ImageTimeRange

  if (item.mediaType === 'video' && isVideoTimeRange(currentTimeRange)) {
    newTimeRange = {
      ...currentTimeRange,
      timelineStartTime: newStartTimeFrames,
      timelineEndTime: newTimelineEndTime,
    }
  } else if (item.mediaType === 'audio' && isVideoTimeRange(currentTimeRange)) {
    newTimeRange = {
      ...currentTimeRange,
      timelineStartTime: newStartTimeFrames,
      timelineEndTime: newTimelineEndTime,
    }
  } else {
    newTimeRange = {
      timelineStartTime: newStartTimeFrames,
      timelineEndTime: newTimelineEndTime,
      displayDuration: durationFrames,
    }
  }

  console.log('🔄 [Duration Change] Moving timeline item:', {
    itemId: item.id,
    oldStart: currentTimeRange.timelineStartTime,
    newStart: newStartTimeFrames,
    duration: durationFrames,
  })

  // 移动不会改变时长，但需要更新timeRange
  // 关键帧位置是相对的，所以不需要调整
  item.timeRange = newTimeRange
}

// ==================== 验证函数 ====================

/**
 * 验证时长变化后的数据一致性
 * @param item TimelineItem实例
 * @returns 是否验证通过
 */
export function validateTimelineItemAfterDurationChange(item: TimelineItem): boolean {
  const timeRange = item.timeRange
  const durationFrames = getClipDurationFrames(timeRange)

  // 检查时长是否为正数
  if (durationFrames <= 0) {
    console.error('🚨 [Duration Change] Invalid duration:', durationFrames)
    return false
  }

  // 检查关键帧位置是否在有效范围内
  if (item.animation && item.animation.keyframes.length > 0) {
    for (const keyframe of item.animation.keyframes) {
      if (keyframe.framePosition < 0 || keyframe.framePosition > durationFrames) {
        console.error('🚨 [Duration Change] Keyframe position out of range:', {
          framePosition: keyframe.framePosition,
          duration: durationFrames,
        })
        return false
      }
    }
  }

  return true
}

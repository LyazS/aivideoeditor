/**
 * 基于Timecode的时间范围类型定义
 * 这些类型将逐步替换基于微秒的时间范围类型
 */

import { Timecode } from '../utils/Timecode'

// ==================== 基于Timecode的时间范围接口 ====================

/**
 * 视频时间范围接口（基于Timecode）
 */
export interface TimecodeVideoTimeRange {
  /** 素材内部开始时间 - 从素材的哪个时间点开始播放 */
  clipStartTime: Timecode
  /** 素材内部结束时间 - 播放到素材的哪个时间点结束 */
  clipEndTime: Timecode
  /** 时间轴开始时间 - 素材在整个项目时间轴上的开始位置 */
  timelineStartTime: Timecode
  /** 时间轴结束时间 - 素材在整个项目时间轴上的结束位置 */
  timelineEndTime: Timecode
  /** 有效播放时长 - 在时间轴上占用的时长，如果与素材内部时长不同则表示变速 */
  effectiveDuration: Timecode
  /** 播放速度倍率 - 1.0为正常速度，2.0为2倍速，0.5为0.5倍速 */
  playbackRate: number
}

/**
 * 图片时间范围接口（基于Timecode）
 */
export interface TimecodeImageTimeRange {
  /** 时间轴开始时间 - 图片在整个项目时间轴上的开始位置 */
  timelineStartTime: Timecode
  /** 时间轴结束时间 - 图片在整个项目时间轴上的结束位置 */
  timelineEndTime: Timecode
  /** 显示时长 - 图片在时间轴上显示的时长 */
  displayDuration: Timecode
}

// ==================== 转换工具函数 ====================

/**
 * 将微秒时间范围转换为Timecode时间范围（视频）
 */
export function microsecondVideoTimeRangeToTimecode(
  microsecondRange: {
    clipStartTime: number
    clipEndTime: number
    timelineStartTime: number
    timelineEndTime: number
    effectiveDuration: number
    playbackRate: number
  },
  frameRate: number = 30
): TimecodeVideoTimeRange {
  return {
    clipStartTime: Timecode.fromMicroseconds(microsecondRange.clipStartTime, frameRate),
    clipEndTime: Timecode.fromMicroseconds(microsecondRange.clipEndTime, frameRate),
    timelineStartTime: Timecode.fromMicroseconds(microsecondRange.timelineStartTime, frameRate),
    timelineEndTime: Timecode.fromMicroseconds(microsecondRange.timelineEndTime, frameRate),
    effectiveDuration: Timecode.fromMicroseconds(microsecondRange.effectiveDuration, frameRate),
    playbackRate: microsecondRange.playbackRate,
  }
}

/**
 * 将Timecode时间范围转换为微秒时间范围（视频）
 */
export function timecodeVideoTimeRangeToMicroseconds(
  timecodeRange: TimecodeVideoTimeRange
): {
  clipStartTime: number
  clipEndTime: number
  timelineStartTime: number
  timelineEndTime: number
  effectiveDuration: number
  playbackRate: number
} {
  return {
    clipStartTime: timecodeRange.clipStartTime.toMicroseconds(),
    clipEndTime: timecodeRange.clipEndTime.toMicroseconds(),
    timelineStartTime: timecodeRange.timelineStartTime.toMicroseconds(),
    timelineEndTime: timecodeRange.timelineEndTime.toMicroseconds(),
    effectiveDuration: timecodeRange.effectiveDuration.toMicroseconds(),
    playbackRate: timecodeRange.playbackRate,
  }
}

/**
 * 将微秒时间范围转换为Timecode时间范围（图片）
 */
export function microsecondImageTimeRangeToTimecode(
  microsecondRange: {
    timelineStartTime: number
    timelineEndTime: number
    displayDuration: number
  },
  frameRate: number = 30
): TimecodeImageTimeRange {
  return {
    timelineStartTime: Timecode.fromMicroseconds(microsecondRange.timelineStartTime, frameRate),
    timelineEndTime: Timecode.fromMicroseconds(microsecondRange.timelineEndTime, frameRate),
    displayDuration: Timecode.fromMicroseconds(microsecondRange.displayDuration, frameRate),
  }
}

/**
 * 将Timecode时间范围转换为微秒时间范围（图片）
 */
export function timecodeImageTimeRangeToMicroseconds(
  timecodeRange: TimecodeImageTimeRange
): {
  timelineStartTime: number
  timelineEndTime: number
  displayDuration: number
} {
  return {
    timelineStartTime: timecodeRange.timelineStartTime.toMicroseconds(),
    timelineEndTime: timecodeRange.timelineEndTime.toMicroseconds(),
    displayDuration: timecodeRange.displayDuration.toMicroseconds(),
  }
}

// ==================== 类型守卫函数 ====================

/**
 * 检查时间范围是否为视频时间范围（Timecode版本）
 */
export function isTimecodeVideoTimeRange(
  timeRange: TimecodeVideoTimeRange | TimecodeImageTimeRange
): timeRange is TimecodeVideoTimeRange {
  return 'clipStartTime' in timeRange && 'clipEndTime' in timeRange && 'effectiveDuration' in timeRange && 'playbackRate' in timeRange
}

/**
 * 检查时间范围是否为图片时间范围（Timecode版本）
 */
export function isTimecodeImageTimeRange(
  timeRange: TimecodeVideoTimeRange | TimecodeImageTimeRange
): timeRange is TimecodeImageTimeRange {
  return 'displayDuration' in timeRange && !('clipStartTime' in timeRange)
}

// ==================== 工具函数 ====================

/**
 * 创建默认的视频时间范围
 */
export function createDefaultVideoTimeRange(frameRate: number = 30): TimecodeVideoTimeRange {
  const zero = Timecode.zero(frameRate)
  return {
    clipStartTime: zero,
    clipEndTime: zero,
    timelineStartTime: zero,
    timelineEndTime: zero,
    effectiveDuration: zero,
    playbackRate: 1.0,
  }
}

/**
 * 创建默认的图片时间范围
 */
export function createDefaultImageTimeRange(frameRate: number = 30): TimecodeImageTimeRange {
  const zero = Timecode.zero(frameRate)
  const defaultDuration = Timecode.fromSeconds(5, frameRate) // 默认5秒
  return {
    timelineStartTime: zero,
    timelineEndTime: defaultDuration,
    displayDuration: defaultDuration,
  }
}

/**
 * 计算时间范围的持续时间
 */
export function calculateTimeRangeDuration(
  timeRange: TimecodeVideoTimeRange | TimecodeImageTimeRange
): Timecode {
  if (isTimecodeVideoTimeRange(timeRange)) {
    return timeRange.timelineEndTime.subtract(timeRange.timelineStartTime)
  } else {
    return timeRange.displayDuration
  }
}

/**
 * 检查时间范围是否有效
 */
export function isTimeRangeValid(
  timeRange: TimecodeVideoTimeRange | TimecodeImageTimeRange
): boolean {
  if (isTimecodeVideoTimeRange(timeRange)) {
    // 视频时间范围验证
    if (timeRange.clipStartTime.greaterThan(timeRange.clipEndTime)) return false
    if (timeRange.timelineStartTime.greaterThan(timeRange.timelineEndTime)) return false
    if (timeRange.playbackRate <= 0) return false
    return true
  } else {
    // 图片时间范围验证
    if (timeRange.timelineStartTime.greaterThan(timeRange.timelineEndTime)) return false
    if (timeRange.displayDuration.isZero() || timeRange.displayDuration.totalFrames < 0) return false
    return true
  }
}

/**
 * 检查时间点是否在时间范围内
 */
export function isTimeInRange(
  time: Timecode,
  timeRange: TimecodeVideoTimeRange | TimecodeImageTimeRange
): boolean {
  return !time.lessThan(timeRange.timelineStartTime) && time.lessThan(timeRange.timelineEndTime)
}

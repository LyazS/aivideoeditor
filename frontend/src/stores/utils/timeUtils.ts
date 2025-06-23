import type { Ref } from 'vue'

// ==================== 时间计算工具 ====================

// ==================== 时间码转换系统 ====================

/**
 * 时间码格式：时:分:秒.帧 (HH:MM:SS.FF)
 * 统一使用30fps作为帧率
 */
const STANDARD_FRAME_RATE = 30

/**
 * 时间码对象接口
 */
export interface Timecode {
  hours: number
  minutes: number
  seconds: number
  frames: number
}

/**
 * 将微秒转换为时间码对象
 * @param microseconds 微秒
 * @param frameRate 帧率（默认30fps）
 * @returns 时间码对象
 */
export function microsecondsToTimecode(microseconds: number, frameRate: number = STANDARD_FRAME_RATE): Timecode {
  // 将微秒转换为秒
  const totalSeconds = microseconds / 1000000

  // 计算各个时间单位
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)

  // 计算帧数：取小数部分乘以帧率
  const fractionalSeconds = totalSeconds % 1
  const frames = Math.floor(fractionalSeconds * frameRate)

  return { hours, minutes, seconds, frames }
}

/**
 * 将时间码对象转换为微秒
 * @param timecode 时间码对象
 * @param frameRate 帧率（默认30fps）
 * @returns 微秒
 */
export function timecodeToMicroseconds(timecode: Timecode, frameRate: number = STANDARD_FRAME_RATE): number {
  const { hours, minutes, seconds, frames } = timecode

  // 计算总秒数
  const totalSeconds = hours * 3600 + minutes * 60 + seconds + (frames / frameRate)

  // 转换为微秒
  return Math.round(totalSeconds * 1000000)
}

/**
 * 将微秒转换为时间码字符串
 * @param microseconds 微秒
 * @param frameRate 帧率（默认30fps）
 * @returns 时间码字符串 (HH:MM:SS.FF)
 */
export function microsecondsToTimecodeString(microseconds: number, frameRate: number = STANDARD_FRAME_RATE): string {
  const timecode = microsecondsToTimecode(microseconds, frameRate)
  return formatTimecode(timecode)
}

/**
 * 将时间码字符串转换为微秒
 * @param timecodeString 时间码字符串 (HH:MM:SS.FF 或 MM:SS.FF)
 * @param frameRate 帧率（默认30fps）
 * @returns 微秒
 */
export function timecodeStringToMicroseconds(timecodeString: string, frameRate: number = STANDARD_FRAME_RATE): number {
  const timecode = parseTimecode(timecodeString)
  return timecodeToMicroseconds(timecode, frameRate)
}

/**
 * 格式化时间码对象为字符串
 * @param timecode 时间码对象
 * @returns 格式化的时间码字符串 (HH:MM:SS.FF)
 */
export function formatTimecode(timecode: Timecode): string {
  const { hours, minutes, seconds, frames } = timecode

  if (hours > 0) {
    // 有小时时显示完整格式
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`
  } else {
    // 无小时时显示简化格式
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`
  }
}

/**
 * 解析时间码字符串为时间码对象
 * @param timecodeString 时间码字符串 (支持 HH:MM:SS.FF 或 MM:SS.FF 格式)
 * @returns 时间码对象
 */
export function parseTimecode(timecodeString: string): Timecode {
  // 移除空格并转换为大写
  const cleaned = timecodeString.trim()

  // 匹配时间码格式：可选的小时:分钟:秒.帧
  const match = cleaned.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})\.(\d{1,2})$/)

  if (!match) {
    throw new Error(`无效的时间码格式: ${timecodeString}。请使用 HH:MM:SS.FF 或 MM:SS.FF 格式`)
  }

  const hours = match[1] ? parseInt(match[1], 10) : 0
  const minutes = parseInt(match[2], 10)
  const seconds = parseInt(match[3], 10)
  const frames = parseInt(match[4], 10)

  // 验证范围
  if (minutes >= 60 || seconds >= 60 || frames >= STANDARD_FRAME_RATE) {
    throw new Error(`时间码值超出范围: ${timecodeString}`)
  }

  return { hours, minutes, seconds, frames }
}

/**
 * 将秒转换为时间码字符串（兼容现有代码）
 * @param seconds 秒
 * @param frameRate 帧率（默认30fps）
 * @returns 时间码字符串
 */
export function secondsToTimecodeString(seconds: number, frameRate: number = STANDARD_FRAME_RATE): string {
  const microseconds = seconds * 1000000
  return microsecondsToTimecodeString(microseconds, frameRate)
}

/**
 * 将时间码字符串转换为秒（兼容现有代码）
 * @param timecodeString 时间码字符串
 * @param frameRate 帧率（默认30fps）
 * @returns 秒
 */
export function timecodeStringToSeconds(timecodeString: string, frameRate: number = STANDARD_FRAME_RATE): number {
  const microseconds = timecodeStringToMicroseconds(timecodeString, frameRate)
  return microseconds / 1000000
}

/**
 * 将时间对齐到帧边界
 * @param time 时间（秒）
 * @param frameRate 帧率
 * @returns 对齐后的时间
 */
export function alignTimeToFrame(time: number, frameRate: number): number {
  const frameDuration = 1 / frameRate
  return Math.floor(time / frameDuration) * frameDuration
}

/**
 * 计算每秒像素数
 * @param timelineWidth 时间轴宽度（像素）
 * @param totalDuration 总时长（秒）
 * @param zoomLevel 缩放级别
 * @returns 每秒像素数
 */
export function calculatePixelsPerSecond(
  timelineWidth: number,
  totalDuration: number,
  zoomLevel: number,
): number {
  return (timelineWidth * zoomLevel) / totalDuration
}

/**
 * 格式化时间显示
 * @param seconds 时间（秒）
 * @param precision 显示精度：'timecode' | 'frames' | 'milliseconds' | 'seconds' | 'hours'
 * @param frameRate 帧率（当precision为'frames'或'timecode'时需要）
 * @returns 格式化的时间字符串
 */
export function formatTime(
  seconds: number,
  precision: 'timecode' | 'frames' | 'milliseconds' | 'seconds' | 'hours' = 'seconds',
  frameRate: number = STANDARD_FRAME_RATE,
): string {
  // 新增：时间码格式
  if (precision === 'timecode') {
    return secondsToTimecodeString(seconds, frameRate)
  }

  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  switch (precision) {
    case 'hours': {
      if (hours > 0) {
        // 如果有小时，显示完整的时:分:秒.毫秒格式
        const milliseconds = Math.floor((seconds % 1) * 1000)
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
      } else {
        // 没有小时时，使用毫秒格式
        const ms = Math.floor((seconds % 1) * 100)
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
      }
    }
    case 'frames': {
      const frames = Math.floor((seconds % 1) * frameRate)
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`
    }
    case 'milliseconds': {
      const ms = Math.floor((seconds % 1) * 100)
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
    }
    case 'seconds':
    default:
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
}

/**
 * 根据缩放级别自动选择时间显示精度
 * @param seconds 时间（秒）
 * @param pixelsPerSecond 每秒像素数
 * @param frameRate 帧率
 * @returns 格式化的时间字符串
 */
export function formatTimeWithAutoPrecision(
  seconds: number,
  pixelsPerSecond: number,
  frameRate: number = STANDARD_FRAME_RATE,
): string {
  if (pixelsPerSecond >= 300) {
    // 高缩放级别：显示时间码格式（时:分:秒.帧）
    return formatTime(seconds, 'timecode', frameRate)
  } else if (pixelsPerSecond >= 100) {
    // 中等缩放级别：显示毫秒
    return formatTime(seconds, 'milliseconds')
  } else {
    // 低缩放级别：只显示分秒
    return formatTime(seconds, 'seconds')
  }
}

/**
 * 动态扩展时间轴长度（用于拖拽时预先扩展）
 * @param targetTime 目标时间
 * @param timelineDuration 当前时间轴长度的ref
 */
export function expandTimelineIfNeeded(targetTime: number, timelineDuration: Ref<number>) {
  if (targetTime > timelineDuration.value) {
    // 扩展到目标时间的1.5倍，确保有足够的空间
    timelineDuration.value = Math.max(targetTime * 1.5, timelineDuration.value)
  }
}

/**
 * 格式化文件大小
 * @param bytes 文件大小（字节）
 * @param precision 小数位数（默认为1）
 * @returns 格式化的文件大小字符串
 */
export function formatFileSize(bytes: number, precision: number = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(precision)) + ' ' + sizes[i]
}

import type { Ref } from 'vue'

// ==================== 时间码系统常量 ====================

/** 固定帧率：30fps */
export const FRAME_RATE = 30

// ==================== 时间计算工具 ====================



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

// ==================== 时间码转换函数 ====================

/**
 * 帧数转换为秒数
 * @param frames 帧数
 * @returns 秒数
 */
export function framesToSeconds(frames: number): number {
  return frames / FRAME_RATE
}

/**
 * 秒数转换为帧数
 * @param seconds 秒数
 * @returns 帧数（向下取整）
 */
export function secondsToFrames(seconds: number): number {
  return Math.floor(seconds * FRAME_RATE)
}

/**
 * 帧数转换为微秒（WebAV接口）
 * @param frames 帧数
 * @returns 微秒数
 */
export function framesToMicroseconds(frames: number): number {
  // 使用更精确的计算，避免精度丢失
  return Math.round((frames / FRAME_RATE) * 1_000_000)
}

/**
 * 微秒转换为帧数（WebAV接口）
 * @param microseconds 微秒数
 * @returns 帧数（向下取整）
 */
export function microsecondsToFrames(microseconds: number): number {
  // 使用四舍五入来避免精度问题，然后向下取整
  return Math.floor(Math.round((microseconds / 1_000_000) * FRAME_RATE * 1000) / 1000)
}

/**
 * 帧数转换为时间码字符串
 * @param frames 帧数
 * @returns 时间码字符串 "HH:MM:SS.FF"
 */
export function framesToTimecode(frames: number): string {
  const totalSeconds = Math.floor(frames / FRAME_RATE)
  const remainingFrames = frames % FRAME_RATE

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${remainingFrames.toString().padStart(2, '0')}`
}

/**
 * 时间码字符串转换为帧数
 * @param timecode 时间码字符串 "HH:MM:SS.FF"
 * @returns 帧数
 * @throws Error 如果时间码格式无效
 */
export function timecodeToFrames(timecode: string): number {
  const match = timecode.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{2})$/)
  if (!match) {
    throw new Error(`Invalid timecode format: ${timecode}. Expected format: HH:MM:SS.FF`)
  }

  const [, hours, minutes, seconds, frames] = match.map(Number)

  // 验证范围
  if (minutes >= 60 || seconds >= 60 || frames >= FRAME_RATE) {
    throw new Error(`Invalid timecode values: ${timecode}`)
  }

  return (hours * 3600 + minutes * 60 + seconds) * FRAME_RATE + frames
}

/**
 * 将帧数对齐到整数帧
 * @param frames 帧数
 * @returns 对齐后的帧数（整数）
 */
export function alignFramesToFrame(frames: number): number {
  return Math.floor(frames)
}

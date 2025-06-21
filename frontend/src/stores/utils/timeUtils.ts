import type { Ref } from 'vue'

// ==================== 时间计算工具 ====================

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
 * @param precision 显示精度：'frames' | 'milliseconds' | 'seconds' | 'hours'
 * @param frameRate 帧率（当precision为'frames'时需要）
 * @returns 格式化的时间字符串
 */
export function formatTime(
  seconds: number,
  precision: 'frames' | 'milliseconds' | 'seconds' | 'hours' = 'seconds',
  frameRate: number = 30,
): string {
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
  frameRate: number = 30,
): string {
  if (pixelsPerSecond >= 300) {
    // 高缩放级别：显示帧
    return formatTime(seconds, 'frames', frameRate)
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

import { calculatePixelsPerSecond } from './timeUtils'

// ==================== 坐标转换工具 ====================

/**
 * 计算可见时间范围
 * @param timelineWidth 时间轴宽度（像素）
 * @param totalDuration 总时长（秒）
 * @param zoomLevel 缩放级别
 * @param scrollOffset 滚动偏移量（像素）
 * @param maxVisibleDuration 最大可见时长（秒）
 * @returns 可见时间范围 { startTime, endTime }
 */
export function calculateVisibleTimeRange(
  timelineWidth: number,
  totalDuration: number,
  zoomLevel: number,
  scrollOffset: number,
  maxVisibleDuration?: number,
): { startTime: number; endTime: number } {
  const pixelsPerSecond = calculatePixelsPerSecond(timelineWidth, totalDuration, zoomLevel)
  const startTime = scrollOffset / pixelsPerSecond
  const calculatedEndTime = startTime + timelineWidth / pixelsPerSecond
  const endTime = maxVisibleDuration ? Math.min(calculatedEndTime, maxVisibleDuration) : calculatedEndTime

  return { startTime, endTime }
}

/**
 * 将时间转换为像素位置（考虑缩放和滚动）
 * @param time 时间（秒）
 * @param timelineWidth 时间轴宽度（像素）
 * @param totalDuration 总时长（秒）
 * @param zoomLevel 缩放级别
 * @param scrollOffset 滚动偏移量（像素）
 * @returns 像素位置
 */
export function timeToPixel(
  time: number,
  timelineWidth: number,
  totalDuration: number,
  zoomLevel: number,
  scrollOffset: number,
): number {
  const pixelsPerSecond = (timelineWidth * zoomLevel) / totalDuration
  const pixelPosition = time * pixelsPerSecond - scrollOffset

  // 只在调试模式下输出详细信息，避免过多日志
  if (window.DEBUG_TIMELINE_CONVERSION) {
    console.log('⏰➡️📐 [坐标转换] 时间转像素:', {
      time: time.toFixed(3),
      timelineWidth,
      totalDuration: totalDuration.toFixed(2),
      zoomLevel: zoomLevel.toFixed(3),
      scrollOffset: scrollOffset.toFixed(2),
      pixelsPerSecond: pixelsPerSecond.toFixed(2),
      pixelPosition: pixelPosition.toFixed(2),
    })
  }

  return pixelPosition
}

/**
 * 将像素位置转换为时间（考虑缩放和滚动）
 * @param pixel 像素位置
 * @param timelineWidth 时间轴宽度（像素）
 * @param totalDuration 总时长（秒）
 * @param zoomLevel 缩放级别
 * @param scrollOffset 滚动偏移量（像素）
 * @returns 时间（秒）
 */
export function pixelToTime(
  pixel: number,
  timelineWidth: number,
  totalDuration: number,
  zoomLevel: number,
  scrollOffset: number,
): number {
  const pixelsPerSecond = (timelineWidth * zoomLevel) / totalDuration
  const time = (pixel + scrollOffset) / pixelsPerSecond

  // 只在调试模式下输出详细信息，避免过多日志
  if (window.DEBUG_TIMELINE_CONVERSION) {
    console.log('📐➡️⏰ [坐标转换] 像素转时间:', {
      pixel: pixel.toFixed(2),
      timelineWidth,
      totalDuration: totalDuration.toFixed(2),
      zoomLevel: zoomLevel.toFixed(3),
      scrollOffset: scrollOffset.toFixed(2),
      pixelsPerSecond: pixelsPerSecond.toFixed(2),
      time: time.toFixed(3),
    })
  }

  return time
}

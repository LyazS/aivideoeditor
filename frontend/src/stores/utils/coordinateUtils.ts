import { calculatePixelsPerSecond } from './timeUtils'
import { Timecode } from '@/utils/Timecode'

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

// ==================== Timecode 支持的坐标转换工具 ====================

/**
 * 将Timecode转换为像素位置（考虑缩放和滚动）
 * @param timecode Timecode对象
 * @param timelineWidth 时间轴宽度（像素）
 * @param totalDuration 总时长（Timecode对象）
 * @param zoomLevel 缩放级别
 * @param scrollOffset 滚动偏移量（像素）
 * @returns 像素位置
 */
export function timecodeToPixel(
  timecode: Timecode,
  timelineWidth: number,
  totalDuration: Timecode,
  zoomLevel: number,
  scrollOffset: number,
): number {
  // 基于帧数进行计算，避免浮点数精度问题
  const timeRatio = timecode.totalFrames / totalDuration.totalFrames
  const pixelPosition = timeRatio * timelineWidth * zoomLevel - scrollOffset

  // 只在调试模式下输出详细信息，避免过多日志
  if (window.DEBUG_TIMELINE_CONVERSION) {
    console.log('⏰➡️📐 [Timecode坐标转换] 时间码转像素:', {
      timecode: timecode.toString(),
      totalFrames: timecode.totalFrames,
      totalDurationFrames: totalDuration.totalFrames,
      timeRatio: timeRatio.toFixed(6),
      timelineWidth,
      zoomLevel: zoomLevel.toFixed(3),
      scrollOffset: scrollOffset.toFixed(2),
      pixelPosition: pixelPosition.toFixed(2),
    })
  }

  return pixelPosition
}

/**
 * 将像素位置转换为Timecode（考虑缩放和滚动）
 * @param pixel 像素位置
 * @param timelineWidth 时间轴宽度（像素）
 * @param totalDuration 总时长（Timecode对象）
 * @param zoomLevel 缩放级别
 * @param scrollOffset 滚动偏移量（像素）
 * @returns Timecode对象
 */
export function pixelToTimecode(
  pixel: number,
  timelineWidth: number,
  totalDuration: Timecode,
  zoomLevel: number,
  scrollOffset: number,
): Timecode {
  // 基于帧数进行计算，确保帧级精度
  const timeRatio = (pixel + scrollOffset) / (timelineWidth * zoomLevel)
  const targetFrames = Math.round(timeRatio * totalDuration.totalFrames)
  const clampedFrames = Math.max(0, Math.min(targetFrames, totalDuration.totalFrames))

  const resultTimecode = new Timecode(clampedFrames, totalDuration.frameRate)

  // 只在调试模式下输出详细信息，避免过多日志
  if (window.DEBUG_TIMELINE_CONVERSION) {
    console.log('📐➡️⏰ [Timecode坐标转换] 像素转时间码:', {
      pixel: pixel.toFixed(2),
      timelineWidth,
      totalDurationFrames: totalDuration.totalFrames,
      zoomLevel: zoomLevel.toFixed(3),
      scrollOffset: scrollOffset.toFixed(2),
      timeRatio: timeRatio.toFixed(6),
      targetFrames,
      clampedFrames,
      resultTimecode: resultTimecode.toString(),
    })
  }

  return resultTimecode
}

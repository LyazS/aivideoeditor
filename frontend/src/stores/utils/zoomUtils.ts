// ==================== 缩放计算工具 ====================

/**
 * 计算最大缩放级别
 * @param timelineWidth 时间轴宽度（像素）
 * @param frameRate 帧率
 * @param totalDuration 总时长（秒）
 * @returns 最大缩放级别
 */
export function getMaxZoomLevel(
  timelineWidth: number,
  frameRate: number,
  totalDuration: number,
): number {
  // 最大缩放级别：一帧占用容器宽度的1/20（即5%）
  const targetFrameWidth = timelineWidth / 20 // 一帧占1/20横幅
  const frameDuration = 1 / frameRate // 一帧的时长（秒）
  const requiredPixelsPerSecond = targetFrameWidth / frameDuration
  const calculatedMaxZoom = (requiredPixelsPerSecond * totalDuration) / timelineWidth
  const maxZoom = Math.max(calculatedMaxZoom, 100) // 确保至少有100倍缩放

  if (window.DEBUG_TIMELINE_ZOOM) {
    console.group('🔬 [缩放计算] 计算最大缩放级别')

    console.log('📐 最大缩放计算参数:', {
      timelineWidth,
      frameRate,
      totalDuration: totalDuration.toFixed(2),
      targetFrameWidth: targetFrameWidth.toFixed(2),
      frameDuration: frameDuration.toFixed(4),
    })

    console.log('📊 最大缩放计算结果:', {
      requiredPixelsPerSecond: requiredPixelsPerSecond.toFixed(2),
      calculatedMaxZoom: calculatedMaxZoom.toFixed(3),
      finalMaxZoom: maxZoom.toFixed(3),
      limitedByMinimum: maxZoom === 100,
    })

    console.groupEnd()
  }

  return maxZoom
}

/**
 * 计算最小缩放级别
 * @param totalDuration 总时长（秒）
 * @param maxVisibleDuration 最大可见时长（秒）
 * @returns 最小缩放级别
 */
export function getMinZoomLevel(totalDuration: number, maxVisibleDuration: number): number {
  // 基于最大可见范围计算最小缩放级别
  const minZoom = totalDuration / maxVisibleDuration

  if (window.DEBUG_TIMELINE_ZOOM) {
    console.group('🔍 [缩放计算] 计算最小缩放级别')

    console.log('📐 最小缩放计算参数:', {
      totalDuration: totalDuration.toFixed(2),
      maxVisibleDuration: maxVisibleDuration.toFixed(2),
    })

    console.log('📊 最小缩放计算结果:', {
      minZoom: minZoom.toFixed(3),
      ratio: (totalDuration / maxVisibleDuration).toFixed(3),
    })

    console.groupEnd()
  }

  return minZoom
}

/**
 * 计算最大滚动偏移量
 * @param timelineWidth 时间轴宽度（像素）
 * @param zoomLevel 缩放级别
 * @param totalDuration 总时长（秒）
 * @param maxVisibleDuration 最大可见时长（秒）
 * @returns 最大滚动偏移量（像素）
 */
export function getMaxScrollOffset(
  timelineWidth: number,
  zoomLevel: number,
  totalDuration: number,
  maxVisibleDuration: number,
): number {
  // 使用最大可见范围作为滚动范围，允许滚动到内容结束时间*4的位置
  const effectiveDuration = maxVisibleDuration
  const pixelsPerSecond = (timelineWidth * zoomLevel) / totalDuration
  const visibleDuration = timelineWidth / pixelsPerSecond
  const maxScrollableTime = Math.max(0, effectiveDuration - visibleDuration)
  const maxScrollOffset = maxScrollableTime * pixelsPerSecond

  // 精简调试信息，只在需要时输出

  return maxScrollOffset
}

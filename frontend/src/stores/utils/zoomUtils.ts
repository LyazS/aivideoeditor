// ==================== 缩放计算工具 ====================

/**
 * 计算最大缩放级别（帧数版本）
 * @param timelineWidth 时间轴宽度（像素）
 * @param totalDurationFrames 总时长（帧数）
 * @returns 最大缩放级别
 */
export function getMaxZoomLevelFrames(
  timelineWidth: number,
  totalDurationFrames: number,
): number {
  // 最大缩放级别：一帧占用容器宽度的1/20（即5%）
  const targetFrameWidth = timelineWidth / 20 // 一帧占1/20横幅
  const calculatedMaxZoom = (targetFrameWidth * totalDurationFrames) / timelineWidth
  const maxZoom = Math.max(calculatedMaxZoom, 100) // 确保至少有100倍缩放

  if (window.DEBUG_TIMELINE_ZOOM) {
    console.group('🔬 [缩放计算] 计算最大缩放级别（帧数版本）')

    console.log('📐 最大缩放计算参数:', {
      timelineWidth,
      totalDurationFrames,
      targetFrameWidth: targetFrameWidth.toFixed(2),
    })

    console.log('📊 最大缩放计算结果:', {
      calculatedMaxZoom: calculatedMaxZoom.toFixed(3),
      finalMaxZoom: maxZoom.toFixed(3),
      limitedByMinimum: maxZoom === 100,
    })

    console.groupEnd()
  }

  return maxZoom
}



/**
 * 计算最小缩放级别（帧数版本）
 * @param totalDurationFrames 总时长（帧数）
 * @param maxVisibleDurationFrames 最大可见时长（帧数）
 * @returns 最小缩放级别
 */
export function getMinZoomLevelFrames(totalDurationFrames: number, maxVisibleDurationFrames: number): number {
  // 基于最大可见范围计算最小缩放级别
  const minZoom = totalDurationFrames / maxVisibleDurationFrames

  if (window.DEBUG_TIMELINE_ZOOM) {
    console.group('🔍 [缩放计算] 计算最小缩放级别（帧数版本）')

    console.log('📐 最小缩放计算参数:', {
      totalDurationFrames,
      maxVisibleDurationFrames,
    })

    console.log('📊 最小缩放计算结果:', {
      minZoom: minZoom.toFixed(3),
      ratio: (totalDurationFrames / maxVisibleDurationFrames).toFixed(3),
    })

    console.groupEnd()
  }

  return minZoom
}



/**
 * 计算最大滚动偏移量（帧数版本）
 * @param timelineWidth 时间轴宽度（像素）
 * @param zoomLevel 缩放级别
 * @param totalDurationFrames 总时长（帧数）
 * @param maxVisibleDurationFrames 最大可见时长（帧数）
 * @returns 最大滚动偏移量（像素）
 */
export function getMaxScrollOffsetFrames(
  timelineWidth: number,
  zoomLevel: number,
  totalDurationFrames: number,
  maxVisibleDurationFrames: number,
): number {
  // 使用最大可见范围作为滚动范围
  const effectiveDurationFrames = maxVisibleDurationFrames
  const pixelsPerFrame = (timelineWidth * zoomLevel) / totalDurationFrames
  const visibleDurationFrames = timelineWidth / pixelsPerFrame
  const maxScrollableFrames = Math.max(0, effectiveDurationFrames - visibleDurationFrames)
  const maxScrollOffset = maxScrollableFrames * pixelsPerFrame

  return maxScrollOffset
}



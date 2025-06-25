import { ref, computed, type Ref } from 'vue'
import {
  getMaxZoomLevelFrames,
  getMinZoomLevelFrames,
  getMaxScrollOffsetFrames,
} from '../utils/storeUtils'
import {
  calculateContentEndTimeFrames,
  calculateMaxVisibleDurationFrames,
} from '../utils/durationUtils'
import { framesToSeconds, secondsToFrames } from '../utils/timeUtils'
import type { TimelineItem } from '../../types'

/**
 * 缩放滚动管理模块
 * 负责管理时间轴的缩放和滚动状态
 */
export function createViewportModule(
  timelineItems: Ref<TimelineItem[]>,
  totalDuration: Ref<number>,
  timelineDuration: Ref<number>,
) {
  // ==================== 状态定义 ====================

  // 缩放和滚动状态
  const zoomLevel = ref(1) // 缩放级别，1为默认，大于1为放大，小于1为缩小
  const scrollOffset = ref(0) // 水平滚动偏移量（像素）

  // ==================== 计算属性 ====================

  // 帧数版本的内容结束时间
  const contentEndTimeFrames = computed(() => {
    return calculateContentEndTimeFrames(timelineItems.value)
  })

  // 计算实际内容的结束时间（向后兼容的秒数版本）
  const contentEndTime = computed(() => {
    return framesToSeconds(contentEndTimeFrames.value)
  })

  // 帧数版本的最大可见时长
  const maxVisibleDurationFrames = computed(() => {
    const timelineDurationFrames = secondsToFrames(timelineDuration.value)
    return calculateMaxVisibleDurationFrames(contentEndTimeFrames.value, timelineDurationFrames)
  })

  // 计算最大允许的可见时间范围（向后兼容的秒数版本）
  const maxVisibleDuration = computed(() => {
    return framesToSeconds(maxVisibleDurationFrames.value)
  })

  // 缩放相关计算属性（使用帧数版本）
  const minZoomLevel = computed(() => {
    const totalDurationFrames = secondsToFrames(totalDuration.value)
    return getMinZoomLevelFrames(totalDurationFrames, maxVisibleDurationFrames.value)
  })

  // 当前可见时间范围（受最大可见范围限制）
  const visibleDuration = computed(() => {
    const calculatedDuration = totalDuration.value / zoomLevel.value
    return Math.min(calculatedDuration, maxVisibleDuration.value)
  })

  // ==================== 缩放滚动方法 ====================

  /**
   * 计算最大缩放级别的函数（使用帧数版本）
   * @param timelineWidth 时间轴宽度（像素）
   * @returns 最大缩放级别
   */
  function getMaxZoomLevelForTimeline(timelineWidth: number): number {
    const totalDurationFrames = secondsToFrames(totalDuration.value)
    return getMaxZoomLevelFrames(timelineWidth, totalDurationFrames)
  }

  /**
   * 计算最大滚动偏移量的函数（使用帧数版本）
   * @param timelineWidth 时间轴宽度（像素）
   * @returns 最大滚动偏移量
   */
  function getMaxScrollOffsetForTimeline(timelineWidth: number): number {
    const totalDurationFrames = secondsToFrames(totalDuration.value)
    return getMaxScrollOffsetFrames(
      timelineWidth,
      zoomLevel.value,
      totalDurationFrames,
      maxVisibleDurationFrames.value,
    )
  }

  /**
   * 设置缩放级别
   * @param newZoomLevel 新的缩放级别
   * @param timelineWidth 时间轴宽度（像素）
   * @param frameRate 帧率
   */
  function setZoomLevel(newZoomLevel: number, timelineWidth: number = 800, frameRate: number = 30) {
    const maxZoom = getMaxZoomLevelForTimeline(timelineWidth)
    const minZoom = minZoomLevel.value
    const clampedZoom = Math.max(minZoom, Math.min(newZoomLevel, maxZoom))

    // 只在达到缩放限制时输出警告信息
    if (newZoomLevel < minZoom && contentEndTime.value > 0) {
      console.warn('⚠️ 已达到最小缩放级别限制')
    }
    if (newZoomLevel > maxZoom) {
      console.warn('⚠️ 已达到最大缩放级别限制')
    }

    if (zoomLevel.value !== clampedZoom) {
      zoomLevel.value = clampedZoom

      // 调整滚动偏移量以保持在有效范围内
      const maxOffset = getMaxScrollOffsetForTimeline(timelineWidth)
      const newScrollOffset = Math.max(0, Math.min(scrollOffset.value, maxOffset))

      if (scrollOffset.value !== newScrollOffset) {
        scrollOffset.value = newScrollOffset
      }
    }
  }

  /**
   * 设置滚动偏移量
   * @param newOffset 新的滚动偏移量（像素）
   * @param timelineWidth 时间轴宽度（像素）
   */
  function setScrollOffset(newOffset: number, timelineWidth: number = 800) {
    const maxOffset = getMaxScrollOffsetForTimeline(timelineWidth)
    const clampedOffset = Math.max(0, Math.min(newOffset, maxOffset))

    if (scrollOffset.value !== clampedOffset) {
      scrollOffset.value = clampedOffset
    }
  }

  /**
   * 放大时间轴
   * @param factor 放大倍数
   * @param timelineWidth 时间轴宽度（像素）
   * @param frameRate 帧率
   */
  function zoomIn(factor: number = 1.2, timelineWidth: number = 800, frameRate: number = 30) {
    setZoomLevel(zoomLevel.value * factor, timelineWidth, frameRate)
  }

  /**
   * 缩小时间轴
   * @param factor 缩小倍数
   * @param timelineWidth 时间轴宽度（像素）
   * @param frameRate 帧率
   */
  function zoomOut(factor: number = 1.2, timelineWidth: number = 800, frameRate: number = 30) {
    setZoomLevel(zoomLevel.value / factor, timelineWidth, frameRate)

    // 当缩小时间轴时，确保基础时间轴长度足够大以显示更多刻度线
    const pixelsPerSecond = (timelineWidth * zoomLevel.value) / totalDuration.value
    const visibleDurationCalc = timelineWidth / pixelsPerSecond

    // 如果可见时间范围超过当前时间轴长度，扩展时间轴
    if (visibleDurationCalc > timelineDuration.value) {
      // 这里需要调用外部的设置方法，因为timelineDuration是从配置模块来的
      // 在主store中会处理这个逻辑
    }
  }

  /**
   * 向左滚动
   * @param amount 滚动量（像素）
   * @param timelineWidth 时间轴宽度（像素）
   */
  function scrollLeft(amount: number = 50, timelineWidth: number = 800) {
    setScrollOffset(scrollOffset.value - amount, timelineWidth)
  }

  /**
   * 向右滚动
   * @param amount 滚动量（像素）
   * @param timelineWidth 时间轴宽度（像素）
   */
  function scrollRight(amount: number = 50, timelineWidth: number = 800) {
    setScrollOffset(scrollOffset.value + amount, timelineWidth)
  }

  /**
   * 滚动到指定时间位置
   * @param time 目标时间（秒）
   * @param timelineWidth 时间轴宽度（像素）
   */
  function scrollToTime(time: number, timelineWidth: number = 800) {
    const pixelsPerSecond = (timelineWidth * zoomLevel.value) / totalDuration.value
    const targetOffset = time * pixelsPerSecond - timelineWidth / 2 // 居中显示
    setScrollOffset(targetOffset, timelineWidth)
  }

  /**
   * 重置视口为默认状态
   */
  function resetViewport() {
    zoomLevel.value = 1
    scrollOffset.value = 0
  }

  /**
   * 获取视口状态摘要
   * @returns 视口状态摘要对象
   */
  function getViewportSummary() {
    return {
      zoomLevel: zoomLevel.value,
      scrollOffset: scrollOffset.value,
      minZoomLevel: minZoomLevel.value,
      visibleDuration: visibleDuration.value,
      maxVisibleDuration: maxVisibleDuration.value,
      contentEndTime: contentEndTime.value,
      totalDuration: totalDuration.value,
    }
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    zoomLevel,
    scrollOffset,

    // 计算属性
    minZoomLevel,
    visibleDuration,
    maxVisibleDuration,
    contentEndTime,

    // 方法
    getMaxZoomLevelForTimeline,
    getMaxScrollOffsetForTimeline,
    setZoomLevel,
    setScrollOffset,
    zoomIn,
    zoomOut,
    scrollLeft,
    scrollRight,
    scrollToTime,
    resetViewport,
    getViewportSummary,
  }
}

// 导出类型定义
export type ViewportModule = ReturnType<typeof createViewportModule>

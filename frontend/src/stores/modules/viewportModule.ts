import { ref, computed, type Ref } from 'vue'
import { 
  getMaxZoomLevel, 
  getMinZoomLevel, 
  getMaxScrollOffset,
  calculateMaxVisibleDuration,
  calculateContentEndTime
} from '../utils/storeUtils'
import type { TimelineItem } from '../../types/videoTypes'

/**
 * 缩放滚动管理模块
 * 负责管理时间轴的缩放和滚动状态
 */
export function createViewportModule(
  timelineItems: Ref<TimelineItem[]>,
  totalDuration: Ref<number>,
  timelineDuration: Ref<number>
) {
  // ==================== 状态定义 ====================
  
  // 缩放和滚动状态
  const zoomLevel = ref(1) // 缩放级别，1为默认，大于1为放大，小于1为缩小
  const scrollOffset = ref(0) // 水平滚动偏移量（像素）

  // ==================== 计算属性 ====================

  // 计算实际内容的结束时间（最后一个视频片段的结束时间）
  const contentEndTime = computed(() => {
    return calculateContentEndTime(timelineItems.value)
  })

  // 计算最大允许的可见时间范围（基于视频内容长度）
  const maxVisibleDuration = computed(() => {
    return calculateMaxVisibleDuration(contentEndTime.value, 300)
  })

  // 缩放相关计算属性
  const minZoomLevel = computed(() => {
    return getMinZoomLevel(totalDuration.value, maxVisibleDuration.value)
  })

  // 当前可见时间范围（受最大可见范围限制）
  const visibleDuration = computed(() => {
    const calculatedDuration = totalDuration.value / zoomLevel.value
    return Math.min(calculatedDuration, maxVisibleDuration.value)
  })

  // ==================== 缩放滚动方法 ====================

  /**
   * 计算最大缩放级别的函数（需要时间轴宽度参数）
   * @param timelineWidth 时间轴宽度（像素）
   * @param frameRate 帧率
   * @returns 最大缩放级别
   */
  function getMaxZoomLevelForTimeline(timelineWidth: number, frameRate: number): number {
    return getMaxZoomLevel(timelineWidth, frameRate, totalDuration.value)
  }

  /**
   * 计算最大滚动偏移量的函数（需要时间轴宽度参数）
   * @param timelineWidth 时间轴宽度（像素）
   * @returns 最大滚动偏移量
   */
  function getMaxScrollOffsetForTimeline(timelineWidth: number): number {
    return getMaxScrollOffset(timelineWidth, zoomLevel.value, totalDuration.value, maxVisibleDuration.value)
  }

  /**
   * 设置缩放级别
   * @param newZoomLevel 新的缩放级别
   * @param timelineWidth 时间轴宽度（像素）
   * @param frameRate 帧率
   */
  function setZoomLevel(newZoomLevel: number, timelineWidth: number = 800, frameRate: number = 30) {
    const maxZoom = getMaxZoomLevelForTimeline(timelineWidth, frameRate)
    const minZoom = minZoomLevel.value
    const clampedZoom = Math.max(minZoom, Math.min(newZoomLevel, maxZoom))

    // 如果达到最小缩放级别，提供调试信息
    if (newZoomLevel < minZoom && contentEndTime.value > 0) {
      console.log(`🔍 已达到最小缩放级别 (${minZoom.toFixed(3)})`)
      console.log(`📏 当前视频总长度: ${contentEndTime.value.toFixed(1)}秒`)
      console.log(`👁️ 最大可见范围限制: ${maxVisibleDuration.value.toFixed(1)}秒`)
      console.log(`🎯 当前可见范围: ${visibleDuration.value.toFixed(1)}秒`)
    }

    if (zoomLevel.value !== clampedZoom) {
      const oldZoom = zoomLevel.value
      zoomLevel.value = clampedZoom

      console.log('🔍 设置缩放级别:', {
        requestedZoom: newZoomLevel,
        oldZoom,
        newZoom: clampedZoom,
        minZoom,
        maxZoom,
        clamped: newZoomLevel !== clampedZoom
      })

      // 调整滚动偏移量以保持在有效范围内
      const maxOffset = getMaxScrollOffsetForTimeline(timelineWidth)
      scrollOffset.value = Math.max(0, Math.min(scrollOffset.value, maxOffset))
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
      const oldOffset = scrollOffset.value
      scrollOffset.value = clampedOffset

      console.log('📜 设置滚动偏移量:', {
        requestedOffset: newOffset,
        oldOffset,
        newOffset: clampedOffset,
        maxOffset,
        clamped: newOffset !== clampedOffset
      })
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
    console.log('🔍➕ 放大时间轴:', { factor, newZoom: zoomLevel.value })
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
      const newDuration = Math.max(visibleDurationCalc * 1.5, timelineDuration.value)
      console.log('📏 扩展时间轴长度:', {
        oldDuration: timelineDuration.value,
        newDuration,
        visibleDuration: visibleDurationCalc
      })
      // 这里需要调用外部的设置方法，因为timelineDuration是从配置模块来的
      // 在主store中会处理这个逻辑
    }

    console.log('🔍➖ 缩小时间轴:', { factor, newZoom: zoomLevel.value })
  }

  /**
   * 向左滚动
   * @param amount 滚动量（像素）
   * @param timelineWidth 时间轴宽度（像素）
   */
  function scrollLeft(amount: number = 50, timelineWidth: number = 800) {
    setScrollOffset(scrollOffset.value - amount, timelineWidth)
    console.log('⬅️ 向左滚动:', { amount, newOffset: scrollOffset.value })
  }

  /**
   * 向右滚动
   * @param amount 滚动量（像素）
   * @param timelineWidth 时间轴宽度（像素）
   */
  function scrollRight(amount: number = 50, timelineWidth: number = 800) {
    setScrollOffset(scrollOffset.value + amount, timelineWidth)
    console.log('➡️ 向右滚动:', { amount, newOffset: scrollOffset.value })
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
    console.log('🎯 滚动到时间:', { time, targetOffset, newOffset: scrollOffset.value })
  }

  /**
   * 重置视口为默认状态
   */
  function resetViewport() {
    zoomLevel.value = 1
    scrollOffset.value = 0
    console.log('🔄 视口已重置为默认状态')
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
      totalDuration: totalDuration.value
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

import { ref, computed, type Ref } from 'vue'
import {
  getMaxZoomLevelFrames,
  getMinZoomLevelFrames,
  getMaxScrollOffsetFrames,
} from '../utils/zoomUtils'
import {
  calculateContentEndTimeFrames,
  calculateMaxVisibleDurationFrames,
} from '../utils/UnifiedDurationUtils'
import type { UnifiedTimelineItem } from '../../unified/timelineitem'

/**
 * 统一视口管理模块
 * 基于统一类型系统的视口状态管理
 * 
 * 核心设计理念：
 * - 统一类型架构：使用UnifiedTimelineItem替代LocalTimelineItem
 * - 状态驱动管理：通过状态变化驱动视口生命周期
 * - 响应式数据：完全基于Vue3响应式系统
 * - 分离关注点：视口配置、缩放管理、滚动管理分离
 */

// ==================== 类型定义 ====================

/**
 * 视口操作结果接口
 */
export interface ViewportOperationResult {
  success: boolean
  message?: string
  data?: any
}

/**
 * 视口状态摘要接口
 */
export interface ViewportStateSummary {
  zoomLevel: number
  scrollOffset: number
  minZoomLevel: number
  visibleDurationFrames: number
  maxVisibleDurationFrames: number
  contentEndTimeFrames: number
  totalDurationFrames: number
}

/**
 * 视口配置接口
 */
export interface ViewportConfig {
  defaultZoomLevel: number
  defaultScrollOffset: number
  zoomStep: number
  scrollStep: number
  timelineWidth: number
  frameRate: number
}

// ==================== 默认配置 ====================

const DEFAULT_VIEWPORT_CONFIG: ViewportConfig = {
  defaultZoomLevel: 1,
  defaultScrollOffset: 0,
  zoomStep: 1.2,
  scrollStep: 50,
  timelineWidth: 800,
  frameRate: 30,
}

// ==================== 统一视口模块 ====================

/**
 * 创建统一视口管理模块
 * 负责管理时间轴的缩放和滚动状态
 */
export function createUnifiedViewportModule(
  timelineItems: Ref<UnifiedTimelineItem[]>,
  totalDurationFrames: Ref<number>,
  timelineDurationFrames: Ref<number>,
  config: Partial<ViewportConfig> = {}
) {
  // ==================== 状态定义 ====================

  // 合并配置
  const viewportConfig = { ...DEFAULT_VIEWPORT_CONFIG, ...config }

  // 缩放和滚动状态
  const zoomLevel = ref(viewportConfig.defaultZoomLevel)
  const scrollOffset = ref(viewportConfig.defaultScrollOffset)

  // 视口状态
  const isViewportReady = ref(false)
  const lastViewportUpdate = ref<Date | null>(null)

  // ==================== 计算属性 ====================

  // 帧数版本的内容结束时间
  const contentEndTimeFrames = computed(() => {
    return calculateContentEndTimeFrames(timelineItems.value)
  })

  // 帧数版本的最大可见时长
  const maxVisibleDurationFrames = computed(() => {
    return calculateMaxVisibleDurationFrames(
      contentEndTimeFrames.value,
      timelineDurationFrames.value,
    )
  })

  // 缩放相关计算属性（使用帧数版本）
  const minZoomLevel = computed(() => {
    return getMinZoomLevelFrames(totalDurationFrames.value, maxVisibleDurationFrames.value)
  })

  // 当前可见时间范围（帧数版本）
  const visibleDurationFrames = computed(() => {
    const calculatedDurationFrames = totalDurationFrames.value / zoomLevel.value
    return Math.min(calculatedDurationFrames, maxVisibleDurationFrames.value)
  })

  // 视口状态摘要
  const viewportSummary = computed<ViewportStateSummary>(() => ({
    zoomLevel: zoomLevel.value,
    scrollOffset: scrollOffset.value,
    minZoomLevel: minZoomLevel.value,
    visibleDurationFrames: visibleDurationFrames.value,
    maxVisibleDurationFrames: maxVisibleDurationFrames.value,
    contentEndTimeFrames: contentEndTimeFrames.value,
    totalDurationFrames: totalDurationFrames.value,
  }))

  // ==================== 工具函数 ====================

  /**
   * 更新视口时间戳
   */
  function updateViewportTimestamp(): void {
    lastViewportUpdate.value = new Date()
    console.log('📝 [UnifiedViewport] 更新视口时间戳:', lastViewportUpdate.value.toISOString())
  }

  /**
   * 验证缩放级别
   */
  function validateZoomLevel(newZoomLevel: number, timelineWidth: number): ViewportOperationResult {
    const maxZoom = getMaxZoomLevelForTimeline(timelineWidth)
    const minZoom = minZoomLevel.value

    if (newZoomLevel < minZoom && contentEndTimeFrames.value > 0) {
      return {
        success: false,
        message: '已达到最小缩放级别限制',
        data: { minZoom, requestedZoom: newZoomLevel }
      }
    }

    if (newZoomLevel > maxZoom) {
      return {
        success: false,
        message: '已达到最大缩放级别限制',
        data: { maxZoom, requestedZoom: newZoomLevel }
      }
    }

    return { success: true }
  }

  /**
   * 验证滚动偏移量
   */
  function validateScrollOffset(newOffset: number, timelineWidth: number): ViewportOperationResult {
    const maxOffset = getMaxScrollOffsetForTimeline(timelineWidth)

    if (newOffset < 0) {
      return {
        success: false,
        message: '滚动偏移量不能小于0',
        data: { minOffset: 0, requestedOffset: newOffset }
      }
    }

    if (newOffset > maxOffset) {
      return {
        success: false,
        message: '已达到最大滚动偏移量限制',
        data: { maxOffset, requestedOffset: newOffset }
      }
    }

    return { success: true }
  }

  // ==================== 缩放滚动方法 ====================

  /**
   * 计算最大缩放级别的函数（使用帧数版本）
   * @param timelineWidth 时间轴宽度（像素）
   * @returns 最大缩放级别
   */
  function getMaxZoomLevelForTimeline(timelineWidth: number): number {
    return getMaxZoomLevelFrames(timelineWidth, totalDurationFrames.value)
  }

  /**
   * 计算最大滚动偏移量的函数（使用帧数版本）
   * @param timelineWidth 时间轴宽度（像素）
   * @returns 最大滚动偏移量
   */
  function getMaxScrollOffsetForTimeline(timelineWidth: number): number {
    return getMaxScrollOffsetFrames(
      timelineWidth,
      zoomLevel.value,
      totalDurationFrames.value,
      maxVisibleDurationFrames.value,
    )
  }

  /**
   * 设置缩放级别
   * @param newZoomLevel 新的缩放级别
   * @param timelineWidth 时间轴宽度（像素）
   * @returns 操作结果
   */
  function setZoomLevel(
    newZoomLevel: number, 
    timelineWidth: number = viewportConfig.timelineWidth
  ): ViewportOperationResult {
    const validation = validateZoomLevel(newZoomLevel, timelineWidth)
    
    if (!validation.success) {
      console.warn(`⚠️ [UnifiedViewport] ${validation.message}`)
      return validation
    }

    const maxZoom = getMaxZoomLevelForTimeline(timelineWidth)
    const minZoom = minZoomLevel.value
    const clampedZoom = Math.max(minZoom, Math.min(newZoomLevel, maxZoom))

    if (zoomLevel.value !== clampedZoom) {
      zoomLevel.value = clampedZoom
      updateViewportTimestamp()

      // 调整滚动偏移量以保持在有效范围内
      const maxOffset = getMaxScrollOffsetForTimeline(timelineWidth)
      const newScrollOffset = Math.max(0, Math.min(scrollOffset.value, maxOffset))

      if (scrollOffset.value !== newScrollOffset) {
        scrollOffset.value = newScrollOffset
      }

      console.log('🔍 [UnifiedViewport] 缩放级别已更新:', {
        from: zoomLevel.value,
        to: clampedZoom,
        scrollOffset: scrollOffset.value
      })
    }

    return { success: true, data: { zoomLevel: clampedZoom } }
  }

  /**
   * 设置滚动偏移量
   * @param newOffset 新的滚动偏移量（像素）
   * @param timelineWidth 时间轴宽度（像素）
   * @returns 操作结果
   */
  function setScrollOffset(
    newOffset: number, 
    timelineWidth: number = viewportConfig.timelineWidth
  ): ViewportOperationResult {
    const validation = validateScrollOffset(newOffset, timelineWidth)
    
    if (!validation.success) {
      console.warn(`⚠️ [UnifiedViewport] ${validation.message}`)
      return validation
    }

    const maxOffset = getMaxScrollOffsetForTimeline(timelineWidth)
    const clampedOffset = Math.max(0, Math.min(newOffset, maxOffset))

    if (scrollOffset.value !== clampedOffset) {
      scrollOffset.value = clampedOffset
      updateViewportTimestamp()

      console.log('📜 [UnifiedViewport] 滚动偏移量已更新:', {
        from: scrollOffset.value,
        to: clampedOffset
      })
    }

    return { success: true, data: { scrollOffset: clampedOffset } }
  }

  /**
   * 放大时间轴
   * @param factor 放大倍数
   * @param timelineWidth 时间轴宽度（像素）
   * @returns 操作结果
   */
  function zoomIn(
    factor: number = viewportConfig.zoomStep,
    timelineWidth: number = viewportConfig.timelineWidth
  ): ViewportOperationResult {
    const result = setZoomLevel(zoomLevel.value * factor, timelineWidth)
    if (result.success) {
      console.log('🔍+ [UnifiedViewport] 放大时间轴:', { factor, newZoomLevel: zoomLevel.value })
    }
    return result
  }

  /**
   * 缩小时间轴
   * @param factor 缩小倍数
   * @param timelineWidth 时间轴宽度（像素）
   * @returns 操作结果
   */
  function zoomOut(
    factor: number = viewportConfig.zoomStep,
    timelineWidth: number = viewportConfig.timelineWidth
  ): ViewportOperationResult {
    const result = setZoomLevel(zoomLevel.value / factor, timelineWidth)

    if (result.success) {
      // 当缩小时间轴时，确保基础时间轴长度足够大以显示更多刻度线
      const pixelsPerFrame = (timelineWidth * zoomLevel.value) / totalDurationFrames.value
      const visibleDurationFrames = timelineWidth / pixelsPerFrame

      // 如果可见时间范围超过当前时间轴长度，扩展时间轴
      if (visibleDurationFrames > timelineDurationFrames.value) {
        console.log('📏 [UnifiedViewport] 需要扩展时间轴长度:', {
          currentDuration: timelineDurationFrames.value,
          requiredDuration: visibleDurationFrames
        })
        // 这里需要调用外部的设置方法，因为timelineDurationFrames是从配置模块来的
        // 在主store中会处理这个逻辑
      }

      console.log('🔍- [UnifiedViewport] 缩小时间轴:', { factor, newZoomLevel: zoomLevel.value })
    }

    return result
  }

  /**
   * 向左滚动
   * @param amount 滚动量（像素）
   * @param timelineWidth 时间轴宽度（像素）
   * @returns 操作结果
   */
  function scrollLeft(
    amount: number = viewportConfig.scrollStep,
    timelineWidth: number = viewportConfig.timelineWidth
  ): ViewportOperationResult {
    const result = setScrollOffset(scrollOffset.value - amount, timelineWidth)
    if (result.success) {
      console.log('📜← [UnifiedViewport] 向左滚动:', { amount, newOffset: scrollOffset.value })
    }
    return result
  }

  /**
   * 向右滚动
   * @param amount 滚动量（像素）
   * @param timelineWidth 时间轴宽度（像素）
   * @returns 操作结果
   */
  function scrollRight(
    amount: number = viewportConfig.scrollStep,
    timelineWidth: number = viewportConfig.timelineWidth
  ): ViewportOperationResult {
    const result = setScrollOffset(scrollOffset.value + amount, timelineWidth)
    if (result.success) {
      console.log('📜→ [UnifiedViewport] 向右滚动:', { amount, newOffset: scrollOffset.value })
    }
    return result
  }

  /**
   * 滚动到指定帧数位置
   * @param frames 目标帧数
   * @param timelineWidth 时间轴宽度（像素）
   * @returns 操作结果
   */
  function scrollToFrame(
    frames: number,
    timelineWidth: number = viewportConfig.timelineWidth
  ): ViewportOperationResult {
    const pixelsPerFrame = (timelineWidth * zoomLevel.value) / totalDurationFrames.value
    const targetOffset = frames * pixelsPerFrame - timelineWidth / 2 // 居中显示
    const result = setScrollOffset(targetOffset, timelineWidth)

    if (result.success) {
      console.log('📜🎯 [UnifiedViewport] 滚动到帧数位置:', {
        targetFrames: frames,
        targetOffset,
        actualOffset: scrollOffset.value
      })
    }

    return result
  }

  /**
   * 重置视口为默认状态
   * @returns 操作结果
   */
  function resetViewport(): ViewportOperationResult {
    zoomLevel.value = viewportConfig.defaultZoomLevel
    scrollOffset.value = viewportConfig.defaultScrollOffset
    updateViewportTimestamp()

    console.log('🔄 [UnifiedViewport] 重置视口到默认状态:', {
      zoomLevel: zoomLevel.value,
      scrollOffset: scrollOffset.value
    })

    return {
      success: true,
      message: '视口已重置到默认状态',
      data: {
        zoomLevel: zoomLevel.value,
        scrollOffset: scrollOffset.value
      }
    }
  }

  /**
   * 初始化视口状态
   * @returns 操作结果
   */
  function initializeViewport(): ViewportOperationResult {
    try {
      isViewportReady.value = true
      updateViewportTimestamp()

      console.log('🚀 [UnifiedViewport] 视口模块初始化完成:', viewportSummary.value)

      return {
        success: true,
        message: '视口模块初始化成功',
        data: viewportSummary.value
      }
    } catch (error) {
      console.error('❌ [UnifiedViewport] 视口模块初始化失败:', error)
      return {
        success: false,
        message: `视口模块初始化失败: ${error}`
      }
    }
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    zoomLevel,
    scrollOffset,
    isViewportReady,
    lastViewportUpdate,

    // 计算属性（帧数版本）
    minZoomLevel,
    visibleDurationFrames,
    maxVisibleDurationFrames,
    contentEndTimeFrames,
    viewportSummary,

    // 配置
    viewportConfig,

    // 核心方法
    getMaxZoomLevelForTimeline,
    getMaxScrollOffsetForTimeline,
    setZoomLevel,
    setScrollOffset,

    // 缩放方法
    zoomIn,
    zoomOut,

    // 滚动方法
    scrollLeft,
    scrollRight,
    scrollToFrame,

    // 系统方法
    resetViewport,
    initializeViewport,
    updateViewportTimestamp,

    // 验证方法
    validateZoomLevel,
    validateScrollOffset,
  }
}

// 导出类型定义
export type UnifiedViewportModule = ReturnType<typeof createUnifiedViewportModule>

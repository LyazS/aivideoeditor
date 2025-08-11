import { computed, ref } from 'vue'
import type {
  SnapResult,
  SnapCalculationOptions,
  SnapPointCollectionOptions,
} from '../../types/snap'
import { UnifiedSnapCalculator } from '../utils/snapCalculator'
import { useSnapConfig } from './useSnapConfig'

/**
 * 吸附管理器 Composable
 * 统一管理所有吸附逻辑，提供高级吸附计算接口
 */
export function useSnapManager() {
  const snapConfig = useSnapConfig()
  const calculator = new UnifiedSnapCalculator()

  // 缓存相关
  const snapPointsCache = ref<Map<string, any>>(new Map())
  const lastCacheKey = ref<string>('')

  /**
   * 生成缓存键
   */
  function generateCacheKey(options: SnapPointCollectionOptions): string {
    return JSON.stringify({
      includeClipBoundaries: options.includeClipBoundaries,
      includeKeyframes: options.includeKeyframes,
      includePlayhead: options.includePlayhead,
      includeTimelineStart: options.includeTimelineStart,
      excludeClipIds: options.excludeClipIds?.sort(),
      frameRange: options.frameRange,
    })
  }

  /**
   * 清除吸附点缓存
   */
  function clearSnapPointsCache() {
    snapPointsCache.value.clear()
    lastCacheKey.value = ''
  }

  /**
   * 计算吸附结果（主要接口）
   */
  function calculateSnap(
    targetFrame: number,
    timelineWidth: number,
    options: SnapCalculationOptions = {},
  ): SnapResult {
    // 检查是否启用吸附
    if (!snapConfig.isActuallyEnabled.value || options.temporaryDisabled) {
      return {
        snapped: false,
        frame: targetFrame,
      }
    }

    // 构建吸附点收集选项
    const collectionOptions: SnapPointCollectionOptions = {
      includeClipBoundaries: snapConfig.isClipBoundariesEnabled.value,
      includeKeyframes: snapConfig.isKeyframesEnabled.value,
      includePlayhead: snapConfig.isPlayheadEnabled.value,
      includeTimelineStart: snapConfig.isTimelineStartEnabled.value,
      excludeClipIds: options.excludeClipIds,
    }

    // 收集吸附点（使用缓存）
    const cacheKey = generateCacheKey(collectionOptions)
    let snapPoints

    if (lastCacheKey.value === cacheKey && snapPointsCache.value.has(cacheKey)) {
      snapPoints = snapPointsCache.value.get(cacheKey)
    } else {
      snapPoints = calculator.collectSnapPoints(collectionOptions)
      snapPointsCache.value.set(cacheKey, snapPoints)
      lastCacheKey.value = cacheKey
    }

    // 计算阈值（帧数）
    const pixelThreshold = options.customThreshold ?? snapConfig.config.value.threshold
    const thresholdFrames = calculator.pixelThresholdToFrames(pixelThreshold, timelineWidth)

    // 执行吸附计算
    return calculator.calculateSnap(targetFrame, snapPoints, thresholdFrames)
  }

  /**
   * 专门用于播放头吸附的方法
   */
  function calculatePlayheadSnap(
    targetFrame: number,
    timelineWidth: number,
    options: Omit<SnapCalculationOptions, 'excludeClipIds'> = {},
  ): SnapResult {
    return calculateSnap(targetFrame, timelineWidth, {
      ...options,
      excludeClipIds: [], // 播放头不需要排除任何片段
    })
  }

  /**
   * 专门用于片段拖拽吸附的方法
   */
  function calculateClipDragSnap(
    targetFrame: number,
    timelineWidth: number,
    draggedClipIds: string[],
    options: Omit<SnapCalculationOptions, 'excludeClipIds'> = {},
  ): SnapResult {
    return calculateSnap(targetFrame, timelineWidth, {
      ...options,
      excludeClipIds: draggedClipIds, // 排除正在拖拽的片段
    })
  }

  /**
   * 专门用于片段调整大小吸附的方法
   */
  function calculateClipResizeSnap(
    targetFrame: number,
    timelineWidth: number,
    resizingClipId: string,
    options: Omit<SnapCalculationOptions, 'excludeClipIds'> = {},
  ): SnapResult {
    return calculateSnap(targetFrame, timelineWidth, {
      ...options,
      excludeClipIds: [resizingClipId], // 排除正在调整大小的片段
    })
  }

  /**
   * 批量计算多个位置的吸附结果
   */
  function calculateMultipleSnaps(
    targetFrames: number[],
    timelineWidth: number,
    options: SnapCalculationOptions = {},
  ): SnapResult[] {
    return targetFrames.map((frame) => calculateSnap(frame, timelineWidth, options))
  }

  /**
   * 检查指定帧数是否接近任何吸附点
   */
  function isNearSnapPoint(
    frame: number,
    timelineWidth: number,
    options: SnapCalculationOptions = {},
  ): boolean {
    const result = calculateSnap(frame, timelineWidth, options)
    return result.snapped
  }

  /**
   * 获取指定范围内的所有吸附点
   */
  function getSnapPointsInRange(
    startFrame: number,
    endFrame: number,
    options: Omit<SnapCalculationOptions, 'targetFrame'> = {},
  ) {
    const collectionOptions: SnapPointCollectionOptions = {
      includeClipBoundaries: snapConfig.isClipBoundariesEnabled.value,
      includeKeyframes: snapConfig.isKeyframesEnabled.value,
      includePlayhead: snapConfig.isPlayheadEnabled.value,
      includeTimelineStart: snapConfig.isTimelineStartEnabled.value,
      excludeClipIds: options.excludeClipIds,
      frameRange: {
        start: startFrame,
        end: endFrame,
      },
    }

    return calculator.collectSnapPoints(collectionOptions)
  }

  return {
    // 配置管理
    snapConfig,

    // 主要计算接口
    calculateSnap,
    calculatePlayheadSnap,
    calculateClipDragSnap,
    calculateClipResizeSnap,
    calculateMultipleSnaps,

    // 辅助方法
    isNearSnapPoint,
    getSnapPointsInRange,

    // 缓存管理
    clearSnapPointsCache,

    // 状态
    isSnapEnabled: snapConfig.isActuallyEnabled,
  }
}

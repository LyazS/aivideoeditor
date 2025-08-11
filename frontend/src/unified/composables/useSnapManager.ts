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
  const MAX_CACHE_SIZE = 50 // 限制缓存大小，防止内存泄漏

  /**
   * 生成缓存键
   */
  function generateCacheKey(options: SnapPointCollectionOptions, currentFrame?: number): string {
    const baseKey = {
      includeClipBoundaries: options.includeClipBoundaries,
      includeKeyframes: options.includeKeyframes,
      includePlayhead: options.includePlayhead,
      includeTimelineStart: options.includeTimelineStart,
      excludeClipIds: options.excludeClipIds?.sort(),
      frameRange: options.frameRange,
    }

    // 如果包含播放头，需要将当前帧加入缓存键以确保正确性
    if (options.includePlayhead && currentFrame !== undefined) {
      return JSON.stringify({
        ...baseKey,
        // 以10帧为单位缓存播放头位置，减少缓存颠簸同时保持精度
        playheadFrame: Math.floor(currentFrame / 10) * 10,
      })
    }

    return JSON.stringify(baseKey)
  }

  /**
   * 清除吸附点缓存
   */
  function clearSnapPointsCache() {
    snapPointsCache.value.clear()
    lastCacheKey.value = ''
  }

  /**
   * 管理缓存大小，防止内存泄漏
   */
  function manageCacheSize(newKey: string, newValue: any) {
    const cache = snapPointsCache.value
    
    // 如果缓存超过限制，清理最旧的条目
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value
      if (firstKey) {
        cache.delete(firstKey)
      }
    }
    
    // 添加新缓存条目
    cache.set(newKey, newValue)
    lastCacheKey.value = newKey
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
    const cacheKey = generateCacheKey(collectionOptions, 
      collectionOptions.includePlayhead ? targetFrame : undefined)
    let snapPoints

    if (lastCacheKey.value === cacheKey && snapPointsCache.value.has(cacheKey)) {
      snapPoints = snapPointsCache.value.get(cacheKey)
    } else {
      snapPoints = calculator.collectSnapPoints(collectionOptions)
      manageCacheSize(cacheKey, snapPoints)
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
    // 播放头拖动时需要特殊处理，避免自吸附问题
    const playheadOptions = {
      ...options,
      excludeClipIds: [], // 播放头不需要排除任何片段
    }

    // 检查是否启用吸附
    if (!snapConfig.isActuallyEnabled.value || playheadOptions.temporaryDisabled) {
      return {
        snapped: false,
        frame: targetFrame,
      }
    }

    // 构建吸附点收集选项 - 播放头拖动时不收集播放头位置
    const collectionOptions: SnapPointCollectionOptions = {
      includeClipBoundaries: snapConfig.isClipBoundariesEnabled.value,
      includeKeyframes: snapConfig.isKeyframesEnabled.value,
      includeTimelineStart: snapConfig.isTimelineStartEnabled.value,
      excludeClipIds: playheadOptions.excludeClipIds,
    }

    // 收集吸附点（使用通用缓存逻辑）
    const cacheKey = generateCacheKey(collectionOptions)
    let snapPoints

    if (lastCacheKey.value === cacheKey && snapPointsCache.value.has(cacheKey)) {
      snapPoints = snapPointsCache.value.get(cacheKey)
      console.log('🎯 [播放头吸附缓存] 使用缓存的吸附点:', {
        缓存键: cacheKey.slice(0, 50) + '...',
        吸附点数量: snapPoints.length,
        吸附点详情: snapPoints.map((p: any) => `${p.type}@${p.frame}`),
        目标帧数: targetFrame,
        缓存大小: snapPointsCache.value.size
      })
    } else {
      snapPoints = calculator.collectSnapPoints(collectionOptions)
      manageCacheSize(cacheKey, snapPoints)
      console.log('🔄 [播放头吸附缓存] 重新收集吸附点:', {
        缓存键: cacheKey.slice(0, 50) + '...',
        吸附点数量: snapPoints.length,
        吸附点详情: snapPoints.map((p: any) => `${p.type}@${p.frame}`),
        目标帧数: targetFrame,
        收集选项: collectionOptions,
        缓存大小: snapPointsCache.value.size
      })
    }

    // 计算阈值（帧数）
    const pixelThreshold = playheadOptions.customThreshold ?? snapConfig.config.value.threshold
    const thresholdFrames = calculator.pixelThresholdToFrames(pixelThreshold, timelineWidth)

    // 执行吸附计算
    const result = calculator.calculateSnap(targetFrame, snapPoints, thresholdFrames)
    
    // 调试信息：播放头吸附结果
    if (result.snapped && result.snapPoint) {
      console.log('🧲 [播放头吸附] 吸附成功:', {
        原始帧数: targetFrame,
        吸附到: result.frame,
        吸附类型: result.snapPoint.type,
        吸附距离: result.distance,
        可用吸附点总数: snapPoints.length
      })
    } else {
      console.log('❌ [播放头吸附] 未发生吸附:', {
        原始帧数: targetFrame,
        阈值帧数: thresholdFrames,
        可用吸附点总数: snapPoints.length
      })
    }

    return result
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

  /**
   * 调试方法：打印当前缓存状态
   */
  function debugPrintCacheState() {
    console.log('📊 [吸附点缓存状态]', {
      缓存大小: snapPointsCache.value.size,
      最大缓存大小: MAX_CACHE_SIZE,
      最后缓存键: lastCacheKey.value.slice(0, 50) + '...',
      所有缓存键: Array.from(snapPointsCache.value.keys()).map(key => key.slice(0, 30) + '...'),
      缓存详情: Array.from(snapPointsCache.value.entries()).map(([key, points]) => ({
        键: key.slice(0, 30) + '...',
        吸附点数量: points.length,
        吸附点: points.map((p: any) => `${p.type}@${p.frame}`)
      }))
    })
  }

  // 在开发环境下暴露调试方法到全局
  if (import.meta.env.DEV) {
    // @ts-ignore
    window.debugSnapCache = debugPrintCacheState
    console.log('🔧 调试工具已挂载到全局: window.debugSnapCache()')
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
    debugPrintCacheState,

    // 状态
    isSnapEnabled: snapConfig.isActuallyEnabled,
  }
}

import type { 
  SnapPoint, 
  SnapResult, 
  SnapCalculationOptions, 
  SnapPointCollectionOptions,
  SnapConfig 
} from '@/types/snap'

/**
 * 吸附计算引擎类
 * 提供时间轴吸附计算的核心功能
 */
export class SnapCalculationEngine {
  private config: SnapConfig
  private snapPointsCache: Map<string, SnapPoint[]> = new Map()
  private cacheTimestamp: number = 0

  constructor(config: SnapConfig) {
    this.config = config
  }

  /**
   * 设置新的配置
   */
  setConfig(config: SnapConfig): void {
    this.config = config
    // 配置改变时清除缓存
    this.clearCache()
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.snapPointsCache.clear()
    this.cacheTimestamp = 0
  }

  /**
   * 计算吸附结果
   */
  calculateSnap(
    sourceFrame: number,
    options: SnapCalculationOptions = {},
    frameToPixel: (frames: number) => number
  ): SnapResult {
    // 检查是否启用了吸附功能
    if (!this.config.enabled || options.temporaryDisabled) {
      return {
        snapped: false,
        frame: sourceFrame
      }
    }

    // 收集候选吸附点
    const snapPoints = this.collectSnapPoints({
      includeClipBoundaries: this.config.clipBoundaries,
      includeKeyframes: this.config.keyframes,
      includeTimelineStart: this.config.timelineStart,
      excludeClipIds: options.excludeClipIds
    })

    if (snapPoints.length === 0) {
      return {
        snapped: false,
        frame: sourceFrame
      }
    }

    // 计算距离并找到最近的吸附点
    const threshold = options.customThreshold || this.config.threshold
    let closestPoint: SnapPoint | null = null
    let minDistance = Infinity

    for (const point of snapPoints) {
      const pixelDistance = Math.abs(
        frameToPixel(sourceFrame) - frameToPixel(point.frame)
      )
      
      if (pixelDistance < minDistance && pixelDistance <= threshold) {
        minDistance = pixelDistance
        closestPoint = point
      }
    }

    // 如果没有找到合适的吸附点，返回原始位置
    if (!closestPoint) {
      return {
        snapped: false,
        frame: sourceFrame
      }
    }

    return {
      snapped: true,
      frame: closestPoint.frame,
      snapPoint: closestPoint,
      distance: Math.abs(sourceFrame - closestPoint.frame)
    }
  }

  /**
   * 使用预计算的吸附点进行吸附计算
   */
  calculateSnapWithPoints(
    sourceFrame: number,
    snapPoints: SnapPoint[],
    options: SnapCalculationOptions = {},
    frameToPixel: (frames: number) => number
  ): SnapResult {
    console.log('🧲 [SnapEngine] calculateSnapWithPoints 开始计算:', {
      sourceFrame,
      snapPointsCount: snapPoints.length,
      options,
      config: this.config
    })

    // 检查是否启用了吸附功能
    if (!this.config.enabled || options.temporaryDisabled) {
      console.log('🧲 [SnapEngine] 吸附功能被禁用')
      return {
        snapped: false,
        frame: sourceFrame
      }
    }

    if (!snapPoints.length) {
      console.log('🧲 [SnapEngine] 没有可用的吸附点')
      return {
        snapped: false,
        frame: sourceFrame
      }
    }

    // 过滤排除的片段
    const filteredPoints = options.excludeClipIds && options.excludeClipIds.length > 0
      ? snapPoints.filter(point => {
          if ('clipId' in point && point.clipId) {
            return !options.excludeClipIds!.includes(point.clipId)
          }
          return true
        })
      : snapPoints

    console.log('🧲 [SnapEngine] 过滤后的吸附点数量:', filteredPoints.length)

    // 计算距离并找到最近的吸附点
    const threshold = options.customThreshold || this.config.threshold
    console.log('🧲 [SnapEngine] 吸附阈值:', threshold)
    
    let closestPoint: SnapPoint | null = null
    let minDistance = Infinity

    for (const point of filteredPoints) {
      const sourcePixel = frameToPixel(sourceFrame)
      const pointPixel = frameToPixel(point.frame)
      const pixelDistance = Math.abs(sourcePixel - pointPixel)
      
      console.log(`🧲 [SnapEngine] 检查吸附点 ${point.type}-${point.frame}: 像素距离=${pixelDistance}, 阈值=${threshold}`)
      
      if (pixelDistance < minDistance && pixelDistance <= threshold) {
        minDistance = pixelDistance
        closestPoint = point
        console.log(`🧲 [SnapEngine] 找到更近的吸附点: ${point.type}-${point.frame}, 距离=${pixelDistance}`)
      }
    }

    if (!closestPoint) {
      console.log('🧲 [SnapEngine] 没有找到满足阈值的吸附点')
      return {
        snapped: false,
        frame: sourceFrame
      }
    }

    console.log('🧲 [SnapEngine] 吸附成功!', {
      from: sourceFrame,
      to: closestPoint.frame,
      point: closestPoint,
      distance: Math.abs(sourceFrame - closestPoint.frame)
    })

    return {
      snapped: true,
      frame: closestPoint.frame,
      snapPoint: closestPoint,
      distance: Math.abs(sourceFrame - closestPoint.frame)
    }
  }

  /**
   * 收集吸附点
   */
  collectSnapPoints(options: SnapPointCollectionOptions = {}): SnapPoint[] {
    const snapPoints: SnapPoint[] = []

    // 创建缓存键
    const cacheKey = this.generateCacheKey(options)
    
    // 检查缓存
    if (this.snapPointsCache.has(cacheKey)) {
      return this.snapPointsCache.get(cacheKey) || []
    }

    // 收集时间轴起始点
    if (options.includeTimelineStart) {
      snapPoints.push({
        type: 'timeline-start',
        frame: 0,
        priority: 3
      })
    }

    // 这里应该从实际的轨道和片段中收集吸附点
    // 由于需要访问 store，这部分逻辑将放在 composable 中实现

    // 缓存结果
    this.snapPointsCache.set(cacheKey, snapPoints)
    this.cacheTimestamp = Date.now()

    return snapPoints
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(options: SnapPointCollectionOptions): string {
    const parts = [
      options.includeClipBoundaries ? '1' : '0',
      options.includeKeyframes ? '1' : '0',
      options.includeTimelineStart ? '1' : '0',
      options.excludeClipIds?.join(',') || '',
      options.frameRange ? `${options.frameRange.start}-${options.frameRange.end}` : ''
    ]
    return parts.join('|')
  }

  /**
   * 获取缓存过期时间
   */
  isCacheExpired(maxAge: number = 5000): boolean {
    return Date.now() - this.cacheTimestamp > maxAge
  }
}

/**
 * 创建吸附计算引擎实例
 */
export function createSnapCalculationEngine(config: SnapConfig): SnapCalculationEngine {
  return new SnapCalculationEngine(config)
}

/**
 * 默认吸附计算函数
 * 用于简单的吸附计算场景
 */
export function calculateSnap(
  sourceFrame: number,
  snapPoints: SnapPoint[],
  frameToPixel: (frames: number) => number,
  threshold: number = 10,
  excludeClipIds?: string[]
): SnapResult {
  if (!snapPoints.length) {
    return {
      snapped: false,
      frame: sourceFrame
    }
  }

  // 过滤排除的片段
  const filteredPoints = excludeClipIds && excludeClipIds.length > 0
    ? snapPoints.filter(point => {
        if ('clipId' in point && point.clipId) {
          return !excludeClipIds.includes(point.clipId)
        }
        return true
      })
    : snapPoints

  let closestPoint: SnapPoint | null = null
  let minDistance = Infinity

  for (const point of filteredPoints) {
    const pixelDistance = Math.abs(
      frameToPixel(sourceFrame) - frameToPixel(point.frame)
    )
    
    if (pixelDistance < minDistance && pixelDistance <= threshold) {
      minDistance = pixelDistance
      closestPoint = point
    }
  }

  if (!closestPoint) {
    return {
      snapped: false,
      frame: sourceFrame
    }
  }

  return {
    snapped: true,
    frame: closestPoint.frame,
    snapPoint: closestPoint,
    distance: Math.abs(sourceFrame - closestPoint.frame)
  }
}
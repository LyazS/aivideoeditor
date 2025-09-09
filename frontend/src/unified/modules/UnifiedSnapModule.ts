import { ref, type Ref } from 'vue'
import type { 
  SnapConfig, 
  SnapPoint, 
  SnapResult, 
  SnapCalculationOptions, 
  SnapPointCollectionOptions,
  ClipBoundarySnapPoint,
  TimelineStartSnapPoint
} from '@/types/snap'
import { DEFAULT_SNAP_CONFIG } from '@/types/snap'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'

/**
 * 吸附缓存接口
 */
interface SnapCache {
  targets: SnapPoint[]
  timestamp: number
  isValid: boolean
}

/**
 * 创建空吸附缓存
 */
function createEmptySnapCache(): SnapCache {
  return {
    targets: [],
    timestamp: 0,
    isValid: false
  }
}

/**
 * 统一吸附管理模块
 * 负责管理时间轴吸附功能，提供无阻塞的吸附计算
 */
export function createUnifiedSnapModule(
  timelineItems: Ref<UnifiedTimelineItemData[]>,
  currentFrame: Ref<number>,
  configModule: any // UnifiedConfigModule
) {
  // ==================== 状态定义 ====================
  
  // 吸附配置
  const snapConfig = ref<SnapConfig>(DEFAULT_SNAP_CONFIG)
  
  // 吸附缓存
  const snapCache = ref<SnapCache>(createEmptySnapCache())
  
  // 计算状态标记
  const isCalculating = ref(false)
  
  // 缓存更新标记
  const isCacheUpdating = ref(false)
  
  // ==================== 核心方法 ====================
  
  /**
   * 收集吸附目标点
   * 无阻塞设计，直接返回候选目标列表
   */
  function collectSnapTargets(options: SnapPointCollectionOptions = {}): SnapPoint[] {
    const {
      includeClipBoundaries = true,
      includeKeyframes = false, // 暂不实现关键帧吸附
      includePlayhead = false,   // 暂不实现播放头吸附
      includeTimelineStart = true,
      excludeClipIds = [],
      frameRange
    } = options
    
    const targets: SnapPoint[] = []
    const now = Date.now()
    
    // 如果是缓存更新中，直接返回空数组避免重复计算
    if (isCacheUpdating.value) {
      return []
    }
    
    // 设置缓存更新标记
    isCacheUpdating.value = true
    
    try {
      // 收集片段边界吸附点
      if (includeClipBoundaries) {
        timelineItems.value.forEach(item => {
          // 跳过被排除的片段
          if (excludeClipIds.includes(item.id)) {
            return
          }
          
          // 检查是否在指定帧范围内
          if (frameRange) {
            const itemStart = item.timeRange.timelineStartTime
            const itemEnd = item.timeRange.timelineEndTime
            if (itemEnd < frameRange.start || itemStart > frameRange.end) {
              return
            }
          }
          
          // 获取媒体项目名称
          const mediaItem = configModule.getMediaItem?.(item.mediaItemId)
          const clipName = mediaItem?.name || `片段 ${item.id.slice(0, 8)}`
          
          // 添加开始位置吸附点
          const startPoint: ClipBoundarySnapPoint = {
            type: 'clip-start',
            frame: item.timeRange.timelineStartTime,
            priority: 1,
            clipId: item.id,
            clipName
          }
          targets.push(startPoint)
          
          // 添加结束位置吸附点
          const endPoint: ClipBoundarySnapPoint = {
            type: 'clip-end',
            frame: item.timeRange.timelineEndTime,
            priority: 1,
            clipId: item.id,
            clipName
          }
          targets.push(endPoint)
        })
      }
      
      // 收集时间轴起始位置吸附点
      if (includeTimelineStart) {
        const timelineStartPoint: TimelineStartSnapPoint = {
          type: 'timeline-start',
          frame: 0,
          priority: 3
        }
        targets.push(timelineStartPoint)
      }
      
      // 更新缓存
      snapCache.value = {
        targets,
        timestamp: now,
        isValid: true
      }
      
    } finally {
      // 清除缓存更新标记
      isCacheUpdating.value = false
    }
    
    return targets
  }
  
  /**
   * 计算吸附位置
   * 使用缓存进行快速计算
   */
  function calculateSnapPosition(frame: number, options: SnapCalculationOptions = {}): SnapResult | null {
    const {
      temporaryDisabled = false,
      customThreshold
    } = options
    
    // 如果吸附被临时禁用，直接返回null
    if (temporaryDisabled) {
      return null
    }
    
    // 检查吸附功能是否启用
    if (!snapConfig.value.enabled) {
      return null
    }
    
    // 使用自定义阈值或配置中的阈值
    const threshold = customThreshold ?? snapConfig.value.threshold
    
    // 检查缓存是否有效
    if (!snapCache.value.isValid) {
      // 缓存无效，直接返回null
      return null
    }
    
    // 查找最近的吸附点
    let bestSnapPoint: SnapPoint | null = null
    let bestDistance = Infinity
    
    snapCache.value.targets.forEach(target => {
      const distance = Math.abs(frame - (target as any).frame)
      if (distance < bestDistance && distance <= threshold) {
        bestDistance = distance
        bestSnapPoint = target
      }
    })
    
    // 如果没有找到合适的吸附点，返回null
    if (!bestSnapPoint || bestDistance > threshold) {
      return null
    }
    
    // 返回吸附结果
    return {
      frame: (bestSnapPoint as any).frame,
      snapPoint: bestSnapPoint,
      distance: bestDistance
    }
  }
  
  /**
   * 更新吸附配置
   */
  function updateSnapConfig(newConfig: Partial<SnapConfig>): void {
    const oldConfig = { ...snapConfig.value }
    snapConfig.value = {
      ...snapConfig.value,
      ...newConfig
    }
    
    // 如果配置发生重要变化，清理缓存
    if (oldConfig.enabled !== snapConfig.value.enabled ||
        oldConfig.threshold !== snapConfig.value.threshold) {
      clearCache()
    }
  }
  
  /**
   * 清理缓存
   */
  function clearCache(): void {
    snapCache.value = createEmptySnapCache()
  }
  
  /**
   * 检查缓存是否有效
   */
  function isCacheValid(): boolean {
    return snapCache.value.isValid
  }
  
  /**
   * 获取吸附功能摘要
   */
  function getSnapSummary() {
    return {
      config: snapConfig.value,
      cache: {
        targetCount: snapCache.value.targets.length,
        isValid: snapCache.value.isValid,
        timestamp: snapCache.value.timestamp
      },
      isCalculating: isCalculating.value,
      isCacheUpdating: isCacheUpdating.value
    }
  }
  
  /**
   * 开始拖拽 - 触发候选目标收集
   * 无阻塞设计，立即返回
   */
  function startDrag(excludeClipIds: string[] = []): void {
    // 如果吸附功能未启用，直接返回
    if (!snapConfig.value.enabled) {
      return
    }
    
    // 设置计算状态
    isCalculating.value = true
    
    try {
      // 收集所有吸附目标（简化实现，不限制范围）
      collectSnapTargets({
        includeClipBoundaries: snapConfig.value.clipBoundaries,
        includeKeyframes: snapConfig.value.keyframes,
        includePlayhead: snapConfig.value.playhead,
        includeTimelineStart: snapConfig.value.timelineStart,
        excludeClipIds
        // 不设置frameRange，收集所有目标
      })
    } finally {
      // 清除计算状态
      isCalculating.value = false
    }
  }
  
  /**
   * 结束拖拽 - 清理临时数据
   */
  function endDrag(): void {
    // 清理临时缓存
    clearCache()
    isCalculating.value = false
    isCacheUpdating.value = false
  }
  
  
  // ==================== 导出接口 ====================
  
  return {
    // 状态
    snapConfig,
    isCalculating,
    isCacheUpdating,
    
    // 核心方法
    collectSnapTargets,
    calculateSnapPosition,
    updateSnapConfig,
    clearCache,
    isCacheValid,
    
    // 拖拽集成方法
    startDrag,
    endDrag,
    
    // 工具方法
    getSnapSummary
  }
}

// 导出类型定义
export type UnifiedSnapModule = ReturnType<typeof createUnifiedSnapModule>
import { ref, computed, watch } from 'vue'
import { createSnapCalculationEngine } from '@/unified/utils/snapCalculation'
import { DEFAULT_SNAP_CONFIG } from '@/types/snap'
import type {
  SnapPoint,
  SnapResult,
  SnapCalculationOptions,
  SnapPointCollectionOptions,
  SnapConfig
} from '@/types/snap'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'

/**
 * 统一吸附模块
 * 提供全局共享的吸附功能
 */
export function createUnifiedSnapModule() {
  // 吸附配置状态
  const snapConfig = ref<SnapConfig>(DEFAULT_SNAP_CONFIG)
  
  // 吸附计算引擎
  const snapEngine = ref(createSnapCalculationEngine(snapConfig.value))
  
  // 当前吸附结果
  const currentSnapResult = ref<SnapResult | null>(null)
  
  // 吸附点收集选项
  const snapPointOptions = ref<SnapPointCollectionOptions>({
    includeClipBoundaries: true,
    includeKeyframes: true,
    includeTimelineStart: true
  })
  
  // 监听配置变化，更新引擎
  watch(snapConfig, (newConfig) => {
    snapEngine.value.setConfig(newConfig)
  }, { deep: true })
  
  /**
   * 更新吸附配置
   */
  function updateSnapConfig(newConfig: Partial<SnapConfig>): void {
    snapConfig.value = { ...snapConfig.value, ...newConfig }
  }
  
  /**
   * 切换吸附功能开关
   */
  function toggleSnapEnabled(): void {
    snapConfig.value.enabled = !snapConfig.value.enabled
  }
  
  /**
   * 收集所有可用的吸附点
   */
  function collectAllSnapPoints(options: SnapPointCollectionOptions = {}): SnapPoint[] {
    const points: SnapPoint[] = []
    
    // 收集时间轴起始点
    if (options.includeTimelineStart ?? snapConfig.value.timelineStart) {
      points.push({
        type: 'timeline-start',
        frame: 0,
        priority: 3
      })
    }
    
    // 这里应该被外部传入的时间轴项目数据填充
    // 具体实现将在 unifiedStore 中完成
    
    return points
  }
  
  /**
   * 收集片段边界吸附点
   */
  function collectClipBoundaryPoints(
    timelineItems: UnifiedTimelineItemData[],
    excludeClipIds?: string[]
  ): SnapPoint[] {
    const points: SnapPoint[] = []
    
    timelineItems.forEach(item => {
      // 排除指定的片段
      if (excludeClipIds && excludeClipIds.includes(item.id)) {
        return
      }
      
      const { timelineStartTime, timelineEndTime } = item.timeRange
      
      // 添加片段起始点
      points.push({
        type: 'clip-start',
        frame: timelineStartTime,
        clipId: item.id,
        clipName: getTimelineItemName(item),
        priority: 1
      })
      
      // 添加片段结束点
      points.push({
        type: 'clip-end',
        frame: timelineEndTime,
        clipId: item.id,
        clipName: getTimelineItemName(item),
        priority: 1
      })
    })
    
    return points
  }
  
  /**
   * 收集关键帧吸附点
   */
  function collectKeyframePoints(
    timelineItems: UnifiedTimelineItemData[],
    excludeClipIds?: string[]
  ): SnapPoint[] {
    const points: SnapPoint[] = []
    
    timelineItems.forEach(item => {
      // 排除指定的片段
      if (excludeClipIds && excludeClipIds.includes(item.id)) {
        return
      }
      
      // 检查是否有关键帧配置
      if (item.config && 'keyframes' in item.config) {
        const keyframes = item.config.keyframes as any[]
        
        keyframes.forEach((keyframe, index) => {
          if (keyframe && typeof keyframe.time === 'number') {
            points.push({
              type: 'keyframe',
              frame: item.timeRange.timelineStartTime + keyframe.time,
              clipId: item.id,
              keyframeId: `keyframe-${item.id}-${index}`,
              priority: 2
            })
          }
        })
      }
    })
    
    return points
  }
  
  /**
   * 获取时间轴项目名称
   */
  function getTimelineItemName(item: UnifiedTimelineItemData): string {
    if (item.config && 'name' in item.config) {
      return item.config.name as string
    }
    
    // 这里需要从外部获取媒体项目名称
    return 'Clip'
  }
  
  /**
   * 执行吸附计算
   */
  function calculateSnap(
    sourceFrame: number,
    options: SnapCalculationOptions = {},
    frameToPixel: (frames: number, timelineWidth: number) => number,
    timelineWidth: number
  ): SnapResult {
    // 获取当前所有吸附点
    const allSnapPoints = collectAllSnapPoints({
      excludeClipIds: options.excludeClipIds
    })
    
    const result = snapEngine.value.calculateSnap(
      sourceFrame,
      options,
      (frames) => frameToPixel(frames, timelineWidth)
    )
    
    // 更新当前吸附结果
    currentSnapResult.value = result
    
    return result
  }
  
  /**
   * 清除当前吸附结果
   */
  function clearCurrentSnap(): void {
    currentSnapResult.value = null
  }
  
  /**
   * 检查是否启用了吸附功能
   */
  const isSnapEnabled = computed(() => snapConfig.value.enabled)
  
  /**
   * 获取当前吸附配置
   */
  const currentSnapConfig = computed(() => snapConfig.value)
  
  /**
   * 获取当前吸附结果
   */
  const snapResult = computed(() => currentSnapResult.value)
  
  /**
   * 获取吸附状态摘要
   */
  function getSnapSummary(): string {
    const status = snapConfig.value.enabled ? '启用' : '禁用'
    const clipBoundaries = snapConfig.value.clipBoundaries ? '是' : '否'
    const keyframes = snapConfig.value.keyframes ? '是' : '否'
    const timelineStart = snapConfig.value.timelineStart ? '是' : '否'
    
    return `吸附功能: ${status}, 片段边界: ${clipBoundaries}, 关键帧: ${keyframes}, 时间轴起始: ${timelineStart}`
  }
  
  // 创建增强版的吸附计算函数，接受timelineItems参数
  function calculateSnapWithTimelineItems(
    sourceFrame: number,
    timelineItems: UnifiedTimelineItemData[],
    options: SnapCalculationOptions = {},
    frameToPixel: (frames: number, timelineWidth: number) => number,
    timelineWidth: number
  ): SnapResult {
    console.log('🧲 [UnifiedSnapModule] 吸附计算开始:', {
      sourceFrame,
      timelineItemsCount: timelineItems.length,
      options,
      snapEnabled: snapConfig.value.enabled
    })

    if (!snapConfig.value.enabled || options.temporaryDisabled) {
      console.log('🧲 [UnifiedSnapModule] 吸附功能被禁用，返回原始位置')
      return {
        snapped: false,
        frame: sourceFrame
      }
    }
    
    // 收集所有可用的吸附点
    const points: SnapPoint[] = []
    
    // 收集时间轴起始点
    if (snapConfig.value.timelineStart) {
      points.push({
        type: 'timeline-start',
        frame: 0,
        priority: 3
      })
    }
    
    // 收集片段边界点
    if (snapConfig.value.clipBoundaries) {
      const clipBoundaryPoints = collectClipBoundaryPoints(timelineItems, options.excludeClipIds)
      console.log('🧲 [UnifiedSnapModule] 收集到的片段边界点:', clipBoundaryPoints)
      points.push(...clipBoundaryPoints)
    }
    
    // 收集关键帧点
    if (snapConfig.value.keyframes) {
      const keyframePoints = collectKeyframePoints(timelineItems, options.excludeClipIds)
      console.log('🧲 [UnifiedSnapModule] 收集到的关键帧点:', keyframePoints)
      points.push(...keyframePoints)
    }
    
    console.log('🧲 [UnifiedSnapModule] 总的吸附点数量:', points.length)
    console.log('🧲 [UnifiedSnapModule] 吸附点详情:', points)
    
    if (points.length === 0) {
      console.log('🧲 [UnifiedSnapModule] 没有找到任何吸附点')
      return {
        snapped: false,
        frame: sourceFrame
      }
    }
    
    // 使用统一的计算引擎
    console.log('🧲 [UnifiedSnapModule] 调用计算引擎')
    const result = snapEngine.value.calculateSnapWithPoints(
      sourceFrame,
      points,
      options,
      (frames) => frameToPixel(frames, timelineWidth)
    )
    
    console.log('🧲 [UnifiedSnapModule] 吸附计算结果:', result)
    
    // 更新当前吸附结果
    currentSnapResult.value = result
    
    return result
  }
  
  return {
    // 状态
    snapConfig,
    isSnapEnabled,
    currentSnapConfig,
    snapResult,
    
    // 方法
    updateSnapConfig,
    toggleSnapEnabled,
    collectAllSnapPoints,
    collectClipBoundaryPoints,
    collectKeyframePoints,
    calculateSnap,
    calculateSnapWithTimelineItems,
    clearCurrentSnap,
    getSnapSummary
  }
}
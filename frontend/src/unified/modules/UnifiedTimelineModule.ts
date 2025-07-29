import { ref, type Raw, type Ref } from 'vue'
import type { MediaTypeOrUnknown } from '../mediaitem'
import type {
  UnifiedTimelineItemData,
  KnownTimelineItem,
  UnknownTimelineItem,
  UnknownMediaConfig
} from '../timelineitem/TimelineItemData'
import {
  isVideoTimelineItem,
  isImageTimelineItem,
  isAudioTimelineItem,
  isTextTimelineItem,
  isUnknownTimelineItem,
  isKnownTimelineItem
} from '../timelineitem/TimelineItemQueries'
import { convertUnknownToKnown } from '../timelineitem/TimelineItemBehaviors'
import { TimelineItemFactory } from '../timelineitem/TimelineItemFactory'
import type { UnifiedMediaItemData } from '../mediaitem/types'
import type { UnifiedTrackData } from '../track/TrackTypes'
import type {
  BaseTimeRange,
  CustomSprite,
  MediaType,
  VideoTimeRange,
  ImageTimeRange
} from '../../types'
import { VideoVisibleSprite } from '../../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../../utils/ImageVisibleSprite'
import { AudioVisibleSprite } from '../../utils/AudioVisibleSprite'
import { webavToProjectCoords, projectToWebavCoords } from '../../utils/coordinateTransform'
// import { printDebugInfo } from '../../stores/utils/debugUtils' // 暂时注释，类型不兼容

// 临时调试函数，适用于统一类型
function unifiedDebugLog(operation: string, details: any) {
  if (import.meta.env.DEV) {
    console.log(`🎬 [UnifiedTimelineModule] ${operation}:`, details)
  }
}
import { syncTimeRange } from '../utils/UnifiedTimeRangeUtils'
import { microsecondsToFrames } from '../../stores/utils/timeUtils'
import { globalUnifiedWebAVAnimationManager } from '../utils/UnifiedWebAVAnimationManager'

/**
 * 统一时间轴核心管理模块
 * 基于新架构的统一类型系统重构的时间轴管理功能
 * 
 * 主要变化：
 * 1. 使用 UnifiedTimelineItemData 替代原有的 LocalTimelineItem 和 AsyncProcessingTimelineItem
 * 2. 使用统一的状态管理系统（3状态：ready|loading|error）
 * 3. 保持与原有模块相同的API接口，便于迁移
 * 4. 支持更丰富的时间轴项目状态和属性管理
 */
export function createUnifiedTimelineModule(
  configModule: { videoResolution: { value: { width: number; height: number } } },
  webavModule: {
    removeSprite: (sprite: any) => boolean
  },
  mediaModule: {
    getMediaItem: (id: string) => UnifiedMediaItemData | undefined
    mediaItems: Ref<UnifiedMediaItemData[]>
    getAllMediaItems: () => UnifiedMediaItemData[]
  },
  trackModule?: {
    tracks: Ref<UnifiedTrackData[]>
  },
) {
  // ==================== 状态定义 ====================

  const timelineItems = ref<UnifiedTimelineItemData<MediaTypeOrUnknown>[]>([])

  // ==================== 双向数据同步函数 ====================

  /**
   * 为UnifiedTimelineItem设置双向数据同步（类型安全版本）
   * 
   * 数据流向说明：
   * 本系统采用分层数据流向策略：
   * 
   * 【动画属性】- 遵循标准数据流向 UI → WebAV → TimelineItem → UI：
   * - x, y, width, height, rotation, zIndex
   * - 这些属性WebAV支持propsChange事件，可以自动同步
   * 
   * 【非动画属性】- 直接修改config（技术限制导致的必要妥协）：
   * - opacity: 通过自定义回调实现类似数据流向
   * - volume, isMuted: WebAV不支持相关事件，只能直接修改config
   */
  function setupBidirectionalSync(timelineItem: UnifiedTimelineItemData<MediaTypeOrUnknown>) {
    // 只有已知类型且就绪状态的时间轴项目才需要双向同步
    if (!isKnownTimelineItem(timelineItem) || timelineItem.timelineStatus !== 'ready') {
      return
    }

    // 注意：这里需要根据实际的sprite实现来调整
    // 目前暂时注释掉，因为新的类型系统中sprite的处理方式可能不同
    console.log('🔄 [UnifiedTimelineModule] 设置双向同步:', timelineItem.id)
    
    // TODO: 根据新的类型系统重新实现双向同步逻辑
    // 这里需要根据具体的sprite实现来调整
  }

  // ==================== 辅助函数 ====================

  /**
   * 检查时间轴项目是否具有视觉属性
   */
  function hasVisualProps(timelineItem: UnifiedTimelineItemData<MediaTypeOrUnknown>): boolean {
    return isVideoTimelineItem(timelineItem) ||
           isImageTimelineItem(timelineItem) ||
           isTextTimelineItem(timelineItem)
  }

  /**
   * 检查时间轴项目是否具有音频属性
   */
  function hasAudioProps(timelineItem: UnifiedTimelineItemData<MediaTypeOrUnknown>): boolean {
    return isVideoTimelineItem(timelineItem) || isAudioTimelineItem(timelineItem)
  }

  // ==================== 时间轴管理方法 ====================

  /**
   * 添加时间轴项目
   * @param timelineItem 要添加的时间轴项目
   */
  function addTimelineItem(timelineItem: UnifiedTimelineItemData<MediaTypeOrUnknown>) {
    // 如果没有指定轨道，默认分配到第一个轨道
    if (!timelineItem.trackId && trackModule) {
      const firstTrack = trackModule.tracks.value[0]
      if (firstTrack) {
        timelineItem.trackId = firstTrack.id
      }
    }

    // 检查时间轴项目状态
    if (timelineItem.timelineStatus === 'loading') {
      // 加载中的时间轴项目不需要sprite相关的设置
      console.log('🔧 [UnifiedTimelineModule] 添加加载中的时间轴项目:', timelineItem.id)
    } else if (timelineItem.timelineStatus === 'ready' && isKnownTimelineItem(timelineItem)) {
      // 就绪的已知类型时间轴项目处理逻辑
      // TODO: 根据新的类型系统重新实现sprite相关逻辑
      
      // 设置双向数据同步（仅就绪状态的已知类型时间轴项目）
      setupBidirectionalSync(timelineItem)

      // TODO: 初始化动画管理器
      // globalUnifiedWebAVAnimationManager.addManager(timelineItem)
      
      const mediaItem = mediaModule.getMediaItem(timelineItem.mediaItemId)
      unifiedDebugLog('添加素材到时间轴', {
        timelineItemId: timelineItem.id,
        mediaItemId: timelineItem.mediaItemId,
        mediaItemName: mediaItem?.name || '未知',
        trackId: timelineItem.trackId,
        mediaType: timelineItem.mediaType,
        position: timelineItem.timeRange.timelineStartTime,
      })
    } else {
      // 错误状态的时间轴项目
      console.log('❌ [UnifiedTimelineModule] 添加错误状态的时间轴项目:', timelineItem.id)
    }

    timelineItems.value.push(timelineItem)
  }

  /**
   * 移除时间轴项目
   * @param timelineItemId 要移除的时间轴项目ID
   */
  function removeTimelineItem(timelineItemId: string) {
    const index = timelineItems.value.findIndex((item: UnifiedTimelineItemData<MediaTypeOrUnknown>) => item.id === timelineItemId)
    if (index > -1) {
      const item = timelineItems.value[index]
      const mediaItem = mediaModule.getMediaItem(item.mediaItemId)

      // 检查时间轴项目状态
      if (item.timelineStatus === 'loading' || item.timelineStatus === 'error') {
        // 加载中或错误状态的时间轴项目不需要清理sprite相关资源
        console.log('🗑️ [UnifiedTimelineModule] 移除非就绪状态的时间轴项目:', timelineItemId)
      } else if (item.timelineStatus === 'ready' && isKnownTimelineItem(item)) {
        // 就绪状态的已知类型时间轴项目清理逻辑
        // TODO: 根据新的类型系统重新实现sprite清理逻辑
        
        // 清理动画管理器
        // globalUnifiedWebAVAnimationManager.removeManager(timelineItemId)
      }

      // 从数组中移除
      timelineItems.value.splice(index, 1)

      unifiedDebugLog('从时间轴删除素材', {
        timelineItemId,
        mediaItemId: item.mediaItemId,
        mediaItemName: mediaItem?.name || '未知',
        trackId: item.trackId,
        position: item.timeRange.timelineStartTime / 30,
      })
    }
  }

  /**
   * 获取时间轴项目
   * @param timelineItemId 时间轴项目ID
   * @returns 时间轴项目或undefined
   */
  function getTimelineItem(timelineItemId: string): UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined {
    return timelineItems.value.find((item: UnifiedTimelineItemData<MediaTypeOrUnknown>) => item.id === timelineItemId)
  }

  /**
   * 获取就绪状态的时间轴项目（过滤掉加载中和错误状态的项目）
   * @param timelineItemId 时间轴项目ID
   * @returns 就绪状态的时间轴项目或undefined
   */
  function getReadyTimelineItem(timelineItemId: string): KnownTimelineItem | undefined {
    const item = getTimelineItem(timelineItemId)
    return item && item.timelineStatus === 'ready' && isKnownTimelineItem(item) ? item : undefined
  }

  /**
   * 更新时间轴项目位置
   * @param timelineItemId 时间轴项目ID
   * @param newPositionFrames 新位置（帧数）
   * @param newTrackId 新轨道ID（可选）
   */
  function updateTimelineItemPosition(
    timelineItemId: string,
    newPositionFrames: number,
    newTrackId?: string,
  ) {
    const item = getTimelineItem(timelineItemId)
    if (item) {
      const oldPositionFrames = item.timeRange.timelineStartTime
      const oldTrackId = item.trackId
      const mediaItem = mediaModule.getMediaItem(item.mediaItemId)

      // 确保新位置不为负数
      const clampedNewPositionFrames = Math.max(0, newPositionFrames)

      // 如果指定了新轨道，更新轨道ID
      if (newTrackId !== undefined) {
        item.trackId = newTrackId

        // 根据新轨道的可见性设置sprite的visible属性（仅就绪状态的时间轴项目）
        if (trackModule && item.timelineStatus === 'ready' && isKnownTimelineItem(item)) {
          const newTrack = trackModule.tracks.value.find((t) => t.id === newTrackId)
          if (newTrack) {
            // TODO: 根据新的类型系统重新实现sprite可见性设置
            console.log('🔄 [UnifiedTimelineModule] 更新轨道可见性:', newTrack.isVisible)
          }
        }
      }

      // 更新时间轴位置
      if (item.timelineStatus === 'loading' || item.timelineStatus === 'error') {
        // 非就绪状态的时间轴项目：直接更新timeRange
        const currentTimeRange = item.timeRange
        const durationFrames = currentTimeRange.timelineEndTime - currentTimeRange.timelineStartTime

        item.timeRange = {
          ...item.timeRange,
          timelineStartTime: clampedNewPositionFrames,
          timelineEndTime: clampedNewPositionFrames + durationFrames,
        }
      } else if (item.timelineStatus === 'ready' && isKnownTimelineItem(item)) {
        // 就绪状态的已知类型时间轴项目：直接更新timeRange
        const currentTimeRange = item.timeRange
        const durationFrames = currentTimeRange.timelineEndTime - currentTimeRange.timelineStartTime

        // 直接更新timeRange
        item.timeRange = {
          ...item.timeRange,
          timelineStartTime: clampedNewPositionFrames,
          timelineEndTime: clampedNewPositionFrames + durationFrames,
        }
      }

      unifiedDebugLog('更新时间轴项目位置', {
        timelineItemId,
        mediaItemName: mediaItem?.name || '未知',
        oldPositionFrames: oldPositionFrames,
        newPositionFrames: clampedNewPositionFrames,
        originalNewPositionFrames: newPositionFrames,
        oldTrackId,
        newTrackId: item.trackId,
        positionChanged: oldPositionFrames !== clampedNewPositionFrames,
        trackChanged: oldTrackId !== item.trackId,
        positionClamped: newPositionFrames !== clampedNewPositionFrames,
      })
    }
  }

  /**
   * 更新时间轴项目的sprite
   * @param timelineItemId 时间轴项目ID
   * @param newSprite 新的sprite实例
   */
  function updateTimelineItemSprite(
    timelineItemId: string,
    newSprite: Raw<VideoVisibleSprite | ImageVisibleSprite | AudioVisibleSprite>,
  ) {
    const item = getReadyTimelineItem(timelineItemId)
    if (item) {
      const mediaItem = mediaModule.getMediaItem(item.mediaItemId)

      // 清理旧的sprite资源
      try {
        if (item.sprite && typeof item.sprite.destroy === 'function') {
          item.sprite.destroy()
        }
      } catch (error) {
        console.warn('清理旧sprite资源时出错:', error)
      }

      // 更新sprite引用
      item.sprite = newSprite

      unifiedDebugLog('更新时间轴项目sprite', {
        timelineItemId,
        mediaItemName: mediaItem?.name || '未知',
        trackId: item.trackId,
        position: microsecondsToFrames(item.timeRange.timelineStartTime),
      })
    }
  }

  /**
   * 更新UnifiedTimelineItem的VisibleSprite变换属性
   * 这会触发propsChange事件，自动同步到TimelineItem，然后更新属性面板显示
   */
  function updateTimelineItemTransform(
    timelineItemId: string,
    transform: {
      x?: number
      y?: number
      width?: number
      height?: number
      rotation?: number
      opacity?: number
      zIndex?: number
    },
  ) {
    const item = getReadyTimelineItem(timelineItemId)
    if (!item || !item.sprite) return

    const sprite = item.sprite

    // TODO: 根据新的类型系统重新实现变换属性更新逻辑
    // 新的类型系统中，配置属性直接存储在config中，而不是通过transform对象
    console.log('🔄 [UnifiedTimelineModule] 更新变换属性:', transform)
    
    // 暂时简化实现，直接更新config属性
    if (hasVisualProps(item) && isKnownTimelineItem(item)) {
      const config = item.config as any // 临时类型断言
      
      if (transform.x !== undefined) config.x = transform.x
      if (transform.y !== undefined) config.y = transform.y
      if (transform.width !== undefined) config.width = transform.width
      if (transform.height !== undefined) config.height = transform.height
      if (transform.rotation !== undefined) config.rotation = transform.rotation
      if (transform.opacity !== undefined) config.opacity = transform.opacity
      if (transform.zIndex !== undefined) config.zIndex = transform.zIndex
    }
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    timelineItems,

    // 方法
    addTimelineItem,
    removeTimelineItem,
    getTimelineItem,
    getReadyTimelineItem,
    setupBidirectionalSync,
    updateTimelineItemPosition,
    updateTimelineItemSprite,
    updateTimelineItemTransform,

    // 工厂函数（使用新的工厂）
    createTimelineItemData: TimelineItemFactory.createKnown,
    createVideoTimelineItem: TimelineItemFactory.createVideoWithDefaults,
    createAudioTimelineItem: TimelineItemFactory.createAudioWithDefaults,
    createImageTimelineItem: TimelineItemFactory.createImageWithDefaults,
    cloneTimelineItemData: TimelineItemFactory.clone,
    duplicateTimelineItem: TimelineItemFactory.duplicate,

    // 类型守卫和转换函数
    isVideoTimelineItem,
    isImageTimelineItem,
    isAudioTimelineItem,
    isTextTimelineItem,
    isUnknownTimelineItem,
    isKnownTimelineItem,
    convertUnknownToKnown,

    // 状态转换函数（简化版本）
    transitionTimelineStatus: (item: UnifiedTimelineItemData<MediaTypeOrUnknown>, newStatus: 'loading' | 'ready' | 'error') => {
      item.timelineStatus = newStatus
    },
    setLoading: (item: UnifiedTimelineItemData<MediaTypeOrUnknown>) => { item.timelineStatus = 'loading' },
    setReady: (item: UnifiedTimelineItemData<MediaTypeOrUnknown>) => { item.timelineStatus = 'ready' },
    setError: (item: UnifiedTimelineItemData<MediaTypeOrUnknown>) => { item.timelineStatus = 'error' },

    // 查询函数（简化版本）
    isReady: (item: UnifiedTimelineItemData<MediaTypeOrUnknown>) => item.timelineStatus === 'ready',
    isLoading: (item: UnifiedTimelineItemData<MediaTypeOrUnknown>) => item.timelineStatus === 'loading',
    hasError: (item: UnifiedTimelineItemData<MediaTypeOrUnknown>) => item.timelineStatus === 'error',
    getDuration: (item: UnifiedTimelineItemData<MediaTypeOrUnknown>) => item.timeRange.timelineEndTime - item.timeRange.timelineStartTime,
    getStatusText: (item: UnifiedTimelineItemData<MediaTypeOrUnknown>) => {
      switch (item.timelineStatus) {
        case 'loading': return '加载中'
        case 'ready': return '就绪'
        case 'error': return '错误'
        default: return '未知'
      }
    },
    filterByStatus: (items: UnifiedTimelineItemData<MediaTypeOrUnknown>[], status: 'loading' | 'ready' | 'error') =>
      items.filter(item => item.timelineStatus === status),
    filterByTrack: (items: UnifiedTimelineItemData<MediaTypeOrUnknown>[], trackId: string) =>
      items.filter(item => item.trackId === trackId),
    sortByTime: (items: UnifiedTimelineItemData<MediaTypeOrUnknown>[]) =>
      [...items].sort((a, b) => a.timeRange.timelineStartTime - b.timeRange.timelineStartTime),

    // 辅助函数
    hasVisualProps,
    hasAudioProps,
  }
}

// 导出类型定义
export type UnifiedTimelineModule = ReturnType<typeof createUnifiedTimelineModule>

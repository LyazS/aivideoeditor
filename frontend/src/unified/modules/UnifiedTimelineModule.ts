import { ref, type Raw, type Ref } from 'vue'
import type {
  UnifiedTimelineItemData,
  TimelineItemStatus,
  BasicTimelineConfig,
  TransformData,
} from '../timelineitem/TimelineItemData'
import {
  createTimelineItemData,
  createVideoTimelineItem,
  createAudioTimelineItem,
  createImageTimelineItem,
  cloneTimelineItemData,
  duplicateTimelineItem,
  transitionTimelineStatus,
  setLoading,
  setReady,
  setError,
  isReady,
  isLoading,
  hasError,
  getDuration,
  getStatusText,
  filterByStatus,
  filterByTrack,
  sortByTime
} from '../timelineitem'
import type { UnifiedMediaItemData } from '../mediaitem/types'
import type { UnifiedTrackData } from '../track/TrackTypes'
import type { BaseTimeRange, CustomSprite } from '../../types'
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

  const timelineItems = ref<UnifiedTimelineItemData[]>([])

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
  function setupBidirectionalSync(timelineItem: UnifiedTimelineItemData) {
    if (!timelineItem.sprite || !isReady(timelineItem)) {
      return
    }

    const sprite = timelineItem.sprite

    // 直接使用WebAV原生的propsChange事件监听器
    // 设置VisibleSprite → TimelineItem 的同步（仅适用于动画属性）
    sprite.on('propsChange', (changedProps: any) => {
      if (changedProps.rect && hasVisualProps(timelineItem)) {
        const rect = changedProps.rect

        // 更新位置（坐标系转换）
        const currentRect = sprite.rect
        const config = timelineItem.config
        const transform = config.transform || {}
        
        const projectCoords = webavToProjectCoords(
          rect.x !== undefined ? rect.x : currentRect.x,
          rect.y !== undefined ? rect.y : currentRect.y,
          rect.w !== undefined ? rect.w : transform.width || 1920,
          rect.h !== undefined ? rect.h : transform.height || 1080,
          configModule.videoResolution.value.width,
          configModule.videoResolution.value.height,
        )
        
        if (!config.transform) {
          config.transform = {}
        }
        config.transform.x = Math.round(projectCoords.x)
        config.transform.y = Math.round(projectCoords.y)

        // 更新尺寸
        if (rect.w !== undefined) config.transform.width = rect.w
        if (rect.h !== undefined) config.transform.height = rect.h

        // 更新旋转角度
        if (rect.angle !== undefined) config.transform.rotation = rect.angle
      }

      // 同步zIndex属性
      if (changedProps.zIndex !== undefined) {
        if (!timelineItem.config.transform) {
          timelineItem.config.transform = {}
        }
        timelineItem.config.transform.zIndex = changedProps.zIndex
      }

      // 同步opacity属性
      if (changedProps.opacity !== undefined && hasVisualProps(timelineItem)) {
        if (!timelineItem.config.transform) {
          timelineItem.config.transform = {}
        }
        timelineItem.config.transform.opacity = changedProps.opacity
      }
    })
  }

  // ==================== 辅助函数 ====================

  /**
   * 检查时间轴项目是否具有视觉属性
   */
  function hasVisualProps(timelineItem: UnifiedTimelineItemData): boolean {
    return timelineItem.mediaType === 'video' || timelineItem.mediaType === 'image'
  }

  /**
   * 检查时间轴项目是否具有音频属性
   */
  function hasAudioProps(timelineItem: UnifiedTimelineItemData): boolean {
    return timelineItem.mediaType === 'video' || timelineItem.mediaType === 'audio'
  }

  // ==================== 时间轴管理方法 ====================

  /**
   * 添加时间轴项目
   * @param timelineItem 要添加的时间轴项目
   */
  function addTimelineItem(timelineItem: UnifiedTimelineItemData) {
    // 如果没有指定轨道，默认分配到第一个轨道
    if (!timelineItem.trackId && trackModule) {
      const firstTrack = trackModule.tracks.value[0]
      if (firstTrack) {
        timelineItem.trackId = firstTrack.id
      }
    }

    // 检查时间轴项目状态
    if (isLoading(timelineItem)) {
      // 加载中的时间轴项目不需要sprite相关的设置
      console.log('🔧 [UnifiedTimelineModule] 添加加载中的时间轴项目:', timelineItem.id)
    } else if (isReady(timelineItem)) {
      // 就绪的时间轴项目处理逻辑
      // 根据轨道的可见性和静音状态设置sprite属性
      if (trackModule && timelineItem.sprite) {
        const track = trackModule.tracks.value.find((t) => t.id === timelineItem.trackId)
        if (track) {
          // 设置可见性
          timelineItem.sprite.visible = track.isVisible

          // 为视频片段设置轨道静音检查函数
          if (timelineItem.mediaType === 'video' && 'setTrackMuteChecker' in timelineItem.sprite) {
            const sprite = timelineItem.sprite as VideoVisibleSprite
            sprite.setTrackMuteChecker(() => track.isMuted)
          }

          // 为音频片段设置轨道静音检查函数
          if (timelineItem.mediaType === 'audio' && 'setTrackMuteChecker' in timelineItem.sprite) {
            const sprite = timelineItem.sprite as AudioVisibleSprite
            sprite.setTrackMuteChecker(() => track.isMuted)
          }
        }
      }

      // 设置双向数据同步（仅就绪状态的时间轴项目）
      setupBidirectionalSync(timelineItem)

      // 初始化动画管理器（仅就绪状态的时间轴项目）
      globalUnifiedWebAVAnimationManager.addManager(timelineItem)
      
      const mediaItem = mediaModule.getMediaItem(timelineItem.mediaItemId)
      unifiedDebugLog('添加素材到时间轴', {
        timelineItemId: timelineItem.id,
        mediaItemId: timelineItem.mediaItemId,
        mediaItemName: mediaItem?.name || '未知',
        trackId: timelineItem.trackId,
        position: timelineItem.timeRange.timelineStartTime / 1000000,
        spriteVisible: timelineItem.sprite?.visible,
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
    const index = timelineItems.value.findIndex((item) => item.id === timelineItemId)
    if (index > -1) {
      const item = timelineItems.value[index]
      const mediaItem = mediaModule.getMediaItem(item.mediaItemId)

      // 检查时间轴项目状态
      if (isLoading(item) || hasError(item)) {
        // 加载中或错误状态的时间轴项目不需要清理sprite相关资源
        console.log('🗑️ [UnifiedTimelineModule] 移除非就绪状态的时间轴项目:', timelineItemId)
      } else if (isReady(item)) {
        // 就绪状态的时间轴项目清理逻辑
        // 清理sprite资源
        try {
          if (item.sprite && typeof item.sprite.destroy === 'function') {
            item.sprite.destroy()
          }
        } catch (error) {
          console.warn('清理sprite资源时出错:', error)
        }

        // 从WebAV画布移除
        if (item.sprite) {
          webavModule.removeSprite(item.sprite)
        }

        // 清理动画管理器
        globalUnifiedWebAVAnimationManager.removeManager(timelineItemId)
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
  function getTimelineItem(timelineItemId: string): UnifiedTimelineItemData | undefined {
    return timelineItems.value.find((item) => item.id === timelineItemId)
  }

  /**
   * 获取就绪状态的时间轴项目（过滤掉加载中和错误状态的项目）
   * @param timelineItemId 时间轴项目ID
   * @returns 就绪状态的时间轴项目或undefined
   */
  function getReadyTimelineItem(timelineItemId: string): UnifiedTimelineItemData | undefined {
    const item = getTimelineItem(timelineItemId)
    return item && isReady(item) ? item : undefined
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
        if (trackModule && isReady(item) && item.sprite) {
          const newTrack = trackModule.tracks.value.find((t) => t.id === newTrackId)
          if (newTrack) {
            item.sprite.visible = newTrack.isVisible
          }
        }
      }

      // 更新时间轴位置
      if (isLoading(item) || hasError(item)) {
        // 非就绪状态的时间轴项目：直接更新timeRange
        const currentTimeRange = item.timeRange
        const durationFrames = currentTimeRange.timelineEndTime - currentTimeRange.timelineStartTime

        item.timeRange = {
          timelineStartTime: clampedNewPositionFrames,
          timelineEndTime: clampedNewPositionFrames + durationFrames,
        }
      } else if (isReady(item) && item.sprite) {
        // 就绪状态的时间轴项目：通过sprite更新
        const sprite = item.sprite
        const currentTimeRange = sprite.getTimeRange()
        const durationFrames = currentTimeRange.timelineEndTime - currentTimeRange.timelineStartTime

        // 使用同步函数更新timeRange（使用帧数）
        syncTimeRange(item, {
          timelineStartTime: clampedNewPositionFrames,
          timelineEndTime: clampedNewPositionFrames + durationFrames,
        })
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

    try {
      // 更新尺寸时使用中心缩放 - 仅对视觉媒体有效
      if (
        (transform.width !== undefined || transform.height !== undefined) &&
        hasVisualProps(item)
      ) {
        // 获取当前中心位置（项目坐标系）
        const config = item.config
        const currentTransform = config.transform || {}
        const currentCenterX = currentTransform.x || 0
        const currentCenterY = currentTransform.y || 0
        const newWidth = transform.width !== undefined ? transform.width : currentTransform.width || 1920
        const newHeight = transform.height !== undefined ? transform.height : currentTransform.height || 1080

        // 中心缩放：保持中心位置不变，更新尺寸
        sprite.rect.w = newWidth
        sprite.rect.h = newHeight

        // 根据新尺寸重新计算WebAV坐标（保持中心位置不变）
        const webavCoords = projectToWebavCoords(
          currentCenterX,
          currentCenterY,
          newWidth,
          newHeight,
          configModule.videoResolution.value.width,
          configModule.videoResolution.value.height,
        )
        sprite.rect.x = webavCoords.x
        sprite.rect.y = webavCoords.y
      }

      // 更新位置（需要坐标系转换）- 仅对视觉媒体有效
      if ((transform.x !== undefined || transform.y !== undefined) && hasVisualProps(item)) {
        const config = item.config
        const currentTransform = config.transform || {}
        const newX = transform.x !== undefined ? transform.x : currentTransform.x || 0
        const newY = transform.y !== undefined ? transform.y : currentTransform.y || 0

        // 使用当前的尺寸（可能已经在上面更新过）
        const currentWidth = transform.width !== undefined ? transform.width : currentTransform.width || 1920
        const currentHeight = transform.height !== undefined ? transform.height : currentTransform.height || 1080

        const webavCoords = projectToWebavCoords(
          newX,
          newY,
          currentWidth,
          currentHeight,
          configModule.videoResolution.value.width,
          configModule.videoResolution.value.height,
        )
        sprite.rect.x = webavCoords.x
        sprite.rect.y = webavCoords.y
      }

      // 更新其他属性
      if (transform.opacity !== undefined && hasVisualProps(item)) {
        sprite.opacity = transform.opacity
        // 手动同步opacity到timelineItem（因为opacity没有propsChange回调）
        if (!item.config.transform) {
          item.config.transform = {}
        }
        item.config.transform.opacity = transform.opacity
      }
      if (transform.zIndex !== undefined) {
        sprite.zIndex = transform.zIndex
        // zIndex有propsChange回调，会自动同步到timelineItem
      }
      // 更新旋转角度（WebAV的rect.angle支持旋转）
      if (transform.rotation !== undefined) {
        sprite.rect.angle = transform.rotation
      }
    } catch (error) {
      console.error('更新VisibleSprite变换属性失败:', error)
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

    // 工厂函数
    createTimelineItemData,
    createVideoTimelineItem,
    createAudioTimelineItem,
    createImageTimelineItem,
    cloneTimelineItemData,
    duplicateTimelineItem,

    // 状态转换函数
    transitionTimelineStatus,
    setLoading,
    setReady,
    setError,

    // 查询函数
    isReady,
    isLoading,
    hasError,
    getDuration,
    getStatusText,
    filterByStatus,
    filterByTrack,
    sortByTime,

    // 辅助函数
    hasVisualProps,
    hasAudioProps,
  }
}

// 导出类型定义
export type UnifiedTimelineModule = ReturnType<typeof createUnifiedTimelineModule>

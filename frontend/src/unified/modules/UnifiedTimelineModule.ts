import { ref, type Raw, type Ref } from 'vue'
import type { MediaTypeOrUnknown } from '@/unified/mediaitem'
import type {
  UnifiedTimelineItemData,
  KnownTimelineItem,
  UnknownTimelineItem,
  UnknownMediaConfig,
} from '@/unified/timelineitem/TimelineItemData'
import {
  isVideoTimelineItem,
  isImageTimelineItem,
  isAudioTimelineItem,
  isTextTimelineItem,
  isUnknownTimelineItem,
  isKnownTimelineItem,
  hasVisualProperties,
  hasAudioProperties,
  isReady,
  isLoading,
  hasError,
} from '@/unified/timelineitem/TimelineItemQueries'
import { TimelineItemFactory } from '@/unified/timelineitem/TimelineItemFactory'
import type { UnifiedMediaItemData } from '@/unified/mediaitem/types'
import type { UnifiedTrackData } from '@/unified/track/TrackTypes'
import type { MediaType } from '@/types'
import type { UnifiedSprite } from '@/unified/visiblesprite'
import type {
  VideoMediaConfig,
  ImageMediaConfig,
  TextMediaConfig,
} from '@/unified/timelineitem/TimelineItemData'
import { VideoVisibleSprite } from '@/unified/visiblesprite/VideoVisibleSprite'
import { ImageVisibleSprite } from '@/unified/visiblesprite/ImageVisibleSprite'
import { AudioVisibleSprite } from '@/unified/visiblesprite/AudioVisibleSprite'
import { webavToProjectCoords, projectToWebavCoords } from '@/utils/coordinateTransform'
import type { ExtendedPropsChangeEvent } from '@/types'
// import { printDebugInfo } from '@/stores/utils/debugUtils' // 暂时注释，类型不兼容

// 临时调试函数，适用于统一类型
function unifiedDebugLog(operation: string, details: any) {
  if (import.meta.env.DEV) {
    console.log(`🎬 [UnifiedTimelineModule] ${operation}:`, details)
  }
}
import { syncTimeRange } from '@/unified/utils/timeRangeUtils'
import { microsecondsToFrames } from '@/unified/utils/timeUtils'
import { hasAudioCapabilities } from '@/unified/utils/spriteTypeGuards'
import { globalWebAVAnimationManager } from '@/unified/utils/webavAnimationManager'

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

  const timelineItems = ref<UnifiedTimelineItemData<MediaType>[]>([])

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
  function setupBidirectionalSync(timelineItem: UnifiedTimelineItemData<MediaType>) {
    // 只有已知类型且就绪状态的时间轴项目才需要双向同步
    if (!isKnownTimelineItem(timelineItem) || !isReady(timelineItem)) {
      return
    }

    const sprite = timelineItem.runtime.sprite
    if (!sprite) {
      return
    }

    unifiedDebugLog('设置双向同步', { timelineItemId: timelineItem.id })

    // 直接使用WebAV原生的propsChange事件监听器
    // 设置VisibleSprite → TimelineItem 的同步（仅适用于动画属性）
    sprite.on('propsChange', (changedProps: ExtendedPropsChangeEvent) => {
      if (changedProps.rect && hasVisualProperties(timelineItem)) {
        const rect = changedProps.rect

        // 更新位置（坐标系转换）
        // 如果rect.x/rect.y为undefined，说明位置没有变化，使用sprite的当前值
        const currentRect = sprite.rect
        // hasVisualProps 类型守卫确保了 config 具有视觉属性
        const config = timelineItem.config as VideoMediaConfig | ImageMediaConfig | TextMediaConfig
        const projectCoords = webavToProjectCoords(
          rect.x !== undefined ? rect.x : currentRect.x,
          rect.y !== undefined ? rect.y : currentRect.y,
          rect.w !== undefined ? rect.w : config.width,
          rect.h !== undefined ? rect.h : config.height,
          configModule.videoResolution.value.width,
          configModule.videoResolution.value.height,
        )
        config.x = Math.round(projectCoords.x)
        config.y = Math.round(projectCoords.y)

        // 更新尺寸
        if (rect.w !== undefined) config.width = rect.w
        if (rect.h !== undefined) config.height = rect.h

        // 更新旋转角度
        if (rect.angle !== undefined) config.rotation = rect.angle

        // console.log('🔄 VisibleSprite → TimelineItem 同步:', {
        //   webavCoords: { x: rect.x, y: rect.y },
        //   projectCoords: { x: config.x, y: config.y },
        //   size: { w: config.width, h: config.height },
        //   rotation: config.rotation
        // })
      }

      // 同步zIndex属性
      if (changedProps.zIndex !== undefined) {
        ;(timelineItem.config as any).zIndex = changedProps.zIndex
      }

      // 同步opacity属性（使用新的事件系统）
      // 📝 现在 opacity 变化通过 propsChange 事件统一处理
      if (changedProps.opacity !== undefined && hasVisualProperties(timelineItem)) {
        // hasVisualProps 类型守卫确保了 config 具有视觉属性
        const config = timelineItem.config as VideoMediaConfig | ImageMediaConfig | TextMediaConfig
        config.opacity = changedProps.opacity
      }
    })
  }

  // ==================== 时间轴管理方法 ====================

  /**
   * 添加时间轴项目
   * @param timelineItem 要添加的时间轴项目
   */
  function addTimelineItem(timelineItem: UnifiedTimelineItemData<MediaType>) {
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
      unifiedDebugLog('添加加载中的时间轴项目', { timelineItemId: timelineItem.id })
    } else if (isReady(timelineItem) && isKnownTimelineItem(timelineItem)) {
      // 就绪的已知类型时间轴项目处理逻辑

      // 根据轨道的可见性和静音状态设置sprite属性
      if (trackModule && timelineItem.runtime.sprite) {
        const track = trackModule.tracks.value.find((t) => t.id === timelineItem.trackId)
        if (track) {
          // 设置可见性
          timelineItem.runtime.sprite.visible = track.isVisible

          // 为具有音频功能的片段设置静音状态
          if (
            timelineItem.runtime.sprite &&
            hasAudioCapabilities(timelineItem.runtime.sprite)
          ) {
            timelineItem.runtime.sprite.setTrackMuted(track.isMuted)
          }
        }
      }

      // 设置双向数据同步（仅就绪状态的已知类型时间轴项目）
      setupBidirectionalSync(timelineItem)

      // 初始化动画管理器（仅就绪状态的已知类型时间轴项目）
      globalWebAVAnimationManager.addManager(timelineItem)

      const mediaItem = mediaModule.getMediaItem(timelineItem.mediaItemId)
      unifiedDebugLog('添加素材到时间轴', {
        timelineItemId: timelineItem.id,
        mediaItemId: timelineItem.mediaItemId,
        mediaItemName: mediaItem?.name || '未知',
        trackId: timelineItem.trackId,
        mediaType: timelineItem.mediaType,
        position: timelineItem.timeRange.timelineStartTime / 1000000,
        spriteVisible: timelineItem.runtime.sprite?.visible,
      })
    } else {
      // 错误状态的时间轴项目
      unifiedDebugLog('添加错误状态的时间轴项目', { timelineItemId: timelineItem.id })
    }

    timelineItems.value.push(timelineItem)
  }

  /**
   * 移除时间轴项目
   * @param timelineItemId 要移除的时间轴项目ID
   */
  function removeTimelineItem(timelineItemId: string) {
    const index = timelineItems.value.findIndex(
      (item: UnifiedTimelineItemData<MediaType>) => item.id === timelineItemId,
    )
    if (index > -1) {
      const item = timelineItems.value[index]
      const mediaItem = mediaModule.getMediaItem(item.mediaItemId)


      // 🆕 增强的清理逻辑：无论状态如何，都检查并清理sprite
      if (item.runtime.sprite) {
        try {
          console.log(`🧹 开始清理时间轴项目sprite: ${timelineItemId}`)
          webavModule.removeSprite(item.runtime.sprite)
          console.log(`✅ 成功从WebAV画布移除sprite: ${timelineItemId}`)
        } catch (error) {
          console.warn(`⚠️ 从WebAV画布移除sprite时出错: ${timelineItemId}`, error)
        }
      }

      // 检查时间轴项目状态
      if (isLoading(item) || hasError(item)) {
        // 加载中或错误状态的时间轴项目不需要额外清理sprite相关资源
        // （已经在上面统一处理）
        unifiedDebugLog('移除非就绪状态的时间轴项目', {
          timelineItemId,
          status: item.timelineStatus,
        })
      } else if (isReady(item) && isKnownTimelineItem(item)) {
        // 就绪状态的已知类型时间轴项目清理逻辑

        // 注意：新的事件系统使用 on 方法返回的取消函数来清理监听器
        // 这里不需要手动清理，因为 sprite 销毁时会自动清理所有事件监听器

        // 🆕 双重保护：确保sprite已清理（虽然上面已经处理过了）
        if (item.runtime.sprite) {
          console.log(`🔍 双重检查：ready状态项目sprite清理: ${timelineItemId}`)
        }

        // 清理动画管理器（仅就绪状态的已知类型时间轴项目）
        globalWebAVAnimationManager.removeManager(timelineItemId)
      }

      // 从数组中移除
      timelineItems.value.splice(index, 1)

      unifiedDebugLog('从时间轴删除素材', {
        timelineItemId,
        mediaItemId: item.mediaItemId,
        mediaItemName: mediaItem?.name || '未知',
        trackId: item.trackId,
        position: item.timeRange.timelineStartTime / 30, // timelineStartTime 是帧数，除以30得到秒数
        status: item.timelineStatus,
        mediaType: item.mediaType,
      })
    }
  }

  /**
   * 获取时间轴项目
   * @param timelineItemId 时间轴项目ID
   * @returns 时间轴项目或undefined
   */
  function getTimelineItem(
    timelineItemId: string,
  ): UnifiedTimelineItemData<MediaType> | undefined {
    return timelineItems.value.find(
      (item: UnifiedTimelineItemData<MediaType>) => item.id === timelineItemId,
    )
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
      const oldPositionFrames = item.timeRange.timelineStartTime // 帧数
      const oldTrackId = item.trackId
      const mediaItem = mediaModule.getMediaItem(item.mediaItemId)

      // 确保新位置不为负数
      const clampedNewPositionFrames = Math.max(0, newPositionFrames)

      // 如果指定了新轨道，更新轨道ID
      if (newTrackId !== undefined) {
        item.trackId = newTrackId

        // 根据新轨道的可见性设置sprite的visible属性（仅就绪状态的已知类型时间轴项目）
        if (trackModule && isReady(item) && isKnownTimelineItem(item)) {
          const newTrack = trackModule.tracks.value.find((t) => t.id === newTrackId)
          if (newTrack && item.runtime.sprite) {
            item.runtime.sprite.visible = newTrack.isVisible
          }
        }
      }

      // 更新时间轴位置
      if (isLoading(item) || hasError(item)) {
        // 非就绪状态的时间轴项目：直接更新timeRange
        const currentTimeRange = item.timeRange
        const durationFrames = currentTimeRange.timelineEndTime - currentTimeRange.timelineStartTime

        item.timeRange = {
          ...item.timeRange,
          timelineStartTime: clampedNewPositionFrames,
          timelineEndTime: clampedNewPositionFrames + durationFrames,
        }
      } else if (isReady(item) && isKnownTimelineItem(item)) {
        // 就绪状态的已知类型时间轴项目：通过sprite更新
        const sprite = item.runtime.sprite
        if (sprite) {
          const currentTimeRange = sprite.getTimeRange()
          const durationFrames =
            currentTimeRange.timelineEndTime - currentTimeRange.timelineStartTime // 帧数

          // 使用同步函数更新timeRange（使用帧数）
          syncTimeRange(item, {
            timelineStartTime: clampedNewPositionFrames, // 帧数
            timelineEndTime: clampedNewPositionFrames + durationFrames, // 帧数
          })
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
        status: item.timelineStatus,
        mediaType: item.mediaType,
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
        if (item.runtime.sprite && typeof item.runtime.sprite.destroy === 'function') {
          item.runtime.sprite.destroy()
        }
      } catch (error) {
        console.warn('清理旧sprite资源时出错:', error)
      }

      // 更新sprite引用
      if (!item.runtime) {
        item.runtime = {}
      }
      item.runtime.sprite = newSprite

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
    if (!item || !item.runtime.sprite) return

    const sprite = item.runtime.sprite

    try {
      // 更新尺寸时使用中心缩放 - 仅对视觉媒体有效
      if (
        (transform.width !== undefined || transform.height !== undefined) &&
        hasVisualProperties(item) &&
        isKnownTimelineItem(item)
      ) {
        // 获取当前中心位置（项目坐标系）
        // hasVisualProperties 类型守卫确保了 config 具有视觉属性
        const config = item.config as VideoMediaConfig | ImageMediaConfig | TextMediaConfig
        const currentCenterX = config.x
        const currentCenterY = config.y
        const newWidth = transform.width !== undefined ? transform.width : config.width
        const newHeight = transform.height !== undefined ? transform.height : config.height

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
      if (
        (transform.x !== undefined || transform.y !== undefined) &&
        hasVisualProperties(item) &&
        isKnownTimelineItem(item)
      ) {
        // hasVisualProperties 类型守卫确保了 config 具有视觉属性
        const config = item.config as VideoMediaConfig | ImageMediaConfig | TextMediaConfig
        const newX = transform.x !== undefined ? transform.x : config.x
        const newY = transform.y !== undefined ? transform.y : config.y

        // 🔧 使用当前的尺寸（可能已经在上面更新过）
        const currentWidth = transform.width !== undefined ? transform.width : config.width
        const currentHeight = transform.height !== undefined ? transform.height : config.height

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
      if (
        transform.opacity !== undefined &&
        hasVisualProperties(item) &&
        isKnownTimelineItem(item)
      ) {
        sprite.opacity = transform.opacity
        // 🔧 手动同步opacity到timelineItem（因为opacity没有propsChange回调）
        // hasVisualProperties 类型守卫确保了 config 具有视觉属性
        const config = item.config as VideoMediaConfig | ImageMediaConfig | TextMediaConfig
        config.opacity = transform.opacity
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
    setupBidirectionalSync,
    getReadyTimelineItem,
    updateTimelineItemPosition,
    updateTimelineItemSprite,
    updateTimelineItemTransform,
  }
}

// 导出类型定义
export type UnifiedTimelineModule = ReturnType<typeof createUnifiedTimelineModule>

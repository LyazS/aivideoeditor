import { ref, type Raw, type Ref, markRaw } from 'vue'
import { VideoVisibleSprite } from '../../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../../utils/ImageVisibleSprite'
import { TextVisibleSprite } from '../../utils/TextVisibleSprite'
import { webavToProjectCoords, projectToWebavCoords } from '../../utils/coordinateTransform'
import { printDebugInfo } from '../utils/debugUtils'
import { syncTimeRange } from '../utils/timeRangeUtils'
import { microsecondsToFrames } from '../utils/timeUtils'
import { globalWebAVAnimationManager } from '../../utils/webavAnimationManager'
import type {
  TimelineItem,
  MediaItem,
  ExtendedPropsChangeEvent,
  VideoResolution,
  MediaType,
} from '../../types'
import { hasVisualProps } from '../../types'

/**
 * 时间轴核心管理模块
 * 负责时间轴项目的完整生命周期管理，包括CRUD操作、双向数据同步、变换属性更新
 */
export function createTimelineModule(
  configModule: { videoResolution: { value: VideoResolution } },
  webavModule: {
    avCanvas: { value: {
      removeSprite: (sprite: unknown) => void
      addSprite: (sprite: unknown) => void
    } | null }
  },
  mediaModule: {
    getMediaItem: (id: string) => MediaItem | undefined
    mediaItems: Ref<MediaItem[]>
  },
  trackModule?: {
    tracks: Ref<{ id: string; name: string; isVisible: boolean; isMuted: boolean }[]>
  },
) {
  // ==================== 状态定义 ====================

  const timelineItems = ref<TimelineItem[]>([])

  // ==================== 文本Sprite重建处理 ====================

  /**
   * 处理文本精灵重建
   * 当文本内容或样式发生变化时，重新创建TextVisibleSprite
   *
   * @param timelineItem 文本时间轴项目
   * @param textUpdate 文本更新信息
   */
  async function handleTextSpriteRecreation(
    timelineItem: TimelineItem,
    textUpdate: { text: string; style: any; needsRecreation: boolean }
  ) {
    if (timelineItem.mediaType !== 'text') {
      console.warn('⚠️ [timelineModule] 非文本项目不支持文本精灵重建')
      return
    }

    try {
      console.log('🔄 [timelineModule] 开始重建文本精灵:', {
        itemId: timelineItem.id,
        text: textUpdate.text.substring(0, 20) + '...',
        style: textUpdate.style
      })

      const oldSprite = timelineItem.sprite as any
      console.log('🔄 [timelineModule] 旧精灵信息:', {
        hasOldSprite: !!oldSprite,
        oldSpriteType: oldSprite?.constructor?.name
      })

      // 1. 创建新的文本精灵
      console.log('🔄 [timelineModule] 开始创建新的文本精灵')
      const newSprite = await TextVisibleSprite.create(textUpdate.text, textUpdate.style)
      console.log('✅ [timelineModule] 新文本精灵创建成功')

      // 2. 设置时间范围（参考视频图片的重建模式）
      if (typeof oldSprite.getTimeRange === 'function') {
        const timeRange = oldSprite.getTimeRange()
        newSprite.setTimelineStartTime(timeRange.timelineStartTime)
        newSprite.setDisplayDuration(timeRange.displayDuration)
      }

      // 3. 应用变换属性（参考视频图片的重建模式）
      if (hasVisualProps(timelineItem)) {
        const config = timelineItem.config

        // 获取新文本的原始尺寸
        const newTextMeta = await newSprite.getTextMeta()

        // 计算缩放比例（基于配置中存储的显示尺寸和原始尺寸）
        const scaleX = config.width > 0 ? config.width / (config.originalWidth || config.width) : 1
        const scaleY = config.height > 0 ? config.height / (config.originalHeight || config.height) : 1

        // 计算新的显示尺寸
        const newDisplayWidth = newTextMeta.width * scaleX
        const newDisplayHeight = newTextMeta.height * scaleY

        // 使用中心缩放：保持中心位置不变，重新计算WebAV坐标
        const { projectToWebavCoords } = await import('../../utils/coordinateTransform')
        const webavCoords = projectToWebavCoords(
          config.x, // 保持原有的中心位置（项目坐标系）
          config.y,
          newDisplayWidth,
          newDisplayHeight,
          configModule.videoResolution.value.width,
          configModule.videoResolution.value.height,
        )

        // 直接应用变换属性（参考视频图片的模式）
        newSprite.rect.x = webavCoords.x
        newSprite.rect.y = webavCoords.y
        newSprite.rect.w = newDisplayWidth
        newSprite.rect.h = newDisplayHeight
        newSprite.rect.angle = config.rotation || 0
        newSprite.setOpacityValue(config.opacity || 1)
        newSprite.zIndex = config.zIndex || 0

        console.log('🎯 [timelineModule] 文本sprite重建完成:', {
          centerPosition: { x: config.x, y: config.y },
          originalSize: { width: config.originalWidth || config.width, height: config.originalHeight || config.height },
          displaySize: { width: config.width, height: config.height },
          scaleRatio: { x: scaleX, y: scaleY },
          newOriginalSize: newTextMeta,
          newDisplaySize: { w: newDisplayWidth, h: newDisplayHeight },
          newWebAVPosition: { x: webavCoords.x, y: webavCoords.y }
        })
      }

      // 4. 从WebAV画布移除旧精灵
      if (webavModule.avCanvas.value && oldSprite) {
        webavModule.avCanvas.value.removeSprite(oldSprite)
      }

      // 5. 更新时间轴项目的精灵引用
      timelineItem.sprite = markRaw(newSprite)

      // 6. 重新设置双向数据同步
      setupBidirectionalSync(timelineItem)

      // 7. 添加新精灵到WebAV画布
      if (webavModule.avCanvas.value) {
        webavModule.avCanvas.value.addSprite(newSprite)
      }

      // 8. 更新配置（获取新的尺寸等）
      if (typeof newSprite.getTextMeta === 'function') {
        const textMeta = await newSprite.getTextMeta()
        if (hasVisualProps(timelineItem)) {
          timelineItem.config.width = textMeta.width
          timelineItem.config.height = textMeta.height
        }
      }

      console.log('✅ [timelineModule] 文本精灵重建完成')

    } catch (error) {
      console.error('❌ [timelineModule] 文本精灵重建失败:', error)
    }
  }

  // ==================== 双向数据同步函数 ====================

  /**
   * 为TimelineItem设置双向数据同步（类型安全版本）
   *
   * 📝 数据流向说明：
   * 本系统采用分层数据流向策略：
   *
   * 【动画属性】- 遵循标准数据流向 UI → WebAV → TimelineItem → UI：
   * - x, y, width, height, rotation, zIndex
   * - 这些属性WebAV支持propsChange事件，可以自动同步
   *
   * 【非动画属性】- 直接修改config（技术限制导致的必要妥协）：
   * - opacity: 通过自定义回调实现类似数据流向
   * - volume, isMuted: WebAV不支持相关事件，只能直接修改config
   *
   * @param timelineItem TimelineItem实例
   */
  function setupBidirectionalSync<T extends MediaType>(timelineItem: TimelineItem<T>) {
    const sprite = timelineItem.sprite

    // 直接使用WebAV原生的propsChange事件监听器
    // 设置VisibleSprite → TimelineItem 的同步（仅适用于动画属性）
    sprite.on('propsChange', (changedProps: ExtendedPropsChangeEvent) => {
      console.log('📡 [timelineModule] 收到propsChange事件:', {
        itemId: timelineItem.id,
        mediaType: timelineItem.mediaType,
        changedProps,
        hasTextUpdate: !!(changedProps as any).textUpdate
      })

      // 处理文本更新事件（需要重建sprite）
      if ((changedProps as any).textUpdate?.needsRecreation && timelineItem.mediaType === 'text') {
        console.log('🔄 [timelineModule] 检测到文本更新事件，开始重建精灵')
        handleTextSpriteRecreation(timelineItem, (changedProps as any).textUpdate)
        return
      }

      if (changedProps.rect && hasVisualProps(timelineItem)) {
        const rect = changedProps.rect

        // 更新位置（坐标系转换）
        // 如果rect.x/rect.y为undefined，说明位置没有变化，使用sprite的当前值
        const currentRect = sprite.rect
        const projectCoords = webavToProjectCoords(
          rect.x !== undefined ? rect.x : currentRect.x,
          rect.y !== undefined ? rect.y : currentRect.y,
          rect.w !== undefined ? rect.w : timelineItem.config.width,
          rect.h !== undefined ? rect.h : timelineItem.config.height,
          configModule.videoResolution.value.width,
          configModule.videoResolution.value.height,
        )
        timelineItem.config.x = Math.round(projectCoords.x)
        timelineItem.config.y = Math.round(projectCoords.y)

        // 更新尺寸
        if (rect.w !== undefined) timelineItem.config.width = rect.w
        if (rect.h !== undefined) timelineItem.config.height = rect.h

        // 更新旋转角度
        if (rect.angle !== undefined) timelineItem.config.rotation = rect.angle

        // console.log('🔄 VisibleSprite → TimelineItem 同步:', {
        //   webavCoords: { x: rect.x, y: rect.y },
        //   projectCoords: { x: timelineItem.config.x, y: timelineItem.config.y },
        //   size: { w: timelineItem.config.width, h: timelineItem.config.height },
        //   rotation: timelineItem.config.rotation
        // })
      }

      // 同步zIndex属性
      if (changedProps.zIndex !== undefined) {
        timelineItem.config.zIndex = changedProps.zIndex
      }

      // 同步opacity属性（使用新的事件系统）
      // 📝 现在 opacity 变化通过 propsChange 事件统一处理
      if (changedProps.opacity !== undefined && hasVisualProps(timelineItem)) {
        timelineItem.config.opacity = changedProps.opacity
      }
    })
  }

  // ==================== 时间轴管理方法 ====================

  /**
   * 添加时间轴项目
   * @param timelineItem 要添加的时间轴项目
   */
  function addTimelineItem(timelineItem: TimelineItem) {
    // 如果没有指定轨道，默认分配到第一个轨道
    if (!timelineItem.trackId && trackModule) {
      const firstTrack = trackModule.tracks.value[0]
      if (firstTrack) {
        timelineItem.trackId = firstTrack.id
      }
    }

    // 根据轨道的可见性和静音状态设置sprite属性
    if (trackModule) {
      const track = trackModule.tracks.value.find((t) => t.id === timelineItem.trackId)
      if (track && timelineItem.sprite) {
        // 设置可见性
        timelineItem.sprite.visible = track.isVisible

        // 为视频片段设置轨道静音检查函数
        if (timelineItem.mediaType === 'video' && 'setTrackMuteChecker' in timelineItem.sprite) {
          const sprite = timelineItem.sprite as VideoVisibleSprite // VideoVisibleSprite
          sprite.setTrackMuteChecker(() => track.isMuted)
        }
      }
    }

    // 设置双向数据同步
    setupBidirectionalSync(timelineItem)

    // 初始化动画管理器
    globalWebAVAnimationManager.addManager(timelineItem)

    timelineItems.value.push(timelineItem)

    const mediaItem = mediaModule.getMediaItem(timelineItem.mediaItemId)
    printDebugInfo(
      '添加素材到时间轴',
      {
        timelineItemId: timelineItem.id,
        mediaItemId: timelineItem.mediaItemId,
        mediaItemName: mediaItem?.name || '未知',
        trackId: timelineItem.trackId,
        position: timelineItem.timeRange.timelineStartTime / 1000000,
        spriteVisible: timelineItem.sprite?.visible,
      },
      mediaModule.mediaItems.value,
      timelineItems.value,
      trackModule?.tracks.value || [],
    )
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

      // 注意：新的事件系统使用 on 方法返回的取消函数来清理监听器
      // 这里不需要手动清理，因为 sprite 销毁时会自动清理所有事件监听器

      // 清理sprite资源
      try {
        if (item.sprite && typeof item.sprite.destroy === 'function') {
          item.sprite.destroy()
        }
      } catch (error) {
        console.warn('清理sprite资源时出错:', error)
      }

      // 从WebAV画布移除
      try {
        const canvas = webavModule.avCanvas.value
        if (canvas) {
          canvas.removeSprite(item.sprite)
        }
      } catch (error) {
        console.warn('从WebAV画布移除sprite时出错:', error)
      }

      // 清理动画管理器
      globalWebAVAnimationManager.removeManager(timelineItemId)

      // 从数组中移除
      timelineItems.value.splice(index, 1)

      printDebugInfo(
        '从时间轴删除素材',
        {
          timelineItemId,
          mediaItemId: item.mediaItemId,
          mediaItemName: mediaItem?.name || '未知',
          trackId: item.trackId,
          position: item.timeRange.timelineStartTime / 30, // timelineStartTime 是帧数，除以30得到秒数
        },
        mediaModule.mediaItems.value,
        timelineItems.value,
        trackModule?.tracks.value || [],
      )
    }
  }

  /**
   * 获取时间轴项目
   * @param timelineItemId 时间轴项目ID
   * @returns 时间轴项目或undefined
   */
  function getTimelineItem(timelineItemId: string): TimelineItem | undefined {
    return timelineItems.value.find((item) => item.id === timelineItemId)
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
    const item = timelineItems.value.find((item) => item.id === timelineItemId)
    if (item) {
      const oldPositionFrames = item.timeRange.timelineStartTime // 帧数
      const oldTrackId = item.trackId
      const mediaItem = mediaModule.getMediaItem(item.mediaItemId)

      // 确保新位置不为负数
      const clampedNewPositionFrames = Math.max(0, newPositionFrames)

      // 如果指定了新轨道，更新轨道ID并同步可见性
      if (newTrackId !== undefined) {
        item.trackId = newTrackId

        // 根据新轨道的可见性设置sprite的visible属性
        if (trackModule) {
          const newTrack = trackModule.tracks.value.find((t) => t.id === newTrackId)
          if (newTrack && item.sprite) {
            item.sprite.visible = newTrack.isVisible
          }
        }
      }

      // 更新时间轴位置
      const sprite = item.sprite
      const currentTimeRange = sprite.getTimeRange()
      const durationFrames = currentTimeRange.timelineEndTime - currentTimeRange.timelineStartTime // 帧数

      // 使用同步函数更新timeRange（使用帧数）
      syncTimeRange(item, {
        timelineStartTime: clampedNewPositionFrames, // 帧数
        timelineEndTime: clampedNewPositionFrames + durationFrames, // 帧数
      })

      printDebugInfo(
        '更新时间轴项目位置',
        {
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
        },
        mediaModule.mediaItems.value,
        timelineItems.value,
        trackModule?.tracks.value || [],
      )
    }
  }

  /**
   * 更新时间轴项目的sprite
   * @param timelineItemId 时间轴项目ID
   * @param newSprite 新的sprite实例
   */
  function updateTimelineItemSprite(
    timelineItemId: string,
    newSprite: Raw<VideoVisibleSprite | ImageVisibleSprite>,
  ) {
    const item = timelineItems.value.find((item) => item.id === timelineItemId)
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

      printDebugInfo(
        '更新时间轴项目sprite',
        {
          timelineItemId,
          mediaItemName: mediaItem?.name || '未知',
          trackId: item.trackId,
          position: microsecondsToFrames(item.timeRange.timelineStartTime),
        },
        mediaModule.mediaItems.value,
        timelineItems.value,
        trackModule?.tracks.value || [],
      )
    }
  }

  // ==================== 属性面板更新方法 ====================

  /**
   * 更新TimelineItem的VisibleSprite变换属性
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
    const item = timelineItems.value.find((item) => item.id === timelineItemId)
    if (!item) return

    const sprite = item.sprite

    try {
      // 更新尺寸时使用中心缩放 - 仅对视觉媒体有效
      if (
        (transform.width !== undefined || transform.height !== undefined) &&
        hasVisualProps(item)
      ) {
        // 获取当前中心位置（项目坐标系）
        const currentCenterX = item.config.x
        const currentCenterY = item.config.y
        const newWidth = transform.width !== undefined ? transform.width : item.config.width
        const newHeight = transform.height !== undefined ? transform.height : item.config.height

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
        const newX = transform.x !== undefined ? transform.x : item.config.x
        const newY = transform.y !== undefined ? transform.y : item.config.y

        // 🔧 使用当前的尺寸（可能已经在上面更新过）
        const currentWidth = transform.width !== undefined ? transform.width : item.config.width
        const currentHeight = transform.height !== undefined ? transform.height : item.config.height

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
        // 🔧 手动同步opacity到timelineItem（因为opacity没有propsChange回调）
        item.config.opacity = transform.opacity
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
    setupBidirectionalSync,
    addTimelineItem,
    removeTimelineItem,
    getTimelineItem,
    updateTimelineItemPosition,
    updateTimelineItemSprite,
    updateTimelineItemTransform,
  }
}

// 导出类型定义
export type TimelineModule = ReturnType<typeof createTimelineModule>

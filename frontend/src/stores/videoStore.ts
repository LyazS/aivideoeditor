import { ref, computed, markRaw, reactive, type Raw } from 'vue'
import { defineStore } from 'pinia'
import { AVCanvas } from '@webav/av-canvas'
import { CustomVisibleSprite } from '../utils/customVisibleSprite'
import { useWebAVControls } from '../composables/useWebAVControls'
import { webavToProjectCoords, projectToWebavCoords } from '../utils/coordinateTransform'
import {
  printDebugInfo,
  alignTimeToFrame,
  timeToPixel,
  pixelToTime,
  expandTimelineIfNeeded,
  getTimelineItemAtTime,
  autoArrangeTimelineItems,
  getMaxZoomLevel,
  getMinZoomLevel,
  getMaxScrollOffset,
  calculateContentEndTime,
  calculateTotalDuration,
  calculateMaxVisibleDuration,
  syncTimeRange,
  findTimelineItemBySprite,
  getTimelineItemsByTrack
} from './utils/storeUtils'
import { createMediaModule } from './modules/mediaModule'
import { createConfigModule } from './modules/configModule'
import { createTrackModule } from './modules/trackModule'
import { createPlaybackModule } from './modules/playbackModule'
import { createWebAVModule } from './modules/webavModule'
import { createViewportModule } from './modules/viewportModule'
import { createSelectionModule } from './modules/selectionModule'
import type {
  PropsChangeEvent,
  MediaItem,
  TimelineItem,
  VideoResolution,
  Track
} from '../types/videoTypes'

export const useVideoStore = defineStore('video', () => {
  // 创建媒体管理模块
  const mediaModule = createMediaModule()

  // 创建配置管理模块
  const configModule = createConfigModule()

  // 创建轨道管理模块
  const trackModule = createTrackModule()

  // 创建播放控制模块
  const playbackModule = createPlaybackModule(configModule.frameRate)

  // 创建WebAV集成模块
  const webavModule = createWebAVModule()

  // 新的两层数据结构
  const timelineItems = ref<TimelineItem[]>([]) // 时间轴





  const totalDuration = computed(() => {
    return calculateTotalDuration(timelineItems.value, configModule.timelineDuration.value)
  })

  // 创建视口管理模块（需要在totalDuration之后创建）
  const viewportModule = createViewportModule(timelineItems, totalDuration, configModule.timelineDuration)

  // 创建选择管理模块（需要在webavModule之后创建）
  const selectionModule = createSelectionModule(timelineItems, webavModule.avCanvas)




  // ==================== 双向数据同步函数 ====================





  /**
   * 为TimelineItem设置双向数据同步
   * @param timelineItem TimelineItem实例
   */
  function setupBidirectionalSync(timelineItem: TimelineItem) {
    const sprite = timelineItem.sprite

    // 直接使用WebAV原生的propsChange事件监听器
    // 设置VisibleSprite → TimelineItem 的同步
    sprite.on('propsChange', (changedProps: PropsChangeEvent) => {
      if (changedProps.rect) {
        const rect = changedProps.rect

        // 更新位置（坐标系转换）
        // 如果rect.x/rect.y为undefined，说明位置没有变化，使用sprite的当前值
        const currentRect = sprite.rect
        const projectCoords = webavToProjectCoords(
          rect.x !== undefined ? rect.x : currentRect.x,
          rect.y !== undefined ? rect.y : currentRect.y,
          rect.w !== undefined ? rect.w : timelineItem.size.width,
          rect.h !== undefined ? rect.h : timelineItem.size.height,
          configModule.videoResolution.value.width,
          configModule.videoResolution.value.height
        )
        timelineItem.position.x = Math.round(projectCoords.x)
        timelineItem.position.y = Math.round(projectCoords.y)

        // 更新尺寸
        if (rect.w !== undefined) timelineItem.size.width = rect.w
        if (rect.h !== undefined) timelineItem.size.height = rect.h

        // 更新旋转角度
        if (rect.angle !== undefined) timelineItem.rotation = rect.angle

        console.log('🔄 VisibleSprite → TimelineItem 同步:', {
          webavCoords: { x: rect.x, y: rect.y },
          projectCoords: { x: timelineItem.position.x, y: timelineItem.position.y },
          size: { w: timelineItem.size.width, h: timelineItem.size.height },
          rotation: timelineItem.rotation
        })
      }

      // 同步zIndex属性（propsChange事件包含此属性）
      if (changedProps.zIndex !== undefined) {
        timelineItem.zIndex = changedProps.zIndex
        console.log('🔄 VisibleSprite → TimelineItem 同步 zIndex:', changedProps.zIndex)
      }

      // 注意：opacity属性没有propsChange回调，需要在直接设置sprite.opacity的地方手动同步
    })
  }



  // ==================== 素材管理方法 ====================
  // 使用媒体模块的方法，但需要包装以提供额外的依赖
  function addMediaItem(mediaItem: MediaItem) {
    mediaModule.addMediaItem(mediaItem, timelineItems, trackModule.tracks)
  }

  function removeMediaItem(mediaItemId: string) {
    mediaModule.removeMediaItem(
      mediaItemId,
      timelineItems,
      trackModule.tracks,
      webavModule.avCanvas.value,
      () => {} // 清理回调，目前为空
    )
  }

  function getMediaItem(mediaItemId: string): MediaItem | undefined {
    return mediaModule.getMediaItem(mediaItemId)
  }

  // ==================== 时间轴管理方法 ====================
  function addTimelineItem(timelineItem: TimelineItem) {
    // 如果没有指定轨道，默认分配到第一个轨道
    if (!timelineItem.trackId) {
      timelineItem.trackId = 1
    }

    // 设置双向数据同步
    setupBidirectionalSync(timelineItem)

    timelineItems.value.push(timelineItem)

    const mediaItem = getMediaItem(timelineItem.mediaItemId)
    printDebugInfo('添加素材到时间轴', {
      timelineItemId: timelineItem.id,
      mediaItemId: timelineItem.mediaItemId,
      mediaItemName: mediaItem?.name || '未知',
      trackId: timelineItem.trackId,
      position: timelineItem.timeRange.timelineStartTime / 1000000
    }, mediaModule.mediaItems, timelineItems, trackModule.tracks)
  }

  function removeTimelineItem(timelineItemId: string) {
    const index = timelineItems.value.findIndex((item) => item.id === timelineItemId)
    if (index > -1) {
      const item = timelineItems.value[index]
      const mediaItem = getMediaItem(item.mediaItemId)

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

      // 从数组中移除
      timelineItems.value.splice(index, 1)

      printDebugInfo('从时间轴删除素材', {
        timelineItemId,
        mediaItemId: item.mediaItemId,
        mediaItemName: mediaItem?.name || '未知',
        trackId: item.trackId,
        position: item.timeRange.timelineStartTime / 1000000
      }, mediaModule.mediaItems, timelineItems, trackModule.tracks)
    }
  }

  function getTimelineItem(timelineItemId: string): TimelineItem | undefined {
    return timelineItems.value.find(item => item.id === timelineItemId)
  }



  // ==================== 素材名称管理 ====================
  function updateMediaItemName(mediaItemId: string, newName: string) {
    mediaModule.updateMediaItemName(mediaItemId, newName)
  }

  function updateTimelineItemPosition(timelineItemId: string, newPosition: number, newTrackId?: number) {
    const item = timelineItems.value.find((item) => item.id === timelineItemId)
    if (item) {
      const oldPosition = item.timeRange.timelineStartTime / 1000000
      const oldTrackId = item.trackId
      const mediaItem = getMediaItem(item.mediaItemId)

      // 如果指定了新轨道，更新轨道ID
      if (newTrackId !== undefined) {
        item.trackId = newTrackId
      }

      // 更新时间轴位置
      const sprite = item.sprite
      const currentTimeRange = sprite.getTimeRange()
      const duration = currentTimeRange.timelineEndTime - currentTimeRange.timelineStartTime

      // 使用同步函数更新timeRange
      syncTimeRange(item, {
        timelineStartTime: newPosition * 1000000, // 转换为微秒
        timelineEndTime: newPosition * 1000000 + duration
      })

      printDebugInfo('更新时间轴项目位置', {
        timelineItemId,
        mediaItemName: mediaItem?.name || '未知',
        oldPosition,
        newPosition,
        oldTrackId,
        newTrackId: item.trackId,
        positionChanged: oldPosition !== newPosition,
        trackChanged: oldTrackId !== item.trackId
      }, mediaModule.mediaItems, timelineItems, trackModule.tracks)
    }
  }

  function updateTimelineItemSprite(timelineItemId: string, newSprite: Raw<CustomVisibleSprite>) {
    const item = timelineItems.value.find((item) => item.id === timelineItemId)
    if (item) {
      const mediaItem = getMediaItem(item.mediaItemId)

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

      printDebugInfo('更新时间轴项目sprite', {
        timelineItemId,
        mediaItemName: mediaItem?.name || '未知',
        trackId: item.trackId,
        position: item.timeRange.timelineStartTime / 1000000
      }, mediaModule.mediaItems, timelineItems, trackModule.tracks)
    }
  }



  async function duplicateTimelineItem(timelineItemId: string): Promise<string | null> {
    console.group('📋 时间轴项目复制调试')

    const originalItem = timelineItems.value.find((item) => item.id === timelineItemId)
    if (!originalItem) {
      console.error('❌ 找不到要复制的时间轴项目:', timelineItemId)
      console.groupEnd()
      return null
    }

    const sprite = originalItem.sprite
    const timeRange = sprite.getTimeRange()
    const mediaItem = getMediaItem(originalItem.mediaItemId)

    if (!mediaItem) {
      console.error('❌ 找不到对应的素材项目')
      console.groupEnd()
      return null
    }

    console.log(`📋 复制时间轴项目: ${mediaItem.name} (ID: ${timelineItemId})`)

    try {
      // 克隆MP4Clip
      const webAVControls = useWebAVControls()
      const clonedClip = await webAVControls.cloneMP4Clip(mediaItem.mp4Clip)

      // 创建新的CustomVisibleSprite
      const newSprite = new CustomVisibleSprite(clonedClip)

      // 复制时间范围设置
      newSprite.setTimeRange({
        clipStartTime: timeRange.clipStartTime,
        clipEndTime: timeRange.clipEndTime,
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: timeRange.timelineEndTime
      })

      // 复制原始sprite的变换属性
      const originalRect = sprite.rect
      newSprite.rect.x = originalRect.x
      newSprite.rect.y = originalRect.y
      newSprite.rect.w = originalRect.w
      newSprite.rect.h = originalRect.h
      newSprite.rect.angle = originalRect.angle // 复制旋转角度
      newSprite.zIndex = sprite.zIndex
      newSprite.opacity = sprite.opacity

      console.log(`📋 复制原始sprite属性:`, {
        position: { x: originalRect.x, y: originalRect.y },
        size: { w: originalRect.w, h: originalRect.h },
        rotation: originalRect.angle,
        zIndex: sprite.zIndex,
        opacity: sprite.opacity
      })

      // 添加到WebAV画布
      const canvas = webavModule.avCanvas.value
      if (canvas) {
        canvas.addSprite(newSprite)
      }

      // 创建新的TimelineItem，放置在原项目的右侧
      const duration = (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000 // 转换为秒
      const newTimelinePosition = timeRange.timelineStartTime / 1000000 + duration // 紧接着原项目

      const newItem: TimelineItem = reactive({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        mediaItemId: originalItem.mediaItemId,
        trackId: originalItem.trackId,
        timeRange: newSprite.getTimeRange(), // 从sprite获取完整的timeRange（包含自动计算的effectiveDuration）
        sprite: markRaw(newSprite),
        // 复制原始项目的sprite属性
        position: {
          x: originalItem.position.x,
          y: originalItem.position.y
        },
        size: {
          width: originalItem.size.width,
          height: originalItem.size.height
        },
        rotation: originalItem.rotation,
        zIndex: originalItem.zIndex,
        opacity: originalItem.opacity
      })

      // 更新新sprite的时间轴位置
      newSprite.setTimeRange({
        clipStartTime: timeRange.clipStartTime,
        clipEndTime: timeRange.clipEndTime,
        timelineStartTime: newTimelinePosition * 1000000,
        timelineEndTime: (newTimelinePosition + duration) * 1000000
      })

      // 添加到时间轴
      timelineItems.value.push(newItem)

      // 🔄 为新创建的TimelineItem设置双向数据同步
      setupBidirectionalSync(newItem)

      console.log('✅ 复制完成')
      console.groupEnd()

      // 打印复制后的调试信息
      printDebugInfo('复制时间轴项目', {
        originalItemId: timelineItemId,
        newItemId: newItem.id,
        mediaItemId: originalItem.mediaItemId,
        mediaItemName: mediaItem?.name || '未知',
        trackId: originalItem.trackId,
        newPosition: newTimelinePosition
      }, mediaModule.mediaItems, timelineItems, trackModule.tracks)

      // 选中新创建的项目
      selectionModule.selectTimelineItem(newItem.id)

      return newItem.id
    } catch (error) {
      console.error('❌ 复制过程中出错:', error)
      console.groupEnd()
      return null
    }
  }

  async function splitTimelineItemAtTime(timelineItemId: string, splitTime: number) {
    console.group('🔪 时间轴项目分割调试')

    const itemIndex = timelineItems.value.findIndex((item) => item.id === timelineItemId)
    if (itemIndex === -1) {
      console.error('❌ 找不到要分割的时间轴项目:', timelineItemId)
      console.groupEnd()
      return
    }

    const originalItem = timelineItems.value[itemIndex]
    const sprite = originalItem.sprite
    const timeRange = sprite.getTimeRange()
    const mediaItem = getMediaItem(originalItem.mediaItemId)

    if (!mediaItem) {
      console.error('❌ 找不到对应的素材项目')
      console.groupEnd()
      return
    }

    const timelineStartTime = timeRange.timelineStartTime / 1000000 // 转换为秒
    const timelineEndTime = timeRange.timelineEndTime / 1000000 // 转换为秒

    console.log('📹 原始时间轴项目信息:')
    console.log('  - 时间轴开始:', timelineStartTime)
    console.log('  - 时间轴结束:', timelineEndTime)
    console.log('  - 分割时间:', splitTime)

    // 检查分割时间是否在项目范围内
    if (splitTime <= timelineStartTime || splitTime >= timelineEndTime) {
      console.error('❌ 分割时间不在项目范围内')
      console.groupEnd()
      return
    }

    // 计算分割点在素材中的相对位置
    const timelineDuration = timelineEndTime - timelineStartTime
    const relativeTimelineTime = splitTime - timelineStartTime
    const relativeRatio = relativeTimelineTime / timelineDuration

    const clipStartTime = timeRange.clipStartTime / 1000000 // 转换为秒
    const clipEndTime = timeRange.clipEndTime / 1000000 // 转换为秒
    const clipDuration = clipEndTime - clipStartTime
    const splitClipTime = clipStartTime + (clipDuration * relativeRatio)

    console.log('🎬 素材时间计算:')
    console.log('  - 素材开始时间:', clipStartTime)
    console.log('  - 素材结束时间:', clipEndTime)
    console.log('  - 分割点素材时间:', splitClipTime)

    try {
      // 为每个分割片段克隆MP4Clip
      const webAVControls = useWebAVControls()
      const firstClonedClip = await webAVControls.cloneMP4Clip(mediaItem.mp4Clip)
      const secondClonedClip = await webAVControls.cloneMP4Clip(mediaItem.mp4Clip)

      // 创建第一个片段的CustomVisibleSprite
      const firstSprite = new CustomVisibleSprite(firstClonedClip)
      firstSprite.setTimeRange({
        clipStartTime: clipStartTime * 1000000,
        clipEndTime: splitClipTime * 1000000,
        timelineStartTime: timelineStartTime * 1000000,
        timelineEndTime: splitTime * 1000000
      })

      // 复制原始sprite的变换属性到第一个片段
      const originalRect = sprite.rect
      firstSprite.rect.x = originalRect.x
      firstSprite.rect.y = originalRect.y
      firstSprite.rect.w = originalRect.w
      firstSprite.rect.h = originalRect.h
      firstSprite.rect.angle = originalRect.angle // 复制旋转角度
      firstSprite.zIndex = sprite.zIndex
      firstSprite.opacity = sprite.opacity

      console.log(`📋 复制原始sprite属性到第一个片段:`, {
        position: { x: originalRect.x, y: originalRect.y },
        size: { w: originalRect.w, h: originalRect.h },
        rotation: originalRect.angle,
        zIndex: sprite.zIndex,
        opacity: sprite.opacity
      })

      // 创建第二个片段的CustomVisibleSprite
      const secondSprite = new CustomVisibleSprite(secondClonedClip)
      secondSprite.setTimeRange({
        clipStartTime: splitClipTime * 1000000,
        clipEndTime: clipEndTime * 1000000,
        timelineStartTime: splitTime * 1000000,
        timelineEndTime: timelineEndTime * 1000000
      })

      // 复制原始sprite的变换属性到第二个片段
      secondSprite.rect.x = originalRect.x
      secondSprite.rect.y = originalRect.y
      secondSprite.rect.w = originalRect.w
      secondSprite.rect.h = originalRect.h
      secondSprite.rect.angle = originalRect.angle // 复制旋转角度
      secondSprite.zIndex = sprite.zIndex
      secondSprite.opacity = sprite.opacity

      console.log(`📋 复制原始sprite属性到第二个片段:`, {
        position: { x: originalRect.x, y: originalRect.y },
        size: { w: originalRect.w, h: originalRect.h },
        rotation: originalRect.angle,
        zIndex: sprite.zIndex,
        opacity: sprite.opacity
      })

      // 添加到WebAV画布
      const canvas = webavModule.avCanvas.value
      if (canvas) {
        canvas.addSprite(firstSprite)
        canvas.addSprite(secondSprite)
      }

      // 创建新的TimelineItem
      const firstItem: TimelineItem = reactive({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        mediaItemId: originalItem.mediaItemId,
        trackId: originalItem.trackId,
        timeRange: firstSprite.getTimeRange(), // 从sprite获取完整的timeRange
        sprite: markRaw(firstSprite),
        // 复制原始项目的sprite属性
        position: {
          x: originalItem.position.x,
          y: originalItem.position.y
        },
        size: {
          width: originalItem.size.width,
          height: originalItem.size.height
        },
        rotation: originalItem.rotation,
        zIndex: originalItem.zIndex,
        opacity: originalItem.opacity
      })

      const secondItem: TimelineItem = reactive({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        mediaItemId: originalItem.mediaItemId,
        trackId: originalItem.trackId,
        timeRange: secondSprite.getTimeRange(), // 从sprite获取完整的timeRange
        sprite: markRaw(secondSprite),
        // 复制原始项目的sprite属性
        position: {
          x: originalItem.position.x,
          y: originalItem.position.y
        },
        size: {
          width: originalItem.size.width,
          height: originalItem.size.height
        },
        rotation: originalItem.rotation,
        zIndex: originalItem.zIndex,
        opacity: originalItem.opacity
      })

      // 从WebAV画布移除原始sprite
      if (canvas) {
        canvas.removeSprite(sprite)
      }

      // 替换原项目为两个新项目
      timelineItems.value.splice(itemIndex, 1, firstItem, secondItem)

      // 🔄 为新创建的两个TimelineItem设置双向数据同步
      setupBidirectionalSync(firstItem)
      setupBidirectionalSync(secondItem)

      console.log('✅ 分割完成')
      console.groupEnd()

      // 打印分割后的调试信息
      printDebugInfo('分割时间轴项目', {
        originalItemId: timelineItemId,
        splitTime,
        firstItemId: firstItem.id,
        secondItemId: secondItem.id,
        mediaItemId: originalItem.mediaItemId,
        mediaItemName: mediaItem?.name || '未知',
        trackId: originalItem.trackId
      }, mediaModule.mediaItems, timelineItems, trackModule.tracks)

      // 清除选中状态
      selectionModule.clearAllSelections()
    } catch (error) {
      console.error('❌ 分割过程中出错:', error)
      console.groupEnd()
    }
  }



























  // 更新时间轴项目播放速度
  function updateTimelineItemPlaybackRate(timelineItemId: string, newRate: number) {
    const item = timelineItems.value.find((item) => item.id === timelineItemId)
    if (item) {
      // 确保播放速度在合理范围内（扩展到0.1-100倍）
      const clampedRate = Math.max(0.1, Math.min(100, newRate))

      // 更新sprite的播放速度（这会自动更新sprite内部的timeRange）
      item.sprite.setPlaybackSpeed(clampedRate)

      // 使用同步函数更新TimelineItem的timeRange
      syncTimeRange(item)

      console.log('🎬 播放速度更新:', {
        timelineItemId,
        newRate: clampedRate,
        timeRange: {
          clipDuration: (item.timeRange.clipEndTime - item.timeRange.clipStartTime) / 1000000,
          timelineDuration: (item.timeRange.timelineEndTime - item.timeRange.timelineStartTime) / 1000000,
          effectiveDuration: item.timeRange.effectiveDuration / 1000000
        }
      })
    }
  }

  // ==================== 属性面板更新方法 ====================

  /**
   * 更新TimelineItem的VisibleSprite变换属性
   * 这会触发propsChange事件，自动同步到TimelineItem，然后更新属性面板显示
   */
  function updateTimelineItemTransform(timelineItemId: string, transform: {
    position?: { x: number; y: number }
    size?: { width: number; height: number }
    rotation?: number
    opacity?: number
    zIndex?: number
  }) {
    const item = timelineItems.value.find((item) => item.id === timelineItemId)
    if (!item) return

    const sprite = item.sprite

    try {
      // 更新尺寸时使用中心缩放
      if (transform.size) {
        // 获取当前中心位置（项目坐标系）
        const currentCenterX = item.position.x
        const currentCenterY = item.position.y
        const newWidth = transform.size.width
        const newHeight = transform.size.height

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
          configModule.videoResolution.value.height
        )
        sprite.rect.x = webavCoords.x
        sprite.rect.y = webavCoords.y

        console.log('🎯 中心缩放:', {
          newSize: { width: newWidth, height: newHeight },
          centerPosition: { x: currentCenterX, y: currentCenterY },
          webavCoords: { x: webavCoords.x, y: webavCoords.y }
        })
      }

      // 更新位置（需要坐标系转换）
      if (transform.position) {
        const webavCoords = projectToWebavCoords(
          transform.position.x,
          transform.position.y,
          item.size.width,
          item.size.height,
          configModule.videoResolution.value.width,
          configModule.videoResolution.value.height
        )
        sprite.rect.x = webavCoords.x
        sprite.rect.y = webavCoords.y
      }

      // 更新其他属性
      if (transform.opacity !== undefined) {
        sprite.opacity = transform.opacity
        // 🔧 手动同步opacity到timelineItem（因为opacity没有propsChange回调）
        item.opacity = transform.opacity
      }
      if (transform.zIndex !== undefined) {
        sprite.zIndex = transform.zIndex
        // zIndex有propsChange回调，会自动同步到timelineItem
      }
      // 更新旋转角度（WebAV的rect.angle支持旋转）
      if (transform.rotation !== undefined) {
        sprite.rect.angle = transform.rotation
      }

      console.log('✅ 属性面板 → VisibleSprite 更新完成:', {
        timelineItemId,
        transform,
        webavRect: { x: sprite.rect.x, y: sprite.rect.y, w: sprite.rect.w, h: sprite.rect.h, angle: sprite.rect.angle }
      })
    } catch (error) {
      console.error('更新VisibleSprite变换属性失败:', error)
    }
  }

  // ==================== 视频元素管理方法 ====================
  // 使用媒体模块的视频元素管理方法
  function setVideoElement(clipId: string, videoElement: HTMLVideoElement | null) {
    mediaModule.setVideoElement(clipId, videoElement)
  }

  function getVideoOriginalResolution(clipId: string): { width: number; height: number } {
    return mediaModule.getVideoOriginalResolution(clipId)
  }

  return {
    // 新的两层数据结构
    mediaItems: mediaModule.mediaItems,
    timelineItems,
    tracks: trackModule.tracks,
    currentTime: playbackModule.currentTime,
    isPlaying: playbackModule.isPlaying,
    timelineDuration: configModule.timelineDuration,
    totalDuration,
    contentEndTime: viewportModule.contentEndTime,
    playbackRate: playbackModule.playbackRate,
    selectedTimelineItemId: selectionModule.selectedTimelineItemId,
    selectedAVCanvasSprite: selectionModule.selectedAVCanvasSprite,
    // 编辑设置
    proportionalScale: configModule.proportionalScale,
    // 缩放和滚动状态
    zoomLevel: viewportModule.zoomLevel,
    scrollOffset: viewportModule.scrollOffset,
    frameRate: configModule.frameRate,
    minZoomLevel: viewportModule.minZoomLevel,
    visibleDuration: viewportModule.visibleDuration,
    maxVisibleDuration: viewportModule.maxVisibleDuration,
    getMaxZoomLevel: (timelineWidth: number) => viewportModule.getMaxZoomLevelForTimeline(timelineWidth, configModule.frameRate.value),
    getMaxScrollOffset: viewportModule.getMaxScrollOffsetForTimeline,
    // 素材管理方法
    addMediaItem,
    removeMediaItem,
    getMediaItem,
    updateMediaItemName,
    // 时间轴管理方法
    addTimelineItem,
    removeTimelineItem,
    getTimelineItem,
    getTimelineItemsForTrack: (trackId: number) => getTimelineItemsByTrack(trackId, timelineItems.value),
    updateTimelineItemPosition,
    updateTimelineItemSprite,
    setupBidirectionalSync,
    // 选择管理方法
    selectTimelineItem: selectionModule.selectTimelineItem,
    selectAVCanvasSprite: selectionModule.selectAVCanvasSprite,
    handleAVCanvasSpriteChange: selectionModule.handleAVCanvasSpriteChange,
    clearAllSelections: selectionModule.clearAllSelections,
    toggleTimelineItemSelection: selectionModule.toggleTimelineItemSelection,
    isTimelineItemSelected: selectionModule.isTimelineItemSelected,
    isSpriteSelected: selectionModule.isSpriteSelected,
    getSelectedTimelineItem: selectionModule.getSelectedTimelineItem,
    getSelectionSummary: selectionModule.getSelectionSummary,
    resetSelectionToDefaults: selectionModule.resetToDefaults,
    findTimelineItemBySprite: (sprite: Raw<CustomVisibleSprite>) => findTimelineItemBySprite(sprite, timelineItems.value),
    duplicateTimelineItem,
    splitTimelineItemAtTime,
    getTimelineItemAtTime: (time: number) => getTimelineItemAtTime(time, timelineItems.value),
    updateTimelineItemPlaybackRate,
    updateTimelineItemTransform,
    autoArrangeTimelineItems: () => autoArrangeTimelineItems(timelineItems),
    // 播放控制方法
    setCurrentTime: playbackModule.setCurrentTime,
    setPlaybackRate: playbackModule.setPlaybackRate,
    seekTo: playbackModule.seekTo,
    seekBy: playbackModule.seekBy,
    nextFrame: playbackModule.nextFrame,
    previousFrame: playbackModule.previousFrame,
    setPlaying: playbackModule.setPlaying,
    play: playbackModule.play,
    pause: playbackModule.pause,
    togglePlayPause: playbackModule.togglePlayPause,
    stop: playbackModule.stop,
    resetPlaybackRate: playbackModule.resetPlaybackRate,
    formattedCurrentTime: playbackModule.formattedCurrentTime,
    playbackRateText: playbackModule.playbackRateText,
    getPlaybackSummary: playbackModule.getPlaybackSummary,
    resetPlaybackToDefaults: playbackModule.resetToDefaults,
    // 轨道管理方法
    addTrack: (name?: string) => trackModule.addTrack(name),
    removeTrack: (trackId: number) => trackModule.removeTrack(trackId, timelineItems),
    toggleTrackVisibility: trackModule.toggleTrackVisibility,
    toggleTrackMute: trackModule.toggleTrackMute,
    renameTrack: trackModule.renameTrack,
    setTrackHeight: trackModule.setTrackHeight,
    getTrack: trackModule.getTrack,
    getTracksSummary: trackModule.getTracksSummary,
    resetTracksToDefaults: trackModule.resetTracksToDefaults,
    // 缩放和滚动方法
    setZoomLevel: (newZoomLevel: number, timelineWidth: number = 800) =>
      viewportModule.setZoomLevel(newZoomLevel, timelineWidth, configModule.frameRate.value),
    setScrollOffset: viewportModule.setScrollOffset,
    zoomIn: (factor: number = 1.2, timelineWidth: number = 800) =>
      viewportModule.zoomIn(factor, timelineWidth, configModule.frameRate.value),
    zoomOut: (factor: number = 1.2, timelineWidth: number = 800) =>
      viewportModule.zoomOut(factor, timelineWidth, configModule.frameRate.value),
    scrollLeft: viewportModule.scrollLeft,
    scrollRight: viewportModule.scrollRight,
    scrollToTime: viewportModule.scrollToTime,
    resetViewport: viewportModule.resetViewport,
    getViewportSummary: viewportModule.getViewportSummary,
    timeToPixel: (time: number, timelineWidth: number) =>
      timeToPixel(time, timelineWidth, totalDuration.value, viewportModule.zoomLevel.value, viewportModule.scrollOffset.value),
    pixelToTime: (pixel: number, timelineWidth: number) =>
      pixelToTime(pixel, timelineWidth, totalDuration.value, viewportModule.zoomLevel.value, viewportModule.scrollOffset.value),
    alignTimeToFrame: (time: number) => alignTimeToFrame(time, configModule.frameRate.value),
    expandTimelineIfNeeded: (targetTime: number) => expandTimelineIfNeeded(targetTime, configModule.timelineDuration),
    // 分辨率相关
    videoResolution: configModule.videoResolution,
    setVideoResolution: configModule.setVideoResolution,
    // 配置管理
    setTimelineDuration: configModule.setTimelineDuration,
    setFrameRate: configModule.setFrameRate,
    setProportionalScale: configModule.setProportionalScale,
    getConfigSummary: configModule.getConfigSummary,
    resetConfigToDefaults: configModule.resetToDefaults,
    // 视频元素管理
    setVideoElement,
    getVideoOriginalResolution,
    // WebAV 相关状态和方法
    avCanvas: webavModule.avCanvas,
    isWebAVReady: webavModule.isWebAVReady,
    webAVError: webavModule.webAVError,
    setAVCanvas: webavModule.setAVCanvas,
    setWebAVReady: webavModule.setWebAVReady,
    setWebAVError: webavModule.setWebAVError,
    initializeWebAV: webavModule.initializeWebAV,
    destroyWebAV: webavModule.destroyWebAV,
    rebuildWebAV: webavModule.rebuildWebAV,
    isWebAVAvailable: webavModule.isWebAVAvailable,
    getWebAVSummary: webavModule.getWebAVSummary,
    resetWebAVToDefaults: webavModule.resetToDefaults,
    addSpriteToCanvas: webavModule.addSprite,
    removeSpriteFromCanvas: webavModule.removeSprite,
  }
})

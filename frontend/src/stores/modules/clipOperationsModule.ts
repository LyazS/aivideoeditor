import { reactive, markRaw, type Raw, type Ref } from 'vue'
import { CustomVisibleSprite } from '../../utils/customVisibleSprite'
import { useWebAVControls } from '../../composables/useWebAVControls'
import { printDebugInfo, syncTimeRange } from '../utils/storeUtils'
import type { TimelineItem, MediaItem } from '../../types/videoTypes'

/**
 * 视频片段操作模块
 * 负责复杂的视频片段编辑操作，包括复制、分割、播放速度调整等
 */
export function createClipOperationsModule(
  webavModule: { avCanvas: { value: any } },
  mediaModule: {
    getMediaItem: (id: string) => MediaItem | undefined
    mediaItems: Ref<MediaItem[]>
  },
  timelineModule: {
    timelineItems: Ref<TimelineItem[]>
    setupBidirectionalSync: (item: TimelineItem) => void
  },
  selectionModule: { selectTimelineItem: (id: string) => void; clearAllSelections: () => void },
  trackModule?: { tracks: Ref<any[]> },
) {
  // ==================== 视频片段操作方法 ====================

  /**
   * 复制时间轴项目
   * @param timelineItemId 要复制的时间轴项目ID
   * @returns 新创建的时间轴项目ID，失败时返回null
   */
  async function duplicateTimelineItem(timelineItemId: string): Promise<string | null> {
    console.group('📋 时间轴项目复制调试')

    const originalItem = timelineModule.timelineItems.value.find(
      (item) => item.id === timelineItemId,
    )
    if (!originalItem) {
      console.error('❌ 找不到要复制的时间轴项目:', timelineItemId)
      console.groupEnd()
      return null
    }

    const sprite = originalItem.sprite
    const timeRange = sprite.getTimeRange()
    const mediaItem = mediaModule.getMediaItem(originalItem.mediaItemId)

    if (!mediaItem) {
      console.error('❌ 找不到对应的素材项目')
      console.groupEnd()
      return null
    }

    console.log(`📋 复制时间轴项目: ${mediaItem.name} (ID: ${timelineItemId})`)

    try {
      // 检查素材是否已经解析完成
      if (!mediaItem.isReady || !mediaItem.mp4Clip) {
        console.error('❌ 素材还在解析中，无法复制')
        console.groupEnd()
        return null
      }

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
        timelineEndTime: timeRange.timelineEndTime,
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
        opacity: sprite.opacity,
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
          y: originalItem.position.y,
        },
        size: {
          width: originalItem.size.width,
          height: originalItem.size.height,
        },
        rotation: originalItem.rotation,
        zIndex: originalItem.zIndex,
        opacity: originalItem.opacity,
      })

      // 更新新sprite的时间轴位置
      newSprite.setTimeRange({
        clipStartTime: timeRange.clipStartTime,
        clipEndTime: timeRange.clipEndTime,
        timelineStartTime: newTimelinePosition * 1000000,
        timelineEndTime: (newTimelinePosition + duration) * 1000000,
      })

      // 添加到时间轴
      timelineModule.timelineItems.value.push(newItem)

      // 🔄 为新创建的TimelineItem设置双向数据同步
      timelineModule.setupBidirectionalSync(newItem)

      console.log('✅ 复制完成')
      console.groupEnd()

      // 打印复制后的调试信息
      printDebugInfo(
        '复制时间轴项目',
        {
          originalItemId: timelineItemId,
          newItemId: newItem.id,
          mediaItemId: originalItem.mediaItemId,
          mediaItemName: mediaItem?.name || '未知',
          trackId: originalItem.trackId,
          newPosition: newTimelinePosition,
        },
        mediaModule.mediaItems.value,
        timelineModule.timelineItems.value,
        trackModule?.tracks.value || [],
      )

      // 选中新创建的项目
      selectionModule.selectTimelineItem(newItem.id)

      return newItem.id
    } catch (error) {
      console.error('❌ 复制过程中出错:', error)
      console.groupEnd()
      return null
    }
  }

  /**
   * 更新时间轴项目播放速度
   * @param timelineItemId 时间轴项目ID
   * @param newRate 新的播放速度
   */
  function updateTimelineItemPlaybackRate(timelineItemId: string, newRate: number) {
    const item = timelineModule.timelineItems.value.find((item) => item.id === timelineItemId)
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
          timelineDuration:
            (item.timeRange.timelineEndTime - item.timeRange.timelineStartTime) / 1000000,
          effectiveDuration: item.timeRange.effectiveDuration / 1000000,
        },
      })
    }
  }

  /**
   * 在指定时间分割时间轴项目
   * @param timelineItemId 要分割的时间轴项目ID
   * @param splitTime 分割时间点（秒）
   */
  async function splitTimelineItemAtTime(timelineItemId: string, splitTime: number) {
    console.group('🔪 时间轴项目分割调试')

    const itemIndex = timelineModule.timelineItems.value.findIndex(
      (item) => item.id === timelineItemId,
    )
    if (itemIndex === -1) {
      console.error('❌ 找不到要分割的时间轴项目:', timelineItemId)
      console.groupEnd()
      return
    }

    const originalItem = timelineModule.timelineItems.value[itemIndex]
    const sprite = originalItem.sprite
    const timeRange = sprite.getTimeRange()
    const mediaItem = mediaModule.getMediaItem(originalItem.mediaItemId)

    if (!mediaItem) {
      console.error('❌ 找不到对应的素材项目')
      console.groupEnd()
      return
    }

    // 检查素材是否已经解析完成
    if (!mediaItem.isReady || !mediaItem.mp4Clip) {
      console.error('❌ 素材还在解析中，无法分割')
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
    const splitClipTime = clipStartTime + clipDuration * relativeRatio

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
        timelineEndTime: splitTime * 1000000,
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
        opacity: sprite.opacity,
      })

      // 创建第二个片段的CustomVisibleSprite
      const secondSprite = new CustomVisibleSprite(secondClonedClip)
      secondSprite.setTimeRange({
        clipStartTime: splitClipTime * 1000000,
        clipEndTime: clipEndTime * 1000000,
        timelineStartTime: splitTime * 1000000,
        timelineEndTime: timelineEndTime * 1000000,
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
        opacity: sprite.opacity,
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
          y: originalItem.position.y,
        },
        size: {
          width: originalItem.size.width,
          height: originalItem.size.height,
        },
        rotation: originalItem.rotation,
        zIndex: originalItem.zIndex,
        opacity: originalItem.opacity,
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
          y: originalItem.position.y,
        },
        size: {
          width: originalItem.size.width,
          height: originalItem.size.height,
        },
        rotation: originalItem.rotation,
        zIndex: originalItem.zIndex,
        opacity: originalItem.opacity,
      })

      // 从WebAV画布移除原始sprite
      if (canvas) {
        canvas.removeSprite(sprite)
      }

      // 替换原项目为两个新项目
      timelineModule.timelineItems.value.splice(itemIndex, 1, firstItem, secondItem)

      // 🔄 为新创建的两个TimelineItem设置双向数据同步
      timelineModule.setupBidirectionalSync(firstItem)
      timelineModule.setupBidirectionalSync(secondItem)

      console.log('✅ 分割完成')
      console.groupEnd()

      // 打印分割后的调试信息
      printDebugInfo(
        '分割时间轴项目',
        {
          originalItemId: timelineItemId,
          splitTime,
          firstItemId: firstItem.id,
          secondItemId: secondItem.id,
          mediaItemId: originalItem.mediaItemId,
          mediaItemName: mediaItem?.name || '未知',
          trackId: originalItem.trackId,
        },
        mediaModule.mediaItems.value,
        timelineModule.timelineItems.value,
        trackModule?.tracks.value || [],
      )

      // 清除选中状态
      selectionModule.clearAllSelections()
    } catch (error) {
      console.error('❌ 分割过程中出错:', error)
      console.groupEnd()
    }
  }

  // ==================== 导出接口 ====================

  return {
    // 方法
    duplicateTimelineItem,
    updateTimelineItemPlaybackRate,
    splitTimelineItemAtTime,
  }
}

// 导出类型定义
export type ClipOperationsModule = ReturnType<typeof createClipOperationsModule>

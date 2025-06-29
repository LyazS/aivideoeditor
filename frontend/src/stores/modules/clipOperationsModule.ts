import { reactive, markRaw, type Ref } from 'vue'
import { VideoVisibleSprite } from '../../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../../utils/ImageVisibleSprite'
import { createSpriteFromMediaItem } from '../../utils/spriteFactory'
import { regenerateThumbnailForTimelineItem } from '../../utils/thumbnailGenerator'
import { printDebugInfo } from '../utils/debugUtils'
import { syncTimeRange } from '../utils/timeRangeUtils'
import { microsecondsToFrames, framesToTimecode } from '../utils/timeUtils'
import type { TimelineItem, MediaItem } from '../../types'
import { isVideoTimeRange } from '../../types'

/**
 * 视频片段操作模块
 * 负责复杂的视频片段编辑操作，包括复制、分割、播放速度调整等
 */
export function createClipOperationsModule(
  webavModule: {
    avCanvas: {
      value: {
        addSprite: (sprite: unknown) => void
        removeSprite: (sprite: unknown) => void
      } | null
    }
  },
  mediaModule: {
    getMediaItem: (id: string) => MediaItem | undefined
    mediaItems: Ref<MediaItem[]>
  },
  timelineModule: {
    timelineItems: Ref<TimelineItem[]>
    setupBidirectionalSync: (item: TimelineItem) => void
  },
  selectionModule: { selectTimelineItem: (id: string) => void; clearAllSelections: () => void },
  trackModule?: { tracks: Ref<{ id: string; name: string }[]> },
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
      if (!mediaItem.isReady || (!mediaItem.mp4Clip && !mediaItem.imgClip)) {
        console.error('❌ 素材还在解析中，无法复制')
        console.groupEnd()
        return null
      }

      // 根据媒体类型克隆对应的Clip
      const newSprite = await createSpriteFromMediaItem(mediaItem)

      // 根据媒体类型复制时间范围设置
      if (mediaItem.mediaType === 'video' && isVideoTimeRange(timeRange)) {
        ;(newSprite as VideoVisibleSprite).setTimeRange({
          clipStartTime: timeRange.clipStartTime,
          clipEndTime: timeRange.clipEndTime,
          timelineStartTime: timeRange.timelineStartTime,
          timelineEndTime: timeRange.timelineEndTime,
        })
      } else if (mediaItem.mediaType === 'image') {
        ;(newSprite as ImageVisibleSprite).setTimeRange({
          timelineStartTime: timeRange.timelineStartTime,
          timelineEndTime: timeRange.timelineEndTime,
          displayDuration: timeRange.timelineEndTime - timeRange.timelineStartTime,
        })
      }

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
      // 注意：timeRange 中的时间是帧数
      const durationFrames = timeRange.timelineEndTime - timeRange.timelineStartTime // 帧数
      const newTimelinePositionFrames = timeRange.timelineEndTime // 紧接着原项目结束位置

      const newItem: TimelineItem = reactive({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        mediaItemId: originalItem.mediaItemId,
        trackId: originalItem.trackId,
        mediaType: originalItem.mediaType,
        timeRange: newSprite.getTimeRange(), // 从sprite获取完整的timeRange（包含自动计算的effectiveDuration）
        sprite: markRaw(newSprite),
        // 复制原始项目的sprite属性
        x: originalItem.x,
        y: originalItem.y,
        width: originalItem.width,
        height: originalItem.height,
        rotation: originalItem.rotation,
        zIndex: originalItem.zIndex,
        opacity: originalItem.opacity,
        // 复制音量属性
        volume: originalItem.volume,
        isMuted: originalItem.isMuted,
      })

      // 根据媒体类型更新新sprite的时间轴位置
      if (mediaItem.mediaType === 'video' && isVideoTimeRange(timeRange)) {
        ;(newSprite as VideoVisibleSprite).setTimeRange({
          clipStartTime: timeRange.clipStartTime,
          clipEndTime: timeRange.clipEndTime,
          timelineStartTime: newTimelinePositionFrames,
          timelineEndTime: newTimelinePositionFrames + durationFrames,
        })
      } else if (mediaItem.mediaType === 'image') {
        ;(newSprite as ImageVisibleSprite).setTimeRange({
          timelineStartTime: newTimelinePositionFrames,
          timelineEndTime: newTimelinePositionFrames + durationFrames,
          displayDuration: durationFrames,
        })
      }

      // 添加到时间轴
      timelineModule.timelineItems.value.push(newItem)

      // 🔄 为新创建的TimelineItem设置双向数据同步
      timelineModule.setupBidirectionalSync(newItem)

      // 🖼️ 为复制的片段重新生成缩略图（异步执行，不阻塞UI）
      regenerateThumbnailAfterDuplicate(newItem, mediaItem)

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
          newPosition: newTimelinePositionFrames,
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

      // 🎯 关键帧位置调整：在更新播放速度之前计算时长变化
      let oldDurationFrames = 0
      let newDurationFrames = 0

      if (item.mediaType === 'video' && isVideoTimeRange(item.timeRange)) {
        const clipDurationFrames = item.timeRange.clipEndTime - item.timeRange.clipStartTime
        oldDurationFrames = item.timeRange.timelineEndTime - item.timeRange.timelineStartTime
        newDurationFrames = Math.round(clipDurationFrames / clampedRate)

        // 如果有关键帧，先调整位置
        if (item.animation && item.animation.keyframes.length > 0) {
          import('../../utils/unifiedKeyframeUtils').then(
            ({ adjustKeyframesForDurationChange }) => {
              adjustKeyframesForDurationChange(item, oldDurationFrames, newDurationFrames)
              console.log('🎬 [Playback Rate] Keyframes adjusted for speed change:', {
                oldRate: isVideoTimeRange(item.timeRange) ? item.timeRange.playbackRate : 1,
                newRate: clampedRate,
                oldDuration: oldDurationFrames,
                newDuration: newDurationFrames,
              })
            },
          )
        }
      }

      // 更新sprite的播放速度（这会自动更新sprite内部的timeRange）
      // 只有视频sprite才有setPlaybackSpeed方法
      if (item.mediaType === 'video') {
        ;(item.sprite as VideoVisibleSprite).setPlaybackSpeed(clampedRate)
      }

      // 使用同步函数更新TimelineItem的timeRange
      syncTimeRange(item)

      // 如果有动画，需要重新设置WebAV动画时长
      if (item.animation && item.animation.isEnabled) {
        // 异步更新动画，不阻塞播放速度调整
        import('../../utils/webavAnimationManager').then(({ updateWebAVAnimation }) => {
          updateWebAVAnimation(item)
            .then(() => {
              console.log(
                '🎬 [Playback Rate] Animation duration updated after playback rate change',
              )
            })
            .catch((error) => {
              console.error('🎬 [Playback Rate] Failed to update animation duration:', error)
            })
        })
      }

      // 只有视频才记录详细的时间范围信息
      if (item.mediaType === 'video' && isVideoTimeRange(item.timeRange)) {
        const clipDurationFrames = microsecondsToFrames(
          item.timeRange.clipEndTime - item.timeRange.clipStartTime,
        )
        const timelineDurationFrames = microsecondsToFrames(
          item.timeRange.timelineEndTime - item.timeRange.timelineStartTime,
        )
        const effectiveDurationFrames = microsecondsToFrames(item.timeRange.effectiveDuration)

        console.log('🎬 播放速度更新:', {
          timelineItemId,
          newRate: clampedRate,
          timeRange: {
            clipDuration: framesToTimecode(clipDurationFrames),
            timelineDuration: framesToTimecode(timelineDurationFrames),
            effectiveDuration: framesToTimecode(effectiveDurationFrames),
          },
        })
      } else {
        console.log('🎬 [ClipOperations] 图片不支持播放速度调整:', { timelineItemId })
      }
    }
  }

  /**
   * 在指定时间分割时间轴项目
   * @param timelineItemId 要分割的时间轴项目ID
   * @param splitTimeFrames 分割时间点（帧数）
   */
  async function splitTimelineItemAtTime(timelineItemId: string, splitTimeFrames: number) {
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

    // 检查是否为视频类型（图片不支持分割）
    if (mediaItem.mediaType !== 'video') {
      console.error('❌ 只有视频片段支持分割操作')
      console.groupEnd()
      return
    }

    // 检查素材是否已经解析完成
    if (!mediaItem.isReady || !mediaItem.mp4Clip) {
      console.error('❌ 素材还在解析中，无法分割')
      console.groupEnd()
      return
    }

    const timelineStartTimeFrames = timeRange.timelineStartTime // 帧数
    const timelineEndTimeFrames = timeRange.timelineEndTime // 帧数

    console.log('📹 原始时间轴项目信息:')
    console.log('  - 时间轴开始:', timelineStartTimeFrames, '帧')
    console.log('  - 时间轴结束:', timelineEndTimeFrames, '帧')
    console.log('  - 分割时间:', splitTimeFrames, '帧')

    // 检查分割时间是否在项目范围内
    if (splitTimeFrames <= timelineStartTimeFrames || splitTimeFrames >= timelineEndTimeFrames) {
      console.error('❌ 分割时间不在项目范围内')
      console.groupEnd()
      return
    }

    // 只有视频才支持分割
    if (originalItem.mediaType !== 'video' || !isVideoTimeRange(timeRange)) {
      console.error('❌ 只有视频片段支持分割')
      console.groupEnd()
      return
    }

    // 计算分割点在素材中的相对位置（使用帧数）
    const timelineDurationFrames = timelineEndTimeFrames - timelineStartTimeFrames
    const relativeTimelineFrames = splitTimeFrames - timelineStartTimeFrames
    const relativeRatio = relativeTimelineFrames / timelineDurationFrames

    const clipStartTimeFrames = timeRange.clipStartTime // 帧数
    const clipEndTimeFrames = timeRange.clipEndTime // 帧数
    const clipDurationFrames = clipEndTimeFrames - clipStartTimeFrames
    const splitClipTimeFrames = clipStartTimeFrames + Math.round(clipDurationFrames * relativeRatio)

    console.log('🎬 素材时间计算:')
    console.log('  - 素材开始时间:', clipStartTimeFrames, '帧')
    console.log('  - 素材结束时间:', clipEndTimeFrames, '帧')
    console.log('  - 分割点素材时间:', splitClipTimeFrames, '帧')

    try {
      // 为每个分割片段从原始素材创建sprite
      // 创建第一个片段的VideoVisibleSprite
      const firstSprite = (await createSpriteFromMediaItem(mediaItem)) as VideoVisibleSprite
      firstSprite.setTimeRange({
        clipStartTime: clipStartTimeFrames, // 帧数
        clipEndTime: splitClipTimeFrames, // 帧数
        timelineStartTime: timelineStartTimeFrames, // 帧数
        timelineEndTime: splitTimeFrames, // 帧数
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

      // 创建第二个片段的VideoVisibleSprite
      const secondSprite = (await createSpriteFromMediaItem(mediaItem)) as VideoVisibleSprite
      secondSprite.setTimeRange({
        clipStartTime: splitClipTimeFrames, // 帧数
        clipEndTime: clipEndTimeFrames, // 帧数
        timelineStartTime: splitTimeFrames, // 帧数
        timelineEndTime: timelineEndTimeFrames, // 帧数
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
        mediaType: originalItem.mediaType,
        timeRange: firstSprite.getTimeRange(), // 从sprite获取完整的timeRange
        sprite: markRaw(firstSprite),
        // 复制原始项目的sprite属性
        x: originalItem.x,
        y: originalItem.y,
        width: originalItem.width,
        height: originalItem.height,
        rotation: originalItem.rotation,
        zIndex: originalItem.zIndex,
        opacity: originalItem.opacity,
        // 复制音量属性
        volume: originalItem.volume,
        isMuted: originalItem.isMuted,
      })

      const secondItem: TimelineItem = reactive({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        mediaItemId: originalItem.mediaItemId,
        trackId: originalItem.trackId,
        mediaType: originalItem.mediaType,
        timeRange: secondSprite.getTimeRange(), // 从sprite获取完整的timeRange
        sprite: markRaw(secondSprite),
        // 复制原始项目的sprite属性
        x: originalItem.x,
        y: originalItem.y,
        width: originalItem.width,
        height: originalItem.height,
        rotation: originalItem.rotation,
        zIndex: originalItem.zIndex,
        opacity: originalItem.opacity,
        // 复制音量属性
        volume: originalItem.volume,
        isMuted: originalItem.isMuted,
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

      // 🖼️ 为分割后的两个片段重新生成缩略图（异步执行，不阻塞UI）
      regenerateThumbnailsAfterSplit(firstItem, secondItem, mediaItem)

      console.log('✅ 分割完成')
      console.groupEnd()

      // 打印分割后的调试信息
      printDebugInfo(
        '分割时间轴项目',
        {
          originalItemId: timelineItemId,
          splitTime: splitTimeFrames,
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

  // ==================== 辅助函数 ====================

  /**
   * 复制后重新生成缩略图
   * @param newItem 新复制的时间轴项目
   * @param mediaItem 对应的媒体项目
   */
  async function regenerateThumbnailAfterDuplicate(newItem: TimelineItem, mediaItem: MediaItem) {
    try {
      console.log('🖼️ 开始为复制的片段重新生成缩略图...')

      const thumbnailUrl = await regenerateThumbnailForTimelineItem(newItem, mediaItem)
      if (thumbnailUrl) {
        newItem.thumbnailUrl = thumbnailUrl
        console.log('✅ 复制片段缩略图生成完成')
      }
    } catch (error) {
      console.error('❌ 复制后缩略图重新生成失败:', error)
    }
  }

  /**
   * 分割后重新生成缩略图
   * @param firstItem 第一个分割片段
   * @param secondItem 第二个分割片段
   * @param mediaItem 对应的媒体项目
   */
  async function regenerateThumbnailsAfterSplit(
    firstItem: TimelineItem,
    secondItem: TimelineItem,
    mediaItem: MediaItem,
  ) {
    try {
      console.log('🖼️ 开始为分割后的片段重新生成缩略图...')

      // 为第一个片段生成缩略图
      const firstThumbnailUrl = await regenerateThumbnailForTimelineItem(firstItem, mediaItem)
      if (firstThumbnailUrl) {
        firstItem.thumbnailUrl = firstThumbnailUrl
        console.log('✅ 第一个分割片段缩略图生成完成')
      }

      // 为第二个片段生成缩略图
      const secondThumbnailUrl = await regenerateThumbnailForTimelineItem(secondItem, mediaItem)
      if (secondThumbnailUrl) {
        secondItem.thumbnailUrl = secondThumbnailUrl
        console.log('✅ 第二个分割片段缩略图生成完成')
      }

      console.log('✅ 分割后缩略图重新生成完成')
    } catch (error) {
      console.error('❌ 分割后缩略图重新生成失败:', error)
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

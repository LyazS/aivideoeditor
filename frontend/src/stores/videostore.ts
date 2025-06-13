import { ref, computed, markRaw, type Raw } from 'vue'
import { defineStore } from 'pinia'
import { AVCanvas } from '@webav/av-canvas'
import { MP4Clip } from '@webav/av-cliper'
import { CustomVisibleSprite } from '../utils/customVisibleSprite'
import { useWebAVControls } from '../composables/useWebAVControls'

// 素材层：包装MP4Clip和原始文件信息
export interface MediaItem {
  id: string
  name: string
  file: File
  url: string
  duration: number
  type: string
  mp4Clip: Raw<MP4Clip>
}

// 时间轴层：包装CustomVisibleSprite和时间轴位置信息
export interface TimelineItem {
  id: string
  mediaItemId: string // 引用MediaItem的ID
  trackId: number
  timelinePosition: number
  sprite: Raw<CustomVisibleSprite>
}

export interface VideoResolution {
  name: string
  width: number
  height: number
  aspectRatio: string
  category?: string
}

export interface Track {
  id: number
  name: string
  isVisible: boolean
  isMuted: boolean
  height: number // 轨道高度
}

export const useVideoStore = defineStore('video', () => {
  // 新的两层数据结构
  const mediaItems = ref<MediaItem[]>([]) // 素材库
  const timelineItems = ref<TimelineItem[]>([]) // 时间轴

  const tracks = ref<Track[]>([
    { id: 1, name: '轨道 1', isVisible: true, isMuted: false, height: 80 },
    { id: 2, name: '轨道 2', isVisible: true, isMuted: false, height: 80 },
  ])
  const currentTime = ref(0)
  const isPlaying = ref(false)
  const timelineDuration = ref(300) // 默认300秒时间轴，确保有足够的刻度线空间
  const selectedTimelineItemId = ref<string | null>(null) // 当前选中的时间轴项ID
  const selectedAVCanvasSprite = ref<Raw<CustomVisibleSprite> | null>(null) // 当前在AVCanvas中选中的sprite
  const playbackRate = ref(1) // 播放速度

  // 编辑设置
  const proportionalScale = ref(true) // 等比缩放设置

  // 音量控制
  const volume = ref(1) // 音量 0-1
  const isMuted = ref(false) // 是否静音

  // 时间轴缩放和滚动状态
  const zoomLevel = ref(1) // 缩放级别，1为默认，大于1为放大，小于1为缩小
  const scrollOffset = ref(0) // 水平滚动偏移量（像素）
  const frameRate = ref(30) // 假设视频帧率为30fps

  // 视频分辨率设置
  const videoResolution = ref<VideoResolution>({
    name: '1080p',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
  })

  // 全局时间控制器
  let timeUpdateInterval: number | null = null

  // ==================== WebAV 相关状态 ====================
  // WebAV核心对象 - 使用markRaw避免Vue响应式包装
  const avCanvas = ref<AVCanvas | null>(null)
  const isWebAVReady = ref(false)
  const webAVError = ref<string | null>(null)

  // WebAV相关方法
  function setAVCanvas(canvas: AVCanvas | null) {
    avCanvas.value = canvas ? markRaw(canvas) : null
  }

  function setWebAVReady(ready: boolean) {
    isWebAVReady.value = ready
  }

  function setWebAVError(error: string | null) {
    webAVError.value = error
  }

  const totalDuration = computed(() => {
    // 依赖强制更新计数器，确保在sprite内部状态变化时重新计算
    forceUpdateCounter.value

    if (timelineItems.value.length === 0) return timelineDuration.value
    const maxEndTime = Math.max(...timelineItems.value.map((item) => {
      // 从CustomVisibleSprite获取时间信息
      const sprite = item.sprite
      const timeRange = sprite.getTimeRange()
      const timelineEndTime = timeRange.timelineEndTime / 1000000 // 转换为秒
      return timelineEndTime
    }))
    return Math.max(maxEndTime, timelineDuration.value)
  })

  // 动态扩展时间轴长度（用于拖拽时预先扩展）
  function expandTimelineIfNeeded(targetTime: number) {
    if (targetTime > timelineDuration.value) {
      // 扩展到目标时间的1.5倍，确保有足够的空间
      timelineDuration.value = Math.max(targetTime * 1.5, timelineDuration.value)
    }
  }

  // 计算最大允许的可见时间范围（基于视频内容长度）
  const maxVisibleDuration = computed(() => {
    if (contentEndTime.value === 0) {
      return 300 // 没有视频时使用默认值300秒
    }
    // 最大可见范围：视频内容长度的4倍
    return contentEndTime.value * 4
  })

  // 缩放相关计算属性
  const minZoomLevel = computed(() => {
    // 基于最大可见范围计算最小缩放级别
    return totalDuration.value / maxVisibleDuration.value
  })

  // 当前可见时间范围（受最大可见范围限制）
  const visibleDuration = computed(() => {
    const calculatedDuration = totalDuration.value / zoomLevel.value
    return Math.min(calculatedDuration, maxVisibleDuration.value)
  })

  // 计算最大缩放级别的函数（需要时间轴宽度参数）
  function getMaxZoomLevel(timelineWidth: number): number {
    // 最大缩放级别：一帧占用容器宽度的1/20（即5%）
    const targetFrameWidth = timelineWidth / 20 // 一帧占1/20横幅
    const frameDuration = 1 / frameRate.value // 一帧的时长（秒）
    const requiredPixelsPerSecond = targetFrameWidth / frameDuration
    const maxZoom = (requiredPixelsPerSecond * totalDuration.value) / timelineWidth

    return Math.max(maxZoom, 100) // 确保至少有100倍缩放
  }

  // 计算最大滚动偏移量的函数（需要时间轴宽度参数）
  function getMaxScrollOffset(timelineWidth: number): number {
    // 基于最大可见范围计算滚动限制，而不是基于totalDuration
    const effectiveDuration = Math.min(totalDuration.value, maxVisibleDuration.value)
    const pixelsPerSecond = (timelineWidth * zoomLevel.value) / totalDuration.value
    const maxScrollableTime = Math.max(0, effectiveDuration - timelineWidth / pixelsPerSecond)
    return maxScrollableTime * pixelsPerSecond
  }

  // 计算实际内容的结束时间（最后一个视频片段的结束时间）
  const contentEndTime = computed(() => {
    if (timelineItems.value.length === 0) return 0
    return Math.max(...timelineItems.value.map((item) => {
      const sprite = item.sprite
      const timeRange = sprite.getTimeRange()
      return timeRange.timelineEndTime / 1000000 // 转换为秒
    }))
  })

  // ==================== 调试信息函数 ====================
  function printDebugInfo(operation: string, details?: any) {
    const timestamp = new Date().toLocaleTimeString()
    console.group(`🎬 [${timestamp}] ${operation}`)

    if (details) {
      console.log('📋 操作详情:', details)
    }

    console.log('📚 素材库状态 (mediaItems):')
    console.table(mediaItems.value.map(item => ({
      id: item.id,
      name: item.name,
      duration: `${item.duration.toFixed(2)}s`,
      type: item.type,
      hasMP4Clip: !!item.mp4Clip
    })))

    console.log('🎞️ 时间轴状态 (timelineItems):')
    console.table(timelineItems.value.map(item => ({
      id: item.id,
      mediaItemId: item.mediaItemId,
      trackId: item.trackId,
      position: `${item.timelinePosition.toFixed(2)}s`,
      hasSprite: !!item.sprite
    })))

    console.log('📊 统计信息:')
    console.log(`- 素材库项目数: ${mediaItems.value.length}`)
    console.log(`- 时间轴项目数: ${timelineItems.value.length}`)
    console.log(`- 轨道数: ${tracks.value.length}`)

    // 检查引用关系
    const orphanedTimelineItems = timelineItems.value.filter(timelineItem =>
      !mediaItems.value.find(mediaItem => mediaItem.id === timelineItem.mediaItemId)
    )
    if (orphanedTimelineItems.length > 0) {
      console.warn('⚠️ 发现孤立的时间轴项目 (没有对应的素材库项目):', orphanedTimelineItems)
    }

    console.groupEnd()
  }

  // ==================== 素材管理方法 ====================
  function addMediaItem(mediaItem: MediaItem) {
    mediaItems.value.push(mediaItem)
    printDebugInfo('添加素材到素材库', {
      mediaItemId: mediaItem.id,
      name: mediaItem.name,
      duration: mediaItem.duration,
      type: mediaItem.type
    })
  }

  function removeMediaItem(mediaItemId: string) {
    const index = mediaItems.value.findIndex((item) => item.id === mediaItemId)
    if (index > -1) {
      const mediaItem = mediaItems.value[index]
      const relatedTimelineItems = timelineItems.value.filter(item => item.mediaItemId === mediaItemId)

      // 先正确地移除所有相关的时间轴项目（包括WebAV画布清理）
      relatedTimelineItems.forEach(timelineItem => {
        console.log(`🧹 清理时间轴项目: ${timelineItem.id}`)

        // 清理sprite资源
        try {
          if (timelineItem.sprite && typeof timelineItem.sprite.destroy === 'function') {
            timelineItem.sprite.destroy()
          }
        } catch (error) {
          console.warn('清理sprite资源时出错:', error)
        }

        // 从WebAV画布移除
        try {
          const canvas = avCanvas.value
          if (canvas) {
            canvas.removeSprite(timelineItem.sprite)
            console.log(`✅ 从WebAV画布移除sprite: ${timelineItem.id}`)
          }
        } catch (error) {
          console.warn('从WebAV画布移除sprite时出错:', error)
        }
      })

      // 从时间轴数组中移除相关项目
      timelineItems.value = timelineItems.value.filter(item => item.mediaItemId !== mediaItemId)

      // 再移除素材项目
      mediaItems.value.splice(index, 1)

      printDebugInfo('从素材库删除素材', {
        mediaItemId,
        mediaItemName: mediaItem.name,
        removedTimelineItemsCount: relatedTimelineItems.length,
        removedTimelineItemIds: relatedTimelineItems.map(item => item.id)
      })
    }
  }

  function getMediaItem(mediaItemId: string): MediaItem | undefined {
    return mediaItems.value.find(item => item.id === mediaItemId)
  }

  // ==================== 时间轴管理方法 ====================
  function addTimelineItem(timelineItem: TimelineItem) {
    // 如果没有指定轨道，默认分配到第一个轨道
    if (!timelineItem.trackId) {
      timelineItem.trackId = 1
    }
    timelineItems.value.push(timelineItem)

    const mediaItem = getMediaItem(timelineItem.mediaItemId)
    printDebugInfo('添加素材到时间轴', {
      timelineItemId: timelineItem.id,
      mediaItemId: timelineItem.mediaItemId,
      mediaItemName: mediaItem?.name || '未知',
      trackId: timelineItem.trackId,
      position: timelineItem.timelinePosition
    })
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
        const canvas = avCanvas.value
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
        position: item.timelinePosition
      })
    }
  }

  function getTimelineItem(timelineItemId: string): TimelineItem | undefined {
    return timelineItems.value.find(item => item.id === timelineItemId)
  }

  function getTimelineItemsForTrack(trackId: number): TimelineItem[] {
    return timelineItems.value.filter(item => item.trackId === trackId)
  }

  // ==================== 素材名称管理 ====================
  function updateMediaItemName(mediaItemId: string, newName: string) {
    const mediaItem = getMediaItem(mediaItemId)
    if (mediaItem && newName.trim()) {
      mediaItem.name = newName.trim()
      console.log(`素材名称已更新: ${mediaItemId} -> ${newName}`)
    }
  }

  function updateTimelineItemPosition(timelineItemId: string, newPosition: number, newTrackId?: number) {
    const item = timelineItems.value.find((item) => item.id === timelineItemId)
    if (item) {
      const oldPosition = item.timelinePosition
      const oldTrackId = item.trackId
      const mediaItem = getMediaItem(item.mediaItemId)

      // 如果指定了新轨道，更新轨道ID
      if (newTrackId !== undefined) {
        item.trackId = newTrackId
      }
      // 更新时间轴位置
      item.timelinePosition = newPosition
      // 更新CustomVisibleSprite的时间轴位置
      const sprite = item.sprite
      const currentTimeRange = sprite.getTimeRange()
      const duration = currentTimeRange.timelineEndTime - currentTimeRange.timelineStartTime
      sprite.setTimeRange({
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
      })
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
        position: item.timelinePosition
      })
    }
  }

  function selectTimelineItem(timelineItemId: string | null) {
    selectedTimelineItemId.value = timelineItemId

    // 同步选择AVCanvas中的sprite
    if (timelineItemId) {
      const timelineItem = getTimelineItem(timelineItemId)
      if (timelineItem) {
        selectAVCanvasSprite(timelineItem.sprite, false) // false表示不触发反向同步
      }
    } else {
      // 取消时间轴选择时，同步取消AVCanvas选择
      selectAVCanvasSprite(null, false)
    }
  }

  function selectAVCanvasSprite(sprite: Raw<CustomVisibleSprite> | null, syncToTimeline: boolean = true) {
    selectedAVCanvasSprite.value = sprite

    // 获取AVCanvas实例并设置活动sprite
    const canvas = avCanvas.value
    if (canvas) {
      try {
        // 直接设置activeSprite属性
        canvas.activeSprite = sprite
      } catch (error) {
        console.warn('设置AVCanvas活动sprite失败:', error)
      }
    }

    // 同步到时间轴选择（如果需要）
    if (syncToTimeline) {
      if (sprite) {
        // 根据sprite查找对应的timelineItem
        const timelineItem = findTimelineItemBySprite(sprite)
        if (timelineItem) {
          selectedTimelineItemId.value = timelineItem.id
        }
      }
      // 注意：当sprite为null时，我们不自动取消时间轴选择，
      // 因为用户要求"取消avcanvas选中片段的时候，要保留时间轴的选中状态"
    }
  }

  function findTimelineItemBySprite(sprite: Raw<CustomVisibleSprite>): TimelineItem | null {
    return timelineItems.value.find(item => item.sprite === sprite) || null
  }

  // 处理来自AVCanvas的sprite选择变化
  function handleAVCanvasSpriteChange(sprite: Raw<CustomVisibleSprite> | null) {
    // 更新AVCanvas选择状态，但不触发反向同步（避免循环）
    selectedAVCanvasSprite.value = sprite

    // 同步到时间轴选择
    if (sprite) {
      const timelineItem = findTimelineItemBySprite(sprite)
      if (timelineItem) {
        selectedTimelineItemId.value = timelineItem.id
      }
    }
    // 注意：当sprite为null时，保留时间轴选择状态
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
      const newSprite = new (sprite.constructor as any)(clonedClip)

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
      newSprite.zIndex = sprite.zIndex
      newSprite.opacity = sprite.opacity

      console.log(`📋 复制原始sprite属性:`, {
        position: { x: originalRect.x, y: originalRect.y },
        size: { w: originalRect.w, h: originalRect.h },
        zIndex: sprite.zIndex,
        opacity: sprite.opacity
      })

      // 添加到WebAV画布
      const canvas = avCanvas.value
      if (canvas) {
        canvas.addSprite(newSprite)
      }

      // 创建新的TimelineItem，放置在原项目的右侧
      const duration = (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000 // 转换为秒
      const newTimelinePosition = timeRange.timelineStartTime / 1000000 + duration // 紧接着原项目

      const newItem: TimelineItem = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        mediaItemId: originalItem.mediaItemId,
        trackId: originalItem.trackId,
        timelinePosition: newTimelinePosition,
        sprite: markRaw(newSprite)
      }

      // 更新新sprite的时间轴位置
      newSprite.setTimeRange({
        clipStartTime: timeRange.clipStartTime,
        clipEndTime: timeRange.clipEndTime,
        timelineStartTime: newTimelinePosition * 1000000,
        timelineEndTime: (newTimelinePosition + duration) * 1000000
      })

      // 添加到时间轴
      timelineItems.value.push(newItem)

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
      })

      // 选中新创建的项目
      selectedTimelineItemId.value = newItem.id

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
      const firstSprite = new (sprite.constructor as any)(firstClonedClip)
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
      firstSprite.zIndex = sprite.zIndex
      firstSprite.opacity = sprite.opacity

      console.log(`📋 复制原始sprite属性到第一个片段:`, {
        position: { x: originalRect.x, y: originalRect.y },
        size: { w: originalRect.w, h: originalRect.h },
        zIndex: sprite.zIndex,
        opacity: sprite.opacity
      })

      // 创建第二个片段的CustomVisibleSprite
      const secondSprite = new (sprite.constructor as any)(secondClonedClip)
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
      secondSprite.zIndex = sprite.zIndex
      secondSprite.opacity = sprite.opacity

      console.log(`📋 复制原始sprite属性到第二个片段:`, {
        position: { x: originalRect.x, y: originalRect.y },
        size: { w: originalRect.w, h: originalRect.h },
        zIndex: sprite.zIndex,
        opacity: sprite.opacity
      })

      // 添加到WebAV画布
      const canvas = avCanvas.value
      if (canvas) {
        canvas.addSprite(firstSprite)
        canvas.addSprite(secondSprite)
      }

      // 创建新的TimelineItem
      const firstItem: TimelineItem = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        mediaItemId: originalItem.mediaItemId,
        trackId: originalItem.trackId,
        timelinePosition: timelineStartTime,
        sprite: markRaw(firstSprite)
      }

      const secondItem: TimelineItem = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        mediaItemId: originalItem.mediaItemId,
        trackId: originalItem.trackId,
        timelinePosition: splitTime,
        sprite: markRaw(secondSprite)
      }

      // 从WebAV画布移除原始sprite
      if (canvas) {
        canvas.removeSprite(sprite)
      }

      // 替换原项目为两个新项目
      timelineItems.value.splice(itemIndex, 1, firstItem, secondItem)

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
      })

      // 清除选中状态
      selectedTimelineItemId.value = null
    } catch (error) {
      console.error('❌ 分割过程中出错:', error)
      console.groupEnd()
    }
  }

  function getTimelineItemAtTime(time: number): TimelineItem | null {
    return timelineItems.value.find((item) => {
      const sprite = item.sprite
      const timeRange = sprite.getTimeRange()
      const startTime = timeRange.timelineStartTime / 1000000 // 转换为秒
      const endTime = timeRange.timelineEndTime / 1000000 // 转换为秒
      return time >= startTime && time < endTime
    }) || null
  }

  // 将时间对齐到帧边界
  function alignTimeToFrame(time: number): number {
    const frameDuration = 1 / frameRate.value
    return Math.floor(time / frameDuration) * frameDuration
  }

  function setCurrentTime(time: number, forceAlign: boolean = true) {
    const finalTime = forceAlign ? alignTimeToFrame(time) : time
    currentTime.value = finalTime
    // 移除自动选中逻辑 - 播放时不自动选中clip
  }

  function startTimeUpdate() {
    if (timeUpdateInterval) return

    timeUpdateInterval = setInterval(() => {
      if (isPlaying.value) {
        const newTime = currentTime.value + 0.05 * playbackRate.value // 每50ms更新一次
        // 如果有视频片段，播放到最后一个片段结束；如果没有片段，播放到时间轴结束
        const endTime = contentEndTime.value > 0 ? contentEndTime.value : totalDuration.value
        if (newTime >= endTime) {
          stop()
        } else {
          setCurrentTime(newTime)
        }
      }
    }, 50) // 50ms间隔，确保流畅播放
  }

  function stopTimeUpdate() {
    if (timeUpdateInterval) {
      clearInterval(timeUpdateInterval)
      timeUpdateInterval = null
    }
  }

  function play() {
    isPlaying.value = true
    startTimeUpdate()
  }

  function pause() {
    isPlaying.value = false
    stopTimeUpdate()
  }

  function stop() {
    isPlaying.value = false
    currentTime.value = 0
    stopTimeUpdate()
  }

  function setPlaybackRate(rate: number) {
    playbackRate.value = rate
  }

  // 音量控制方法
  function setVolume(newVolume: number) {
    volume.value = Math.max(0, Math.min(1, newVolume)) // 确保音量在0-1范围内
    if (volume.value > 0) {
      isMuted.value = false
    }
  }

  function toggleMute() {
    isMuted.value = !isMuted.value
  }

  function mute() {
    isMuted.value = true
  }

  function unmute() {
    isMuted.value = false
  }

  // 前一帧控制
  function previousFrame() {
    const frameDuration = 1 / frameRate.value
    const newTime = Math.max(0, currentTime.value - frameDuration)
    setCurrentTime(newTime)
  }

  // 后一帧控制
  function nextFrame() {
    const frameDuration = 1 / frameRate.value
    const endTime = contentEndTime.value > 0 ? contentEndTime.value : totalDuration.value
    const newTime = Math.min(endTime, currentTime.value + frameDuration)
    setCurrentTime(newTime)
  }

  // 强制更新计数器，用于触发Vue组件重新渲染
  const forceUpdateCounter = ref(0)

  function autoArrangeTimelineItems() {
    // 按轨道分组，然后在每个轨道内按时间位置排序
    const trackGroups = new Map<number, TimelineItem[]>()

    timelineItems.value.forEach((item) => {
      if (!trackGroups.has(item.trackId)) {
        trackGroups.set(item.trackId, [])
      }
      trackGroups.get(item.trackId)!.push(item)
    })

    // 在每个轨道内重新排列项目
    trackGroups.forEach((trackItems) => {
      // 按时间轴开始时间排序
      const sortedItems = trackItems.sort((a, b) => {
        const rangeA = a.sprite.getTimeRange()
        const rangeB = b.sprite.getTimeRange()
        return rangeA.timelineStartTime - rangeB.timelineStartTime
      })

      let currentPosition = 0
      for (const item of sortedItems) {
        const sprite = item.sprite
        const timeRange = sprite.getTimeRange()
        const duration = (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000 // 转换为秒

        // 更新时间轴位置
        sprite.setTimeRange({
          clipStartTime: timeRange.clipStartTime,
          clipEndTime: timeRange.clipEndTime,
          timelineStartTime: currentPosition * 1000000, // 转换为微秒
          timelineEndTime: (currentPosition + duration) * 1000000
        })

        item.timelinePosition = currentPosition
        currentPosition += duration
      }
    })

    // 强制触发Vue组件重新渲染
    forceUpdateCounter.value++

    console.log('✅ 时间轴项目自动整理完成')
  }

  // 轨道管理方法
  function addTrack(name?: string): Track {
    const newId = Math.max(...tracks.value.map((t) => t.id)) + 1
    const newTrack: Track = {
      id: newId,
      name: name || `轨道 ${newId}`,
      isVisible: true,
      isMuted: false,
      height: 80,
    }
    tracks.value.push(newTrack)
    return newTrack
  }

  function removeTrack(trackId: number) {
    // 不能删除最后一个轨道
    if (tracks.value.length <= 1) return

    // 将该轨道的所有时间轴项目移动到第一个轨道
    timelineItems.value.forEach((item) => {
      if (item.trackId === trackId) {
        item.trackId = tracks.value[0].id
      }
    })

    // 删除轨道
    const index = tracks.value.findIndex((t) => t.id === trackId)
    if (index > -1) {
      tracks.value.splice(index, 1)
    }
  }

  function toggleTrackVisibility(trackId: number) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) {
      track.isVisible = !track.isVisible
    }
  }

  function toggleTrackMute(trackId: number) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) {
      track.isMuted = !track.isMuted
    }
  }

  function renameTrack(trackId: number, newName: string) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) {
      track.name = newName
    }
  }

  // 缩放和滚动方法
  function setZoomLevel(newZoomLevel: number, timelineWidth: number = 800) {
    const maxZoom = getMaxZoomLevel(timelineWidth)
    const minZoom = minZoomLevel.value
    const clampedZoom = Math.max(minZoom, Math.min(newZoomLevel, maxZoom))

    // 如果达到最小缩放级别，提供调试信息
    if (newZoomLevel < minZoom && contentEndTime.value > 0) {
      console.log(`🔍 已达到最小缩放级别 (${minZoom.toFixed(3)})`)
      console.log(`📏 当前视频总长度: ${contentEndTime.value.toFixed(1)}秒`)
      console.log(`👁️ 最大可见范围限制: ${maxVisibleDuration.value.toFixed(1)}秒`)
      console.log(`🎯 当前可见范围: ${visibleDuration.value.toFixed(1)}秒`)
    }

    zoomLevel.value = clampedZoom

    // 调整滚动偏移量以保持在有效范围内
    const maxOffset = getMaxScrollOffset(timelineWidth)
    scrollOffset.value = Math.max(0, Math.min(scrollOffset.value, maxOffset))
  }

  function setScrollOffset(newOffset: number, timelineWidth: number = 800) {
    const maxOffset = getMaxScrollOffset(timelineWidth)
    scrollOffset.value = Math.max(0, Math.min(newOffset, maxOffset))
  }

  function zoomIn(factor: number = 1.2, timelineWidth: number = 800) {
    setZoomLevel(zoomLevel.value * factor, timelineWidth)
  }

  function zoomOut(factor: number = 1.2, timelineWidth: number = 800) {
    setZoomLevel(zoomLevel.value / factor, timelineWidth)

    // 当缩小时间轴时，确保基础时间轴长度足够大以显示更多刻度线
    const pixelsPerSecond = (timelineWidth * zoomLevel.value) / totalDuration.value
    const visibleDuration = timelineWidth / pixelsPerSecond

    // 如果可见时间范围超过当前时间轴长度，扩展时间轴
    if (visibleDuration > timelineDuration.value) {
      timelineDuration.value = Math.max(visibleDuration * 1.5, timelineDuration.value)
    }
  }

  function scrollLeft(amount: number = 50, timelineWidth: number = 800) {
    setScrollOffset(scrollOffset.value - amount, timelineWidth)
  }

  function scrollRight(amount: number = 50, timelineWidth: number = 800) {
    setScrollOffset(scrollOffset.value + amount, timelineWidth)
  }

  // 计算用于刻度线显示的虚拟时间轴长度
  function getVirtualTimelineDuration(timelineWidth: number): number {
    // 当缩小时间轴时，计算可见范围的结束时间
    const pixelsPerSecond = (timelineWidth * zoomLevel.value) / totalDuration.value
    const visibleEndTime = scrollOffset.value / pixelsPerSecond + timelineWidth / pixelsPerSecond

    // 返回当前内容长度和可见范围结束时间的较大值，确保刻度线能够扩展
    return Math.max(totalDuration.value, visibleEndTime + 60) // 额外添加60秒缓冲
  }

  // 将时间转换为像素位置（考虑缩放和滚动）
  function timeToPixel(time: number, timelineWidth: number): number {
    const pixelsPerSecond = (timelineWidth * zoomLevel.value) / totalDuration.value
    return time * pixelsPerSecond - scrollOffset.value
  }

  // 将像素位置转换为时间（考虑缩放和滚动）
  function pixelToTime(pixel: number, timelineWidth: number): number {
    const pixelsPerSecond = (timelineWidth * zoomLevel.value) / totalDuration.value
    return (pixel + scrollOffset.value) / pixelsPerSecond
  }

  // 专门用于刻度线计算的时间到像素转换（使用虚拟时间轴长度）
  function timeToPixelForScale(time: number, timelineWidth: number): number {
    const virtualDuration = getVirtualTimelineDuration(timelineWidth)
    const pixelsPerSecond = (timelineWidth * zoomLevel.value) / virtualDuration
    return time * pixelsPerSecond - scrollOffset.value
  }

  // 设置视频分辨率
  function setVideoResolution(resolution: VideoResolution) {
    videoResolution.value = resolution
    console.log('视频分辨率已设置为:', resolution)
  }

  // 更新时间轴项目播放速度
  function updateTimelineItemPlaybackRate(timelineItemId: string, newRate: number) {
    const item = timelineItems.value.find((item) => item.id === timelineItemId)
    if (item) {
      // 确保播放速度在合理范围内（扩展到0.1-100倍）
      const clampedRate = Math.max(0.1, Math.min(100, newRate))
      item.sprite.setPlaybackSpeed(clampedRate)
    }
  }

  // 视频元素引用映射（用于获取原始分辨率）
  const videoElementsMap = new Map<string, HTMLVideoElement>()

  // 设置视频元素引用
  function setVideoElement(clipId: string, videoElement: HTMLVideoElement | null) {
    if (videoElement) {
      videoElementsMap.set(clipId, videoElement)
    } else {
      videoElementsMap.delete(clipId)
    }
  }

  // 获取视频原始分辨率
  function getVideoOriginalResolution(clipId: string): { width: number; height: number } {
    const videoElement = videoElementsMap.get(clipId)
    if (videoElement && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
      return {
        width: videoElement.videoWidth,
        height: videoElement.videoHeight,
      }
    }
    // 默认分辨率
    return { width: 1920, height: 1080 }
  }

  // 计算视频片段在画布中的适应缩放比例
  function getVideoFitScale(clipId: string): { scaleX: number; scaleY: number; fitScale: number } {
    const videoElement = videoElementsMap.get(clipId)
    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      return { scaleX: 1, scaleY: 1, fitScale: 1 }
    }

    const videoWidth = videoElement.videoWidth
    const videoHeight = videoElement.videoHeight
    const canvasWidth = videoResolution.value.width
    const canvasHeight = videoResolution.value.height

    // 计算适应画布的缩放比例
    const scaleX = canvasWidth / videoWidth
    const scaleY = canvasHeight / videoHeight

    // 选择较小的缩放比例以确保视频完全适应画布
    const fitScale = Math.min(scaleX, scaleY)

    return { scaleX, scaleY, fitScale }
  }

  // 计算视频片段的实际显示尺寸（考虑适应缩放）
  function getVideoDisplaySize(clipId: string, userScaleX: number, userScaleY: number): { width: number; height: number } {
    const videoElement = videoElementsMap.get(clipId)
    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      return { width: videoResolution.value.width, height: videoResolution.value.height }
    }

    const { fitScale } = getVideoFitScale(clipId)

    // 基础尺寸：视频原始尺寸 * 适应缩放
    const baseWidth = videoElement.videoWidth * fitScale
    const baseHeight = videoElement.videoHeight * fitScale

    // 应用用户缩放
    const displayWidth = baseWidth * userScaleX
    const displayHeight = baseHeight * userScaleY

    return { width: displayWidth, height: displayHeight }
  }

  return {
    // 新的两层数据结构
    mediaItems,
    timelineItems,
    tracks,
    currentTime,
    isPlaying,
    timelineDuration,
    totalDuration,
    contentEndTime,
    playbackRate,
    selectedTimelineItemId,
    selectedAVCanvasSprite,
    // 编辑设置
    proportionalScale,
    // 音量状态
    volume,
    isMuted,
    // 缩放和滚动状态
    zoomLevel,
    scrollOffset,
    frameRate,
    minZoomLevel,
    visibleDuration,
    maxVisibleDuration,
    getMaxZoomLevel,
    getMaxScrollOffset,
    // 强制更新计数器
    forceUpdateCounter,
    // 素材管理方法
    addMediaItem,
    removeMediaItem,
    getMediaItem,
    updateMediaItemName,
    // 时间轴管理方法
    addTimelineItem,
    removeTimelineItem,
    getTimelineItem,
    getTimelineItemsForTrack,
    updateTimelineItemPosition,
    updateTimelineItemSprite,
    selectTimelineItem,
    selectAVCanvasSprite,
    findTimelineItemBySprite,
    handleAVCanvasSpriteChange,
    duplicateTimelineItem,
    splitTimelineItemAtTime,
    getTimelineItemAtTime,
    updateTimelineItemPlaybackRate,
    autoArrangeTimelineItems,
    // 播放控制方法
    setCurrentTime,
    play,
    pause,
    stop,
    setPlaybackRate,
    // 音量控制方法
    setVolume,
    toggleMute,
    mute,
    unmute,
    previousFrame,
    nextFrame,
    startTimeUpdate,
    stopTimeUpdate,
    // 轨道管理方法
    addTrack,
    removeTrack,
    toggleTrackVisibility,
    toggleTrackMute,
    renameTrack,
    // 缩放和滚动方法
    setZoomLevel,
    setScrollOffset,
    zoomIn,
    zoomOut,
    scrollLeft,
    scrollRight,
    timeToPixel,
    pixelToTime,
    alignTimeToFrame,
    expandTimelineIfNeeded,
    getVirtualTimelineDuration,
    timeToPixelForScale,
    // 分辨率相关
    videoResolution,
    setVideoResolution,
    // 视频元素管理
    setVideoElement,
    getVideoOriginalResolution,
    getVideoFitScale,
    getVideoDisplaySize,
    // WebAV 相关状态和方法
    avCanvas,
    isWebAVReady,
    webAVError,
    setAVCanvas,
    setWebAVReady,
    setWebAVError,
  }
})

import { useUnifiedStore } from '@/unified/unifiedStore'
import type { TimelineItemDragData, MediaItemDragData } from '@/unified/types'
import type { MediaType } from '@/unified/mediaitem'
import type { UnifiedTrackType } from '@/unified/track/TrackTypes'
import { alignFramesToFrame } from '@/unified/utils/timeUtils'
import { DEFAULT_TRACK_PADDING } from '@/unified/constants/TrackConstants'
import { getDefaultTrackHeight, mapMediaTypeToTrackType } from '@/unified/track/TrackUtils'

/**
 * 拖拽工具函数集合
 * 提供统一的拖拽处理逻辑，避免代码重复
 */
export function useDragUtils() {
  const unifiedStore = useUnifiedStore()

  /**
   * 设置时间轴项目拖拽数据
   */
  function setTimelineItemDragData(
    event: DragEvent,
    itemId: string,
    trackId: string,
    startTime: number, // 帧数
    selectedItems: string[],
    dragOffset: { x: number; y: number },
  ) {
    const dragData: TimelineItemDragData = {
      type: 'timeline-item',
      itemId,
      trackId,
      startTime,
      selectedItems,
      dragOffset,
    }

    // 设置拖拽数据
    event.dataTransfer!.setData('application/timeline-item', JSON.stringify(dragData))
    event.dataTransfer!.effectAllowed = 'move'

    // 设置全局拖拽状态（用于dragover事件中访问）
    window.__timelineDragData = dragData

    return dragData
  }

  /**
   * 设置素材库拖拽数据
   */
  function setMediaItemDragData(
    event: DragEvent,
    mediaItemId: string,
    name: string,
    duration: number, // 帧数
    mediaType: 'video' | 'image' | 'audio' | 'text',
  ) {
    const dragData: MediaItemDragData = {
      type: 'media-item',
      mediaItemId,
      name,
      duration,
      mediaType,
    }

    // 设置拖拽数据
    event.dataTransfer!.setData('application/media-item', JSON.stringify(dragData))
    event.dataTransfer!.effectAllowed = 'copy'

    // 设置全局拖拽状态
    window.__mediaDragData = dragData

    return dragData
  }

  /**
   * 获取当前时间轴项目拖拽数据
   */
  function getCurrentTimelineItemDragData(): TimelineItemDragData | null {
    return window.__timelineDragData || null
  }

  /**
   * 获取当前素材库拖拽数据
   */
  function getCurrentMediaItemDragData(): MediaItemDragData | null {
    return window.__mediaDragData || null
  }

  /**
   * 清理拖拽数据
   */
  function clearDragData() {
    window.__timelineDragData = null
    window.__mediaDragData = null
  }

  /**
   * 确保项目被选中（拖拽开始时调用）
   */
  function ensureItemSelected(itemId: string) {
    if (!unifiedStore.selectedTimelineItemIds.has(itemId)) {
      unifiedStore.selectTimelineItem(itemId)
    }
  }


  /**
   * 根据媒体类型计算clip高度
   */
  function getClipHeightByMediaType(mediaType: MediaType): number {
      // 根据媒体类型获取对应的轨道类型，然后计算clip高度
      const trackType = mapMediaTypeToTrackType(mediaType)
      return getDefaultTrackHeight(trackType) - (DEFAULT_TRACK_PADDING * 2)
    }

  /**
   * 获取被拖拽项目的实际高度
   */
  function getDraggedItemHeight(): number {
    // 检查是否是时间轴项目拖拽
    const timelineDragData = getCurrentTimelineItemDragData()
    if (timelineDragData) {
      const draggedItem = unifiedStore.getTimelineItem(timelineDragData.itemId)
      if (draggedItem) {
        return getClipHeightByMediaType(draggedItem.mediaType)
      }
    }

    // 检查是否是素材库拖拽
    const mediaDragData = getCurrentMediaItemDragData()
    if (mediaDragData) {
      return getClipHeightByMediaType(mediaDragData.mediaType)
    }

    // 默认高度：视频轨道高度减去上下间距
    return getDefaultTrackHeight('video') - (DEFAULT_TRACK_PADDING * 2)
  }

  /**
   * 创建拖拽预览的基础数据
   */
  function createDragPreviewData(
    name: string,
    duration: number, // 帧数
    startTime: number, // 帧数
    trackId: string,
    isConflict: boolean = false,
    isMultiple: boolean = false,
    count?: number,
    mediaType?: MediaType,
    statusInfo?: { isReady: boolean; isLoading: boolean; hasError?: boolean },
  ) {
    // 计算预览高度
    let height: number
    if (mediaType) {
      height = getClipHeightByMediaType(mediaType)
    } else {
      height = getDraggedItemHeight()
    }

    return {
      name,
      duration,
      startTime,
      trackId,
      isConflict,
      isMultiple,
      count,
      height,
      mediaType,
      statusInfo,
    }
  }

  /**
   * 检查媒体类型与轨道类型的兼容性
   */
  function isMediaCompatibleWithTrack(
    mediaType: MediaType,
    trackType: UnifiedTrackType,
  ): boolean {
    // 视频轨道支持视频和图片素材
    if (trackType === 'video') {
      return mediaType === 'video' || mediaType === 'image'
    }

    // 音频轨道支持音频素材
    if (trackType === 'audio') {
      return mediaType === 'audio'
    }

    // 文本轨道支持文本素材
    if (trackType === 'text' || trackType === 'subtitle') {
      return mediaType === 'text'
    }

    return false
  }

  /**
   * 根据媒体类型寻找最近的兼容轨道
   */
  function findNearestCompatibleTrack(
    mouseY: number,
    mediaType: MediaType,
  ): string | null {
    const tracks = unifiedStore.tracks
    if (tracks.length === 0) return null

    // 获取所有兼容的轨道及其位置信息
    const compatibleTracks: Array<{ id: string; distance: number; element: HTMLElement }> = []

    tracks.forEach((track) => {
      if (isMediaCompatibleWithTrack(mediaType, track.type)) {
        const trackElement = document.querySelector(`[data-track-id="${track.id}"]`) as HTMLElement
        if (trackElement) {
          const rect = trackElement.getBoundingClientRect()
          const trackCenterY = rect.top + rect.height / 2
          const distance = Math.abs(mouseY - trackCenterY)
          compatibleTracks.push({
            id: track.id,
            distance,
            element: trackElement,
          })
        }
      }
    })

    if (compatibleTracks.length === 0) return null

    // 返回距离最近的兼容轨道
    compatibleTracks.sort((a, b) => a.distance - b.distance)
    return compatibleTracks[0].id
  }

  /**
   * 计算拖拽目标位置（已集成吸附功能）
   */
  function calculateDropPosition(
    event: DragEvent,
    timelineWidth: number,
    dragOffset?: { x: number; y: number },
    enableSnapping: boolean = true,
  ) {
    const targetElement = event.target as HTMLElement
    let trackContent = targetElement.closest('.track-content')

    // 如果没有找到track-content，尝试在整个时间轴容器内查找最近的轨道
    if (!trackContent) {
      const timelineContainer = targetElement.closest('.timeline')
      if (timelineContainer) {
        // 获取所有轨道元素
        const allTrackContents = timelineContainer.querySelectorAll('.track-content')
        if (allTrackContents.length > 0) {
          // 计算鼠标位置与每个轨道的距离
          const mouseY = event.clientY
          let closestTrack: HTMLElement | null = null
          let minDistance = Infinity

          allTrackContents.forEach((track) => {
            const rect = track.getBoundingClientRect()
            const trackCenterY = rect.top + rect.height / 2
            const distance = Math.abs(mouseY - trackCenterY)

            if (distance < minDistance) {
              minDistance = distance
              closestTrack = track as HTMLElement
            }
          })

          trackContent = closestTrack
        }
      }
    }

    if (!trackContent) {
      return null
    }

    const rect = trackContent.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    let targetTrackId =
      trackContent.getAttribute('data-track-id') || unifiedStore.tracks[0]?.id || ''

    // 获取拖拽的媒体类型和排除的片段ID
    let draggedMediaType: MediaType | null = null
    let excludeClipIds: string[] = []

    // 检查是否是时间轴项目拖拽
    const timelineDragData = getCurrentTimelineItemDragData()
    if (timelineDragData) {
      const draggedItem = unifiedStore.getTimelineItem(timelineDragData.itemId)
      if (draggedItem) {
        draggedMediaType = draggedItem.mediaType
      }
      // 排除当前拖拽的所有选中片段
      excludeClipIds = timelineDragData.selectedItems
    } else {
      // 检查是否是素材库拖拽
      const mediaDragData = getCurrentMediaItemDragData()
      if (mediaDragData) {
        draggedMediaType = mediaDragData.mediaType
      }
      // 素材库拖拽不需要排除任何片段
      excludeClipIds = []
    }

    // 如果能获取到媒体类型，检查轨道兼容性
    if (draggedMediaType) {
      const currentTrack = unifiedStore.tracks.find((t) => t.id === targetTrackId)
      if (currentTrack && !isMediaCompatibleWithTrack(draggedMediaType, currentTrack.type)) {
        // 当前轨道不兼容，寻找最近的兼容轨道
        const nearestCompatibleTrackId = findNearestCompatibleTrack(event.clientY, draggedMediaType)
        if (nearestCompatibleTrackId) {
          targetTrackId = nearestCompatibleTrackId
          // 更新trackContent为新的目标轨道
          const newTrackContent = document.querySelector(
            `[data-track-id="${targetTrackId}"]`,
          ) as HTMLElement
          if (newTrackContent) {
            const newRect = newTrackContent.getBoundingClientRect()
            // 重新计算mouseX相对于新轨道的位置
            const mouseXRelativeToNewTrack = event.clientX - newRect.left
            // 使用新的相对位置计算时间（已启用吸附）
                    const dropResult = calculateDropFrames(
                      mouseXRelativeToNewTrack,
                      timelineWidth,
                      dragOffset,
                      enableSnapping,
                      excludeClipIds,
                    )
                    return {
                      dropTime: dropResult.frame,
                      targetTrackId,
                      trackContent: newTrackContent,
                      snapResult: dropResult.snapResult,
                    }
          }
        }
      }
    }

    // 使用原始逻辑计算时间（已启用吸附）
    const dropResult = calculateDropFrames(
      mouseX,
      timelineWidth,
      dragOffset,
      enableSnapping,
      excludeClipIds,
    )

    return {
      dropTime: dropResult.frame,
      targetTrackId,
      trackContent,
      snapResult: dropResult.snapResult,
    }
  }

  /**
   * 计算拖拽帧数的辅助函数（已集成吸附功能）
   */
  function calculateDropFrames(
    mouseX: number,
    timelineWidth: number,
    dragOffset?: { x: number; y: number },
    enableSnapping: boolean = true,
    excludeClipIds: string[] = [],
  ): { frame: number; snapResult?: any } {
    // 使用帧数进行精确计算
    let dropFrames: number
    if (dragOffset) {
      // 考虑拖拽偏移量，计算clip的实际开始位置
      const clipStartX = mouseX - dragOffset.x
      dropFrames = unifiedStore.pixelToFrame(clipStartX, timelineWidth)
    } else {
      // 直接使用鼠标位置
      dropFrames = unifiedStore.pixelToFrame(mouseX, timelineWidth)
    }

    // 确保拖拽帧数不会小于0
    dropFrames = Math.max(0, dropFrames)

    // 对齐到帧边界
    dropFrames = alignFramesToFrame(dropFrames)

    // 启用吸附功能
    if (enableSnapping && unifiedStore.snapConfig.enabled) {
      // 开始拖拽阶段，收集候选目标
      unifiedStore.startSnapDrag(excludeClipIds)
      
      // 计算吸附位置
      const snapOptions: any = {
        excludeClipIds,
        customThreshold: unifiedStore.snapConfig.threshold
      }
      
      const snapResult = unifiedStore.calculateSnapPosition(dropFrames, snapOptions)
      
      // 结束拖拽阶段，清理缓存
      unifiedStore.endSnapDrag()
      
      if (snapResult) {
        return {
          frame: snapResult.frame,
          snapResult: snapResult // 返回完整的吸附结果
        }
      }
    }
    
    // 返回原始位置（未吸附）
    return { frame: dropFrames, snapResult: null }
  }

  /**
   * 检查拖拽数据类型
   */
  function getDragDataType(event: DragEvent): 'timeline-item' | 'media-item' | 'files' | 'unknown' {
    const types = event.dataTransfer?.types || []

    if (types.includes('application/timeline-item')) {
      return 'timeline-item'
    } else if (types.includes('application/media-item')) {
      return 'media-item'
    } else if (types.includes('Files')) {
      return 'files'
    } else {
      return 'unknown'
    }
  }

  /**
   * 通过数据属性查询DOM元素的实用函数
   */
  function getTimelineItemElement(timelineItemId: string): HTMLElement | null {
    return document.querySelector(`[data-timeline-item-id="${timelineItemId}"]`)
  }

  function getMediaItemElement(mediaItemId: string): HTMLElement | null {
    return document.querySelector(`[data-media-item-id="${mediaItemId}"]`)
  }

  function getTrackElement(trackId: string): HTMLElement | null {
    return document.querySelector(`[data-track-id="${trackId}"]`)
  }

  /**
   * 获取元素的实际尺寸信息
   */
  function getElementDimensions(element: HTMLElement | null): { width: number; height: number } {
    if (!element) {
      return { width: 100, height: 60 } // 默认尺寸
    }
    return {
      width: element.offsetWidth,
      height: element.offsetHeight,
    }
  }

  return {
    // 拖拽数据管理
    setTimelineItemDragData,
    setMediaItemDragData,
    getCurrentTimelineItemDragData,
    getCurrentMediaItemDragData,
    clearDragData,

    // 选择管理
    ensureItemSelected,

    // 预览数据创建
    createDragPreviewData,
    getClipHeightByMediaType,
    getDraggedItemHeight,

    // 位置计算
    calculateDropPosition,
    findNearestCompatibleTrack,
    isMediaCompatibleWithTrack,

    // 类型检查
    getDragDataType,

    // DOM查询工具
    getTimelineItemElement,
    getMediaItemElement,
    getTrackElement,
    getElementDimensions,
  }
}

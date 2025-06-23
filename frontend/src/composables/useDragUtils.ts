import { useVideoStore } from '../stores/videoStore'
import type { TimelineItemDragData, MediaItemDragData } from '../types/videoTypes'
import { alignTimeToFrame } from '../stores/utils/timeUtils'

/**
 * 拖拽工具函数集合
 * 提供统一的拖拽处理逻辑，避免代码重复
 */
export function useDragUtils() {
  const videoStore = useVideoStore()

  /**
   * 设置时间轴项目拖拽数据
   */
  function setTimelineItemDragData(
    event: DragEvent,
    itemId: string,
    trackId: number,
    startTime: number,
    selectedItems: string[],
    dragOffset: { x: number, y: number }
  ) {
    const dragData: TimelineItemDragData = {
      type: 'timeline-item',
      itemId,
      trackId,
      startTime,
      selectedItems,
      dragOffset
    }

    // 设置拖拽数据
    event.dataTransfer!.setData('application/timeline-item', JSON.stringify(dragData))
    event.dataTransfer!.effectAllowed = 'move'

    // 设置全局拖拽状态（用于dragover事件中访问）
    ;(window as any).__timelineDragData = dragData

    return dragData
  }

  /**
   * 设置素材库拖拽数据
   */
  function setMediaItemDragData(
    event: DragEvent,
    mediaItemId: string,
    name: string,
    duration: number,
    mediaType: 'video' | 'image'
  ) {
    const dragData: MediaItemDragData = {
      type: 'media-item',
      mediaItemId,
      name,
      duration,
      mediaType
    }

    // 设置拖拽数据
    event.dataTransfer!.setData('application/media-item', JSON.stringify(dragData))
    event.dataTransfer!.effectAllowed = 'copy'

    // 设置全局拖拽状态
    ;(window as any).__mediaDragData = dragData

    return dragData
  }

  /**
   * 获取当前时间轴项目拖拽数据
   */
  function getCurrentTimelineItemDragData(): TimelineItemDragData | null {
    return (window as any).__timelineDragData || null
  }

  /**
   * 获取当前素材库拖拽数据
   */
  function getCurrentMediaItemDragData(): MediaItemDragData | null {
    return (window as any).__mediaDragData || null
  }

  /**
   * 清理拖拽数据
   */
  function clearDragData() {
    ;(window as any).__timelineDragData = null
    ;(window as any).__mediaDragData = null
  }

  /**
   * 确保项目被选中（拖拽开始时调用）
   */
  function ensureItemSelected(itemId: string) {
    if (!videoStore.selectedTimelineItemIds.has(itemId)) {
      videoStore.selectTimelineItem(itemId)
    }
  }

  /**
   * 创建拖拽预览的基础数据
   */
  function createDragPreviewData(
    name: string,
    duration: number,
    startTime: number,
    trackId: number,
    isConflict: boolean = false,
    isMultiple: boolean = false,
    count?: number
  ) {
    return {
      name,
      duration,
      startTime,
      trackId,
      isConflict,
      isMultiple,
      count
    }
  }

  /**
   * 计算拖拽目标位置
   */
  function calculateDropPosition(
    event: DragEvent,
    timelineWidth: number,
    dragOffset?: { x: number, y: number }
  ) {
    const targetElement = event.target as HTMLElement
    const trackContent = targetElement.closest('.track-content')
    
    if (!trackContent) {
      return null
    }

    const rect = trackContent.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const targetTrackId = parseInt(trackContent.getAttribute('data-track-id') || '1')

    let dropTime: number
    if (dragOffset) {
      // 考虑拖拽偏移量，计算clip的实际开始位置
      const clipStartX = mouseX - dragOffset.x
      dropTime = videoStore.pixelToTime(clipStartX, timelineWidth)
    } else {
      // 直接使用鼠标位置
      dropTime = videoStore.pixelToTime(mouseX, timelineWidth)
    }

    // 确保拖拽时间不会小于0（防止clip被拖拽到负数时间轴）
    dropTime = Math.max(0, dropTime)

    // 对齐到帧边界（与播放头拖拽和时间刻度点击保持一致）
    dropTime = alignTimeToFrame(dropTime, videoStore.frameRate)

    return {
      dropTime,
      targetTrackId,
      trackContent
    }
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

  function getTrackElement(trackId: number): HTMLElement | null {
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
      height: element.offsetHeight
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

    // 位置计算
    calculateDropPosition,

    // 类型检查
    getDragDataType,

    // DOM查询工具
    getTimelineItemElement,
    getMediaItemElement,
    getTrackElement,
    getElementDimensions,
  }
}

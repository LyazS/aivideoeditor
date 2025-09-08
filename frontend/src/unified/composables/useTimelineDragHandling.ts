import { useUnifiedStore } from '@/unified/unifiedStore'
import {
  usePlaybackControls,
  getDragPreviewManager,
  useDragUtils,
  useDialogs,
} from '@/unified/composables'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import type { MediaType } from '@/unified/mediaitem/types'
import type { TimelineItemDragData, MediaItemDragData, ConflictInfo } from '@/unified/types'
import type { Ref } from 'vue'
import { UnifiedMediaItemQueries } from '@/unified/mediaitem'

/**
 * 时间轴拖拽处理模块
 * 提供时间轴拖拽相关的处理功能，包括拖拽悬停、放置等操作
 */
export function useTimelineDragHandling(
  timelineBody: Ref<HTMLElement | undefined>,
  timelineWidth: Ref<number>,
  dragPreviewManager: ReturnType<typeof getDragPreviewManager>,
  detectMediaItemConflicts: (
    dropTime: number,
    targetTrackId: string,
    duration: number,
    trackItems: UnifiedTimelineItemData[],
    excludeItems?: string[],
  ) => ConflictInfo[],
  detectTimelineConflicts: (
    dropTime: number,
    targetTrackId: string,
    dragData: TimelineItemDragData,
    trackItems: UnifiedTimelineItemData[],
  ) => ConflictInfo[],
  createMediaClipFromMediaItem: (
    mediaItemId: string,
    startTimeFrames: number,
    trackId?: string,
  ) => Promise<void>,
  moveSingleItem: (itemId: string, newTimeFrames: number, newTrackId: string) => Promise<void>,
  moveMultipleItems: (
    itemIds: string[],
    newTimeFrames: number,
    newTrackId: string,
    originalStartTimeFrames: number,
  ) => Promise<void>,
) {
  const unifiedStore = useUnifiedStore()
  const dialogs = useDialogs()
  const dragUtils = useDragUtils()
  const { pauseForEditing } = usePlaybackControls()
  /**
   * 处理拖拽悬停
   * @param event 拖拽事件
   */
  function handleDragOver(event: DragEvent) {
    event.preventDefault()

    // 使用统一的拖拽工具检查数据类型
    const dragType = dragUtils.getDragDataType(event)

    switch (dragType) {
      case 'timeline-item':
        event.dataTransfer!.dropEffect = 'move'
        handleTimelineItemDragOver(event)
        break
      case 'media-item':
        event.dataTransfer!.dropEffect = 'copy'
        handleMediaItemDragOver(event)
        break
      case 'files':
        // 文件拖拽，但我们不再支持直接文件拖拽
        event.dataTransfer!.dropEffect = 'none'
        dragPreviewManager.hidePreview()
        break
      default:
        event.dataTransfer!.dropEffect = 'copy'
        dragPreviewManager.hidePreview()
        break
    }
  }

  /**
   * 处理素材库拖拽悬停
   * @param event 拖拽事件
   */
  function handleMediaItemDragOver(event: DragEvent) {
    // 使用统一的拖拽工具计算目标位置
    const dropPosition = dragUtils.calculateDropPosition(event, timelineWidth.value)

    if (!dropPosition) {
      dragPreviewManager.hidePreview()
      return
    }

    const { dropTime, targetTrackId } = dropPosition

    // 执行吸附计算
    console.log('🧲 [TimelineDrag] 执行吸附计算，原始位置:', dropTime)
    console.log('🧲 [TimelineDrag] 吸附功能状态:', unifiedStore.isSnapEnabled)
    console.log('🧲 [TimelineDrag] 时间轴宽度:', timelineWidth.value)
    console.log('🧲 [TimelineDrag] 时间轴项目数量:', unifiedStore.timelineItems.length)
    
    const timelineItems = unifiedStore.timelineItems
    console.log('🧲 [TimelineDrag] 时间轴项目详情:', timelineItems.map(item => {
      let name = 'Clip'
      if (item.config && typeof item.config === 'object' && 'name' in item.config) {
        name = String(item.config.name)
      }
      return {
        id: item.id,
        name: name,
        start: item.timeRange.timelineStartTime,
        end: item.timeRange.timelineEndTime,
        mediaType: item.mediaType
      }
    }))
    
    const snapResult = unifiedStore.calculateSnapWithTimelineItems(
      dropTime,
      timelineItems,
      {},
      unifiedStore.frameToPixel,
      timelineWidth.value
    )
    
    console.log('🧲 [TimelineDrag] 吸附结果:', JSON.stringify(snapResult, null, 2))
    
    const finalDropTime = snapResult.snapped ? snapResult.frame : dropTime
    if (snapResult.snapped) {
      console.log(`🧲 [TimelineDrag] 吸附成功：从 ${dropTime} 到 ${finalDropTime}`)
    }

    // 使用统一的拖拽工具获取素材拖拽数据
    const mediaDragData = dragUtils.getCurrentMediaItemDragData()
    if (mediaDragData) {
      // 获取素材项目以检查状态
      const mediaItem = unifiedStore.getMediaItem(mediaDragData.mediaItemId)
      const isReady = mediaItem ? UnifiedMediaItemQueries.isReady(mediaItem) : false
      const isLoading = mediaItem ? UnifiedMediaItemQueries.isProcessing(mediaItem) : false
      const hasError = mediaItem ? UnifiedMediaItemQueries.hasError(mediaItem) : false

      // 检测素材库拖拽的重叠冲突
      const trackItems = unifiedStore.getTimelineItemsByTrack(targetTrackId)
      const conflicts = detectMediaItemConflicts(
        finalDropTime,
        targetTrackId,
        mediaDragData.duration,
        trackItems,
      )
      const isConflict = conflicts.length > 0

      // 使用统一的拖拽工具创建预览数据，包含状态信息
      const previewData = dragUtils.createDragPreviewData(
        mediaDragData.name,
        mediaDragData.duration,
        finalDropTime,
        targetTrackId,
        isConflict,
        false,
        undefined,
        mediaDragData.mediaType,
        { isReady, isLoading, hasError }, // 新增状态信息
      )

      dragPreviewManager.updatePreview(previewData, timelineWidth.value)
    } else {
      // 显示默认预览
      const previewData = dragUtils.createDragPreviewData(
        '素材预览',
        5,
        finalDropTime,
        targetTrackId,
        false,
        false,
        undefined,
        'video', // 默认使用视频类型
      )

      dragPreviewManager.updatePreview(previewData, timelineWidth.value)
    }
  }

  /**
   * 处理时间轴项目拖拽悬停
   * @param event 拖拽事件
   */
  function handleTimelineItemDragOver(event: DragEvent) {
    // 使用统一的拖拽工具获取当前拖拽数据
    const currentDragData = dragUtils.getCurrentTimelineItemDragData()
    if (!currentDragData) {
      dragPreviewManager.hidePreview()
      return
    }

    // 使用统一的拖拽工具计算目标位置（考虑拖拽偏移量）
    const dropPosition = dragUtils.calculateDropPosition(
      event,
      timelineWidth.value,
      currentDragData.dragOffset,
    )

    if (!dropPosition) {
      dragPreviewManager.hidePreview()
      return
    }

    const { dropTime: clipStartTime, targetTrackId } = dropPosition

    // 执行吸附计算
    const excludeClipIds = currentDragData?.selectedItems || []
    console.log('🧲 [TimelineDrag-Item] 执行吸附计算，原始位置:', clipStartTime)
    console.log('🧲 [TimelineDrag-Item] 排除的片段ID:', excludeClipIds)
    
    const timelineItems = unifiedStore.timelineItems
    console.log('🧲 [TimelineDrag-Item] 可用时间轴项目数量:', timelineItems.length)
    
    const snapResult = unifiedStore.calculateSnapWithTimelineItems(
      clipStartTime,
      timelineItems,
      { excludeClipIds },
      unifiedStore.frameToPixel,
      timelineWidth.value
    )
    console.log('🧲 [TimelineDrag-Item] 吸附结果:', JSON.stringify(snapResult, null, 2))
    
    const finalClipStartTime = snapResult.snapped ? snapResult.frame : clipStartTime

    // 获取拖拽项目信息
    const draggedItem = unifiedStore.getTimelineItem(currentDragData.itemId)
    if (draggedItem) {
      const duration =
        draggedItem.timeRange.timelineEndTime - draggedItem.timeRange.timelineStartTime // 帧数

      // 检测冲突
      const trackItems = unifiedStore.getTimelineItemsByTrack(targetTrackId)
      const conflicts = detectTimelineConflicts(
        finalClipStartTime,
        targetTrackId,
        currentDragData,
        trackItems,
      )
      const isConflict = conflicts.length > 0

      // 获取显示名称
      let name = 'Clip'
      if ('config' in draggedItem && draggedItem.config && 'name' in draggedItem.config) {
        // 异步处理时间轴项目：从配置中获取名称
        name = draggedItem.config.name as string
      } else if ('mediaItemId' in draggedItem) {
        // 本地时间轴项目：从媒体项目中获取名称
        const mediaItem = unifiedStore.getMediaItem(draggedItem.mediaItemId)
        name = mediaItem?.name || 'Clip'
      }

      // 使用统一的拖拽工具创建预览数据
      const previewData = dragUtils.createDragPreviewData(
        name,
        duration,
        finalClipStartTime,
        targetTrackId,
        isConflict,
        currentDragData.selectedItems.length > 1,
        currentDragData.selectedItems.length,
        draggedItem.mediaType,
      )

      dragPreviewManager.updatePreview(previewData, timelineWidth.value)
    } else {
      dragPreviewManager.hidePreview()
    }
  }

  /**
   * 处理拖拽放置
   * @param event 拖拽事件
   */
  async function handleDrop(event: DragEvent) {
    event.preventDefault()
    console.log('🎯 [UnifiedTimeline] 时间轴接收到拖拽事件')

    // 清理统一预览
    dragPreviewManager.hidePreview()

    // 暂停播放以便进行拖拽操作
    pauseForEditing('时间轴拖拽放置')

    // 使用统一的拖拽工具检查数据类型
    const dragType = dragUtils.getDragDataType(event)

    switch (dragType) {
      case 'timeline-item': {
        const timelineItemData = event.dataTransfer?.getData('application/timeline-item')
        if (timelineItemData) {
          console.log('📦 [UnifiedTimeline] 处理时间轴项目拖拽')
          await handleTimelineItemDrop(event, JSON.parse(timelineItemData))
        }
        break
      }
      case 'media-item': {
        const mediaItemData = event.dataTransfer?.getData('application/media-item')
        if (mediaItemData) {
          console.log('📦 [UnifiedTimeline] 处理素材库拖拽')
          await handleMediaItemDrop(event, JSON.parse(mediaItemData))
        }
        break
      }
      default:
        console.log('❌ [UnifiedTimeline] 没有检测到有效的拖拽数据')
        dialogs.showInfo('请先将视频或图片文件导入到素材库，然后从素材库拖拽到时间轴')
        break
    }

    // 使用统一的拖拽工具清理全局拖拽状态
    dragUtils.clearDragData()
  }

  /**
   * 处理时间轴项目拖拽放置
   * @param event 拖拽事件
   * @param dragData 拖拽数据
   */
  async function handleTimelineItemDrop(event: DragEvent, dragData: TimelineItemDragData) {
    console.log('🎯 [UnifiedTimeline] 处理时间轴项目拖拽放置:', dragData)

    // 使用统一的拖拽工具计算目标位置（考虑拖拽偏移量）
    const dropPosition = dragUtils.calculateDropPosition(
      event,
      timelineWidth.value,
      dragData.dragOffset,
    )

    if (!dropPosition) {
      console.error('❌ [UnifiedTimeline] 无法找到目标轨道')
      return
    }

    const { dropTime, targetTrackId } = dropPosition

    // 执行吸附计算
    const currentDragData = dragUtils.getCurrentTimelineItemDragData()
    const excludeClipIds = currentDragData?.selectedItems || []
    const snapResult = unifiedStore.calculateSnapWithTimelineItems(
      dropTime,
      unifiedStore.timelineItems,
      { excludeClipIds },
      unifiedStore.frameToPixel,
      timelineWidth.value
    )
    const finalDropTime = snapResult.snapped ? snapResult.frame : dropTime

    // 验证轨道类型兼容性
    const draggedItem = unifiedStore.getTimelineItem(dragData.itemId)
    if (draggedItem) {
      const targetTrack = unifiedStore.tracks.find((t) => t.id === targetTrackId)
      // unknown类型的素材不能拖拽到任何轨道
      if (
        targetTrack &&
        !dragUtils.isMediaCompatibleWithTrack(draggedItem.mediaType as MediaType, targetTrack.type)
      ) {
        // 获取媒体类型标签
        const mediaTypeLabels = {
          video: '视频',
          image: '图片',
          audio: '音频',
          text: '文本',
        }
        const mediaTypeLabel = mediaTypeLabels[draggedItem.mediaType as MediaType] || '未知'
        const trackTypeLabel =
          targetTrack.type === 'video'
            ? '视频'
            : targetTrack.type === 'audio'
              ? '音频'
              : targetTrack.type === 'text'
                ? '文本'
                : '未知'

        // 根据媒体类型提供合适的建议
        let suggestion = ''
        switch (draggedItem.mediaType) {
          case 'video':
          case 'image':
            suggestion = '请将该片段拖拽到视频轨道。'
            break
          case 'audio':
            suggestion = '请将该片段拖拽到音频轨道。'
            break
          case 'text':
            suggestion = '请将该片段拖拽到文本轨道。'
            break
          default:
            suggestion = '请将该片段拖拽到兼容的轨道。'
        }

        dialogs.showError(
          `${mediaTypeLabel}片段不能拖拽到${trackTypeLabel}轨道上。\n${suggestion}`,
        )
        return
      }
    }

    console.log('📍 [UnifiedTimeline] 拖拽目标位置:', {
      dragOffsetX: dragData.dragOffset.x,
      dropTime: dropTime.toFixed(2),
      targetTrackId,
      selectedItems: dragData.selectedItems,
    })

    // 执行移动操作
    try {
      if (dragData.selectedItems.length > 1) {
        // 多选拖拽
        console.log('🔄 [UnifiedTimeline] 执行多选项目移动')
        await moveMultipleItems(dragData.selectedItems, finalDropTime, targetTrackId, dragData.startTime)
      } else {
        // 单个拖拽
        console.log('🔄 [UnifiedTimeline] 执行单个项目移动')
        await moveSingleItem(dragData.itemId, finalDropTime, targetTrackId)
      }
      console.log('✅ [UnifiedTimeline] 时间轴项目移动完成')
    } catch (error) {
      console.error('❌ [UnifiedTimeline] 时间轴项目移动失败:', error)
    }
  }

  /**
   * 处理素材库拖拽放置
   * @param event 拖拽事件
   * @param mediaDragData 素材拖拽数据
   */
  async function handleMediaItemDrop(event: DragEvent, mediaDragData: MediaItemDragData) {
    try {
      console.log('解析的素材拖拽数据:', mediaDragData)

      // 从store中获取完整的MediaItem信息
      const mediaItem = unifiedStore.getMediaItem(mediaDragData.mediaItemId)

      if (!mediaItem) {
        console.error('❌ 找不到对应的素材项目:', mediaDragData.mediaItemId)
        return
      }

      // 使用统一的拖拽工具计算目标位置
      const dropPosition = dragUtils.calculateDropPosition(event, timelineWidth.value)

      if (!dropPosition) {
        console.error('无法获取轨道区域信息')
        return
      }

      // 验证轨道类型兼容性
      const targetTrack = unifiedStore.tracks.find((t) => t.id === dropPosition.targetTrackId)
      if (!targetTrack) {
        console.error('❌ 目标轨道不存在:', dropPosition.targetTrackId)
        return
      }

      // 文本类型不支持从素材库拖拽创建
      if (mediaItem.mediaType === 'text') {
        dialogs.showError(
          '文本内容不能通过拖拽创建。\n请在文本轨道中右键选择"添加文本"。',
        )
        return
      }

      // 检查素材类型与轨道类型的兼容性
      if (
        !dragUtils.isMediaCompatibleWithTrack(mediaItem.mediaType as MediaType, targetTrack.type)
      ) {
        // 获取媒体类型标签
        const mediaTypeLabels: Record<MediaType, string> = {
          video: '视频',
          image: '图片',
          audio: '音频',
          text: '文本',
        }
        const mediaTypeLabel = mediaTypeLabels[mediaItem.mediaType as MediaType] || '未知'
        const trackTypeLabel =
          targetTrack.type === 'video'
            ? '视频'
            : targetTrack.type === 'audio'
              ? '音频'
              : targetTrack.type === 'text'
                ? '文本'
                : '未知'

        // 根据媒体类型提供合适的建议
        let suggestion = ''
        switch (mediaItem.mediaType) {
          case 'video':
          case 'image':
            suggestion = '请将该素材拖拽到视频轨道。'
            break
          case 'audio':
            suggestion = '请将该素材拖拽到音频轨道。'
            break
          default:
            suggestion = '请将该素材拖拽到兼容的轨道。'
        }

        dialogs.showError(
          `${mediaTypeLabel}素材不能拖拽到${trackTypeLabel}轨道上。\n${suggestion}`,
        )
        return
      }

      const { dropTime, targetTrackId } = dropPosition

      // 执行吸附计算（素材拖拽也需要吸附）
      const snapResult = unifiedStore.calculateSnapWithTimelineItems(
        dropTime,
        unifiedStore.timelineItems,
        {},
        unifiedStore.frameToPixel,
        timelineWidth.value
      )
      const finalDropTime = snapResult.snapped ? snapResult.frame : dropTime

      console.log(`🎯 拖拽素材到时间轴: ${mediaDragData.name}`)
      console.log(`📍 拖拽位置: 对应帧数: ${finalDropTime}, 目标轨道: ${targetTrackId}`)

      // 如果拖拽位置超出当前时间轴长度，动态扩展时间轴
      const bufferFrames = 300 // 预留10秒缓冲（300帧）
      unifiedStore.expandTimelineIfNeededFrames(finalDropTime + bufferFrames)

      await createMediaClipFromMediaItem(mediaItem.id, finalDropTime, targetTrackId)
    } catch (error) {
      console.error('Failed to parse media item data:', error)
      dialogs.showError('拖拽失败：拖拽数据格式错误')
    }
  }

  /**
   * 处理拖拽离开事件
   * @param event 拖拽事件
   */
  function handleDragLeave(event: DragEvent) {
    // 只有当真正离开时间轴区域时才隐藏预览
    const relatedTarget = event.relatedTarget as Element
    const timelineElement = event.currentTarget as Element

    if (!timelineElement.contains(relatedTarget)) {
      dragPreviewManager.hidePreview()
    }
    
    // 清除当前吸附结果
    unifiedStore.clearCurrentSnap()
  }

  return {
    // 方法
    handleDragOver,
    handleMediaItemDragOver,
    handleTimelineItemDragOver,
    handleDrop,
    handleTimelineItemDrop,
    handleMediaItemDrop,
    handleDragLeave,
  }
}

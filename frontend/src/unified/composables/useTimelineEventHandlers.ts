import { useUnifiedStore } from '@/unified/unifiedStore'
import { usePlaybackControls } from '@/unified/composables'
import type { Ref } from 'vue'

/**
 * 时间轴事件处理模块
 * 提供时间轴相关的事件处理功能，包括点击、滚轮、键盘等事件
 */
export function useTimelineEventHandlers(
  timelineBody: Ref<HTMLElement | undefined>,
  timelineWidth: Ref<number>,
  handleTimelineItemRemove: (timelineItemId: string) => Promise<void>
) {
  const unifiedStore = useUnifiedStore()
  const { pauseForEditing } = usePlaybackControls()

  /**
   * 处理时间轴容器点击事件
   * 点击时间轴容器的空白区域取消所有选中
   */
  function handleTimelineContainerClick(event: MouseEvent) {
    // 点击时间轴容器的空白区域取消所有选中
    const target = event.target as HTMLElement

    // 检查点击的是否是时间轴容器本身或其他空白区域
    // 排除点击在VideoClip、按钮、输入框等交互元素上的情况
    if (
      target.classList.contains('timeline') ||
      target.classList.contains('timeline-header') ||
      target.classList.contains('timeline-body') ||
      target.classList.contains('timeline-grid') ||
      target.classList.contains('grid-line') ||
      target.classList.contains('track-row')
    ) {
      try {
        // 使用带历史记录的清除选择
        unifiedStore.selectTimelineItemsWithHistory([], 'replace')
      } catch (error) {
        console.error('❌ 清除选择操作失败:', error)
        // 如果历史记录清除失败，回退到普通清除
        unifiedStore.clearAllSelections()
      }
    }
  }

  /**
   * 处理滚轮事件
   * 支持Alt+滚轮缩放、Shift+滚轮水平滚动
   */
  function handleWheel(event: WheelEvent) {
    if (event.altKey) {
      // Alt + 滚轮：缩放
      event.preventDefault()
      const zoomFactor = 1.1
      const rect = timelineBody.value?.getBoundingClientRect()
      if (!rect) {
        console.error('❌ 无法获取时间轴主体边界')
        return
      }

      // 获取鼠标在时间轴上的位置（减去轨道控制区域的150px）
      const mouseX = event.clientX - rect.left - 150
      const mouseFrames = unifiedStore.pixelToFrame(mouseX, timelineWidth.value)

      if (event.deltaY < 0) {
        // 向上滚动：放大
        unifiedStore.zoomIn(zoomFactor, timelineWidth.value)
      } else {
        // 向下滚动：缩小
        unifiedStore.zoomOut(zoomFactor, timelineWidth.value)
      }

      // 调整滚动偏移量，使鼠标位置保持在相同的帧数点
      const newMousePixel = unifiedStore.frameToPixel(mouseFrames, timelineWidth.value)
      const offsetAdjustment = newMousePixel - mouseX
      const newScrollOffset = unifiedStore.scrollOffset + offsetAdjustment

      unifiedStore.setScrollOffset(newScrollOffset, timelineWidth.value)
    } else if (event.shiftKey) {
      // Shift + 滚轮：水平滚动
      event.preventDefault()
      const scrollAmount = 50

      if (event.deltaX < 0) {
        // 向上滚动：向左滚动
        unifiedStore.scrollLeft(scrollAmount, timelineWidth.value)
      } else {
        // 向下滚动：向右滚动
        unifiedStore.scrollRight(scrollAmount, timelineWidth.value)
      }
    } else {
      // 普通滚轮：垂直滚动（让浏览器处理默认的滚动行为）
      // 不阻止默认行为，允许正常的垂直滚动
    }
  }

  /**
   * 处理时间轴点击事件
   * 点击轨道内容空白区域取消所有选中（包括单选和多选）
   */
  async function handleTimelineClick(event: MouseEvent) {
    // 点击轨道内容空白区域取消所有选中（包括单选和多选）
    const target = event.target as HTMLElement
    if (target.classList.contains('track-content')) {
      // 阻止事件冒泡，避免触发容器的点击事件
      event.stopPropagation()

      try {
        // 使用带历史记录的清除选择
        await unifiedStore.selectTimelineItemsWithHistory([], 'replace')
      } catch (error) {
        console.error('❌ 清除选择操作失败:', error)
        // 如果历史记录清除失败，回退到普通清除
        unifiedStore.clearAllSelections()
      }
    }
  }

  /**
   * 处理片段选中事件
   */
  function handleSelectClip(clipId: string) {
    console.log('🎯 [UnifiedTimeline] 选中clip:', clipId)
    try {
      // 使用unifiedStore的选择方法
      unifiedStore.selectTimelineItem(clipId)
    } catch (error) {
      console.error('❌ 选中clip失败:', error)
    }
  }

  /**
   * 处理时间轴项目双击事件
   */
  function handleTimelineItemDoubleClick(id: string) {
    // 处理时间轴项目双击
    console.log('Timeline item double click:', id)
  }

  /**
   * 处理时间轴项目调整大小开始事件
   */
  function handleTimelineItemResizeStart(
    event: MouseEvent,
    itemId: string,
    direction: 'left' | 'right',
  ) {
    // 处理时间轴项目调整大小开始
    console.log('🔧 [UnifiedTimeline] 时间轴项目开始调整大小:', {
      itemId,
      direction,
      clientX: event.clientX,
      clientY: event.clientY,
    })

    // 暂停播放以便进行编辑
    pauseForEditing('片段大小调整')

    // 确保项目被选中（如果还没有选中的话）
    if (!unifiedStore.isTimelineItemSelected(itemId)) {
      unifiedStore.selectTimelineItem(itemId)
    }
  }

  /**
   * 处理键盘事件
   */
  function handleKeyDown(event: KeyboardEvent) {
    // 检查是否有修饰键，如果有则不处理（让全局快捷键处理）
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return
    }

    // 按 Escape 键取消选中
    if (event.key === 'Escape') {
      unifiedStore.selectTimelineItem(null)
    }

    // 按 Delete 键删除选中的项目
    if (event.key === 'Delete') {
      const selectedItems = unifiedStore.selectedTimelineItemIds
      if (selectedItems.size > 0) {
        selectedItems.forEach((itemId: string) => {
          handleTimelineItemRemove(itemId)
        })
      }
    }
  }

  return {
    // 方法
    handleTimelineContainerClick,
    handleWheel,
    handleTimelineClick,
    handleSelectClip,
    handleTimelineItemDoubleClick,
    handleTimelineItemResizeStart,
    handleKeyDown,
  }
}
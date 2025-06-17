import { ref, type Raw, type Ref } from 'vue'
import type { TimelineItem } from '../../types/videoTypes'
import { findTimelineItemBySprite } from '../utils/storeUtils'

// 定义CustomVisibleSprite类型（避免循环依赖）
type CustomVisibleSprite = {
  destroy: () => void
  [key: string]: unknown
}

/**
 * 选择管理模块
 * 负责管理时间轴和AVCanvas的选择状态同步
 */
export function createSelectionModule(timelineItems: Ref<TimelineItem[]>, avCanvas: Ref<{ activeSprite: unknown } | null>) {
  // ==================== 状态定义 ====================

  // 选择状态
  const selectedTimelineItemId = ref<string | null>(null) // 当前选中的时间轴项ID
  const selectedAVCanvasSprite = ref<Raw<CustomVisibleSprite> | null>(null) // 当前在AVCanvas中选中的sprite

  // ==================== 选择管理方法 ====================

  /**
   * 选择时间轴项目
   * @param timelineItemId 时间轴项目ID，null表示取消选择
   */
  function selectTimelineItem(timelineItemId: string | null) {
    const oldSelection = selectedTimelineItemId.value
    selectedTimelineItemId.value = timelineItemId

    console.log('🎯 选择时间轴项目:', {
      oldSelection,
      newSelection: timelineItemId,
      selectionChanged: oldSelection !== timelineItemId,
    })

    // 同步选择AVCanvas中的sprite
    if (timelineItemId) {
      const timelineItem = getTimelineItem(timelineItemId)
      if (timelineItem) {
        selectAVCanvasSprite(timelineItem.sprite, false) // false表示不触发反向同步
        console.log('🔗 同步选择AVCanvas sprite:', timelineItem.sprite)
      }
    } else {
      // 取消时间轴选择时，同步取消AVCanvas选择
      selectAVCanvasSprite(null, false)
      console.log('🔗 同步取消AVCanvas选择')
    }
  }

  /**
   * 选择AVCanvas中的sprite
   * @param sprite CustomVisibleSprite实例或null
   * @param syncToTimeline 是否同步到时间轴选择
   */
  function selectAVCanvasSprite(
    sprite: Raw<CustomVisibleSprite> | null,
    syncToTimeline: boolean = true,
  ) {
    const oldSprite = selectedAVCanvasSprite.value
    selectedAVCanvasSprite.value = sprite

    console.log('🎨 选择AVCanvas sprite:', {
      hasOldSprite: !!oldSprite,
      hasNewSprite: !!sprite,
      syncToTimeline,
      selectionChanged: oldSprite !== sprite,
    })

    // 获取AVCanvas实例并设置活动sprite
    const canvas = avCanvas.value
    if (canvas) {
      try {
        // 直接设置activeSprite属性
        canvas.activeSprite = sprite
        console.log('✅ 设置AVCanvas活动sprite成功')
      } catch (error) {
        console.warn('⚠️ 设置AVCanvas活动sprite失败:', error)
      }
    } else {
      console.warn('⚠️ AVCanvas不可用，无法设置活动sprite')
    }

    // 同步到时间轴选择（如果需要）
    if (syncToTimeline) {
      if (sprite) {
        // 根据sprite查找对应的timelineItem
        const timelineItem = findTimelineItemBySprite(sprite, timelineItems.value)
        if (timelineItem) {
          selectedTimelineItemId.value = timelineItem.id
          console.log('🔗 同步选择时间轴项目:', timelineItem.id)
        } else {
          console.warn('⚠️ 未找到对应的时间轴项目')
        }
      }
      // 注意：当sprite为null时，我们不自动取消时间轴选择，
      // 因为用户要求"取消avcanvas选中片段的时候，要保留时间轴的选中状态"
    }
  }

  /**
   * 处理来自AVCanvas的sprite选择变化
   * 这个方法用于响应AVCanvas内部的选择变化事件
   * @param sprite 新选择的sprite或null
   */
  function handleAVCanvasSpriteChange(sprite: Raw<CustomVisibleSprite> | null) {
    console.log('📡 处理AVCanvas sprite选择变化:', { hasSprite: !!sprite })

    // 更新AVCanvas选择状态，但不触发反向同步（避免循环）
    selectedAVCanvasSprite.value = sprite

    // 同步到时间轴选择
    if (sprite) {
      const timelineItem = findTimelineItemBySprite(sprite, timelineItems.value)
      if (timelineItem) {
        selectedTimelineItemId.value = timelineItem.id
        console.log('🔗 同步选择时间轴项目:', timelineItem.id)
      } else {
        console.warn('⚠️ 未找到对应的时间轴项目')
      }
    }
    // 注意：当sprite为null时，保留时间轴选择状态
  }

  /**
   * 清除所有选择
   */
  function clearAllSelections() {
    console.log('🧹 清除所有选择')
    selectedTimelineItemId.value = null
    selectAVCanvasSprite(null, false)
  }

  /**
   * 切换时间轴项目的选择状态
   * @param timelineItemId 时间轴项目ID
   */
  function toggleTimelineItemSelection(timelineItemId: string) {
    if (selectedTimelineItemId.value === timelineItemId) {
      selectTimelineItem(null) // 取消选择
    } else {
      selectTimelineItem(timelineItemId) // 选择
    }
  }

  /**
   * 检查时间轴项目是否被选中
   * @param timelineItemId 时间轴项目ID
   * @returns 是否被选中
   */
  function isTimelineItemSelected(timelineItemId: string): boolean {
    return selectedTimelineItemId.value === timelineItemId
  }

  /**
   * 检查sprite是否被选中
   * @param sprite CustomVisibleSprite实例
   * @returns 是否被选中
   */
  function isSpriteSelected(sprite: Raw<CustomVisibleSprite>): boolean {
    return selectedAVCanvasSprite.value === sprite
  }

  /**
   * 获取当前选中的时间轴项目
   * @returns 选中的时间轴项目或null
   */
  function getSelectedTimelineItem(): TimelineItem | null {
    if (!selectedTimelineItemId.value) return null
    return getTimelineItem(selectedTimelineItemId.value)
  }

  /**
   * 获取选择状态摘要
   * @returns 选择状态摘要对象
   */
  function getSelectionSummary() {
    const selectedItem = getSelectedTimelineItem()
    return {
      hasTimelineSelection: !!selectedTimelineItemId.value,
      hasAVCanvasSelection: !!selectedAVCanvasSprite.value,
      selectedTimelineItemId: selectedTimelineItemId.value,
      selectedTimelineItem: selectedItem
        ? {
            id: selectedItem.id,
            mediaItemId: selectedItem.mediaItemId,
            trackId: selectedItem.trackId,
            startTime: selectedItem.timeRange.timelineStartTime / 1000000,
            endTime: selectedItem.timeRange.timelineEndTime / 1000000,
          }
        : null,
      selectionsInSync: selectedItem
        ? selectedAVCanvasSprite.value === selectedItem.sprite
        : !selectedAVCanvasSprite.value,
    }
  }

  /**
   * 重置选择状态为默认值
   */
  function resetToDefaults() {
    clearAllSelections()
    console.log('🔄 选择状态已重置为默认值')
  }

  // ==================== 辅助方法 ====================

  /**
   * 根据ID获取时间轴项目
   * @param timelineItemId 时间轴项目ID
   * @returns 时间轴项目或undefined
   */
  function getTimelineItem(timelineItemId: string): TimelineItem | undefined {
    return timelineItems.value.find((item) => item.id === timelineItemId)
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    selectedTimelineItemId,
    selectedAVCanvasSprite,

    // 方法
    selectTimelineItem,
    selectAVCanvasSprite,
    handleAVCanvasSpriteChange,
    clearAllSelections,
    toggleTimelineItemSelection,
    isTimelineItemSelected,
    isSpriteSelected,
    getSelectedTimelineItem,
    getSelectionSummary,
    resetToDefaults,
  }
}

// 导出类型定义
export type SelectionModule = ReturnType<typeof createSelectionModule>

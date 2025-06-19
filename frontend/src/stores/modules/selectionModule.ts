import { ref, computed, type Raw, type Ref } from 'vue'
import type { TimelineItem } from '../../types/videoTypes'
import { findTimelineItemBySprite } from '../utils/storeUtils'

// 定义VideoVisibleSprite类型（避免循环依赖）
type VideoVisibleSprite = {
  destroy: () => void
  [key: string]: unknown
}

/**
 * 选择管理模块
 * 负责管理时间轴和AVCanvas的选择状态同步
 */
export function createSelectionModule(timelineItems: Ref<TimelineItem[]>, avCanvas: Ref<{ activeSprite: unknown } | null>) {
  // ==================== 状态定义 ====================

  // 统一选择状态：使用单一集合管理所有选择
  const selectedTimelineItemIds = ref<Set<string>>(new Set()) // 选中项目ID集合
  const selectedAVCanvasSprite = ref<Raw<VideoVisibleSprite> | null>(null) // 当前在AVCanvas中选中的sprite

  // 计算属性：从集合派生的状态
  const selectedTimelineItemId = computed(() => {
    // 单选时返回唯一ID，多选或无选择时返回null
    return selectedTimelineItemIds.value.size === 1
      ? Array.from(selectedTimelineItemIds.value)[0]
      : null
  })

  const isMultiSelectMode = computed(() => selectedTimelineItemIds.value.size > 1)
  const hasSelection = computed(() => selectedTimelineItemIds.value.size > 0)

  // ==================== 选择管理方法 ====================

  /**
   * 统一的时间轴项目选择方法
   * @param itemIds 要操作的项目ID数组
   * @param mode 操作模式：'replace'替换选择，'toggle'切换选择状态
   */
  function selectTimelineItems(itemIds: string[], mode: 'replace' | 'toggle' = 'replace') {
    const oldSelection = new Set(selectedTimelineItemIds.value)

    if (mode === 'replace') {
      // 替换模式：清空现有选择，设置新选择
      selectedTimelineItemIds.value.clear()
      itemIds.forEach(id => selectedTimelineItemIds.value.add(id))
    } else {
      // 切换模式：切换每个项目的选择状态
      itemIds.forEach(id => {
        if (selectedTimelineItemIds.value.has(id)) {
          selectedTimelineItemIds.value.delete(id)
        } else {
          selectedTimelineItemIds.value.add(id)
        }
      })
    }

    console.log('🎯 统一选择操作:', {
      mode,
      itemIds,
      oldSize: oldSelection.size,
      newSize: selectedTimelineItemIds.value.size,
      isMultiSelect: isMultiSelectMode.value,
      oldSelection: Array.from(oldSelection),
      newSelection: Array.from(selectedTimelineItemIds.value)
    })

    // 统一的AVCanvas同步逻辑
    syncAVCanvasSelection()
  }

  /**
   * AVCanvas选择同步逻辑
   */
  function syncAVCanvasSelection() {
    if (selectedTimelineItemIds.value.size === 1) {
      // 单选：同步到AVCanvas
      const itemId = Array.from(selectedTimelineItemIds.value)[0]
      const timelineItem = getTimelineItem(itemId)
      if (timelineItem) {
        selectAVCanvasSprite(timelineItem.sprite as any, false)
        console.log('🔗 单选模式：同步AVCanvas sprite')
      }
    } else {
      // 无选择或多选：清除AVCanvas选择
      selectAVCanvasSprite(null, false)
      console.log('🔗 多选/无选择模式：清除AVCanvas选择')
    }
  }

  /**
   * 兼容性方法：选择单个时间轴项目
   * @param timelineItemId 时间轴项目ID，null表示取消选择
   */
  function selectTimelineItem(timelineItemId: string | null) {
    if (timelineItemId) {
      selectTimelineItems([timelineItemId], 'replace')
    } else {
      selectTimelineItems([], 'replace')
    }
  }

  /**
   * 选择AVCanvas中的sprite
   * @param sprite VideoVisibleSprite实例或null
   * @param syncToTimeline 是否同步到时间轴选择
   */
  function selectAVCanvasSprite(
    sprite: Raw<VideoVisibleSprite> | null,
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
          // 使用统一API选择对应的时间轴项目
          selectTimelineItems([timelineItem.id], 'replace')
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
  function handleAVCanvasSpriteChange(sprite: Raw<VideoVisibleSprite> | null) {
    console.log('📡 处理AVCanvas sprite选择变化:', { hasSprite: !!sprite })

    // 更新AVCanvas选择状态，但不触发反向同步（避免循环）
    selectedAVCanvasSprite.value = sprite

    // 同步到时间轴选择
    if (sprite) {
      const timelineItem = findTimelineItemBySprite(sprite, timelineItems.value)
      if (timelineItem) {
        // 使用统一API选择对应的时间轴项目
        selectTimelineItems([timelineItem.id], 'replace')
        console.log('🔗 同步选择时间轴项目:', timelineItem.id)
      } else {
        console.warn('⚠️ 未找到对应的时间轴项目')
      }
    }
    // 注意：当sprite为null时，保留时间轴选择状态
  }

  // ==================== 多选管理方法 ====================

  /**
   * 添加项目到选择集合（兼容性方法）
   * @param timelineItemId 时间轴项目ID
   */
  function addToMultiSelection(timelineItemId: string) {
    // 如果项目未选中，则添加它
    if (!selectedTimelineItemIds.value.has(timelineItemId)) {
      selectTimelineItems([timelineItemId], 'toggle')
    }
  }

  /**
   * 从选择集合移除项目（兼容性方法）
   * @param timelineItemId 时间轴项目ID
   */
  function removeFromMultiSelection(timelineItemId: string) {
    // 如果项目已选中，则移除它
    if (selectedTimelineItemIds.value.has(timelineItemId)) {
      selectTimelineItems([timelineItemId], 'toggle')
    }
  }

  /**
   * 切换项目的选择状态（兼容性方法）
   * @param timelineItemId 时间轴项目ID
   */
  function toggleMultiSelection(timelineItemId: string) {
    selectTimelineItems([timelineItemId], 'toggle')
  }

  /**
   * 清空多选集合（兼容性方法）
   */
  function clearMultiSelection() {
    selectTimelineItems([], 'replace')
  }

  /**
   * 检查项目是否在多选集合中
   * @param timelineItemId 时间轴项目ID
   * @returns 是否在多选集合中
   */
  function isInMultiSelection(timelineItemId: string): boolean {
    return selectedTimelineItemIds.value.has(timelineItemId)
  }

  /**
   * 清除所有选择（包括单选和多选）
   */
  function clearAllSelections() {
    selectTimelineItems([], 'replace')
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
   * @param sprite VideoVisibleSprite实例
   * @returns 是否被选中
   */
  function isSpriteSelected(sprite: Raw<VideoVisibleSprite>): boolean {
    return selectedAVCanvasSprite.value === sprite
  }

  /**
   * 获取当前选中的时间轴项目
   * @returns 选中的时间轴项目或null
   */
  function getSelectedTimelineItem(): TimelineItem | null {
    if (!selectedTimelineItemId.value) return null
    return getTimelineItem(selectedTimelineItemId.value) || null
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
        ? (selectedAVCanvasSprite.value as any) === selectedItem.sprite
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
    selectedTimelineItemIds,
    isMultiSelectMode,
    hasSelection,

    // 统一选择API
    selectTimelineItems,
    syncAVCanvasSelection,

    // 兼容性方法
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

    // 多选兼容性方法
    addToMultiSelection,
    removeFromMultiSelection,
    toggleMultiSelection,
    clearMultiSelection,
    isInMultiSelection,
  }
}

// 导出类型定义
export type SelectionModule = ReturnType<typeof createSelectionModule>

import { ref, computed, type Raw, type Ref } from 'vue'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import type { UnifiedMediaItemData } from '@/unified/mediaitem/types'

/**
 * 统一选择管理模块
 * 基于新架构的统一类型系统重构的选择管理功能
 *
 * 主要变化：
 * 1. 使用 UnifiedTimelineItemData 替代原有的 LocalTimelineItem | AsyncProcessingTimelineItem
 * 2. 使用 UnifiedMediaItemData 替代原有的 LocalMediaItem
 * 3. 保持与原有模块相同的API接口，便于迁移
 * 4. 支持统一的时间轴项目选择状态管理
 */
export function createUnifiedSelectionModule(
  getTimelineItem: (id: string) => UnifiedTimelineItemData | undefined,
) {
  // ==================== 状态定义 ====================

  // 统一选择状态：使用单一集合管理所有选择
  const selectedTimelineItemIds = ref<Set<string>>(new Set()) // 选中项目ID集合

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
   * @param withHistory 是否记录到操作历史，默认为true
   */
  function selectTimelineItems(
    itemIds: string[],
    mode: 'replace' | 'toggle' = 'replace',
    withHistory: boolean = true,
  ) {
    const oldSelection = new Set(selectedTimelineItemIds.value)

    if (mode === 'replace') {
      // 替换模式：清空现有选择，设置新选择
      selectedTimelineItemIds.value.clear()
      itemIds.forEach((id) => selectedTimelineItemIds.value.add(id))
    } else {
      // 切换模式：切换每个项目的选择状态
      itemIds.forEach((id) => {
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
      withHistory,
      oldSize: oldSelection.size,
      newSize: selectedTimelineItemIds.value.size,
      isMultiSelect: isMultiSelectMode.value,
      oldSelection: Array.from(oldSelection),
      newSelection: Array.from(selectedTimelineItemIds.value),
    })
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
    return selectedTimelineItemIds.value.has(timelineItemId)
  }

  /**
   * 获取当前选中的时间轴项目
   * @returns 选中的时间轴项目或null
   */
  function getSelectedTimelineItem(): UnifiedTimelineItemData | null {
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

  // ==================== 导出接口 ====================

  return {
    // 状态
    selectedTimelineItemId,
    selectedTimelineItemIds,
    isMultiSelectMode,
    hasSelection,

    // 统一选择API
    selectTimelineItems,

    // 兼容性方法
    selectTimelineItem,
    clearAllSelections,
    toggleTimelineItemSelection,
    isTimelineItemSelected,
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
export type UnifiedSelectionModule = ReturnType<typeof createUnifiedSelectionModule>

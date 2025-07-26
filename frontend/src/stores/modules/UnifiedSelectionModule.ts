import { ref, computed, type Ref } from 'vue'
import type { UnifiedTimelineItem } from '../../unified/timelineitem/types'
import type { UnifiedMediaItemData } from '../../unified/UnifiedMediaItem'
import type { UnifiedCommand } from './UnifiedHistoryModule'
import { UnifiedSelectTimelineItemsCommand } from './commands/UnifiedTimelineCommands'

/**
 * 统一选择管理模块
 * 基于新架构的统一类型设计，负责管理时间轴项目的选择状态
 * 
 * 核心设计理念：
 * - 基于UnifiedTimelineItem的统一选择管理
 * - 状态驱动的选择操作，支持撤销/重做
 * - 响应式数据结构，与Vue3完美集成
 * - 类型安全的选择操作接口
 */
export function createUnifiedSelectionModule(
  getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined,
  getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined,
  executeCommand: (command: UnifiedCommand) => Promise<void>,
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

    // 统一的选择同步逻辑
    syncSelectionState()
  }

  /**
   * 选择状态同步逻辑
   * 在新架构中，这里可以触发相关的状态更新和UI同步
   */
  function syncSelectionState() {
    // 在新架构中，选择状态的同步可能涉及：
    // 1. 更新选中项目的状态
    // 2. 触发UI更新
    // 3. 同步到其他相关模块
    console.log('🔗 选择状态已更新（基于统一架构）')
  }

  // 防抖机制：避免短时间内重复执行相同的选择操作
  let lastSelectionCommand: { itemIds: string[]; mode: string; timestamp: number } | null = null
  const SELECTION_DEBOUNCE_TIME = 100 // 100毫秒内的重复操作会被忽略

  /**
   * 带历史记录的时间轴项目选择方法
   * @param itemIds 要操作的项目ID数组
   * @param mode 操作模式：'replace'替换选择，'toggle'切换选择状态
   */
  async function selectTimelineItemsWithHistory(
    itemIds: string[],
    mode: 'replace' | 'toggle' = 'replace',
  ) {
    const now = Date.now()

    // 检查是否是重复的操作（防抖）
    if (lastSelectionCommand) {
      const timeDiff = now - lastSelectionCommand.timestamp
      const isSameOperation =
        lastSelectionCommand.mode === mode && arraysEqual(lastSelectionCommand.itemIds, itemIds)

      if (isSameOperation && timeDiff < SELECTION_DEBOUNCE_TIME) {
        console.log('🎯 检测到重复选择操作，跳过历史记录', { timeDiff, itemIds, mode })
        return
      }
    }

    // 检查是否有实际的选择变化
    const currentSelection = new Set(selectedTimelineItemIds.value)
    const newSelection = calculateNewSelection(itemIds, mode, currentSelection)

    // 如果选择状态没有变化，不创建历史记录
    if (setsEqual(currentSelection, newSelection)) {
      console.log('🎯 选择状态无变化，跳过历史记录')
      return
    }

    // 记录当前操作，用于防抖检测
    lastSelectionCommand = { itemIds: [...itemIds], mode, timestamp: now }

    // 创建统一选择命令
    const command = new UnifiedSelectTimelineItemsCommand(
      itemIds,
      mode,
      {
        selectedTimelineItemIds,
        selectTimelineItems: (ids: string[], m: 'replace' | 'toggle') =>
          selectTimelineItems(ids, m, false),
        syncSelectionState,
      },
      { getUnifiedTimelineItem },
      { getUnifiedMediaItem },
    )

    // 执行命令（这会自动添加到历史记录）
    await executeCommand(command)
  }

  /**
   * 计算新的选择状态
   */
  function calculateNewSelection(
    itemIds: string[],
    mode: 'replace' | 'toggle',
    currentSelection: Set<string>,
  ): Set<string> {
    const newSelection = new Set(currentSelection)

    if (mode === 'replace') {
      newSelection.clear()
      itemIds.forEach((id) => newSelection.add(id))
    } else {
      itemIds.forEach((id) => {
        if (newSelection.has(id)) {
          newSelection.delete(id)
        } else {
          newSelection.add(id)
        }
      })
    }

    return newSelection
  }

  /**
   * 检查两个Set是否相等
   */
  function setsEqual(set1: Set<string>, set2: Set<string>): boolean {
    if (set1.size !== set2.size) return false
    for (const item of set1) {
      if (!set2.has(item)) return false
    }
    return true
  }

  /**
   * 检查两个数组是否相等
   */
  function arraysEqual(arr1: string[], arr2: string[]): boolean {
    if (arr1.length !== arr2.length) return false
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) return false
    }
    return true
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
    return selectedTimelineItemId.value === timelineItemId
  }

  /**
   * 获取当前选中的时间轴项目
   * @returns 选中的时间轴项目或null
   */
  function getSelectedTimelineItem(): UnifiedTimelineItem | null {
    if (!selectedTimelineItemId.value) return null
    return getUnifiedTimelineItem(selectedTimelineItemId.value) || null
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
            status: selectedItem.timelineStatus,
            mediaType: selectedItem.mediaType,
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

  // ==================== 导出接口 ====================

  return {
    // 状态
    selectedTimelineItemId,
    selectedTimelineItemIds,
    isMultiSelectMode,
    hasSelection,

    // 统一选择API
    selectTimelineItems,
    selectTimelineItemsWithHistory,
    syncSelectionState,

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

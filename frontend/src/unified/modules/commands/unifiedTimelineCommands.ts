import { generateCommandId } from '../../../utils/idGenerator'
import type { Ref } from 'vue'
import type { UnifiedTimelineItemData } from '../../timelineitem/TimelineItemData'
import type { UnifiedMediaItemData } from '../../mediaitem/types'

/**
 * 统一选择时间轴项目命令
 * 支持统一时间轴项目的单选和多选操作的撤销/重做
 * 记录选择状态的变化，支持恢复到之前的选择状态
 */
export class UnifiedSelectTimelineItemsCommand {
  public readonly id: string
  public readonly description: string
  private previousSelection: Set<string> // 保存操作前的选择状态
  private newSelection: Set<string> // 保存操作后的选择状态

  constructor(
    private itemIds: string[],
    private mode: 'replace' | 'toggle',
    private selectionModule: {
      selectedTimelineItemIds: Ref<Set<string>>
      selectTimelineItems: (itemIds: string[], mode: 'replace' | 'toggle') => void
      syncAVCanvasSelection: () => void
    },
    private timelineModule: {
      getTimelineItem: (id: string) => UnifiedTimelineItemData | undefined
    },
    private mediaModule: {
      getMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
  ) {
    this.id = generateCommandId()

    // 保存当前选择状态
    this.previousSelection = new Set(this.selectionModule.selectedTimelineItemIds.value)

    // 计算新的选择状态
    this.newSelection = this.calculateNewSelection()

    // 生成描述信息
    this.description = this.generateDescription()

    console.log('💾 保存选择操作数据:', {
      itemIds,
      mode,
      previousSelection: Array.from(this.previousSelection),
      newSelection: Array.from(this.newSelection),
    })
  }

  /**
   * 计算新的选择状态
   */
  private calculateNewSelection(): Set<string> {
    const newSelection = new Set(this.previousSelection)

    if (this.mode === 'replace') {
      // 替换模式：清空现有选择，设置新选择
      newSelection.clear()
      this.itemIds.forEach((id) => newSelection.add(id))
    } else {
      // 切换模式：切换每个项目的选择状态
      this.itemIds.forEach((id) => {
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
   * 生成描述信息
   */
  private generateDescription(): string {
    // 单选/多选/取消选择的不同描述
    if (this.newSelection.size === 0) {
      return '取消选择'
    } else if (this.newSelection.size === 1) {
      // 单选：显示项目名称
      const itemId = Array.from(this.newSelection)[0]
      const timelineItem = this.timelineModule.getTimelineItem(itemId)
      
      if (timelineItem) {
        const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        const itemName = mediaItem?.name || '未知素材'
        return `选择项目: ${itemName}`
      }
      return '选择单个项目'
    } else {
      // 多选：显示数量
      return `选择 ${this.newSelection.size} 个项目`
    }
  }

  /**
   * 执行命令：应用新的选择状态
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行选择操作: ${this.description}`)

      // 直接设置选择状态，避免触发新的历史记录
      this.applySelection(this.newSelection)

      console.log(`✅ 选择操作完成: ${Array.from(this.newSelection).length} 个项目被选中`)
    } catch (error) {
      console.error(`❌ 选择操作失败: ${this.description}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复到之前的选择状态
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销选择操作: ${this.description}`)

      // 恢复到之前的选择状态
      this.applySelection(this.previousSelection)

      console.log(`↩️ 已恢复选择状态: ${Array.from(this.previousSelection).length} 个项目被选中`)
    } catch (error) {
      console.error(`❌ 撤销选择操作失败: ${this.description}`, error)
      throw error
    }
  }

  /**
   * 应用选择状态（不触发历史记录）
   */
  private applySelection(selection: Set<string>): void {
    // 直接更新选择状态，不通过selectTimelineItems方法以避免循环调用
    this.selectionModule.selectedTimelineItemIds.value.clear()
    selection.forEach((id) => this.selectionModule.selectedTimelineItemIds.value.add(id))

    // 手动触发AVCanvas同步逻辑
    this.selectionModule.syncAVCanvasSelection()
  }
}

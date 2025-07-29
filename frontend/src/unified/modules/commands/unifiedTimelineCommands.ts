/**
 * 统一时间轴命令定义
 * 用于处理时间轴相关的操作命令
 */

import type { MediaTypeOrUnknown } from '../../mediaitem'
import type { UnifiedTimelineItemData } from '../../timelineitem/TimelineItemData'

/**
 * 基础命令接口
 */
export interface BaseCommand {
  execute(): Promise<void> | void
  undo(): Promise<void> | void
  canExecute(): boolean
  canUndo(): boolean
}

/**
 * 选择时间轴项目命令
 */
export class UnifiedSelectTimelineItemsCommand implements BaseCommand {
  private previousSelection: string[] = []
  
  constructor(
    private itemIds: string[],
    private trackId?: string,
    private addToSelection: boolean = false
  ) {}

  canExecute(): boolean {
    return this.itemIds.length > 0
  }

  canUndo(): boolean {
    return true
  }

  async execute(): Promise<void> {
    // 这里应该调用实际的选择逻辑
    // 暂时留空，等待实际的选择系统实现
    console.log('🎯 [UnifiedSelectTimelineItemsCommand] Executing selection:', {
      itemIds: this.itemIds,
      trackId: this.trackId,
      addToSelection: this.addToSelection
    })
  }

  async undo(): Promise<void> {
    // 恢复之前的选择状态
    console.log('🎯 [UnifiedSelectTimelineItemsCommand] Undoing selection:', {
      previousSelection: this.previousSelection
    })
  }
}

/**
 * 移动时间轴项目命令
 */
export class UnifiedMoveTimelineItemsCommand implements BaseCommand {
  private originalPositions: Map<string, { trackId: string; startTime: number }> = new Map()
  
  constructor(
    private itemIds: string[],
    private targetTrackId: string,
    private targetStartTime: number
  ) {}

  canExecute(): boolean {
    return this.itemIds.length > 0 && this.targetTrackId.length > 0
  }

  canUndo(): boolean {
    return this.originalPositions.size > 0
  }

  async execute(): Promise<void> {
    console.log('🎯 [UnifiedMoveTimelineItemsCommand] Executing move:', {
      itemIds: this.itemIds,
      targetTrackId: this.targetTrackId,
      targetStartTime: this.targetStartTime
    })
  }

  async undo(): Promise<void> {
    console.log('🎯 [UnifiedMoveTimelineItemsCommand] Undoing move:', {
      originalPositions: Array.from(this.originalPositions.entries())
    })
  }
}

/**
 * 删除时间轴项目命令
 */
export class UnifiedDeleteTimelineItemsCommand implements BaseCommand {
  private deletedItems: UnifiedTimelineItemData<MediaTypeOrUnknown>[] = []
  
  constructor(private itemIds: string[]) {}

  canExecute(): boolean {
    return this.itemIds.length > 0
  }

  canUndo(): boolean {
    return this.deletedItems.length > 0
  }

  async execute(): Promise<void> {
    console.log('🎯 [UnifiedDeleteTimelineItemsCommand] Executing delete:', {
      itemIds: this.itemIds
    })
  }

  async undo(): Promise<void> {
    console.log('🎯 [UnifiedDeleteTimelineItemsCommand] Undoing delete:', {
      deletedItems: this.deletedItems.length
    })
  }
}

/**
 * 复制时间轴项目命令
 */
export class UnifiedCopyTimelineItemsCommand implements BaseCommand {
  private copiedItems: UnifiedTimelineItemData<MediaTypeOrUnknown>[] = []
  
  constructor(
    private itemIds: string[],
    private targetTrackId?: string,
    private targetStartTime?: number
  ) {}

  canExecute(): boolean {
    return this.itemIds.length > 0
  }

  canUndo(): boolean {
    return this.copiedItems.length > 0
  }

  async execute(): Promise<void> {
    console.log('🎯 [UnifiedCopyTimelineItemsCommand] Executing copy:', {
      itemIds: this.itemIds,
      targetTrackId: this.targetTrackId,
      targetStartTime: this.targetStartTime
    })
  }

  async undo(): Promise<void> {
    console.log('🎯 [UnifiedCopyTimelineItemsCommand] Undoing copy:', {
      copiedItems: this.copiedItems.length
    })
  }
}

/**
 * 命令管理器
 */
export class UnifiedTimelineCommandManager {
  private commandHistory: BaseCommand[] = []
  private currentIndex: number = -1
  private maxHistorySize: number = 100

  /**
   * 执行命令
   */
  async executeCommand(command: BaseCommand): Promise<void> {
    if (!command.canExecute()) {
      throw new Error('Command cannot be executed')
    }

    await command.execute()

    // 清除当前位置之后的历史记录
    this.commandHistory = this.commandHistory.slice(0, this.currentIndex + 1)
    
    // 添加新命令到历史记录
    this.commandHistory.push(command)
    this.currentIndex++

    // 限制历史记录大小
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory.shift()
      this.currentIndex--
    }
  }

  /**
   * 撤销命令
   */
  async undo(): Promise<void> {
    if (!this.canUndo()) {
      throw new Error('Cannot undo')
    }

    const command = this.commandHistory[this.currentIndex]
    await command.undo()
    this.currentIndex--
  }

  /**
   * 重做命令
   */
  async redo(): Promise<void> {
    if (!this.canRedo()) {
      throw new Error('Cannot redo')
    }

    this.currentIndex++
    const command = this.commandHistory[this.currentIndex]
    await command.execute()
  }

  /**
   * 检查是否可以撤销
   */
  canUndo(): boolean {
    return this.currentIndex >= 0 && 
           this.commandHistory[this.currentIndex]?.canUndo() === true
  }

  /**
   * 检查是否可以重做
   */
  canRedo(): boolean {
    return this.currentIndex < this.commandHistory.length - 1 &&
           this.commandHistory[this.currentIndex + 1]?.canExecute() === true
  }

  /**
   * 清除历史记录
   */
  clearHistory(): void {
    this.commandHistory = []
    this.currentIndex = -1
  }

  /**
   * 获取历史记录信息
   */
  getHistoryInfo(): {
    totalCommands: number
    currentIndex: number
    canUndo: boolean
    canRedo: boolean
  } {
    return {
      totalCommands: this.commandHistory.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    }
  }
}

// 导出单例命令管理器
export const unifiedTimelineCommandManager = new UnifiedTimelineCommandManager()

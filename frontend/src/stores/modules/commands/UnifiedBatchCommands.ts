import { generateCommandId } from '../../../utils/idGenerator'
import type {
  UnifiedCommand,
  CommandResult,
  OperationType,
  CommandTargetInfo,
  StateTransitionInfo
} from '../UnifiedHistoryModule'
import { UnifiedBaseBatchCommand } from '../UnifiedHistoryModule'
import type { UnifiedTimelineItem } from '../../../unified/timelineitem/types'
import type { UnifiedMediaItemData } from '../../../unified/UnifiedMediaItem'
import { UnifiedRemoveTimelineItemCommand } from './UnifiedTimelineCommands'

/**
 * 统一批量删除时间轴项目命令
 * 将多个删除操作组合为一个批量操作，统一撤销/重做
 */
export class UnifiedBatchDeleteCommand extends UnifiedBaseBatchCommand {
  constructor(
    private timelineItemIds: string[],
    private timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      addTimelineItem: (item: UnifiedTimelineItem) => { success: boolean; error?: string }
      removeTimelineItem: (id: string) => { success: boolean; error?: string }
    },
    private mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
    private webavModule?: {
      addSprite: (sprite: any) => Promise<boolean>
      removeSprite: (sprite: any) => boolean
    }
  ) {
    super(`批量删除 ${timelineItemIds.length} 个时间轴项目`)
    this.buildDeleteCommands()
  }

  /**
   * 构建删除命令列表
   */
  private buildDeleteCommands() {
    this.subCommands = []
    
    for (const itemId of this.timelineItemIds) {
      const item = this.timelineModule.getUnifiedTimelineItem(itemId)
      if (item) {
        const deleteCommand = new UnifiedRemoveTimelineItemCommand(
          itemId,
          this.timelineModule,
          this.mediaModule,
          this.webavModule
        )
        this.subCommands.push(deleteCommand)
      }
    }

    // 更新目标信息
    ;(this as any).targetInfo = {
      type: 'batch',
      ids: this.timelineItemIds
    }

    console.log(`📋 准备批量删除 ${this.subCommands.length} 个时间轴项目`)
  }
}

/**
 * 统一批量属性修改命令
 * 将多个属性修改操作组合为一个批量操作
 */
export class UnifiedBatchUpdatePropertiesCommand extends UnifiedBaseBatchCommand {
  constructor(
    targetItemIds: string[], 
    updateCommands: UnifiedCommand[]
  ) {
    super(`批量修改 ${targetItemIds.length} 个项目的属性`)

    // 添加所有更新命令
    this.subCommands = [...updateCommands]

    // 更新目标信息
    ;(this as any).targetInfo = {
      type: 'batch',
      ids: targetItemIds
    }

    console.log(`📋 准备批量修改 ${this.subCommands.length} 个属性`)
  }
}

/**
 * 统一批量轨道自动排列命令
 * 将轨道内所有项目的自动排列操作组合为一个批量操作
 */
export class UnifiedBatchAutoArrangeTrackCommand extends UnifiedBaseBatchCommand {
  private originalPositions: Map<string, number> = new Map()

  constructor(
    private trackId: string,
    private timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      getTimelineItemsByTrack: (trackId: string) => UnifiedTimelineItem[]
      updateTimelineItemPosition: (id: string, positionFrames: number) => { success: boolean; error?: string }
      autoArrangeTrackItems: (trackId: string) => { success: boolean; error?: string; newPositions?: Map<string, number> }
    },
    private mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    }
  ) {
    const trackItems = timelineModule.getTimelineItemsByTrack(trackId)
    super(`自动排列轨道 ${trackId} 的 ${trackItems.length} 个项目`)

    // 保存原始位置
    trackItems.forEach(item => {
      this.originalPositions.set(item.id, item.timeRange.timelineStartTime)
    })

    // 更新目标信息
    ;(this as any).targetInfo = {
      type: 'batch',
      ids: trackItems.map(item => item.id)
    }

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: {
        positions: Object.fromEntries(this.originalPositions)
      },
      afterState: {
        arranged: true
      }
    }
  }

  /**
   * 执行命令：自动排列轨道项目
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一批量自动排列操作: ${this.description}`)

      // 执行自动排列
      const result = (this.timelineModule as any).autoArrangeTrackItems(this.trackId)
      if (!result.success) {
        return this.createErrorResult(result.error || '自动排列轨道项目失败')
      }

      console.log(`✅ 统一批量自动排列操作完成`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一批量自动排列操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复原始位置
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一批量自动排列操作: ${this.description}`)

      // 恢复所有项目的原始位置
      for (const [itemId, originalPosition] of this.originalPositions) {
        const result = (this.timelineModule as any).updateTimelineItemPosition(
          itemId,
          originalPosition
        )
        if (!result.success) {
          console.warn(`⚠️ 恢复项目位置失败: ${itemId}`)
        }
      }

      console.log(`✅ 统一批量自动排列操作撤销完成`)
      return this.createSuccessResult('撤销批量自动排列操作成功')
    } catch (error) {
      const errorMessage = `撤销统一批量自动排列操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 创建成功结果
   */
  protected createSuccessResult(message?: string): CommandResult {
    return {
      success: true,
      message: message || `${this.description} 执行成功`,
      timestamp: Date.now()
    }
  }

  /**
   * 创建错误结果
   */
  protected createErrorResult(error: string): CommandResult {
    return {
      success: false,
      error,
      timestamp: Date.now()
    }
  }
}

/**
 * 统一批量选择命令
 * 将多个选择操作组合为一个批量操作
 */
export class UnifiedBatchSelectionCommand extends UnifiedBaseBatchCommand {
  private previousSelection: Set<string> = new Set()

  constructor(
    private itemIds: string[],
    private mode: 'replace' | 'add' | 'remove',
    private selectionModule: {
      selectedTimelineItemIds: { value: Set<string> }
      selectTimelineItems: (itemIds: string[], mode: string) => void
      syncSelectionState: () => void
    }
  ) {
    super(`批量选择 ${itemIds.length} 个项目`)

    // 保存当前选择状态
    this.previousSelection = new Set(this.selectionModule.selectedTimelineItemIds.value)

    // 更新目标信息
    ;(this as any).targetInfo = {
      type: 'batch',
      ids: itemIds
    }

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: {
        selection: Array.from(this.previousSelection)
      },
      afterState: {
        selection: itemIds,
        mode: mode
      }
    }
  }

  /**
   * 执行命令：批量选择
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一批量选择操作: ${this.description}`)

      // 执行批量选择
      this.selectionModule.selectTimelineItems(this.itemIds, this.mode)
      this.selectionModule.syncSelectionState()

      console.log(`✅ 统一批量选择操作完成: 选择了 ${this.itemIds.length} 个项目`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一批量选择操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复原始选择状态
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一批量选择操作: ${this.description}`)

      // 恢复原始选择状态
      this.selectionModule.selectedTimelineItemIds.value.clear()
      this.previousSelection.forEach(id => {
        this.selectionModule.selectedTimelineItemIds.value.add(id)
      })
      this.selectionModule.syncSelectionState()

      console.log(`✅ 统一批量选择操作撤销完成: 恢复到 ${this.previousSelection.size} 个选中项目`)
      return this.createSuccessResult('撤销批量选择操作成功')
    } catch (error) {
      const errorMessage = `撤销统一批量选择操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 创建成功结果
   */
  protected createSuccessResult(message?: string): CommandResult {
    return {
      success: true,
      message: message || `${this.description} 执行成功`,
      timestamp: Date.now()
    }
  }

  /**
   * 创建错误结果
   */
  protected createErrorResult(error: string): CommandResult {
    return {
      success: false,
      error,
      timestamp: Date.now()
    }
  }
}

/**
 * 统一批量移动时间轴项目命令
 * 将多个移动操作组合为一个批量操作
 */
export class UnifiedBatchMoveCommand extends UnifiedBaseBatchCommand {
  private originalPositions: Map<string, { positionFrames: number; trackId: string }> = new Map()

  constructor(
    private moveOperations: Array<{
      itemId: string
      oldPositionFrames: number
      newPositionFrames: number
      oldTrackId: string
      newTrackId: string
    }>,
    private timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      updateTimelineItemPosition: (id: string, positionFrames: number, trackId?: string) => { success: boolean; error?: string }
    },
    private mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    }
  ) {
    super(`批量移动 ${moveOperations.length} 个时间轴项目`)

    // 保存原始位置
    moveOperations.forEach(op => {
      this.originalPositions.set(op.itemId, {
        positionFrames: op.oldPositionFrames,
        trackId: op.oldTrackId
      })
    })

    // 更新目标信息
    ;(this as any).targetInfo = {
      type: 'batch',
      ids: moveOperations.map(op => op.itemId)
    }

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: {
        positions: Object.fromEntries(this.originalPositions)
      },
      afterState: {
        moved: true,
        operations: moveOperations.length
      }
    }
  }

  /**
   * 执行命令：批量移动时间轴项目
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一批量移动操作: ${this.description}`)

      // 执行所有移动操作
      for (const operation of this.moveOperations) {
        const result = (this.timelineModule as any).updateTimelineItemPosition(
          operation.itemId,
          operation.newPositionFrames,
          operation.newTrackId
        )

        if (!result.success) {
          console.warn(`⚠️ 移动项目失败: ${operation.itemId}`)
        }
      }

      console.log(`✅ 统一批量移动操作完成`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一批量移动操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复原始位置
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一批量移动操作: ${this.description}`)

      // 恢复所有项目的原始位置
      for (const [itemId, originalPos] of this.originalPositions) {
        const result = (this.timelineModule as any).updateTimelineItemPosition(
          itemId,
          originalPos.positionFrames,
          originalPos.trackId
        )
        if (!result.success) {
          console.warn(`⚠️ 恢复项目位置失败: ${itemId}`)
        }
      }

      console.log(`✅ 统一批量移动操作撤销完成`)
      return this.createSuccessResult('撤销批量移动操作成功')
    } catch (error) {
      const errorMessage = `撤销统一批量移动操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 创建成功结果
   */
  protected createSuccessResult(message?: string): CommandResult {
    return {
      success: true,
      message: message || `${this.description} 执行成功`,
      timestamp: Date.now()
    }
  }

  /**
   * 创建错误结果
   */
  protected createErrorResult(error: string): CommandResult {
    return {
      success: false,
      error,
      timestamp: Date.now()
    }
  }
}

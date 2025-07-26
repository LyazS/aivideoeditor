import { generateCommandId } from '../../../utils/idGenerator'
import type { Ref } from 'vue'
import type {
  UnifiedCommand,
  CommandResult,
  OperationType,
  CommandTargetInfo,
  StateTransitionInfo,
} from '../UnifiedHistoryModule'
import type { UnifiedTimelineItem } from '../../../unified/timelineitem/types'
import type { UnifiedMediaItemData } from '../../../unified/UnifiedMediaItem'

/**
 * 统一时间轴项目命令基类
 * 基于新架构的统一类型设计，提供时间轴项目操作的基础功能
 */
export abstract class UnifiedTimelineCommand implements UnifiedCommand {
  public readonly id: string
  public readonly description: string
  public readonly timestamp: number
  public readonly operationType: OperationType
  public readonly targetInfo: CommandTargetInfo
  public readonly stateTransition: StateTransitionInfo

  constructor(
    operationType: OperationType,
    targetIds: string[],
    description: string,
    protected timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
    },
    protected mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    }
  ) {
    this.id = generateCommandId()
    this.description = description
    this.timestamp = Date.now()
    this.operationType = operationType
    this.targetInfo = {
      type: 'selection',
      ids: targetIds
    }
    this.stateTransition = {}
  }

  abstract execute(): Promise<CommandResult>
  abstract undo(): Promise<CommandResult>

  /**
   * 检查命令是否可以执行
   */
  canExecute(): boolean {
    return this.targetInfo.ids.every(id => this.timelineModule.getUnifiedTimelineItem(id) !== undefined)
  }

  /**
   * 检查命令是否可以撤销
   */
  canUndo(): boolean {
    return true // 默认情况下所有命令都可以撤销
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
 * 统一选择时间轴项目命令
 * 基于UnifiedTimelineItem的选择操作，支持撤销/重做
 */
export class UnifiedSelectTimelineItemsCommand extends UnifiedTimelineCommand {
  private previousSelection: Set<string> // 保存操作前的选择状态
  private newSelection: Set<string> // 保存操作后的选择状态

  constructor(
    private itemIds: string[],
    private mode: 'replace' | 'toggle',
    private selectionModule: {
      selectedTimelineItemIds: Ref<Set<string>>
      selectTimelineItems: (itemIds: string[], mode: 'replace' | 'toggle') => void
      syncSelectionState: () => void
    },
    timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
    },
    mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
  ) {
    super(
      'selection.change',
      itemIds,
      `选择时间轴项目: ${itemIds.length} 个项目`,
      timelineModule,
      mediaModule
    )

    // 保存当前选择状态
    this.previousSelection = new Set(this.selectionModule.selectedTimelineItemIds.value)

    // 计算新的选择状态
    this.newSelection = this.calculateNewSelection()

    // 更新描述信息
    ;(this as any).description = this.generateDescription()

    // 设置状态转换信息
    ;(this as any).stateTransition = {
      beforeState: {
        selectedIds: Array.from(this.previousSelection)
      },
      afterState: {
        selectedIds: Array.from(this.newSelection)
      }
    }

    console.log('💾 保存统一选择操作数据:', {
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
    const currentSelection = new Set(this.selectionModule.selectedTimelineItemIds.value)
    const newSelection = new Set(currentSelection)

    if (this.mode === 'replace') {
      newSelection.clear()
      this.itemIds.forEach((id) => newSelection.add(id))
    } else {
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
    const itemCount = this.itemIds.length
    const newSelectionCount = this.newSelection.size
    const previousSelectionCount = this.previousSelection.size

    if (this.mode === 'replace') {
      if (itemCount === 0) {
        return '清除所有选择'
      } else if (itemCount === 1) {
        return `选择时间轴项目`
      } else {
        return `选择 ${itemCount} 个时间轴项目`
      }
    } else {
      if (newSelectionCount > previousSelectionCount) {
        return `添加 ${newSelectionCount - previousSelectionCount} 个项目到选择`
      } else if (newSelectionCount < previousSelectionCount) {
        return `从选择中移除 ${previousSelectionCount - newSelectionCount} 个项目`
      } else {
        return '切换选择状态'
      }
    }
  }

  /**
   * 应用选择状态
   */
  private applySelection(selection: Set<string>) {
    // 直接设置选择状态，避免触发新的历史记录
    this.selectionModule.selectedTimelineItemIds.value.clear()
    selection.forEach(id => this.selectionModule.selectedTimelineItemIds.value.add(id))
    
    // 同步选择状态
    this.selectionModule.syncSelectionState()
  }

  /**
   * 执行命令：应用新的选择状态
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一选择操作: ${this.description}`)

      // 直接设置选择状态，避免触发新的历史记录
      this.applySelection(this.newSelection)

      console.log(`✅ 统一选择操作完成: ${Array.from(this.newSelection).length} 个项目被选中`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一选择操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复到之前的选择状态
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一选择操作: ${this.description}`)

      // 恢复到之前的选择状态
      this.applySelection(this.previousSelection)

      console.log(`↩️ 已恢复选择状态: ${Array.from(this.previousSelection).length} 个项目被选中`)
      return this.createSuccessResult('选择状态已恢复')
    } catch (error) {
      const errorMessage = `撤销统一选择操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 检查是否可以与其他命令合并
   */
  canMergeWith(other: UnifiedCommand): boolean {
    // 只能与相同类型的选择命令合并
    if (!(other instanceof UnifiedSelectTimelineItemsCommand)) {
      return false
    }

    // 检查时间间隔（100ms内的操作可以合并）
    const timeDiff = other.timestamp - this.timestamp
    if (timeDiff > 100) {
      return false
    }

    // 检查是否是相同的操作模式
    return this.mode === other.mode
  }

  /**
   * 与其他命令合并
   */
  mergeWith(other: UnifiedCommand): UnifiedCommand {
    if (!(other instanceof UnifiedSelectTimelineItemsCommand)) {
      throw new Error('无法合并不同类型的命令')
    }

    // 创建合并后的命令
    const mergedItemIds = [...new Set([...this.itemIds, ...other.itemIds])]
    
    return new UnifiedSelectTimelineItemsCommand(
      mergedItemIds,
      this.mode,
      this.selectionModule,
      this.timelineModule,
      this.mediaModule
    )
  }
}

// ==================== 时间轴项目操作命令 ====================

/**
 * 统一添加时间轴项目命令
 * 基于UnifiedTimelineItem的添加操作，支持撤销/重做
 */
export class UnifiedAddTimelineItemCommand extends UnifiedTimelineCommand {
  private addedItem: UnifiedTimelineItem | null = null

  constructor(
    private timelineItem: UnifiedTimelineItem,
    timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      addTimelineItem: (item: UnifiedTimelineItem) => { success: boolean; error?: string }
      removeTimelineItem: (id: string) => { success: boolean; error?: string }
    },
    mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
    private webavModule?: {
      addSprite: (sprite: any) => Promise<boolean>
      removeSprite: (sprite: any) => boolean
    }
  ) {
    super(
      'timeline.create',
      [timelineItem.id],
      `添加时间轴项目: ${timelineItem.config.name || '未知素材'}`,
      timelineModule,
      mediaModule
    )

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { timelineItemExists: false },
      afterState: { timelineItemExists: true, timelineItem: { ...timelineItem } }
    }
  }

  /**
   * 执行命令：添加时间轴项目
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一添加操作: ${this.description}`)

      // 1. 添加到时间轴模块
      const result = (this.timelineModule as any).addTimelineItem(this.timelineItem)
      if (!result.success) {
        return this.createErrorResult(result.error || '添加时间轴项目失败')
      }

      // 2. 处理WebAV集成（如果项目状态为ready且有sprite）
      if (this.webavModule && this.timelineItem.timelineStatus === 'ready' && this.timelineItem.sprite) {
        try {
          await this.webavModule.addSprite(this.timelineItem.sprite)
        } catch (error) {
          console.warn('⚠️ WebAV sprite添加失败，但时间轴项目已添加:', error)
        }
      }

      this.addedItem = this.timelineItem
      console.log(`✅ 统一添加操作完成: ${this.timelineItem.config.name}`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一添加操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：移除时间轴项目
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一添加操作: ${this.description}`)

      if (!this.addedItem) {
        return this.createErrorResult('没有可撤销的添加操作')
      }

      // 1. 移除WebAV sprite（如果存在）
      if (this.webavModule && this.addedItem.sprite) {
        try {
          this.webavModule.removeSprite(this.addedItem.sprite)
        } catch (error) {
          console.warn('⚠️ WebAV sprite移除失败:', error)
        }
      }

      // 2. 从时间轴模块移除
      const result = (this.timelineModule as any).removeTimelineItem(this.addedItem.id)
      if (!result.success) {
        return this.createErrorResult(result.error || '撤销添加操作失败')
      }

      console.log(`✅ 统一添加操作撤销完成: ${this.addedItem.config.name}`)
      return this.createSuccessResult('撤销添加操作成功')
    } catch (error) {
      const errorMessage = `撤销统一添加操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

/**
 * 统一移除时间轴项目命令
 * 基于UnifiedTimelineItem的移除操作，支持撤销/重做
 */
export class UnifiedRemoveTimelineItemCommand extends UnifiedTimelineCommand {
  private removedItem: UnifiedTimelineItem | null = null

  constructor(
    private timelineItemId: string,
    timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      addTimelineItem: (item: UnifiedTimelineItem) => { success: boolean; error?: string }
      removeTimelineItem: (id: string) => { success: boolean; error?: string }
    },
    mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
    private webavModule?: {
      addSprite: (sprite: any) => Promise<boolean>
      removeSprite: (sprite: any) => boolean
    }
  ) {
    const item = timelineModule.getUnifiedTimelineItem(timelineItemId)
    super(
      'timeline.delete',
      [timelineItemId],
      `移除时间轴项目: ${item?.config.name || '未知素材'}`,
      timelineModule,
      mediaModule
    )

    // 保存要移除的项目
    this.removedItem = item ? { ...item } : null

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { timelineItemExists: true, timelineItem: this.removedItem },
      afterState: { timelineItemExists: false }
    }
  }

  /**
   * 执行命令：移除时间轴项目
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一移除操作: ${this.description}`)

      if (!this.removedItem) {
        return this.createErrorResult('要移除的时间轴项目不存在')
      }

      // 1. 移除WebAV sprite（如果存在）
      if (this.webavModule && this.removedItem.sprite) {
        try {
          this.webavModule.removeSprite(this.removedItem.sprite)
        } catch (error) {
          console.warn('⚠️ WebAV sprite移除失败:', error)
        }
      }

      // 2. 从时间轴模块移除
      const result = (this.timelineModule as any).removeTimelineItem(this.removedItem.id)
      if (!result.success) {
        return this.createErrorResult(result.error || '移除时间轴项目失败')
      }

      console.log(`✅ 统一移除操作完成: ${this.removedItem.config.name}`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一移除操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复时间轴项目
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一移除操作: ${this.description}`)

      if (!this.removedItem) {
        return this.createErrorResult('没有可恢复的时间轴项目')
      }

      // 1. 添加回时间轴模块
      const result = (this.timelineModule as any).addTimelineItem(this.removedItem)
      if (!result.success) {
        return this.createErrorResult(result.error || '恢复时间轴项目失败')
      }

      // 2. 恢复WebAV sprite（如果存在且状态为ready）
      if (this.webavModule && this.removedItem.timelineStatus === 'ready' && this.removedItem.sprite) {
        try {
          await this.webavModule.addSprite(this.removedItem.sprite)
        } catch (error) {
          console.warn('⚠️ WebAV sprite恢复失败，但时间轴项目已恢复:', error)
        }
      }

      console.log(`✅ 统一移除操作撤销完成: ${this.removedItem.config.name}`)
      return this.createSuccessResult('撤销移除操作成功')
    } catch (error) {
      const errorMessage = `撤销统一移除操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

/**
 * 统一移动时间轴项目命令
 * 基于UnifiedTimelineItem的位置移动操作，支持撤销/重做
 */
export class UnifiedMoveTimelineItemCommand extends UnifiedTimelineCommand {
  constructor(
    private timelineItemId: string,
    private oldPositionFrames: number,
    private newPositionFrames: number,
    private oldTrackId: string,
    private newTrackId: string,
    timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      updateTimelineItemPosition: (id: string, positionFrames: number, trackId?: string) => { success: boolean; error?: string }
    },
    mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    }
  ) {
    const item = timelineModule.getUnifiedTimelineItem(timelineItemId)
    super(
      'timeline.move',
      [timelineItemId],
      `移动时间轴项目: ${item?.config.name || '未知素材'}`,
      timelineModule,
      mediaModule
    )

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: {
        positionFrames: oldPositionFrames,
        trackId: oldTrackId
      },
      afterState: {
        positionFrames: newPositionFrames,
        trackId: newTrackId
      }
    }
  }

  /**
   * 执行命令：移动时间轴项目
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一移动操作: ${this.description}`)

      // 更新时间轴项目位置
      const result = (this.timelineModule as any).updateTimelineItemPosition(
        this.timelineItemId,
        this.newPositionFrames,
        this.newTrackId
      )

      if (!result.success) {
        return this.createErrorResult(result.error || '移动时间轴项目失败')
      }

      console.log(`✅ 统一移动操作完成: 从轨道${this.oldTrackId}移动到${this.newTrackId}`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一移动操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复原始位置
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一移动操作: ${this.description}`)

      // 恢复到原始位置
      const result = (this.timelineModule as any).updateTimelineItemPosition(
        this.timelineItemId,
        this.oldPositionFrames,
        this.oldTrackId
      )

      if (!result.success) {
        return this.createErrorResult(result.error || '恢复时间轴项目位置失败')
      }

      console.log(`✅ 统一移动操作撤销完成: 恢复到轨道${this.oldTrackId}`)
      return this.createSuccessResult('撤销移动操作成功')
    } catch (error) {
      const errorMessage = `撤销统一移动操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

/**
 * 统一更新变换属性命令
 * 基于UnifiedTimelineItem的属性更新操作，支持撤销/重做
 */
export class UnifiedUpdateTransformCommand extends UnifiedTimelineCommand {
  private oldTransform: Record<string, any> = {}

  constructor(
    private timelineItemId: string,
    private newTransform: {
      x?: number
      y?: number
      width?: number
      height?: number
      rotation?: number
      opacity?: number
      zIndex?: number
      duration?: number
      playbackRate?: number
      volume?: number
      isMuted?: boolean
      gain?: number
    },
    timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      updateTimelineItemTransform: (id: string, transform: any) => { success: boolean; error?: string }
    },
    mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    }
  ) {
    const item = timelineModule.getUnifiedTimelineItem(timelineItemId)
    super(
      'property.update',
      [timelineItemId],
      `更新变换属性: ${item?.config.name || '未知素材'}`,
      timelineModule,
      mediaModule
    )

    // 保存原始变换属性
    if (item) {
      const mediaConfig = item.config.mediaConfig as any
      this.oldTransform = {
        x: mediaConfig.x,
        y: mediaConfig.y,
        width: mediaConfig.width,
        height: mediaConfig.height,
        rotation: mediaConfig.rotation,
        opacity: mediaConfig.opacity,
        zIndex: mediaConfig.zIndex,
        duration: item.timeRange.timelineEndTime - item.timeRange.timelineStartTime,
        playbackRate: mediaConfig.playbackRate,
        volume: mediaConfig.volume,
        isMuted: mediaConfig.isMuted,
        gain: mediaConfig.gain
      }
    }

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { transform: this.oldTransform },
      afterState: { transform: newTransform }
    }
  }

  /**
   * 执行命令：更新变换属性
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一变换更新操作: ${this.description}`)

      // 更新变换属性
      const result = (this.timelineModule as any).updateTimelineItemTransform(
        this.timelineItemId,
        this.newTransform
      )

      if (!result.success) {
        return this.createErrorResult(result.error || '更新变换属性失败')
      }

      console.log(`✅ 统一变换更新操作完成`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一变换更新操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复原始变换属性
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一变换更新操作: ${this.description}`)

      // 恢复原始变换属性
      const result = (this.timelineModule as any).updateTimelineItemTransform(
        this.timelineItemId,
        this.oldTransform
      )

      if (!result.success) {
        return this.createErrorResult(result.error || '恢复变换属性失败')
      }

      console.log(`✅ 统一变换更新操作撤销完成`)
      return this.createSuccessResult('撤销变换更新操作成功')
    } catch (error) {
      const errorMessage = `撤销统一变换更新操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

/**
 * 统一分割时间轴项目命令
 * 基于UnifiedTimelineItem的分割操作，支持撤销/重做
 */
export class UnifiedSplitTimelineItemCommand extends UnifiedTimelineCommand {
  private originalItem: UnifiedTimelineItem | null = null
  private firstPart: UnifiedTimelineItem | null = null
  private secondPart: UnifiedTimelineItem | null = null

  constructor(
    private timelineItemId: string,
    private splitTimeFrames: number,
    timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      addTimelineItem: (item: UnifiedTimelineItem) => { success: boolean; error?: string }
      removeTimelineItem: (id: string) => { success: boolean; error?: string }
      splitTimelineItem: (id: string, splitTime: number) => { success: boolean; error?: string; firstPart?: UnifiedTimelineItem; secondPart?: UnifiedTimelineItem }
    },
    mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
    private webavModule?: {
      addSprite: (sprite: any) => Promise<boolean>
      removeSprite: (sprite: any) => boolean
    }
  ) {
    const item = timelineModule.getUnifiedTimelineItem(timelineItemId)
    super(
      'timeline.split',
      [timelineItemId],
      `分割时间轴项目: ${item?.config.name || '未知素材'}`,
      timelineModule,
      mediaModule
    )

    // 保存原始项目
    this.originalItem = item ? { ...item } : null

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: {
        singleItem: true,
        originalItem: this.originalItem
      },
      afterState: {
        singleItem: false,
        splitTime: splitTimeFrames
      }
    }
  }

  /**
   * 执行命令：分割时间轴项目
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一分割操作: ${this.description}`)

      if (!this.originalItem) {
        return this.createErrorResult('要分割的时间轴项目不存在')
      }

      // 执行分割操作
      const result = (this.timelineModule as any).splitTimelineItem(
        this.timelineItemId,
        this.splitTimeFrames
      )

      if (!result.success) {
        return this.createErrorResult(result.error || '分割时间轴项目失败')
      }

      // 保存分割后的两部分
      this.firstPart = result.firstPart
      this.secondPart = result.secondPart

      // 处理WebAV集成（如果需要）
      if (this.webavModule) {
        try {
          if (this.firstPart?.sprite && this.firstPart.timelineStatus === 'ready') {
            await this.webavModule.addSprite(this.firstPart.sprite)
          }
          if (this.secondPart?.sprite && this.secondPart.timelineStatus === 'ready') {
            await this.webavModule.addSprite(this.secondPart.sprite)
          }
        } catch (error) {
          console.warn('⚠️ WebAV sprite处理失败:', error)
        }
      }

      console.log(`✅ 统一分割操作完成: 分割为2个部分`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一分割操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复原始项目
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一分割操作: ${this.description}`)

      if (!this.originalItem) {
        return this.createErrorResult('没有可恢复的原始项目')
      }

      // 移除分割后的两部分
      if (this.firstPart) {
        if (this.webavModule && this.firstPart.sprite) {
          this.webavModule.removeSprite(this.firstPart.sprite)
        }
        (this.timelineModule as any).removeTimelineItem(this.firstPart.id)
      }

      if (this.secondPart) {
        if (this.webavModule && this.secondPart.sprite) {
          this.webavModule.removeSprite(this.secondPart.sprite)
        }
        (this.timelineModule as any).removeTimelineItem(this.secondPart.id)
      }

      // 恢复原始项目
      const result = (this.timelineModule as any).addTimelineItem(this.originalItem)
      if (!result.success) {
        return this.createErrorResult(result.error || '恢复原始项目失败')
      }

      // 恢复WebAV sprite
      if (this.webavModule && this.originalItem.sprite && this.originalItem.timelineStatus === 'ready') {
        try {
          await this.webavModule.addSprite(this.originalItem.sprite)
        } catch (error) {
          console.warn('⚠️ WebAV sprite恢复失败:', error)
        }
      }

      console.log(`✅ 统一分割操作撤销完成: 恢复原始项目`)
      return this.createSuccessResult('撤销分割操作成功')
    } catch (error) {
      const errorMessage = `撤销统一分割操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

/**
 * 统一复制时间轴项目命令
 * 基于UnifiedTimelineItem的复制操作，支持撤销/重做
 */
export class UnifiedDuplicateTimelineItemCommand extends UnifiedTimelineCommand {
  private duplicatedItem: UnifiedTimelineItem | null = null

  constructor(
    private originalItemId: string,
    private offsetFrames: number,
    timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      addTimelineItem: (item: UnifiedTimelineItem) => { success: boolean; error?: string }
      removeTimelineItem: (id: string) => { success: boolean; error?: string }
      duplicateTimelineItem: (id: string, offset: number) => { success: boolean; error?: string; duplicatedItem?: UnifiedTimelineItem }
    },
    mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
    private webavModule?: {
      addSprite: (sprite: any) => Promise<boolean>
      removeSprite: (sprite: any) => boolean
    }
  ) {
    const item = timelineModule.getUnifiedTimelineItem(originalItemId)
    super(
      'timeline.duplicate',
      [originalItemId],
      `复制时间轴项目: ${item?.config.name || '未知素材'}`,
      timelineModule,
      mediaModule
    )

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: {
        itemCount: 1
      },
      afterState: {
        itemCount: 2,
        offset: offsetFrames
      }
    }
  }

  /**
   * 执行命令：复制时间轴项目
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一复制操作: ${this.description}`)

      // 执行复制操作
      const result = (this.timelineModule as any).duplicateTimelineItem(
        this.originalItemId,
        this.offsetFrames
      )

      if (!result.success) {
        return this.createErrorResult(result.error || '复制时间轴项目失败')
      }

      // 保存复制的项目
      this.duplicatedItem = result.duplicatedItem

      // 处理WebAV集成（如果需要）
      if (this.webavModule && this.duplicatedItem?.sprite && this.duplicatedItem.timelineStatus === 'ready') {
        try {
          await this.webavModule.addSprite(this.duplicatedItem.sprite)
        } catch (error) {
          console.warn('⚠️ WebAV sprite添加失败:', error)
        }
      }

      console.log(`✅ 统一复制操作完成: ${this.duplicatedItem?.config.name}`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一复制操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：移除复制的项目
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一复制操作: ${this.description}`)

      if (!this.duplicatedItem) {
        return this.createErrorResult('没有可移除的复制项目')
      }

      // 移除WebAV sprite
      if (this.webavModule && this.duplicatedItem.sprite) {
        try {
          this.webavModule.removeSprite(this.duplicatedItem.sprite)
        } catch (error) {
          console.warn('⚠️ WebAV sprite移除失败:', error)
        }
      }

      // 移除复制的项目
      const result = (this.timelineModule as any).removeTimelineItem(this.duplicatedItem.id)
      if (!result.success) {
        return this.createErrorResult(result.error || '移除复制项目失败')
      }

      console.log(`✅ 统一复制操作撤销完成: ${this.duplicatedItem.config.name}`)
      return this.createSuccessResult('撤销复制操作成功')
    } catch (error) {
      const errorMessage = `撤销统一复制操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

/**
 * 统一调整时间轴项目时间范围命令
 * 基于UnifiedTimelineItem的时间范围调整操作，支持撤销/重做
 */
export class UnifiedResizeTimelineItemCommand extends UnifiedTimelineCommand {
  private oldTimeRange: any = {}

  constructor(
    private timelineItemId: string,
    private newTimeRange: {
      timelineStartTime: number
      timelineEndTime: number
    },
    timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      updateTimelineItemTimeRange: (id: string, timeRange: any) => { success: boolean; error?: string }
    },
    mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    }
  ) {
    const item = timelineModule.getUnifiedTimelineItem(timelineItemId)
    super(
      'property.update',
      [timelineItemId],
      `调整时间范围: ${item?.config.name || '未知素材'}`,
      timelineModule,
      mediaModule
    )

    // 保存原始时间范围
    if (item) {
      this.oldTimeRange = {
        timelineStartTime: item.timeRange.timelineStartTime,
        timelineEndTime: item.timeRange.timelineEndTime
      }
    }

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { timeRange: this.oldTimeRange },
      afterState: { timeRange: newTimeRange }
    }
  }

  /**
   * 执行命令：调整时间范围
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一调整时间范围操作: ${this.description}`)

      // 更新时间范围
      const result = (this.timelineModule as any).updateTimelineItemTimeRange(
        this.timelineItemId,
        this.newTimeRange
      )

      if (!result.success) {
        return this.createErrorResult(result.error || '调整时间范围失败')
      }

      console.log(`✅ 统一调整时间范围操作完成`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一调整时间范围操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复原始时间范围
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一调整时间范围操作: ${this.description}`)

      // 恢复原始时间范围
      const result = (this.timelineModule as any).updateTimelineItemTimeRange(
        this.timelineItemId,
        this.oldTimeRange
      )

      if (!result.success) {
        return this.createErrorResult(result.error || '恢复时间范围失败')
      }

      console.log(`✅ 统一调整时间范围操作撤销完成`)
      return this.createSuccessResult('撤销调整时间范围操作成功')
    } catch (error) {
      const errorMessage = `撤销统一调整时间范围操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

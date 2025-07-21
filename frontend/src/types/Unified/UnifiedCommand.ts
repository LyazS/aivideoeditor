/**
 * 统一操作记录系统类型设计
 * 
 * 基于重构架构的统一操作记录系统，支持状态驱动的操作记录、
 * 撤销/重做、批量操作和命令合并等功能
 */

import type { UnifiedTimelineItem, TimelineStatusContext } from './UnifiedTimelineItem'
import type { UnifiedMediaItem, TransitionContext } from './UnifiedMediaItem'

// ==================== 基础命令接口 ====================

/**
 * 统一命令接口 - 所有操作命令的基础接口
 */
export interface UnifiedCommand {
  readonly __type__: 'UnifiedCommand'
  id: string
  type: string
  timestamp: number
  description: string
  
  /**
   * 执行命令
   */
  execute(): Promise<void>
  
  /**
   * 撤销命令
   */
  undo(): Promise<void>
  
  /**
   * 重做命令
   */
  redo(): Promise<void>
  
  /**
   * 检查命令是否可以撤销
   */
  canUndo(): boolean
  
  /**
   * 检查命令是否可以重做
   */
  canRedo(): boolean
  
  /**
   * 获取命令的状态快照
   */
  getSnapshot(): StateSnapshot
  
  /**
   * 检查是否可以与其他命令合并
   */
  canMergeWith(other: UnifiedCommand): boolean
  
  /**
   * 与其他命令合并
   */
  mergeWith(other: UnifiedCommand): UnifiedCommand
}

// ==================== 状态快照接口 ====================

/**
 * 状态快照接口 - 用于撤销/重做操作
 */
export interface StateSnapshot {
  id: string
  timestamp: number
  type: 'timeline_item' | 'media_item' | 'project' | 'batch'
  data: any
  metadata?: Record<string, any>
}

/**
 * 时间轴项目状态快照
 */
export interface TimelineItemSnapshot extends StateSnapshot {
  type: 'timeline_item'
  data: {
    timelineItem: Partial<UnifiedTimelineItem>
    previousState?: any
    newState?: any
  }
}

/**
 * 媒体项目状态快照
 */
export interface MediaItemSnapshot extends StateSnapshot {
  type: 'media_item'
  data: {
    mediaItem: Partial<UnifiedMediaItem>
    previousState?: any
    newState?: any
  }
}

/**
 * 批量操作状态快照
 */
export interface BatchSnapshot extends StateSnapshot {
  type: 'batch'
  data: {
    snapshots: StateSnapshot[]
    batchId: string
    batchDescription: string
  }
}

// ==================== 转换上下文接口 ====================

/**
 * 命令转换上下文 - 包含命令执行的详细信息
 */
export interface CommandTransitionContext {
  commandId: string
  commandType: string
  timestamp: number
  source: 'user' | 'system' | 'api'
  reason: string
  metadata?: Record<string, any>
}

// ==================== 时间轴项目命令基类 ====================

/**
 * 时间轴项目命令基类
 */
export abstract class TimelineItemCommand implements UnifiedCommand {
  public readonly __type__ = 'UnifiedCommand' as const
  public readonly id: string
  public readonly timestamp: number

  constructor(
    public readonly type: string,
    public readonly description: string,
    protected readonly timelineItemId: string
  ) {
    this.id = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.timestamp = Date.now()
  }
  
  abstract execute(): Promise<void>
  abstract undo(): Promise<void>
  abstract redo(): Promise<void>
  abstract getSnapshot(): StateSnapshot
  
  canUndo(): boolean {
    return true // 默认可撤销，子类可重写
  }
  
  canRedo(): boolean {
    return true // 默认可重做，子类可重写
  }
  
  canMergeWith(other: UnifiedCommand): boolean {
    return false // 默认不可合并，子类可重写
  }
  
  mergeWith(other: UnifiedCommand): UnifiedCommand {
    throw new Error('Command merging not implemented')
  }
  
  protected getTimelineItem(): UnifiedTimelineItem | undefined {
    // 这里应该通过时间轴管理器获取项目
    // 实际实现时需要注入依赖
    throw new Error('Timeline item access not implemented')
  }
}

// ==================== 具体命令类型 ====================

/**
 * 时间轴项目移动命令
 */
export class MoveTimelineItemCommand extends TimelineItemCommand {
  private previousPosition: { x: number; y: number }
  private newPosition: { x: number; y: number }
  
  constructor(
    timelineItemId: string,
    newPosition: { x: number; y: number },
    previousPosition: { x: number; y: number }
  ) {
    super('move_timeline_item', `移动时间轴项目`, timelineItemId)
    this.newPosition = newPosition
    this.previousPosition = previousPosition
  }
  
  async execute(): Promise<void> {
    const item = this.getTimelineItem()
    if (item && 'config' in item && 'mediaConfig' in item.config) {
      const mediaConfig = item.config.mediaConfig as any
      if ('x' in mediaConfig && 'y' in mediaConfig) {
        mediaConfig.x = this.newPosition.x
        mediaConfig.y = this.newPosition.y
      }
    }
  }
  
  async undo(): Promise<void> {
    const item = this.getTimelineItem()
    if (item && 'config' in item && 'mediaConfig' in item.config) {
      const mediaConfig = item.config.mediaConfig as any
      if ('x' in mediaConfig && 'y' in mediaConfig) {
        mediaConfig.x = this.previousPosition.x
        mediaConfig.y = this.previousPosition.y
      }
    }
  }
  
  async redo(): Promise<void> {
    await this.execute()
  }
  
  getSnapshot(): StateSnapshot {
    return {
      id: this.id,
      timestamp: this.timestamp,
      type: 'timeline_item',
      data: {
        timelineItemId: this.timelineItemId,
        previousPosition: this.previousPosition,
        newPosition: this.newPosition
      }
    }
  }
  
  canMergeWith(other: UnifiedCommand): boolean {
    return other instanceof MoveTimelineItemCommand &&
           other.timelineItemId === this.timelineItemId &&
           Math.abs(other.timestamp - this.timestamp) < 1000 // 1秒内的移动可合并
  }
  
  mergeWith(other: UnifiedCommand): UnifiedCommand {
    if (other instanceof MoveTimelineItemCommand) {
      return new MoveTimelineItemCommand(
        this.timelineItemId,
        other.newPosition,
        this.previousPosition // 保持最初的位置作为撤销目标
      )
    }
    throw new Error('Cannot merge with incompatible command')
  }
}

/**
 * 时间轴项目删除命令
 */
export class DeleteTimelineItemCommand extends TimelineItemCommand {
  private deletedItem?: UnifiedTimelineItem
  
  constructor(timelineItemId: string) {
    super('delete_timeline_item', `删除时间轴项目`, timelineItemId)
  }
  
  async execute(): Promise<void> {
    this.deletedItem = this.getTimelineItem()
    // 执行删除逻辑
  }
  
  async undo(): Promise<void> {
    if (this.deletedItem) {
      // 恢复删除的项目
    }
  }
  
  async redo(): Promise<void> {
    await this.execute()
  }
  
  getSnapshot(): StateSnapshot {
    return {
      id: this.id,
      timestamp: this.timestamp,
      type: 'timeline_item',
      data: {
        timelineItemId: this.timelineItemId,
        deletedItem: this.deletedItem
      }
    }
  }
}

// ==================== 批量命令接口 ====================

/**
 * 批量命令接口 - 支持批量操作
 */
export interface BatchCommand extends UnifiedCommand {
  commands: UnifiedCommand[]
  batchId: string
  
  /**
   * 添加命令到批量操作
   */
  addCommand(command: UnifiedCommand): void
  
  /**
   * 移除命令从批量操作
   */
  removeCommand(commandId: string): void
  
  /**
   * 获取批量操作中的所有命令
   */
  getCommands(): UnifiedCommand[]
}

/**
 * 批量命令实现
 */
export class BatchCommandImpl implements BatchCommand {
  public readonly __type__ = 'UnifiedCommand' as const
  public readonly id: string
  public readonly type = 'batch'
  public readonly timestamp: number
  public readonly batchId: string
  public commands: UnifiedCommand[] = []

  constructor(
    public readonly description: string,
    batchId?: string
  ) {
    this.id = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.batchId = batchId || this.id
    this.timestamp = Date.now()
  }
  
  addCommand(command: UnifiedCommand): void {
    this.commands.push(command)
  }
  
  removeCommand(commandId: string): void {
    this.commands = this.commands.filter(cmd => cmd.id !== commandId)
  }
  
  getCommands(): UnifiedCommand[] {
    return [...this.commands]
  }
  
  async execute(): Promise<void> {
    for (const command of this.commands) {
      await command.execute()
    }
  }
  
  async undo(): Promise<void> {
    // 逆序撤销
    for (let i = this.commands.length - 1; i >= 0; i--) {
      await this.commands[i].undo()
    }
  }
  
  async redo(): Promise<void> {
    await this.execute()
  }
  
  canUndo(): boolean {
    return this.commands.every(cmd => cmd.canUndo())
  }
  
  canRedo(): boolean {
    return this.commands.every(cmd => cmd.canRedo())
  }
  
  getSnapshot(): StateSnapshot {
    return {
      id: this.id,
      timestamp: this.timestamp,
      type: 'batch',
      data: {
        snapshots: this.commands.map(cmd => cmd.getSnapshot()),
        batchId: this.batchId,
        batchDescription: this.description
      }
    }
  }
  
  canMergeWith(other: UnifiedCommand): boolean {
    return false // 批量命令通常不合并
  }
  
  mergeWith(other: UnifiedCommand): UnifiedCommand {
    throw new Error('Batch commands cannot be merged')
  }
}

// ==================== 类型守卫函数 ====================

/**
 * 检查是否为命令
 */
export function isUnifiedCommand(command: any): command is UnifiedCommand {
  return command && command.__type__ === 'UnifiedCommand'
}

/**
 * 统一操作记录系统类型设计
 *
 * 基于重构架构的统一操作记录系统，支持状态驱动的操作记录、
 * 撤销/重做、批量操作和命令合并等功能
 */

import type { UnifiedTimelineItem } from './UnifiedTimelineItem'

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
  type: 'timeline_item' | 'project' | 'batch'
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

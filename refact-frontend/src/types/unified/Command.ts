/**
 * 统一异步源架构 - 操作记录系统类型定义
 * 
 * 基于统一异步源架构的操作记录和撤销重做系统
 */

import type { BaseDataSource } from './DataSource'

// 命令状态枚举
export enum CommandStatus {
  PENDING = 'pending',      // 等待执行
  EXECUTING = 'executing',  // 执行中
  COMPLETED = 'completed',  // 已完成
  FAILED = 'failed',        // 执行失败
  UNDONE = 'undone',        // 已撤销
  REDONE = 'redone'         // 已重做
}

// 命令类型枚举
export enum CommandType {
  // 媒体操作
  ADD_MEDIA = 'add_media',
  REMOVE_MEDIA = 'remove_media',
  UPDATE_MEDIA = 'update_media',
  
  // 时间轴操作
  ADD_TIMELINE_ITEM = 'add_timeline_item',
  REMOVE_TIMELINE_ITEM = 'remove_timeline_item',
  UPDATE_TIMELINE_ITEM = 'update_timeline_item',
  MOVE_TIMELINE_ITEM = 'move_timeline_item',
  SPLIT_TIMELINE_ITEM = 'split_timeline_item',
  MERGE_TIMELINE_ITEMS = 'merge_timeline_items',
  
  // 轨道操作
  ADD_TRACK = 'add_track',
  REMOVE_TRACK = 'remove_track',
  UPDATE_TRACK = 'update_track',
  REORDER_TRACKS = 'reorder_tracks',
  
  // 变换操作
  UPDATE_TRANSFORM = 'update_transform',
  ADD_KEYFRAME = 'add_keyframe',
  REMOVE_KEYFRAME = 'remove_keyframe',
  UPDATE_KEYFRAME = 'update_keyframe',
  
  // 项目操作
  CREATE_PROJECT = 'create_project',
  SAVE_PROJECT = 'save_project',
  LOAD_PROJECT = 'load_project',
  
  // 批量操作
  BATCH_OPERATION = 'batch_operation'
}

// 基础命令接口
export interface BaseUnifiedCommand {
  /** 命令唯一标识 */
  id: string
  /** 命令类型 */
  type: CommandType
  /** 命令名称（用于显示） */
  name: string
  /** 命令描述 */
  description?: string
  
  // 状态信息
  /** 命令状态 */
  status: CommandStatus
  /** 错误信息 */
  error: string | null
  /** 执行进度 (0-100) */
  progress: number
  
  // 异步源相关
  /** 命令数据源（存储命令执行所需的数据） */
  dataSource?: BaseDataSource<any>
  /** 结果数据源（存储命令执行结果） */
  resultSource?: BaseDataSource<any>
  
  // 撤销重做相关
  /** 是否可撤销 */
  undoable: boolean
  /** 是否可重做 */
  redoable: boolean
  /** 撤销数据 */
  undoData?: any
  /** 重做数据 */
  redoData?: any
  
  // 时间戳
  /** 创建时间 */
  createdAt: Date
  /** 执行时间 */
  executedAt?: Date
  /** 完成时间 */
  completedAt?: Date
  
  // 元数据
  /** 用户ID（如果有用户系统） */
  userId?: string
  /** 会话ID */
  sessionId?: string
  /** 自定义元数据 */
  metadata: Record<string, any>
}

// 具体命令类型

// 添加媒体命令
export interface AddMediaCommand extends BaseUnifiedCommand {
  type: CommandType.ADD_MEDIA
  /** 媒体文件数据 */
  mediaData: File | string | ArrayBuffer
  /** 媒体类型 */
  mediaType: string
  /** 目标位置 */
  targetIndex?: number
}

// 添加时间轴项目命令
export interface AddTimelineItemCommand extends BaseUnifiedCommand {
  type: CommandType.ADD_TIMELINE_ITEM
  /** 轨道ID */
  trackId: string
  /** 开始时间 */
  startFrame: number
  /** 持续时间 */
  durationFrames: number
  /** 媒体项目ID（如果是媒体片段） */
  mediaItemId?: string
  /** 项目配置 */
  itemConfig: Record<string, any>
}

// 更新变换命令
export interface UpdateTransformCommand extends BaseUnifiedCommand {
  type: CommandType.UPDATE_TRANSFORM
  /** 目标项目ID */
  targetItemId: string
  /** 新的变换属性 */
  newTransform: Record<string, any>
  /** 旧的变换属性（用于撤销） */
  oldTransform: Record<string, any>
}

// 批量操作命令
export interface BatchOperationCommand extends BaseUnifiedCommand {
  type: CommandType.BATCH_OPERATION
  /** 子命令列表 */
  subCommands: BaseUnifiedCommand[]
  /** 是否原子操作（全部成功或全部失败） */
  atomic: boolean
}

// 联合命令类型
export type UnifiedCommand = 
  | AddMediaCommand
  | AddTimelineItemCommand
  | UpdateTransformCommand
  | BatchOperationCommand
  | BaseUnifiedCommand

// 命令执行器接口
export interface CommandExecutor {
  /** 执行命令 */
  execute(command: UnifiedCommand): Promise<any>
  
  /** 撤销命令 */
  undo(command: UnifiedCommand): Promise<any>
  
  /** 重做命令 */
  redo(command: UnifiedCommand): Promise<any>
  
  /** 检查命令是否可执行 */
  canExecute(command: UnifiedCommand): boolean
  
  /** 检查命令是否可撤销 */
  canUndo(command: UnifiedCommand): boolean
  
  /** 检查命令是否可重做 */
  canRedo(command: UnifiedCommand): boolean
}

// 命令历史管理器接口
export interface CommandHistoryManager {
  /** 添加命令到历史 */
  addCommand(command: UnifiedCommand): void
  
  /** 执行命令并添加到历史 */
  executeCommand(command: UnifiedCommand): Promise<any>
  
  /** 撤销最后一个命令 */
  undo(): Promise<boolean>
  
  /** 重做下一个命令 */
  redo(): Promise<boolean>
  
  /** 获取历史记录 */
  getHistory(): UnifiedCommand[]
  
  /** 获取当前位置 */
  getCurrentIndex(): number
  
  /** 清空历史 */
  clearHistory(): void
  
  /** 检查是否可撤销 */
  canUndo(): boolean
  
  /** 检查是否可重做 */
  canRedo(): boolean
  
  /** 监听历史变化 */
  subscribe(callback: (history: UnifiedCommand[], currentIndex: number) => void): () => void
}

// 命令创建配置
export interface CreateCommandConfig {
  /** 命令类型 */
  type: CommandType
  /** 命令名称 */
  name: string
  /** 命令描述 */
  description?: string
  /** 是否可撤销 */
  undoable?: boolean
  /** 命令数据 */
  data?: any
  /** 自定义元数据 */
  metadata?: Record<string, any>
}

// 命令查询条件
export interface CommandQuery {
  /** 按类型筛选 */
  type?: CommandType | CommandType[]
  /** 按状态筛选 */
  status?: CommandStatus | CommandStatus[]
  /** 按时间范围筛选 */
  createdAfter?: Date
  createdBefore?: Date
  /** 按用户筛选 */
  userId?: string
  /** 按会话筛选 */
  sessionId?: string
  /** 排序 */
  sortBy?: 'createdAt' | 'executedAt' | 'completedAt'
  sortOrder?: 'asc' | 'desc'
  /** 分页 */
  limit?: number
  offset?: number
}

// 命令管理器接口
export interface UnifiedCommandManager {
  /** 创建命令 */
  createCommand(config: CreateCommandConfig): UnifiedCommand
  
  /** 获取命令 */
  getCommand(id: string): UnifiedCommand | null
  
  /** 查询命令 */
  queryCommands(query: CommandQuery): UnifiedCommand[]
  
  /** 更新命令 */
  updateCommand(id: string, updates: Partial<UnifiedCommand>): void
  
  /** 删除命令 */
  removeCommand(id: string): void
  
  /** 获取历史管理器 */
  getHistoryManager(): CommandHistoryManager
  
  /** 获取执行器 */
  getExecutor(): CommandExecutor
  
  /** 监听命令变化 */
  subscribe(callback: (commands: UnifiedCommand[]) => void): () => void
  
  /** 清理资源 */
  cleanup(): void
}

import { ref } from 'vue'
import type { NotificationManager } from '../../types'

// ==================== 统一命令接口 ====================

/**
 * 操作类型枚举
 */
export type OperationType =
  // 时间轴项目操作
  | 'timeline.create' | 'timeline.delete' | 'timeline.move' | 'timeline.split' | 'timeline.duplicate'
  // 属性操作
  | 'property.update' | 'property.batch_update'
  // 关键帧操作
  | 'keyframe.create' | 'keyframe.delete' | 'keyframe.update' | 'keyframe.clear'
  // 轨道操作
  | 'track.create' | 'track.delete' | 'track.reorder' | 'track.rename' | 'track.toggle_visibility' | 'track.toggle_mute'
  // 选择操作
  | 'selection.change'
  // 批量操作
  | 'batch.operation'

/**
 * 命令目标信息
 */
export interface CommandTargetInfo {
  type: 'timeline' | 'track' | 'selection' | 'batch'
  ids: string[] // 目标对象ID列表
  metadata?: Record<string, any> // 额外的目标信息
}

/**
 * 状态转换信息
 */
export interface StateTransitionInfo {
  beforeState?: Record<string, any> // 操作前状态快照
  afterState?: Record<string, any> // 操作后状态快照
  transitionContext?: Record<string, any> // 转换上下文
}

/**
 * 命令执行结果
 */
export interface CommandResult {
  success: boolean
  error?: string
  message?: string
  timestamp: number
  affectedItems?: string[]
  metadata?: Record<string, any>
}

/**
 * 重构后的统一命令接口
 * 基于状态转换的操作记录，支持丰富的上下文信息
 */
export interface UnifiedCommand {
  // 基础属性
  id: string
  description: string
  timestamp: number
  
  // 操作类型标识
  operationType: OperationType
  
  // 目标对象信息
  targetInfo: CommandTargetInfo
  
  // 状态转换信息
  stateTransition: StateTransitionInfo
  
  // 执行和撤销方法
  execute(): Promise<CommandResult>
  undo(): Promise<CommandResult>
  
  // 可选的验证方法
  canExecute?(): boolean
  canUndo?(): boolean
  
  // 操作合并支持（用于优化历史记录）
  canMergeWith?(other: UnifiedCommand): boolean
  mergeWith?(other: UnifiedCommand): UnifiedCommand
}

// ==================== 批量命令实现 ====================

/**
 * 生成命令ID
 */
function generateCommandId(): string {
  return `unified_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * 统一批量命令基类
 * 支持将多个统一命令组合为一个批量操作，统一执行和撤销
 */
export abstract class UnifiedBaseBatchCommand implements UnifiedCommand {
  public readonly id: string
  public readonly description: string
  public readonly timestamp: number
  public readonly operationType: OperationType = 'batch.operation'
  public readonly targetInfo: CommandTargetInfo
  public readonly stateTransition: StateTransitionInfo
  protected subCommands: UnifiedCommand[] = []

  constructor(description: string) {
    this.id = generateCommandId()
    this.description = description
    this.timestamp = Date.now()
    this.targetInfo = { type: 'batch', ids: [] }
    this.stateTransition = {}
  }

  /**
   * 批量执行：依次执行所有子命令
   */
  async execute(): Promise<CommandResult> {
    const affectedItems: string[] = []
    
    try {
      for (const command of this.subCommands) {
        const result = await command.execute()
        if (!result.success) {
          throw new Error(result.error || '子命令执行失败')
        }
        if (result.affectedItems) {
          affectedItems.push(...result.affectedItems)
        }
      }
      
      return {
        success: true,
        timestamp: Date.now(),
        affectedItems: [...new Set(affectedItems)] // 去重
      }
    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : '批量执行失败'
      }
    }
  }

  /**
   * 批量撤销：逆序撤销所有子命令
   */
  async undo(): Promise<CommandResult> {
    const affectedItems: string[] = []
    
    try {
      for (let i = this.subCommands.length - 1; i >= 0; i--) {
        const result = await this.subCommands[i].undo()
        if (!result.success) {
          throw new Error(result.error || '子命令撤销失败')
        }
        if (result.affectedItems) {
          affectedItems.push(...result.affectedItems)
        }
      }
      
      return {
        success: true,
        timestamp: Date.now(),
        affectedItems: [...new Set(affectedItems)] // 去重
      }
    } catch (error) {
      return {
        success: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : '批量撤销失败'
      }
    }
  }

  /**
   * 添加子命令
   */
  protected addCommand(command: UnifiedCommand): void {
    this.subCommands.push(command)
    // 更新目标信息
    this.updateTargetInfo()
  }

  /**
   * 更新目标信息
   */
  protected updateTargetInfo(): void {
    const allIds = new Set<string>()
    const types = new Set<string>()

    for (const cmd of this.subCommands) {
      cmd.targetInfo.ids.forEach(id => allIds.add(id))
      types.add(cmd.targetInfo.type)
    }

    this.targetInfo.ids = Array.from(allIds)
    this.targetInfo.type = types.size === 1 ? Array.from(types)[0] as any : 'batch'
  }

  /**
   * 获取批量操作摘要
   */
  getBatchSummary(): string {
    return `${this.description} (${this.subCommands.length}个操作)`
  }
}

/**
 * 批量操作构建器
 * 提供链式调用方式构建批量命令
 */
export class UnifiedBatchBuilder {
  private commands: UnifiedCommand[] = []
  private description: string

  constructor(description: string) {
    this.description = description
  }

  /**
   * 添加命令到批量操作（支持链式调用）
   */
  addCommand(command: UnifiedCommand): UnifiedBatchBuilder {
    this.commands.push(command)
    return this
  }

  /**
   * 构建批量命令
   */
  build(): UnifiedGenericBatchCommand {
    return new UnifiedGenericBatchCommand(this.description, this.commands)
  }

  /**
   * 获取命令数量
   */
  getCommandCount(): number {
    return this.commands.length
  }
}

/**
 * 通用批量命令实现
 */
export class UnifiedGenericBatchCommand extends UnifiedBaseBatchCommand {
  constructor(description: string, commands: UnifiedCommand[]) {
    super(description)
    this.subCommands = [...commands]
    this.updateTargetInfo()
  }
}

// ==================== 统一历史管理器 ====================

/**
 * 统一历史管理器
 * 基于UnifiedCommand接口的历史记录管理，支持智能命令合并
 */
class UnifiedHistoryManager {
  private commands: UnifiedCommand[] = []
  private currentIndex = -1
  private maxHistorySize = 100
  private notificationManager: NotificationManager

  constructor(notificationManager: NotificationManager) {
    this.notificationManager = notificationManager
  }

  /**
   * 执行命令并添加到历史记录
   * @param command 要执行的统一命令
   */
  async executeCommand(command: UnifiedCommand): Promise<void> {
    try {
      // 执行命令
      const result = await command.execute()
      
      if (!result.success) {
        throw new Error(result.error || '命令执行失败')
      }

      // 清除当前位置之后的所有命令（如果用户在历史中间执行了新命令）
      if (this.currentIndex < this.commands.length - 1) {
        this.commands.splice(this.currentIndex + 1)
      }

      // 添加新命令到历史记录
      this.commands.push(command)
      this.currentIndex++

      // 限制历史记录大小
      if (this.commands.length > this.maxHistorySize) {
        this.commands.shift()
        this.currentIndex--
      }

      console.log(`✅ 统一命令已执行: ${command.description}`)
      console.log(`📊 历史记录: ${this.currentIndex + 1}/${this.commands.length}`)
    } catch (error) {
      console.error(`❌ 统一命令执行失败: ${command.description}`, error)

      // 显示错误通知
      this.notificationManager.showError(
        '操作执行失败',
        `无法执行操作: ${command.description}。${error instanceof Error ? error.message : '未知错误'}`,
      )

      throw error
    }
  }

  /**
   * 撤销上一个命令
   * @returns 是否成功撤销
   */
  async undo(): Promise<boolean> {
    if (!this.canUndo()) {
      console.log('⚠️ 没有可撤销的操作')
      this.notificationManager.showWarning('无法撤销', '没有可撤销的操作')
      return false
    }

    try {
      const command = this.commands[this.currentIndex]
      const result = await command.undo()

      if (!result.success) {
        throw new Error(result.error || '撤销失败')
      }

      this.currentIndex--

      console.log(`↩️ 已撤销: ${command.description}`)
      console.log(`📊 历史记录: ${this.currentIndex + 1}/${this.commands.length}`)

      // 显示成功通知
      this.notificationManager.showSuccess('撤销成功', `已撤销: ${command.description}`)

      return true
    } catch (error) {
      console.error('❌ 撤销操作失败', error)

      // 显示错误通知
      this.notificationManager.showError(
        '撤销失败',
        `撤销操作时发生错误。${error instanceof Error ? error.message : '未知错误'}`,
      )

      return false
    }
  }

  /**
   * 重做下一个命令
   * @returns 是否成功重做
   */
  async redo(): Promise<boolean> {
    if (!this.canRedo()) {
      console.log('⚠️ 没有可重做的操作')
      this.notificationManager.showWarning('无法重做', '没有可重做的操作')
      return false
    }

    try {
      this.currentIndex++
      const command = this.commands[this.currentIndex]
      const result = await command.execute()

      if (!result.success) {
        this.currentIndex-- // 回滚索引
        throw new Error(result.error || '重做失败')
      }

      console.log(`↪️ 已重做: ${command.description}`)
      console.log(`📊 历史记录: ${this.currentIndex + 1}/${this.commands.length}`)

      // 显示成功通知
      this.notificationManager.showSuccess('重做成功', `已重做: ${command.description}`)

      return true
    } catch (error) {
      console.error('❌ 重做操作失败', error)

      // 显示错误通知
      this.notificationManager.showError(
        '重做失败',
        `重做操作时发生错误。${error instanceof Error ? error.message : '未知错误'}`,
      )

      return false
    }
  }

  /**
   * 检查是否可以撤销
   * @returns 是否可以撤销
   */
  canUndo(): boolean {
    return this.currentIndex >= 0
  }

  /**
   * 检查是否可以重做
   * @returns 是否可以重做
   */
  canRedo(): boolean {
    return this.currentIndex < this.commands.length - 1
  }

  /**
   * 清空历史记录
   */
  clear(): void {
    this.commands = []
    this.currentIndex = -1
    console.log('🗑️ 统一历史记录已清空')
  }

  /**
   * 开始批量操作
   * @param description 批量操作描述
   * @returns 批量操作构建器
   */
  startBatch(description: string): UnifiedBatchBuilder {
    return new UnifiedBatchBuilder(description)
  }

  /**
   * 执行批量命令
   * @param batchCommand 要执行的批量命令
   */
  async executeBatchCommand(batchCommand: UnifiedBaseBatchCommand): Promise<void> {
    try {
      const result = await batchCommand.execute()

      if (!result.success) {
        throw new Error(result.error || '批量命令执行失败')
      }

      // 添加到历史记录（作为单个条目）
      if (this.currentIndex < this.commands.length - 1) {
        this.commands.splice(this.currentIndex + 1)
      }

      this.commands.push(batchCommand)
      this.currentIndex++

      // 限制历史记录大小
      if (this.commands.length > this.maxHistorySize) {
        this.commands.shift()
        this.currentIndex--
      }

      console.log(`✅ 批量命令已执行: ${batchCommand.getBatchSummary()}`)

      // 显示批量操作成功通知
      this.notificationManager.showSuccess('批量操作完成', batchCommand.getBatchSummary())
    } catch (error) {
      console.error(`❌ 批量命令执行失败: ${batchCommand.description}`, error)

      this.notificationManager.showError(
        '批量操作失败',
        `${batchCommand.description}执行失败。${error instanceof Error ? error.message : '未知错误'}`,
      )

      throw error
    }
  }

  /**
   * 获取历史记录摘要（用于调试）
   * @returns 历史记录摘要
   */
  getHistorySummary() {
    return {
      totalCommands: this.commands.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      commands: this.commands.map((cmd, index) => ({
        id: cmd.id,
        description: cmd.description,
        operationType: cmd.operationType,
        timestamp: cmd.timestamp,
        isCurrent: index === this.currentIndex,
        isExecuted: index <= this.currentIndex,
        isBatch: cmd instanceof UnifiedBaseBatchCommand,
        batchSummary: cmd instanceof UnifiedBaseBatchCommand ? cmd.getBatchSummary() : undefined,
        targetInfo: cmd.targetInfo,
      })),
    }
  }
}

// ==================== 统一历史管理模块 ====================

/**
 * 统一历史管理模块
 * 提供响应式的撤销/重做状态和方法，基于新架构的统一类型
 */
export function createUnifiedHistoryModule(notificationManager: NotificationManager) {
  // ==================== 状态定义 ====================

  // 创建统一历史管理器
  const historyManager = new UnifiedHistoryManager(notificationManager)

  // 响应式状态
  const canUndo = ref(false)
  const canRedo = ref(false)

  // ==================== 内部方法 ====================

  /**
   * 更新响应式状态
   */
  function updateReactiveState() {
    canUndo.value = historyManager.canUndo()
    canRedo.value = historyManager.canRedo()
  }

  // ==================== 公共方法 ====================

  /**
   * 执行统一命令
   * @param command 要执行的统一命令
   */
  async function executeCommand(command: UnifiedCommand): Promise<void> {
    await historyManager.executeCommand(command)
    updateReactiveState()
  }

  /**
   * 撤销操作
   * @returns 是否成功撤销
   */
  async function undo(): Promise<boolean> {
    const result = await historyManager.undo()
    updateReactiveState()
    return result
  }

  /**
   * 重做操作
   * @returns 是否成功重做
   */
  async function redo(): Promise<boolean> {
    const result = await historyManager.redo()
    updateReactiveState()
    return result
  }

  /**
   * 清空历史记录
   */
  function clear(): void {
    historyManager.clear()
    updateReactiveState()
  }

  /**
   * 获取历史记录摘要
   * @returns 历史记录摘要
   */
  function getHistorySummary() {
    return historyManager.getHistorySummary()
  }

  /**
   * 开始批量操作
   * @param description 批量操作描述
   * @returns 批量操作构建器
   */
  function startBatch(description: string): UnifiedBatchBuilder {
    return historyManager.startBatch(description)
  }

  /**
   * 执行批量命令
   * @param batchCommand 要执行的批量命令
   */
  async function executeBatchCommand(batchCommand: UnifiedBaseBatchCommand): Promise<void> {
    await historyManager.executeBatchCommand(batchCommand)
    updateReactiveState()
  }

  // ==================== 导出接口 ====================

  return {
    // 响应式状态
    canUndo,
    canRedo,

    // 历史操作方法
    executeCommand,
    undo,
    redo,
    clear,
    getHistorySummary,

    // 批量操作方法
    startBatch,
    executeBatchCommand,
  }
}

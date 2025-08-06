import { ref } from 'vue'
import type { NotificationManager } from '../../types'
import type { SimpleCommand } from './commands/types'

/**
 * 批量命令基类
 * 支持将多个单个命令组合为一个批量操作，统一执行和撤销
 */
export abstract class BaseBatchCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  protected subCommands: SimpleCommand[] = []

  constructor(description: string) {
    this.id = this.generateCommandId()
    this.description = description
  }

  /**
   * 批量执行：依次执行所有子命令
   */
  async execute(): Promise<void> {
    for (const command of this.subCommands) {
      await command.execute()
    }
  }

  /**
   * 批量撤销：逆序撤销所有子命令
   */
  async undo(): Promise<void> {
    for (let i = this.subCommands.length - 1; i >= 0; i--) {
      await this.subCommands[i].undo()
    }
  }

  /**
   * 添加子命令
   */
  protected addCommand(command: SimpleCommand): void {
    this.subCommands.push(command)
  }

  /**
   * 获取批量操作摘要
   */
  getBatchSummary(): string {
    return `${this.description} (${this.subCommands.length}个操作)`
  }

  /**
   * 生成命令ID
   */
  private generateCommandId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }
}

/**
 * 批量操作构建器
 * 提供链式调用方式构建批量命令
 */
export class BatchBuilder {
  private commands: SimpleCommand[] = []
  private description: string

  constructor(description: string) {
    this.description = description
  }

  /**
   * 添加命令到批量操作（支持链式调用）
   */
  addCommand(command: SimpleCommand): BatchBuilder {
    this.commands.push(command)
    return this
  }

  /**
   * 构建批量命令
   */
  build(): GenericBatchCommand {
    return new GenericBatchCommand(this.description, this.commands)
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
export class GenericBatchCommand extends BaseBatchCommand {
  constructor(description: string, commands: SimpleCommand[]) {
    super(description)
    this.subCommands = [...commands]
  }
}

/**
 * 简单历史管理器
 * 阶段1的最简实现，管理命令历史栈和撤销/重做逻辑
 */
class SimpleHistoryManager {
  private commands: SimpleCommand[] = []
  private currentIndex = -1
  private notificationManager: NotificationManager

  constructor(notificationManager: NotificationManager) {
    this.notificationManager = notificationManager
  }

  /**
   * 执行命令并添加到历史记录
   * @param command 要执行的命令
   */
  async executeCommand(command: SimpleCommand): Promise<void> {
    try {
      // 执行命令
      await command.execute()

      // 清除当前位置之后的所有命令（如果用户在历史中间执行了新命令）
      if (this.currentIndex < this.commands.length - 1) {
        this.commands.splice(this.currentIndex + 1)
      }

      // 添加新命令到历史记录
      this.commands.push(command)
      this.currentIndex++

      console.log(`✅ 命令已执行: ${command.description}`)
      console.log(`📊 历史记录: ${this.currentIndex + 1}/${this.commands.length}`)
    } catch (error) {
      console.error(`❌ 命令执行失败: ${command.description}`, error)

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
      await command.undo()
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
      await command.execute()

      console.log(`↪️ 已重做: ${command.description}`)
      console.log(`📊 历史记录: ${this.currentIndex + 1}/${this.commands.length}`)

      // 显示成功通知
      this.notificationManager.showSuccess('重做成功', `已重做: ${command.description}`)

      return true
    } catch (error) {
      console.error('❌ 重做操作失败', error)
      this.currentIndex-- // 回滚索引

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
    console.log('🗑️ 历史记录已清空')
  }

  /**
   * 开始批量操作
   * @param description 批量操作描述
   * @returns 批量操作构建器
   */
  startBatch(description: string): BatchBuilder {
    return new BatchBuilder(description)
  }

  /**
   * 执行批量命令
   * @param batchCommand 要执行的批量命令
   */
  async executeBatchCommand(batchCommand: BaseBatchCommand): Promise<void> {
    try {
      await batchCommand.execute()

      // 添加到历史记录（作为单个条目）
      if (this.currentIndex < this.commands.length - 1) {
        this.commands.splice(this.currentIndex + 1)
      }

      this.commands.push(batchCommand)
      this.currentIndex++

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
        isCurrent: index === this.currentIndex,
        isExecuted: index <= this.currentIndex,
        isBatch: cmd instanceof BaseBatchCommand,
        batchSummary: cmd instanceof BaseBatchCommand ? cmd.getBatchSummary() : undefined,
      })),
    }
  }

  /**
   * 根据命令ID获取命令
   * @param id 命令ID
   * @returns 找到的命令，如果未找到则返回undefined
   */
  getCommandById(id: string): SimpleCommand | undefined {
    return this.commands.find(command => command.id === id)
  }
}

/**
 * 历史管理模块
 * 提供响应式的撤销/重做状态和方法
 */
export function createUnifiedHistoryModule(notificationManager: NotificationManager) {
  // ==================== 状态定义 ====================

  // 创建历史管理器
  const historyManager = new SimpleHistoryManager(notificationManager)

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
   * 执行命令
   * @param command 要执行的命令
   */
  async function executeCommand(command: SimpleCommand): Promise<void> {
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
  function startBatch(description: string): BatchBuilder {
    return historyManager.startBatch(description)
  }

  /**
   * 执行批量命令
   * @param batchCommand 要执行的批量命令
   */
  async function executeBatchCommand(batchCommand: BaseBatchCommand): Promise<void> {
    await historyManager.executeBatchCommand(batchCommand)
    updateReactiveState()
  }

  /**
   * 根据命令ID获取命令
   * @param id 命令ID
   * @returns 找到的命令，如果未找到则返回undefined
   */
  function getCommandById(id: string): SimpleCommand | undefined {
    return historyManager.getCommandById(id)
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

    // 命令查询方法
    getCommandById,
  }
}

import { ref } from 'vue'

/**
 * 简单命令接口
 * 阶段1的最简实现，只包含基础的execute和undo方法
 */
export interface SimpleCommand {
  id: string
  description: string
  execute(): void | Promise<void>
  undo(): void | Promise<void>
}

/**
 * 简单历史管理器
 * 阶段1的最简实现，管理命令历史栈和撤销/重做逻辑
 */
class SimpleHistoryManager {
  private commands: SimpleCommand[] = []
  private currentIndex = -1

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
      return false
    }

    try {
      const command = this.commands[this.currentIndex]
      await command.undo()
      this.currentIndex--

      console.log(`↩️ 已撤销: ${command.description}`)
      console.log(`📊 历史记录: ${this.currentIndex + 1}/${this.commands.length}`)
      return true
    } catch (error) {
      console.error('❌ 撤销操作失败', error)
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
      return false
    }

    try {
      this.currentIndex++
      const command = this.commands[this.currentIndex]
      await command.execute()

      console.log(`↪️ 已重做: ${command.description}`)
      console.log(`📊 历史记录: ${this.currentIndex + 1}/${this.commands.length}`)
      return true
    } catch (error) {
      console.error('❌ 重做操作失败', error)
      this.currentIndex-- // 回滚索引
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
        isExecuted: index <= this.currentIndex
      }))
    }
  }
}

/**
 * 历史管理模块
 * 提供响应式的撤销/重做状态和方法
 */
export function createHistoryModule() {
  // ==================== 状态定义 ====================
  
  const historyManager = new SimpleHistoryManager()
  
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

  // ==================== 导出接口 ====================

  return {
    // 响应式状态
    canUndo,
    canRedo,

    // 方法
    executeCommand,
    undo,
    redo,
    clear,
    getHistorySummary,
  }
}

import type { Operation, OperationResult, ExecutionStrategy } from '../types'
import type { HistoryListener, HistorySummary } from './HistoryTypes'
import { CompositeOperationImpl } from '../base'

/**
 * 现代化历史管理器
 * 提供完整的操作历史管理功能
 */
export class HistoryManager {
  private history: Operation[] = []
  private currentIndex = -1
  private maxHistorySize = 100
  private listeners: HistoryListener[] = []
  private mergeTimeWindow = 1000 // 1秒内的操作可以合并

  /**
   * 执行操作
   */
  async execute(operation: Operation): Promise<OperationResult> {
    // 1. 验证操作
    if (operation.validate && !(await operation.validate())) {
      return {
        success: false,
        error: 'Operation validation failed',
        metadata: { operationId: operation.id, operationType: operation.type }
      }
    }

    // 2. 执行操作
    const result = await operation.execute()

    if (result.success) {
      // 3. 清理分支历史（如果用户在历史中间执行了新操作）
      this.history.splice(this.currentIndex + 1)

      // 4. 尝试合并操作
      const merged = this.tryMergeWithLast(operation)
      if (!merged) {
        this.history.push(operation)
        this.currentIndex++
      }

      // 5. 限制历史大小
      this.trimHistory()

      // 6. 通知监听器
      this.notifyListeners('executed', operation, result)
    }

    return result
  }

  /**
   * 撤销操作
   */
  async undo(): Promise<OperationResult | null> {
    if (!this.canUndo()) {
      return {
        success: false,
        error: 'No operation to undo'
      }
    }

    const operation = this.history[this.currentIndex]

    // 验证依赖
    if (operation.validate && !(await operation.validate())) {
      return {
        success: false,
        error: 'Cannot undo: operation dependencies not met',
        metadata: { operationId: operation.id, operationType: operation.type }
      }
    }

    const result = await operation.undo()

    if (result.success) {
      this.currentIndex--
      this.notifyListeners('undone', operation, result)
    }

    return result
  }

  /**
   * 重做操作
   */
  async redo(): Promise<OperationResult | null> {
    if (!this.canRedo()) {
      return {
        success: false,
        error: 'No operation to redo'
      }
    }

    this.currentIndex++
    const operation = this.history[this.currentIndex]

    // 验证依赖
    if (operation.validate && !(await operation.validate())) {
      this.currentIndex-- // 回滚索引
      return {
        success: false,
        error: 'Cannot redo: operation dependencies not met',
        metadata: { operationId: operation.id, operationType: operation.type }
      }
    }

    const result = await operation.execute()

    if (result.success) {
      this.notifyListeners('redone', operation, result)
    } else {
      this.currentIndex-- // 回滚索引
    }

    return result
  }

  /**
   * 批量执行操作
   */
  async executeBatch(operations: Operation[], strategy: ExecutionStrategy = 'transactional'): Promise<OperationResult> {
    const batchOp = new CompositeOperationImpl(
      operations,
      strategy,
      `批量操作 (${operations.length} 个操作)`,
      { batchSize: operations.length, strategy }
    )

    return this.execute(batchOp)
  }

  /**
   * 获取历史摘要
   */
  getHistorySummary(): HistorySummary {
    return {
      total: this.history.length,
      current: this.currentIndex + 1,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      operations: this.history.map((op, index) => ({
        id: op.id,
        type: op.type,
        description: op.description,
        timestamp: op.timestamp,
        isCurrent: index === this.currentIndex,
        metadata: op.metadata
      }))
    }
  }

  /**
   * 清空历史记录
   */
  clear(): void {
    this.history = []
    this.currentIndex = -1
    this.notifyListeners('cleared', null, { success: true })
  }

  /**
   * 添加历史监听器
   */
  addListener(listener: HistoryListener): void {
    this.listeners.push(listener)
  }

  /**
   * 移除历史监听器
   */
  removeListener(listener: HistoryListener): void {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  canUndo(): boolean {
    return this.currentIndex >= 0
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1
  }

  // ==================== 私有方法 ====================

  private tryMergeWithLast(operation: Operation): boolean {
    if (this.history.length === 0) return false

    const lastOp = this.history[this.currentIndex]

    // 检查是否可以合并
    if (lastOp.canMerge?.(operation)) {
      // 检查时间窗口
      const timeDiff = operation.timestamp - lastOp.timestamp
      if (timeDiff <= this.mergeTimeWindow) {
        const merged = lastOp.merge!(operation)
        this.history[this.currentIndex] = merged
        return true
      }
    }

    return false
  }

  private trimHistory(): void {
    if (this.history.length > this.maxHistorySize) {
      const removeCount = this.history.length - this.maxHistorySize
      this.history.splice(0, removeCount)
      this.currentIndex -= removeCount
    }
  }

  private notifyListeners(event: string, operation: Operation | null, result: OperationResult): void {
    this.listeners.forEach(listener => {
      try {
        listener(event, operation, result)
      } catch (error) {
        console.error('History listener error:', error)
      }
    })
  }
}

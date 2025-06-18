import type { Operation, OperationResult } from '../types'
import { ReactiveHistoryManager } from '../history/ReactiveHistoryManager'

/**
 * 操作调度器
 * 提供高级的操作调度功能，包括队列管理、优先级处理、批量优化等
 */
export class OperationScheduler {
  private historyManager: ReactiveHistoryManager
  private operationQueue: QueuedOperation[] = []
  private isProcessing = false
  private maxConcurrency = 1 // 默认串行执行
  private currentlyExecuting = 0

  constructor(historyManager: ReactiveHistoryManager) {
    this.historyManager = historyManager
  }

  /**
   * 调度操作执行
   */
  async schedule(operation: Operation, options: ScheduleOptions = {}): Promise<OperationResult> {
    const queuedOp: QueuedOperation = {
      operation,
      priority: options.priority || 0,
      immediate: options.immediate || false,
      resolve: () => {},
      reject: () => {},
      promise: Promise.resolve({ success: false, error: 'Not executed' })
    }

    // 创建Promise
    queuedOp.promise = new Promise<OperationResult>((resolve, reject) => {
      queuedOp.resolve = resolve
      queuedOp.reject = reject
    })

    if (options.immediate) {
      // 立即执行
      return this.executeOperation(queuedOp)
    } else {
      // 加入队列
      this.enqueue(queuedOp)
      this.processQueue()
      return queuedOp.promise
    }
  }

  /**
   * 批量调度操作
   */
  async scheduleBatch(operations: Operation[], options: BatchScheduleOptions = {}): Promise<OperationResult[]> {
    if (options.optimize) {
      // 优化批量操作
      operations = this.optimizeBatch(operations)
    }

    const promises = operations.map(op => 
      this.schedule(op, { priority: options.priority })
    )

    return Promise.all(promises)
  }

  /**
   * 设置并发数
   */
  setConcurrency(maxConcurrency: number): void {
    this.maxConcurrency = Math.max(1, maxConcurrency)
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    // 拒绝所有等待中的操作
    this.operationQueue.forEach(queuedOp => {
      queuedOp.reject(new Error('Queue cleared'))
    })
    this.operationQueue = []
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): QueueStatus {
    return {
      pending: this.operationQueue.length,
      executing: this.currentlyExecuting,
      maxConcurrency: this.maxConcurrency
    }
  }

  /**
   * 入队操作
   */
  private enqueue(queuedOp: QueuedOperation): void {
    // 按优先级插入
    let insertIndex = this.operationQueue.length
    for (let i = 0; i < this.operationQueue.length; i++) {
      if (this.operationQueue[i].priority < queuedOp.priority) {
        insertIndex = i
        break
      }
    }
    this.operationQueue.splice(insertIndex, 0, queuedOp)
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true

    while (this.operationQueue.length > 0 && this.currentlyExecuting < this.maxConcurrency) {
      const queuedOp = this.operationQueue.shift()!
      this.executeOperation(queuedOp)
    }

    this.isProcessing = false
  }

  /**
   * 执行操作
   */
  private async executeOperation(queuedOp: QueuedOperation): Promise<OperationResult> {
    this.currentlyExecuting++

    try {
      const result = await this.historyManager.execute(queuedOp.operation)
      queuedOp.resolve(result)
      return result
    } catch (error) {
      const errorResult: OperationResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      queuedOp.reject(error)
      return errorResult
    } finally {
      this.currentlyExecuting--
      // 继续处理队列
      if (this.operationQueue.length > 0) {
        setTimeout(() => this.processQueue(), 0)
      }
    }
  }

  /**
   * 优化批量操作
   */
  private optimizeBatch(operations: Operation[]): Operation[] {
    // 这里可以实现各种优化策略：
    // 1. 合并相似操作
    // 2. 重排序以减少冲突
    // 3. 移除冗余操作
    
    const optimized: Operation[] = []
    const mergeGroups = new Map<string, Operation[]>()

    // 按操作类型分组
    operations.forEach(op => {
      const key = `${op.type}_${this.getOperationTarget(op)}`
      if (!mergeGroups.has(key)) {
        mergeGroups.set(key, [])
      }
      mergeGroups.get(key)!.push(op)
    })

    // 尝试合并每个组中的操作
    mergeGroups.forEach(group => {
      if (group.length === 1) {
        optimized.push(group[0])
      } else {
        // 尝试合并操作
        const merged = this.tryMergeOperations(group)
        optimized.push(...merged)
      }
    })

    return optimized
  }

  /**
   * 获取操作目标（用于分组）
   */
  private getOperationTarget(operation: Operation): string {
    // 从操作元数据中提取目标标识符
    return operation.metadata.itemId || 
           operation.metadata.trackId || 
           operation.metadata.targetId || 
           'unknown'
  }

  /**
   * 尝试合并操作
   */
  private tryMergeOperations(operations: Operation[]): Operation[] {
    if (operations.length <= 1) return operations

    const result: Operation[] = []
    let current = operations[0]

    for (let i = 1; i < operations.length; i++) {
      const next = operations[i]
      
      if (current.canMerge && current.canMerge(next)) {
        current = current.merge!(next)
      } else {
        result.push(current)
        current = next
      }
    }
    
    result.push(current)
    return result
  }
}

/**
 * 队列中的操作
 */
interface QueuedOperation {
  operation: Operation
  priority: number
  immediate: boolean
  resolve: (result: OperationResult) => void
  reject: (error: any) => void
  promise: Promise<OperationResult>
}

/**
 * 调度选项
 */
export interface ScheduleOptions {
  priority?: number      // 优先级，数字越大优先级越高
  immediate?: boolean    // 是否立即执行，跳过队列
}

/**
 * 批量调度选项
 */
export interface BatchScheduleOptions {
  priority?: number      // 批量操作的优先级
  optimize?: boolean     // 是否优化批量操作
}

/**
 * 队列状态
 */
export interface QueueStatus {
  pending: number        // 等待中的操作数量
  executing: number      // 正在执行的操作数量
  maxConcurrency: number // 最大并发数
}

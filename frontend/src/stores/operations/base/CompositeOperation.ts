import type { Operation, CompositeOperation, OperationResult, ExecutionStrategy } from '../types'
import { AtomicOperation } from './AtomicOperation'

/**
 * 复合操作实现
 * 管理多个子操作的执行和撤销
 */
export class CompositeOperationImpl extends AtomicOperation implements CompositeOperation {
  constructor(
    public readonly operations: Operation[],
    public readonly strategy: ExecutionStrategy,
    description: string,
    metadata: Record<string, any> = {}
  ) {
    super('composite', description, {
      ...metadata,
      strategy,
      operationCount: operations.length
    })
  }

  async execute(): Promise<OperationResult> {
    switch (this.strategy) {
      case 'sequential':
        return this.executeSequential()
      case 'parallel':
        return this.executeParallel()
      case 'transactional':
        return this.executeTransactional()
      default:
        return {
          success: false,
          error: `Unknown execution strategy: ${this.strategy}`
        }
    }
  }

  async undo(): Promise<OperationResult> {
    // 总是按逆序撤销，确保依赖关系正确
    const results: OperationResult[] = []
    for (let i = this.operations.length - 1; i >= 0; i--) {
      const result = await this.operations[i].undo()
      results.push(result)
      if (!result.success && this.strategy === 'transactional') {
        break // 事务模式下遇到失败就停止
      }
    }

    return {
      success: results.every(r => r.success),
      data: results,
      affectedEntities: results.flatMap(r => r.affectedEntities || [])
    }
  }

  private async executeSequential(): Promise<OperationResult> {
    const results: OperationResult[] = []
    for (const op of this.operations) {
      const result = await op.execute()
      results.push(result)
      if (!result.success) break // 遇到失败就停止
    }

    return {
      success: results.every(r => r.success),
      data: results,
      affectedEntities: results.flatMap(r => r.affectedEntities || [])
    }
  }

  private async executeParallel(): Promise<OperationResult> {
    const results = await Promise.allSettled(
      this.operations.map(op => op.execute())
    )

    const successResults = results
      .filter((r): r is PromiseFulfilledResult<OperationResult> => r.status === 'fulfilled')
      .map(r => r.value)

    return {
      success: results.every(r => r.status === 'fulfilled' && r.value.success),
      data: successResults,
      affectedEntities: successResults.flatMap(r => r.affectedEntities || [])
    }
  }

  private async executeTransactional(): Promise<OperationResult> {
    const executedOps: Operation[] = []

    try {
      for (const op of this.operations) {
        const result = await op.execute()
        if (!result.success) {
          throw new Error(`Operation failed: ${result.error}`)
        }
        executedOps.push(op)
      }

      return { success: true, affectedEntities: [] }
    } catch (error) {
      // 自动回滚已执行的操作
      for (let i = executedOps.length - 1; i >= 0; i--) {
        await executedOps[i].undo()
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

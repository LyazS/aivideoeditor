import type { Operation, OperationResult } from '../types'
import { generateId } from '../utils/OperationUtils'

/**
 * 原子操作基类
 * 不可再分的最小操作单元
 */
export abstract class AtomicOperation implements Operation {
  readonly id = generateId()
  readonly timestamp = Date.now()

  constructor(
    public readonly type: string,
    public readonly description: string,
    public readonly metadata: Record<string, any> = {}
  ) {}

  abstract execute(): Promise<OperationResult>
  abstract undo(): Promise<OperationResult>

  async validate(): Promise<boolean> {
    return true // 默认总是有效，子类可以重写
  }
}

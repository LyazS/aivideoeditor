/**
 * 操作接口 - 统一的操作抽象
 * 所有操作（原子操作和复合操作）都实现此接口
 */
export interface Operation {
  readonly id: string              // 唯一标识符
  readonly type: string            // 操作类型（如 timeline.item.add）
  readonly description: string     // 人类可读的描述
  readonly timestamp: number       // 创建时间戳
  readonly metadata: Record<string, any> // 操作元数据

  execute(): Promise<OperationResult>     // 执行操作
  undo(): Promise<OperationResult>        // 撤销操作
  canMerge?(other: Operation): boolean    // 是否可以与其他操作合并
  merge?(other: Operation): Operation     // 合并操作
  validate?(): Promise<boolean>           // 验证操作是否可执行
}

/**
 * 复合操作接口
 * 包含多个子操作的复合操作
 */
export interface CompositeOperation extends Operation {
  readonly operations: Operation[]        // 子操作列表
  readonly strategy: ExecutionStrategy    // 执行策略
}

/**
 * 执行策略枚举
 */
export enum ExecutionStrategy {
  SEQUENTIAL = 'sequential',      // 顺序执行（默认）
  PARALLEL = 'parallel',         // 并行执行
  TRANSACTIONAL = 'transactional' // 事务执行（全成功或全失败）
}

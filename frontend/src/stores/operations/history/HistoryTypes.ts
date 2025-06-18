import type { Operation, OperationResult } from '../types'

/**
 * 历史监听器类型
 */
export type HistoryListener = (
  event: string,
  operation: Operation | null,
  result: OperationResult
) => void

/**
 * 历史摘要接口
 */
export interface HistorySummary {
  total: number
  current: number
  canUndo: boolean
  canRedo: boolean
  operations: Array<{
    id: string
    type: string
    description: string
    timestamp: number
    isCurrent: boolean
    metadata: Record<string, any>
  }>
}

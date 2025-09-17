/**
 * 代理系统共享类型定义
 * 统一管理所有代理相关的类型定义，避免重复定义
 */

/**
 * 基础操作配置接口
 */
export interface BaseOperationConfig {
  type: string
  params: any
}

/**
 * 添加时间轴项目操作
 */
export interface AddTimelineItemOperation extends BaseOperationConfig {
  type: 'addTimelineItem'
  params: {
    mediaItemId: string
    trackId: string
    position: string // 时间轴位置（时间码）
  }
}

/**
 * 操作配置联合类型 - 所有支持的操作类型
 */
export type OperationConfig = AddTimelineItemOperation

/**
 * 验证错误接口
 */
export interface ValidationError {
  operation: BaseOperationConfig
  error: string
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  validOperations: BaseOperationConfig[]
  errors: ValidationError[]
}

/**
 * 操作结果接口
 */
export interface OperationResult {
  success: boolean
  operation: OperationConfig
  error?: string
}

/**
 * 构建结果接口
 */
export interface BuildResult {
  batchCommand: any // BaseBatchCommand 类型
  buildResults: OperationResult[]
}

/**
 * 执行操作结果接口
 */
export interface ExecutionOperationResult {
  success: boolean
  operation: OperationConfig
  error?: string
}

/**
 * 执行错误接口
 */
export interface ExecutionError {
  operation?: OperationConfig
  error: string
  type: 'script' | 'validation' | 'build' | 'execution'
}

/**
 * 执行结果接口
 */
export interface ExecutionResult {
  success: boolean
  executedCount: number
  errorCount: number
  results: ExecutionOperationResult[]
  errors?: ExecutionError[]
}

/**
 * 执行系统配置接口
 */
export interface ExecutionSystemConfig {
  historyModule: any // UnifiedHistoryModule
  timelineModule: any // UnifiedTimelineModule
  webavModule: any // UnifiedWebavModule
  mediaModule: any // UnifiedMediaModule
  configModule: any // UnifiedConfigModule
  trackModule: any // UnifiedTrackModule
  selectionModule: any // UnifiedSelectionModule
}
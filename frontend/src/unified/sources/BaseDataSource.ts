/**
 * 数据源基础类型设计（响应式重构版）
 * 基于"核心数据与行为分离"的重构方案
 */

import { reactive } from 'vue'
import { generateUUID4 } from '@/utils/idGenerator'

// ==================== 类型定义 ====================

/**
 * 数据源状态类型
 */
export type DataSourceStatus =
  | 'pending' // 等待开始
  | 'acquiring' // 获取中
  | 'acquired' // 已获取
  | 'error' // 错误
  | 'cancelled' // 已取消
  | 'missing' // 缺失（适用于所有数据源类型）

/**
 * 数据源状态到媒体状态的映射表
 */
export const DATA_SOURCE_TO_MEDIA_STATUS_MAP = {
  pending: 'pending',
  acquiring: 'asyncprocessing',
  acquired: 'webavdecoding',
  error: 'error',
  cancelled: 'cancelled',
  missing: 'missing',
} as const

// ==================== 核心数据结构 ====================

/**
 * 基础数据源数据接口 - 只包含持久化数据
 */
export interface BaseDataSourceData {
  readonly id: string
  readonly type: string
  mediaReferenceId?: string
}

/**
 * 数据源运行时状态接口 - 包含所有运行时状态字段
 */
export interface DataSourceRuntimeState {
  status: DataSourceStatus
  progress: number
  errorMessage?: string
  taskId?: string
  file: File | null
  url: string | null
}

// 注意：UnifiedDataSourceData 类型在 DataSourceTypes.ts 中定义
// 这里只导出基础类型，避免循环依赖

// ==================== 基础工厂函数 ====================

/**
 * 基础数据源工厂函数 - 创建基础数据对象（不包含运行时状态）
 */
export const BaseDataSourceFactory = {
  // createBase 方法已删除，因为使用它仍然需要明确指定类型，没有简化代码
}

/**
 * 运行时状态工厂函数 - 创建运行时状态对象
 */
export const RuntimeStateFactory = {
  createRuntimeState(): DataSourceRuntimeState {
    return reactive({
      status: 'pending' as DataSourceStatus,
      progress: 0,
      file: null,
      url: null,
    })
  },
}

// ==================== 基础类型守卫 ====================

/**
 * 基础类型守卫函数
 */
export const BaseDataSourceTypeGuards = {
  isBaseDataSource(source: unknown): source is BaseDataSourceData {
    return (
      typeof source === 'object' &&
      source !== null &&
      typeof (source as Record<string, unknown>).id === 'string' &&
      typeof (source as Record<string, unknown>).type === 'string'
    )
  },

  isRuntimeState(source: unknown): source is DataSourceRuntimeState {
    return (
      typeof source === 'object' &&
      source !== null &&
      typeof (source as Record<string, unknown>).status === 'string' &&
      typeof (source as Record<string, unknown>).progress === 'number'
    )
  },
}

// ==================== 通用行为函数 ====================

// ==================== 第一层：纯数据操作层（无副作用） ====================

/**
 * 运行时状态操作函数 - 纯数据设置，无状态变化，无副作用
 */
export const RuntimeStateActions = {
  // 文件和URL设置
  setFile(state: DataSourceRuntimeState, file: File): void {
    state.file = file
  },

  setUrl(state: DataSourceRuntimeState, url: string): void {
    state.url = url
  },

  clearFile(state: DataSourceRuntimeState): void {
    state.file = null
  },

  clearUrl(state: DataSourceRuntimeState): void {
    if (state.url) {
      URL.revokeObjectURL(state.url)
      state.url = null
    }
  },

  // 进度管理
  setProgress(state: DataSourceRuntimeState, progress: number): void {
    state.progress = Math.max(0, Math.min(100, progress))
  },

  resetProgress(state: DataSourceRuntimeState): void {
    state.progress = 0
  },

  // 错误信息管理
  setErrorMessage(state: DataSourceRuntimeState, errorMessage: string): void {
    state.errorMessage = errorMessage
  },

  clearError(state: DataSourceRuntimeState): void {
    state.errorMessage = undefined
  },

  // 任务管理
  setTaskId(state: DataSourceRuntimeState, taskId: string): void {
    state.taskId = taskId
  },

  clearTaskId(state: DataSourceRuntimeState): void {
    state.taskId = undefined
  },
}

// ==================== 第二层：状态管理层（管理状态转换） ====================

/**
 * 运行时状态管理函数 - 只负责状态转换，不处理业务逻辑
 */
export const RuntimeStateManager = {
  // 状态转换
  transitionTo(state: DataSourceRuntimeState, status: DataSourceStatus): boolean {
    const currentStatus = state.status

    // 这里可以添加状态转换验证逻辑
    if (currentStatus === status) {
      return true // 已经是目标状态
    }

    state.status = status
    console.log(`🔄 [DataSource] 状态转换: ${currentStatus} → ${status}`)
    return true
  },

  // 便捷的状态设置方法
  setPending(state: DataSourceRuntimeState): boolean {
    return this.transitionTo(state, 'pending')
  },

  setAcquiring(state: DataSourceRuntimeState): boolean {
    return this.transitionTo(state, 'acquiring')
  },

  setAcquired(state: DataSourceRuntimeState): boolean {
    return this.transitionTo(state, 'acquired')
  },

  setError(state: DataSourceRuntimeState): boolean {
    return this.transitionTo(state, 'error')
  },

  setCancelled(state: DataSourceRuntimeState): boolean {
    return this.transitionTo(state, 'cancelled')
  },

  setMissing(state: DataSourceRuntimeState): boolean {
    return this.transitionTo(state, 'missing')
  },
}

// ==================== 第三层：业务协调层（协调完整的业务操作） ====================

/**
 * 运行时状态业务协调函数 - 协调数据操作和状态转换，处理完整的业务流程
 */
export const RuntimeStateBusinessActions = {
  // 开始获取流程
  startAcquisition(state: DataSourceRuntimeState): void {
    RuntimeStateActions.clearError(state)
    RuntimeStateManager.setAcquiring(state)
  },

  // 完成获取流程（不包含媒体类型检测）
  completeAcquisition(state: DataSourceRuntimeState, file: File, url: string): void {
    // 设置数据
    RuntimeStateActions.setFile(state, file)
    RuntimeStateActions.setUrl(state, url)
    RuntimeStateActions.setProgress(state, 100)
    RuntimeStateActions.clearError(state)

    // 设置状态（这会触发响应式更新）
    RuntimeStateManager.setAcquired(state)
  },

  // 完成获取流程（包含媒体类型检测的异步版本）
  async completeAcquisitionWithTypeDetection(
    state: DataSourceRuntimeState,
    file: File,
    url: string,
    typeDetector?: (state: DataSourceRuntimeState) => Promise<void>,
  ): Promise<void> {
    // 设置基础数据（但不改变状态）
    RuntimeStateActions.setFile(state, file)
    RuntimeStateActions.setUrl(state, url)
    RuntimeStateActions.setProgress(state, 100)
    RuntimeStateActions.clearError(state)

    // 如果提供了类型检测器，先执行类型检测
    if (typeDetector) {
      await typeDetector(state)
    }

    // 最后设置状态（触发后续处理）
    RuntimeStateManager.setAcquired(state)
  },

  // 设置错误状态
  setError(state: DataSourceRuntimeState, errorMessage: string): void {
    RuntimeStateActions.setErrorMessage(state, errorMessage)
    RuntimeStateActions.resetProgress(state)
    RuntimeStateManager.setError(state)
  },

  // 取消获取
  cancel(state: DataSourceRuntimeState): void {
    RuntimeStateActions.resetProgress(state)
    RuntimeStateActions.clearError(state)
    RuntimeStateManager.setCancelled(state)
  },

  // 设置缺失状态
  setMissing(state: DataSourceRuntimeState): void {
    RuntimeStateActions.resetProgress(state)
    RuntimeStateActions.setErrorMessage(state, '文件缺失')
    RuntimeStateManager.setMissing(state)
  },

  // 资源清理
  cleanup(state: DataSourceRuntimeState): void {
    RuntimeStateActions.clearUrl(state)
    RuntimeStateActions.clearFile(state)
    RuntimeStateActions.clearTaskId(state)
  },
}

// ==================== 通用查询函数 ====================

/**
 * 运行时状态查询函数 - 纯函数，用于状态查询和计算
 */
export const RuntimeStateQueries = {
  // 状态查询
  isPending(state: DataSourceRuntimeState): boolean {
    return state.status === 'pending'
  },

  isAcquiring(state: DataSourceRuntimeState): boolean {
    return state.status === 'acquiring'
  },

  isAcquired(state: DataSourceRuntimeState): boolean {
    return state.status === 'acquired'
  },

  isError(state: DataSourceRuntimeState): boolean {
    return state.status === 'error'
  },

  isCancelled(state: DataSourceRuntimeState): boolean {
    return state.status === 'cancelled'
  },

  isMissing(state: DataSourceRuntimeState): boolean {
    return state.status === 'missing'
  },

  // 基础类型查询
  isRuntimeState(source: unknown): source is DataSourceRuntimeState {
    return BaseDataSourceTypeGuards.isRuntimeState(source)
  },

  // 业务查询
  canRetry(state: DataSourceRuntimeState): boolean {
    return state.status === 'error' || state.status === 'cancelled'
  },

  canCancel(state: DataSourceRuntimeState): boolean {
    return state.status === 'acquiring'
  },

  // 获取媒体状态映射
  getMediaStatus(state: DataSourceRuntimeState): string {
    return DATA_SOURCE_TO_MEDIA_STATUS_MAP[state.status]
  },
}

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
 * 基础数据源数据接口 - 纯响应式状态对象
 */
export interface BaseDataSourceData {
  readonly id: string
  readonly type: string
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
 * 基础数据源工厂函数 - 创建基础响应式数据源对象
 */
export const BaseDataSourceFactory = {
  createBase(type: string): BaseDataSourceData {
    return reactive({
      id: generateUUID4(),
      type,
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
      typeof (source as Record<string, unknown>).type === 'string' &&
      typeof (source as Record<string, unknown>).status === 'string' &&
      typeof (source as Record<string, unknown>).progress === 'number'
    )
  },
}

// ==================== 通用行为函数 ====================

// ==================== 第一层：纯数据操作层（无副作用） ====================

/**
 * 数据源数据操作函数 - 纯数据设置，无状态变化，无副作用
 */
export const DataSourceDataActions = {
  // 文件和URL设置
  setFile(source: BaseDataSourceData, file: File): void {
    source.file = file
  },

  setUrl(source: BaseDataSourceData, url: string): void {
    source.url = url
  },

  clearFile(source: BaseDataSourceData): void {
    source.file = null
  },

  clearUrl(source: BaseDataSourceData): void {
    if (source.url) {
      URL.revokeObjectURL(source.url)
      source.url = null
    }
  },

  // 进度管理
  setProgress(source: BaseDataSourceData, progress: number): void {
    source.progress = Math.max(0, Math.min(100, progress))
  },

  resetProgress(source: BaseDataSourceData): void {
    source.progress = 0
  },

  // 错误信息管理
  setErrorMessage(source: BaseDataSourceData, errorMessage: string): void {
    source.errorMessage = errorMessage
  },

  clearError(source: BaseDataSourceData): void {
    source.errorMessage = undefined
  },

  // 任务管理
  setTaskId(source: BaseDataSourceData, taskId: string): void {
    source.taskId = taskId
  },

  clearTaskId(source: BaseDataSourceData): void {
    source.taskId = undefined
  },
}

// ==================== 第二层：状态管理层（管理状态转换） ====================

/**
 * 数据源状态管理函数 - 只负责状态转换，不处理业务逻辑
 */
export const DataSourceStateActions = {
  // 状态转换
  transitionTo(source: BaseDataSourceData, status: DataSourceStatus): boolean {
    const currentStatus = source.status

    // 这里可以添加状态转换验证逻辑
    if (currentStatus === status) {
      return true // 已经是目标状态
    }

    source.status = status
    console.log(`🔄 [DataSource] 状态转换: ${currentStatus} → ${status}`)
    return true
  },

  // 便捷的状态设置方法
  setPending(source: BaseDataSourceData): boolean {
    return this.transitionTo(source, 'pending')
  },

  setAcquiring(source: BaseDataSourceData): boolean {
    return this.transitionTo(source, 'acquiring')
  },

  setAcquired(source: BaseDataSourceData): boolean {
    return this.transitionTo(source, 'acquired')
  },

  setError(source: BaseDataSourceData): boolean {
    return this.transitionTo(source, 'error')
  },

  setCancelled(source: BaseDataSourceData): boolean {
    return this.transitionTo(source, 'cancelled')
  },

  setMissing(source: BaseDataSourceData): boolean {
    return this.transitionTo(source, 'missing')
  },
}

// ==================== 第三层：业务协调层（协调完整的业务操作） ====================

/**
 * 数据源业务协调函数 - 协调数据操作和状态转换，处理完整的业务流程
 */
export const DataSourceBusinessActions = {
  // 开始获取流程
  startAcquisition(source: BaseDataSourceData): void {
    DataSourceDataActions.clearError(source)
    DataSourceStateActions.setAcquiring(source)
  },

  // 完成获取流程（不包含媒体类型检测）
  completeAcquisition(source: BaseDataSourceData, file: File, url: string): void {
    // 设置数据
    DataSourceDataActions.setFile(source, file)
    DataSourceDataActions.setUrl(source, url)
    DataSourceDataActions.setProgress(source, 100)
    DataSourceDataActions.clearError(source)

    // 设置状态（这会触发响应式更新）
    DataSourceStateActions.setAcquired(source)
  },

  // 完成获取流程（包含媒体类型检测的异步版本）
  async completeAcquisitionWithTypeDetection(
    source: BaseDataSourceData,
    file: File,
    url: string,
    typeDetector?: (source: BaseDataSourceData) => Promise<void>,
  ): Promise<void> {
    // 设置基础数据（但不改变状态）
    DataSourceDataActions.setFile(source, file)
    DataSourceDataActions.setUrl(source, url)
    DataSourceDataActions.setProgress(source, 100)
    DataSourceDataActions.clearError(source)

    // 如果提供了类型检测器，先执行类型检测
    if (typeDetector) {
      await typeDetector(source)
    }

    // 最后设置状态（触发后续处理）
    DataSourceStateActions.setAcquired(source)
  },

  // 设置错误状态
  setError(source: BaseDataSourceData, errorMessage: string): void {
    DataSourceDataActions.setErrorMessage(source, errorMessage)
    DataSourceDataActions.resetProgress(source)
    DataSourceStateActions.setError(source)
  },

  // 取消获取
  cancel(source: BaseDataSourceData): void {
    DataSourceDataActions.resetProgress(source)
    DataSourceDataActions.clearError(source)
    DataSourceStateActions.setCancelled(source)
  },

  // 设置缺失状态
  setMissing(source: BaseDataSourceData): void {
    DataSourceDataActions.resetProgress(source)
    DataSourceDataActions.setErrorMessage(source, '文件缺失')
    DataSourceStateActions.setMissing(source)
  },

  // 资源清理
  cleanup(source: BaseDataSourceData): void {
    DataSourceDataActions.clearUrl(source)
    DataSourceDataActions.clearFile(source)
    DataSourceDataActions.clearTaskId(source)
  },
}

// ==================== 通用查询函数 ====================

/**
 * 基础数据源查询函数 - 纯函数，用于状态查询和计算
 */
export const DataSourceQueries = {
  // 状态查询
  isPending(source: BaseDataSourceData): boolean {
    return source.status === 'pending'
  },

  isAcquiring(source: BaseDataSourceData): boolean {
    return source.status === 'acquiring'
  },

  isAcquired(source: BaseDataSourceData): boolean {
    return source.status === 'acquired'
  },

  isError(source: BaseDataSourceData): boolean {
    return source.status === 'error'
  },

  isCancelled(source: BaseDataSourceData): boolean {
    return source.status === 'cancelled'
  },

  isMissing(source: BaseDataSourceData): boolean {
    return source.status === 'missing'
  },

  // 基础类型查询
  isBaseDataSource(source: unknown): source is BaseDataSourceData {
    return BaseDataSourceTypeGuards.isBaseDataSource(source)
  },

  // 业务查询
  canRetry(source: BaseDataSourceData): boolean {
    return source.status === 'error' || source.status === 'cancelled'
  },

  canCancel(source: BaseDataSourceData): boolean {
    return source.status === 'acquiring'
  },

  // 获取媒体状态映射
  getMediaStatus(source: BaseDataSourceData): string {
    return DATA_SOURCE_TO_MEDIA_STATUS_MAP[source.status]
  },
}

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
  | 'pending'     // 等待开始
  | 'acquiring'   // 获取中
  | 'acquired'    // 已获取
  | 'error'       // 错误
  | 'cancelled'   // 已取消
  | 'missing'     // 缺失（适用于所有数据源类型）

/**
 * 数据源状态到媒体状态的映射表
 */
export const DATA_SOURCE_TO_MEDIA_STATUS_MAP = {
  'pending': 'pending',
  'acquiring': 'asyncprocessing',
  'acquired': 'webavdecoding',
  'error': 'error',
  'cancelled': 'cancelled',
  'missing': 'missing'
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
      url: null
    })
  }
}

// ==================== 基础类型守卫 ====================

/**
 * 基础类型守卫函数
 */
export const BaseDataSourceTypeGuards = {
  isBaseDataSource(source: unknown): source is BaseDataSourceData {
    return typeof source === 'object' &&
           source !== null &&
           typeof (source as Record<string, unknown>).id === 'string' &&
           typeof (source as Record<string, unknown>).type === 'string' &&
           typeof (source as Record<string, unknown>).status === 'string' &&
           typeof (source as Record<string, unknown>).progress === 'number'
  }
}

// ==================== 通用行为函数 ====================

/**
 * 通用数据源行为函数 - 无状态函数，操作数据对象
 */
export const UnifiedDataSourceActions = {
  // 状态设置
  setStatus(source: BaseDataSourceData, status: DataSourceStatus): void {
    source.status = status
  },

  setProgress(source: BaseDataSourceData, progress: number): void {
    source.progress = Math.max(0, Math.min(100, progress))
  },

  setError(source: BaseDataSourceData, errorMessage: string): void {
    source.status = 'error'
    source.errorMessage = errorMessage
    source.progress = 0
  },

  setAcquiring(source: BaseDataSourceData): void {
    source.status = 'acquiring'
    source.errorMessage = undefined
  },

  setAcquired(source: BaseDataSourceData, file: File, url: string): void {
    source.status = 'acquired'
    source.file = file
    source.url = url
    source.progress = 100
    source.errorMessage = undefined
  },

  setCancelled(source: BaseDataSourceData): void {
    source.status = 'cancelled'
    source.progress = 0
    source.errorMessage = undefined
  },

  setMissing(source: BaseDataSourceData): void {
    source.status = 'missing'
    source.progress = 0
    source.errorMessage = '文件缺失'
  },

  // 任务管理
  setTaskId(source: BaseDataSourceData, taskId: string): void {
    source.taskId = taskId
  },

  clearTaskId(source: BaseDataSourceData): void {
    source.taskId = undefined
  },

  // 资源清理
  cleanup(source: BaseDataSourceData): void {
    if (source.url) {
      URL.revokeObjectURL(source.url)
      source.url = null
    }
    source.file = null
    source.taskId = undefined
  }
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
  }
}

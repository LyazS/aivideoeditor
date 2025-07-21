/**
 * 统一异步源架构 - 数据源类型定义
 * 
 * 这是统一异步源架构的核心类型定义，所有数据都通过异步源进行管理
 */

// 数据源状态枚举
export enum DataSourceStatus {
  IDLE = 'idle',           // 空闲状态
  LOADING = 'loading',     // 加载中
  SUCCESS = 'success',     // 成功
  ERROR = 'error',         // 错误
  CANCELLED = 'cancelled'  // 已取消
}

// 基础数据源接口
export interface BaseDataSource<T = any> {
  /** 数据源唯一标识 */
  id: string
  /** 数据源类型 */
  type: string
  /** 当前状态 */
  status: DataSourceStatus
  /** 数据内容 */
  data: T | null
  /** 错误信息 */
  error: string | null
  /** 加载进度 (0-100) */
  progress: number
  /** 创建时间 */
  createdAt: Date
  /** 最后更新时间 */
  updatedAt: Date
  /** 元数据 */
  metadata: Record<string, any>
}

// 异步操作配置
export interface AsyncOperationConfig {
  /** 超时时间（毫秒） */
  timeout?: number
  /** 重试次数 */
  retries?: number
  /** 重试间隔（毫秒） */
  retryDelay?: number
  /** 是否可取消 */
  cancellable?: boolean
}

// 数据源更新事件
export interface DataSourceUpdateEvent<T = any> {
  /** 数据源ID */
  sourceId: string
  /** 更新类型 */
  type: 'status' | 'data' | 'progress' | 'error'
  /** 旧值 */
  oldValue: any
  /** 新值 */
  newValue: any
  /** 完整的数据源对象 */
  source: BaseDataSource<T>
  /** 事件时间戳 */
  timestamp: Date
}

// 数据源管理器接口
export interface DataSourceManager {
  /** 创建数据源 */
  createSource<T>(type: string, config?: AsyncOperationConfig): BaseDataSource<T>
  
  /** 获取数据源 */
  getSource<T>(id: string): BaseDataSource<T> | null
  
  /** 更新数据源 */
  updateSource<T>(id: string, updates: Partial<BaseDataSource<T>>): void
  
  /** 删除数据源 */
  removeSource(id: string): void
  
  /** 监听数据源变化 */
  subscribe(callback: (event: DataSourceUpdateEvent) => void): () => void
  
  /** 取消异步操作 */
  cancelOperation(id: string): void
  
  /** 清理所有数据源 */
  cleanup(): void
}

// 数据源工厂接口
export interface DataSourceFactory {
  /** 创建特定类型的数据源 */
  create<T>(type: string, initialData?: Partial<T>, config?: AsyncOperationConfig): BaseDataSource<T>
}

// 预定义的数据源类型
export const DATA_SOURCE_TYPES = {
  MEDIA_FILE: 'media_file',
  REMOTE_DOWNLOAD: 'remote_download',
  PROJECT_DATA: 'project_data',
  TIMELINE_ITEM: 'timeline_item',
  RENDER_OUTPUT: 'render_output',
  THUMBNAIL: 'thumbnail',
  WAVEFORM: 'waveform'
} as const

export type DataSourceType = typeof DATA_SOURCE_TYPES[keyof typeof DATA_SOURCE_TYPES]

// 数据源查询条件
export interface DataSourceQuery {
  /** 按类型筛选 */
  type?: DataSourceType | DataSourceType[]
  /** 按状态筛选 */
  status?: DataSourceStatus | DataSourceStatus[]
  /** 按创建时间范围筛选 */
  createdAfter?: Date
  createdBefore?: Date
  /** 按元数据筛选 */
  metadata?: Record<string, any>
  /** 排序字段 */
  sortBy?: 'createdAt' | 'updatedAt' | 'progress'
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc'
  /** 分页 */
  limit?: number
  offset?: number
}

// 批量操作结果
export interface BatchOperationResult {
  /** 成功的操作数量 */
  successCount: number
  /** 失败的操作数量 */
  errorCount: number
  /** 错误详情 */
  errors: Array<{
    sourceId: string
    error: string
  }>
}

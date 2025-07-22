/**
 * 统一数据源基础类型设计
 *
 * 基于重构文档的统一异步源架构，定义数据源的基础抽象类和通用接口
 * 数据源负责处理不同来源的文件获取逻辑，与媒体项目的处理逻辑分离
 */
import {generateUUID4}from '@/utils/idGenerator.ts'

/**
 * 数据源状态类型
 *
 * 数据源的内部状态会映射到媒体项目的抽象状态：
 * - 'pending'     → 'pending'
 * - 'acquiring'   → 'asyncprocessing' ✅ 关键映射
 * - 'acquired'    → 'webavdecoding' (开始解析文件)
 * - 'error'       → 'error'
 * - 'cancelled'   → 'cancelled'
 * - 'missing'     → 'missing' (仅工程文件)
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

/**
 * 数据源管理器基类前向声明（避免循环导入）
 */
interface BaseDataSourceManager<T extends BaseDataSource> {
  // startAcquisition(source: T, taskId: string): void
  cancelAcquisition(taskId: string): void
  // getActiveTaskCount(): number
  // getTaskStatus(taskId: string): string | undefined
  // cleanupCompletedTasks(): void
}

/**
 * 数据源基础抽象类 - 统一管理通用逻辑
 *
 * 注意：此抽象类同时作为类型定义使用，无需额外的接口
 * 所有具体数据源都必须继承此类，确保接口一致性
 */
export abstract class BaseDataSource {
  public readonly __type__ = 'UnifiedDataSource' as const
  protected file: File | null = null
  protected url: string | null = null
  protected status: DataSourceStatus = 'pending'
  protected progress: number = 0
  protected errorMessage?: string
  protected taskId?: string
  private readonly sourceType: string

  constructor(
    sourceType: string,
    protected onUpdate?: (source: BaseDataSource | any) => void,
  ) {
    this.sourceType = sourceType
  }

  // ==================== 通用访问方法 ====================

  /**
   * 获取数据源类型标识
   */
  getType(): string {
    return this.sourceType
  }

  /**
   * 获取文件对象（如果已获取）
   */
  getFile(): File | null {
    return this.file
  }

  /**
   * 获取文件URL（如果已获取）
   */
  getUrl(): string | null {
    return this.url
  }

  /**
   * 获取当前状态
   */
  getStatus(): DataSourceStatus {
    return this.status
  }

  /**
   * 获取处理进度（0-100）
   */
  getProgress(): number {
    return this.progress
  }

  /**
   * 获取错误信息（如果有）
   */
  getError(): string | undefined {
    return this.errorMessage
  }

  /**
   * 获取任务ID（如果有）
   */
  getTaskId(): string | undefined {
    return this.taskId
  }

  // ==================== 通用操作方法 ====================

  /**
   * 开始获取文件
   */
  startAcquisition(): void {
    console.log(`🎯 [UNIFIED-MEDIA] BaseDataSource.startAcquisition 开始: 类型=${this.sourceType}`)
    this.taskId = generateUUID4()
    console.log(`🎯 [UNIFIED-MEDIA] 生成任务ID: ${this.taskId}`)
    this.executeAcquisition()
    console.log(`🎯 [UNIFIED-MEDIA] BaseDataSource.startAcquisition 完成: 任务ID=${this.taskId}`)
  }

  /**
   * 取消获取操作
   */
  cancel(): void {
    if (this.taskId) {
      this.getManager().cancelAcquisition(this.taskId)
    }
  }

  /**
   * 重试获取操作
   */
  retry(): void {
    this.reset()
    this.startAcquisition()
  }

  // ==================== 抽象方法 ====================

  /**
   * 获取对应的管理器实例
   */
  protected abstract getManager(): BaseDataSourceManager<BaseDataSource>

  /**
   * 执行具体的获取逻辑
   */
  protected abstract executeAcquisition(): void

  // ==================== 状态管理方法 ====================

  /**
   * 设置为获取中状态
   */
  setAcquiring(): void {
    console.log(`🔄 [UNIFIED-MEDIA] BaseDataSource.setAcquiring: 类型=${this.sourceType}, 任务ID=${this.taskId}`)
    this.status = 'acquiring'
    this.progress = 0
    this.errorMessage = undefined
    this.notifyUpdate()
  }

  /**
   * 设置为已获取状态
   */
  setAcquired(file: File, url: string): void {
    console.log(`✅ [UNIFIED-MEDIA] BaseDataSource.setAcquired: 类型=${this.sourceType}, 文件=${file.name}, URL=${url.substring(0, 50)}...`)
    this.file = file
    this.url = url
    this.status = 'acquired'
    this.progress = 100
    this.notifyUpdate()
  }

  /**
   * 设置为错误状态
   */
  setError(message: string): void {
    console.error(`❌ [UNIFIED-MEDIA] BaseDataSource.setError: 类型=${this.sourceType}, 错误=${message}`)
    this.status = 'error'
    this.errorMessage = message
    this.notifyUpdate()
  }

  /**
   * 设置为取消状态
   */
  setCancelled(): void {
    this.status = 'cancelled'
    this.notifyUpdate()
  }

  /**
   * 设置为缺失状态（仅工程文件使用）
   */
  protected setMissing(message: string): void {
    this.status = 'missing'
    this.errorMessage = message
    this.notifyUpdate()
  }

  /**
   * 更新进度
   */
  protected updateProgress(progress: number): void {
    this.progress = Math.max(0, Math.min(100, progress))
    this.notifyUpdate()
  }

  /**
   * 重置状态
   */
  protected reset(): void {
    this.status = 'pending'
    this.progress = 0
    this.errorMessage = undefined
    this.taskId = undefined
  }

  /**
   * 通知状态更新
   */
  private notifyUpdate(): void {
    console.log(`📢 [UNIFIED-MEDIA] BaseDataSource.notifyUpdate: 类型=${this.sourceType}, 状态=${this.status}, 进度=${this.progress}%`)
    this.onUpdate?.(this)
  }
}

/**
 * 状态转换验证函数
 */
export function isValidDataSourceTransition(from: DataSourceStatus, to: DataSourceStatus): boolean {
  const validTransitions: Record<DataSourceStatus, DataSourceStatus[]> = {
    pending: ['acquiring', 'error', 'missing'],
    acquiring: ['acquired', 'error', 'cancelled'],
    acquired: ['error'], // 运行时可能出错
    error: ['pending'], // 支持重试
    cancelled: ['pending'], // 支持重新开始
    missing: ['pending', 'error'], // 重新选择文件或确认错误
  }

  return validTransitions[from]?.includes(to) ?? false
}

/**
 * 数据源状态映射到媒体状态
 */
export function mapDataSourceStatusToMediaStatus(dataSourceStatus: DataSourceStatus): string {
  return DATA_SOURCE_TO_MEDIA_STATUS_MAP[dataSourceStatus]
}

/**
 * 数据源管理器基础类（响应式重构版）
 * 基于"核心数据与行为分离"的重构方案
 */

import {
  DataSourceDataActions,
  DataSourceBusinessActions,
  DataSourceStateActions,
  DataSourceQueries,
} from '@/unified/sources/BaseDataSource'
import type { UnifiedDataSourceData } from '@/unified/sources/DataSourceTypes'

// ==================== 任务相关接口 ====================

/**
 * 获取任务状态
 */
export type AcquisitionTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * 获取任务接口
 */
export interface AcquisitionTask<T extends UnifiedDataSourceData> {
  id: string
  source: T
  status: AcquisitionTaskStatus
  createdAt: number
  startedAt?: number
  completedAt?: number
  retryCount: number
  error?: string
}

/**
 * 管理器统计信息
 */
export interface ManagerStats {
  totalTasks: number
  pendingTasks: number
  runningTasks: number
  completedTasks: number
  failedTasks: number
  cancelledTasks: number
  averageProcessingTime: number
}

// ==================== 数据源管理器基础抽象类 ====================

/**
 * 数据源管理器基础抽象类 - 适配响应式数据源
 */
export abstract class DataSourceManager<T extends UnifiedDataSourceData> {
  protected tasks: Map<string, AcquisitionTask<T>> = new Map()
  protected maxConcurrentTasks: number = 5
  protected currentRunningTasks: number = 0
  protected taskQueue: string[] = []
  protected processingTimes: number[] = []

  // ==================== 公共接口 ====================

  /**
   * 开始获取任务
   */
  startAcquisition(source: T, taskId: string): void {
    const task: AcquisitionTask<T> = {
      id: taskId,
      source,
      status: 'pending',
      createdAt: Date.now(),
      retryCount: 0,
    }

    this.tasks.set(taskId, task)
    this.taskQueue.push(taskId)

    // 设置数据源的任务ID
    DataSourceDataActions.setTaskId(source, taskId)

    this.processQueue()
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task) return false

    // 如果任务正在运行，减少运行计数
    const wasRunning = task.status === 'running'

    // 更新任务状态
    task.status = 'cancelled'
    task.completedAt = Date.now()

    // 更新数据源状态
    DataSourceBusinessActions.cancel(task.source)
    DataSourceDataActions.clearTaskId(task.source)

    // 从队列中移除
    const queueIndex = this.taskQueue.indexOf(taskId)
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1)
    }

    // 如果任务之前正在运行，减少运行计数
    if (wasRunning) {
      this.currentRunningTasks--
    }

    // 处理下一个任务
    this.processQueue()

    return true
  }

  /**
   * 重试任务
   */
  retryTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'failed') return false

    // 检查重试次数
    const maxRetries = this.getMaxRetries(task.source)
    if (task.retryCount >= maxRetries) return false

    // 重置任务状态
    task.status = 'pending'
    task.retryCount++
    task.error = undefined

    // 重新加入队列
    this.taskQueue.push(taskId)

    // 重置数据源状态
    DataSourceStateActions.setPending(task.source)

    this.processQueue()

    return true
  }

  /**
   * 获取任务信息
   */
  getTask(taskId: string): AcquisitionTask<T> | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): AcquisitionTask<T>[] {
    return Array.from(this.tasks.values())
  }

  /**
   * 清理已完成的任务
   */
  cleanupCompletedTasks(): void {
    const completedTasks = Array.from(this.tasks.entries()).filter(
      ([_, task]) => task.status === 'completed' || task.status === 'cancelled',
    )

    for (const [taskId, task] of completedTasks) {
      // 清理数据源资源
      if (task.status === 'cancelled') {
        DataSourceBusinessActions.cleanup(task.source)
      }

      this.tasks.delete(taskId)
    }
  }

  /**
   * 获取管理器统计信息
   */
  getStats(): ManagerStats {
    const tasks = Array.from(this.tasks.values())

    const stats: ManagerStats = {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((t) => t.status === 'pending').length,
      runningTasks: tasks.filter((t) => t.status === 'running').length,
      completedTasks: tasks.filter((t) => t.status === 'completed').length,
      failedTasks: tasks.filter((t) => t.status === 'failed').length,
      cancelledTasks: tasks.filter((t) => t.status === 'cancelled').length,
      averageProcessingTime: this.calculateAverageProcessingTime(),
    }

    return stats
  }

  /**
   * 设置最大并发任务数
   */
  setMaxConcurrentTasks(max: number): void {
    this.maxConcurrentTasks = Math.max(1, max)
    this.processQueue()
  }

  /**
   * 获取最大并发任务数
   */
  getMaxConcurrentTasks(): number {
    return this.maxConcurrentTasks
  }

  // ==================== 受保护的方法 ====================

  /**
   * 处理任务队列
   */
  protected processQueue(): void {
    while (this.taskQueue.length > 0 && this.currentRunningTasks < this.maxConcurrentTasks) {
      const taskId = this.taskQueue.shift()!
      const task = this.tasks.get(taskId)

      if (!task || task.status !== 'pending') continue

      this.executeTaskWithRetry(task)
    }
  }

  /**
   * 执行任务（带重试）
   */
  protected async executeTaskWithRetry(task: AcquisitionTask<T>): Promise<void> {
    task.status = 'running'
    task.startedAt = Date.now()
    this.currentRunningTasks++

    try {
      await this.executeTask(task)

      // 任务成功完成
      task.status = 'completed'
      task.completedAt = Date.now()

      // 记录处理时间
      if (task.startedAt) {
        const processingTime = task.completedAt - task.startedAt
        this.processingTimes.push(processingTime)

        // 保持最近100次的处理时间记录
        if (this.processingTimes.length > 100) {
          this.processingTimes.shift()
        }
      }

      // 清理任务ID
      DataSourceDataActions.clearTaskId(task.source)
    } catch (error) {
      // 任务执行失败
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      task.error = errorMessage
      task.status = 'failed'
      task.completedAt = Date.now()

      // 检查是否可以重试
      const maxRetries = this.getMaxRetries(task.source)
      if (task.retryCount < maxRetries) {
        // 延迟后重试
        setTimeout(() => {
          if (this.tasks.has(task.id) && task.status === 'failed') {
            this.retryTask(task.id)
          }
        }, this.getRetryDelay(task.retryCount))
      } else {
        // 重试次数用尽，清理任务ID
        DataSourceDataActions.clearTaskId(task.source)
      }
    } finally {
      this.currentRunningTasks--
      this.processQueue()
    }
  }

  /**
   * 计算平均处理时间
   */
  protected calculateAverageProcessingTime(): number {
    if (this.processingTimes.length === 0) return 0

    const total = this.processingTimes.reduce((sum, time) => sum + time, 0)
    return Math.round(total / this.processingTimes.length)
  }

  /**
   * 获取重试延迟（指数退避）
   */
  protected getRetryDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount), 30000) // 最大30秒
  }

  // ==================== 抽象方法 ====================

  /**
   * 执行具体的获取任务 - 子类必须实现
   */
  protected abstract executeTask(task: AcquisitionTask<T>): Promise<void>

  /**
   * 获取管理器类型 - 子类必须实现
   */
  abstract getManagerType(): string

  /**
   * 获取最大重试次数 - 子类可以重写
   */
  protected getMaxRetries(_source: T): number {
    return 3
  }
}

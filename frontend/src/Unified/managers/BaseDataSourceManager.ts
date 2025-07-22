/**
 * 数据源管理器基础抽象类
 * 
 * 基于重构文档的统一异步源架构，定义数据源管理器的基础抽象类和通用接口
 * 负责任务调度、并发控制、错误处理和重试机制
 */

import type { BaseDataSource } from '../sources/BaseDataSource'

/**
 * 获取任务状态类型
 */
export type AcquisitionTaskStatus =
  | 'pending'     // 等待执行
  | 'running'     // 执行中
  | 'completed'   // 已完成
  | 'failed'      // 失败
  | 'cancelled'   // 已取消

/**
 * 获取任务接口
 */
export interface AcquisitionTask<T extends BaseDataSource> {
  id: string
  source: T
  status: AcquisitionTaskStatus
  createdAt: number
  startedAt?: number
  completedAt?: number
  retryCount: number
  error?: string
  abortController?: AbortController
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
  currentRunningTasks: number
  maxConcurrentTasks: number
}

/**
 * 管理器配置接口
 */
export interface ManagerConfig {
  maxConcurrentTasks?: number
  maxRetries?: number
  retryDelay?: number
  timeout?: number
}

/**
 * 数据源管理器基础抽象类
 * 
 * 提供统一的任务管理、并发控制、错误处理和重试机制
 * 所有具体的数据源管理器都必须继承此类
 */
export abstract class BaseDataSourceManager<T extends BaseDataSource> {
  protected tasks: Map<string, AcquisitionTask<T>> = new Map()
  protected maxConcurrentTasks: number = 5
  protected currentRunningTasks: number = 0
  protected taskQueue: string[] = []

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
      retryCount: 0
    }

    this.tasks.set(taskId, task)
    this.taskQueue.push(taskId)
    this.processQueue()
  }

  /**
   * 取消获取任务
   */
  cancelAcquisition(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return

    task.status = 'cancelled'
    
    if (task.abortController) {
      task.abortController.abort()
    }

    task.source.setCancelled()
    this.cleanupTask(taskId)
  }

  /**
   * 重试获取任务
   */
  retryAcquisition(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return

    task.status = 'pending'
    task.retryCount++
    task.abortController = undefined

    this.taskQueue.push(taskId)
    this.processQueue()
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(taskId: string): AcquisitionTaskStatus | undefined {
    return this.tasks.get(taskId)?.status
  }

  /**
   * 获取正在进行的任务数量
   */
  getActiveTaskCount(): number {
    return this.currentRunningTasks
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
    const completedTasks = Array.from(this.tasks.entries())
      .filter(([_, task]) => 
        task.status === 'completed' || 
        task.status === 'failed' || 
        task.status === 'cancelled'
      )

    completedTasks.forEach(([taskId]) => {
      this.tasks.delete(taskId)
    })
  }

  // ==================== 抽象方法 ====================
  
  /**
   * 执行具体的获取逻辑
   */
  protected abstract executeTask(task: AcquisitionTask<T>): Promise<void>

  /**
   * 获取管理器类型名称
   */
  abstract getManagerType(): string

  // ==================== 内部方法 ====================
  
  /**
   * 处理任务队列
   */
  protected processQueue(): void {
    while (
      this.currentRunningTasks < this.maxConcurrentTasks && 
      this.taskQueue.length > 0
    ) {
      const taskId = this.taskQueue.shift()!
      const task = this.tasks.get(taskId)
      
      if (task && task.status === 'pending') {
        this.runTask(task)
      }
    }
  }

  /**
   * 运行单个任务
   */
  protected async runTask(task: AcquisitionTask<T>): Promise<void> {
    task.status = 'running'
    task.startedAt = Date.now()
    task.abortController = new AbortController()
    
    this.currentRunningTasks++
    task.source.setAcquiring()

    try {
      await this.executeTask(task)
      task.status = 'completed'
      task.completedAt = Date.now()
    } catch (error) {
      task.status = 'failed'
      task.error = error instanceof Error ? error.message : String(error)
      task.source.setError(task.error)
      
      // 检查是否需要重试
      if (this.shouldRetry(task)) {
        setTimeout(() => {
          this.retryAcquisition(task.id)
        }, this.getRetryDelay(task.retryCount))
      }
    } finally {
      this.currentRunningTasks--
      this.processQueue() // 处理队列中的下一个任务
    }
  }

  /**
   * 判断是否应该重试
   */
  protected shouldRetry(task: AcquisitionTask<T>): boolean {
    const maxRetries = this.getMaxRetries(task.source)
    return task.retryCount < maxRetries && task.status === 'failed'
  }

  /**
   * 获取最大重试次数
   */
  protected getMaxRetries(source: T): number {
    // 子类可以重写此方法
    return 3
  }

  /**
   * 获取重试延迟时间
   */
  protected getRetryDelay(retryCount: number): number {
    // 指数退避策略
    return Math.min(1000 * Math.pow(2, retryCount), 30000)
  }

  /**
   * 清理任务资源
   */
  protected cleanupTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (task?.abortController) {
      task.abortController.abort()
    }
    
    // 可以在子类中重写以添加特定的清理逻辑
  }

  /**
   * 设置最大并发任务数
   */
  setMaxConcurrentTasks(max: number): void {
    this.maxConcurrentTasks = Math.max(1, max)
  }

  /**
   * 获取统计信息
   */
  getStats(): ManagerStats {
    const tasks = Array.from(this.tasks.values())
    
    return {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      runningTasks: tasks.filter(t => t.status === 'running').length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
      cancelledTasks: tasks.filter(t => t.status === 'cancelled').length,
      currentRunningTasks: this.currentRunningTasks,
      maxConcurrentTasks: this.maxConcurrentTasks
    }
  }
}

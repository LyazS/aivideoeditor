/**
 * 数据源管理器基础类（响应式重构版）
 * 基于"核心数据与行为分离"的重构方案
 */

import {
  RuntimeStateActions,
} from '@/unified/sources/BaseDataSource'
import type { UnifiedDataSourceData } from '@/unified/sources/DataSourceTypes'
import type { UnifiedMediaItemData, MediaStatus } from '@/unified/mediaitem/types'
import { UnifiedMediaItemActions } from '@/unified/mediaitem/actions'
import { MediaStatusManager } from '@/unified/managers/MediaStatusManager'
import { WebAVProcessor } from '@/unified/managers/WebAVProcessor'
import { FileManager } from '@/unified/managers/FileManager'
import { MetadataManager } from '@/unified/managers/MetadataManager'

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
  
  // 新增：直接管理UnifiedMediaItemData
  protected mediaItems: Map<string, UnifiedMediaItemData> = new Map()
  
  // 新增：专门的管理器实例
  protected mediaStatusManager: MediaStatusManager = new MediaStatusManager()
  protected webavProcessor: WebAVProcessor = new WebAVProcessor()
  protected fileManager: FileManager = new FileManager()
  protected metadataManager: MetadataManager = new MetadataManager()

  // ==================== 公共接口 ====================

  // 数据源获取任务相关方法已移除，任务处理现在统一由processMediaItem方法处理

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
   * 取消任务
   * @param taskId 任务ID
   * @returns 是否成功取消
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task) {
      return false
    }

    // 如果任务正在运行，标记为取消状态
    if (task.status === 'running') {
      task.status = 'cancelled'
      task.completedAt = Date.now()
      this.currentRunningTasks--
      this.processQueue()
      return true
    }

    // 如果任务在队列中，直接移除
    if (task.status === 'pending') {
      const queueIndex = this.taskQueue.indexOf(taskId)
      if (queueIndex !== -1) {
        this.taskQueue.splice(queueIndex, 1)
      }
      task.status = 'cancelled'
      task.completedAt = Date.now()
      return true
    }

    return false
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
            // 重置任务状态
            task.status = 'pending'
            task.retryCount++
            task.error = undefined
            
            // 重新加入队列
            this.taskQueue.push(task.id)
            
            // 处理队列
            this.processQueue()
          }
        }, this.getRetryDelay(task.retryCount))
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

  // ==================== 新增抽象方法 ====================

  /**
   * 处理完整的媒体项目生命周期 - 子类必须实现
   * @param mediaItem 媒体项目
   */
  abstract processMediaItem(mediaItem: UnifiedMediaItemData): Promise<void>

  // ==================== 新增统一状态机方法 ====================

  /**
   * 统一状态机转换方法
   * @param mediaItem 媒体项目
   * @param status 目标状态
   */
  protected transitionMediaStatus(
    mediaItem: UnifiedMediaItemData,
    status: MediaStatus
  ): void {
    this.mediaStatusManager.transitionTo(mediaItem, status, { manager: this.getManagerType() })
  }


}

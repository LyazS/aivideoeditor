/**
 * 数据源管理器注册中心
 * 提供统一的管理器注册和获取接口
 */

import { DataSourceManager } from './BaseDataSourceManager'
import type { UnifiedDataSourceData } from '../sources/DataSourceTypes'
import { UserSelectedFileManager } from './UserSelectedFileManager'
import { RemoteFileManager } from './RemoteFileManager'

// ==================== 类型定义 ====================

/**
 * 管理器类型映射
 */
type ManagerTypeMap = {
  'user-selected': UserSelectedFileManager
  remote: RemoteFileManager
}

/**
 * 管理器注册中心
 */
export class DataSourceManagerRegistry {
  private static instance: DataSourceManagerRegistry
  private managers: Map<string, DataSourceManager<UnifiedDataSourceData>> = new Map()

  /**
   * 获取单例实例
   */
  static getInstance(): DataSourceManagerRegistry {
    if (!this.instance) {
      this.instance = new DataSourceManagerRegistry()
      this.instance.initializeDefaultManagers()
    }
    return this.instance
  }

  /**
   * 私有构造函数，确保单例模式
   */
  private constructor() {}

  // ==================== 管理器注册 ====================

  /**
   * 注册管理器
   */
  register(type: string, manager: DataSourceManager<UnifiedDataSourceData>): void {
    if (this.managers.has(type)) {
      console.warn(`管理器类型 "${type}" 已存在，将被覆盖`)
    }

    this.managers.set(type, manager)
    console.log(`已注册数据源管理器: ${type}`)
  }

  /**
   * 获取管理器
   */
  getManager(type: string): DataSourceManager<UnifiedDataSourceData> | undefined {
    return this.managers.get(type)
  }

  /**
   * 获取用户选择文件管理器
   */
  getUserSelectedFileManager(): UserSelectedFileManager | undefined {
    return this.managers.get('user-selected') as UserSelectedFileManager | undefined
  }

  /**
   * 获取远程文件管理器
   */
  getRemoteFileManager(): RemoteFileManager | undefined {
    return this.managers.get('remote') as RemoteFileManager | undefined
  }

  /**
   * 获取所有管理器
   */
  getAllManagers(): Map<string, DataSourceManager<UnifiedDataSourceData>> {
    return new Map(this.managers)
  }

  /**
   * 检查管理器是否已注册
   */
  hasManager(type: string): boolean {
    return this.managers.has(type)
  }

  /**
   * 注销管理器
   */
  unregister(type: string): boolean {
    if (this.managers.has(type)) {
      this.managers.delete(type)
      console.log(`已注销数据源管理器: ${type}`)
      return true
    }
    return false
  }

  /**
   * 获取已注册的管理器类型列表
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.managers.keys())
  }

  // ==================== 默认管理器初始化 ====================

  /**
   * 初始化默认管理器
   */
  private initializeDefaultManagers(): void {
    // 注册用户选择文件管理器
    this.register('user-selected', UserSelectedFileManager.getInstance())

    // 注册远程文件管理器
    this.register('remote', RemoteFileManager.getInstance())
  }

  // ==================== 便捷方法 ====================

  /**
   * 根据数据源类型获取对应的管理器
   */
  getManagerForSource(
    source: UnifiedDataSourceData,
  ): DataSourceManager<UnifiedDataSourceData> | undefined {
    return this.getManager(source.type)
  }

  /**
   * 开始数据源获取任务
   */
  startAcquisition(source: UnifiedDataSourceData, taskId?: string): boolean {
    const manager = this.getManagerForSource(source)
    if (!manager) {
      console.error(`未找到类型为 "${source.type}" 的管理器`)
      return false
    }

    const finalTaskId = taskId || `${source.type}_${source.id}_${Date.now()}`
    manager.startAcquisition(source, finalTaskId)
    return true
  }

  /**
   * 取消数据源获取任务
   */
  cancelAcquisition(source: UnifiedDataSourceData): boolean {
    if (!source.taskId) {
      console.warn('数据源没有关联的任务ID')
      return false
    }

    const manager = this.getManagerForSource(source)
    if (!manager) {
      console.error(`未找到类型为 "${source.type}" 的管理器`)
      return false
    }

    return manager.cancelTask(source.taskId)
  }

  /**
   * 重试数据源获取任务
   */
  retryAcquisition(source: UnifiedDataSourceData): boolean {
    if (!source.taskId) {
      console.warn('数据源没有关联的任务ID')
      return false
    }

    const manager = this.getManagerForSource(source)
    if (!manager) {
      console.error(`未找到类型为 "${source.type}" 的管理器`)
      return false
    }

    return manager.retryTask(source.taskId)
  }

  // ==================== 统计和监控 ====================

  /**
   * 获取所有管理器的统计信息
   */
  getAllStats(): Record<string, ReturnType<DataSourceManager<UnifiedDataSourceData>['getStats']>> {
    const stats: Record<
      string,
      ReturnType<DataSourceManager<UnifiedDataSourceData>['getStats']>
    > = {}

    for (const [type, manager] of this.managers) {
      stats[type] = manager.getStats()
    }

    return stats
  }

  /**
   * 获取系统总体统计信息
   */
  getSystemStats(): {
    totalManagers: number
    totalTasks: number
    totalPendingTasks: number
    totalRunningTasks: number
    totalCompletedTasks: number
    totalFailedTasks: number
    totalCancelledTasks: number
  } {
    const allStats = this.getAllStats()

    const systemStats = {
      totalManagers: this.managers.size,
      totalTasks: 0,
      totalPendingTasks: 0,
      totalRunningTasks: 0,
      totalCompletedTasks: 0,
      totalFailedTasks: 0,
      totalCancelledTasks: 0,
    }

    for (const stats of Object.values(allStats)) {
      systemStats.totalTasks += stats.totalTasks
      systemStats.totalPendingTasks += stats.pendingTasks
      systemStats.totalRunningTasks += stats.runningTasks
      systemStats.totalCompletedTasks += stats.completedTasks
      systemStats.totalFailedTasks += stats.failedTasks
      systemStats.totalCancelledTasks += stats.cancelledTasks
    }

    return systemStats
  }

  // ==================== 资源管理 ====================

  /**
   * 清理所有管理器的已完成任务
   */
  cleanupAllCompletedTasks(): void {
    for (const manager of this.managers.values()) {
      manager.cleanupCompletedTasks()
    }
    console.log('已清理所有管理器的已完成任务')
  }

  /**
   * 设置所有管理器的最大并发任务数
   */
  setGlobalMaxConcurrentTasks(max: number): void {
    for (const manager of this.managers.values()) {
      manager.setMaxConcurrentTasks(max)
    }
    console.log(`已设置全局最大并发任务数: ${max}`)
  }

  /**
   * 获取所有管理器的配置信息
   */
  getAllManagerConfigs(): Record<
    string,
    {
      type: string
      maxConcurrentTasks: number
      stats: ReturnType<DataSourceManager<UnifiedDataSourceData>['getStats']>
    }
  > {
    const configs: Record<
      string,
      {
        type: string
        maxConcurrentTasks: number
        stats: ReturnType<DataSourceManager<UnifiedDataSourceData>['getStats']>
      }
    > = {}

    for (const [type, manager] of this.managers) {
      configs[type] = {
        type: manager.getManagerType(),
        maxConcurrentTasks: manager.getMaxConcurrentTasks(),
        stats: manager.getStats(),
      }
    }

    return configs
  }

  // ==================== 调试和诊断 ====================

  /**
   * 打印所有管理器的状态信息
   */
  printManagerStatus(): void {
    console.group('数据源管理器状态')

    for (const [type, manager] of this.managers) {
      const stats = manager.getStats()
      console.log(`${type}:`, {
        maxConcurrent: manager.getMaxConcurrentTasks(),
        ...stats,
      })
    }

    console.groupEnd()
  }

  /**
   * 验证所有管理器的健康状态
   */
  validateManagerHealth(): {
    healthy: boolean
    issues: string[]
  } {
    const issues: string[] = []

    // 检查是否有管理器注册
    if (this.managers.size === 0) {
      issues.push('没有注册任何管理器')
    }

    // 检查默认管理器是否存在
    const requiredTypes = ['user-selected', 'remote']
    for (const type of requiredTypes) {
      if (!this.hasManager(type)) {
        issues.push(`缺少必需的管理器: ${type}`)
      }
    }

    // 检查管理器状态
    for (const [type, manager] of this.managers) {
      try {
        const stats = manager.getStats()
        if (stats.totalTasks < 0) {
          issues.push(`管理器 ${type} 的任务统计异常`)
        }
      } catch (error) {
        issues.push(`管理器 ${type} 状态检查失败: ${error}`)
      }
    }

    return {
      healthy: issues.length === 0,
      issues,
    }
  }
}

// ==================== 导出便捷函数 ====================

/**
 * 获取管理器注册中心实例
 */
export function getManagerRegistry(): DataSourceManagerRegistry {
  return DataSourceManagerRegistry.getInstance()
}

/**
 * 快速开始数据源获取
 */
export function startDataSourceAcquisition(
  source: UnifiedDataSourceData,
  taskId?: string,
): boolean {
  return getManagerRegistry().startAcquisition(source, taskId)
}

/**
 * 快速取消数据源获取
 */
export function cancelDataSourceAcquisition(source: UnifiedDataSourceData): boolean {
  return getManagerRegistry().cancelAcquisition(source)
}

/**
 * 快速重试数据源获取
 */
export function retryDataSourceAcquisition(source: UnifiedDataSourceData): boolean {
  return getManagerRegistry().retryAcquisition(source)
}

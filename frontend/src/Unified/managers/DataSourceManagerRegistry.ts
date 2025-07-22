/**
 * 数据源管理器注册中心
 * 
 * 统一管理所有数据源管理器的注册、获取和全局操作
 * 采用单例模式，确保全局唯一的管理器注册中心
 */

import type { BaseDataSource } from '../sources/BaseDataSource'
import type { BaseDataSourceManager, ManagerStats } from './BaseDataSourceManager'

/**
 * 全局管理器统计信息
 */
export interface GlobalManagerStats {
  totalManagers: number
  managerStats: Map<string, ManagerStats>
}

/**
 * 数据源管理器注册中心
 * 
 * 提供管理器的注册、获取、统计和全局操作功能
 */
export class DataSourceManagerRegistry {
  private static instance: DataSourceManagerRegistry
  private managers: Map<string, BaseDataSourceManager<any>> = new Map()

  private constructor() {
    // 私有构造函数，确保单例模式
  }

  /**
   * 获取注册中心单例实例
   */
  static getInstance(): DataSourceManagerRegistry {
    if (!this.instance) {
      this.instance = new DataSourceManagerRegistry()
    }
    return this.instance
  }

  /**
   * 注册管理器
   * 
   * @param type 数据源类型标识
   * @param manager 管理器实例
   */
  register<T extends BaseDataSource>(
    type: string, 
    manager: BaseDataSourceManager<T>
  ): void {
    if (this.managers.has(type)) {
      console.warn(`管理器类型 "${type}" 已存在，将被覆盖`)
    }
    
    this.managers.set(type, manager)
    console.log(`✅ 数据源管理器已注册: ${type}`)
  }

  /**
   * 获取指定类型的管理器
   * 
   * @param type 数据源类型标识
   * @returns 管理器实例或undefined
   */
  getManager<T extends BaseDataSource>(type: string): BaseDataSourceManager<T> | undefined {
    return this.managers.get(type)
  }

  /**
   * 检查管理器是否已注册
   * 
   * @param type 数据源类型标识
   * @returns 是否已注册
   */
  hasManager(type: string): boolean {
    return this.managers.has(type)
  }

  /**
   * 获取所有已注册的管理器类型
   * 
   * @returns 管理器类型数组
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.managers.keys())
  }

  /**
   * 获取所有管理器
   * 
   * @returns 管理器映射的副本
   */
  getAllManagers(): Map<string, BaseDataSourceManager<any>> {
    return new Map(this.managers)
  }

  /**
   * 注销指定类型的管理器
   * 
   * @param type 数据源类型标识
   * @returns 是否成功注销
   */
  unregister(type: string): boolean {
    const success = this.managers.delete(type)
    if (success) {
      console.log(`🗑️ 数据源管理器已注销: ${type}`)
    }
    return success
  }

  /**
   * 清空所有管理器
   */
  clear(): void {
    const types = Array.from(this.managers.keys())
    this.managers.clear()
    console.log(`🗑️ 已清空所有数据源管理器: ${types.join(', ')}`)
  }

  /**
   * 获取全局统计信息
   * 
   * @returns 全局管理器统计信息
   */
  getGlobalStats(): GlobalManagerStats {
    const stats: GlobalManagerStats = {
      totalManagers: this.managers.size,
      managerStats: new Map()
    }

    this.managers.forEach((manager, type) => {
      stats.managerStats.set(type, manager.getStats())
    })

    return stats
  }

  /**
   * 清理所有管理器的已完成任务
   * 
   * 遍历所有已注册的管理器，清理其已完成的任务以释放内存
   */
  cleanupAllCompletedTasks(): void {
    let totalCleaned = 0
    
    this.managers.forEach((manager, type) => {
      const beforeStats = manager.getStats()
      manager.cleanupCompletedTasks()
      const afterStats = manager.getStats()
      
      const cleaned = beforeStats.totalTasks - afterStats.totalTasks
      if (cleaned > 0) {
        totalCleaned += cleaned
        console.log(`🧹 ${type} 管理器清理了 ${cleaned} 个已完成任务`)
      }
    })

    if (totalCleaned > 0) {
      console.log(`🧹 全局清理完成，共清理 ${totalCleaned} 个已完成任务`)
    }
  }

  /**
   * 获取全局活跃任务数量
   * 
   * @returns 所有管理器的活跃任务总数
   */
  getGlobalActiveTaskCount(): number {
    let totalActive = 0
    
    this.managers.forEach(manager => {
      totalActive += manager.getActiveTaskCount()
    })

    return totalActive
  }

  /**
   * 设置所有管理器的最大并发任务数
   * 
   * @param maxConcurrent 最大并发任务数
   */
  setGlobalMaxConcurrentTasks(maxConcurrent: number): void {
    this.managers.forEach((manager, type) => {
      manager.setMaxConcurrentTasks(maxConcurrent)
      console.log(`⚙️ ${type} 管理器最大并发任务数设置为: ${maxConcurrent}`)
    })
  }

  /**
   * 打印全局统计信息到控制台
   */
  printGlobalStats(): void {
    const stats = this.getGlobalStats()
    
    console.log('📊 数据源管理器全局统计:')
    console.log(`  总管理器数量: ${stats.totalManagers}`)
    
    if (stats.totalManagers > 0) {
      console.log('  各管理器详情:')
      stats.managerStats.forEach((managerStats, type) => {
        console.log(`    ${type}:`)
        console.log(`      总任务: ${managerStats.totalTasks}`)
        console.log(`      运行中: ${managerStats.runningTasks}`)
        console.log(`      等待中: ${managerStats.pendingTasks}`)
        console.log(`      已完成: ${managerStats.completedTasks}`)
        console.log(`      失败: ${managerStats.failedTasks}`)
        console.log(`      已取消: ${managerStats.cancelledTasks}`)
        console.log(`      最大并发: ${managerStats.maxConcurrentTasks}`)
      })
    }
  }
}

/**
 * 获取全局管理器注册中心实例的便捷函数
 */
export function getManagerRegistry(): DataSourceManagerRegistry {
  return DataSourceManagerRegistry.getInstance()
}

/**
 * 注册管理器的便捷函数
 */
export function registerManager<T extends BaseDataSource>(
  type: string, 
  manager: BaseDataSourceManager<T>
): void {
  getManagerRegistry().register(type, manager)
}

/**
 * 获取管理器的便捷函数
 */
export function getManager<T extends BaseDataSource>(
  type: string
): BaseDataSourceManager<T> | undefined {
  return getManagerRegistry().getManager<T>(type)
}

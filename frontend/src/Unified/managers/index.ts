/**
 * 数据源管理器统一导出文件
 * 
 * 导出所有数据源管理器相关的类型和实现
 */

// ==================== 基础管理器类型 ====================

export {
  BaseDataSourceManager,
  type AcquisitionTask,
  type AcquisitionTaskStatus,
  type ManagerStats,
  type ManagerConfig
} from './BaseDataSourceManager'

// ==================== 管理器注册系统 ====================

export {
  DataSourceManagerRegistry,
  getManagerRegistry,
  registerManager,
  getManager,
  type GlobalManagerStats
} from './DataSourceManagerRegistry'
import  { DataSourceManagerRegistry } from './DataSourceManagerRegistry'

// ==================== 具体管理器实现 ====================

export { UserSelectedFileManager } from './UserSelectedFileManager'
import { UserSelectedFileManager } from './UserSelectedFileManager'
// ==================== 管理器初始化 ====================

/**
 * 初始化所有数据源管理器
 * 
 * 注册所有已实现的管理器到全局注册中心
 * 应在应用启动时调用
 */
export function initializeDataSourceManagers(): void {
  const registry = DataSourceManagerRegistry.getInstance()
  
  // 注册用户选择文件管理器
  registry.register('user-selected', UserSelectedFileManager.getInstance())
  
  console.log('✅ 数据源管理器初始化完成')
  
  // 打印注册的管理器信息
  const registeredTypes = registry.getRegisteredTypes()
  console.log(`📋 已注册的管理器类型: ${registeredTypes.join(', ')}`)
}

/**
 * 获取所有已注册的管理器类型
 */
export function getRegisteredManagerTypes(): string[] {
  return DataSourceManagerRegistry.getInstance().getRegisteredTypes()
}

/**
 * 清理所有管理器的已完成任务
 */
export function cleanupAllManagerTasks(): void {
  DataSourceManagerRegistry.getInstance().cleanupAllCompletedTasks()
}

/**
 * 打印全局管理器统计信息
 */
export function printGlobalManagerStats(): void {
  DataSourceManagerRegistry.getInstance().printGlobalStats()
}

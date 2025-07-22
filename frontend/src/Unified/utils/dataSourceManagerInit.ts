/**
 * 数据源管理器初始化工具
 *
 * 负责在应用启动时初始化和注册所有数据源管理器
 * 确保管理器在使用前已正确注册到全局注册中心
 */

import {
  initializeDataSourceManagers,
  printGlobalManagerStats,
  getRegisteredManagerTypes,
} from '@/Unified'

/**
 * 初始化数据源管理器系统
 *
 * 应在应用的main.ts或App.vue中调用
 * 确保所有管理器在数据源使用前已正确初始化
 */
export function initDataSourceManagers(): void {
  console.log('🚀 开始初始化数据源管理器系统...')

  try {
    // 初始化所有管理器
    initializeDataSourceManagers()

    // 验证初始化结果
    const registeredTypes = getRegisteredManagerTypes()

    if (registeredTypes.length === 0) {
      console.warn('⚠️ 没有注册任何数据源管理器')
      return
    }

    console.log(`✅ 数据源管理器系统初始化成功`)
    console.log(`📊 已注册 ${registeredTypes.length} 个管理器类型:`)
    registeredTypes.forEach((type) => {
      console.log(`   - ${type}`)
    })

    printGlobalManagerStats()
  } catch (error) {
    console.error('❌ 数据源管理器系统初始化失败:', error)
    throw error
  }
}

/**
 * 检查管理器系统是否已初始化
 */
export function isDataSourceManagersInitialized(): boolean {
  const registeredTypes = getRegisteredManagerTypes()
  return registeredTypes.length > 0
}

/**
 * 获取管理器系统状态信息
 */
export function getDataSourceManagersStatus(): {
  initialized: boolean
  registeredTypes: string[]
  totalManagers: number
} {
  const registeredTypes = getRegisteredManagerTypes()

  return {
    initialized: registeredTypes.length > 0,
    registeredTypes,
    totalManagers: registeredTypes.length,
  }
}

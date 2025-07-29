import { createConfigModule, type ConfigModule } from '@/stores/modules/configModule'

/**
 * 统一配置管理模块
 * 负责管理项目级别的配置和设置
 * 
 * 注意：此模块是对旧架构configModule的封装，用于统一新架构的模块导入方式
 */
export function createUnifiedConfigModule() {
  // 直接使用旧架构的configModule
  const configModule = createConfigModule()
  
  return {
    // 导出所有configModule的状态和方法
    ...configModule
  }
}

// 导出类型定义
export type UnifiedConfigModule = ReturnType<typeof createUnifiedConfigModule>
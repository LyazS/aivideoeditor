import { createWebAVModule, type WebAVModule } from '@/stores/modules/webavModule'

/**
 * 统一WebAV集成管理模块
 * 负责管理WebAV相关的状态和方法
 * 
 * 注意：此模块是对旧架构webavModule的封装，用于统一新架构的模块导入方式
 */
export function createUnifiedWebavModule() {
  // 直接使用旧架构的webavModule
  const webavModule = createWebAVModule()
  
  return {
    // 导出所有webavModule的状态和方法
    ...webavModule
  }
}

// 导出类型定义
export type UnifiedWebavModule = ReturnType<typeof createUnifiedWebavModule>
import { 
  createHistoryModule, 
  BaseBatchCommand, 
  BatchBuilder, 
  GenericBatchCommand 
} from '@/stores/modules/historyModule'
import type { NotificationManager } from '@/types'

/**
 * 统一历史记录管理模块
 * 负责管理操作历史记录和撤销/重做功能
 * 
 * 注意：此模块是对旧架构historyModule的封装，用于统一新架构的模块导入方式
 */
export function createUnifiedHistoryModule(notificationManager: NotificationManager) {
  // 直接使用旧架构的historyModule
  const historyModule = createHistoryModule(notificationManager)
  
  return {
    // 导出所有historyModule的状态和方法
    ...historyModule
  }
}

// 重新导出批量命令相关类
export { BaseBatchCommand, BatchBuilder, GenericBatchCommand }

// 导出类型定义
export type UnifiedHistoryModule = ReturnType<typeof createUnifiedHistoryModule>
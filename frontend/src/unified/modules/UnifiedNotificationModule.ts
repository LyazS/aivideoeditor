import { createNotificationModule } from '@/stores/modules/notificationModule'
import type { Notification, NotificationType } from '@/types'

/**
 * 统一通知管理模块
 * 负责管理应用内的通知显示和管理
 * 
 * 注意：此模块是对旧架构notificationModule的封装，用于统一新架构的模块导入方式
 */
export function createUnifiedNotificationModule() {
  // 直接使用旧架构的notificationModule
  const notificationModule = createNotificationModule()
  
  return {
    // 导出所有notificationModule的状态和方法
    ...notificationModule
  }
}

// 导出类型定义
export type UnifiedNotificationModule = ReturnType<typeof createUnifiedNotificationModule>
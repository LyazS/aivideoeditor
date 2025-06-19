import { ref } from 'vue'

/**
 * 通知类型
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info'

/**
 * 通知接口
 */
export interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number // 显示时长（毫秒），0表示不自动消失
}

/**
 * 通知管理器
 * 专门负责应用内的通知显示和管理
 */
class NotificationManager {
  private notifications = ref<Notification[]>([])
  private nextId = 1

  /**
   * 显示通知
   * @param notification 通知配置
   */
  show(notification: Omit<Notification, 'id'>): string {
    const id = `notification-${this.nextId++}`
    const fullNotification: Notification = {
      id,
      duration: 5000, // 默认5秒
      ...notification,
    }

    this.notifications.value.push(fullNotification)

    // 自动移除通知
    if (fullNotification.duration && fullNotification.duration > 0) {
      setTimeout(() => {
        this.remove(id)
      }, fullNotification.duration)
    }

    return id
  }

  /**
   * 移除通知
   * @param id 通知ID
   */
  remove(id: string): void {
    const index = this.notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      this.notifications.value.splice(index, 1)
    }
  }

  /**
   * 清空所有通知
   */
  clear(): void {
    this.notifications.value = []
  }

  /**
   * 获取通知列表
   */
  getNotifications() {
    return this.notifications
  }

  /**
   * 显示成功通知
   */
  success(title: string, message?: string, duration?: number): string {
    return this.show({ type: 'success', title, message, duration: duration || 3000 })
  }

  /**
   * 显示错误通知
   */
  error(title: string, message?: string, duration?: number): string {
    return this.show({ type: 'error', title, message, duration: duration || 5000 })
  }

  /**
   * 显示警告通知
   */
  warning(title: string, message?: string, duration?: number): string {
    return this.show({ type: 'warning', title, message, duration: duration || 5000 })
  }

  /**
   * 显示信息通知
   */
  info(title: string, message?: string, duration?: number): string {
    return this.show({ type: 'info', title, message, duration: duration || 5000 })
  }
}

/**
 * 通知管理模块
 * 提供响应式的通知状态和方法
 */
export function createNotificationModule() {
  // ==================== 状态定义 ====================

  // 创建通知管理器
  const notificationManager = new NotificationManager()

  // ==================== 公共方法 ====================

  /**
   * 显示通知
   * @param notification 通知配置
   */
  function showNotification(notification: Omit<Notification, 'id'>): string {
    return notificationManager.show(notification)
  }

  /**
   * 移除通知
   * @param id 通知ID
   */
  function removeNotification(id: string): void {
    notificationManager.remove(id)
  }

  /**
   * 清空所有通知
   */
  function clearNotifications(): void {
    notificationManager.clear()
  }

  /**
   * 显示成功通知
   */
  function showSuccess(title: string, message?: string, duration?: number): string {
    return notificationManager.success(title, message, duration)
  }

  /**
   * 显示错误通知
   */
  function showError(title: string, message?: string, duration?: number): string {
    return notificationManager.error(title, message, duration)
  }

  /**
   * 显示警告通知
   */
  function showWarning(title: string, message?: string, duration?: number): string {
    return notificationManager.warning(title, message, duration)
  }

  /**
   * 显示信息通知
   */
  function showInfo(title: string, message?: string, duration?: number): string {
    return notificationManager.info(title, message, duration)
  }

  // ==================== 导出接口 ====================

  return {
    // 响应式状态
    notifications: notificationManager.getNotifications(),

    // 通知管理方法
    showNotification,
    removeNotification,
    clearNotifications,

    // 便捷通知方法
    showSuccess,
    showError,
    showWarning,
    showInfo,
  }
}

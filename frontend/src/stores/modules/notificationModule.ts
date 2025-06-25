import { ref } from 'vue'
import type { Notification, NotificationType } from '../../types'

// Notification 和 NotificationType 接口已移动到统一类型文件 src/types/index.ts

/**
 * 通知管理器
 * 专门负责应用内的通知显示和管理
 */
class NotificationManager {
  private notifications = ref<Notification[]>([])
  private nextId = 1
  private maxNotifications = 5 // 最大同时显示的通知数量

  /**
   * 显示通知
   * @param notification 通知配置
   */
  show(notification: Omit<Notification, 'id'>): string {
    const id = `notification-${this.nextId++}`
    const fullNotification: Notification = {
      id,
      duration: 5000, // 默认5秒
      timestamp: Date.now(),
      persistent: false,
      ...notification,
    }

    // 如果通知数量超过限制，移除最旧的非持久化通知
    if (this.notifications.value.length >= this.maxNotifications) {
      const oldestNonPersistent = this.notifications.value.find(n => !n.persistent)
      if (oldestNonPersistent) {
        this.remove(oldestNonPersistent.id)
      }
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
   * @param includePersistent 是否包括持久化通知
   */
  clear(includePersistent: boolean = false): void {
    if (includePersistent) {
      this.notifications.value = []
    } else {
      this.notifications.value = this.notifications.value.filter(n => n.persistent)
    }
  }

  /**
   * 根据类型移除通知
   * @param type 通知类型
   */
  removeByType(type: NotificationType): void {
    this.notifications.value = this.notifications.value.filter(n => n.type !== type)
  }

  /**
   * 获取指定类型的通知数量
   * @param type 通知类型
   */
  getCountByType(type: NotificationType): number {
    return this.notifications.value.filter(n => n.type === type).length
  }

  /**
   * 检查是否存在相同内容的通知（防重复）
   * @param title 标题
   * @param message 消息
   */
  hasDuplicate(title: string, message?: string): boolean {
    return this.notifications.value.some(n =>
      n.title === title && n.message === message
    )
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
  success(title: string, message?: string, duration?: number, options?: { persistent?: boolean }): string {
    // 检查重复通知
    if (this.hasDuplicate(title, message)) {
      console.log('🔄 跳过重复的成功通知:', title)
      return ''
    }
    return this.show({
      type: 'success',
      title,
      message,
      duration: duration || 3000,
      persistent: options?.persistent || false
    })
  }

  /**
   * 显示错误通知
   */
  error(title: string, message?: string, duration?: number, options?: { persistent?: boolean }): string {
    // 错误通知不检查重复，因为可能需要多次显示
    return this.show({
      type: 'error',
      title,
      message,
      duration: duration || 8000, // 错误通知显示更久
      persistent: options?.persistent || false
    })
  }

  /**
   * 显示警告通知
   */
  warning(title: string, message?: string, duration?: number, options?: { persistent?: boolean }): string {
    if (this.hasDuplicate(title, message)) {
      console.log('🔄 跳过重复的警告通知:', title)
      return ''
    }
    return this.show({
      type: 'warning',
      title,
      message,
      duration: duration || 6000,
      persistent: options?.persistent || false
    })
  }

  /**
   * 显示信息通知
   */
  info(title: string, message?: string, duration?: number, options?: { persistent?: boolean }): string {
    if (this.hasDuplicate(title, message)) {
      console.log('🔄 跳过重复的信息通知:', title)
      return ''
    }
    return this.show({
      type: 'info',
      title,
      message,
      duration: duration || 5000,
      persistent: options?.persistent || false
    })
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
   * @param includePersistent 是否包括持久化通知
   */
  function clearNotifications(includePersistent: boolean = false): void {
    notificationManager.clear(includePersistent)
  }

  /**
   * 根据类型移除通知
   * @param type 通知类型
   */
  function removeNotificationsByType(type: NotificationType): void {
    notificationManager.removeByType(type)
  }

  /**
   * 获取指定类型的通知数量
   * @param type 通知类型
   */
  function getNotificationCountByType(type: NotificationType): number {
    return notificationManager.getCountByType(type)
  }

  /**
   * 显示成功通知
   */
  function showSuccess(title: string, message?: string, duration?: number, options?: { persistent?: boolean }): string {
    return notificationManager.success(title, message, duration, options)
  }

  /**
   * 显示错误通知
   */
  function showError(title: string, message?: string, duration?: number, options?: { persistent?: boolean }): string {
    return notificationManager.error(title, message, duration, options)
  }

  /**
   * 显示警告通知
   */
  function showWarning(title: string, message?: string, duration?: number, options?: { persistent?: boolean }): string {
    return notificationManager.warning(title, message, duration, options)
  }

  /**
   * 显示信息通知
   */
  function showInfo(title: string, message?: string, duration?: number, options?: { persistent?: boolean }): string {
    return notificationManager.info(title, message, duration, options)
  }

  // ==================== 导出接口 ====================

  return {
    // 响应式状态
    notifications: notificationManager.getNotifications(),

    // 通知管理方法
    showNotification,
    removeNotification,
    clearNotifications,
    removeNotificationsByType,
    getNotificationCountByType,

    // 便捷通知方法
    showSuccess,
    showError,
    showWarning,
    showInfo,
  }
}

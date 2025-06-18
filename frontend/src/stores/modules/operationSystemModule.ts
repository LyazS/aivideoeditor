import { ref, computed } from 'vue'
import { createOperationSystem, type OperationSystemManager, type OperationNotification } from '../operations'

/**
 * 现代化操作系统模块
 * 替换原有的historyModule，提供完整的操作管理功能
 */
export function createOperationSystemModule(modules: {
  timelineModule: any
  webavModule: any
  trackModule: any
  mediaModule: any
  configModule: any
}) {
  // ==================== 状态定义 ====================
  
  // 操作系统管理器
  let systemManager: OperationSystemManager | null = null
  
  // 响应式状态
  const isInitialized = ref(false)
  const isExecuting = ref(false)
  
  // 通知系统
  const notifications = ref<Array<OperationNotification & { id: string }>>([])
  
  // ==================== 初始化 ====================
  
  /**
   * 初始化操作系统
   */
  async function initialize(): Promise<void> {
    if (isInitialized.value) {
      console.warn('Operation system already initialized')
      return
    }

    try {
      console.log('🚀 初始化现代化操作系统模块...')

      // 创建操作系统
      const operationSystem = createOperationSystem(modules)
      systemManager = await operationSystem.initialize()

      // 设置通知回调
      systemManager.onNotification(handleNotification)

      isInitialized.value = true
      console.log('✅ 操作系统模块初始化完成')
    } catch (error) {
      console.error('❌ 操作系统模块初始化失败:', error)
      throw error
    }
  }

  // ==================== 通知管理 ====================
  
  /**
   * 处理操作通知
   */
  function handleNotification(notification: OperationNotification): void {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const notificationWithId = { ...notification, id }
    
    notifications.value.push(notificationWithId)
    
    // 自动移除通知
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, notification.duration)
    }
  }

  /**
   * 移除通知
   */
  function removeNotification(id: string): void {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  /**
   * 清空所有通知
   */
  function clearNotifications(): void {
    notifications.value = []
  }

  /**
   * 显示成功通知
   */
  function showSuccess(title: string, message?: string, duration?: number): string {
    const notification: OperationNotification = {
      type: 'success',
      title,
      message: message || '',
      duration: duration || 3000
    }
    handleNotification(notification)
    return notifications.value[notifications.value.length - 1].id
  }

  /**
   * 显示错误通知
   */
  function showError(title: string, message?: string, duration?: number): string {
    const notification: OperationNotification = {
      type: 'error',
      title,
      message: message || '',
      duration: duration || 5000
    }
    handleNotification(notification)
    return notifications.value[notifications.value.length - 1].id
  }

  /**
   * 显示警告通知
   */
  function showWarning(title: string, message?: string, duration?: number): string {
    const notification: OperationNotification = {
      type: 'warning',
      title,
      message: message || '',
      duration: duration || 5000
    }
    handleNotification(notification)
    return notifications.value[notifications.value.length - 1].id
  }

  /**
   * 显示信息通知
   */
  function showInfo(title: string, message?: string, duration?: number): string {
    const notification: OperationNotification = {
      type: 'info',
      title,
      message: message || '',
      duration: duration || 5000
    }
    handleNotification(notification)
    return notifications.value[notifications.value.length - 1].id
  }

  // ==================== 操作系统接口 ====================
  
  /**
   * 确保系统已初始化
   */
  function ensureInitialized(): OperationSystemManager {
    if (!isInitialized.value || !systemManager) {
      throw new Error('Operation system not initialized. Call initialize() first.')
    }
    return systemManager
  }

  /**
   * 执行操作
   */
  async function execute(operation: any): Promise<any> {
    const manager = ensureInitialized()
    isExecuting.value = true
    
    try {
      return await manager.execute(operation)
    } finally {
      isExecuting.value = false
    }
  }

  /**
   * 撤销操作
   */
  async function undo(): Promise<boolean> {
    const manager = ensureInitialized()
    isExecuting.value = true
    
    try {
      const result = await manager.undo()
      return result?.success || false
    } finally {
      isExecuting.value = false
    }
  }

  /**
   * 重做操作
   */
  async function redo(): Promise<boolean> {
    const manager = ensureInitialized()
    isExecuting.value = true
    
    try {
      const result = await manager.redo()
      return result?.success || false
    } finally {
      isExecuting.value = false
    }
  }

  /**
   * 清空历史记录
   */
  function clear(): void {
    const manager = ensureInitialized()
    manager.clearHistory()
  }

  /**
   * 获取历史摘要
   */
  function getHistorySummary(): any {
    const manager = ensureInitialized()
    return manager.history.getHistorySummary()
  }

  /**
   * 获取系统状态
   */
  function getSystemStatus(): any {
    const manager = ensureInitialized()
    return manager.getSystemStatus()
  }

  /**
   * 获取性能报告
   */
  function getPerformanceReport(): any {
    const manager = ensureInitialized()
    return manager.getPerformanceReport()
  }

  // ==================== 计算属性 ====================
  
  const canUndo = computed(() => {
    if (!isInitialized.value || !systemManager) return false
    return systemManager.history.canUndo.value
  })

  const canRedo = computed(() => {
    if (!isInitialized.value || !systemManager) return false
    return systemManager.history.canRedo.value
  })

  const currentIndex = computed(() => {
    if (!isInitialized.value || !systemManager) return -1
    return systemManager.history.currentIndex.value
  })

  const totalOperations = computed(() => {
    if (!isInitialized.value || !systemManager) return 0
    return systemManager.history.totalOperations.value
  })

  // ==================== 便捷操作方法 ====================
  
  /**
   * 获取操作工厂（用于创建操作）
   */
  function getFactory(): any {
    const manager = ensureInitialized()
    return manager.factory
  }

  /**
   * 获取操作上下文（用于高级操作）
   */
  function getContext(): any {
    const manager = ensureInitialized()
    return manager.context
  }

  /**
   * 获取系统管理器（用于直接访问）
   */
  function getSystemManager(): OperationSystemManager {
    return ensureInitialized()
  }

  // ==================== 返回模块接口 ====================
  
  return {
    // 初始化
    initialize,
    
    // 状态
    isInitialized,
    isExecuting,
    canUndo,
    canRedo,
    currentIndex,
    totalOperations,
    
    // 通知系统
    notifications,
    removeNotification,
    clearNotifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    
    // 操作系统接口
    execute,
    undo,
    redo,
    clear,
    getHistorySummary,
    getSystemStatus,
    getPerformanceReport,
    
    // 高级接口
    getFactory,
    getContext,
    getSystemManager,
    
    // 兼容性方法（用于平滑迁移）
    executeCommand: execute, // 兼容旧的executeCommand方法名
    showNotification: (notification: Omit<OperationNotification, 'id'>) => {
      handleNotification(notification as OperationNotification)
      return notifications.value[notifications.value.length - 1].id
    }
  }
}

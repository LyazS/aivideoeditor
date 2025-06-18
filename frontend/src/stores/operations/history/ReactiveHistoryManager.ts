import { ref, computed } from 'vue'
import { HistoryManager } from './HistoryManager'
import type { Operation, OperationResult, ExecutionStrategy } from '../types'
import type { HistoryListener, HistorySummary } from './HistoryTypes'

/**
 * 响应式历史管理器
 * 为HistoryManager提供Vue响应式包装
 */
export class ReactiveHistoryManager {
  private historyManager: HistoryManager
  
  // 响应式状态
  private _canUndo = ref(false)
  private _canRedo = ref(false)
  private _currentIndex = ref(-1)
  private _totalOperations = ref(0)
  private _isExecuting = ref(false)

  // 计算属性
  public readonly canUndo = computed(() => this._canUndo.value)
  public readonly canRedo = computed(() => this._canRedo.value)
  public readonly currentIndex = computed(() => this._currentIndex.value)
  public readonly totalOperations = computed(() => this._totalOperations.value)
  public readonly isExecuting = computed(() => this._isExecuting.value)

  // 通知管理
  private notificationCallbacks: Array<(notification: OperationNotification) => void> = []

  constructor() {
    this.historyManager = new HistoryManager()
    
    // 添加历史监听器来更新响应式状态
    this.historyManager.addListener(this.handleHistoryChange.bind(this))
    
    // 初始化状态
    this.updateReactiveState()
  }

  /**
   * 执行操作
   */
  async execute(operation: Operation): Promise<OperationResult> {
    this._isExecuting.value = true
    
    try {
      const result = await this.historyManager.execute(operation)
      
      // 显示通知
      if (result.success) {
        this.showNotification({
          type: 'success',
          title: '操作成功',
          message: operation.description,
          duration: 3000
        })
      } else {
        this.showNotification({
          type: 'error',
          title: '操作失败',
          message: result.error || '未知错误',
          duration: 5000
        })
      }
      
      return result
    } finally {
      this._isExecuting.value = false
    }
  }

  /**
   * 撤销操作
   */
  async undo(): Promise<OperationResult | null> {
    if (!this.canUndo.value) {
      this.showNotification({
        type: 'warning',
        title: '无法撤销',
        message: '没有可撤销的操作',
        duration: 3000
      })
      return null
    }

    this._isExecuting.value = true
    
    try {
      const result = await this.historyManager.undo()
      
      if (result?.success) {
        this.showNotification({
          type: 'success',
          title: '撤销成功',
          message: '操作已撤销',
          duration: 3000
        })
      } else {
        this.showNotification({
          type: 'error',
          title: '撤销失败',
          message: result?.error || '撤销操作时发生错误',
          duration: 5000
        })
      }
      
      return result
    } finally {
      this._isExecuting.value = false
    }
  }

  /**
   * 重做操作
   */
  async redo(): Promise<OperationResult | null> {
    if (!this.canRedo.value) {
      this.showNotification({
        type: 'warning',
        title: '无法重做',
        message: '没有可重做的操作',
        duration: 3000
      })
      return null
    }

    this._isExecuting.value = true
    
    try {
      const result = await this.historyManager.redo()
      
      if (result?.success) {
        this.showNotification({
          type: 'success',
          title: '重做成功',
          message: '操作已重做',
          duration: 3000
        })
      } else {
        this.showNotification({
          type: 'error',
          title: '重做失败',
          message: result?.error || '重做操作时发生错误',
          duration: 5000
        })
      }
      
      return result
    } finally {
      this._isExecuting.value = false
    }
  }

  /**
   * 批量执行操作
   */
  async executeBatch(operations: Operation[], strategy: ExecutionStrategy = 'transactional'): Promise<OperationResult> {
    this._isExecuting.value = true
    
    try {
      const result = await this.historyManager.executeBatch(operations, strategy)
      
      if (result.success) {
        this.showNotification({
          type: 'success',
          title: '批量操作成功',
          message: `成功执行 ${operations.length} 个操作`,
          duration: 3000
        })
      } else {
        this.showNotification({
          type: 'error',
          title: '批量操作失败',
          message: result.error || '批量操作时发生错误',
          duration: 5000
        })
      }
      
      return result
    } finally {
      this._isExecuting.value = false
    }
  }

  /**
   * 获取历史摘要
   */
  getHistorySummary(): HistorySummary {
    return this.historyManager.getHistorySummary()
  }

  /**
   * 清空历史记录
   */
  clear(): void {
    this.historyManager.clear()
    this.showNotification({
      type: 'info',
      title: '历史记录已清空',
      message: '所有操作历史已被清除',
      duration: 3000
    })
  }

  /**
   * 添加历史监听器
   */
  addListener(listener: HistoryListener): void {
    this.historyManager.addListener(listener)
  }

  /**
   * 移除历史监听器
   */
  removeListener(listener: HistoryListener): void {
    this.historyManager.removeListener(listener)
  }

  /**
   * 添加通知回调
   */
  addNotificationCallback(callback: (notification: OperationNotification) => void): void {
    this.notificationCallbacks.push(callback)
  }

  /**
   * 移除通知回调
   */
  removeNotificationCallback(callback: (notification: OperationNotification) => void): void {
    const index = this.notificationCallbacks.indexOf(callback)
    if (index > -1) {
      this.notificationCallbacks.splice(index, 1)
    }
  }

  /**
   * 处理历史变化
   */
  private handleHistoryChange(event: string, operation: Operation | null, result: OperationResult): void {
    this.updateReactiveState()
    
    // 可以在这里添加更多的历史变化处理逻辑
    console.log(`📊 历史事件: ${event}`, {
      operation: operation?.description,
      success: result.success,
      currentState: {
        canUndo: this._canUndo.value,
        canRedo: this._canRedo.value,
        total: this._totalOperations.value,
        current: this._currentIndex.value + 1
      }
    })
  }

  /**
   * 更新响应式状态
   */
  private updateReactiveState(): void {
    this._canUndo.value = this.historyManager.canUndo()
    this._canRedo.value = this.historyManager.canRedo()
    
    const summary = this.historyManager.getHistorySummary()
    this._currentIndex.value = summary.current - 1
    this._totalOperations.value = summary.total
  }

  /**
   * 显示通知
   */
  private showNotification(notification: OperationNotification): void {
    this.notificationCallbacks.forEach(callback => {
      try {
        callback(notification)
      } catch (error) {
        console.error('Notification callback error:', error)
      }
    })
  }
}

/**
 * 操作通知接口
 */
export interface OperationNotification {
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  duration?: number
}

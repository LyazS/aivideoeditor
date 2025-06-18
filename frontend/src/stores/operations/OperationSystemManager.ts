import { ReactiveHistoryManager } from './history/ReactiveHistoryManager'
import { OperationScheduler } from './advanced/OperationScheduler'
import { OperationAnalyzer } from './advanced/OperationAnalyzer'
import { OperationFactory } from './factory/OperationFactory'
import { OperationContext } from './context/OperationContext'
import type { Operation, OperationResult, ExecutionStrategy } from './types'
import type { OperationNotification } from './history/ReactiveHistoryManager'
import type { PerformanceReport } from './advanced/OperationAnalyzer'

/**
 * 操作系统管理器
 * 统一管理整个操作系统的各个组件
 */
export class OperationSystemManager {
  public readonly history: ReactiveHistoryManager
  public readonly scheduler: OperationScheduler
  public readonly analyzer: OperationAnalyzer
  public readonly factory: OperationFactory
  public readonly context: OperationContext

  private isInitialized = false

  constructor(
    context: OperationContext,
    factory: OperationFactory
  ) {
    this.context = context
    this.factory = factory
    
    // 创建核心组件
    this.history = new ReactiveHistoryManager()
    this.scheduler = new OperationScheduler(this.history)
    this.analyzer = new OperationAnalyzer()

    // 设置组件间的连接
    this.setupConnections()
  }

  /**
   * 初始化操作系统
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('Operation system already initialized')
      return
    }

    console.log('🚀 初始化现代化操作系统...')

    try {
      // 添加分析器监听器
      this.history.addListener(this.analyzer.createHistoryListener())

      // 设置默认配置
      this.scheduler.setConcurrency(1) // 默认串行执行
      this.analyzer.setEnabled(true)

      this.isInitialized = true
      console.log('✅ 操作系统初始化完成')
    } catch (error) {
      console.error('❌ 操作系统初始化失败:', error)
      throw error
    }
  }

  /**
   * 执行操作（推荐的主要接口）
   */
  async execute(operation: Operation): Promise<OperationResult> {
    this.ensureInitialized()
    
    // 使用调度器执行，获得队列管理和优化的好处
    return this.scheduler.schedule(operation, { immediate: true })
  }

  /**
   * 调度操作执行（用于非紧急操作）
   */
  async schedule(operation: Operation, priority: number = 0): Promise<OperationResult> {
    this.ensureInitialized()
    
    return this.scheduler.schedule(operation, { priority })
  }

  /**
   * 批量执行操作
   */
  async executeBatch(operations: Operation[], strategy: ExecutionStrategy = 'transactional'): Promise<OperationResult> {
    this.ensureInitialized()
    
    return this.history.executeBatch(operations, strategy)
  }

  /**
   * 撤销操作
   */
  async undo(): Promise<OperationResult | null> {
    this.ensureInitialized()
    
    return this.history.undo()
  }

  /**
   * 重做操作
   */
  async redo(): Promise<OperationResult | null> {
    this.ensureInitialized()
    
    return this.history.redo()
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): PerformanceReport {
    return this.analyzer.getPerformanceReport()
  }

  /**
   * 清空历史记录
   */
  clearHistory(): void {
    this.history.clear()
    this.analyzer.reset()
  }

  /**
   * 设置通知回调
   */
  onNotification(callback: (notification: OperationNotification) => void): void {
    this.history.addNotificationCallback(callback)
  }

  /**
   * 移除通知回调
   */
  offNotification(callback: (notification: OperationNotification) => void): void {
    this.history.removeNotificationCallback(callback)
  }

  /**
   * 获取系统状态
   */
  getSystemStatus(): SystemStatus {
    return {
      initialized: this.isInitialized,
      history: {
        canUndo: this.history.canUndo.value,
        canRedo: this.history.canRedo.value,
        currentIndex: this.history.currentIndex.value,
        totalOperations: this.history.totalOperations.value,
        isExecuting: this.history.isExecuting.value
      },
      scheduler: this.scheduler.getQueueStatus(),
      analyzer: {
        totalOperations: this.analyzer.getMetrics().totalOperations,
        successRate: this.analyzer.getMetrics().totalOperations > 0 
          ? this.analyzer.getMetrics().successfulOperations / this.analyzer.getMetrics().totalOperations 
          : 0,
        averageExecutionTime: this.analyzer.getMetrics().averageExecutionTime
      }
    }
  }

  /**
   * 启用/禁用性能分析
   */
  setAnalyzerEnabled(enabled: boolean): void {
    this.analyzer.setEnabled(enabled)
  }

  /**
   * 设置调度器并发数
   */
  setSchedulerConcurrency(maxConcurrency: number): void {
    this.scheduler.setConcurrency(maxConcurrency)
  }

  /**
   * 销毁操作系统
   */
  destroy(): void {
    console.log('🔄 销毁操作系统...')
    
    // 清空队列
    this.scheduler.clearQueue()
    
    // 清空历史
    this.history.clear()
    
    // 重置分析器
    this.analyzer.reset()
    
    this.isInitialized = false
    console.log('✅ 操作系统已销毁')
  }

  // ==================== 便捷方法 ====================

  /**
   * 创建并执行添加时间轴项目操作
   */
  async addTimelineItem(itemData: any): Promise<OperationResult> {
    const operation = this.factory.createTimelineItemAdd(itemData)
    return this.execute(operation)
  }

  /**
   * 创建并执行删除时间轴项目操作
   */
  async removeTimelineItem(itemId: string): Promise<OperationResult> {
    const operation = this.factory.createTimelineItemRemove(itemId)
    return this.execute(operation)
  }

  /**
   * 创建并执行移动时间轴项目操作
   */
  async moveTimelineItem(itemId: string, from: any, to: any): Promise<OperationResult> {
    const operation = this.factory.createTimelineItemMove(itemId, from, to)
    return this.execute(operation)
  }

  /**
   * 创建并执行变换时间轴项目操作
   */
  async transformTimelineItem(itemId: string, oldTransform: any, newTransform: any): Promise<OperationResult> {
    const operation = this.factory.createTimelineItemTransform(itemId, oldTransform, newTransform)
    return this.execute(operation)
  }

  /**
   * 创建并执行添加轨道操作
   */
  async addTrack(name?: string): Promise<OperationResult> {
    const operation = this.factory.createTrackAdd(name)
    return this.execute(operation)
  }

  /**
   * 创建并执行删除轨道操作
   */
  async removeTrack(trackId: number): Promise<OperationResult> {
    const operation = this.factory.createTrackRemove(trackId)
    return this.execute(operation)
  }

  /**
   * 创建并执行自动排列操作
   */
  async autoArrange(trackId: number): Promise<OperationResult> {
    const operation = this.factory.createAutoArrange(trackId)
    return this.execute(operation)
  }

  // ==================== 私有方法 ====================

  /**
   * 设置组件间的连接
   */
  private setupConnections(): void {
    // 这里可以设置各组件间的通信和协调逻辑
    console.log('🔗 设置操作系统组件连接...')
  }

  /**
   * 确保系统已初始化
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Operation system not initialized. Call initialize() first.')
    }
  }
}

/**
 * 系统状态接口
 */
export interface SystemStatus {
  initialized: boolean
  history: {
    canUndo: boolean
    canRedo: boolean
    currentIndex: number
    totalOperations: number
    isExecuting: boolean
  }
  scheduler: {
    pending: number
    executing: number
    maxConcurrency: number
  }
  analyzer: {
    totalOperations: number
    successRate: number
    averageExecutionTime: number
  }
}

import type { Operation, OperationResult } from '../types'
import type { HistoryListener } from '../history/HistoryTypes'

/**
 * 操作分析器
 * 提供操作性能监控、统计分析和调试功能
 */
export class OperationAnalyzer {
  private metrics: OperationMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    totalExecutionTime: 0,
    averageExecutionTime: 0,
    operationTypes: new Map(),
    performanceHistory: [],
    errorHistory: []
  }

  private isEnabled = true
  private maxHistorySize = 1000

  /**
   * 启用/禁用分析器
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  /**
   * 记录操作开始
   */
  recordOperationStart(operation: Operation): OperationRecord {
    if (!this.isEnabled) {
      return { operation, startTime: 0, endTime: 0, duration: 0, success: false }
    }

    const record: OperationRecord = {
      operation,
      startTime: performance.now(),
      endTime: 0,
      duration: 0,
      success: false
    }

    return record
  }

  /**
   * 记录操作完成
   */
  recordOperationEnd(record: OperationRecord, result: OperationResult): void {
    if (!this.isEnabled) return

    record.endTime = performance.now()
    record.duration = record.endTime - record.startTime
    record.success = result.success
    record.error = result.error

    this.updateMetrics(record)
    this.addToHistory(record)

    // 性能警告
    if (record.duration > 1000) { // 超过1秒
      console.warn(`⚠️ 慢操作检测: ${record.operation.description} 耗时 ${record.duration.toFixed(2)}ms`)
    }

    // 调试日志
    console.log(`📊 操作分析: ${record.operation.description}`, {
      duration: `${record.duration.toFixed(2)}ms`,
      success: record.success,
      type: record.operation.type,
      metadata: record.operation.metadata
    })
  }

  /**
   * 获取性能指标
   */
  getMetrics(): OperationMetrics {
    return { ...this.metrics }
  }

  /**
   * 获取操作类型统计
   */
  getOperationTypeStats(): Array<{ type: string; count: number; avgDuration: number; successRate: number }> {
    const stats: Array<{ type: string; count: number; avgDuration: number; successRate: number }> = []

    this.metrics.operationTypes.forEach((typeMetrics, type) => {
      stats.push({
        type,
        count: typeMetrics.count,
        avgDuration: typeMetrics.totalDuration / typeMetrics.count,
        successRate: typeMetrics.successCount / typeMetrics.count
      })
    })

    return stats.sort((a, b) => b.count - a.count)
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): PerformanceReport {
    const typeStats = this.getOperationTypeStats()
    const recentErrors = this.metrics.errorHistory.slice(-10)
    const slowOperations = this.metrics.performanceHistory
      .filter(record => record.duration > 500)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)

    return {
      summary: {
        totalOperations: this.metrics.totalOperations,
        successRate: this.metrics.totalOperations > 0 
          ? this.metrics.successfulOperations / this.metrics.totalOperations 
          : 0,
        averageExecutionTime: this.metrics.averageExecutionTime,
        totalExecutionTime: this.metrics.totalExecutionTime
      },
      operationTypes: typeStats,
      recentErrors,
      slowOperations,
      recommendations: this.generateRecommendations(typeStats, slowOperations)
    }
  }

  /**
   * 重置统计数据
   */
  reset(): void {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      operationTypes: new Map(),
      performanceHistory: [],
      errorHistory: []
    }
  }

  /**
   * 创建历史监听器
   */
  createHistoryListener(): HistoryListener {
    return (event: string, operation: Operation | null, result: OperationResult) => {
      if (!this.isEnabled || !operation) return

      // 简化的记录方式，用于历史监听
      const record: OperationRecord = {
        operation,
        startTime: operation.timestamp,
        endTime: Date.now(),
        duration: Date.now() - operation.timestamp,
        success: result.success,
        error: result.error
      }

      this.updateMetrics(record)
    }
  }

  /**
   * 更新指标
   */
  private updateMetrics(record: OperationRecord): void {
    this.metrics.totalOperations++
    this.metrics.totalExecutionTime += record.duration

    if (record.success) {
      this.metrics.successfulOperations++
    } else {
      this.metrics.failedOperations++
    }

    this.metrics.averageExecutionTime = this.metrics.totalExecutionTime / this.metrics.totalOperations

    // 更新操作类型统计
    const type = record.operation.type
    if (!this.metrics.operationTypes.has(type)) {
      this.metrics.operationTypes.set(type, {
        count: 0,
        successCount: 0,
        totalDuration: 0
      })
    }

    const typeMetrics = this.metrics.operationTypes.get(type)!
    typeMetrics.count++
    typeMetrics.totalDuration += record.duration
    if (record.success) {
      typeMetrics.successCount++
    }
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(record: OperationRecord): void {
    // 添加到性能历史
    this.metrics.performanceHistory.push(record)
    if (this.metrics.performanceHistory.length > this.maxHistorySize) {
      this.metrics.performanceHistory.shift()
    }

    // 添加到错误历史
    if (!record.success && record.error) {
      this.metrics.errorHistory.push({
        operation: record.operation,
        error: record.error,
        timestamp: record.endTime
      })
      if (this.metrics.errorHistory.length > this.maxHistorySize) {
        this.metrics.errorHistory.shift()
      }
    }
  }

  /**
   * 生成性能建议
   */
  private generateRecommendations(
    typeStats: Array<{ type: string; count: number; avgDuration: number; successRate: number }>,
    slowOperations: OperationRecord[]
  ): string[] {
    const recommendations: string[] = []

    // 检查慢操作类型
    const slowTypes = typeStats.filter(stat => stat.avgDuration > 500)
    if (slowTypes.length > 0) {
      recommendations.push(`发现 ${slowTypes.length} 种操作类型平均执行时间超过500ms，建议优化: ${slowTypes.map(t => t.type).join(', ')}`)
    }

    // 检查失败率高的操作
    const unreliableTypes = typeStats.filter(stat => stat.successRate < 0.9 && stat.count > 5)
    if (unreliableTypes.length > 0) {
      recommendations.push(`发现 ${unreliableTypes.length} 种操作类型成功率低于90%，建议检查: ${unreliableTypes.map(t => t.type).join(', ')}`)
    }

    // 检查频繁操作
    const frequentTypes = typeStats.filter(stat => stat.count > 100)
    if (frequentTypes.length > 0) {
      recommendations.push(`发现 ${frequentTypes.length} 种高频操作，建议考虑批量优化: ${frequentTypes.map(t => t.type).join(', ')}`)
    }

    if (recommendations.length === 0) {
      recommendations.push('系统运行良好，暂无优化建议')
    }

    return recommendations
  }
}

/**
 * 操作记录
 */
export interface OperationRecord {
  operation: Operation
  startTime: number
  endTime: number
  duration: number
  success: boolean
  error?: string
}

/**
 * 操作指标
 */
interface OperationMetrics {
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  totalExecutionTime: number
  averageExecutionTime: number
  operationTypes: Map<string, OperationTypeMetrics>
  performanceHistory: OperationRecord[]
  errorHistory: Array<{
    operation: Operation
    error: string
    timestamp: number
  }>
}

/**
 * 操作类型指标
 */
interface OperationTypeMetrics {
  count: number
  successCount: number
  totalDuration: number
}

/**
 * 性能报告
 */
export interface PerformanceReport {
  summary: {
    totalOperations: number
    successRate: number
    averageExecutionTime: number
    totalExecutionTime: number
  }
  operationTypes: Array<{
    type: string
    count: number
    avgDuration: number
    successRate: number
  }>
  recentErrors: Array<{
    operation: Operation
    error: string
    timestamp: number
  }>
  slowOperations: OperationRecord[]
  recommendations: string[]
}

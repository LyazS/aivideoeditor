/**
 * 视频编辑执行系统 - 主执行系统
 *
 * 采用组合式API设计，协调四阶段执行流程：
 * 1. 脚本执行 → 2. 配置验证 → 3. 命令构建 → 4. 批量执行
 *
 * 与useBatchCommandBuilder保持一致的设计理念，提供函数式架构
 */

import type { Ref } from 'vue'
import { ScriptExecutor } from './ScriptExecutor'
import { ConfigValidator } from './ConfigValidator'
import {
  useBatchCommandBuilder,
  type OperationConfig,
  type BuildResult,
  type OperationResult as BuildOperationResult,
} from './useBatchCommandBuilder'

// 重新定义OperationConfig以避免类型冲突
type ScriptOperationConfig = {
  type: string
  params: any
}
import type {
  UnifiedHistoryModule,
  UnifiedTimelineModule,
  UnifiedWebavModule,
  UnifiedMediaModule,
  UnifiedConfigModule,
  UnifiedTrackModule,
  UnifiedSelectionModule,
} from '@/unified/modules'

// 执行结果接口
export interface ExecutionResult {
  success: boolean
  executedCount: number
  errorCount: number
  results: ExecutionOperationResult[]
  errors?: ExecutionError[]
}

export interface ExecutionOperationResult {
  success: boolean
  operation: OperationConfig
  error?: string
}

export interface ExecutionError {
  operation?: OperationConfig
  error: string
  type: 'script' | 'validation' | 'build' | 'execution'
}

// 执行系统配置接口
export interface ExecutionSystemConfig {
  historyModule: UnifiedHistoryModule
  timelineModule: UnifiedTimelineModule
  webavModule: UnifiedWebavModule
  mediaModule: UnifiedMediaModule
  configModule: UnifiedConfigModule
  trackModule: UnifiedTrackModule
  selectionModule: UnifiedSelectionModule
}

/**
 * 视频编辑执行系统组合式函数
 *
 * 提供完整的四阶段执行流程协调功能
 */
export function useVideoEditExecutionSystem(config: ExecutionSystemConfig) {
  // 创建执行器实例
  const scriptExecutor = new ScriptExecutor()
  const configValidator = new ConfigValidator()

  // 创建批量命令构建器
  const batchCommandBuilder = useBatchCommandBuilder(
    config.historyModule,
    config.timelineModule,
    config.webavModule,
    config.mediaModule,
    config.configModule,
    config.trackModule,
    config.selectionModule,
  )

  /**
   * 执行用户脚本 - 核心执行函数
   *
   * 协调四阶段执行流程：
   * 1. 脚本执行 → 2. 配置验证 → 3. 命令构建 → 4. 批量执行
   */
  async function executeUserScript(
    userScript: string,
    timeout: number = 5000,
    validateConfig: boolean = true,
  ): Promise<ExecutionResult> {
    try {
      // 阶段1: 脚本执行
      const operations = await executeScriptPhase(userScript, timeout, validateConfig)

      if (operations.length === 0) {
        return createSuccessResult([], '未生成任何操作')
      }

      // 阶段2: 配置验证
      const validationResult = await validateOperationsPhase(operations, validateConfig)

      if (validationResult.errors.length > 0) {
        return createValidationErrorResult(validationResult.errors)
      }

      if (validationResult.validOperations.length === 0) {
        return createSuccessResult([], '没有有效的操作可供执行')
      }

      // 阶段3: 命令构建
      const buildResult = await buildCommandsPhase(validationResult.validOperations)

      if (buildResult.buildResults.some((r) => !r.success)) {
        return createBuildErrorResult(buildResult.buildResults)
      }

      // 阶段4: 批量执行
      return await executeCommandsPhase(buildResult)
    } catch (error: any) {
      // 处理脚本执行阶段的错误
      return createScriptErrorResult(error.message)
    } finally {
      // 确保资源清理
      cleanupResources()
    }
  }

  /**
   * 阶段1: 脚本执行
   *
   * 在沙箱环境中执行用户代码，生成操作配置
   */
  async function executeScriptPhase(
    userScript: string,
    timeout: number,
    validateConfig: boolean,
  ): Promise<ScriptOperationConfig[]> {
    try {
      return await scriptExecutor.executeScript(userScript, timeout, validateConfig)
    } catch (error: any) {
      throw new Error(`脚本执行失败: ${error.message}`)
    }
  }

  /**
   * 阶段2: 配置验证
   *
   * 验证操作配置的合法性
   */
  async function validateOperationsPhase(
    operations: ScriptOperationConfig[],
    validateConfig: boolean,
  ): Promise<{ validOperations: OperationConfig[]; errors: ExecutionError[] }> {
    if (!validateConfig || operations.length === 0) {
      // 直接返回空数组，避免类型冲突
      return { validOperations: [], errors: [] }
    }

    const validationResult = configValidator.validateOperations(operations as any)

    const errors: ExecutionError[] = validationResult.errors.map((error) => ({
      operation: error.operation as OperationConfig,
      error: error.error,
      type: 'validation',
    }))

    return {
      validOperations: validationResult.validOperations as OperationConfig[],
      errors,
    }
  }

  /**
   * 阶段3: 命令构建
   *
   * 将验证后的操作配置转换为可执行的命令
   */
  async function buildCommandsPhase(validOperations: OperationConfig[]): Promise<BuildResult> {
    try {
      return batchCommandBuilder.buildOperations(validOperations)
    } catch (error: any) {
      throw new Error(`命令构建失败: ${error.message}`)
    }
  }

  /**
   * 阶段4: 批量执行
   *
   * 执行构建好的批量命令
   */
  async function executeCommandsPhase(buildResult: BuildResult): Promise<ExecutionResult> {
    try {
      // 执行批量命令
      await buildResult.batchCommand.execute()

      // 创建成功结果
      const results: ExecutionOperationResult[] = buildResult.buildResults.map((result) => ({
        success: result.success,
        operation: result.operation,
        error: result.error,
      }))

      const successCount = results.filter((r) => r.success).length
      const errorCount = results.filter((r) => !r.success).length

      return {
        success: errorCount === 0,
        executedCount: successCount,
        errorCount,
        results,
      }
    } catch (error: any) {
      // 批量执行失败
      return {
        success: false,
        executedCount: 0,
        errorCount: buildResult.buildResults.length,
        results: buildResult.buildResults.map((result) => ({
          success: false,
          operation: result.operation,
          error: `执行失败: ${error.message}`,
        })),
        errors: [
          {
            error: `批量命令执行失败: ${error.message}`,
            type: 'execution',
          },
        ],
      }
    }
  }

  /**
   * 创建成功结果
   */
  function createSuccessResult(
    results: ExecutionOperationResult[] = [],
    message?: string,
  ): ExecutionResult {
    const executedCount = results.filter((r) => r.success).length
    const errorCount = results.filter((r) => !r.success).length

    return {
      success: errorCount === 0,
      executedCount,
      errorCount,
      results,
      errors: message && errorCount > 0 ? [{ error: message, type: 'validation' }] : undefined,
    }
  }

  /**
   * 创建验证错误结果
   */
  function createValidationErrorResult(errors: ExecutionError[]): ExecutionResult {
    return {
      success: false,
      executedCount: 0,
      errorCount: errors.length,
      results: [],
      errors,
    }
  }

  /**
   * 创建构建错误结果
   */
  function createBuildErrorResult(buildResults: BuildOperationResult[]): ExecutionResult {
    const failedResults = buildResults.filter((r) => !r.success)

    return {
      success: false,
      executedCount: 0,
      errorCount: failedResults.length,
      results: buildResults,
      errors: failedResults.map((r) => ({
        operation: r.operation,
        error: r.error || '构建失败',
        type: 'build',
      })),
    }
  }

  /**
   * 创建脚本错误结果
   */
  function createScriptErrorResult(errorMessage: string): ExecutionResult {
    return {
      success: false,
      executedCount: 0,
      errorCount: 1,
      results: [],
      errors: [
        {
          error: errorMessage,
          type: 'script',
        },
      ],
    }
  }

  /**
   * 处理执行结果 - 统一错误处理和状态返回
   *
   * 提供标准化的结果处理和日志记录
   */
  function handleExecutionResult(result: ExecutionResult): ExecutionResult {
    if (result.success) {
      console.log(`✅ 执行成功: ${result.executedCount}个操作`)
      if (result.results.length > 0) {
        console.log('📊 操作详情:')
        result.results.forEach((r, idx) => {
          console.log(`  ${idx + 1}. ${r.operation.type}: ${r.success ? '✅' : '❌'}`)
        })
      }
    } else {
      console.error(`❌ 执行失败: ${result.errorCount}个错误`)
      if (result.errors) {
        result.errors.forEach((error) => {
          const operationType = error.operation?.type || '未知操作'
          console.error(`  - ${operationType}: ${error.error}`)
        })
      }
    }

    return result
  }

  /**
   * 清理资源 - 确保所有资源被正确释放
   */
  function cleanupResources(): void {
    // ScriptExecutor在每次执行后都会自动清理
    // 这里可以添加其他需要清理的资源
  }

  /**
   * 销毁执行系统 - 释放所有资源
   */
  function destroy(): void {
    scriptExecutor.destroy()
    // 清理其他资源
  }

  // 返回组合式API接口
  return {
    // 核心函数
    executeUserScript,
    handleExecutionResult,

    // 工具函数
    destroy,
  }
}

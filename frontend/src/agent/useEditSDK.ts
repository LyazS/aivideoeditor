import { ScriptExecutor } from './ScriptExecutor'
import { useBatchCommandBuilder } from './useBatchCommandBuilder'

// 导入共享类型定义
import type {
  OperationConfig,
  BuildResult,
  OperationResult as BuildOperationResult,
  ExecutionResult,
  ExecutionOperationResult,
  ExecutionError,
  ExecutionSystemConfig
} from './types'
import type {
  UnifiedHistoryModule,
  UnifiedTimelineModule,
  UnifiedWebavModule,
  UnifiedMediaModule,
  UnifiedConfigModule,
  UnifiedTrackModule,
  UnifiedSelectionModule,
} from '@/unified/modules'


/**
 * 音视频编辑SDK组合式函数
 *
 * 提供完整的三阶段执行流程协调功能
 */
export function useEditSDK(
  unifiedHistoryModule: UnifiedHistoryModule,
  unifiedTimelineModule: UnifiedTimelineModule,
  unifiedWebavModule: UnifiedWebavModule,
  unifiedMediaModule: UnifiedMediaModule,
  unifiedConfigModule: UnifiedConfigModule,
  unifiedTrackModule: UnifiedTrackModule,
  unifiedSelectionModule: UnifiedSelectionModule,
) {
  // 创建批量命令构建器
  const batchCommandBuilder = useBatchCommandBuilder(
    unifiedHistoryModule,
    unifiedTimelineModule,
    unifiedWebavModule,
    unifiedMediaModule,
    unifiedConfigModule,
    unifiedTrackModule,
    unifiedSelectionModule,
  )

  /**
   * 执行用户脚本 - 核心执行函数
   *
   * 协调音视频编辑三阶段执行流程：
   * 1. 脚本执行（包含内置验证）→ 2. 命令构建 → 3. 批量执行
   */
  async function executeUserScript(
    userScript: string,
    timeout: number = 5000,
  ): Promise<ExecutionResult> {
    try {
      // 阶段1: 脚本执行（包含内置验证）
      const operations = await executeScriptPhase(userScript, timeout)

      if (operations.length === 0) {
        return createSuccessResult([], '未生成任何操作')
      }

      // 阶段2: 命令构建
      const buildResult = await buildCommandsPhase(operations as OperationConfig[])

      if (buildResult.buildResults.some((r) => !r.success)) {
        return createBuildErrorResult(buildResult.buildResults)
      }

      // 阶段3: 批量执行
      return await executeCommandsPhase(buildResult)
    } catch (error: any) {
      // 处理脚本执行阶段的错误
      return createScriptErrorResult(error.message)
    }
  }

  /**
   * 阶段1: 脚本执行
   *
   * 在沙箱环境中执行用户代码，生成音视频编辑操作配置
   */
  async function executeScriptPhase(
    userScript: string,
    timeout: number,
  ): Promise<OperationConfig[]> {
    try {
      // 每次执行时创建新的ScriptExecutor实例
      const scriptExecutor = new ScriptExecutor()
      try {
        return await scriptExecutor.executeScript(userScript, timeout)
      } finally {
        // 确保资源被清理
        scriptExecutor.destroy()
      }
    } catch (error: any) {
      throw new Error(`脚本执行失败: ${error.message}`)
    }
  }

  /**
   * 阶段2: 命令构建
   *
   * 将验证后的音视频操作配置转换为可执行的命令
   */
  async function buildCommandsPhase(validOperations: OperationConfig[]): Promise<BuildResult> {
    try {
      return batchCommandBuilder.buildOperations(validOperations)
    } catch (error: any) {
      throw new Error(`命令构建失败: ${error.message}`)
    }
  }

  /**
   * 阶段3: 批量执行
   *
   * 执行构建好的音视频编辑批量命令
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

  // 返回组合式API接口
  return {
    // 核心函数
    executeUserScript,
    handleExecutionResult,
  }
}

/**
 * Agent 模块 - 音视频编辑智能执行系统
 * 
 * 这个模块提供了智能的脚本执行能力，允许用户通过JavaScript代码
 * 控制音视频编辑操作，系统会安全地执行这些脚本并生成相应的操作配置。
 */

// 脚本执行器 - 核心组件
export { ScriptExecutor } from './ScriptExecutor'

// 类型定义
export type { 
  OperationConfig, 
  ExecutionAPI, 
  WebWorkerExecutor 
} from './ScriptExecutorTypes'
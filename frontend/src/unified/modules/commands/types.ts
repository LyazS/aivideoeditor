/**
 * 统一架构下的命令类型定义
 */

/**
 * 简单命令接口
 * 所有支持撤销/重做操作的命令都需要实现此接口
 */
export interface SimpleCommand {
  readonly id: string
  readonly description: string
  execute(): Promise<void>
  undo(): Promise<void>
}
/**
 * 操作结果
 * 提供详细的执行反馈信息
 */
export interface OperationResult {
  success: boolean                 // 是否成功
  data?: any                      // 返回数据
  error?: string                  // 错误信息
  affectedEntities?: string[]     // 受影响的实体ID列表
  metadata?: Record<string, any>  // 结果元数据
}

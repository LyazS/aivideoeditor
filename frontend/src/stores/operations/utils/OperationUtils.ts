/**
 * 生成唯一ID
 */
export function generateId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 操作工具函数
 */
export class OperationUtils {
  /**
   * 检查两个操作是否可以合并
   */
  static canMergeOperations(op1: any, op2: any): boolean {
    // 基本检查：类型相同且时间间隔在合理范围内
    if (op1.type !== op2.type) return false
    
    const timeDiff = Math.abs(op2.timestamp - op1.timestamp)
    const mergeTimeWindow = 1000 // 1秒内的操作可以合并
    
    return timeDiff <= mergeTimeWindow
  }

  /**
   * 深度克隆对象
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj
    if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T
    if (obj instanceof Array) return obj.map(item => OperationUtils.deepClone(item)) as unknown as T
    
    const cloned = {} as T
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = OperationUtils.deepClone(obj[key])
      }
    }
    return cloned
  }

  /**
   * 格式化操作描述
   */
  static formatOperationDescription(type: string, metadata: Record<string, any>): string {
    const typeMap: Record<string, string> = {
      'timeline.item.add': '添加时间轴项目',
      'timeline.item.remove': '删除时间轴项目',
      'timeline.item.move': '移动时间轴项目',
      'timeline.item.transform': '变换时间轴项目',
      'track.add': '添加轨道',
      'track.remove': '删除轨道',
      'composite': '复合操作'
    }

    const baseDescription = typeMap[type] || type
    
    if (metadata.itemName) {
      return `${baseDescription}: ${metadata.itemName}`
    }
    if (metadata.trackName) {
      return `${baseDescription}: ${metadata.trackName}`
    }
    if (metadata.operationCount) {
      return `${baseDescription} (${metadata.operationCount}个操作)`
    }
    
    return baseDescription
  }
}

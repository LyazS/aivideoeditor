/**
 * ID生成器工具
 * 提供统一的唯一ID生成方法
 */

/**
 * 生成唯一ID
 * 使用时间戳和随机字符串组合，确保唯一性
 * @returns 唯一ID字符串
 */
export function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 11)
}

/**
 * 生成带前缀的唯一ID
 * @param prefix ID前缀
 * @returns 带前缀的唯一ID字符串
 */
export function generateIdWithPrefix(prefix: string): string {
  return `${prefix}_${generateId()}`
}

/**
 * 生成命令ID
 * 专门用于历史记录命令的ID生成
 * @returns 命令ID字符串
 */
export function generateCommandId(): string {
  return generateIdWithPrefix('cmd')
}

/**
 * 生成UUID4格式的唯一ID
 * 使用crypto.randomUUID()或回退到自定义实现
 * @returns UUID4格式的字符串
 */
export function generateUUID4(): string {
  // 优先使用浏览器原生的crypto.randomUUID()
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // 回退到自定义UUID4实现
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * 生成轨道ID
 * 使用UUID4格式确保全局唯一性
 * @returns 轨道ID字符串
 */
export function generateTrackId(): string {
  return generateUUID4()
}

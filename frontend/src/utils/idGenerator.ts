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

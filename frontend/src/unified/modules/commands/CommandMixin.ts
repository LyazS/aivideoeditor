import type { SimpleCommand } from './types'

/**
 * 命令混入，为所有命令提供统一的资源清理功能
 */
export function CommandMixin<T extends { new (...args: any[]): SimpleCommand }>(Base: T) {
  return class extends Base {
    private _isDisposed = false
    
    /**
     * 清理命令持有的资源
     * 子类可以重写此方法来添加特定的清理逻辑
     */
    dispose(): void {
      if (this._isDisposed) {
        return
      }
      
      this._isDisposed = true
      console.log(`🗑️ [CommandMixin] 命令资源已清理: ${this.id}`)
    }
    
    /**
     * 检查命令是否已被清理
     */
    get isDisposed(): boolean {
      return this._isDisposed
    }
  }
}
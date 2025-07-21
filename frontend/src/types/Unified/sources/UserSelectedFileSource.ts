/**
 * 用户选择文件数据源
 *
 * 场景：用户通过文件选择器或拖拽选择的本地文件
 * 特点：有活跃的File对象，需要验证有效性
 */

import { BaseDataSource } from './BaseDataSource'
import type { DataSourceManager } from '../UnifiedManagers'

/**
 * 用户选择文件数据源
 *
 * 场景：用户通过文件选择器或拖拽选择的本地文件
 * 特点：有活跃的File对象，需要验证有效性
 */
export class UserSelectedFileSource extends BaseDataSource {
  constructor(
    private selectedFile: File,
    onUpdate?: (source: UserSelectedFileSource) => void,
  ) {
    super('user-selected', onUpdate)
  }

  /**
   * 获取用户选择的文件对象
   */
  getSelectedFile(): File {
    return this.selectedFile
  }

  protected getManager(): DataSourceManager<UserSelectedFileSource> {
    // 这里应该返回UserSelectedFileManager的单例实例
    // 实际实现时需要导入对应的管理器
    throw new Error('UserSelectedFileManager not implemented yet')
  }

  protected executeAcquisition(): void {
    this.getManager().startAcquisition(this, this.taskId!)
  }
}

// ==================== 类型守卫函数 ====================

/**
 * 判断是否为用户选择文件数据源
 */
export function isUserSelectedSource(source: any): source is UserSelectedFileSource {
  return source?.getType?.() === 'user-selected'
}

// ==================== 工厂函数 ====================

/**
 * 创建用户选择文件数据源
 */
export function createUserSelectedFileSource(
  file: File,
  onUpdate?: (source: UserSelectedFileSource) => void,
): UserSelectedFileSource {
  return new UserSelectedFileSource(file, onUpdate)
}

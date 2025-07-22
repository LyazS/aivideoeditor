/**
 * 用户选择文件数据源
 *
 * 场景：用户通过文件选择器或拖拽选择的本地文件
 * 特点：有活跃的File对象，需要验证有效性
 */

import { BaseDataSource } from './BaseDataSource'
import { UserSelectedFileManager } from '../managers/UserSelectedFileManager'

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

  protected getManager(): UserSelectedFileManager {
    return UserSelectedFileManager.getInstance()
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

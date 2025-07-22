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
    console.log(`📁 [UNIFIED-MEDIA] UserSelectedFileSource 构造: ${selectedFile.name}`)
    super('user-selected', onUpdate)
    console.log(`📁 [UNIFIED-MEDIA] UserSelectedFileSource 构造完成: ${selectedFile.name}`)
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
    console.log(`🚀 [UNIFIED-MEDIA] UserSelectedFileSource 开始执行获取: ${this.selectedFile.name} (任务ID: ${this.taskId})`)
    this.getManager().startAcquisition(this, this.taskId!)
    console.log(`🚀 [UNIFIED-MEDIA] UserSelectedFileSource 已提交给管理器: ${this.selectedFile.name}`)
  }
}

// ==================== 类型守卫函数 ====================

/**
 * 判断是否为用户选择文件数据源
 */
export function isUserSelectedSource(source: any): source is UserSelectedFileSource {
  return source?.getType?.() === 'user-selected'
}

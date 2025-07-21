/**
 * 工程文件数据源
 *
 * 场景：从工程配置中加载的文件路径
 * 特点：只有路径信息，需要重新定位文件，可能出现文件缺失
 */

import { BaseDataSource } from './BaseDataSource'
import type { DataSourceManager } from '../UnifiedManagers'

/**
 * 工程文件信息接口
 */
export interface ProjectFileInfo {
  filePath: string // 文件路径
  fileName: string // 文件名
  fileSize?: number // 文件大小（可选）
  lastModified?: number // 最后修改时间（可选）
}

/**
 * 工程文件数据源
 *
 * 场景：从工程配置中加载的文件路径
 * 特点：只有路径信息，需要重新定位文件，可能出现文件缺失
 */
export class ProjectFileSource extends BaseDataSource {
  constructor(
    private fileInfo: ProjectFileInfo,
    onUpdate?: (source: ProjectFileSource) => void,
  ) {
    super('project-file', onUpdate)
  }

  /**
   * 获取文件信息
   */
  getFileInfo(): ProjectFileInfo {
    return this.fileInfo
  }

  protected getManager(): DataSourceManager<ProjectFileSource> {
    // 这里应该返回ProjectFileManager的单例实例
    throw new Error('ProjectFileManager not implemented yet')
  }

  protected executeAcquisition(): void {
    this.getManager().startAcquisition(this, this.taskId!)
  }

  // ==================== 工程文件特有方法 ====================

  /**
   * 设置文件缺失状态
   */
  setMissing(message: string): void {
    super.setMissing(message)
  }

  /**
   * 重新定位文件
   */
  relocateFile(newFile: File): void {
    this.setAcquired(newFile, URL.createObjectURL(newFile))
  }

  /**
   * 更新文件信息
   */
  updateFileInfo(newFileInfo: Partial<ProjectFileInfo>): void {
    this.fileInfo = { ...this.fileInfo, ...newFileInfo }
  }
}

// ==================== 类型守卫函数 ====================

/**
 * 判断是否为工程文件数据源
 */
export function isProjectFileSource(source: any): source is ProjectFileSource {
  return source?.getType?.() === 'project-file'
}

// ==================== 工厂函数 ====================

/**
 * 创建工程文件数据源
 */
export function createProjectFileSource(
  fileInfo: ProjectFileInfo,
  onUpdate?: (source: ProjectFileSource) => void,
): ProjectFileSource {
  return new ProjectFileSource(fileInfo, onUpdate)
}

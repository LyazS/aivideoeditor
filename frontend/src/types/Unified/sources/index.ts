/**
 * 数据源类型统一导出文件
 *
 * 这个文件统一导入和导出所有数据源类型，提供一个集中的访问点
 */

// ==================== 导入所有数据源类型 ====================

// 用户选择文件数据源
export {
  UserSelectedFileSource,
  isUserSelectedSource,
  createUserSelectedFileSource,
} from './UserSelectedFileSource.ts'

// 工程文件数据源
export {
  ProjectFileSource,
  isProjectFileSource,
  createProjectFileSource,
} from './ProjectFileSource.ts'
export type { ProjectFileInfo } from './ProjectFileSource.ts'
// 远程文件数据源
export { RemoteFileSource, isRemoteSource, createRemoteFileSource } from './RemoteFileSource.ts'
export type { RemoteFileConfig, DownloadStats } from './RemoteFileSource.ts'

// ==================== 联合类型定义 ====================

import type { UserSelectedFileSource } from './UserSelectedFileSource.ts'
import type { ProjectFileSource } from './ProjectFileSource.ts'
import type { RemoteFileSource } from './RemoteFileSource.ts'

/**
 * 数据源联合类型 - 统一的数据源接口
 * 这是媒体项目中 source 字段的类型定义
 *
 * 设计说明：
 * - 所有数据源都继承自 BaseDataSource，确保接口一致性
 * - 使用联合类型而非接口，提供更好的类型推断
 * - 通过 getType() 方法进行类型区分和类型守卫
 */
export type UnifiedDataSource = UserSelectedFileSource | ProjectFileSource | RemoteFileSource

// ==================== 通用类型守卫函数 ====================

/**
 * 通用数据源类型守卫 - 检查对象是否为有效的数据源
 */
export function isUnifiedDataSource(obj: any): obj is UnifiedDataSource {
  return obj && obj.__type__ === 'UnifiedDataSource'
}

/**
 * 根据类型字符串判断数据源类型
 */
export function getDataSourceType(
  source: UnifiedDataSource,
): 'user-selected' | 'project-file' | 'remote' {
  return source.getType() as 'user-selected' | 'project-file' | 'remote'
}

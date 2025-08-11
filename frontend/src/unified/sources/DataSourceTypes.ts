/**
 * 统一数据源类型定义
 * 提供联合类型、工厂函数和类型查询的核心功能
 */

import type { UserSelectedFileSourceData } from './UserSelectedFileSource'
import type { RemoteFileSourceData } from './RemoteFileSource'
import { UserSelectedFileSourceFactory } from './UserSelectedFileSource'
import { RemoteFileSourceFactory } from './RemoteFileSource'
import { UserSelectedFileTypeGuards } from './UserSelectedFileSource'
import { RemoteFileTypeGuards } from './RemoteFileSource'
import { DataSourceQueries as BaseDataSourceQueries } from './BaseDataSource'
import type { RemoteFileConfig } from './RemoteFileSource'

// ==================== 联合类型定义 ====================

/**
 * 统一数据源联合类型
 */
export type UnifiedDataSourceData = UserSelectedFileSourceData | RemoteFileSourceData

// ==================== 统一工厂函数 ====================

/**
 * 统一数据源工厂函数
 */
export const DataSourceFactory = {
  createUserSelectedSource(file: File): UserSelectedFileSourceData {
    return UserSelectedFileSourceFactory.createUserSelectedSource(file)
  },

  createRemoteSource(remoteUrl: string, config: RemoteFileConfig = {}): RemoteFileSourceData {
    return RemoteFileSourceFactory.createRemoteSource(remoteUrl, config)
  },
}

// ==================== 统一查询函数 ====================

/**
 * 扩展的数据源查询函数
 * 包含基础查询和类型特定查询
 */
export const DataSourceQueries = {
  // 继承基础查询函数
  ...BaseDataSourceQueries,

  // 类型查询 - 直接使用具体类型守卫，避免额外封装层
  isUserSelectedSource(source: UnifiedDataSourceData): source is UserSelectedFileSourceData {
    return UserSelectedFileTypeGuards.isUserSelectedSource(source)
  },

  isRemoteSource(source: UnifiedDataSourceData): source is RemoteFileSourceData {
    return RemoteFileTypeGuards.isRemoteSource(source)
  },
}

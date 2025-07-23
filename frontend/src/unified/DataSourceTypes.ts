/**
 * 统一数据源类型定义
 * 将所有具体数据源类型组合成联合类型
 */

import type { UserSelectedFileSourceData } from './UserSelectedFileSource'
import type { RemoteFileSourceData } from './RemoteFileSource'

// ==================== 联合类型定义 ====================

/**
 * 统一数据源联合类型
 */
export type UnifiedDataSourceData =
  | UserSelectedFileSourceData
  | RemoteFileSourceData

// ==================== 统一工厂函数 ====================

import { UserSelectedFileSourceFactory } from './UserSelectedFileSource'
import { RemoteFileSourceFactory } from './RemoteFileSource'
import type { RemoteFileConfig } from './RemoteFileSource'

/**
 * 统一数据源工厂函数
 */
export const DataSourceFactory = {
  createUserSelectedSource(file: File): UserSelectedFileSourceData {
    return UserSelectedFileSourceFactory.createUserSelectedSource(file)
  },

  createRemoteSource(
    remoteUrl: string,
    config: RemoteFileConfig = {}
  ): RemoteFileSourceData {
    return RemoteFileSourceFactory.createRemoteSource(remoteUrl, config)
  }
}

// ==================== 统一类型守卫 ====================

import { UserSelectedFileTypeGuards } from './UserSelectedFileSource'
import { RemoteFileTypeGuards } from './RemoteFileSource'

/**
 * 统一数据源类型守卫
 */
export const DataSourceTypeGuards = {
  isUserSelectedSource(source: UnifiedDataSourceData): source is UserSelectedFileSourceData {
    return UserSelectedFileTypeGuards.isUserSelectedSource(source)
  },

  isRemoteSource(source: UnifiedDataSourceData): source is RemoteFileSourceData {
    return RemoteFileTypeGuards.isRemoteSource(source)
  }
}

// ==================== 扩展基础查询函数 ====================

import { DataSourceQueries as BaseDataSourceQueries } from './BaseDataSource'

/**
 * 扩展的数据源查询函数
 */
export const DataSourceQueries = {
  // 继承基础查询函数
  ...BaseDataSourceQueries,

  // 类型查询
  isUserSelectedSource(source: UnifiedDataSourceData): source is UserSelectedFileSourceData {
    return DataSourceTypeGuards.isUserSelectedSource(source)
  },

  isRemoteSource(source: UnifiedDataSourceData): source is RemoteFileSourceData {
    return DataSourceTypeGuards.isRemoteSource(source)
  }
}

// ==================== 重新导出所有类型 ====================

// 基础类型
export type { BaseDataSourceData, DataSourceStatus } from './BaseDataSource'

// 具体类型
export type { UserSelectedFileSourceData } from './UserSelectedFileSource'
export type { RemoteFileSourceData, RemoteFileConfig, DownloadStats } from './RemoteFileSource'

// 常量
export { DATA_SOURCE_TO_MEDIA_STATUS_MAP } from './BaseDataSource'

// 行为函数
export { UnifiedDataSourceActions } from './BaseDataSource'

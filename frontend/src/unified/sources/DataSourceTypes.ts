/**
 * 统一数据源类型定义
 * 提供联合类型、工厂函数和类型查询的核心功能
 */

import type { UserSelectedFileSourceData, BaseUserSelectedFileSourceData } from '@/unified/sources/UserSelectedFileSource'
import type { RemoteFileSourceData, BaseRemoteFileSourceData } from '@/unified/sources/RemoteFileSource'
import { UserSelectedFileSourceFactory } from '@/unified/sources/UserSelectedFileSource'
import { RemoteFileSourceFactory } from '@/unified/sources/RemoteFileSource'
import { UserSelectedFileTypeGuards } from '@/unified/sources/UserSelectedFileSource'
import { RemoteFileTypeGuards } from '@/unified/sources/RemoteFileSource'
import { RuntimeStateQueries as BaseDataSourceQueries } from '@/unified/sources/BaseDataSource'
import { extractUserSelectedFileSourceData } from '@/unified/sources/UserSelectedFileSource'
import { extractRemoteFileSourceData } from '@/unified/sources/RemoteFileSource'

// ==================== 联合类型定义 ====================

/**
 * 统一数据源联合类型
 */
export type UnifiedDataSourceData = UserSelectedFileSourceData | RemoteFileSourceData

/**
 * 数据源基类型联合类型 - 用于持久化
 */
export type BaseDataSourcePersistedData =
  | BaseUserSelectedFileSourceData
  | BaseRemoteFileSourceData

// ==================== 统一工厂函数 ====================

/**
 * 统一数据源工厂函数
 */
export const DataSourceFactory = {
  // 统一创建方法，支持文件或媒体引用ID
  createUserSelectedSource(param: File | BaseUserSelectedFileSourceData): UserSelectedFileSourceData {
    return UserSelectedFileSourceFactory.createUserSelectedSource(param)
  },

  createRemoteSource(param: BaseRemoteFileSourceData): RemoteFileSourceData {
    return RemoteFileSourceFactory.createRemoteSource(param)
  },
}

// ==================== 数据源提取函数 ====================

/**
 * 根据数据源类型提取持久化数据
 */
export function extractSourceData(source: UnifiedDataSourceData): BaseDataSourcePersistedData {
  if (DataSourceQueries.isUserSelectedSource(source)) {
    return extractUserSelectedFileSourceData(source)
  } else if (DataSourceQueries.isRemoteSource(source)) {
    return extractRemoteFileSourceData(source)
  } else {
    console.warn('未知的数据源类型:', source)
    throw new Error('未知的数据源类型')
  }
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

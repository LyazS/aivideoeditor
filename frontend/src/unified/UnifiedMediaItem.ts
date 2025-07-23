/**
 * 统一媒体项目类型定义
 * 基于"核心数据与行为分离"的响应式重构方案
 */

import { reactive } from 'vue'
import type { Raw } from 'vue'
import type { MP4Clip, ImgClip, AudioClip } from '@webav/av-cliper'
import type { UnifiedDataSourceData } from './sources/DataSourceTypes'

// ==================== 类型定义 ====================

/**
 * 媒体状态枚举
 */
export type MediaStatus =
  | 'pending'         // 等待开始处理
  | 'asyncprocessing' // 异步获取中（抽象状态，对应各种数据源的获取阶段）
  | 'webavdecoding'   // WebAV解析中
  | 'ready'           // 就绪
  | 'error'           // 错误
  | 'cancelled'       // 取消
  | 'missing'         // 缺失（加载工程时本地文件不存在）

/**
 * 核心媒体类型 - 支持视频、图片、音频和文本
 */
export type MediaType = 'video' | 'image' | 'audio' | 'text'

/**
 * WebAV对象接口
 */
export interface WebAVObjects {
  mp4Clip?: Raw<MP4Clip>
  imgClip?: Raw<ImgClip>
  audioClip?: Raw<AudioClip>
  thumbnailUrl?: string
  // WebAV解析得到的原始尺寸信息
  originalWidth?: number  // 原始宽度（视频和图片）
  originalHeight?: number // 原始高度（视频和图片）
}

/**
 * 统一的媒体项目数据接口 - 纯响应式状态对象
 */
export interface UnifiedMediaItemData {
  // ==================== 核心属性 ====================
  readonly id: string
  name: string
  createdAt: string

  // ==================== 状态信息 ====================
  mediaStatus: MediaStatus
  mediaType: MediaType | 'unknown'

  // ==================== 数据源（包含获取状态） ====================
  source: UnifiedDataSourceData // 使用统一的响应式数据源

  // ==================== WebAV对象（状态相关） ====================
  webav?: WebAVObjects

  // ==================== 元数据（状态相关） ====================
  duration?: number // 媒体时长（帧数），可能在不同阶段获得：服务器提供、用户输入、WebAV解析等
}

// ==================== 工厂函数 ====================

/**
 * 工厂函数 - 创建响应式媒体项目数据
 */
export function createUnifiedMediaItemData(
  id: string,
  name: string,
  source: UnifiedDataSourceData,
  options?: Partial<UnifiedMediaItemData>
): UnifiedMediaItemData {
  return reactive({
    id,
    name,
    createdAt: new Date().toISOString(),
    mediaStatus: 'pending' as MediaStatus,
    mediaType: 'unknown' as MediaType | 'unknown',
    source,
    ...options
  })
}

// ==================== 查询函数模块 ====================

/**
 * 统一媒体项目查询函数 - 无状态查询函数
 */
export const UnifiedMediaItemQueries = {
  // 状态检查
  isPending(item: UnifiedMediaItemData): boolean {
    return item.mediaStatus === 'pending'
  },

  isReady(item: UnifiedMediaItemData): boolean {
    return item.mediaStatus === 'ready'
  },

  isProcessing(item: UnifiedMediaItemData): boolean {
    return item.mediaStatus === 'asyncprocessing' ||
           item.mediaStatus === 'webavdecoding'
  },

  hasError(item: UnifiedMediaItemData): boolean {
    return item.mediaStatus === 'error'
  },

  hasAnyError(item: UnifiedMediaItemData): boolean {
    return item.mediaStatus === 'error' ||
           item.mediaStatus === 'cancelled' ||
           item.mediaStatus === 'missing'
  },

  isParsing(item: UnifiedMediaItemData): boolean {
    return UnifiedMediaItemQueries.isPending(item) ||
           UnifiedMediaItemQueries.isProcessing(item)
  },

  // 状态转换验证
  canTransitionTo(item: UnifiedMediaItemData, newStatus: MediaStatus): boolean {
    const validTransitions: Record<MediaStatus, MediaStatus[]> = {
      pending: ['asyncprocessing', 'error', 'cancelled'],
      asyncprocessing: ['webavdecoding', 'error', 'cancelled'],
      webavdecoding: ['ready', 'error', 'cancelled'],
      ready: ['error'],
      error: ['pending', 'cancelled'],
      cancelled: ['pending'],
      missing: ['pending', 'cancelled'],
    }

    return validTransitions[item.mediaStatus]?.includes(newStatus) || false
  },

  // 获取进度信息
  getProgress(item: UnifiedMediaItemData): number {
    if (item.mediaStatus === 'asyncprocessing') {
      return item.source.progress / 100 // 转换为 0-1 范围
    }
    if (item.mediaStatus === 'ready') {
      return 1
    }
    return 0
  },

  // 获取错误信息
  getError(item: UnifiedMediaItemData): string | undefined {
    return item.source.errorMessage
  },

  // 获取时长
  getDuration(item: UnifiedMediaItemData): number | undefined {
    return item.duration
  },

  // 获取URL
  getUrl(item: UnifiedMediaItemData): string | null {
    return item.source.url
  },

  // 获取原始尺寸
  getOriginalSize(item: UnifiedMediaItemData): { width: number; height: number } | undefined {
    if (item.webav?.originalWidth && item.webav?.originalHeight) {
      return {
        width: item.webav.originalWidth,
        height: item.webav.originalHeight
      }
    }
    return undefined
  }
}

// ==================== 行为函数模块 ====================

/**
 * 统一媒体项目行为函数 - 无状态操作函数
 */
export const UnifiedMediaItemActions = {
  // 状态转换
  transitionTo(
    item: UnifiedMediaItemData,
    newStatus: MediaStatus,
    context?: any
  ): boolean {
    if (!UnifiedMediaItemQueries.canTransitionTo(item, newStatus)) {
      console.warn(`无效状态转换: ${item.mediaStatus} → ${newStatus}`)
      return false
    }

    const oldStatus = item.mediaStatus
    item.mediaStatus = newStatus

    console.log(`媒体项目状态转换: ${item.name} ${oldStatus} → ${newStatus}`)

    return true
  },

  // 设置WebAV对象
  setWebAVObjects(item: UnifiedMediaItemData, webav: WebAVObjects): void {
    item.webav = webav
  },

  // 设置时长
  setDuration(item: UnifiedMediaItemData, duration: number): void {
    item.duration = duration
  },

  // 设置媒体类型
  setMediaType(item: UnifiedMediaItemData, mediaType: MediaType): void {
    item.mediaType = mediaType
  },

  // 更新名称
  updateName(item: UnifiedMediaItemData, newName: string): void {
    if (newName.trim()) {
      item.name = newName.trim()
      console.log(`媒体项目名称已更新: ${item.id} -> ${newName}`)
    }
  },

  // 重试
  retry(item: UnifiedMediaItemData): void {
    if (UnifiedMediaItemQueries.hasAnyError(item)) {
      UnifiedMediaItemActions.transitionTo(item, 'pending')
      // 重置数据源状态
      if (item.source.status === 'error' || item.source.status === 'cancelled') {
        item.source.status = 'pending'
        item.source.progress = 0
        item.source.errorMessage = undefined
      }
    }
  },

  // 取消
  cancel(item: UnifiedMediaItemData): void {
    if (UnifiedMediaItemQueries.isProcessing(item)) {
      UnifiedMediaItemActions.transitionTo(item, 'cancelled')
      // 取消数据源获取
      if (item.source.status === 'acquiring') {
        item.source.status = 'cancelled'
      }
    }
  }
}

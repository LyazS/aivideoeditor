/**
 * 统一媒体项目数据结构定义
 * 基于"核心数据与行为分离"的响应式重构方案
 */

import { reactive } from 'vue'
import type { Raw } from 'vue'
import type { MP4Clip, ImgClip, AudioClip } from '@webav/av-cliper'
import type { UnifiedDataSourceData } from '../sources/DataSourceTypes'

// ==================== 类型定义 ====================

/**
 * 媒体状态枚举
 */
export type MediaStatus =
  | 'pending' // 等待开始处理
  | 'asyncprocessing' // 异步获取中（抽象状态，对应各种数据源的获取阶段）
  | 'webavdecoding' // WebAV解析中
  | 'ready' // 就绪
  | 'error' // 错误
  | 'cancelled' // 取消
  | 'missing' // 缺失（加载工程时本地文件不存在）

/**
 * 核心媒体类型 - 支持视频、图片、音频和文本
 */
export type MediaType = 'video' | 'image' | 'audio' | 'text'

/**
 * 异步处理素材在处理前使用 'unknown' 类型，处理后使用实际检测到的类型
 */
export type MediaTypeOrUnknown = MediaType | 'unknown'

/**
 * WebAV对象接口
 */
export interface WebAVObjects {
  mp4Clip?: Raw<MP4Clip>
  imgClip?: Raw<ImgClip>
  audioClip?: Raw<AudioClip>
  thumbnailUrl?: string
  // WebAV解析得到的原始尺寸信息
  originalWidth?: number // 原始宽度（视频和图片）
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

// ==================== 专门的状态类型定义 ====================

/**
 * 就绪状态的媒体项目类型
 * 当媒体项目处于 ready 状态时，保证 mediaStatus 为 'ready' 且 duration 不为空
 */
export type ReadyMediaItem = UnifiedMediaItemData & {
  mediaStatus: 'ready'
  duration: number
}

/**
 * 处理中状态的媒体项目类型
 * 当媒体项目处于处理中状态时，保证 mediaStatus 为处理中的状态之一
 */
export type ProcessingMediaItem = UnifiedMediaItemData & {
  mediaStatus: 'asyncprocessing' | 'webavdecoding'
}

/**
 * 错误状态的媒体项目类型
 * 当媒体项目处于错误状态时，保证 mediaStatus 为错误状态之一
 */
export type ErrorMediaItem = UnifiedMediaItemData & {
  mediaStatus: 'error' | 'cancelled' | 'missing'
}

/**
 * 等待状态的媒体项目类型
 * 当媒体项目处于等待状态时，保证 mediaStatus 为 'pending'
 */
export type PendingMediaItem = UnifiedMediaItemData & {
  mediaStatus: 'pending'
}

// ==================== 媒体类型专门状态定义 ====================

/**
 * 视频媒体项目类型
 * 当媒体项目为视频类型时，保证 mediaType 为 'video'
 */
export type VideoMediaItem = UnifiedMediaItemData & {
  mediaType: 'video'
}

/**
 * 图片媒体项目类型
 * 当媒体项目为图片类型时，保证 mediaType 为 'image'
 */
export type ImageMediaItem = UnifiedMediaItemData & {
  mediaType: 'image'
}

/**
 * 音频媒体项目类型
 * 当媒体项目为音频类型时，保证 mediaType 为 'audio'
 */
export type AudioMediaItem = UnifiedMediaItemData & {
  mediaType: 'audio'
}

/**
 * 文本媒体项目类型
 * 当媒体项目为文本类型时，保证 mediaType 为 'text'
 */
export type TextMediaItem = UnifiedMediaItemData & {
  mediaType: 'text'
}

/**
 * 未知类型媒体项目类型
 * 当媒体项目类型未确定时，保证 mediaType 为 'unknown'
 */
export type UnknownMediaItem = UnifiedMediaItemData & {
  mediaType: 'unknown'
}

/**
 * 已知类型媒体项目类型
 * 当媒体项目类型已确定时，保证 mediaType 为具体的媒体类型
 */
export type KnownMediaItem = UnifiedMediaItemData & {
  mediaType: MediaType
}

/**
 * 视觉媒体项目类型（视频或图片）
 * 当媒体项目为视觉类型时，保证 mediaType 为 'video' 或 'image'
 */
export type VisualMediaItem = UnifiedMediaItemData & {
  mediaType: 'video' | 'image'
}

/**
 * 音频媒体项目类型（音频或视频）
 * 当媒体项目包含音频时，保证 mediaType 为 'audio' 或 'video'
 */
export type AudioCapableMediaItem = UnifiedMediaItemData & {
  mediaType: 'audio' | 'video'
}

// ==================== 工厂函数 ====================

/**
 * 工厂函数 - 创建响应式媒体项目数据
 */
export function createUnifiedMediaItemData(
  id: string,
  name: string,
  source: UnifiedDataSourceData,
  options?: Partial<UnifiedMediaItemData>,
): UnifiedMediaItemData {
  return reactive({
    id,
    name,
    createdAt: new Date().toISOString(),
    mediaStatus: 'pending' as MediaStatus,
    mediaType: 'unknown' as MediaType | 'unknown',
    source,
    ...options,
  })
}

/**
 * 统一媒体项目类型设计
 *
 * 基于统一异步源架构，将LocalMediaItem和AsyncProcessingMediaItem
 * 统一为单一的UnifiedMediaItem，采用状态机模式管理媒体处理流程
 */

import type { Raw } from 'vue'
import type { MP4Clip, ImgClip, AudioClip } from '@webav/av-cliper'
import type { UnifiedDataSource } from './sources'
import type { MediaTransitionContext } from './index'
import type { MediaStatus } from './index'

// ==================== 基础类型定义 ====================

/**
 * 核心媒体类型 - 支持视频、图片、音频和文本
 */
export type MediaType = 'video' | 'image' | 'audio' | 'text'

// ==================== WebAV对象接口 ====================

/**
 * WebAV解析结果接口
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

// ==================== 统一媒体项目接口 ====================

/**
 * 统一的媒体项目接口 - 采用状态机模式
 *
 * 核心理念：统一异步源 (Unified Async Source)
 * 所有媒体项目都是异步源，无论是本地文件、远程文件还是工程文件，
 * 都通过统一的异步状态机进行处理，差异仅体现在处理速度上
 */
export interface UnifiedMediaItem {
  // ==================== 类型标识 ====================
  readonly __type__: 'UnifiedMediaItem'

  // ==================== 核心属性 ====================
  id: string
  name: string
  createdAt: string
  mediaType: MediaType | 'unknown'
  mediaStatus: MediaStatus // 独立状态字段，不是计算属性

  // ==================== 数据源（包含获取状态） ====================
  source: UnifiedDataSource // 使用统一的数据源联合类型

  // ==================== WebAV对象（状态相关） ====================
  webav?: WebAVObjects

  // ==================== 元数据（状态相关） ====================
  duration?: number // 媒体时长（帧数），可能在不同阶段获得

  // ==================== 状态机方法 ====================

  /**
   * 状态转换方法 - 由数据源管理器调用
   * @param newStatus 目标状态
   * @param context 转换上下文（可选）- 用于传递状态转换的附加信息
   */
  transitionTo(newStatus: MediaStatus, context?: MediaTransitionContext): void

  /**
   * 检查是否可以转换到指定状态
   * @param newStatus 目标状态
   */
  canTransitionTo(newStatus: MediaStatus): boolean

  /**
   * 状态转换钩子 - 用于副作用处理
   * @param oldStatus 原状态
   * @param newStatus 新状态
   * @param context 转换上下文 - 包含状态转换的详细信息
   */
  onStatusChanged?(
    oldStatus: MediaStatus,
    newStatus: MediaStatus,
    context?: MediaTransitionContext,
  ): void

  // ==================== 用户控制方法 ====================

  /**
   * 取消处理
   * 如果正在异步获取中，则取消获取任务
   */
  cancel(): void

  /**
   * 重试处理
   * 仅在错误状态下可用，重新开始处理流程
   */
  retry(): void

  // ==================== 只读查询方法 ====================

  /**
   * 获取文件URL（如果可用）
   */
  getUrl(): string | undefined

  /**
   * 获取媒体时长（如果已解析）
   */
  getDuration(): number | undefined

  /**
   * 获取处理进度（0-1）
   */
  getProgress(): number | undefined

  /**
   * 获取原始宽度（视频和图片）
   */
  getOriginalWidth(): number | undefined

  /**
   * 获取原始高度（视频和图片）
   */
  getOriginalHeight(): number | undefined

  /**
   * 获取原始尺寸对象
   */
  getOriginalSize(): { width: number; height: number } | undefined

  // ==================== 状态查询方法 ====================

  /**
   * 是否已就绪
   */
  isReady(): boolean

  /**
   * 是否正在处理中
   */
  isProcessing(): boolean

  /**
   * 是否有错误
   */
  hasError(): boolean

  /**
   * 获取错误信息（如果有）
   */
  getError(): string | undefined

  /**
   * 是否有尺寸信息
   */
  hasSize(): boolean
}

/**
 * 统一时间轴项目核心接口类型定义
 * 基于重构文档：10-统一时间轴项目设计-类型设计.md
 * 
 * 核心设计理念：
 * - 状态驱动的统一架构：将"本地"和"异步"从类型区分改为状态区分
 * - 3状态简化方案：ready | loading | error
 * - 状态上下文承载细节：StatusContext承载当前状态的详细信息
 */

import type { Raw } from 'vue'
import type { MediaType } from '../UnifiedMediaItem'
import type { CustomSprite } from '../../types'

// 重新导出 MediaType 以便其他模块使用
export type { MediaType }

// ==================== 核心状态定义 ====================

/**
 * 统一时间轴项目状态 - 基于实际业务场景的三元模型
 */
export type TimelineItemStatus = 
  | 'ready'    // 完全就绪，可用于时间轴
  | 'loading'  // 正在处理中，包含下载、解析、等待
  | 'error'    // 不可用状态，包含错误、缺失、取消

// ==================== 状态上下文设计 ====================

/**
 * 基础 Context 接口
 */
interface BaseTimelineStatusContext {
  stage: string
  message: string
  timestamp?: number
}

/**
 * 进度相关的扩展接口
 */
export interface ProgressExtension {
  progress: {
    percent: number        // 0-100
    detail?: string       // 额外描述
  }
}

/**
 * 错误相关的扩展接口
 */
interface ErrorExtension {
  error: {
    code: string
    message: string
    recoverable: boolean
  }
}

// ==================== 具体的 Context 类型定义 ====================

/**
 * 下载上下文
 */
export interface DownloadContext extends BaseTimelineStatusContext, ProgressExtension {
  stage: 'downloading'
  downloadSpeed?: string
  downloadedBytes?: number
  totalBytes?: number
}

/**
 * 解析上下文
 */
export interface ParseContext extends BaseTimelineStatusContext, ProgressExtension {
  stage: 'parsing'
  currentStep?: string     // '解析视频轨道' | '解析音频轨道' 等
  totalSteps?: number
}

/**
 * 处理上下文
 */
export interface ProcessingContext extends BaseTimelineStatusContext, ProgressExtension {
  stage: 'processing'
  operation?: string       // 'thumbnail' | 'compress' | 'convert' 等
}

/**
 * 就绪上下文
 */
export interface ReadyContext extends BaseTimelineStatusContext {
  stage: 'ready'
  metadata?: {
    duration?: number
    resolution?: string
    format?: string
  }
}

/**
 * 错误上下文
 */
export interface ErrorContext extends BaseTimelineStatusContext, ErrorExtension {
  stage: 'error'
}

/**
 * 统一的状态上下文联合类型 - 动态状态信息
 *
 * 职责：描述时间轴项目当前的运行状态和进度信息
 * 特点：频繁变化，主要用于UI展示和状态管理，通常不持久化
 *
 * 与 BasicTimelineConfig 的区别：
 * - BasicTimelineConfig：静态配置，"这个项目是什么"
 * - TimelineStatusContext：动态状态，"这个项目现在怎么样"
 */
export type TimelineStatusContext =
  | DownloadContext
  | ParseContext
  | ProcessingContext
  | ReadyContext
  | ErrorContext

// ==================== 媒体配置类型 ====================

/**
 * 基础媒体属性
 */
interface BaseMediaProps<T extends MediaType> {
  mediaType: T
}

/**
 * 视觉媒体属性（视频、图片、文本共用）
 */
interface VisualMediaProps<T extends MediaType> extends BaseMediaProps<T> {
  /** 位置和尺寸 */
  x: number
  y: number
  width: number
  height: number
  /** 旋转角度（度） */
  rotation: number
  /** 透明度 0-1 */
  opacity: number
  /** 层级 */
  zIndex: number
}

/**
 * 音频媒体属性
 */
interface AudioMediaProps {
  /** 音量 0-1 */
  volume: number
  /** 是否静音 */
  isMuted: boolean
}

/**
 * 文本样式配置
 */
export interface TextStyleConfig {
  fontSize: number
  fontFamily: string
  fontWeight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'
  fontStyle: 'normal' | 'italic'
  color: string
  textAlign: 'left' | 'center' | 'right'
  lineHeight: number
}

/**
 * 视频媒体配置：继承视觉媒体属性，添加音频属性
 */
export interface VideoMediaConfig extends VisualMediaProps<'video'>, AudioMediaProps {
  /** 播放速度倍率 */
  playbackRate: number
  /** 缩略图URL */
  thumbnailUrl?: string
}

/**
 * 图片媒体配置：只有视觉属性
 */
export interface ImageMediaConfig extends VisualMediaProps<'image'> {
  /** 缩略图URL（可能是压缩版本） */
  thumbnailUrl?: string
}

/**
 * 音频媒体配置：只有音频属性
 */
export interface AudioMediaConfig extends BaseMediaProps<'audio'>, AudioMediaProps {
  /** 增益（dB） */
  gain: number
}

/**
 * 文本媒体配置：继承视觉媒体属性，添加文本特有属性
 */
export interface TextMediaConfig extends VisualMediaProps<'text'> {
  /** 文本内容 */
  text: string
  /** 文本样式配置 */
  style: TextStyleConfig
}

/**
 * 媒体配置映射
 */
type MediaConfigMap = {
  video: VideoMediaConfig
  image: ImageMediaConfig
  audio: AudioMediaConfig
  text: TextMediaConfig
}

/**
 * 根据媒体类型获取对应配置的工具类型
 */
export type GetMediaConfig<T extends MediaType> = MediaConfigMap[T]

// ==================== 动画配置类型 ====================

/**
 * 关键帧属性映射
 */
type KeyframePropertiesMap = {
  video: Omit<VideoMediaConfig, 'mediaType' | 'thumbnailUrl'>
  image: Omit<ImageMediaConfig, 'mediaType' | 'thumbnailUrl'>
  audio: Omit<AudioMediaConfig, 'mediaType'>
  text: Omit<TextMediaConfig, 'mediaType'>
}

/**
 * 根据媒体类型获取关键帧属性的工具类型
 */
export type GetKeyframeProperties<T extends MediaType> = KeyframePropertiesMap[T]

/**
 * 关键帧接口
 */
export interface Keyframe<T extends MediaType = MediaType> {
  /** 关键帧位置（相对于clip开始的帧数） */
  framePosition: number
  /** 包含所有可动画属性的完整状态 */
  properties: GetKeyframeProperties<T>
}

/**
 * 动画配置接口
 */
export interface AnimationConfig<T extends MediaType = MediaType> {
  /** 关键帧数组 */
  keyframes: Keyframe<T>[]
  /** 是否启用动画 */
  isEnabled: boolean
  /** 缓动函数（预留） */
  easing?: string
}

// ==================== 统一基础配置 ====================

/**
 * 统一的基础配置 - 静态配置信息
 *
 * 职责：定义时间轴项目的基本属性和媒体参数
 * 特点：创建时设置，很少变化，需要持久化保存
 */
export interface BasicTimelineConfig {
  name: string                           // 显示名称
  mediaConfig: GetMediaConfig<MediaType> // 媒体配置（变换、音量、缩略图等参数）
  animation?: AnimationConfig<MediaType> // 可选动画配置
}

// ==================== 扩展的属性变化事件类型 ====================

/**
 * 扩展的属性变化事件类型（来自 BaseVisibleSprite）
 */
export type ExtendedPropsChangeEvent = Partial<{
  rect: Partial<{ x: number; y: number; w: number; h: number; angle: number }>
  zIndex: number
  opacity: number
  textUpdate?: {
    text: string
    style: TextStyleConfig // 文本样式配置
    needsRecreation: boolean
  }
}>

// ==================== 统一时间轴项目核心接口 ====================

/**
 * 统一的时间轴项目接口 - 3状态极简核心 + 上下文扩展
 *
 * 设计理念：
 * - 状态驱动：通过 timelineStatus 和 statusContext 管理项目状态
 * - 统一架构：消除 LocalTimelineItem 和 AsyncProcessingTimelineItem 的类型分离
 * - 响应式友好：所有属性都支持 Vue3 响应式系统
 */
export interface UnifiedTimelineItem {
  // ==================== 核心属性 ====================
  id: string
  mediaItemId: string // 关联的统一媒体项目ID
  trackId?: string

  // ==================== 状态管理 ====================
  timelineStatus: TimelineItemStatus // 仅3状态：ready|loading|error

  // ==================== 状态上下文 - 动态状态信息 ====================
  statusContext?: TimelineStatusContext // 承载当前状态的详细信息和UI展示数据

  // ==================== 媒体信息 ====================
  mediaType: MediaType | 'unknown' // 从关联的媒体项目同步

  // ==================== 时间范围 ====================
  timeRange: {
    timelineStartTime: number // 时间轴开始时间（帧数）
    timelineEndTime: number   // 时间轴结束时间（帧数）
  }

  // ==================== 统一配置 ====================
  config: BasicTimelineConfig // 统一基础配置，取消占位符/准备中分离

  // ==================== 精灵对象 ====================
  sprite?: Raw<CustomSprite> // ready状态可用
}

// ==================== 状态转换规则 ====================

/**
 * 极简3状态转换规则 - 基于真实业务场景
 *
 * 原6状态24种转换 -> 简化到9种转换
 * 所有中间状态都通过TimelineStatusContext表达
 */
export const VALID_TIMELINE_TRANSITIONS: Record<TimelineItemStatus, TimelineItemStatus[]> = {
  'loading': ['ready', 'error'],  // loading完成后变为就绪或错误
  'ready': ['loading', 'error'],  // 重新处理或出错
  'error': ['loading', 'ready']   // 重试或恢复
}



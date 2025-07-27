/**
 * 统一时间轴项目数据类型定义（响应式重构版）
 * 基于"核心数据与行为分离"的重构方案
 */

import type { MediaType } from '../mediaitem'

// ==================== 基础类型定义 ====================

/**
 * 时间轴项目状态类型 - 3状态简化版
 */
export type TimelineItemStatus = 
  | 'ready'    // 完全就绪，可用于时间轴
  | 'loading'  // 正在处理中，包含下载、解析、等待
  | 'error'    // 不可用状态，包含错误、缺失、取消

/**
 * 状态转换规则定义
 */
export const VALID_TIMELINE_TRANSITIONS: Record<TimelineItemStatus, TimelineItemStatus[]> = {
  'loading': ['ready', 'error'],
  'ready': ['loading', 'error'],
  'error': ['loading']
} as const

/**
 * 媒体状态到时间轴状态的映射表
 */
export const MEDIA_TO_TIMELINE_STATUS_MAP = {
  'pending': 'loading',           // 等待开始 → 加载中
  'asyncprocessing': 'loading',   // 异步处理中 → 加载中  
  'webavdecoding': 'loading',     // WebAV解析中 → 加载中
  'ready': 'ready',               // 就绪 → 就绪
  'error': 'error',               // 错误 → 错误
  'cancelled': 'error',           // 已取消 → 错误
  'missing': 'error'              // 文件缺失 → 错误
} as const

// ==================== 移除复杂的上下文系统 ====================

/**
 * 注意：已移除复杂的 statusContext 系统
 * 状态显示信息现在直接基于关联媒体项目状态计算
 * 使用 TimelineStatusDisplayUtils 获取状态显示信息
 */

// ==================== 配置类型 ====================

/**
 * 变换数据接口
 */
export interface TransformData {
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  opacity?: number
  zIndex?: number
  duration?: number // 时长（帧数）- 用于时间轴项目时长调整
  playbackRate?: number
  volume?: number
  isMuted?: boolean
  gain?: number // 音频增益（dB）
}

/**
 * 基础时间轴配置 - 静态配置信息
 * 
 * 职责：定义时间轴项目的基本属性和媒体参数
 * 特点：创建时设置，很少变化，需要持久化保存
 */
export interface BasicTimelineConfig {
  name: string                    // 显示名称
  transform?: TransformData       // 变换配置
  
  // 媒体特定配置
  videoConfig?: {
    clipStartTime?: number        // 裁剪开始时间（帧数）
    clipEndTime?: number          // 裁剪结束时间（帧数）
  }
  
  audioConfig?: {
    volume?: number               // 音量 (0-1)
    isMuted?: boolean            // 是否静音
    gain?: number                // 增益 (dB)
  }
  
  imageConfig?: {
    displayDuration?: number      // 显示时长（帧数）
  }
}

// ==================== 核心数据接口 ====================

/**
 * 统一时间轴项目数据接口 - 纯响应式状态对象
 *
 * 设计理念：
 * - 纯数据对象，使用 reactive() 包装
 * - 移除复杂的上下文模板，状态显示直接基于关联媒体项目计算
 * - 所有状态变化自动触发Vue组件更新
 * - 与数据源、媒体项目采用一致的架构模式
 */
export interface UnifiedTimelineItemData {
  // ==================== 核心属性 ====================
  readonly id: string
  mediaItemId: string // 关联的统一媒体项目ID
  trackId?: string

  // ==================== 状态管理 ====================
  timelineStatus: TimelineItemStatus // 仅3状态：ready|loading|error

  // ==================== 媒体信息 ====================
  mediaType: MediaType | 'unknown' // 从关联的媒体项目同步

  // ==================== 时间范围 ====================
  timeRange: {
    timelineStartTime: number // 时间轴开始时间（帧数）
    timelineEndTime: number   // 时间轴结束时间（帧数）
  }

  // ==================== 基础配置 ====================
  config: BasicTimelineConfig // 静态配置信息

  // ==================== Sprite引用 ====================
  spriteId?: string // Sprite ID，由SpriteLifecycleManager管理
}

// ==================== 工厂函数选项类型 ====================

/**
 * 创建时间轴项目数据的选项
 */
export interface CreateTimelineItemOptions {
  mediaItemId: string
  trackId?: string
  timeRange: { timelineStartTime: number; timelineEndTime: number }
  config: BasicTimelineConfig
  mediaType?: MediaType | 'unknown'
  initialStatus?: TimelineItemStatus
}

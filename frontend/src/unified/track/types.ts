/**
 * 统一轨道类型定义
 * 基于重构文档的统一类型设计理念
 * 
 * 核心设计理念：
 * - 状态驱动的统一架构：与UnifiedTimelineItem完美集成
 * - 响应式数据结构：核心数据 + 行为函数 + 查询函数
 * - 类型安全：完整的TypeScript类型定义
 */

// ==================== 核心类型定义 ====================

/**
 * 统一轨道类型 - 基于重构文档的设计理念
 */
export type UnifiedTrackType = 'video' | 'audio' | 'text'

/**
 * 统一轨道状态 - 简化的状态管理
 */
export type UnifiedTrackStatus = 
  | 'active'    // 活跃状态，正常使用
  | 'disabled'  // 禁用状态，暂时不可用
  | 'locked'    // 锁定状态，防止意外修改

/**
 * 统一轨道接口 - 基于统一类型设计
 */
export interface UnifiedTrack {
  // ==================== 核心属性 ====================
  id: string
  name: string
  type: UnifiedTrackType
  
  // ==================== 状态管理 ====================
  status: UnifiedTrackStatus
  
  // ==================== 视觉属性 ====================
  isVisible: boolean    // 可见性（仅适用于视觉轨道）
  isMuted: boolean      // 静音状态（仅适用于音频轨道）
  
  // ==================== 布局属性 ====================
  height: number        // 轨道高度
  order: number         // 轨道顺序
  
  // ==================== 扩展属性 ====================
  color?: string        // 轨道颜色标识
  description?: string  // 轨道描述
  
  // ==================== 元数据 ====================
  createdAt: string     // 创建时间
  updatedAt: string     // 更新时间
}

/**
 * 轨道配置接口
 */
export interface UnifiedTrackConfig {
  name?: string
  type: UnifiedTrackType
  status?: UnifiedTrackStatus
  isVisible?: boolean
  isMuted?: boolean
  height?: number
  color?: string
  description?: string
  position?: number  // 插入位置
}

/**
 * 轨道摘要信息
 */
export interface UnifiedTrackSummary {
  id: string
  name: string
  type: UnifiedTrackType
  status: UnifiedTrackStatus
  isVisible: boolean
  isMuted: boolean
  height: number
  order: number
  itemCount: number  // 轨道上的时间轴项目数量
}

/**
 * 轨道操作结果
 */
export interface UnifiedTrackOperationResult {
  success: boolean
  message?: string
  data?: any
}

/**
 * 轨道验证结果
 */
export interface UnifiedTrackValidationResult {
  isValid: boolean
  errors: string[]
}

/**
 * 轨道能力接口 - 描述轨道支持的功能
 */
export interface UnifiedTrackCapabilities {
  supportsVisibility: boolean  // 是否支持可见性控制
  supportsMute: boolean        // 是否支持静音控制
  supportsReorder: boolean     // 是否支持重排序
  supportsResize: boolean      // 是否支持调整高度
  supportsLock: boolean        // 是否支持锁定
}

/**
 * 轨道事件类型
 */
export type UnifiedTrackEventType =
  | 'track:created'
  | 'track:deleted'
  | 'track:renamed'
  | 'track:reordered'
  | 'track:visibility:changed'
  | 'track:mute:changed'
  | 'track:status:changed'
  | 'track:height:changed'

/**
 * 轨道事件数据
 */
export interface UnifiedTrackEventData {
  type: UnifiedTrackEventType
  trackId: string
  trackName: string
  oldValue?: any
  newValue?: any
  timestamp: number
}

// ==================== 常量定义 ====================

/**
 * 默认轨道配置
 */
export const DEFAULT_UNIFIED_TRACK_CONFIGS: Record<UnifiedTrackType, Partial<UnifiedTrackConfig>> = {
  video: {
    height: 60,
    isVisible: true,
    isMuted: false,
    color: '#4CAF50',
  },
  audio: {
    height: 60,
    isVisible: true,
    isMuted: false,
    color: '#FF9800',
  },
  text: {
    height: 60,
    isVisible: true,
    isMuted: false,
    color: '#2196F3',
  },
}

/**
 * 轨道类型显示名称
 */
export const UNIFIED_TRACK_TYPE_NAMES: Record<UnifiedTrackType, string> = {
  video: '视频轨道',
  audio: '音频轨道',
  text: '文本轨道',
}

/**
 * 轨道状态显示名称
 */
export const UNIFIED_TRACK_STATUS_NAMES: Record<UnifiedTrackStatus, string> = {
  active: '活跃',
  disabled: '禁用',
  locked: '锁定',
}

/**
 * 轨道类型图标路径
 */
export const UNIFIED_TRACK_TYPE_ICONS: Record<UnifiedTrackType, string> = {
  video: 'M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z',
  audio: 'M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12Z',
  text: 'M18,11H16.5V10.5H14.5V13.5H16.5V13H18V14A1,1 0 0,1 17,15H14A1,1 0 0,1 13,14V10A1,1 0 0,1 14,9H17A1,1 0 0,1 18,10V11M11,15H9V9H11V15M8,9H6V15H8V9Z',
}

/**
 * 轨道状态颜色
 */
export const UNIFIED_TRACK_STATUS_COLORS: Record<UnifiedTrackStatus, string> = {
  active: '#4CAF50',
  disabled: '#9E9E9E',
  locked: '#FF5722',
}

/**
 * 轨道类型能力映射
 */
export const UNIFIED_TRACK_TYPE_CAPABILITIES: Record<UnifiedTrackType, UnifiedTrackCapabilities> = {
  video: {
    supportsVisibility: true,
    supportsMute: true,
    supportsReorder: true,
    supportsResize: true,
    supportsLock: true,
  },
  audio: {
    supportsVisibility: false,
    supportsMute: true,
    supportsReorder: true,
    supportsResize: true,
    supportsLock: true,
  },
  text: {
    supportsVisibility: true,
    supportsMute: false,
    supportsReorder: true,
    supportsResize: true,
    supportsLock: true,
  },
}



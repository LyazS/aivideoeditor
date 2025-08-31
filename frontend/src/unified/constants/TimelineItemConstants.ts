/**
 * 统一时间轴项目常量定义
 */

import type { TimelineItemStatus } from '@/unified/timelineitem/TimelineItemData'

// ==================== 状态相关常量 ====================

/**
 * 默认状态
 */
export const DEFAULT_TIMELINE_STATUS: TimelineItemStatus = 'loading'

/**
 * 状态优先级（用于排序和比较）
 */
export const STATUS_PRIORITY: Record<TimelineItemStatus, number> = {
  error: 0, // 最高优先级，需要用户关注
  loading: 1, // 中等优先级，正在处理
  ready: 2, // 最低优先级，正常状态
}

/**
 * 状态颜色映射（用于UI显示）
 */
export const STATUS_COLORS = {
  ready: '#52c41a', // 绿色
  loading: '#1890ff', // 蓝色
  error: '#ff4d4f', // 红色
} as const

/**
 * 状态图标映射
 */
export const STATUS_ICONS = {
  ready: 'check-circle',
  loading: 'loading',
  error: 'exclamation-circle',
} as const

// ==================== 时间相关常量 ====================
// 已迁移到 TimeConstants.ts

// ==================== 变换相关常量 ====================

/**
 * 默认变换值
 */
export const DEFAULT_TRANSFORM = {
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  rotation: 0,
  opacity: 1,
  zIndex: 0,
  playbackRate: 1,
  volume: 1,
  isMuted: false,
  gain: 0,
} as const

/**
 * 变换值范围限制
 */
export const TRANSFORM_LIMITS = {
  opacity: { min: 0, max: 1 },
  volume: { min: 0, max: 2 },
  playbackRate: { min: 0.1, max: 4 },
  gain: { min: -60, max: 20 }, // dB
  rotation: { min: -360, max: 360 },
  zIndex: { min: 0, max: 9999 },
} as const

// ==================== 媒体类型相关常量 ====================

/**
 * 支持的媒体类型
 */
export const SUPPORTED_MEDIA_TYPES = ['video', 'audio', 'image'] as const

/**
 * 媒体类型默认配置
 */
export const MEDIA_TYPE_DEFAULTS = {
  video: {
    hasVisualTrack: true,
    hasAudioTrack: true,
    defaultDuration: 30 * 5, // 5秒@30fps
    supportsCropping: true,
    supportsTransform: true,
  },
  audio: {
    hasVisualTrack: false,
    hasAudioTrack: true,
    defaultDuration: 30 * 5, // 5秒@30fps
    supportsCropping: false,
    supportsTransform: false,
  },
  image: {
    hasVisualTrack: true,
    hasAudioTrack: false,
    defaultDuration: 30 * 5, // 5秒@30fps
    supportsCropping: false,
    supportsTransform: true,
  },
} as const

/**
 * 媒体类型图标映射
 */
export const MEDIA_TYPE_ICONS = {
  video: 'video-camera',
  audio: 'audio',
  image: 'picture',
  unknown: 'file',
} as const

// ==================== 轨道相关常量 ====================

/**
 * 默认轨道类型
 */
export const DEFAULT_TRACK_TYPES = {
  VIDEO: 'video',
  AUDIO: 'audio',
  SUBTITLE: 'subtitle',
} as const

/**
 * 轨道高度（像素）- 统一为60px，与旧架构一致
 */
export const TRACK_HEIGHTS = {
  video: 60,
  audio: 60,
  text: 60,
  subtitle: 60,
  effect: 60,
} as const

// ==================== 错误相关常量 ====================

/**
 * 错误代码定义
 */
export const ERROR_CODES = {
  // 文件相关错误
  FILE_MISSING: 'FILE_MISSING',
  FILE_CORRUPTED: 'FILE_CORRUPTED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',

  // 网络相关错误
  NETWORK_ERROR: 'NETWORK_ERROR',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  TIMEOUT: 'TIMEOUT',

  // 解析相关错误
  PARSE_ERROR: 'PARSE_ERROR',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  CODEC_ERROR: 'CODEC_ERROR',

  // 系统相关错误
  MEMORY_ERROR: 'MEMORY_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

/**
 * 错误消息映射
 */
export const ERROR_MESSAGES = {
  [ERROR_CODES.FILE_MISSING]: '文件不存在',
  [ERROR_CODES.FILE_CORRUPTED]: '文件已损坏',
  [ERROR_CODES.FILE_TOO_LARGE]: '文件过大',
  [ERROR_CODES.NETWORK_ERROR]: '网络连接失败',
  [ERROR_CODES.DOWNLOAD_FAILED]: '下载失败',
  [ERROR_CODES.TIMEOUT]: '操作超时',
  [ERROR_CODES.PARSE_ERROR]: '文件解析失败',
  [ERROR_CODES.UNSUPPORTED_FORMAT]: '不支持的文件格式',
  [ERROR_CODES.CODEC_ERROR]: '编解码器错误',
  [ERROR_CODES.MEMORY_ERROR]: '内存不足',
  [ERROR_CODES.PERMISSION_DENIED]: '权限不足',
  [ERROR_CODES.UNKNOWN_ERROR]: '未知错误',
} as const

/**
 * 可恢复的错误代码
 */
export const RECOVERABLE_ERROR_CODES = new Set([
  ERROR_CODES.NETWORK_ERROR,
  ERROR_CODES.DOWNLOAD_FAILED,
  ERROR_CODES.TIMEOUT,
  ERROR_CODES.FILE_MISSING,
])

// ==================== 性能相关常量 ====================

/**
 * 批量操作的默认批次大小
 */
export const DEFAULT_BATCH_SIZE = 50

/**
 * 状态转换的防抖延迟（毫秒）
 */
export const STATE_TRANSITION_DEBOUNCE = 100

/**
 * 进度更新的节流间隔（毫秒）
 */
export const PROGRESS_UPDATE_THROTTLE = 200

// ==================== 调试相关常量 ====================

/**
 * 调试模式标志
 */
export const DEBUG_MODE = import.meta.env.DEV

/**
 * 日志级别
 */
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
} as const

/**
 * 当前日志级别
 */
export const CURRENT_LOG_LEVEL = DEBUG_MODE ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN

// ==================== 导出所有常量 ====================

export const TimelineConstants = {
  // 状态相关
  DEFAULT_TIMELINE_STATUS,
  STATUS_PRIORITY,
  STATUS_COLORS,
  STATUS_ICONS,

  // 时间相关
  // 已迁移到 TimeConstants.ts

  // 变换相关
  DEFAULT_TRANSFORM,
  TRANSFORM_LIMITS,

  // 媒体类型相关
  SUPPORTED_MEDIA_TYPES,
  MEDIA_TYPE_DEFAULTS,
  MEDIA_TYPE_ICONS,

  // 轨道相关
  DEFAULT_TRACK_TYPES,
  TRACK_HEIGHTS,

  // 错误相关
  ERROR_CODES,
  ERROR_MESSAGES,
  RECOVERABLE_ERROR_CODES,

  // 性能相关
  // 已迁移到 PerformanceConstants.ts

  // 调试相关
  DEBUG_MODE,
  LOG_LEVELS,
  CURRENT_LOG_LEVEL,
}

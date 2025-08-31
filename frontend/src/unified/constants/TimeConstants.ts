/**
 * 统一时间系统常量定义
 * 包含帧率、时间计算、时间轴网格等相关常量
 */

// ==================== 帧率相关常量 ====================

/**
 * 默认帧率 - 30fps
 */
export const DEFAULT_FRAME_RATE = 30

/**
 * 固定帧率 - 30fps（用于时间码计算）
 */
export const FRAME_RATE = 30

// ==================== 时间轴项目时长常量 ====================

/**
 * 最小项目持续时间（帧数）- 1帧
 */
export const MIN_ITEM_DURATION = 1

/**
 * 最大项目持续时间（帧数）- 1小时@30fps
 */
export const MAX_ITEM_DURATION = 30 * 60 * 60

/**
 * 默认项目持续时间（帧数）- 5秒@30fps
 */
export const DEFAULT_ITEM_DURATION = 30 * 5

/**
 * 默认图片/文本项目持续时间（帧数）- 5秒@30fps
 */
export const DEFAULT_MEDIA_ITEM_DURATION = 30 * 5

// ==================== 时间轴网格常量 ====================

/**
 * 时间轴网格间隔（帧数）- 1秒@30fps
 */
export const TIMELINE_GRID_INTERVAL = 30

/**
 * 主要网格间隔（帧数）- 5秒@30fps
 */
export const MAJOR_GRID_INTERVAL = 30 * 5

/**
 * 次要网格间隔（帧数）- 1帧
 */
export const MINOR_GRID_INTERVAL = 1

// ==================== 时间码格式常量 ====================

/**
 * 时间码分隔符
 */
export const TIMECODE_SEPARATOR = ':'

/**
 * 时间码帧分隔符
 */
export const TIMECODE_FRAME_SEPARATOR = ';'

/**
 * 时间码显示格式
 */
export const TIMECODE_FORMAT = 'HH:mm:ss:ff'

// ==================== 时间范围常量 ====================

/**
 * 默认时间轴总时长（帧数）- 60秒@30fps
 */
export const DEFAULT_TOTAL_DURATION = 30 * 60

/**
 * 最小时间轴长度（帧数）- 1秒@30fps
 */
export const MIN_TIMELINE_LENGTH = 30

/**
 * 最大时间轴长度（帧数）- 24小时@30fps
 */
export const MAX_TIMELINE_LENGTH = 30 * 60 * 60 * 24

// ==================== 导出所有时间常量 ====================

export const TimeConstants = {
  // 帧率相关
  DEFAULT_FRAME_RATE,
  FRAME_RATE,

  // 项目时长
  MIN_ITEM_DURATION,
  MAX_ITEM_DURATION,
  DEFAULT_ITEM_DURATION,
  DEFAULT_MEDIA_ITEM_DURATION,

  // 网格相关
  TIMELINE_GRID_INTERVAL,
  MAJOR_GRID_INTERVAL,
  MINOR_GRID_INTERVAL,

  // 时间码相关
  TIMECODE_SEPARATOR,
  TIMECODE_FRAME_SEPARATOR,
  TIMECODE_FORMAT,

  // 时间范围
  DEFAULT_TOTAL_DURATION,
  MIN_TIMELINE_LENGTH,
  MAX_TIMELINE_LENGTH,
} as const
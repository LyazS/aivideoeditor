/**
 * 统一布局系统常量定义
 * 包含时间轴布局、轨道布局、UI尺寸等相关常量
 */

// ==================== 时间轴布局常量 ====================

/**
 * 轨道控制区域宽度 - 150px
 */
export const TRACK_CONTROL_WIDTH = 150

/**
 * 时间轴默认宽度 - 800px
 */
export const TIMELINE_DEFAULT_WIDTH = 800

/**
 * 时间轴最小宽度 - 400px
 */
export const TIMELINE_MIN_WIDTH = 400

/**
 * 时间轴最大宽度 - 2000px
 */
export const TIMELINE_MAX_WIDTH = 2000

/**
 * 播放头组件轨道控制宽度 - 150px
 */
export const PLAYHEAD_TRACK_CONTROL_WIDTH = 150

// ==================== 轨道布局常量 ====================

/**
 * 轨道头部高度 - 40px
 */
export const TRACK_HEADER_HEIGHT = 40

/**
 * 轨道内容内边距 - 8px
 */
export const TRACK_CONTENT_PADDING = 8

/**
 * 最小轨道高度 - 30px
 */
export const TRACK_MIN_HEIGHT = 30

/**
 * 最大轨道高度 - 200px
 */
export const TRACK_MAX_HEIGHT = 200

/**
 * 默认轨道高度 - 60px
 */
export const TRACK_DEFAULT_HEIGHT = 60

/**
 * 折叠轨道高度 - 30px
 */
export const TRACK_COLLAPSED_HEIGHT = 30

/**
 * 展开轨道高度倍数 - 1.5倍
 */
export const TRACK_EXPANDED_HEIGHT_MULTIPLIER = 1.5

/**
 * 轨道颜色标识宽度 - 4px
 */
export const TRACK_COLOR_INDICATOR_WIDTH = 4

// ==================== 时间轴项目布局常量 ====================

/**
 * 时间轴项目最小宽度 - 20px
 */
export const TIMELINE_ITEM_MIN_WIDTH = 20

/**
 * 时间轴项目默认内边距 - 水平8px，垂直4px
 */
export const TIMELINE_ITEM_PADDING = {
  horizontal: 8,
  vertical: 4
} as const

/**
 * 时间轴项目边框圆角 - 4px
 */
export const TIMELINE_ITEM_BORDER_RADIUS = 4

/**
 * 时间轴项目选中边框宽度 - 2px
 */
export const TIMELINE_ITEM_SELECTED_BORDER_WIDTH = 2

// ==================== 播放头布局常量 ====================

/**
 * 播放头宽度 - 2px
 */
export const PLAYHEAD_WIDTH = 2

/**
 * 播放头高度倍数 - 1.2倍（相对于轨道高度）
 */
export const PLAYHEAD_HEIGHT_MULTIPLIER = 1.2

/**
 * 播放头三角形大小 - 8px
 */
export const PLAYHEAD_TRIANGLE_SIZE = 8

// ==================== 网格线布局常量 ====================

/**
 * 主要网格线高度 - 30px
 */
export const MAJOR_GRIDLINE_HEIGHT = 30

/**
 * 次要网格线高度 - 20px
 */
export const MINOR_GRIDLINE_HEIGHT = 20

/**
 * 帧网格线高度 - 15px
 */
export const FRAME_GRIDLINE_HEIGHT = 15

/**
 * 网格线宽度 - 1px
 */
export const GRIDLINE_WIDTH = 1

// ==================== UI控件布局常量 ====================

/**
 * 按钮默认尺寸 - 24px
 */
export const BUTTON_DEFAULT_SIZE = 24

/**
 * 图标默认尺寸 - 16px
 */
export const ICON_DEFAULT_SIZE = 16

/**
 * 输入框默认高度 - 32px
 */
export const INPUT_DEFAULT_HEIGHT = 32

/**
 * 滑块默认高度 - 8px
 */
export const SLIDER_DEFAULT_HEIGHT = 8

// ==================== 导出所有布局常量 ====================

export const LayoutConstants = {
  // 时间轴布局
  TRACK_CONTROL_WIDTH,
  TIMELINE_DEFAULT_WIDTH,
  TIMELINE_MIN_WIDTH,
  TIMELINE_MAX_WIDTH,
  PLAYHEAD_TRACK_CONTROL_WIDTH,

  // 轨道布局
  TRACK_HEADER_HEIGHT,
  TRACK_CONTENT_PADDING,
  TRACK_MIN_HEIGHT,
  TRACK_MAX_HEIGHT,
  TRACK_DEFAULT_HEIGHT,
  TRACK_COLLAPSED_HEIGHT,
  TRACK_EXPANDED_HEIGHT_MULTIPLIER,
  TRACK_COLOR_INDICATOR_WIDTH,

  // 时间轴项目布局
  TIMELINE_ITEM_MIN_WIDTH,
  TIMELINE_ITEM_PADDING,
  TIMELINE_ITEM_BORDER_RADIUS,
  TIMELINE_ITEM_SELECTED_BORDER_WIDTH,

  // 播放头布局
  PLAYHEAD_WIDTH,
  PLAYHEAD_HEIGHT_MULTIPLIER,
  PLAYHEAD_TRIANGLE_SIZE,

  // 网格线布局
  MAJOR_GRIDLINE_HEIGHT,
  MINOR_GRIDLINE_HEIGHT,
  FRAME_GRIDLINE_HEIGHT,
  GRIDLINE_WIDTH,

  // UI控件布局
  BUTTON_DEFAULT_SIZE,
  ICON_DEFAULT_SIZE,
  INPUT_DEFAULT_HEIGHT,
  SLIDER_DEFAULT_HEIGHT,
} as const
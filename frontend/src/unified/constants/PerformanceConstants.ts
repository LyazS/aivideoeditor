/**
 * 统一性能系统常量定义
 * 包含批量处理、防抖节流、渲染优化等相关常量
 */

// ==================== 批量处理常量 ====================

/**
 * 默认批量大小 - 50个项目
 */
export const DEFAULT_BATCH_SIZE = 50

/**
 * 最大批量大小 - 100个项目
 */
export const MAX_BATCH_SIZE = 100

/**
 * 最小批量大小 - 10个项目
 */
export const MIN_BATCH_SIZE = 10

/**
 * 轨道渲染批量大小 - 10个轨道
 */
export const TRACK_RENDER_BATCH_SIZE = 10

/**
 * 时间轴项目渲染批量大小 - 20个项目
 */
export const TIMELINE_ITEM_RENDER_BATCH_SIZE = 20

// ==================== 防抖节流常量 ====================

/**
 * 状态转换防抖时间 - 100ms
 */
export const STATE_TRANSITION_DEBOUNCE = 100

/**
 * 进度更新节流时间 - 200ms
 */
export const PROGRESS_UPDATE_THROTTLE = 200

/**
 * 滚动事件节流时间 - 16ms（约60fps）
 */
export const SCROLL_THROTTLE_MS = 16

/**
 * 调整大小事件防抖时间 - 300ms
 */
export const RESIZE_DEBOUNCE_MS = 300

/**
 * 输入防抖时间 - 150ms
 */
export const INPUT_DEBOUNCE_MS = 150

/**
 * 搜索防抖时间 - 250ms
 */
export const SEARCH_DEBOUNCE_MS = 250

// ==================== 动画性能常量 ====================

/**
 * 动画帧率限制 - 60fps
 */
export const ANIMATION_FRAME_RATE = 60

/**
 * 动画帧间隔 - 16.67ms（1000ms / 60fps）
 */
export const ANIMATION_FRAME_INTERVAL = 1000 / 60

/**
 * 最大关键帧数量 - 1000个
 */
export const MAX_KEYFRAMES = 1000

/**
 * 关键帧更新阈值 - 0.1（10%变化才更新）
 */
export const KEYFRAME_UPDATE_THRESHOLD = 0.1

// ==================== 渲染优化常量 ====================

/**
 * 视口外渲染缓冲区 - 200px
 */
export const VIEWPORT_BUFFER = 200

/**
 * 懒加载阈值 - 500px
 */
export const LAZY_LOAD_THRESHOLD = 500

/**
 * 虚拟滚动项高度 - 50px
 */
export const VIRTUAL_ITEM_HEIGHT = 50

/**
 * 最大并发渲染任务 - 4个
 */
export const MAX_CONCURRENT_RENDER_TASKS = 4

/**
 * 渲染任务超时时间 - 5000ms
 */
export const RENDER_TASK_TIMEOUT = 5000

// ==================== 内存管理常量 ====================

/**
 * 最大缓存项目数量 - 1000个
 */
export const MAX_CACHED_ITEMS = 1000

/**
 * 缓存清理阈值 - 80%（超过80%容量时清理）
 */
export const CACHE_CLEANUP_THRESHOLD = 0.8

/**
 * 缓存存活时间 - 5分钟
 */
export const CACHE_TTL = 5 * 60 * 1000

/**
 * 最大历史记录步骤 - 100步
 */
export const MAX_HISTORY_STEPS = 100

// ==================== 网络性能常量 ====================

/**
 * 请求超时时间 - 30000ms
 */
export const REQUEST_TIMEOUT = 30000

/**
 * 最大重试次数 - 3次
 */
export const MAX_RETRY_ATTEMPTS = 3

/**
 * 重试延迟基数 - 1000ms
 */
export const RETRY_DELAY_BASE = 1000

/**
 * 并发请求限制 - 6个
 */
export const CONCURRENT_REQUEST_LIMIT = 6

// ==================== 导出所有性能常量 ====================

export const PerformanceConstants = {
  // 批量处理
  DEFAULT_BATCH_SIZE,
  MAX_BATCH_SIZE,
  MIN_BATCH_SIZE,
  TRACK_RENDER_BATCH_SIZE,
  TIMELINE_ITEM_RENDER_BATCH_SIZE,

  // 防抖节流
  STATE_TRANSITION_DEBOUNCE,
  PROGRESS_UPDATE_THROTTLE,
  SCROLL_THROTTLE_MS,
  RESIZE_DEBOUNCE_MS,
  INPUT_DEBOUNCE_MS,
  SEARCH_DEBOUNCE_MS,

  // 动画性能
  ANIMATION_FRAME_RATE,
  ANIMATION_FRAME_INTERVAL,
  MAX_KEYFRAMES,
  KEYFRAME_UPDATE_THRESHOLD,

  // 渲染优化
  VIEWPORT_BUFFER,
  LAZY_LOAD_THRESHOLD,
  VIRTUAL_ITEM_HEIGHT,
  MAX_CONCURRENT_RENDER_TASKS,
  RENDER_TASK_TIMEOUT,

  // 内存管理
  MAX_CACHED_ITEMS,
  CACHE_CLEANUP_THRESHOLD,
  CACHE_TTL,
  MAX_HISTORY_STEPS,

  // 网络性能
  REQUEST_TIMEOUT,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAY_BASE,
  CONCURRENT_REQUEST_LIMIT,
} as const
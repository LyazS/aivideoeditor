// ==================== 核心动画类型定义 ====================

/**
 * 可动画属性枚举
 * 定义了支持关键帧动画的所有属性类型
 */
export type AnimatableProperty = 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity' | 'zIndex'

/**
 * 插值类型枚举
 * 定义关键帧之间的插值算法类型
 */
export type InterpolationType = 'linear' // 未来可扩展为 'ease-in', 'ease-out', 'bezier' 等

/**
 * 关键帧属性值接口
 * 定义单个属性的值和插值类型
 */
export interface KeyFrameProperty {
  /** 动画属性类型 */
  property: AnimatableProperty
  /** 属性值 */
  value: number
  /** 插值类型 */
  interpolation: InterpolationType
}

/**
 * 关键帧数据接口
 * 定义单个关键帧的完整数据结构，可以包含多个属性
 */
export interface KeyFrame {
  /** 关键帧唯一标识符 */
  id: string
  /** 关键帧时间点（秒） */
  time: number
  /** 属性值数组，一个关键帧可以包含多个属性 */
  properties: KeyFrameProperty[]
}

/**
 * 动画配置接口
 * 定义时间轴项目的完整动画配置
 */
export interface AnimationConfig {
  /** 该项目的所有关键帧 */
  keyFrames: KeyFrame[]
  /** 动画总时长（微秒） */
  duration: number
  /** 迭代次数，默认1 */
  iterCount: number
  /** 是否启用动画 */
  isEnabled: boolean
}

// ==================== WebAV集成类型 ====================

/**
 * WebAV动画属性接口
 * 对应WebAV内部的TAnimateProps类型定义
 */
export interface WebAVAnimateProps {
  /** X坐标位置 */
  x?: number
  /** Y坐标位置 */
  y?: number
  /** 宽度 */
  w?: number
  /** 高度 */
  h?: number
  /** 旋转角度（弧度） */
  angle?: number
  /** 透明度（0-1） */
  opacity?: number
  /** 层级（注意：WebAV可能不直接支持zIndex动画） */
  zIndex?: number
}

/**
 * WebAV关键帧格式转换类型
 * 用于将项目关键帧转换为WebAV可识别的格式
 */
export type WebAVKeyFrameOpts = Partial<
  Record<`${number}%` | 'from' | 'to', Partial<WebAVAnimateProps>>
>

/**
 * WebAV动画选项接口
 * 对应WebAV的setAnimation方法参数
 */
export interface WebAVAnimationOpts {
  /** 动画时长（微秒） */
  duration: number
  /** 迭代次数 */
  iterCount: number
  /** 延迟时间（微秒） */
  delay?: number
}

// ==================== 关键帧查找和导航类型 ====================

/**
 * 关键帧查找选项
 */
export interface KeyFrameFindOptions {
  /** 时间容差（秒），用于判断是否在关键帧附近 */
  tolerance?: number
  /** 是否只查找包含指定属性的关键帧 */
  property?: AnimatableProperty
  /** 是否只查找包含指定属性列表的关键帧 */
  properties?: AnimatableProperty[]
}

/**
 * 关键帧导航结果
 */
export interface KeyFrameNavigationResult {
  /** 找到的关键帧 */
  keyFrame: KeyFrame | null
  /** 是否有更多关键帧 */
  hasMore: boolean
  /** 总关键帧数量 */
  total: number
}

// ==================== 关键帧操作类型 ====================

/**
 * 关键帧操作结果
 */
export type KeyFrameOperationResult = 'added' | 'removed' | 'updated'

/**
 * 批量关键帧操作数据
 */
export interface BatchKeyFrameOperation {
  /** 操作类型 */
  type: 'add' | 'remove' | 'update'
  /** 关键帧数据 */
  keyFrames: KeyFrame[]
}

/**
 * 关键帧验证错误
 */
export interface KeyFrameValidationError {
  /** 错误类型 */
  type: 'invalid_time' | 'invalid_value' | 'duplicate_keyframe' | 'missing_property'
  /** 错误消息 */
  message: string
  /** 相关的关键帧ID（如果有） */
  keyFrameId?: string
}

// ==================== 坐标转换类型 ====================

/**
 * 坐标系转换上下文
 * 用于在项目坐标系和WebAV坐标系之间转换
 */
export interface CoordinateTransformContext {
  /** 画布宽度 */
  canvasWidth: number
  /** 画布高度 */
  canvasHeight: number
  /** 视频分辨率 */
  videoResolution: {
    width: number
    height: number
  }
}

/**
 * 属性值转换映射
 * 定义项目属性名到WebAV属性名的映射关系
 */
export type PropertyMapping = Record<AnimatableProperty, keyof WebAVAnimateProps>

// ==================== 动画状态管理类型 ====================

/**
 * 动画播放状态
 */
export interface AnimationPlaybackState {
  /** 是否正在播放动画 */
  isPlaying: boolean
  /** 当前播放时间（秒） */
  currentTime: number
  /** 当前活动的关键帧 */
  activeKeyFrames: KeyFrame[]
  /** 下一个关键帧 */
  nextKeyFrame: KeyFrame | null
  /** 上一个关键帧 */
  previousKeyFrame: KeyFrame | null
}

/**
 * 关键帧选择状态
 */
export interface KeyFrameSelectionState {
  /** 当前选中的关键帧 */
  selectedKeyFrame: KeyFrame | null
  /** 多选的关键帧列表 */
  selectedKeyFrames: KeyFrame[]
  /** 是否处于多选模式 */
  isMultiSelect: boolean
}

// ==================== 缓存和性能优化类型 ====================

/**
 * 关键帧缓存项
 */
export interface KeyFrameCacheItem {
  /** 原始关键帧数据 */
  keyFrames: KeyFrame[]
  /** 转换后的WebAV关键帧 */
  webavKeyFrames: WebAVKeyFrameOpts
  /** 最后更新时间 */
  lastUpdate: number
  /** 缓存版本号 */
  version: number
}

/**
 * 动画性能统计
 */
export interface AnimationPerformanceStats {
  /** 关键帧转换耗时（毫秒） */
  conversionTime: number
  /** 动画应用耗时（毫秒） */
  applicationTime: number
  /** 缓存命中率 */
  cacheHitRate: number
  /** 总关键帧数量 */
  totalKeyFrames: number
}

// ==================== 事件类型定义 ====================

/**
 * 关键帧事件数据
 * 注意：事件数据保留timelineItemId，因为事件可能在不同组件间传递
 */
export interface KeyFrameEventData {
  /** 事件类型 */
  type: 'added' | 'removed' | 'updated' | 'selected'
  /** 相关的关键帧 */
  keyFrame: KeyFrame
  /** 时间轴项目ID - 用于事件传递时的上下文标识 */
  timelineItemId: string
  /** 事件时间戳 */
  timestamp: number
}

/**
 * 动画事件数据
 * 注意：事件数据保留timelineItemId，因为事件可能在不同组件间传递
 */
export interface AnimationEventData {
  /** 事件类型 */
  type: 'started' | 'paused' | 'stopped' | 'completed'
  /** 时间轴项目ID - 用于事件传递时的上下文标识 */
  timelineItemId: string
  /** 动画配置 */
  config: AnimationConfig
  /** 事件时间戳 */
  timestamp: number
}

// ==================== 导出工具类型 ====================

/**
 * 关键帧导出数据格式
 */
export interface KeyFrameExportData {
  /** 版本号 */
  version: string
  /** 导出时间戳 */
  exportedAt: number
  /** 项目信息 */
  project: {
    name: string
    duration: number
  }
  /** 关键帧数据 */
  keyFrames: KeyFrame[]
  /** 动画配置 */
  animations: AnimationConfig[]
}

/**
 * 关键帧导入选项
 */
export interface KeyFrameImportOptions {
  /** 是否覆盖现有关键帧 */
  overwrite: boolean
  /** 是否验证数据完整性 */
  validate: boolean
  /** 时间偏移量（秒） */
  timeOffset?: number
}

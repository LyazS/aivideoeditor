/**
 * 动画转换器
 * 负责帧数与WebAV百分比格式的转换，生成WebAV兼容的动画配置
 */

import type {
  AnimationConfig,
  WebAVAnimationConfig,
  VideoTimeRange,
  ImageTimeRange,
  Keyframe,
} from '../types'
import { framesToMicroseconds } from '../stores/utils/timeUtils'
import { projectToWebavCoords } from './coordinateTransform'

// ==================== 转换核心函数 ====================

/**
 * 将帧数转换为相对于clip时长的百分比
 * @param frame 绝对帧数（相对于整个项目时间轴）
 * @param clipStartFrame clip在时间轴上的开始帧数
 * @param clipDurationFrames clip的总时长（帧数）
 * @returns 百分比字符串，如 "25%"
 */
export function framesToPercentage(
  frame: number,
  clipStartFrame: number,
  clipDurationFrames: number
): string {
  // 计算相对于clip开始的帧数
  const relativeFrame = frame - clipStartFrame
  
  // 计算百分比
  const percentage = (relativeFrame / clipDurationFrames) * 100
  
  // 确保百分比在0-100范围内
  const clampedPercentage = Math.max(0, Math.min(100, percentage))
  
  return `${clampedPercentage}%`
}

/**
 * 将关键帧转换为WebAV格式
 * @param keyframe 关键帧数据
 * @param canvasWidth 画布宽度（用于坐标转换）
 * @param canvasHeight 画布高度（用于坐标转换）
 * @param spriteWidth 精灵宽度（用于坐标转换）
 * @param spriteHeight 精灵高度（用于坐标转换）
 * @returns WebAV属性对象
 */
export function convertKeyframeToWebAV(
  keyframe: Keyframe,
  canvasWidth?: number,
  canvasHeight?: number,
  spriteWidth?: number,
  spriteHeight?: number
): Record<string, number> {
  const webavProps: Record<string, number> = {}

  // 转换变换属性（位置和尺寸）
  if (keyframe.properties.transform) {
    // 转换位置（需要坐标系转换）
    if (canvasWidth && canvasHeight && spriteWidth && spriteHeight) {
      const webavCoords = projectToWebavCoords(
        keyframe.properties.transform.x,
        keyframe.properties.transform.y,
        spriteWidth,
        spriteHeight,
        canvasWidth,
        canvasHeight
      )
      webavProps.x = webavCoords.x
      webavProps.y = webavCoords.y
    } else {
      // 如果没有提供画布信息，直接使用原值（向后兼容）
      console.warn('🎬 [Animation Converter] Missing canvas/sprite dimensions for coordinate conversion')
      webavProps.x = keyframe.properties.transform.x
      webavProps.y = keyframe.properties.transform.y
    }

    // 转换尺寸
    webavProps.w = keyframe.properties.transform.width
    webavProps.h = keyframe.properties.transform.height
  }

  // 转换旋转属性
  if (keyframe.properties.rotation !== undefined) {
    webavProps.angle = keyframe.properties.rotation
  }

  // 转换透明度属性
  if (keyframe.properties.opacity !== undefined) {
    webavProps.opacity = keyframe.properties.opacity
  }

  return webavProps
}

/**
 * 将动画配置转换为WebAV格式
 * @param animationConfig 动画配置
 * @param timeRange 时间范围信息
 * @returns WebAV动画配置
 */
export function convertToWebAVAnimation(
  animationConfig: AnimationConfig,
  timeRange: VideoTimeRange | ImageTimeRange,
  canvasWidth?: number,
  canvasHeight?: number,
  spriteWidth?: number,
  spriteHeight?: number
): WebAVAnimationConfig {
  // 验证输入参数
  if (!animationConfig || !timeRange) {
    throw new Error('Invalid animation config or time range')
  }

  if (!Array.isArray(animationConfig.keyframes)) {
    throw new Error('Invalid keyframes array')
  }

  const webavKeyframes: Record<string, Record<string, number>> = {}

  // 获取clip的开始时间和时长
  const clipStartFrame = timeRange.timelineStartTime
  const clipDurationFrames = 'effectiveDuration' in timeRange
    ? timeRange.effectiveDuration
    : timeRange.displayDuration

  // 验证时长
  if (clipDurationFrames <= 0) {
    console.warn('🎬 [Animation Converter] Invalid clip duration:', clipDurationFrames)
    return {
      keyframes: {},
      options: { duration: 0, iterCount: 1 }
    }
  }

  // 转换每个关键帧
  animationConfig.keyframes.forEach(keyframe => {
    try {
      // 验证关键帧
      if (typeof keyframe.frame !== 'number' || keyframe.frame < 0) {
        console.warn('🎬 [Animation Converter] Invalid keyframe frame:', keyframe.frame)
        return
      }

      // 检查关键帧是否在有效范围内
      if (!isKeyframeInRange(keyframe, timeRange)) {
        console.warn('🎬 [Animation Converter] Keyframe out of range:', {
          frame: keyframe.frame,
          range: { start: timeRange.timelineStartTime, end: timeRange.timelineEndTime }
        })
        return
      }

      // 计算百分比位置
      const percentage = framesToPercentage(
        keyframe.frame,
        clipStartFrame,
        clipDurationFrames
      )

      // 转换属性（传递画布和精灵尺寸信息）
      const webavProps = convertKeyframeToWebAV(
        keyframe,
        canvasWidth,
        canvasHeight,
        spriteWidth,
        spriteHeight
      )

      // 只有当有属性时才添加关键帧
      if (Object.keys(webavProps).length > 0) {
        webavKeyframes[percentage] = webavProps
      }
    } catch (error) {
      console.error('🎬 [Animation Converter] Error converting keyframe:', error)
    }
  })

  // 计算动画时长（微秒）
  const durationMicroseconds = framesToMicroseconds(clipDurationFrames)

  return {
    keyframes: webavKeyframes,
    options: {
      duration: Math.max(0, durationMicroseconds), // 确保时长不为负数
      iterCount: 1, // 默认播放一次
      easing: animationConfig.easing
    }
  }
}

// ==================== 验证和工具函数 ====================

/**
 * 验证动画配置是否有效
 * @param animationConfig 动画配置
 * @returns 是否有效
 */
export function isValidAnimationConfig(animationConfig: AnimationConfig): boolean {
  // 检查基本结构
  if (!animationConfig || !Array.isArray(animationConfig.keyframes)) {
    return false
  }

  // 检查是否启用
  if (!animationConfig.isEnabled) {
    return false
  }

  // 检查是否有关键帧
  if (animationConfig.keyframes.length === 0) {
    return false
  }

  // 检查关键帧是否有效
  return animationConfig.keyframes.every(keyframe => {
    // 检查帧数是否有效
    if (typeof keyframe.frame !== 'number' || keyframe.frame < 0) {
      return false
    }

    // 检查是否有属性
    if (!keyframe.properties || Object.keys(keyframe.properties).length === 0) {
      return false
    }

    return true
  })
}

/**
 * 检查关键帧是否在时间范围内
 * @param keyframe 关键帧
 * @param timeRange 时间范围
 * @returns 是否在范围内
 */
export function isKeyframeInRange(
  keyframe: Keyframe,
  timeRange: VideoTimeRange | ImageTimeRange
): boolean {
  const startFrame = timeRange.timelineStartTime
  const endFrame = timeRange.timelineEndTime

  return keyframe.frame >= startFrame && keyframe.frame <= endFrame
}

/**
 * 过滤时间范围内的关键帧
 * @param animationConfig 动画配置
 * @param timeRange 时间范围
 * @returns 过滤后的动画配置
 */
export function filterKeyframesInRange(
  animationConfig: AnimationConfig,
  timeRange: VideoTimeRange | ImageTimeRange
): AnimationConfig {
  const filteredKeyframes = animationConfig.keyframes.filter(keyframe =>
    isKeyframeInRange(keyframe, timeRange)
  )

  return {
    ...animationConfig,
    keyframes: filteredKeyframes
  }
}

/**
 * 获取动画配置的调试信息
 * @param animationConfig 动画配置
 * @param timeRange 时间范围
 * @returns 调试信息
 */
export function getAnimationDebugInfo(
  animationConfig: AnimationConfig,
  timeRange: VideoTimeRange | ImageTimeRange
) {
  const clipStartFrame = timeRange.timelineStartTime
  const clipDurationFrames = 'effectiveDuration' in timeRange 
    ? timeRange.effectiveDuration 
    : timeRange.displayDuration

  return {
    isValid: isValidAnimationConfig(animationConfig),
    keyframeCount: animationConfig.keyframes.length,
    duration: animationConfig.duration,
    clipStartFrame,
    clipDurationFrames,
    keyframes: animationConfig.keyframes.map(keyframe => ({
      frame: keyframe.frame,
      percentage: framesToPercentage(keyframe.frame, clipStartFrame, clipDurationFrames),
      properties: Object.keys(keyframe.properties),
      inRange: isKeyframeInRange(keyframe, timeRange)
    }))
  }
}

// ==================== 批量转换函数 ====================

/**
 * 批量转换多个动画配置
 * @param animations 动画配置数组
 * @param timeRanges 对应的时间范围数组
 * @returns WebAV动画配置数组
 */
export function convertMultipleAnimations(
  animations: AnimationConfig[],
  timeRanges: (VideoTimeRange | ImageTimeRange)[]
): WebAVAnimationConfig[] {
  if (animations.length !== timeRanges.length) {
    throw new Error('动画配置和时间范围数组长度不匹配')
  }

  return animations.map((animation, index) => {
    const timeRange = timeRanges[index]
    return convertToWebAVAnimation(animation, timeRange)
  })
}

/**
 * 合并多个WebAV动画配置
 * 注意：这个函数用于将多个动画合并为一个，需要小心处理冲突
 * @param configs WebAV动画配置数组
 * @returns 合并后的配置
 */
export function mergeWebAVAnimations(configs: WebAVAnimationConfig[]): WebAVAnimationConfig {
  if (configs.length === 0) {
    throw new Error('没有动画配置可合并')
  }

  if (configs.length === 1) {
    return configs[0]
  }

  // 合并关键帧（后面的会覆盖前面的）
  const mergedKeyframes: Record<string, Record<string, number>> = {}
  configs.forEach(config => {
    Object.assign(mergedKeyframes, config.keyframes)
  })

  // 使用最长的时长
  const maxDuration = Math.max(...configs.map(config => config.options.duration))

  return {
    keyframes: mergedKeyframes,
    options: {
      duration: maxDuration,
      iterCount: 1,
      easing: configs[0].options.easing // 使用第一个的缓动函数
    }
  }
}

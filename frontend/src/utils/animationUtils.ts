import type {
  AnimatableProperty,
  KeyFrame,
  AnimationConfig,
  KeyFrameProperty
} from '../types/animationTypes'
import type { TimelineItem } from '../types/videoTypes'

/**
 * 动画工具函数集合
 * 提供时间计算、关键帧查找等辅助功能
 */

/**
 * 将秒转换为动画相对时间（0-1）
 * @param timeInSeconds 时间（秒）
 * @param animationDuration 动画时长（微秒）
 * @returns 相对时间（0-1）
 */
export function secondsToRelativeTime(timeInSeconds: number, animationDuration: number): number {
  const animationDurationSeconds = animationDuration / 1_000_000
  const timeInCycle = timeInSeconds % animationDurationSeconds
  return Math.max(0, Math.min(1, timeInCycle / animationDurationSeconds))
}

/**
 * 将动画相对时间（0-1）转换为秒
 * @param relativeTime 相对时间（0-1）
 * @param animationDuration 动画时长（微秒）
 * @returns 时间（秒）
 */
export function relativeTimeToSeconds(relativeTime: number, animationDuration: number): number {
  const animationDurationSeconds = animationDuration / 1_000_000
  return relativeTime * animationDurationSeconds
}

/**
 * 获取TimelineItem在指定时间的属性值
 * @param timelineItem 时间轴项目
 * @param property 属性名
 * @param time 时间点（秒）
 * @returns 属性值，如果没有动画则返回当前值
 */
export function getPropertyValueAtTime(
  timelineItem: TimelineItem,
  property: AnimatableProperty,
  time: number
): number {
  // 如果没有动画配置，返回当前属性值
  if (!timelineItem.animationConfig || !timelineItem.animationConfig.isEnabled) {
    return getCurrentPropertyValue(timelineItem, property)
  }

  const config = timelineItem.animationConfig
  const relativeTime = secondsToRelativeTime(time, config.duration)

  // 查找包含该属性的关键帧
  const keyFramesWithProperty = config.keyFrames
    .filter(kf => kf.properties.some(p => p.property === property))
    .sort((a, b) => a.time - b.time)

  if (keyFramesWithProperty.length === 0) {
    return getCurrentPropertyValue(timelineItem, property)
  }

  // 如果时间在第一个关键帧之前
  if (relativeTime <= keyFramesWithProperty[0].time) {
    const firstKeyFrame = keyFramesWithProperty[0]
    const prop = firstKeyFrame.properties.find(p => p.property === property)
    return prop?.value ?? getCurrentPropertyValue(timelineItem, property)
  }

  // 如果时间在最后一个关键帧之后
  const lastKeyFrame = keyFramesWithProperty[keyFramesWithProperty.length - 1]
  if (relativeTime >= lastKeyFrame.time) {
    const prop = lastKeyFrame.properties.find(p => p.property === property)
    return prop?.value ?? getCurrentPropertyValue(timelineItem, property)
  }

  // 在两个关键帧之间，进行线性插值
  for (let i = 0; i < keyFramesWithProperty.length - 1; i++) {
    const currentKF = keyFramesWithProperty[i]
    const nextKF = keyFramesWithProperty[i + 1]

    if (relativeTime >= currentKF.time && relativeTime <= nextKF.time) {
      const currentProp = currentKF.properties.find(p => p.property === property)
      const nextProp = nextKF.properties.find(p => p.property === property)

      if (currentProp && nextProp) {
        // 线性插值
        const t = (relativeTime - currentKF.time) / (nextKF.time - currentKF.time)
        return currentProp.value + (nextProp.value - currentProp.value) * t
      }
    }
  }

  return getCurrentPropertyValue(timelineItem, property)
}

/**
 * 获取TimelineItem当前的属性值
 * @param timelineItem 时间轴项目
 * @param property 属性名
 * @returns 当前属性值
 */
export function getCurrentPropertyValue(timelineItem: TimelineItem, property: AnimatableProperty): number {
  switch (property) {
    case 'x':
      return timelineItem.x
    case 'y':
      return timelineItem.y
    case 'width':
      return timelineItem.width
    case 'height':
      return timelineItem.height
    case 'rotation':
      return timelineItem.rotation
    case 'opacity':
      return timelineItem.opacity
    default:
      return 0
  }
}

/**
 * 设置TimelineItem的属性值
 * @param timelineItem 时间轴项目
 * @param property 属性名
 * @param value 属性值
 */
export function setCurrentPropertyValue(
  timelineItem: TimelineItem,
  property: AnimatableProperty,
  value: number
): void {
  switch (property) {
    case 'x':
      timelineItem.x = value
      break
    case 'y':
      timelineItem.y = value
      break
    case 'width':
      timelineItem.width = value
      break
    case 'height':
      timelineItem.height = value
      break
    case 'rotation':
      timelineItem.rotation = value
      break
    case 'opacity':
      timelineItem.opacity = value
      break
  }
}

/**
 * 获取关键帧在时间轴上的所有时间点
 * @param config 动画配置
 * @returns 时间点数组（秒）
 */
export function getKeyFrameTimePoints(config: AnimationConfig): number[] {
  return config.keyFrames
    .map(kf => relativeTimeToSeconds(kf.time, config.duration))
    .sort((a, b) => a - b)
}

/**
 * 查找最近的关键帧时间点
 * @param config 动画配置
 * @param currentTime 当前时间（秒）
 * @param direction 查找方向：'prev' | 'next' | 'nearest'
 * @returns 最近的关键帧时间点（秒），如果没有找到返回null
 */
export function findNearestKeyFrameTime(
  config: AnimationConfig,
  currentTime: number,
  direction: 'prev' | 'next' | 'nearest' = 'nearest'
): number | null {
  const timePoints = getKeyFrameTimePoints(config)
  
  if (timePoints.length === 0) {
    return null
  }

  switch (direction) {
    case 'prev':
      // 查找小于当前时间的最大时间点
      const prevPoints = timePoints.filter(t => t < currentTime)
      return prevPoints.length > 0 ? Math.max(...prevPoints) : null

    case 'next':
      // 查找大于当前时间的最小时间点
      const nextPoints = timePoints.filter(t => t > currentTime)
      return nextPoints.length > 0 ? Math.min(...nextPoints) : null

    case 'nearest':
      // 查找最近的时间点
      let nearest = timePoints[0]
      let minDistance = Math.abs(timePoints[0] - currentTime)

      for (const timePoint of timePoints) {
        const distance = Math.abs(timePoint - currentTime)
        if (distance < minDistance) {
          minDistance = distance
          nearest = timePoint
        }
      }
      return nearest

    default:
      return null
  }
}

/**
 * 检查时间点是否接近关键帧（在容差范围内）
 * @param config 动画配置
 * @param time 时间点（秒）
 * @param tolerance 容差（秒），默认0.1秒
 * @returns 是否接近关键帧
 */
export function isNearKeyFrame(
  config: AnimationConfig,
  time: number,
  tolerance: number = 0.1
): boolean {
  const timePoints = getKeyFrameTimePoints(config)
  return timePoints.some(timePoint => Math.abs(timePoint - time) <= tolerance)
}

/**
 * 创建关键帧属性对象
 * @param property 属性名
 * @param value 属性值
 * @param interpolation 插值类型，默认'linear'
 * @returns 关键帧属性对象
 */
export function createKeyFrameProperty(
  property: AnimatableProperty,
  value: number,
  interpolation: 'linear' = 'linear'
): KeyFrameProperty {
  return {
    property,
    value,
    interpolation
  }
}

/**
 * 验证动画时长是否合理
 * @param duration 动画时长（微秒）
 * @returns 是否合理
 */
export function isValidAnimationDuration(duration: number): boolean {
  // 最小100毫秒，最大60秒
  return duration >= 100_000 && duration <= 60_000_000
}

/**
 * 格式化动画时长为可读字符串
 * @param duration 动画时长（微秒）
 * @returns 格式化字符串
 */
export function formatAnimationDuration(duration: number): string {
  const seconds = duration / 1_000_000
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)}ms`
  } else if (seconds < 60) {
    return `${seconds.toFixed(1)}s`
  } else {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`
  }
}

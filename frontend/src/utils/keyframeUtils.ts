/**
 * 关键帧管理工具函数
 * 提供关键帧的增删改查、类型守卫和基础工具函数
 */

import type {
  TimelineItem,
  Keyframe,
  AnimationConfig,
  AnimatableProperty,
} from '../types'

// ==================== 类型守卫函数 ====================

/**
 * 检查时间轴项目是否有动画
 */
export function hasAnimation(item: TimelineItem): boolean {
  return !!(item.animation && item.animation.isEnabled && item.animation.keyframes.length > 0)
}

/**
 * 检查属性是否有关键帧
 */
export function hasPropertyKeyframes(item: TimelineItem, property: AnimatableProperty): boolean {
  if (!item.animation) return false
  return item.animation.keyframes.some(keyframe =>
    keyframe.properties.hasOwnProperty(property)
  )
}

/**
 * 获取指定帧位置的关键帧
 */
export function getKeyframeAtFrame(item: TimelineItem, frame: number): Keyframe | undefined {
  if (!item.animation) return undefined
  return item.animation.keyframes.find(keyframe => keyframe.frame === frame)
}

/**
 * 检查指定帧位置是否有关键帧
 */
export function hasKeyframeAtFrame(item: TimelineItem, frame: number): boolean {
  return !!getKeyframeAtFrame(item, frame)
}

/**
 * 获取属性的所有关键帧
 */
export function getPropertyKeyframes(item: TimelineItem, property: AnimatableProperty): Keyframe[] {
  if (!item.animation) return []
  return item.animation.keyframes.filter(keyframe =>
    keyframe.properties.hasOwnProperty(property)
  )
}

// ==================== 关键帧操作函数 ====================

/**
 * 初始化动画配置
 * 如果TimelineItem没有动画配置，创建一个新的
 */
export function initializeAnimation(item: TimelineItem): void {
  if (!item.animation) {
    item.animation = {
      keyframes: [],
      isEnabled: true,
      duration: 0
    }
  }
}

/**
 * 创建或更新关键帧
 * 如果指定帧位置已有关键帧，则更新；否则创建新的
 */
export function setKeyframeProperty(
  item: TimelineItem,
  frame: number,
  property: AnimatableProperty,
  value: any
): void {
  // 验证输入参数
  if (!item) {
    console.error('🎬 [Keyframe Utils] Invalid timeline item')
    return
  }

  if (typeof frame !== 'number' || frame < 0) {
    console.error('🎬 [Keyframe Utils] Invalid frame number:', frame)
    return
  }

  if (!property || !['transform', 'rotation', 'opacity'].includes(property)) {
    console.error('🎬 [Keyframe Utils] Invalid property:', property)
    return
  }

  if (value === undefined || value === null) {
    console.error('🎬 [Keyframe Utils] Invalid property value:', value)
    return
  }

  // 检查帧数是否在时间轴项目的范围内
  const timeRange = item.timeRange
  if (frame < timeRange.timelineStartTime || frame > timeRange.timelineEndTime) {
    console.warn('🎬 [Keyframe Utils] Frame out of timeline range:', {
      frame,
      range: { start: timeRange.timelineStartTime, end: timeRange.timelineEndTime }
    })
    // 仍然允许创建，但给出警告
  }

  // 确保有动画配置
  initializeAnimation(item)

  // 查找现有关键帧或创建新的
  let keyframe = item.animation!.keyframes.find(kf => kf.frame === frame)
  if (!keyframe) {
    keyframe = { frame, properties: {} }
    item.animation!.keyframes.push(keyframe)
    // 按帧数排序
    item.animation!.keyframes.sort((a, b) => a.frame - b.frame)
  }

  // 设置属性值
  keyframe.properties[property] = value

  // 更新动画时长
  updateAnimationDuration(item)

  console.log('🎬 [Keyframe Utils] Keyframe property set:', {
    itemId: item.id,
    frame,
    property,
    value
  })
}

/**
 * 设置变换关键帧（位置和尺寸）
 */
export function setTransformKeyframe(
  item: TimelineItem,
  frame: number,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  setKeyframeProperty(item, frame, 'transform', { x, y, width, height })
}

/**
 * 设置位置关键帧（向后兼容）
 * @deprecated 请使用 setTransformKeyframe
 */
export function setPositionKeyframe(item: TimelineItem, frame: number, x: number, y: number): void {
  // 获取当前尺寸，保持不变
  const currentWidth = item.width
  const currentHeight = item.height
  setTransformKeyframe(item, frame, x, y, currentWidth, currentHeight)
}

/**
 * 设置尺寸关键帧（向后兼容）
 * @deprecated 请使用 setTransformKeyframe
 */
export function setSizeKeyframe(item: TimelineItem, frame: number, width: number, height: number): void {
  // 获取当前位置，保持不变
  const currentX = item.x
  const currentY = item.y
  setTransformKeyframe(item, frame, currentX, currentY, width, height)
}

/**
 * 设置旋转关键帧
 */
export function setRotationKeyframe(item: TimelineItem, frame: number, rotation: number): void {
  setKeyframeProperty(item, frame, 'rotation', rotation)
}

/**
 * 设置透明度关键帧
 */
export function setOpacityKeyframe(item: TimelineItem, frame: number, opacity: number): void {
  setKeyframeProperty(item, frame, 'opacity', opacity)
}

/**
 * 删除指定帧位置的关键帧
 */
export function removeKeyframe(item: TimelineItem, frame: number): boolean {
  if (!item.animation) return false

  const index = item.animation.keyframes.findIndex(kf => kf.frame === frame)
  if (index === -1) return false

  item.animation.keyframes.splice(index, 1)
  updateAnimationDuration(item)
  return true
}

/**
 * 删除属性的所有关键帧
 */
export function removePropertyKeyframes(item: TimelineItem, property: AnimatableProperty): void {
  if (!item.animation) return

  // 从所有关键帧中移除该属性
  item.animation.keyframes.forEach(keyframe => {
    delete keyframe.properties[property]
  })

  // 移除空的关键帧（没有任何属性的关键帧）
  item.animation.keyframes = item.animation.keyframes.filter(keyframe =>
    Object.keys(keyframe.properties).length > 0
  )

  updateAnimationDuration(item)
}

/**
 * 清除所有关键帧
 */
export function clearAllKeyframes(item: TimelineItem): void {
  if (!item.animation) return
  item.animation.keyframes = []
  item.animation.duration = 0
}

/**
 * 更新动画时长
 * 根据最后一个关键帧的位置更新动画总时长
 */
export function updateAnimationDuration(item: TimelineItem): void {
  if (!item.animation || item.animation.keyframes.length === 0) {
    if (item.animation) {
      item.animation.duration = 0
    }
    return
  }

  const maxFrame = Math.max(...item.animation.keyframes.map(kf => kf.frame))
  item.animation.duration = maxFrame
}

// ==================== 关键帧查询函数 ====================

/**
 * 获取所有关键帧的帧位置
 */
export function getAllKeyframeFrames(item: TimelineItem): number[] {
  if (!item.animation) return []
  return item.animation.keyframes.map(kf => kf.frame).sort((a, b) => a - b)
}

/**
 * 获取下一个关键帧位置
 */
export function getNextKeyframeFrame(item: TimelineItem, currentFrame: number): number | null {
  const frames = getAllKeyframeFrames(item)
  const nextFrame = frames.find(frame => frame > currentFrame)
  return nextFrame ?? null
}

/**
 * 获取上一个关键帧位置
 */
export function getPreviousKeyframeFrame(item: TimelineItem, currentFrame: number): number | null {
  const frames = getAllKeyframeFrames(item)
  const previousFrames = frames.filter(frame => frame < currentFrame)
  return previousFrames.length > 0 ? previousFrames[previousFrames.length - 1] : null
}

/**
 * 获取当前属性值（从TimelineItem）
 * 用于创建关键帧时获取当前值
 */
export function getCurrentPropertyValue(item: TimelineItem, property: AnimatableProperty): any {
  switch (property) {
    case 'transform':
      return { x: item.x, y: item.y, width: item.width, height: item.height }
    case 'rotation':
      return item.rotation
    case 'opacity':
      return item.opacity
    default:
      return undefined
  }
}

/**
 * 创建初始关键帧
 * 在当前帧位置创建包含当前属性值的关键帧
 */
export function createInitialKeyframe(
  item: TimelineItem,
  frame: number,
  property: AnimatableProperty
): void {
  const currentValue = getCurrentPropertyValue(item, property)
  if (currentValue !== undefined) {
    setKeyframeProperty(item, frame, property, currentValue)
  }
}

// ==================== 动画状态管理 ====================

/**
 * 启用动画
 */
export function enableAnimation(item: TimelineItem): void {
  initializeAnimation(item)
  item.animation!.isEnabled = true
}

/**
 * 禁用动画
 */
export function disableAnimation(item: TimelineItem): void {
  if (item.animation) {
    item.animation.isEnabled = false
  }
}

/**
 * 检查动画是否启用
 */
export function isAnimationEnabled(item: TimelineItem): boolean {
  return !!(item.animation && item.animation.isEnabled)
}

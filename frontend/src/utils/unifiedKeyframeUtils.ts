/**
 * 统一关键帧工具函数
 * 实现统一关键帧系统的核心逻辑，包括关键帧的增删改查、状态判断和交互逻辑
 */

import type {
  TimelineItem,
  Keyframe,
  AnimationConfig,
  KeyframeProperties,
  KeyframeButtonState,
  KeyframeUIState,
} from '../types'

// ==================== 关键帧位置转换工具函数 ====================

/**
 * 将绝对帧数转换为相对于clip开始的帧数
 * @param absoluteFrame 绝对帧数（相对于整个项目时间轴）
 * @param timeRange clip的时间范围
 * @returns 相对于clip开始的帧数
 */
export function absoluteFrameToRelativeFrame(absoluteFrame: number, timeRange: any): number {
  const clipStartFrame = timeRange.timelineStartTime
  const relativeFrame = absoluteFrame - clipStartFrame

  // 确保相对帧数不小于0
  return Math.max(0, relativeFrame)
}

/**
 * 将相对于clip开始的帧数转换为绝对帧数
 * @param relativeFrame 相对于clip开始的帧数
 * @param timeRange clip的时间范围
 * @returns 绝对帧数（相对于整个项目时间轴）
 */
export function relativeFrameToAbsoluteFrame(relativeFrame: number, timeRange: any): number {
  const clipStartFrame = timeRange.timelineStartTime
  return clipStartFrame + relativeFrame
}

/**
 * 计算关键帧位置的精度阈值（基于帧数）
 * @param timeRange clip的时间范围
 * @returns 精度阈值（帧数）
 */
export function getKeyframePositionTolerance(timeRange: any): number {
  // 使用0帧作为精确匹配，确保只有完全相同的帧数才被认为是关键帧位置
  return 0
}

// ==================== 关键帧基础操作 ====================

/**
 * 初始化动画配置
 * 如果TimelineItem没有动画配置，则创建一个空的配置
 */
export function initializeAnimation(item: TimelineItem): void {
  if (!item.animation) {
    item.animation = {
      keyframes: [],
      isEnabled: false,
      easing: 'linear',
    }
  }
}

/**
 * 创建包含所有属性的关键帧
 * @param item 时间轴项目
 * @param absoluteFrame 绝对帧数（相对于整个项目时间轴）
 * @returns 新创建的关键帧
 */
export function createKeyframe(item: TimelineItem, absoluteFrame: number): Keyframe {
  const relativeFrame = absoluteFrameToRelativeFrame(absoluteFrame, item.timeRange)

  return {
    framePosition: relativeFrame,
    properties: {
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      rotation: item.rotation,
      opacity: item.opacity,
    },
  }
}

/**
 * 检查是否有动画
 */
export function hasAnimation(item: TimelineItem): boolean {
  return !!(item.animation && item.animation.isEnabled && item.animation.keyframes.length > 0)
}

/**
 * 检查当前帧是否在关键帧位置
 */
export function isCurrentFrameOnKeyframe(item: TimelineItem, absoluteFrame: number): boolean {
  if (!item.animation) return false

  const relativeFrame = absoluteFrameToRelativeFrame(absoluteFrame, item.timeRange)
  const tolerance = getKeyframePositionTolerance(item.timeRange)

  return item.animation.keyframes.some(
    (kf) => Math.abs(kf.framePosition - relativeFrame) <= tolerance,
  )
}

/**
 * 获取关键帧按钮状态
 */
export function getKeyframeButtonState(
  item: TimelineItem,
  currentFrame: number,
): KeyframeButtonState {
  if (!hasAnimation(item)) {
    return 'none' // 黑色
  }

  if (isCurrentFrameOnKeyframe(item, currentFrame)) {
    return 'on-keyframe' // 蓝色
  }

  return 'between-keyframes' // 金色
}

/**
 * 获取关键帧UI状态
 */
export function getKeyframeUIState(item: TimelineItem, currentFrame: number): KeyframeUIState {
  return {
    hasAnimation: hasAnimation(item),
    isOnKeyframe: isCurrentFrameOnKeyframe(item, currentFrame),
  }
}

// ==================== 关键帧操作 ====================

/**
 * 在指定帧位置查找关键帧
 */
function findKeyframeAtFrame(item: TimelineItem, absoluteFrame: number): Keyframe | undefined {
  if (!item.animation) return undefined

  const relativeFrame = absoluteFrameToRelativeFrame(absoluteFrame, item.timeRange)
  const tolerance = getKeyframePositionTolerance(item.timeRange)

  return item.animation.keyframes.find(
    (kf) => Math.abs(kf.framePosition - relativeFrame) <= tolerance,
  )
}

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
    item.animation.keyframes = []
  }
}

/**
 * 删除指定帧位置的关键帧
 */
export function removeKeyframeAtFrame(item: TimelineItem, absoluteFrame: number): boolean {
  if (!item.animation) return false

  const relativeFrame = absoluteFrameToRelativeFrame(absoluteFrame, item.timeRange)
  const tolerance = getKeyframePositionTolerance(item.timeRange)
  const initialLength = item.animation.keyframes.length

  item.animation.keyframes = item.animation.keyframes.filter(
    (kf) => Math.abs(kf.framePosition - relativeFrame) > tolerance,
  )

  const removed = item.animation.keyframes.length < initialLength
  if (removed) {
    console.log('🎬 [Unified Keyframe] Removed keyframe at frame:', absoluteFrame)
  }

  return removed
}

// ==================== 关键帧时长变化处理 ====================

/**
 * 当clip时长变化时，重新计算所有关键帧的位置
 * @param item 时间轴项目
 * @param oldDurationFrames 原始时长（帧数）
 * @param newDurationFrames 新时长（帧数）
 */
export function adjustKeyframesForDurationChange(
  item: TimelineItem,
  oldDurationFrames: number,
  newDurationFrames: number,
): void {
  if (!item.animation || item.animation.keyframes.length === 0) return
  if (oldDurationFrames <= 0 || newDurationFrames <= 0) return

  console.log('🎬 [Unified Keyframe] Adjusting keyframes for duration change:', {
    itemId: item.id,
    oldDuration: oldDurationFrames,
    newDuration: newDurationFrames,
    keyframeCount: item.animation.keyframes.length,
  })

  // 为每个关键帧重新计算位置
  item.animation.keyframes.forEach((keyframe) => {
    // 计算在原时长中的百分比位置
    const percentagePosition = keyframe.framePosition / oldDurationFrames

    // 根据新时长计算新的帧位置
    const newFramePosition = Math.round(percentagePosition * newDurationFrames)

    // 确保新位置在有效范围内
    keyframe.framePosition = Math.max(0, Math.min(newDurationFrames, newFramePosition))

    console.log('🎬 [Unified Keyframe] Adjusted keyframe position:', {
      oldPosition: keyframe.framePosition,
      percentage: percentagePosition,
      newPosition: keyframe.framePosition,
    })
  })

  // 移除超出新时长范围的关键帧
  const validKeyframes = item.animation.keyframes.filter(
    (kf) => kf.framePosition <= newDurationFrames,
  )
  const removedCount = item.animation.keyframes.length - validKeyframes.length

  if (removedCount > 0) {
    item.animation.keyframes = validKeyframes
    console.log('🎬 [Unified Keyframe] Removed keyframes beyond new duration:', removedCount)
  }

  // 按位置排序关键帧
  sortKeyframes(item)
}

/**
 * 按帧位置排序关键帧
 */
export function sortKeyframes(item: TimelineItem): void {
  if (!item.animation) return

  item.animation.keyframes.sort((a, b) => a.framePosition - b.framePosition)
}

// ==================== 统一关键帧交互逻辑 ====================

/**
 * 处理关键帧按钮点击 - 状态1：黑色（无动画）→ 蓝色
 */
function handleClick_NoAnimation(item: TimelineItem, currentFrame: number): void {
  // 1. 启用动画
  enableAnimation(item)

  // 2. 在当前帧创建包含所有属性的关键帧
  const keyframe = createKeyframe(item, currentFrame)
  item.animation!.keyframes.push(keyframe)

  // 3. 排序关键帧
  sortKeyframes(item)

  console.log('🎬 [Unified Keyframe] Created initial keyframe:', {
    itemId: item.id,
    frame: currentFrame,
    keyframe,
  })
}

/**
 * 处理关键帧按钮点击 - 状态2：蓝色（在关键帧）→ 金色或黑色
 */
function handleClick_OnKeyframe(item: TimelineItem, currentFrame: number): void {
  // 1. 删除当前帧的关键帧
  removeKeyframeAtFrame(item, currentFrame)

  // 2. 检查是否还有其他关键帧
  if (item.animation!.keyframes.length > 0) {
    // 还有其他关键帧：蓝色 → 金色
    console.log('🎬 [Unified Keyframe] Removed keyframe, animation continues:', {
      itemId: item.id,
      frame: currentFrame,
      remainingKeyframes: item.animation!.keyframes.length,
    })
  } else {
    // 没有其他关键帧：蓝色 → 黑色
    disableAnimation(item)
    console.log('🎬 [Unified Keyframe] Removed last keyframe, disabled animation:', {
      itemId: item.id,
      frame: currentFrame,
    })
  }
}

/**
 * 处理关键帧按钮点击 - 状态3：金色（不在关键帧）→ 蓝色
 */
function handleClick_BetweenKeyframes(item: TimelineItem, currentFrame: number): void {
  // 1. 在当前帧创建包含所有属性的关键帧
  const keyframe = createKeyframe(item, currentFrame)
  item.animation!.keyframes.push(keyframe)

  // 2. 排序关键帧
  sortKeyframes(item)

  console.log('🎬 [Unified Keyframe] Created new keyframe:', {
    itemId: item.id,
    frame: currentFrame,
    keyframe,
  })
}

/**
 * 统一关键帧切换逻辑
 * 根据当前状态执行相应的操作
 */
export function toggleKeyframe(item: TimelineItem, currentFrame: number): void {
  if (!item) {
    console.error('🎬 [Unified Keyframe] Invalid timeline item')
    return
  }

  const buttonState = getKeyframeButtonState(item, currentFrame)

  switch (buttonState) {
    case 'none':
      handleClick_NoAnimation(item, currentFrame)
      break
    case 'on-keyframe':
      handleClick_OnKeyframe(item, currentFrame)
      break
    case 'between-keyframes':
      handleClick_BetweenKeyframes(item, currentFrame)
      break
  }
}

// ==================== 属性修改处理 ====================

/**
 * 处理属性修改 - 状态1：黑色（无动画）
 */
function handlePropertyChange_NoAnimation(item: TimelineItem, property: string, value: any): void {
  // 直接更新属性值，不创建关键帧
  ;(item as any)[property] = value

  console.log('🎬 [Unified Keyframe] Property updated without animation:', {
    itemId: item.id,
    property,
    value,
  })
}

/**
 * 处理属性修改 - 状态2：蓝色（在关键帧）
 */
function handlePropertyChange_OnKeyframe(
  item: TimelineItem,
  currentFrame: number,
  property: string,
  value: any,
): void {
  // 1. 更新TimelineItem属性
  ;(item as any)[property] = value

  // 2. 找到当前帧的关键帧并更新
  const keyframe = findKeyframeAtFrame(item, currentFrame)
  if (keyframe) {
    ;(keyframe.properties as any)[property] = value
  }

  console.log('🎬 [Unified Keyframe] Updated keyframe property:', {
    itemId: item.id,
    frame: currentFrame,
    property,
    value,
  })
}

/**
 * 处理属性修改 - 状态3：金色（不在关键帧）
 */
function handlePropertyChange_BetweenKeyframes(
  item: TimelineItem,
  currentFrame: number,
  property: string,
  value: any,
): void {
  // 1. 更新TimelineItem属性
  ;(item as any)[property] = value

  // 2. 在当前帧创建新关键帧（包含所有属性的当前值）
  const keyframe = createKeyframe(item, currentFrame)
  item.animation!.keyframes.push(keyframe)

  console.log('🎬 [Unified Keyframe] Created keyframe for property change:', {
    itemId: item.id,
    frame: currentFrame,
    property,
    value,
  })
}

/**
 * 统一属性修改处理
 */
export function handlePropertyChange(
  item: TimelineItem,
  currentFrame: number,
  property: string,
  value: any,
): void {
  if (!item) {
    console.error('🎬 [Unified Keyframe] Invalid timeline item')
    return
  }

  const buttonState = getKeyframeButtonState(item, currentFrame)

  switch (buttonState) {
    case 'none':
      handlePropertyChange_NoAnimation(item, property, value)
      break
    case 'on-keyframe':
      handlePropertyChange_OnKeyframe(item, currentFrame, property, value)
      break
    case 'between-keyframes':
      handlePropertyChange_BetweenKeyframes(item, currentFrame, property, value)
      break
  }
}

// ==================== 关键帧导航 ====================

/**
 * 获取上一个关键帧的帧数
 */
export function getPreviousKeyframeFrame(item: TimelineItem, currentFrame: number): number | null {
  if (!item.animation || item.animation.keyframes.length === 0) return null

  const currentRelativeFrame = absoluteFrameToRelativeFrame(currentFrame, item.timeRange)

  // 找到所有在当前位置之前的关键帧
  const previousKeyframes = item.animation.keyframes
    .filter((kf) => kf.framePosition < currentRelativeFrame)
    .sort((a, b) => b.framePosition - a.framePosition) // 按位置降序排列

  if (previousKeyframes.length === 0) return null

  // 返回最近的上一个关键帧的绝对帧数
  return relativeFrameToAbsoluteFrame(previousKeyframes[0].framePosition, item.timeRange)
}

/**
 * 获取下一个关键帧的帧数
 */
export function getNextKeyframeFrame(item: TimelineItem, currentFrame: number): number | null {
  if (!item.animation || item.animation.keyframes.length === 0) return null

  const currentRelativeFrame = absoluteFrameToRelativeFrame(currentFrame, item.timeRange)

  // 找到所有在当前位置之后的关键帧
  const nextKeyframes = item.animation.keyframes
    .filter((kf) => kf.framePosition > currentRelativeFrame)
    .sort((a, b) => a.framePosition - b.framePosition) // 按位置升序排列

  if (nextKeyframes.length === 0) return null

  // 返回最近的下一个关键帧的绝对帧数
  return relativeFrameToAbsoluteFrame(nextKeyframes[0].framePosition, item.timeRange)
}

// ==================== 清理和重置 ====================

/**
 * 清除所有关键帧
 */
export function clearAllKeyframes(item: TimelineItem): void {
  if (!item.animation) return

  item.animation.keyframes = []
  item.animation.isEnabled = false

  console.log('🎬 [Unified Keyframe] Cleared all keyframes:', {
    itemId: item.id,
  })
}

/**
 * 获取关键帧总数
 */
export function getKeyframeCount(item: TimelineItem): number {
  return item.animation?.keyframes.length || 0
}

/**
 * 获取所有关键帧的帧数列表（按时间顺序）
 */
export function getAllKeyframeFrames(item: TimelineItem): number[] {
  if (!item.animation) return []

  return item.animation.keyframes
    .map((kf) => relativeFrameToAbsoluteFrame(kf.framePosition, item.timeRange))
    .sort((a, b) => a - b)
}

// ==================== 调试和验证 ====================

/**
 * 验证关键帧数据的完整性
 */
export function validateKeyframes(item: TimelineItem): boolean {
  if (!item.animation) return true

  const clipDurationFrames = item.timeRange.timelineEndTime - item.timeRange.timelineStartTime

  for (const keyframe of item.animation.keyframes) {
    // 检查位置是否在有效范围内（使用帧数）
    if (keyframe.framePosition < 0 || keyframe.framePosition > clipDurationFrames) {
      console.warn('🎬 [Unified Keyframe] Invalid keyframe position:', {
        framePosition: keyframe.framePosition,
        clipDuration: clipDurationFrames,
      })
      return false
    }

    // 检查属性是否完整
    const props = keyframe.properties
    if (
      typeof props.x !== 'number' ||
      typeof props.y !== 'number' ||
      typeof props.width !== 'number' ||
      typeof props.height !== 'number' ||
      typeof props.rotation !== 'number' ||
      typeof props.opacity !== 'number'
    ) {
      console.warn('🎬 [Unified Keyframe] Incomplete keyframe properties:', props)
      return false
    }
  }

  return true
}

/**
 * 输出关键帧调试信息
 */
export function debugKeyframes(item: TimelineItem): void {
  console.group('🎬 [Unified Keyframe Debug]')

  console.log('Item:', {
    id: item.id,
    hasAnimation: hasAnimation(item),
    keyframeCount: getKeyframeCount(item),
  })

  if (item.animation) {
    console.log('Animation Config:', {
      isEnabled: item.animation.isEnabled,
      easing: item.animation.easing,
      keyframes: item.animation.keyframes,
    })

    console.log('Keyframe Frames:', getAllKeyframeFrames(item))
    console.log('Validation:', validateKeyframes(item))
  }

  console.groupEnd()
}

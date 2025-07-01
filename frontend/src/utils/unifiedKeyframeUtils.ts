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
import { hasVisualProps } from '../types'

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

  if (hasVisualProps(item)) {
    if (item.mediaType === 'video') {
      return {
        framePosition: relativeFrame,
        properties: {
          x: item.config.x,
          y: item.config.y,
          width: item.config.width,
          height: item.config.height,
          rotation: item.config.rotation,
          opacity: item.config.opacity,
          zIndex: item.config.zIndex,
          volume: item.config.volume,
        },
      } as Keyframe<'video'>
    } else {
      // image 类型
      return {
        framePosition: relativeFrame,
        properties: {
          x: item.config.x,
          y: item.config.y,
          width: item.config.width,
          height: item.config.height,
          rotation: item.config.rotation,
          opacity: item.config.opacity,
          zIndex: item.config.zIndex,
        },
      } as Keyframe<'image'>
    }
  } else {
    // 音频类型
    return {
      framePosition: relativeFrame,
      properties: {
        volume: (item.config as any).volume ?? 1,
      },
    } as Keyframe<'audio'>
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
 * 批量更新属性值（优化版本，避免重复位置计算）
 * 特别适用于同时更新width和height的情况
 */
export async function updatePropertiesBatchViaWebAV(
  item: TimelineItem,
  properties: Record<string, any>,
): Promise<void> {
  const sprite = item.sprite
  if (!sprite) {
    console.warn('🎬 [Unified Keyframe] No sprite found for item:', item.id)
    return
  }

  try {
    // 检查是否同时更新width和height
    const hasWidth = 'width' in properties
    const hasHeight = 'height' in properties

    if (hasWidth && hasHeight && hasVisualProps(item)) {
      // 🎯 批量处理尺寸更新：一次性计算位置，避免重复计算
      const { projectToWebavCoords } = await import('./coordinateTransform')
      const { useVideoStore } = await import('../stores/videoStore')
      const videoStore = useVideoStore()

      // 获取当前中心位置（项目坐标系）
      const currentCenterX = item.config.x
      const currentCenterY = item.config.y
      const newWidth = properties.width
      const newHeight = properties.height

      // 同时更新尺寸
      sprite.rect.w = newWidth
      sprite.rect.h = newHeight

      // 一次性重新计算WebAV坐标（保持中心位置不变）
      const webavCoords = projectToWebavCoords(
        currentCenterX,
        currentCenterY,
        newWidth,
        newHeight,
        videoStore.videoResolution.width,
        videoStore.videoResolution.height,
      )
      sprite.rect.x = webavCoords.x
      sprite.rect.y = webavCoords.y

      console.log('🎯 [Batch Center Scale] Size adjustment:', {
        itemId: item.id,
        centerPosition: { x: currentCenterX, y: currentCenterY },
        oldSize: { w: item.config.width, h: item.config.height },
        newSize: { w: newWidth, h: newHeight },
        newWebAVPos: { x: webavCoords.x, y: webavCoords.y },
      })

      // 移除已处理的属性
      const remainingProperties = { ...properties }
      delete remainingProperties.width
      delete remainingProperties.height

      // 处理剩余属性
      for (const [prop, val] of Object.entries(remainingProperties)) {
        await updatePropertyViaWebAV(item, prop, val)
      }
    } else {
      // 逐个处理属性（原有逻辑）
      for (const [prop, val] of Object.entries(properties)) {
        await updatePropertyViaWebAV(item, prop, val)
      }
    }

    // 触发渲染更新
    const { useVideoStore } = await import('../stores/videoStore')
    const videoStore = useVideoStore()
    const avCanvas = videoStore.avCanvas
    if (avCanvas) {
      const currentTime = videoStore.currentFrame * (1000000 / 30) // 转换为微秒
      avCanvas.previewFrame(currentTime)
    }
  } catch (error) {
    console.error('批量更新属性失败:', error)
  }
}

/**
 * 通过WebAV更新属性值（遵循正确的数据流向）
 */
async function updatePropertyViaWebAV(
  item: TimelineItem,
  property: string,
  value: any,
): Promise<void> {
  const sprite = item.sprite
  if (!sprite) {
    console.warn('🎬 [Unified Keyframe] No sprite found for item:', item.id)
    return
  }

  try {
    if (property === 'x' || property === 'y') {
      // 位置更新需要坐标转换
      const { projectToWebavCoords } = await import('./coordinateTransform')
      const { useVideoStore } = await import('../stores/videoStore')
      const videoStore = useVideoStore()

      const webavCoords = projectToWebavCoords(
        property === 'x' ? value : hasVisualProps(item) ? item.config.x : 0,
        property === 'y' ? value : hasVisualProps(item) ? item.config.y : 0,
        hasVisualProps(item) ? item.config.width : 0,
        hasVisualProps(item) ? item.config.height : 0,
        videoStore.videoResolution.width,
        videoStore.videoResolution.height,
      )
      sprite.rect.x = webavCoords.x
      sprite.rect.y = webavCoords.y
    } else if (property === 'width') {
      // 中心缩放：保持中心位置不变，更新宽度
      const { projectToWebavCoords } = await import('./coordinateTransform')
      const { useVideoStore } = await import('../stores/videoStore')
      const videoStore = useVideoStore()

      if (hasVisualProps(item)) {
        // 获取当前中心位置（项目坐标系）
        const currentCenterX = item.config.x
        const currentCenterY = item.config.y
        const newWidth = value
        const currentHeight = item.config.height

        // 更新尺寸
        sprite.rect.w = newWidth

        // 根据新尺寸重新计算WebAV坐标（保持中心位置不变）
        const webavCoords = projectToWebavCoords(
          currentCenterX,
          currentCenterY,
          newWidth,
          currentHeight,
          videoStore.videoResolution.width,
          videoStore.videoResolution.height,
        )
        sprite.rect.x = webavCoords.x
        sprite.rect.y = webavCoords.y

        console.log('🎯 [Center Scale] Width adjustment:', {
          itemId: item.id,
          centerPosition: { x: currentCenterX, y: currentCenterY },
          oldSize: { w: item.config.width, h: currentHeight },
          newSize: { w: newWidth, h: currentHeight },
          oldWebAVPos: { x: sprite.rect.x, y: sprite.rect.y },
          newWebAVPos: { x: webavCoords.x, y: webavCoords.y },
        })
      }
    } else if (property === 'height') {
      // 中心缩放：保持中心位置不变，更新高度
      const { projectToWebavCoords } = await import('./coordinateTransform')
      const { useVideoStore } = await import('../stores/videoStore')
      const videoStore = useVideoStore()

      if (hasVisualProps(item)) {
        // 获取当前中心位置（项目坐标系）
        const currentCenterX = item.config.x
        const currentCenterY = item.config.y
        const currentWidth = item.config.width
        const newHeight = value

        // 更新尺寸
        sprite.rect.h = newHeight

        // 根据新尺寸重新计算WebAV坐标（保持中心位置不变）
        const webavCoords = projectToWebavCoords(
          currentCenterX,
          currentCenterY,
          currentWidth,
          newHeight,
          videoStore.videoResolution.width,
          videoStore.videoResolution.height,
        )
        sprite.rect.x = webavCoords.x
        sprite.rect.y = webavCoords.y

        console.log('🎯 [Center Scale] Height adjustment:', {
          itemId: item.id,
          centerPosition: { x: currentCenterX, y: currentCenterY },
          oldSize: { w: currentWidth, h: item.config.height },
          newSize: { w: currentWidth, h: newHeight },
          oldWebAVPos: { x: sprite.rect.x, y: sprite.rect.y },
          newWebAVPos: { x: webavCoords.x, y: webavCoords.y },
        })
      }
    } else if (property === 'rotation') {
      sprite.rect.angle = value
    } else if (property === 'opacity') {
      sprite.opacity = value
    }

    // 触发渲染更新
    const { useVideoStore } = await import('../stores/videoStore')
    const videoStore = useVideoStore()
    const avCanvas = videoStore.avCanvas
    if (avCanvas) {
      const currentTime = videoStore.currentFrame * (1000000 / 30)
      avCanvas.previewFrame(currentTime)
    }
  } catch (error) {
    console.error('🎬 [Unified Keyframe] Failed to update property via WebAV:', error)
  }
}

/**
 * 处理属性修改 - 状态1：黑色（无动画）
 */
async function handlePropertyChange_NoAnimation(
  item: TimelineItem,
  property: string,
  value: any,
): Promise<void> {
  // 通过WebAV更新属性值，propsChange事件会自动同步到TimelineItem
  await updatePropertyViaWebAV(item, property, value)

  console.log('🎬 [Unified Keyframe] Property updated without animation via WebAV:', {
    itemId: item.id,
    property,
    value,
  })
}

/**
 * 处理属性修改 - 状态2：蓝色（在关键帧）
 */
async function handlePropertyChange_OnKeyframe(
  item: TimelineItem,
  currentFrame: number,
  property: string,
  value: any,
): Promise<void> {
  // 🎯 关键修复：先更新关键帧数据，再触发WebAV更新
  // 这样可以避免WebAV动画系统用旧的关键帧数据覆盖新设置的值

  // 1. 先找到当前帧的关键帧并更新关键帧数据
  const keyframe = findKeyframeAtFrame(item, currentFrame)
  if (keyframe) {
    ;(keyframe.properties as any)[property] = value
    console.log('🎯 [Keyframe Fix] Updated keyframe data first:', {
      itemId: item.id,
      currentFrame,
      property,
      value,
      keyframePosition: keyframe.framePosition,
    })
  }

  // 2. 更新WebAV动画（使用新的关键帧数据）
  const { updateWebAVAnimation } = await import('./webavAnimationManager')
  await updateWebAVAnimation(item)

  // 3. 立即更新当前属性值到sprite（确保立即生效）
  await updatePropertyViaWebAV(item, property, value)

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
async function handlePropertyChange_BetweenKeyframes(
  item: TimelineItem,
  currentFrame: number,
  property: string,
  value: any,
): Promise<void> {
  // 🎯 关键修复：先创建关键帧，再更新WebAV动画

  // 1. 在当前帧创建新关键帧（包含所有属性的当前值，但使用新的属性值）
  const keyframe = createKeyframe(item, currentFrame)
  // 确保新关键帧包含更新后的属性值
  ;(keyframe.properties as any)[property] = value
  item.animation!.keyframes.push(keyframe)

  console.log('🎯 [Keyframe Fix] Created new keyframe with updated property:', {
    itemId: item.id,
    currentFrame,
    property,
    value,
    keyframePosition: keyframe.framePosition,
  })

  // 2. 更新WebAV动画（使用新的关键帧数据）
  const { updateWebAVAnimation } = await import('./webavAnimationManager')
  await updateWebAVAnimation(item)

  // 3. 立即更新当前属性值到sprite（确保立即生效）
  await updatePropertyViaWebAV(item, property, value)

  console.log('🎬 [Unified Keyframe] Created keyframe for property change:', {
    itemId: item.id,
    frame: currentFrame,
    property,
    value,
  })
}

/**
 * 统一属性修改处理（遵循正确的数据流向）
 * @returns 返回处理状态，用于日志记录
 */
export async function handlePropertyChange(
  item: TimelineItem,
  currentFrame: number,
  property: string,
  value: any,
): Promise<'no-animation' | 'updated-keyframe' | 'created-keyframe'> {
  if (!item) {
    console.error('🎬 [Unified Keyframe] Invalid timeline item')
    throw new Error('Invalid timeline item')
  }

  const buttonState = getKeyframeButtonState(item, currentFrame)

  switch (buttonState) {
    case 'none':
      await handlePropertyChange_NoAnimation(item, property, value)
      return 'no-animation'
    case 'on-keyframe':
      await handlePropertyChange_OnKeyframe(item, currentFrame, property, value)
      return 'updated-keyframe'
    case 'between-keyframes':
      await handlePropertyChange_BetweenKeyframes(item, currentFrame, property, value)
      return 'created-keyframe'
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

    // 检查属性是否完整（根据媒体类型验证不同的属性）
    const props = keyframe.properties

    if (hasVisualProps(item)) {
      // 视觉媒体类型（video/image）需要验证视觉属性
      if (
        typeof (props as any).x !== 'number' ||
        typeof (props as any).y !== 'number' ||
        typeof (props as any).width !== 'number' ||
        typeof (props as any).height !== 'number' ||
        typeof (props as any).rotation !== 'number' ||
        typeof (props as any).opacity !== 'number'
      ) {
        console.warn('🎬 [Unified Keyframe] Incomplete visual keyframe properties:', props)
        return false
      }

      // 视频类型还需要验证音频属性
      if (item.mediaType === 'video') {
        if (typeof (props as any).volume !== 'number') {
          console.warn('🎬 [Unified Keyframe] Incomplete video audio properties:', props)
          return false
        }
      }
    } else {
      // 音频类型只需要验证音频属性
      if (typeof (props as any).volume !== 'number') {
        console.warn('🎬 [Unified Keyframe] Incomplete audio keyframe properties:', props)
        return false
      }
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

/**
 * 统一架构下的关键帧命令实现
 * 基于"核心数据与行为分离"的响应式重构版本
 * 
 * 主要变化：
 * 1. 使用 UnifiedTimelineItemData 替代原有的 LocalTimelineItem
 * 2. 使用新架构的关键帧类型系统和工具
 * 3. 保持与原有命令相同的API接口，便于迁移
 */

import { generateCommandId } from '../../../utils/idGenerator'
import { framesToTimecode } from '../../utils/UnifiedTimeUtils'
import { cloneDeep } from 'lodash'
import { reactive, markRaw, ref, type Raw, type Ref } from 'vue'
import type { VisibleSprite } from '@webav/av-cliper'
import type { SimpleCommand } from './types'

// ==================== 新架构类型导入 ====================
import type {
  UnifiedTimelineItemData,
  KnownTimelineItem,
  TimelineItemStatus,
  Keyframe,
  AnimationConfig,
  KeyframeProperties,
  VisualAnimatableProps,
  AudioAnimatableProps,
  GetKeyframeProperties,
  GetTimelineItemConfig
} from '../../timelineitem/TimelineItemData'

import type {
  MediaType,
  MediaTypeOrUnknown
} from '../../mediaitem/types'

import type {
  BaseMediaProps
} from '../../../types'
import type { UnifiedTimeRange } from '../../types/timeRange'

// ==================== 关键帧数据快照接口 ====================

/**
 * 类型安全的关键帧状态快照
 * 用于保存和恢复关键帧的完整状态
 */
interface KeyframeSnapshot<TMediaType extends MediaType = MediaType> {
  /** 动画配置的完整快照 */
  animationConfig: AnimationConfig<TMediaType> | null
  /** 时间轴项目的属性快照（类型安全） */
  itemProperties: GetTimelineItemConfig<TMediaType>
}

// ==================== 新架构工具导入 ====================
import {
  isKnownTimelineItem,
  isUnknownTimelineItem,
  isVideoTimelineItem,
  isImageTimelineItem,
  isAudioTimelineItem,
  isTextTimelineItem,
  hasVisualProperties,
  hasAudioProperties,
  TimelineItemFactory
} from '../../timelineitem'

// ==================== 旧架构兼容性导入 ====================
import { VideoVisibleSprite } from '../../../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../../../utils/ImageVisibleSprite'
import { AudioVisibleSprite } from '../../../utils/AudioVisibleSprite'
import {
  isVideoVisibleSprite,
  isAudioVisibleSprite
} from '../../utils/SpriteTypeGuards'

// ==================== 关键帧属性枚举 ====================
/**
 * 关键帧属性枚举（用于UI和命令参数）
 */
export enum KeyframeProperty {
  X = 'x',
  Y = 'y',
  WIDTH = 'width',
  HEIGHT = 'height',
  ROTATION = 'rotation',
  OPACITY = 'opacity',
  VOLUME = 'volume',
  Z_INDEX = 'zIndex'
}

// ==================== 关键帧插值方式枚举 ====================
/**
 * 关键帧插值方式枚举
 */
export enum KeyframeInterpolation {
  LINEAR = 'linear',
  STEP = 'step',
  CUBIC_BEZIER = 'cubic-bezier'
}

// ==================== 关键帧缓动函数枚举 ====================
/**
 * 关键帧缓动函数枚举
 */
export enum KeyframeEasing {
  EASE = 'ease',
  EASE_IN = 'ease-in',
  EASE_OUT = 'ease-out',
  EASE_IN_OUT = 'ease-in-out',
  LINEAR = 'linear'
}

// ==================== 工具函数 ====================
/**
 * 将绝对帧数转换为相对于clip开始的帧数
 */
function absoluteFrameToRelativeFrame(absoluteFrame: number, timeRange: UnifiedTimeRange): number {
  const clipStartFrame = timeRange.timelineStartTime
  const relativeFrame = absoluteFrame - clipStartFrame
  return Math.max(0, relativeFrame)
}

/**
 * 将相对于clip开始的帧数转换为绝对帧数
 */
function relativeFrameToAbsoluteFrame(relativeFrame: number, timeRange: UnifiedTimeRange): number {
  const clipStartFrame = timeRange.timelineStartTime
  return clipStartFrame + relativeFrame
}

/**
 * 初始化动画配置
 */
function initializeAnimation<T extends MediaType>(item: UnifiedTimelineItemData<T>): void {
  if (!item.animation) {
    // 使用类型守卫确保动画配置的类型安全
    const animationConfig: AnimationConfig<T> = {
      keyframes: [],
      isEnabled: false,
      easing: 'linear',
    }
    // 使用类型断言来处理条件类型
    item.animation = animationConfig as T extends MediaType ? AnimationConfig<T> : undefined
  }
}

/**
 * 创建包含所有属性的关键帧
 */
function createKeyframe<T extends MediaType>(
  item: UnifiedTimelineItemData<T>,
  absoluteFrame: number
): Keyframe<T> {
  const relativeFrame = absoluteFrameToRelativeFrame(absoluteFrame, item.timeRange)

  if (hasVisualProperties(item)) {
    if (item.mediaType === 'video') {
      const config = item.config as GetTimelineItemConfig<'video'>
      return {
        framePosition: relativeFrame,
        properties: {
          x: config.x,
          y: config.y,
          width: config.width,
          height: config.height,
          rotation: config.rotation,
          opacity: config.opacity,
          zIndex: config.zIndex,
          volume: config.volume,
        } as GetKeyframeProperties<'video'>,
      } as Keyframe<T>
    } else if (item.mediaType === 'image') {
      const config = item.config as GetTimelineItemConfig<'image'>
      return {
        framePosition: relativeFrame,
        properties: {
          x: config.x,
          y: config.y,
          width: config.width,
          height: config.height,
          rotation: config.rotation,
          opacity: config.opacity,
          zIndex: config.zIndex,
        } as GetKeyframeProperties<'image'>,
      } as Keyframe<T>
    } else if (item.mediaType === 'text') {
      const config = item.config as GetTimelineItemConfig<'text'>
      return {
        framePosition: relativeFrame,
        properties: {
          x: config.x,
          y: config.y,
          width: config.width,
          height: config.height,
          rotation: config.rotation,
          opacity: config.opacity,
          zIndex: config.zIndex,
        } as GetKeyframeProperties<'text'>,
      } as Keyframe<T>
    }
  } else if (hasAudioProperties(item)) {
    const config = item.config as GetTimelineItemConfig<'audio'>
    return {
      framePosition: relativeFrame,
      properties: {
        volume: config.volume ?? 1,
        zIndex: config.zIndex,
      } as GetKeyframeProperties<'audio'>,
    } as Keyframe<T>
  }

  throw new Error(`Unsupported media type: ${item.mediaType}`)
}

/**
 * 检查是否有动画
 */
function hasAnimation<T extends MediaType>(item: UnifiedTimelineItemData<T>): boolean {
  return !!(item.animation && item.animation.isEnabled && item.animation.keyframes.length > 0)
}

/**
 * 检查当前帧是否在关键帧位置
 */
function isCurrentFrameOnKeyframe<T extends MediaType>(
  item: UnifiedTimelineItemData<T>,
  absoluteFrame: number
): boolean {
  if (!item.animation) return false

  const relativeFrame = absoluteFrameToRelativeFrame(absoluteFrame, item.timeRange)
  const tolerance = 0 // 精确匹配

  return item.animation.keyframes.some(
    (kf) => Math.abs(kf.framePosition - relativeFrame) <= tolerance,
  )
}

/**
 * 在指定帧位置查找关键帧
 */
function findKeyframeAtFrame<T extends MediaType>(
  item: UnifiedTimelineItemData<T>,
  absoluteFrame: number
): Keyframe<T> | undefined {
  if (!item.animation) return undefined

  const relativeFrame = absoluteFrameToRelativeFrame(absoluteFrame, item.timeRange)
  const tolerance = 0 // 精确匹配

  return item.animation.keyframes.find(
    (kf) => Math.abs(kf.framePosition - relativeFrame) <= tolerance,
  ) as Keyframe<T> | undefined
}

/**
 * 启用动画
 */
function enableAnimation<T extends MediaType>(item: UnifiedTimelineItemData<T>): void {
  initializeAnimation(item)
  item.animation!.isEnabled = true
}

/**
 * 禁用动画
 */
function disableAnimation<T extends MediaType>(item: UnifiedTimelineItemData<T>): void {
  if (item.animation) {
    item.animation.isEnabled = false
    item.animation.keyframes = []
  }
}

/**
 * 删除指定帧位置的关键帧
 */
function removeKeyframeAtFrame<T extends MediaType>(
  item: UnifiedTimelineItemData<T>,
  absoluteFrame: number
): boolean {
  if (!item.animation) return false

  const relativeFrame = absoluteFrameToRelativeFrame(absoluteFrame, item.timeRange)
  const tolerance = 0 // 精确匹配
  
  // 使用类型守卫确保动画配置的类型安全
  const animationConfig = item.animation as AnimationConfig<T>
  const initialLength = animationConfig.keyframes.length

    animationConfig.keyframes = item.animation.keyframes.filter(
    (kf) => Math.abs(kf.framePosition - relativeFrame) > tolerance,
  ) as Keyframe<T>[]

  const removed = animationConfig.keyframes.length < initialLength
  if (removed) {
    console.log('🎬 [Keyframe Command] Removed keyframe at frame:', absoluteFrame)
  }

  return removed
}

/**
 * 按帧位置排序关键帧
 */
function sortKeyframes<T extends MediaType>(item: UnifiedTimelineItemData<T>): void {
  if (!item.animation) return

  item.animation.keyframes.sort((a, b) => a.framePosition - b.framePosition)
}

/**
 * 清除所有关键帧
 */
function clearAllKeyframes<T extends MediaType>(item: UnifiedTimelineItemData<T>): void {
  if (!item.animation) return

  item.animation.keyframes = []
  item.animation.isEnabled = false

  console.log('🎬 [Keyframe Command] Cleared all keyframes:', {
    itemId: item.id,
  })
}

// ==================== 通用工具函数 ====================

/**
 * 通用的状态快照应用函数（遵循正确的数据流向：UI → WebAV → TimelineItem）
 * 类型安全版本
 */
async function applyKeyframeSnapshot<TMediaType extends MediaType = MediaType>(
  item: UnifiedTimelineItemData<TMediaType>,
  snapshot: KeyframeSnapshot<TMediaType>,
  webavAnimationManager: { updateWebAVAnimation: (item: UnifiedTimelineItemData<TMediaType>) => Promise<void> },
): Promise<void> {
  // 1. 恢复动画配置（关键帧数据）
  if (snapshot.animationConfig) {
    // 使用类型守卫确保动画配置的类型安全
    const animationConfig: AnimationConfig<TMediaType> = {
      keyframes: snapshot.animationConfig.keyframes.map((kf) => ({
        framePosition: kf.framePosition,
        properties: { ...kf.properties },
      })),
      isEnabled: snapshot.animationConfig.isEnabled,
      easing: snapshot.animationConfig.easing,
    }
    // 使用类型断言来处理条件类型
    item.animation = animationConfig as TMediaType extends MediaType ? AnimationConfig<TMediaType> : undefined
  } else {
    item.animation = undefined
  }

  // 2. 通过WebAV恢复属性值（遵循正确的数据流向）
  const sprite = item.sprite
  if (sprite && snapshot.itemProperties) {
    try {
      // 类型安全的属性恢复 - 只处理视觉属性
      if (hasVisualProperties(item)) {
        // hasVisualProperties 类型守卫确保了 item 具有视觉属性
        const config = item.config as GetTimelineItemConfig<TMediaType>
        const visualProps = snapshot.itemProperties as GetTimelineItemConfig<TMediaType>

        // 恢复位置和尺寸
        if ('x' in visualProps || 'y' in visualProps) {
          const { projectToWebavCoords } = await import('../../../utils/coordinateTransform')
          const { useUnifiedStore } = await import('../../unifiedStore')
          const unifiedStore = useUnifiedStore()

          // hasVisualProperties 类型守卫确保了 config 具有视觉属性
          const config = item.config as GetTimelineItemConfig<TMediaType> & VisualAnimatableProps
          const webavCoords = projectToWebavCoords(
            Number(('x' in visualProps ? visualProps.x : undefined) ?? ('x' in config ? (config as VisualAnimatableProps).x : 0)),
            Number(('y' in visualProps ? visualProps.y : undefined) ?? ('y' in config ? (config as VisualAnimatableProps).y : 0)),
            Number(('width' in visualProps ? visualProps.width : undefined) ?? ('width' in config ? (config as VisualAnimatableProps).width : 100)),
            Number(('height' in visualProps ? visualProps.height : undefined) ?? ('height' in config ? (config as VisualAnimatableProps).height : 100)),
            unifiedStore.videoResolution.width,
            unifiedStore.videoResolution.height,
          )
          sprite.rect.x = webavCoords.x
          sprite.rect.y = webavCoords.y
        }

        // 恢复尺寸
        if ('width' in visualProps) {
          sprite.rect.w = visualProps.width
        }
        if ('height' in visualProps) {
          sprite.rect.h = visualProps.height
        }

        // 恢复旋转
        if ('rotation' in visualProps) {
          sprite.rect.angle = visualProps.rotation
        }

        // 恢复透明度
        if ('opacity' in visualProps) {
          sprite.opacity = visualProps.opacity
        }
      }

      // 触发渲染更新
      const { useUnifiedStore } = await import('../../unifiedStore')
      const unifiedStore = useUnifiedStore()
      unifiedStore.webAVSeekTo(unifiedStore.currentFrame)
    } catch (error) {
      console.error('🎬 [Keyframe Command] Failed to restore properties via WebAV:', error)
      // 如果WebAV更新失败，回退到直接更新TimelineItem配置
      Object.assign(item.config, snapshot.itemProperties)
    }
  }

  // 3. 更新WebAV动画配置
  await webavAnimationManager.updateWebAVAnimation(item)
}

// ==================== 创建关键帧命令 ====================

/**
 * 创建关键帧命令
 * 支持在指定帧位置创建包含所有属性的关键帧
 */
export class CreateKeyframeCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private beforeSnapshot: KeyframeSnapshot
  private afterSnapshot: KeyframeSnapshot | null = null

  constructor(
    private timelineItemId: string,
    private frame: number,
    private timelineModule: {
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: UnifiedTimelineItemData<MediaType>) => Promise<void>
    },
    private playbackControls?: {
      seekTo: (frame: number) => void
    },
  ) {
    this.id = generateCommandId()
    this.description = `创建关键帧 (帧 ${frame})`

    // 保存执行前的状态快照
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (!item || !isKnownTimelineItem(item)) {
      throw new Error(`时间轴项目不存在或类型错误: ${timelineItemId}`)
    }
    this.beforeSnapshot = this.createSnapshot(item)
  }

  /**
   * 创建状态快照（类型安全版本）
   */
  private createSnapshot(item: KnownTimelineItem): KeyframeSnapshot<MediaType> {
    return {
      animationConfig: item.animation
        ? {
            keyframes: item.animation.keyframes.map((kf) => ({
              framePosition: kf.framePosition,
              properties: { ...kf.properties },
            })),
            isEnabled: item.animation.isEnabled,
            easing: item.animation.easing,
          }
        : null,
      itemProperties: { ...item.config } as GetTimelineItemConfig<MediaType>, // 使用完整的config作为快照，确保类型安全
    }
  }

  /**
   * 应用状态快照
   */
  private async applySnapshot(item: KnownTimelineItem, snapshot: KeyframeSnapshot<MediaType>): Promise<void> {
    await applyKeyframeSnapshot(item, snapshot, this.webavAnimationManager)
  }

  /**
   * 执行命令：创建关键帧
   */
  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item || !isKnownTimelineItem(item)) {
      throw new Error(`时间轴项目不存在或类型错误: ${this.timelineItemId}`)
    }

    // 检查播放头是否在clip时间范围内
    const { isPlayheadInTimelineItem } = await import('../../utils/UnifiedTimelineSearchUtils')
    if (!isPlayheadInTimelineItem(item, this.frame)) {
      // 使用通知系统显示用户友好的警告
      const { useUnifiedStore } = await import('../../unifiedStore')
      const unifiedStore = useUnifiedStore()

      unifiedStore.showWarning(
        '无法创建关键帧',
        '播放头不在当前视频片段的时间范围内。请将播放头移动到片段内再尝试创建关键帧。',
      )

      console.warn('🎬 [Create Keyframe Command] 播放头不在当前clip时间范围内，无法创建关键帧:', {
        itemId: this.timelineItemId,
        frame: this.frame,
        clipTimeRange: {
          start: item.timeRange.timelineStartTime,
          end: item.timeRange.timelineEndTime,
        },
      })
      throw new Error('播放头不在当前clip时间范围内，无法创建关键帧')
    }

    try {
      // 1. 确保动画已启用
      if (!item.animation) {
        initializeAnimation(item)
      }
      enableAnimation(item)

      // 2. 创建关键帧
      const keyframe = createKeyframe(item, this.frame)
      item.animation!.keyframes.push(keyframe as any)

      // 3. 排序关键帧
      sortKeyframes(item)

      // 4. 更新WebAV动画
      await this.webavAnimationManager.updateWebAVAnimation(item)

      // 5. 保存执行后的状态快照
      this.afterSnapshot = this.createSnapshot(item)

      // 6. 重做关键帧操作时，跳转到相关帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('✅ 创建关键帧命令执行成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
        keyframe,
      })
    } catch (error) {
      console.error('❌ 创建关键帧命令执行失败:', error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复到创建前的状态
   */
  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item || !isKnownTimelineItem(item)) {
      throw new Error(`时间轴项目不存在或类型错误: ${this.timelineItemId}`)
    }

    try {
      await this.applySnapshot(item, this.beforeSnapshot)

      // 撤销关键帧操作时，跳转到相关帧位置（seekTo会自动触发渲染更新）
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('↩️ 创建关键帧命令撤销成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
      })
    } catch (error) {
      console.error('❌ 创建关键帧命令撤销失败:', error)
      throw error
    }
  }
}

// ==================== 删除关键帧命令 ====================

/**
 * 删除关键帧命令
 * 支持删除指定帧位置的关键帧
 */
export class DeleteKeyframeCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private beforeSnapshot: KeyframeSnapshot
  private afterSnapshot: KeyframeSnapshot | null = null

  constructor(
    private timelineItemId: string,
    private frame: number,
    private timelineModule: {
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: UnifiedTimelineItemData<MediaType>) => Promise<void>
    },
    private playbackControls?: {
      seekTo: (frame: number) => void
    },
  ) {
    this.id = generateCommandId()
    this.description = `删除关键帧 (帧 ${frame})`

    // 保存执行前的状态快照
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (!item || !isKnownTimelineItem(item)) {
      throw new Error(`时间轴项目不存在或类型错误: ${timelineItemId}`)
    }
    this.beforeSnapshot = this.createSnapshot(item)
  }

  /**
   * 创建状态快照（类型安全版本）
   */
  private createSnapshot(item: KnownTimelineItem): KeyframeSnapshot<MediaType> {
    return {
      animationConfig: item.animation
        ? {
            keyframes: item.animation.keyframes.map((kf) => ({
              framePosition: kf.framePosition,
              properties: { ...kf.properties },
            })),
            isEnabled: item.animation.isEnabled,
            easing: item.animation.easing,
          }
        : null,
      itemProperties: { ...item.config } as GetTimelineItemConfig<MediaType>, // 使用完整的config作为快照，确保类型安全
    }
  }

  /**
   * 应用状态快照
   */
  private async applySnapshot(item: KnownTimelineItem, snapshot: KeyframeSnapshot<MediaType>): Promise<void> {
    await applyKeyframeSnapshot(item, snapshot, this.webavAnimationManager)
  }

  /**
   * 执行命令：删除关键帧
   */
  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item || !isKnownTimelineItem(item)) {
      throw new Error(`时间轴项目不存在或类型错误: ${this.timelineItemId}`)
    }

    // 检查播放头是否在clip时间范围内
    const { isPlayheadInTimelineItem } = await import('../../utils/UnifiedTimelineSearchUtils')
    if (!isPlayheadInTimelineItem(item, this.frame)) {
      // 使用通知系统显示用户友好的警告
      const { useUnifiedStore } = await import('../../unifiedStore')
      const unifiedStore = useUnifiedStore()

      unifiedStore.showWarning(
        '无法删除关键帧',
        '播放头不在当前视频片段的时间范围内。请将播放头移动到片段内再尝试删除关键帧。',
      )

      console.warn('🎬 [Delete Keyframe Command] 播放头不在当前clip时间范围内，无法删除关键帧:', {
        itemId: this.timelineItemId,
        frame: this.frame,
        clipTimeRange: {
          start: item.timeRange.timelineStartTime,
          end: item.timeRange.timelineEndTime,
        },
      })
      throw new Error('播放头不在当前clip时间范围内，无法删除关键帧')
    }

    try {
      // 1. 删除指定帧的关键帧
      removeKeyframeAtFrame(item, this.frame)

      // 2. 如果没有其他关键帧，禁用动画
      if (!item.animation || item.animation.keyframes.length === 0) {
        disableAnimation(item)
      }

      // 3. 更新WebAV动画
      await this.webavAnimationManager.updateWebAVAnimation(item)

      // 4. 保存执行后的状态快照
      this.afterSnapshot = this.createSnapshot(item)

      // 5. 重做关键帧操作时，跳转到相关帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('✅ 删除关键帧命令执行成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
      })
    } catch (error) {
      console.error('❌ 删除关键帧命令执行失败:', error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复到删除前的状态
   */
  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item || !isKnownTimelineItem(item)) {
      throw new Error(`时间轴项目不存在或类型错误: ${this.timelineItemId}`)
    }

    try {
      await this.applySnapshot(item, this.beforeSnapshot)

      // 撤销关键帧操作时，跳转到相关帧位置（seekTo会自动触发渲染更新）
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('↩️ 删除关键帧命令撤销成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
      })
    } catch (error) {
      console.error('❌ 删除关键帧命令撤销失败:', error)
      throw error
    }
  }
}

// ==================== 统一属性更新命令 ====================

/**
 * 统一属性更新命令
 * 根据当前动画状态智能处理属性修改：
 * - 无动画状态：直接更新属性
 * - 在关键帧上：更新现有关键帧
 * - 在关键帧之间：创建新关键帧
 */
export class UpdatePropertyCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private beforeSnapshot: KeyframeSnapshot
  private afterSnapshot: KeyframeSnapshot | null = null

  constructor(
    private timelineItemId: string,
    private frame: number,
    private property: string,
    private newValue: KeyframeProperties[keyof KeyframeProperties] | number,
    private timelineModule: {
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: UnifiedTimelineItemData<MediaType>) => Promise<void>
    },
    private playbackControls?: {
      seekTo: (frame: number) => void
    },
  ) {
    this.id = generateCommandId()
    this.description = `修改属性: ${property} (帧 ${frame})`

    // 保存执行前的状态快照
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (!item || !isKnownTimelineItem(item)) {
      throw new Error(`时间轴项目不存在或类型错误: ${timelineItemId}`)
    }
    this.beforeSnapshot = this.createSnapshot(item)
  }

  /**
   * 创建状态快照（类型安全版本）
   */
  private createSnapshot(item: KnownTimelineItem): KeyframeSnapshot<MediaType> {
    return {
      animationConfig: item.animation
        ? {
            keyframes: item.animation.keyframes.map((kf) => ({
              framePosition: kf.framePosition,
              properties: { ...kf.properties },
            })),
            isEnabled: item.animation.isEnabled,
            easing: item.animation.easing,
          }
        : null,
      itemProperties: { ...item.config } as GetTimelineItemConfig<MediaType>, // 使用完整的config作为快照，确保类型安全
    }
  }

  /**
   * 应用状态快照
   */
  private async applySnapshot(item: KnownTimelineItem, snapshot: KeyframeSnapshot<MediaType>): Promise<void> {
    await applyKeyframeSnapshot(item, snapshot, this.webavAnimationManager)
  }

  /**
   * 执行命令：更新属性（智能处理关键帧）
   */
  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item || !isKnownTimelineItem(item)) {
      throw new Error(`时间轴项目不存在或类型错误: ${this.timelineItemId}`)
    }

    // 检查播放头是否在clip时间范围内
    const { isPlayheadInTimelineItem } = await import('../../utils/UnifiedTimelineSearchUtils')
    if (!isPlayheadInTimelineItem(item, this.frame)) {
      // 使用通知系统显示用户友好的警告
      const { useUnifiedStore } = await import('../../unifiedStore')
      const unifiedStore = useUnifiedStore()

      unifiedStore.showWarning(
        '无法更新属性',
        '播放头不在当前视频片段的时间范围内。请将播放头移动到片段内再尝试修改属性。',
      )

      console.warn('🎬 [Update Property Command] 播放头不在当前clip时间范围内，无法更新属性:', {
        itemId: this.timelineItemId,
        frame: this.frame,
        property: this.property,
        value: this.newValue,
        clipTimeRange: {
          start: item.timeRange.timelineStartTime,
          end: item.timeRange.timelineEndTime,
        },
      })
      throw new Error('播放头不在当前clip时间范围内，无法更新属性')
    }

    try {
      // 使用统一的属性修改处理逻辑（遵循正确的数据流向）
      // 注意：handlePropertyChange 内部已经包含了 updateWebAVAnimation 调用，无需重复调用
      const actionType = await this.handlePropertyChange(item, this.frame, this.property, this.newValue)

      // 保存执行后的状态快照
      this.afterSnapshot = this.createSnapshot(item)

      // 重做属性修改时，跳转到相关帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      // 根据实际处理类型显示不同的日志
      const actionMessages: Record<string, string> = {
        'no-animation': '✅ 属性更新完成（无动画）',
        'updated-keyframe': '✅ 关键帧属性更新完成',
        'created-keyframe': '✅ 创建关键帧并更新属性完成',
      }

      console.log(actionMessages[actionType], {
        itemId: this.timelineItemId,
        frame: this.frame,
        property: this.property,
        value: this.newValue,
        actionType,
      })
    } catch (error) {
      console.error('❌ 属性更新命令执行失败:', error)
      throw error
    }
  }

  /**
   * 处理属性变更（统一逻辑）
   */
  private async handlePropertyChange(
    item: KnownTimelineItem,
    frame: number,
    property: string,
    value: KeyframeProperties[keyof KeyframeProperties] | number
  ): Promise<string> {
    // 1. 无动画状态：直接更新属性
    if (!hasAnimation(item)) {
      // 直接更新配置属性
      if (property in item.config) {
        const config = item.config as GetTimelineItemConfig<MediaType>
        // 使用类型断言来处理类型不匹配的问题
        config[property as keyof GetTimelineItemConfig<MediaType>] = value as any
      }
      
      // 更新WebAV动画
      await this.webavAnimationManager.updateWebAVAnimation(item)
      return 'no-animation'
    }

    // 2. 有动画状态：检查当前帧是否在关键帧上
    const isOnKeyframe = isCurrentFrameOnKeyframe(item, frame)
    
    if (isOnKeyframe) {
      // 3. 在关键帧上：更新现有关键帧属性
      const keyframe = findKeyframeAtFrame(item, frame)
      if (keyframe && property in keyframe.properties) {
        const properties = keyframe.properties as GetKeyframeProperties<MediaType>
        properties[property as keyof GetKeyframeProperties<MediaType>] = value
      }
      
      // 更新WebAV动画
      await this.webavAnimationManager.updateWebAVAnimation(item)
      return 'updated-keyframe'
    } else {
      // 4. 在关键帧之间：创建新关键帧
      const newKeyframe = createKeyframe(item, frame)
      
      // 更新新关键帧的指定属性
      if (property in newKeyframe.properties) {
        const properties = newKeyframe.properties as GetKeyframeProperties<MediaType>
        properties[property as keyof GetKeyframeProperties<MediaType>] = value
      }
      
      // 添加新关键帧到动画配置
      item.animation!.keyframes.push(newKeyframe as any)
      sortKeyframes(item)
      
      // 更新WebAV动画
      await this.webavAnimationManager.updateWebAVAnimation(item)
      return 'created-keyframe'
    }
  }

  /**
   * 撤销命令：恢复到修改前的状态
   */
  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item || !isKnownTimelineItem(item)) {
      throw new Error(`时间轴项目不存在或类型错误: ${this.timelineItemId}`)
    }

    try {
      await this.applySnapshot(item, this.beforeSnapshot)

      // 撤销属性修改时，跳转到相关帧位置（seekTo会自动触发渲染更新）
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('↩️ 属性更新命令撤销成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
        property: this.property,
      })
    } catch (error) {
      console.error('❌ 属性更新命令撤销失败:', error)
      throw error
    }
  }
}

// ==================== 切换关键帧命令 ====================
/**
 * 支持在指定时间点添加或删除关键帧的撤销/重做操作
 * 保存操作前后的关键帧状态，支持恢复到之前的状态
 */
export class ToggleKeyframeCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalKeyframes: Keyframe<MediaType>[] | null = null // 保存原始关键帧状态
  private newKeyframes: Keyframe<MediaType>[] | null = null // 保存新关键帧状态
  private wasKeyframeAdded: boolean = false // 标记是添加还是删除关键帧

  constructor(
    private timelineItemId: string,
    private timeFrames: number, // 时间点（帧数）
    private properties: KeyframeProperty[], // 要操作的关键帧属性
    private timelineModule: {
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
      updateTimelineItemAnimation: (id: string, animation: AnimationConfig<MediaType> | undefined) => void
    },
    private mediaModule: {
      getMediaItem: (id: string) => { name: string } | undefined
    },
  ) {
    this.id = generateCommandId()

    // 获取时间轴项目信息用于描述
    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    let itemName = '未知素材'

    if (timelineItem) {
      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      itemName = mediaItem?.name || '未知素材'
    }

    // 检查指定时间点是否有关键帧
    const hasKeyframeAtTime = this.checkHasKeyframeAtTime(timelineItem, timeFrames, this.properties)
    this.wasKeyframeAdded = !hasKeyframeAtTime

    this.description = `${this.wasKeyframeAdded ? '添加' : '删除'}关键帧: ${itemName} (${framesToTimecode(timeFrames)})`

    console.log('💾 保存切换关键帧操作数据:', {
      timelineItemId,
      timeFrames,
      properties,
      wasKeyframeAdded: this.wasKeyframeAdded
    })
  }

  /**
   * 检查指定时间点是否有关键帧
   */
  private checkHasKeyframeAtTime(
    timelineItem: UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined,
    timeFrames: number,
    properties: KeyframeProperty[]
  ): boolean {
    if (!timelineItem || !isKnownTimelineItem(timelineItem) || !timelineItem.animation) {
      return false
    }

    return isCurrentFrameOnKeyframe(timelineItem, timeFrames)
  }

  /**
   * 执行命令：添加或删除关键帧
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行${this.wasKeyframeAdded ? '添加' : '删除'}关键帧操作: ${this.timelineItemId}...`)

      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem || !isKnownTimelineItem(timelineItem)) {
        throw new Error(`时间轴项目不存在或类型错误: ${this.timelineItemId}`)
      }

      // 保存原始关键帧状态
      this.originalKeyframes = timelineItem.animation ? cloneDeep(timelineItem.animation.keyframes) : null

      // 执行添加或删除关键帧操作
      if (this.wasKeyframeAdded) {
        await this.addKeyframes(timelineItem)
      } else {
        await this.removeKeyframes(timelineItem)
      }

      // 保存新关键帧状态
      this.newKeyframes = timelineItem.animation ? cloneDeep(timelineItem.animation.keyframes) : null

      console.log(`✅ 关键帧${this.wasKeyframeAdded ? '添加' : '删除'}成功: ${this.timelineItemId}`)
    } catch (error) {
      console.error(`❌ 关键帧${this.wasKeyframeAdded ? '添加' : '删除'}失败: ${this.timelineItemId}`, error)
      throw error
    }
  }

  /**
   * 添加关键帧
   */
  private async addKeyframes(timelineItem: KnownTimelineItem): Promise<void> {
    // 确保动画配置存在
    if (!timelineItem.animation) {
      initializeAnimation(timelineItem)
    }

    // 在当前帧创建关键帧并添加到动画配置
    const keyframe = createKeyframe(timelineItem, this.timeFrames)
    timelineItem.animation!.keyframes.push(keyframe as any)

    // 排序关键帧
    sortKeyframes(timelineItem)

    // 更新时间轴项目的动画配置
    this.timelineModule.updateTimelineItemAnimation(this.timelineItemId, timelineItem.animation)
  }

  /**
   * 删除关键帧
   */
  private async removeKeyframes(timelineItem: KnownTimelineItem): Promise<void> {
    if (!timelineItem.animation) {
      return
    }

    // 删除当前帧的关键帧
    removeKeyframeAtFrame(timelineItem, this.timeFrames)

    // 如果没有关键帧了，禁用动画
    const hasAnyKeyframes = timelineItem.animation.keyframes.length > 0

    if (!hasAnyKeyframes) {
      timelineItem.animation.isEnabled = false
    }

    // 更新时间轴项目的动画配置
    this.timelineModule.updateTimelineItemAnimation(this.timelineItemId, timelineItem.animation)
  }

  /**
   * 撤销命令：恢复到原始关键帧状态
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销${this.wasKeyframeAdded ? '添加' : '删除'}关键帧操作: ${this.timelineItemId}...`)

      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem || !isKnownTimelineItem(timelineItem)) {
        throw new Error(`时间轴项目不存在或类型错误: ${this.timelineItemId}`)
      }

      // 恢复原始关键帧状态
      if (this.originalKeyframes) {
        if (!timelineItem.animation) {
          initializeAnimation(timelineItem)
        }
        // 使用非空断言操作符，因为我们已经检查了animation是否存在
        timelineItem.animation!.keyframes = cloneDeep(this.originalKeyframes) as any
        timelineItem.animation!.isEnabled = true
      } else if (timelineItem.animation) {
        // 如果原始没有关键帧，则清除所有关键帧
        clearAllKeyframes(timelineItem)
      }

      // 更新时间轴项目的动画配置
      this.timelineModule.updateTimelineItemAnimation(this.timelineItemId, timelineItem.animation)

      console.log(`↩️ 已撤销关键帧${this.wasKeyframeAdded ? '添加' : '删除'}: ${this.timelineItemId}`)
    } catch (error) {
      console.error(`❌ 撤销关键帧${this.wasKeyframeAdded ? '添加' : '删除'}失败: ${this.timelineItemId}`, error)
      throw error
    }
  }
}

// ==================== 更新关键帧属性命令 ====================
/**
 * 支持修改关键帧时间、值、插值方式等属性的撤销/重做操作
 * 保存修改前后的关键帧状态，支持恢复到之前的状态
 */
export class UpdateKeyframeCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalKeyframe: Keyframe<MediaType> | null = null // 保存原始关键帧状态
  private newKeyframe: Keyframe<MediaType> | null = null // 保存新关键帧状态

  constructor(
    private timelineItemId: string,
    private property: KeyframeProperty, // 关键帧属性
    private oldTimeFrames: number, // 原始时间点（帧数）
    private newTimeFrames: number, // 新时间点（帧数）
    private oldValue: KeyframeProperties[keyof KeyframeProperties] | number, // 原始值
    private newValue: KeyframeProperties[keyof KeyframeProperties] | number, // 新值
    private oldInterpolation: KeyframeInterpolation, // 原始插值方式
    private newInterpolation: KeyframeInterpolation, // 新插值方式
    private oldEasing: KeyframeEasing, // 原始缓动函数
    private newEasing: KeyframeEasing, // 新缓动函数
    private timelineModule: {
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
      updateTimelineItemAnimation: (id: string, animation: AnimationConfig<MediaType> | undefined) => void
    },
    private mediaModule: {
      getMediaItem: (id: string) => { name: string } | undefined
    },
  ) {
    this.id = generateCommandId()

    // 获取时间轴项目信息用于描述
    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    let itemName = '未知素材'

    if (timelineItem) {
      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      itemName = mediaItem?.name || '未知素材'
    }

    this.description = `更新关键帧属性: ${itemName} (${this.property} @ ${framesToTimecode(oldTimeFrames)})`

    console.log('💾 保存更新关键帧属性操作数据:', {
      timelineItemId,
      property,
      oldTimeFrames,
      newTimeFrames,
      oldValue,
      newValue,
      oldInterpolation,
      newInterpolation,
      oldEasing,
      newEasing
    })
  }

  /**
   * 执行命令：更新关键帧属性
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行更新关键帧属性操作: ${this.timelineItemId}...`)

      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem || !isKnownTimelineItem(timelineItem) || !timelineItem.animation) {
        throw new Error(`时间轴项目不存在、类型错误或没有动画: ${this.timelineItemId}`)
      }

      // 获取原始关键帧
      const originalKeyframe = findKeyframeAtFrame(timelineItem, this.oldTimeFrames)
      if (!originalKeyframe) {
        throw new Error(`在指定时间点找不到关键帧: ${framesToTimecode(this.oldTimeFrames)}`)
      }

      // 保存原始关键帧状态
      this.originalKeyframe = { ...originalKeyframe }

      // 删除原始关键帧
      removeKeyframeAtFrame(timelineItem, this.oldTimeFrames)

      // 创建新关键帧
      const newKeyframe = { ...originalKeyframe }
      newKeyframe.framePosition = absoluteFrameToRelativeFrame(this.newTimeFrames, timelineItem.timeRange)
      
      // 更新属性值
      if (this.property in newKeyframe.properties) {
        const properties = newKeyframe.properties as GetKeyframeProperties<MediaType>
        properties[this.property as keyof GetKeyframeProperties<MediaType>] = this.newValue
      }

      // 添加新关键帧到动画配置
      timelineItem.animation.keyframes.push(newKeyframe as any)
      sortKeyframes(timelineItem)

      // 保存新关键帧状态
      this.newKeyframe = { ...newKeyframe }

      // 更新时间轴项目的动画配置
      this.timelineModule.updateTimelineItemAnimation(this.timelineItemId, timelineItem.animation)

      console.log(`✅ 关键帧属性更新成功: ${this.timelineItemId}`)
    } catch (error) {
      console.error(`❌ 关键帧属性更新失败: ${this.timelineItemId}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复到原始关键帧状态
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销更新关键帧属性操作: ${this.timelineItemId}...`)

      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem || !isKnownTimelineItem(timelineItem) || !timelineItem.animation) {
        throw new Error(`时间轴项目不存在、类型错误或没有动画: ${this.timelineItemId}`)
      }

      // 删除新关键帧
      removeKeyframeAtFrame(timelineItem, this.newTimeFrames)

      // 恢复原始关键帧到动画配置
      if (this.originalKeyframe) {
        timelineItem.animation.keyframes.push({ ...this.originalKeyframe } as any)
        sortKeyframes(timelineItem)
      }

      // 更新时间轴项目的动画配置
      this.timelineModule.updateTimelineItemAnimation(this.timelineItemId, timelineItem.animation)

      console.log(`↩️ 已撤销关键帧属性更新: ${this.timelineItemId}`)
    } catch (error) {
      console.error(`❌ 撤销关键帧属性更新失败: ${this.timelineItemId}`, error)
      throw error
    }
  }
}

// ==================== 启用/禁用动画命令 ====================
/**
 * 支持启用或禁用时间轴项目动画的撤销/重做操作
 * 保存操作前后的动画状态，支持恢复到之前的状态
 */
export class ToggleAnimationCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalAnimationState: boolean = false // 保存原始动画状态

  constructor(
    private timelineItemId: string,
    private enable: boolean, // true表示启用，false表示禁用
    private timelineModule: {
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
      updateTimelineItemAnimation: (id: string, animation: AnimationConfig<MediaType> | undefined) => void
    },
    private mediaModule: {
      getMediaItem: (id: string) => { name: string } | undefined
    },
  ) {
    this.id = generateCommandId()

    // 获取时间轴项目信息用于描述
    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    let itemName = '未知素材'

    if (timelineItem) {
      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      itemName = mediaItem?.name || '未知素材'
      
      // 保存原始动画状态
      if (timelineItem.animation) {
        this.originalAnimationState = timelineItem.animation.isEnabled
      }
    }

    this.description = `${this.enable ? '启用' : '禁用'}动画: ${itemName}`

    console.log('💾 保存切换动画状态操作数据:', {
      timelineItemId,
      enable,
      originalAnimationState: this.originalAnimationState
    })
  }

  /**
   * 执行命令：启用或禁用动画
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行${this.enable ? '启用' : '禁用'}动画操作: ${this.timelineItemId}...`)

      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem || !isKnownTimelineItem(timelineItem)) {
        throw new Error(`时间轴项目不存在或类型错误: ${this.timelineItemId}`)
      }

      // 更新动画状态
      if (this.enable) {
        enableAnimation(timelineItem)
      } else {
        disableAnimation(timelineItem)
      }

      // 更新时间轴项目的动画配置
      this.timelineModule.updateTimelineItemAnimation(this.timelineItemId, timelineItem.animation)

      console.log(`✅ 动画${this.enable ? '启用' : '禁用'}成功: ${this.timelineItemId}`)
    } catch (error) {
      console.error(`❌ 动画${this.enable ? '启用' : '禁用'}失败: ${this.timelineItemId}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复到原始动画状态
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销${this.enable ? '启用' : '禁用'}动画操作: ${this.timelineItemId}...`)

      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem || !isKnownTimelineItem(timelineItem)) {
        throw new Error(`时间轴项目不存在或类型错误: ${this.timelineItemId}`)
      }

      if (!timelineItem.animation) {
        // 如果原始没有动画配置，则不需要恢复
        console.log(`↩️ 原始没有动画配置，跳过恢复: ${this.timelineItemId}`)
        return
      }

      // 恢复原始动画状态
      if (this.originalAnimationState) {
        enableAnimation(timelineItem)
      } else {
        disableAnimation(timelineItem)
      }

      // 更新时间轴项目的动画配置
      this.timelineModule.updateTimelineItemAnimation(this.timelineItemId, timelineItem.animation)

      console.log(`↩️ 已撤销动画${this.enable ? '启用' : '禁用'}: ${this.timelineItemId}`)
    } catch (error) {
      console.error(`❌ 撤销动画${this.enable ? '启用' : '禁用'}失败: ${this.timelineItemId}`, error)
      throw error
    }
  }
}

// ==================== 清除所有关键帧命令 ====================
/**
 * 支持清除时间轴项目所有关键帧的撤销/重做操作
 * 保存清除前的关键帧状态，支持恢复到之前的状态
 */
export class ClearAllKeyframesCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalKeyframes: Keyframe<MediaType>[] | null = null // 保存原始关键帧状态
  private originalAnimationState: boolean = false // 保存原始动画状态

  constructor(
    private timelineItemId: string,
    private timelineModule: {
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
      updateTimelineItemAnimation: (id: string, animation: AnimationConfig<MediaType> | undefined) => void
    },
    private mediaModule: {
      getMediaItem: (id: string) => { name: string } | undefined
    },
  ) {
    this.id = generateCommandId()

    // 获取时间轴项目信息用于描述
    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    let itemName = '未知素材'

    if (timelineItem) {
      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      itemName = mediaItem?.name || '未知素材'
      
      // 保存原始关键帧状态和动画状态
      if (timelineItem.animation) {
        this.originalKeyframes = cloneDeep(timelineItem.animation.keyframes)
        this.originalAnimationState = timelineItem.animation.isEnabled
      }
    }

    this.description = `清除所有关键帧: ${itemName}`

    console.log('💾 保存清除所有关键帧操作数据:', {
      timelineItemId,
      originalKeyframes: this.originalKeyframes,
      originalAnimationState: this.originalAnimationState
    })
  }

  /**
   * 执行命令：清除所有关键帧
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行清除所有关键帧操作: ${this.timelineItemId}...`)

      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem || !isKnownTimelineItem(timelineItem)) {
        throw new Error(`时间轴项目不存在或类型错误: ${this.timelineItemId}`)
      }

      // 如果没有动画配置，则不需要清除
      if (!timelineItem.animation) {
        console.log(`⚠️ 时间轴项目没有动画配置，跳过清除: ${this.timelineItemId}`)
        return
      }

      // 清除所有关键帧
      clearAllKeyframes(timelineItem)

      // 更新时间轴项目的动画配置
      this.timelineModule.updateTimelineItemAnimation(this.timelineItemId, timelineItem.animation)

      console.log(`✅ 所有关键帧清除成功: ${this.timelineItemId}`)
    } catch (error) {
      console.error(`❌ 清除所有关键帧失败: ${this.timelineItemId}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复到原始关键帧状态
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销清除所有关键帧操作: ${this.timelineItemId}...`)

      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem || !isKnownTimelineItem(timelineItem)) {
        throw new Error(`时间轴项目不存在或类型错误: ${this.timelineItemId}`)
      }

      // 确保动画配置存在
      if (!timelineItem.animation) {
        initializeAnimation(timelineItem)
      }

      // 恢复原始关键帧状态
      if (this.originalKeyframes) {
        // 使用非空断言操作符，因为我们已经检查了animation是否存在
        timelineItem.animation!.keyframes = cloneDeep(this.originalKeyframes) as any[]
        timelineItem.animation!.isEnabled = this.originalAnimationState
      }

      // 更新时间轴项目的动画配置
      this.timelineModule.updateTimelineItemAnimation(this.timelineItemId, timelineItem.animation)

      console.log(`↩️ 已撤销清除所有关键帧: ${this.timelineItemId}`)
    } catch (error) {
      console.error(`❌ 撤销清除所有关键帧失败: ${this.timelineItemId}`, error)
      throw error
    }
  }
}

// ==================== 关键帧命令工厂函数 ====================
/**
 * 提供便捷的命令创建方法
 */
export const KeyframeCommandFactory = {
  /**
   * 创建切换关键帧命令
   */
  createToggleKeyframeCommand(
    timelineItemId: string,
    timeFrames: number,
    properties: KeyframeProperty[],
    timelineModule: {
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
      updateTimelineItemAnimation: (id: string, animation: AnimationConfig<MediaType> | undefined) => void
    },
    mediaModule: {
      getMediaItem: (id: string) => { name: string } | undefined
    },
  ): ToggleKeyframeCommand {
    return new ToggleKeyframeCommand(
      timelineItemId,
      timeFrames,
      properties,
      timelineModule,
      mediaModule,
    )
  },

  /**
   * 创建更新关键帧属性命令
   */
  createUpdateKeyframeCommand(
    timelineItemId: string,
    property: KeyframeProperty,
    oldTimeFrames: number,
    newTimeFrames: number,
    oldValue: KeyframeProperties[keyof KeyframeProperties] | number,
    newValue: KeyframeProperties[keyof KeyframeProperties] | number,
    oldInterpolation: KeyframeInterpolation,
    newInterpolation: KeyframeInterpolation,
    oldEasing: KeyframeEasing,
    newEasing: KeyframeEasing,
    timelineModule: {
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
      updateTimelineItemAnimation: (id: string, animation: AnimationConfig<MediaType> | undefined) => void
    },
    mediaModule: {
      getMediaItem: (id: string) => { name: string } | undefined
    },
  ): UpdateKeyframeCommand {
    return new UpdateKeyframeCommand(
      timelineItemId,
      property,
      oldTimeFrames,
      newTimeFrames,
      oldValue,
      newValue,
      oldInterpolation,
      newInterpolation,
      oldEasing,
      newEasing,
      timelineModule,
      mediaModule,
    )
  },

  /**
   * 创建启用/禁用动画命令
   */
  createToggleAnimationCommand(
    timelineItemId: string,
    enable: boolean,
    timelineModule: {
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
      updateTimelineItemAnimation: (id: string, animation: AnimationConfig<MediaType> | undefined) => void
    },
    mediaModule: {
      getMediaItem: (id: string) => { name: string } | undefined
    },
  ): ToggleAnimationCommand {
    return new ToggleAnimationCommand(
      timelineItemId,
      enable,
      timelineModule,
      mediaModule,
    )
  },

  /**
   * 创建清除所有关键帧命令
   */
  createClearAllKeyframesCommand(
    timelineItemId: string,
    timelineModule: {
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
      updateTimelineItemAnimation: (id: string, animation: AnimationConfig<MediaType> | undefined) => void
    },
    mediaModule: {
      getMediaItem: (id: string) => { name: string } | undefined
    },
  ): ClearAllKeyframesCommand {
    return new ClearAllKeyframesCommand(
      timelineItemId,
      timelineModule,
      mediaModule,
    )
  },
}
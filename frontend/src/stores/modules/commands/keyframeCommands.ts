/**
 * 关键帧操作命令类
 * 为关键帧系统提供撤销/重做支持
 */

import type {
  SimpleCommand,
  LocalTimelineItem,
  Keyframe,
  AnimationConfig,
  MediaType,
  GetMediaConfig,
} from '../../../types'
import { hasVisualProps } from '../../../types'
import { generateCommandId } from '../../../utils/idGenerator'

// ==================== 关键帧数据快照接口 ====================

// ===== 旧实现 (保留作为参考) =====
// interface KeyframeSnapshot {
//   /** 动画配置的完整快照 */
//   animationConfig: AnimationConfig | null
//   /** 时间轴项目的属性快照 */
//   itemProperties: {
//     x: number
//     y: number
//     width: number
//     height: number
//     rotation: number
//     opacity: number
//   }
// }

// ===== 新实现 - 类型安全的关键帧快照 =====

/**
 * 类型安全的关键帧状态快照
 * 用于保存和恢复关键帧的完整状态
 */
interface KeyframeSnapshot<T extends MediaType = MediaType> {
  /** 动画配置的完整快照 */
  animationConfig: AnimationConfig<T> | null
  /** 时间轴项目的属性快照（类型安全） */
  itemProperties: GetMediaConfig<T>
}

// ==================== 通用工具函数 ====================

/**
 * 通用的状态快照应用函数（遵循正确的数据流向：UI → WebAV → TimelineItem）
 * 类型安全版本
 */
async function applyKeyframeSnapshot<T extends MediaType = MediaType>(
  item: LocalTimelineItem<T>,
  snapshot: KeyframeSnapshot<T>,
  webavAnimationManager: { updateWebAVAnimation: (item: LocalTimelineItem<T>) => Promise<void> },
): Promise<void> {
  // 1. 恢复动画配置（关键帧数据）
  if (snapshot.animationConfig) {
    item.animation = {
      keyframes: snapshot.animationConfig.keyframes.map((kf) => ({
        framePosition: kf.framePosition,
        properties: { ...kf.properties },
      })),
      isEnabled: snapshot.animationConfig.isEnabled,
      easing: snapshot.animationConfig.easing,
    }
  } else {
    item.animation = undefined
  }

  // 2. 通过WebAV恢复属性值（遵循正确的数据流向）
  const sprite = item.sprite
  if (sprite && snapshot.itemProperties) {
    try {
      // 类型安全的属性恢复 - 只处理视觉属性
      if (hasVisualProps(item)) {
        const visualProps = snapshot.itemProperties as any // 临时类型断言，因为我们已经通过类型守卫确认

        // 恢复位置和尺寸
        if (visualProps.x !== undefined || visualProps.y !== undefined) {
          const { projectToWebavCoords } = await import('../../../utils/coordinateTransform')
          const { useVideoStore } = await import('../../../stores/videoStore')
          const videoStore = useVideoStore()

          const webavCoords = projectToWebavCoords(
            visualProps.x ?? item.config.x,
            visualProps.y ?? item.config.y,
            visualProps.width ?? item.config.width,
            visualProps.height ?? item.config.height,
            videoStore.videoResolution.width,
            videoStore.videoResolution.height,
          )
          sprite.rect.x = webavCoords.x
          sprite.rect.y = webavCoords.y
        }

        // 恢复尺寸
        if (visualProps.width !== undefined) {
          sprite.rect.w = visualProps.width
        }
        if (visualProps.height !== undefined) {
          sprite.rect.h = visualProps.height
        }

        // 恢复旋转
        if (visualProps.rotation !== undefined) {
          sprite.rect.angle = visualProps.rotation
        }

        // 恢复透明度
        if (visualProps.opacity !== undefined) {
          sprite.opacity = visualProps.opacity
        }
      }

      // 触发渲染更新
      const { useVideoStore } = await import('../../../stores/videoStore')
      const videoStore = useVideoStore()
      const avCanvas = videoStore.avCanvas
      if (avCanvas) {
        const currentTime = videoStore.currentFrame * (1000000 / 30)
        avCanvas.previewFrame(currentTime)
      }
    } catch (error) {
      console.error('🎬 [Keyframe Command] Failed to restore properties via WebAV:', error)
      // 如果WebAV更新失败，回退到直接更新TimelineItem
      Object.assign(item, snapshot.itemProperties)
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
      getTimelineItem: (id: string) => LocalTimelineItem | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: LocalTimelineItem) => Promise<void>
    },
    private playbackControls?: {
      seekTo: (frame: number) => void
    },
  ) {
    this.id = generateCommandId()
    this.description = `创建关键帧 (帧 ${frame})`

    // 保存执行前的状态快照
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${timelineItemId}`)
    }
    this.beforeSnapshot = this.createSnapshot(item)
  }

  /**
   * 创建状态快照（类型安全版本）
   */
  private createSnapshot(item: LocalTimelineItem): KeyframeSnapshot {
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
      itemProperties: { ...item.config } as any, // 使用完整的config作为快照
    }
  }

  /**
   * 应用状态快照
   */
  private async applySnapshot(item: LocalTimelineItem, snapshot: KeyframeSnapshot): Promise<void> {
    await applyKeyframeSnapshot(item, snapshot, this.webavAnimationManager)
  }

  /**
   * 执行命令：创建关键帧
   */
  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    // 检查播放头是否在clip时间范围内
    const { isPlayheadInTimelineItem } = await import('../../utils/timelineSearchUtils')
    if (!isPlayheadInTimelineItem(item, this.frame)) {
      // 使用通知系统显示用户友好的警告
      const { useVideoStore } = await import('../../../stores/videoStore')
      const videoStore = useVideoStore()

      videoStore.showWarning(
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
      // 动态导入关键帧工具函数
      const { createKeyframe, enableAnimation, initializeAnimation } = await import(
        '../../../utils/unifiedKeyframeUtils'
      )

      // 1. 确保动画已启用
      if (!item.animation) {
        initializeAnimation(item)
      }
      enableAnimation(item)

      // 2. 创建关键帧
      const keyframe = createKeyframe(item, this.frame)
      item.animation!.keyframes.push(keyframe)

      // 3. 排序关键帧
      const { sortKeyframes } = await import('../../../utils/unifiedKeyframeUtils')
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
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
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
      getTimelineItem: (id: string) => LocalTimelineItem | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: LocalTimelineItem) => Promise<void>
    },
    private playbackControls?: {
      seekTo: (frame: number) => void
    },
  ) {
    this.id = generateCommandId()
    this.description = `删除关键帧 (帧 ${frame})`

    // 保存执行前的状态快照
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${timelineItemId}`)
    }
    this.beforeSnapshot = this.createSnapshot(item)
  }

  /**
   * 创建状态快照（类型安全版本）
   */
  private createSnapshot(item: LocalTimelineItem): KeyframeSnapshot {
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
      itemProperties: { ...item.config } as any, // 使用完整的config作为快照
    }
  }

  /**
   * 应用状态快照
   */
  private async applySnapshot(item: LocalTimelineItem, snapshot: KeyframeSnapshot): Promise<void> {
    await applyKeyframeSnapshot(item, snapshot, this.webavAnimationManager)
  }

  /**
   * 执行命令：删除关键帧
   */
  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    // 检查播放头是否在clip时间范围内
    const { isPlayheadInTimelineItem } = await import('../../utils/timelineSearchUtils')
    if (!isPlayheadInTimelineItem(item, this.frame)) {
      // 使用通知系统显示用户友好的警告
      const { useVideoStore } = await import('../../../stores/videoStore')
      const videoStore = useVideoStore()

      videoStore.showWarning(
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
      // 动态导入关键帧工具函数
      const { removeKeyframeAtFrame, disableAnimation } = await import(
        '../../../utils/unifiedKeyframeUtils'
      )

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
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
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
    private newValue: any,
    private timelineModule: {
      getTimelineItem: (id: string) => LocalTimelineItem | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: LocalTimelineItem) => Promise<void>
    },
    private playbackControls?: {
      seekTo: (frame: number) => void
    },
  ) {
    this.id = generateCommandId()
    this.description = `修改属性: ${property} (帧 ${frame})`

    // 保存执行前的状态快照
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${timelineItemId}`)
    }
    this.beforeSnapshot = this.createSnapshot(item)
  }

  /**
   * 创建状态快照（类型安全版本）
   */
  private createSnapshot(item: LocalTimelineItem): KeyframeSnapshot {
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
      itemProperties: { ...item.config } as any, // 使用完整的config作为快照
    }
  }

  /**
   * 应用状态快照
   */
  private async applySnapshot(item: LocalTimelineItem, snapshot: KeyframeSnapshot): Promise<void> {
    await applyKeyframeSnapshot(item, snapshot, this.webavAnimationManager)
  }

  /**
   * 执行命令：更新属性（智能处理关键帧）
   */
  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    // 检查播放头是否在clip时间范围内
    const { isPlayheadInTimelineItem } = await import('../../utils/timelineSearchUtils')
    if (!isPlayheadInTimelineItem(item, this.frame)) {
      // 使用通知系统显示用户友好的警告
      const { useVideoStore } = await import('../../../stores/videoStore')
      const videoStore = useVideoStore()

      videoStore.showWarning(
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
      // 动态导入关键帧工具函数
      const { handlePropertyChange } = await import('../../../utils/unifiedKeyframeUtils')

      // 使用统一的属性修改处理逻辑（遵循正确的数据流向）
      // 注意：handlePropertyChange 内部已经包含了 updateWebAVAnimation 调用，无需重复调用
      const actionType = await handlePropertyChange(item, this.frame, this.property, this.newValue)

      // 保存执行后的状态快照
      this.afterSnapshot = this.createSnapshot(item)

      // 重做属性修改时，跳转到相关帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      // 根据实际处理类型显示不同的日志
      const actionMessages = {
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
   * 撤销命令：恢复到修改前的状态
   */
  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
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

// ==================== 清除所有关键帧命令 ====================

/**
 * 清除所有关键帧命令
 * 支持清除时间轴项目的所有关键帧并禁用动画
 */
export class ClearAllKeyframesCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private beforeSnapshot: KeyframeSnapshot
  private afterSnapshot: KeyframeSnapshot | null = null

  constructor(
    private timelineItemId: string,
    private timelineModule: {
      getTimelineItem: (id: string) => LocalTimelineItem | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: LocalTimelineItem) => Promise<void>
    },
    private playbackControls?: {
      seekTo: (frame: number) => void
    },
  ) {
    this.id = generateCommandId()
    this.description = `清除所有关键帧`

    // 保存执行前的状态快照
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${timelineItemId}`)
    }
    this.beforeSnapshot = this.createSnapshot(item)
  }

  /**
   * 创建状态快照（类型安全版本）
   */
  private createSnapshot(item: LocalTimelineItem): KeyframeSnapshot {
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
      itemProperties: { ...item.config } as any, // 使用完整的config作为快照
    }
  }

  /**
   * 应用状态快照
   */
  private async applySnapshot(item: LocalTimelineItem, snapshot: KeyframeSnapshot): Promise<void> {
    await applyKeyframeSnapshot(item, snapshot, this.webavAnimationManager)
  }

  /**
   * 执行命令：清除所有关键帧
   */
  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    try {
      // 动态导入关键帧工具函数
      const { clearAllKeyframes } = await import('../../../utils/unifiedKeyframeUtils')

      // 清除所有关键帧
      clearAllKeyframes(item)

      // 更新WebAV动画
      await this.webavAnimationManager.updateWebAVAnimation(item)

      // 保存执行后的状态快照
      this.afterSnapshot = this.createSnapshot(item)

      // 重做清除关键帧操作时，跳转到时间轴项目的开始位置
      if (this.playbackControls && item.timeRange) {
        this.playbackControls.seekTo(item.timeRange.timelineStartTime)
      }

      console.log('✅ 清除所有关键帧命令执行成功:', {
        itemId: this.timelineItemId,
      })
    } catch (error) {
      console.error('❌ 清除所有关键帧命令执行失败:', error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复到清除前的状态
   */
  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    try {
      await this.applySnapshot(item, this.beforeSnapshot)

      // 撤销清除关键帧操作时，跳转到第一个关键帧位置（seekTo会自动触发渲染更新）
      if (this.playbackControls && this.beforeSnapshot.animationConfig?.keyframes?.length) {
        const firstKeyframe = this.beforeSnapshot.animationConfig.keyframes[0]
        if (firstKeyframe && item.timeRange) {
          // 将帧位置转换为绝对帧数
          const { relativeFrameToAbsoluteFrame } = await import(
            '../../../utils/unifiedKeyframeUtils'
          )
          const absoluteFrame = relativeFrameToAbsoluteFrame(
            firstKeyframe.framePosition,
            item.timeRange,
          )
          this.playbackControls.seekTo(absoluteFrame)
        }
      }

      console.log('↩️ 清除所有关键帧命令撤销成功:', {
        itemId: this.timelineItemId,
      })
    } catch (error) {
      console.error('❌ 清除所有关键帧命令撤销失败:', error)
      throw error
    }
  }
}

// ==================== 切换关键帧命令 ====================

/**
 * 切换关键帧命令
 * 根据当前状态智能地创建或删除关键帧
 * 这是最常用的关键帧操作命令，对应关键帧按钮的点击行为
 */
export class ToggleKeyframeCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private beforeSnapshot: KeyframeSnapshot
  private afterSnapshot: KeyframeSnapshot | null = null

  constructor(
    private timelineItemId: string,
    private frame: number,
    private timelineModule: {
      getTimelineItem: (id: string) => LocalTimelineItem | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: LocalTimelineItem) => Promise<void>
    },
    private playbackControls?: {
      seekTo: (frame: number) => void
    },
  ) {
    this.id = generateCommandId()
    this.description = `切换关键帧 (帧 ${frame})`

    // 保存执行前的状态快照
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${timelineItemId}`)
    }
    this.beforeSnapshot = this.createSnapshot(item)
  }

  /**
   * 创建状态快照（类型安全版本）
   */
  private createSnapshot(item: LocalTimelineItem): KeyframeSnapshot {
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
      itemProperties: { ...item.config } as any, // 使用完整的config作为快照
    }
  }

  /**
   * 应用状态快照
   */
  private async applySnapshot(item: LocalTimelineItem, snapshot: KeyframeSnapshot): Promise<void> {
    await applyKeyframeSnapshot(item, snapshot, this.webavAnimationManager)
  }

  /**
   * 执行命令：切换关键帧
   */
  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    // 检查播放头是否在clip时间范围内
    const { isPlayheadInTimelineItem } = await import('../../utils/timelineSearchUtils')
    if (!isPlayheadInTimelineItem(item, this.frame)) {
      // 使用通知系统显示用户友好的警告
      const { useVideoStore } = await import('../../../stores/videoStore')
      const videoStore = useVideoStore()

      videoStore.showWarning(
        '无法切换关键帧',
        '播放头不在当前视频片段的时间范围内。请将播放头移动到片段内再尝试切换关键帧。',
      )

      console.warn('🎬 [Toggle Keyframe Command] 播放头不在当前clip时间范围内，无法切换关键帧:', {
        itemId: this.timelineItemId,
        frame: this.frame,
        clipTimeRange: {
          start: item.timeRange.timelineStartTime,
          end: item.timeRange.timelineEndTime,
        },
      })
      throw new Error('播放头不在当前clip时间范围内，无法切换关键帧')
    }

    try {
      // 动态导入关键帧工具函数
      const { toggleKeyframe } = await import('../../../utils/unifiedKeyframeUtils')

      // 使用统一的关键帧切换逻辑
      toggleKeyframe(item, this.frame)

      // 更新WebAV动画
      await this.webavAnimationManager.updateWebAVAnimation(item)

      // 保存执行后的状态快照
      this.afterSnapshot = this.createSnapshot(item)

      // 重做关键帧切换操作时，跳转到相关帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('✅ 切换关键帧命令执行成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
      })
    } catch (error) {
      console.error('❌ 切换关键帧命令执行失败:', error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复到切换前的状态
   */
  async undo(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    try {
      await this.applySnapshot(item, this.beforeSnapshot)

      // 撤销关键帧切换操作时，跳转到相关帧位置（seekTo会自动触发渲染更新）
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('↩️ 切换关键帧命令撤销成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
      })
    } catch (error) {
      console.error('❌ 切换关键帧命令撤销失败:', error)
      throw error
    }
  }
}

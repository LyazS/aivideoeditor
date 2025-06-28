/**
 * 关键帧操作命令类
 * 为关键帧系统提供撤销/重做支持
 */

import type { SimpleCommand, TimelineItem, Keyframe, AnimationConfig } from '../../../types'
import { generateCommandId } from '../../../utils/idGenerator'

// ==================== 关键帧数据快照接口 ====================

/**
 * 关键帧状态快照
 * 用于保存和恢复关键帧的完整状态
 */
interface KeyframeSnapshot {
  /** 动画配置的完整快照 */
  animationConfig: AnimationConfig | null
  /** 时间轴项目的属性快照 */
  itemProperties: {
    x: number
    y: number
    width: number
    height: number
    rotation: number
    opacity: number
  }
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
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: TimelineItem) => Promise<void>
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
   * 创建状态快照
   */
  private createSnapshot(item: TimelineItem): KeyframeSnapshot {
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
      itemProperties: {
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
   * 应用状态快照
   */
  private async applySnapshot(item: TimelineItem, snapshot: KeyframeSnapshot): Promise<void> {
    // 恢复动画配置
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

    // 恢复项目属性
    Object.assign(item, snapshot.itemProperties)

    // 更新WebAV动画
    await this.webavAnimationManager.updateWebAVAnimation(item)
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
    const { isPlayheadInTimelineItem } = await import('../../../utils/timeOverlapUtils')
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

      // 撤销关键帧操作时，跳转到相关帧位置
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
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: TimelineItem) => Promise<void>
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
   * 创建状态快照
   */
  private createSnapshot(item: TimelineItem): KeyframeSnapshot {
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
      itemProperties: {
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
   * 应用状态快照
   */
  private async applySnapshot(item: TimelineItem, snapshot: KeyframeSnapshot): Promise<void> {
    // 恢复动画配置
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

    // 恢复项目属性
    Object.assign(item, snapshot.itemProperties)

    // 更新WebAV动画
    await this.webavAnimationManager.updateWebAVAnimation(item)
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
    const { isPlayheadInTimelineItem } = await import('../../../utils/timeOverlapUtils')
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

      // 撤销关键帧操作时，跳转到相关帧位置
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

// ==================== 更新关键帧属性命令 ====================

/**
 * 更新关键帧属性命令
 * 支持修改关键帧中的属性值
 */
export class UpdateKeyframePropertyCommand implements SimpleCommand {
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
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: TimelineItem) => Promise<void>
    },
    private playbackControls?: {
      seekTo: (frame: number) => void
    },
  ) {
    this.id = generateCommandId()
    this.description = `修改关键帧属性: ${property} (帧 ${frame})`

    // 保存执行前的状态快照
    const item = this.timelineModule.getTimelineItem(timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${timelineItemId}`)
    }
    this.beforeSnapshot = this.createSnapshot(item)
  }

  /**
   * 创建状态快照
   */
  private createSnapshot(item: TimelineItem): KeyframeSnapshot {
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
      itemProperties: {
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
   * 应用状态快照
   */
  private async applySnapshot(item: TimelineItem, snapshot: KeyframeSnapshot): Promise<void> {
    // 恢复动画配置
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

    // 恢复项目属性
    Object.assign(item, snapshot.itemProperties)

    // 更新WebAV动画
    await this.webavAnimationManager.updateWebAVAnimation(item)
  }

  /**
   * 执行命令：更新关键帧属性
   */
  async execute(): Promise<void> {
    const item = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!item) {
      throw new Error(`时间轴项目不存在: ${this.timelineItemId}`)
    }

    // 检查播放头是否在clip时间范围内
    const { isPlayheadInTimelineItem } = await import('../../../utils/timeOverlapUtils')
    if (!isPlayheadInTimelineItem(item, this.frame)) {
      // 使用通知系统显示用户友好的警告
      const { useVideoStore } = await import('../../../stores/videoStore')
      const videoStore = useVideoStore()

      videoStore.showWarning(
        '无法更新关键帧属性',
        '播放头不在当前视频片段的时间范围内。请将播放头移动到片段内再尝试修改属性。',
      )

      console.warn(
        '🎬 [Update Keyframe Property Command] 播放头不在当前clip时间范围内，无法更新关键帧属性:',
        {
          itemId: this.timelineItemId,
          frame: this.frame,
          property: this.property,
          value: this.newValue,
          clipTimeRange: {
            start: item.timeRange.timelineStartTime,
            end: item.timeRange.timelineEndTime,
          },
        },
      )
      throw new Error('播放头不在当前clip时间范围内，无法更新关键帧属性')
    }

    try {
      // 动态导入关键帧工具函数
      const { handlePropertyChange } = await import('../../../utils/unifiedKeyframeUtils')

      // 使用统一的属性修改处理逻辑
      handlePropertyChange(item, this.frame, this.property, this.newValue)

      // 更新WebAV动画
      await this.webavAnimationManager.updateWebAVAnimation(item)

      // 保存执行后的状态快照
      this.afterSnapshot = this.createSnapshot(item)

      // 重做关键帧属性修改时，跳转到相关帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('✅ 更新关键帧属性命令执行成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
        property: this.property,
        value: this.newValue,
      })
    } catch (error) {
      console.error('❌ 更新关键帧属性命令执行失败:', error)
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

      // 撤销关键帧属性修改时，跳转到相关帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.frame)
      }

      console.log('↩️ 更新关键帧属性命令撤销成功:', {
        itemId: this.timelineItemId,
        frame: this.frame,
        property: this.property,
      })
    } catch (error) {
      console.error('❌ 更新关键帧属性命令撤销失败:', error)
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
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: TimelineItem) => Promise<void>
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
   * 创建状态快照
   */
  private createSnapshot(item: TimelineItem): KeyframeSnapshot {
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
      itemProperties: {
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
   * 应用状态快照
   */
  private async applySnapshot(item: TimelineItem, snapshot: KeyframeSnapshot): Promise<void> {
    // 恢复动画配置
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

    // 恢复项目属性
    Object.assign(item, snapshot.itemProperties)

    // 更新WebAV动画
    await this.webavAnimationManager.updateWebAVAnimation(item)
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

      // 撤销清除关键帧操作时，跳转到第一个关键帧位置
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
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private webavAnimationManager: {
      updateWebAVAnimation: (item: TimelineItem) => Promise<void>
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
   * 创建状态快照
   */
  private createSnapshot(item: TimelineItem): KeyframeSnapshot {
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
      itemProperties: {
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
   * 应用状态快照
   */
  private async applySnapshot(item: TimelineItem, snapshot: KeyframeSnapshot): Promise<void> {
    // 恢复动画配置
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

    // 恢复项目属性
    Object.assign(item, snapshot.itemProperties)

    // 更新WebAV动画
    await this.webavAnimationManager.updateWebAVAnimation(item)
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
    const { isPlayheadInTimelineItem } = await import('../../../utils/timeOverlapUtils')
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

      // 撤销关键帧切换操作时，跳转到相关帧位置
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

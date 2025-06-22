import type { SimpleCommand } from '../historyModule'
import { generateCommandId } from '../../../utils/idGenerator'
import type { TimelineItem } from '../../../types/videoTypes'
import type { AnimatableProperty, AnimationConfig } from '../../../types/animationTypes'
import { KeyFrameAnimationManager } from '../../../utils/keyFrameAnimationManager'
import { getCurrentPropertyValue, getPropertyValueAtTime } from '../../../utils/animationUtils'

/**
 * 创建关键帧命令
 * 支持在指定时间点为指定属性创建关键帧的撤销/重做操作
 */
export class CreateKeyFrameCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string

  constructor(
    private timelineItemId: string,
    private property: AnimatableProperty,
    private time: number,
    private value: number,
    private timelineModule: {
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private videoResolution: { width: number; height: number }
  ) {
    this.id = generateCommandId()
    this.description = `创建关键帧: ${property} = ${value} (${time}s)`

    console.log('💾 保存创建关键帧操作数据:', {
      timelineItemId,
      property,
      time,
      value,
    })
  }

  /**
   * 执行命令：创建关键帧
   */
  async execute(): Promise<void> {
    try {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法创建关键帧: ${this.timelineItemId}`)
        return
      }

      KeyFrameAnimationManager.createKeyFrame(
        timelineItem,
        this.property,
        this.time,
        this.value,
        this.videoResolution
      )

      console.log(`✅ 已创建关键帧: ${this.property} = ${this.value} (${this.time}s)`)
    } catch (error) {
      console.error(`❌ 创建关键帧失败: ${this.property}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：删除创建的关键帧
   */
  async undo(): Promise<void> {
    try {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法撤销关键帧创建: ${this.timelineItemId}`)
        return
      }

      KeyFrameAnimationManager.removeKeyFrameProperty(
        timelineItem,
        this.property,
        this.time
      )

      console.log(`↩️ 已撤销关键帧创建: ${this.property} (${this.time}s)`)
    } catch (error) {
      console.error(`❌ 撤销关键帧创建失败: ${this.property}`, error)
      throw error
    }
  }
}

/**
 * 删除关键帧命令
 * 支持删除指定时间点指定属性的关键帧的撤销/重做操作
 */
export class RemoveKeyFrameCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private removedKeyFrameData: {
    value: number
    videoResolution: { width: number; height: number }
  } | null = null

  constructor(
    private timelineItemId: string,
    private property: AnimatableProperty,
    private time: number,
    private timelineModule: {
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private videoResolution: { width: number; height: number }
  ) {
    this.id = generateCommandId()
    this.description = `删除关键帧: ${property} (${time}s)`
    
    // 保存要删除的关键帧数据用于撤销
    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    if (timelineItem) {
      const currentValue = getPropertyValueAtTime(timelineItem, property, time)
      this.removedKeyFrameData = {
        value: currentValue,
        videoResolution: { ...videoResolution }
      }
    }

    console.log('💾 保存删除关键帧操作数据:', {
      timelineItemId,
      property,
      time,
      removedValue: this.removedKeyFrameData?.value,
    })
  }

  /**
   * 执行命令：删除关键帧
   */
  async execute(): Promise<void> {
    try {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法删除关键帧: ${this.timelineItemId}`)
        return
      }

      KeyFrameAnimationManager.removeKeyFrameProperty(
        timelineItem,
        this.property,
        this.time
      )

      console.log(`✅ 已删除关键帧: ${this.property} (${this.time}s)`)
    } catch (error) {
      console.error(`❌ 删除关键帧失败: ${this.property}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复被删除的关键帧
   */
  async undo(): Promise<void> {
    try {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem || !this.removedKeyFrameData) {
        console.warn(`⚠️ 无法撤销关键帧删除，缺少必要数据: ${this.timelineItemId}`)
        return
      }

      // 恢复被删除的关键帧
      KeyFrameAnimationManager.createKeyFrame(
        timelineItem,
        this.property,
        this.time,
        this.removedKeyFrameData.value,
        this.removedKeyFrameData.videoResolution
      )

      console.log(`↩️ 已恢复关键帧: ${this.property} = ${this.removedKeyFrameData.value} (${this.time}s)`)
    } catch (error) {
      console.error(`❌ 撤销关键帧删除失败: ${this.property}`, error)
      throw error
    }
  }
}

/**
 * 清除动画命令
 * 支持清除时间轴项目所有动画配置的撤销/重做操作
 */
export class ClearAnimationCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private savedAnimationConfig: AnimationConfig | null = null

  constructor(
    private timelineItemId: string,
    private timelineModule: {
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private videoResolution: { width: number; height: number }
  ) {
    this.id = generateCommandId()
    this.description = '清除动画'
    
    // 保存当前动画配置用于撤销
    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    if (timelineItem?.animationConfig) {
      this.savedAnimationConfig = JSON.parse(JSON.stringify(timelineItem.animationConfig))
    }

    console.log('💾 保存清除动画操作数据:', {
      timelineItemId,
      hasAnimationConfig: !!this.savedAnimationConfig,
      keyFrameCount: this.savedAnimationConfig?.keyFrames.length || 0,
    })
  }

  /**
   * 执行命令：清除动画配置
   */
  async execute(): Promise<void> {
    try {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法清除动画: ${this.timelineItemId}`)
        return
      }

      // 清除动画配置
      timelineItem.animationConfig = undefined
      KeyFrameAnimationManager.clearSpriteAnimation(timelineItem.sprite)

      console.log(`✅ 已清除动画配置`)
    } catch (error) {
      console.error(`❌ 清除动画失败`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复动画配置
   */
  async undo(): Promise<void> {
    try {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem || !this.savedAnimationConfig) {
        console.warn(`⚠️ 无法撤销动画清除，缺少必要数据: ${this.timelineItemId}`)
        return
      }

      // 恢复动画配置
      timelineItem.animationConfig = this.savedAnimationConfig

      // 重新应用动画到sprite
      KeyFrameAnimationManager.applyAnimationToSprite(
        timelineItem.sprite,
        this.savedAnimationConfig,
        timelineItem,
        this.videoResolution
      )

      console.log(`↩️ 已恢复动画配置，包含 ${this.savedAnimationConfig.keyFrames.length} 个关键帧`)
    } catch (error) {
      console.error(`❌ 撤销动画清除失败`, error)
      throw error
    }
  }
}

/**
 * 更新关键帧命令
 * 支持更新指定时间点指定属性的关键帧值的撤销/重做操作
 */
export class UpdateKeyFrameCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private oldValue: number

  constructor(
    private timelineItemId: string,
    private property: AnimatableProperty,
    private time: number,
    private newValue: number,
    private timelineModule: {
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private videoResolution: { width: number; height: number }
  ) {
    this.id = generateCommandId()
    this.description = `更新关键帧: ${property} = ${newValue} (${time}s)`

    // 保存旧值用于撤销
    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    this.oldValue = timelineItem ? getPropertyValueAtTime(timelineItem, property, time) : 0

    console.log('💾 保存更新关键帧操作数据:', {
      timelineItemId,
      property,
      time,
      oldValue: this.oldValue,
      newValue,
    })
  }

  /**
   * 执行命令：更新关键帧值
   */
  async execute(): Promise<void> {
    try {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法更新关键帧: ${this.timelineItemId}`)
        return
      }

      KeyFrameAnimationManager.createKeyFrame(
        timelineItem,
        this.property,
        this.time,
        this.newValue,
        this.videoResolution
      )

      console.log(`✅ 已更新关键帧: ${this.property} = ${this.newValue} (${this.time}s)`)
    } catch (error) {
      console.error(`❌ 更新关键帧失败: ${this.property}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复关键帧旧值
   */
  async undo(): Promise<void> {
    try {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法撤销关键帧更新: ${this.timelineItemId}`)
        return
      }

      KeyFrameAnimationManager.createKeyFrame(
        timelineItem,
        this.property,
        this.time,
        this.oldValue,
        this.videoResolution
      )

      console.log(`↩️ 已撤销关键帧更新: ${this.property} = ${this.oldValue} (${this.time}s)`)
    } catch (error) {
      console.error(`❌ 撤销关键帧更新失败: ${this.property}`, error)
      throw error
    }
  }
}

/**
 * 切换动画启用状态命令
 * 支持启用/禁用动画的撤销/重做操作
 */
export class ToggleAnimationCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private oldEnabled: boolean

  constructor(
    private timelineItemId: string,
    private newEnabled: boolean,
    private timelineModule: {
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private videoResolution: { width: number; height: number }
  ) {
    this.id = generateCommandId()
    this.description = `${newEnabled ? '启用' : '禁用'}动画`

    // 保存当前启用状态
    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    this.oldEnabled = timelineItem?.animationConfig?.isEnabled ?? false

    console.log('💾 保存切换动画状态操作数据:', {
      timelineItemId,
      oldEnabled: this.oldEnabled,
      newEnabled,
    })
  }

  /**
   * 执行命令：切换动画启用状态
   */
  async execute(): Promise<void> {
    try {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法切换动画状态: ${this.timelineItemId}`)
        return
      }

      KeyFrameAnimationManager.setAnimationEnabled(
        timelineItem,
        this.newEnabled,
        this.videoResolution
      )

      console.log(`✅ 已${this.newEnabled ? '启用' : '禁用'}动画`)
    } catch (error) {
      console.error(`❌ 切换动画状态失败`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复动画启用状态
   */
  async undo(): Promise<void> {
    try {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法撤销动画状态切换: ${this.timelineItemId}`)
        return
      }

      KeyFrameAnimationManager.setAnimationEnabled(
        timelineItem,
        this.oldEnabled,
        this.videoResolution
      )

      console.log(`↩️ 已恢复动画状态: ${this.oldEnabled ? '启用' : '禁用'}`)
    } catch (error) {
      console.error(`❌ 撤销动画状态切换失败`, error)
      throw error
    }
  }
}

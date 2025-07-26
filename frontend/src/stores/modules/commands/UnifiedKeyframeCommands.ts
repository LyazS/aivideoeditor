import { generateCommandId } from '../../../utils/idGenerator'
import type { 
  UnifiedCommand, 
  CommandResult, 
  OperationType, 
  CommandTargetInfo, 
  StateTransitionInfo 
} from '../UnifiedHistoryModule'
import type { UnifiedTimelineItem } from '../../../unified/timelineitem/types'
import type { UnifiedMediaItemData } from '../../../unified/UnifiedMediaItem'

/**
 * 统一关键帧命令基类
 * 基于新架构的统一类型设计，提供关键帧操作的基础功能
 */
export abstract class UnifiedKeyframeCommand implements UnifiedCommand {
  public readonly id: string
  public readonly description: string
  public readonly timestamp: number
  public readonly operationType: OperationType
  public readonly targetInfo: CommandTargetInfo
  public readonly stateTransition: StateTransitionInfo

  constructor(
    operationType: OperationType,
    targetIds: string[],
    description: string,
    protected timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
    },
    protected mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
    protected webavAnimationManager?: {
      updateWebAVAnimation: (item: UnifiedTimelineItem) => Promise<void>
    },
    protected playbackControls?: {
      seekTo: (frame: number) => void
    }
  ) {
    this.id = generateCommandId()
    this.description = description
    this.timestamp = Date.now()
    this.operationType = operationType
    this.targetInfo = {
      type: 'timeline',
      ids: targetIds
    }
    this.stateTransition = {}
  }

  abstract execute(): Promise<CommandResult>
  abstract undo(): Promise<CommandResult>

  /**
   * 检查命令是否可以执行
   */
  canExecute(): boolean {
    return this.targetInfo.ids.every(id => this.timelineModule.getUnifiedTimelineItem(id) !== undefined)
  }

  /**
   * 检查命令是否可以撤销
   */
  canUndo(): boolean {
    return true // 默认情况下所有命令都可以撤销
  }

  /**
   * 创建成功结果
   */
  protected createSuccessResult(message?: string): CommandResult {
    return {
      success: true,
      message: message || `${this.description} 执行成功`,
      timestamp: Date.now()
    }
  }

  /**
   * 创建错误结果
   */
  protected createErrorResult(error: string): CommandResult {
    return {
      success: false,
      error,
      timestamp: Date.now()
    }
  }

  /**
   * 创建关键帧快照
   */
  protected createKeyframeSnapshot(item: UnifiedTimelineItem): any {
    const mediaConfig = item.config.mediaConfig as any
    return {
      animationConfig: item.config.animation ? { ...item.config.animation } : null,
      itemProperties: {
        x: mediaConfig.x || 0,
        y: mediaConfig.y || 0,
        width: mediaConfig.width || 0,
        height: mediaConfig.height || 0,
        rotation: mediaConfig.rotation || 0,
        opacity: mediaConfig.opacity || 1,
        zIndex: mediaConfig.zIndex || 0,
        volume: mediaConfig.volume || 1,
        isMuted: mediaConfig.isMuted || false
      }
    }
  }

  /**
   * 恢复关键帧快照
   */
  protected async restoreKeyframeSnapshot(item: UnifiedTimelineItem, snapshot: any): Promise<void> {
    // 恢复动画配置
    if (snapshot.animationConfig) {
      item.config.animation = { ...snapshot.animationConfig }
    } else {
      item.config.animation = undefined
    }

    // 恢复项目属性
    const mediaConfig = item.config.mediaConfig as any
    Object.assign(mediaConfig, snapshot.itemProperties)

    // 更新WebAV动画
    if (this.webavAnimationManager) {
      await this.webavAnimationManager.updateWebAVAnimation(item)
    }
  }
}

/**
 * 统一创建关键帧命令
 * 在指定帧位置创建关键帧
 */
export class UnifiedCreateKeyframeCommand extends UnifiedKeyframeCommand {
  private beforeSnapshot: any = null
  private afterSnapshot: any = null

  constructor(
    private timelineItemId: string,
    private framePosition: number,
    timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      createKeyframe: (id: string, frame: number) => { success: boolean; error?: string }
    },
    mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
    webavAnimationManager?: {
      updateWebAVAnimation: (item: UnifiedTimelineItem) => Promise<void>
    },
    playbackControls?: {
      seekTo: (frame: number) => void
    }
  ) {
    const item = timelineModule.getUnifiedTimelineItem(timelineItemId)
    super(
      'keyframe.create',
      [timelineItemId],
      `创建关键帧: ${item?.config.name || '未知素材'} @ ${framePosition}帧`,
      timelineModule,
      mediaModule,
      webavAnimationManager,
      playbackControls
    )
    
    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { hasKeyframe: false },
      afterState: { hasKeyframe: true, framePosition }
    }
  }

  /**
   * 执行命令：创建关键帧
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一创建关键帧操作: ${this.description}`)

      const item = this.timelineModule.getUnifiedTimelineItem(this.timelineItemId)
      if (!item) {
        return this.createErrorResult('时间轴项目不存在')
      }

      // 保存执行前的快照
      this.beforeSnapshot = this.createKeyframeSnapshot(item)

      // 创建关键帧
      const result = (this.timelineModule as any).createKeyframe(this.timelineItemId, this.framePosition)
      if (!result.success) {
        return this.createErrorResult(result.error || '创建关键帧失败')
      }

      // 更新WebAV动画
      if (this.webavAnimationManager) {
        await this.webavAnimationManager.updateWebAVAnimation(item)
      }

      // 跳转到关键帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.framePosition)
      }

      // 保存执行后的快照
      this.afterSnapshot = this.createKeyframeSnapshot(item)

      console.log(`✅ 统一创建关键帧操作完成`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一创建关键帧操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：删除创建的关键帧
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一创建关键帧操作: ${this.description}`)

      const item = this.timelineModule.getUnifiedTimelineItem(this.timelineItemId)
      if (!item || !this.beforeSnapshot) {
        return this.createErrorResult('无法撤销创建关键帧操作')
      }

      // 恢复到执行前的状态
      await this.restoreKeyframeSnapshot(item, this.beforeSnapshot)

      console.log(`✅ 统一创建关键帧操作撤销完成`)
      return this.createSuccessResult('撤销创建关键帧操作成功')
    } catch (error) {
      const errorMessage = `撤销统一创建关键帧操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

/**
 * 统一删除关键帧命令
 * 删除指定帧位置的关键帧
 */
export class UnifiedDeleteKeyframeCommand extends UnifiedKeyframeCommand {
  private beforeSnapshot: any = null
  private afterSnapshot: any = null

  constructor(
    private timelineItemId: string,
    private framePosition: number,
    timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      deleteKeyframe: (id: string, frame: number) => { success: boolean; error?: string }
    },
    mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
    webavAnimationManager?: {
      updateWebAVAnimation: (item: UnifiedTimelineItem) => Promise<void>
    },
    playbackControls?: {
      seekTo: (frame: number) => void
    }
  ) {
    const item = timelineModule.getUnifiedTimelineItem(timelineItemId)
    super(
      'keyframe.delete',
      [timelineItemId],
      `删除关键帧: ${item?.config.name || '未知素材'} @ ${framePosition}帧`,
      timelineModule,
      mediaModule,
      webavAnimationManager,
      playbackControls
    )
    
    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { hasKeyframe: true, framePosition },
      afterState: { hasKeyframe: false }
    }
  }

  /**
   * 执行命令：删除关键帧
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一删除关键帧操作: ${this.description}`)

      const item = this.timelineModule.getUnifiedTimelineItem(this.timelineItemId)
      if (!item) {
        return this.createErrorResult('时间轴项目不存在')
      }

      // 保存执行前的快照
      this.beforeSnapshot = this.createKeyframeSnapshot(item)

      // 删除关键帧
      const result = (this.timelineModule as any).deleteKeyframe(this.timelineItemId, this.framePosition)
      if (!result.success) {
        return this.createErrorResult(result.error || '删除关键帧失败')
      }

      // 更新WebAV动画
      if (this.webavAnimationManager) {
        await this.webavAnimationManager.updateWebAVAnimation(item)
      }

      // 保存执行后的快照
      this.afterSnapshot = this.createKeyframeSnapshot(item)

      console.log(`✅ 统一删除关键帧操作完成`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一删除关键帧操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复删除的关键帧
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一删除关键帧操作: ${this.description}`)

      const item = this.timelineModule.getUnifiedTimelineItem(this.timelineItemId)
      if (!item || !this.beforeSnapshot) {
        return this.createErrorResult('无法撤销删除关键帧操作')
      }

      // 恢复到执行前的状态
      await this.restoreKeyframeSnapshot(item, this.beforeSnapshot)

      // 跳转到关键帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.framePosition)
      }

      console.log(`✅ 统一删除关键帧操作撤销完成`)
      return this.createSuccessResult('撤销删除关键帧操作成功')
    } catch (error) {
      const errorMessage = `撤销统一删除关键帧操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

/**
 * 统一更新关键帧命令
 * 更新指定帧位置的关键帧属性
 */
export class UnifiedUpdateKeyframeCommand extends UnifiedKeyframeCommand {
  private beforeSnapshot: any = null
  private afterSnapshot: any = null

  constructor(
    private timelineItemId: string,
    private framePosition: number,
    private newProperties: Record<string, any>,
    timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      updateKeyframe: (id: string, frame: number, properties: any) => { success: boolean; error?: string }
    },
    mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
    webavAnimationManager?: {
      updateWebAVAnimation: (item: UnifiedTimelineItem) => Promise<void>
    },
    playbackControls?: {
      seekTo: (frame: number) => void
    }
  ) {
    const item = timelineModule.getUnifiedTimelineItem(timelineItemId)
    super(
      'keyframe.update',
      [timelineItemId],
      `更新关键帧: ${item?.config.name || '未知素材'} @ ${framePosition}帧`,
      timelineModule,
      mediaModule,
      webavAnimationManager,
      playbackControls
    )

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { framePosition, oldProperties: {} },
      afterState: { framePosition, newProperties }
    }
  }

  /**
   * 执行命令：更新关键帧
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一更新关键帧操作: ${this.description}`)

      const item = this.timelineModule.getUnifiedTimelineItem(this.timelineItemId)
      if (!item) {
        return this.createErrorResult('时间轴项目不存在')
      }

      // 保存执行前的快照
      this.beforeSnapshot = this.createKeyframeSnapshot(item)

      // 更新关键帧
      const result = (this.timelineModule as any).updateKeyframe(
        this.timelineItemId,
        this.framePosition,
        this.newProperties
      )
      if (!result.success) {
        return this.createErrorResult(result.error || '更新关键帧失败')
      }

      // 更新WebAV动画
      if (this.webavAnimationManager) {
        await this.webavAnimationManager.updateWebAVAnimation(item)
      }

      // 跳转到关键帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.framePosition)
      }

      // 保存执行后的快照
      this.afterSnapshot = this.createKeyframeSnapshot(item)

      console.log(`✅ 统一更新关键帧操作完成`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一更新关键帧操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复关键帧原始属性
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一更新关键帧操作: ${this.description}`)

      const item = this.timelineModule.getUnifiedTimelineItem(this.timelineItemId)
      if (!item || !this.beforeSnapshot) {
        return this.createErrorResult('无法撤销更新关键帧操作')
      }

      // 恢复到执行前的状态
      await this.restoreKeyframeSnapshot(item, this.beforeSnapshot)

      // 跳转到关键帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.framePosition)
      }

      console.log(`✅ 统一更新关键帧操作撤销完成`)
      return this.createSuccessResult('撤销更新关键帧操作成功')
    } catch (error) {
      const errorMessage = `撤销统一更新关键帧操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

/**
 * 统一清除所有关键帧命令
 * 清除时间轴项目的所有关键帧
 */
export class UnifiedClearAllKeyframesCommand extends UnifiedKeyframeCommand {
  private beforeSnapshot: any = null

  constructor(
    private timelineItemId: string,
    timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      clearAllKeyframes: (id: string) => { success: boolean; error?: string }
    },
    mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
    webavAnimationManager?: {
      updateWebAVAnimation: (item: UnifiedTimelineItem) => Promise<void>
    },
    playbackControls?: {
      seekTo: (frame: number) => void
    }
  ) {
    const item = timelineModule.getUnifiedTimelineItem(timelineItemId)
    super(
      'keyframe.clear',
      [timelineItemId],
      `清除所有关键帧: ${item?.config.name || '未知素材'}`,
      timelineModule,
      mediaModule,
      webavAnimationManager,
      playbackControls
    )

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { hasKeyframes: true },
      afterState: { hasKeyframes: false }
    }
  }

  /**
   * 执行命令：清除所有关键帧
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一清除所有关键帧操作: ${this.description}`)

      const item = this.timelineModule.getUnifiedTimelineItem(this.timelineItemId)
      if (!item) {
        return this.createErrorResult('时间轴项目不存在')
      }

      // 保存执行前的快照
      this.beforeSnapshot = this.createKeyframeSnapshot(item)

      // 清除所有关键帧
      const result = (this.timelineModule as any).clearAllKeyframes(this.timelineItemId)
      if (!result.success) {
        return this.createErrorResult(result.error || '清除所有关键帧失败')
      }

      // 更新WebAV动画
      if (this.webavAnimationManager) {
        await this.webavAnimationManager.updateWebAVAnimation(item)
      }

      // 跳转到时间轴项目开始位置
      if (this.playbackControls && item.timeRange) {
        this.playbackControls.seekTo(item.timeRange.timelineStartTime)
      }

      console.log(`✅ 统一清除所有关键帧操作完成`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一清除所有关键帧操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复所有关键帧
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一清除所有关键帧操作: ${this.description}`)

      const item = this.timelineModule.getUnifiedTimelineItem(this.timelineItemId)
      if (!item || !this.beforeSnapshot) {
        return this.createErrorResult('无法撤销清除所有关键帧操作')
      }

      // 恢复到执行前的状态
      await this.restoreKeyframeSnapshot(item, this.beforeSnapshot)

      console.log(`✅ 统一清除所有关键帧操作撤销完成`)
      return this.createSuccessResult('撤销清除所有关键帧操作成功')
    } catch (error) {
      const errorMessage = `撤销统一清除所有关键帧操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

/**
 * 统一切换关键帧命令
 * 在指定帧位置切换关键帧（存在则删除，不存在则创建）
 */
export class UnifiedToggleKeyframeCommand extends UnifiedKeyframeCommand {
  private beforeSnapshot: any = null
  private afterSnapshot: any = null
  private wasKeyframeCreated: boolean = false

  constructor(
    private timelineItemId: string,
    private framePosition: number,
    timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      toggleKeyframe: (id: string, frame: number) => { success: boolean; error?: string; created?: boolean }
    },
    mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
    webavAnimationManager?: {
      updateWebAVAnimation: (item: UnifiedTimelineItem) => Promise<void>
    },
    playbackControls?: {
      seekTo: (frame: number) => void
    }
  ) {
    const item = timelineModule.getUnifiedTimelineItem(timelineItemId)
    super(
      'keyframe.create', // 默认操作类型，实际执行时可能变化
      [timelineItemId],
      `切换关键帧: ${item?.config.name || '未知素材'} @ ${framePosition}帧`,
      timelineModule,
      mediaModule,
      webavAnimationManager,
      playbackControls
    )

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { framePosition },
      afterState: { framePosition, toggled: true }
    }
  }

  /**
   * 执行命令：切换关键帧
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一切换关键帧操作: ${this.description}`)

      const item = this.timelineModule.getUnifiedTimelineItem(this.timelineItemId)
      if (!item) {
        return this.createErrorResult('时间轴项目不存在')
      }

      // 保存执行前的快照
      this.beforeSnapshot = this.createKeyframeSnapshot(item)

      // 切换关键帧
      const result = (this.timelineModule as any).toggleKeyframe(this.timelineItemId, this.framePosition)
      if (!result.success) {
        return this.createErrorResult(result.error || '切换关键帧失败')
      }

      // 记录是否创建了关键帧
      this.wasKeyframeCreated = result.created || false

      // 更新操作类型
      ;(this as any).operationType = this.wasKeyframeCreated ? 'keyframe.create' : 'keyframe.delete'

      // 更新WebAV动画
      if (this.webavAnimationManager) {
        await this.webavAnimationManager.updateWebAVAnimation(item)
      }

      // 跳转到关键帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.framePosition)
      }

      // 保存执行后的快照
      this.afterSnapshot = this.createKeyframeSnapshot(item)

      const action = this.wasKeyframeCreated ? '创建' : '删除'
      console.log(`✅ 统一切换关键帧操作完成: ${action}了关键帧`)
      return this.createSuccessResult(`${action}了关键帧`)
    } catch (error) {
      const errorMessage = `统一切换关键帧操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复切换前的状态
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一切换关键帧操作: ${this.description}`)

      const item = this.timelineModule.getUnifiedTimelineItem(this.timelineItemId)
      if (!item || !this.beforeSnapshot) {
        return this.createErrorResult('无法撤销切换关键帧操作')
      }

      // 恢复到执行前的状态
      await this.restoreKeyframeSnapshot(item, this.beforeSnapshot)

      // 跳转到关键帧位置
      if (this.playbackControls) {
        this.playbackControls.seekTo(this.framePosition)
      }

      const action = this.wasKeyframeCreated ? '删除' : '恢复'
      console.log(`✅ 统一切换关键帧操作撤销完成: ${action}了关键帧`)
      return this.createSuccessResult(`撤销切换关键帧操作成功`)
    } catch (error) {
      const errorMessage = `撤销统一切换关键帧操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

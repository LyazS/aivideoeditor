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
 * 统一轨道命令基类
 * 基于新架构的统一类型设计，提供轨道操作的基础功能
 */
export abstract class UnifiedTrackCommand implements UnifiedCommand {
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
    protected trackModule: {
      getTrack: (id: string) => any
    }
  ) {
    this.id = generateCommandId()
    this.description = description
    this.timestamp = Date.now()
    this.operationType = operationType
    this.targetInfo = {
      type: 'track',
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
    return this.targetInfo.ids.every(id => this.trackModule.getTrack(id) !== undefined)
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
}

/**
 * 统一添加轨道命令
 * 基于新架构的轨道添加操作，支持撤销/重做
 */
export class UnifiedAddTrackCommand extends UnifiedTrackCommand {
  private addedTrack: any = null

  constructor(
    private trackData: {
      id: string
      name: string
      type: 'video' | 'audio' | 'text'
      height?: number
      isVisible?: boolean
      isMuted?: boolean
    },
    trackModule: {
      getTrack: (id: string) => any
      addTrack: (track: any) => { success: boolean; error?: string }
      removeTrack: (id: string) => { success: boolean; error?: string }
    }
  ) {
    super(
      'track.create',
      [trackData.id],
      `添加轨道: ${trackData.name}`,
      trackModule
    )
    
    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { trackExists: false },
      afterState: { trackExists: true, trackData: { ...trackData } }
    }
  }

  /**
   * 执行命令：添加轨道
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一添加轨道操作: ${this.description}`)

      // 添加轨道
      const result = (this.trackModule as any).addTrack(this.trackData)
      if (!result.success) {
        return this.createErrorResult(result.error || '添加轨道失败')
      }

      this.addedTrack = this.trackData
      console.log(`✅ 统一添加轨道操作完成: ${this.trackData.name}`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一添加轨道操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：移除轨道
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一添加轨道操作: ${this.description}`)

      if (!this.addedTrack) {
        return this.createErrorResult('没有可撤销的添加轨道操作')
      }

      // 移除轨道
      const result = (this.trackModule as any).removeTrack(this.addedTrack.id)
      if (!result.success) {
        return this.createErrorResult(result.error || '撤销添加轨道操作失败')
      }

      console.log(`✅ 统一添加轨道操作撤销完成: ${this.addedTrack.name}`)
      return this.createSuccessResult('撤销添加轨道操作成功')
    } catch (error) {
      const errorMessage = `撤销统一添加轨道操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

/**
 * 统一移除轨道命令
 * 基于新架构的轨道移除操作，支持撤销/重做
 */
export class UnifiedRemoveTrackCommand extends UnifiedTrackCommand {
  private removedTrack: any = null

  constructor(
    private trackId: string,
    trackModule: {
      getTrack: (id: string) => any
      addTrack: (track: any) => { success: boolean; error?: string }
      removeTrack: (id: string) => { success: boolean; error?: string }
    }
  ) {
    const track = trackModule.getTrack(trackId)
    super(
      'track.delete',
      [trackId],
      `移除轨道: ${track?.name || '未知轨道'}`,
      trackModule
    )
    
    // 保存要移除的轨道
    this.removedTrack = track ? { ...track } : null
    
    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { trackExists: true, trackData: this.removedTrack },
      afterState: { trackExists: false }
    }
  }

  /**
   * 执行命令：移除轨道
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一移除轨道操作: ${this.description}`)

      if (!this.removedTrack) {
        return this.createErrorResult('要移除的轨道不存在')
      }

      // 移除轨道
      const result = (this.trackModule as any).removeTrack(this.removedTrack.id)
      if (!result.success) {
        return this.createErrorResult(result.error || '移除轨道失败')
      }

      console.log(`✅ 统一移除轨道操作完成: ${this.removedTrack.name}`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一移除轨道操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复轨道
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一移除轨道操作: ${this.description}`)

      if (!this.removedTrack) {
        return this.createErrorResult('没有可恢复的轨道')
      }

      // 恢复轨道
      const result = (this.trackModule as any).addTrack(this.removedTrack)
      if (!result.success) {
        return this.createErrorResult(result.error || '恢复轨道失败')
      }

      console.log(`✅ 统一移除轨道操作撤销完成: ${this.removedTrack.name}`)
      return this.createSuccessResult('撤销移除轨道操作成功')
    } catch (error) {
      const errorMessage = `撤销统一移除轨道操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

/**
 * 统一重命名轨道命令
 * 基于新架构的轨道重命名操作，支持撤销/重做
 */
export class UnifiedRenameTrackCommand extends UnifiedTrackCommand {
  private oldName: string = ''

  constructor(
    private trackId: string,
    private newName: string,
    trackModule: {
      getTrack: (id: string) => any
      renameTrack: (id: string, name: string) => { success: boolean; error?: string }
    }
  ) {
    const track = trackModule.getTrack(trackId)
    super(
      'track.rename',
      [trackId],
      `重命名轨道: ${track?.name || '未知轨道'} -> ${newName}`,
      trackModule
    )
    
    // 保存原始名称
    this.oldName = track?.name || ''
    
    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { name: this.oldName },
      afterState: { name: newName }
    }
  }

  /**
   * 执行命令：重命名轨道
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一重命名轨道操作: ${this.description}`)

      // 重命名轨道
      const result = (this.trackModule as any).renameTrack(this.trackId, this.newName)
      if (!result.success) {
        return this.createErrorResult(result.error || '重命名轨道失败')
      }

      console.log(`✅ 统一重命名轨道操作完成: ${this.oldName} -> ${this.newName}`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一重命名轨道操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复原始名称
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一重命名轨道操作: ${this.description}`)

      // 恢复原始名称
      const result = (this.trackModule as any).renameTrack(this.trackId, this.oldName)
      if (!result.success) {
        return this.createErrorResult(result.error || '恢复轨道名称失败')
      }

      console.log(`✅ 统一重命名轨道操作撤销完成: ${this.newName} -> ${this.oldName}`)
      return this.createSuccessResult('撤销重命名轨道操作成功')
    } catch (error) {
      const errorMessage = `撤销统一重命名轨道操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

/**
 * 统一切换轨道可见性命令
 * 基于新架构的轨道可见性切换操作，支持撤销/重做
 */
export class UnifiedToggleTrackVisibilityCommand extends UnifiedTrackCommand {
  private oldVisibility: boolean = true

  constructor(
    private trackId: string,
    trackModule: {
      getTrack: (id: string) => any
      toggleTrackVisibility: (id: string) => { success: boolean; error?: string; newVisibility?: boolean }
    }
  ) {
    const track = trackModule.getTrack(trackId)
    super(
      'track.toggle_visibility',
      [trackId],
      `切换轨道可见性: ${track?.name || '未知轨道'}`,
      trackModule
    )

    // 保存原始可见性状态
    this.oldVisibility = track?.isVisible ?? true

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { isVisible: this.oldVisibility },
      afterState: { isVisible: !this.oldVisibility }
    }
  }

  /**
   * 执行命令：切换轨道可见性
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一切换轨道可见性操作: ${this.description}`)

      // 切换轨道可见性
      const result = (this.trackModule as any).toggleTrackVisibility(this.trackId)
      if (!result.success) {
        return this.createErrorResult(result.error || '切换轨道可见性失败')
      }

      console.log(`✅ 统一切换轨道可见性操作完成: ${this.oldVisibility} -> ${!this.oldVisibility}`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一切换轨道可见性操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复原始可见性状态
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一切换轨道可见性操作: ${this.description}`)

      // 再次切换以恢复原始状态
      const result = (this.trackModule as any).toggleTrackVisibility(this.trackId)
      if (!result.success) {
        return this.createErrorResult(result.error || '恢复轨道可见性状态失败')
      }

      console.log(`✅ 统一切换轨道可见性操作撤销完成: 恢复到 ${this.oldVisibility}`)
      return this.createSuccessResult('撤销切换轨道可见性操作成功')
    } catch (error) {
      const errorMessage = `撤销统一切换轨道可见性操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

/**
 * 统一切换轨道静音命令
 * 基于新架构的轨道静音切换操作，支持撤销/重做
 */
export class UnifiedToggleTrackMuteCommand extends UnifiedTrackCommand {
  private oldMuteState: boolean = false

  constructor(
    private trackId: string,
    trackModule: {
      getTrack: (id: string) => any
      toggleTrackMute: (id: string) => { success: boolean; error?: string; newMuteState?: boolean }
    }
  ) {
    const track = trackModule.getTrack(trackId)
    super(
      'track.toggle_mute',
      [trackId],
      `切换轨道静音: ${track?.name || '未知轨道'}`,
      trackModule
    )

    // 保存原始静音状态
    this.oldMuteState = track?.isMuted ?? false

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { isMuted: this.oldMuteState },
      afterState: { isMuted: !this.oldMuteState }
    }
  }

  /**
   * 执行命令：切换轨道静音
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一切换轨道静音操作: ${this.description}`)

      // 切换轨道静音
      const result = (this.trackModule as any).toggleTrackMute(this.trackId)
      if (!result.success) {
        return this.createErrorResult(result.error || '切换轨道静音失败')
      }

      console.log(`✅ 统一切换轨道静音操作完成: ${this.oldMuteState} -> ${!this.oldMuteState}`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一切换轨道静音操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复原始静音状态
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一切换轨道静音操作: ${this.description}`)

      // 再次切换以恢复原始状态
      const result = (this.trackModule as any).toggleTrackMute(this.trackId)
      if (!result.success) {
        return this.createErrorResult(result.error || '恢复轨道静音状态失败')
      }

      console.log(`✅ 统一切换轨道静音操作撤销完成: 恢复到 ${this.oldMuteState}`)
      return this.createSuccessResult('撤销切换轨道静音操作成功')
    } catch (error) {
      const errorMessage = `撤销统一切换轨道静音操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

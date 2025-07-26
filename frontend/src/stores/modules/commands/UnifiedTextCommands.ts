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
 * 统一文本命令基类
 * 基于新架构的统一类型设计，提供文本操作的基础功能
 */
export abstract class UnifiedTextCommand implements UnifiedCommand {
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
}

/**
 * 统一添加文本项目命令
 * 基于UnifiedTimelineItem的文本添加操作，支持撤销/重做
 */
export class UnifiedAddTextItemCommand extends UnifiedTextCommand {
  private addedTextItem: UnifiedTimelineItem | null = null

  constructor(
    private textData: {
      text: string
      style: {
        fontSize?: number
        fontFamily?: string
        color?: string
        backgroundColor?: string
        textAlign?: 'left' | 'center' | 'right'
        fontWeight?: 'normal' | 'bold'
        fontStyle?: 'normal' | 'italic'
      }
      startTimeFrames: number
      duration: number
      trackId: string
      position: { x: number; y: number }
      size: { width: number; height: number }
    },
    timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      addTimelineItem: (item: UnifiedTimelineItem) => { success: boolean; error?: string }
      removeTimelineItem: (id: string) => { success: boolean; error?: string }
      createTextTimelineItem: (data: any) => UnifiedTimelineItem
    },
    mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
    private webavModule?: {
      addSprite: (sprite: any) => Promise<boolean>
      removeSprite: (sprite: any) => boolean
    }
  ) {
    super(
      'timeline.create',
      [], // 文本项目ID在创建时生成
      `添加文本项目: ${textData.text.substring(0, 20)}${textData.text.length > 20 ? '...' : ''}`,
      timelineModule,
      mediaModule
    )
    
    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { textItemExists: false },
      afterState: { textItemExists: true, textData: { ...textData } }
    }
  }

  /**
   * 执行命令：添加文本项目
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一添加文本项目操作: ${this.description}`)

      // 创建文本时间轴项目
      const textItem = (this.timelineModule as any).createTextTimelineItem(this.textData)
      
      // 添加到时间轴
      const result = (this.timelineModule as any).addTimelineItem(textItem)
      if (!result.success) {
        return this.createErrorResult(result.error || '添加文本项目失败')
      }

      // 处理WebAV集成（如果需要）
      if (this.webavModule && textItem.sprite && textItem.timelineStatus === 'ready') {
        try {
          await this.webavModule.addSprite(textItem.sprite)
        } catch (error) {
          console.warn('⚠️ WebAV文本sprite添加失败:', error)
        }
      }

      this.addedTextItem = textItem
      // 更新目标ID
      ;(this as any).targetInfo.ids = [textItem.id]
      
      console.log(`✅ 统一添加文本项目操作完成: ${this.textData.text}`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一添加文本项目操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：移除文本项目
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一添加文本项目操作: ${this.description}`)

      if (!this.addedTextItem) {
        return this.createErrorResult('没有可撤销的添加文本项目操作')
      }

      // 移除WebAV sprite
      if (this.webavModule && this.addedTextItem.sprite) {
        try {
          this.webavModule.removeSprite(this.addedTextItem.sprite)
        } catch (error) {
          console.warn('⚠️ WebAV文本sprite移除失败:', error)
        }
      }

      // 从时间轴移除
      const result = (this.timelineModule as any).removeTimelineItem(this.addedTextItem.id)
      if (!result.success) {
        return this.createErrorResult(result.error || '撤销添加文本项目操作失败')
      }

      console.log(`✅ 统一添加文本项目操作撤销完成: ${this.textData.text}`)
      return this.createSuccessResult('撤销添加文本项目操作成功')
    } catch (error) {
      const errorMessage = `撤销统一添加文本项目操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

/**
 * 统一更新文本内容命令
 * 基于UnifiedTimelineItem的文本内容更新操作，支持撤销/重做
 */
export class UnifiedUpdateTextCommand extends UnifiedTextCommand {
  private oldText: string = ''
  private oldStyle: any = {}

  constructor(
    private timelineItemId: string,
    private newText: string,
    private newStyle: {
      fontSize?: number
      fontFamily?: string
      color?: string
      backgroundColor?: string
      textAlign?: 'left' | 'center' | 'right'
      fontWeight?: 'normal' | 'bold'
      fontStyle?: 'normal' | 'italic'
    },
    timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      updateTextItem: (id: string, text: string, style: any) => { success: boolean; error?: string }
    },
    mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    }
  ) {
    const item = timelineModule.getUnifiedTimelineItem(timelineItemId)
    super(
      'property.update',
      [timelineItemId],
      `更新文本内容: ${newText.substring(0, 20)}${newText.length > 20 ? '...' : ''}`,
      timelineModule,
      mediaModule
    )
    
    // 保存原始文本和样式
    if (item && item.mediaType === 'text') {
      this.oldText = (item.config as any).text || ''
      this.oldStyle = (item.config as any).style ? { ...(item.config as any).style } : {}
    }

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { text: this.oldText, style: this.oldStyle },
      afterState: { text: newText, style: newStyle }
    }
  }

  /**
   * 执行命令：更新文本内容
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一更新文本内容操作: ${this.description}`)

      // 更新文本内容和样式
      const result = (this.timelineModule as any).updateTextItem(
        this.timelineItemId,
        this.newText,
        this.newStyle
      )
      
      if (!result.success) {
        return this.createErrorResult(result.error || '更新文本内容失败')
      }

      console.log(`✅ 统一更新文本内容操作完成`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一更新文本内容操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复原始文本内容
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一更新文本内容操作: ${this.description}`)

      // 恢复原始文本内容和样式
      const result = (this.timelineModule as any).updateTextItem(
        this.timelineItemId,
        this.oldText,
        this.oldStyle
      )
      
      if (!result.success) {
        return this.createErrorResult(result.error || '恢复文本内容失败')
      }

      console.log(`✅ 统一更新文本内容操作撤销完成`)
      return this.createSuccessResult('撤销更新文本内容操作成功')
    } catch (error) {
      const errorMessage = `撤销统一更新文本内容操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

/**
 * 统一文本样式更新命令
 * 专门用于更新文本样式属性，支持撤销/重做
 */
export class UnifiedUpdateTextStyleCommand extends UnifiedTextCommand {
  private oldStyle: any = {}

  constructor(
    private timelineItemId: string,
    private newStyle: {
      fontSize?: number
      fontFamily?: string
      color?: string
      backgroundColor?: string
      textAlign?: 'left' | 'center' | 'right'
      fontWeight?: 'normal' | 'bold'
      fontStyle?: 'normal' | 'italic'
      textDecoration?: 'none' | 'underline' | 'line-through'
      lineHeight?: number
      letterSpacing?: number
      textShadow?: string
      borderRadius?: number
      padding?: number
      margin?: number
    },
    timelineModule: {
      getUnifiedTimelineItem: (id: string) => UnifiedTimelineItem | undefined
      updateTextStyle: (id: string, style: any) => { success: boolean; error?: string }
    },
    mediaModule: {
      getUnifiedMediaItem: (id: string) => UnifiedMediaItemData | undefined
    }
  ) {
    const item = timelineModule.getUnifiedTimelineItem(timelineItemId)
    super(
      'property.update',
      [timelineItemId],
      `更新文本样式: ${item?.config.name || '未知文本'}`,
      timelineModule,
      mediaModule
    )

    // 保存原始样式
    if (item && item.mediaType === 'text') {
      this.oldStyle = (item.config as any).style ? { ...(item.config as any).style } : {}
    }

    // 保存状态转换信息
    ;(this as any).stateTransition = {
      beforeState: { style: this.oldStyle },
      afterState: { style: newStyle }
    }
  }

  /**
   * 执行命令：更新文本样式
   */
  async execute(): Promise<CommandResult> {
    try {
      console.log(`🔄 执行统一更新文本样式操作: ${this.description}`)

      // 更新文本样式
      const result = (this.timelineModule as any).updateTextStyle(
        this.timelineItemId,
        this.newStyle
      )

      if (!result.success) {
        return this.createErrorResult(result.error || '更新文本样式失败')
      }

      console.log(`✅ 统一更新文本样式操作完成`)
      return this.createSuccessResult()
    } catch (error) {
      const errorMessage = `统一更新文本样式操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }

  /**
   * 撤销命令：恢复原始文本样式
   */
  async undo(): Promise<CommandResult> {
    try {
      console.log(`🔄 撤销统一更新文本样式操作: ${this.description}`)

      // 恢复原始文本样式
      const result = (this.timelineModule as any).updateTextStyle(
        this.timelineItemId,
        this.oldStyle
      )

      if (!result.success) {
        return this.createErrorResult(result.error || '恢复文本样式失败')
      }

      console.log(`✅ 统一更新文本样式操作撤销完成`)
      return this.createSuccessResult('撤销更新文本样式操作成功')
    } catch (error) {
      const errorMessage = `撤销统一更新文本样式操作失败: ${this.description}`
      console.error(`❌ ${errorMessage}`, error)
      return this.createErrorResult(errorMessage)
    }
  }
}

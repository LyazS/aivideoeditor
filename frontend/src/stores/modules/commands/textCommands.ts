/**
 * 文本操作命令
 * 实现文本项目的创建、内容更新、样式更新等操作
 * 遵循"从源头重建"原则，确保命令的可靠性和一致性
 */

import { markRaw } from 'vue'
import type { SimpleCommand } from '../../../types'
import type { TextTimelineItem, TextMediaConfig, TextStyleConfig } from '../../../types'
import { generateCommandId } from '../../../utils/idGenerator'
import { TextVisibleSprite } from '../../../utils/TextVisibleSprite'
import { createDefaultTextItem, syncConfigFromSprite } from '../../../utils/textTimelineUtils'
import { useVideoStore } from '../../videoStore'

/**
 * 创建文本项目命令
 * 遵循"从源头重建"原则：保存创建参数，每次执行都重新创建文本精灵
 */
export class CreateTextItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  
  // 保存创建参数用于重建
  private readonly creationParams: {
    text: string
    style: Partial<TextStyleConfig>
    startTimeFrames: number
    trackId: string
    duration: number
  }
  
  // 生成的项目ID（固定不变）
  public readonly newItemId: string

  constructor(
    text: string,
    style: Partial<TextStyleConfig>,
    startTimeFrames: number,
    trackId: string,
    duration: number,
    private timelineModule: {
      addTimelineItem: (item: TextTimelineItem) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => TextTimelineItem | undefined
    },
    private webavModule: {
      addSprite: (sprite: any) => boolean
      removeSprite: (sprite: any) => boolean
    }
  ) {
    this.id = generateCommandId()
    this.description = `创建文本项目: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`
    
    // 保存创建参数
    this.creationParams = {
      text,
      style,
      startTimeFrames,
      trackId,
      duration
    }
    
    // 生成固定的项目ID
    this.newItemId = `text-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    console.log('💾 保存文本项目创建参数:', this.creationParams)
  }

  /**
   * 执行命令：从源头重建文本项目
   */
  async execute(): Promise<void> {
    try {
      console.log('🔄 执行创建文本项目：从源头重建...')
      
      // 从源头重新创建文本项目
      const textItem = await this.rebuildTextItem()
      
      // 1. 添加到时间轴
      this.timelineModule.addTimelineItem(textItem)
      
      // 2. 添加精灵到WebAV画布
      this.webavModule.addSprite(textItem.sprite)
      
      console.log('✅ 文本项目创建成功:', {
        id: textItem.id,
        text: textItem.config.text.substring(0, 20) + '...'
      })
    } catch (error) {
      console.error('❌ 创建文本项目失败:', error)
      throw error
    }
  }

  /**
   * 撤销命令：移除文本项目
   */
  async undo(): Promise<void> {
    try {
      console.log('↩️ 撤销创建文本项目...')
      
      // 获取要删除的项目
      const textItem = this.timelineModule.getTimelineItem(this.newItemId)
      if (textItem) {
        // 从WebAV画布移除精灵
        this.webavModule.removeSprite(textItem.sprite)
      }
      
      // 从时间轴移除项目
      this.timelineModule.removeTimelineItem(this.newItemId)
      
      console.log('✅ 文本项目删除成功:', this.newItemId)
    } catch (error) {
      console.error('❌ 撤销创建文本项目失败:', error)
      throw error
    }
  }

  /**
   * 从源头重建文本项目
   * 每次执行都完全重新创建，确保状态一致性
   */
  private async rebuildTextItem(): Promise<TextTimelineItem> {
    const { text, style, startTimeFrames, trackId, duration } = this.creationParams
    
    // 1. 创建文本精灵
    const textSprite = await TextVisibleSprite.create(text, style)
    
    // 2. 设置时间范围
    textSprite.setTimelineStartTime(startTimeFrames)
    textSprite.setDisplayDuration(duration)

    // 3. 获取文本渲染后的尺寸
    const textMeta = await textSprite.getTextMeta()

    // 4. 设置默认位置（画布中心）- 动态计算，与图片clip保持一致
    const videoStore = useVideoStore()
    const canvasWidth = videoStore.videoResolution.width
    const canvasHeight = videoStore.videoResolution.height
    textSprite.rect.x = (canvasWidth - textMeta.width) / 2
    textSprite.rect.y = (canvasHeight - textMeta.height) / 2
    
    // 5. 创建时间轴项目
    const textItem: TextTimelineItem = {
      id: this.newItemId, // 使用固定的ID
      mediaItemId: '', // 文本项目不需要媒体库项目
      trackId,
      mediaType: 'text',
      timeRange: textSprite.getTimeRange(),
      sprite: markRaw(textSprite),
      config: {
        text,
        style: textSprite.getTextStyle(),
        x: textSprite.rect.x,
        y: textSprite.rect.y,
        width: textMeta.width,
        height: textMeta.height,
        opacity: textSprite.opacity,
        rotation: textSprite.rect.angle,
        zIndex: textSprite.zIndex,
      }
    }
    
    return textItem
  }
}

/**
 * 更新文本内容命令
 * 遵循"从源头重建"原则：保存新的文本内容，重建时应用新内容
 */
export class UpdateTextContentCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  
  private oldText: string
  private newText: string

  constructor(
    private timelineItemId: string,
    newText: string,
    private timelineModule: {
      getTimelineItem: (id: string) => TextTimelineItem | undefined
    }
  ) {
    this.id = generateCommandId()
    this.newText = newText
    this.description = `更新文本内容: ${newText.substring(0, 20)}${newText.length > 20 ? '...' : ''}`
    
    // 保存当前文本内容
    const textItem = this.timelineModule.getTimelineItem(timelineItemId)
    if (!textItem) {
      throw new Error(`文本项目不存在: ${timelineItemId}`)
    }
    
    this.oldText = textItem.config.text
    
    console.log('💾 保存文本内容更新数据:', {
      itemId: timelineItemId,
      oldText: this.oldText.substring(0, 20) + '...',
      newText: this.newText.substring(0, 20) + '...'
    })
  }

  /**
   * 执行命令：更新文本内容
   */
  async execute(): Promise<void> {
    await this.updateTextContent(this.newText)
  }

  /**
   * 撤销命令：恢复原文本内容
   */
  async undo(): Promise<void> {
    await this.updateTextContent(this.oldText)
  }

  /**
   * 更新文本内容的通用方法
   */
  private async updateTextContent(text: string): Promise<void> {
    try {
      const textItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!textItem) {
        throw new Error(`文本项目不存在: ${this.timelineItemId}`)
      }

      console.log('🔄 [UpdateTextContentCommand] 开始更新文本内容:', {
        itemId: this.timelineItemId,
        oldText: textItem.config.text.substring(0, 20) + '...',
        newText: text.substring(0, 20) + '...',
        spriteType: textItem.sprite?.constructor?.name
      })

      // 1. 更新配置
      textItem.config.text = text
      console.log('📝 [UpdateTextContentCommand] 配置已更新')

      // 2. 更新WebAV精灵
      const textSprite = textItem.sprite as any
      if (textSprite && typeof textSprite.updateText === 'function') {
        console.log('🎨 [UpdateTextContentCommand] 调用精灵的updateText方法')
        await textSprite.updateText(text)
        console.log('✅ [UpdateTextContentCommand] 精灵updateText完成')

        // 3. 同步配置（获取新的尺寸等）
        console.log('🔄 [UpdateTextContentCommand] 开始同步配置')
        await syncConfigFromSprite(textItem, textSprite)
        console.log('✅ [UpdateTextContentCommand] 配置同步完成')
      } else {
        console.warn('⚠️ [UpdateTextContentCommand] 精灵不存在或没有updateText方法:', {
          hasSprite: !!textSprite,
          hasUpdateText: textSprite && typeof textSprite.updateText === 'function'
        })
      }

      console.log('✅ [UpdateTextContentCommand] 文本内容更新成功')
    } catch (error) {
      console.error('❌ [UpdateTextContentCommand] 更新文本内容失败:', error)
      throw error
    }
  }
}

/**
 * 更新文本样式命令
 * 遵循"从源头重建"原则：保存新的样式配置，重建时应用新样式
 */
export class UpdateTextStyleCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  
  private oldStyle: TextStyleConfig
  private newStyle: Partial<TextStyleConfig>

  constructor(
    private timelineItemId: string,
    newStyle: Partial<TextStyleConfig>,
    private timelineModule: {
      getTimelineItem: (id: string) => TextTimelineItem | undefined
    }
  ) {
    this.id = generateCommandId()
    this.newStyle = newStyle
    this.description = `更新文本样式`
    
    // 保存当前样式
    const textItem = this.timelineModule.getTimelineItem(timelineItemId)
    if (!textItem) {
      throw new Error(`文本项目不存在: ${timelineItemId}`)
    }
    
    this.oldStyle = { ...textItem.config.style }
    
    console.log('💾 保存文本样式更新数据:', {
      itemId: timelineItemId,
      oldStyle: this.oldStyle,
      newStyle: this.newStyle
    })
  }

  /**
   * 执行命令：更新文本样式
   */
  async execute(): Promise<void> {
    await this.updateTextStyle(this.newStyle)
  }

  /**
   * 撤销命令：恢复原文本样式
   */
  async undo(): Promise<void> {
    await this.updateTextStyle(this.oldStyle)
  }

  /**
   * 更新文本样式的通用方法
   */
  private async updateTextStyle(style: Partial<TextStyleConfig>): Promise<void> {
    try {
      const textItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!textItem) {
        throw new Error(`文本项目不存在: ${this.timelineItemId}`)
      }

      console.log('🔄 更新文本样式:', {
        itemId: this.timelineItemId,
        newStyle: style
      })

      // 1. 更新配置
      textItem.config.style = { ...textItem.config.style, ...style }

      // 2. 更新WebAV精灵
      const textSprite = textItem.sprite as any
      if (textSprite && typeof textSprite.updateStyle === 'function') {
        await textSprite.updateStyle(style)

        // 3. 同步配置（获取新的尺寸等）
        await syncConfigFromSprite(textItem, textSprite)
      }

      console.log('✅ 文本样式更新成功')
    } catch (error) {
      console.error('❌ 更新文本样式失败:', error)
      throw error
    }
  }
}

import { generateCommandId } from '../../../utils/idGenerator'
import { framesToTimecode } from '../../utils/timeUtils'
import type { SimpleCommand, LocalTimelineItem, TextStyleConfig } from '../../../types'
import { createTextTimelineItem } from '../../../utils/textTimelineUtils'
import { TextVisibleSprite } from '../../../utils/TextVisibleSprite'
import { markRaw } from 'vue'

/**
 * 文本相关的命令实现
 * 提供文本项目的创建、更新、删除等操作的撤销/重做支持
 */

/**
 * 添加文本项目命令
 * 支持撤销/重做的文本项目创建操作
 */
export class AddTextItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private textItem: LocalTimelineItem<'text'> | null = null

  constructor(
    private text: string,
    private style: Partial<TextStyleConfig>,
    private startTimeFrames: number,
    private trackId: string,
    private duration: number,
    private videoResolution: { width: number; height: number },
    private timelineModule: {
      addTimelineItem: (item: LocalTimelineItem<'text'>) => void
      removeTimelineItem: (id: string) => void
    },
    private webavModule: {
      addSprite: (sprite: any) => Promise<boolean>
      removeSprite: (sprite: any) => boolean
    },
  ) {
    this.id = generateCommandId()
    this.description = `添加文本: ${text.substring(0, 10)}${text.length > 10 ? '...' : ''}`
  }

  async execute(): Promise<void> {
    try {
      console.log(`🔄 [AddTextItemCommand] 执行添加文本操作...`)

      // 创建文本时间轴项目
      this.textItem = await createTextTimelineItem(
        this.text,
        this.style,
        this.startTimeFrames,
        this.trackId,
        this.duration,
        this.videoResolution,
      )

      // 1. 添加到时间轴
      this.timelineModule.addTimelineItem(this.textItem)

      // 2. 添加sprite到WebAV画布
      await this.webavModule.addSprite(this.textItem.sprite)

      console.log(`✅ [AddTextItemCommand] 文本项目添加成功:`, {
        id: this.textItem.id,
        text: this.text.substring(0, 20) + '...',
        startTime: framesToTimecode(this.startTimeFrames),
        duration: framesToTimecode(this.duration),
      })
    } catch (error) {
      console.error(`❌ [AddTextItemCommand] 添加文本项目失败:`, error)
      throw error
    }
  }

  async undo(): Promise<void> {
    try {
      if (this.textItem) {
        console.log(`🔄 [AddTextItemCommand] 撤销添加文本操作...`)

        // 1. 从WebAV画布移除sprite
        this.webavModule.removeSprite(this.textItem.sprite)

        // 2. 从时间轴移除项目
        this.timelineModule.removeTimelineItem(this.textItem.id)

        console.log(`✅ [AddTextItemCommand] 文本项目撤销成功: ${this.textItem.id}`)
      }
    } catch (error) {
      console.error(`❌ [AddTextItemCommand] 撤销文本项目失败:`, error)
      throw error
    }
  }
}

/**
 * 更新文本内容命令
 * 支持撤销/重做的文本内容和样式更新操作
 */
export class UpdateTextCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private oldText: string = ''
  private oldStyle: TextStyleConfig | null = null

  constructor(
    private timelineItemId: string,
    private newText: string,
    private newStyle: Partial<TextStyleConfig>,
    private timelineModule: {
      getTimelineItem: (id: string) => LocalTimelineItem | undefined
    },
  ) {
    this.id = generateCommandId()
    this.description = `更新文本: ${newText.substring(0, 10)}${newText.length > 10 ? '...' : ''}`
  }

  async execute(): Promise<void> {
    try {
      console.log(`🔄 [UpdateTextCommand] 执行更新文本操作...`)

      const item = this.timelineModule.getTimelineItem(
        this.timelineItemId,
      ) as LocalTimelineItem<'text'>
      if (!item || item.mediaType !== 'text') {
        throw new Error(`文本项目不存在或类型错误: ${this.timelineItemId}`)
      }

      // 保存旧值用于撤销
      this.oldText = item.config.text
      this.oldStyle = { ...item.config.style }

      // 重新创建文本精灵（遵循"从源头重建"原则）
      await this.recreateTextSprite(item, this.newText, this.newStyle)

      console.log(`✅ [UpdateTextCommand] 文本更新成功:`, {
        id: this.timelineItemId,
        oldText: this.oldText.substring(0, 20) + '...',
        newText: this.newText.substring(0, 20) + '...',
      })
    } catch (error) {
      console.error(`❌ [UpdateTextCommand] 更新文本失败:`, error)
      throw error
    }
  }

  /**
   * 重新创建文本精灵
   * 遵循"从源头重建"原则，完全重新创建sprite实例
   */
  private async recreateTextSprite(
    item: LocalTimelineItem<'text'>,
    newText: string,
    newStyle: Partial<TextStyleConfig>,
  ): Promise<void> {
    // 保存旧精灵的状态
    const oldSprite = item.sprite as TextVisibleSprite
    const oldState = {
      rect: {
        x: oldSprite.rect.x,
        y: oldSprite.rect.y,
        w: oldSprite.rect.w,
        h: oldSprite.rect.h,
        angle: oldSprite.rect.angle,
      },
      opacity: oldSprite.opacity,
      zIndex: oldSprite.zIndex,
      timeRange: oldSprite.getTimeRange(),
    }

    // 🎯 先保存TimelineItem的宽高和原始宽高，计算缩放系数
    const currentWidth = item.config.width
    const currentHeight = item.config.height
    const originalWidth = item.config.originalWidth
    const originalHeight = item.config.originalHeight

    // 计算当前的缩放系数
    const scaleX = originalWidth > 0 ? currentWidth / originalWidth : 1
    const scaleY = originalHeight > 0 ? currentHeight / originalHeight : 1

    console.log('🔄 [TextCommands] 保存缩放系数:', {
      current: { width: currentWidth, height: currentHeight },
      original: { width: originalWidth, height: originalHeight },
      scale: { x: scaleX, y: scaleY },
    })

    // 合并新样式
    const completeStyle = { ...item.config.style, ...newStyle }

    // 创建新的文本精灵
    const { TextVisibleSprite } = await import('../../../utils/TextVisibleSprite')
    const newSprite = await TextVisibleSprite.create(newText, completeStyle)

    // 🎯 更新TimelineItem的原始宽高为新sprite的尺寸
    item.config.originalWidth = newSprite.rect.w
    item.config.originalHeight = newSprite.rect.h

    // 🎯 使用缩放系数重新计算TimelineItem的宽高
    const newWidth = item.config.originalWidth * scaleX
    const newHeight = item.config.originalHeight * scaleY
    item.config.width = newWidth
    item.config.height = newHeight

    console.log('🔄 [TextCommands] 应用缩放系数:', {
      newOriginal: { width: item.config.originalWidth, height: item.config.originalHeight },
      newSize: { width: newWidth, height: newHeight },
      appliedScale: { x: scaleX, y: scaleY },
    })

    // 🎯 通过TimelineItem的xywh转换为sprite的rect坐标
    const { projectToWebavCoords } = await import('../../../utils/coordinateTransform')
    const { useVideoStore } = await import('../../videoStore')
    const videoStore = useVideoStore()

    const webavCoords = projectToWebavCoords(
      item.config.x,
      item.config.y,
      newWidth,
      newHeight,
      videoStore.videoResolution.width,
      videoStore.videoResolution.height,
    )

    // 设置新sprite的位置和尺寸
    newSprite.rect.x = webavCoords.x
    newSprite.rect.y = webavCoords.y
    newSprite.rect.w = newWidth
    newSprite.rect.h = newHeight
    newSprite.rect.angle = oldState.rect.angle
    newSprite.opacity = oldState.opacity
    newSprite.zIndex = oldState.zIndex

    // 恢复时间范围
    newSprite.setTimeRange(oldState.timeRange)

    // 更新配置
    item.config.text = newText
    item.config.style = completeStyle

    // 替换精灵引用
    item.sprite = markRaw(newSprite)

    // 在WebAV画布中替换精灵
    videoStore.removeSpriteFromCanvas(oldSprite)
    videoStore.addSpriteToCanvas(newSprite)

    // 🔄 重新设置双向数据绑定 - 这是关键步骤！
    videoStore.setupBidirectionalSync(item)

    console.log('✅ [UpdateTextCommand] 文本精灵重新创建完成，数据绑定已重新建立')
  }

  async undo(): Promise<void> {
    try {
      if (this.oldText && this.oldStyle) {
        console.log(`🔄 [UpdateTextCommand] 撤销更新文本操作...`)

        const item = this.timelineModule.getTimelineItem(
          this.timelineItemId,
        ) as LocalTimelineItem<'text'>
        if (!item || item.mediaType !== 'text') {
          throw new Error(`文本项目不存在或类型错误: ${this.timelineItemId}`)
        }

        // 重新创建文本精灵（恢复到旧状态）
        await this.recreateTextSprite(item, this.oldText, this.oldStyle)

        console.log(`✅ [UpdateTextCommand] 文本撤销成功: ${this.timelineItemId}`)
      }
    } catch (error) {
      console.error(`❌ [UpdateTextCommand] 撤销文本更新失败:`, error)
      throw error
    }
  }
}

/**
 * 删除文本项目命令
 * 支持撤销/重做的文本项目删除操作
 */
export class RemoveTextItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private removedItem: LocalTimelineItem<'text'> | null = null

  constructor(
    private timelineItemId: string,
    private timelineModule: {
      addTimelineItem: (item: LocalTimelineItem<'text'>) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => LocalTimelineItem<'text'> | undefined
    },
    private webavModule: {
      addSprite: (sprite: any) => Promise<boolean>
      removeSprite: (sprite: any) => boolean
    },
  ) {
    this.id = generateCommandId()
    this.description = `删除文本项目`
  }

  async execute(): Promise<void> {
    try {
      console.log(`🔄 [RemoveTextItemCommand] 执行删除文本操作...`)

      const item = this.timelineModule.getTimelineItem(
        this.timelineItemId,
      ) as LocalTimelineItem<'text'>
      if (!item || item.mediaType !== 'text') {
        throw new Error(`文本项目不存在或类型错误: ${this.timelineItemId}`)
      }

      // 保存项目用于撤销
      this.removedItem = item

      // 1. 从WebAV画布移除sprite
      this.webavModule.removeSprite(item.sprite)

      // 2. 从时间轴移除项目
      this.timelineModule.removeTimelineItem(this.timelineItemId)

      console.log(`✅ [RemoveTextItemCommand] 文本项目删除成功: ${this.timelineItemId}`)
    } catch (error) {
      console.error(`❌ [RemoveTextItemCommand] 删除文本项目失败:`, error)
      throw error
    }
  }

  async undo(): Promise<void> {
    try {
      if (this.removedItem) {
        console.log(`🔄 [RemoveTextItemCommand] 撤销删除文本操作...`)

        // 1. 重新添加到时间轴
        this.timelineModule.addTimelineItem(this.removedItem)

        // 2. 重新添加sprite到WebAV画布
        await this.webavModule.addSprite(this.removedItem.sprite)

        console.log(`✅ [RemoveTextItemCommand] 文本项目恢复成功: ${this.removedItem.id}`)
      }
    } catch (error) {
      console.error(`❌ [RemoveTextItemCommand] 撤销删除文本项目失败:`, error)
      throw error
    }
  }
}

/**
 * 文本命令工厂函数
 * 提供便捷的命令创建方法
 */
export const TextCommandFactory = {
  /**
   * 创建添加文本项目命令
   */
  createAddTextCommand(
    text: string,
    style: Partial<TextStyleConfig>,
    startTimeFrames: number,
    trackId: string,
    duration: number,
    videoResolution: { width: number; height: number },
    timelineModule: any,
    webavModule: any,
  ): AddTextItemCommand {
    return new AddTextItemCommand(
      text,
      style,
      startTimeFrames,
      trackId,
      duration,
      videoResolution,
      timelineModule,
      webavModule,
    )
  },

  /**
   * 创建更新文本命令
   */
  createUpdateTextCommand(
    timelineItemId: string,
    newText: string,
    newStyle: Partial<TextStyleConfig>,
    timelineModule: any,
  ): UpdateTextCommand {
    return new UpdateTextCommand(timelineItemId, newText, newStyle, timelineModule)
  },

  /**
   * 创建删除文本项目命令
   */
  createRemoveTextCommand(
    timelineItemId: string,
    timelineModule: any,
    webavModule: any,
  ): RemoveTextItemCommand {
    return new RemoveTextItemCommand(timelineItemId, timelineModule, webavModule)
  },
}

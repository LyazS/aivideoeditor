/**
 * 统一架构下的文本命令实现
 * 基于"核心数据与行为分离"的响应式重构版本
 *
 * 主要变化：
 * 1. 使用 UnifiedTimelineItemData 替代原有的 LocalTimelineItem
 * 2. 使用新架构的类型系统和工具
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
} from '../../timelineitem/TimelineItemData'
type TextTimelineItem = UnifiedTimelineItemData<'text'>

import type { ImageTimeRange } from '../../../types'

// ==================== 新架构工具导入 ====================
import { isTextTimelineItem, isReady, TimelineItemFactory } from '../../timelineitem'

// ==================== 旧架构兼容性导入 ====================
import { TextVisibleSprite } from '../../../utils/TextVisibleSprite'
import type { TextMediaConfig, TextStyleConfig } from '../../../types'

// ==================== 添加文本项目命令 ====================
/**
 * 添加文本项目命令
 * 支持撤销/重做的文本项目创建操作
 * 采用统一重建逻辑：每次执行都从原始配置重新创建sprite
 */
export class AddTextItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: TextTimelineItem | null = null // 保存原始项目的重建数据

  constructor(
    private text: string,
    private style: Partial<TextStyleConfig>,
    private startTimeFrames: number,
    private trackId: string,
    private duration: number,
    private videoResolution: { width: number; height: number },
    private timelineModule: {
      addTimelineItem: (item: TextTimelineItem) => void
      removeTimelineItem: (id: string) => void
    },
    private webavModule: {
      addSprite: (sprite: VisibleSprite) => Promise<boolean>
      removeSprite: (sprite: VisibleSprite) => boolean
    },
  ) {
    this.id = generateCommandId()
    this.description = `添加文本: ${text.substring(0, 10)}${text.length > 10 ? '...' : ''}`
  }

  /**
   * 从原始配置重建文本时间轴项目
   * 统一重建逻辑：每次都从原始配置完全重新创建
   */
  private async rebuildTextTimelineItem(): Promise<TextTimelineItem> {
    console.log('🔄 开始从源头重建文本时间轴项目...')

    // 1. 创建文本精灵
    const newSprite = await TextVisibleSprite.create(this.text, this.style)

    // 2. 设置时间范围
    const timeRange: ImageTimeRange = {
      timelineStartTime: this.startTimeFrames,
      timelineEndTime: this.startTimeFrames + this.duration,
      displayDuration: this.duration,
    }
    newSprite.setTimeRange(timeRange)

    // 3. 设置位置和尺寸（使用视频分辨率进行坐标转换）
    // 这里暂时使用默认位置，实际应用中可能需要根据视频分辨率进行调整
    const defaultX = this.videoResolution.width / 2 - 100
    const defaultY = this.videoResolution.height / 2 - 50
    const defaultWidth = 200
    const defaultHeight = 100

    newSprite.rect.x = defaultX
    newSprite.rect.y = defaultY
    newSprite.rect.w = defaultWidth
    newSprite.rect.h = defaultHeight
    newSprite.rect.angle = 0
    newSprite.opacity = 1
    newSprite.zIndex = 1

    // 4. 创建新的TimelineItem
    const newTimelineItem = reactive({
      id: `text_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      mediaItemId: '', // 文本项目不需要媒体库项目
      trackId: this.trackId,
      mediaType: 'text' as const,
      timeRange: newSprite.getTimeRange(),
      sprite: markRaw(newSprite),
      config: {
        text: this.text,
        style: { ...this.style },
        x: defaultX,
        y: defaultY,
        width: defaultWidth,
        height: defaultHeight,
        rotation: 0,
        opacity: 1,
        zIndex: 1,
        originalWidth: defaultWidth,
        originalHeight: defaultHeight,
      } as TextMediaConfig,
      timelineStatus: 'ready' as TimelineItemStatus,
    }) as TextTimelineItem

    // 5. 保存原始数据用于重建
    this.originalTimelineItemData = TimelineItemFactory.clone(newTimelineItem)

    console.log('🔄 重建文本时间轴项目完成:', {
      id: newTimelineItem.id,
      text: this.text.substring(0, 20) + '...',
      timeRange,
      position: { x: defaultX, y: defaultY },
      size: { w: defaultWidth, h: defaultHeight },
    })

    return newTimelineItem
  }

  /**
   * 执行命令：添加文本时间轴项目
   * 统一重建逻辑：每次执行都从原始配置重新创建
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行添加文本操作...`)

      // 从原始配置重新创建TimelineItem和sprite
      const newTimelineItem = await this.rebuildTextTimelineItem()

      // 1. 添加到时间轴
      this.timelineModule.addTimelineItem(newTimelineItem)

      // 2. 添加sprite到WebAV画布
      if (newTimelineItem.sprite) {
        await this.webavModule.addSprite(newTimelineItem.sprite)
      }

      console.log(`✅ 文本项目添加成功:`, {
        id: newTimelineItem.id,
        text: this.text.substring(0, 20) + '...',
        startTime: framesToTimecode(this.startTimeFrames),
        duration: framesToTimecode(this.duration),
      })
    } catch (error) {
      console.error(`❌ 添加文本项目失败:`, error)
      throw error
    }
  }

  /**
   * 撤销命令：移除文本时间轴项目
   */
  async undo(): Promise<void> {
    try {
      if (this.originalTimelineItemData) {
        console.log(`🔄 撤销添加文本操作...`)

        // 移除时间轴项目（这会自动处理sprite的清理）
        this.timelineModule.removeTimelineItem(this.originalTimelineItemData.id)

        console.log(`✅ 文本项目撤销成功: ${this.originalTimelineItemData.id}`)
      }
    } catch (error) {
      console.error(`❌ 撤销文本项目失败:`, error)
      throw error
    }
  }
}

// ==================== 更新文本内容命令 ====================
/**
 * 更新文本内容命令
 * 支持撤销/重做的文本内容和样式更新操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始配置重新创建
 */
export class UpdateTextCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: TextTimelineItem | null = null // 保存原始项目的重建数据
  private oldText: string = ''
  private oldStyle: TextStyleConfig | null = null

  constructor(
    private timelineItemId: string,
    private newText: string,
    private newStyle: Partial<TextStyleConfig>,
    private timelineModule: {
      getTimelineItem: (id: string) => TextTimelineItem | undefined
    },
    private webavModule: {
      addSprite: (sprite: VisibleSprite) => Promise<boolean>
      removeSprite: (sprite: VisibleSprite) => boolean
    },
  ) {
    this.id = generateCommandId()
    this.description = `更新文本: ${newText.substring(0, 10)}${newText.length > 10 ? '...' : ''}`
  }

  /**
   * 从原始配置重建文本时间轴项目
   * 遵循"从源头重建"原则，每次都完全重新创建
   */
  private async rebuildTextTimelineItem(
    item: TextTimelineItem,
    text: string,
    style: Partial<TextStyleConfig>,
  ): Promise<TextTimelineItem> {
    console.log('🔄 开始从源头重建文本时间轴项目...')

    // 1. 保存旧精灵的状态
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

    // 2. 保存TimelineItem的宽高和原始宽高，计算缩放系数
    const currentWidth = item.config.width
    const currentHeight = item.config.height
    const originalWidth = item.config.originalWidth
    const originalHeight = item.config.originalHeight

    // 计算当前的缩放系数
    const scaleX = originalWidth > 0 ? currentWidth / originalWidth : 1
    const scaleY = originalHeight > 0 ? currentHeight / originalHeight : 1

    console.log('🔄 保存缩放系数:', {
      current: { width: currentWidth, height: currentHeight },
      original: { width: originalWidth, height: originalHeight },
      scale: { x: scaleX, y: scaleY },
    })

    // 3. 合并新样式
    const completeStyle = { ...item.config.style, ...style }

    // 4. 创建新的文本精灵
    const newSprite = await TextVisibleSprite.create(text, completeStyle)

    // 5. 更新TimelineItem的原始宽高为新sprite的尺寸
    item.config.originalWidth = newSprite.rect.w
    item.config.originalHeight = newSprite.rect.h

    // 6. 使用缩放系数重新计算TimelineItem的宽高
    const newWidth = item.config.originalWidth * scaleX
    const newHeight = item.config.originalHeight * scaleY
    item.config.width = newWidth
    item.config.height = newHeight

    console.log('🔄 应用缩放系数:', {
      newOriginal: { width: item.config.originalWidth, height: item.config.originalHeight },
      newSize: { width: newWidth, height: newHeight },
      appliedScale: { x: scaleX, y: scaleY },
    })

    // 7. 设置新sprite的位置和尺寸
    newSprite.rect.x = item.config.x
    newSprite.rect.y = item.config.y
    newSprite.rect.w = newWidth
    newSprite.rect.h = newHeight
    newSprite.rect.angle = item.config.rotation
    newSprite.opacity = item.config.opacity
    newSprite.zIndex = item.config.zIndex

    // 8. 恢复时间范围
    newSprite.setTimeRange(oldState.timeRange)

    // 9. 更新配置
    item.config.text = text
    item.config.style = completeStyle

    // 10. 替换精灵引用
    item.sprite = markRaw(newSprite)

    // 11. 在WebAV画布中替换精灵
    if (oldSprite) {
      this.webavModule.removeSprite(oldSprite)
    }
    if (newSprite) {
      await this.webavModule.addSprite(newSprite)
    }

    console.log('✅ 文本精灵重新创建完成')

    return item
  }

  /**
   * 执行命令：更新文本内容
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行更新文本操作...`)

      const item = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!item || !isTextTimelineItem(item)) {
        throw new Error(`文本项目不存在或类型错误: ${this.timelineItemId}`)
      }

      // 保存旧值用于撤销
      this.oldText = item.config.text
      this.oldStyle = { ...item.config.style }

      // 保存原始项目数据用于撤销
      this.originalTimelineItemData = TimelineItemFactory.clone(item)

      // 重新创建文本精灵（遵循"从源头重建"原则）
      await this.rebuildTextSprite(item, this.newText, this.newStyle)

      console.log(`✅ 文本更新成功:`, {
        id: this.timelineItemId,
        oldText: this.oldText.substring(0, 20) + '...',
        newText: this.newText.substring(0, 20) + '...',
      })
    } catch (error) {
      console.error(`❌ 更新文本失败:`, error)
      throw error
    }
  }

  /**
   * 重新创建文本精灵
   * 遵循"从源头重建"原则，完全重新创建sprite实例
   */
  private async rebuildTextSprite(
    item: TextTimelineItem,
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

    // 保存TimelineItem的宽高和原始宽高，计算缩放系数
    const currentWidth = item.config.width
    const currentHeight = item.config.height
    const originalWidth = item.config.originalWidth
    const originalHeight = item.config.originalHeight

    // 计算当前的缩放系数
    const scaleX = originalWidth > 0 ? currentWidth / originalWidth : 1
    const scaleY = originalHeight > 0 ? currentHeight / originalHeight : 1

    console.log('🔄 保存缩放系数:', {
      current: { width: currentWidth, height: currentHeight },
      original: { width: originalWidth, height: originalHeight },
      scale: { x: scaleX, y: scaleY },
    })

    // 合并新样式
    const completeStyle = { ...item.config.style, ...newStyle }

    // 创建新的文本精灵
    const newSprite = await TextVisibleSprite.create(newText, completeStyle)

    // 更新TimelineItem的原始宽高为新sprite的尺寸
    item.config.originalWidth = newSprite.rect.w
    item.config.originalHeight = newSprite.rect.h

    // 使用缩放系数重新计算TimelineItem的宽高
    const newWidth = item.config.originalWidth * scaleX
    const newHeight = item.config.originalHeight * scaleY
    item.config.width = newWidth
    item.config.height = newHeight

    console.log('🔄 应用缩放系数:', {
      newOriginal: { width: item.config.originalWidth, height: item.config.originalHeight },
      newSize: { width: newWidth, height: newHeight },
      appliedScale: { x: scaleX, y: scaleY },
    })

    // 设置新sprite的位置和尺寸
    newSprite.rect.x = item.config.x
    newSprite.rect.y = item.config.y
    newSprite.rect.w = newWidth
    newSprite.rect.h = newHeight
    newSprite.rect.angle = item.config.rotation
    newSprite.opacity = item.config.opacity
    newSprite.zIndex = item.config.zIndex

    // 恢复时间范围
    newSprite.setTimeRange(oldState.timeRange)

    // 更新配置
    item.config.text = newText
    item.config.style = completeStyle

    // 替换精灵引用
    item.sprite = markRaw(newSprite)

    // 在WebAV画布中替换精灵
    if (oldSprite) {
      this.webavModule.removeSprite(oldSprite)
    }
    if (newSprite) {
      await this.webavModule.addSprite(newSprite)
    }

    console.log('✅ 文本精灵重新创建完成')
  }

  /**
   * 撤销命令：恢复到原始文本内容
   * 遵循"从源头重建"原则，从原始配置完全重新创建
   */
  async undo(): Promise<void> {
    try {
      if (this.oldText && this.oldStyle && this.originalTimelineItemData) {
        console.log(`🔄 撤销更新文本操作...`)

        const item = this.timelineModule.getTimelineItem(this.timelineItemId)
        if (!item || !isTextTimelineItem(item)) {
          throw new Error(`文本项目不存在或类型错误: ${this.timelineItemId}`)
        }

        // 重新创建文本精灵（恢复到旧状态）
        await this.rebuildTextTimelineItem(item, this.oldText, this.oldStyle)

        console.log(`✅ 文本撤销成功: ${this.timelineItemId}`)
      }
    } catch (error) {
      console.error(`❌ 撤销文本更新失败:`, error)
      throw error
    }
  }
}

// ==================== 删除文本项目命令 ====================
/**
 * 删除文本项目命令
 * 支持撤销/重做的文本项目删除操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始配置重新创建
 */
export class RemoveTextItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: TextTimelineItem | null = null // 保存原始项目的重建数据

  constructor(
    private timelineItemId: string,
    private timelineModule: {
      addTimelineItem: (item: TextTimelineItem) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => TextTimelineItem | undefined
    },
    private webavModule: {
      addSprite: (sprite: VisibleSprite) => Promise<boolean>
      removeSprite: (sprite: VisibleSprite) => boolean
    },
  ) {
    this.id = generateCommandId()
    this.description = `删除文本项目`
  }

  /**
   * 从原始配置重建文本时间轴项目
   * 遵循"从源头重建"原则，每次都完全重新创建
   */
  private async rebuildTextTimelineItem(): Promise<TextTimelineItem> {
    if (!this.originalTimelineItemData) {
      throw new Error('文本时间轴项目数据不存在')
    }

    console.log('🔄 开始从源头重建文本时间轴项目...')

    // 1. 获取原始配置
    const text = this.originalTimelineItemData.config.text
    const style = { ...this.originalTimelineItemData.config.style }

    // 2. 创建新的文本精灵
    const newSprite = await TextVisibleSprite.create(text, style)

    // 3. 设置时间范围
    newSprite.setTimeRange(this.originalTimelineItemData.timeRange)

    // 4. 设置位置和尺寸
    const config = this.originalTimelineItemData.config
    newSprite.rect.x = config.x
    newSprite.rect.y = config.y
    newSprite.rect.w = config.width
    newSprite.rect.h = config.height
    newSprite.rect.angle = config.rotation
    newSprite.opacity = config.opacity
    newSprite.zIndex = config.zIndex

    // 5. 创建新的TimelineItem
    const newTimelineItem = reactive({
      id: this.originalTimelineItemData.id,
      mediaItemId: '', // 文本项目不需要媒体库项目
      trackId: this.originalTimelineItemData.trackId,
      mediaType: 'text' as const,
      timeRange: newSprite.getTimeRange(),
      sprite: markRaw(newSprite),
      config: { ...config },
      timelineStatus: 'ready' as TimelineItemStatus,
    }) as TextTimelineItem

    console.log('🔄 重建文本时间轴项目完成:', {
      id: newTimelineItem.id,
      text: text.substring(0, 20) + '...',
      timeRange: this.originalTimelineItemData.timeRange,
      position: { x: config.x, y: config.y },
      size: { w: config.width, h: config.height },
    })

    return newTimelineItem
  }

  /**
   * 执行命令：删除文本时间轴项目
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行删除文本操作...`)

      const item = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!item || !isTextTimelineItem(item)) {
        throw new Error(`文本项目不存在或类型错误: ${this.timelineItemId}`)
      }

      // 保存项目用于撤销
      this.originalTimelineItemData = TimelineItemFactory.clone(item)

      // 1. 从WebAV画布移除sprite
      if (item.sprite) {
        this.webavModule.removeSprite(item.sprite)
      }

      // 2. 从时间轴移除项目
      this.timelineModule.removeTimelineItem(this.timelineItemId)

      console.log(`✅ 文本项目删除成功: ${this.timelineItemId}`)
    } catch (error) {
      console.error(`❌ 删除文本项目失败:`, error)
      throw error
    }
  }

  /**
   * 撤销命令：重新创建文本时间轴项目
   * 遵循"从源头重建"原则，从原始配置完全重新创建
   */
  async undo(): Promise<void> {
    try {
      if (this.originalTimelineItemData) {
        console.log(`🔄 撤销删除文本操作...`)

        // 从原始配置重新创建TimelineItem和sprite
        const newTimelineItem = await this.rebuildTextTimelineItem()

        // 1. 重新添加到时间轴
        this.timelineModule.addTimelineItem(newTimelineItem)

        // 2. 重新添加sprite到WebAV画布
        if (newTimelineItem.sprite) {
          await this.webavModule.addSprite(newTimelineItem.sprite)
        }

        console.log(`✅ 文本项目恢复成功: ${newTimelineItem.id}`)
      }
    } catch (error) {
      console.error(`❌ 撤销删除文本项目失败:`, error)
      throw error
    }
  }
}

// ==================== 文本命令工厂函数 ====================
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
    webavModule: any,
  ): UpdateTextCommand {
    return new UpdateTextCommand(timelineItemId, newText, newStyle, timelineModule, webavModule)
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

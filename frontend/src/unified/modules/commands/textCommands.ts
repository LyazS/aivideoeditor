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

import type { UnifiedTimeRange } from '../../types/timeRange'

// ==================== 新架构工具导入 ====================
import { isTextTimelineItem, isReady, TimelineItemFactory } from '../../timelineitem'
import { createTextTimelineItem, createSpriteForTextTimelineItem } from '../../utils/textTimelineUtils'

// ==================== 旧架构兼容性导入 ====================
import { TextVisibleSprite } from '../../visiblesprite/TextVisibleSprite'
import type { TextStyleConfig } from '../../../types'
import type { TextMediaConfig } from '../../timelineitem/TimelineItemData'

// ==================== 添加文本项目命令 ====================
/**
 * 添加文本项目命令
 * 支持撤销/重做的文本项目创建操作
 * 采用统一重建逻辑：每次执行都从原始配置重新创建sprite
 */
export class AddTextItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: UnifiedTimelineItemData<'text'> | null = null // 保存原始项目的重建数据

  constructor(
    private textItem: UnifiedTimelineItemData<'text'>,
    private timelineModule: {
      addTimelineItem: (item: UnifiedTimelineItemData<'text'>) => void
      removeTimelineItem: (id: string) => void
    },
    private webavModule: {
      addSprite: (sprite: VisibleSprite) => Promise<boolean>
      removeSprite: (sprite: VisibleSprite) => boolean
    },
  ) {
    this.id = generateCommandId()
    const textConfig = textItem.config as TextMediaConfig
    this.description = `添加文本: ${textConfig.text.substring(0, 10)}${textConfig.text.length > 10 ? '...' : ''}`
    
    // 保存原始项目数据用于重建
    this.originalTimelineItemData = TimelineItemFactory.clone(textItem)
  }

  /**
   * 执行命令：添加文本时间轴项目
   * 统一重建逻辑：每次执行都从原始数据重新创建完整的 TimelineItem 和 sprite
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行添加文本操作...`)

      if (!this.originalTimelineItemData) {
        throw new Error('原始文本项目数据不存在')
      }

      console.log('🔄 开始从原始数据重建文本时间轴项目...')

      // 1. 使用 TimelineItemFactory.clone 创建新的 TimelineItem（确保独立性和正确的 runtime 处理）
      const newTimelineItem = TimelineItemFactory.clone(this.originalTimelineItemData)

      // 2. 使用 textTimelineUtils 中的工具函数创建精灵
      const newSprite = await createSpriteForTextTimelineItem(newTimelineItem)

      // 3. 将精灵添加到 runtime
      newTimelineItem.runtime.sprite = markRaw(newSprite)

      const originalConfig = this.originalTimelineItemData.config as TextMediaConfig
      console.log('✅ 文本时间轴项目重建完成:', {
        id: newTimelineItem.id,
        text: originalConfig.text.substring(0, 20) + '...',
        timeRange: newTimelineItem.timeRange,
        position: { x: newSprite.rect.x, y: newSprite.rect.y },
        size: { w: newSprite.rect.w, h: newSprite.rect.h },
      })

      // 4. 添加到时间轴
      this.timelineModule.addTimelineItem(newTimelineItem)

      // 5. 添加sprite到WebAV画布
      if (newTimelineItem.runtime.sprite) {
        await this.webavModule.addSprite(newTimelineItem.runtime.sprite)
      }

      console.log(`✅ 文本项目添加成功:`, {
        id: newTimelineItem.id,
        text: originalConfig.text.substring(0, 20) + '...',
        startTime: framesToTimecode(newTimelineItem.timeRange.timelineStartTime),
        duration: framesToTimecode(newTimelineItem.timeRange.timelineEndTime - newTimelineItem.timeRange.timelineStartTime),
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
  private originalTimelineItemData: UnifiedTimelineItemData<'text'> | null = null // 保存原始项目的重建数据
  private oldText: string = ''
  private oldStyle: TextStyleConfig | null = null

  constructor(
    private timelineItemId: string,
    private newText: string,
    private newStyle: Partial<TextStyleConfig>,
    private timelineModule: {
      getTimelineItem: (id: string) => UnifiedTimelineItemData<'text'> | undefined
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
   * 遵循"从源头重建"原则，复用 textTimelineUtils 中的工具函数
   */
  private async rebuildTextTimelineItem(
    item: UnifiedTimelineItemData<'text'>,
    text: string,
    style: Partial<TextStyleConfig>,
  ): Promise<UnifiedTimelineItemData<'text'>> {
    console.log('🔄 开始从源头重建文本时间轴项目...')

    // 1. 保存旧精灵的状态和缩放信息
    const oldSprite = item.runtime.sprite as TextVisibleSprite
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

    // 2. 计算当前的缩放系数
    const currentWidth = item.config.width
    const currentHeight = item.config.height
    const originalWidth = item.config.originalWidth
    const originalHeight = item.config.originalHeight
    const scaleX = originalWidth > 0 ? currentWidth / originalWidth : 1
    const scaleY = originalHeight > 0 ? currentHeight / originalHeight : 1

    // 3. 更新配置
    const completeStyle = { ...item.config.style, ...style }
    item.config.text = text
    item.config.style = completeStyle

    // 4. 使用 textTimelineUtils 中的工具函数重新创建精灵
    const newSprite = await createSpriteForTextTimelineItem(item)

    // 5. 更新原始尺寸信息
    item.config.originalWidth = newSprite.rect.w
    item.config.originalHeight = newSprite.rect.h

    // 6. 应用缩放系数
    const newWidth = item.config.originalWidth * scaleX
    const newHeight = item.config.originalHeight * scaleY
    item.config.width = newWidth
    item.config.height = newHeight

    // 7. 更新精灵的尺寸和位置
    newSprite.rect.x = oldState.rect.x
    newSprite.rect.y = oldState.rect.y
    newSprite.rect.w = newWidth
    newSprite.rect.h = newHeight
    newSprite.rect.angle = oldState.rect.angle
    newSprite.opacity = oldState.opacity
    newSprite.zIndex = oldState.zIndex
    newSprite.setTimeRange(oldState.timeRange)

    // 8. 替换精灵引用
    if (!item.runtime) {
      item.runtime = {}
    }
    item.runtime.sprite = markRaw(newSprite)

    // 9. 在WebAV画布中替换精灵
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
   * 遵循"从源头重建"原则，复用 rebuildTextTimelineItem 方法
   */
  private async rebuildTextSprite(
    item: UnifiedTimelineItemData<'text'>,
    newText: string,
    newStyle: Partial<TextStyleConfig>,
  ): Promise<void> {
    // 直接复用 rebuildTextTimelineItem 方法，避免代码重复
    await this.rebuildTextTimelineItem(item, newText, newStyle)
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
  private originalTimelineItemData: UnifiedTimelineItemData<'text'> | null = null // 保存原始项目的重建数据

  constructor(
    private timelineItemId: string,
    private timelineModule: {
      addTimelineItem: (item: UnifiedTimelineItemData<'text'>) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => UnifiedTimelineItemData<'text'> | undefined
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

      // 从时间轴移除项目
      this.timelineModule.removeTimelineItem(this.timelineItemId)

      console.log(`✅ 文本项目删除成功: ${this.timelineItemId}`)
    } catch (error) {
      console.error(`❌ 删除文本项目失败:`, error)
      throw error
    }
  }

  /**
   * 撤销命令：重新创建文本时间轴项目
   * 遵循"从源头重建"原则，复用 textTimelineUtils 中的工具函数
   */
  async undo(): Promise<void> {
    try {
      if (this.originalTimelineItemData) {
        console.log(`🔄 撤销删除文本操作...`)

        // 1. 使用 TimelineItemFactory.clone 创建新的 TimelineItem（确保独立性和正确的 runtime 处理）
        const newTimelineItem = TimelineItemFactory.clone(this.originalTimelineItemData)

        // 2. 使用 textTimelineUtils 中的工具函数创建精灵
        const newSprite = await createSpriteForTextTimelineItem(newTimelineItem)

        // 3. 将精灵添加到 runtime
        newTimelineItem.runtime.sprite = markRaw(newSprite)

        // 4. 重新添加到时间轴
        this.timelineModule.addTimelineItem(newTimelineItem)

        // 5. 重新添加sprite到WebAV画布
        if (newTimelineItem.runtime.sprite) {
          await this.webavModule.addSprite(newTimelineItem.runtime.sprite)
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
    textItem: UnifiedTimelineItemData<'text'>,
    timelineModule: any,
    webavModule: any,
  ): AddTextItemCommand {
    return new AddTextItemCommand(
      textItem,
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

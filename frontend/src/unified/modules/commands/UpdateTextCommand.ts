/**
 * 更新文本内容命令
 * 支持撤销/重做的文本内容和样式更新操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始配置重新创建
 */

import { generateCommandId } from '@/utils/idGenerator'
import { markRaw } from 'vue'
import type { VisibleSprite } from '@webav/av-cliper'
import type { SimpleCommand } from '@/unified/modules/commands/types'

// ==================== 新架构类型导入 ====================
import type {
  UnifiedTimelineItemData,
} from '@/unified/timelineitem/TimelineItemData'

// ==================== 新架构工具导入 ====================
import { isTextTimelineItem, TimelineItemFactory } from '@/unified/timelineitem'
import {
  createSpriteForTextTimelineItem,
} from '@/unified/utils/textTimelineUtils'
import { TextVisibleSprite } from '@/unified/visiblesprite/TextVisibleSprite'
import type { TextStyleConfig } from '@/unified/timelineitem'

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
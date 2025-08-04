/**
 * 移除时间轴项目命令
 * 支持移除已知和未知时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始素材重新创建
 */

import { generateCommandId } from '../../../utils/idGenerator'
import { cloneDeep } from 'lodash'
import { reactive, markRaw } from 'vue'
import type { VisibleSprite } from '@webav/av-cliper'
import type { SimpleCommand } from './types'

// ==================== 新架构类型导入 ====================
import type {
  UnifiedTimelineItemData,
  KnownTimelineItem,
  UnknownTimelineItem,
  TimelineItemStatus,
} from '../../timelineitem/TimelineItemData'

import type {
  UnifiedMediaItemData,
  MediaType,
  MediaTypeOrUnknown,
} from '../../mediaitem/types'

import type {
  VideoMediaConfig,
  ImageMediaConfig,
  AudioMediaConfig,
  TextMediaConfig,
  BaseMediaProps,
} from '../../../types'
import type { UnifiedTimeRange } from '../../types/timeRange'

// ==================== 新架构工具导入 ====================
import {
  createSpriteFromUnifiedMediaItem,
} from '../../utils/UnifiedSpriteFactory'

import { regenerateThumbnailForUnifiedTimelineItem } from '../../utils/thumbnailGenerator'

import {
  isKnownTimelineItem,
  isUnknownTimelineItem,
  hasVisualProperties,
  TimelineItemFactory,
} from '../../timelineitem'

import { UnifiedMediaItemQueries } from '../../mediaitem'

import { createTextTimelineItem } from '../../utils/textTimelineUtils'

/**
 * 移除时间轴项目命令
 * 支持移除已知和未知时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始素材重新创建
 */
export class RemoveTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: UnifiedTimelineItemData<MediaTypeOrUnknown> | null = null // 保存原始项目的重建数据

  constructor(
    private timelineItemId: string,
    timelineItem: UnifiedTimelineItemData<MediaTypeOrUnknown>,
    private timelineModule: {
      addTimelineItem: (item: UnifiedTimelineItemData<MediaTypeOrUnknown>) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
    },
    private webavModule: {
      addSprite: (sprite: VisibleSprite) => Promise<boolean>
      removeSprite: (sprite: VisibleSprite) => boolean
    },
    private mediaModule: {
      getMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
  ) {
    this.id = generateCommandId()

    // 使用类型守卫来区分已知和未知项目
    if (isKnownTimelineItem(timelineItem)) {
      // 已知项目处理逻辑
      if (timelineItem.mediaType === 'text') {
        // 文本项目特殊处理 - 不需要媒体项目
        const textConfig = timelineItem.config as TextMediaConfig
        this.description = `移除文本项目: ${textConfig.text.substring(0, 20)}${textConfig.text.length > 20 ? '...' : ''}`
      } else {
        // 常规媒体项目处理
        const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        this.description = `移除时间轴项目: ${mediaItem?.name || '未知素材'}`
      }

      // 保存重建所需的完整元数据 - 明确传入原始ID以避免重新生成
      this.originalTimelineItemData = TimelineItemFactory.clone(timelineItem, { id: timelineItem.id })

      console.log('💾 保存删除已知项目的重建数据:', {
        id: this.originalTimelineItemData.id,
        mediaItemId: this.originalTimelineItemData.mediaItemId,
        mediaType: this.originalTimelineItemData.mediaType,
        timeRange: this.originalTimelineItemData.timeRange,
        config: this.originalTimelineItemData.config,
      })
    } else if (isUnknownTimelineItem(timelineItem)) {
      // 未知项目处理逻辑
      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      this.description = `移除未知处理项目: ${mediaItem?.name || '未知素材'}`

      // 保存未知项目的完整数据（使用 lodash 深拷贝避免引用问题）
      this.originalTimelineItemData = cloneDeep(timelineItem)

      console.log('💾 保存删除未知项目的数据:', {
        id: this.originalTimelineItemData.id,
        mediaItemId: this.originalTimelineItemData.mediaItemId,
        timeRange: this.originalTimelineItemData.timeRange,
      })
    } else {
      throw new Error('不支持的时间轴项目类型')
    }
  }

  /**
   * 从原始素材重建已知时间轴项目的sprite和timelineItem
   * 遵循"从源头重建"原则，每次都完全重新创建
   */
  private async rebuildKnownTimelineItem(): Promise<KnownTimelineItem> {
    if (!this.originalTimelineItemData || !isKnownTimelineItem(this.originalTimelineItemData)) {
      throw new Error('已知时间轴项目数据不存在')
    }

    console.log('🔄 开始从源头重建已知时间轴项目...')

    // 1. 获取原始素材
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`原始素材不存在: ${this.originalTimelineItemData.mediaItemId}`)
    }

    // 确保素材已经解析完成
    if (!UnifiedMediaItemQueries.isReady(mediaItem)) {
      throw new Error(`素材尚未解析完成: ${mediaItem.name}`)
    }

    // 2. 从原始素材重新创建sprite
    const newSprite = await createSpriteFromUnifiedMediaItem(mediaItem)

    // 3. 设置时间范围
    newSprite.setTimeRange(this.originalTimelineItemData.timeRange)

    // 4. 应用变换属性
    if (hasVisualProperties(this.originalTimelineItemData)) {
      const config = this.originalTimelineItemData.config as
        | VideoMediaConfig
        | ImageMediaConfig
        | TextMediaConfig
      if (config.x !== undefined) newSprite.rect.x = config.x
      if (config.y !== undefined) newSprite.rect.y = config.y
      if (config.width !== undefined) newSprite.rect.w = config.width
      if (config.height !== undefined) newSprite.rect.h = config.height
      if (config.rotation !== undefined) newSprite.rect.angle = config.rotation
      if (config.opacity !== undefined) newSprite.opacity = config.opacity
    }

    // 安全地获取 zIndex，所有媒体类型的配置都应该有 zIndex 属性
    const config = this.originalTimelineItemData.config as BaseMediaProps
    newSprite.zIndex = config.zIndex

    // 5. 创建新的TimelineItem（先不设置缩略图）
    const newTimelineItem = reactive({
      id: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: newSprite.getTimeRange(),
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation
        ? { ...this.originalTimelineItemData.animation }
        : undefined,
      timelineStatus: 'ready' as TimelineItemStatus,
      runtime: {
        sprite: markRaw(newSprite)
      },
    }) as KnownTimelineItem

    // 6. 重新生成缩略图（异步执行，不阻塞重建过程）
    this.regenerateThumbnailForRemovedItem(newTimelineItem, mediaItem)

    console.log('🔄 重建已知时间轴项目完成:', {
      id: newTimelineItem.id,
      mediaType: mediaItem.mediaType,
      timeRange: this.originalTimelineItemData.timeRange,
      position: { x: newSprite.rect.x, y: newSprite.rect.y },
      size: { w: newSprite.rect.w, h: newSprite.rect.h },
    })

    return newTimelineItem
  }

  /**
   * 重建未知处理时间轴项目占位符
   * 不需要创建sprite，只需要重建占位符数据
   */
  private rebuildUnknownTimelineItem(): UnknownTimelineItem {
    if (!this.originalTimelineItemData || !isUnknownTimelineItem(this.originalTimelineItemData)) {
      throw new Error('未知时间轴项目数据不存在')
    }

    console.log('🔄 开始重建未知处理时间轴项目占位符...')

    // 使用 lodash 深拷贝确保完全独立的数据副本
    const newUnknownTimelineItem: UnknownTimelineItem = cloneDeep(this.originalTimelineItemData)

    console.log('🔄 重建未知处理时间轴项目完成:', {
      id: newUnknownTimelineItem.id,
      mediaType: newUnknownTimelineItem.mediaType,
      mediaItemId: newUnknownTimelineItem.mediaItemId,
      timeRange: newUnknownTimelineItem.timeRange,
    })

    return newUnknownTimelineItem
  }

  /**
   * 重建文本时间轴项目
   * 使用 createTextTimelineItem 直接重建，避免重复代码
   */
  private async rebuildTextTimelineItem(): Promise<KnownTimelineItem> {
    if (!this.originalTimelineItemData || !isKnownTimelineItem(this.originalTimelineItemData)) {
      throw new Error('文本时间轴项目数据不存在')
    }

    if (this.originalTimelineItemData.mediaType !== 'text') {
      throw new Error('不是文本项目，无法使用文本重建方法')
    }

    console.log('🔄 开始重建文本时间轴项目...')

    const originalConfig = this.originalTimelineItemData.config as TextMediaConfig
    const originalTimeRange = this.originalTimelineItemData.timeRange

    // 计算视频分辨率（从项目配置获取，这里使用默认值）
    const videoResolution = { width: 1920, height: 1080 } // 实际应该从项目配置获取

    // 计算duration（显示时长）
    const duration = originalTimeRange.timelineEndTime - originalTimeRange.timelineStartTime

    // 直接使用 createTextTimelineItem 重建，传入原始ID以保持一致性
    const newTimelineItem = await createTextTimelineItem(
      originalConfig.text,
      originalConfig.style,
      originalTimeRange.timelineStartTime,
      this.originalTimelineItemData.trackId || '',
      duration,
      videoResolution,
      this.originalTimelineItemData.id // 传入原始ID
    )

    // 恢复原始的位置、尺寸和其他属性（createTextTimelineItem 创建的是默认位置）
    newTimelineItem.config.x = originalConfig.x
    newTimelineItem.config.y = originalConfig.y
    newTimelineItem.config.width = originalConfig.width
    newTimelineItem.config.height = originalConfig.height
    newTimelineItem.config.rotation = originalConfig.rotation
    newTimelineItem.config.opacity = originalConfig.opacity
    newTimelineItem.config.zIndex = originalConfig.zIndex
    newTimelineItem.config.originalWidth = originalConfig.originalWidth
    newTimelineItem.config.originalHeight = originalConfig.originalHeight
    newTimelineItem.config.proportionalScale = originalConfig.proportionalScale

    // 恢复动画配置（如果存在）
    if (this.originalTimelineItemData.animation) {
      newTimelineItem.animation = this.originalTimelineItemData.animation
    }

    // 同步更新sprite的属性以匹配配置
    if (newTimelineItem.runtime.sprite) {
      const sprite = newTimelineItem.runtime.sprite as any
      sprite.rect.x = originalConfig.x
      sprite.rect.y = originalConfig.y
      sprite.rect.w = originalConfig.width
      sprite.rect.h = originalConfig.height
      sprite.rect.angle = originalConfig.rotation
      sprite.opacity = originalConfig.opacity
      sprite.zIndex = originalConfig.zIndex
      
      // 恢复时间范围
      sprite.setTimeRange(originalTimeRange)
    }

    console.log('🔄 重建文本时间轴项目完成:', {
      id: newTimelineItem.id,
      text: originalConfig.text.substring(0, 20) + '...',
      timeRange: originalTimeRange,
      position: { x: originalConfig.x, y: originalConfig.y },
      size: { w: originalConfig.width, h: originalConfig.height },
    })

    return newTimelineItem
  }

  /**
   * 执行命令：删除时间轴项目
   */
  async execute(): Promise<void> {
    try {
      // 检查项目是否存在
      const existingItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!existingItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法删除: ${this.timelineItemId}`)
        return
      }

      // 删除时间轴项目（这会自动处理sprite的清理和WebAV画布移除）
      this.timelineModule.removeTimelineItem(this.timelineItemId)

      if (this.originalTimelineItemData && isKnownTimelineItem(this.originalTimelineItemData)) {
        // 已知项目删除日志
        const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
        console.log(`🗑️ 已删除已知时间轴项目: ${mediaItem?.name || '未知素材'}`)
      } else if (
        this.originalTimelineItemData &&
        isUnknownTimelineItem(this.originalTimelineItemData)
      ) {
        // 未知项目删除日志
        const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
        console.log(`🗑️ 已删除未知处理时间轴项目: ${mediaItem?.name || '未知素材'}`)
      }
    } catch (error) {
      const itemName = this.originalTimelineItemData?.mediaItemId || '未知项目'
      console.error(`❌ 删除时间轴项目失败: ${itemName}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：重新创建时间轴项目
   * 遵循"从源头重建"原则，从原始素材完全重新创建
   */
  async undo(): Promise<void> {
    try {
      if (this.originalTimelineItemData && isKnownTimelineItem(this.originalTimelineItemData)) {
        // 检查是否为文本项目
        if (this.originalTimelineItemData.mediaType === 'text') {
          // 文本项目特殊处理 - 不需要媒体项目
          console.log(`🔄 撤销删除操作：重建文本时间轴项目...`)

          // 从原始配置重新创建文本TimelineItem和sprite
          const newTimelineItem = await this.rebuildTextTimelineItem()

          // 1. 添加到时间轴
          this.timelineModule.addTimelineItem(newTimelineItem)

          // 2. 添加sprite到WebAV画布
          if (newTimelineItem.runtime.sprite) {
            await this.webavModule.addSprite(newTimelineItem.runtime.sprite)
          }

          const textConfig = this.originalTimelineItemData.config as TextMediaConfig
          console.log(`↩️ 已撤销删除文本时间轴项目: ${textConfig.text.substring(0, 20)}...`)
        } else {
          // 常规媒体项目撤销逻辑
          console.log(`🔄 撤销删除操作：重建已知时间轴项目...`)

          // 从原始素材重新创建TimelineItem和sprite
          const newTimelineItem = await this.rebuildKnownTimelineItem()

          // 1. 添加到时间轴
          this.timelineModule.addTimelineItem(newTimelineItem)

          // 2. 添加sprite到WebAV画布
          if (newTimelineItem.runtime.sprite) {
            await this.webavModule.addSprite(newTimelineItem.runtime.sprite)
          }

          const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
          console.log(`↩️ 已撤销删除已知时间轴项目: ${mediaItem?.name || '未知素材'}`)
        }
      } else if (
        this.originalTimelineItemData &&
        isUnknownTimelineItem(this.originalTimelineItemData)
      ) {
        // 未知项目撤销逻辑
        console.log(`🔄 撤销删除操作：重建未知处理时间轴项目占位符...`)

        // 重建未知处理时间轴项目占位符
        const newUnknownTimelineItem = this.rebuildUnknownTimelineItem()

        // 1. 添加到时间轴（未知项目不需要添加sprite到WebAV画布）
        this.timelineModule.addTimelineItem(newUnknownTimelineItem)

        const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
        console.log(`↩️ 已撤销删除未知处理时间轴项目: ${mediaItem?.name || '未知素材'}`)
      } else {
        throw new Error('没有有效的时间轴项目数据')
      }
    } catch (error) {
      const itemName = this.originalTimelineItemData?.mediaItemId || '未知项目'
      console.error(`❌ 撤销删除时间轴项目失败: ${itemName}`, error)
      throw error
    }
  }

  /**
   * 为重建的删除项目重新生成缩略图
   * @param timelineItem 重建的时间轴项目
   * @param mediaItem 对应的媒体项目
   */
  private async regenerateThumbnailForRemovedItem(
    timelineItem: KnownTimelineItem,
    mediaItem: UnifiedMediaItemData,
  ) {
    // 音频不需要缩略图
    if (mediaItem.mediaType === 'audio') {
      console.log('🎵 音频不需要缩略图，跳过生成')
      return
    }

    try {
      console.log('🖼️ 开始为重建的删除项目重新生成缩略图...')

      const thumbnailUrl = await regenerateThumbnailForUnifiedTimelineItem(timelineItem, mediaItem)

      if (thumbnailUrl) {
        // 缩略图已存储到runtime.thumbnailUrl中
        // 这里暂时保留原有逻辑，需要根据实际实现调整
        console.log('✅ 重建删除项目缩略图生成完成')
      }
    } catch (error) {
      console.error('❌ 重建删除项目缩略图生成失败:', error)
    }
  }
}
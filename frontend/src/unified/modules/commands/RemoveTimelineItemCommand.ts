/**
 * 移除时间轴项目命令
 * 支持移除已知和未知时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始素材重新创建
 */

import { generateCommandId } from '../../../utils/idGenerator'
import { reactive, markRaw } from 'vue'
import type { VisibleSprite } from '@webav/av-cliper'
import type { SimpleCommand } from './types'
import { cloneTimelineItem } from '../../timelineitem/TimelineItemFactory'

// ==================== 新架构类型导入 ====================
import type {
  UnifiedTimelineItemData,
  KnownTimelineItem,
  UnknownTimelineItem,
  TimelineItemStatus,
} from '../../timelineitem/TimelineItemData'

import type { UnifiedMediaItemData, MediaType } from '../../mediaitem/types'

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
  createSpriteFromUnifiedTimelineItem
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
import { useTimelineMediaSync } from '../../composables/useTimelineMediaSync'

/**
 * 移除时间轴项目命令
 * 支持移除已知和未知时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始素材重新创建
 */
export class RemoveTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: UnifiedTimelineItemData<MediaType> | null = null // 保存原始项目的重建数据

  constructor(
    private timelineItemId: string,
    timelineItem: UnifiedTimelineItemData<MediaType>,
    private timelineModule: {
      addTimelineItem: (item: UnifiedTimelineItemData<MediaType>) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaType> | undefined
    },
    private webavModule: {
      addSprite: (sprite: VisibleSprite) => Promise<boolean>
      removeSprite: (sprite: VisibleSprite) => boolean
    },
    private mediaModule: {
      getMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
    private configModule: {
      videoResolution: { value: { width: number; height: number } }
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

      // 保存重建所需的完整元数据
      this.originalTimelineItemData = TimelineItemFactory.clone(timelineItem)

      console.log('💾 保存删除已知项目的重建数据:', {
        id: this.originalTimelineItemData.id,
        mediaItemId: this.originalTimelineItemData.mediaItemId,
        mediaType: this.originalTimelineItemData.mediaType,
        timeRange: this.originalTimelineItemData.timeRange,
        config: this.originalTimelineItemData.config,
      })
    // 注意：由于不再支持 unknown 类型，移除了对 isUnknownTimelineItem 的处理
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

    // 检查素材状态和重建条件
    const isReady = UnifiedMediaItemQueries.isReady(mediaItem)
    const hasError = UnifiedMediaItemQueries.hasError(mediaItem)

    // 只阻止错误状态的素材
    if (hasError) {
      throw new Error(`素材解析失败，无法重建时间轴项目: ${mediaItem.name}`)
    }

    // 检查媒体类型和时长
    if (mediaItem.mediaType === 'unknown') {
      throw new Error(`素材类型未确定，无法重建时间轴项目: ${mediaItem.name}`)
    }

    const availableDuration = mediaItem.duration
    if (!availableDuration || availableDuration <= 0) {
      throw new Error(`素材时长信息不可用，无法重建时间轴项目: ${mediaItem.name}`)
    }

    // 根据素材状态确定时间轴项目状态
    const timelineStatus: TimelineItemStatus = isReady ? 'ready' : 'loading'

    if (isReady) {
      // Ready素材：创建包含sprite的完整时间轴项目
      console.log('✅ [RemoveTimelineItemCommand] 重建ready状态时间轴项目')

      // 2. 使用时间轴项目数据创建sprite（参考AddTimelineItemCommand的逻辑）
      const newSprite = await createSpriteFromUnifiedTimelineItem(this.originalTimelineItemData)

      // 3. 创建新的TimelineItem
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
        timelineStatus: timelineStatus,
        runtime: {
          sprite: markRaw(newSprite),
        },
      }) as KnownTimelineItem

      // 4. 重新生成缩略图（异步执行，不阻塞重建过程）
      this.regenerateThumbnailForRemovedItem(newTimelineItem, mediaItem)

      console.log('🔄 重建ready状态时间轴项目完成:', {
        id: newTimelineItem.id,
        mediaType: mediaItem.mediaType,
        timeRange: this.originalTimelineItemData.timeRange,
        position: { x: newSprite.rect.x, y: newSprite.rect.y },
        size: { w: newSprite.rect.w, h: newSprite.rect.h },
      })

      return newTimelineItem
    } else {
      // 未Ready素材：创建loading状态的时间轴项目
      console.log('⏳ [RemoveTimelineItemCommand] 重建loading状态时间轴项目')

      // 创建loading状态的时间轴项目
      const newTimelineItem = reactive({
        id: this.originalTimelineItemData.id,
        mediaItemId: this.originalTimelineItemData.mediaItemId,
        trackId: this.originalTimelineItemData.trackId,
        mediaType: this.originalTimelineItemData.mediaType,
        timeRange: { ...this.originalTimelineItemData.timeRange },
        config: { ...this.originalTimelineItemData.config },
        animation: this.originalTimelineItemData.animation
          ? { ...this.originalTimelineItemData.animation }
          : undefined,
        timelineStatus: timelineStatus,
        runtime: {}, // loading状态暂时没有sprite
      }) as KnownTimelineItem

      console.log('🔄 重建loading状态时间轴项目完成:', {
        id: newTimelineItem.id,
        mediaType: mediaItem.mediaType,
        timeRange: this.originalTimelineItemData.timeRange,
        status: 'loading',
      })

      return newTimelineItem
    }
  }

  /**
   * 重建未知处理时间轴项目占位符
   * 不需要创建sprite，只需要重建占位符数据
   */
  // 注意：rebuildUnknownTimelineItem 方法已被移除，因为不再支持 unknown 类型

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
      this.originalTimelineItemData.id, // 传入原始ID
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

    // 同步更新sprite的属性以匹配配置（使用坐标转换）
    if (newTimelineItem.runtime.sprite) {
      const sprite = newTimelineItem.runtime.sprite as any

      // 导入坐标转换工具
      const { projectToWebavCoords } = await import('../../utils/coordinateTransform')

      // 获取画布分辨率
      const canvasWidth = this.configModule.videoResolution.value.width
      const canvasHeight = this.configModule.videoResolution.value.height

      // 使用坐标转换将项目坐标系转换为WebAV坐标系
      const webavCoords = projectToWebavCoords(
        originalConfig.x,
        originalConfig.y,
        originalConfig.width,
        originalConfig.height,
        canvasWidth,
        canvasHeight,
      )

      sprite.rect.x = webavCoords.x
      sprite.rect.y = webavCoords.y
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
      // 注意：移除了对未知项目的处理逻辑
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

          // 3. 为loading状态的项目设置媒体同步
          const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
          if (mediaItem) {
            const { setupMediaSyncIfNeeded } = useTimelineMediaSync()
            setupMediaSyncIfNeeded(newTimelineItem, mediaItem, this)
          }

          console.log(`↩️ 已撤销删除已知时间轴项目: ${mediaItem?.name || '未知素材'}`)
        }
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
   * 更新保存的原始时间轴项目时长和状态
   * 当素材从loading状态转换为ready状态时，时长可能会发生变化，需要更新保存的时长数据
   * 同时更新timelineStatus为传入的状态，并更新config中的原始分辨率信息
   * @param duration 新的时长
   * @param timelineStatus 新的时间轴状态
   * @param updatedConfig 更新后的配置信息（可选，用于更新原始分辨率等信息）
   */
  public updateOriginalTimelineItemData(
    duration: number,
    timelineStatus: TimelineItemStatus,
    updatedConfig?: Partial<
      VideoMediaConfig | ImageMediaConfig | AudioMediaConfig | TextMediaConfig
    >,
  ): void {
    if (!this.originalTimelineItemData) {
      console.warn('⚠️ [RemoveTimelineItemCommand] 没有原始时间轴项目数据，无法更新时长')
      return
    }

    const oldDuration =
      this.originalTimelineItemData.timeRange.timelineEndTime -
      this.originalTimelineItemData.timeRange.timelineStartTime

    console.log('🔄 [RemoveTimelineItemCommand] 更新原始时间轴项目时长和配置', {
      oldDuration,
      newDuration: duration,
      timelineStatus,
      mediaType: this.originalTimelineItemData.mediaType,
      hasUpdatedConfig: !!updatedConfig,
    })

    // 更新时间范围的结束时间，保持开始时间不变
    this.originalTimelineItemData.timeRange.timelineEndTime =
      this.originalTimelineItemData.timeRange.timelineStartTime + duration
    this.originalTimelineItemData.timeRange.clipEndTime = duration

    // 更新状态为传入的状态
    this.originalTimelineItemData.timelineStatus = timelineStatus

    // 如果提供了更新的配置信息，则更新config
    if (updatedConfig) {
      console.log('🔄 [RemoveTimelineItemCommand] 应用更新的配置信息', updatedConfig)

      // 合并更新的配置到原始配置中
      Object.assign(this.originalTimelineItemData.config, updatedConfig)

      console.log('✅ [RemoveTimelineItemCommand] 配置信息已更新')
    }

    console.log('✅ [RemoveTimelineItemCommand] 原始时间轴项目时长、状态和配置更新完成', {
      timelineStatus: this.originalTimelineItemData.timelineStatus,
    })
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

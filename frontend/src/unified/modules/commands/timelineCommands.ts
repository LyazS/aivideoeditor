/**
 * 统一架构下的时间轴命令实现
 * 基于"核心数据与行为分离"的响应式重构版本
 * 
 * 主要变化：
 * 1. 使用 UnifiedTimelineItemData 替代原有的 LocalTimelineItem 和 AsyncProcessingTimelineItem
 * 2. 使用 UnifiedMediaItemData 替代原有的 LocalMediaItem 和 AsyncProcessingMediaItem
 * 3. 使用 UnifiedTrackData 替代原有的 Track 类型
 * 4. 使用统一的状态管理系统（3状态：ready|loading|error）
 * 5. 保持与原有命令相同的API接口，便于迁移
 */

import { generateCommandId } from '../../../utils/idGenerator'
import { framesToMicroseconds, framesToTimecode } from '../../utils/UnifiedTimeUtils'
import { cloneDeep } from 'lodash'
import { reactive, markRaw, ref, type Raw, type Ref } from 'vue'
import type { VisibleSprite } from '@webav/av-cliper'
import type { SimpleCommand } from './types'

// ==================== 新架构类型导入 ====================
import type {
  UnifiedTimelineItemData,
  KnownTimelineItem,
  UnknownTimelineItem,
  TimelineItemStatus,
  CreateKnownTimelineItemOptions,
  CreateUnknownTimelineItemOptions,
  TransformData,
  GetTimeRange,
  GetTimelineItemConfig,
  AnimationConfig
} from '../../timelineitem/TimelineItemData'

import type {
  UnifiedMediaItemData,
  MediaStatus,
  MediaType,
  MediaTypeOrUnknown
} from '../../mediaitem/types'

import type {
  UnifiedTrackData,
  UnifiedTrackType
} from '../../track/TrackTypes'

import type {
  BaseTimeRange,
  VideoTimeRange,
  ImageTimeRange,
  AsyncProcessingTimeRange,
  CustomSprite,
  VideoMediaConfig,
  ImageMediaConfig,
  AudioMediaConfig,
  TextMediaConfig,
  BaseMediaProps
} from '../../../types'

// ==================== 新架构工具导入 ====================
import {
  createSpriteFromUnifiedMediaItem,
  canCreateSpriteFromUnifiedMediaItem
} from '../../utils/UnifiedSpriteFactory'

import {
  regenerateThumbnailForUnifiedTimelineItem
} from '../../utils/thumbnailGenerator'

import {
  syncTimeRange,
  moveTimelineItem,
  resizeTimelineItem
} from '../../utils/UnifiedTimeRangeUtils'

import {
  isKnownTimelineItem,
  isUnknownTimelineItem,
  isVideoTimelineItem,
  isImageTimelineItem,
  isAudioTimelineItem,
  isTextTimelineItem,
  isReady,
  isLoading,
  hasError,
  getDuration,
  hasVisualProperties,
  hasAudioProperties,
  TimelineItemFactory
} from '../../timelineitem'

import { UnifiedMediaItemQueries } from '../../mediaitem'

// ==================== 旧架构兼容性导入 ====================
import { VideoVisibleSprite } from '../../../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../../../utils/ImageVisibleSprite'
import { AudioVisibleSprite } from '../../../utils/AudioVisibleSprite'
import {
  isVideoVisibleSprite,
  isAudioVisibleSprite
} from '../../utils/SpriteTypeGuards'

// ==================== 添加时间轴项目命令 ====================
/**
 * 添加时间轴项目命令
 * 支持添加已知和未知时间轴项目的撤销/重做操作
 * 采用统一重建逻辑：每次执行都从原始素材重新创建sprite（已知项目）或重建占位符（未知项目）
 */
export class AddTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: UnifiedTimelineItemData<MediaTypeOrUnknown> | null = null // 保存原始项目的重建数据

  constructor(
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
      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      this.description = `添加时间轴项目: ${mediaItem?.name || '未知素材'}`

      // 保存原始数据用于重建sprite
      this.originalTimelineItemData = TimelineItemFactory.clone(timelineItem)
    } else if (isUnknownTimelineItem(timelineItem)) {
      // 未知项目处理逻辑
      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      this.description = `添加异步处理项目: ${mediaItem?.name || '未知素材'}`

      // 保存未知项目的完整数据（使用 lodash 深拷贝避免引用问题）
      this.originalTimelineItemData = cloneDeep(timelineItem)
    } else {
      throw new Error('不支持的时间轴项目类型')
    }
  }

  /**
   * 从原始素材重建完整的已知TimelineItem
   * 统一重建逻辑：每次都从原始素材完全重新创建
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
      const config = this.originalTimelineItemData.config as any // 临时类型断言
      
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
      sprite: markRaw(newSprite),
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation
        ? { ...this.originalTimelineItemData.animation }
        : undefined,
      timelineStatus: 'ready' as TimelineItemStatus
    }) as KnownTimelineItem

    // 6. 重新生成缩略图（异步执行，不阻塞重建过程）
    this.regenerateThumbnailForAddedItem(newTimelineItem, mediaItem)

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
    const newUnknownTimelineItem: UnknownTimelineItem = cloneDeep(
      this.originalTimelineItemData,
    )

    console.log('🔄 重建未知处理时间轴项目完成:', {
      id: newUnknownTimelineItem.id,
      mediaType: newUnknownTimelineItem.mediaType,
      mediaItemId: newUnknownTimelineItem.mediaItemId,
      timeRange: newUnknownTimelineItem.timeRange,
    })

    return newUnknownTimelineItem
  }

  /**
   * 执行命令：添加时间轴项目
   * 统一重建逻辑：每次执行都从原始素材重新创建（已知项目）或重建占位符（未知项目）
   */
  async execute(): Promise<void> {
    try {
      if (this.originalTimelineItemData && isKnownTimelineItem(this.originalTimelineItemData)) {
        // 已知项目处理逻辑
        console.log(`🔄 执行添加操作：从源头重建已知时间轴项目...`)

        // 从原始素材重新创建TimelineItem和sprite
        const newTimelineItem = await this.rebuildKnownTimelineItem()

        // 1. 添加到时间轴
        this.timelineModule.addTimelineItem(newTimelineItem)

        // 2. 添加sprite到WebAV画布
        if (newTimelineItem.sprite) {
          await this.webavModule.addSprite(newTimelineItem.sprite)
        }

        console.log(`✅ 已添加已知时间轴项目: ${this.originalTimelineItemData.mediaItemId}`)
      } else if (this.originalTimelineItemData && isUnknownTimelineItem(this.originalTimelineItemData)) {
        // 未知项目处理逻辑
        console.log(`🔄 执行添加操作：重建未知处理时间轴项目占位符...`)

        // 重建未知处理时间轴项目占位符
        const newUnknownTimelineItem = this.rebuildUnknownTimelineItem()

        // 1. 添加到时间轴（未知项目不需要添加sprite到WebAV画布）
        this.timelineModule.addTimelineItem(newUnknownTimelineItem)

        console.log(`✅ 已添加未知处理时间轴项目: ${newUnknownTimelineItem.config.name}`)
      } else {
        throw new Error('没有有效的时间轴项目数据')
      }
    } catch (error) {
      const itemName = this.originalTimelineItemData?.mediaItemId || '未知项目'
      console.error(`❌ 添加时间轴项目失败: ${itemName}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：移除时间轴项目
   */
  async undo(): Promise<void> {
    try {
      if (this.originalTimelineItemData && isKnownTimelineItem(this.originalTimelineItemData)) {
        // 已知项目撤销逻辑
        const existingItem = this.timelineModule.getTimelineItem(this.originalTimelineItemData.id)
        if (!existingItem) {
          console.warn(`⚠️ 已知时间轴项目不存在，无法撤销: ${this.originalTimelineItemData.id}`)
          return
        }

        // 移除时间轴项目（这会自动处理sprite的清理）
        this.timelineModule.removeTimelineItem(this.originalTimelineItemData.id)
        const mediaItem = this.mediaModule.getMediaItem(
          this.originalTimelineItemData.mediaItemId,
        )
        console.log(`↩️ 已撤销添加已知时间轴项目: ${mediaItem?.name || '未知素材'}`)
      } else if (this.originalTimelineItemData && isUnknownTimelineItem(this.originalTimelineItemData)) {
        // 未知项目撤销逻辑
        const existingItem = this.timelineModule.getTimelineItem(this.originalTimelineItemData.id)
        if (!existingItem) {
          console.warn(
            `⚠️ 未知处理时间轴项目不存在，无法撤销: ${this.originalTimelineItemData.id}`,
          )
          return
        }

        // 移除未知处理时间轴项目
        this.timelineModule.removeTimelineItem(this.originalTimelineItemData.id)
        const mediaItem = this.mediaModule.getMediaItem(
          this.originalTimelineItemData.mediaItemId,
        )
        console.log(`↩️ 已撤销添加未知处理时间轴项目: ${mediaItem?.name || '未知素材'}`)
      } else {
        console.warn('⚠️ 没有有效的时间轴项目数据，无法撤销')
      }
    } catch (error) {
      const itemName = this.originalTimelineItemData?.mediaItemId || '未知项目'
      console.error(`❌ 撤销添加时间轴项目失败: ${itemName}`, error)
      throw error
    }
  }

  /**
   * 为添加的项目重新生成缩略图
   * @param timelineItem 添加的时间轴项目
   * @param mediaItem 对应的媒体项目
   */
  private async regenerateThumbnailForAddedItem(
    timelineItem: KnownTimelineItem,
    mediaItem: UnifiedMediaItemData,
  ) {
    // 音频不需要缩略图
    if (mediaItem.mediaType === 'audio') {
      console.log('🎵 音频不需要缩略图，跳过生成')
      return
    }

    // 检查是否已经有缩略图，避免重复生成
    // 缩略图URL存储在config中
    const config = timelineItem.config as any
    if (config && config.thumbnailUrl) {
      console.log('✅ 项目已有缩略图，跳过重新生成')
      return
    }

    try {
      console.log('🖼️ 开始为添加的项目重新生成缩略图...')

      const thumbnailUrl = await regenerateThumbnailForUnifiedTimelineItem(timelineItem, mediaItem)

      if (thumbnailUrl) {
        // 在新架构中，缩略图可能存储在不同的位置
        // 这里暂时保留原有逻辑，需要根据实际实现调整
        console.log('✅ 添加项目缩略图生成完成')
      }
    } catch (error) {
      console.error('❌ 添加项目缩略图生成失败:', error)
    }
  }
}

// ==================== 移除时间轴项目命令 ====================
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
      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      this.description = `移除时间轴项目: ${mediaItem?.name || '未知素材'}`

      // 保存重建所需的完整元数据
      this.originalTimelineItemData = TimelineItemFactory.clone(timelineItem)

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
      const config = this.originalTimelineItemData.config as any // 临时类型断言
      
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
      sprite: markRaw(newSprite),
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation
        ? { ...this.originalTimelineItemData.animation }
        : undefined,
      timelineStatus: 'ready' as TimelineItemStatus
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
    const newUnknownTimelineItem: UnknownTimelineItem = cloneDeep(
      this.originalTimelineItemData,
    )

    console.log('🔄 重建未知处理时间轴项目完成:', {
      id: newUnknownTimelineItem.id,
      mediaType: newUnknownTimelineItem.mediaType,
      mediaItemId: newUnknownTimelineItem.mediaItemId,
      timeRange: newUnknownTimelineItem.timeRange,
    })

    return newUnknownTimelineItem
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
        const mediaItem = this.mediaModule.getMediaItem(
          this.originalTimelineItemData.mediaItemId,
        )
        console.log(`🗑️ 已删除已知时间轴项目: ${mediaItem?.name || '未知素材'}`)
      } else if (this.originalTimelineItemData && isUnknownTimelineItem(this.originalTimelineItemData)) {
        // 未知项目删除日志
        const mediaItem = this.mediaModule.getMediaItem(
          this.originalTimelineItemData.mediaItemId,
        )
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
        // 已知项目撤销逻辑
        console.log(`🔄 撤销删除操作：重建已知时间轴项目...`)

        // 从原始素材重新创建TimelineItem和sprite
        const newTimelineItem = await this.rebuildKnownTimelineItem()

        // 1. 添加到时间轴
        this.timelineModule.addTimelineItem(newTimelineItem)

        // 2. 添加sprite到WebAV画布
        if (newTimelineItem.sprite) {
          await this.webavModule.addSprite(newTimelineItem.sprite)
        }

        const mediaItem = this.mediaModule.getMediaItem(
          this.originalTimelineItemData.mediaItemId,
        )
        console.log(`↩️ 已撤销删除已知时间轴项目: ${mediaItem?.name || '未知素材'}`)
      } else if (this.originalTimelineItemData && isUnknownTimelineItem(this.originalTimelineItemData)) {
        // 未知项目撤销逻辑
        console.log(`🔄 撤销删除操作：重建未知处理时间轴项目占位符...`)

        // 重建未知处理时间轴项目占位符
        const newUnknownTimelineItem = this.rebuildUnknownTimelineItem()

        // 1. 添加到时间轴（未知项目不需要添加sprite到WebAV画布）
        this.timelineModule.addTimelineItem(newUnknownTimelineItem)

        const mediaItem = this.mediaModule.getMediaItem(
          this.originalTimelineItemData.mediaItemId,
        )
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
        // 在新架构中，缩略图可能存储在不同的位置
        // 这里暂时保留原有逻辑，需要根据实际实现调整
        console.log('✅ 重建删除项目缩略图生成完成')
      }
    } catch (error) {
      console.error('❌ 重建删除项目缩略图生成失败:', error)
    }
  }
}

// ==================== 移动时间轴项目命令 ====================
/**
 * 移动时间轴项目命令
 * 支持已知和未知时间轴项目位置移动的撤销/重做操作
 * 包括时间位置移动和轨道间移动
 */
export class MoveTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string

  constructor(
    private timelineItemId: string,
    private oldPositionFrames: number, // 旧的时间位置（帧数）
    private newPositionFrames: number, // 新的时间位置（帧数）
    private oldTrackId: string, // 旧的轨道ID
    private newTrackId: string, // 新的轨道ID
    private timelineModule: {
      updateTimelineItemPosition: (id: string, positionFrames: number, trackId?: string) => Promise<void>
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
    },
    private mediaModule: {
      getMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
  ) {
    this.id = generateCommandId()

    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    let itemName = '未知素材'

    // 根据项目类型获取名称
    if (timelineItem) {
      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      itemName = mediaItem?.name || '未知素材'
    }

    // 生成描述信息
    const positionChanged = this.oldPositionFrames !== this.newPositionFrames
    const trackChanged = oldTrackId !== newTrackId

    if (positionChanged && trackChanged) {
      this.description = `移动时间轴项目: ${itemName} (位置: ${this.oldPositionFrames}帧→${this.newPositionFrames}帧, 轨道: ${oldTrackId}→${newTrackId})`
    } else if (positionChanged) {
      this.description = `移动时间轴项目: ${itemName} (位置: ${this.oldPositionFrames}帧→${this.newPositionFrames}帧)`
    } else if (trackChanged) {
      this.description = `移动时间轴项目: ${itemName} (轨道: ${oldTrackId}→${newTrackId})`
    } else {
      this.description = `移动时间轴项目: ${itemName} (无变化)`
    }

    console.log('💾 保存移动操作数据:', {
      timelineItemId,
      oldPositionFrames: this.oldPositionFrames,
      newPositionFrames: this.newPositionFrames,
      oldTrackId,
      newTrackId,
      positionChanged,
      trackChanged,
    })
  }

  /**
   * 执行命令：移动时间轴项目到新位置
   */
  async execute(): Promise<void> {
    try {
      // 检查项目是否存在
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法移动: ${this.timelineItemId}`)
        return
      }

      // 移动到新位置
      const trackIdToSet = this.oldTrackId !== this.newTrackId ? this.newTrackId : undefined
      await this.timelineModule.updateTimelineItemPosition(
        this.timelineItemId,
        this.newPositionFrames,
        trackIdToSet,
      )

      // 根据项目类型获取名称
      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      const itemName = mediaItem?.name || '未知素材'

      console.log(
        `🔄 已移动时间轴项目: ${itemName} 到位置 ${this.newPositionFrames}帧, 轨道 ${this.newTrackId}`,
      )
    } catch (error) {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem
        ? this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        : null
      const itemName = mediaItem?.name || '未知素材'
      console.error(`❌ 移动时间轴项目失败: ${itemName}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：移动时间轴项目回到原位置
   */
  async undo(): Promise<void> {
    try {
      // 检查项目是否存在
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法撤销移动: ${this.timelineItemId}`)
        return
      }

      // 移动回原位置
      const trackIdToSet = this.oldTrackId !== this.newTrackId ? this.oldTrackId : undefined
      await this.timelineModule.updateTimelineItemPosition(
        this.timelineItemId,
        this.oldPositionFrames,
        trackIdToSet,
      )

      // 根据项目类型获取名称
      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      const itemName = mediaItem?.name || '未知素材'

      console.log(
        `↩️ 已撤销移动时间轴项目: ${itemName} 回到位置 ${this.oldPositionFrames}帧, 轨道 ${this.oldTrackId}`,
      )
    } catch (error) {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem
        ? this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        : null
      const itemName = mediaItem?.name || '未知素材'
      console.error(`❌ 撤销移动时间轴项目失败: ${itemName}`, error)
      throw error
    }
  }
}

// ==================== 更新变换属性命令 ====================
/**
 * 更新变换属性命令
 * 支持变换属性（位置、大小、旋转、透明度、zIndex、时长、倍速）修改的撤销/重做操作
 */
export class UpdateTransformCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string

  constructor(
    private timelineItemId: string,
    private propertyType:
      | 'position'
      | 'size'
      | 'rotation'
      | 'opacity'
      | 'zIndex'
      | 'duration'
      | 'playbackRate'
      | 'volume'
      | 'audioState'
      | 'gain'
      | 'multiple',
    private oldValues: {
      x?: number
      y?: number
      width?: number
      height?: number
      rotation?: number
      opacity?: number
      zIndex?: number
      duration?: number // 时长（帧数）
      playbackRate?: number // 倍速
      volume?: number // 音量（0-1之间）
      isMuted?: boolean // 静音状态
      gain?: number // 音频增益（dB）
    },
    private newValues: {
      x?: number
      y?: number
      width?: number
      height?: number
      rotation?: number
      opacity?: number
      zIndex?: number
      duration?: number // 时长（帧数）
      playbackRate?: number // 倍速
      volume?: number // 音量（0-1之间）
      isMuted?: boolean // 静音状态
      gain?: number // 音频增益（dB）
    },
    private timelineModule: {
      updateTimelineItemTransform: (id: string, transform: TransformData) => void
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
    },
    private mediaModule: {
      getMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
    private clipOperationsModule?: {
      updateTimelineItemPlaybackRate: (id: string, rate: number) => void
    },
  ) {
    this.id = generateCommandId()

    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    const mediaItem = timelineItem
      ? this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      : null

    // 生成描述信息
    this.description = this.generateDescription(mediaItem?.name || '未知素材')

    console.log('💾 保存变换属性操作数据:', {
      timelineItemId,
      propertyType,
      oldValues,
      newValues,
    })
  }

  /**
   * 执行命令：应用新的变换属性
   */
  async execute(): Promise<void> {
    try {
      // 检查项目是否存在
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法更新变换属性: ${this.timelineItemId}`)
        return
      }

      // 应用新的变换属性（位置、大小、旋转、透明度、层级）
      const transformValues = {
        x: this.newValues.x,
        y: this.newValues.y,
        width: this.newValues.width,
        height: this.newValues.height,
        rotation: this.newValues.rotation,
        opacity: this.newValues.opacity,
        zIndex: this.newValues.zIndex,
      }

      // 过滤掉undefined的值
      const filteredTransform = Object.fromEntries(
        Object.entries(transformValues).filter(([_, value]) => value !== undefined),
      )

      if (Object.keys(filteredTransform).length > 0) {
        this.timelineModule.updateTimelineItemTransform(this.timelineItemId, filteredTransform)
      }

      // 处理倍速更新（对视频和音频有效）
      if (this.newValues.playbackRate !== undefined && this.clipOperationsModule) {
        this.clipOperationsModule.updateTimelineItemPlaybackRate(
          this.timelineItemId,
          this.newValues.playbackRate,
        )
      }

      // 处理时长更新（通过直接操作sprite的timeRange）
      if (this.newValues.duration !== undefined) {
        this.updateTimelineItemDuration(this.timelineItemId, this.newValues.duration)
      }

      // 处理音量更新（对视频和音频有效）
      if (hasAudioProperties(timelineItem)) {
        if (this.newValues.volume !== undefined) {
          // hasAudioProperties 类型守卫确保了 config 具有音频属性
          const config = timelineItem.config as any
          if (config.volume !== undefined) {
            config.volume = this.newValues.volume
          }
          const sprite = timelineItem.sprite
          if (sprite && 'setVolume' in sprite) {
            (sprite as VideoVisibleSprite).setVolume?.(this.newValues.volume)
          }
        }

        if (this.newValues.isMuted !== undefined) {
          // hasAudioProperties 类型守卫确保了 config 具有音频属性
          const config = timelineItem.config as any
          if (config.isMuted !== undefined) {
            config.isMuted = this.newValues.isMuted
          }
          const sprite = timelineItem.sprite
          if (sprite && isVideoVisibleSprite(sprite)) {
            sprite.setMuted(this.newValues.isMuted)
          }
        }
      }

      // 处理音频增益更新（仅对音频有效）
      if (isAudioTimelineItem(timelineItem) && this.newValues.gain !== undefined) {
        // 类型安全的音频配置更新
        const config = timelineItem.config as AudioMediaConfig
        if (config.gain !== undefined) {
          config.gain = this.newValues.gain
        }
        const sprite = timelineItem.sprite
        if (sprite && isAudioVisibleSprite(sprite)) {
          sprite.setGain(this.newValues.gain)
        }
      }

      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      console.log(`🎯 已更新变换属性: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem
        ? this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        : null
      console.error(`❌ 更新变换属性失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复到旧的变换属性
   */
  async undo(): Promise<void> {
    try {
      // 检查项目是否存在
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      if (!timelineItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法撤销变换属性: ${this.timelineItemId}`)
        return
      }

      // 恢复到旧的变换属性（位置、大小、旋转、透明度、层级）
      const transformValues = {
        x: this.oldValues.x,
        y: this.oldValues.y,
        width: this.oldValues.width,
        height: this.oldValues.height,
        rotation: this.oldValues.rotation,
        opacity: this.oldValues.opacity,
        zIndex: this.oldValues.zIndex,
      }

      // 过滤掉undefined的值
      const filteredTransform = Object.fromEntries(
        Object.entries(transformValues).filter(([_, value]) => value !== undefined),
      )

      if (Object.keys(filteredTransform).length > 0) {
        this.timelineModule.updateTimelineItemTransform(this.timelineItemId, filteredTransform)
      }

      // 处理倍速恢复（对视频和音频有效）
      if (this.oldValues.playbackRate !== undefined && this.clipOperationsModule) {
        this.clipOperationsModule.updateTimelineItemPlaybackRate(
          this.timelineItemId,
          this.oldValues.playbackRate,
        )
      }

      // 处理时长恢复（通过直接操作sprite的timeRange）
      if (this.oldValues.duration !== undefined) {
        this.updateTimelineItemDuration(this.timelineItemId, this.oldValues.duration)
      }

      // 处理音量恢复（对视频和音频有效）
      if (hasAudioProperties(timelineItem)) {
        if (this.oldValues.volume !== undefined) {
          // hasAudioProperties 类型守卫确保了 config 具有音频属性
          const config = timelineItem.config as any
          if (config.volume !== undefined) {
            config.volume = this.oldValues.volume
          }
          const sprite = timelineItem.sprite
          if (sprite && isVideoVisibleSprite(sprite)) {
            sprite.setVolume(this.oldValues.volume)
          }
        }

        if (this.oldValues.isMuted !== undefined) {
          // hasAudioProperties 类型守卫确保了 config 具有音频属性
          const config = timelineItem.config as any
          if (config.isMuted !== undefined) {
            config.isMuted = this.oldValues.isMuted
          }
          const sprite = timelineItem.sprite
          if (sprite && isVideoVisibleSprite(sprite)) {
            sprite.setMuted(this.oldValues.isMuted)
          }
        }
      }

      // 处理音频增益恢复（仅对音频有效）
      if (isAudioTimelineItem(timelineItem) && this.oldValues.gain !== undefined) {
        // 类型安全的音频配置恢复
        const config = timelineItem.config as AudioMediaConfig
        if (config.gain !== undefined) {
          config.gain = this.oldValues.gain
        }
        const sprite = timelineItem.sprite
        if (sprite && isAudioVisibleSprite(sprite)) {
          sprite.setGain(this.oldValues.gain)
        }
      }

      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      console.log(`↩️ 已撤销变换属性更新: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem
        ? this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        : null
      console.error(`❌ 撤销变换属性更新失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }

  /**
   * 生成命令描述
   */
  private generateDescription(mediaName: string): string {
    const changes: string[] = []

    // 检查位置变化
    if (
      (this.newValues.x !== undefined && this.oldValues.x !== undefined) ||
      (this.newValues.y !== undefined && this.oldValues.y !== undefined)
    ) {
      const oldX = this.oldValues.x ?? 0
      const oldY = this.oldValues.y ?? 0
      const newX = this.newValues.x ?? oldX
      const newY = this.newValues.y ?? oldY
      changes.push(
        `位置: (${oldX.toFixed(0)}, ${oldY.toFixed(0)}) → (${newX.toFixed(0)}, ${newY.toFixed(0)})`,
      )
    }

    // 检查大小变化
    if (
      (this.newValues.width !== undefined && this.oldValues.width !== undefined) ||
      (this.newValues.height !== undefined && this.oldValues.height !== undefined)
    ) {
      const oldWidth = this.oldValues.width ?? 0
      const oldHeight = this.oldValues.height ?? 0
      const newWidth = this.newValues.width ?? oldWidth
      const newHeight = this.newValues.height ?? oldHeight
      changes.push(
        `大小: ${oldWidth.toFixed(0)}×${oldHeight.toFixed(0)} → ${newWidth.toFixed(0)}×${newHeight.toFixed(0)}`,
      )
    }

    if (this.newValues.rotation !== undefined && this.oldValues.rotation !== undefined) {
      // 将弧度转换为角度显示
      const oldDegrees = ((this.oldValues.rotation * 180) / Math.PI).toFixed(1)
      const newDegrees = ((this.newValues.rotation * 180) / Math.PI).toFixed(1)
      changes.push(`旋转: ${oldDegrees}° → ${newDegrees}°`)
    }

    if (this.newValues.opacity !== undefined && this.oldValues.opacity !== undefined) {
      const oldOpacity = (this.oldValues.opacity * 100).toFixed(0)
      const newOpacity = (this.newValues.opacity * 100).toFixed(0)
      changes.push(`透明度: ${oldOpacity}% → ${newOpacity}%`)
    }

    if (this.newValues.zIndex !== undefined && this.oldValues.zIndex !== undefined) {
      changes.push(`层级: ${this.oldValues.zIndex} → ${this.newValues.zIndex}`)
    }

    if (this.newValues.duration !== undefined && this.oldValues.duration !== undefined) {
      changes.push(
        `时长: ${framesToTimecode(this.oldValues.duration)} → ${framesToTimecode(this.newValues.duration)}`,
      )
    }

    if (this.newValues.playbackRate !== undefined && this.oldValues.playbackRate !== undefined) {
      changes.push(
        `倍速: ${this.oldValues.playbackRate.toFixed(1)}x → ${this.newValues.playbackRate.toFixed(1)}x`,
      )
    }

    if (this.newValues.volume !== undefined && this.oldValues.volume !== undefined) {
      const oldVolumePercent = (this.oldValues.volume * 100).toFixed(0)
      const newVolumePercent = (this.newValues.volume * 100).toFixed(0)
      changes.push(`音量: ${oldVolumePercent}% → ${newVolumePercent}%`)
    }

    if (this.newValues.isMuted !== undefined && this.oldValues.isMuted !== undefined) {
      const oldMuteText = this.oldValues.isMuted ? '静音' : '有声'
      const newMuteText = this.newValues.isMuted ? '静音' : '有声'
      changes.push(`静音状态: ${oldMuteText} → ${newMuteText}`)
    }

    if (this.newValues.gain !== undefined && this.oldValues.gain !== undefined) {
      changes.push(
        `增益: ${this.oldValues.gain.toFixed(1)}dB → ${this.newValues.gain.toFixed(1)}dB`,
      )
    }

    const changeText = changes.length > 0 ? ` (${changes.join(', ')})` : ''
    return `更新变换属性: ${mediaName}${changeText}`
  }

  /**
   * 更新时间轴项目的时长
   * @param timelineItemId 时间轴项目ID
   * @param newDurationFrames 新的时长（帧数）
   */
  private updateTimelineItemDuration(timelineItemId: string, newDurationFrames: number): void {
    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) return

    const sprite = timelineItem.sprite
    if (!sprite) return

    const timeRange = sprite.getTimeRange()
    const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)

    if (!mediaItem) return

    // 直接使用帧数进行计算，timeRange中的时间已经是帧数
    const timelineStartFrames = timeRange.timelineStartTime
    const newTimelineEndFrames = timelineStartFrames + newDurationFrames
    const newTimelineEndTime = framesToMicroseconds(newTimelineEndFrames)

    if (isVideoTimelineItem(timelineItem)) {
      // 更新sprite的时间范围
      sprite.setTimeRange({
        clipStartTime: 'clipStartTime' in timeRange ? timeRange.clipStartTime || 0 : 0,
        clipEndTime: 'clipEndTime' in timeRange ? timeRange.clipEndTime || mediaItem.duration : mediaItem.duration,
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: newTimelineEndTime,
      })
    } else if (isAudioTimelineItem(timelineItem)) {
      // 更新sprite的时间范围
      sprite.setTimeRange({
        clipStartTime: 'clipStartTime' in timeRange ? timeRange.clipStartTime || 0 : 0,
        clipEndTime: 'clipEndTime' in timeRange ? timeRange.clipEndTime || mediaItem.duration : mediaItem.duration,
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: newTimelineEndTime,
      })
    } else if (isImageTimelineItem(timelineItem)) {
      // 对于图片，直接更新显示时长（使用帧数）
      sprite.setTimeRange({
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: newTimelineEndTime,
        displayDuration: newDurationFrames,
      })
    } else if (isTextTimelineItem(timelineItem)) {
      // 对于文本，与图片类似，直接更新显示时长（使用帧数）
      sprite.setTimeRange({
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: newTimelineEndTime,
        displayDuration: newDurationFrames,
      })
      console.log('📝 [UpdateTimelineItemDuration] 文本时长已更新:', {
        startTime: timeRange.timelineStartTime,
        endTime: newTimelineEndTime,
        duration: newDurationFrames,
      })
    }

    // 同步timeRange到TimelineItem
    timelineItem.timeRange = sprite.getTimeRange()

    // 如果有动画，需要重新设置WebAV动画时长
    if (timelineItem.animation && timelineItem.animation.isEnabled) {
      // 异步更新动画，不阻塞命令执行
      console.log('🎬 [Command] Timeline item has animation, but animation update is not yet implemented in unified architecture')
    }
  }
}

// ==================== 复制时间轴项目命令 ====================
/**
 * 复制时间轴项目命令
 * 支持复制已知和未知时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时删除复制的项目
 */
export class DuplicateTimelineItemCommand implements SimpleCommand {
    public readonly id: string
    public readonly description: string
    private originalTimelineItemData: UnifiedTimelineItemData<MediaTypeOrUnknown> | null = null // 保存原始项目的重建数据
    public readonly newTimelineItemId: string // 新创建的项目ID
  
    constructor(
      private originalTimelineItemId: string,
      originalTimelineItem: UnifiedTimelineItemData<MediaTypeOrUnknown>, // 支持已知和未知项目
      private newPositionFrames: number, // 新项目的时间位置（帧数）
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
      if (isKnownTimelineItem(originalTimelineItem)) {
        // 已知项目处理逻辑
        const mediaItem = this.mediaModule.getMediaItem(originalTimelineItem.mediaItemId)
        this.description = `复制时间轴项目: ${mediaItem?.name || '未知素材'}`
  
        // 保存原始项目的完整重建元数据
        this.originalTimelineItemData = TimelineItemFactory.clone(originalTimelineItem)
      } else if (isUnknownTimelineItem(originalTimelineItem)) {
        // 未知项目处理逻辑
        this.description = `复制未知处理项目: ${originalTimelineItem.config.name || '未知素材'}`
  
        // 保存未知项目的完整数据（使用 lodash 深拷贝避免引用问题）
        this.originalTimelineItemData = cloneDeep(originalTimelineItem)
      } else {
        throw new Error('不支持的时间轴项目类型')
      }
  
      // 生成新项目的ID
      this.newTimelineItemId = `timeline_item_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    }
  
    /**
     * 从原始素材重建复制的时间轴项目
     */
    private async rebuildDuplicatedItem(): Promise<UnifiedTimelineItemData<MediaTypeOrUnknown>> {
      if (this.originalTimelineItemData && isKnownTimelineItem(this.originalTimelineItemData)) {
        // 已知项目重建逻辑
        return this.rebuildKnownDuplicatedItem()
      } else if (this.originalTimelineItemData && isUnknownTimelineItem(this.originalTimelineItemData)) {
        // 未知项目重建逻辑
        return this.rebuildUnknownDuplicatedItem()
      } else {
        throw new Error('没有有效的时间轴项目数据')
      }
    }
  
    /**
     * 重建已知时间轴项目的复制
     */
    private async rebuildKnownDuplicatedItem(): Promise<KnownTimelineItem> {
      if (!this.originalTimelineItemData || !isKnownTimelineItem(this.originalTimelineItemData)) {
        throw new Error('已知时间轴项目数据不存在')
      }
  
      console.log('🔄 [DuplicateTimelineItemCommand] 重建已知时间轴项目...')
  
      // 1. 获取原始素材
      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      if (!mediaItem) {
        throw new Error(`找不到素材项目: ${this.originalTimelineItemData.mediaItemId}`)
      }
  
      // 确保素材已经解析完成
      if (!UnifiedMediaItemQueries.isReady(mediaItem)) {
        throw new Error('素材还在解析中，无法复制')
      }
  
      // 2. 从原始素材重新创建sprite
      const newSprite = await createSpriteFromUnifiedMediaItem(mediaItem)
  
      // 3. 设置时间范围（调整到新位置）
      const originalTimeRange = this.originalTimelineItemData.timeRange
      const originalDurationFrames = originalTimeRange.timelineEndTime - originalTimeRange.timelineStartTime
      const newTimelineStartTimeFrames = this.newPositionFrames
      const newTimelineEndTimeFrames = newTimelineStartTimeFrames + originalDurationFrames
  
      // 根据媒体类型设置时间范围
      if (isVideoTimelineItem(this.originalTimelineItemData) || isAudioTimelineItem(this.originalTimelineItemData)) {
        newSprite.setTimeRange({
          clipStartTime: 'clipStartTime' in originalTimeRange ? originalTimeRange.clipStartTime || 0 : 0,
          clipEndTime: 'clipEndTime' in originalTimeRange ? originalTimeRange.clipEndTime || mediaItem.duration : mediaItem.duration,
          timelineStartTime: newTimelineStartTimeFrames,
          timelineEndTime: newTimelineEndTimeFrames,
        })
      } else {
        // 图片和文本类型
        newSprite.setTimeRange({
          timelineStartTime: newTimelineStartTimeFrames,
          timelineEndTime: newTimelineEndTimeFrames,
          displayDuration: newTimelineEndTimeFrames - newTimelineStartTimeFrames,
        })
      }
  
      // 4. 应用变换属性
      if (hasVisualProperties(this.originalTimelineItemData)) {
        const config = this.originalTimelineItemData.config as any // 临时类型断言
        
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
        id: this.newTimelineItemId,
        mediaItemId: this.originalTimelineItemData.mediaItemId,
        trackId: this.originalTimelineItemData.trackId,
        mediaType: this.originalTimelineItemData.mediaType,
        timeRange: newSprite.getTimeRange(),
        sprite: markRaw(newSprite),
        config: { ...this.originalTimelineItemData.config },
        animation: this.originalTimelineItemData.animation
          ? { ...this.originalTimelineItemData.animation }
          : undefined,
        timelineStatus: 'ready' as TimelineItemStatus
      }) as KnownTimelineItem
  
      // 6. 重新生成缩略图（异步执行，不阻塞重建过程）
      this.regenerateThumbnailForDuplicatedItem(newTimelineItem, mediaItem)
  
      console.log('✅ [DuplicateTimelineItemCommand] 已知时间轴项目重建完成')
      return newTimelineItem
    }
  
    /**
     * 重建未知处理时间轴项目的复制
     */
    private rebuildUnknownDuplicatedItem(): UnknownTimelineItem {
      if (!this.originalTimelineItemData || !isUnknownTimelineItem(this.originalTimelineItemData)) {
        throw new Error('未知时间轴项目数据不存在')
      }
  
      console.log('🔄 [DuplicateTimelineItemCommand] 重建未知处理时间轴项目...')
  
      // 使用 lodash 深拷贝确保完全独立的数据副本
      const newUnknownTimelineItem: UnknownTimelineItem = cloneDeep(
        this.originalTimelineItemData,
      )
  
      // 更新新项目的属性
      // 注意：在统一架构中，我们需要创建一个新的对象而不是修改只读属性
      const updatedUnknownTimelineItem: UnknownTimelineItem = {
        ...newUnknownTimelineItem,
        id: this.newTimelineItemId,
        timeRange: {
          ...newUnknownTimelineItem.timeRange,
          timelineStartTime: this.newPositionFrames,
          timelineEndTime: this.newPositionFrames +
            (this.originalTimelineItemData.timeRange.timelineEndTime - this.originalTimelineItemData.timeRange.timelineStartTime)
        }
      }
  
      console.log('🔄 重建未知处理时间轴项目完成:', {
        id: newUnknownTimelineItem.id,
        mediaType: newUnknownTimelineItem.mediaType,
        mediaItemId: newUnknownTimelineItem.mediaItemId,
        timeRange: newUnknownTimelineItem.timeRange,
      })
  
      return updatedUnknownTimelineItem
    }
  
    /**
     * 执行命令：创建复制的时间轴项目
     * 遵循"从源头重建"原则，从原始素材完全重新创建
     */
    async execute(): Promise<void> {
      try {
        console.log(`🔄 执行复制操作：从源头重建时间轴项目...`)
  
        // 从原始素材重新创建复制的TimelineItem和sprite
        const newTimelineItem = await this.rebuildDuplicatedItem()
  
        // 1. 添加到时间轴
        this.timelineModule.addTimelineItem(newTimelineItem)
  
        if (isKnownTimelineItem(newTimelineItem)) {
          // 已知项目处理逻辑
          // 2. 添加sprite到WebAV画布
          if (newTimelineItem.sprite) {
            await this.webavModule.addSprite(newTimelineItem.sprite)
          }
  
          console.log(
            `✅ 已复制已知时间轴项目: ${this.originalTimelineItemData?.mediaItemId || '未知素材'}`,
          )
        } else if (isUnknownTimelineItem(newTimelineItem)) {
          // 未知项目处理逻辑（不需要添加sprite）
          console.log(`✅ 已复制未知处理时间轴项目: ${newTimelineItem.config.name || '未知素材'}`)
        }
      } catch (error) {
        const itemName = this.originalTimelineItemData?.mediaItemId ||
          (this.originalTimelineItemData && isUnknownTimelineItem(this.originalTimelineItemData) ?
            this.originalTimelineItemData.config.name : '未知项目')
        console.error(`❌ 复制时间轴项目失败: ${itemName}`, error)
        throw error
      }
    }
  
    /**
     * 撤销命令：删除复制的时间轴项目
     */
    async undo(): Promise<void> {
      try {
        console.log(`🔄 撤销复制操作：删除复制的时间轴项目...`)
  
        // 删除复制的时间轴项目
        this.timelineModule.removeTimelineItem(this.newTimelineItemId)
  
        if (this.originalTimelineItemData && isKnownTimelineItem(this.originalTimelineItemData)) {
          // 已知项目撤销日志
          const mediaItem = this.mediaModule.getMediaItem(
            this.originalTimelineItemData.mediaItemId,
          )
          console.log(`↩️ 已撤销复制已知时间轴项目: ${mediaItem?.name || '未知素材'}`)
        } else if (this.originalTimelineItemData && isUnknownTimelineItem(this.originalTimelineItemData)) {
          // 未知项目撤销日志
          console.log(
            `↩️ 已撤销复制未知处理时间轴项目: ${this.originalTimelineItemData.config.name || '未知素材'}`,
          )
        }
      } catch (error) {
        const itemName = this.originalTimelineItemData?.mediaItemId ||
          (this.originalTimelineItemData && isUnknownTimelineItem(this.originalTimelineItemData) ?
            this.originalTimelineItemData.config.name : '未知项目')
        console.error(`❌ 撤销复制时间轴项目失败: ${itemName}`, error)
        throw error
      }
    }
  
    /**
     * 为复制的项目重新生成缩略图
     * @param timelineItem 复制的时间轴项目
     * @param mediaItem 对应的媒体项目
     */
    private async regenerateThumbnailForDuplicatedItem(
      timelineItem: KnownTimelineItem,
      mediaItem: UnifiedMediaItemData,
    ) {
      // 音频不需要缩略图
      if (mediaItem.mediaType === 'audio') {
        console.log('🎵 音频不需要缩略图，跳过生成')
        return
      }
  
      try {
        console.log('🖼️ 开始为复制的项目重新生成缩略图...')
  
        const thumbnailUrl = await regenerateThumbnailForUnifiedTimelineItem(timelineItem, mediaItem)
  
        if (thumbnailUrl) {
          // 在新架构中，缩略图可能存储在不同的位置
          // 这里暂时保留原有逻辑，需要根据实际实现调整
          console.log('✅ 复制项目缩略图生成完成')
        }
      } catch (error) {
        console.error('❌ 复制项目缩略图生成失败:', error)
      }
    }
  }

// ==================== 分割时间轴项目命令 ====================
/**
 * 分割时间轴项目命令
 * 支持分割已知时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始素材重新创建
 */
export class SplitTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: UnifiedTimelineItemData<MediaTypeOrUnknown> // 保存原始项目的重建数据
  private firstItemId: string // 分割后第一个项目的ID
  private secondItemId: string // 分割后第二个项目的ID

  constructor(
    private originalTimelineItemId: string,
    originalTimelineItem: UnifiedTimelineItemData<MediaTypeOrUnknown>, // 要分割的原始时间轴项目
    private splitTimeFrames: number, // 分割时间点（帧数）
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
    if (isKnownTimelineItem(originalTimelineItem)) {
      // 已知项目处理逻辑
      const mediaItem = this.mediaModule.getMediaItem(originalTimelineItem.mediaItemId)
      this.description = `分割时间轴项目: ${mediaItem?.name || '未知素材'} (在 ${framesToTimecode(splitTimeFrames)})`

      // 保存原始项目的完整重建元数据
      this.originalTimelineItemData = TimelineItemFactory.clone(originalTimelineItem)
    } else if (isUnknownTimelineItem(originalTimelineItem)) {
      // 未知项目处理逻辑
      this.description = `分割未知处理项目: ${originalTimelineItem.config.name || '未知素材'} (在 ${framesToTimecode(splitTimeFrames)})`

      // 保存未知项目的完整数据（使用 lodash 深拷贝避免引用问题）
      this.originalTimelineItemData = cloneDeep(originalTimelineItem)
    } else {
      throw new Error('不支持的时间轴项目类型')
    }

    // 生成分割后项目的ID
    this.firstItemId = `timeline_item_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    this.secondItemId = `timeline_item_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    console.log('💾 保存分割项目的重建数据:', {
      originalId: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      mediaType: this.originalTimelineItemData.mediaType,
      splitTimeFrames: this.splitTimeFrames,
      timeRange: this.originalTimelineItemData.timeRange,
      firstItemId: this.firstItemId,
      secondItemId: this.secondItemId,
    })
  }

  /**
   * 从原始素材重建分割后的两个sprite和timelineItem
   * 遵循"从源头重建"原则，每次都完全重新创建
   */
  private async rebuildSplitItems(): Promise<{
    firstItem: UnifiedTimelineItemData<MediaTypeOrUnknown>
    secondItem: UnifiedTimelineItemData<MediaTypeOrUnknown>
  }> {
    console.log('🔄 开始从源头重建分割后的时间轴项目...')

    // 1. 获取原始素材
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`原始素材不存在: ${this.originalTimelineItemData.mediaItemId}`)
    }

    // 检查素材是否已准备好并且是支持分割的类型
    if (!UnifiedMediaItemQueries.isReady(mediaItem)) {
      throw new Error(`素材尚未解析完成: ${mediaItem.name}`)
    }

    // 2. 计算分割点的时间信息（直接使用帧数）
    const originalTimeRange = this.originalTimelineItemData.timeRange
    const timelineStartTimeFrames = originalTimeRange.timelineStartTime
    const timelineEndTimeFrames = originalTimeRange.timelineEndTime
    const splitTimeFrames = this.splitTimeFrames // 分割时间点（帧数）

    // 计算分割点在素材中的相对位置（使用帧数）
    const timelineDurationFrames = timelineEndTimeFrames - timelineStartTimeFrames
    const relativeTimelineFrames = splitTimeFrames - timelineStartTimeFrames
    const relativeRatio = relativeTimelineFrames / timelineDurationFrames

    // 3. 从原始素材重新创建两个sprite
    const firstSprite = await createSpriteFromUnifiedMediaItem(mediaItem)
    const secondSprite = await createSpriteFromUnifiedMediaItem(mediaItem)

    // 4. 设置时间范围
    if ('clipStartTime' in originalTimeRange) {
      // 视频和音频类型（使用 clipStartTime 和 clipEndTime）
      const videoTimeRange = originalTimeRange as VideoTimeRange
      const clipStartTimeFrames = videoTimeRange.clipStartTime || 0
      const clipEndTimeFrames = videoTimeRange.clipEndTime || mediaItem.duration || 0
      const clipDurationFrames = clipEndTimeFrames - clipStartTimeFrames
      const splitClipTimeFrames = clipStartTimeFrames + Math.round(clipDurationFrames * relativeRatio)

      firstSprite.setTimeRange({
        clipStartTime: clipStartTimeFrames,
        clipEndTime: splitClipTimeFrames,
        timelineStartTime: timelineStartTimeFrames,
        timelineEndTime: splitTimeFrames,
      })

      secondSprite.setTimeRange({
        clipStartTime: splitClipTimeFrames,
        clipEndTime: clipEndTimeFrames,
        timelineStartTime: splitTimeFrames,
        timelineEndTime: timelineEndTimeFrames,
      })
    } else {
      // 图片和文本类型（使用 displayDuration）
      const imageTimeRange = originalTimeRange as ImageTimeRange
      const displayDuration = imageTimeRange.displayDuration || timelineDurationFrames
      const firstDisplayDuration = Math.round(displayDuration * relativeRatio)
      const secondDisplayDuration = displayDuration - firstDisplayDuration

      firstSprite.setTimeRange({
        timelineStartTime: timelineStartTimeFrames,
        timelineEndTime: splitTimeFrames,
        displayDuration: firstDisplayDuration,
      })

      secondSprite.setTimeRange({
        timelineStartTime: splitTimeFrames,
        timelineEndTime: timelineEndTimeFrames,
        displayDuration: secondDisplayDuration,
      })
    }

    // 5. 应用变换属性
    if (hasVisualProperties(this.originalTimelineItemData)) {
      const config = this.originalTimelineItemData.config as any // 临时类型断言
      
      // 应用到第一个sprite
      if (config.x !== undefined) firstSprite.rect.x = config.x
      if (config.y !== undefined) firstSprite.rect.y = config.y
      if (config.width !== undefined) firstSprite.rect.w = config.width
      if (config.height !== undefined) firstSprite.rect.h = config.height
      if (config.rotation !== undefined) firstSprite.rect.angle = config.rotation
      if (config.opacity !== undefined) firstSprite.opacity = config.opacity
      
      // 应用到第二个sprite
      if (config.x !== undefined) secondSprite.rect.x = config.x
      if (config.y !== undefined) secondSprite.rect.y = config.y
      if (config.width !== undefined) secondSprite.rect.w = config.width
      if (config.height !== undefined) secondSprite.rect.h = config.height
      if (config.rotation !== undefined) secondSprite.rect.angle = config.rotation
      if (config.opacity !== undefined) secondSprite.opacity = config.opacity
    }
    
    // 安全地获取 zIndex，所有媒体类型的配置都应该有 zIndex 属性
    const config = this.originalTimelineItemData.config as BaseMediaProps
    firstSprite.zIndex = config.zIndex
    secondSprite.zIndex = config.zIndex

    // 6. 创建新的TimelineItem
    const firstItem = reactive({
      id: this.firstItemId,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: firstSprite.getTimeRange(),
      sprite: markRaw(firstSprite),
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation
        ? { ...this.originalTimelineItemData.animation }
        : undefined,
      timelineStatus: 'ready' as TimelineItemStatus
    }) as KnownTimelineItem

    const secondItem = reactive({
      id: this.secondItemId,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: secondSprite.getTimeRange(),
      sprite: markRaw(secondSprite),
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation
        ? { ...this.originalTimelineItemData.animation }
        : undefined,
      timelineStatus: 'ready' as TimelineItemStatus
    }) as KnownTimelineItem

    // 7. 重新生成缩略图（异步执行，不阻塞重建过程）
    this.regenerateThumbnailsForSplitItems(firstItem, secondItem, mediaItem)

    console.log('🔄 重建分割项目完成:', {
      firstItemId: firstItem.id,
      secondItemId: secondItem.id,
      splitTimeFrames: this.splitTimeFrames,
      firstTimeRange: firstItem.timeRange,
      secondTimeRange: secondItem.timeRange,
    })

    return { firstItem, secondItem }
  }

  /**
   * 从原始素材重建原始项目
   * 用于撤销分割操作
   */
  private async rebuildOriginalItem(): Promise<UnifiedTimelineItemData<MediaTypeOrUnknown>> {
    console.log('🔄 开始从源头重建原始时间轴项目...')

    // 1. 获取原始素材
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`原始素材不存在: ${this.originalTimelineItemData.mediaItemId}`)
    }

    // 确保素材已准备好
    if (!UnifiedMediaItemQueries.isReady(mediaItem)) {
      throw new Error(`素材尚未解析完成: ${mediaItem.name}`)
    }

    // 2. 从原始素材重新创建sprite
    const newSprite = await createSpriteFromUnifiedMediaItem(mediaItem)

    // 3. 设置原始时间范围
    newSprite.setTimeRange(this.originalTimelineItemData.timeRange)

    // 4. 应用变换属性
    if (hasVisualProperties(this.originalTimelineItemData)) {
      const config = this.originalTimelineItemData.config as any // 临时类型断言
      
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

    // 5. 创建新的TimelineItem
    const newTimelineItem = reactive({
      id: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: newSprite.getTimeRange(),
      sprite: markRaw(newSprite),
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation
        ? { ...this.originalTimelineItemData.animation }
        : undefined,
      timelineStatus: 'ready' as TimelineItemStatus
    }) as KnownTimelineItem

    // 6. 重新生成缩略图（异步执行，不阻塞重建过程）
    this.regenerateThumbnailForOriginalItem(newTimelineItem, mediaItem)

    console.log('🔄 重建原始项目完成:', {
      id: newTimelineItem.id,
      mediaType: mediaItem.mediaType,
      timeRange: this.originalTimelineItemData.timeRange,
    })

    return newTimelineItem
  }

  /**
   * 执行命令：分割时间轴项目
   */
  async execute(): Promise<void> {
    try {
      // 检查原始项目是否存在
      const originalItem = this.timelineModule.getTimelineItem(this.originalTimelineItemId)
      if (!originalItem) {
        console.warn(`⚠️ 原始时间轴项目不存在，无法分割: ${this.originalTimelineItemId}`)
        return
      }

      // 从原始素材重新创建分割后的两个项目
      const { firstItem, secondItem } = await this.rebuildSplitItems()

      // 1. 删除原始项目
      this.timelineModule.removeTimelineItem(this.originalTimelineItemId)

      // 2. 添加分割后的两个项目
      this.timelineModule.addTimelineItem(firstItem)
      this.timelineModule.addTimelineItem(secondItem)

      // 3. 添加sprite到WebAV画布
      if (isKnownTimelineItem(firstItem) && firstItem.sprite) {
        await this.webavModule.addSprite(firstItem.sprite)
      }
      if (isKnownTimelineItem(secondItem) && secondItem.sprite) {
        await this.webavModule.addSprite(secondItem.sprite)
      }

      const mediaItem = this.mediaModule.getMediaItem(
        this.originalTimelineItemData.mediaItemId,
      )
      console.log(
        `🔪 已分割时间轴项目: ${mediaItem?.name || '未知素材'} 在 ${framesToTimecode(this.splitTimeFrames)}`,
      )
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(
        this.originalTimelineItemData.mediaItemId,
      )
      console.error(`❌ 分割时间轴项目失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复原始项目，删除分割后的项目
   * 遵循"从源头重建"原则，从原始素材完全重新创建
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销分割操作：重建原始时间轴项目...`)

      // 1. 删除分割后的两个项目
      this.timelineModule.removeTimelineItem(this.firstItemId)
      this.timelineModule.removeTimelineItem(this.secondItemId)

      // 2. 从原始素材重新创建原始项目
      const originalItem = await this.rebuildOriginalItem()

      // 3. 添加原始项目到时间轴
      this.timelineModule.addTimelineItem(originalItem)

      // 4. 添加sprite到WebAV画布
      if (isKnownTimelineItem(originalItem) && originalItem.sprite) {
        await this.webavModule.addSprite(originalItem.sprite)
      }

      const mediaItem = this.mediaModule.getMediaItem(
        this.originalTimelineItemData.mediaItemId,
      )
      console.log(`↩️ 已撤销分割时间轴项目: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(
        this.originalTimelineItemData.mediaItemId,
      )
      console.error(`❌ 撤销分割时间轴项目失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }

  /**
   * 为重建的原始项目重新生成缩略图
   * @param timelineItem 重建的时间轴项目
   * @param mediaItem 对应的媒体项目
   */
  private async regenerateThumbnailForOriginalItem(
    timelineItem: KnownTimelineItem,
    mediaItem: UnifiedMediaItemData,
  ) {
    // 音频不需要缩略图
    if (mediaItem.mediaType === 'audio') {
      console.log('🎵 音频不需要缩略图，跳过生成')
      return
    }

    try {
      console.log('🖼️ 开始为重建的原始项目重新生成缩略图...')

      const thumbnailUrl = await regenerateThumbnailForUnifiedTimelineItem(timelineItem, mediaItem)

      if (thumbnailUrl) {
        // 在新架构中，缩略图可能存储在不同的位置
        // 这里暂时保留原有逻辑，需要根据实际实现调整
        console.log('✅ 重建原始项目缩略图生成完成')
      }
    } catch (error) {
      console.error('❌ 重建原始项目缩略图生成失败:', error)
    }
  }

  /**
   * 为分割后的两个项目重新生成缩略图
   * @param firstItem 第一个分割片段
   * @param secondItem 第二个分割片段
   * @param mediaItem 对应的媒体项目
   */
  private async regenerateThumbnailsForSplitItems(
    firstItem: KnownTimelineItem,
    secondItem: KnownTimelineItem,
    mediaItem: UnifiedMediaItemData,
  ) {
    // 音频不需要缩略图
    if (mediaItem.mediaType === 'audio') {
      console.log('🎵 音频不需要缩略图，跳过生成')
      return
    }

    try {
      console.log('🖼️ 开始为分割后的项目重新生成缩略图...')

      // 为第一个片段生成缩略图
      const firstThumbnailUrl = await regenerateThumbnailForUnifiedTimelineItem(firstItem, mediaItem)
      if (firstThumbnailUrl) {
        console.log('✅ 第一个分割片段缩略图生成完成')
      }

      // 为第二个片段生成缩略图
      const secondThumbnailUrl = await regenerateThumbnailForUnifiedTimelineItem(secondItem, mediaItem)
      if (secondThumbnailUrl) {
        console.log('✅ 第二个分割片段缩略图生成完成')
      }
    } catch (error) {
      console.error('❌ 分割项目缩略图生成失败:', error)
    }
  }
}

// ==================== 添加轨道命令 ====================
/**
 * 添加轨道命令
 * 支持添加轨道的撤销/重做操作
 * 采用简单的添加/删除逻辑，不涉及WebAV对象重建
 */
export class AddTrackCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private newTrackId: string = '' // 新创建的轨道ID
  private trackData: UnifiedTrackData // 保存轨道数据

  constructor(
    private trackType: UnifiedTrackType, // 轨道类型
    private trackName: string | undefined, // 轨道名称（可选）
    private position: number | undefined, // 插入位置（可选）
    private trackModule: {
      addTrack: (type: UnifiedTrackType, name?: string, position?: number) => UnifiedTrackData
      removeTrack: (
        trackId: string,
        timelineItems: Ref<UnifiedTimelineItemData<MediaTypeOrUnknown>[]>,
        removeTimelineItemCallback?: (id: string) => void,
      ) => void
      getTrack: (trackId: string) => UnifiedTrackData | undefined
    },
  ) {
    this.id = generateCommandId()
    this.description = `添加轨道: ${trackName || `${trackType}轨道`}${position !== undefined ? ` (位置: ${position})` : ''}`

    // 预先计算新轨道ID（模拟trackModule的逻辑）
    // 注意：这里我们无法直接访问tracks数组，所以在execute时会获取实际的轨道数据
    this.newTrackId = '' // 将在execute时设置
    this.trackData = {
      id: '',
      name: '',
      type: trackType,
      isVisible: true,
      isMuted: false,
      height: 80,
    }
  }
  

  /**
   * 获取新创建的轨道ID
   */
  get createdTrackId(): string {
    return this.newTrackId
  }

  /**
   * 执行命令：添加轨道
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行添加轨道操作...`)

      // 调用trackModule的addTrack方法，传入位置参数
      const newTrack = this.trackModule.addTrack(this.trackType, this.trackName, this.position)

      // 保存轨道数据用于撤销
      this.newTrackId = newTrack.id
      this.trackData = { ...newTrack }

      console.log(
        `✅ 已添加轨道: ${newTrack.name} (ID: ${newTrack.id}, 类型: ${newTrack.type}, 位置: ${this.position ?? '末尾'})`,
      )
    } catch (error) {
      console.error(`❌ 添加轨道失败: ${this.trackName || `${this.trackType}轨道`}`, error)
      throw error
    }
    
  }

  /**
   * 撤销命令：删除添加的轨道
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销添加轨道操作：删除轨道 ${this.trackData.name}...`)

      // 删除添加的轨道
      // 注意：这里传入空的timelineItems和回调，因为新添加的轨道上不应该有任何项目
      this.trackModule.removeTrack(this.newTrackId, ref([]), undefined)

      console.log(`↩️ 已撤销添加轨道: ${this.trackData.name}`)
    } catch (error) {
      console.error(`❌ 撤销添加轨道失败: ${this.trackData.name}`, error)
      throw error
    }
  }
}

// ==================== 重命名轨道命令 ====================
/**
 * 重命名轨道命令
 * 支持重命名轨道的撤销/重做操作
 * 采用简单的名称修改逻辑，不涉及WebAV对象重建
 */
export class RenameTrackCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private oldName: string = '' // 保存原始名称用于撤销

  constructor(
    private trackId: string,
    private newName: string,
    private trackModule: {
      renameTrack: (trackId: string, newName: string) => void
      getTrack: (trackId: string) => UnifiedTrackData | undefined
    },
  ) {
    this.id = generateCommandId()
    this.description = `重命名轨道: ${newName}`

    // 获取当前轨道名称用于撤销
    const track = this.trackModule.getTrack(trackId)
    this.oldName = track?.name || ''
  }

  /**
   * 执行命令：重命名轨道
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行重命名轨道操作: ${this.oldName} -> ${this.newName}...`)

      // 检查轨道是否存在
      const track = this.trackModule.getTrack(this.trackId)
      if (!track) {
        throw new Error(`轨道不存在: ${this.trackId}`)
      }

      // 检查新名称是否有效
      if (!this.newName.trim()) {
        throw new Error('轨道名称不能为空')
      }

      // 调用trackModule的renameTrack方法
      this.trackModule.renameTrack(this.trackId, this.newName)

      console.log(`✅ 已重命名轨道: ${this.oldName} -> ${this.newName}`)
    } catch (error) {
      console.error(`❌ 重命名轨道失败: ${this.oldName} -> ${this.newName}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复原始轨道名称
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销重命名轨道操作：恢复名称 ${this.newName} -> ${this.oldName}...`)

      // 检查轨道是否存在
      const track = this.trackModule.getTrack(this.trackId)
      if (!track) {
        throw new Error(`轨道不存在: ${this.trackId}`)
      }

      // 恢复原始名称
      this.trackModule.renameTrack(this.trackId, this.oldName)

      console.log(`↩️ 已撤销重命名轨道: ${this.newName} -> ${this.oldName}`)
    } catch (error) {
      console.error(`❌ 撤销重命名轨道失败: ${this.newName} -> ${this.oldName}`, error)
      throw error
    }
  }
}
// ==================== 删除轨道命令 ====================
/**
 * 删除轨道命令
 * 支持删除轨道的撤销/重做操作，兼容已知和未知时间轴项目
 * 遵循"从源头重建"原则：保存轨道信息和所有受影响的时间轴项目信息，撤销时完全重建
 */
export class RemoveTrackCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private trackData: UnifiedTrackData // 保存被删除的轨道数据
  private affectedKnownTimelineItems: UnifiedTimelineItemData<MediaType>[] = [] // 保存被删除的已知时间轴项目的重建元数据
  private affectedUnknownTimelineItems: UnifiedTimelineItemData<'unknown'>[] = [] // 保存被删除的未知时间轴项目的完整数据

  constructor(
    private trackId: string,
    private trackModule: {
      addTrack: (type: UnifiedTrackType, name?: string) => UnifiedTrackData
      removeTrack: (
        trackId: string,
        timelineItems: Ref<UnifiedTimelineItemData<MediaTypeOrUnknown>[]>,
        removeTimelineItemCallback?: (id: string) => void,
      ) => void
      getTrack: (trackId: string) => UnifiedTrackData | undefined
      tracks: { value: UnifiedTrackData[] }
    },
    private timelineModule: {
      addTimelineItem: (item: UnifiedTimelineItemData<MediaTypeOrUnknown>) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
      timelineItems: { value: UnifiedTimelineItemData<MediaTypeOrUnknown>[] }
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

    // 获取要删除的轨道信息
    const track = this.trackModule.getTrack(trackId)
    if (!track) {
      throw new Error(`找不到要删除的轨道: ${trackId}`)
    }

    this.trackData = { ...track }
    this.description = `删除轨道: ${track.name}`

    // 保存该轨道上所有时间轴项目的重建元数据
    const affectedItems = this.timelineModule.timelineItems.value.filter(
      (item) => item.trackId === trackId,
    )

    // 分别处理已知和未知项目
    for (const item of affectedItems) {
      if (isKnownTimelineItem(item)) {
        this.affectedKnownTimelineItems.push(TimelineItemFactory.clone(item))
      } else if (isUnknownTimelineItem(item)) {
        this.affectedUnknownTimelineItems.push(cloneDeep(item))
      }
    }

    console.log(
      `📋 准备删除轨道: ${track.name}, 受影响的项目: ${this.affectedKnownTimelineItems.length}个已知项目, ${this.affectedUnknownTimelineItems.length}个未知项目`,
    )
  }

  /**
   * 从原始素材重建时间轴项目
   */
  private async rebuildTimelineItem(itemData: UnifiedTimelineItemData<MediaType>): Promise<KnownTimelineItem> {
    // 特殊处理文本类型的时间轴项目
    if (itemData.mediaType === 'text') {
      return await this.rebuildTextTimelineItem(itemData as UnifiedTimelineItemData<'text'>)
    }

    const mediaItem = this.mediaModule.getMediaItem(itemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`找不到素材项目: ${itemData.mediaItemId}`)
    }

    // 确保素材已经解析完成
    if (!UnifiedMediaItemQueries.isReady(mediaItem)) {
      throw new Error('素材还在解析中，无法重建')
    }

    // 从原始素材重新创建sprite
    const newSprite = await createSpriteFromUnifiedMediaItem(mediaItem)

    // 设置时间范围
    newSprite.setTimeRange(itemData.timeRange)

    // 应用变换属性
    if (hasVisualProperties(itemData)) {
      const config = itemData.config as any // 临时类型断言
      
      if (config.x !== undefined) newSprite.rect.x = config.x
      if (config.y !== undefined) newSprite.rect.y = config.y
      if (config.width !== undefined) newSprite.rect.w = config.width
      if (config.height !== undefined) newSprite.rect.h = config.height
      if (config.rotation !== undefined) newSprite.rect.angle = config.rotation
      if (config.opacity !== undefined) newSprite.opacity = config.opacity
    }
    
    // 安全地获取 zIndex，所有媒体类型的配置都应该有 zIndex 属性
    const config = itemData.config as BaseMediaProps
    newSprite.zIndex = config.zIndex

    // 创建新的TimelineItem
    const newTimelineItem = reactive({
      id: itemData.id,
      mediaItemId: itemData.mediaItemId,
      trackId: itemData.trackId,
      mediaType: itemData.mediaType,
      timeRange: newSprite.getTimeRange(),
      sprite: markRaw(newSprite),
      config: { ...itemData.config },
      animation: itemData.animation ? { ...itemData.animation } : undefined,
      timelineStatus: 'ready' as TimelineItemStatus
    }) as KnownTimelineItem

    return newTimelineItem
  }

  /**
   * 重建文本时间轴项目
   */
  private async rebuildTextTimelineItem(
    itemData: UnifiedTimelineItemData<'text'>,
  ): Promise<KnownTimelineItem> {
    console.log('🔄 [RemoveTrackCommand] 重建文本时间轴项目...')

    // 从保存的配置中获取文本内容和样式
    const textConfig = itemData.config as TextMediaConfig
    const text = textConfig.text
    const style = textConfig.style

    console.log('📝 [RemoveTrackCommand] 文本重建参数:', {
      text: text.substring(0, 20) + '...',
      style,
      timeRange: itemData.timeRange,
    })

    // 动态导入TextVisibleSprite
    const { TextVisibleSprite } = await import('../../../utils/TextVisibleSprite')

    // 重新创建文本精灵
    const newSprite = await TextVisibleSprite.create(text, style)

    // 设置时间范围
    newSprite.setTimeRange(itemData.timeRange)

    // 设置变换属性
    const rect = newSprite.rect
    rect.x = textConfig.x
    rect.y = textConfig.y
    rect.w = textConfig.width
    rect.h = textConfig.height
    rect.angle = textConfig.rotation
    newSprite.opacity = textConfig.opacity

    // 设置其他属性
    newSprite.zIndex = textConfig.zIndex

    // 创建新的TimelineItem
    const newTimelineItem = reactive({
      id: itemData.id,
      mediaItemId: '', // 文本项目不需要媒体库项目
      trackId: itemData.trackId,
      mediaType: 'text',
      timeRange: { ...itemData.timeRange },
      sprite: markRaw(newSprite),
      config: { ...itemData.config },
      animation: itemData.animation ? { ...itemData.animation } : undefined,
      timelineStatus: 'ready' as TimelineItemStatus
    }) as KnownTimelineItem

    console.log('✅ [RemoveTrackCommand] 文本时间轴项目重建完成')
    return newTimelineItem
  }

  /**
   * 执行命令：删除轨道及其上的所有时间轴项目
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行删除轨道操作: ${this.trackData.name}...`)

      // 检查是否为最后一个轨道
      if (this.trackModule.tracks.value.length <= 1) {
        throw new Error('不能删除最后一个轨道')
      }

      // 检查轨道是否存在
      const track = this.trackModule.getTrack(this.trackId)
      if (!track) {
        console.warn(`⚠️ 轨道不存在，无法删除: ${this.trackId}`)
        return
      }

      // 删除轨道（这会自动删除轨道上的所有时间轴项目）
      this.trackModule.removeTrack(
        this.trackId,
        ref(this.timelineModule.timelineItems.value),
        this.timelineModule.removeTimelineItem,
      )

      const totalAffectedItems =
        this.affectedKnownTimelineItems.length + this.affectedUnknownTimelineItems.length
      console.log(
        `✅ 已删除轨道: ${this.trackData.name}, 删除了 ${totalAffectedItems} 个时间轴项目 (${this.affectedKnownTimelineItems.length}个已知项目, ${this.affectedUnknownTimelineItems.length}个未知项目)`,
      )
    } catch (error) {
      console.error(`❌ 删除轨道失败: ${this.trackData.name}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：重建轨道和所有受影响的时间轴项目
   * 遵循"从源头重建"原则，从原始素材完全重新创建所有项目
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销删除轨道操作：重建轨道 ${this.trackData.name}...`)

      // 1. 重建轨道
      // 注意：我们需要手动重建轨道，保持原有的ID和属性
      // 找到正确的插入位置（按ID排序）
      const tracks = this.trackModule.tracks.value
      const insertIndex = tracks.findIndex((track) => track.id > this.trackData.id)
      if (insertIndex === -1) {
        tracks.push({ ...this.trackData })
      } else {
        tracks.splice(insertIndex, 0, { ...this.trackData })
      }

      // 2. 重建所有受影响的已知时间轴项目
      for (const itemData of this.affectedKnownTimelineItems) {
        console.log(`🔄 重建已知时间轴项目: ${itemData.id}`)

        const newTimelineItem = await this.rebuildTimelineItem(itemData)

        // 添加到时间轴
        this.timelineModule.addTimelineItem(newTimelineItem)

        // 添加sprite到WebAV画布
        if (newTimelineItem.sprite) {
          await this.webavModule.addSprite(newTimelineItem.sprite)
        }
      }

      // 3. 重建所有受影响的未知时间轴项目
      for (const asyncItem of this.affectedUnknownTimelineItems) {
        console.log(`🔄 重建未知处理时间轴项目: ${asyncItem.id}`)

        // 未知项目不需要重建sprite，直接添加到时间轴
        this.timelineModule.addTimelineItem(asyncItem)
      }

      const totalAffectedItems =
        this.affectedKnownTimelineItems.length + this.affectedUnknownTimelineItems.length
      console.log(
        `↩️ 已撤销删除轨道: ${this.trackData.name}, 恢复了 ${totalAffectedItems} 个时间轴项目 (${this.affectedKnownTimelineItems.length}个已知项目, ${this.affectedUnknownTimelineItems.length}个未知项目)`,
      )
    } catch (error) {
      console.error(`❌ 撤销删除轨道失败: ${this.trackData.name}`, error)
      throw error
    }
  }
}

// ==================== 切换轨道可见性命令 ====================
/**
 * 切换轨道可见性命令
 * 支持切换轨道可见性的撤销/重做操作
 * 同时同步该轨道上所有时间轴项目的sprite可见性
 */
export class ToggleTrackVisibilityCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private previousVisibility: boolean // 保存切换前的可见性状态

  constructor(
    private trackId: string,
    private trackModule: {
      getTrack: (trackId: string) => UnifiedTrackData | undefined
      toggleTrackVisibility: (
        trackId: string,
        timelineItems?: Ref<UnifiedTimelineItemData<MediaTypeOrUnknown>[]>,
      ) => void
    },
    private timelineModule: {
      timelineItems: { value: UnifiedTimelineItemData<MediaTypeOrUnknown>[] }
    },
  ) {
    this.id = generateCommandId()

    // 获取轨道信息
    const track = this.trackModule.getTrack(trackId)
    if (!track) {
      throw new Error(`找不到轨道: ${trackId}`)
    }

    this.previousVisibility = track.isVisible
    this.description = `${track.isVisible ? '隐藏' : '显示'}轨道: ${track.name}`

    console.log(
      `📋 准备切换轨道可见性: ${track.name}, 当前状态: ${track.isVisible ? '可见' : '隐藏'}`,
    )
  }

  /**
   * 执行命令：切换轨道可见性
   */
  async execute(): Promise<void> {
    try {
      const track = this.trackModule.getTrack(this.trackId)
      if (!track) {
        throw new Error(`轨道不存在: ${this.trackId}`)
      }

      console.log(`🔄 执行切换轨道可见性操作: ${track.name}...`)

      // 调用trackModule的toggleTrackVisibility方法
      // 这会自动同步该轨道上所有TimelineItem的sprite可见性
      this.trackModule.toggleTrackVisibility(
        this.trackId,
        ref(this.timelineModule.timelineItems.value),
      )

      const newVisibility = track.isVisible
      console.log(`✅ 已切换轨道可见性: ${track.name}, 新状态: ${newVisibility ? '可见' : '隐藏'}`)
    } catch (error) {
      const track = this.trackModule.getTrack(this.trackId)
      console.error(`❌ 切换轨道可见性失败: ${track?.name || `轨道 ${this.trackId}`}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复轨道的原始可见性状态
   */
  async undo(): Promise<void> {
    try {
      const track = this.trackModule.getTrack(this.trackId)
      if (!track) {
        throw new Error(`轨道不存在: ${this.trackId}`)
      }

      console.log(`🔄 撤销切换轨道可见性操作：恢复轨道 ${track.name} 的原始状态...`)

      // 如果当前状态与原始状态不同，则再次切换
      if (track.isVisible !== this.previousVisibility) {
        this.trackModule.toggleTrackVisibility(
          this.trackId,
          ref(this.timelineModule.timelineItems.value),
        )
      }

      console.log(
        `↩️ 已撤销切换轨道可见性: ${track.name}, 恢复状态: ${this.previousVisibility ? '可见' : '隐藏'}`,
      )
    } catch (error) {
      const track = this.trackModule.getTrack(this.trackId)
      console.error(`❌ 撤销切换轨道可见性失败: ${track?.name || `轨道 ${this.trackId}`}`, error)
      throw error
    }
  }
}
// ==================== 切换轨道静音命令 ====================
/**
 * 切换轨道静音命令
 * 支持切换轨道静音状态的撤销/重做操作
 * 同时同步该轨道上所有时间轴项目的音频状态
 */
export class ToggleTrackMuteCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private previousMuteState: boolean // 保存切换前的静音状态

  constructor(
    private trackId: string,
    private trackModule: {
      getTrack: (trackId: string) => UnifiedTrackData | undefined
      toggleTrackMute: (
        trackId: string,
        timelineItems?: Ref<UnifiedTimelineItemData<MediaTypeOrUnknown>[]>,
      ) => void
    },
    private timelineModule: {
      timelineItems: { value: UnifiedTimelineItemData<MediaTypeOrUnknown>[] }
    },
  ) {
    this.id = generateCommandId()

    // 获取轨道信息
    const track = this.trackModule.getTrack(trackId)
    if (!track) {
      throw new Error(`找不到轨道: ${trackId}`)
    }

    this.previousMuteState = track.isMuted
    this.description = `${track.isMuted ? '取消静音' : '静音'}轨道: ${track.name}`

    console.log(
      `📋 准备切换轨道静音状态: ${track.name}, 当前状态: ${track.isMuted ? '静音' : '有声'}`,
    )
  }

  /**
   * 执行命令：切换轨道静音状态
   */
  async execute(): Promise<void> {
    try {
      const track = this.trackModule.getTrack(this.trackId)
      if (!track) {
        throw new Error(`轨道不存在: ${this.trackId}`)
      }

      console.log(`🔄 执行切换轨道静音状态操作: ${track.name}...`)

      // 调用trackModule的toggleTrackMute方法
      // 这会自动同步该轨道上所有TimelineItem的音频状态
      this.trackModule.toggleTrackMute(
        this.trackId,
        ref(this.timelineModule.timelineItems.value),
      )

      const newMuteState = track.isMuted
      console.log(`✅ 已切换轨道静音状态: ${track.name}, 新状态: ${newMuteState ? '静音' : '有声'}`)
    } catch (error) {
      const track = this.trackModule.getTrack(this.trackId)
      console.error(`❌ 切换轨道静音状态失败: ${track?.name || `轨道 ${this.trackId}`}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复轨道的原始静音状态
   */
  async undo(): Promise<void> {
    try {
      const track = this.trackModule.getTrack(this.trackId)
      if (!track) {
        throw new Error(`轨道不存在: ${this.trackId}`)
      }

      console.log(`🔄 撤销切换轨道静音状态操作：恢复轨道 ${track.name} 的原始状态...`)

      // 如果当前状态与原始状态不同，则再次切换
      if (track.isMuted !== this.previousMuteState) {
        this.trackModule.toggleTrackMute(
          this.trackId,
          ref(this.timelineModule.timelineItems.value),
        )
      }

      console.log(
        `↩️ 已撤销切换轨道静音状态: ${track.name}, 恢复状态: ${this.previousMuteState ? '静音' : '有声'}`,
      )
    } catch (error) {
      const track = this.trackModule.getTrack(this.trackId)
      console.error(`❌ 撤销切换轨道静音状态失败: ${track?.name || `轨道 ${this.trackId}`}`, error)
      throw error
    }
  }
}

// ==================== 调整时间轴项目大小命令 ====================
/**
 * 调整时间轴项目大小命令
 * 支持已知和未知时间轴项目时间范围调整（拖拽边缘）的撤销/重做操作
 * 保存调整前的时间范围，撤销时恢复原始时间范围
 */
export class ResizeTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimeRange: BaseTimeRange
  private newTimeRange: BaseTimeRange

  constructor(
    private timelineItemId: string,
    originalTimeRange: BaseTimeRange, // 原始时间范围
    newTimeRange: BaseTimeRange, // 新的时间范围
    private timelineModule: {
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
    },
    private mediaModule: {
      getMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
  ) {
    this.id = generateCommandId()

    // 保存原始和新的时间范围
    this.originalTimeRange = { ...originalTimeRange }
    this.newTimeRange = { ...newTimeRange }

    // 获取时间轴项目信息用于描述
    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    let itemName = '未知素材'

    // 根据项目类型获取名称
    if (timelineItem) {
      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      itemName = mediaItem?.name || '未知素材'
    }

    // 使用帧数计算时长，提供更精确的显示
    const originalDurationFrames =
      this.originalTimeRange.timelineEndTime - this.originalTimeRange.timelineStartTime
    const newDurationFrames =
      this.newTimeRange.timelineEndTime - this.newTimeRange.timelineStartTime
    const originalStartFrames = this.originalTimeRange.timelineStartTime
    const newStartFrames = this.newTimeRange.timelineStartTime

    this.description = `调整时间范围: ${itemName} (${framesToTimecode(originalDurationFrames)} → ${framesToTimecode(newDurationFrames)})`

    console.log(`📋 准备调整时间范围: ${itemName}`, {
      原始时长: framesToTimecode(originalDurationFrames),
      新时长: framesToTimecode(newDurationFrames),
      原始位置: framesToTimecode(originalStartFrames),
      新位置: framesToTimecode(newStartFrames),
    })
  }

  /**
   * 应用时间范围到sprite和timelineItem
   */
  private applyTimeRange(timeRange: BaseTimeRange): void {
    const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!timelineItem) {
      throw new Error(`找不到时间轴项目: ${this.timelineItemId}`)
    }

    if (isKnownTimelineItem(timelineItem)) {
      // 已知项目处理逻辑
      const sprite = timelineItem.sprite
      if (!sprite) {
        throw new Error(`时间轴项目没有sprite: ${this.timelineItemId}`)
      }

      // 根据媒体类型设置时间范围
      if (isVideoTimelineItem(timelineItem) || isAudioTimelineItem(timelineItem)) {
        // 视频和音频类型：保持clipStartTime和clipEndTime，更新timeline时间
        const clipStartTime = 'clipStartTime' in timeRange ?
          (typeof timeRange.clipStartTime === 'number' ? timeRange.clipStartTime : 0) : 0
        const clipEndTime = 'clipEndTime' in timeRange ?
          (typeof timeRange.clipEndTime === 'number' ? timeRange.clipEndTime : 0) : 0
        
        sprite.setTimeRange({
          clipStartTime,
          clipEndTime,
          timelineStartTime: timeRange.timelineStartTime,
          timelineEndTime: timeRange.timelineEndTime,
        })
      } else if (isImageTimelineItem(timelineItem) || isTextTimelineItem(timelineItem)) {
        // 图片和文本类型：设置displayDuration
        const displayDuration = 'displayDuration' in timeRange ?
          (typeof timeRange.displayDuration === 'number' ? timeRange.displayDuration :
            timeRange.timelineEndTime - timeRange.timelineStartTime) :
          timeRange.timelineEndTime - timeRange.timelineStartTime
        
        sprite.setTimeRange({
          timelineStartTime: timeRange.timelineStartTime,
          timelineEndTime: timeRange.timelineEndTime,
          displayDuration,
        })
      } else {
        throw new Error('不支持的媒体类型')
      }

      // 同步timeRange到TimelineItem
      timelineItem.timeRange = sprite.getTimeRange()
    } else if (isUnknownTimelineItem(timelineItem)) {
      // 未知项目处理逻辑：直接更新timeRange（未知项目没有sprite）
      timelineItem.timeRange = {
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: timeRange.timelineEndTime,
      }
    }
  }

  /**
   * 执行命令：应用新的时间范围
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行调整时间范围操作: ${this.timelineItemId}...`)

      this.applyTimeRange(this.newTimeRange)

      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem
        ? this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        : null
      const newDurationFrames =
        this.newTimeRange.timelineEndTime - this.newTimeRange.timelineStartTime

      console.log(
        `✅ 已调整时间范围: ${mediaItem?.name || '未知素材'} → ${framesToTimecode(newDurationFrames)}`,
      )
    } catch (error) {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem
        ? this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        : null
      console.error(`❌ 调整时间范围失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复原始时间范围
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销调整时间范围操作：恢复 ${this.timelineItemId} 的原始时间范围...`)

      this.applyTimeRange(this.originalTimeRange)

      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem
        ? this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        : null
      const originalDurationFrames =
        this.originalTimeRange.timelineEndTime - this.originalTimeRange.timelineStartTime

      console.log(
        `↩️ 已撤销调整时间范围: ${mediaItem?.name || '未知素材'} → ${framesToTimecode(originalDurationFrames)}`,
      )
    } catch (error) {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem
        ? this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        : null
      console.error(`❌ 撤销调整时间范围失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }
}

// ==================== 选择时间轴项目命令 ====================
/**
 * 选择时间轴项目命令
 * 支持已知和未知时间轴项目的单选和多选操作的撤销/重做
 * 记录选择状态的变化，支持恢复到之前的选择状态
 */
export class SelectTimelineItemsCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private previousSelection: Set<string> // 保存操作前的选择状态
  private newSelection: Set<string> // 保存操作后的选择状态

  constructor(
    private itemIds: string[],
    private mode: 'replace' | 'toggle',
    private selectionModule: {
      selectedTimelineItemIds: { value: Set<string> }
      selectTimelineItems: (itemIds: string[], mode: 'replace' | 'toggle') => void
      syncAVCanvasSelection: () => void
    },
    private timelineModule: {
      getTimelineItem: (id: string) => UnifiedTimelineItemData<MediaTypeOrUnknown> | undefined
    },
    private mediaModule: {
      getMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
  ) {
    this.id = generateCommandId()

    // 保存当前选择状态
    this.previousSelection = new Set(this.selectionModule.selectedTimelineItemIds.value)

    // 计算新的选择状态
    this.newSelection = this.calculateNewSelection()

    // 生成描述信息
    this.description = this.generateDescription()

    console.log('💾 保存选择操作数据:', {
      itemIds,
      mode,
      previousSelection: Array.from(this.previousSelection),
      newSelection: Array.from(this.newSelection),
    })
  }

  /**
   * 计算新的选择状态
   */
  private calculateNewSelection(): Set<string> {
    const newSelection = new Set(this.previousSelection)

    if (this.mode === 'replace') {
      // 替换模式：清空现有选择，设置新选择
      newSelection.clear()
      this.itemIds.forEach((id) => newSelection.add(id))
    } else {
      // 切换模式：切换每个项目的选择状态
      this.itemIds.forEach((id) => {
        if (newSelection.has(id)) {
          newSelection.delete(id)
        } else {
          newSelection.add(id)
        }
      })
    }

    return newSelection
  }

  /**
   * 生成操作描述
   */
  private generateDescription(): string {
    const itemNames = this.itemIds.map((id) => {
      const timelineItem = this.timelineModule.getTimelineItem(id)
      if (!timelineItem) return '未知项目'

      // 根据项目类型获取名称
      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      return mediaItem?.name || '未知素材'
    })

    if (this.mode === 'replace') {
      if (this.itemIds.length === 0) {
        return '取消选择所有项目'
      } else if (this.itemIds.length === 1) {
        return `选择项目: ${itemNames[0]}`
      } else {
        return `选择 ${this.itemIds.length} 个项目`
      }
    } else {
      // toggle模式
      if (this.itemIds.length === 1) {
        const wasSelected = this.previousSelection.has(this.itemIds[0])
        return wasSelected ? `取消选择: ${itemNames[0]}` : `添加选择: ${itemNames[0]}`
      } else {
        return `切换选择 ${this.itemIds.length} 个项目`
      }
    }
  }

  /**
   * 执行命令：应用新的选择状态
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行选择操作: ${this.description}`)

      // 直接设置选择状态，避免触发新的历史记录
      this.applySelection(this.newSelection)

      console.log(`✅ 选择操作完成: ${Array.from(this.newSelection).length} 个项目被选中`)
    } catch (error) {
      console.error(`❌ 选择操作失败: ${this.description}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复到之前的选择状态
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销选择操作: ${this.description}`)

      // 恢复到之前的选择状态
      this.applySelection(this.previousSelection)

      console.log(`↩️ 已恢复选择状态: ${Array.from(this.previousSelection).length} 个项目被选中`)
    } catch (error) {
      console.error(`❌ 撤销选择操作失败: ${this.description}`, error)
      throw error
    }
  }

  /**
   * 应用选择状态（不触发历史记录）
   */
  private applySelection(selection: Set<string>): void {
    // 直接更新选择状态，不通过selectTimelineItems方法以避免循环调用
    this.selectionModule.selectedTimelineItemIds.value.clear()
    selection.forEach((id) => this.selectionModule.selectedTimelineItemIds.value.add(id))

    // 手动触发AVCanvas同步逻辑
    this.selectionModule.syncAVCanvasSelection()
  }
}
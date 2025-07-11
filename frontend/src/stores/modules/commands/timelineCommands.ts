import { generateCommandId } from '../../../utils/idGenerator'
import { framesToMicroseconds, framesToTimecode } from '../../utils/timeUtils'
import type {
  SimpleCommand,
  LocalTimelineItem,
  LocalMediaItem,
  Track,
  TrackType,
  VideoTimeRange,
  ImageTimeRange,
  LocalTimelineItemData,
  TransformData,
  TextMediaConfig,
} from '../../../types'
import {
  isVideoTimeRange,
  isImageTimeRange,
  createLocalTimelineItemData,
  getVisualPropsFromData,
  getAudioPropsFromData,
  hasVisualProps,
  hasAudioProps,
} from '../../../types'
import { VideoVisibleSprite } from '../../../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../../../utils/ImageVisibleSprite'
import { AudioVisibleSprite } from '../../../utils/AudioVisibleSprite'
import { createSpriteFromMediaItem } from '../../../utils/spriteFactory'
import { markRaw, reactive, ref, type Ref } from 'vue'
import type { VisibleSprite } from '@webav/av-cliper'

/**
 * 添加时间轴项目命令
 * 支持添加时间轴项目的撤销/重做操作
 * 采用统一重建逻辑：每次执行都从原始素材重新创建sprite
 */
export class AddTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: LocalTimelineItemData // 保存原始timelineItem数据用于重建

  constructor(
    timelineItem: LocalTimelineItem, // 注意：不再保存timelineItem引用，只保存重建数据
    private timelineModule: {
      addTimelineItem: (item: LocalTimelineItem) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => LocalTimelineItem | undefined
    },
    private webavModule: {
      addSprite: (sprite: VisibleSprite) => Promise<boolean>
      removeSprite: (sprite: VisibleSprite) => boolean
    },
    private mediaModule: {
      getMediaItem: (id: string) => LocalMediaItem | undefined
    },
  ) {
    this.id = generateCommandId()
    const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
    this.description = `添加时间轴项目: ${mediaItem?.name || '未知素材'}`

    // 保存原始数据用于重建sprite（类型安全版本）
    this.originalTimelineItemData = createLocalTimelineItemData(timelineItem)
  }

  /**
   * 从原始素材重建完整的TimelineItem
   * 统一重建逻辑：每次都从原始素材完全重新创建
   */
  private async rebuildTimelineItem(): Promise<LocalTimelineItem> {
    console.log('🔄 开始从源头重建时间轴项目...')

    // 1. 获取原始素材
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`原始素材不存在: ${this.originalTimelineItemData.mediaItemId}`)
    }

    if (!mediaItem.isReady) {
      throw new Error(`素材尚未解析完成: ${mediaItem.name}`)
    }

    // 2. 从原始素材重新创建sprite
    const newSprite = await createSpriteFromMediaItem(mediaItem)

    // 3. 设置时间范围
    newSprite.setTimeRange(this.originalTimelineItemData.timeRange)

    // 4. 应用变换属性（类型安全版本）
    const visualProps = getVisualPropsFromData(this.originalTimelineItemData)
    if (visualProps) {
      newSprite.rect.x = visualProps.x
      newSprite.rect.y = visualProps.y
      newSprite.rect.w = visualProps.width
      newSprite.rect.h = visualProps.height
      newSprite.rect.angle = visualProps.rotation
      newSprite.opacity = visualProps.opacity
    }
    newSprite.zIndex = (this.originalTimelineItemData.config as any).zIndex

    // 5. 创建新的TimelineItem（先不设置缩略图）
    const newTimelineItem: LocalTimelineItem = reactive({
      id: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: newSprite.getTimeRange(),
      sprite: markRaw(newSprite),
      thumbnailUrl: undefined, // 先设为undefined，稍后重新生成
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation ? { ...this.originalTimelineItemData.animation } : undefined,
      mediaName: this.originalTimelineItemData.mediaName,
    })

    // 6. 重新生成缩略图（异步执行，不阻塞重建过程）
    this.regenerateThumbnailForAddedItem(newTimelineItem, mediaItem)

    console.log('🔄 重建时间轴项目完成:', {
      id: newTimelineItem.id,
      mediaType: mediaItem.mediaType,
      timeRange: this.originalTimelineItemData.timeRange,
      position: { x: newSprite.rect.x, y: newSprite.rect.y },
      size: { w: newSprite.rect.w, h: newSprite.rect.h },
    })

    return newTimelineItem
  }

  /**
   * 执行命令：添加时间轴项目
   * 统一重建逻辑：每次执行都从原始素材重新创建
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行添加操作：从源头重建时间轴项目...`)

      // 从原始素材重新创建TimelineItem和sprite
      const newTimelineItem = await this.rebuildTimelineItem()

      // 1. 添加到时间轴
      this.timelineModule.addTimelineItem(newTimelineItem)

      // 2. 添加sprite到WebAV画布
      await this.webavModule.addSprite(newTimelineItem.sprite)

      console.log(`✅ 已添加时间轴项目: ${this.originalTimelineItemData.mediaName}`)
    } catch (error) {
      console.error(`❌ 添加时间轴项目失败: ${this.originalTimelineItemData.mediaName}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：移除时间轴项目
   */
  undo(): void {
    try {
      // 检查项目是否仍然存在
      const existingItem = this.timelineModule.getTimelineItem(this.originalTimelineItemData.id)
      if (!existingItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法撤销: ${this.originalTimelineItemData.id}`)
        return
      }

      // 移除时间轴项目（这会自动处理sprite的清理）
      this.timelineModule.removeTimelineItem(this.originalTimelineItemData.id)
      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.log(`↩️ 已撤销添加时间轴项目: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.error(`❌ 撤销添加时间轴项目失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }

  /**
   * 为添加的项目重新生成缩略图
   * @param timelineItem 添加的时间轴项目
   * @param mediaItem 对应的媒体项目
   */
  private async regenerateThumbnailForAddedItem(timelineItem: LocalTimelineItem, mediaItem: LocalMediaItem) {
    // 音频不需要缩略图
    if (mediaItem.mediaType === 'audio') {
      console.log('🎵 音频不需要缩略图，跳过生成')
      return
    }

    try {
      console.log('🖼️ 开始为添加的项目重新生成缩略图...')

      const { regenerateThumbnailForTimelineItem } = await import(
        '../../../utils/thumbnailGenerator'
      )
      const thumbnailUrl = await regenerateThumbnailForTimelineItem(timelineItem, mediaItem)

      if (thumbnailUrl) {
        timelineItem.thumbnailUrl = thumbnailUrl
        console.log('✅ 添加项目缩略图生成完成')
      }
    } catch (error) {
      console.error('❌ 添加项目缩略图生成失败:', error)
    }
  }
}

/**
 * 移除时间轴项目命令
 * 支持移除时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始素材重新创建
 */
export class RemoveTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: LocalTimelineItemData // 保存重建所需的完整元数据

  constructor(
    private timelineItemId: string,
    timelineItem: LocalTimelineItem, // 要删除的时间轴项目
    private timelineModule: {
      addTimelineItem: (item: LocalTimelineItem) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => LocalTimelineItem | undefined
    },
    private webavModule: {
      addSprite: (sprite: VisibleSprite) => Promise<boolean>
      removeSprite: (sprite: VisibleSprite) => boolean
    },
    private mediaModule: {
      getMediaItem: (id: string) => LocalMediaItem | undefined
    },
  ) {
    this.id = generateCommandId()

    const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
    this.description = `移除时间轴项目: ${mediaItem?.name || '未知素材'}`

    // 🎯 关键：保存重建所需的完整元数据，而不是对象引用
    this.originalTimelineItemData = createLocalTimelineItemData(timelineItem)

    console.log('💾 保存删除项目的重建数据:', {
      id: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: this.originalTimelineItemData.timeRange,
      config: this.originalTimelineItemData.config,
    })
  }

  /**
   * 从原始素材重建sprite和timelineItem
   * 遵循"从源头重建"原则，每次都完全重新创建
   */
  private async rebuildTimelineItem(): Promise<LocalTimelineItem> {
    console.log('🔄 开始从源头重建时间轴项目...')

    // 1. 获取原始素材
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`原始素材不存在: ${this.originalTimelineItemData.mediaItemId}`)
    }

    if (!mediaItem.isReady) {
      throw new Error(`素材尚未解析完成: ${mediaItem.name}`)
    }

    // 2. 从原始素材重新创建sprite
    const newSprite = await createSpriteFromMediaItem(mediaItem)

    // 3. 设置时间范围
    newSprite.setTimeRange(this.originalTimelineItemData.timeRange)

    // 4. 应用变换属性（类型安全版本）
    const visualProps = getVisualPropsFromData(this.originalTimelineItemData)
    if (visualProps) {
      newSprite.rect.x = visualProps.x
      newSprite.rect.y = visualProps.y
      newSprite.rect.w = visualProps.width
      newSprite.rect.h = visualProps.height
      newSprite.rect.angle = visualProps.rotation
      newSprite.opacity = visualProps.opacity
    }
    newSprite.zIndex = (this.originalTimelineItemData.config as any).zIndex

    // 5. 创建新的TimelineItem（先不设置缩略图）
    const newTimelineItem: LocalTimelineItem = reactive({
      id: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: this.originalTimelineItemData.timeRange,
      sprite: markRaw(newSprite),
      thumbnailUrl: undefined, // 先设为undefined，稍后重新生成
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation ? { ...this.originalTimelineItemData.animation } : undefined,
      mediaName: this.originalTimelineItemData.mediaName,
    })

    // 6. 重新生成缩略图（异步执行，不阻塞重建过程）
    this.regenerateThumbnailForRemovedItem(newTimelineItem, mediaItem)

    console.log('🔄 重建时间轴项目完成:', {
      id: newTimelineItem.id,
      mediaType: mediaItem.mediaType,
      timeRange: this.originalTimelineItemData.timeRange,
      position: { x: newSprite.rect.x, y: newSprite.rect.y },
      size: { w: newSprite.rect.w, h: newSprite.rect.h },
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

      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.log(`🗑️ 已删除时间轴项目: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.error(`❌ 删除时间轴项目失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：重新创建时间轴项目
   * 遵循"从源头重建"原则，从原始素材完全重新创建
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销删除操作：重建时间轴项目...`)

      // 从原始素材重新创建TimelineItem和sprite
      const newTimelineItem = await this.rebuildTimelineItem()

      // 1. 添加到时间轴
      this.timelineModule.addTimelineItem(newTimelineItem)

      // 2. 添加sprite到WebAV画布
      await this.webavModule.addSprite(newTimelineItem.sprite)

      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.log(`↩️ 已撤销删除时间轴项目: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.error(`❌ 撤销删除时间轴项目失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }

  /**
   * 为重建的删除项目重新生成缩略图
   * @param timelineItem 重建的时间轴项目
   * @param mediaItem 对应的媒体项目
   */
  private async regenerateThumbnailForRemovedItem(
    timelineItem: LocalTimelineItem,
    mediaItem: LocalMediaItem,
  ) {
    // 音频不需要缩略图
    if (mediaItem.mediaType === 'audio') {
      console.log('🎵 音频不需要缩略图，跳过生成')
      return
    }

    try {
      console.log('🖼️ 开始为重建的删除项目重新生成缩略图...')

      const { regenerateThumbnailForTimelineItem } = await import(
        '../../../utils/thumbnailGenerator'
      )
      const thumbnailUrl = await regenerateThumbnailForTimelineItem(timelineItem, mediaItem)

      if (thumbnailUrl) {
        timelineItem.thumbnailUrl = thumbnailUrl
        console.log('✅ 重建删除项目缩略图生成完成')
      }
    } catch (error) {
      console.error('❌ 重建删除项目缩略图生成失败:', error)
    }
  }
}

/**
 * 复制时间轴项目命令
 * 支持复制时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时删除复制的项目
 */
export class DuplicateTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: LocalTimelineItemData // 保存原始项目的重建元数据
  public readonly newTimelineItemId: string // 新创建的项目ID

  constructor(
    private originalTimelineItemId: string,
    originalTimelineItem: LocalTimelineItem, // 要复制的原始时间轴项目
    private newPositionFrames: number, // 新项目的时间位置（帧数）
    private timelineModule: {
      addTimelineItem: (item: LocalTimelineItem) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => LocalTimelineItem | undefined
      setupBidirectionalSync: (item: LocalTimelineItem) => void
    },
    private webavModule: {
      addSprite: (sprite: VisibleSprite) => Promise<boolean>
      removeSprite: (sprite: VisibleSprite) => boolean
    },
    private mediaModule: {
      getMediaItem: (id: string) => LocalMediaItem | undefined
    },
    private canvasResolution: { width: number; height: number }, // 画布分辨率
  ) {
    this.id = generateCommandId()
    const mediaItem = this.mediaModule.getMediaItem(originalTimelineItem.mediaItemId)
    this.description = `复制时间轴项目: ${mediaItem?.name || '未知素材'}`

    // 保存原始项目的完整重建元数据
    this.originalTimelineItemData = createLocalTimelineItemData(originalTimelineItem)

    // 生成新项目的ID
    this.newTimelineItemId = `timeline_item_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * 从原始素材重建复制的时间轴项目
   */
  private async rebuildDuplicatedItem(): Promise<LocalTimelineItem> {
    // 根据媒体类型分发到对应的重建方法
    switch (this.originalTimelineItemData.mediaType) {
      case 'text':
        return this.rebuildTextItem()
      case 'video':
        return this.rebuildVideoItem()
      case 'image':
        return this.rebuildImageItem()
      case 'audio':
        return this.rebuildAudioItem()
      default:
        throw new Error(`不支持的媒体类型: ${this.originalTimelineItemData.mediaType}`)
    }
  }

  /**
   * 重建视频时间轴项目
   */
  private async rebuildVideoItem(): Promise<LocalTimelineItem> {
    console.log('🔄 [DuplicateTimelineItemCommand] 重建视频时间轴项目...')

    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`找不到素材项目: ${this.originalTimelineItemData.mediaItemId}`)
    }

    // 检查素材是否已经解析完成
    if (!mediaItem.isReady || !mediaItem.mp4Clip) {
      throw new Error('视频素材还在解析中，无法复制')
    }

    // 创建视频精灵
    const newSprite = await createSpriteFromMediaItem(mediaItem)

    // 设置时间范围（调整到新位置）
    const originalTimeRange = this.originalTimelineItemData.timeRange as VideoTimeRange
    const originalDurationFrames =
      originalTimeRange.timelineEndTime - originalTimeRange.timelineStartTime
    const newTimelineStartTimeFrames = this.newPositionFrames
    const newTimelineEndTimeFrames = newTimelineStartTimeFrames + originalDurationFrames

    newSprite.setTimeRange({
      clipStartTime: originalTimeRange.clipStartTime,
      clipEndTime: originalTimeRange.clipEndTime,
      timelineStartTime: newTimelineStartTimeFrames,
      timelineEndTime: newTimelineEndTimeFrames,
    })

    // 设置变换属性
    await this.applyVisualProperties(newSprite)

    // 创建新的TimelineItem
    const newTimelineItem: LocalTimelineItem = reactive({
      id: this.newTimelineItemId,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: 'video',
      timeRange: {
        clipStartTime: originalTimeRange.clipStartTime,
        clipEndTime: originalTimeRange.clipEndTime,
        timelineStartTime: newTimelineStartTimeFrames,
        timelineEndTime: newTimelineEndTimeFrames,
        effectiveDuration: originalTimeRange.effectiveDuration,
        playbackRate: originalTimeRange.playbackRate,
      },
      sprite: markRaw(newSprite),
      thumbnailUrl: undefined,
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation ? { ...this.originalTimelineItemData.animation } : undefined,
      mediaName: this.originalTimelineItemData.mediaName,
    })

    // 重新生成缩略图
    this.regenerateThumbnailForDuplicatedItem(newTimelineItem, mediaItem)

    console.log('✅ [DuplicateTimelineItemCommand] 视频时间轴项目重建完成')
    return newTimelineItem
  }

  /**
   * 重建图片时间轴项目
   */
  private async rebuildImageItem(): Promise<LocalTimelineItem> {
    console.log('🔄 [DuplicateTimelineItemCommand] 重建图片时间轴项目...')

    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`找不到素材项目: ${this.originalTimelineItemData.mediaItemId}`)
    }

    // 检查素材是否已经解析完成
    if (!mediaItem.isReady || !mediaItem.imgClip) {
      throw new Error('图片素材还在解析中，无法复制')
    }

    // 创建图片精灵
    const newSprite = await createSpriteFromMediaItem(mediaItem)

    // 设置时间范围（调整到新位置）
    const originalTimeRange = this.originalTimelineItemData.timeRange as ImageTimeRange
    const originalDurationFrames =
      originalTimeRange.timelineEndTime - originalTimeRange.timelineStartTime
    const newTimelineStartTimeFrames = this.newPositionFrames
    const newTimelineEndTimeFrames = newTimelineStartTimeFrames + originalDurationFrames

    newSprite.setTimeRange({
      timelineStartTime: newTimelineStartTimeFrames,
      timelineEndTime: newTimelineEndTimeFrames,
      displayDuration: originalTimeRange.displayDuration,
    })

    // 设置变换属性
    await this.applyVisualProperties(newSprite)

    // 创建新的TimelineItem
    const newTimelineItem: LocalTimelineItem = reactive({
      id: this.newTimelineItemId,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: 'image',
      timeRange: {
        timelineStartTime: newTimelineStartTimeFrames,
        timelineEndTime: newTimelineEndTimeFrames,
        displayDuration: originalTimeRange.displayDuration,
      },
      sprite: markRaw(newSprite),
      thumbnailUrl: undefined,
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation ? { ...this.originalTimelineItemData.animation } : undefined,
      mediaName: this.originalTimelineItemData.mediaName,
    })

    // 重新生成缩略图
    this.regenerateThumbnailForDuplicatedItem(newTimelineItem, mediaItem)

    console.log('✅ [DuplicateTimelineItemCommand] 图片时间轴项目重建完成')
    return newTimelineItem
  }

  /**
   * 重建音频时间轴项目
   */
  private async rebuildAudioItem(): Promise<LocalTimelineItem> {
    console.log('🔄 [DuplicateTimelineItemCommand] 重建音频时间轴项目...')

    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`找不到素材项目: ${this.originalTimelineItemData.mediaItemId}`)
    }

    // 检查素材是否已经解析完成
    if (!mediaItem.isReady || !mediaItem.audioClip) {
      throw new Error('音频素材还在解析中，无法复制')
    }

    // 创建音频精灵
    const newSprite = await createSpriteFromMediaItem(mediaItem)

    // 设置时间范围（调整到新位置）
    const originalTimeRange = this.originalTimelineItemData.timeRange as VideoTimeRange
    const originalDurationFrames =
      originalTimeRange.timelineEndTime - originalTimeRange.timelineStartTime
    const newTimelineStartTimeFrames = this.newPositionFrames
    const newTimelineEndTimeFrames = newTimelineStartTimeFrames + originalDurationFrames

    newSprite.setTimeRange({
      clipStartTime: originalTimeRange.clipStartTime,
      clipEndTime: originalTimeRange.clipEndTime,
      timelineStartTime: newTimelineStartTimeFrames,
      timelineEndTime: newTimelineEndTimeFrames,
    })

    // 音频不需要视觉属性，但需要复制音频属性
    const audioConfig = this.originalTimelineItemData.config as any
    if (audioConfig && audioConfig.audioState) {
      const audioSprite = newSprite as any
      if (typeof audioSprite.setAudioState === 'function') {
        audioSprite.setAudioState(audioConfig.audioState)
      }
      if (typeof audioSprite.setGain === 'function' && audioConfig.gain !== undefined) {
        audioSprite.setGain(audioConfig.gain)
      }
    }

    // 创建新的TimelineItem
    const newTimelineItem: LocalTimelineItem = reactive({
      id: this.newTimelineItemId,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: 'audio',
      timeRange: {
        clipStartTime: originalTimeRange.clipStartTime,
        clipEndTime: originalTimeRange.clipEndTime,
        timelineStartTime: newTimelineStartTimeFrames,
        timelineEndTime: newTimelineEndTimeFrames,
        effectiveDuration: originalTimeRange.effectiveDuration,
        playbackRate: originalTimeRange.playbackRate,
      },
      sprite: markRaw(newSprite),
      thumbnailUrl: undefined, // 音频不需要缩略图
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation ? { ...this.originalTimelineItemData.animation } : undefined,
      mediaName: this.originalTimelineItemData.mediaName,
    })

    // 音频不需要缩略图，跳过缩略图生成
    console.log('✅ [DuplicateTimelineItemCommand] 音频时间轴项目重建完成')
    return newTimelineItem
  }

  /**
   * 应用视觉属性到精灵
   */
  private async applyVisualProperties(sprite: any): Promise<void> {
    const visualProps = getVisualPropsFromData(this.originalTimelineItemData)
    if (visualProps) {
      // 导入坐标转换工具
      const { projectToWebavCoords } = await import('../../../utils/coordinateTransform')

      // 使用传入的画布分辨率
      const canvasWidth = this.canvasResolution.width
      const canvasHeight = this.canvasResolution.height

      // 将项目坐标系转换为WebAV坐标系
      const webavCoords = projectToWebavCoords(
        visualProps.x,
        visualProps.y,
        visualProps.width,
        visualProps.height,
        canvasWidth,
        canvasHeight,
      )

      const rect = sprite.rect
      rect.x = webavCoords.x
      rect.y = webavCoords.y
      rect.w = visualProps.width
      rect.h = visualProps.height
      rect.angle = visualProps.rotation
      sprite.opacity = visualProps.opacity
    }
    sprite.zIndex = (this.originalTimelineItemData.config as any).zIndex
  }

  /**
   * 重建文本时间轴项目（文本clip没有MediaItem）
   */
  private async rebuildTextItem(): Promise<LocalTimelineItem> {
    console.log('🔄 [DuplicateTimelineItemCommand] 重建文本时间轴项目...')

    // 从保存的配置中获取文本内容和样式
    const textConfig = this.originalTimelineItemData.config as any
    const text = textConfig.text
    const style = textConfig.style

    if (!text) {
      throw new Error('文本内容不能为空')
    }

    // 动态导入TextVisibleSprite
    const { TextVisibleSprite } = await import('../../../utils/TextVisibleSprite')

    // 重新创建文本精灵
    const newSprite = await TextVisibleSprite.create(text, style)

    // 设置时间范围（调整到新位置）
    const originalTimeRange = this.originalTimelineItemData.timeRange
    const originalDurationFrames =
      originalTimeRange.timelineEndTime - originalTimeRange.timelineStartTime
    const newTimelineStartTimeFrames = this.newPositionFrames
    const newTimelineEndTimeFrames = newTimelineStartTimeFrames + originalDurationFrames

    newSprite.setTimeRange({
      timelineStartTime: newTimelineStartTimeFrames,
      timelineEndTime: newTimelineEndTimeFrames,
      displayDuration: originalDurationFrames,
    })

    // 设置变换属性（应用坐标转换）
    const visualProps = getVisualPropsFromData(this.originalTimelineItemData)

    if (visualProps) {
      // 导入坐标转换工具
      const { projectToWebavCoords } = await import('../../../utils/coordinateTransform')

      // 使用传入的画布分辨率进行坐标转换
      const canvasWidth = this.canvasResolution.width
      const canvasHeight = this.canvasResolution.height

      // 将项目坐标系转换为WebAV坐标系
      const webavCoords = projectToWebavCoords(
        visualProps.x,
        visualProps.y,
        visualProps.width,
        visualProps.height,
        canvasWidth,
        canvasHeight,
      )

      const rect = newSprite.rect
      rect.x = webavCoords.x
      rect.y = webavCoords.y
      rect.w = visualProps.width
      rect.h = visualProps.height
      rect.angle = visualProps.rotation
      newSprite.opacity = visualProps.opacity
    } else {
      console.warn('⚠️ [DuplicateTimelineItemCommand] 未找到视觉属性，跳过坐标设置')
    }

    // 设置其他属性
    newSprite.zIndex = textConfig.zIndex

    // 创建新的TimelineItem
    const newTimelineItem: LocalTimelineItem = reactive({
      id: this.newTimelineItemId,
      mediaItemId: '', // 文本项目不需要媒体库项目
      trackId: this.originalTimelineItemData.trackId,
      mediaType: 'text',
      timeRange: {
        timelineStartTime: newTimelineStartTimeFrames,
        timelineEndTime: newTimelineEndTimeFrames,
        displayDuration: originalDurationFrames,
      },
      sprite: markRaw(newSprite),
      thumbnailUrl: undefined, // 文本项目不需要缩略图
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation ? { ...this.originalTimelineItemData.animation } : undefined,
      mediaName: this.originalTimelineItemData.mediaName,
    })

    console.log('✅ [DuplicateTimelineItemCommand] 文本时间轴项目重建完成')
    return newTimelineItem
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

      // 2. 设置双向数据同步
      this.timelineModule.setupBidirectionalSync(newTimelineItem)

      // 3. 添加sprite到WebAV画布
      await this.webavModule.addSprite(newTimelineItem.sprite)

      console.log(`✅ 已复制时间轴项目: ${this.originalTimelineItemData.mediaName}`)
    } catch (error) {
      console.error(`❌ 复制时间轴项目失败: ${this.originalTimelineItemData.mediaName}`, error)
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

      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.log(`↩️ 已撤销复制时间轴项目: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.error(`❌ 撤销复制时间轴项目失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }

  /**
   * 为复制的项目重新生成缩略图
   * @param timelineItem 复制的时间轴项目
   * @param mediaItem 对应的媒体项目
   */
  private async regenerateThumbnailForDuplicatedItem(
    timelineItem: LocalTimelineItem,
    mediaItem: LocalMediaItem,
  ) {
    // 文本和音频clip不需要缩略图
    if (timelineItem.mediaType === 'text' || timelineItem.mediaType === 'audio') {
      console.log(`📝 ${timelineItem.mediaType}clip不需要缩略图，跳过生成`)
      return
    }

    try {
      console.log('🖼️ 开始为复制的项目重新生成缩略图...')

      const { regenerateThumbnailForTimelineItem } = await import(
        '../../../utils/thumbnailGenerator'
      )
      const thumbnailUrl = await regenerateThumbnailForTimelineItem(timelineItem, mediaItem)

      if (thumbnailUrl) {
        timelineItem.thumbnailUrl = thumbnailUrl
        console.log('✅ 复制项目缩略图生成完成')
      }
    } catch (error) {
      console.error('❌ 复制项目缩略图生成失败:', error)
    }
  }
}

/**
 * 移动时间轴项目命令
 * 支持时间轴项目位置移动的撤销/重做操作
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
      updateTimelineItemPosition: (id: string, positionFrames: number, trackId?: string) => void
      getTimelineItem: (id: string) => LocalTimelineItem | undefined
    },
    private mediaModule: {
      getMediaItem: (id: string) => LocalMediaItem | undefined
    },
  ) {
    this.id = generateCommandId()

    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    const mediaItem = timelineItem ? this.mediaModule.getMediaItem(timelineItem.mediaItemId) : null

    // 生成描述信息
    const positionChanged = this.oldPositionFrames !== this.newPositionFrames
    const trackChanged = oldTrackId !== newTrackId

    if (positionChanged && trackChanged) {
      this.description = `移动时间轴项目: ${mediaItem?.name || '未知素材'} (位置: ${this.oldPositionFrames}帧→${this.newPositionFrames}帧, 轨道: ${oldTrackId}→${newTrackId})`
    } else if (positionChanged) {
      this.description = `移动时间轴项目: ${mediaItem?.name || '未知素材'} (位置: ${this.oldPositionFrames}帧→${this.newPositionFrames}帧)`
    } else if (trackChanged) {
      this.description = `移动时间轴项目: ${mediaItem?.name || '未知素材'} (轨道: ${oldTrackId}→${newTrackId})`
    } else {
      this.description = `移动时间轴项目: ${mediaItem?.name || '未知素材'} (无变化)`
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
      this.timelineModule.updateTimelineItemPosition(
        this.timelineItemId,
        this.newPositionFrames,
        trackIdToSet,
      )

      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      console.log(
        `🔄 已移动时间轴项目: ${mediaItem?.name || '未知素材'} 到位置 ${this.newPositionFrames}帧, 轨道 ${this.newTrackId}`,
      )
    } catch (error) {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem
        ? this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        : null
      console.error(`❌ 移动时间轴项目失败: ${mediaItem?.name || '未知素材'}`, error)
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
      this.timelineModule.updateTimelineItemPosition(
        this.timelineItemId,
        this.oldPositionFrames,
        trackIdToSet,
      )

      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      console.log(
        `↩️ 已撤销移动时间轴项目: ${mediaItem?.name || '未知素材'} 回到位置 ${this.oldPositionFrames}帧, 轨道 ${this.oldTrackId}`,
      )
    } catch (error) {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem
        ? this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        : null
      console.error(`❌ 撤销移动时间轴项目失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }
}

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
      getTimelineItem: (id: string) => LocalTimelineItem | undefined
    },
    private mediaModule: {
      getMediaItem: (id: string) => LocalMediaItem | undefined
    },
    private clipOperationsModule?: {
      updateTimelineItemPlaybackRate: (id: string, rate: number) => void
    },
  ) {
    this.id = generateCommandId()

    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    const mediaItem = timelineItem ? this.mediaModule.getMediaItem(timelineItem.mediaItemId) : null

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
      changes.push(`增益: ${this.oldValues.gain.toFixed(1)}dB → ${this.newValues.gain.toFixed(1)}dB`)
    }

    const changeText = changes.length > 0 ? ` (${changes.join(', ')})` : ''
    return `更新变换属性: ${mediaName}${changeText}`
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
      if (hasAudioProps(timelineItem)) {
        if (this.newValues.volume !== undefined) {
          timelineItem.config.volume = this.newValues.volume
          const sprite = timelineItem.sprite
          if (sprite && 'setVolume' in sprite) {
            ;(sprite as VideoVisibleSprite).setVolume?.(this.newValues.volume)
          }
        }

        if (this.newValues.isMuted !== undefined) {
          timelineItem.config.isMuted = this.newValues.isMuted
          const sprite = timelineItem.sprite
          if (sprite && 'setMuted' in sprite) {
            ;(sprite as VideoVisibleSprite).setMuted?.(this.newValues.isMuted)
          }
        }
      }

      // 处理音频增益更新（仅对音频有效）
      if (timelineItem.mediaType === 'audio' && this.newValues.gain !== undefined) {
        ;(timelineItem.config as any).gain = this.newValues.gain
        const sprite = timelineItem.sprite
        if (sprite && 'setGain' in sprite) {
          ;(sprite as AudioVisibleSprite).setGain(this.newValues.gain)
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
      if (hasAudioProps(timelineItem)) {
        if (this.oldValues.volume !== undefined) {
          timelineItem.config.volume = this.oldValues.volume
          const sprite = timelineItem.sprite
          if (sprite && 'setVolume' in sprite) {
            ;(sprite as VideoVisibleSprite).setVolume?.(this.oldValues.volume)
          }
        }

        if (this.oldValues.isMuted !== undefined) {
          timelineItem.config.isMuted = this.oldValues.isMuted
          const sprite = timelineItem.sprite
          if (sprite && 'setMuted' in sprite) {
            ;(sprite as VideoVisibleSprite).setMuted?.(this.oldValues.isMuted)
          }
        }
      }

      // 处理音频增益恢复（仅对音频有效）
      if (timelineItem.mediaType === 'audio' && this.oldValues.gain !== undefined) {
        ;(timelineItem.config as any).gain = this.oldValues.gain
        const sprite = timelineItem.sprite
        if (sprite && 'setGain' in sprite) {
          ;(sprite as AudioVisibleSprite).setGain(this.oldValues.gain)
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
   * 更新时间轴项目的时长
   * @param timelineItemId 时间轴项目ID
   * @param newDurationFrames 新的时长（帧数）
   */
  private updateTimelineItemDuration(timelineItemId: string, newDurationFrames: number): void {
    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) return

    const sprite = timelineItem.sprite
    const timeRange = sprite.getTimeRange()
    const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)

    if (!mediaItem) return

    // 直接使用帧数进行计算，timeRange中的时间已经是帧数
    const timelineStartFrames = timeRange.timelineStartTime
    const newTimelineEndFrames = timelineStartFrames + newDurationFrames
    const newTimelineEndTime = framesToMicroseconds(newTimelineEndFrames)

    if (timelineItem.mediaType === 'video' && isVideoTimeRange(timeRange)) {
      // 更新sprite的时间范围
      sprite.setTimeRange({
        clipStartTime: timeRange.clipStartTime || 0,
        clipEndTime: timeRange.clipEndTime || mediaItem.duration,
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: newTimelineEndTime,
      })
    } else if (timelineItem.mediaType === 'audio' && isVideoTimeRange(timeRange)) {
      // 更新sprite的时间范围
      sprite.setTimeRange({
        clipStartTime: timeRange.clipStartTime || 0,
        clipEndTime: timeRange.clipEndTime || mediaItem.duration,
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: newTimelineEndTime,
      })
    } else if (timelineItem.mediaType === 'image') {
      // 对于图片，直接更新显示时长（使用帧数）
      sprite.setTimeRange({
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: newTimelineEndTime,
        displayDuration: newDurationFrames,
      })
    } else if (timelineItem.mediaType === 'text') {
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
      import('../../../utils/webavAnimationManager').then(({ updateWebAVAnimation }) => {
        updateWebAVAnimation(timelineItem)
          .then(() => {
            console.log('🎬 [Command] Animation duration updated after duration change')
          })
          .catch((error) => {
            console.error('🎬 [Command] Failed to update animation duration:', error)
          })
      })
    }
  }
}

/**
 * 分割时间轴项目命令
 * 支持分割时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始素材重新创建
 */
export class SplitTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: LocalTimelineItemData // 保存原始项目的重建数据
  private firstItemId: string // 分割后第一个项目的ID
  private secondItemId: string // 分割后第二个项目的ID

  constructor(
    private originalTimelineItemId: string,
    originalTimelineItem: LocalTimelineItem, // 要分割的原始时间轴项目
    private splitTimeFrames: number, // 分割时间点（帧数）
    private timelineModule: {
      addTimelineItem: (item: LocalTimelineItem) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => LocalTimelineItem | undefined
    },
    private webavModule: {
      addSprite: (sprite: VisibleSprite) => Promise<boolean>
      removeSprite: (sprite: VisibleSprite) => boolean
    },
    private mediaModule: {
      getMediaItem: (id: string) => LocalMediaItem | undefined
    },
  ) {
    this.id = generateCommandId()

    const mediaItem = this.mediaModule.getMediaItem(originalTimelineItem.mediaItemId)
    this.description = `分割时间轴项目: ${mediaItem?.name || '未知素材'} (在 ${framesToTimecode(splitTimeFrames)})`

    // 🎯 关键：保存原始项目的完整重建元数据
    this.originalTimelineItemData = createLocalTimelineItemData(originalTimelineItem)

    // 生成分割后项目的ID
    this.firstItemId = Date.now().toString() + Math.random().toString(36).substring(2, 11)
    this.secondItemId = Date.now().toString() + Math.random().toString(36).substring(2, 11)

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
    firstItem: LocalTimelineItem
    secondItem: LocalTimelineItem
  }> {
    console.log('🔄 开始从源头重建分割后的时间轴项目...')

    // 1. 获取原始素材
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`原始素材不存在: ${this.originalTimelineItemData.mediaItemId}`)
    }

    // 检查素材是否已准备好并且是支持分割的类型
    if (!mediaItem.isReady) {
      throw new Error(`素材尚未解析完成: ${mediaItem.name}`)
    }

    if (mediaItem.mediaType === 'video' && !mediaItem.mp4Clip) {
      throw new Error(`视频素材解析失败: ${mediaItem.name}`)
    }

    if (mediaItem.mediaType === 'audio' && !mediaItem.audioClip) {
      throw new Error(`音频素材解析失败: ${mediaItem.name}`)
    }

    // 2. 计算分割点的时间信息（直接使用帧数）
    const originalTimeRange = this.originalTimelineItemData.timeRange
    if (!isVideoTimeRange(originalTimeRange)) {
      throw new Error('只能分割视频和音频项目')
    }
    // originalTimeRange 中的时间已经是帧数
    const timelineStartTimeFrames = originalTimeRange.timelineStartTime
    const timelineEndTimeFrames = originalTimeRange.timelineEndTime
    const clipStartTimeFrames = originalTimeRange.clipStartTime
    const clipEndTimeFrames = originalTimeRange.clipEndTime
    const splitTimeFrames = this.splitTimeFrames // 分割时间点（帧数）

    // 计算分割点在素材中的相对位置（使用帧数）
    const timelineDurationFrames = timelineEndTimeFrames - timelineStartTimeFrames
    const relativeTimelineFrames = splitTimeFrames - timelineStartTimeFrames
    const relativeRatio = relativeTimelineFrames / timelineDurationFrames
    const clipDurationFrames = clipEndTimeFrames - clipStartTimeFrames
    const splitClipTimeFrames = clipStartTimeFrames + Math.round(clipDurationFrames * relativeRatio)

    // 3. 从原始素材重新创建两个sprite
    const firstSprite = await createSpriteFromMediaItem(mediaItem)
    firstSprite.setTimeRange({
      clipStartTime: clipStartTimeFrames,
      clipEndTime: splitClipTimeFrames,
      timelineStartTime: timelineStartTimeFrames,
      timelineEndTime: splitTimeFrames, // 分割点时间（帧数）
    })

    const secondSprite = await createSpriteFromMediaItem(mediaItem)
    secondSprite.setTimeRange({
      clipStartTime: splitClipTimeFrames,
      clipEndTime: clipEndTimeFrames,
      timelineStartTime: splitTimeFrames, // 分割点时间（帧数）
      timelineEndTime: timelineEndTimeFrames,
    })

    // 4. 根据媒体类型应用相应的属性
    if (mediaItem.mediaType === 'video') {
      // 视频：应用视觉和音频属性
      const firstVideoSprite = firstSprite as VideoVisibleSprite
      const secondVideoSprite = secondSprite as VideoVisibleSprite

      const applyVideoTransform = (sprite: VideoVisibleSprite) => {
        const visualProps = getVisualPropsFromData(this.originalTimelineItemData)
        if (visualProps) {
          sprite.rect.x = visualProps.x
          sprite.rect.y = visualProps.y
          sprite.rect.w = visualProps.width
          sprite.rect.h = visualProps.height
          sprite.rect.angle = visualProps.rotation
          sprite.opacity = visualProps.opacity
        }
        sprite.zIndex = (this.originalTimelineItemData.config as any).zIndex

        // 应用音频属性
        const audioProps = getAudioPropsFromData(this.originalTimelineItemData)
        if (audioProps) {
          sprite.setAudioState({
            volume: audioProps.volume,
            isMuted: audioProps.isMuted,
          })
        }
      }

      applyVideoTransform(firstVideoSprite)
      applyVideoTransform(secondVideoSprite)
    } else if (mediaItem.mediaType === 'audio') {
      // 音频：只应用音频属性
      const firstAudioSprite = firstSprite as AudioVisibleSprite
      const secondAudioSprite = secondSprite as AudioVisibleSprite

      const applyAudioTransform = (sprite: AudioVisibleSprite) => {
        const audioProps = getAudioPropsFromData(this.originalTimelineItemData)
        if (audioProps) {
          sprite.setAudioState({
            volume: audioProps.volume,
            isMuted: audioProps.isMuted,
          })
        }
        // 应用增益设置（如果有的话）
        const config = this.originalTimelineItemData.config as any
        if (config.gain !== undefined) {
          sprite.setGain(config.gain)
        }
      }

      applyAudioTransform(firstAudioSprite)
      applyAudioTransform(secondAudioSprite)
    }

    // 5. 创建新的TimelineItem（先不设置缩略图）
    const firstItem: LocalTimelineItem = reactive({
      id: this.firstItemId,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: firstSprite.getTimeRange(),
      sprite: markRaw(firstSprite),
      thumbnailUrl: undefined, // 先设为undefined，稍后重新生成
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation ? { ...this.originalTimelineItemData.animation } : undefined,
      mediaName: this.originalTimelineItemData.mediaName,
    })

    const secondItem: LocalTimelineItem = reactive({
      id: this.secondItemId,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: secondSprite.getTimeRange(),
      sprite: markRaw(secondSprite),
      thumbnailUrl: undefined, // 先设为undefined，稍后重新生成
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation ? { ...this.originalTimelineItemData.animation } : undefined,
      mediaName: this.originalTimelineItemData.mediaName,
    })

    // 6. 重新生成缩略图（异步执行，不阻塞重建过程）
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
  private async rebuildOriginalItem(): Promise<LocalTimelineItem> {
    console.log('🔄 开始从源头重建原始时间轴项目...')

    // 1. 获取原始素材
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`原始素材不存在: ${this.originalTimelineItemData.mediaItemId}`)
    }

    // 检查素材是否已准备好并且是支持的类型
    if (!mediaItem.isReady) {
      throw new Error(`素材尚未解析完成: ${mediaItem.name}`)
    }

    if (mediaItem.mediaType === 'video' && !mediaItem.mp4Clip) {
      throw new Error(`视频素材解析失败: ${mediaItem.name}`)
    }

    if (mediaItem.mediaType === 'audio' && !mediaItem.audioClip) {
      throw new Error(`音频素材解析失败: ${mediaItem.name}`)
    }

    // 2. 从原始素材重新创建sprite
    const newSprite = await createSpriteFromMediaItem(mediaItem)

    // 3. 设置原始时间范围
    newSprite.setTimeRange(this.originalTimelineItemData.timeRange)

    // 4. 根据媒体类型应用相应的属性
    if (mediaItem.mediaType === 'video') {
      // 视频：应用视觉和音频属性
      const videoSprite = newSprite as VideoVisibleSprite
      const visualProps = getVisualPropsFromData(this.originalTimelineItemData)
      if (visualProps) {
        videoSprite.rect.x = visualProps.x
        videoSprite.rect.y = visualProps.y
        videoSprite.rect.w = visualProps.width
        videoSprite.rect.h = visualProps.height
        videoSprite.rect.angle = visualProps.rotation
        videoSprite.opacity = visualProps.opacity
      }
      videoSprite.zIndex = (this.originalTimelineItemData.config as any).zIndex

      // 应用音频属性
      const audioProps = getAudioPropsFromData(this.originalTimelineItemData)
      if (audioProps) {
        videoSprite.setAudioState({
          volume: audioProps.volume,
          isMuted: audioProps.isMuted,
        })
      }
    } else if (mediaItem.mediaType === 'audio') {
      // 音频：只应用音频属性
      const audioSprite = newSprite as AudioVisibleSprite

      const audioProps = getAudioPropsFromData(this.originalTimelineItemData)
      if (audioProps) {
        audioSprite.setAudioState({
          volume: audioProps.volume,
          isMuted: audioProps.isMuted,
        })
      }

      // 应用增益设置（如果有的话）
      const config = this.originalTimelineItemData.config as any
      if (config.gain !== undefined) {
        audioSprite.setGain(config.gain)
      }
    }

    // 5. 创建新的TimelineItem（先不设置缩略图）
    const newTimelineItem: LocalTimelineItem = reactive({
      id: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: newSprite.getTimeRange(),
      sprite: markRaw(newSprite),
      thumbnailUrl: undefined, // 先设为undefined，稍后重新生成
      config: { ...this.originalTimelineItemData.config },
      animation: this.originalTimelineItemData.animation ? { ...this.originalTimelineItemData.animation } : undefined,
      mediaName: this.originalTimelineItemData.mediaName,
    })

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
   * 为重建的原始项目重新生成缩略图
   * @param timelineItem 重建的时间轴项目
   * @param mediaItem 对应的媒体项目
   */
  private async regenerateThumbnailForOriginalItem(
    timelineItem: LocalTimelineItem,
    mediaItem: LocalMediaItem,
  ) {
    // 音频不需要缩略图
    if (mediaItem.mediaType === 'audio') {
      console.log('🎵 音频不需要缩略图，跳过生成')
      return
    }

    try {
      console.log('🖼️ 开始为重建的原始项目重新生成缩略图...')

      const { regenerateThumbnailForTimelineItem } = await import(
        '../../../utils/thumbnailGenerator'
      )
      const thumbnailUrl = await regenerateThumbnailForTimelineItem(timelineItem, mediaItem)

      if (thumbnailUrl) {
        timelineItem.thumbnailUrl = thumbnailUrl
        console.log('✅ 重建原始项目缩略图生成完成')
      }
    } catch (error) {
      console.error('❌ 重建原始项目缩略图生成失败:', error)
    }
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
      await this.webavModule.addSprite(firstItem.sprite)
      await this.webavModule.addSprite(secondItem.sprite)

      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.log(
        `🔪 已分割时间轴项目: ${mediaItem?.name || '未知素材'} 在 ${framesToTimecode(this.splitTimeFrames)}`,
      )
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
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
      await this.webavModule.addSprite(originalItem.sprite)

      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.log(`↩️ 已撤销分割时间轴项目: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.error(`❌ 撤销分割时间轴项目失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }

  /**
   * 为分割后的两个项目重新生成缩略图
   * @param firstItem 第一个分割片段
   * @param secondItem 第二个分割片段
   * @param mediaItem 对应的媒体项目
   */
  private async regenerateThumbnailsForSplitItems(
    firstItem: LocalTimelineItem,
    secondItem: LocalTimelineItem,
    mediaItem: LocalMediaItem,
  ) {
    // 音频不需要缩略图
    if (mediaItem.mediaType === 'audio') {
      console.log('🎵 音频不需要缩略图，跳过生成')
      return
    }

    try {
      console.log('🖼️ 开始为分割后的项目重新生成缩略图...')

      const { regenerateThumbnailForTimelineItem } = await import(
        '../../../utils/thumbnailGenerator'
      )

      // 为第一个片段生成缩略图
      const firstThumbnailUrl = await regenerateThumbnailForTimelineItem(firstItem, mediaItem)
      if (firstThumbnailUrl) {
        firstItem.thumbnailUrl = firstThumbnailUrl
        console.log('✅ 第一个分割片段缩略图生成完成')
      }

      // 为第二个片段生成缩略图
      const secondThumbnailUrl = await regenerateThumbnailForTimelineItem(secondItem, mediaItem)
      if (secondThumbnailUrl) {
        secondItem.thumbnailUrl = secondThumbnailUrl
        console.log('✅ 第二个分割片段缩略图生成完成')
      }
    } catch (error) {
      console.error('❌ 分割项目缩略图生成失败:', error)
    }
  }
}

/**
 * 添加轨道命令
 * 支持添加轨道的撤销/重做操作
 * 采用简单的添加/删除逻辑，不涉及WebAV对象重建
 */
export class AddTrackCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private newTrackId: string = '' // 新创建的轨道ID
  private trackData: Track // 保存轨道数据

  constructor(
    private trackType: TrackType, // 轨道类型
    private trackName: string | undefined, // 轨道名称（可选）
    private position: number | undefined, // 插入位置（可选）
    private trackModule: {
      addTrack: (type: TrackType, name?: string, position?: number) => Track
      removeTrack: (
        trackId: string,
        timelineItems: Ref<TimelineItem[]>,
        removeTimelineItemCallback?: (id: string) => void,
      ) => void
      getTrack: (trackId: string) => Track | undefined
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

      console.log(`✅ 已添加轨道: ${newTrack.name} (ID: ${newTrack.id}, 类型: ${newTrack.type}, 位置: ${this.position ?? '末尾'})`)
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
      getTrack: (trackId: string) => Track | undefined
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

/**
 * 删除轨道命令
 * 支持删除轨道的撤销/重做操作
 * 遵循"从源头重建"原则：保存轨道信息和所有受影响的时间轴项目信息，撤销时完全重建
 */
export class RemoveTrackCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private trackData: Track // 保存被删除的轨道数据
  private affectedTimelineItems: LocalTimelineItemData[] = [] // 保存被删除的时间轴项目的重建元数据

  constructor(
    private trackId: string,
    private trackModule: {
      addTrack: (type: TrackType, name?: string) => Track
      removeTrack: (
        trackId: string,
        timelineItems: Ref<LocalTimelineItem[]>,
        removeTimelineItemCallback?: (id: string) => void,
      ) => void
      getTrack: (trackId: string) => Track | undefined
      tracks: { value: Track[] }
    },
    private timelineModule: {
      addTimelineItem: (item: LocalTimelineItem) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => LocalTimelineItem | undefined
      setupBidirectionalSync: (item: LocalTimelineItem) => void
      timelineItems: { value: LocalTimelineItem[] }
    },
    private webavModule: {
      addSprite: (sprite: VisibleSprite) => Promise<boolean>
      removeSprite: (sprite: VisibleSprite) => boolean
    },
    private mediaModule: {
      getMediaItem: (id: string) => LocalMediaItem | undefined
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
    this.affectedTimelineItems = affectedItems.map((item) => {
      return createLocalTimelineItemData(item)
    })

    console.log(
      `📋 准备删除轨道: ${track.name}, 受影响的时间轴项目: ${this.affectedTimelineItems.length}个`,
    )
  }

  /**
   * 从原始素材重建时间轴项目
   */
  private async rebuildTimelineItem(itemData: LocalTimelineItemData): Promise<LocalTimelineItem> {
    // 特殊处理文本类型的时间轴项目
    if (itemData.mediaType === 'text') {
      return await this.rebuildTextTimelineItem(itemData as LocalTimelineItemData<'text'>)
    }

    const mediaItem = this.mediaModule.getMediaItem(itemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`找不到素材项目: ${itemData.mediaItemId}`)
    }

    // 检查素材是否已经解析完成
    if (!mediaItem.isReady || (!mediaItem.mp4Clip && !mediaItem.imgClip && !mediaItem.audioClip)) {
      throw new Error('素材还在解析中，无法重建')
    }

    // 根据媒体类型克隆对应的Clip
    const newSprite = await createSpriteFromMediaItem(mediaItem)

    // 设置时间范围
    if (mediaItem.mediaType === 'video' && isVideoTimeRange(itemData.timeRange)) {
      newSprite.setTimeRange({
        clipStartTime: itemData.timeRange.clipStartTime,
        clipEndTime: itemData.timeRange.clipEndTime,
        timelineStartTime: itemData.timeRange.timelineStartTime,
        timelineEndTime: itemData.timeRange.timelineEndTime,
      })
    } else if (mediaItem.mediaType === 'image' && isImageTimeRange(itemData.timeRange)) {
      newSprite.setTimeRange({
        timelineStartTime: itemData.timeRange.timelineStartTime,
        timelineEndTime: itemData.timeRange.timelineEndTime,
        displayDuration: itemData.timeRange.displayDuration,
      })
    } else if (mediaItem.mediaType === 'audio' && isVideoTimeRange(itemData.timeRange)) {
      // 音频使用与视频相同的时间范围结构
      newSprite.setTimeRange({
        clipStartTime: itemData.timeRange.clipStartTime,
        clipEndTime: itemData.timeRange.clipEndTime,
        timelineStartTime: itemData.timeRange.timelineStartTime,
        timelineEndTime: itemData.timeRange.timelineEndTime,
      })
    }

    // 设置变换属性（类型安全版本）
    const visualProps = getVisualPropsFromData(itemData)
    if (visualProps) {
      const rect = newSprite.rect
      rect.x = visualProps.x
      rect.y = visualProps.y
      rect.w = visualProps.width
      rect.h = visualProps.height
      rect.angle = visualProps.rotation
      newSprite.opacity = visualProps.opacity
    }

    // 设置其他属性
    newSprite.zIndex = (itemData.config as any).zIndex

    // 创建新的TimelineItem
    const newTimelineItem: LocalTimelineItem = reactive({
      id: itemData.id,
      mediaItemId: itemData.mediaItemId,
      trackId: itemData.trackId,
      mediaType: itemData.mediaType,
      timeRange: { ...itemData.timeRange },
      sprite: markRaw(newSprite),
      thumbnailUrl: undefined, // 运行时重新生成
      config: { ...itemData.config },
      animation: itemData.animation ? { ...itemData.animation } : undefined,
      mediaName: itemData.mediaName,
    })

    return newTimelineItem
  }

  /**
   * 重建文本时间轴项目
   */
  private async rebuildTextTimelineItem(itemData: LocalTimelineItemData<'text'>): Promise<LocalTimelineItem<'text'>> {
    console.log('🔄 [RemoveTrackCommand] 重建文本时间轴项目...')

    // 从保存的配置中获取文本内容和样式
    const textConfig = itemData.config as TextMediaConfig
    const text = textConfig.text
    const style = textConfig.style

    console.log('📝 [RemoveTrackCommand] 文本重建参数:', {
      text: text.substring(0, 20) + '...',
      style,
      timeRange: itemData.timeRange
    })

    // 动态导入TextVisibleSprite
    const { TextVisibleSprite } = await import('../../../utils/TextVisibleSprite')

    // 重新创建文本精灵
    const newSprite = await TextVisibleSprite.create(text, style)

    // 设置时间范围
    if (isImageTimeRange(itemData.timeRange)) {
      newSprite.setTimeRange({
        timelineStartTime: itemData.timeRange.timelineStartTime,
        timelineEndTime: itemData.timeRange.timelineEndTime,
        displayDuration: itemData.timeRange.displayDuration,
      })
    }

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
    const newTimelineItem: LocalTimelineItem<'text'> = reactive({
      id: itemData.id,
      mediaItemId: '', // 文本项目不需要媒体库项目
      trackId: itemData.trackId,
      mediaType: 'text',
      timeRange: { ...itemData.timeRange },
      sprite: markRaw(newSprite),
      thumbnailUrl: undefined, // 文本项目不需要缩略图
      config: { ...itemData.config },
      animation: itemData.animation ? { ...itemData.animation } : undefined,
      mediaName: itemData.mediaName,
    })

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

      console.log(
        `✅ 已删除轨道: ${this.trackData.name}, 删除了 ${this.affectedTimelineItems.length} 个时间轴项目`,
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

      // 2. 重建所有受影响的时间轴项目
      for (const itemData of this.affectedTimelineItems) {
        console.log(`🔄 重建时间轴项目: ${itemData.id}`)

        const newTimelineItem = await this.rebuildTimelineItem(itemData)

        // 添加到时间轴
        this.timelineModule.addTimelineItem(newTimelineItem)

        // 设置双向数据同步
        this.timelineModule.setupBidirectionalSync(newTimelineItem)

        // 添加sprite到WebAV画布
        await this.webavModule.addSprite(newTimelineItem.sprite)
      }

      console.log(
        `↩️ 已撤销删除轨道: ${this.trackData.name}, 恢复了 ${this.affectedTimelineItems.length} 个时间轴项目`,
      )
    } catch (error) {
      console.error(`❌ 撤销删除轨道失败: ${this.trackData.name}`, error)
      throw error
    }
  }
}

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
      getTrack: (trackId: string) => Track | undefined
      toggleTrackVisibility: (trackId: string, timelineItems?: Ref<LocalTimelineItem[]>) => void
    },
    private timelineModule: {
      timelineItems: { value: LocalTimelineItem[] }
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

/**
 * 切换轨道静音状态命令
 * 支持切换轨道静音状态的撤销/重做操作
 * 同时同步该轨道上所有视频时间轴项目的sprite静音状态
 */
export class ToggleTrackMuteCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private previousMuteState: boolean // 保存切换前的静音状态

  constructor(
    private trackId: string,
    private trackModule: {
      getTrack: (trackId: string) => Track | undefined
      toggleTrackMute: (trackId: string, timelineItems?: Ref<LocalTimelineItem[]>) => void
    },
    private timelineModule: {
      timelineItems: Ref<LocalTimelineItem[]>
    },
  ) {
    this.id = `toggle-track-mute-${trackId}-${Date.now()}`

    // 获取当前轨道信息
    const track = this.trackModule.getTrack(trackId)
    const trackName = track?.name || `轨道 ${trackId}`

    this.description = `切换轨道静音状态: ${trackName}`

    // 保存当前静音状态
    this.previousMuteState = track?.isMuted || false
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
      // 这会自动同步该轨道上所有视频TimelineItem的sprite静音状态
      this.trackModule.toggleTrackMute(this.trackId, this.timelineModule.timelineItems)

      const newMuteState = track.isMuted
      console.log(`✅ 已切换轨道静音状态: ${track.name}, 新状态: ${newMuteState ? '静音' : '有声'}`)
    } catch (error) {
      const track = this.trackModule.getTrack(this.trackId)
      console.error(`❌ 切换轨道静音状态失败: ${track?.name || `轨道 ${this.trackId}`}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复轨道静音状态
   */
  async undo(): Promise<void> {
    try {
      const track = this.trackModule.getTrack(this.trackId)
      if (!track) {
        throw new Error(`轨道不存在: ${this.trackId}`)
      }

      console.log(`🔄 撤销轨道静音状态操作: ${track.name}...`)

      // 如果当前状态与之前状态不同，则切换回去
      if (track.isMuted !== this.previousMuteState) {
        this.trackModule.toggleTrackMute(this.trackId, this.timelineModule.timelineItems)
      }

      console.log(
        `✅ 已撤销轨道静音状态: ${track.name}, 恢复状态: ${this.previousMuteState ? '静音' : '有声'}`,
      )
    } catch (error) {
      const track = this.trackModule.getTrack(this.trackId)
      console.error(`❌ 撤销轨道静音状态失败: ${track?.name || `轨道 ${this.trackId}`}`, error)
      throw error
    }
  }
}

/**
 * 调整时间轴项目大小命令
 * 支持时间范围调整（拖拽边缘）的撤销/重做操作
 * 保存调整前的时间范围，撤销时恢复原始时间范围
 */
export class ResizeTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimeRange: VideoTimeRange | ImageTimeRange
  private newTimeRange: VideoTimeRange | ImageTimeRange

  constructor(
    private timelineItemId: string,
    originalTimeRange: VideoTimeRange | ImageTimeRange, // 原始时间范围
    newTimeRange: VideoTimeRange | ImageTimeRange, // 新的时间范围
    private timelineModule: {
      getTimelineItem: (id: string) => LocalTimelineItem | undefined
    },
    private mediaModule: {
      getMediaItem: (id: string) => LocalMediaItem | undefined
    },
  ) {
    this.id = generateCommandId()

    // 保存原始和新的时间范围
    this.originalTimeRange = { ...originalTimeRange }
    this.newTimeRange = { ...newTimeRange }

    // 获取时间轴项目信息用于描述
    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    const mediaItem = timelineItem ? this.mediaModule.getMediaItem(timelineItem.mediaItemId) : null

    // 使用帧数计算时长，提供更精确的显示
    const originalDurationFrames =
      this.originalTimeRange.timelineEndTime - this.originalTimeRange.timelineStartTime
    const newDurationFrames =
      this.newTimeRange.timelineEndTime - this.newTimeRange.timelineStartTime
    const originalStartFrames = this.originalTimeRange.timelineStartTime
    const newStartFrames = this.newTimeRange.timelineStartTime

    this.description = `调整时间范围: ${mediaItem?.name || '未知素材'} (${framesToTimecode(originalDurationFrames)} → ${framesToTimecode(newDurationFrames)})`

    console.log(`📋 准备调整时间范围: ${mediaItem?.name || '未知素材'}`, {
      原始时长: framesToTimecode(originalDurationFrames),
      新时长: framesToTimecode(newDurationFrames),
      原始位置: framesToTimecode(originalStartFrames),
      新位置: framesToTimecode(newStartFrames),
    })
  }

  /**
   * 应用时间范围到sprite和timelineItem
   */
  private applyTimeRange(timeRange: VideoTimeRange | ImageTimeRange): void {
    const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!timelineItem) {
      throw new Error(`找不到时间轴项目: ${this.timelineItemId}`)
    }

    const sprite = timelineItem.sprite

    // 根据媒体类型设置时间范围（直接使用 timelineItem.mediaType，避免冗余的 MediaItem 获取）
    if (timelineItem.mediaType === 'video' && isVideoTimeRange(timeRange)) {
      // 视频类型：保持clipStartTime和clipEndTime，更新timeline时间
      sprite.setTimeRange({
        clipStartTime: timeRange.clipStartTime,
        clipEndTime: timeRange.clipEndTime,
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: timeRange.timelineEndTime,
      })
    } else if (timelineItem.mediaType === 'audio' && isVideoTimeRange(timeRange)) {
      // 音频类型：保持clipStartTime和clipEndTime，更新timeline时间（与视频相同）
      sprite.setTimeRange({
        clipStartTime: timeRange.clipStartTime,
        clipEndTime: timeRange.clipEndTime,
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: timeRange.timelineEndTime,
      })
    } else if (timelineItem.mediaType === 'image' && isImageTimeRange(timeRange)) {
      // 图片类型：设置displayDuration
      sprite.setTimeRange({
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: timeRange.timelineEndTime,
        displayDuration: timeRange.displayDuration,
      })
    } else if (timelineItem.mediaType === 'text' && isImageTimeRange(timeRange)) {
      // 文本类型：与图片类似，设置displayDuration
      sprite.setTimeRange({
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: timeRange.timelineEndTime,
        displayDuration: timeRange.displayDuration,
      })
    }

    // 同步timeRange到TimelineItem
    timelineItem.timeRange = sprite.getTimeRange()
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

/**
 * 选择时间轴项目命令
 * 支持单选和多选操作的撤销/重做
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
      selectedTimelineItemIds: Ref<Set<string>>
      selectTimelineItems: (itemIds: string[], mode: 'replace' | 'toggle') => void
      syncAVCanvasSelection: () => void
    },
    private timelineModule: {
      getTimelineItem: (id: string) => LocalTimelineItem | undefined
    },
    private mediaModule: {
      getMediaItem: (id: string) => LocalMediaItem | undefined
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
      const mediaItem = timelineItem
        ? this.mediaModule.getMediaItem(timelineItem.mediaItemId)
        : null
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

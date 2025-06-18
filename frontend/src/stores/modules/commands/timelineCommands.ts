import { generateCommandId } from '../../../utils/idGenerator'
import type { SimpleCommand } from '../historyModule'
import type { TimelineItem, MediaItem, Track } from '../../../types/videoTypes'
import { VideoVisibleSprite } from '../../../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../../../utils/ImageVisibleSprite'
import { useWebAVControls } from '../../../composables/useWebAVControls'
import { markRaw, reactive, type Ref } from 'vue'

/**
 * 添加时间轴项目命令
 * 支持添加时间轴项目的撤销/重做操作
 * 采用统一重建逻辑：每次执行都从原始素材重新创建sprite
 */
export class AddTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: any // 保存原始timelineItem数据用于重建

  constructor(
    timelineItem: TimelineItem, // 注意：不再保存timelineItem引用，只保存重建数据
    private timelineModule: {
      addTimelineItem: (item: TimelineItem) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private webavModule: {
      addSprite: (sprite: unknown) => void
      removeSprite: (sprite: unknown) => void
    },
    private mediaModule: {
      getMediaItem: (id: string) => MediaItem | undefined
    }
  ) {
    this.id = generateCommandId()
    const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
    this.description = `添加时间轴项目: ${mediaItem?.name || '未知素材'}`

    // 保存原始数据用于重建sprite
    this.originalTimelineItemData = {
      id: timelineItem.id,
      mediaItemId: timelineItem.mediaItemId,
      trackId: timelineItem.trackId,
      mediaType: timelineItem.mediaType,
      timeRange: { ...timelineItem.timeRange },
      position: { ...timelineItem.position },
      size: { ...timelineItem.size },
      rotation: timelineItem.rotation,
      zIndex: timelineItem.zIndex,
      opacity: timelineItem.opacity,
      thumbnailUrl: timelineItem.thumbnailUrl,
    }
  }

  /**
   * 从原始素材重建完整的TimelineItem
   * 统一重建逻辑：每次都从原始素材完全重新创建
   */
  private async rebuildTimelineItem(): Promise<TimelineItem> {
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
    const webAVControls = useWebAVControls()
    let newSprite: VideoVisibleSprite | ImageVisibleSprite

    if (mediaItem.mediaType === 'video') {
      if (!mediaItem.mp4Clip) {
        throw new Error('视频素材解析失败，无法重建sprite')
      }
      const clonedMP4Clip = await webAVControls.cloneMP4Clip(mediaItem.mp4Clip)
      newSprite = new VideoVisibleSprite(clonedMP4Clip)
    } else if (mediaItem.mediaType === 'image') {
      if (!mediaItem.imgClip) {
        throw new Error('图片素材解析失败，无法重建sprite')
      }
      const clonedImgClip = await webAVControls.cloneImgClip(mediaItem.imgClip)
      newSprite = new ImageVisibleSprite(clonedImgClip)
    } else {
      throw new Error('不支持的媒体类型')
    }

    // 3. 设置时间范围
    newSprite.setTimeRange(this.originalTimelineItemData.timeRange)

    // 4. 应用变换属性
    newSprite.rect.x = this.originalTimelineItemData.position.x
    newSprite.rect.y = this.originalTimelineItemData.position.y
    newSprite.rect.w = this.originalTimelineItemData.size.width
    newSprite.rect.h = this.originalTimelineItemData.size.height
    newSprite.rect.angle = this.originalTimelineItemData.rotation
    newSprite.zIndex = this.originalTimelineItemData.zIndex
    newSprite.opacity = this.originalTimelineItemData.opacity

    // 5. 创建新的TimelineItem
    const newTimelineItem: TimelineItem = reactive({
      id: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: newSprite.getTimeRange(),
      sprite: markRaw(newSprite),
      thumbnailUrl: this.originalTimelineItemData.thumbnailUrl,
      position: {
        x: this.originalTimelineItemData.position.x,
        y: this.originalTimelineItemData.position.y,
      },
      size: {
        width: this.originalTimelineItemData.size.width,
        height: this.originalTimelineItemData.size.height,
      },
      rotation: this.originalTimelineItemData.rotation,
      zIndex: this.originalTimelineItemData.zIndex,
      opacity: this.originalTimelineItemData.opacity,
      volume: this.originalTimelineItemData.volume,
      isMuted: this.originalTimelineItemData.isMuted,
    })

    console.log('🔄 重建时间轴项目完成:', {
      id: newTimelineItem.id,
      mediaType: mediaItem.mediaType,
      timeRange: this.originalTimelineItemData.timeRange,
      position: { x: newSprite.rect.x, y: newSprite.rect.y },
      size: { w: newSprite.rect.w, h: newSprite.rect.h }
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
      this.webavModule.addSprite(newTimelineItem.sprite)

      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.log(`✅ 已添加时间轴项目: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.error(`❌ 添加时间轴项目失败: ${mediaItem?.name || '未知素材'}`, error)
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
}

/**
 * 移除时间轴项目命令
 * 支持移除时间轴项目的撤销/重做操作
 * 遵循"从源头重建"原则：保存完整的重建元数据，撤销时从原始素材重新创建
 */
export class RemoveTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: any // 保存重建所需的完整元数据

  constructor(
    private timelineItemId: string,
    timelineItem: TimelineItem, // 要删除的时间轴项目
    private timelineModule: {
      addTimelineItem: (item: TimelineItem) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private webavModule: {
      addSprite: (sprite: unknown) => void
      removeSprite: (sprite: unknown) => void
    },
    private mediaModule: {
      getMediaItem: (id: string) => MediaItem | undefined
    }
  ) {
    this.id = generateCommandId()

    const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
    this.description = `移除时间轴项目: ${mediaItem?.name || '未知素材'}`

    // 🎯 关键：保存重建所需的完整元数据，而不是对象引用
    this.originalTimelineItemData = {
      id: timelineItem.id,
      mediaItemId: timelineItem.mediaItemId,
      trackId: timelineItem.trackId,
      mediaType: timelineItem.mediaType,
      // 深拷贝时间范围信息
      timeRange: {
        timelineStartTime: timelineItem.timeRange.timelineStartTime,
        timelineEndTime: timelineItem.timeRange.timelineEndTime,
        ...(timelineItem.mediaType === 'video' && 'clipStartTime' in timelineItem.timeRange ? {
          clipStartTime: timelineItem.timeRange.clipStartTime,
          clipEndTime: timelineItem.timeRange.clipEndTime,
          playbackRate: timelineItem.timeRange.playbackRate,
          effectiveDuration: timelineItem.timeRange.effectiveDuration,
        } : {}),
      },
      // 深拷贝变换属性
      position: {
        x: timelineItem.position.x,
        y: timelineItem.position.y,
      },
      size: {
        width: timelineItem.size.width,
        height: timelineItem.size.height,
      },
      rotation: timelineItem.rotation,
      zIndex: timelineItem.zIndex,
      opacity: timelineItem.opacity,
      thumbnailUrl: timelineItem.thumbnailUrl,
    }

    console.log('💾 保存删除项目的重建数据:', {
      id: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: this.originalTimelineItemData.timeRange,
      position: this.originalTimelineItemData.position,
      size: this.originalTimelineItemData.size,
    })
  }

  /**
   * 从原始素材重建sprite和timelineItem
   * 遵循"从源头重建"原则，每次都完全重新创建
   */
  private async rebuildTimelineItem(): Promise<TimelineItem> {
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
    const webAVControls = useWebAVControls()
    let newSprite: VideoVisibleSprite | ImageVisibleSprite

    if (mediaItem.mediaType === 'video') {
      if (!mediaItem.mp4Clip) {
        throw new Error('视频素材解析失败，无法重建sprite')
      }
      const clonedMP4Clip = await webAVControls.cloneMP4Clip(mediaItem.mp4Clip)
      newSprite = new VideoVisibleSprite(clonedMP4Clip)
    } else if (mediaItem.mediaType === 'image') {
      if (!mediaItem.imgClip) {
        throw new Error('图片素材解析失败，无法重建sprite')
      }
      const clonedImgClip = await webAVControls.cloneImgClip(mediaItem.imgClip)
      newSprite = new ImageVisibleSprite(clonedImgClip)
    } else {
      throw new Error('不支持的媒体类型')
    }

    // 3. 设置时间范围
    newSprite.setTimeRange(this.originalTimelineItemData.timeRange)

    // 4. 应用变换属性
    newSprite.rect.x = this.originalTimelineItemData.position.x
    newSprite.rect.y = this.originalTimelineItemData.position.y
    newSprite.rect.w = this.originalTimelineItemData.size.width
    newSprite.rect.h = this.originalTimelineItemData.size.height
    newSprite.rect.angle = this.originalTimelineItemData.rotation
    newSprite.zIndex = this.originalTimelineItemData.zIndex
    newSprite.opacity = this.originalTimelineItemData.opacity

    // 5. 创建新的TimelineItem
    const newTimelineItem: TimelineItem = reactive({
      id: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: this.originalTimelineItemData.timeRange,
      sprite: markRaw(newSprite),
      thumbnailUrl: this.originalTimelineItemData.thumbnailUrl,
      position: {
        x: this.originalTimelineItemData.position.x,
        y: this.originalTimelineItemData.position.y,
      },
      size: {
        width: this.originalTimelineItemData.size.width,
        height: this.originalTimelineItemData.size.height,
      },
      rotation: this.originalTimelineItemData.rotation,
      zIndex: this.originalTimelineItemData.zIndex,
      opacity: this.originalTimelineItemData.opacity,
      volume: this.originalTimelineItemData.volume,
      isMuted: this.originalTimelineItemData.isMuted,
    })

    console.log('🔄 重建时间轴项目完成:', {
      id: newTimelineItem.id,
      mediaType: mediaItem.mediaType,
      timeRange: this.originalTimelineItemData.timeRange,
      position: { x: newSprite.rect.x, y: newSprite.rect.y },
      size: { w: newSprite.rect.w, h: newSprite.rect.h }
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
      this.webavModule.addSprite(newTimelineItem.sprite)

      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.log(`↩️ 已撤销删除时间轴项目: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.error(`❌ 撤销删除时间轴项目失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
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
  private originalTimelineItemData: any // 保存原始项目的重建元数据
  public readonly newTimelineItemId: string // 新创建的项目ID

  constructor(
    private originalTimelineItemId: string,
    originalTimelineItem: TimelineItem, // 要复制的原始时间轴项目
    private newPosition: number, // 新项目的时间位置（秒）
    private timelineModule: {
      addTimelineItem: (item: TimelineItem) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => TimelineItem | undefined
      setupBidirectionalSync: (item: TimelineItem) => void
    },
    private webavModule: {
      addSprite: (sprite: unknown) => void
      removeSprite: (sprite: unknown) => void
    },
    private mediaModule: {
      getMediaItem: (id: string) => MediaItem | undefined
    }
  ) {
    this.id = generateCommandId()
    const mediaItem = this.mediaModule.getMediaItem(originalTimelineItem.mediaItemId)
    this.description = `复制时间轴项目: ${mediaItem?.name || '未知素材'}`

    // 保存原始项目的完整重建元数据
    this.originalTimelineItemData = {
      mediaItemId: originalTimelineItem.mediaItemId,
      trackId: originalTimelineItem.trackId,
      mediaType: originalTimelineItem.mediaType,
      timeRange: { ...originalTimelineItem.timeRange },
      position: { ...originalTimelineItem.position },
      size: { ...originalTimelineItem.size },
      rotation: originalTimelineItem.rotation,
      zIndex: originalTimelineItem.zIndex,
      opacity: originalTimelineItem.opacity,
      thumbnailUrl: originalTimelineItem.thumbnailUrl,
    }

    // 生成新项目的ID
    this.newTimelineItemId = `timeline_item_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * 从原始素材重建复制的时间轴项目
   */
  private async rebuildDuplicatedItem(): Promise<TimelineItem> {
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`找不到素材项目: ${this.originalTimelineItemData.mediaItemId}`)
    }

    // 检查素材是否已经解析完成
    if (!mediaItem.isReady || (!mediaItem.mp4Clip && !mediaItem.imgClip)) {
      throw new Error('素材还在解析中，无法复制')
    }

    // 根据媒体类型克隆对应的Clip
    const webAVControls = useWebAVControls()
    let newSprite: VideoVisibleSprite | ImageVisibleSprite

    if (mediaItem.mediaType === 'video' && mediaItem.mp4Clip) {
      const clonedClip = await webAVControls.cloneMP4Clip(mediaItem.mp4Clip)
      newSprite = new VideoVisibleSprite(clonedClip)
    } else if (mediaItem.mediaType === 'image' && mediaItem.imgClip) {
      const clonedClip = await webAVControls.cloneImgClip(mediaItem.imgClip)
      newSprite = new ImageVisibleSprite(clonedClip)
    } else {
      throw new Error('不支持的媒体类型或缺少对应的clip')
    }

    // 设置时间范围（调整到新位置）
    const originalTimeRange = this.originalTimelineItemData.timeRange
    const originalDuration = (originalTimeRange.timelineEndTime - originalTimeRange.timelineStartTime) / 1000000 // 转换为秒
    const newTimelineStartTime = this.newPosition * 1000000 // 转换为微秒
    const newTimelineEndTime = newTimelineStartTime + (originalDuration * 1000000)

    if (mediaItem.mediaType === 'video') {
      newSprite.setTimeRange({
        clipStartTime: originalTimeRange.clipStartTime || 0,
        clipEndTime: originalTimeRange.clipEndTime || mediaItem.duration * 1000000,
        timelineStartTime: newTimelineStartTime,
        timelineEndTime: newTimelineEndTime,
      })
    } else if (mediaItem.mediaType === 'image') {
      newSprite.setTimeRange({
        timelineStartTime: newTimelineStartTime,
        timelineEndTime: newTimelineEndTime,
        displayDuration: originalDuration * 1000000,
      })
    }

    // 设置变换属性
    const rect = newSprite.rect
    rect.x = this.originalTimelineItemData.position.x
    rect.y = this.originalTimelineItemData.position.y
    rect.w = this.originalTimelineItemData.size.width
    rect.h = this.originalTimelineItemData.size.height
    rect.angle = this.originalTimelineItemData.rotation

    // 设置其他属性
    newSprite.zIndex = this.originalTimelineItemData.zIndex
    newSprite.opacity = this.originalTimelineItemData.opacity

    // 创建新的TimelineItem
    const newTimelineItem: TimelineItem = reactive({
      id: this.newTimelineItemId,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: mediaItem.mediaType === 'video' ? {
        clipStartTime: originalTimeRange.clipStartTime || 0,
        clipEndTime: originalTimeRange.clipEndTime || mediaItem.duration * 1000000,
        timelineStartTime: newTimelineStartTime,
        timelineEndTime: newTimelineEndTime,
        effectiveDuration: originalDuration * 1000000,
        playbackRate: originalTimeRange.playbackRate || 1.0,
      } : {
        timelineStartTime: newTimelineStartTime,
        timelineEndTime: newTimelineEndTime,
        displayDuration: originalDuration * 1000000,
      },
      position: { ...this.originalTimelineItemData.position },
      size: { ...this.originalTimelineItemData.size },
      rotation: this.originalTimelineItemData.rotation,
      zIndex: this.originalTimelineItemData.zIndex,
      opacity: this.originalTimelineItemData.opacity,
      volume: this.originalTimelineItemData.volume,
      isMuted: this.originalTimelineItemData.isMuted,
      sprite: markRaw(newSprite),
      thumbnailUrl: this.originalTimelineItemData.thumbnailUrl,
    })

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
      this.webavModule.addSprite(newTimelineItem.sprite)

      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.log(`✅ 已复制时间轴项目: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.error(`❌ 复制时间轴项目失败: ${mediaItem?.name || '未知素材'}`, error)
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
    private oldPosition: number, // 旧的时间位置（秒）
    private newPosition: number, // 新的时间位置（秒）
    private oldTrackId: number, // 旧的轨道ID
    private newTrackId: number, // 新的轨道ID
    private timelineModule: {
      updateTimelineItemPosition: (id: string, position: number, trackId?: number) => void
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private mediaModule: {
      getMediaItem: (id: string) => MediaItem | undefined
    }
  ) {
    this.id = generateCommandId()

    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    const mediaItem = timelineItem ? this.mediaModule.getMediaItem(timelineItem.mediaItemId) : null

    // 生成描述信息
    const positionChanged = oldPosition !== newPosition
    const trackChanged = oldTrackId !== newTrackId

    if (positionChanged && trackChanged) {
      this.description = `移动时间轴项目: ${mediaItem?.name || '未知素材'} (位置: ${oldPosition.toFixed(2)}s→${newPosition.toFixed(2)}s, 轨道: ${oldTrackId}→${newTrackId})`
    } else if (positionChanged) {
      this.description = `移动时间轴项目: ${mediaItem?.name || '未知素材'} (位置: ${oldPosition.toFixed(2)}s→${newPosition.toFixed(2)}s)`
    } else if (trackChanged) {
      this.description = `移动时间轴项目: ${mediaItem?.name || '未知素材'} (轨道: ${oldTrackId}→${newTrackId})`
    } else {
      this.description = `移动时间轴项目: ${mediaItem?.name || '未知素材'} (无变化)`
    }

    console.log('💾 保存移动操作数据:', {
      timelineItemId,
      oldPosition,
      newPosition,
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
      this.timelineModule.updateTimelineItemPosition(this.timelineItemId, this.newPosition, trackIdToSet)

      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      console.log(`🔄 已移动时间轴项目: ${mediaItem?.name || '未知素材'} 到位置 ${this.newPosition.toFixed(2)}s, 轨道 ${this.newTrackId}`)
    } catch (error) {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem ? this.mediaModule.getMediaItem(timelineItem.mediaItemId) : null
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
      this.timelineModule.updateTimelineItemPosition(this.timelineItemId, this.oldPosition, trackIdToSet)

      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      console.log(`↩️ 已撤销移动时间轴项目: ${mediaItem?.name || '未知素材'} 回到位置 ${this.oldPosition.toFixed(2)}s, 轨道 ${this.oldTrackId}`)
    } catch (error) {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem ? this.mediaModule.getMediaItem(timelineItem.mediaItemId) : null
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
    private propertyType: 'position' | 'size' | 'rotation' | 'opacity' | 'zIndex' | 'duration' | 'playbackRate' | 'volume' | 'audioState' | 'multiple',
    private oldValues: {
      position?: { x: number; y: number }
      size?: { width: number; height: number }
      rotation?: number
      opacity?: number
      zIndex?: number
      duration?: number // 时长（秒）
      playbackRate?: number // 倍速
      volume?: number // 音量（0-1之间）
      isMuted?: boolean // 静音状态
    },
    private newValues: {
      position?: { x: number; y: number }
      size?: { width: number; height: number }
      rotation?: number
      opacity?: number
      zIndex?: number
      duration?: number // 时长（秒）
      playbackRate?: number // 倍速
      volume?: number // 音量（0-1之间）
      isMuted?: boolean // 静音状态
    },
    private timelineModule: {
      updateTimelineItemTransform: (id: string, transform: any) => void
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private mediaModule: {
      getMediaItem: (id: string) => MediaItem | undefined
    },
    private clipOperationsModule?: {
      updateTimelineItemPlaybackRate: (id: string, rate: number) => void
    }
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

    if (this.newValues.position && this.oldValues.position) {
      const oldPos = this.oldValues.position
      const newPos = this.newValues.position
      changes.push(`位置: (${oldPos.x.toFixed(0)}, ${oldPos.y.toFixed(0)}) → (${newPos.x.toFixed(0)}, ${newPos.y.toFixed(0)})`)
    }

    if (this.newValues.size && this.oldValues.size) {
      const oldSize = this.oldValues.size
      const newSize = this.newValues.size
      changes.push(`大小: ${oldSize.width.toFixed(0)}×${oldSize.height.toFixed(0)} → ${newSize.width.toFixed(0)}×${newSize.height.toFixed(0)}`)
    }

    if (this.newValues.rotation !== undefined && this.oldValues.rotation !== undefined) {
      // 将弧度转换为角度显示
      const oldDegrees = (this.oldValues.rotation * 180 / Math.PI).toFixed(1)
      const newDegrees = (this.newValues.rotation * 180 / Math.PI).toFixed(1)
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
      changes.push(`时长: ${this.oldValues.duration.toFixed(1)}s → ${this.newValues.duration.toFixed(1)}s`)
    }

    if (this.newValues.playbackRate !== undefined && this.oldValues.playbackRate !== undefined) {
      changes.push(`倍速: ${this.oldValues.playbackRate.toFixed(1)}x → ${this.newValues.playbackRate.toFixed(1)}x`)
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
        position: this.newValues.position,
        size: this.newValues.size,
        rotation: this.newValues.rotation,
        opacity: this.newValues.opacity,
        zIndex: this.newValues.zIndex,
      }

      // 过滤掉undefined的值
      const filteredTransform = Object.fromEntries(
        Object.entries(transformValues).filter(([_, value]) => value !== undefined)
      )

      if (Object.keys(filteredTransform).length > 0) {
        this.timelineModule.updateTimelineItemTransform(this.timelineItemId, filteredTransform)
      }

      // 处理倍速更新（仅对视频有效）
      if (this.newValues.playbackRate !== undefined && this.clipOperationsModule) {
        this.clipOperationsModule.updateTimelineItemPlaybackRate(this.timelineItemId, this.newValues.playbackRate)
      }

      // 处理时长更新（通过直接操作sprite的timeRange）
      if (this.newValues.duration !== undefined) {
        this.updateTimelineItemDuration(this.timelineItemId, this.newValues.duration)
      }

      // 处理音量更新（仅对视频有效）
      if (timelineItem.mediaType === 'video') {
        if (this.newValues.volume !== undefined) {
          timelineItem.volume = this.newValues.volume
          const sprite = timelineItem.sprite
          if (sprite && 'setVolume' in sprite) {
            ;(sprite as any).setVolume(this.newValues.volume)
          }
        }

        if (this.newValues.isMuted !== undefined) {
          timelineItem.isMuted = this.newValues.isMuted
          const sprite = timelineItem.sprite
          if (sprite && 'setMuted' in sprite) {
            ;(sprite as any).setMuted(this.newValues.isMuted)
          }
        }
      }

      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      console.log(`🎯 已更新变换属性: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem ? this.mediaModule.getMediaItem(timelineItem.mediaItemId) : null
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
        position: this.oldValues.position,
        size: this.oldValues.size,
        rotation: this.oldValues.rotation,
        opacity: this.oldValues.opacity,
        zIndex: this.oldValues.zIndex,
      }

      // 过滤掉undefined的值
      const filteredTransform = Object.fromEntries(
        Object.entries(transformValues).filter(([_, value]) => value !== undefined)
      )

      if (Object.keys(filteredTransform).length > 0) {
        this.timelineModule.updateTimelineItemTransform(this.timelineItemId, filteredTransform)
      }

      // 处理倍速恢复（仅对视频有效）
      if (this.oldValues.playbackRate !== undefined && this.clipOperationsModule) {
        this.clipOperationsModule.updateTimelineItemPlaybackRate(this.timelineItemId, this.oldValues.playbackRate)
      }

      // 处理时长恢复（通过直接操作sprite的timeRange）
      if (this.oldValues.duration !== undefined) {
        this.updateTimelineItemDuration(this.timelineItemId, this.oldValues.duration)
      }

      // 处理音量恢复（仅对视频有效）
      if (timelineItem.mediaType === 'video') {
        if (this.oldValues.volume !== undefined) {
          timelineItem.volume = this.oldValues.volume
          const sprite = timelineItem.sprite
          if (sprite && 'setVolume' in sprite) {
            ;(sprite as any).setVolume(this.oldValues.volume)
          }
        }

        if (this.oldValues.isMuted !== undefined) {
          timelineItem.isMuted = this.oldValues.isMuted
          const sprite = timelineItem.sprite
          if (sprite && 'setMuted' in sprite) {
            ;(sprite as any).setMuted(this.oldValues.isMuted)
          }
        }
      }

      const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
      console.log(`↩️ 已撤销变换属性更新: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem ? this.mediaModule.getMediaItem(timelineItem.mediaItemId) : null
      console.error(`❌ 撤销变换属性更新失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }

  /**
   * 更新时间轴项目的时长
   * @param timelineItemId 时间轴项目ID
   * @param newDuration 新的时长（秒）
   */
  private updateTimelineItemDuration(timelineItemId: string, newDuration: number): void {
    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    if (!timelineItem) return

    const sprite = timelineItem.sprite
    const timeRange = sprite.getTimeRange()
    const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)

    if (!mediaItem) return

    // 计算新的时间轴结束时间
    const newTimelineEndTime = timeRange.timelineStartTime + newDuration * 1000000

    if (timelineItem.mediaType === 'video') {
      // 对于视频，通过调整倍速来实现时长变化
      const videoTimeRange = timeRange as import('../../../utils/VideoVisibleSprite').VideoTimeRange

      // 更新sprite的时间范围
      sprite.setTimeRange({
        clipStartTime: videoTimeRange.clipStartTime || 0,
        clipEndTime: videoTimeRange.clipEndTime || mediaItem.duration * 1000000,
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: newTimelineEndTime,
      })
    } else if (timelineItem.mediaType === 'image') {
      // 对于图片，直接更新显示时长
      sprite.setTimeRange({
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: newTimelineEndTime,
        displayDuration: newDuration * 1000000,
      })
    }

    // 同步timeRange到TimelineItem
    timelineItem.timeRange = sprite.getTimeRange()
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
  private originalTimelineItemData: any // 保存原始项目的重建数据
  private firstItemId: string // 分割后第一个项目的ID
  private secondItemId: string // 分割后第二个项目的ID

  constructor(
    private originalTimelineItemId: string,
    originalTimelineItem: TimelineItem, // 要分割的原始时间轴项目
    private splitTime: number, // 分割时间点（秒）
    private timelineModule: {
      addTimelineItem: (item: TimelineItem) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private webavModule: {
      addSprite: (sprite: unknown) => void
      removeSprite: (sprite: unknown) => void
    },
    private mediaModule: {
      getMediaItem: (id: string) => MediaItem | undefined
    }
  ) {
    this.id = generateCommandId()

    const mediaItem = this.mediaModule.getMediaItem(originalTimelineItem.mediaItemId)
    this.description = `分割时间轴项目: ${mediaItem?.name || '未知素材'} (在 ${splitTime.toFixed(2)}s)`

    // 🎯 关键：保存原始项目的完整重建元数据
    this.originalTimelineItemData = {
      id: originalTimelineItem.id,
      mediaItemId: originalTimelineItem.mediaItemId,
      trackId: originalTimelineItem.trackId,
      mediaType: originalTimelineItem.mediaType,
      // 深拷贝时间范围信息
      timeRange: {
        timelineStartTime: originalTimelineItem.timeRange.timelineStartTime,
        timelineEndTime: originalTimelineItem.timeRange.timelineEndTime,
        ...(originalTimelineItem.mediaType === 'video' && 'clipStartTime' in originalTimelineItem.timeRange ? {
          clipStartTime: originalTimelineItem.timeRange.clipStartTime,
          clipEndTime: originalTimelineItem.timeRange.clipEndTime,
          playbackRate: originalTimelineItem.timeRange.playbackRate,
          effectiveDuration: originalTimelineItem.timeRange.effectiveDuration,
        } : {}),
      },
      // 深拷贝变换属性
      position: {
        x: originalTimelineItem.position.x,
        y: originalTimelineItem.position.y,
      },
      size: {
        width: originalTimelineItem.size.width,
        height: originalTimelineItem.size.height,
      },
      rotation: originalTimelineItem.rotation,
      zIndex: originalTimelineItem.zIndex,
      opacity: originalTimelineItem.opacity,
      volume: originalTimelineItem.volume,
      isMuted: originalTimelineItem.isMuted,
      thumbnailUrl: originalTimelineItem.thumbnailUrl,
    }

    // 生成分割后项目的ID
    this.firstItemId = Date.now().toString() + Math.random().toString(36).substring(2, 11)
    this.secondItemId = Date.now().toString() + Math.random().toString(36).substring(2, 11)

    console.log('💾 保存分割项目的重建数据:', {
      originalId: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      mediaType: this.originalTimelineItemData.mediaType,
      splitTime,
      timeRange: this.originalTimelineItemData.timeRange,
      firstItemId: this.firstItemId,
      secondItemId: this.secondItemId,
    })
  }

  /**
   * 从原始素材重建分割后的两个sprite和timelineItem
   * 遵循"从源头重建"原则，每次都完全重新创建
   */
  private async rebuildSplitItems(): Promise<{ firstItem: TimelineItem; secondItem: TimelineItem }> {
    console.log('🔄 开始从源头重建分割后的时间轴项目...')

    // 1. 获取原始素材
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`原始素材不存在: ${this.originalTimelineItemData.mediaItemId}`)
    }

    if (!mediaItem.isReady || !mediaItem.mp4Clip) {
      throw new Error(`素材尚未解析完成或不是视频: ${mediaItem.name}`)
    }

    // 2. 计算分割点的时间信息
    const originalTimeRange = this.originalTimelineItemData.timeRange
    const timelineStartTime = originalTimeRange.timelineStartTime / 1000000 // 转换为秒
    const timelineEndTime = originalTimeRange.timelineEndTime / 1000000 // 转换为秒
    const clipStartTime = originalTimeRange.clipStartTime / 1000000 // 转换为秒
    const clipEndTime = originalTimeRange.clipEndTime / 1000000 // 转换为秒

    // 计算分割点在素材中的相对位置
    const timelineDuration = timelineEndTime - timelineStartTime
    const relativeTimelineTime = this.splitTime - timelineStartTime
    const relativeRatio = relativeTimelineTime / timelineDuration
    const clipDuration = clipEndTime - clipStartTime
    const splitClipTime = clipStartTime + clipDuration * relativeRatio

    // 3. 从原始素材重新创建两个sprite
    const webAVControls = useWebAVControls()
    const firstClonedClip = await webAVControls.cloneMP4Clip(mediaItem.mp4Clip)
    const secondClonedClip = await webAVControls.cloneMP4Clip(mediaItem.mp4Clip)

    const firstSprite = new VideoVisibleSprite(firstClonedClip)
    firstSprite.setTimeRange({
      clipStartTime: clipStartTime * 1000000,
      clipEndTime: splitClipTime * 1000000,
      timelineStartTime: timelineStartTime * 1000000,
      timelineEndTime: this.splitTime * 1000000,
    })

    const secondSprite = new VideoVisibleSprite(secondClonedClip)
    secondSprite.setTimeRange({
      clipStartTime: splitClipTime * 1000000,
      clipEndTime: clipEndTime * 1000000,
      timelineStartTime: this.splitTime * 1000000,
      timelineEndTime: timelineEndTime * 1000000,
    })

    // 4. 应用变换属性到两个sprite
    const applyTransformToSprite = (sprite: VideoVisibleSprite) => {
      sprite.rect.x = this.originalTimelineItemData.position.x
      sprite.rect.y = this.originalTimelineItemData.position.y
      sprite.rect.w = this.originalTimelineItemData.size.width
      sprite.rect.h = this.originalTimelineItemData.size.height
      sprite.rect.angle = this.originalTimelineItemData.rotation
      sprite.zIndex = this.originalTimelineItemData.zIndex
      sprite.opacity = this.originalTimelineItemData.opacity
    }

    applyTransformToSprite(firstSprite)
    applyTransformToSprite(secondSprite)

    // 5. 创建新的TimelineItem
    const firstItem: TimelineItem = reactive({
      id: this.firstItemId,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: firstSprite.getTimeRange(),
      sprite: markRaw(firstSprite),
      thumbnailUrl: this.originalTimelineItemData.thumbnailUrl,
      position: {
        x: this.originalTimelineItemData.position.x,
        y: this.originalTimelineItemData.position.y,
      },
      size: {
        width: this.originalTimelineItemData.size.width,
        height: this.originalTimelineItemData.size.height,
      },
      rotation: this.originalTimelineItemData.rotation,
      zIndex: this.originalTimelineItemData.zIndex,
      opacity: this.originalTimelineItemData.opacity,
      volume: this.originalTimelineItemData.volume,
      isMuted: this.originalTimelineItemData.isMuted,
    })

    const secondItem: TimelineItem = reactive({
      id: this.secondItemId,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: secondSprite.getTimeRange(),
      sprite: markRaw(secondSprite),
      thumbnailUrl: this.originalTimelineItemData.thumbnailUrl,
      position: {
        x: this.originalTimelineItemData.position.x,
        y: this.originalTimelineItemData.position.y,
      },
      size: {
        width: this.originalTimelineItemData.size.width,
        height: this.originalTimelineItemData.size.height,
      },
      rotation: this.originalTimelineItemData.rotation,
      zIndex: this.originalTimelineItemData.zIndex,
      opacity: this.originalTimelineItemData.opacity,
      volume: this.originalTimelineItemData.volume,
      isMuted: this.originalTimelineItemData.isMuted,
    })

    console.log('🔄 重建分割项目完成:', {
      firstItemId: firstItem.id,
      secondItemId: secondItem.id,
      splitTime: this.splitTime,
      firstTimeRange: firstItem.timeRange,
      secondTimeRange: secondItem.timeRange,
    })

    return { firstItem, secondItem }
  }

  /**
   * 从原始素材重建原始项目
   * 用于撤销分割操作
   */
  private async rebuildOriginalItem(): Promise<TimelineItem> {
    console.log('🔄 开始从源头重建原始时间轴项目...')

    // 1. 获取原始素材
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`原始素材不存在: ${this.originalTimelineItemData.mediaItemId}`)
    }

    if (!mediaItem.isReady || !mediaItem.mp4Clip) {
      throw new Error(`素材尚未解析完成或不是视频: ${mediaItem.name}`)
    }

    // 2. 从原始素材重新创建sprite
    const webAVControls = useWebAVControls()
    const clonedMP4Clip = await webAVControls.cloneMP4Clip(mediaItem.mp4Clip)
    const newSprite = new VideoVisibleSprite(clonedMP4Clip)

    // 3. 设置原始时间范围
    newSprite.setTimeRange(this.originalTimelineItemData.timeRange)

    // 4. 应用变换属性
    newSprite.rect.x = this.originalTimelineItemData.position.x
    newSprite.rect.y = this.originalTimelineItemData.position.y
    newSprite.rect.w = this.originalTimelineItemData.size.width
    newSprite.rect.h = this.originalTimelineItemData.size.height
    newSprite.rect.angle = this.originalTimelineItemData.rotation
    newSprite.zIndex = this.originalTimelineItemData.zIndex
    newSprite.opacity = this.originalTimelineItemData.opacity

    // 5. 创建新的TimelineItem
    const newTimelineItem: TimelineItem = reactive({
      id: this.originalTimelineItemData.id,
      mediaItemId: this.originalTimelineItemData.mediaItemId,
      trackId: this.originalTimelineItemData.trackId,
      mediaType: this.originalTimelineItemData.mediaType,
      timeRange: newSprite.getTimeRange(),
      sprite: markRaw(newSprite),
      thumbnailUrl: this.originalTimelineItemData.thumbnailUrl,
      position: {
        x: this.originalTimelineItemData.position.x,
        y: this.originalTimelineItemData.position.y,
      },
      size: {
        width: this.originalTimelineItemData.size.width,
        height: this.originalTimelineItemData.size.height,
      },
      rotation: this.originalTimelineItemData.rotation,
      zIndex: this.originalTimelineItemData.zIndex,
      opacity: this.originalTimelineItemData.opacity,
      volume: this.originalTimelineItemData.volume,
      isMuted: this.originalTimelineItemData.isMuted,
    })

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
      this.webavModule.addSprite(firstItem.sprite)
      this.webavModule.addSprite(secondItem.sprite)

      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.log(`🔪 已分割时间轴项目: ${mediaItem?.name || '未知素材'} 在 ${this.splitTime.toFixed(2)}s`)
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
      this.webavModule.addSprite(originalItem.sprite)

      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.log(`↩️ 已撤销分割时间轴项目: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
      console.error(`❌ 撤销分割时间轴项目失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
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
  private newTrackId: number = 0 // 新创建的轨道ID
  private trackData: Track // 保存轨道数据

  constructor(
    private trackName: string | undefined, // 轨道名称（可选）
    private trackModule: {
      addTrack: (name?: string) => Track
      removeTrack: (trackId: number, timelineItems: any, removeTimelineItemCallback?: any) => void
      getTrack: (trackId: number) => Track | undefined
    }
  ) {
    this.id = generateCommandId()
    this.description = `添加轨道: ${trackName || '新轨道'}`

    // 预先计算新轨道ID（模拟trackModule的逻辑）
    // 注意：这里我们无法直接访问tracks数组，所以在execute时会获取实际的轨道数据
    this.newTrackId = 0 // 将在execute时设置
    this.trackData = {
      id: 0,
      name: '',
      isVisible: true,
      isMuted: false,
      height: 80,
    }
  }

  /**
   * 获取新创建的轨道ID
   */
  get createdTrackId(): number {
    return this.newTrackId
  }

  /**
   * 执行命令：添加轨道
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行添加轨道操作...`)

      // 调用trackModule的addTrack方法
      const newTrack = this.trackModule.addTrack(this.trackName)

      // 保存轨道数据用于撤销
      this.newTrackId = newTrack.id
      this.trackData = { ...newTrack }

      console.log(`✅ 已添加轨道: ${newTrack.name} (ID: ${newTrack.id})`)
    } catch (error) {
      console.error(`❌ 添加轨道失败: ${this.trackName || '新轨道'}`, error)
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
      this.trackModule.removeTrack(this.newTrackId, { value: [] } as any, undefined)

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
    private trackId: number,
    private newName: string,
    private trackModule: {
      renameTrack: (trackId: number, newName: string) => void
      getTrack: (trackId: number) => Track | undefined
    }
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
  private affectedTimelineItems: any[] = [] // 保存被删除的时间轴项目的重建元数据

  constructor(
    private trackId: number,
    private trackModule: {
      addTrack: (name?: string) => Track
      removeTrack: (trackId: number, timelineItems: any, removeTimelineItemCallback?: any) => void
      getTrack: (trackId: number) => Track | undefined
      tracks: { value: Track[] }
    },
    private timelineModule: {
      addTimelineItem: (item: TimelineItem) => void
      removeTimelineItem: (id: string) => void
      getTimelineItem: (id: string) => TimelineItem | undefined
      setupBidirectionalSync: (item: TimelineItem) => void
      timelineItems: { value: TimelineItem[] }
    },
    private webavModule: {
      addSprite: (sprite: unknown) => void
      removeSprite: (sprite: unknown) => void
    },
    private mediaModule: {
      getMediaItem: (id: string) => MediaItem | undefined
    }
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
    const affectedItems = this.timelineModule.timelineItems.value.filter(item => item.trackId === trackId)
    this.affectedTimelineItems = affectedItems.map(item => ({
      id: item.id,
      mediaItemId: item.mediaItemId,
      trackId: item.trackId,
      mediaType: item.mediaType,
      timeRange: { ...item.timeRange },
      position: { ...item.position },
      size: { ...item.size },
      rotation: item.rotation,
      zIndex: item.zIndex,
      opacity: item.opacity,
      volume: item.volume,
      isMuted: item.isMuted,
      thumbnailUrl: item.thumbnailUrl,
    }))

    console.log(`📋 准备删除轨道: ${track.name}, 受影响的时间轴项目: ${this.affectedTimelineItems.length}个`)
  }

  /**
   * 从原始素材重建时间轴项目
   */
  private async rebuildTimelineItem(itemData: any): Promise<TimelineItem> {
    const mediaItem = this.mediaModule.getMediaItem(itemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`找不到素材项目: ${itemData.mediaItemId}`)
    }

    // 检查素材是否已经解析完成
    if (!mediaItem.isReady || (!mediaItem.mp4Clip && !mediaItem.imgClip)) {
      throw new Error('素材还在解析中，无法重建')
    }

    // 根据媒体类型克隆对应的Clip
    const webAVControls = useWebAVControls()
    let newSprite: VideoVisibleSprite | ImageVisibleSprite

    if (mediaItem.mediaType === 'video' && mediaItem.mp4Clip) {
      const clonedClip = await webAVControls.cloneMP4Clip(mediaItem.mp4Clip)
      newSprite = new VideoVisibleSprite(clonedClip)
    } else if (mediaItem.mediaType === 'image' && mediaItem.imgClip) {
      const clonedClip = await webAVControls.cloneImgClip(mediaItem.imgClip)
      newSprite = new ImageVisibleSprite(clonedClip)
    } else {
      throw new Error('不支持的媒体类型或缺少对应的clip')
    }

    // 设置时间范围
    if (mediaItem.mediaType === 'video') {
      newSprite.setTimeRange({
        clipStartTime: itemData.timeRange.clipStartTime || 0,
        clipEndTime: itemData.timeRange.clipEndTime || mediaItem.duration * 1000000,
        timelineStartTime: itemData.timeRange.timelineStartTime,
        timelineEndTime: itemData.timeRange.timelineEndTime,
      })
    } else if (mediaItem.mediaType === 'image') {
      newSprite.setTimeRange({
        timelineStartTime: itemData.timeRange.timelineStartTime,
        timelineEndTime: itemData.timeRange.timelineEndTime,
        displayDuration: itemData.timeRange.displayDuration,
      })
    }

    // 设置变换属性
    const rect = newSprite.rect
    rect.x = itemData.position.x
    rect.y = itemData.position.y
    rect.w = itemData.size.width
    rect.h = itemData.size.height
    rect.angle = itemData.rotation

    // 设置其他属性
    newSprite.zIndex = itemData.zIndex
    newSprite.opacity = itemData.opacity

    // 创建新的TimelineItem
    const newTimelineItem: TimelineItem = reactive({
      id: itemData.id,
      mediaItemId: itemData.mediaItemId,
      trackId: itemData.trackId,
      mediaType: itemData.mediaType,
      timeRange: mediaItem.mediaType === 'video' ? {
        clipStartTime: itemData.timeRange.clipStartTime || 0,
        clipEndTime: itemData.timeRange.clipEndTime || mediaItem.duration * 1000000,
        timelineStartTime: itemData.timeRange.timelineStartTime,
        timelineEndTime: itemData.timeRange.timelineEndTime,
        effectiveDuration: itemData.timeRange.effectiveDuration,
        playbackRate: itemData.timeRange.playbackRate || 1.0,
      } : {
        timelineStartTime: itemData.timeRange.timelineStartTime,
        timelineEndTime: itemData.timeRange.timelineEndTime,
        displayDuration: itemData.timeRange.displayDuration,
      },
      position: { ...itemData.position },
      size: { ...itemData.size },
      rotation: itemData.rotation,
      zIndex: itemData.zIndex,
      opacity: itemData.opacity,
      volume: itemData.volume,
      isMuted: itemData.isMuted,
      sprite: markRaw(newSprite),
      thumbnailUrl: itemData.thumbnailUrl,
    })

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
        this.timelineModule.timelineItems,
        this.timelineModule.removeTimelineItem
      )

      console.log(`✅ 已删除轨道: ${this.trackData.name}, 删除了 ${this.affectedTimelineItems.length} 个时间轴项目`)
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
      const insertIndex = tracks.findIndex(track => track.id > this.trackData.id)
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
        this.webavModule.addSprite(newTimelineItem.sprite)
      }

      console.log(`↩️ 已撤销删除轨道: ${this.trackData.name}, 恢复了 ${this.affectedTimelineItems.length} 个时间轴项目`)
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
    private trackId: number,
    private trackModule: {
      getTrack: (trackId: number) => Track | undefined
      toggleTrackVisibility: (trackId: number, timelineItems?: any) => void
    },
    private timelineModule: {
      timelineItems: { value: TimelineItem[] }
    }
  ) {
    this.id = generateCommandId()

    // 获取轨道信息
    const track = this.trackModule.getTrack(trackId)
    if (!track) {
      throw new Error(`找不到轨道: ${trackId}`)
    }

    this.previousVisibility = track.isVisible
    this.description = `${track.isVisible ? '隐藏' : '显示'}轨道: ${track.name}`

    console.log(`📋 准备切换轨道可见性: ${track.name}, 当前状态: ${track.isVisible ? '可见' : '隐藏'}`)
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
      this.trackModule.toggleTrackVisibility(this.trackId, this.timelineModule.timelineItems)

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
        this.trackModule.toggleTrackVisibility(this.trackId, this.timelineModule.timelineItems)
      }

      console.log(`↩️ 已撤销切换轨道可见性: ${track.name}, 恢复状态: ${this.previousVisibility ? '可见' : '隐藏'}`)
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
    private trackId: number,
    private trackModule: {
      getTrack: (trackId: number) => Track | undefined
      toggleTrackMute: (trackId: number, timelineItems?: Ref<TimelineItem[]>) => void
    },
    private timelineModule: {
      timelineItems: Ref<TimelineItem[]>
    }
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

      console.log(`✅ 已撤销轨道静音状态: ${track.name}, 恢复状态: ${this.previousMuteState ? '静音' : '有声'}`)
    } catch (error) {
      const track = this.trackModule.getTrack(this.trackId)
      console.error(`❌ 撤销轨道静音状态失败: ${track?.name || `轨道 ${this.trackId}`}`, error)
      throw error
    }
  }
}

/**
 * 自动排列轨道命令
 * 支持单轨道自动排列的撤销/重做操作
 * 保存排列前的所有时间轴项目位置，撤销时恢复原始位置
 */
export class AutoArrangeTrackCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalPositions: Map<string, { timelineStartTime: number; timelineEndTime: number }> = new Map()
  private affectedItemIds: string[] = []

  constructor(
    private trackId: number,
    private timelineModule: {
      timelineItems: { value: TimelineItem[] }
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private trackModule: {
      getTrack: (trackId: number) => Track | undefined
    }
  ) {
    this.id = generateCommandId()

    // 获取轨道信息
    const track = this.trackModule.getTrack(trackId)
    this.description = `自动排列轨道: ${track?.name || `轨道 ${trackId}`}`

    // 获取该轨道的所有时间轴项目
    const trackItems = this.timelineModule.timelineItems.value.filter(item => item.trackId === trackId)

    if (trackItems.length === 0) {
      console.log(`⚠️ 轨道 ${trackId} 没有片段需要整理`)
      return
    }

    // 保存原始位置
    trackItems.forEach(item => {
      const timeRange = item.sprite.getTimeRange()
      this.originalPositions.set(item.id, {
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: timeRange.timelineEndTime,
      })
      this.affectedItemIds.push(item.id)
    })

    console.log(`📋 准备自动排列轨道: ${track?.name || `轨道 ${trackId}`}, 受影响的项目: ${this.affectedItemIds.length}个`)
  }

  /**
   * 执行命令：自动排列轨道上的所有时间轴项目
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行自动排列轨道操作: 轨道 ${this.trackId}...`)

      // 获取该轨道的所有项目
      const trackItems = this.timelineModule.timelineItems.value.filter(item => item.trackId === this.trackId)

      if (trackItems.length === 0) {
        console.log(`⚠️ 轨道 ${this.trackId} 没有片段需要整理`)
        return
      }

      // 按时间轴开始时间排序
      const sortedItems = trackItems.sort((a, b) => {
        const rangeA = a.sprite.getTimeRange()
        const rangeB = b.sprite.getTimeRange()
        return rangeA.timelineStartTime - rangeB.timelineStartTime
      })

      let currentPosition = 0
      for (const item of sortedItems) {
        const sprite = item.sprite
        const timeRange = sprite.getTimeRange()
        const duration = (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000 // 转换为秒

        // 更新时间轴位置 - 根据媒体类型设置不同的时间范围
        if (item.mediaType === 'video' && 'clipStartTime' in timeRange) {
          sprite.setTimeRange({
            clipStartTime: timeRange.clipStartTime,
            clipEndTime: timeRange.clipEndTime,
            timelineStartTime: currentPosition * 1000000, // 转换为微秒
            timelineEndTime: (currentPosition + duration) * 1000000,
          })
        } else {
          // 图片类型
          sprite.setTimeRange({
            timelineStartTime: currentPosition * 1000000, // 转换为微秒
            timelineEndTime: (currentPosition + duration) * 1000000,
            displayDuration: duration * 1000000,
          })
        }

        // 从sprite获取更新后的完整timeRange（包含自动计算的effectiveDuration）
        item.timeRange = sprite.getTimeRange()
        currentPosition += duration
      }

      const track = this.trackModule.getTrack(this.trackId)
      console.log(`✅ 轨道 ${track?.name || `轨道 ${this.trackId}`} 的片段自动整理完成，共整理 ${sortedItems.length} 个片段`)
    } catch (error) {
      const track = this.trackModule.getTrack(this.trackId)
      console.error(`❌ 自动排列轨道失败: ${track?.name || `轨道 ${this.trackId}`}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：恢复所有时间轴项目的原始位置
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销自动排列轨道操作：恢复轨道 ${this.trackId} 的原始布局...`)

      // 恢复每个项目的原始位置
      for (const itemId of this.affectedItemIds) {
        const item = this.timelineModule.getTimelineItem(itemId)
        const originalPosition = this.originalPositions.get(itemId)

        if (!item || !originalPosition) {
          console.warn(`⚠️ 无法找到项目或原始位置: ${itemId}`)
          continue
        }

        const sprite = item.sprite
        const currentTimeRange = sprite.getTimeRange()

        // 根据媒体类型恢复时间范围
        if (item.mediaType === 'video' && 'clipStartTime' in currentTimeRange) {
          sprite.setTimeRange({
            clipStartTime: currentTimeRange.clipStartTime,
            clipEndTime: currentTimeRange.clipEndTime,
            timelineStartTime: originalPosition.timelineStartTime,
            timelineEndTime: originalPosition.timelineEndTime,
          })
        } else {
          // 图片类型
          const duration = originalPosition.timelineEndTime - originalPosition.timelineStartTime
          sprite.setTimeRange({
            timelineStartTime: originalPosition.timelineStartTime,
            timelineEndTime: originalPosition.timelineEndTime,
            displayDuration: duration,
          })
        }

        // 从sprite获取更新后的完整timeRange
        item.timeRange = sprite.getTimeRange()
      }

      const track = this.trackModule.getTrack(this.trackId)
      console.log(`↩️ 已撤销自动排列轨道: ${track?.name || `轨道 ${this.trackId}`}, 恢复了 ${this.affectedItemIds.length} 个项目的位置`)
    } catch (error) {
      const track = this.trackModule.getTrack(this.trackId)
      console.error(`❌ 撤销自动排列轨道失败: ${track?.name || `轨道 ${this.trackId}`}`, error)
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
  private originalTimeRange: { timelineStartTime: number; timelineEndTime: number; [key: string]: any }
  private newTimeRange: { timelineStartTime: number; timelineEndTime: number; [key: string]: any }

  constructor(
    private timelineItemId: string,
    originalTimeRange: any, // 原始时间范围
    newTimeRange: any, // 新的时间范围
    private timelineModule: {
      getTimelineItem: (id: string) => TimelineItem | undefined
    },
    private mediaModule: {
      getMediaItem: (id: string) => MediaItem | undefined
    }
  ) {
    this.id = generateCommandId()

    // 保存原始和新的时间范围
    this.originalTimeRange = { ...originalTimeRange }
    this.newTimeRange = { ...newTimeRange }

    // 获取时间轴项目信息用于描述
    const timelineItem = this.timelineModule.getTimelineItem(timelineItemId)
    const mediaItem = timelineItem ? this.mediaModule.getMediaItem(timelineItem.mediaItemId) : null

    const originalDuration = (this.originalTimeRange.timelineEndTime - this.originalTimeRange.timelineStartTime) / 1000000
    const newDuration = (this.newTimeRange.timelineEndTime - this.newTimeRange.timelineStartTime) / 1000000

    this.description = `调整时间范围: ${mediaItem?.name || '未知素材'} (${originalDuration.toFixed(2)}s → ${newDuration.toFixed(2)}s)`

    console.log(`📋 准备调整时间范围: ${mediaItem?.name || '未知素材'}`, {
      原始时长: originalDuration.toFixed(2) + 's',
      新时长: newDuration.toFixed(2) + 's',
      原始位置: (this.originalTimeRange.timelineStartTime / 1000000).toFixed(2) + 's',
      新位置: (this.newTimeRange.timelineStartTime / 1000000).toFixed(2) + 's',
    })
  }

  /**
   * 应用时间范围到sprite和timelineItem
   */
  private applyTimeRange(timeRange: any): void {
    const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
    if (!timelineItem) {
      throw new Error(`找不到时间轴项目: ${this.timelineItemId}`)
    }

    const sprite = timelineItem.sprite
    const mediaItem = this.mediaModule.getMediaItem(timelineItem.mediaItemId)
    if (!mediaItem) {
      throw new Error(`找不到素材项目: ${timelineItem.mediaItemId}`)
    }

    // 根据媒体类型设置时间范围
    if (mediaItem.mediaType === 'video') {
      // 视频类型：保持clipStartTime和clipEndTime，更新timeline时间
      sprite.setTimeRange({
        clipStartTime: timeRange.clipStartTime || 0,
        clipEndTime: timeRange.clipEndTime || mediaItem.duration * 1000000,
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: timeRange.timelineEndTime,
      })
    } else if (mediaItem.mediaType === 'image') {
      // 图片类型：设置displayDuration
      const duration = timeRange.timelineEndTime - timeRange.timelineStartTime
      sprite.setTimeRange({
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: timeRange.timelineEndTime,
        displayDuration: duration,
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
      const mediaItem = timelineItem ? this.mediaModule.getMediaItem(timelineItem.mediaItemId) : null
      const newDuration = (this.newTimeRange.timelineEndTime - this.newTimeRange.timelineStartTime) / 1000000

      console.log(`✅ 已调整时间范围: ${mediaItem?.name || '未知素材'} → ${newDuration.toFixed(2)}s`)
    } catch (error) {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem ? this.mediaModule.getMediaItem(timelineItem.mediaItemId) : null
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
      const mediaItem = timelineItem ? this.mediaModule.getMediaItem(timelineItem.mediaItemId) : null
      const originalDuration = (this.originalTimeRange.timelineEndTime - this.originalTimeRange.timelineStartTime) / 1000000

      console.log(`↩️ 已撤销调整时间范围: ${mediaItem?.name || '未知素材'} → ${originalDuration.toFixed(2)}s`)
    } catch (error) {
      const timelineItem = this.timelineModule.getTimelineItem(this.timelineItemId)
      const mediaItem = timelineItem ? this.mediaModule.getMediaItem(timelineItem.mediaItemId) : null
      console.error(`❌ 撤销调整时间范围失败: ${mediaItem?.name || '未知素材'}`, error)
      throw error
    }
  }
}

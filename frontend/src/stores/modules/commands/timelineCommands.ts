import { generateCommandId } from '../../../utils/idGenerator'
import type { SimpleCommand } from '../historyModule'
import type { TimelineItem, MediaItem } from '../../../types/videoTypes'
import { CustomVisibleSprite } from '../../../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../../../utils/ImageVisibleSprite'
import { useWebAVControls } from '../../../composables/useWebAVControls'
import { markRaw, reactive } from 'vue'

/**
 * 添加时间轴项目命令
 * 支持添加时间轴项目的撤销/重做操作
 */
export class AddTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private isFirstExecution = true // 标记是否为首次执行
  private originalTimelineItemData: any // 保存原始timelineItem数据用于重建

  constructor(
    private timelineItem: TimelineItem,
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
   * 重建sprite（用于重做时）
   */
  private async rebuildSprite(): Promise<void> {
    const mediaItem = this.mediaModule.getMediaItem(this.originalTimelineItemData.mediaItemId)
    if (!mediaItem) {
      throw new Error('媒体项目不存在，无法重建sprite')
    }

    const webAVControls = useWebAVControls()
    let newSprite: CustomVisibleSprite | ImageVisibleSprite

    if (mediaItem.mediaType === 'video') {
      if (!mediaItem.mp4Clip) {
        throw new Error('视频素材解析失败，无法重建sprite')
      }
      const clonedMP4Clip = await webAVControls.cloneMP4Clip(mediaItem.mp4Clip)
      newSprite = new CustomVisibleSprite(clonedMP4Clip)
    } else if (mediaItem.mediaType === 'image') {
      if (!mediaItem.imgClip) {
        throw new Error('图片素材解析失败，无法重建sprite')
      }
      const clonedImgClip = await webAVControls.cloneImgClip(mediaItem.imgClip)
      newSprite = new ImageVisibleSprite(clonedImgClip)
    } else {
      throw new Error('不支持的媒体类型')
    }

    // 恢复sprite的时间范围和变换属性
    newSprite.setTimeRange(this.originalTimelineItemData.timeRange)

    // 恢复变换属性
    newSprite.rect.x = this.timelineItem.sprite.rect.x
    newSprite.rect.y = this.timelineItem.sprite.rect.y
    newSprite.rect.w = this.originalTimelineItemData.size.width
    newSprite.rect.h = this.originalTimelineItemData.size.height
    newSprite.rect.angle = this.originalTimelineItemData.rotation
    newSprite.zIndex = this.originalTimelineItemData.zIndex
    newSprite.opacity = this.originalTimelineItemData.opacity

    // 更新timelineItem的sprite引用
    this.timelineItem.sprite = markRaw(newSprite)

    console.log('🔄 重建sprite完成:', {
      mediaType: mediaItem.mediaType,
      timeRange: this.originalTimelineItemData.timeRange,
      position: { x: newSprite.rect.x, y: newSprite.rect.y },
      size: { w: newSprite.rect.w, h: newSprite.rect.h }
    })
  }

  /**
   * 执行命令：添加时间轴项目
   */
  async execute(): Promise<void> {
    try {
      // 如果不是首次执行（即重做），需要重建sprite
      if (!this.isFirstExecution) {
        console.log(`🔄 重做操作：重建sprite...`)
        await this.rebuildSprite()
      }

      // 1. 添加到时间轴
      this.timelineModule.addTimelineItem(this.timelineItem)

      // 2. 只有在重做时才需要添加sprite到WebAV画布
      // 首次执行时，sprite已经在Timeline.vue中添加到画布了
      if (!this.isFirstExecution) {
        this.webavModule.addSprite(this.timelineItem.sprite)
        console.log(`🔄 重做时添加sprite到WebAV画布`)
      }

      // 标记已经执行过一次
      this.isFirstExecution = false

      const mediaItem = this.mediaModule.getMediaItem(this.timelineItem.mediaItemId)
      console.log(`✅ 已添加时间轴项目: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(this.timelineItem.mediaItemId)
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
      const existingItem = this.timelineModule.getTimelineItem(this.timelineItem.id)
      if (!existingItem) {
        console.warn(`⚠️ 时间轴项目不存在，无法撤销: ${this.timelineItem.id}`)
        return
      }

      // 移除时间轴项目（这会自动处理sprite的清理）
      this.timelineModule.removeTimelineItem(this.timelineItem.id)
      const mediaItem = this.mediaModule.getMediaItem(this.timelineItem.mediaItemId)
      console.log(`↩️ 已撤销添加时间轴项目: ${mediaItem?.name || '未知素材'}`)
    } catch (error) {
      const mediaItem = this.mediaModule.getMediaItem(this.timelineItem.mediaItemId)
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
          playbackSpeed: timelineItem.timeRange.playbackSpeed,
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
    let newSprite: CustomVisibleSprite | ImageVisibleSprite

    if (mediaItem.mediaType === 'video') {
      if (!mediaItem.mp4Clip) {
        throw new Error('视频素材解析失败，无法重建sprite')
      }
      const clonedMP4Clip = await webAVControls.cloneMP4Clip(mediaItem.mp4Clip)
      newSprite = new CustomVisibleSprite(clonedMP4Clip)
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
    private propertyType: 'position' | 'size' | 'rotation' | 'opacity' | 'zIndex' | 'duration' | 'playbackRate' | 'multiple',
    private oldValues: {
      position?: { x: number; y: number }
      size?: { width: number; height: number }
      rotation?: number
      opacity?: number
      zIndex?: number
      duration?: number // 时长（秒）
      playbackRate?: number // 倍速
    },
    private newValues: {
      position?: { x: number; y: number }
      size?: { width: number; height: number }
      rotation?: number
      opacity?: number
      zIndex?: number
      duration?: number // 时长（秒）
      playbackRate?: number // 倍速
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
      const newPlaybackRate = mediaItem.duration / newDuration
      const clampedRate = Math.max(0.1, Math.min(100, newPlaybackRate))

      // 更新sprite的时间范围
      sprite.setTimeRange({
        clipStartTime: timeRange.clipStartTime || 0,
        clipEndTime: timeRange.clipEndTime || mediaItem.duration * 1000000,
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

    const firstSprite = new CustomVisibleSprite(firstClonedClip)
    firstSprite.setTimeRange({
      clipStartTime: clipStartTime * 1000000,
      clipEndTime: splitClipTime * 1000000,
      timelineStartTime: timelineStartTime * 1000000,
      timelineEndTime: this.splitTime * 1000000,
    })

    const secondSprite = new CustomVisibleSprite(secondClonedClip)
    secondSprite.setTimeRange({
      clipStartTime: splitClipTime * 1000000,
      clipEndTime: clipEndTime * 1000000,
      timelineStartTime: this.splitTime * 1000000,
      timelineEndTime: timelineEndTime * 1000000,
    })

    // 4. 应用变换属性到两个sprite
    const applyTransformToSprite = (sprite: CustomVisibleSprite) => {
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
    const newSprite = new CustomVisibleSprite(clonedMP4Clip)

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

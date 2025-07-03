/**
 * 音频相关的命令实现
 * 包含添加音频项目、更新音频属性等命令
 */

import { reactive, markRaw } from 'vue'
import type { SimpleCommand } from '../../../types'
import type { TimelineItem, AudioMediaConfig, VideoTimeRange, MediaItem } from '../../../types'
import { AudioVisibleSprite } from '../../../utils/AudioVisibleSprite'
import { generateId, generateCommandId } from '../../../utils/idGenerator'

// ==================== 添加音频项目命令 ====================

/**
 * 添加音频项目到时间轴的命令
 */
export class AddAudioItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private audioItem: TimelineItem<'audio'> | null = null

  constructor(
    private mediaItemId: string,
    private startTimeFrames: number,
    private trackId: string,
    private timelineModule: any,
    private webavModule: any,
    private duration?: number
  ) {
    this.id = generateCommandId()
    this.description = `添加音频项目`
  }

  async execute(): Promise<void> {
    try {
      console.log(`🔄 [AddAudioItemCommand] 执行添加音频操作...`)

      // 1. 获取媒体库项目
      const mediaItem = this.timelineModule.getMediaItem(this.mediaItemId)
      if (!mediaItem || mediaItem.mediaType !== 'audio') {
        throw new Error(`音频文件不存在: ${this.mediaItemId}`)
      }

      // 2. 创建音频时间轴项目
      this.audioItem = await createAudioTimelineItem(
        this.mediaItemId,
        this.startTimeFrames,
        this.trackId,
        this.duration,
        mediaItem
      )

      // 3. 添加到时间轴
      this.timelineModule.addTimelineItem(this.audioItem)

      // 4. 添加到WebAV画布
      this.webavModule.addSprite(this.audioItem.sprite)

      console.log(`✅ [AddAudioItemCommand] 音频项目添加成功:`, {
        id: this.audioItem.id,
        mediaItemId: this.mediaItemId,
        startTime: this.startTimeFrames,
        duration: this.duration
      })
    } catch (error) {
      console.error(`❌ [AddAudioItemCommand] 添加音频项目失败:`, error)
      throw error
    }
  }

  async undo(): Promise<void> {
    try {
      if (this.audioItem) {
        console.log(`🔄 [AddAudioItemCommand] 撤销添加音频操作...`)
        
        // 从WebAV画布移除
        this.webavModule.removeSprite(this.audioItem.sprite)
        
        // 从时间轴移除
        this.timelineModule.removeTimelineItem(this.audioItem.id)
        
        console.log(`✅ [AddAudioItemCommand] 音频项目撤销成功`)
      }
    } catch (error) {
      console.error(`❌ [AddAudioItemCommand] 撤销音频项目失败:`, error)
      throw error
    }
  }
}

// ==================== 更新音频属性命令 ====================

/**
 * 更新音频属性的命令（采用直接属性更新模式）
 */
export class UpdateAudioPropertiesCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private oldProperties: Partial<AudioMediaConfig> = {}
  private oldTimeRange: Partial<VideoTimeRange> = {}
  private oldGain: number = 0

  constructor(
    private timelineItemId: string,
    private newProperties: Partial<AudioMediaConfig & { playbackRate?: number; gain?: number }>,
    private timelineModule: any
  ) {
    this.id = generateCommandId()
    this.description = `更新音频属性`
  }

  async execute(): Promise<void> {
    try {
      console.log(`🔄 [UpdateAudioPropertiesCommand] 执行更新音频属性...`)

      const item = this.timelineModule.getTimelineItem(this.timelineItemId) as TimelineItem<'audio'>
      if (!item || item.mediaType !== 'audio') {
        throw new Error(`音频项目不存在: ${this.timelineItemId}`)
      }

      const config = item.config
      const timeRange = item.timeRange as VideoTimeRange
      const sprite = item.sprite as AudioVisibleSprite

      // 保存旧属性用于撤销
      this.oldProperties = {
        volume: config.volume,
        isMuted: config.isMuted,
      }
      this.oldTimeRange = {
        playbackRate: timeRange.playbackRate,
      }
      if (sprite && typeof sprite.getGain === 'function') {
        this.oldGain = sprite.getGain()
      }

      // 直接更新配置（无需重建精灵）
      if (this.newProperties.volume !== undefined) {
        config.volume = this.newProperties.volume
      }
      if (this.newProperties.isMuted !== undefined) {
        config.isMuted = this.newProperties.isMuted
      }

      // 直接更新音频精灵属性（实时生效）
      if (sprite) {
        if (this.newProperties.volume !== undefined) {
          sprite.setVolume(this.newProperties.volume)
        }
        if (this.newProperties.isMuted !== undefined) {
          sprite.setMuted(this.newProperties.isMuted)
        }
        if (this.newProperties.playbackRate !== undefined) {
          // 播放速度通过sprite更新，sprite会同步更新timeRange
          sprite.setPlaybackRate(this.newProperties.playbackRate)
        }
        if (this.newProperties.gain !== undefined) {
          sprite.setGain(this.newProperties.gain)
        }
      }

      console.log('✅ [UpdateAudioPropertiesCommand] 音频属性更新成功（直接更新模式）')
    } catch (error) {
      console.error('❌ [UpdateAudioPropertiesCommand] 更新音频属性失败:', error)
      throw error
    }
  }

  async undo(): Promise<void> {
    try {
      console.log(`🔄 [UpdateAudioPropertiesCommand] 撤销更新音频属性...`)

      const item = this.timelineModule.getTimelineItem(this.timelineItemId) as TimelineItem<'audio'>
      if (item) {
        const config = item.config
        const timeRange = item.timeRange as VideoTimeRange
        const sprite = item.sprite as AudioVisibleSprite

        // 直接恢复属性（无需重建精灵）
        if (this.oldProperties.volume !== undefined) {
          config.volume = this.oldProperties.volume
        }
        if (this.oldProperties.isMuted !== undefined) {
          config.isMuted = this.oldProperties.isMuted
        }

        // 直接恢复音频精灵属性
        if (sprite) {
          if (this.oldProperties.volume !== undefined) {
            sprite.setVolume(this.oldProperties.volume)
          }
          if (this.oldProperties.isMuted !== undefined) {
            sprite.setMuted(this.oldProperties.isMuted)
          }
          if (this.oldTimeRange.playbackRate !== undefined) {
            // 播放速度通过sprite恢复，sprite会同步更新timeRange
            sprite.setPlaybackRate(this.oldTimeRange.playbackRate)
          }
          sprite.setGain(this.oldGain)
        }

        console.log('↩️ [UpdateAudioPropertiesCommand] 音频属性撤销成功（直接更新模式）')
      }
    } catch (error) {
      console.error('❌ [UpdateAudioPropertiesCommand] 撤销音频属性失败:', error)
      throw error
    }
  }
}

// ==================== 音频工具函数 ====================

/**
 * 创建音频时间轴项目
 */
export async function createAudioTimelineItem(
  mediaItemId: string,
  startTimeFrames: number,
  trackId: string,
  duration?: number,
  mediaItem?: MediaItem
): Promise<TimelineItem<'audio'>> {
  
  console.log('🔄 [createAudioTimelineItem] 开始创建音频时间轴项目...')

  // 1. 获取媒体库项目（如果没有传入）
  if (!mediaItem) {
    throw new Error('需要提供MediaItem参数')
  }
  
  if (!mediaItem || mediaItem.mediaType !== 'audio') {
    throw new Error(`音频文件不存在: ${mediaItemId}`)
  }

  if (!mediaItem.audioClip) {
    throw new Error(`音频文件未准备就绪: ${mediaItemId}`)
  }

  // 2. 计算时长
  const audioDurationFrames = duration || mediaItem.duration
  const maxDuration = mediaItem.duration
  const actualDuration = Math.min(audioDurationFrames, maxDuration)

  // 3. 创建音频精灵
  const audioSprite = new AudioVisibleSprite(mediaItem.audioClip)

  // 4. 设置时间范围
  audioSprite.setTimelineStartTime(startTimeFrames)
  audioSprite.setDisplayDuration(actualDuration)

  // 5. 设置初始音频属性
  audioSprite.setVolume(1)
  audioSprite.setMuted(false)
  audioSprite.setPlaybackRate(1)
  audioSprite.setGain(0)

  // 6. 创建音频配置
  const audioConfig: AudioMediaConfig = {
    volume: 1,
    isMuted: false,
    zIndex: 1,
    animation: undefined,
  }

  // 7. 创建时间轴项目
  const timelineItem: TimelineItem<'audio'> = reactive({
    id: generateId(),
    mediaItemId,
    trackId,
    mediaType: 'audio',
    timeRange: audioSprite.getTimeRange(),
    sprite: markRaw(audioSprite),
    thumbnailUrl: undefined, // 音频不需要缩略图
    config: audioConfig
  })

  console.log('✅ [createAudioTimelineItem] 音频时间轴项目创建完成（直接属性更新模式）')
  return timelineItem
}

/**
 * 验证音频轨道兼容性
 */
export function isAudioTrackCompatible(trackType: string): boolean {
  return trackType === 'audio'
}

/**
 * 获取音频项目显示名称
 */
export function getAudioItemDisplayName(audioItem: TimelineItem<'audio'>, maxLength: number = 20): string {
  // 这里需要从store获取mediaItem，暂时返回固定值
  const name = '音频文件' // 实际应该从mediaItem获取
  return name.length > maxLength ? name.substring(0, maxLength) + '...' : name
}

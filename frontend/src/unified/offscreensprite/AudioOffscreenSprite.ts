import { AudioClip } from '@webav/av-cliper'
import type { UnifiedTimeRange } from '@/unified/types/timeRange'
import { framesToMicroseconds } from '@/unified/utils/timeUtils'
import { BaseOffscreenSprite } from '@/unified/offscreensprite/BaseOffscreenSprite'
import type { AudioState } from '@/unified/visiblesprite/types'

/**
 * 自定义的音频OffscreenSprite类，继承自BaseOffscreenSprite
 * 专门用于处理音频素材，采用直接属性更新模式
 * 专注于视频合成功能，移除了事件监听
 */
export class AudioOffscreenSprite extends BaseOffscreenSprite {
  /**
   * 音频状态
   */
  #audioState: AudioState = {
    volume: 1,
    isMuted: false,
  }

  /**
   * 音频增益（dB）
   */
  #gain: number = 0

  /**
   * 轨道静音状态
   */
  #isTrackMuted: boolean = false

  /**
   * 构造函数
   * @param clip AudioClip实例
   */
  constructor(clip: AudioClip) {
    // 调用父类构造函数
    super(clip)
  }

  // ==================== 音频属性控制接口 ====================

  /**
   * 设置音量
   * @param volume 音量值（0-1之间）
   */
  public setVolume(volume: number): void {
    this.#audioState.volume = Math.max(0, Math.min(1, volume))
    // 音频属性变化会通过拦截器实时生效，无需重建
  }

  /**
   * 设置静音状态
   * @param muted 是否静音
   */
  public setMuted(muted: boolean): void {
    this.#audioState.isMuted = muted
    // 音频属性变化会通过拦截器实时生效，无需重建
  }

  /**
   * 设置播放速度
   * @param speed 播放速度倍率（1.0为正常速度，2.0为2倍速，0.5为0.5倍速）
   */
  public setPlaybackRate(speed: number): void {
    if (speed <= 0) {
      throw new Error('播放速度必须大于0')
    }

    const timeRange = this.getTimeRange()
    const { clipStartTime, clipEndTime, timelineStartTime } = timeRange
    const clipDuration = clipEndTime - clipStartTime

    if (clipDuration > 0) {
      // 根据新的播放速度计算时间轴结束时间
      // 时间轴时长 = 素材时长 / 播放速度
      const newTimelineDuration = clipDuration / speed

      // 🔧 确保时间轴结束时间是整数帧数（避免小数点时长显示）
      const newTimelineEndTime = timelineStartTime + Math.round(newTimelineDuration)

      // 通过设置时间范围来实现播放速度调整
      // playbackRate 会在 updateOffscreenSpriteTime() 中根据时间范围自动计算
      this.setTimeRange({
        timelineEndTime: newTimelineEndTime
      })
    }
  }


  /**
   * 设置音频增益
   * @param gainDb 增益值（dB，通常在-20到20之间）
   */
  public setGain(gainDb: number): void {
    this.#gain = Math.max(-20, Math.min(20, gainDb))
    // 音频属性变化会通过拦截器实时生效，无需重建
  }

  /**
   * 设置完整的音频状态
   * @param audioState 音频状态对象
   */
  public setAudioState(audioState: Partial<AudioState>): void {
    if (audioState.volume !== undefined) {
      this.#audioState.volume = Math.max(0, Math.min(1, audioState.volume))
    }
    if (audioState.isMuted !== undefined) {
      this.#audioState.isMuted = audioState.isMuted
    }
  }

  /**
   * 设置轨道静音状态
   * @param muted 是否静音
   */
  public setTrackMuted(muted: boolean): void {
    this.#isTrackMuted = muted
  }

  // ==================== 渲染方法 ====================

  /**
   * 覆写offscreenRender方法，应用音量和增益控制
   * @param ctx 渲染上下文
   * @param time 当前时间（微秒）
   * @returns 音频数据和完成状态
   */
  public async offscreenRender(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    time: number,
  ): Promise<{ audio: Float32Array[]; done: boolean }> {
    // 调用父类的offscreenRender方法获取音频数据
    const renderResult = await super.offscreenRender(ctx, time)
    
    // 如果有音频数据，根据静音状态、音量和增益调整
    if (renderResult.audio && renderResult.audio.length > 0) {
      // 计算实际音量：轨道静音或片段静音时为0，否则使用当前音量
      const effectiveVolume =
        this.#audioState.isMuted || this.#isTrackMuted ? 0 : this.#audioState.volume

      // 计算增益倍数（dB转线性）
      const gainMultiplier = Math.pow(10, this.#gain / 20)

      // 最终音频倍数
      const finalVolume = effectiveVolume * gainMultiplier

      if (finalVolume !== 1) {
        // 应用音量和增益到所有声道
        for (const channel of renderResult.audio) {
          for (let i = 0; i < channel.length; i++) {
            channel[i] *= finalVolume
          }
        }
      }
    }

    return renderResult
  }

  // ==================== 保护方法 ====================

  /**
   * 更新 OffscreenSprite 的 time 属性
   * 音频素材的定制化实现，支持音频特有的播放速度计算
   */
  protected updateOffscreenSpriteTime(): void {
    const timeRange = this.getTimeRange()
    const { clipStartTime, clipEndTime, timelineStartTime, timelineEndTime } = timeRange

    // 计算时长参数（使用帧数）
    let durationFrames = 0
    let playbackRate = 1 // 默认正常速度

    const clipDurationFrames = clipEndTime - clipStartTime // 素材内部要播放的帧数
    const timelineDurationFrames = timelineEndTime - timelineStartTime // 在时间轴上占用的帧数

    if (clipDurationFrames > 0 && timelineDurationFrames > 0) {
      // duration 是在时间轴上占用的帧数
      durationFrames = timelineDurationFrames
      
      // 计算播放速度
      // playbackRate = 素材内部时长 / 时间轴时长
      playbackRate = clipDurationFrames / timelineDurationFrames

      // 修正浮点数精度问题，避免出现1.00000001这样的值
      // 如果非常接近整数，则四舍五入到最近的0.1
      const rounded = Math.round(playbackRate * 10) / 10
      if (Math.abs(playbackRate - rounded) < 0.001) {
        playbackRate = rounded
      }
    }

    // 设置 OffscreenSprite.time 属性（转换为微秒给WebAV）
    // offset: 在时间轴上的播放开始位置（微秒）
    // duration: 在时间轴上占用的时长（微秒）
    // playbackRate: 音频素材播放的速度
    this.time = {
      offset: framesToMicroseconds(timelineStartTime),
      duration: framesToMicroseconds(durationFrames),
      playbackRate: playbackRate,
    }
  }
}
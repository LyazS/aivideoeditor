import { VisibleSprite, MP4Clip } from '@webav/av-cliper'
import type { AudioTickData, ExtendedSprite } from '../types/webavTypes'

/**
 * 时间范围接口定义
 */
export interface VideoTimeRange {
  /** 素材内部开始时间（微秒） - 从素材的哪个时间点开始播放 */
  clipStartTime: number
  /** 素材内部结束时间（微秒） - 播放到素材的哪个时间点结束 */
  clipEndTime: number
  /** 时间轴开始时间（微秒） - 素材在整个项目时间轴上的开始位置 */
  timelineStartTime: number
  /** 时间轴结束时间（微秒） - 素材在整个项目时间轴上的结束位置 */
  timelineEndTime: number
  /** 有效播放时长（微秒） - 在时间轴上占用的时长，如果与素材内部时长不同则表示变速 */
  effectiveDuration: number
  /** 播放速度倍率 - 1.0为正常速度，2.0为2倍速，0.5为0.5倍速 */
  playbackRate: number
}

/**
 * 音频状态接口
 */
export interface AudioState {
  /** 音量（0-1之间，0为静音，1为最大音量） */
  volume: number
  /** 静音状态标记 */
  isMuted: boolean
}

/**
 * 自定义的VisibleSprite类，继承自WebAV的VisibleSprite
 * 添加了startOffset属性用于自定义起始偏移和音量控制功能
 */
export class VideoVisibleSprite extends VisibleSprite {
  /**
   * 起始偏移时间（微秒）
   */
  #startOffset: number = 0

  /**
   * 音频状态
   */
  #audioState: AudioState = {
    volume: 1,
    isMuted: false,
  }

  /**
   * 轨道静音状态检查函数
   * 这个函数由外部设置，用于检查当前sprite所在轨道是否被静音
   */
  #trackMuteChecker: (() => boolean) | null = null

  /**
   * 时间范围信息
   */
  #timeRange: VideoTimeRange = {
    clipStartTime: 0,
    clipEndTime: 0,
    timelineStartTime: 0,
    timelineEndTime: 0,
    effectiveDuration: 0,
    playbackRate: 1.0,
  }

  /**
   * 构造函数
   * @param clip MP4Clip实例
   */
  constructor(clip: MP4Clip) {
    // 调用父类构造函数
    super(clip)

    // 设置音频拦截器来控制音量
    this.#setupVolumeInterceptor()
  }

  /**
   * 覆写preFrame方法，应用startOffset
   * @param time 当前时间（微秒）
   */
  public async preFrame(time: number): Promise<void> {
    // 将startOffset应用到时间上，传递给父类
    const adjustedTime = time + this.#startOffset
    return super.preFrame(adjustedTime)
  }

  /**
   * 覆写render方法，应用startOffset
   * @param ctx 渲染上下文
   * @param time 当前时间（微秒）
   * @returns 音频数据
   */
  public render(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    time: number,
  ): { audio: Float32Array[] } {
    // 将startOffset应用到时间上，传递给父类
    const adjustedTime = time + this.#startOffset
    return super.render(ctx, adjustedTime)
  }

  // ==================== 时间轴接口 ====================

  /**
   * 设置素材内部的开始时间（从素材的哪个时间点开始播放）
   * @param startTime 开始时间（微秒）
   */
  public setClipStartTime(startTime: number): void {
    this.#timeRange.clipStartTime = startTime
    this.#updateVisibleSpriteTime()
  }

  /**
   * 设置素材内部的结束时间（播放到素材的哪个时间点结束）
   * @param endTime 结束时间（微秒）
   */
  public setClipEndTime(endTime: number): void {
    this.#timeRange.clipEndTime = endTime
    this.#updateVisibleSpriteTime()
  }

  /**
   * 获取素材内部的开始时间
   * @returns 开始时间（微秒）
   */
  public getClipStartTime(): number {
    return this.#timeRange.clipStartTime
  }

  /**
   * 获取素材内部的结束时间
   * @returns 结束时间（微秒）
   */
  public getClipEndTime(): number {
    return this.#timeRange.clipEndTime
  }

  /**
   * 设置在时间轴上的开始时间（素材在整个项目时间轴上的位置）
   * @param startTime 时间轴开始时间（微秒）
   */
  public setTimelineStartTime(startTime: number): void {
    this.#timeRange.timelineStartTime = startTime
    this.#updateVisibleSpriteTime()
  }

  /**
   * 设置在时间轴上的结束时间
   * @param endTime 时间轴结束时间（微秒）
   */
  public setTimelineEndTime(endTime: number): void {
    this.#timeRange.timelineEndTime = endTime
    this.#updateVisibleSpriteTime()
  }

  /**
   * 获取在时间轴上的开始时间
   * @returns 时间轴开始时间（微秒）
   */
  public getTimelineStartTime(): number {
    return this.#timeRange.timelineStartTime
  }

  /**
   * 获取在时间轴上的结束时间
   * @returns 时间轴结束时间（微秒）
   */
  public getTimelineEndTime(): number {
    return this.#timeRange.timelineEndTime
  }

  /**
   * 同时设置内部素材和时间轴的时间范围
   * @param options 时间范围配置
   */
  public setTimeRange(options: {
    clipStartTime?: number
    clipEndTime?: number
    timelineStartTime?: number
    timelineEndTime?: number
  }): void {
    if (options.clipStartTime !== undefined) {
      this.#timeRange.clipStartTime = options.clipStartTime
    }
    if (options.clipEndTime !== undefined) {
      this.#timeRange.clipEndTime = options.clipEndTime
    }
    if (options.timelineStartTime !== undefined) {
      this.#timeRange.timelineStartTime = options.timelineStartTime
    }
    if (options.timelineEndTime !== undefined) {
      this.#timeRange.timelineEndTime = options.timelineEndTime
    }
    this.#updateVisibleSpriteTime()
  }

  /**
   * 获取完整的时间范围信息
   * @returns 时间范围信息
   */
  public getTimeRange(): VideoTimeRange {
    return { ...this.#timeRange }
  }

  /**
   * 重置时间范围到默认状态
   */
  public resetTimeRange(): void {
    this.#timeRange = {
      clipStartTime: 0,
      clipEndTime: 0,
      timelineStartTime: 0,
      timelineEndTime: 0,
      effectiveDuration: 0,
      playbackRate: 1.0,
    }
    this.#updateVisibleSpriteTime()
  }

  // ==================== 变速接口 ====================

  /**
   * 设置播放速度
   * @param speed 播放速度倍率（1.0为正常速度，2.0为2倍速，0.5为0.5倍速）
   */
  public setPlaybackSpeed(speed: number): void {
    if (speed <= 0) {
      throw new Error('播放速度必须大于0')
    }

    const { clipStartTime, clipEndTime, timelineStartTime } = this.#timeRange
    const clipDuration = clipEndTime - clipStartTime

    if (clipDuration > 0) {
      // 根据新的播放速度计算时间轴结束时间
      // 时间轴时长 = 素材时长 / 播放速度
      const newTimelineDuration = clipDuration / speed
      const newTimelineEndTime = timelineStartTime + newTimelineDuration

      // 通过设置时间范围来实现播放速度调整
      // playbackRate 会在 #updateVisibleSpriteTime() 中根据时间范围自动计算
      this.#timeRange.timelineEndTime = newTimelineEndTime
      this.#updateVisibleSpriteTime()
    }
  }

  /**
   * 获取当前播放速度
   * @returns 播放速度倍率
   */
  public getPlaybackSpeed(): number {
    return this.#timeRange.playbackRate
  }

  /**
   * 获取原始素材的完整时长（不受任何设置影响）
   * @returns 原始素材时长（微秒）
   */
  public async getOriginalClipDuration(): Promise<number> {
    const clip = this.getClip()
    if (clip && 'meta' in clip) {
      const meta = clip.meta
      return meta.duration
    }
    return 0
  }

  /**
   * 检查时间范围是否有效
   * @returns 是否有效
   */
  public isTimeRangeValid(): boolean {
    const { clipStartTime, clipEndTime, timelineStartTime, timelineEndTime } = this.#timeRange

    // 检查素材内部时间范围是否有效
    if (clipStartTime < 0 || clipEndTime < 0) return false
    if (clipStartTime >= clipEndTime) return false

    // 检查时间轴时间范围是否有效
    if (timelineStartTime < 0 || timelineEndTime < 0) return false
    if (timelineStartTime >= timelineEndTime) return false

    return true
  }

  // ==================== 私有方法 ====================

  /**
   * 更新时间范围的计算值（如有效播放时长）
   */
  #updateTimeRangeCalculations(): void {
    const { clipStartTime, clipEndTime, timelineStartTime, timelineEndTime } = this.#timeRange

    if (clipEndTime > clipStartTime && timelineEndTime > timelineStartTime) {
      // 在时间轴上占用的时长
      const timelineDuration = timelineEndTime - timelineStartTime

      // 有效播放时长就是时间轴上的时长
      this.#timeRange.effectiveDuration = timelineDuration
    } else {
      this.#timeRange.effectiveDuration = 0
    }
  }

  /**
   * 更新 VisibleSprite 的 time 属性
   * 根据当前的时间范围设置同步更新父类的时间属性
   */
  #updateVisibleSpriteTime(): void {
    this.#updateTimeRangeCalculations()

    const { clipStartTime, clipEndTime, timelineStartTime, timelineEndTime } = this.#timeRange

    // 计算播放速度和相关参数
    let playbackRate = 1
    let duration = 0

    const clipDuration = clipEndTime - clipStartTime // 素材内部要播放的时长
    const timelineDuration = timelineEndTime - timelineStartTime // 在时间轴上占用的时长

    if (clipDuration > 0 && timelineDuration > 0) {
      // playbackRate = 素材内部时长 / 时间轴时长
      playbackRate = clipDuration / timelineDuration

      // 修正浮点数精度问题，避免出现1.00000001这样的值
      // 如果非常接近整数，则四舍五入到最近的0.1
      const rounded = Math.round(playbackRate * 10) / 10
      if (Math.abs(playbackRate - rounded) < 0.001) {
        playbackRate = rounded
      }

      // duration 是在时间轴上占用的时长
      duration = timelineDuration

      // 更新 #startOffset 为素材内部的开始位置
      this.#startOffset = clipStartTime
    }

    // 设置 VisibleSprite.time 属性
    // offset: 在时间轴上的播放开始位置（微秒）
    // duration: 在时间轴上占用的时长（微秒）
    // playbackRate: 素材播放的速度（根据时间范围计算）
    // 配合 preFrame/render 中的 adjustedTime = time + this.#startOffset 实现从指定位置开始播放
    this.time = {
      offset: timelineStartTime,
      duration: duration,
      playbackRate: playbackRate,
    }

    // 将计算出的播放速度同步回TimeRange中（从this.time获取）
    this.#timeRange.playbackRate = this.time.playbackRate
  }

  // ==================== 音量控制接口 ====================

  /**
   * 设置音频拦截器来控制音量
   */
  #setupVolumeInterceptor(): void {
    const clip = this.getClip()
    if (clip && 'tickInterceptor' in clip) {
      // 设置tickInterceptor来拦截音频数据
      clip.tickInterceptor = async (_time: number, tickRet: AudioTickData) => {
        // 如果有音频数据，根据静音状态和音量调整
        if (tickRet.audio && tickRet.audio.length > 0) {
          // 检查轨道是否被静音
          const isTrackMuted = this.#trackMuteChecker ? this.#trackMuteChecker() : false

          // 计算实际音量：轨道静音或片段静音时为0，否则使用当前音量
          const effectiveVolume = (this.#audioState.isMuted || isTrackMuted) ? 0 : this.#audioState.volume

          if (effectiveVolume !== 1) {
            // 对每个声道的PCM数据进行音量调整
            tickRet.audio = tickRet.audio.map((channelData: Float32Array) => {
              // 创建新的Float32Array避免修改原数据
              const adjustedData = new Float32Array(channelData.length)
              for (let i = 0; i < channelData.length; i++) {
                adjustedData[i] = channelData[i] * effectiveVolume
              }
              return adjustedData
            })
          }
        }

        return tickRet
      }
    }
  }

  /**
   * 动态设置音量
   * @param volume 音量值（0-1之间，0为静音，1为最大音量）
   */
  public setVolume(volume: number): void {
    // 限制音量范围 0-1
    this.#audioState.volume = Math.max(0, Math.min(1, volume))
  }

  /**
   * 获取当前音量
   * @returns 当前音量值（0-1之间）
   */
  public getVolume(): number {
    return this.#audioState.volume
  }

  /**
   * 设置静音状态
   * @param muted 是否静音
   */
  public setMuted(muted: boolean): void {
    this.#audioState.isMuted = muted
  }

  /**
   * 静音/取消静音切换
   * @returns 切换后的静音状态（true为静音，false为有声音）
   */
  public toggleMute(): boolean {
    this.#audioState.isMuted = !this.#audioState.isMuted
    return this.#audioState.isMuted
  }

  /**
   * 检查是否处于静音状态
   * @returns 是否静音
   */
  public isMuted(): boolean {
    return this.#audioState.isMuted
  }

  /**
   * 获取显示音量（用于UI显示）
   * 静音时返回0，否则返回实际音量
   * @returns 显示音量值（0-1之间）
   */
  public getDisplayVolume(): number {
    return this.#audioState.isMuted ? 0 : this.#audioState.volume
  }

  /**
   * 获取完整的音频状态
   * @returns 音频状态对象
   */
  public getAudioState(): AudioState {
    return { ...this.#audioState }
  }

  /**
   * 设置完整的音频状态
   * @param audioState 音频状态对象
   */
  public setAudioState(audioState: AudioState): void {
    this.#audioState.volume = Math.max(0, Math.min(1, audioState.volume))
    this.#audioState.isMuted = audioState.isMuted
  }

  /**
   * 设置轨道静音状态检查函数
   * @param checker 检查函数，返回true表示轨道被静音
   */
  public setTrackMuteChecker(checker: (() => boolean) | null): void {
    this.#trackMuteChecker = checker
  }

  /**
   * 检查是否因轨道静音而被静音
   * @returns 是否因轨道静音而被静音
   */
  public isTrackMuted(): boolean {
    return this.#trackMuteChecker ? this.#trackMuteChecker() : false
  }

  /**
   * 检查是否被静音（包括片段静音和轨道静音）
   * @returns 是否被静音
   */
  public isEffectivelyMuted(): boolean {
    return this.#audioState.isMuted || this.isTrackMuted()
  }

}

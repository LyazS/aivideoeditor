import { MP4Clip } from '@webav/av-cliper'
import type { UnifiedTimeRange } from '@/unified/types/timeRange'
import { framesToMicroseconds } from '@/unified/utils/timeUtils'
import { BaseOffscreenSprite } from '@/unified/offscreensprite/BaseOffscreenSprite'
import type { AudioState } from '@/unified/visiblesprite/types'

// 从 BaseSprite 复制的类型定义（简化版，去掉 iterCount）
interface IAnimationOpts {
  duration: number
  delay?: number
}

type TAnimateProps = {
  x: number
  y: number
  w: number
  h: number
  angle: number
  opacity: number
}

export type TAnimationKeyFrame = Array<[number, Partial<TAnimateProps>]>

type TKeyFrameOpts = Partial<Record<`${number}%` | 'from' | 'to', Partial<TAnimateProps>>>

/**
 * 自定义的VideoOffscreenSprite类，继承自BaseOffscreenSprite
 * 专门用于处理视频素材，添加了startOffset属性和音量控制功能
 * 专注于视频合成功能，移除了事件监听
 */
export class VideoOffscreenSprite extends BaseOffscreenSprite {
  /**
   * 音频状态
   */
  #audioState: AudioState = {
    volume: 1,
    isMuted: false,
  }

  /**
   * 轨道静音状态
   */
  #isTrackMuted: boolean = false

  // ==================== 动画相关私有字段 ====================

  /**
   * 动画关键帧数据
   */
  #animatKeyFrame: TAnimationKeyFrame | null = null

  /**
   * 动画选项配置（简化版，固定 iterCount 为 1）
   */
  #animatOpts: (Required<IAnimationOpts> & { iterCount: 1 }) | null = null

  /**
   * 构造函数
   * @param clip MP4Clip实例
   */
  constructor(clip: MP4Clip) {
    // 调用父类构造函数
    super(clip)
  }

  // ==================== 变速接口 ====================

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


  // ==================== 渲染方法 ====================

  /**
   * 覆写offscreenRender方法，应用音量控制
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
    
    // 如果有音频数据，根据静音状态和音量调整
    if (renderResult.audio && renderResult.audio.length > 0) {
      // 计算实际音量：轨道静音或片段静音时为0，否则使用当前音量
      const effectiveVolume =
        this.#audioState.isMuted || this.#isTrackMuted ? 0 : this.#audioState.volume

      if (effectiveVolume !== 1) {
        // 对每个声道的PCM数据进行音量调整
        for (const channel of renderResult.audio) {
          for (let i = 0; i < channel.length; i++) {
            channel[i] *= effectiveVolume
          }
        }
      }
    }

    return renderResult
  }

  // ==================== 音量控制接口 ====================

  /**
   * 动态设置音量
   * @param volume 音量值（0-1之间，0为静音，1为最大音量）
   */
  public setVolume(volume: number): void {
    // 限制音量范围 0-1
    this.#audioState.volume = Math.max(0, Math.min(1, volume))
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
   * 设置完整的音频状态
   * @param audioState 音频状态对象
   */
  public setAudioState(audioState: AudioState): void {
    this.#audioState.volume = Math.max(0, Math.min(1, audioState.volume))
    this.#audioState.isMuted = audioState.isMuted
  }

  /**
   * 设置轨道静音状态
   * @param muted 是否静音
   */
  public setTrackMuted(muted: boolean): void {
    this.#isTrackMuted = muted
  }

  // ==================== 动画方法（从BaseSprite复制） ====================

  /**
   * 给素材添加动画，使用方法参考 css animation
   *
   * @example
   * sprite.setAnimation(
   *   {
   *     '0%': { x: 0, y: 0 },
   *     '25%': { x: 1200, y: 680 },
   *     '50%': { x: 1200, y: 0 },
   *     '75%': { x: 0, y: 680 },
   *     '100%': { x: 0, y: 0 },
   *   },
   *   { duration: 4e6 }, // iterCount 固定为1，无需指定
   * );
   *
   * @see [视频水印动画](https://webav-tech.github.io/WebAV/demo/2_1-concat-video)
   */
  public setAnimation(keyFrame: TKeyFrameOpts, opts: IAnimationOpts): void {
    this.#animatKeyFrame = Object.entries(keyFrame).map(([k, val]) => {
      const numK = { from: 0, to: 100 }[k] ?? Number(k.slice(0, -1))
      if (isNaN(numK) || numK > 100 || numK < 0) {
        throw Error('keyFrame must between 0~100')
      }
      return [numK / 100, val]
    }) as TAnimationKeyFrame

    this.#animatOpts = Object.assign({}, this.#animatOpts, {
      duration: opts.duration,
      delay: opts.delay ?? 0,
      iterCount: 1, // 固定为1轮，简化逻辑
    })

    console.log('setAnimation', this.#animatKeyFrame, this.#animatOpts)
  }

  /**
   * 如果当前 sprite 已被设置动画，将 sprite 的动画属性设定到指定时间的状态
   */
  public animate(time: number): void {
    if (this.#animatKeyFrame == null || this.#animatOpts == null || time < this.#animatOpts.delay)
      return
    // console.log('animate', time, this.#animatKeyFrame, this.#animatOpts)
    const updateProps = linearTimeFn(time, this.#animatKeyFrame, this.#animatOpts)
    for (const k in updateProps) {
      switch (k) {
        case 'opacity':
          this.opacity = updateProps[k] as number
          break
        case 'x':
        case 'y':
        case 'w':
        case 'h':
        case 'angle':
          this.rect[k] = updateProps[k] as number
          break
      }
    }
  }

  // ==================== 保护方法 ====================

  /**
   * 更新 OffscreenSprite 的 time 属性
   * 视频素材的定制化实现，支持视频特有的播放速度计算
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
    // playbackRate: 视频素材播放的速度
    this.time = {
      offset: framesToMicroseconds(timelineStartTime),
      duration: framesToMicroseconds(durationFrames),
      playbackRate: playbackRate,
    }
  }
}

/**
 * 线性时间函数（简化版，固定单轮播放）
 */
export function linearTimeFn(
  time: number,
  kf: TAnimationKeyFrame,
  opts: Required<IAnimationOpts> & { iterCount: 1 },
): Partial<TAnimateProps> {
  const offsetTime = time - opts.delay

  // 简化：如果超过动画时长，返回最后一帧状态
  if (offsetTime > opts.duration) {
    const lastFrame = kf[kf.length - 1]
    return lastFrame ? lastFrame[1] : {}
  }

  // 如果还没开始，返回空
  if (offsetTime < 0) return {}

  // 计算当前进度（0-1之间）
  const process = offsetTime / opts.duration
  const idx = kf.findIndex((it) => it[0] >= process)
  if (idx === -1) return {}

  const startState = kf[idx - 1]
  const nextState = kf[idx]
  const nextFrame = nextState[1]
  if (startState == null) return nextFrame
  const startFrame = startState[1]

  const rs: Partial<TAnimateProps> = {}
  // 介于两个Frame状态间的进度
  const stateProcess = (process - startState[0]) / (nextState[0] - startState[0])
  for (const prop in nextFrame) {
    const p = prop as keyof TAnimateProps
    if (startFrame[p] == null) continue
    // @ts-expect-error
      
    rs[p] = (nextFrame[p] - startFrame[p]) * stateProcess + startFrame[p]
  }

  return rs
}

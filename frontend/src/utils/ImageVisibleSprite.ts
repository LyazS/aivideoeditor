import { VisibleSprite, ImgClip } from '@webav/av-cliper'

/**
 * 图片时间范围接口定义
 * 图片没有倍速概念，所以不包含playbackRate
 */
export interface ImageTimeRange {
  /** 时间轴开始时间（微秒） - 图片在整个项目时间轴上的开始位置 */
  timelineStartTime: number
  /** 时间轴结束时间（微秒） - 图片在整个项目时间轴上的结束位置 */
  timelineEndTime: number
  /** 显示时长（微秒） - 图片在时间轴上显示的时长 */
  displayDuration: number
}

/**
 * 自定义的图片VisibleSprite类，继承自WebAV的VisibleSprite
 * 专门用于处理图片素材，不包含视频特有的倍速功能
 */
export class ImageVisibleSprite extends VisibleSprite {
  /**
   * 时间范围信息
   */
  #timeRange: ImageTimeRange = {
    timelineStartTime: 0,
    timelineEndTime: 5_000_000, // 默认5秒（5,000,000微秒）
    displayDuration: 5_000_000,
  }

  /**
   * 默认显示时长（微秒） - 5秒
   */
  public static readonly DEFAULT_DURATION = 5_000_000

  /**
   * 构造函数
   * @param clip ImgClip实例
   */
  constructor(clip: ImgClip) {
    // 调用父类构造函数
    super(clip)
    
    // 初始化时间设置
    this.#updateVisibleSpriteTime()
  }

  // ==================== 时间轴接口 ====================

  /**
   * 设置在时间轴上的开始时间（图片在整个项目时间轴上的位置）
   * @param startTime 时间轴开始时间（微秒）
   */
  public setTimelineStartTime(startTime: number): void {
    const duration = this.#timeRange.displayDuration
    this.#timeRange.timelineStartTime = startTime
    this.#timeRange.timelineEndTime = startTime + duration
    this.#updateVisibleSpriteTime()
  }

  /**
   * 设置在时间轴上的结束时间
   * @param endTime 时间轴结束时间（微秒）
   */
  public setTimelineEndTime(endTime: number): void {
    this.#timeRange.timelineEndTime = endTime
    this.#timeRange.displayDuration = endTime - this.#timeRange.timelineStartTime
    this.#updateVisibleSpriteTime()
  }

  /**
   * 设置显示时长
   * @param duration 显示时长（微秒）
   */
  public setDisplayDuration(duration: number): void {
    if (duration <= 0) {
      throw new Error('显示时长必须大于0')
    }
    
    this.#timeRange.displayDuration = duration
    this.#timeRange.timelineEndTime = this.#timeRange.timelineStartTime + duration
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
   * 获取显示时长
   * @returns 显示时长（微秒）
   */
  public getDisplayDuration(): number {
    return this.#timeRange.displayDuration
  }

  /**
   * 同时设置时间轴的时间范围
   * @param options 时间范围配置
   */
  public setTimeRange(options: {
    timelineStartTime?: number
    timelineEndTime?: number
    displayDuration?: number
  }): void {
    if (options.timelineStartTime !== undefined) {
      this.#timeRange.timelineStartTime = options.timelineStartTime
    }
    if (options.timelineEndTime !== undefined) {
      this.#timeRange.timelineEndTime = options.timelineEndTime
    }
    if (options.displayDuration !== undefined) {
      this.#timeRange.displayDuration = options.displayDuration
    }
    
    // 确保时间范围的一致性
    if (options.displayDuration !== undefined && options.timelineStartTime !== undefined) {
      this.#timeRange.timelineEndTime = this.#timeRange.timelineStartTime + this.#timeRange.displayDuration
    } else if (options.timelineStartTime !== undefined && options.timelineEndTime !== undefined) {
      this.#timeRange.displayDuration = this.#timeRange.timelineEndTime - this.#timeRange.timelineStartTime
    }
    
    this.#updateVisibleSpriteTime()
  }

  /**
   * 获取完整的时间范围信息
   * @returns 时间范围信息
   */
  public getTimeRange(): ImageTimeRange {
    return { ...this.#timeRange }
  }

  /**
   * 重置时间范围到默认状态
   */
  public resetTimeRange(): void {
    this.#timeRange = {
      timelineStartTime: 0,
      timelineEndTime: ImageVisibleSprite.DEFAULT_DURATION,
      displayDuration: ImageVisibleSprite.DEFAULT_DURATION,
    }
    this.#updateVisibleSpriteTime()
  }

  /**
   * 检查时间范围是否有效
   * @returns 是否有效
   */
  public isTimeRangeValid(): boolean {
    const { timelineStartTime, timelineEndTime, displayDuration } = this.#timeRange

    // 检查时间轴时间范围是否有效
    if (timelineStartTime < 0 || timelineEndTime < 0) return false
    if (timelineStartTime >= timelineEndTime) return false
    if (displayDuration <= 0) return false

    // 检查时间范围的一致性
    const calculatedDuration = timelineEndTime - timelineStartTime
    if (Math.abs(calculatedDuration - displayDuration) > 1) return false // 允许1微秒的误差

    return true
  }

  /**
   * 获取图片的原始尺寸信息
   * @returns 图片尺寸信息
   */
  public async getImageMeta(): Promise<{ width: number; height: number }> {
    const clip = this.getClip() as ImgClip
    if (clip && 'meta' in clip) {
      const meta = await clip.meta
      return {
        width: meta.width,
        height: meta.height
      }
    }
    return { width: 0, height: 0 }
  }

  // ==================== 私有方法 ====================

  /**
   * 更新 VisibleSprite 的 time 属性
   * 根据当前的时间范围设置同步更新父类的时间属性
   */
  #updateVisibleSpriteTime(): void {
    const { timelineStartTime, displayDuration } = this.#timeRange

    // 设置 VisibleSprite.time 属性
    // offset: 在时间轴上的播放开始位置（微秒）
    // duration: 在时间轴上占用的时长（微秒）
    // 图片不需要playbackRate，保持默认值1.0
    this.time = {
      offset: timelineStartTime,
      duration: displayDuration,
      playbackRate: 1.0, // 图片固定为1.0，没有倍速概念
    }
  }

}

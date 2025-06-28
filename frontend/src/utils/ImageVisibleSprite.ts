import { VisibleSprite, ImgClip } from '@webav/av-cliper'
import type { ImageTimeRange, ExtendedPropsChangeEvent } from '../types'
import { framesToMicroseconds } from '../stores/utils/timeUtils'

/**
 * 自定义的图片VisibleSprite类，继承自WebAV的VisibleSprite
 * 专门用于处理图片素材，不包含视频特有的倍速功能
 */
export class ImageVisibleSprite extends VisibleSprite {
  /**
   * 时间范围信息（帧数版本）
   */
  #timeRange: ImageTimeRange = {
    timelineStartTime: 0, // 帧数
    timelineEndTime: 150, // 默认150帧（5秒@30fps）
    displayDuration: 150, // 帧数
  }

  /**
   * 默认显示时长（帧数） - 150帧（5秒@30fps）
   */
  public static readonly DEFAULT_DURATION = 150

  /**
   * 上次已知的opacity值，用于变化检测
   */
  #lastKnownOpacity: number = 1

  /**
   * 是否启用opacity监控
   */
  #isOpacityMonitoringEnabled: boolean = true

  /**
   * 存储opacity值的私有字段
   */
  #opacityValue: number = 1

  /**
   * 存储opacity变化的回调函数
   */
  #opacityChangeCallback: ((opacity: number) => void) | null = null

  /**
   * 构造函数
   * @param clip ImgClip实例
   */
  constructor(clip: ImgClip) {
    // 调用父类构造函数
    super(clip)

    // 初始化时间设置
    this.#updateVisibleSpriteTime()

    // 初始化opacity监控
    this.#initializeOpacityMonitoring()

    // 重写opacity属性为访问器
    this.#setupOpacityAccessor()
  }

  // ==================== 时间轴接口 ====================

  /**
   * 设置在时间轴上的开始时间（图片在整个项目时间轴上的位置）
   * @param startTime 时间轴开始时间（帧数）
   */
  public setTimelineStartTime(startTime: number): void {
    const duration = this.#timeRange.displayDuration
    this.#timeRange.timelineStartTime = startTime
    this.#timeRange.timelineEndTime = startTime + duration
    this.#updateVisibleSpriteTime()
  }

  /**
   * 设置在时间轴上的结束时间
   * @param endTime 时间轴结束时间（帧数）
   */
  public setTimelineEndTime(endTime: number): void {
    this.#timeRange.timelineEndTime = endTime
    this.#timeRange.displayDuration = endTime - this.#timeRange.timelineStartTime
    this.#updateVisibleSpriteTime()
  }

  /**
   * 设置显示时长
   * @param duration 显示时长（帧数）
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
   * @returns 时间轴开始时间（帧数）
   */
  public getTimelineStartTime(): number {
    return this.#timeRange.timelineStartTime
  }

  /**
   * 获取在时间轴上的结束时间
   * @returns 时间轴结束时间（帧数）
   */
  public getTimelineEndTime(): number {
    return this.#timeRange.timelineEndTime
  }

  /**
   * 获取显示时长
   * @returns 显示时长（帧数）
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
      this.#timeRange.timelineEndTime =
        this.#timeRange.timelineStartTime + this.#timeRange.displayDuration
    } else if (options.timelineStartTime !== undefined && options.timelineEndTime !== undefined) {
      this.#timeRange.displayDuration =
        this.#timeRange.timelineEndTime - this.#timeRange.timelineStartTime
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
    if (calculatedDuration !== displayDuration) return false

    return true
  }

  /**
   * 获取图片的原始尺寸信息
   * @returns 图片尺寸信息
   */
  public async getImageMeta(): Promise<{ width: number; height: number }> {
    const clip = this.getClip() as ImgClip
    if (clip && 'meta' in clip) {
      const meta = clip.meta
      return {
        width: meta.width,
        height: meta.height,
      }
    }
    return { width: 0, height: 0 }
  }

  // ==================== 私有方法 ====================

  /**
   * 更新 VisibleSprite 的 time 属性
   * 根据当前的时间范围设置同步更新父类的时间属性
   * 内部使用帧数计算，设置WebAV时转换为微秒
   */
  #updateVisibleSpriteTime(): void {
    const { timelineStartTime, displayDuration } = this.#timeRange

    // 设置 VisibleSprite.time 属性（转换为微秒给WebAV）
    // offset: 在时间轴上的播放开始位置（微秒）
    // duration: 在时间轴上占用的时长（微秒）
    // 图片不需要playbackRate，保持默认值1.0
    this.time = {
      offset: framesToMicroseconds(timelineStartTime),
      duration: framesToMicroseconds(displayDuration),
      playbackRate: 1.0, // 图片固定为1.0，没有倍速概念
    }
  }

  // ==================== Opacity监控接口 ====================

  /**
   * 启用opacity监控
   */
  public enableOpacityMonitoring(): void {
    this.#isOpacityMonitoringEnabled = true
  }

  /**
   * 禁用opacity监控
   */
  public disableOpacityMonitoring(): void {
    this.#isOpacityMonitoringEnabled = false
  }

  /**
   * 设置opacity变化的回调函数
   * 这个方法将被timelineModule调用来注册opacity同步回调
   */
  public setOpacityChangeCallback(callback: (opacity: number) => void): void {
    this.#opacityChangeCallback = callback
  }

  /**
   * 移除opacity变化的回调函数
   */
  public removeOpacityChangeCallback(): void {
    this.#opacityChangeCallback = null
  }

  // ==================== 私有方法：Opacity监控 ====================

  /**
   * 初始化opacity监控
   */
  #initializeOpacityMonitoring(): void {
    // 保存父类的原始opacity值（在重写之前）
    this.#opacityValue = (this as any).opacity || 1
    this.#lastKnownOpacity = this.#opacityValue
  }

  /**
   * 设置opacity属性访问器
   * 使用属性描述符重写父类的opacity属性
   */
  #setupOpacityAccessor(): void {
    // 定义新的属性描述符
    Object.defineProperty(this, 'opacity', {
      get: () => {
        return this.#opacityValue
      },
      set: (value: number) => {
        if (!this.#isOpacityMonitoringEnabled) {
          this.#opacityValue = value
          return
        }

        const oldValue = this.#opacityValue
        this.#opacityValue = value

        // 检测变化并触发事件
        this.#checkOpacityChange(oldValue, value)
      },
      enumerable: true,
      configurable: true,
    })
  }

  /**
   * 检查opacity变化并触发事件
   */
  #checkOpacityChange(oldValue: number, newValue: number): void {
    // 使用小的容差来避免浮点数精度问题
    const tolerance = 0.0001
    if (Math.abs(oldValue - newValue) > tolerance) {
      this.#lastKnownOpacity = newValue
      this.#emitExtendedPropsChange({ opacity: newValue })
    }
  }

  /**
   * 触发opacity变化回调
   */
  #emitExtendedPropsChange(props: ExtendedPropsChangeEvent): void {
    try {
      if (props.opacity !== undefined && this.#opacityChangeCallback) {
        this.#opacityChangeCallback(props.opacity)
      }
    } catch (error) {
      console.warn('Failed to emit opacity change callback:', error)
    }
  }
}

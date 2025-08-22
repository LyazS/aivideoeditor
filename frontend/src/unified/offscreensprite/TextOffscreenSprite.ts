import { ImgClip } from '@webav/av-cliper'
import type { UnifiedTimeRange } from '@/unified/types/timeRange'
import type { TextStyleConfig } from '@/unified/timelineitem/TimelineItemData'
import { framesToMicroseconds } from '@/unified/utils/timeUtils'
import { BaseOffscreenSprite } from '@/unified/offscreensprite/BaseOffscreenSprite'
import { TextHelper } from '@/unified/utils'

/**
 * 文本OffscreenSprite类，继承自BaseOffscreenSprite
 * 提供文本内容和样式的设置能力，专注于视频合成
 * 移除了事件监听和防抖更新功能
 */
export class TextOffscreenSprite extends BaseOffscreenSprite {
  /**
   * 当前文本内容
   */
  #text: string

  /**
   * 当前文本样式配置
   */
  #textStyle: TextStyleConfig

  /**
   * 时间范围信息（帧数版本）
   * 对于文本，clipStartTime 和 clipEndTime 都设置为 -1，不使用
   * 所有时间计算都基于 timelineStartTime 和 timelineEndTime
   */
  #timeRange: UnifiedTimeRange = {
    timelineStartTime: 0, // 帧数
    timelineEndTime: 150, // 默认150帧（5秒@30fps）
    clipStartTime: -1, // 文本不使用此属性
    clipEndTime: -1, // 文本不使用此属性
  }

  /**
   * 默认显示时长（帧数） - 150帧（5秒@30fps）
   */
  public static readonly DEFAULT_DURATION = 150

  /**
   * 私有构造函数，使用静态工厂方法创建实例
   * @param clip ImgClip实例
   * @param text 文本内容
   * @param style 文本样式
   */
  private constructor(clip: ImgClip, text: string, style: TextStyleConfig) {
    // 调用父类构造函数
    super(clip)

    this.#text = text
    this.#textStyle = style

    // 初始化时间设置
    this.updateOffscreenSpriteTime()

    console.log('✅ [TextOffscreenSprite] 文本精灵创建完成:', {
      text: text.substring(0, 20) + (text.length > 20 ? '...' : ''),
      style: style,
    })
  }

  /**
   * 静态工厂方法：创建文本精灵
   * @param text 文本内容
   * @param style 文本样式配置（可选，使用默认样式）
   * @returns Promise<TextOffscreenSprite>
   */
  static async create(
    text: string = '示例文本',
    style: Partial<TextStyleConfig> = {},
  ): Promise<TextOffscreenSprite> {
    try {
      console.log('🎨 [TextOffscreenSprite] 开始创建文本精灵:', { text, style })

      // 验证和补全样式配置
      const validatedStyle = TextHelper.validateTextStyle(style)

      // 创建文本 ImgClip
      const imgClip = await TextHelper.createTextImgClip(text, validatedStyle)

      // 创建精灵实例
      const sprite = new TextOffscreenSprite(imgClip, text, validatedStyle)

      console.log('✅ [TextOffscreenSprite] 文本精灵创建成功')
      return sprite
    } catch (error) {
      console.error('❌ [TextOffscreenSprite] 创建文本精灵失败:', error)
      throw new Error(`创建文本精灵失败: ${(error as Error).message}`)
    }
  }

  // ==================== 文本更新接口 ====================

  /**
   * 更新文本内容
   * @param text 新的文本内容
   */
  async updateText(text: string): Promise<void> {
    if (this.#text === text) {
      console.log('📝 [TextOffscreenSprite] 文本内容未变化，跳过更新')
      return
    }

    console.log('📝 [TextOffscreenSprite] 更新文本内容:', {
      old: this.#text.substring(0, 20) + '...',
      new: text.substring(0, 20) + '...',
    })

    this.#text = text
    await this.#performUpdate()
  }

  /**
   * 更新文本样式
   * @param style 新的文本样式配置
   */
  async updateStyle(style: Partial<TextStyleConfig>): Promise<void> {
    const newStyle = TextHelper.validateTextStyle({ ...this.#textStyle, ...style })

    // 检查样式是否真的有变化
    if (JSON.stringify(this.#textStyle) === JSON.stringify(newStyle)) {
      console.log('🎨 [TextOffscreenSprite] 文本样式未变化，跳过更新')
      return
    }

    console.log('🎨 [TextOffscreenSprite] 更新文本样式:', { old: this.#textStyle, new: newStyle })

    this.#textStyle = newStyle
    await this.#performUpdate()
  }

  /**
   * 同时更新文本内容和样式
   * @param text 新的文本内容
   * @param style 新的文本样式配置
   */
  async updateTextAndStyle(text: string, style: Partial<TextStyleConfig>): Promise<void> {
    const newStyle = TextHelper.validateTextStyle({ ...this.#textStyle, ...style })

    // 检查是否有变化
    const textChanged = this.#text !== text
    const styleChanged = JSON.stringify(this.#textStyle) !== JSON.stringify(newStyle)

    if (!textChanged && !styleChanged) {
      console.log('📝🎨 [TextOffscreenSprite] 文本和样式均未变化，跳过更新')
      return
    }

    console.log('📝🎨 [TextOffscreenSprite] 同时更新文本和样式:', {
      textChanged,
      styleChanged,
      text: text.substring(0, 20) + '...',
      style: newStyle,
    })

    this.#text = text
    this.#textStyle = newStyle
    await this.#performUpdate()
  }


  // ==================== 时间轴接口 ====================

  /**
   * 设置时间范围
   * @param options 时间范围配置
   */
  setTimeRange(options: {
    timelineStartTime?: number
    timelineEndTime?: number
    clipStartTime?: number
    clipEndTime?: number
  }): void {
    if (options.timelineStartTime !== undefined) {
      this.#timeRange.timelineStartTime = Math.round(options.timelineStartTime)
    }
    if (options.timelineEndTime !== undefined) {
      this.#timeRange.timelineEndTime = Math.round(options.timelineEndTime)
    }
    // 对于文本，忽略 clipStartTime 和 clipEndTime 参数，保持为 -1

    this.updateOffscreenSpriteTime()
  }

  // ==================== 私有方法 ====================

  /**
   * 执行实际的更新操作
   * 注意：由于 WebAV 的 OffscreenSprite 在构造时绑定 clip，无法运行时替换
   * 这个方法主要用于触发外部重新创建精灵的流程
   */
  async #performUpdate(): Promise<void> {
    console.log('🔄 [TextOffscreenSprite] 开始执行文本更新')

    // 由于 WebAV 的限制，我们无法直接替换内部的 clip
    // 实际的更新需要通过外部重新创建精灵来实现
    // 这里我们只记录更新，让外部系统知道需要重新创建

    console.log('📢 [TextOffscreenSprite] 文本已更新，需要外部重新创建精灵')
  }

  /**
   * 创建新的文本精灵实例（用于替换当前实例）
   * @returns Promise<TextOffscreenSprite> 新的精灵实例
   */
  async createUpdatedSprite(): Promise<TextOffscreenSprite> {
    console.log('🔄 [TextOffscreenSprite] 创建更新后的精灵实例')

    // 保存当前状态
    const currentState = this.#saveCurrentState()

    // 创建新的精灵
    const newSprite = await TextOffscreenSprite.create(this.#text, this.#textStyle)

    // 恢复状态
    newSprite.rect.x = currentState.rect.x
    newSprite.rect.y = currentState.rect.y
    newSprite.rect.w = currentState.rect.w
    newSprite.rect.h = currentState.rect.h
    newSprite.rect.angle = currentState.rect.angle
    newSprite.opacity = currentState.opacity
    newSprite.zIndex = currentState.zIndex

    // 恢复时间范围
    newSprite.#timeRange = { ...currentState.timeRange }
    newSprite.updateOffscreenSpriteTime()

    console.log('✅ [TextOffscreenSprite] 更新后的精灵实例创建完成')
    return newSprite
  }

  /**
   * 保存当前精灵状态
   */
  #saveCurrentState() {
    return {
      rect: {
        x: this.rect.x,
        y: this.rect.y,
        w: this.rect.w,
        h: this.rect.h,
        angle: this.rect.angle,
      },
      opacity: this.opacity,
      zIndex: this.zIndex,
      timeRange: { ...this.#timeRange },
    }
  }

  /**
   * 更新 OffscreenSprite 的 time 属性
   * 根据当前的时间范围设置同步更新父类的时间属性
   * 内部使用帧数计算，设置WebAV时转换为微秒
   */
  protected updateOffscreenSpriteTime(): void {
    const { timelineStartTime, timelineEndTime } = this.#timeRange
    const displayDuration = timelineEndTime - timelineStartTime

    // 设置 OffscreenSprite.time 属性（转换为微秒给WebAV）
    // offset: 在时间轴上的播放开始位置（微秒）
    // duration: 在时间轴上占用的时长（微秒）
    // 文本不需要playbackRate，保持默认值1.0
    this.time = {
      offset: framesToMicroseconds(timelineStartTime),
      duration: framesToMicroseconds(displayDuration),
      playbackRate: 1.0, // 文本固定为1.0，没有倍速概念
    }
  }
}
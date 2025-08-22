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
 * OffscreenSprite统一类型
 * 用于表示所有类型的OffscreenSprite
 */
export type UnifiedOffscreenSprite =
  | import('./VideoOffscreenSprite').VideoOffscreenSprite
  | import('./ImageOffscreenSprite').ImageOffscreenSprite
  | import('./TextOffscreenSprite').TextOffscreenSprite
  | import('./AudioOffscreenSprite').AudioOffscreenSprite

/**
 * OffscreenSprite创建选项
 */
export interface OffscreenSpriteCreateOptions {
  /** 时间轴开始时间（帧数） */
  timelineStartTime?: number
  /** 时间轴结束时间（帧数） */
  timelineEndTime?: number
  /** 素材内部开始时间（帧数） */
  clipStartTime?: number
  /** 素材内部结束时间（帧数） */
  clipEndTime?: number
  /** 音量设置（0-1） */
  volume?: number
  /** 是否静音 */
  muted?: boolean
  /** 透明度（0-1） */
  opacity?: number
  /** 层级 */
  zIndex?: number
  /** 位置X坐标 */
  x?: number
  /** 位置Y坐标 */
  y?: number
  /** 宽度 */
  width?: number
  /** 高度 */
  height?: number
  /** 旋转角度 */
  angle?: number
}

/**
 * OffscreenSprite动画关键帧配置
 */
export interface OffscreenSpriteAnimationConfig {
  /** 动画时长（微秒） */
  duration: number
  /** 动画延迟（微秒） */
  delay?: number
  /** 关键帧配置 */
  keyFrames: Record<string, Partial<{
    x: number
    y: number
    w: number
    h: number
    angle: number
    opacity: number
  }>>
}
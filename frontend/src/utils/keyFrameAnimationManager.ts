import { generateId } from './idGenerator'
import { WebAVAnimationConverter } from './webavAnimationConverter'
import { getClipDuration } from './animationUtils'
import type { VideoVisibleSprite } from './VideoVisibleSprite'
import type { ImageVisibleSprite } from './ImageVisibleSprite'
import type {
  KeyFrame,
  KeyFrameProperty,
  AnimationConfig,
  AnimatableProperty,
  KeyFrameOperationResult,
  KeyFrameFindOptions
} from '../types/animationTypes'
import type { TimelineItem } from '../types/videoTypes'

/**
 * 关键帧动画管理器
 * 负责关键帧的CRUD操作和动画应用
 */
export class KeyFrameAnimationManager {
  /**
   * 为TimelineItem创建关键帧
   * @param timelineItem 时间轴项目
   * @param property 动画属性
   * @param time 当前播放时间（秒）
   * @param value 属性值
   * @param videoResolution 视频分辨率（用于坐标转换）
   * @returns 操作结果
   */
  static createKeyFrame(
    timelineItem: TimelineItem,
    property: AnimatableProperty,
    time: number,
    value: number,
    videoResolution: { width: number; height: number }
  ): KeyFrameOperationResult {
    // 确保动画配置存在，使用clip时长作为动画duration
    if (!timelineItem.animationConfig) {
      const clipDurationMicroseconds = getClipDuration(timelineItem) * 1_000_000
      timelineItem.animationConfig = WebAVAnimationConverter.createDefaultAnimationConfig(clipDurationMicroseconds)
    }

    const config = timelineItem.animationConfig

    // 计算相对时间（0-1）
    const relativeTime = this.calculateRelativeTime(time, config)
    
    // 查找是否已存在该时间点的关键帧
    let existingKeyFrame = config.keyFrames.find(kf => 
      Math.abs(kf.time - relativeTime) < 0.01 // 1%容差
    )

    if (existingKeyFrame) {
      // 更新现有关键帧的属性
      const existingProperty = existingKeyFrame.properties.find(p => p.property === property)
      if (existingProperty) {
        existingProperty.value = value
        this.applyAnimationToSprite(timelineItem.sprite, config, timelineItem, videoResolution)
        return 'updated'
      } else {
        // 添加新属性到现有关键帧
        existingKeyFrame.properties.push({
          property,
          value,
          interpolation: 'linear'
        })
        this.applyAnimationToSprite(timelineItem.sprite, config, timelineItem, videoResolution)
        return 'updated'
      }
    } else {
      // 创建新关键帧
      const newKeyFrame: KeyFrame = {
        id: generateId(),
        time: relativeTime,
        properties: [{
          property,
          value,
          interpolation: 'linear'
        }]
      }
      
      config.keyFrames.push(newKeyFrame)
      
      // 按时间排序
      config.keyFrames.sort((a, b) => a.time - b.time)

      this.applyAnimationToSprite(timelineItem.sprite, config, timelineItem, videoResolution)
      return 'added'
    }
  }

  /**
   * 删除关键帧
   * @param timelineItem 时间轴项目
   * @param keyFrameId 关键帧ID
   * @returns 操作结果
   */
  static removeKeyFrame(timelineItem: TimelineItem, keyFrameId: string): KeyFrameOperationResult {
    if (!timelineItem.animationConfig) {
      return 'removed' // 没有动画配置，视为已删除
    }

    const config = timelineItem.animationConfig
    const initialLength = config.keyFrames.length
    
    config.keyFrames = config.keyFrames.filter(kf => kf.id !== keyFrameId)
    
    if (config.keyFrames.length < initialLength) {
      // 如果关键帧少于2个，禁用动画
      if (config.keyFrames.length < 2) {
        config.isEnabled = false
        this.clearSpriteAnimation(timelineItem.sprite)
      } else {
        // 需要传入timelineItem和videoResolution参数
        // 这里使用默认分辨率，实际使用时应该传入正确的分辨率
        const defaultVideoResolution = { width: 1920, height: 1080 }
        this.applyAnimationToSprite(timelineItem.sprite, config, timelineItem, defaultVideoResolution)
      }
      return 'removed'
    }
    
    return 'removed'
  }

  /**
   * 删除指定属性的关键帧
   * @param timelineItem 时间轴项目
   * @param property 属性名
   * @param time 时间点（秒）
   * @returns 操作结果
   */
  static removeKeyFrameProperty(
    timelineItem: TimelineItem,
    property: AnimatableProperty,
    time: number
  ): KeyFrameOperationResult {
    if (!timelineItem.animationConfig) {
      return 'removed'
    }

    const config = timelineItem.animationConfig
    const relativeTime = this.calculateRelativeTime(time, config)
    
    const keyFrame = config.keyFrames.find(kf => 
      Math.abs(kf.time - relativeTime) < 0.01
    )

    if (keyFrame) {
      keyFrame.properties = keyFrame.properties.filter(p => p.property !== property)
      
      // 如果关键帧没有属性了，删除整个关键帧
      if (keyFrame.properties.length === 0) {
        return this.removeKeyFrame(timelineItem, keyFrame.id)
      } else {
        // 需要传入timelineItem和videoResolution参数
        const defaultVideoResolution = { width: 1920, height: 1080 }
        this.applyAnimationToSprite(timelineItem.sprite, config, timelineItem, defaultVideoResolution)
        return 'updated'
      }
    }
    
    return 'removed'
  }

  /**
   * 查找指定时间点的关键帧
   * @param timelineItem 时间轴项目
   * @param time 时间点（秒）
   * @param options 查找选项
   * @returns 找到的关键帧或null
   */
  static findKeyFrameAtTime(
    timelineItem: TimelineItem,
    time: number,
    options: KeyFrameFindOptions = {}
  ): KeyFrame | null {
    if (!timelineItem.animationConfig) {
      return null
    }

    const config = timelineItem.animationConfig
    const relativeTime = this.calculateRelativeTime(time, config)
    const tolerance = options.tolerance || 0.01

    return config.keyFrames.find(kf => {
      const timeMatch = Math.abs(kf.time - relativeTime) < tolerance
      
      if (!timeMatch) return false
      
      // 如果指定了属性过滤
      if (options.property) {
        return kf.properties.some(p => p.property === options.property)
      }
      
      if (options.properties) {
        return options.properties.every(prop => 
          kf.properties.some(p => p.property === prop)
        )
      }
      
      return true
    }) || null
  }

  /**
   * 应用动画到WebAV Sprite
   * @param sprite WebAV Sprite实例
   * @param config 动画配置
   * @param timelineItem 时间轴项目（用于坐标转换）
   * @param videoResolution 视频分辨率（用于坐标转换）
   */
  static applyAnimationToSprite(
    sprite: VideoVisibleSprite | ImageVisibleSprite,
    config: AnimationConfig,
    timelineItem: TimelineItem,
    videoResolution: { width: number; height: number }
  ): void {
    if (!config.isEnabled || !WebAVAnimationConverter.isValidAnimationConfig(config)) {
      this.clearSpriteAnimation(sprite)
      return
    }

    try {
      const webavKeyFrames = WebAVAnimationConverter.convertToWebAVKeyFrames(
        config.keyFrames,
        timelineItem,
        videoResolution
      )
      const webavOpts = WebAVAnimationConverter.convertToWebAVOpts(config)

      // 调用WebAV的setAnimation方法
      sprite.setAnimation(webavKeyFrames, webavOpts)

      console.log('🎬 [Animation] Applied animation to sprite:', {
        keyFrameCount: config.keyFrames.length,
        duration: config.duration,
        webavKeyFrames,
        webavOpts
      })
    } catch (error) {
      console.error('❌ [Animation] Failed to apply animation:', error)
      this.clearSpriteAnimation(sprite)
    }
  }

  /**
   * 清除Sprite的动画
   * @param sprite WebAV Sprite实例
   */
  static clearSpriteAnimation(sprite: VideoVisibleSprite | ImageVisibleSprite): void {
    try {
      // WebAV清除动画的方式：设置空的关键帧和0时长
      sprite.setAnimation({}, { duration: 0, iterCount: 1 })
      console.log('🧹 [Animation] Cleared sprite animation')
    } catch (error) {
      console.error('❌ [Animation] Failed to clear animation:', error)
    }
  }

  /**
   * 计算相对时间（关键逻辑）
   * @param currentTime 当前时间（秒）
   * @param config 动画配置
   * @returns 相对时间（0-1）
   */
  private static calculateRelativeTime(currentTime: number, config: AnimationConfig): number {
    const animationDurationSeconds = config.duration / 1_000_000

    // 直接计算相对时间，不使用取模运算
    // 因为动画duration现在等于clip时长，且只迭代一次
    return Math.max(0, Math.min(1, currentTime / animationDurationSeconds))
  }

  /**
   * 获取TimelineItem的所有关键帧
   * @param timelineItem 时间轴项目
   * @returns 关键帧数组
   */
  static getKeyFrames(timelineItem: TimelineItem): KeyFrame[] {
    return timelineItem.animationConfig?.keyFrames || []
  }

  /**
   * 检查指定时间点是否有关键帧
   * @param timelineItem 时间轴项目
   * @param time 时间点（秒）
   * @param property 可选的属性过滤
   * @returns 是否存在关键帧
   */
  static hasKeyFrameAtTime(
    timelineItem: TimelineItem,
    time: number,
    property?: AnimatableProperty
  ): boolean {
    return this.findKeyFrameAtTime(timelineItem, time, { property }) !== null
  }

  /**
   * 启用或禁用动画
   * @param timelineItem 时间轴项目
   * @param enabled 是否启用
   * @param videoResolution 视频分辨率（用于坐标转换）
   */
  static setAnimationEnabled(
    timelineItem: TimelineItem,
    enabled: boolean,
    videoResolution: { width: number; height: number }
  ): void {
    if (!timelineItem.animationConfig) {
      if (enabled) {
        const clipDurationMicroseconds = getClipDuration(timelineItem) * 1_000_000
        timelineItem.animationConfig = WebAVAnimationConverter.createDefaultAnimationConfig(clipDurationMicroseconds)
      }
      return
    }

    timelineItem.animationConfig.isEnabled = enabled

    if (enabled) {
      this.applyAnimationToSprite(timelineItem.sprite, timelineItem.animationConfig, timelineItem, videoResolution)
    } else {
      this.clearSpriteAnimation(timelineItem.sprite)
    }
  }
}

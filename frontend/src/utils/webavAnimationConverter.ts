import type {
  KeyFrame,
  AnimationConfig,
  WebAVAnimateProps,
  WebAVKeyFrameOpts,
  WebAVAnimationOpts,
  AnimatableProperty
} from '../types/animationTypes'

/**
 * WebAV动画格式转换器
 * 负责在项目关键帧格式和WebAV格式之间进行转换
 */
export class WebAVAnimationConverter {
  /**
   * 属性名映射：项目属性名 → WebAV属性名
   */
  private static readonly PROPERTY_MAPPING: Record<AnimatableProperty, keyof WebAVAnimateProps> = {
    x: 'x',
    y: 'y',
    width: 'w',
    height: 'h',
    rotation: 'angle',
    opacity: 'opacity'
  }

  /**
   * 将项目关键帧转换为WebAV TKeyFrameOpts格式
   * @param keyFrames 项目关键帧数组
   * @returns WebAV关键帧格式
   */
  static convertToWebAVKeyFrames(keyFrames: KeyFrame[]): WebAVKeyFrameOpts {
    const webavKeyFrames: WebAVKeyFrameOpts = {}

    // 按时间排序关键帧
    const sortedKeyFrames = [...keyFrames].sort((a, b) => a.time - b.time)

    sortedKeyFrames.forEach(keyFrame => {
      // 计算时间键值
      const timeKey = this.calculateTimeKey(keyFrame.time)
      
      // 如果该时间点已存在，合并属性
      if (!webavKeyFrames[timeKey]) {
        webavKeyFrames[timeKey] = {}
      }

      // 转换每个属性
      keyFrame.properties.forEach(prop => {
        const webavPropName = this.PROPERTY_MAPPING[prop.property]
        if (webavPropName) {
          webavKeyFrames[timeKey]![webavPropName] = prop.value
        }
      })
    })

    return webavKeyFrames
  }

  /**
   * 将项目动画配置转换为WebAV IAnimationOpts格式
   * @param config 项目动画配置
   * @returns WebAV动画选项
   */
  static convertToWebAVOpts(config: AnimationConfig): WebAVAnimationOpts {
    return {
      duration: config.duration,
      iterCount: config.iterCount,
      delay: 0 // MVP版本暂不支持延迟
    }
  }

  /**
   * 计算时间键值（支持百分比和from/to格式）
   * @param time 相对时间（0-1）
   * @returns 时间键值
   */
  private static calculateTimeKey(time: number): string {
    // 确保时间在有效范围内
    const clampedTime = Math.max(0, Math.min(1, time))
    
    if (clampedTime === 0) {
      return 'from'
    } else if (clampedTime === 1) {
      return 'to'
    } else {
      // 转换为百分比，保留1位小数
      const percentage = Math.round(clampedTime * 1000) / 10
      return `${percentage}%`
    }
  }

  /**
   * 验证关键帧数据的有效性
   * @param keyFrames 关键帧数组
   * @returns 验证结果
   */
  static validateKeyFrames(keyFrames: KeyFrame[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (keyFrames.length < 2) {
      errors.push('至少需要2个关键帧才能创建动画')
    }

    keyFrames.forEach((keyFrame, index) => {
      // 验证时间范围
      if (keyFrame.time < 0 || keyFrame.time > 1) {
        errors.push(`关键帧${index + 1}的时间值${keyFrame.time}超出有效范围[0, 1]`)
      }

      // 验证属性
      if (keyFrame.properties.length === 0) {
        errors.push(`关键帧${index + 1}没有定义任何属性`)
      }

      keyFrame.properties.forEach(prop => {
        if (!this.PROPERTY_MAPPING[prop.property]) {
          errors.push(`关键帧${index + 1}包含不支持的属性: ${prop.property}`)
        }
      })
    })

    // 检查重复时间点
    const timePoints = keyFrames.map(kf => kf.time)
    const uniqueTimePoints = new Set(timePoints)
    if (timePoints.length !== uniqueTimePoints.size) {
      errors.push('存在重复的时间点')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * 创建默认的动画配置
   * @param duration 动画时长（微秒），默认2秒
   * @returns 默认动画配置
   */
  static createDefaultAnimationConfig(duration: number = 2_000_000): AnimationConfig {
    return {
      keyFrames: [],
      duration,
      iterCount: 1,
      isEnabled: true
    }
  }

  /**
   * 检查动画配置是否有效
   * @param config 动画配置
   * @returns 是否有效
   */
  static isValidAnimationConfig(config: AnimationConfig): boolean {
    return config.isEnabled && 
           config.keyFrames.length >= 2 && 
           config.duration > 0 &&
           this.validateKeyFrames(config.keyFrames).isValid
  }
}

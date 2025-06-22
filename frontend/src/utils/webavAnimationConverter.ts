import type {
  KeyFrame,
  AnimationConfig,
  WebAVAnimateProps,
  WebAVKeyFrameOpts,
  WebAVAnimationOpts,
  AnimatableProperty
} from '../types/animationTypes'
import type { TimelineItem } from '../types/videoTypes'
import { projectToWebavCoords } from './coordinateTransform'

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
    opacity: 'opacity',
    zIndex: 'zIndex' as keyof WebAVAnimateProps // 注意：WebAV可能不直接支持zIndex动画
  }

  /**
   * 将项目关键帧转换为WebAV TKeyFrameOpts格式
   * @param keyFrames 项目关键帧数组
   * @param timelineItem 时间轴项目（用于获取坐标转换所需的信息）
   * @param videoResolution 视频分辨率（用于坐标转换）
   * @returns WebAV关键帧格式
   */
  static convertToWebAVKeyFrames(
    keyFrames: KeyFrame[],
    timelineItem: TimelineItem,
    videoResolution: { width: number; height: number }
  ): WebAVKeyFrameOpts {
    const webavKeyFrames: WebAVKeyFrameOpts = {}

    // 按时间排序关键帧
    const sortedKeyFrames = [...keyFrames].sort((a, b) => a.time - b.time)

    sortedKeyFrames.forEach(keyFrame => {
      // 计算时间键值
      const timeKey = this.calculateTimeKey(keyFrame.time)

      // 如果该时间点已存在，合并属性
      if (!(webavKeyFrames as any)[timeKey]) {
        (webavKeyFrames as any)[timeKey] = {}
      }

      // 转换每个属性
      keyFrame.properties.forEach(prop => {
        const webavPropName = this.PROPERTY_MAPPING[prop.property]
        if (webavPropName) {
          // 对于位置属性，需要进行坐标转换
          let convertedValue = prop.value

          if (prop.property === 'x' || prop.property === 'y') {
            convertedValue = this.convertPositionToWebAV(
              prop.property,
              prop.value,
              keyFrame,
              timelineItem,
              videoResolution
            )
          }

          ;(webavKeyFrames as any)[timeKey]![webavPropName] = convertedValue
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
   * @param duration 动画时长（微秒），如果不提供则使用默认值2秒
   * @returns 默认动画配置
   */
  static createDefaultAnimationConfig(duration?: number): AnimationConfig {
    return {
      keyFrames: [],
      duration: duration ?? 2_000_000, // 如果没有提供duration，使用默认2秒
      iterCount: 1, // 固定为1次迭代
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

  /**
   * 将项目坐标系的位置属性转换为WebAV坐标系
   * @param property 属性名（'x' 或 'y'）
   * @param value 项目坐标系的值
   * @param keyFrame 当前关键帧（用于获取其他属性）
   * @param timelineItem 时间轴项目
   * @param videoResolution 视频分辨率
   * @returns WebAV坐标系的值
   */
  private static convertPositionToWebAV(
    property: 'x' | 'y',
    value: number,
    keyFrame: KeyFrame,
    timelineItem: TimelineItem,
    videoResolution: { width: number; height: number }
  ): number {
    // 获取当前关键帧中的x和y值，如果没有则使用TimelineItem的当前值
    const xProp = keyFrame.properties.find(p => p.property === 'x')
    const yProp = keyFrame.properties.find(p => p.property === 'y')

    const projectX = property === 'x' ? value : (xProp?.value ?? timelineItem.x)
    const projectY = property === 'y' ? value : (yProp?.value ?? timelineItem.y)

    // 获取sprite的当前尺寸
    const spriteWidth = timelineItem.width
    const spriteHeight = timelineItem.height

    // 进行坐标转换
    const webavCoords = projectToWebavCoords(
      projectX,
      projectY,
      spriteWidth,
      spriteHeight,
      videoResolution.width,
      videoResolution.height
    )

    return property === 'x' ? webavCoords.x : webavCoords.y
  }
}

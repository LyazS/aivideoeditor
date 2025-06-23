/**
 * 时间码工具类
 * 提供时间码和微秒之间的转换，以及相关的工具方法
 * 统一使用30fps作为标准帧率
 */

import { 
  microsecondsToTimecode, 
  timecodeToMicroseconds, 
  microsecondsToTimecodeString,
  timecodeStringToMicroseconds,
  formatTimecode,
  parseTimecode,
  type Timecode 
} from '../stores/utils/storeUtils'

export class TimecodeUtils {
  private static readonly STANDARD_FRAME_RATE = 30

  /**
   * WebAV时间转换：将WebAV返回的微秒转换为UI显示的时间码字符串
   * @param microseconds WebAV返回的微秒值
   * @param frameRate 帧率（默认30fps）
   * @returns 时间码字符串 (HH:MM:SS.FF)
   */
  static webAVToTimecode(microseconds: number, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): string {
    return microsecondsToTimecodeString(microseconds, frameRate)
  }

  /**
   * UI时间转换：将UI输入的时间码字符串转换为WebAV需要的微秒值
   * @param timecodeString 时间码字符串 (HH:MM:SS.FF 或 MM:SS.FF)
   * @param frameRate 帧率（默认30fps）
   * @returns WebAV需要的微秒值
   */
  static timecodeToWebAV(timecodeString: string, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): number {
    return timecodeStringToMicroseconds(timecodeString, frameRate)
  }

  /**
   * 时间码加法运算
   * @param timecode1 时间码1
   * @param timecode2 时间码2
   * @param frameRate 帧率
   * @returns 相加后的时间码
   */
  static addTimecodes(timecode1: Timecode, timecode2: Timecode, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): Timecode {
    const microseconds1 = timecodeToMicroseconds(timecode1, frameRate)
    const microseconds2 = timecodeToMicroseconds(timecode2, frameRate)
    const resultMicroseconds = microseconds1 + microseconds2
    return microsecondsToTimecode(resultMicroseconds, frameRate)
  }

  /**
   * 时间码减法运算
   * @param timecode1 被减数时间码
   * @param timecode2 减数时间码
   * @param frameRate 帧率
   * @returns 相减后的时间码（如果结果为负数，返回零时间码）
   */
  static subtractTimecodes(timecode1: Timecode, timecode2: Timecode, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): Timecode {
    const microseconds1 = timecodeToMicroseconds(timecode1, frameRate)
    const microseconds2 = timecodeToMicroseconds(timecode2, frameRate)
    const resultMicroseconds = Math.max(0, microseconds1 - microseconds2)
    return microsecondsToTimecode(resultMicroseconds, frameRate)
  }

  /**
   * 比较两个时间码
   * @param timecode1 时间码1
   * @param timecode2 时间码2
   * @param frameRate 帧率
   * @returns -1: timecode1 < timecode2, 0: 相等, 1: timecode1 > timecode2
   */
  static compareTimecodes(timecode1: Timecode, timecode2: Timecode, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): number {
    const microseconds1 = timecodeToMicroseconds(timecode1, frameRate)
    const microseconds2 = timecodeToMicroseconds(timecode2, frameRate)
    
    if (microseconds1 < microseconds2) return -1
    if (microseconds1 > microseconds2) return 1
    return 0
  }

  /**
   * 将时间码对齐到帧边界
   * @param microseconds 微秒值
   * @param frameRate 帧率
   * @returns 对齐后的微秒值
   */
  static alignToFrame(microseconds: number, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): number {
    const timecode = microsecondsToTimecode(microseconds, frameRate)
    return timecodeToMicroseconds(timecode, frameRate)
  }

  /**
   * 获取时间码的总帧数
   * @param timecode 时间码对象
   * @param frameRate 帧率
   * @returns 总帧数
   */
  static getTotalFrames(timecode: Timecode, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): number {
    const { hours, minutes, seconds, frames } = timecode
    return (hours * 3600 + minutes * 60 + seconds) * frameRate + frames
  }

  /**
   * 从总帧数创建时间码
   * @param totalFrames 总帧数
   * @param frameRate 帧率
   * @returns 时间码对象
   */
  static fromTotalFrames(totalFrames: number, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): Timecode {
    const totalSeconds = Math.floor(totalFrames / frameRate)
    const frames = totalFrames % frameRate
    
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    
    return { hours, minutes, seconds, frames }
  }

  /**
   * 验证时间码字符串格式
   * @param timecodeString 时间码字符串
   * @returns 是否为有效格式
   */
  static isValidTimecodeString(timecodeString: string): boolean {
    try {
      parseTimecode(timecodeString)
      return true
    } catch {
      return false
    }
  }

  /**
   * 创建零时间码
   * @returns 零时间码对象
   */
  static zero(): Timecode {
    return { hours: 0, minutes: 0, seconds: 0, frames: 0 }
  }

  /**
   * 检查时间码是否为零
   * @param timecode 时间码对象
   * @returns 是否为零时间码
   */
  static isZero(timecode: Timecode): boolean {
    return timecode.hours === 0 && timecode.minutes === 0 && timecode.seconds === 0 && timecode.frames === 0
  }

  /**
   * 获取标准帧率
   * @returns 标准帧率（30fps）
   */
  static getStandardFrameRate(): number {
    return TimecodeUtils.STANDARD_FRAME_RATE
  }

  /**
   * 格式化时间码为不同的显示格式
   * @param timecode 时间码对象
   * @param format 格式类型
   * @returns 格式化的字符串
   */
  static formatTimecodeAs(timecode: Timecode, format: 'standard' | 'compact' | 'verbose'): string {
    const { hours, minutes, seconds, frames } = timecode
    
    switch (format) {
      case 'compact':
        // 紧凑格式：省略前导零
        if (hours > 0) {
          return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`
        } else {
          return `${minutes}:${seconds.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`
        }
      
      case 'verbose':
        // 详细格式：包含单位
        if (hours > 0) {
          return `${hours}h ${minutes}m ${seconds}s ${frames}f`
        } else {
          return `${minutes}m ${seconds}s ${frames}f`
        }
      
      case 'standard':
      default:
        return formatTimecode(timecode)
    }
  }
}

// 导出类型
export type { Timecode }

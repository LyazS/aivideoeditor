/**
 * 时间码工具类
 * 提供WebAV集成和高级时间码操作功能
 * 基于新的Timecode类实现
 */

import { Timecode } from './Timecode'
import type { TimecodeComponents } from './Timecode'

// 重新导出核心类型
export { Timecode, type TimecodeComponents }

/**
 * 时间码工具类 - 提供WebAV集成和便捷方法
 */
export class TimecodeUtils {
  private static readonly STANDARD_FRAME_RATE = 30

  // ==================== WebAV集成方法 ====================

  /**
   * WebAV时间转换：将WebAV返回的微秒转换为UI显示的时间码字符串
   * @param microseconds WebAV返回的微秒值
   * @param frameRate 帧率（默认30fps）
   * @returns 时间码字符串 (HH:MM:SS.FF)
   */
  static webAVToTimecode(microseconds: number, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): string {
    const timecode = Timecode.fromMicroseconds(microseconds, frameRate)
    return timecode.toString()
  }

  /**
   * UI时间转换：将UI输入的时间码字符串转换为WebAV需要的微秒值
   * @param timecodeString 时间码字符串 (HH:MM:SS.FF 或 MM:SS.FF)
   * @param frameRate 帧率（默认30fps）
   * @returns WebAV需要的微秒值
   */
  static timecodeToWebAV(timecodeString: string, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): number {
    const timecode = Timecode.fromString(timecodeString, frameRate)
    return timecode.toMicroseconds()
  }

  /**
   * WebAV时间转换：将WebAV返回的微秒转换为Timecode对象
   * @param microseconds WebAV返回的微秒值
   * @param frameRate 帧率（默认30fps）
   * @returns Timecode对象
   */
  static webAVToTimecodeObject(microseconds: number, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): Timecode {
    return Timecode.fromMicroseconds(microseconds, frameRate)
  }

  /**
   * Timecode对象转换为WebAV微秒值
   * @param timecode Timecode对象
   * @returns WebAV需要的微秒值
   */
  static timecodeObjectToWebAV(timecode: Timecode): number {
    return timecode.toMicroseconds()
  }

  // ==================== 时间码运算方法 ====================

  /**
   * 时间码加法运算
   * @param timecode1 时间码1
   * @param timecode2 时间码2
   * @returns 相加后的时间码
   */
  static addTimecodes(timecode1: Timecode, timecode2: Timecode): Timecode {
    return timecode1.add(timecode2)
  }

  /**
   * 时间码减法运算
   * @param timecode1 被减数时间码
   * @param timecode2 减数时间码
   * @returns 相减后的时间码（如果结果为负数，返回零时间码）
   */
  static subtractTimecodes(timecode1: Timecode, timecode2: Timecode): Timecode {
    return timecode1.subtract(timecode2)
  }

  /**
   * 比较两个时间码
   * @param timecode1 时间码1
   * @param timecode2 时间码2
   * @returns -1: timecode1 < timecode2, 0: 相等, 1: timecode1 > timecode2
   */
  static compareTimecodes(timecode1: Timecode, timecode2: Timecode): number {
    return timecode1.compare(timecode2)
  }

  // ==================== 实用工具方法 ====================

  /**
   * 将时间码对齐到帧边界
   * @param microseconds 微秒值
   * @param frameRate 帧率
   * @returns 对齐后的微秒值
   */
  static alignToFrame(microseconds: number, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): number {
    const timecode = Timecode.fromMicroseconds(microseconds, frameRate)
    return timecode.toMicroseconds()
  }

  /**
   * 获取时间码的总帧数
   * @param timecode 时间码对象
   * @returns 总帧数
   */
  static getTotalFrames(timecode: Timecode): number {
    return timecode.totalFrames
  }

  /**
   * 从总帧数创建时间码
   * @param totalFrames 总帧数
   * @param frameRate 帧率
   * @returns 时间码对象
   */
  static fromTotalFrames(totalFrames: number, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): Timecode {
    return Timecode.fromFrames(totalFrames, frameRate)
  }

  /**
   * 验证时间码字符串格式
   * @param timecodeString 时间码字符串
   * @returns 是否为有效格式
   */
  static isValidTimecodeString(timecodeString: string): boolean {
    try {
      new Timecode(timecodeString)
      return true
    } catch {
      return false
    }
  }

  /**
   * 创建零时间码
   * @param frameRate 帧率
   * @returns 零时间码对象
   */
  static zero(frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): Timecode {
    return Timecode.zero(frameRate)
  }

  /**
   * 检查时间码是否为零
   * @param timecode 时间码对象
   * @returns 是否为零时间码
   */
  static isZero(timecode: Timecode): boolean {
    return timecode.isZero()
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
    const { hours, minutes, seconds, frames } = timecode.components

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
        return timecode.toString()
    }
  }

  // ==================== 向后兼容方法 ====================

  /**
   * 从秒数创建时间码字符串（向后兼容）
   * @param seconds 秒数
   * @param frameRate 帧率
   * @returns 时间码字符串
   */
  static secondsToTimecodeString(seconds: number, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): string {
    const timecode = Timecode.fromSeconds(seconds, frameRate)
    return timecode.toString()
  }

  /**
   * 从时间码字符串转换为秒数（向后兼容）
   * @param timecodeString 时间码字符串
   * @param frameRate 帧率
   * @returns 秒数
   */
  static timecodeStringToSeconds(timecodeString: string, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): number {
    const timecode = Timecode.fromString(timecodeString, frameRate)
    return timecode.toSeconds()
  }

  /**
   * 从微秒转换为时间码字符串（向后兼容）
   * @param microseconds 微秒
   * @param frameRate 帧率
   * @returns 时间码字符串
   */
  static microsecondsToTimecodeString(microseconds: number, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): string {
    const timecode = Timecode.fromMicroseconds(microseconds, frameRate)
    return timecode.toString()
  }

  /**
   * 从时间码字符串转换为微秒（向后兼容）
   * @param timecodeString 时间码字符串
   * @param frameRate 帧率
   * @returns 微秒
   */
  static timecodeStringToMicroseconds(timecodeString: string, frameRate: number = TimecodeUtils.STANDARD_FRAME_RATE): number {
    const timecode = Timecode.fromString(timecodeString, frameRate)
    return timecode.toMicroseconds()
  }
}

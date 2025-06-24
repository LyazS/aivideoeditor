/**
 * 时间码工具类
 * 
 * 提供WebAV与UI之间的时间转换、时间码运算和验证功能
 * 作为时间码系统的统一工具接口
 */

import { Timecode } from './Timecode'

/**
 * 时间码工具类
 * 
 * 主要功能：
 * 1. WebAV ↔ UI 时间转换
 * 2. 时间码字符串运算
 * 3. 帧对齐和验证
 * 4. 缓存优化
 */
export class TimecodeUtils {
  // 默认帧率
  private static readonly DEFAULT_FRAME_RATE = 30

  // 转换缓存
  private static readonly conversionCache = new Map<string, string>()
  private static readonly maxCacheSize = 1000

  // ==================== WebAV ↔ UI 转换 ====================

  /**
   * WebAV微秒转时间码字符串
   * @param microseconds WebAV返回的微秒数
   * @param frameRate 帧率（默认30fps）
   * @param includeHours 是否包含小时
   * @returns 时间码字符串 "MM:SS.FF" 或 "HH:MM:SS.FF"
   */
  static webAVToTimecode(
    microseconds: number, 
    frameRate: number = TimecodeUtils.DEFAULT_FRAME_RATE,
    includeHours?: boolean
  ): string {
    const cacheKey = `${microseconds}_${frameRate}_${includeHours}`
    
    // 检查缓存
    if (TimecodeUtils.conversionCache.has(cacheKey)) {
      return TimecodeUtils.conversionCache.get(cacheKey)!
    }

    try {
      const timecode = Timecode.fromMicroseconds(microseconds, frameRate)
      const result = timecode.toString(includeHours)
      
      // 添加到缓存
      TimecodeUtils.addToCache(cacheKey, result)
      
      return result
    } catch (error) {
      console.error('WebAV微秒转时间码失败:', error)
      return '00:00.00'
    }
  }

  /**
   * 时间码字符串转WebAV微秒
   * @param timecodeString 时间码字符串
   * @param frameRate 帧率（默认30fps）
   * @returns WebAV需要的微秒数
   */
  static timecodeToWebAV(
    timecodeString: string, 
    frameRate: number = TimecodeUtils.DEFAULT_FRAME_RATE
  ): number {
    const cacheKey = `${timecodeString}_${frameRate}_toWebAV`
    
    // 检查缓存
    const cached = TimecodeUtils.conversionCache.get(cacheKey)
    if (cached) {
      return parseFloat(cached)
    }

    try {
      const timecode = Timecode.fromString(timecodeString, frameRate)
      const result = timecode.toMicroseconds()
      
      // 添加到缓存
      TimecodeUtils.addToCache(cacheKey, result.toString())
      
      return result
    } catch (error) {
      console.error('时间码转WebAV微秒失败:', error)
      return 0
    }
  }

  /**
   * 秒数转时间码字符串
   * @param seconds 秒数
   * @param frameRate 帧率（默认30fps）
   * @param includeHours 是否包含小时
   * @returns 时间码字符串
   */
  static secondsToTimecode(
    seconds: number, 
    frameRate: number = TimecodeUtils.DEFAULT_FRAME_RATE,
    includeHours?: boolean
  ): string {
    try {
      const timecode = Timecode.fromSeconds(seconds, frameRate)
      return timecode.toString(includeHours)
    } catch (error) {
      console.error('秒数转时间码失败:', error)
      return '00:00.00'
    }
  }

  /**
   * 时间码字符串转秒数
   * @param timecodeString 时间码字符串
   * @param frameRate 帧率（默认30fps）
   * @returns 秒数
   */
  static timecodeToSeconds(
    timecodeString: string, 
    frameRate: number = TimecodeUtils.DEFAULT_FRAME_RATE
  ): number {
    try {
      const timecode = Timecode.fromString(timecodeString, frameRate)
      return timecode.toSeconds()
    } catch (error) {
      console.error('时间码转秒数失败:', error)
      return 0
    }
  }

  // ==================== 时间码运算 ====================

  /**
   * 时间码加法
   * @param timecode1 时间码1
   * @param timecode2 时间码2
   * @param frameRate 帧率（默认30fps）
   * @returns 相加结果的时间码字符串
   */
  static addTimecodes(
    timecode1: string, 
    timecode2: string, 
    frameRate: number = TimecodeUtils.DEFAULT_FRAME_RATE
  ): string {
    try {
      const tc1 = Timecode.fromString(timecode1, frameRate)
      const tc2 = Timecode.fromString(timecode2, frameRate)
      return tc1.add(tc2).toString()
    } catch (error) {
      console.error('时间码加法失败:', error)
      return timecode1
    }
  }

  /**
   * 时间码减法
   * @param timecode1 被减数
   * @param timecode2 减数
   * @param frameRate 帧率（默认30fps）
   * @returns 相减结果的时间码字符串
   */
  static subtractTimecodes(
    timecode1: string, 
    timecode2: string, 
    frameRate: number = TimecodeUtils.DEFAULT_FRAME_RATE
  ): string {
    try {
      const tc1 = Timecode.fromString(timecode1, frameRate)
      const tc2 = Timecode.fromString(timecode2, frameRate)
      return tc1.subtract(tc2).toString()
    } catch (error) {
      console.error('时间码减法失败:', error)
      return timecode1
    }
  }

  /**
   * 时间码比较
   * @param timecode1 时间码1
   * @param timecode2 时间码2
   * @param frameRate 帧率（默认30fps）
   * @returns -1: timecode1 < timecode2, 0: 相等, 1: timecode1 > timecode2
   */
  static compareTimecodes(
    timecode1: string, 
    timecode2: string, 
    frameRate: number = TimecodeUtils.DEFAULT_FRAME_RATE
  ): number {
    try {
      const tc1 = Timecode.fromString(timecode1, frameRate)
      const tc2 = Timecode.fromString(timecode2, frameRate)
      return tc1.compare(tc2)
    } catch (error) {
      console.error('时间码比较失败:', error)
      return 0
    }
  }

  // ==================== 帧对齐和验证 ====================

  /**
   * 将时间对齐到帧边界
   * @param time 时间（秒）
   * @param frameRate 帧率（默认30fps）
   * @returns 对齐后的时间（秒）
   */
  static alignToFrame(time: number, frameRate: number = TimecodeUtils.DEFAULT_FRAME_RATE): number {
    try {
      const timecode = Timecode.fromSeconds(time, frameRate)
      return timecode.toSeconds()
    } catch (error) {
      console.error('帧对齐失败:', error)
      return time
    }
  }

  /**
   * 验证时间码格式
   * @param timecodeString 时间码字符串
   * @returns 是否为有效格式
   */
  static validateTimecode(timecodeString: string): boolean {
    try {
      new Timecode(timecodeString)
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取时间码的帧数
   * @param timecodeString 时间码字符串
   * @param frameRate 帧率（默认30fps）
   * @returns 总帧数
   */
  static getFrameCount(
    timecodeString: string, 
    frameRate: number = TimecodeUtils.DEFAULT_FRAME_RATE
  ): number {
    try {
      const timecode = Timecode.fromString(timecodeString, frameRate)
      return timecode.totalFrames
    } catch (error) {
      console.error('获取帧数失败:', error)
      return 0
    }
  }

  // ==================== 格式化和显示 ====================

  /**
   * 格式化时间码显示
   * @param timecodeString 时间码字符串
   * @param options 格式化选项
   * @returns 格式化后的字符串
   */
  static formatTimecodeDisplay(
    timecodeString: string,
    options: {
      showFrames?: boolean
      showHours?: boolean
      separator?: string
    } = {}
  ): string {
    const { showFrames = true, showHours, separator = ':' } = options

    try {
      const timecode = Timecode.fromString(timecodeString)
      const { hours, minutes, seconds, frames } = timecode.components

      let result = ''
      
      if (showHours || hours > 0) {
        result += `${hours.toString().padStart(2, '0')}${separator}`
      }
      
      result += `${minutes.toString().padStart(2, '0')}${separator}${seconds.toString().padStart(2, '0')}`
      
      if (showFrames) {
        result += `.${frames.toString().padStart(2, '0')}`
      }

      return result
    } catch (error) {
      console.error('格式化时间码显示失败:', error)
      return timecodeString
    }
  }

  /**
   * 获取时间码的可读描述
   * @param timecodeString 时间码字符串
   * @returns 可读描述
   */
  static getTimecodeDescription(timecodeString: string): string {
    try {
      const timecode = Timecode.fromString(timecodeString)
      const { hours, minutes, seconds, frames } = timecode.components

      const parts: string[] = []
      
      if (hours > 0) {
        parts.push(`${hours}小时`)
      }
      if (minutes > 0) {
        parts.push(`${minutes}分钟`)
      }
      if (seconds > 0) {
        parts.push(`${seconds}秒`)
      }
      if (frames > 0) {
        parts.push(`${frames}帧`)
      }

      return parts.length > 0 ? parts.join('') : '0秒'
    } catch (error) {
      console.error('获取时间码描述失败:', error)
      return '无效时间码'
    }
  }

  // ==================== 缓存管理 ====================

  /**
   * 添加到缓存
   */
  private static addToCache(key: string, value: string): void {
    // 如果缓存已满，清除最旧的条目
    if (TimecodeUtils.conversionCache.size >= TimecodeUtils.maxCacheSize) {
      const firstKey = TimecodeUtils.conversionCache.keys().next().value
      if (firstKey !== undefined) {
        TimecodeUtils.conversionCache.delete(firstKey)
      }
    }

    TimecodeUtils.conversionCache.set(key, value)
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    TimecodeUtils.conversionCache.clear()
  }

  /**
   * 获取缓存统计
   */
  static getCacheStats(): { size: number; maxSize: number } {
    return {
      size: TimecodeUtils.conversionCache.size,
      maxSize: TimecodeUtils.maxCacheSize
    }
  }
}

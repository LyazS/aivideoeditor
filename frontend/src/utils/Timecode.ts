/**
 * 时间码系统核心类
 * 
 * 基于总帧数存储的时间码实现，提供帧级精度的时间控制
 * 支持多种输入格式和运算操作，与WebAV引擎无缝集成
 * 
 * 设计原则：
 * 1. 以帧为最小精度单位
 * 2. 基于总帧数的简单整数运算
 * 3. 类型安全的操作接口
 * 4. 不可变的运算结果
 */

// 支持的输入类型
export type TimecodeInput = 
  | string                    // "00:30.15"
  | number                    // 915 (总帧数)
  | TimecodeComponents        // {hours: 0, minutes: 0, seconds: 30, frames: 15}
  | Timecode                  // 另一个时间码实例

export interface TimecodeComponents {
  hours: number
  minutes: number
  seconds: number
  frames: number
}

/**
 * 时间码类
 * 
 * 核心存储：总帧数 + 帧率
 * 所有运算都基于总帧数进行，避免复杂的时分秒进位计算
 */
export class Timecode {
  private _totalFrames: number  // 核心存储：总帧数
  private _frameRate: number    // 帧率（默认30fps）

  /**
   * 构造函数
   * @param input 输入值（字符串、数字、组件对象或另一个时间码实例）
   * @param frameRate 帧率（默认30fps）
   */
  constructor(input: TimecodeInput, frameRate: number = 30) {
    this._frameRate = this.validateFrameRate(frameRate)
    this._totalFrames = this.parseInput(input)
  }

  // ==================== 静态工厂方法 ====================

  /**
   * 从字符串创建时间码
   * @param timecodeString 时间码字符串 "HH:MM:SS.FF" 或 "MM:SS.FF"
   * @param frameRate 帧率
   */
  static fromString(timecodeString: string, frameRate: number = 30): Timecode {
    return new Timecode(timecodeString, frameRate)
  }

  /**
   * 从总帧数创建时间码
   * @param frames 总帧数
   * @param frameRate 帧率
   */
  static fromFrames(frames: number, frameRate: number = 30): Timecode {
    return new Timecode(frames, frameRate)
  }

  /**
   * 从秒数创建时间码
   * @param seconds 秒数
   * @param frameRate 帧率
   */
  static fromSeconds(seconds: number, frameRate: number = 30): Timecode {
    const totalFrames = Math.round(seconds * frameRate)
    return new Timecode(totalFrames, frameRate)
  }

  /**
   * 从微秒创建时间码
   * @param microseconds 微秒数
   * @param frameRate 帧率
   */
  static fromMicroseconds(microseconds: number, frameRate: number = 30): Timecode {
    const seconds = microseconds / 1000000
    return Timecode.fromSeconds(seconds, frameRate)
  }

  /**
   * 创建零时间码
   * @param frameRate 帧率
   */
  static zero(frameRate: number = 30): Timecode {
    return new Timecode(0, frameRate)
  }

  // ==================== 获取器属性 ====================

  /**
   * 获取总帧数
   */
  get totalFrames(): number {
    return this._totalFrames
  }

  /**
   * 获取帧率
   */
  get frameRate(): number {
    return this._frameRate
  }

  /**
   * 获取时间码组件
   */
  get components(): TimecodeComponents {
    const totalSeconds = Math.floor(this._totalFrames / this._frameRate)
    const frames = this._totalFrames % this._frameRate
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return { hours, minutes, seconds, frames }
  }

  /**
   * 获取小时
   */
  get hours(): number {
    return this.components.hours
  }

  /**
   * 获取分钟
   */
  get minutes(): number {
    return this.components.minutes
  }

  /**
   * 获取秒
   */
  get seconds(): number {
    return this.components.seconds
  }

  /**
   * 获取帧
   */
  get frames(): number {
    return this.components.frames
  }

  // ==================== 转换方法 ====================

  /**
   * 转换为时间码字符串
   * @param includeHours 是否包含小时（默认自动判断）
   */
  toString(includeHours?: boolean): string {
    const { hours, minutes, seconds, frames } = this.components
    
    const shouldIncludeHours = includeHours !== undefined ? includeHours : hours > 0
    
    if (shouldIncludeHours) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`
    }
  }

  /**
   * 转换为秒数
   */
  toSeconds(): number {
    return this._totalFrames / this._frameRate
  }

  /**
   * 转换为微秒数
   */
  toMicroseconds(): number {
    return this.toSeconds() * 1000000
  }

  /**
   * 转换为毫秒数
   */
  toMilliseconds(): number {
    return this.toSeconds() * 1000
  }

  // ==================== 运算方法 ====================

  /**
   * 加法运算
   * @param other 另一个时间码
   */
  add(other: Timecode): Timecode {
    this.ensureCompatibleFrameRate(other)
    return new Timecode(this._totalFrames + other._totalFrames, this._frameRate)
  }

  /**
   * 减法运算
   * @param other 另一个时间码
   */
  subtract(other: Timecode): Timecode {
    this.ensureCompatibleFrameRate(other)
    const result = Math.max(0, this._totalFrames - other._totalFrames)
    return new Timecode(result, this._frameRate)
  }

  /**
   * 乘法运算
   * @param multiplier 乘数
   */
  multiply(multiplier: number): Timecode {
    if (multiplier < 0) {
      throw new Error('乘数不能为负数')
    }
    const result = Math.round(this._totalFrames * multiplier)
    return new Timecode(result, this._frameRate)
  }

  /**
   * 除法运算
   * @param divisor 除数
   */
  divide(divisor: number): Timecode {
    if (divisor <= 0) {
      throw new Error('除数必须为正数')
    }
    const result = Math.round(this._totalFrames / divisor)
    return new Timecode(result, this._frameRate)
  }

  // ==================== 比较方法 ====================

  /**
   * 相等比较
   * @param other 另一个时间码
   */
  equals(other: Timecode): boolean {
    this.ensureCompatibleFrameRate(other)
    return this._totalFrames === other._totalFrames
  }

  /**
   * 小于比较
   * @param other 另一个时间码
   */
  lessThan(other: Timecode): boolean {
    this.ensureCompatibleFrameRate(other)
    return this._totalFrames < other._totalFrames
  }

  /**
   * 大于比较
   * @param other 另一个时间码
   */
  greaterThan(other: Timecode): boolean {
    this.ensureCompatibleFrameRate(other)
    return this._totalFrames > other._totalFrames
  }

  /**
   * 比较方法
   * @param other 另一个时间码
   * @returns -1: 小于, 0: 等于, 1: 大于
   */
  compare(other: Timecode): number {
    this.ensureCompatibleFrameRate(other)
    if (this._totalFrames < other._totalFrames) return -1
    if (this._totalFrames > other._totalFrames) return 1
    return 0
  }

  /**
   * 是否为零
   */
  isZero(): boolean {
    return this._totalFrames === 0
  }

  // ==================== 实用方法 ====================

  /**
   * 克隆时间码
   */
  clone(): Timecode {
    return new Timecode(this._totalFrames, this._frameRate)
  }

  /**
   * 转换帧率
   * @param newFrameRate 新帧率
   */
  convertFrameRate(newFrameRate: number): Timecode {
    const seconds = this.toSeconds()
    return Timecode.fromSeconds(seconds, newFrameRate)
  }

  // ==================== 私有方法 ====================

  /**
   * 验证帧率
   */
  private validateFrameRate(frameRate: number): number {
    if (!Number.isFinite(frameRate) || frameRate <= 0) {
      throw new Error(`无效的帧率: ${frameRate}`)
    }
    return frameRate
  }

  /**
   * 解析输入值
   */
  private parseInput(input: TimecodeInput): number {
    if (typeof input === 'number') {
      if (!Number.isFinite(input) || input < 0) {
        throw new Error(`无效的帧数: ${input}`)
      }
      return Math.floor(input)
    }

    if (typeof input === 'string') {
      return this.parseTimecodeString(input)
    }

    if (input instanceof Timecode) {
      if (input._frameRate !== this._frameRate) {
        // 自动转换帧率
        return Math.round(input.toSeconds() * this._frameRate)
      }
      return input._totalFrames
    }

    if (typeof input === 'object' && input !== null) {
      return this.parseTimecodeComponents(input as TimecodeComponents)
    }

    throw new Error(`不支持的输入类型: ${typeof input}`)
  }

  /**
   * 解析时间码字符串
   */
  private parseTimecodeString(timecodeString: string): number {
    // 支持格式: "HH:MM:SS.FF" 或 "MM:SS.FF"
    const patterns = [
      /^(\d{1,2}):(\d{2}):(\d{2})\.(\d{2})$/, // HH:MM:SS.FF
      /^(\d{1,2}):(\d{2})\.(\d{2})$/,         // MM:SS.FF
    ]

    for (const pattern of patterns) {
      const match = timecodeString.match(pattern)
      if (match) {
        if (match.length === 5) {
          // HH:MM:SS.FF 格式
          const [, hours, minutes, seconds, frames] = match
          return this.parseTimecodeComponents({
            hours: parseInt(hours, 10),
            minutes: parseInt(minutes, 10),
            seconds: parseInt(seconds, 10),
            frames: parseInt(frames, 10)
          })
        } else if (match.length === 4) {
          // MM:SS.FF 格式
          const [, minutes, seconds, frames] = match
          return this.parseTimecodeComponents({
            hours: 0,
            minutes: parseInt(minutes, 10),
            seconds: parseInt(seconds, 10),
            frames: parseInt(frames, 10)
          })
        }
      }
    }

    throw new Error(`无效的时间码格式: ${timecodeString}`)
  }

  /**
   * 解析时间码组件
   */
  private parseTimecodeComponents(components: TimecodeComponents): number {
    const { hours, minutes, seconds, frames } = components

    // 验证组件值
    if (hours < 0 || minutes < 0 || minutes >= 60 || 
        seconds < 0 || seconds >= 60 || 
        frames < 0 || frames >= this._frameRate) {
      throw new Error(`无效的时间码组件: ${JSON.stringify(components)}`)
    }

    // 计算总帧数
    return (hours * 3600 + minutes * 60 + seconds) * this._frameRate + frames
  }

  /**
   * 确保帧率兼容
   */
  private ensureCompatibleFrameRate(other: Timecode): void {
    if (this._frameRate !== other._frameRate) {
      throw new Error(`帧率不匹配: ${this._frameRate} vs ${other._frameRate}`)
    }
  }
}

// ==================== 时间码核心类型定义 ====================

/**
 * 时间码组件接口
 */
export interface TimecodeComponents {
  hours: number
  minutes: number
  seconds: number
  frames: number
}

/**
 * 时间码输入类型
 */
export type TimecodeInput = 
  | string                    // "00:30.15"
  | number                    // 915 (总帧数)
  | TimecodeComponents        // {hours: 0, minutes: 0, seconds: 30, frames: 15}
  | Timecode                  // 另一个时间码实例

// ==================== 核心Timecode类 ====================

/**
 * 时间码类 - 基于总帧数的高性能时间码实现
 * 
 * 设计特点：
 * - 内部使用总帧数存储，避免复杂的时分秒进位计算
 * - 支持多种输入格式，提供灵活的API
 * - 提供完整的运算和比较方法
 * - 与WebAV系统无缝集成
 */
export class Timecode {
  private _totalFrames: number  // 核心存储：总帧数
  private _frameRate: number    // 帧率（默认30fps）

  private static readonly STANDARD_FRAME_RATE = 30

  /**
   * 构造函数
   * @param input 时间码输入（字符串、数字、组件对象或另一个时间码实例）
   * @param frameRate 帧率（默认30fps）
   */
  constructor(input: TimecodeInput = 0, frameRate: number = Timecode.STANDARD_FRAME_RATE) {
    this._frameRate = this.validateFrameRate(frameRate)
    this._totalFrames = this.parseInput(input)
  }

  // ==================== 静态工厂方法 ====================

  /**
   * 从字符串创建时间码
   */
  static fromString(timecodeString: string, frameRate: number = Timecode.STANDARD_FRAME_RATE): Timecode {
    return new Timecode(timecodeString, frameRate)
  }

  /**
   * 从总帧数创建时间码
   */
  static fromFrames(totalFrames: number, frameRate: number = Timecode.STANDARD_FRAME_RATE): Timecode {
    return new Timecode(totalFrames, frameRate)
  }

  /**
   * 从秒数创建时间码
   */
  static fromSeconds(seconds: number, frameRate: number = Timecode.STANDARD_FRAME_RATE): Timecode {
    const totalFrames = Math.round(seconds * frameRate)
    return new Timecode(totalFrames, frameRate)
  }

  /**
   * 从微秒创建时间码
   */
  static fromMicroseconds(microseconds: number, frameRate: number = Timecode.STANDARD_FRAME_RATE): Timecode {
    const seconds = microseconds / 1000000
    return Timecode.fromSeconds(seconds, frameRate)
  }

  /**
   * 创建零时间码
   */
  static zero(frameRate: number = Timecode.STANDARD_FRAME_RATE): Timecode {
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
   * 转换为字符串格式 (HH:MM:SS.FF)
   */
  toString(): string {
    const { hours, minutes, seconds, frames } = this.components
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`
    }
  }

  /**
   * 转换为秒数（浮点数）
   */
  toSeconds(): number {
    return this._totalFrames / this._frameRate
  }

  /**
   * 转换为微秒
   */
  toMicroseconds(): number {
    return Math.round(this.toSeconds() * 1000000)
  }

  /**
   * 转换为毫秒
   */
  toMilliseconds(): number {
    return Math.round(this.toSeconds() * 1000)
  }

  // ==================== 运算方法 ====================

  /**
   * 加法运算
   */
  add(other: Timecode): Timecode {
    this.validateFrameRateCompatibility(other)
    return new Timecode(this._totalFrames + other._totalFrames, this._frameRate)
  }

  /**
   * 减法运算
   */
  subtract(other: Timecode): Timecode {
    this.validateFrameRateCompatibility(other)
    const result = Math.max(0, this._totalFrames - other._totalFrames)
    return new Timecode(result, this._frameRate)
  }

  /**
   * 乘法运算
   */
  multiply(factor: number): Timecode {
    const result = Math.round(this._totalFrames * factor)
    return new Timecode(result, this._frameRate)
  }

  /**
   * 除法运算
   */
  divide(divisor: number): Timecode {
    if (divisor === 0) {
      throw new Error('除数不能为零')
    }
    const result = Math.round(this._totalFrames / divisor)
    return new Timecode(result, this._frameRate)
  }

  // ==================== 比较方法 ====================

  /**
   * 相等比较
   */
  equals(other: Timecode): boolean {
    this.validateFrameRateCompatibility(other)
    return this._totalFrames === other._totalFrames
  }

  /**
   * 小于比较
   */
  lessThan(other: Timecode): boolean {
    this.validateFrameRateCompatibility(other)
    return this._totalFrames < other._totalFrames
  }

  /**
   * 大于比较
   */
  greaterThan(other: Timecode): boolean {
    this.validateFrameRateCompatibility(other)
    return this._totalFrames > other._totalFrames
  }

  /**
   * 比较方法
   * @returns -1: 小于, 0: 相等, 1: 大于
   */
  compare(other: Timecode): number {
    this.validateFrameRateCompatibility(other)
    if (this._totalFrames < other._totalFrames) return -1
    if (this._totalFrames > other._totalFrames) return 1
    return 0
  }

  /**
   * 是否为零时间码
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
    if (frameRate <= 0 || !Number.isFinite(frameRate)) {
      throw new Error(`无效的帧率: ${frameRate}`)
    }
    return frameRate
  }

  /**
   * 解析输入
   */
  private parseInput(input: TimecodeInput): number {
    if (typeof input === 'number') {
      // 直接使用总帧数
      return Math.max(0, Math.round(input))
    }
    
    if (typeof input === 'string') {
      // 解析时间码字符串
      return this.parseTimecodeString(input)
    }
    
    if (input instanceof Timecode) {
      // 从另一个时间码实例复制
      if (input._frameRate !== this._frameRate) {
        // 需要转换帧率
        return Math.round(input.toSeconds() * this._frameRate)
      }
      return input._totalFrames
    }
    
    // 从组件对象解析
    const { hours, minutes, seconds, frames } = input as TimecodeComponents
    return (hours * 3600 + minutes * 60 + seconds) * this._frameRate + frames
  }

  /**
   * 解析时间码字符串
   */
  private parseTimecodeString(timecodeString: string): number {
    // 支持格式: HH:MM:SS.FF 或 MM:SS.FF
    const pattern = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})\.(\d{1,2})$/
    const match = timecodeString.match(pattern)
    
    if (!match) {
      throw new Error(`无效的时间码格式: ${timecodeString}`)
    }
    
    const hours = parseInt(match[1] || '0', 10)
    const minutes = parseInt(match[2], 10)
    const seconds = parseInt(match[3], 10)
    const frames = parseInt(match[4], 10)
    
    // 验证范围
    if (minutes >= 60 || seconds >= 60 || frames >= this._frameRate) {
      throw new Error(`时间码数值超出范围: ${timecodeString}`)
    }
    
    return (hours * 3600 + minutes * 60 + seconds) * this._frameRate + frames
  }

  /**
   * 验证帧率兼容性
   */
  private validateFrameRateCompatibility(other: Timecode): void {
    if (this._frameRate !== other._frameRate) {
      throw new Error(`帧率不匹配: ${this._frameRate} vs ${other._frameRate}`)
    }
  }
}

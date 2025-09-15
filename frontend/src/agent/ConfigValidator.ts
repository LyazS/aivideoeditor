/**
 * 配置验证器 - 验证操作配置的合法性
 * 确保所有操作参数符合系统要求
 */

interface OperationConfig {
  type: string
  params: any
}

interface ValidationError {
  operation: OperationConfig
  error: string
}

interface ValidationResult {
  validOperations: OperationConfig[]
  errors: ValidationError[]
}

interface TextStyleConfig {
  fontSize: number
  fontFamily: string
  fontWeight: string | number
  fontStyle: 'normal' | 'italic'
  color: string
  backgroundColor?: string
  textShadow?: string
  textStroke?: {
    width: number
    color: string
  }
  textGlow?: {
    color: string
    blur: number
    spread?: number
  }
  textAlign: 'left' | 'center' | 'right'
  lineHeight?: number
  maxWidth?: number
  customFont?: {
    name: string
    url: string
  }
}

export class ConfigValidator {
  /**
   * 验证操作配置数组
   */
  validateOperations(operations: OperationConfig[]): ValidationResult {
    const errors: ValidationError[] = []
    const validOperations: OperationConfig[] = []

    for (const op of operations) {
      try {
        this.validateSingleOperation(op)
        validOperations.push(op)
      } catch (error: any) {
        errors.push({ operation: op, error: error.message })
      }
    }

    return { validOperations, errors }
  }

  /**
   * 验证单个操作
   */
  private validateSingleOperation(op: OperationConfig) {
    if (!op.type || typeof op.type !== 'string') {
      throw new Error('操作类型不能为空且必须是字符串')
    }

    if (!op.params || typeof op.params !== 'object') {
      throw new Error('操作参数不能为空且必须是对象')
    }

    switch (op.type) {
      // 时间轴项目操作
      case 'addTimelineItem':
        this.validateTimelineItemData(op.params)
        break
      case 'rmTimelineItem':
        this.validateTimelineItemId(op.params.timelineItemId)
        break
      case 'mvTimelineItem':
        this.validateMvTimelineItemParams(op.params)
        break
      case 'splitTimelineItem':
        this.validateSplitTimelineItemParams(op.params)
        break
      case 'cpTimelineItem':
        this.validateCpTimelineItemParams(op.params)
        break
      case 'resizeTimelineItem':
        this.validateResizeTimelineItemParams(op.params)
        break
      case 'updateTimelineItemTransform':
        this.validateTransformParams(op.params)
        break

      // 轨道操作
      case 'addTrack':
        this.validateAddTrackParams(op.params)
        break
      case 'rmTrack':
        this.validateTrackId(op.params.trackId)
        break
      case 'renameTrack':
        this.validateRenameTrackParams(op.params)
        break
      case 'autoArrangeTrack':
        this.validateTrackId(op.params.trackId)
        break
      case 'toggleTrackVisibility':
        this.validateToggleTrackParams(op.params)
        break
      case 'toggleTrackMute':
        this.validateToggleTrackParams(op.params)
        break

      // 文本操作
      case 'updateTextContent':
        this.validateUpdateTextContentParams(op.params)
        break
      case 'updateTextStyle':
        this.validateUpdateTextStyleParams(op.params)
        break

      // 关键帧操作
      case 'createKeyframe':
        this.validateKeyframeParams(op.params)
        break
      case 'deleteKeyframe':
        this.validateKeyframeParams(op.params)
        break
      case 'updateKeyframeProperty':
        this.validateUpdateKeyframePropertyParams(op.params)
        break
      case 'clearAllKeyframes':
        this.validateTimelineItemId(op.params.timelineItemId)
        break

      default:
        throw new Error(`不支持的操作类型: ${op.type}`)
    }
  }

  /**
   * 验证时间码格式 (HH:MM:SS.FF)
   */
  private validateTimecode(timecode: string): void {
    if (typeof timecode !== 'string') {
      throw new Error('时间码必须是字符串')
    }

    const timecodeRegex = /^(\d{2}):(\d{2}):(\d{2})\.(\d{2})$/
    if (!timecodeRegex.test(timecode)) {
      throw new Error(`无效的时间码格式: ${timecode}，应为 HH:MM:SS.FF 格式`)
    }

    const [, hours, minutes, seconds, frames] = timecode.match(timecodeRegex)!
    const h = parseInt(hours, 10)
    const m = parseInt(minutes, 10)
    const s = parseInt(seconds, 10)

    if (h < 0 || m < 0 || m > 59 || s < 0 || s > 59) {
      throw new Error(`无效的时间码值: ${timecode}`)
    }
  }

  /**
   * 验证时间轴项目数据
   */
  private validateTimelineItemData(params: any): void {
    if (!params.mediaItemId || typeof params.mediaItemId !== 'string') {
      throw new Error('mediaItemId 不能为空且必须是字符串')
    }

    if (!params.trackId || typeof params.trackId !== 'string') {
      throw new Error('trackId 不能为空且必须是字符串')
    }

    if (!params.timeRange || typeof params.timeRange !== 'object') {
      throw new Error('timeRange 不能为空且必须是对象')
    }

    this.validateTimecode(params.timeRange.start)
    this.validateTimecode(params.timeRange.end)

    if (this.timeToSeconds(params.timeRange.start) >= this.timeToSeconds(params.timeRange.end)) {
      throw new Error('开始时间必须早于结束时间')
    }
  }

  /**
   * 验证时间轴项目ID
   */
  private validateTimelineItemId(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new Error('timelineItemId 不能为空且必须是字符串')
    }
  }

  /**
   * 验证轨道ID
   */
  private validateTrackId(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new Error('trackId 不能为空且必须是字符串')
    }
  }

  /**
   * 验证移动时间轴项目参数
   */
  private validateMvTimelineItemParams(params: any): void {
    this.validateTimelineItemId(params.timelineItemId)
    this.validateTimecode(params.newPosition)

    if (params.newTrackId && typeof params.newTrackId !== 'string') {
      throw new Error('newTrackId 必须是字符串')
    }
  }

  /**
   * 验证分割时间轴项目参数
   */
  private validateSplitTimelineItemParams(params: any): void {
    this.validateTimelineItemId(params.timelineItemId)
    this.validateTimecode(params.splitPosition)
  }

  /**
   * 验证复制时间轴项目参数
   */
  private validateCpTimelineItemParams(params: any): void {
    this.validateTimelineItemId(params.timelineItemId)

    if (params.newPosition) {
      this.validateTimecode(params.newPosition)
    }

    if (params.newTrackId && typeof params.newTrackId !== 'string') {
      throw new Error('newTrackId 必须是字符串')
    }
  }

  /**
   * 验证调整时间轴项目大小参数
   */
  private validateResizeTimelineItemParams(params: any): void {
    this.validateTimelineItemId(params.timelineItemId)

    if (!params.newTimeRange || typeof params.newTimeRange !== 'object') {
      throw new Error('newTimeRange 不能为空且必须是对象')
    }

    this.validateTimecode(params.newTimeRange.timelineStart)
    this.validateTimecode(params.newTimeRange.timelineEnd)
    this.validateTimecode(params.newTimeRange.clipStart)
    this.validateTimecode(params.newTimeRange.clipEnd)
  }

  /**
   * 验证变换参数
   */
  private validateTransformParams(params: any): void {
    this.validateTimelineItemId(params.timelineItemId)

    if (!params.newTransform || typeof params.newTransform !== 'object') {
      throw new Error('newTransform 不能为空且必须是对象')
    }

    const transform = params.newTransform
    const numericFields = [
      'x',
      'y',
      'width',
      'height',
      'rotation',
      'opacity',
      'zIndex',
      'playbackRate',
      'volume',
      'gain',
    ]

    for (const field of numericFields) {
      if (transform[field] !== undefined && typeof transform[field] !== 'number') {
        throw new Error(`${field} 必须是数字`)
      }
    }

    if (transform.opacity !== undefined && (transform.opacity < 0 || transform.opacity > 1)) {
      throw new Error('opacity 必须在 0-1 之间')
    }

    if (transform.volume !== undefined && (transform.volume < 0 || transform.volume > 1)) {
      throw new Error('volume 必须在 0-1 之间')
    }

    if (transform.duration !== undefined) {
      this.validateTimecode(transform.duration)
    }

    if (transform.isMuted !== undefined && typeof transform.isMuted !== 'boolean') {
      throw new Error('isMuted 必须是布尔值')
    }
  }

  /**
   * 验证添加轨道参数
   */
  private validateAddTrackParams(params: any): void {
    const validTypes = ['video', 'audio', 'text']
    if (params.type && !validTypes.includes(params.type)) {
      throw new Error(`无效的轨道类型: ${params.type}，应为 video、audio 或 text`)
    }

    if (params.position !== undefined && typeof params.position !== 'number') {
      throw new Error('position 必须是数字')
    }
  }

  /**
   * 验证重命名轨道参数
   */
  private validateRenameTrackParams(params: any): void {
    this.validateTrackId(params.trackId)

    if (!params.newName || typeof params.newName !== 'string') {
      throw new Error('newName 不能为空且必须是字符串')
    }
  }

  /**
   * 验证切换轨道参数
   */
  private validateToggleTrackParams(params: any): void {
    this.validateTrackId(params.trackId)

    if (params.visible !== undefined && typeof params.visible !== 'boolean') {
      throw new Error('visible 必须是布尔值')
    }

    if (params.muted !== undefined && typeof params.muted !== 'boolean') {
      throw new Error('muted 必须是布尔值')
    }
  }

  /**
   * 验证更新文本内容参数
   */
  private validateUpdateTextContentParams(params: any): void {
    this.validateTimelineItemId(params.timelineItemId)

    if (!params.newText || typeof params.newText !== 'string') {
      throw new Error('newText 不能为空且必须是字符串')
    }

    if (params.newStyle !== undefined) {
      this.validateTextStyle(params.newStyle)
    }
  }

  /**
   * 验证更新文本样式参数
   */
  private validateUpdateTextStyleParams(params: any): void {
    this.validateTimelineItemId(params.timelineItemId)

    if (!params.newStyle || typeof params.newStyle !== 'object') {
      throw new Error('newStyle 不能为空且必须是对象')
    }

    this.validateTextStyle(params.newStyle)
  }

  /**
   * 验证文本样式
   */
  private validateTextStyle(style: Partial<TextStyleConfig>): void {
    if (style.fontSize !== undefined) {
      if (typeof style.fontSize !== 'number' || style.fontSize <= 0) {
        throw new Error('fontSize 必须是大于0的数字')
      }
    }

    if (style.fontFamily && typeof style.fontFamily !== 'string') {
      throw new Error('fontFamily 必须是字符串')
    }

    if (style.fontWeight) {
      if (typeof style.fontWeight !== 'string' && typeof style.fontWeight !== 'number') {
        throw new Error('fontWeight 必须是字符串或数字')
      }
    }

    if (style.fontStyle && !['normal', 'italic'].includes(style.fontStyle)) {
      throw new Error('fontStyle 必须是 "normal" 或 "italic"')
    }

    if (style.color && typeof style.color !== 'string') {
      throw new Error('color 必须是字符串')
    }

    if (style.backgroundColor && typeof style.backgroundColor !== 'string') {
      throw new Error('backgroundColor 必须是字符串')
    }

    if (style.textAlign && !['left', 'center', 'right'].includes(style.textAlign)) {
      throw new Error('textAlign 必须是 "left"、"center" 或 "right"')
    }

    if (style.lineHeight !== undefined && typeof style.lineHeight !== 'number') {
      throw new Error('lineHeight 必须是数字')
    }

    if (style.maxWidth !== undefined && typeof style.maxWidth !== 'number') {
      throw new Error('maxWidth 必须是数字')
    }
  }

  /**
   * 验证关键帧参数
   */
  private validateKeyframeParams(params: any): void {
    this.validateTimelineItemId(params.timelineItemId)
    this.validateTimecode(params.position)
  }

  /**
   * 验证更新关键帧属性参数
   */
  private validateUpdateKeyframePropertyParams(params: any): void {
    this.validateTimelineItemId(params.timelineItemId)
    this.validateTimecode(params.position)

    if (!params.property || typeof params.property !== 'string') {
      throw new Error('property 不能为空且必须是字符串')
    }

    // value 可以是任意类型，但会进行运行时检查
  }

  /**
   * 将时间码转换为秒数用于比较
   */
  private timeToSeconds(timecode: string): number {
    const [, hours, minutes, seconds, frames] = timecode.match(
      /^(\d{2}):(\d{2}):(\d{2})\.(\d{2})$/,
    )!
    const h = parseInt(hours, 10)
    const m = parseInt(minutes, 10)
    const s = parseInt(seconds, 10)
    const f = parseInt(frames, 10)

    return h * 3600 + m * 60 + s + f / 30 // 假设 30fps
  }
}

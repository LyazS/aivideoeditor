/**
 * 统一时间轴项目工厂函数
 * 支持混合类型系统的重构版本
 */

import { reactive } from 'vue'
import { cloneDeep } from 'lodash'
import { generateUUID4 } from '@/utils/idGenerator'
import type { MediaType, MediaTypeOrUnknown } from '../mediaitem'
import type {
  VideoMediaConfig,
  ImageMediaConfig,
  AudioMediaConfig,
  TextMediaConfig,
  GetMediaConfig
} from './TimelineItemData'
import type {
  UnifiedTimeRange
} from '../types/timeRange'
import type {
  UnifiedTimelineItemData,
  KnownTimelineItem,
  UnknownMediaConfig,
  AnimationConfig,
  Keyframe
} from './TimelineItemData'

// ==================== 基础工厂函数 ====================

/**
 * 创建已知媒体类型的时间轴项目
 */
export function createKnownTimelineItem<T extends MediaType>(
  mediaType: T,
  options: {
    id?: string
    mediaItemId: string
    trackId: string
    timeRange: UnifiedTimeRange
    config: GetMediaConfig<T>
    timelineStatus?: 'loading' | 'ready' | 'error'
  }
): UnifiedTimelineItemData<T> {
  return reactive({
    id: options.id || generateUUID4(),
    mediaItemId: options.mediaItemId,
    trackId: options.trackId,
    mediaType,
    timeRange: options.timeRange,
    config: options.config,
    timelineStatus: options.timelineStatus || 'loading'
  }) as UnifiedTimelineItemData<T>
}

/**
 * 创建未知媒体类型的时间轴项目（异步处理占位符）
 */
export function createUnknownTimelineItem(options: {
  id?: string
  mediaItemId: string
  trackId: string
  timeRange: UnifiedTimeRange
  config: UnknownMediaConfig
  timelineStatus?: 'loading' | 'ready' | 'error'
}): UnifiedTimelineItemData<'unknown'> {
  return reactive({
    id: options.id || generateUUID4(),
    mediaItemId: options.mediaItemId,
    trackId: options.trackId,
    mediaType: 'unknown' as const,
    timeRange: options.timeRange,
    config: options.config,
    timelineStatus: options.timelineStatus || 'loading'
  })
}

// ==================== 具体媒体类型工厂函数 ====================

/**
 * 创建视频时间轴项目
 */
export function createVideoTimelineItem(options: {
  id?: string
  mediaItemId: string
  trackId: string
  timeRange: UnifiedTimeRange
  config: VideoMediaConfig
}): UnifiedTimelineItemData<'video'> {
  return createKnownTimelineItem('video', options)
}

/**
 * 创建图片时间轴项目
 */
export function createImageTimelineItem(options: {
  id?: string
  mediaItemId: string
  trackId: string
  timeRange: UnifiedTimeRange
  config: ImageMediaConfig
}): UnifiedTimelineItemData<'image'> {
  return createKnownTimelineItem('image', options)
}

/**
 * 创建音频时间轴项目
 */
export function createAudioTimelineItem(options: {
  id?: string
  mediaItemId: string
  trackId: string
  timeRange: UnifiedTimeRange
  config: AudioMediaConfig
}): UnifiedTimelineItemData<'audio'> {
  return createKnownTimelineItem('audio', options)
}

/**
 * 创建文本时间轴项目
 */
export function createTextTimelineItem(options: {
  id?: string
  mediaItemId: string
  trackId: string
  timeRange: UnifiedTimeRange
  config: TextMediaConfig
}): UnifiedTimelineItemData<'text'> {
  return createKnownTimelineItem('text', options)
}

// ==================== 默认配置创建函数 ====================

/**
 * 创建默认视频配置
 */
export function createDefaultVideoConfig(): VideoMediaConfig {
  return {
    // 视觉属性
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    rotation: 0,
    opacity: 1,
    originalWidth: 1920,
    originalHeight: 1080,
    proportionalScale: true,
    // 音频属性
    volume: 1,
    isMuted: false,
    // 基础属性
    zIndex: 0
  }
}

/**
 * 创建默认图片配置
 */
export function createDefaultImageConfig(): ImageMediaConfig {
  return {
    // 视觉属性
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    rotation: 0,
    opacity: 1,
    originalWidth: 1920,
    originalHeight: 1080,
    proportionalScale: true,
    // 基础属性
    zIndex: 0
  }
}

/**
 * 创建默认音频配置
 */
export function createDefaultAudioConfig(): AudioMediaConfig {
  return {
    // 音频属性
    volume: 1,
    isMuted: false,
    gain: 0,
    // 基础属性
    zIndex: 0
  }
}

/**
 * 创建默认文本配置
 */
export function createDefaultTextConfig(text: string = '新文本'): TextMediaConfig {
  return {
    // 视觉属性
    x: 960, // 居中
    y: 540, // 居中
    width: 400,
    height: 100,
    rotation: 0,
    opacity: 1,
    originalWidth: 400,
    originalHeight: 100,
    proportionalScale: true,
    // 文本属性
    text,
    style: {
      fontSize: 48,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#ffffff',
      textAlign: 'center',
      lineHeight: 1.2
    },
    // 基础属性
    zIndex: 0
  }
}

/**
 * 创建默认未知媒体配置（用于未知类型）
 */
export function createDefaultUnknownConfig(name: string, expectedDuration: number): UnknownMediaConfig {
  return {
    name,
    expectedDuration
  }
}

// ==================== 时间范围创建函数 ====================

/**
 * 创建视频时间范围
 */
export function createVideoTimeRange(
  timelineStartTime: number,
  timelineEndTime: number,
  clipStartTime: number = 0,
  clipEndTime?: number,
  playbackRate: number = 1
): UnifiedTimeRange {
  const effectiveDuration = timelineEndTime - timelineStartTime
  return {
    timelineStartTime,
    timelineEndTime,
    clipStartTime,
    clipEndTime: clipEndTime || clipStartTime + effectiveDuration
  }
}

/**
 * 创建图片时间范围
 */
export function createImageTimeRange(
  timelineStartTime: number,
  timelineEndTime: number
): UnifiedTimeRange {
  return {
    timelineStartTime,
    timelineEndTime,
    clipStartTime: -1,
    clipEndTime: -1
  }
}

/**
 * 创建基础时间范围（用于未知类型）
 */
export function createBaseTimeRange(
  timelineStartTime: number,
  timelineEndTime: number
): UnifiedTimeRange {
  return {
    timelineStartTime,
    timelineEndTime,
    clipStartTime: -1,
    clipEndTime: -1
  }
}

// ==================== 便捷创建函数 ====================

/**
 * 便捷创建视频时间轴项目（带默认配置）
 */
export function createVideoTimelineItemWithDefaults(options: {
  mediaItemId: string
  trackId: string
  timelineStartTime: number
  timelineEndTime: number
  name: string
  clipStartTime?: number
  clipEndTime?: number
  playbackRate?: number
  configOverrides?: Partial<VideoMediaConfig>
}): UnifiedTimelineItemData<'video'> {
  const timeRange = createVideoTimeRange(
    options.timelineStartTime,
    options.timelineEndTime,
    options.clipStartTime,
    options.clipEndTime,
    options.playbackRate
  )
  
  const config = {
    ...createDefaultVideoConfig(),
    ...options.configOverrides
  }

  return createVideoTimelineItem({
    mediaItemId: options.mediaItemId,
    trackId: options.trackId,
    timeRange,
    config
  })
}

/**
 * 便捷创建图片时间轴项目（带默认配置）
 */
export function createImageTimelineItemWithDefaults(options: {
  mediaItemId: string
  trackId: string
  timelineStartTime: number
  timelineEndTime: number
  name: string
  configOverrides?: Partial<ImageMediaConfig>
}): UnifiedTimelineItemData<'image'> {
  const timeRange = createImageTimeRange(options.timelineStartTime, options.timelineEndTime)
  
  const config = {
    ...createDefaultImageConfig(),
    ...options.configOverrides
  }

  return createImageTimelineItem({
    mediaItemId: options.mediaItemId,
    trackId: options.trackId,
    timeRange,
    config
  })
}

/**
 * 便捷创建音频时间轴项目（带默认配置）
 */
export function createAudioTimelineItemWithDefaults(options: {
  mediaItemId: string
  trackId: string
  timelineStartTime: number
  timelineEndTime: number
  name: string
  clipStartTime?: number
  clipEndTime?: number
  playbackRate?: number
  configOverrides?: Partial<AudioMediaConfig>
}): UnifiedTimelineItemData<'audio'> {
  const timeRange = createVideoTimeRange(
    options.timelineStartTime,
    options.timelineEndTime,
    options.clipStartTime,
    options.clipEndTime,
    options.playbackRate
  )
  
  const config = {
    ...createDefaultAudioConfig(),
    ...options.configOverrides
  }

  return createAudioTimelineItem({
    mediaItemId: options.mediaItemId,
    trackId: options.trackId,
    timeRange,
    config
  })
}

/**
 * 便捷创建文本时间轴项目（带默认配置）
 */
export function createTextTimelineItemWithDefaults(options: {
  mediaItemId: string
  trackId: string
  timelineStartTime: number
  timelineEndTime: number
  name: string
  text?: string
  configOverrides?: Partial<TextMediaConfig>
}): UnifiedTimelineItemData<'text'> {
  const timeRange = createImageTimeRange(options.timelineStartTime, options.timelineEndTime)
  
  const config = {
    ...createDefaultTextConfig(options.text),
    ...options.configOverrides
  }

  return createTextTimelineItem({
    mediaItemId: options.mediaItemId,
    trackId: options.trackId,
    timeRange,
    config
  })
}

/**
 * 便捷创建未知类型时间轴项目（带默认配置）
 */
export function createUnknownTimelineItemWithDefaults(options: {
  mediaItemId: string
  trackId: string
  timelineStartTime: number
  timelineEndTime: number
  name: string
  expectedDuration?: number
}): UnifiedTimelineItemData<'unknown'> {
  const timeRange = createBaseTimeRange(options.timelineStartTime, options.timelineEndTime)
  const expectedDuration = options.expectedDuration || (options.timelineEndTime - options.timelineStartTime)
  const config = createDefaultUnknownConfig(options.name, expectedDuration)

  return createUnknownTimelineItem({
    mediaItemId: options.mediaItemId,
    trackId: options.trackId,
    timeRange,
    config
  })
}

// ==================== 克隆和复制函数 ====================

/**
 * 克隆时间轴项目（深拷贝）
 * 使用 lodash.cloneDeep 确保完整的深拷贝
 */
export function cloneTimelineItem<T extends MediaTypeOrUnknown>(
  original: UnifiedTimelineItemData<T>,
  overrides?: {
    id?: string
    mediaItemId?: string
    trackId?: string
    timeRange?: UnifiedTimeRange
    config?: T extends 'unknown' ? UnknownMediaConfig : GetMediaConfig<T & MediaType>
    timelineStatus?: 'loading' | 'ready' | 'error'
    animation?: T extends MediaType ? AnimationConfig<T> : undefined
  }
): UnifiedTimelineItemData<T> {
  // 深拷贝原始对象，排除不需要克隆的 sprite 属性
  const cloned = cloneDeep({
    ...original,
    sprite: undefined // 明确排除 sprite，它需要重新创建
  })

  // 应用覆盖值
  const result = {
    ...cloned,
    id: overrides?.id || generateUUID4(), // 总是生成新ID
    mediaItemId: overrides?.mediaItemId || cloned.mediaItemId,
    trackId: overrides?.trackId || cloned.trackId,
    timelineStatus: overrides?.timelineStatus || cloned.timelineStatus,
    timeRange: overrides?.timeRange ? cloneDeep(overrides.timeRange) : cloned.timeRange,
    config: overrides?.config ? cloneDeep(overrides.config) : cloned.config,
    animation: overrides?.animation ? cloneDeep(overrides.animation) : cloned.animation
  }

  return reactive(result) as UnifiedTimelineItemData<T>
}

/**
 * 复制时间轴项目到新轨道
 */
export function duplicateTimelineItem<T extends MediaTypeOrUnknown>(
  original: UnifiedTimelineItemData<T>,
  newTrackId: string,
  timeOffset: number = 0
): UnifiedTimelineItemData<T> {
  const newTimeRange = {
    ...original.timeRange,
    timelineStartTime: original.timeRange.timelineStartTime + timeOffset,
    timelineEndTime: original.timeRange.timelineEndTime + timeOffset
  }

  const newConfig = {
    ...original.config
  }

  return cloneTimelineItem(original, {
    trackId: newTrackId,
    timeRange: newTimeRange as any,
    config: newConfig as any
  })
}

// ==================== 验证函数 ====================

/**
 * 验证时间轴项目数据的有效性
 */
export function validateTimelineItem<T extends MediaTypeOrUnknown>(
  item: UnifiedTimelineItemData<T>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // 检查必需字段
  if (!item.id) {
    errors.push('缺少ID')
  }

  if (!item.mediaItemId) {
    errors.push('缺少关联的媒体项目ID')
  }

  if (!item.trackId) {
    errors.push('缺少轨道ID')
  }

  // 配置验证（根据媒体类型进行不同的验证）
  if (!item.config) {
    errors.push('缺少配置信息')
  }

  // 检查时间范围
  if (item.timeRange.timelineStartTime < 0) {
    errors.push('时间轴开始时间不能为负数')
  }

  if (item.timeRange.timelineEndTime <= item.timeRange.timelineStartTime) {
    errors.push('时间轴结束时间必须大于开始时间')
  }

  // 检查媒体类型特定的配置
  if (item.mediaType !== 'unknown') {
    // 已知媒体类型的额外验证
    const knownItem = item as KnownTimelineItem
    
    if (knownItem.mediaType === 'video' || knownItem.mediaType === 'audio') {
      const timeRange = knownItem.timeRange
      if (timeRange.clipStartTime < 0) {
        errors.push('素材开始时间不能为负数')
      }
      if (timeRange.clipEndTime <= timeRange.clipStartTime) {
        errors.push('素材结束时间必须大于开始时间')
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// ==================== 导出工厂对象 ====================

export const TimelineItemFactory = {
  // 基础创建函数
  createKnown: createKnownTimelineItem,
  createUnknown: createUnknownTimelineItem,
  
  // 具体类型创建函数
  createVideo: createVideoTimelineItem,
  createImage: createImageTimelineItem,
  createAudio: createAudioTimelineItem,
  createText: createTextTimelineItem,
  
  // 便捷创建函数
  createVideoWithDefaults: createVideoTimelineItemWithDefaults,
  createImageWithDefaults: createImageTimelineItemWithDefaults,
  createAudioWithDefaults: createAudioTimelineItemWithDefaults,
  createTextWithDefaults: createTextTimelineItemWithDefaults,
  createUnknownWithDefaults: createUnknownTimelineItemWithDefaults,
  
  // 配置创建函数
  createDefaultVideoConfig,
  createDefaultImageConfig,
  createDefaultAudioConfig,
  createDefaultTextConfig,
  createDefaultUnknownConfig,
  
  // 时间范围创建函数
  createVideoTimeRange,
  createImageTimeRange,
  createBaseTimeRange,
  
  // 工具函数
  clone: cloneTimelineItem,
  duplicate: duplicateTimelineItem,
  validate: validateTimelineItem
}

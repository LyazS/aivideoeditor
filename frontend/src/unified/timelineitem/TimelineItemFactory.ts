/**
 * 统一时间轴项目工厂函数
 * 基于"核心数据与行为分离"的重构方案
 */

import { reactive } from 'vue'
import { generateUUID4 } from '@/utils/idGenerator'
import type { MediaType } from '../mediaitem'
import type {
  UnifiedTimelineItemData,
  CreateTimelineItemOptions,
  TimelineItemStatus,
  BasicTimelineConfig,
  TransformData
} from './TimelineItemData'


// ==================== 工厂函数 ====================

/**
 * 创建响应式时间轴项目数据对象
 */
export function createTimelineItemData(options: CreateTimelineItemOptions): UnifiedTimelineItemData {
  return reactive({
    id: generateUUID4(),
    mediaItemId: options.mediaItemId,
    trackId: options.trackId,
    timelineStatus: options.initialStatus || 'loading',
    mediaType: options.mediaType || 'unknown',
    timeRange: options.timeRange,
    config: options.config,
    spriteId: undefined
  })
}

/**
 * 创建基础时间轴配置
 */
export function createBasicTimelineConfig(name: string, options?: {
  transform?: TransformData
  videoConfig?: BasicTimelineConfig['videoConfig']
  audioConfig?: BasicTimelineConfig['audioConfig']
  imageConfig?: BasicTimelineConfig['imageConfig']
}): BasicTimelineConfig {
  return {
    name,
    transform: options?.transform,
    videoConfig: options?.videoConfig,
    audioConfig: options?.audioConfig,
    imageConfig: options?.imageConfig
  }
}

/**
 * 创建默认变换配置
 */
export function createDefaultTransform(): TransformData {
  return {
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    playbackRate: 1,
    volume: 1,
    isMuted: false,
    gain: 0
  }
}

// ==================== 便捷工厂函数 ====================

/**
 * 创建视频时间轴项目数据
 */
export function createVideoTimelineItem(options: {
  mediaItemId: string
  trackId?: string
  timeRange: { timelineStartTime: number; timelineEndTime: number }
  name: string
  clipStartTime?: number
  clipEndTime?: number
  transform?: TransformData
}): UnifiedTimelineItemData {
  const config = createBasicTimelineConfig(options.name, {
    transform: options.transform || createDefaultTransform(),
    videoConfig: {
      clipStartTime: options.clipStartTime,
      clipEndTime: options.clipEndTime
    }
  })

  return createTimelineItemData({
    mediaItemId: options.mediaItemId,
    trackId: options.trackId,
    timeRange: options.timeRange,
    config,
    mediaType: 'video'
  })
}

/**
 * 创建音频时间轴项目数据
 */
export function createAudioTimelineItem(options: {
  mediaItemId: string
  trackId?: string
  timeRange: { timelineStartTime: number; timelineEndTime: number }
  name: string
  volume?: number
  isMuted?: boolean
  gain?: number
}): UnifiedTimelineItemData {
  const config = createBasicTimelineConfig(options.name, {
    audioConfig: {
      volume: options.volume ?? 1,
      isMuted: options.isMuted ?? false,
      gain: options.gain ?? 0
    }
  })

  return createTimelineItemData({
    mediaItemId: options.mediaItemId,
    trackId: options.trackId,
    timeRange: options.timeRange,
    config,
    mediaType: 'audio'
  })
}

/**
 * 创建图片时间轴项目数据
 */
export function createImageTimelineItem(options: {
  mediaItemId: string
  trackId?: string
  timeRange: { timelineStartTime: number; timelineEndTime: number }
  name: string
  displayDuration?: number
  transform?: TransformData
}): UnifiedTimelineItemData {
  const config = createBasicTimelineConfig(options.name, {
    transform: options.transform || createDefaultTransform(),
    imageConfig: {
      displayDuration: options.displayDuration
    }
  })

  return createTimelineItemData({
    mediaItemId: options.mediaItemId,
    trackId: options.trackId,
    timeRange: options.timeRange,
    config,
    mediaType: 'image'
  })
}

// ==================== 克隆和复制函数 ====================

/**
 * 克隆时间轴项目数据（深拷贝）
 */
export function cloneTimelineItemData(
  original: UnifiedTimelineItemData,
  overrides?: Partial<CreateTimelineItemOptions>
): UnifiedTimelineItemData {
  return createTimelineItemData({
    mediaItemId: overrides?.mediaItemId || original.mediaItemId,
    trackId: overrides?.trackId || original.trackId,
    timeRange: overrides?.timeRange || { ...original.timeRange },
    config: overrides?.config || { ...original.config },
    mediaType: overrides?.mediaType || original.mediaType,
    initialStatus: overrides?.initialStatus || original.timelineStatus
  })
}

/**
 * 从现有项目创建副本（新ID）
 */
export function duplicateTimelineItem(
  original: UnifiedTimelineItemData,
  newTrackId?: string,
  timeOffset?: number
): UnifiedTimelineItemData {
  const timeRange = timeOffset ? {
    timelineStartTime: original.timeRange.timelineStartTime + timeOffset,
    timelineEndTime: original.timeRange.timelineEndTime + timeOffset
  } : { ...original.timeRange }

  return createTimelineItemData({
    mediaItemId: original.mediaItemId,
    trackId: newTrackId || original.trackId,
    timeRange,
    config: { ...original.config, name: `${original.config.name} (副本)` },
    mediaType: original.mediaType,
    initialStatus: 'loading' // 副本需要重新处理
  })
}

// ==================== 验证函数 ====================

/**
 * 验证时间轴项目数据的有效性
 */
export function validateTimelineItemData(data: UnifiedTimelineItemData): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // 检查必需字段
  if (!data.id) {
    errors.push('缺少ID')
  }

  if (!data.mediaItemId) {
    errors.push('缺少关联的媒体项目ID')
  }

  if (!data.config?.name) {
    errors.push('缺少项目名称')
  }

  // 检查时间范围
  if (data.timeRange.timelineStartTime < 0) {
    errors.push('时间轴开始时间不能为负数')
  }

  if (data.timeRange.timelineEndTime <= data.timeRange.timelineStartTime) {
    errors.push('时间轴结束时间必须大于开始时间')
  }

  // 检查状态一致性
  if (data.timelineStatus === 'ready' && !data.spriteId) {
    errors.push('就绪状态的项目必须有关联的Sprite')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// ==================== 导出所有工厂函数 ====================

export const TimelineItemFactory = {
  create: createTimelineItemData,
  createConfig: createBasicTimelineConfig,
  createTransform: createDefaultTransform,
  createVideo: createVideoTimelineItem,
  createAudio: createAudioTimelineItem,
  createImage: createImageTimelineItem,
  clone: cloneTimelineItemData,
  duplicate: duplicateTimelineItem,
  validate: validateTimelineItemData
}

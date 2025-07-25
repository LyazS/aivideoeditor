/**
 * 统一时间轴项目工厂函数
 * 提供创建和初始化时间轴项目的工具函数
 */

import { reactive } from 'vue'
import type {
  UnifiedTimelineItem,
  TimelineItemStatus,
  BasicTimelineConfig,
  VideoMediaConfig,
  ImageMediaConfig,
  AudioMediaConfig,
  TextMediaConfig,
  TextStyleConfig
} from './types'
import type { MediaType } from './types'
import { TIMELINE_CONTEXT_TEMPLATES } from './contextTemplates'
import { generateUUID4 } from '../../utils/idGenerator'

// ==================== 默认配置 ====================

/**
 * 默认文本样式配置
 */
export const DEFAULT_TEXT_STYLE: TextStyleConfig = {
  fontSize: 48,
  fontFamily: 'Arial, sans-serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#ffffff',
  textAlign: 'center',
  lineHeight: 1.2,
}

/**
 * 默认媒体配置生成器
 */
export const DEFAULT_MEDIA_CONFIGS = {
  video: (): VideoMediaConfig => ({
    mediaType: 'video',
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    rotation: 0,
    opacity: 1,
    zIndex: 1,
    volume: 1,
    isMuted: false,
    playbackRate: 1
  }),

  image: (): ImageMediaConfig => ({
    mediaType: 'image',
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    rotation: 0,
    opacity: 1,
    zIndex: 1
  }),

  audio: (): AudioMediaConfig => ({
    mediaType: 'audio',
    volume: 1,
    isMuted: false,
    gain: 0
  }),

  text: (): TextMediaConfig => ({
    mediaType: 'text',
    x: 0,
    y: 0,
    width: 1920,
    height: 200,
    rotation: 0,
    opacity: 1,
    zIndex: 2,
    text: '新建文本',
    style: { ...DEFAULT_TEXT_STYLE }
  })
}

// ==================== 工厂函数 ====================

/**
 * 创建统一时间轴项目的基础参数
 */
export interface CreateTimelineItemParams {
  id?: string
  mediaItemId: string
  trackId?: string
  mediaType?: MediaType | 'unknown'
  name: string
  startTime: number
  endTime: number
  initialStatus?: TimelineItemStatus
  mediaConfig?: any
}

/**
 * 创建响应式的统一时间轴项目
 */
export function createUnifiedTimelineItem(params: CreateTimelineItemParams): UnifiedTimelineItem {
  const {
    id = generateTimelineItemId(),
    mediaItemId,
    trackId,
    mediaType = 'unknown',
    name,
    startTime,
    endTime,
    initialStatus = 'loading',
    mediaConfig
  } = params

  // 生成默认媒体配置
  const defaultMediaConfig = mediaType !== 'unknown' 
    ? DEFAULT_MEDIA_CONFIGS[mediaType as MediaType]() 
    : DEFAULT_MEDIA_CONFIGS.video() // 未知类型时使用视频配置作为默认

  // 创建基础配置
  const config: BasicTimelineConfig = {
    name,
    mediaConfig: mediaConfig || defaultMediaConfig
  }

  // 创建响应式时间轴项目
  const timelineItem: UnifiedTimelineItem = reactive({
    id,
    mediaItemId,
    trackId,
    timelineStatus: initialStatus,
    statusContext: getInitialStatusContext(initialStatus),
    mediaType,
    timeRange: {
      timelineStartTime: startTime,
      timelineEndTime: endTime
    },
    config
  })

  console.log(`🏭 [TimelineItemFactory] 创建时间轴项目: ${name} (${id})`)
  return timelineItem
}

/**
 * 为特定媒体类型创建时间轴项目
 */
export function createTimelineItemForMediaType<T extends MediaType>(
  mediaType: T,
  params: Omit<CreateTimelineItemParams, 'mediaType' | 'mediaConfig'> & {
    mediaConfig?: any
  }
): UnifiedTimelineItem {
  const mediaConfig = params.mediaConfig || DEFAULT_MEDIA_CONFIGS[mediaType]()
  
  return createUnifiedTimelineItem({
    ...params,
    mediaType,
    mediaConfig
  })
}

/**
 * 创建视频时间轴项目
 */
export function createVideoTimelineItem(
  params: Omit<CreateTimelineItemParams, 'mediaType' | 'mediaConfig'> & {
    mediaConfig?: Partial<VideoMediaConfig>
  }
): UnifiedTimelineItem {
  const defaultConfig = DEFAULT_MEDIA_CONFIGS.video()
  const mediaConfig = { ...defaultConfig, ...params.mediaConfig }
  
  return createTimelineItemForMediaType('video', {
    ...params,
    mediaConfig
  })
}

/**
 * 创建图片时间轴项目
 */
export function createImageTimelineItem(
  params: Omit<CreateTimelineItemParams, 'mediaType' | 'mediaConfig'> & {
    mediaConfig?: Partial<ImageMediaConfig>
  }
): UnifiedTimelineItem {
  const defaultConfig = DEFAULT_MEDIA_CONFIGS.image()
  const mediaConfig = { ...defaultConfig, ...params.mediaConfig }
  
  return createTimelineItemForMediaType('image', {
    ...params,
    mediaConfig
  })
}

/**
 * 创建音频时间轴项目
 */
export function createAudioTimelineItem(
  params: Omit<CreateTimelineItemParams, 'mediaType' | 'mediaConfig'> & {
    mediaConfig?: Partial<AudioMediaConfig>
  }
): UnifiedTimelineItem {
  const defaultConfig = DEFAULT_MEDIA_CONFIGS.audio()
  const mediaConfig = { ...defaultConfig, ...params.mediaConfig }
  
  return createTimelineItemForMediaType('audio', {
    ...params,
    mediaConfig
  })
}

/**
 * 创建文本时间轴项目
 */
export function createTextTimelineItem(
  params: Omit<CreateTimelineItemParams, 'mediaType' | 'mediaConfig'> & {
    text?: string
    style?: Partial<TextStyleConfig>
    mediaConfig?: Partial<TextMediaConfig>
  }
): UnifiedTimelineItem {
  const defaultConfig = DEFAULT_MEDIA_CONFIGS.text()
  const textConfig: TextMediaConfig = {
    ...defaultConfig,
    text: params.text || defaultConfig.text,
    style: { ...defaultConfig.style, ...params.style },
    ...params.mediaConfig
  }
  
  return createTimelineItemForMediaType('text', {
    ...params,
    mediaConfig: textConfig
  })
}

// ==================== 工具函数 ====================

/**
 * 生成唯一的时间轴项目ID
 */
export function generateTimelineItemId(): string {
  return generateUUID4()
}

/**
 * 获取初始状态上下文
 */
function getInitialStatusContext(status: TimelineItemStatus) {
  switch (status) {
    case 'loading':
      return TIMELINE_CONTEXT_TEMPLATES.processingStart()
    case 'ready':
      return TIMELINE_CONTEXT_TEMPLATES.ready()
    case 'error':
      return TIMELINE_CONTEXT_TEMPLATES.error('初始化失败')
    default:
      return undefined
  }
}

/**
 * 从现有项目克隆创建新项目
 */
export function cloneTimelineItem(
  sourceItem: UnifiedTimelineItem,
  overrides?: Partial<CreateTimelineItemParams>
): UnifiedTimelineItem {
  const params: CreateTimelineItemParams = {
    mediaItemId: sourceItem.mediaItemId,
    trackId: sourceItem.trackId,
    mediaType: sourceItem.mediaType as MediaType,
    name: `${sourceItem.config.name} (副本)`,
    startTime: sourceItem.timeRange.timelineStartTime,
    endTime: sourceItem.timeRange.timelineEndTime,
    initialStatus: 'loading',
    mediaConfig: JSON.parse(JSON.stringify(sourceItem.config.mediaConfig)), // 深拷贝配置
    ...overrides
  }

  return createUnifiedTimelineItem(params)
}

/**
 * 批量创建时间轴项目
 */
export function createMultipleTimelineItems(
  paramsList: CreateTimelineItemParams[]
): UnifiedTimelineItem[] {
  return paramsList.map(params => createUnifiedTimelineItem(params))
}

/**
 * 从配置数据恢复时间轴项目（用于项目加载）
 */
export function restoreTimelineItemFromData(data: any): UnifiedTimelineItem {
  return createUnifiedTimelineItem({
    id: data.id,
    mediaItemId: data.mediaItemId,
    trackId: data.trackId,
    mediaType: data.mediaType,
    name: data.config?.name || '未命名项目',
    startTime: data.timeRange?.timelineStartTime || 0,
    endTime: data.timeRange?.timelineEndTime || 0,
    initialStatus: 'loading', // 恢复时总是从loading状态开始
    mediaConfig: data.config?.mediaConfig
  })
}

/**
 * 统一时间轴项目工厂函数
 * 支持混合类型系统的重构版本
 */

import { reactive, markRaw } from 'vue'
import { cloneDeep } from 'lodash'
import { generateUUID4 } from '@/utils/idGenerator'
import type { MediaType, MediaTypeOrUnknown, UnifiedMediaItemData } from '../mediaitem'
import type {
  VideoMediaConfig,
  ImageMediaConfig,
  AudioMediaConfig,
  TextMediaConfig,
  GetMediaConfig,
} from './TimelineItemData'
import type { UnifiedTimeRange } from '../types/timeRange'
import type {
  UnifiedTimelineItemData,
  KnownTimelineItem,
  UnknownMediaConfig,
  AnimationConfig,
  Keyframe,
  TimelineItemStatus,
} from './TimelineItemData'
import { TimelineItemQueries } from './TimelineItemQueries'
import { UnifiedMediaItemQueries } from '../mediaitem'
import { regenerateThumbnailForUnifiedTimelineItem } from '../utils/thumbnailGenerator'
import { createSpriteFromUnifiedTimelineItem } from '../utils/UnifiedSpriteFactory'
import {
  createTextTimelineItem as createTextTimelineItemFromUtils,
  createSpriteForTextTimelineItem,
} from '../utils/textTimelineUtils'
import { projectToWebavCoords } from '../utils/coordinateTransform'

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
  },
): UnifiedTimelineItemData<T> {
  return reactive({
    id: options.id || generateUUID4(),
    mediaItemId: options.mediaItemId,
    trackId: options.trackId,
    mediaType,
    timeRange: options.timeRange,
    config: options.config,
    timelineStatus: options.timelineStatus || 'loading',
    runtime: {},
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
}): never {
  // 不再支持创建 unknown 类型的时间轴项目
  throw new Error('不再支持创建 unknown 类型的时间轴项目，请使用已知的媒体类型')
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
    zIndex: 0,
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
    zIndex: 0,
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
    zIndex: 0,
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
      lineHeight: 1.2,
    },
    // 基础属性
    zIndex: 0,
  }
}

/**
 * 创建默认未知媒体配置（用于未知类型）
 */
export function createDefaultUnknownConfig(
  name: string,
  expectedDuration: number,
): UnknownMediaConfig {
  return {
    name,
    expectedDuration,
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
  playbackRate: number = 1,
): UnifiedTimeRange {
  const effectiveDuration = timelineEndTime - timelineStartTime
  return {
    timelineStartTime,
    timelineEndTime,
    clipStartTime,
    clipEndTime: clipEndTime || clipStartTime + effectiveDuration,
  }
}

/**
 * 创建图片时间范围
 */
export function createImageTimeRange(
  timelineStartTime: number,
  timelineEndTime: number,
): UnifiedTimeRange {
  return {
    timelineStartTime,
    timelineEndTime,
    clipStartTime: -1,
    clipEndTime: -1,
  }
}

/**
 * 创建基础时间范围（用于未知类型）
 */
export function createBaseTimeRange(
  timelineStartTime: number,
  timelineEndTime: number,
): UnifiedTimeRange {
  return {
    timelineStartTime,
    timelineEndTime,
    clipStartTime: -1,
    clipEndTime: -1,
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
    options.playbackRate,
  )

  const config = {
    ...createDefaultVideoConfig(),
    ...options.configOverrides,
  }

  return createVideoTimelineItem({
    mediaItemId: options.mediaItemId,
    trackId: options.trackId,
    timeRange,
    config,
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
    ...options.configOverrides,
  }

  return createImageTimelineItem({
    mediaItemId: options.mediaItemId,
    trackId: options.trackId,
    timeRange,
    config,
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
    options.playbackRate,
  )

  const config = {
    ...createDefaultAudioConfig(),
    ...options.configOverrides,
  }

  return createAudioTimelineItem({
    mediaItemId: options.mediaItemId,
    trackId: options.trackId,
    timeRange,
    config,
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
    ...options.configOverrides,
  }

  return createTextTimelineItem({
    mediaItemId: options.mediaItemId,
    trackId: options.trackId,
    timeRange,
    config,
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
}): never {
  // 不再支持创建 unknown 类型的时间轴项目
  throw new Error('不再支持创建 unknown 类型的时间轴项目，请使用已知的媒体类型')
}

// ==================== 克隆和复制函数 ====================

/**
 * 克隆时间轴项目（深拷贝）
 * 使用 lodash.cloneDeep 确保完整的深拷贝
 */
export function cloneTimelineItem<T extends MediaType>(
  original: UnifiedTimelineItemData<T>,
  overrides?: {
    id?: string
    mediaItemId?: string
    trackId?: string
    timeRange?: UnifiedTimeRange
    config?: GetMediaConfig<T>
    timelineStatus?: 'loading' | 'ready' | 'error'
    animation?: AnimationConfig<T>
  },
): UnifiedTimelineItemData<T> {
  // 深拷贝原始对象，排除不需要克隆的 runtime 属性
  const cloned = cloneDeep({
    ...original,
    runtime: {}, // 明确排除 runtime，它需要重新创建
  })

  // 应用覆盖值
  const result = {
    ...cloned,
    id: overrides?.id || cloned.id,
    mediaItemId: overrides?.mediaItemId || cloned.mediaItemId,
    trackId: overrides?.trackId || cloned.trackId,
    timelineStatus: overrides?.timelineStatus || cloned.timelineStatus,
    timeRange: overrides?.timeRange ? cloneDeep(overrides.timeRange) : cloned.timeRange,
    config: overrides?.config ? cloneDeep(overrides.config) : cloned.config,
    animation: overrides?.animation ? cloneDeep(overrides.animation) : cloned.animation,
  }

  return reactive(result) as UnifiedTimelineItemData<T>
}

/**
 * 复制时间轴项目到新轨道
 */
export function duplicateTimelineItem<T extends MediaType>(
  original: UnifiedTimelineItemData<T>,
  newTrackId: string,
  timeOffset: number = 0,
): UnifiedTimelineItemData<T> {
  const newTimeRange: UnifiedTimeRange = {
    ...original.timeRange,
    timelineStartTime: original.timeRange.timelineStartTime + timeOffset,
    timelineEndTime: original.timeRange.timelineEndTime + timeOffset,
  }

  const newConfig: GetMediaConfig<T> = {
    ...original.config,
  }

  return cloneTimelineItem(original, {
    id: generateUUID4(),
    trackId: newTrackId,
    timeRange: newTimeRange,
    config: newConfig,
  })
}

// ==================== 验证函数 ====================

/**
 * 验证时间轴项目数据的有效性
 */
export function validateTimelineItem<T extends MediaType>(
  item: UnifiedTimelineItemData<T>,
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

  return {
    isValid: errors.length === 0,
    errors,
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
  validate: validateTimelineItem,
  rebuildKnown: rebuildKnownTimelineItem,
  rebuildText: rebuildTextTimelineItem,
}

// ==================== 重建时间轴项目函数 ====================

/**
 * 重建已知时间轴项目的选项接口
 */
export interface RebuildKnownTimelineItemOptions {
  /** 原始时间轴项目数据 */
  originalTimelineItemData: UnifiedTimelineItemData<MediaType>
  /** 获取媒体项目的函数 */
  getMediaItem: (id: string) => UnifiedMediaItemData | undefined
  /** 日志标识符，用于区分不同调用方的日志 */
  logIdentifier: string
}

/**
 * 重建已知时间轴项目的结果接口
 */
export interface RebuildKnownTimelineItemResult {
  /** 重建后的时间轴项目 */
  timelineItem: KnownTimelineItem
  /** 是否成功 */
  success: boolean
  /** 错误信息（如果有） */
  error?: string
}

/**
 * 重建文本时间轴项目的选项接口
 */
export interface RebuildTextTimelineItemOptions {
  /** 原始时间轴项目数据 */
  originalTimelineItemData: UnifiedTimelineItemData<'text'>
  /** 视频分辨率配置 */
  videoResolution: { width: number; height: number }
  /** 日志标识符，用于区分不同调用方的日志 */
  logIdentifier: string
}

/**
 * 重建文本时间轴项目的结果接口
 */
export interface RebuildTextTimelineItemResult {
  /** 重建后的时间轴项目 */
  timelineItem: UnifiedTimelineItemData<'text'>
  /** 是否成功 */
  success: boolean
  /** 错误信息（如果有） */
  error?: string
}

/**
 * 从原始素材重建完整的已知TimelineItem
 * 统一重建逻辑：每次都从原始素材完全重新创建
 *
 * @param options 重建选项
 * @returns 重建结果
 */
export async function rebuildKnownTimelineItem(
  options: RebuildKnownTimelineItemOptions,
): Promise<RebuildKnownTimelineItemResult> {
  const { originalTimelineItemData, getMediaItem, logIdentifier } = options

  try {
    if (!originalTimelineItemData) {
      throw new Error('时间轴项目数据不存在')
    }

    console.log(`🔄 [${logIdentifier}] 开始从源头重建已知时间轴项目...`)
    if (TimelineItemQueries.isTextTimelineItem(originalTimelineItemData)) {
      // 1. 使用 TimelineItemFactory.clone 创建新的 TimelineItem（确保独立性和正确的 runtime 处理）
      const newTimelineItem = cloneTimelineItem(originalTimelineItemData)

      // 2. 使用 textTimelineUtils 中的工具函数创建精灵
      const newSprite = await createSpriteForTextTimelineItem(newTimelineItem)

      // 3. 将精灵添加到 runtime
      newTimelineItem.runtime.sprite = markRaw(newSprite)
      return {
        timelineItem: newTimelineItem,
        success: true,
      }
    } else {
      // 1. 获取原始素材
      const mediaItem = getMediaItem(originalTimelineItemData.mediaItemId)
      if (!mediaItem) {
        throw new Error(`原始素材不存在: ${originalTimelineItemData.mediaItemId}`)
      }

      // 检查素材状态和重建条件
      const isReady = UnifiedMediaItemQueries.isReady(mediaItem)

      // 检查媒体类型和时长
      if (mediaItem.mediaType === 'unknown') {
        throw new Error(`素材类型未确定，无法重建时间轴项目: ${mediaItem.name}`)
      }

      const availableDuration = mediaItem.duration
      if (!availableDuration || availableDuration <= 0) {
        throw new Error(`素材时长信息不可用，无法重建时间轴项目: ${mediaItem.name}`)
      }

      // 根据素材状态确定时间轴项目状态
      const timelineStatus: TimelineItemStatus = isReady ? 'ready' : 'loading'

      if (isReady) {
        // Ready素材：创建包含sprite的完整时间轴项目
        console.log(`🔄 [${logIdentifier}] 重建ready状态时间轴项目`)

        // 2. 使用新的统一函数从时间轴项目数据创建sprite
        const newSprite = await createSpriteFromUnifiedTimelineItem(originalTimelineItemData)

        // 3. 使用TimelineItemFactory.clone创建新的TimelineItem（先不设置缩略图）
        const newTimelineItem = cloneTimelineItem(originalTimelineItemData, {
          timeRange: newSprite.getTimeRange(),
          timelineStatus: timelineStatus,
        }) as KnownTimelineItem

        // 4. 设置runtime和sprite
        newTimelineItem.runtime = {
          sprite: markRaw(newSprite),
        }

        // 4. 重新生成缩略图（异步执行，不阻塞重建过程）
        await regenerateThumbnailForAddedItem(newTimelineItem, mediaItem, logIdentifier)

        console.log(`🔄 [${logIdentifier}] 重建ready状态时间轴项目完成:`, {
          id: newTimelineItem.id,
          mediaType: mediaItem.mediaType,
          timeRange: originalTimelineItemData.timeRange,
          position: { x: newSprite.rect.x, y: newSprite.rect.y },
          size: { w: newSprite.rect.w, h: newSprite.rect.h },
        })

        return {
          timelineItem: newTimelineItem,
          success: true,
        }
      } else {
        // 未Ready素材：创建loading状态的时间轴项目
        console.log(`🔄 [${logIdentifier}] 重建loading状态时间轴项目`)

        // 创建loading状态的时间轴项目
        const newTimelineItem = reactive({
          id: originalTimelineItemData.id,
          mediaItemId: originalTimelineItemData.mediaItemId,
          trackId: originalTimelineItemData.trackId,
          mediaType: originalTimelineItemData.mediaType,
          timeRange: { ...originalTimelineItemData.timeRange },
          config: { ...originalTimelineItemData.config },
          animation: originalTimelineItemData.animation
            ? { ...originalTimelineItemData.animation }
            : undefined,
          timelineStatus: timelineStatus,
          runtime: {}, // loading状态暂时没有sprite
        }) as KnownTimelineItem

        // 注意：状态同步监听将在调用方设置，确保时间轴项目已添加到store

        console.log(`🔄 [${logIdentifier}] 重建loading状态时间轴项目完成:`, {
          id: newTimelineItem.id,
          mediaType: mediaItem.mediaType,
          timeRange: originalTimelineItemData.timeRange,
          status: 'loading',
        })

        return {
          timelineItem: newTimelineItem,
          success: true,
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`❌ [${logIdentifier}] 重建时间轴项目失败:`, errorMessage)

    return {
      timelineItem: originalTimelineItemData as KnownTimelineItem,
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * 为重建的项目重新生成缩略图
 * @param timelineItem 重建的时间轴项目
 * @param mediaItem 对应的媒体项目
 * @param logger 日志工具
 */
async function regenerateThumbnailForAddedItem(
  timelineItem: KnownTimelineItem,
  mediaItem: UnifiedMediaItemData,
  logIdentifier: string,
) {
  // 音频不需要缩略图
  if (mediaItem.mediaType === 'audio') {
    console.log(`🔄 [${logIdentifier}] 音频不需要缩略图，跳过生成`)
    return
  }

  // 检查是否已经有缩略图，避免重复生成
  // 缩略图URL存储在runtime中
  if (timelineItem.runtime.thumbnailUrl) {
    console.log(`🔄 [${logIdentifier}] 项目已有缩略图，跳过重新生成`)
    return
  }

  try {
    console.log(`🔄 [${logIdentifier}] 开始为重建的项目重新生成缩略图...`)

    const thumbnailUrl = await regenerateThumbnailForUnifiedTimelineItem(timelineItem, mediaItem)

    if (thumbnailUrl) {
      console.log(`🔄 [${logIdentifier}] 重建项目缩略图生成完成，已存储到runtime`)
    }
  } catch (error) {
    console.error(`❌ [${logIdentifier}] 重建项目缩略图生成失败:`, error)
  }
}

/**
 * 重建文本时间轴项目
 * 从原始配置重新创建文本TimelineItem和sprite
 *
 * @param options 重建选项
 * @returns 重建结果
 */
export async function rebuildTextTimelineItem(
  options: RebuildTextTimelineItemOptions,
): Promise<RebuildTextTimelineItemResult> {
  const { originalTimelineItemData, videoResolution, logIdentifier } = options

  try {
    if (!originalTimelineItemData) {
      throw new Error('文本时间轴项目数据不存在')
    }

    if (originalTimelineItemData.mediaType !== 'text') {
      throw new Error('不是文本项目，无法使用文本重建方法')
    }

    console.log(`🔄 [${logIdentifier}] 开始重建文本时间轴项目...`)

    const originalConfig = originalTimelineItemData.config as TextMediaConfig
    const originalTimeRange = originalTimelineItemData.timeRange

    // 计算duration（显示时长）
    const duration = originalTimeRange.timelineEndTime - originalTimeRange.timelineStartTime

    // 直接使用 createTextTimelineItemFromUtils 重建，传入原始ID以保持一致性
    const newTimelineItem = await createTextTimelineItemFromUtils(
      originalConfig.text,
      originalConfig.style,
      originalTimeRange.timelineStartTime,
      originalTimelineItemData.trackId || '',
      duration,
      videoResolution,
      originalTimelineItemData.id, // 传入原始ID
    )

    // 恢复原始的位置、尺寸和其他属性（createTextTimelineItemFromUtils 创建的是默认位置）
    newTimelineItem.config.x = originalConfig.x
    newTimelineItem.config.y = originalConfig.y
    newTimelineItem.config.width = originalConfig.width
    newTimelineItem.config.height = originalConfig.height
    newTimelineItem.config.rotation = originalConfig.rotation
    newTimelineItem.config.opacity = originalConfig.opacity
    newTimelineItem.config.zIndex = originalConfig.zIndex
    newTimelineItem.config.originalWidth = originalConfig.originalWidth
    newTimelineItem.config.originalHeight = originalConfig.originalHeight
    newTimelineItem.config.proportionalScale = originalConfig.proportionalScale

    // 恢复动画配置（如果存在）
    if (originalTimelineItemData.animation) {
      newTimelineItem.animation = originalTimelineItemData.animation
    }

    // 同步更新sprite的属性以匹配配置（使用坐标转换）
    if (newTimelineItem.runtime.sprite) {
      const sprite = newTimelineItem.runtime.sprite as any

      // 获取画布分辨率
      const canvasWidth = videoResolution.width
      const canvasHeight = videoResolution.height

      // 使用坐标转换将项目坐标系转换为WebAV坐标系
      const webavCoords = projectToWebavCoords(
        originalConfig.x,
        originalConfig.y,
        originalConfig.width,
        originalConfig.height,
        canvasWidth,
        canvasHeight,
      )

      sprite.rect.x = webavCoords.x
      sprite.rect.y = webavCoords.y
      sprite.rect.w = originalConfig.width
      sprite.rect.h = originalConfig.height
      sprite.rect.angle = originalConfig.rotation
      sprite.opacity = originalConfig.opacity
      sprite.zIndex = originalConfig.zIndex

      // 恢复时间范围
      sprite.setTimeRange(originalTimeRange)
    }

    console.log(`🔄 [${logIdentifier}] 重建文本时间轴项目完成:`, {
      id: newTimelineItem.id,
      text: originalConfig.text.substring(0, 20) + '...',
      timeRange: originalTimeRange,
      position: { x: originalConfig.x, y: originalConfig.y },
      size: { w: originalConfig.width, h: originalConfig.height },
    })

    return {
      timelineItem: newTimelineItem,
      success: true,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`❌ [${logIdentifier}] 重建文本时间轴项目失败:`, errorMessage)

    return {
      timelineItem: originalTimelineItemData,
      success: false,
      error: errorMessage,
    }
  }
}

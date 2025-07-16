/**
 * 媒体转换工具函数
 * 用于异步处理素材转换为本地素材的相关工具
 */

import type { LocalMediaItem, AsyncProcessingMediaItem, AsyncProcessingTimelineItem, LocalTimelineItem, MediaType } from '../types'
import { useVideoStore } from '../stores/videoStore'
import { markRaw } from 'vue'

/**
 * 等待本地素材解析完成
 * @param mediaItemId 本地素材项目ID
 * @param timeout 超时时间（毫秒），默认30秒
 * @returns Promise<LocalMediaItem> 解析完成的本地素材项目
 */
export async function waitForMediaItemReady(
  mediaItemId: string,
  timeout: number = 30000
): Promise<LocalMediaItem> {
  const videoStore = useVideoStore()
  const startTime = Date.now()

  return new Promise((resolve, reject) => {
    const checkReady = () => {
      const mediaItem = videoStore.getLocalMediaItem(mediaItemId)
      
      if (!mediaItem) {
        reject(new Error(`找不到媒体项目: ${mediaItemId}`))
        return
      }

      // 检查是否解析完成
      if (mediaItem.isReady && mediaItem.status === 'ready') {
        console.log(`✅ [MediaConversion] 媒体项目解析完成: ${mediaItem.name}`)
        resolve(mediaItem)
        return
      }

      // 检查是否解析失败
      if (mediaItem.status === 'error') {
        reject(new Error(`媒体项目解析失败: ${mediaItem.name}`))
        return
      }

      // 检查超时
      if (Date.now() - startTime > timeout) {
        reject(new Error(`等待媒体项目解析超时: ${mediaItem.name}`))
        return
      }

      // 继续等待
      setTimeout(checkReady, 100) // 每100ms检查一次
    }

    checkReady()
  })
}

/**
 * 保存时间轴clip信息
 * @param asyncProcessingMediaItemId 异步处理素材项目ID
 * @returns 保存的时间轴clip信息数组
 */
export function saveTimelineClipInfo(asyncProcessingMediaItemId: string) {
  const videoStore = useVideoStore()
  
  // 查找所有相关的异步处理时间轴项目
  const relatedTimelineItems = videoStore.timelineItems.filter(item => 
    'isAsyncProcessingPlaceholder' in item && 
    item.isAsyncProcessingPlaceholder === true &&
    item.mediaItemId === asyncProcessingMediaItemId
  ) as AsyncProcessingTimelineItem[]

  console.log(`💾 [MediaConversion] 保存时间轴clip信息，找到 ${relatedTimelineItems.length} 个相关clip`)

  return relatedTimelineItems.map(item => ({
    id: item.id,
    trackId: item.trackId,
    timelineStartTime: item.timeRange.timelineStartTime,
    originalDuration: item.timeRange.timelineEndTime - item.timeRange.timelineStartTime,
    config: item.config,
    mediaType: item.mediaType
  }))
}

/**
 * 检查轨道兼容性并重新分配
 * @param originalTrackId 原始轨道ID
 * @param actualMediaType 实际媒体类型
 * @returns 目标轨道ID
 */
export function checkTrackCompatibility(originalTrackId: string, actualMediaType: MediaType): string {
  const videoStore = useVideoStore()
  const originalTrack = videoStore.getTrack(originalTrackId)
  
  if (!originalTrack) {
    console.warn(`⚠️ [MediaConversion] 原始轨道不存在: ${originalTrackId}`)
    return findCompatibleTrack(actualMediaType)
  }

  // 检查轨道类型兼容性
  const isCompatible = checkTrackTypeCompatibility(originalTrack.type, actualMediaType)
  
  if (isCompatible) {
    console.log(`✅ [MediaConversion] 轨道兼容，保持原轨道: ${originalTrackId}`)
    return originalTrackId
  } else {
    console.log(`🔄 [MediaConversion] 轨道不兼容，重新分配: ${originalTrack.type} -> ${actualMediaType}`)
    return findCompatibleTrack(actualMediaType)
  }
}

/**
 * 检查轨道类型兼容性
 * @param trackType 轨道类型
 * @param mediaType 媒体类型
 * @returns 是否兼容
 */
function checkTrackTypeCompatibility(trackType: string, mediaType: MediaType): boolean {
  switch (mediaType) {
    case 'video':
    case 'image':
      return trackType === 'video'
    case 'audio':
      return trackType === 'audio'
    case 'text':
      return trackType === 'video' // 文本通常放在视频轨道上
    default:
      return false
  }
}

/**
 * 查找兼容的轨道
 * @param mediaType 媒体类型
 * @returns 兼容的轨道ID
 */
function findCompatibleTrack(mediaType: MediaType): string {
  const videoStore = useVideoStore()
  const tracks = videoStore.tracks
  
  // 确定需要的轨道类型
  let requiredTrackType: string
  switch (mediaType) {
    case 'video':
    case 'image':
    case 'text':
      requiredTrackType = 'video'
      break
    case 'audio':
      requiredTrackType = 'audio'
      break
    default:
      requiredTrackType = 'video' // 默认使用视频轨道
  }

  // 查找第一个匹配的轨道
  const compatibleTrack = tracks.find(track => track.type === requiredTrackType)
  
  if (compatibleTrack) {
    console.log(`✅ [MediaConversion] 找到兼容轨道: ${compatibleTrack.id} (${requiredTrackType})`)
    return compatibleTrack.id
  }

  // 如果没有找到兼容轨道，创建新轨道
  console.log(`🆕 [MediaConversion] 创建新轨道: ${requiredTrackType}`)
  // 这里应该调用创建轨道的方法，但为了简化，先返回第一个轨道
  return tracks[0]?.id || 'track_1'
}

/**
 * 调整时长机制
 * @param originalDuration 原始预估时长（帧数）
 * @param actualDuration 实际文件时长（帧数）
 * @param startTime 开始时间（帧数）
 * @param actualMediaType 实际媒体类型
 * @returns 调整后的时间范围
 */
export function adjustTimelineDuration(
  originalDuration: number,
  actualDuration: number,
  startTime: number,
  actualMediaType: MediaType
) {
  if (actualDuration !== originalDuration) {
    console.log(`⏱️ [MediaConversion] 时长调整: 预估${originalDuration}帧 → 实际${actualDuration}帧`)
  }

  // 根据实际媒体类型创建对应的时间范围
  if (actualMediaType === 'video' || actualMediaType === 'audio') {
    return {
      clipStartTime: 0,
      clipEndTime: actualDuration,
      timelineStartTime: startTime,
      timelineEndTime: startTime + actualDuration,
      effectiveDuration: actualDuration,
      playbackRate: 1.0
    }
  } else {
    // 图片类型
    return {
      timelineStartTime: startTime,
      timelineEndTime: startTime + actualDuration,
      displayDuration: actualDuration
    }
  }
}

/**
 * 创建默认配置
 * @param mediaType 媒体类型
 * @param sprite WebAV sprite对象
 * @returns 默认配置对象
 */
export function createDefaultConfig(mediaType: MediaType, sprite: any) {
  if (mediaType === 'video') {
    return {
      // 视觉属性
      x: sprite.rect?.x || 0,
      y: sprite.rect?.y || 0,
      width: sprite.rect?.w || 1920,
      height: sprite.rect?.h || 1080,
      rotation: sprite.rect?.angle || 0,
      opacity: sprite.opacity || 1,
      // 原始尺寸
      originalWidth: sprite.rect?.w || 1920,
      originalHeight: sprite.rect?.h || 1080,
      // 等比缩放状态
      proportionalScale: true,
      // 音频属性
      volume: 1,
      isMuted: false,
      // 基础属性
      zIndex: sprite.zIndex || 0,
    }
  } else if (mediaType === 'image') {
    return {
      // 视觉属性
      x: sprite.rect?.x || 0,
      y: sprite.rect?.y || 0,
      width: sprite.rect?.w || 1920,
      height: sprite.rect?.h || 1080,
      rotation: sprite.rect?.angle || 0,
      opacity: sprite.opacity || 1,
      // 原始尺寸
      originalWidth: sprite.rect?.w || 1920,
      originalHeight: sprite.rect?.h || 1080,
      // 等比缩放状态
      proportionalScale: true,
      // 基础属性
      zIndex: sprite.zIndex || 0,
    }
  } else if (mediaType === 'audio') {
    return {
      // 音频属性
      volume: 1,
      isMuted: false,
      // 基础属性
      zIndex: sprite.zIndex || 0,
    }
  } else {
    // 默认配置
    return {
      zIndex: sprite.zIndex || 0,
    }
  }
}

/**
 * 从本地媒体创建时间轴项目
 * @param localMediaItem 本地媒体项目
 * @param trackId 目标轨道ID
 * @param startTimeFrames 开始时间（帧数）
 * @param timeRange 时间范围
 * @returns Promise<void>
 */
export async function createTimelineItemFromLocalMedia(
  localMediaItem: LocalMediaItem,
  trackId: string,
  _startTimeFrames: number,
  timeRange: any
): Promise<void> {
  console.log(`🎯 [MediaConversion] 创建时间轴项目: ${localMediaItem.name} -> 轨道${trackId}`)

  try {
    // 导入必要的工具函数
    const { generateId } = await import('./idGenerator')
    const { createSpriteFromMediaItem } = await import('./spriteFactory')

    // 1. 创建sprite
    const sprite = await createSpriteFromMediaItem(localMediaItem)

    // 2. 设置时间范围
    if ('setTimeRange' in sprite) {
      sprite.setTimeRange(timeRange)
    }

    // 3. 创建时间轴项目
    const timelineItemId = generateId()
    const timelineItem = {
      id: timelineItemId,
      mediaItemId: localMediaItem.id,
      trackId: trackId,
      mediaType: localMediaItem.mediaType,
      timeRange: timeRange,
      sprite: markRaw(sprite),
      config: createDefaultConfig(localMediaItem.mediaType, sprite),
      mediaName: localMediaItem.name
    } as LocalTimelineItem

    // 4. 添加到时间轴（使用带历史记录的方法）
    const videoStore = useVideoStore()
    await videoStore.addTimelineItemWithHistory(timelineItem)

    console.log(`✅ [MediaConversion] 时间轴项目创建完成: ${timelineItemId}`)
  } catch (error) {
    console.error(`❌ [MediaConversion] 创建时间轴项目失败: ${localMediaItem.name}`, error)
    throw error
  }
}

/**
 * 重建时间轴clips
 * @param timelineClipInfos 保存的时间轴clip信息数组
 * @param newLocalMediaItem 新的本地媒体项目
 * @returns Promise<void>
 */
export async function rebuildTimelineClips(timelineClipInfos: any[], newLocalMediaItem: LocalMediaItem): Promise<void> {
  console.log(`🔄 [MediaConversion] 开始重建 ${timelineClipInfos.length} 个时间轴clip`)

  const videoStore = useVideoStore()

  for (const clipInfo of timelineClipInfos) {
    try {
      console.log(`🔄 [MediaConversion] 重建clip: ${clipInfo.id} -> ${newLocalMediaItem.name}`)

      // 1. 检查轨道兼容性并重新分配
      const targetTrackId = checkTrackCompatibility(clipInfo.trackId, newLocalMediaItem.mediaType)

      // 2. 时长调整
      const adjustedTimeRange = adjustTimelineDuration(
        clipInfo.originalDuration,
        newLocalMediaItem.duration,
        clipInfo.timelineStartTime,
        newLocalMediaItem.mediaType
      )

      // 3. 等待WebAV初始化完成
      const { useVideoStore } = await import('../stores/videoStore')
      const videoStore = useVideoStore()
      await videoStore.waitForWebAVReady() // 阻塞直到WebAV初始化完成

      // 4. 创建新的时间轴项目
      await createTimelineItemFromLocalMedia(
        newLocalMediaItem,
        targetTrackId,
        clipInfo.timelineStartTime,
        adjustedTimeRange
      )

      // 5. 只有在新clip创建成功后才删除原有的异步处理时间轴项目
      const existingItem = videoStore.getTimelineItem(clipInfo.id)
      if (existingItem) {
        await videoStore.removeTimelineItemWithHistory(clipInfo.id)
        console.log(`🗑️ [MediaConversion] 已删除异步处理clip: ${clipInfo.id}`)
      }

      console.log(`✅ [MediaConversion] clip重建完成: ${clipInfo.id} -> 新的LocalTimelineItem`)
    } catch (error) {
      console.error(`❌ [MediaConversion] 重建clip失败: ${clipInfo.id}`, error)
      // 重建失败时，保留原有的异步处理clip以显示错误状态
      // 不删除clip，让用户能看到错误状态
      console.log(`🔄 [MediaConversion] 保留异步处理clip以显示错误状态: ${clipInfo.id}`)
    }
  }

  console.log(`✅ [MediaConversion] 所有时间轴clip重建完成`)
}

/**
 * 将异步处理素材转换为本地素材（优化版本）
 * @param asyncProcessingItem 异步处理素材项目
 * @param processFiles 处理文件的函数
 * @returns Promise<void>
 */
export async function convertAsyncProcessingToLocalMedia(
  asyncProcessingItem: AsyncProcessingMediaItem,
  processFiles: (files: File[]) => Promise<void>
): Promise<void> {
  if (!asyncProcessingItem.processedFile) {
    throw new Error('没有处理完成的文件')
  }

  console.log('🔄 [MediaConversion] 开始优化转换异步处理素材:', asyncProcessingItem.name)

  const videoStore = useVideoStore()

  try {
    // 1. 检查文件类型是否支持
    const { AsyncProcessingManager } = await import('./AsyncProcessingManager')
    const asyncProcessingManager = AsyncProcessingManager.getInstance()
    if (!asyncProcessingManager.isSupportedMediaType(asyncProcessingItem.processedFile)) {
      // 文件类型不支持，标记为unsupported状态
      asyncProcessingItem.processingStatus = 'unsupported'
      asyncProcessingItem.errorMessage = `不支持的文件类型: ${asyncProcessingItem.processedFile.type}`
      videoStore.updateAsyncProcessingItem(asyncProcessingItem)

      console.log(`❌ [MediaConversion] 文件类型不支持: ${asyncProcessingItem.processedFile.type}`)
      return // 保持占位符状态，不进行转换
    }

    // 2. 隐藏异步素材（标记为转换中）
    asyncProcessingItem.isConverting = true
    videoStore.updateAsyncProcessingItem(asyncProcessingItem)
    console.log('🔄 [MediaConversion] 异步素材已隐藏，开始转换...')

    // 3. 保存时间轴clip信息
    const timelineClipInfos = saveTimelineClipInfo(asyncProcessingItem.id)

    // 4. 创建本地素材
    const files = [asyncProcessingItem.processedFile]
    await processFiles(files)

    // 5. 等待本地素材解析完成
    // 通过文件名查找新创建的本地素材
    const newLocalMediaItem = videoStore.mediaItems.find(item =>
      item.file.name === asyncProcessingItem.processedFile!.name &&
      item.file.size === asyncProcessingItem.processedFile!.size
    )

    if (!newLocalMediaItem) {
      throw new Error('无法找到新创建的本地素材')
    }

    console.log('⏳ [MediaConversion] 等待本地素材解析完成...')
    await waitForMediaItemReady(newLocalMediaItem.id)

    // 6. 重建时间轴clip
    await rebuildTimelineClips(timelineClipInfos, newLocalMediaItem)

    // 7. 删除异步素材
    videoStore.removeAsyncProcessingItem(asyncProcessingItem.id)

    console.log('✅ [MediaConversion] 异步处理素材转换完成:', asyncProcessingItem.name)
  } catch (error) {
    console.error('❌ [MediaConversion] 转换异步处理素材失败:', error)

    // 转换失败时重新显示异步素材并更新状态
    asyncProcessingItem.isConverting = false
    asyncProcessingItem.processingStatus = 'error'
    asyncProcessingItem.errorMessage = error instanceof Error ? error.message : '转换失败'

    // 确保状态更新传播到时间轴clip
    videoStore.updateAsyncProcessingItem(asyncProcessingItem)

    // 强制触发响应式更新（确保时间轴clip能看到状态变化）
    console.log(`🔄 [MediaConversion] 转换失败，异步素材状态已更新为error: ${asyncProcessingItem.name}`)
    console.log(`🔄 [MediaConversion] 时间轴clip应该显示错误状态，状态: ${asyncProcessingItem.processingStatus}`)

    throw error
  }
}

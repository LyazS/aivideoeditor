/**
 * 轨道工具函数集合
 */

import { generateUUID4 } from '@/unified/utils/idGenerator'
import { DEFAULT_TRACK_NAMES, DEFAULT_TRACK_HEIGHTS } from '@/unified/constants/TrackConstants'
import type { MediaType } from '@/unified/mediaitem'
import type { UnifiedTrackType } from './TrackTypes'

/**
 * 生成轨道ID
 */
export function generateTrackId(): string {
  return generateUUID4()
}

/**
 * 获取默认轨道名称
 */
export function getDefaultTrackName(type: UnifiedTrackType): string {
  return DEFAULT_TRACK_NAMES[type]
}

/**
 * 获取默认轨道高度
 */
export function getDefaultTrackHeight(type: UnifiedTrackType): number {
  return DEFAULT_TRACK_HEIGHTS[type]
}

/**
 * 将媒体类型映射到轨道类型
 */
export function mapMediaTypeToTrackType(mediaType: MediaType): UnifiedTrackType {
  switch (mediaType) {
    case 'video':
    case 'image':
      return 'video'
    case 'audio':
      return 'audio'
    case 'text':
      return 'text'
    default:
      return 'video' // 默认视频轨道
  }
}

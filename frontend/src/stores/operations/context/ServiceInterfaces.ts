import type { TimelineItem, MediaItem, Track } from '../../../types/videoTypes'
import type { MP4Clip, ImgClip, AVCanvas } from '@webav/av-cliper'

/**
 * 服务接口定义
 * 定义操作上下文所需的各种服务接口
 */

export interface TimelineService {
  addItem(item: TimelineItem): void
  removeItem(itemId: string): void
  getItem(itemId: string): TimelineItem | undefined
  getItemsInTrack(trackId: number): TimelineItem[]
  updateItem(itemId: string, updates: Partial<TimelineItem>): void
}

export interface CanvasService {
  addSprite(sprite: any): void
  removeSprite(sprite: any): void
  updateSprite(sprite: any): void
}

export interface TrackService {
  createTrack(data: TrackData): Track
  removeTrack(trackId: number): void
  getTrack(trackId: number): Track | undefined
  getNextTrackNumber(): number
  updateTrack(trackId: number, updates: Partial<Track>): void
}

export interface MediaService {
  getItem(mediaItemId: string): MediaItem | undefined
  addItem(item: MediaItem): void
  removeItem(mediaItemId: string): void
  getVideoOriginalResolution(mediaItemId: string): { width: number; height: number }
  getImageOriginalResolution(mediaItemId: string): { width: number; height: number }
}

export interface WebAVService {
  cloneMP4Clip(originalClip: MP4Clip): Promise<MP4Clip>
  cloneImgClip(originalClip: ImgClip): Promise<ImgClip>
  getCanvas(): AVCanvas | undefined
}

export interface ConfigService {
  videoResolution: { value: { width: number; height: number } }
}

/**
 * 轨道数据接口
 */
export interface TrackData {
  id: number
  name: string
  isVisible: boolean
  isMuted: boolean
}

/**
 * 媒体项目接口
 */
export interface MediaItemData {
  id: string
  file: File
  name: string
  mediaType: 'video' | 'image'
  isReady: boolean
  mp4Clip?: MP4Clip | null
  imgClip?: ImgClip | null
  duration?: number
  thumbnailUrl?: string
}

/**
 * 时间轴项目数据接口
 */
export interface TimelineItemData {
  id: string
  mediaItemId: string
  trackId: number
  mediaType: 'video' | 'image'
  timeRange: {
    timelineStartTime: number
    timelineEndTime: number
    [key: string]: any
  }
  position: { x: number; y: number }
  size: { width: number; height: number }
  rotation: number
  zIndex: number
  opacity: number
  thumbnailUrl?: string
  volume?: number
  isMuted?: boolean
}

/**
 * 变换数据接口
 */
export interface TransformData {
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  rotation?: number
  opacity?: number
  zIndex?: number
  duration?: number
  playbackRate?: number
  volume?: number
  isMuted?: boolean
}

/**
 * 位置接口
 */
export interface Position {
  time: number
  trackId?: number
}

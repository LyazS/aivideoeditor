import type { Raw } from 'vue'
import type { MP4Clip, ImgClip, Rect } from '@webav/av-cliper'
import type { CustomVisibleSprite, TimeRange } from '../utils/VideoVisibleSprite'
import type { ImageVisibleSprite, ImageTimeRange } from '../utils/ImageVisibleSprite'

// 定义WebAV属性变化事件的类型
export interface PropsChangeEvent {
  rect?: Partial<Rect>
  zIndex?: number
}

// 素材层：包装MP4Clip/ImgClip和原始文件信息
export interface MediaItem {
  id: string
  name: string
  file: File
  url: string
  duration: number
  type: string
  mediaType: 'video' | 'image' // 媒体类型：视频或图片
  mp4Clip: Raw<MP4Clip> | null // 视频文件解析中时为null，解析完成后为MP4Clip实例
  imgClip: Raw<ImgClip> | null // 图片文件解析中时为null，解析完成后为ImgClip实例
  isReady: boolean // 是否解析完成
}

// 时间轴层：包装CustomVisibleSprite/ImageVisibleSprite和时间轴位置信息
export interface TimelineItem {
  id: string
  mediaItemId: string // 引用MediaItem的ID
  trackId: number
  mediaType: 'video' | 'image' // 媒体类型：视频或图片
  timeRange: TimeRange | ImageTimeRange // 时间范围信息（视频包含倍速，图片不包含）
  sprite: Raw<CustomVisibleSprite | ImageVisibleSprite> // 视频或图片sprite
  // Sprite位置和大小属性（响应式）
  position: {
    x: number
    y: number
  }
  size: {
    width: number
    height: number
  }
  // 其他sprite属性（响应式）
  rotation: number // 旋转角度（弧度）
  zIndex: number
  opacity: number
}

export interface VideoResolution {
  name: string
  width: number
  height: number
  aspectRatio: string
  category?: string
}

export interface Track {
  id: number
  name: string
  isVisible: boolean
  isMuted: boolean
  height: number // 轨道高度
}

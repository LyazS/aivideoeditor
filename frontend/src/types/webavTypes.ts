/**
 * WebAV 相关类型定义
 * 为 WebAV 库提供更精确的类型定义，减少 any 类型的使用
 */

import type { VisibleSprite } from '@webav/av-cliper'

// 扩展 WebAV 的 AVCanvas 类型定义
export interface ExtendedAVCanvas {
  width?: number
  height?: number
  constructor: { name: string }
  addSprite: (sprite: VisibleSprite) => void
  removeSprite: (sprite: VisibleSprite) => void
  on: <Type extends 'activeSpriteChange' | 'playing' | 'timeupdate' | 'paused'>(
    type: Type,
    listener: {
      timeupdate: (time: number) => void
      paused: () => void
      playing: () => void
      activeSpriteChange: (sprite: VisibleSprite | null) => void
    }[Type]
  ) => () => void
  play: () => Promise<void>
  pause: () => void
  seek: (time: number) => void
  destroy: () => void
  [key: string]: any // 允许其他未知属性
}

// 音频数据接口
export interface AudioTickData {
  audio?: Float32Array[]
  [key: string]: any
}

// WebAV Sprite 扩展接口
export interface ExtendedSprite extends VisibleSprite {
  setVolume?: (volume: number) => void
  setMuted?: (muted: boolean) => void
  tickInterceptor?: (time: number, tickRet: AudioTickData) => Promise<AudioTickData>
}

// WebAV 模块接口
export interface WebAVModuleInterface {
  removeSprite: (sprite: VisibleSprite) => void
}



// 时间轴项目拖拽数据
export interface TimelineItemDragData {
  type: 'timeline-item'
  itemId: string
  trackId: number
  startTime: number
  selectedItems: string[]
  dragOffset: { x: number; y: number }
}

// 媒体项目拖拽数据
export interface MediaItemDragData {
  type: 'media-item'
  mediaItemId: string
  name: string
  duration: number
  mediaType: 'video' | 'image'
}

// 拖拽预览数据
export interface DragPreviewData {
  name: string
  duration: number
  startTime: number
  trackId: number
  isConflict?: boolean
  isMultiple?: boolean
  count?: number
}

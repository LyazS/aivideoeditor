/**
 * 统一异步源架构 - 时间轴项目类型定义
 * 
 * 基于统一异步源架构的时间轴项目类型，所有时间轴数据都通过异步源管理
 */

import type { BaseDataSource, DataSourceStatus } from './DataSource'
import type { UnifiedMediaItem, UnifiedMediaType } from './MediaItem'

// 时间轴项目类型
export enum TimelineItemType {
  MEDIA_CLIP = 'media_clip',      // 媒体片段
  TEXT_CLIP = 'text_clip',        // 文本片段
  EFFECT = 'effect',              // 效果
  TRANSITION = 'transition',      // 转场
  MARKER = 'marker'               // 标记
}

// 轨道类型
export enum TrackType {
  VIDEO = 'video',
  AUDIO = 'audio',
  TEXT = 'text',
  EFFECT = 'effect'
}

// 变换属性
export interface Transform {
  /** 位置 X */
  x: number
  /** 位置 Y */
  y: number
  /** 缩放 X */
  scaleX: number
  /** 缩放 Y */
  scaleY: number
  /** 旋转角度 */
  rotation: number
  /** 不透明度 */
  opacity: number
  /** 锚点 X (0-1) */
  anchorX: number
  /** 锚点 Y (0-1) */
  anchorY: number
}

// 关键帧数据
export interface Keyframe<T = any> {
  /** 时间位置（帧） */
  frame: number
  /** 关键帧值 */
  value: T
  /** 缓动类型 */
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier'
  /** 贝塞尔曲线控制点（当easing为bezier时） */
  bezierPoints?: [number, number, number, number]
}

// 动画轨道
export interface AnimationTrack<T = any> {
  /** 属性名 */
  property: string
  /** 关键帧列表 */
  keyframes: Keyframe<T>[]
  /** 是否启用 */
  enabled: boolean
}

// 基础时间轴项目接口
export interface BaseUnifiedTimelineItem {
  /** 唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 项目类型 */
  type: TimelineItemType
  /** 所属轨道ID */
  trackId: string
  
  // 时间属性
  /** 开始时间（帧） */
  startFrame: number
  /** 持续时间（帧） */
  durationFrames: number
  /** 结束时间（帧，计算属性） */
  endFrame: number
  
  // 异步源相关
  /** 渲染数据源 */
  renderSource?: BaseDataSource<any>
  /** 缓存数据源 */
  cacheSource?: BaseDataSource<ArrayBuffer>
  
  // 状态信息
  /** 项目状态 */
  status: DataSourceStatus
  /** 错误信息 */
  error: string | null
  
  // 变换和动画
  /** 变换属性 */
  transform: Transform
  /** 动画轨道 */
  animationTracks: AnimationTrack[]
  
  // 可见性和启用状态
  /** 是否可见 */
  visible: boolean
  /** 是否启用 */
  enabled: boolean
  /** 是否锁定 */
  locked: boolean
  
  // 时间戳
  /** 创建时间 */
  createdAt: Date
  /** 最后更新时间 */
  updatedAt: Date
  
  // 扩展属性
  /** 自定义属性 */
  customProperties: Record<string, any>
}

// 媒体片段时间轴项目
export interface UnifiedMediaTimelineItem extends BaseUnifiedTimelineItem {
  type: TimelineItemType.MEDIA_CLIP
  /** 关联的媒体项目 */
  mediaItem: UnifiedMediaItem
  /** 媒体类型 */
  mediaType: UnifiedMediaType
  
  // 媒体特定属性
  /** 媒体内偏移（帧） */
  mediaStartFrame: number
  /** 播放速度 */
  playbackRate: number
  /** 是否静音（音频/视频） */
  muted: boolean
  /** 音量（0-1） */
  volume: number
}

// 文本片段时间轴项目
export interface UnifiedTextTimelineItem extends BaseUnifiedTimelineItem {
  type: TimelineItemType.TEXT_CLIP
  /** 文本内容数据源 */
  textSource: BaseDataSource<string>
  
  // 文本样式
  /** 字体族 */
  fontFamily: string
  /** 字体大小 */
  fontSize: number
  /** 字体粗细 */
  fontWeight: string
  /** 文本颜色 */
  color: string
  /** 背景颜色 */
  backgroundColor: string
  /** 文本对齐 */
  textAlign: 'left' | 'center' | 'right'
  /** 行高 */
  lineHeight: number
}

// 效果时间轴项目
export interface UnifiedEffectTimelineItem extends BaseUnifiedTimelineItem {
  type: TimelineItemType.EFFECT
  /** 效果类型 */
  effectType: string
  /** 效果参数数据源 */
  parametersSource: BaseDataSource<Record<string, any>>
  /** 目标项目ID列表 */
  targetItemIds: string[]
}

// 转场时间轴项目
export interface UnifiedTransitionTimelineItem extends BaseUnifiedTimelineItem {
  type: TimelineItemType.TRANSITION
  /** 转场类型 */
  transitionType: string
  /** 转场参数数据源 */
  parametersSource: BaseDataSource<Record<string, any>>
  /** 前一个项目ID */
  fromItemId: string
  /** 后一个项目ID */
  toItemId: string
}

// 标记时间轴项目
export interface UnifiedMarkerTimelineItem extends BaseUnifiedTimelineItem {
  type: TimelineItemType.MARKER
  /** 标记类型 */
  markerType: 'chapter' | 'bookmark' | 'comment'
  /** 标记内容 */
  content: string
  /** 标记颜色 */
  color: string
}

// 联合类型
export type UnifiedTimelineItem = 
  | UnifiedMediaTimelineItem
  | UnifiedTextTimelineItem
  | UnifiedEffectTimelineItem
  | UnifiedTransitionTimelineItem
  | UnifiedMarkerTimelineItem

// 轨道定义
export interface UnifiedTrack {
  /** 轨道ID */
  id: string
  /** 轨道名称 */
  name: string
  /** 轨道类型 */
  type: TrackType
  /** 轨道高度 */
  height: number
  /** 轨道顺序 */
  order: number
  /** 是否可见 */
  visible: boolean
  /** 是否静音 */
  muted: boolean
  /** 是否锁定 */
  locked: boolean
  /** 轨道颜色 */
  color: string
  /** 创建时间 */
  createdAt: Date
}

// 时间轴项目创建配置
export interface CreateTimelineItemConfig {
  /** 项目类型 */
  type: TimelineItemType
  /** 轨道ID */
  trackId: string
  /** 开始时间（帧） */
  startFrame: number
  /** 持续时间（帧） */
  durationFrames: number
  /** 初始名称 */
  name?: string
  /** 关联的媒体项目（媒体片段） */
  mediaItem?: UnifiedMediaItem
  /** 自定义属性 */
  customProperties?: Record<string, any>
}

// 时间轴项目查询条件
export interface TimelineItemQuery {
  /** 按项目类型筛选 */
  type?: TimelineItemType | TimelineItemType[]
  /** 按轨道ID筛选 */
  trackId?: string | string[]
  /** 按时间范围筛选 */
  startFrameAfter?: number
  startFrameBefore?: number
  endFrameAfter?: number
  endFrameBefore?: number
  /** 按状态筛选 */
  status?: DataSourceStatus | DataSourceStatus[]
  /** 按可见性筛选 */
  visible?: boolean
  /** 按启用状态筛选 */
  enabled?: boolean
  /** 排序 */
  sortBy?: 'startFrame' | 'endFrame' | 'createdAt' | 'name'
  sortOrder?: 'asc' | 'desc'
}

// 时间轴管理器接口
export interface UnifiedTimelineManager {
  /** 创建时间轴项目 */
  createTimelineItem(config: CreateTimelineItemConfig): Promise<UnifiedTimelineItem>
  
  /** 获取时间轴项目 */
  getTimelineItem(id: string): UnifiedTimelineItem | null
  
  /** 查询时间轴项目 */
  queryTimelineItems(query: TimelineItemQuery): UnifiedTimelineItem[]
  
  /** 更新时间轴项目 */
  updateTimelineItem(id: string, updates: Partial<UnifiedTimelineItem>): void
  
  /** 删除时间轴项目 */
  removeTimelineItem(id: string): void
  
  /** 创建轨道 */
  createTrack(type: TrackType, name?: string): UnifiedTrack
  
  /** 获取轨道 */
  getTrack(id: string): UnifiedTrack | null
  
  /** 获取所有轨道 */
  getAllTracks(): UnifiedTrack[]
  
  /** 更新轨道 */
  updateTrack(id: string, updates: Partial<UnifiedTrack>): void
  
  /** 删除轨道 */
  removeTrack(id: string): void
  
  /** 监听变化 */
  subscribe(callback: (items: UnifiedTimelineItem[], tracks: UnifiedTrack[]) => void): () => void
  
  /** 清理资源 */
  cleanup(): void
}

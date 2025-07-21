/**
 * 统一异步源架构 - 媒体项目类型定义
 * 
 * 基于统一异步源架构的媒体项目类型，所有媒体数据都通过异步源管理
 */

import type { BaseDataSource, DataSourceStatus } from './DataSource'

// 媒体类型枚举
export enum UnifiedMediaType {
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'image',
  TEXT = 'text'
}

// 媒体来源类型
export enum MediaSourceType {
  LOCAL_FILE = 'local_file',        // 本地文件
  REMOTE_URL = 'remote_url',        // 远程URL
  GENERATED = 'generated',          // 程序生成（如文本）
  IMPORTED = 'imported'             // 导入的项目
}

// 基础媒体元数据
export interface BaseMediaMetadata {
  /** 文件名 */
  fileName: string
  /** 文件大小（字节） */
  fileSize: number
  /** MIME类型 */
  mimeType: string
  /** 创建时间 */
  createdAt: Date
  /** 修改时间 */
  modifiedAt: Date
}

// 视频媒体元数据
export interface VideoMediaMetadata extends BaseMediaMetadata {
  /** 视频宽度 */
  width: number
  /** 视频高度 */
  height: number
  /** 持续时间（秒） */
  duration: number
  /** 帧率 */
  frameRate: number
  /** 视频编码 */
  videoCodec: string
  /** 音频编码 */
  audioCodec?: string
  /** 比特率 */
  bitrate: number
}

// 音频媒体元数据
export interface AudioMediaMetadata extends BaseMediaMetadata {
  /** 持续时间（秒） */
  duration: number
  /** 采样率 */
  sampleRate: number
  /** 声道数 */
  channels: number
  /** 音频编码 */
  audioCodec: string
  /** 比特率 */
  bitrate: number
}

// 图片媒体元数据
export interface ImageMediaMetadata extends BaseMediaMetadata {
  /** 图片宽度 */
  width: number
  /** 图片高度 */
  height: number
  /** 图片格式 */
  format: string
}

// 文本媒体元数据
export interface TextMediaMetadata extends BaseMediaMetadata {
  /** 文本内容 */
  content: string
  /** 字体信息 */
  fontFamily?: string
  fontSize?: number
  fontWeight?: string
  /** 颜色 */
  color?: string
  /** 背景色 */
  backgroundColor?: string
}

// 统一媒体项目接口
export interface UnifiedMediaItem<T extends UnifiedMediaType = UnifiedMediaType> {
  /** 唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 媒体类型 */
  mediaType: T
  /** 来源类型 */
  sourceType: MediaSourceType
  
  // 异步源相关
  /** 主数据源（文件内容） */
  dataSource: BaseDataSource<ArrayBuffer | string>
  /** 缩略图数据源 */
  thumbnailSource?: BaseDataSource<string>
  /** 波形数据源（音频） */
  waveformSource?: BaseDataSource<Float32Array>
  /** 元数据源 */
  metadataSource: BaseDataSource<BaseMediaMetadata>
  
  // 状态信息
  /** 整体状态（基于所有数据源的综合状态） */
  status: DataSourceStatus
  /** 加载进度 */
  progress: number
  /** 错误信息 */
  error: string | null
  
  // 时间戳
  /** 创建时间 */
  createdAt: Date
  /** 最后更新时间 */
  updatedAt: Date
  
  // 扩展属性
  /** 标签 */
  tags: string[]
  /** 自定义属性 */
  customProperties: Record<string, any>
}

// 特定类型的媒体项目
export type UnifiedVideoMediaItem = UnifiedMediaItem<UnifiedMediaType.VIDEO> & {
  metadataSource: BaseDataSource<VideoMediaMetadata>
}

export type UnifiedAudioMediaItem = UnifiedMediaItem<UnifiedMediaType.AUDIO> & {
  metadataSource: BaseDataSource<AudioMediaMetadata>
  waveformSource: BaseDataSource<Float32Array>
}

export type UnifiedImageMediaItem = UnifiedMediaItem<UnifiedMediaType.IMAGE> & {
  metadataSource: BaseDataSource<ImageMediaMetadata>
}

export type UnifiedTextMediaItem = UnifiedMediaItem<UnifiedMediaType.TEXT> & {
  metadataSource: BaseDataSource<TextMediaMetadata>
}

// 媒体项目创建配置
export interface CreateMediaItemConfig {
  /** 媒体类型 */
  mediaType: UnifiedMediaType
  /** 来源类型 */
  sourceType: MediaSourceType
  /** 初始名称 */
  name?: string
  /** 初始标签 */
  tags?: string[]
  /** 自定义属性 */
  customProperties?: Record<string, any>
}

// 媒体项目查询条件
export interface MediaItemQuery {
  /** 按媒体类型筛选 */
  mediaType?: UnifiedMediaType | UnifiedMediaType[]
  /** 按来源类型筛选 */
  sourceType?: MediaSourceType | MediaSourceType[]
  /** 按状态筛选 */
  status?: DataSourceStatus | DataSourceStatus[]
  /** 按标签筛选 */
  tags?: string[]
  /** 按名称搜索 */
  nameContains?: string
  /** 按创建时间范围筛选 */
  createdAfter?: Date
  createdBefore?: Date
  /** 排序 */
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'mediaType'
  sortOrder?: 'asc' | 'desc'
  /** 分页 */
  limit?: number
  offset?: number
}

// 媒体项目管理器接口
export interface UnifiedMediaManager {
  /** 创建媒体项目 */
  createMediaItem(config: CreateMediaItemConfig): Promise<UnifiedMediaItem>
  
  /** 从文件创建媒体项目 */
  createFromFile(file: File): Promise<UnifiedMediaItem>
  
  /** 从URL创建媒体项目 */
  createFromUrl(url: string, name?: string): Promise<UnifiedMediaItem>
  
  /** 获取媒体项目 */
  getMediaItem(id: string): UnifiedMediaItem | null
  
  /** 查询媒体项目 */
  queryMediaItems(query: MediaItemQuery): UnifiedMediaItem[]
  
  /** 更新媒体项目 */
  updateMediaItem(id: string, updates: Partial<UnifiedMediaItem>): void
  
  /** 删除媒体项目 */
  removeMediaItem(id: string): void
  
  /** 监听媒体项目变化 */
  subscribe(callback: (items: UnifiedMediaItem[]) => void): () => void
  
  /** 清理资源 */
  cleanup(): void
}

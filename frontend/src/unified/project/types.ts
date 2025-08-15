/**
 * 统一项目配置类型定义
 * 基于新架构统一类型系统的项目配置接口，参考旧架构ProjectConfig设计
 */

import type { UnifiedMediaItemData } from '@/unified/mediaitem'
import type { UnifiedTrackData } from '@/unified/track'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem'
import type { MediaType } from '@/unified/mediaitem'

/**
 * 媒体元数据接口
 */
export interface UnifiedMediaMetadata {
  id: string                    // 元数据ID
  originalFileName: string      // 原始文件名
  fileSize: number             // 文件大小
  mimeType: string             // MIME类型
  checksum: string             // 文件校验和
  importedAt: string           // 导入时间
  duration?: number            // 持续时间（视频/音频）
  width?: number               // 宽度（视频/图片）
  height?: number              // 高度（视频/图片）
  [key: string]: any           // 其他元数据
}

/**
 * 媒体引用接口（仅用于页面级内存缓存，不保存到项目配置文件中）
 */
export interface UnifiedMediaReference {
  id: string                   // 从metadata.id获取，保持持久化一致性
  storedPath: string           // 存储路径
  mediaType: MediaType         // 媒体类型
  metadata: UnifiedMediaMetadata // 媒体元数据
  status?: 'ready' | 'error'   // 状态
}

/**
 * 统一项目配置接口（基于新架构统一类型）
 * 采用Meta驱动策略，项目配置不包含媒体引用字段
 */
export interface UnifiedProjectConfig {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  version: string
  thumbnail?: string
  duration: number // 项目总时长（秒）

  // 项目设置
  settings: {
    videoResolution: {
      name: string
      width: number
      height: number
      aspectRatio: string
    }
    frameRate: number // 固定30帧
    timelineDurationFrames: number
  }

  // 时间轴数据（使用统一类型）
  timeline: {
    tracks: UnifiedTrackData[]
    timelineItems: UnifiedTimelineItemData[]
    mediaItems: UnifiedMediaItemData[]
  }
  
  // 注意：采用完全Meta驱动策略后，项目配置不再包含媒体相关字段
  // 所有媒体信息都通过扫描目录中的.meta文件获取
}

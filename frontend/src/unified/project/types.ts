/**
 * 统一项目配置类型定义
 * 基于新架构统一类型系统的项目配置接口，参考旧架构ProjectConfig设计
 */

import type { UnifiedMediaItemData } from '@/unified/mediaitem'
import type { UnifiedTrackData } from '@/unified/track'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem'

/**
 * 统一项目配置接口（基于新架构统一类型）
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
  // 媒体数据（使用统一类型）(根据不同数据源有不同的配置)
  media: {}
}

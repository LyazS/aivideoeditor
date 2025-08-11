/**
 * 统一项目配置类型定义
 * 基于新架构统一类型系统的项目配置接口，参考旧架构ProjectConfig设计
 */

import type { UnifiedMediaItemData } from '../mediaitem/types'
import type { UnifiedTrackData } from '../track/TrackTypes'
import type { UnifiedTimelineItemData } from '../timelineitem/TimelineItemData'

/**
 * 统一项目配置接口（基于新架构统一类型）
 */
export interface UnifiedProjectConfig {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  version: string
  thumbnail?: string
  duration?: string

  // 项目设置
  settings: {
    videoResolution: {
      name: string
      width: number
      height: number
      aspectRatio: string
    }
    frameRate: number
    timelineDurationFrames: number
  }

  // 时间轴数据（使用统一类型）
  timeline: {
    tracks: UnifiedTrackData[]
    timelineItems: UnifiedTimelineItemData[]
    mediaItems: UnifiedMediaItemData[]
  }

  // 导出历史
  exports: any[]
}

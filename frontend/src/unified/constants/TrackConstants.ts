/**
 * 轨道相关常量定义
 */

import type { UnifiedTrackType } from '@/unified/track/TrackTypes'

/**
 * 默认轨道名称映射
 */
export const DEFAULT_TRACK_NAMES: Record<UnifiedTrackType, string> = {
  video: '默认视频轨道',
  audio: '默认音频轨道',
  text: '默认文本轨道',
  subtitle: '默认字幕轨道',
  effect: '默认特效轨道',
}

/**
 * 默认轨道高度映射
 * 视频轨道: 80px, 音频轨道: 60px, 文本轨道: 40px, 其他轨道: 60px
 */
export const DEFAULT_TRACK_HEIGHTS: Record<UnifiedTrackType, number> = {
  video: 70,
  audio: 60,
  text: 55,
  subtitle: 40,
  effect: 60,
}

/**
 * 默认轨道内间距
 * 轨道高度60px，clip高度50px（60px - 5px * 2），上下各留5px间距
 */
export const DEFAULT_TRACK_PADDING = 5

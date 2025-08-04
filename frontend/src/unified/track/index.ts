/**
 * 统一轨道模块导出
 * 简化版本，只导出基础功能
 */

// ==================== 类型定义导出 ====================
export type {
  // 基础类型
  UnifiedTrackType,

  // 核心接口
  UnifiedTrackData,
} from './TrackTypes'

// ==================== 类型守卫函数导出 ====================
export {
  isVideoTrack,
  isAudioTrack,
  isTextTrack,
  isSubtitleTrack,
  isEffectTrack,
  createUnifiedTrackData,
  generateTrackId,
} from './TrackTypes'

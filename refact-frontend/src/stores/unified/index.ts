/**
 * 统一异步源架构 - Store统一导出
 */

// 导出所有Store
export { useUnifiedProjectStore } from './unifiedProjectStore'
export { useUnifiedMediaStore } from './unifiedMediaStore'
export { useUnifiedTimelineStore } from './unifiedTimelineStore'
export { useUnifiedPlaybackStore } from './unifiedPlaybackStore'

// 导出Store相关类型
export type { ProjectInfo, ProjectSettings, ProjectState } from './unifiedProjectStore'
export type { MediaLibraryState } from './unifiedMediaStore'
export type { TimelineState } from './unifiedTimelineStore'
export type { PlaybackControlState, PlaybackState, PlaybackMode } from './unifiedPlaybackStore'

// 统一Store初始化函数
export const initializeUnifiedStores = () => {
  // 在这里可以进行Store之间的关联设置
  // 例如：监听项目Store的变化来更新其他Store
  console.log('Unified stores initialized (empty shell)')
}

// Store清理函数
export const cleanupUnifiedStores = () => {
  // 清理所有Store的资源
  console.log('Unified stores cleaned up (empty shell)')
}

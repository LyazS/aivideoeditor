import type { TrackData } from '../../context'

/**
 * 轨道操作相关的类型定义
 */

/**
 * 添加轨道的数据
 */
export interface AddTrackData {
  name?: string
  isVisible?: boolean
  isMuted?: boolean
}

/**
 * 删除轨道的数据
 */
export interface RemoveTrackData {
  trackId: number
  trackData: TrackData // 保存轨道数据用于撤销
  affectedItemIds: string[] // 受影响的时间轴项目ID列表
}

/**
 * 重命名轨道的数据
 */
export interface RenameTrackData {
  trackId: number
  oldName: string
  newName: string
}

/**
 * 切换轨道可见性的数据
 */
export interface ToggleTrackVisibilityData {
  trackId: number
  oldVisibility: boolean
  newVisibility: boolean
}

/**
 * 切换轨道静音的数据
 */
export interface ToggleTrackMuteData {
  trackId: number
  oldMuteState: boolean
  newMuteState: boolean
}

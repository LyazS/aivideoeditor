/**
 * 统一轨道工具函数
 * 包含类型守卫、验证函数、工具函数等
 */

import type {
  UnifiedTrack,
  UnifiedTrackType,
  UnifiedTrackStatus,
  UnifiedTrackConfig,
  UnifiedTrackCapabilities,
  UnifiedTrackValidationResult,
} from './types'
import {
  UNIFIED_TRACK_TYPE_CAPABILITIES,
  UNIFIED_TRACK_TYPE_NAMES,
  UNIFIED_TRACK_STATUS_NAMES,
  UNIFIED_TRACK_TYPE_ICONS,
  UNIFIED_TRACK_STATUS_COLORS,
} from './types'

// ==================== 类型守卫 ====================

/**
 * 检查是否为有效的轨道类型
 */
export function isValidUnifiedTrackType(type: string): type is UnifiedTrackType {
  return ['video', 'audio', 'text'].includes(type)
}

/**
 * 检查是否为有效的轨道状态
 */
export function isValidUnifiedTrackStatus(status: string): status is UnifiedTrackStatus {
  return ['active', 'disabled', 'locked'].includes(status)
}

/**
 * 检查是否为统一轨道对象
 */
export function isUnifiedTrack(obj: any): obj is UnifiedTrack {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    isValidUnifiedTrackType(obj.type) &&
    isValidUnifiedTrackStatus(obj.status) &&
    typeof obj.isVisible === 'boolean' &&
    typeof obj.isMuted === 'boolean' &&
    typeof obj.height === 'number' &&
    typeof obj.order === 'number' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string'
  )
}

// ==================== 能力检查函数 ====================

/**
 * 获取轨道类型的能力
 */
export function getUnifiedTrackCapabilities(type: UnifiedTrackType): UnifiedTrackCapabilities {
  return UNIFIED_TRACK_TYPE_CAPABILITIES[type]
}

/**
 * 检查轨道是否支持可见性控制
 */
export function supportsVisibility(track: UnifiedTrack): boolean {
  return getUnifiedTrackCapabilities(track.type).supportsVisibility
}

/**
 * 检查轨道是否支持静音控制
 */
export function supportsMute(track: UnifiedTrack): boolean {
  return getUnifiedTrackCapabilities(track.type).supportsMute
}

/**
 * 检查轨道是否可编辑
 */
export function isUnifiedTrackEditable(track: UnifiedTrack): boolean {
  return track.status !== 'locked'
}

/**
 * 检查轨道是否可用
 */
export function isUnifiedTrackUsable(track: UnifiedTrack): boolean {
  return track.status === 'active'
}

// ==================== UI辅助函数 ====================

/**
 * 获取轨道类型的图标路径
 */
export function getUnifiedTrackTypeIcon(type: UnifiedTrackType): string {
  return UNIFIED_TRACK_TYPE_ICONS[type]
}

/**
 * 获取轨道状态的显示文本
 */
export function getUnifiedTrackStatusLabel(status: UnifiedTrackStatus): string {
  return UNIFIED_TRACK_STATUS_NAMES[status]
}

/**
 * 获取轨道状态的颜色
 */
export function getUnifiedTrackStatusColor(status: UnifiedTrackStatus): string {
  return UNIFIED_TRACK_STATUS_COLORS[status]
}

/**
 * 获取轨道类型的显示名称
 */
export function getUnifiedTrackTypeName(type: UnifiedTrackType): string {
  return UNIFIED_TRACK_TYPE_NAMES[type]
}

// ==================== 验证函数 ====================

/**
 * 验证轨道配置
 */
export function validateUnifiedTrackConfig(config: UnifiedTrackConfig): UnifiedTrackValidationResult {
  const errors: string[] = []

  // 检查轨道类型
  if (!isValidUnifiedTrackType(config.type)) {
    errors.push(`无效的轨道类型: ${config.type}`)
  }

  // 检查轨道状态
  if (config.status && !isValidUnifiedTrackStatus(config.status)) {
    errors.push(`无效的轨道状态: ${config.status}`)
  }

  // 检查轨道高度
  if (config.height !== undefined && config.height <= 0) {
    errors.push(`轨道高度必须大于0: ${config.height}`)
  }

  // 检查轨道名称
  if (config.name !== undefined && !config.name.trim()) {
    errors.push('轨道名称不能为空')
  }

  // 检查插入位置
  if (config.position !== undefined && config.position < 0) {
    errors.push(`插入位置不能为负数: ${config.position}`)
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

// ==================== 工具函数 ====================

/**
 * 创建轨道配置的深拷贝
 */
export function cloneUnifiedTrackConfig(config: UnifiedTrackConfig): UnifiedTrackConfig {
  return {
    ...config,
  }
}

/**
 * 创建轨道的深拷贝（会生成新的ID和时间戳）
 */
export function cloneUnifiedTrack(track: UnifiedTrack, generateNewId: () => string): UnifiedTrack {
  return {
    ...track,
    id: generateNewId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * 比较两个轨道是否相等（忽略时间戳）
 */
export function areUnifiedTracksEqual(track1: UnifiedTrack, track2: UnifiedTrack): boolean {
  return (
    track1.id === track2.id &&
    track1.name === track2.name &&
    track1.type === track2.type &&
    track1.status === track2.status &&
    track1.isVisible === track2.isVisible &&
    track1.isMuted === track2.isMuted &&
    track1.height === track2.height &&
    track1.order === track2.order &&
    track1.color === track2.color &&
    track1.description === track2.description
  )
}

/**
 * 生成轨道默认名称
 */
export function generateUnifiedTrackName(type: UnifiedTrackType, existingTracks: UnifiedTrack[]): string {
  const sameTypeCount = existingTracks.filter(t => t.type === type).length + 1
  return `${UNIFIED_TRACK_TYPE_NAMES[type]} ${sameTypeCount}`
}

/**
 * 创建默认轨道配置
 */
export function createDefaultUnifiedTrackConfig(
  type: UnifiedTrackType,
  name?: string,
  existingTracks?: UnifiedTrack[]
): UnifiedTrackConfig {
  const defaultConfig = {
    video: { height: 60, isVisible: true, isMuted: false, color: '#4CAF50' },
    audio: { height: 60, isVisible: true, isMuted: false, color: '#FF9800' },
    text: { height: 60, isVisible: true, isMuted: false, color: '#2196F3' },
  }[type]
  
  return {
    type,
    name: name || (existingTracks ? generateUnifiedTrackName(type, existingTracks) : UNIFIED_TRACK_TYPE_NAMES[type]),
    status: 'active',
    ...defaultConfig,
  }
}

/**
 * 合并轨道配置
 */
export function mergeUnifiedTrackConfig(
  base: UnifiedTrackConfig,
  override: Partial<UnifiedTrackConfig>
): UnifiedTrackConfig {
  return {
    ...base,
    ...override,
  }
}

/**
 * 过滤轨道列表
 */
export function filterUnifiedTracks(
  tracks: UnifiedTrack[],
  filters: {
    type?: UnifiedTrackType
    status?: UnifiedTrackStatus
    isVisible?: boolean
    isMuted?: boolean
  }
): UnifiedTrack[] {
  return tracks.filter(track => {
    if (filters.type && track.type !== filters.type) return false
    if (filters.status && track.status !== filters.status) return false
    if (filters.isVisible !== undefined && track.isVisible !== filters.isVisible) return false
    if (filters.isMuted !== undefined && track.isMuted !== filters.isMuted) return false
    return true
  })
}

/**
 * 排序轨道列表
 */
export function sortUnifiedTracks(
  tracks: UnifiedTrack[],
  sortBy: 'order' | 'name' | 'type' | 'createdAt' | 'updatedAt' = 'order',
  ascending: boolean = true
): UnifiedTrack[] {
  const sorted = [...tracks].sort((a, b) => {
    let aValue: any = a[sortBy]
    let bValue: any = b[sortBy]
    
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }
    
    if (aValue < bValue) return ascending ? -1 : 1
    if (aValue > bValue) return ascending ? 1 : -1
    return 0
  })
  
  return sorted
}

/**
 * 获取轨道统计信息
 */
export function getUnifiedTrackStats(tracks: UnifiedTrack[]): {
  total: number
  byType: Record<UnifiedTrackType, number>
  byStatus: Record<UnifiedTrackStatus, number>
  visible: number
  muted: number
} {
  const stats = {
    total: tracks.length,
    byType: { video: 0, audio: 0, text: 0 } as Record<UnifiedTrackType, number>,
    byStatus: { active: 0, disabled: 0, locked: 0 } as Record<UnifiedTrackStatus, number>,
    visible: 0,
    muted: 0,
  }
  
  tracks.forEach(track => {
    stats.byType[track.type]++
    stats.byStatus[track.status]++
    if (track.isVisible) stats.visible++
    if (track.isMuted) stats.muted++
  })
  
  return stats
}

// ==================== 调试工具 ====================

/**
 * 获取轨道的调试信息
 */
export function getUnifiedTrackDebugInfo(track: UnifiedTrack): object {
  return {
    id: track.id,
    name: track.name,
    type: track.type,
    status: track.status,
    isVisible: track.isVisible,
    isMuted: track.isMuted,
    height: track.height,
    order: track.order,
    color: track.color,
    description: track.description,
    createdAt: track.createdAt,
    updatedAt: track.updatedAt,
  }
}

/**
 * 打印轨道的调试信息
 */
export function debugUnifiedTrack(track: UnifiedTrack): void {
  console.log('🔍 [UnifiedTrack Debug]', getUnifiedTrackDebugInfo(track))
}

/**
 * 打印轨道列表的调试信息
 */
export function debugUnifiedTrackList(tracks: UnifiedTrack[]): void {
  console.log('🔍 [UnifiedTrack List Debug]', {
    count: tracks.length,
    tracks: tracks.map(getUnifiedTrackDebugInfo),
    stats: getUnifiedTrackStats(tracks),
  })
}

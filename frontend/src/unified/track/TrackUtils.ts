/**
 * 统一轨道工具函数 - 简化版本
 * 提供轨道操作、验证、转换等实用工具
 * 适配简化的轨道数据结构
 */

import type {
  UnifiedTrackData,
  UnifiedTrackType
} from './TrackTypes'
import {
  TRACK_TYPE_DEFAULTS,
  TRACK_NAME_VALIDATION,
  TRACK_PROPERTY_VALIDATION,
  TRACK_COLOR_THEMES
} from './TrackConstants'

// ==================== 轨道验证工具 ====================

/**
 * 验证轨道名称
 */
export function validateTrackName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: '轨道名称不能为空' }
  }

  if (name.length < TRACK_NAME_VALIDATION.MIN_LENGTH) {
    return { valid: false, error: `轨道名称至少需要${TRACK_NAME_VALIDATION.MIN_LENGTH}个字符` }
  }

  if (name.length > TRACK_NAME_VALIDATION.MAX_LENGTH) {
    return { valid: false, error: `轨道名称不能超过${TRACK_NAME_VALIDATION.MAX_LENGTH}个字符` }
  }

  if (!TRACK_NAME_VALIDATION.ALLOWED_CHARS.test(name)) {
    return { valid: false, error: '轨道名称包含不允许的字符' }
  }

  if (TRACK_NAME_VALIDATION.RESERVED_NAMES.includes(name.toLowerCase() as any)) {
    return { valid: false, error: '轨道名称不能使用保留字' }
  }

  return { valid: true }
}

/**
 * 验证轨道高度
 */
export function validateTrackHeight(height: number): { valid: boolean; error?: string } {
  const { min, max } = TRACK_PROPERTY_VALIDATION.height

  if (height < min) {
    return { valid: false, error: `轨道高度不能小于${min}像素` }
  }

  if (height > max) {
    return { valid: false, error: `轨道高度不能大于${max}像素` }
  }

  return { valid: true }
}

/**
 * 验证轨道数据完整性
 */
export function validateTrackData(track: UnifiedTrackData): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // 验证基础属性
  if (!track.id) errors.push('轨道ID不能为空')
  if (!track.type) errors.push('轨道类型不能为空')

  // 验证名称
  const nameValidation = validateTrackName(track.name)
  if (!nameValidation.valid) {
    errors.push(nameValidation.error!)
  }

  // 验证高度
  const heightValidation = validateTrackHeight(track.height)
  if (!heightValidation.valid) {
    errors.push(heightValidation.error!)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// ==================== 轨道查询工具 ====================

/**
 * 检查轨道是否可见
 */
export function isTrackVisible(track: UnifiedTrackData): boolean {
  return track.isVisible
}

/**
 * 检查轨道是否静音
 */
export function isTrackMuted(track: UnifiedTrackData): boolean {
  return track.isMuted
}

/**
 * 检查轨道是否支持音频
 */
export function trackSupportsAudio(track: UnifiedTrackData): boolean {
  const defaults = TRACK_TYPE_DEFAULTS[track.type]
  return defaults?.hasAudio ?? false
}

/**
 * 检查轨道是否支持视觉效果
 */
export function trackSupportsVisual(track: UnifiedTrackData): boolean {
  const defaults = TRACK_TYPE_DEFAULTS[track.type]
  return defaults?.hasVisual ?? false
}

/**
 * 检查轨道是否支持特效
 */
export function trackSupportsEffects(track: UnifiedTrackData): boolean {
  const defaults = TRACK_TYPE_DEFAULTS[track.type]
  return defaults?.supportsEffects ?? false
}

/**
 * 检查轨道是否支持变换
 */
export function trackSupportsTransform(track: UnifiedTrackData): boolean {
  const defaults = TRACK_TYPE_DEFAULTS[track.type]
  return defaults?.supportsTransform ?? false
}

// ==================== 轨道操作工具 ====================

/**
 * 切换轨道可见性
 */
export function toggleTrackVisibility(track: UnifiedTrackData): void {
  track.isVisible = !track.isVisible
}

/**
 * 切换轨道静音状态
 */
export function toggleTrackMute(track: UnifiedTrackData): void {
  if (!trackSupportsAudio(track)) {
    console.warn('⚠️ 该轨道类型不支持音频操作')
    return
  }

  track.isMuted = !track.isMuted
}

/**
 * 设置轨道高度
 */
export function setTrackHeight(track: UnifiedTrackData, height: number): boolean {
  const validation = validateTrackHeight(height)
  if (!validation.valid) {
    console.warn('⚠️ 高度值无效:', validation.error)
    return false
  }

  track.height = height
  return true
}

// ==================== 轨道转换工具 ====================

/**
 * 获取轨道显示名称
 */
export function getTrackDisplayName(track: UnifiedTrackData): string {
  return track.name || TRACK_TYPE_DEFAULTS[track.type]?.name || '未命名轨道'
}

/**
 * 获取轨道颜色
 */
export function getTrackColor(track: UnifiedTrackData, theme: keyof typeof TRACK_COLOR_THEMES = 'default'): string {
  return TRACK_COLOR_THEMES[theme][track.type] ||
         TRACK_COLOR_THEMES.default[track.type] ||
         '#666666'
}

/**
 * 获取轨道图标
 */
export function getTrackIcon(track: UnifiedTrackData): string {
  return TRACK_TYPE_DEFAULTS[track.type]?.icon || 'help'
}

/**
 * 获取轨道类型描述
 */
export function getTrackTypeDescription(track: UnifiedTrackData): string {
  const typeMap = {
    video: '视频轨道',
    audio: '音频轨道',
    text: '文本轨道',
    subtitle: '字幕轨道',
    effect: '特效轨道'
  }
  return typeMap[track.type] || '未知类型'
}

// ==================== 轨道排序工具 ====================

/**
 * 按类型排序轨道
 */
export function sortTracksByType(tracks: UnifiedTrackData[]): UnifiedTrackData[] {
  const typeOrder = ['video', 'audio', 'text', 'subtitle', 'effect']
  return [...tracks].sort((a, b) => {
    const aIndex = typeOrder.indexOf(a.type)
    const bIndex = typeOrder.indexOf(b.type)
    return aIndex - bIndex
  })
}

/**
 * 按名称排序轨道
 */
export function sortTracksByName(tracks: UnifiedTrackData[]): UnifiedTrackData[] {
  return [...tracks].sort((a, b) => a.name.localeCompare(b.name))
}

// ==================== 轨道统计工具 ====================

/**
 * 计算轨道组统计信息
 */
export function calculateTrackGroupStats(tracks: UnifiedTrackData[]) {
  const stats = {
    total: tracks.length,
    byType: {} as Record<UnifiedTrackType, number>,
    visible: 0,
    muted: 0,
    totalHeight: 0,
    averageHeight: 0
  }

  tracks.forEach(track => {
    // 按类型统计
    stats.byType[track.type] = (stats.byType[track.type] || 0) + 1

    // 其他统计
    if (isTrackVisible(track)) stats.visible++
    if (isTrackMuted(track)) stats.muted++

    stats.totalHeight += track.height
  })

  stats.averageHeight = tracks.length > 0 ? stats.totalHeight / tracks.length : 0

  return stats
}

// ==================== 轨道导出工具 ====================

/**
 * 导出轨道为JSON
 */
export function exportTrackToJSON(track: UnifiedTrackData): string {
  return JSON.stringify(track, null, 2)
}

/**
 * 从JSON导入轨道
 */
export function importTrackFromJSON(json: string): UnifiedTrackData | null {
  try {
    const track = JSON.parse(json) as UnifiedTrackData
    const validation = validateTrackData(track)

    if (!validation.valid) {
      console.error('❌ 轨道数据验证失败:', validation.errors)
      return null
    }

    return track
  } catch (error) {
    console.error('❌ JSON解析失败:', error)
    return null
  }
}

/**
 * 复制轨道数据
 */
export function cloneTrackData(track: UnifiedTrackData): UnifiedTrackData {
  return JSON.parse(JSON.stringify(track))
}

/**
 * 合并轨道数据
 */
export function mergeTrackData(
  target: UnifiedTrackData,
  source: Partial<UnifiedTrackData>
): UnifiedTrackData {
  return {
    ...target,
    ...source
  }
}

/**
 * 统一轨道类型定义
 * 基于"核心数据与行为分离"的响应式重构方案
 */

import { reactive } from 'vue'
import { generateUUID4 } from '@/unified/utils/idGenerator'

// ==================== 基础类型定义 ====================

/**
 * 轨道类型枚举
 */
export type UnifiedTrackType = 'video' | 'audio' | 'text' | 'subtitle' | 'effect'

/**
 * 轨道状态枚举
 */
export type TrackStatus =
  | 'active' // 活跃状态，正常使用
  | 'locked' // 锁定状态，不可编辑
  | 'disabled' // 禁用状态，不参与渲染

/**
 * 轨道可见性状态
 */
export interface TrackVisibility {
  isVisible: boolean // 是否在时间轴中可见
  isRendered: boolean // 是否参与最终渲染
  opacity: number // 透明度 (0-1)
}

/**
 * 轨道音频状态
 */
export interface TrackAudio {
  isMuted: boolean // 是否静音
  volume: number // 音量 (0-1)
  solo: boolean // 是否独奏
}

/**
 * 轨道布局属性
 */
export interface TrackLayout {
  height: number // 轨道高度（像素）
  order: number // 轨道顺序（用于排序）
  isCollapsed: boolean // 是否折叠
  isExpanded: boolean // 是否展开（显示详细信息）
}

/**
 * 轨道渲染配置
 */
export interface TrackRenderConfig {
  blendMode?: string // 混合模式
  filters?: string[] // 应用的滤镜列表
  transform?: {
    // 变换属性
    x: number
    y: number
    scaleX: number
    scaleY: number
    rotation: number
  }
}

// ==================== 核心数据接口 ====================

/**
 * 统一轨道数据接口 - 简化版本
 *
 * 设计理念：
 * - 保持与原有Track接口相似的简单结构
 * - 纯数据对象，使用 reactive() 包装
 * - 所有状态变化自动触发Vue组件更新
 */
export interface UnifiedTrackData {
  readonly id: string
  name: string
  type: UnifiedTrackType
  isVisible: boolean
  isMuted: boolean
  height: number
}

// ==================== 类型守卫函数 ====================

/**
 * 检查是否为视频轨道
 */
export function isVideoTrack(track: UnifiedTrackData): boolean {
  return track.type === 'video'
}

/**
 * 检查是否为音频轨道
 */
export function isAudioTrack(track: UnifiedTrackData): boolean {
  return track.type === 'audio'
}

/**
 * 检查是否为文本轨道
 */
export function isTextTrack(track: UnifiedTrackData): boolean {
  return track.type === 'text'
}

/**
 * 检查是否为字幕轨道
 */
export function isSubtitleTrack(track: UnifiedTrackData): boolean {
  return track.type === 'subtitle'
}

/**
 * 检查是否为特效轨道
 */
export function isEffectTrack(track: UnifiedTrackData): boolean {
  return track.type === 'effect'
}

// ==================== 工厂函数 ====================

/**
 * 创建响应式轨道数据对象
 */
export function createUnifiedTrackData(
  type: UnifiedTrackType,
  name?: string,
  options?: Partial<UnifiedTrackData>,
  id?: string,
): UnifiedTrackData {
  const baseData: UnifiedTrackData = {
    id: id || generateTrackId(),
    name: name || getDefaultTrackName(type),
    type,
    isVisible: true,
    isMuted: false,
    height: getDefaultTrackHeight(type),
    ...options,
  }

  return reactive(baseData)
}

// ==================== 辅助函数 ====================

/**
 * 生成轨道ID
 */
export function generateTrackId(): string {
  return generateUUID4()
}

/**
 * 获取默认轨道名称
 */
function getDefaultTrackName(type: UnifiedTrackType): string {
  const names = {
    video: '视频轨道',
    audio: '音频轨道',
    text: '文本轨道',
    subtitle: '字幕轨道',
    effect: '特效轨道',
  }
  return names[type]
}

/**
 * 获取默认轨道高度（统一为60px，与旧架构一致）
 */
function getDefaultTrackHeight(type: UnifiedTrackType): number {
  // 所有轨道类型统一使用60px高度
  return 60
}

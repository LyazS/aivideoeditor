/**
 * 文本Clip操作限制配置
 * 定义文本clip的操作限制和轨道兼容性
 */

import type { MediaType, TrackType } from '../types'

/**
 * 文本clip的操作限制常量配置
 */
export const TEXT_CLIP_CONSTRAINTS = {
  // 轨道兼容性：只能在文本轨道上
  compatibleTracks: ['text'] as const,

  // 不支持的操作
  unsupportedOperations: [
    'crop',    // 不能裁剪
    'split',   // 不能分割
    'trim'     // 不能修剪
  ] as const,

  // 支持的操作
  supportedOperations: [
    'move',           // 可以移动位置
    'resize',         // 可以调整时长
    'copy',           // 可以复制
    'delete',         // 可以删除
    'style-edit'      // 可以编辑样式
  ] as const
} as const

/**
 * 所有可能的操作类型
 */
export const ALL_OPERATIONS = [
  'move',
  'resize', 
  'copy',
  'delete',
  'crop',
  'split',
  'trim',
  'style-edit'
] as const

export type OperationType = typeof ALL_OPERATIONS[number]

/**
 * 操作检查工具函数
 * 检查指定操作是否被允许用于特定媒体类型
 * 
 * @param operation 要检查的操作类型
 * @param mediaType 媒体类型
 * @returns 是否允许该操作
 */
export function isOperationAllowed(
  operation: string,
  mediaType: MediaType
): boolean {
  if (mediaType === 'text') {
    return !TEXT_CLIP_CONSTRAINTS.unsupportedOperations.includes(operation as any)
  }
  
  // 其他媒体类型默认支持所有操作
  return true
}

/**
 * 轨道兼容性检查
 * 检查指定媒体类型是否可以放置在指定轨道类型上
 * 
 * @param mediaType 媒体类型
 * @param trackType 轨道类型
 * @returns 是否兼容
 */
export function isTrackCompatible(
  mediaType: MediaType,
  trackType: TrackType
): boolean {
  if (mediaType === 'text') {
    return TEXT_CLIP_CONSTRAINTS.compatibleTracks.includes(trackType as any)
  }

  // 其他媒体类型的兼容性
  switch (trackType) {
    case 'video':
      return mediaType === 'video' || mediaType === 'image'
    case 'audio':
      return mediaType === 'audio'
    case 'text':
      return mediaType === 'text'
    default:
      return false
  }
}

/**
 * 获取媒体类型支持的操作列表
 * 
 * @param mediaType 媒体类型
 * @returns 支持的操作列表
 */
export function getSupportedOperations(mediaType: MediaType): OperationType[] {
  if (mediaType === 'text') {
    return [...TEXT_CLIP_CONSTRAINTS.supportedOperations]
  }
  
  // 其他媒体类型支持所有操作
  return [...ALL_OPERATIONS]
}

/**
 * 获取媒体类型不支持的操作列表
 * 
 * @param mediaType 媒体类型
 * @returns 不支持的操作列表
 */
export function getUnsupportedOperations(mediaType: MediaType): readonly string[] {
  if (mediaType === 'text') {
    return TEXT_CLIP_CONSTRAINTS.unsupportedOperations
  }
  
  // 其他媒体类型没有限制
  return []
}

/**
 * 获取媒体类型兼容的轨道类型列表
 * 
 * @param mediaType 媒体类型
 * @returns 兼容的轨道类型列表
 */
export function getCompatibleTrackTypes(mediaType: MediaType): TrackType[] {
  switch (mediaType) {
    case 'video':
    case 'image':
      return ['video']
    case 'audio':
      return ['audio']
    case 'text':
      return ['text']
    default:
      return []
  }
}

/**
 * 操作标签映射
 * 用于UI显示
 */
export const OPERATION_LABELS: Record<OperationType, string> = {
  move: '移动',
  resize: '调整时长',
  copy: '复制',
  delete: '删除',
  crop: '裁剪',
  split: '分割',
  trim: '修剪',
  'style-edit': '编辑样式'
}

/**
 * 检查拖拽操作是否有效
 * 
 * @param draggedMediaType 被拖拽的媒体类型
 * @param targetTrackType 目标轨道类型
 * @returns 拖拽是否有效
 */
export function isDragDropValid(
  draggedMediaType: MediaType,
  targetTrackType: TrackType
): boolean {
  return isTrackCompatible(draggedMediaType, targetTrackType)
}

/**
 * 获取拖拽错误消息
 * 
 * @param draggedMediaType 被拖拽的媒体类型
 * @param targetTrackType 目标轨道类型
 * @returns 错误消息
 */
export function getDragDropErrorMessage(
  draggedMediaType: MediaType,
  targetTrackType: TrackType
): string {
  if (isDragDropValid(draggedMediaType, targetTrackType)) {
    return ''
  }
  
  return `${mediaType2Label(draggedMediaType)}类型不能放置在${trackType2Label(targetTrackType)}轨道上`
}

/**
 * 媒体类型标签映射
 */
function mediaType2Label(mediaType: MediaType): string {
  const labels: Record<MediaType, string> = {
    video: '视频',
    image: '图片',
    audio: '音频',
    text: '文本'
  }
  return labels[mediaType] || mediaType
}

/**
 * 轨道类型标签映射
 */
function trackType2Label(trackType: TrackType): string {
  const labels: Record<TrackType, string> = {
    video: '视频',
    audio: '音频',
    text: '文本'
  }
  return labels[trackType] || trackType
}

/**
 * 基于Timecode的关键帧系统类型定义
 * 这些类型使用Timecode对象进行精确的时间管理
 */

import { Timecode } from '../utils/Timecode'

// ==================== 关键帧核心类型 ====================

/**
 * 单个关键帧 - 可以包含多个属性（基于Timecode）
 */
export interface TimecodeKeyframe {
  id: string
  time: Timecode // 相对于clip开始的时间（Timecode对象）
  properties: Record<string, any> // 该时间点的所有属性值
  interpolation?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'step' // 到下一个关键帧的插值方式
}

/**
 * clip的关键帧数据（基于Timecode）
 */
export interface TimecodeClipKeyframes {
  version: number // 数据版本，用于未来升级兼容
  hasKeyframes: boolean // 该clip是否启用了关键帧模式
  keyframes: TimecodeKeyframe[] // 按时间排序的关键帧数组
  enabledProperties: Set<string> // 启用关键帧的属性列表
  frameRate: number // 帧率，用于Timecode对象的创建和转换
}

/**
 * 支持不同类型的关键帧值
 */
export type KeyframeValue = 
  | number // 单值：opacity, rotation, volume
  | { x: number; y: number } // 位置
  | { width: number; height: number } // 尺寸

/**
 * 关键帧操作类型
 */
export type KeyframeOperation = 
  | 'enable' // 启用关键帧
  | 'disable' // 禁用关键帧
  | 'add' // 添加关键帧
  | 'update' // 更新关键帧
  | 'remove' // 删除关键帧
  | 'addProperty' // 添加属性到关键帧系统
  | 'removeProperty' // 从关键帧系统移除属性

/**
 * 关键帧操作参数
 */
export interface KeyframeOperationParams {
  timelineItemId: string
  operation: KeyframeOperation
  time?: Timecode
  property?: string
  properties?: Record<string, any>
  value?: any
}

// ==================== 序列化相关类型 ====================

/**
 * 可序列化的关键帧（用于存储和传输）
 */
export interface SerializableTimecodeKeyframe {
  id: string
  time: string // Timecode转换为字符串格式
  properties: Record<string, any>
  interpolation?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'step'
}

/**
 * 可序列化的关键帧数据
 */
export interface SerializableTimecodeClipKeyframes {
  version: number
  hasKeyframes: boolean
  keyframes: SerializableTimecodeKeyframe[]
  enabledProperties: string[] // Set转换为数组进行序列化
  frameRate: number
}

// ==================== 转换工具函数 ====================

/**
 * 将TimecodeKeyframe转换为可序列化格式
 */
export function serializeTimecodeKeyframe(keyframe: TimecodeKeyframe): SerializableTimecodeKeyframe {
  return {
    id: keyframe.id,
    time: keyframe.time.toString(),
    properties: keyframe.properties,
    interpolation: keyframe.interpolation,
  }
}

/**
 * 将可序列化格式转换为TimecodeKeyframe
 */
export function deserializeTimecodeKeyframe(
  serialized: SerializableTimecodeKeyframe,
  frameRate: number
): TimecodeKeyframe {
  return {
    id: serialized.id,
    time: Timecode.fromString(serialized.time, frameRate),
    properties: serialized.properties,
    interpolation: serialized.interpolation,
  }
}

/**
 * 将TimecodeClipKeyframes转换为可序列化格式
 */
export function serializeTimecodeClipKeyframes(clipKeyframes: TimecodeClipKeyframes): SerializableTimecodeClipKeyframes {
  return {
    version: clipKeyframes.version,
    hasKeyframes: clipKeyframes.hasKeyframes,
    keyframes: clipKeyframes.keyframes.map(serializeTimecodeKeyframe),
    enabledProperties: Array.from(clipKeyframes.enabledProperties),
    frameRate: clipKeyframes.frameRate,
  }
}

/**
 * 将可序列化格式转换为TimecodeClipKeyframes
 */
export function deserializeTimecodeClipKeyframes(
  serialized: SerializableTimecodeClipKeyframes
): TimecodeClipKeyframes {
  return {
    version: serialized.version,
    hasKeyframes: serialized.hasKeyframes,
    keyframes: serialized.keyframes.map(kf => deserializeTimecodeKeyframe(kf, serialized.frameRate)),
    enabledProperties: new Set(serialized.enabledProperties),
    frameRate: serialized.frameRate,
  }
}

// ==================== 工具函数 ====================

/**
 * 创建默认的关键帧数据
 */
export function createDefaultTimecodeClipKeyframes(frameRate: number = 30): TimecodeClipKeyframes {
  return {
    version: 1,
    hasKeyframes: false,
    keyframes: [],
    enabledProperties: new Set(),
    frameRate,
  }
}

/**
 * 创建新的关键帧
 */
export function createTimecodeKeyframe(
  time: Timecode,
  properties: Record<string, any>,
  interpolation: TimecodeKeyframe['interpolation'] = 'linear'
): TimecodeKeyframe {
  return {
    id: `kf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    time,
    properties,
    interpolation,
  }
}

/**
 * 按时间排序关键帧数组
 */
export function sortKeyframesByTime(keyframes: TimecodeKeyframe[]): TimecodeKeyframe[] {
  return [...keyframes].sort((a, b) => a.time.compare(b.time))
}

/**
 * 查找指定时间的关键帧
 */
export function findKeyframeAtTime(keyframes: TimecodeKeyframe[], time: Timecode): TimecodeKeyframe | null {
  return keyframes.find(kf => kf.time.equals(time)) || null
}

/**
 * 查找指定时间范围内的关键帧
 */
export function findKeyframesInRange(
  keyframes: TimecodeKeyframe[],
  startTime: Timecode,
  endTime: Timecode
): TimecodeKeyframe[] {
  return keyframes.filter(kf => 
    !kf.time.lessThan(startTime) && kf.time.lessThan(endTime)
  )
}

/**
 * 获取关键帧的时间范围
 */
export function getKeyframesTimeRange(keyframes: TimecodeKeyframe[]): {
  start: Timecode | null
  end: Timecode | null
} {
  if (keyframes.length === 0) {
    return { start: null, end: null }
  }

  const sorted = sortKeyframesByTime(keyframes)
  return {
    start: sorted[0].time,
    end: sorted[sorted.length - 1].time,
  }
}

/**
 * 检查属性是否在关键帧中启用
 */
export function isPropertyEnabled(clipKeyframes: TimecodeClipKeyframes, property: string): boolean {
  return clipKeyframes.hasKeyframes && clipKeyframes.enabledProperties.has(property)
}

/**
 * 检查指定时间是否有关键帧
 */
export function hasKeyframeAtTime(clipKeyframes: TimecodeClipKeyframes, time: Timecode): boolean {
  return clipKeyframes.keyframes.some(kf => kf.time.equals(time))
}

/**
 * 获取指定时间的属性值（通过插值计算）
 */
export function getInterpolatedValuesAtTime(
  clipKeyframes: TimecodeClipKeyframes,
  time: Timecode,
  properties: string[]
): Record<string, any> {
  const result: Record<string, any> = {}
  
  if (!clipKeyframes.hasKeyframes || clipKeyframes.keyframes.length === 0) {
    return result
  }

  const sortedKeyframes = sortKeyframesByTime(clipKeyframes.keyframes)
  
  for (const property of properties) {
    if (!clipKeyframes.enabledProperties.has(property)) {
      continue
    }

    // 查找包含该属性的关键帧
    const keyframesWithProperty = sortedKeyframes.filter(kf => property in kf.properties)
    
    if (keyframesWithProperty.length === 0) {
      continue
    }

    // 如果时间在第一个关键帧之前，使用第一个关键帧的值
    if (time.lessThan(keyframesWithProperty[0].time)) {
      result[property] = keyframesWithProperty[0].properties[property]
      continue
    }

    // 如果时间在最后一个关键帧之后，使用最后一个关键帧的值
    const lastKeyframe = keyframesWithProperty[keyframesWithProperty.length - 1]
    if (!time.lessThan(lastKeyframe.time)) {
      result[property] = lastKeyframe.properties[property]
      continue
    }

    // 查找时间所在的区间进行插值
    for (let i = 0; i < keyframesWithProperty.length - 1; i++) {
      const currentKf = keyframesWithProperty[i]
      const nextKf = keyframesWithProperty[i + 1]

      if (!time.lessThan(currentKf.time) && time.lessThan(nextKf.time)) {
        // 在这个区间内，进行插值
        const progress = calculateInterpolationProgress(time, currentKf.time, nextKf.time)
        result[property] = interpolateValue(
          currentKf.properties[property],
          nextKf.properties[property],
          progress,
          currentKf.interpolation || 'linear'
        )
        break
      }
    }
  }

  return result
}

/**
 * 计算插值进度（0-1之间）
 */
function calculateInterpolationProgress(
  currentTime: Timecode,
  startTime: Timecode,
  endTime: Timecode
): number {
  const totalDuration = endTime.subtract(startTime).totalFrames
  const currentDuration = currentTime.subtract(startTime).totalFrames
  
  if (totalDuration === 0) return 0
  return Math.max(0, Math.min(1, currentDuration / totalDuration))
}

/**
 * 插值计算
 */
function interpolateValue(
  startValue: any,
  endValue: any,
  progress: number,
  interpolation: TimecodeKeyframe['interpolation'] = 'linear'
): any {
  // 应用插值曲线
  let easedProgress = progress
  switch (interpolation) {
    case 'ease':
      easedProgress = easeInOut(progress)
      break
    case 'ease-in':
      easedProgress = easeIn(progress)
      break
    case 'ease-out':
      easedProgress = easeOut(progress)
      break
    case 'step':
      easedProgress = progress < 1 ? 0 : 1
      break
    case 'linear':
    default:
      // 保持线性插值
      break
  }

  // 根据值类型进行插值
  if (typeof startValue === 'number' && typeof endValue === 'number') {
    return startValue + (endValue - startValue) * easedProgress
  }

  if (typeof startValue === 'object' && typeof endValue === 'object') {
    const result: any = {}
    for (const key in startValue) {
      if (key in endValue) {
        result[key] = startValue[key] + (endValue[key] - startValue[key]) * easedProgress
      }
    }
    return result
  }

  // 对于其他类型，使用步进插值
  return easedProgress < 1 ? startValue : endValue
}

// 缓动函数
function easeIn(t: number): number {
  return t * t
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

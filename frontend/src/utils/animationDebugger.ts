/**
 * 动画调试工具
 * 提供动画系统的调试和诊断功能
 */

import type { TimelineItem, AnimationConfig, Keyframe } from '../types'
import { hasAnimation, isAnimationEnabled, getAllKeyframeFrames } from './keyframeUtils'
import { isValidAnimationConfig, getAnimationDebugInfo } from './animationConverter'

// ==================== 调试信息类型 ====================

/**
 * 动画诊断结果
 */
export interface AnimationDiagnostic {
  itemId: string
  itemName: string
  hasAnimation: boolean
  isEnabled: boolean
  isValid: boolean
  keyframeCount: number
  duration: number
  issues: AnimationIssue[]
  suggestions: string[]
}

/**
 * 动画问题类型
 */
export interface AnimationIssue {
  type: 'error' | 'warning' | 'info'
  code: string
  message: string
  details?: any
}

// ==================== 诊断函数 ====================

/**
 * 诊断TimelineItem的动画配置
 * @param item 时间轴项目
 * @param mediaItemName 媒体项目名称（用于显示）
 * @returns 诊断结果
 */
export function diagnoseAnimation(item: TimelineItem, mediaItemName?: string): AnimationDiagnostic {
  const diagnostic: AnimationDiagnostic = {
    itemId: item.id,
    itemName: mediaItemName || `Item ${item.id}`,
    hasAnimation: hasAnimation(item),
    isEnabled: isAnimationEnabled(item),
    isValid: false,
    keyframeCount: 0,
    duration: 0,
    issues: [],
    suggestions: []
  }

  // 基础检查
  if (!item.animation) {
    diagnostic.issues.push({
      type: 'info',
      code: 'NO_ANIMATION',
      message: '该项目没有动画配置'
    })
    diagnostic.suggestions.push('点击属性右侧的钻石框来启用动画')
    return diagnostic
  }

  const animation = item.animation
  diagnostic.keyframeCount = animation.keyframes.length
  diagnostic.duration = animation.duration

  // 检查动画是否启用
  if (!animation.isEnabled) {
    diagnostic.issues.push({
      type: 'warning',
      code: 'ANIMATION_DISABLED',
      message: '动画已禁用'
    })
    diagnostic.suggestions.push('在动画配置中启用动画')
  }

  // 检查关键帧数量
  if (animation.keyframes.length === 0) {
    diagnostic.issues.push({
      type: 'error',
      code: 'NO_KEYFRAMES',
      message: '没有关键帧'
    })
    diagnostic.suggestions.push('至少需要一个关键帧才能播放动画')
    return diagnostic
  }

  if (animation.keyframes.length === 1) {
    diagnostic.issues.push({
      type: 'warning',
      code: 'SINGLE_KEYFRAME',
      message: '只有一个关键帧，无法产生动画效果'
    })
    diagnostic.suggestions.push('添加更多关键帧来创建动画效果')
  }

  // 验证动画配置
  diagnostic.isValid = isValidAnimationConfig(animation)
  if (!diagnostic.isValid) {
    diagnostic.issues.push({
      type: 'error',
      code: 'INVALID_CONFIG',
      message: '动画配置无效'
    })
  }

  // 检查关键帧
  animation.keyframes.forEach((keyframe, index) => {
    validateKeyframe(keyframe, index, item, diagnostic)
  })

  // 检查时间范围
  validateTimeRange(animation, item, diagnostic)

  // 检查属性一致性
  validatePropertyConsistency(animation, diagnostic)

  // 性能建议
  if (animation.keyframes.length > 20) {
    diagnostic.issues.push({
      type: 'warning',
      code: 'TOO_MANY_KEYFRAMES',
      message: '关键帧数量过多可能影响性能'
    })
    diagnostic.suggestions.push('考虑减少关键帧数量或优化动画')
  }

  return diagnostic
}

/**
 * 验证单个关键帧
 */
function validateKeyframe(
  keyframe: Keyframe,
  index: number,
  item: TimelineItem,
  diagnostic: AnimationDiagnostic
): void {
  // 检查帧数
  if (typeof keyframe.frame !== 'number' || keyframe.frame < 0) {
    diagnostic.issues.push({
      type: 'error',
      code: 'INVALID_FRAME',
      message: `关键帧 ${index} 的帧数无效: ${keyframe.frame}`,
      details: { keyframeIndex: index, frame: keyframe.frame }
    })
  }

  // 检查是否在时间范围内
  const timeRange = item.timeRange
  if (keyframe.frame < timeRange.timelineStartTime || keyframe.frame > timeRange.timelineEndTime) {
    diagnostic.issues.push({
      type: 'warning',
      code: 'FRAME_OUT_OF_RANGE',
      message: `关键帧 ${index} 超出时间轴范围`,
      details: {
        keyframeIndex: index,
        frame: keyframe.frame,
        range: { start: timeRange.timelineStartTime, end: timeRange.timelineEndTime }
      }
    })
  }

  // 检查属性
  if (!keyframe.properties || Object.keys(keyframe.properties).length === 0) {
    diagnostic.issues.push({
      type: 'error',
      code: 'NO_PROPERTIES',
      message: `关键帧 ${index} 没有属性`,
      details: { keyframeIndex: index }
    })
  }

  // 验证属性值
  Object.entries(keyframe.properties).forEach(([property, value]) => {
    validatePropertyValue(property, value, index, diagnostic)
  })
}

/**
 * 验证属性值
 */
function validatePropertyValue(
  property: string,
  value: any,
  keyframeIndex: number,
  diagnostic: AnimationDiagnostic
): void {
  switch (property) {
    case 'position':
      if (!value || typeof value.x !== 'number' || typeof value.y !== 'number') {
        diagnostic.issues.push({
          type: 'error',
          code: 'INVALID_POSITION',
          message: `关键帧 ${keyframeIndex} 的位置值无效`,
          details: { keyframeIndex, property, value }
        })
      }
      break

    case 'size':
      if (!value || typeof value.width !== 'number' || typeof value.height !== 'number') {
        diagnostic.issues.push({
          type: 'error',
          code: 'INVALID_SIZE',
          message: `关键帧 ${keyframeIndex} 的尺寸值无效`,
          details: { keyframeIndex, property, value }
        })
      } else if (value.width <= 0 || value.height <= 0) {
        diagnostic.issues.push({
          type: 'warning',
          code: 'ZERO_SIZE',
          message: `关键帧 ${keyframeIndex} 的尺寸为零或负数`,
          details: { keyframeIndex, property, value }
        })
      }
      break

    case 'rotation':
      if (typeof value !== 'number') {
        diagnostic.issues.push({
          type: 'error',
          code: 'INVALID_ROTATION',
          message: `关键帧 ${keyframeIndex} 的旋转值无效`,
          details: { keyframeIndex, property, value }
        })
      }
      break

    case 'opacity':
      if (typeof value !== 'number' || value < 0 || value > 1) {
        diagnostic.issues.push({
          type: 'error',
          code: 'INVALID_OPACITY',
          message: `关键帧 ${keyframeIndex} 的透明度值无效（应在0-1之间）`,
          details: { keyframeIndex, property, value }
        })
      }
      break
  }
}

/**
 * 验证时间范围
 */
function validateTimeRange(
  animation: AnimationConfig,
  item: TimelineItem,
  diagnostic: AnimationDiagnostic
): void {
  const frames = getAllKeyframeFrames(item)
  if (frames.length === 0) return

  const minFrame = Math.min(...frames)
  const maxFrame = Math.max(...frames)
  const timeRange = item.timeRange

  if (minFrame < timeRange.timelineStartTime) {
    diagnostic.issues.push({
      type: 'warning',
      code: 'KEYFRAME_BEFORE_START',
      message: '有关键帧位于时间轴开始之前',
      details: { minFrame, timelineStart: timeRange.timelineStartTime }
    })
  }

  if (maxFrame > timeRange.timelineEndTime) {
    diagnostic.issues.push({
      type: 'warning',
      code: 'KEYFRAME_AFTER_END',
      message: '有关键帧位于时间轴结束之后',
      details: { maxFrame, timelineEnd: timeRange.timelineEndTime }
    })
  }

  if (animation.duration !== maxFrame) {
    diagnostic.issues.push({
      type: 'info',
      code: 'DURATION_MISMATCH',
      message: '动画时长与最后关键帧位置不匹配',
      details: { animationDuration: animation.duration, lastKeyframe: maxFrame }
    })
  }
}

/**
 * 验证属性一致性
 */
function validatePropertyConsistency(
  animation: AnimationConfig,
  diagnostic: AnimationDiagnostic
): void {
  const propertyUsage: Record<string, number> = {}

  animation.keyframes.forEach(keyframe => {
    Object.keys(keyframe.properties).forEach(property => {
      propertyUsage[property] = (propertyUsage[property] || 0) + 1
    })
  })

  Object.entries(propertyUsage).forEach(([property, count]) => {
    if (count === 1) {
      diagnostic.issues.push({
        type: 'info',
        code: 'SINGLE_PROPERTY_USAGE',
        message: `属性 ${property} 只在一个关键帧中使用`,
        details: { property, usage: count }
      })
    }
  })
}

// ==================== 批量诊断 ====================

/**
 * 诊断多个TimelineItem的动画
 * @param items 时间轴项目数组
 * @param getMediaItemName 获取媒体项目名称的函数
 * @returns 诊断结果数组
 */
export function diagnoseMultipleAnimations(
  items: TimelineItem[],
  getMediaItemName?: (mediaItemId: string) => string
): AnimationDiagnostic[] {
  return items.map(item => {
    const mediaItemName = getMediaItemName ? getMediaItemName(item.mediaItemId) : undefined
    return diagnoseAnimation(item, mediaItemName)
  })
}

/**
 * 生成诊断报告
 * @param diagnostics 诊断结果数组
 * @returns 格式化的报告字符串
 */
export function generateDiagnosticReport(diagnostics: AnimationDiagnostic[]): string {
  const lines: string[] = []
  
  lines.push('# 动画系统诊断报告')
  lines.push(`生成时间: ${new Date().toLocaleString()}`)
  lines.push(`检查项目数: ${diagnostics.length}`)
  lines.push('')

  const withAnimation = diagnostics.filter(d => d.hasAnimation)
  const withIssues = diagnostics.filter(d => d.issues.length > 0)

  lines.push('## 概览')
  lines.push(`- 有动画的项目: ${withAnimation.length}`)
  lines.push(`- 有问题的项目: ${withIssues.length}`)
  lines.push('')

  if (withIssues.length > 0) {
    lines.push('## 问题详情')
    withIssues.forEach(diagnostic => {
      lines.push(`### ${diagnostic.itemName} (${diagnostic.itemId})`)
      diagnostic.issues.forEach(issue => {
        const icon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️'
        lines.push(`${icon} ${issue.message}`)
      })
      if (diagnostic.suggestions.length > 0) {
        lines.push('**建议:**')
        diagnostic.suggestions.forEach(suggestion => {
          lines.push(`- ${suggestion}`)
        })
      }
      lines.push('')
    })
  }

  return lines.join('\n')
}

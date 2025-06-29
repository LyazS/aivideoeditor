/**
 * 关键帧系统测试工具
 * 用于调试和验证关键帧系统的各个环节
 */

import type { TimelineItem, MediaType } from '../types'
import { 
  createKeyframe, 
  hasAnimation, 
  getKeyframeButtonState,
  extractAnimatableProperties 
} from './unifiedKeyframeUtils'
import { convertToWebAVAnimation, isValidAnimationConfig } from './animationConverter'

/**
 * 测试关键帧创建流程
 */
export function testKeyframeCreation(item: TimelineItem, frame: number): void {
  console.group('🧪 [Keyframe Test] 测试关键帧创建流程')
  
  try {
    console.log('📋 测试参数:', {
      itemId: item.id,
      mediaType: item.mediaType,
      frame,
      hasConfig: !!item.config,
      hasAnimation: !!item.config.animation,
    })

    // 1. 测试属性提取
    console.log('🔍 步骤1: 测试属性提取')
    const properties = (extractAnimatableProperties as any)(item)
    console.log('提取的属性:', properties)

    // 2. 测试关键帧创建
    console.log('🔍 步骤2: 测试关键帧创建')
    const keyframe = createKeyframe(item, frame)
    console.log('创建的关键帧:', keyframe)

    // 3. 测试动画状态
    console.log('🔍 步骤3: 测试动画状态')
    const hasAnim = hasAnimation(item)
    const buttonState = getKeyframeButtonState(item, frame)
    console.log('动画状态:', { hasAnimation: hasAnim, buttonState })

    // 4. 测试动画配置验证
    if (item.config.animation) {
      console.log('🔍 步骤4: 测试动画配置验证')
      const isValid = isValidAnimationConfig(item.config.animation)
      console.log('动画配置有效性:', isValid)

      // 5. 测试WebAV转换
      if (isValid) {
        console.log('🔍 步骤5: 测试WebAV转换')
        try {
          const webavConfig = convertToWebAVAnimation(
            item.config.animation,
            item.timeRange,
            1920, // 假设画布宽度
            1080  // 假设画布高度
          )
          console.log('WebAV配置:', webavConfig)
        } catch (conversionError) {
          console.error('WebAV转换失败:', conversionError)
        }
      }
    }

    console.log('✅ 关键帧创建流程测试完成')
  } catch (error) {
    console.error('❌ 关键帧创建流程测试失败:', error)
  }
  
  console.groupEnd()
}

/**
 * 测试关键帧系统的完整性
 */
export function testKeyframeSystem(item: TimelineItem): void {
  console.group('🧪 [Keyframe Test] 测试关键帧系统完整性')
  
  try {
    // 测试不同帧位置的关键帧创建
    const testFrames = [0, 30, 60, 90]
    
    testFrames.forEach(frame => {
      console.log(`\n📍 测试帧位置: ${frame}`)
      testKeyframeCreation(item, frame)
    })

    console.log('✅ 关键帧系统完整性测试完成')
  } catch (error) {
    console.error('❌ 关键帧系统完整性测试失败:', error)
  }
  
  console.groupEnd()
}

/**
 * 快速诊断关键帧问题
 */
export function diagnoseKeyframeIssues(item: TimelineItem): void {
  console.group('🔧 [Keyframe Diagnosis] 诊断关键帧问题')
  
  const issues: string[] = []
  
  // 检查基本结构
  if (!item) {
    issues.push('TimelineItem为空')
  } else {
    if (!item.config) {
      issues.push('config属性缺失')
    } else {
      if (item.config.animation === null) {
        issues.push('animation属性为null')
      } else if (item.config.animation === undefined) {
        console.log('ℹ️ animation属性未初始化（正常状态）')
      }
    }

    if (!item.timeRange) {
      issues.push('timeRange属性缺失')
    } else {
      const duration = item.timeRange.timelineEndTime - item.timeRange.timelineStartTime
      if (duration <= 0) {
        issues.push(`时间范围无效: ${duration}`)
      }
    }

    if (!item.sprite) {
      issues.push('sprite属性缺失')
    }
  }

  if (issues.length > 0) {
    console.error('❌ 发现问题:', issues)
  } else {
    console.log('✅ 基本结构检查通过')
  }
  
  console.groupEnd()
}

// 导出到全局对象以便在控制台中使用
if (typeof window !== 'undefined') {
  ;(window as any).keyframeTest = {
    testKeyframeCreation,
    testKeyframeSystem,
    diagnoseKeyframeIssues,
  }
}

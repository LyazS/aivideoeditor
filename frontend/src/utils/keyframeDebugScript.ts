/**
 * 关键帧调试脚本
 * 提供一键调试关键帧系统的功能
 */

import { useVideoStore } from '../stores/videoStore'
import { testKeyframeCreation, testKeyframeSystem, diagnoseKeyframeIssues } from './keyframeTestUtils'
import { enableKeyframeDebug, debugCurrentItem } from './keyframeDebugger'

/**
 * 一键调试当前选中的时间轴项目
 */
export async function debugSelectedItem(): Promise<void> {
  console.group('🔧 [Keyframe Debug] 一键调试选中项目')
  
  try {
    const videoStore = useVideoStore()
    
    // 获取选中的项目
    let selectedItem = null
    if (videoStore.selectedTimelineItemId) {
      selectedItem = videoStore.getTimelineItem(videoStore.selectedTimelineItemId)
    }
    
    if (!selectedItem) {
      console.warn('❌ 没有选中的时间轴项目')
      return
    }
    
    console.log('📋 选中项目信息:', {
      id: selectedItem.id,
      mediaType: selectedItem.mediaType,
      hasConfig: !!selectedItem.config,
      hasAnimation: !!selectedItem.config?.animation,
    })
    
    // 启用调试模式
    enableKeyframeDebug()
    
    // 1. 诊断基本问题
    diagnoseKeyframeIssues(selectedItem)
    
    // 2. 测试关键帧创建
    const currentFrame = videoStore.currentFrame
    testKeyframeCreation(selectedItem, currentFrame)
    
    // 3. 测试系统完整性
    testKeyframeSystem(selectedItem)
    
    console.log('✅ 调试完成')
  } catch (error) {
    console.error('❌ 调试过程中出现错误:', error)
  }
  
  console.groupEnd()
}

/**
 * 调试所有时间轴项目
 */
export async function debugAllItems(): Promise<void> {
  console.group('🔧 [Keyframe Debug] 调试所有时间轴项目')
  
  try {
    const videoStore = useVideoStore()
    const allItems = videoStore.timelineItems
    
    if (allItems.length === 0) {
      console.warn('❌ 没有时间轴项目')
      return
    }
    
    console.log(`📋 找到 ${allItems.length} 个时间轴项目`)
    
    allItems.forEach((item, index) => {
      console.log(`\n🔍 调试项目 ${index + 1}/${allItems.length}: ${item.id}`)
      diagnoseKeyframeIssues(item)
    })
    
    console.log('✅ 所有项目调试完成')
  } catch (error) {
    console.error('❌ 调试过程中出现错误:', error)
  }
  
  console.groupEnd()
}

/**
 * 快速修复常见问题
 */
export async function quickFix(): Promise<void> {
  console.group('🔧 [Keyframe Debug] 快速修复常见问题')
  
  try {
    const videoStore = useVideoStore()
    const allItems = videoStore.timelineItems
    let fixedCount = 0
    
    allItems.forEach(item => {
      // 修复缺失的animation属性
      if (item.config && item.config.animation === null) {
        item.config.animation = undefined
        fixedCount++
        console.log(`✅ 修复项目 ${item.id} 的animation属性`)
      }
    })
    
    console.log(`✅ 快速修复完成，修复了 ${fixedCount} 个项目`)
  } catch (error) {
    console.error('❌ 快速修复失败:', error)
  }
  
  console.groupEnd()
}

/**
 * 测试关键帧创建和应用流程
 */
export async function testKeyframeFlow(): Promise<void> {
  console.group('🧪 [Keyframe Test] 测试关键帧完整流程')
  
  try {
    const videoStore = useVideoStore()
    
    // 获取选中的项目
    let selectedItem = null
    if (videoStore.selectedTimelineItemId) {
      selectedItem = videoStore.getTimelineItem(videoStore.selectedTimelineItemId)
    }
    
    if (!selectedItem) {
      console.warn('❌ 没有选中的时间轴项目')
      return
    }
    
    const currentFrame = videoStore.currentFrame
    
    console.log('📋 测试参数:', {
      itemId: selectedItem.id,
      currentFrame,
      mediaType: selectedItem.mediaType,
    })
    
    // 动态导入关键帧工具
    const { toggleKeyframe } = await import('./keyframeCommandUtils')
    
    // 测试关键帧切换
    console.log('🔍 测试关键帧切换...')
    await toggleKeyframe(selectedItem.id, currentFrame)
    
    console.log('✅ 关键帧流程测试完成')
  } catch (error) {
    console.error('❌ 关键帧流程测试失败:', error)
  }
  
  console.groupEnd()
}

// 导出到全局对象以便在控制台中使用
if (typeof window !== 'undefined') {
  ;(window as any).keyframeDebugScript = {
    debugSelectedItem,
    debugAllItems,
    quickFix,
    testKeyframeFlow,
  }
  
  // 提供快捷方式
  ;(window as any).debugKeyframes = debugSelectedItem
  ;(window as any).fixKeyframes = quickFix
  ;(window as any).testKeyframes = testKeyframeFlow
  
  console.log('🔧 关键帧调试工具已加载到全局对象:')
  console.log('  - window.debugKeyframes() - 调试选中项目')
  console.log('  - window.fixKeyframes() - 快速修复问题')
  console.log('  - window.testKeyframes() - 测试关键帧流程')
}

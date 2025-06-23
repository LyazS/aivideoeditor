/**
 * 🆕 简化的数据流架构示例
 * 
 * 完整的数据流：
 * UI输入 → updateTimelineItemProperty → Sprite属性更新 → propsChange事件 → TimelineItem属性更新 → UI反馈
 */

import { useVideoStore } from '../stores/videoStore'

/**
 * 属性面板中使用的简化更新方法
 * 
 * @example
 * // 在属性面板中更新位置
 * const updatePosition = (axis: 'x' | 'y', value: number) => {
 *   if (!selectedTimelineItem.value) return
 *   
 *   // 直接调用store的更新方法，触发完整的数据流
 *   videoStore.updateTimelineItemProperty(selectedTimelineItem.value.id, axis, value)
 * }
 * 
 * // 在模板中使用
 * <input 
 *   :value="selectedTimelineItem.x" 
 *   @blur="updatePosition('x', $event.target.value)"
 * />
 */
export function createPropertyUpdater(timelineItemId: string) {
  const videoStore = useVideoStore()
  
  return {
    /**
     * 更新位置属性
     */
    updatePosition: (axis: 'x' | 'y', value: number) => {
      videoStore.updateTimelineItemProperty(timelineItemId, axis, value)
    },
    
    /**
     * 更新尺寸属性
     */
    updateSize: (dimension: 'width' | 'height', value: number) => {
      videoStore.updateTimelineItemProperty(timelineItemId, dimension, value)
    },
    
    /**
     * 更新变换属性
     */
    updateTransform: (property: 'rotation' | 'opacity' | 'zIndex', value: number) => {
      videoStore.updateTimelineItemProperty(timelineItemId, property, value)
    },
    
    /**
     * 更新音频属性
     */
    updateAudio: (property: 'volume' | 'isMuted', value: number | boolean) => {
      videoStore.updateTimelineItemProperty(timelineItemId, property, value)
    }
  }
}

/**
 * 数据流验证函数
 * 用于调试，验证数据流的完整性
 */
export function validateDataFlow(timelineItemId: string, property: string, expectedValue: any) {
  const videoStore = useVideoStore()
  const timelineItem = videoStore.getTimelineItem(timelineItemId)
  
  if (!timelineItem) {
    console.error(`❌ TimelineItem not found: ${timelineItemId}`)
    return false
  }
  
  const actualValue = (timelineItem as any)[property]
  const isValid = Math.abs(actualValue - expectedValue) < 0.001
  
  console.log(`🔍 数据流验证 - ${property}:`, {
    timelineItemId,
    property,
    expectedValue,
    actualValue,
    isValid,
    spriteValue: getSpritePropertyValue(timelineItem.sprite, property)
  })
  
  return isValid
}

/**
 * 获取Sprite属性值（用于调试）
 */
function getSpritePropertyValue(sprite: any, property: string): any {
  switch (property) {
    case 'x':
    case 'y':
      // 需要坐标转换，这里简化处理
      return `sprite.rect.${property === 'x' ? 'x' : 'y'}: ${sprite.rect[property === 'x' ? 'x' : 'y']}`
    case 'width':
      return sprite.rect.w
    case 'height':
      return sprite.rect.h
    case 'rotation':
      return sprite.rect.angle || 0
    case 'opacity':
      return sprite.opacity
    case 'zIndex':
      return sprite.zIndex
    case 'volume':
      return sprite.getVolume?.() || 'N/A'
    case 'isMuted':
      return sprite.isMuted?.() || 'N/A'
    default:
      return 'Unknown property'
  }
}

/**
 * 批量属性更新（用于复杂操作）
 */
export function batchUpdateProperties(timelineItemId: string, updates: Record<string, any>) {
  const videoStore = useVideoStore()
  
  console.log(`🔄 批量更新属性:`, { timelineItemId, updates })
  
  // 按顺序更新属性，确保依赖关系正确
  const updateOrder = ['x', 'y', 'width', 'height', 'rotation', 'opacity', 'zIndex', 'volume', 'isMuted']
  
  updateOrder.forEach(property => {
    if (updates.hasOwnProperty(property)) {
      videoStore.updateTimelineItemProperty(timelineItemId, property, updates[property])
    }
  })
}

/**
 * 动画UI状态管理 Composable
 * 管理属性面板的动画相关UI状态，包括钻石框选中状态和关键帧录制模式
 */

import { ref, computed, watch, readonly, type Ref } from 'vue'
import type {
  TimelineItem,
  PropertyAnimationState,
  AnimatableProperty,
} from '../types'
import {
  hasPropertyKeyframes,
  createInitialKeyframe,
  enableAnimation,
  disableAnimation,
  removePropertyKeyframes,
  hasAnimation,
} from '../utils/keyframeUtils'

/**
 * 动画UI管理 Composable
 * @param timelineItem 当前选中的时间轴项目
 * @param currentFrame 当前播放帧数
 */
export function useAnimationUI(
  timelineItem: Ref<TimelineItem | null>,
  currentFrame: Ref<number>
) {
  // ==================== 状态定义 ====================

  /**
   * 属性动画状态
   * 管理每个属性的UI状态（钻石框选中、是否有关键帧等）
   */
  const animationState = ref<PropertyAnimationState>({})

  // ==================== 计算属性 ====================

  /**
   * 支持的动画属性列表
   */
  const animatableProperties: AnimatableProperty[] = ['transform', 'rotation', 'opacity']

  /**
   * 当前是否有任何属性处于录制状态
   */
  const hasRecordingProperties = computed(() => {
    return Object.values(animationState.value).some(state => state.isRecording)
  })

  /**
   * 当前是否有任何动画
   */
  const hasAnyAnimation = computed(() => {
    return timelineItem.value ? hasAnimation(timelineItem.value) : false
  })

  // ==================== 核心方法 ====================

  /**
   * 防抖更新WebAV动画
   */
  let updateAnimationTimer: number | null = null

  const updateWebAVAnimationAsync = async (item: TimelineItem | null) => {
    if (!item) return

    // 清除之前的定时器
    if (updateAnimationTimer) {
      clearTimeout(updateAnimationTimer)
    }

    // 设置新的定时器，防抖300ms
    updateAnimationTimer = window.setTimeout(async () => {
      try {
        const { updateWebAVAnimation } = await import('../utils/webavAnimationManager')
        await updateWebAVAnimation(item)
      } catch (error) {
        console.error('🎬 [Animation UI] Failed to update WebAV animation:', error)
      } finally {
        updateAnimationTimer = null
      }
    }, 300)
  }

  /**
   * 根据动画数据更新UI状态
   */
  const updateAnimationState = () => {
    if (!timelineItem.value) {
      animationState.value = {}
      return
    }

    const newState: PropertyAnimationState = {}

    animatableProperties.forEach(property => {
      newState[property] = {
        hasKeyframes: hasPropertyKeyframes(timelineItem.value!, property),
        isRecording: animationState.value[property]?.isRecording || false, // 保持当前录制状态
        isDirty: false // 重置脏状态
      }
    })

    animationState.value = newState
  }

  /**
   * 切换属性录制状态（钻石框点击）
   * @param property 属性名称
   */
  const togglePropertyRecording = (property: AnimatableProperty) => {
    if (!timelineItem.value) return

    // 确保属性状态存在
    if (!animationState.value[property]) {
      animationState.value[property] = {
        hasKeyframes: false,
        isRecording: false,
        isDirty: false
      }
    }

    const currentState = animationState.value[property]
    const newRecordingState = !currentState.isRecording

    // 更新录制状态
    animationState.value[property].isRecording = newRecordingState

    if (newRecordingState) {
      // 开启录制
      enableAnimation(timelineItem.value)

      // 如果该属性没有关键帧，创建初始关键帧
      if (!currentState.hasKeyframes) {
        createInitialKeyframe(timelineItem.value, currentFrame.value, property)
        // 更新状态
        animationState.value[property].hasKeyframes = true
      }
    } else {
      // 关闭录制
      // 检查是否还有其他属性在录制
      const hasOtherRecording = animatableProperties.some(
        prop => prop !== property && animationState.value[prop]?.isRecording
      )

      if (!hasOtherRecording) {
        // 如果没有其他属性在录制，可以选择禁用动画或保持启用
        // 这里选择保持启用，让用户手动控制
        // disableAnimation(timelineItem.value)
      }
    }

    console.log(`🎬 [Animation UI] Toggle ${property} recording:`, {
      property,
      isRecording: newRecordingState,
      hasKeyframes: currentState.hasKeyframes,
      currentFrame: currentFrame.value
    })

    // 更新WebAV动画
    updateWebAVAnimationAsync(timelineItem.value)
  }

  /**
   * 清除属性的所有关键帧
   * @param property 属性名称
   */
  const clearPropertyAnimation = (property: AnimatableProperty) => {
    if (!timelineItem.value) return

    removePropertyKeyframes(timelineItem.value, property)

    // 更新UI状态
    if (animationState.value[property]) {
      animationState.value[property].hasKeyframes = false
      animationState.value[property].isRecording = false
    }

    console.log(`🎬 [Animation UI] Clear ${property} animation`)

    // 更新WebAV动画
    updateWebAVAnimationAsync(timelineItem.value)
  }

  /**
   * 标记属性为脏状态（值已修改但未保存）
   * @param property 属性名称
   */
  const markPropertyDirty = (property: AnimatableProperty) => {
    if (animationState.value[property]) {
      animationState.value[property].isDirty = true
    }
  }

  /**
   * 清除属性的脏状态
   * @param property 属性名称
   */
  const clearPropertyDirty = (property: AnimatableProperty) => {
    if (animationState.value[property]) {
      animationState.value[property].isDirty = false
    }
  }

  /**
   * 检查属性是否处于录制状态
   * @param property 属性名称
   */
  const isPropertyRecording = (property: AnimatableProperty): boolean => {
    return animationState.value[property]?.isRecording || false
  }

  /**
   * 检查属性是否有关键帧
   * @param property 属性名称
   */
  const propertyHasKeyframes = (property: AnimatableProperty): boolean => {
    return animationState.value[property]?.hasKeyframes || false
  }

  /**
   * 检查属性是否为脏状态
   * @param property 属性名称
   */
  const isPropertyDirty = (property: AnimatableProperty): boolean => {
    return animationState.value[property]?.isDirty || false
  }

  /**
   * 停止所有属性的录制
   */
  const stopAllRecording = () => {
    animatableProperties.forEach(property => {
      if (animationState.value[property]) {
        animationState.value[property].isRecording = false
      }
    })
  }

  /**
   * 获取当前录制中的属性列表
   */
  const getRecordingProperties = (): AnimatableProperty[] => {
    return animatableProperties.filter(property =>
      animationState.value[property]?.isRecording
    )
  }

  // ==================== 监听器 ====================

  /**
   * 监听 timelineItem 变化，更新UI状态
   */
  watch(
    timelineItem,
    () => {
      updateAnimationState()
    },
    { immediate: true, deep: true }
  )

  /**
   * 监听动画配置变化，更新UI状态
   */
  watch(
    () => timelineItem.value?.animation,
    () => {
      updateAnimationState()
    },
    { deep: true }
  )

  // ==================== 返回接口 ====================

  return {
    // 状态
    animationState: readonly(animationState),
    hasRecordingProperties,
    hasAnyAnimation,

    // 方法
    togglePropertyRecording,
    clearPropertyAnimation,
    markPropertyDirty,
    clearPropertyDirty,
    stopAllRecording,
    updateAnimationState,

    // 查询方法
    isPropertyRecording,
    propertyHasKeyframes,
    isPropertyDirty,
    getRecordingProperties,
  }
}

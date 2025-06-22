import { ref, computed, watch } from 'vue'
import { KeyFrameAnimationManager } from '../utils/keyFrameAnimationManager'
import {
  getCurrentPropertyValue,
  getPropertyValueAtTime,
  isNearKeyFrame,
  findNearestKeyFrameTime,
  getClipDuration
} from '../utils/animationUtils'
import { useVideoStore } from '../stores/videoStore'
import type {
  AnimatableProperty,
  KeyFrame,
  KeyFrameOperationResult
} from '../types/animationTypes'
import type { TimelineItem } from '../types/videoTypes'

/**
 * 关键帧动画管理的组合式函数
 * 提供关键帧操作的响应式接口
 */
export function useKeyFrameAnimation() {
  const videoStore = useVideoStore()

  // 当前选中的时间轴项目
  const selectedTimelineItem = ref<TimelineItem | null>(null)

  // 计算属性：是否有动画配置
  const hasAnimation = computed(() => {
    return selectedTimelineItem.value?.animationConfig?.isEnabled ?? false
  })

  // 计算属性：关键帧数量
  const keyFrameCount = computed(() => {
    return selectedTimelineItem.value?.animationConfig?.keyFrames.length ?? 0
  })

  // 计算属性：当前时间是否接近关键帧
  const isNearCurrentKeyFrame = computed(() => {
    if (!selectedTimelineItem.value?.animationConfig) return false
    return isNearKeyFrame(
      selectedTimelineItem.value.animationConfig,
      videoStore.currentTime,
      0.1 // 0.1秒容差
    )
  })

  /**
   * 设置当前操作的时间轴项目
   * @param timelineItem 时间轴项目
   */
  function setSelectedTimelineItem(timelineItem: TimelineItem | null) {
    selectedTimelineItem.value = timelineItem
  }

  /**
   * 创建关键帧
   * @param property 动画属性
   * @param value 属性值，如果不提供则使用当前值
   * @param time 时间点（秒），如果不提供则使用当前播放时间
   * @returns 操作结果
   */
  function createKeyFrame(
    property: AnimatableProperty,
    value?: number,
    time?: number
  ): KeyFrameOperationResult | null {
    if (!selectedTimelineItem.value) {
      console.warn('❌ [Animation] No timeline item selected')
      return null
    }

    const targetTime = time ?? videoStore.currentTime
    const targetValue = value ?? getCurrentPropertyValue(selectedTimelineItem.value, property)

    const result = KeyFrameAnimationManager.createKeyFrame(
      selectedTimelineItem.value,
      property,
      targetTime,
      targetValue,
      videoStore.videoResolution
    )

    console.log('🎬 [Animation] Created keyframe:', {
      property,
      value: targetValue,
      time: targetTime,
      result
    })

    return result
  }

  /**
   * 删除关键帧
   * @param keyFrameId 关键帧ID
   * @returns 操作结果
   */
  function removeKeyFrame(keyFrameId: string): KeyFrameOperationResult | null {
    if (!selectedTimelineItem.value) {
      console.warn('❌ [Animation] No timeline item selected')
      return null
    }

    const result = KeyFrameAnimationManager.removeKeyFrame(
      selectedTimelineItem.value,
      keyFrameId
    )

    console.log('🗑️ [Animation] Removed keyframe:', { keyFrameId, result })
    return result
  }

  /**
   * 删除指定属性在当前时间的关键帧
   * @param property 动画属性
   * @param time 时间点（秒），如果不提供则使用当前播放时间
   * @returns 操作结果
   */
  function removeKeyFrameProperty(
    property: AnimatableProperty,
    time?: number
  ): KeyFrameOperationResult | null {
    if (!selectedTimelineItem.value) {
      console.warn('❌ [Animation] No timeline item selected')
      return null
    }

    const targetTime = time ?? videoStore.currentTime

    const result = KeyFrameAnimationManager.removeKeyFrameProperty(
      selectedTimelineItem.value,
      property,
      targetTime
    )

    console.log('🗑️ [Animation] Removed keyframe property:', {
      property,
      time: targetTime,
      result
    })

    return result
  }

  /**
   * 检查指定属性在当前时间是否有关键帧
   * @param property 动画属性
   * @param time 时间点（秒），如果不提供则使用当前播放时间
   * @returns 是否有关键帧
   */
  function hasKeyFrameAtTime(property: AnimatableProperty, time?: number): boolean {
    if (!selectedTimelineItem.value) return false

    const targetTime = time ?? videoStore.currentTime
    return KeyFrameAnimationManager.hasKeyFrameAtTime(
      selectedTimelineItem.value,
      targetTime,
      property
    )
  }

  /**
   * 获取指定属性在当前时间的值
   * @param property 动画属性
   * @param time 时间点（秒），如果不提供则使用当前播放时间
   * @returns 属性值
   */
  function getPropertyValue(property: AnimatableProperty, time?: number): number {
    if (!selectedTimelineItem.value) return 0

    const targetTime = time ?? videoStore.currentTime
    return getPropertyValueAtTime(selectedTimelineItem.value, property, targetTime)
  }

  /**
   * 启用或禁用动画
   * @param enabled 是否启用
   */
  function setAnimationEnabled(enabled: boolean): void {
    if (!selectedTimelineItem.value) {
      console.warn('❌ [Animation] No timeline item selected')
      return
    }

    KeyFrameAnimationManager.setAnimationEnabled(
      selectedTimelineItem.value,
      enabled,
      videoStore.videoResolution
    )
    console.log('🎬 [Animation] Animation enabled:', enabled)
  }

  /**
   * 获取所有关键帧
   * @returns 关键帧数组
   */
  function getKeyFrames(): KeyFrame[] {
    if (!selectedTimelineItem.value) return []
    return KeyFrameAnimationManager.getKeyFrames(selectedTimelineItem.value)
  }

  /**
   * 跳转到下一个关键帧
   */
  function goToNextKeyFrame(): void {
    if (!selectedTimelineItem.value?.animationConfig) return

    const nextTime = findNearestKeyFrameTime(
      selectedTimelineItem.value.animationConfig,
      videoStore.currentTime,
      'next'
    )

    if (nextTime !== null) {
      videoStore.setCurrentTime(nextTime)
      console.log('⏭️ [Animation] Jumped to next keyframe:', nextTime)
    }
  }

  /**
   * 跳转到上一个关键帧
   */
  function goToPrevKeyFrame(): void {
    if (!selectedTimelineItem.value?.animationConfig) return

    const prevTime = findNearestKeyFrameTime(
      selectedTimelineItem.value.animationConfig,
      videoStore.currentTime,
      'prev'
    )

    if (prevTime !== null) {
      videoStore.setCurrentTime(prevTime)
      console.log('⏮️ [Animation] Jumped to prev keyframe:', prevTime)
    }
  }

  /**
   * 清除所有动画
   */
  function clearAllAnimations(): void {
    if (!selectedTimelineItem.value) return

    if (selectedTimelineItem.value.animationConfig) {
      selectedTimelineItem.value.animationConfig.keyFrames = []
      selectedTimelineItem.value.animationConfig.isEnabled = false
      KeyFrameAnimationManager.clearSpriteAnimation(selectedTimelineItem.value.sprite)
      console.log('🧹 [Animation] Cleared all animations')
    }
  }

  /**
   * 获取动画时长（秒）
   * 动画时长现在等于clip时长，不可单独设置
   */
  function getAnimationDuration(): number {
    if (!selectedTimelineItem.value) return 0

    // 如果有动画配置，返回配置中的时长
    if (selectedTimelineItem.value.animationConfig) {
      return selectedTimelineItem.value.animationConfig.duration / 1_000_000
    }

    // 否则返回clip时长
    return getClipDuration(selectedTimelineItem.value)
  }

  // 监听当前时间变化，自动更新属性值（如果有动画的话）
  watch(
    () => videoStore.currentTime,
    (newTime) => {
      if (selectedTimelineItem.value?.animationConfig?.isEnabled) {
        // 这里可以添加实时属性值更新的逻辑
        // 但由于WebAV会自动处理动画，通常不需要手动更新
      }
    }
  )

  return {
    // 状态
    selectedTimelineItem,
    hasAnimation,
    keyFrameCount,
    isNearCurrentKeyFrame,

    // 方法
    setSelectedTimelineItem,
    createKeyFrame,
    removeKeyFrame,
    removeKeyFrameProperty,
    hasKeyFrameAtTime,
    getPropertyValue,
    setAnimationEnabled,
    getKeyFrames,
    goToNextKeyFrame,
    goToPrevKeyFrame,
    clearAllAnimations,
    getAnimationDuration
  }
}

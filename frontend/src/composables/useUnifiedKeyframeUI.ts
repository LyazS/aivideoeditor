/**
 * 统一关键帧UI状态管理 Composable
 * 管理统一关键帧按钮的状态和交互逻辑
 */

import { ref, computed, watch, readonly, type Ref } from 'vue'
import type {
  TimelineItem,
  KeyframeUIState,
  KeyframeButtonState,
  KeyframeProperties,
} from '../types'
import { useWebAVControls } from './useWebAVControls'
import { useVideoStore } from '../stores/videoStore'
import {
  hasAnimation,
  isCurrentFrameOnKeyframe,
  getKeyframeButtonState,
  getKeyframeUIState,
  getPreviousKeyframeFrame,
  getNextKeyframeFrame,
} from '../utils/unifiedKeyframeUtils'
import {
  toggleKeyframe as toggleKeyframeWithCommand,
  updateTimelineItemProperty as updateKeyframePropertyWithCommand,
  clearAllKeyframes as clearAllKeyframesWithCommand,
} from '../utils/keyframeCommandUtils'
import { isPlayheadInTimelineItem } from '../stores/utils/timelineSearchUtils'

/**
 * 统一关键帧UI管理 Composable
 * @param timelineItem 当前选中的时间轴项目
 * @param currentFrame 当前播放帧数
 */
export function useUnifiedKeyframeUI(
  timelineItem: Ref<TimelineItem | null>,
  currentFrame: Ref<number>,
) {
  // WebAV控制器，用于正确的时间跳转
  const webAVControls = useWebAVControls()

  // 视频存储，用于显示通知
  const videoStore = useVideoStore()

  // ==================== 状态定义 ====================

  /**
   * 强制刷新计数器，用于触发响应式更新
   */
  const refreshCounter = ref(0)

  // ==================== 计算属性 ====================

  /**
   * 关键帧UI状态
   */
  const keyframeUIState = computed<KeyframeUIState>(() => {
    // 访问refreshCounter以确保响应式更新
    refreshCounter.value

    if (!timelineItem.value) {
      return { hasAnimation: false, isOnKeyframe: false }
    }

    return getKeyframeUIState(timelineItem.value, currentFrame.value)
  })

  /**
   * 关键帧按钮状态
   */
  const buttonState = computed<KeyframeButtonState>(() => {
    // 访问refreshCounter以确保响应式更新
    refreshCounter.value

    if (!timelineItem.value) {
      return 'none'
    }

    return getKeyframeButtonState(timelineItem.value, currentFrame.value)
  })

  /**
   * 是否有上一个关键帧
   */
  const hasPreviousKeyframe = computed(() => {
    if (!timelineItem.value) return false
    return getPreviousKeyframeFrame(timelineItem.value, currentFrame.value) !== null
  })

  /**
   * 是否有下一个关键帧
   */
  const hasNextKeyframe = computed(() => {
    if (!timelineItem.value) return false
    return getNextKeyframeFrame(timelineItem.value, currentFrame.value) !== null
  })

  /**
   * 播放头是否在当前选中clip的时间范围内
   */
  const isPlayheadInClip = computed(() => {
    if (!timelineItem.value) return false
    return isPlayheadInTimelineItem(timelineItem.value, currentFrame.value)
  })

  /**
   * 关键帧操作是否可用（播放头必须在clip时间范围内）
   */
  const canOperateKeyframes = computed(() => {
    return isPlayheadInClip.value
  })

  // ==================== 方法定义 ====================

  /**
   * 强制刷新UI状态
   */
  const forceRefresh = () => {
    refreshCounter.value++
  }

  /**
   * 切换关键帧状态
   */
  const toggleKeyframeState = async () => {
    if (!timelineItem.value) return

    // 检查播放头是否在clip时间范围内
    if (!canOperateKeyframes.value) {
      // 使用通知系统显示用户友好的警告
      videoStore.showWarning(
        '无法操作关键帧',
        '播放头不在当前视频片段的时间范围内。请将播放头移动到片段内再尝试操作关键帧。',
      )

      console.warn('🎬 [Unified Keyframe UI] 播放头不在当前clip时间范围内，无法操作关键帧:', {
        itemId: timelineItem.value.id,
        currentFrame: currentFrame.value,
        clipTimeRange: {
          start: timelineItem.value.timeRange.timelineStartTime,
          end: timelineItem.value.timeRange.timelineEndTime,
        },
      })
      return
    }

    try {
      // 使用命令系统切换关键帧
      await toggleKeyframeWithCommand(timelineItem.value.id, currentFrame.value)

      // 强制刷新UI状态
      forceRefresh()

      console.log('🎬 [Unified Keyframe UI] Keyframe toggled with command:', {
        itemId: timelineItem.value.id,
        frame: currentFrame.value,
        newState: buttonState.value,
      })
    } catch (error) {
      console.error('🎬 [Unified Keyframe UI] Failed to toggle keyframe:', error)
    }
  }

  /**
   * 处理属性修改
   */
  const handlePropertyChangeWrapper = async (property: string, value: any) => {
    if (!timelineItem.value) return

    // 检查播放头是否在clip时间范围内
    if (!canOperateKeyframes.value) {
      // 使用通知系统显示用户友好的警告
      videoStore.showWarning(
        '无法修改属性',
        '播放头不在当前视频片段的时间范围内。请将播放头移动到片段内再尝试修改属性。',
      )

      console.warn('🎬 [Unified Keyframe UI] 播放头不在当前clip时间范围内，无法操作关键帧属性:', {
        itemId: timelineItem.value.id,
        currentFrame: currentFrame.value,
        property,
        value,
        clipTimeRange: {
          start: timelineItem.value.timeRange.timelineStartTime,
          end: timelineItem.value.timeRange.timelineEndTime,
        },
      })
      return
    }

    try {
      // 使用命令系统处理属性修改
      await updateKeyframePropertyWithCommand(
        timelineItem.value.id,
        currentFrame.value,
        property,
        value,
      )

      // 强制刷新UI状态
      forceRefresh()

      console.log('🎬 [Unified Keyframe UI] Property changed with command:', {
        itemId: timelineItem.value.id,
        frame: currentFrame.value,
        property,
        value,
        buttonState: buttonState.value,
      })
    } catch (error) {
      console.error('🎬 [Unified Keyframe UI] Failed to handle property change:', error)
    }
  }

  /**
   * 跳转到上一个关键帧
   */
  const goToPreviousKeyframe = async () => {
    if (!timelineItem.value) return

    const previousFrame = getPreviousKeyframeFrame(timelineItem.value, currentFrame.value)
    if (previousFrame !== null) {
      await jumpToFrame(previousFrame)
    }
  }

  /**
   * 跳转到下一个关键帧
   */
  const goToNextKeyframe = async () => {
    if (!timelineItem.value) return

    const nextFrame = getNextKeyframeFrame(timelineItem.value, currentFrame.value)
    if (nextFrame !== null) {
      await jumpToFrame(nextFrame)
    }
  }

  /**
   * 清除所有关键帧
   */
  const clearAllKeyframesWrapper = async () => {
    if (!timelineItem.value) return

    try {
      // 使用命令系统清除所有关键帧
      await clearAllKeyframesWithCommand(timelineItem.value.id)

      // 强制刷新UI状态
      forceRefresh()

      console.log('🎬 [Unified Keyframe UI] All keyframes cleared with command:', {
        itemId: timelineItem.value.id,
      })
    } catch (error) {
      console.error('🎬 [Unified Keyframe UI] Failed to clear keyframes:', error)
    }
  }

  /**
   * 更新WebAV动画
   */
  const updateWebAVAnimation = async () => {
    if (!timelineItem.value) return

    try {
      // 动态导入WebAV动画管理器
      const { updateWebAVAnimation: updateAnimation } = await import(
        '../utils/webavAnimationManager'
      )
      await updateAnimation(timelineItem.value)
    } catch (error) {
      console.error('🎬 [Unified Keyframe UI] Failed to update WebAV animation:', error)
    }
  }

  /**
   * 跳转到指定帧
   */
  const jumpToFrame = async (frame: number) => {
    webAVControls.seekTo(frame)
  }

  /**
   * 跳转到指定帧（别名方法）
   */
  const seekToFrame = async (frame: number) => {
    webAVControls.seekTo(frame)
  }

  // ==================== 监听器 ====================

  /**
   * 监听时间轴项目变化，重置状态
   */
  watch(timelineItem, () => {
    forceRefresh()
  })

  /**
   * 监听当前帧变化，更新状态
   */
  watch(currentFrame, () => {
    forceRefresh()
  })

  // ==================== 返回接口 ====================

  return {
    // 状态
    keyframeUIState: readonly(keyframeUIState),
    buttonState: readonly(buttonState),
    hasPreviousKeyframe: readonly(hasPreviousKeyframe),
    hasNextKeyframe: readonly(hasNextKeyframe),
    isPlayheadInClip: readonly(isPlayheadInClip),
    canOperateKeyframes: readonly(canOperateKeyframes),

    // 方法
    toggleKeyframe: toggleKeyframeState,
    handlePropertyChange: handlePropertyChangeWrapper,
    goToPreviousKeyframe,
    goToNextKeyframe,
    clearAllKeyframes: clearAllKeyframesWrapper,
    jumpToFrame,
    seekToFrame,
    forceRefresh,

    // 工具方法
    updateWebAVAnimation,
  }
}

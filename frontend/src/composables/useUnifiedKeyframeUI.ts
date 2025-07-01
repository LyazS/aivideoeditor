/**
 * 统一关键帧UI状态管理 Composable
 * 管理统一关键帧按钮的状态和交互逻辑
 */

import { computed, readonly, type Ref } from 'vue'
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
  updateProperty as updatePropertyWithCommand,
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

  // ==================== 计算属性 ====================

  /**
   * 关键帧UI状态
   */
  const keyframeUIState = computed<KeyframeUIState>(() => {
    if (!timelineItem.value) {
      return { hasAnimation: false, isOnKeyframe: false }
    }

    // 显式访问需要追踪的深层属性，让 Vue 建立依赖关系
    timelineItem.value.animation?.keyframes.length
    timelineItem.value.animation?.isEnabled

    return getKeyframeUIState(timelineItem.value, currentFrame.value)
  })

  /**
   * 关键帧按钮状态
   */
  const buttonState = computed<KeyframeButtonState>(() => {
    if (!timelineItem.value) {
      return 'none'
    }

    // 显式访问需要追踪的深层属性，让 Vue 建立依赖关系
    timelineItem.value.animation?.keyframes.length
    timelineItem.value.animation?.isEnabled

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
      await updatePropertyWithCommand(
        timelineItem.value.id,
        currentFrame.value,
        property,
        value,
      )

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

  /**
   * 批量更新属性（使用现有的命令系统）
   * 🎯 正确方案：利用现有的批量操作架构，而不是重新实现
   */
  const updateUnifiedPropertyBatch = async (properties: Record<string, any>) => {
    if (!timelineItem.value || currentFrame.value == null) return

    try {
      // 动态导入命令系统
      const { UpdatePropertyCommand } = await import('../stores/modules/commands/keyframeCommands')
      const { BatchUpdatePropertiesCommand } = await import('../stores/modules/commands/batchCommands')
      const { useVideoStore } = await import('../stores/videoStore')

      const videoStore = useVideoStore()

      // 创建多个属性更新命令
      const updateCommands = Object.entries(properties).map(([property, value]) => {
        return new UpdatePropertyCommand(
          timelineItem.value!.id,
          currentFrame.value!,
          property,
          value,
          {
            getTimelineItem: videoStore.getTimelineItem
          },
          {
            updateWebAVAnimation: async (item) => {
              const { updateWebAVAnimation } = await import('../utils/webavAnimationManager')
              await updateWebAVAnimation(item)
            }
          },
          webAVControls // 播放头控制器
        )
      })

      // 创建批量命令
      const batchCommand = new BatchUpdatePropertiesCommand(
        [timelineItem.value.id],
        updateCommands
      )

      // 通过历史模块执行批量命令
      await videoStore.executeBatchCommand(batchCommand)

      console.log('🎬 [Unified Keyframe UI] Batch property update completed via command system:', {
        itemId: timelineItem.value.id,
        properties: Object.keys(properties),
        currentFrame: currentFrame.value,
        buttonState: buttonState.value,
        commandCount: updateCommands.length
      })
    } catch (error) {
      console.error('🎬 [Unified Keyframe UI] Failed to batch update properties:', error)
    }
  }

  // ==================== 监听器 ====================

  // 注意：由于计算属性现在正确追踪了响应式依赖，
  // 不再需要手动监听 timelineItem 和 currentFrame 的变化

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
    updateUnifiedPropertyBatch,
    goToPreviousKeyframe,
    goToNextKeyframe,
    clearAllKeyframes: clearAllKeyframesWrapper,
    jumpToFrame,
    seekToFrame,

    // 工具方法
    updateWebAVAnimation,
  }
}

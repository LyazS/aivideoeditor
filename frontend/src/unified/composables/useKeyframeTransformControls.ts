/**
 * 关键帧动画和位置大小变换统一控制器（新架构适配版）
 * 提供关键帧动画、位置、大小、旋转、透明度等变换属性的统一管理
 */

import { computed, type Ref } from 'vue'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { uiDegreesToWebAVRadians, webAVRadiansToUIDegrees } from '@/unified/utils/rotationTransform'
import { useUnifiedKeyframeUI } from '@/unified/composables/useUnifiedKeyframeUI'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem'
import { TimelineItemQueries } from '@/unified/timelineitem'

interface UnifiedKeyframeTransformControlsOptions {
  selectedTimelineItem: Ref<UnifiedTimelineItemData | null>
  currentFrame: Ref<number>
}

/**
 * 关键帧动画和变换控制器（新架构版本）
 */
export function useUnifiedKeyframeTransformControls(
  options: UnifiedKeyframeTransformControlsOptions,
) {
  const { selectedTimelineItem, currentFrame } = options
  const unifiedStore = useUnifiedStore()

  // 统一关键帧UI管理
  const {
    buttonState: unifiedKeyframeButtonState,
    toggleKeyframe: toggleUnifiedKeyframe,
    handlePropertyChange: handleUnifiedPropertyChange,
    updateUnifiedPropertyBatch,
    goToPreviousKeyframe: goToPreviousUnifiedKeyframe,
    goToNextKeyframe: goToNextUnifiedKeyframe,
    hasPreviousKeyframe: hasUnifiedPreviousKeyframe,
    hasNextKeyframe: hasUnifiedNextKeyframe,
    canOperateKeyframes: canOperateUnifiedKeyframes,
  } = useUnifiedKeyframeUI(selectedTimelineItem, currentFrame)

  // ==================== 变换属性计算 ====================

  // 变换属性 - 基于TimelineItem的响应式计算属性（类型安全版本）
  const transformX = computed(() => {
    if (
      !selectedTimelineItem.value ||
      !TimelineItemQueries.hasVisualProperties(selectedTimelineItem.value)
    )
      return 0
    // hasVisualProperties 类型守卫确保了 config 具有视觉属性
    return selectedTimelineItem.value.config.x
  })

  const transformY = computed(() => {
    if (
      !selectedTimelineItem.value ||
      !TimelineItemQueries.hasVisualProperties(selectedTimelineItem.value)
    )
      return 0
    // hasVisualProperties 类型守卫确保了 config 具有视觉属性
    return selectedTimelineItem.value.config.y
  })

  const scaleX = computed(() => {
    if (
      !selectedTimelineItem.value ||
      !TimelineItemQueries.hasVisualProperties(selectedTimelineItem.value)
    )
      return 1

    // hasVisualProperties 类型守卫确保了 config 具有视觉属性
    const config = selectedTimelineItem.value.config
    return config.width / config.originalWidth
  })

  const scaleY = computed(() => {
    if (
      !selectedTimelineItem.value ||
      !TimelineItemQueries.hasVisualProperties(selectedTimelineItem.value)
    )
      return 1

    // hasVisualProperties 类型守卫确保了 config 具有视觉属性
    const config = selectedTimelineItem.value.config
    return config.height / config.originalHeight
  })

  const rotation = computed(() => {
    if (
      !selectedTimelineItem.value ||
      !TimelineItemQueries.hasVisualProperties(selectedTimelineItem.value)
    )
      return 0
    // hasVisualProperties 类型守卫确保了 config 具有视觉属性
    const radians = selectedTimelineItem.value.config.rotation
    return webAVRadiansToUIDegrees(radians)
  })

  const opacity = computed(() => {
    if (
      !selectedTimelineItem.value ||
      !TimelineItemQueries.hasVisualProperties(selectedTimelineItem.value)
    )
      return 1
    // hasVisualProperties 类型守卫确保了 config 具有视觉属性
    return selectedTimelineItem.value.config.opacity
  })

  const zIndex = computed(() => {
    if (!selectedTimelineItem.value) return 0
    return selectedTimelineItem.value.config.zIndex
  })

  // 等比缩放相关（每个clip独立状态）
  const proportionalScale = computed({
    get: () => {
      if (
        !selectedTimelineItem.value ||
        !TimelineItemQueries.hasVisualProperties(selectedTimelineItem.value)
      )
        return true
      // hasVisualProperties 类型守卫确保了 config 具有视觉属性
      return selectedTimelineItem.value.config.proportionalScale
    },
    set: (value) => {
      if (
        !selectedTimelineItem.value ||
        !TimelineItemQueries.hasVisualProperties(selectedTimelineItem.value)
      )
        return
      // hasVisualProperties 类型守卫确保了 config 具有视觉属性
      selectedTimelineItem.value.config.proportionalScale = value
    },
  })

  // 等比缩放相关
  const uniformScale = computed(() => scaleX.value) // 使用X缩放值作为统一缩放值

  // ==================== 关键帧控制方法 ====================

  /**
   * 获取统一关键帧按钮的提示文本
   */
  const getUnifiedKeyframeTooltip = () => {
    // 如果播放头不在clip时间范围内，显示相应提示
    if (!canOperateUnifiedKeyframes.value) {
      return '播放头不在当前clip时间范围内，无法操作关键帧'
    }

    switch (unifiedKeyframeButtonState.value) {
      case 'none':
        return '点击创建关键帧动画'
      case 'on-keyframe':
        return '当前在关键帧位置，点击删除关键帧'
      case 'between-keyframes':
        return '点击在当前位置创建关键帧'
      default:
        return '关键帧控制'
    }
  }

  /**
   * 统一关键帧调试信息
   */
  const debugUnifiedKeyframes = async () => {
    if (!selectedTimelineItem.value) {
      console.log('🎬 [Unified Debug] 没有选中的时间轴项目')
      return
    }

    try {
      const { debugKeyframes } = await import('../utils/unifiedKeyframeUtils')
      debugKeyframes(selectedTimelineItem.value)
    } catch (error) {
      console.error('🎬 [Unified Debug] 调试失败:', error)
    }
  }

  // ==================== 变换更新方法 ====================

  /**
   * 更新变换属性 - 使用带历史记录的方法
   */
  const updateTransform = async (transform?: {
    x?: number
    y?: number
    width?: number
    height?: number
    rotation?: number
    opacity?: number
    zIndex?: number
  }) => {
    if (!selectedTimelineItem.value) return

    // 如果没有提供transform参数，使用当前的响应式值（类型安全版本）
    const finalTransform = transform || {
      x: transformX.value,
      y: transformY.value,
      width: TimelineItemQueries.hasVisualProperties(selectedTimelineItem.value)
        ? selectedTimelineItem.value.config.width
        : 0,
      height: TimelineItemQueries.hasVisualProperties(selectedTimelineItem.value)
        ? selectedTimelineItem.value.config.height
        : 0,
      rotation: rotation.value,
      opacity: opacity.value,
      zIndex: zIndex.value,
    }

    // 统一关键帧系统处理 - 根据当前状态自动处理关键帧创建/更新
    // 注意：updateUnifiedProperty 已经包含了实时渲染更新，所以不需要再调用 updateTimelineItemTransformWithHistory

    // 🎯 特殊处理：如果同时设置了width和height，使用批量更新避免重复位置计算
    if (finalTransform.width !== undefined && finalTransform.height !== undefined) {
      await updateUnifiedPropertyBatch({
        width: finalTransform.width,
        height: finalTransform.height,
      })
    } else {
      // 单独处理尺寸属性
      if (finalTransform.width !== undefined) {
        await updateUnifiedProperty('width', finalTransform.width)
      }
      if (finalTransform.height !== undefined) {
        await updateUnifiedProperty('height', finalTransform.height)
      }
    }

    // 处理其他属性
    if (finalTransform.x !== undefined) {
      await updateUnifiedProperty('x', finalTransform.x)
    }
    if (finalTransform.y !== undefined) {
      await updateUnifiedProperty('y', finalTransform.y)
    }
    if (finalTransform.rotation !== undefined) {
      await updateUnifiedProperty('rotation', finalTransform.rotation)
    }
    if (finalTransform.opacity !== undefined) {
      await updateUnifiedProperty('opacity', finalTransform.opacity)
    }

    // 对于其他属性（如zIndex），仍然使用原来的更新方式
    const otherTransform: any = {}
    if (finalTransform.zIndex !== undefined) {
      otherTransform.zIndex = finalTransform.zIndex
    }

    if (Object.keys(otherTransform).length > 0) {
      // 使用带历史记录的变换属性更新方法（仅用于非关键帧属性）
      await unifiedStore.updateTimelineItemTransformWithHistory(
        selectedTimelineItem.value.id,
        otherTransform,
      )
      console.log('✅ 其他变换属性更新成功')
    }

    console.log('✅ 统一关键帧变换属性更新完成')
  }

  /**
   * 更新属性值（统一关键帧版本）
   * 根据当前状态自动处理关键帧创建，同时确保实时渲染更新
   */
  const updateUnifiedProperty = async (property: string, value: any) => {
    if (!selectedTimelineItem.value) return

    try {
      // 使用统一关键帧处理逻辑（已经包含了正确的WebAV更新流程）
      await handleUnifiedPropertyChange(property, value)

      console.log('🎬 [Unified Property] Property updated via unified keyframe system:', {
        property,
        value,
        buttonState: unifiedKeyframeButtonState.value,
      })
    } catch (error) {
      console.error('🎬 [Unified Property] Failed to update property:', error)
    }
  }

  // ==================== 缩放控制方法 ====================

  /**
   * 切换等比缩放
   */
  const toggleProportionalScale = () => {
    // 先切换状态
    proportionalScale.value = !proportionalScale.value

    // 如果刚刚开启等比缩放，使用当前X缩放值作为统一缩放值，同时更新Y缩放
    if (
      proportionalScale.value &&
      selectedTimelineItem.value &&
      TimelineItemQueries.hasVisualProperties(selectedTimelineItem.value)
    ) {
      // hasVisualProperties 类型守卫确保了 config 具有视觉属性
      const config = selectedTimelineItem.value.config
      const newSize = {
        width: config.originalWidth * scaleX.value,
        height: config.originalHeight * scaleX.value, // 使用X缩放值保持等比
      }
      updateTransform({ width: newSize.width, height: newSize.height })
    }
  }

  /**
   * 更新统一缩放
   */
  const updateUniformScale = (newScale: number) => {
    if (
      proportionalScale.value &&
      selectedTimelineItem.value &&
      TimelineItemQueries.hasVisualProperties(selectedTimelineItem.value)
    ) {
      // hasVisualProperties 类型守卫确保了 config 具有视觉属性
      const config = selectedTimelineItem.value.config
      const newSize = {
        width: config.originalWidth * newScale,
        height: config.originalHeight * newScale,
      }
      updateTransform({ width: newSize.width, height: newSize.height })
    }
  }

  /**
   * 设置X缩放绝对值的方法
   */
  const setScaleX = (value: number) => {
    if (
      !selectedTimelineItem.value ||
      !TimelineItemQueries.hasVisualProperties(selectedTimelineItem.value)
    )
      return

    // hasVisualProperties 类型守卫确保了 config 具有视觉属性
    const config = selectedTimelineItem.value.config
    const newScaleX = Math.max(0.01, Math.min(5, value))
    const newSize = {
      width: config.originalWidth * newScaleX,
      height: config.height, // 保持Y尺寸不变
    }
    updateTransform({ width: newSize.width, height: newSize.height })
  }

  /**
   * 设置Y缩放绝对值的方法
   */
  const setScaleY = (value: number) => {
    if (
      !selectedTimelineItem.value ||
      !TimelineItemQueries.hasVisualProperties(selectedTimelineItem.value)
    )
      return

    // hasVisualProperties 类型守卫确保了 config 具有视觉属性
    const config = selectedTimelineItem.value.config
    const newScaleY = Math.max(0.01, Math.min(5, value))
    const newSize = {
      width: config.width, // 保持X尺寸不变
      height: config.originalHeight * newScaleY,
    }
    updateTransform({ width: newSize.width, height: newSize.height })
  }

  /**
   * 设置旋转绝对值的方法（输入角度，转换为弧度）
   */
  const setRotation = (value: number) => {
    const newRotationRadians = uiDegreesToWebAVRadians(value)
    updateTransform({ rotation: newRotationRadians })
  }

  /**
   * 设置透明度绝对值的方法
   */
  const setOpacity = (value: number) => {
    const newOpacity = Math.max(0, Math.min(1, value))
    updateTransform({ opacity: newOpacity })
  }

  // ==================== 对齐控制方法 ====================

  /**
   * 实现对齐功能（基于项目坐标系：中心为原点）
   */
  const alignHorizontal = (alignment: 'left' | 'center' | 'right') => {
    if (!selectedTimelineItem.value || !selectedTimelineItem.value.runtime.sprite) return

    const sprite = selectedTimelineItem.value.runtime.sprite
    const canvasWidth = unifiedStore.videoResolution.width
    const spriteWidth = sprite.rect.w || canvasWidth

    try {
      let newProjectX = 0
      switch (alignment) {
        case 'left':
          // 左对齐：sprite左边缘贴画布左边缘
          newProjectX = -canvasWidth / 2 + spriteWidth / 2
          break
        case 'center':
          // 居中：sprite中心对齐画布中心
          newProjectX = 0
          break
        case 'right':
          // 右对齐：sprite右边缘贴画布右边缘
          newProjectX = canvasWidth / 2 - spriteWidth / 2
          break
      }

      updateTransform({ x: Math.round(newProjectX) })

      console.log('✅ 水平对齐完成:', alignment, '项目坐标X:', Math.round(newProjectX))
    } catch (error) {
      console.error('水平对齐失败:', error)
    }
  }

  const alignVertical = (alignment: 'top' | 'middle' | 'bottom') => {
    if (!selectedTimelineItem.value) return

    const sprite = selectedTimelineItem.value.runtime.sprite!
    const canvasHeight = unifiedStore.videoResolution.height
    const spriteHeight = sprite.rect.h || canvasHeight

    try {
      let newProjectY = 0
      switch (alignment) {
        case 'top':
          // 顶对齐：sprite上边缘贴画布上边缘
          newProjectY = -canvasHeight / 2 + spriteHeight / 2
          break
        case 'middle':
          // 居中：sprite中心对齐画布中心
          newProjectY = 0
          break
        case 'bottom':
          // 底对齐：sprite下边缘贴画布下边缘
          newProjectY = canvasHeight / 2 - spriteHeight / 2
          break
      }

      updateTransform({ y: Math.round(newProjectY) })

      console.log('✅ 垂直对齐完成:', alignment, '项目坐标Y:', Math.round(newProjectY))
    } catch (error) {
      console.error('垂直对齐失败:', error)
    }
  }

  return {
    // 关键帧状态
    unifiedKeyframeButtonState,
    canOperateUnifiedKeyframes,
    hasUnifiedPreviousKeyframe,
    hasUnifiedNextKeyframe,

    // 变换属性
    transformX,
    transformY,
    scaleX,
    scaleY,
    rotation,
    opacity,
    zIndex,
    proportionalScale,
    uniformScale,

    // 关键帧控制方法
    toggleUnifiedKeyframe,
    goToPreviousUnifiedKeyframe,
    goToNextUnifiedKeyframe,
    getUnifiedKeyframeTooltip,
    debugUnifiedKeyframes,

    // 变换更新方法
    updateTransform,
    updateUnifiedProperty,
    updateUnifiedPropertyBatch,

    // 缩放控制方法
    toggleProportionalScale,
    updateUniformScale,
    setScaleX,
    setScaleY,

    // 旋转和透明度控制方法
    setRotation,
    setOpacity,

    // 对齐控制方法
    alignHorizontal,
    alignVertical,
  }
}

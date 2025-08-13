<template>
  <div class="video-clip-properties">
    <!-- 基本信息 -->
    <div class="property-section">
      <h4>基本信息</h4>
      <div class="property-item">
        <label>名称</label>
        <input
          v-model="clipName"
          @blur="updateClipName"
          @keyup.enter="updateClipName"
          class="property-input"
        />
      </div>
      <!-- 分辨率显示 -->
      <div class="property-item">
        <label>分辨率</label>
        <div class="resolution-display">
          {{ currentResolution.width }} × {{ currentResolution.height }}
        </div>
      </div>
    </div>

    <!-- 播放设置 - 视频和图片都显示 -->
    <div
      v-if="selectedTimelineItem && hasVisualProperties(selectedTimelineItem)"
      class="property-section"
    >
      <h4>播放设置</h4>

      <!-- 精确时长控制 -->
      <div class="property-item">
        <label>目标时长</label>
        <div class="duration-controls">
          <input
            type="text"
            v-model="timecodeInput"
            @blur="updateTargetDurationFromTimecode"
            @keyup.enter="updateTargetDurationFromTimecode"
            placeholder="HH:MM:SS.FF"
            :style="propertyInputStyle"
            class="timecode-input"
          />
        </div>
      </div>

      <!-- 倍速控制 - 仅对视频显示 -->
      <div v-if="selectedTimelineItem && isVideoTimelineItem(selectedTimelineItem)" class="property-item">
        <label>倍速</label>
        <div class="speed-controls">
          <!-- 分段倍速滑块 -->
          <SliderInput
            :model-value="normalizedSpeed"
            @input="updateNormalizedSpeed"
            :min="0"
            :max="100"
            :step="1"
            slider-class="segmented-speed-slider"
            :segments="speedSliderSegments"
          />
          <NumberInput
            :model-value="speedInputValue"
            @change="updateSpeedFromInput"
            :min="0.1"
            :max="100"
            :step="0.1"
            :precision="1"
            :show-controls="false"
            placeholder="倍速"
            :input-style="speedInputStyle"
          />
        </div>
      </div>

      <!-- 音量控制 - 仅对视频显示 -->
      <div v-if="selectedTimelineItem && isVideoTimelineItem(selectedTimelineItem)" class="property-item">
        <label>音量</label>
        <div class="volume-controls">
          <SliderInput
            :model-value="volume"
            @input="updateVolume"
            :min="0"
            :max="1"
            :step="0.01"
            slider-class="volume-slider"
          />
          <NumberInput
            :model-value="volume"
            @change="updateVolume"
            :min="0"
            :max="1"
            :step="0.01"
            :precision="2"
            :show-controls="false"
            placeholder="音量"
            :input-style="speedInputStyle"
          />
          <button
            @click="toggleMute"
            class="mute-btn"
            :class="{ muted: isMuted }"
            :title="isMuted ? '取消静音' : '静音'"
          >
            <svg v-if="!isMuted" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M3,9V15H7L12,20V4L7,9H3M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23Z"
              />
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 关键帧控制 -->
    <UnifiedKeyframeControls
      :keyframe-button-state="unifiedKeyframeButtonState"
      :can-operate-keyframes="canOperateUnifiedKeyframes"
      :has-previous-keyframe="hasUnifiedPreviousKeyframe"
      :has-next-keyframe="hasUnifiedNextKeyframe"
      :keyframe-tooltip="getUnifiedKeyframeTooltip()"
      :show-debug-button="true"
      @toggle-keyframe="toggleUnifiedKeyframe"
      @go-to-previous="goToPreviousUnifiedKeyframe"
      @go-to-next="goToNextUnifiedKeyframe"
      @debug-keyframes="debugUnifiedKeyframes"
    />

    <!-- 变换控制 -->
    <UnifiedTransformControls
      :transform-x="transformX"
      :transform-y="transformY"
      :scale-x="scaleX"
      :scale-y="scaleY"
      :rotation="rotation"
      :opacity="opacity"
      :z-index="zIndex"
      :proportional-scale="proportionalScale"
      :uniform-scale="uniformScale"
      :position-limits="{
        minX: -unifiedStore.videoResolution.width,
        maxX: unifiedStore.videoResolution.width,
        minY: -unifiedStore.videoResolution.height,
        maxY: unifiedStore.videoResolution.height,
      }"
      @update-transform="updateTransform"
      @toggle-proportional-scale="toggleProportionalScale"
      @update-uniform-scale="updateUniformScale"
      @set-scale-x="setScaleX"
      @set-scale-y="setScaleY"
      @set-rotation="setRotation"
      @set-opacity="setOpacity"
      @align-horizontal="alignHorizontal"
      @align-vertical="alignVertical"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUnifiedStore } from '@/unified/unifiedStore'
import {
  isVideoTimelineItem,
  isImageTimelineItem,
  hasVisualProperties,
  hasAudioProperties,
} from '@/unified/timelineitem/TimelineItemQueries'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import { framesToTimecode, timecodeToFrames } from '@/unified/utils/timeUtils'
import { useUnifiedKeyframeTransformControls } from '@/unified/composables'
import NumberInput from '@/components/NumberInput.vue'
import SliderInput from '@/components/SliderInput.vue'
import UnifiedKeyframeControls from './UnifiedKeyframeControls.vue'
import UnifiedTransformControls from './UnifiedTransformControls.vue'

interface Props {
  selectedTimelineItem: UnifiedTimelineItemData | null
  currentFrame: number
}

const props = defineProps<Props>()

const unifiedStore = useUnifiedStore()

// 关键帧动画和变换控制器
const {
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
} = useUnifiedKeyframeTransformControls({
  selectedTimelineItem: computed(() => props.selectedTimelineItem),
  currentFrame: computed(() => props.currentFrame),
})

// 选中项目对应的素材
const selectedMediaItem = computed(() => {
  if (!props.selectedTimelineItem) return null
  return unifiedStore.getMediaItem(props.selectedTimelineItem.mediaItemId) || null
})

// 时间轴时长（帧数）
const timelineDurationFrames = computed(() => {
  if (!props.selectedTimelineItem) return 0
  const timeRange = props.selectedTimelineItem.timeRange
  // 确保返回整数帧数，避免浮点数精度问题
  return Math.round(timeRange.timelineEndTime - timeRange.timelineStartTime)
})

// 格式化时长显示（使用时间码格式）
const formattedDuration = computed(() => {
  return framesToTimecode(timelineDurationFrames.value)
})

// 时间码输入框的临时值
const timecodeInput = computed({
  get: () => formattedDuration.value,
  set: () => {
    // 这里不做任何操作，只在失焦或回车时更新
  },
})

// 倍速分段配置
const speedSegments = [
  { min: 0.1, max: 1, normalizedStart: 0, normalizedEnd: 20 }, // 0-20%: 0.1-1x
  { min: 1, max: 2, normalizedStart: 20, normalizedEnd: 40 }, // 20-40%: 1-2x
  { min: 2, max: 5, normalizedStart: 40, normalizedEnd: 60 }, // 40-60%: 2-5x
  { min: 5, max: 10, normalizedStart: 60, normalizedEnd: 80 }, // 60-80%: 5-10x
  { min: 10, max: 100, normalizedStart: 80, normalizedEnd: 100 }, // 80-100%: 10-100x
]

// 分辨率相关 - 显示当前选中视频缩放后的分辨率
const currentResolution = computed(() => {
  if (!props.selectedTimelineItem) {
    return { width: 0, height: 0 }
  }
  // 直接使用TimelineItem中的width/height属性，这是缩放后的实际尺寸（类型安全版本）
  if (!hasVisualProperties(props.selectedTimelineItem)) {
    return { width: 0, height: 0 }
  }

  // 类型安全的配置访问 - 使用类型守卫确保属性存在
  const config = props.selectedTimelineItem.config
  return {
    width: Math.round(config.width),
    height: Math.round(config.height),
  }
})

// 其他响应式属性
const clipName = computed({
  get: () => selectedMediaItem.value?.name || '',
  set: (value) => {
    if (selectedMediaItem.value && value.trim()) {
      unifiedStore.updateMediaItemName(selectedMediaItem.value.id, value.trim())
    }
  },
})

const playbackRate = computed(() => {
  if (!props.selectedTimelineItem) return 1

  // 图片类型没有播放速度概念，返回1
  if (isImageTimelineItem(props.selectedTimelineItem)) {
    return 1
  }

  // 对于视频类型，从timeRange计算播放速度以确保响应性
  if (isVideoTimelineItem(props.selectedTimelineItem)) {
    const timeRange = props.selectedTimelineItem.timeRange
    const clipDurationFrames = timeRange.clipEndTime - timeRange.clipStartTime // 素材内部要播放的帧数
    const timelineDurationFrames = timeRange.timelineEndTime - timeRange.timelineStartTime // 在时间轴上占用的帧数

    if (clipDurationFrames > 0 && timelineDurationFrames > 0) {
      // playbackRate = 素材内部时长 / 时间轴时长
      let playbackRate = clipDurationFrames / timelineDurationFrames

      // 修正浮点数精度问题，避免出现1.00000001这样的值
      // 如果非常接近整数，则四舍五入到最近的0.1
      const rounded = Math.round(playbackRate * 10) / 10
      if (Math.abs(playbackRate - rounded) < 0.001) {
        playbackRate = rounded
      }

      return playbackRate
    }
  }

  return 1
})

const normalizedSpeed = computed(() => {
  return speedToNormalized(playbackRate.value)
})

const speedInputValue = computed(() => playbackRate.value)

// 倍速滑块分段标记（用于SliderInput组件）
const speedSliderSegments = [
  { position: 20, label: '1x' },
  { position: 40, label: '2x' },
  { position: 60, label: '5x' },
  { position: 80, label: '10x' },
]

// 音量相关 - 直接从TimelineItem读取，这是响应式的
const volume = computed(() => {
  if (!props.selectedTimelineItem || !isVideoTimelineItem(props.selectedTimelineItem)) return 1
  // 确保 volume 和 isMuted 都有默认值（类型安全版本）
  if (!hasAudioProperties(props.selectedTimelineItem)) return 1

  // 类型安全的配置访问
  const config = props.selectedTimelineItem.config
  const itemVolume = config.volume ?? 1
  const itemMuted = config.isMuted ?? false
  // 静音时显示0，否则显示实际音量
  return itemMuted ? 0 : itemVolume
})

const isMuted = computed(() => {
  if (!props.selectedTimelineItem || !hasAudioProperties(props.selectedTimelineItem)) return false

  // 类型安全的配置访问
  const config = props.selectedTimelineItem.config
  return config.isMuted ?? false
})

// NumberInput 样式定义
const propertyInputStyle = {
  maxWidth: '120px',
  textAlign: 'center' as const,
}

const speedInputStyle = {
  maxWidth: '60px',
  textAlign: 'center' as const,
}

// 更新片段名称
const updateClipName = () => {
  if (selectedMediaItem.value && clipName.value.trim()) {
    unifiedStore.updateMediaItemName(selectedMediaItem.value.id, clipName.value.trim())
  }
}

// 更新播放速度（仅对视频有效）- 使用带历史记录的方法
const updatePlaybackRate = async (newRate?: number) => {
  if (props.selectedTimelineItem && isVideoTimelineItem(props.selectedTimelineItem)) {
    const rate = newRate || playbackRate.value

    // 使用带历史记录的变换属性更新方法
    await unifiedStore.updateTimelineItemTransformWithHistory(props.selectedTimelineItem.id, {
      playbackRate: rate,
    })
    console.log('✅ 倍速更新成功')
  }
}

// 更新目标时长（从时间码输入）
const updateTargetDurationFromTimecode = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const timecodeValue = input.value.trim()

  if (!timecodeValue || !props.selectedTimelineItem || !selectedMediaItem.value) {
    // 如果输入为空，恢复到当前值
    input.value = formattedDuration.value
    return
  }

  try {
    // 解析时间码为帧数
    const newDurationFrames = timecodeToFrames(timecodeValue)
    const alignedDurationFrames = Math.max(1, newDurationFrames) // 最少1帧

    // 更新时长
    await updateTargetDurationFrames(alignedDurationFrames)

    console.log('✅ 时间码时长更新成功:', {
      inputTimecode: timecodeValue,
      parsedFrames: newDurationFrames,
      alignedFrames: alignedDurationFrames,
      finalTimecode: framesToTimecode(alignedDurationFrames),
    })
  } catch (error) {
    console.warn('⚠️ 时间码格式无效:', timecodeValue, error)

    // 根据错误类型提供具体的错误信息
    let errorMessage = '请使用正确的时间码格式：HH:MM:SS.FF'
    const errorStr = error instanceof Error ? error.message : String(error)

    if (errorStr.includes('Invalid timecode format')) {
      // 格式错误
      errorMessage = `格式错误：请使用 HH:MM:SS.FF 格式
示例：00:01:30.15（1分30秒15帧）
当前输入：${timecodeValue}`
    } else if (errorStr.includes('Invalid timecode values')) {
      // 数值范围错误
      errorMessage = `数值超出范围：
• 分钟和秒数应小于60
• 帧数应小于30（30fps）
当前输入：${timecodeValue}`
    } else {
      // 其他错误
      errorMessage = `时间码解析失败
请检查格式：HH:MM:SS.FF
当前输入：${timecodeValue}`
    }

    // 显示错误通知
    unifiedStore.showError(
      '时间码格式错误',
      errorMessage,
      8000, // 显示8秒，给用户足够时间阅读
    )

    // 恢复到当前值
    input.value = formattedDuration.value
  }
}

// 更新目标时长（帧数版本）
const updateTargetDurationFrames = async (newDurationFrames: number) => {
  if (!props.selectedTimelineItem || !selectedMediaItem.value) {
    return
  }

  const alignedDurationFrames = Math.max(1, newDurationFrames) // 最少1帧
  const sprite = props.selectedTimelineItem.runtime.sprite!
  const timeRange = props.selectedTimelineItem.timeRange
  const oldDurationFrames = timeRange.timelineEndTime - timeRange.timelineStartTime // 计算旧时长
  const newTimelineEndTime = timeRange.timelineStartTime + alignedDurationFrames // 帧数相加，不需要转换

  // 🎯 关键帧位置调整：在更新timeRange之前调整关键帧位置
  if (
    props.selectedTimelineItem.animation &&
    props.selectedTimelineItem.animation.keyframes.length > 0
  ) {
    const { adjustKeyframesForDurationChange } = await import('@/unified/utils/unifiedKeyframeUtils')
    adjustKeyframesForDurationChange(
      props.selectedTimelineItem,
      oldDurationFrames,
      alignedDurationFrames,
    )
    console.log('🎬 [Duration Update] Keyframes adjusted for duration change:', {
      oldDuration: oldDurationFrames,
      newDuration: alignedDurationFrames,
    })
  }

  if (isVideoTimelineItem(props.selectedTimelineItem)) {
    if (isVideoTimelineItem(props.selectedTimelineItem) && 'clipStartTime' in timeRange) {
      sprite.setTimeRange({
        clipStartTime: timeRange.clipStartTime,
        clipEndTime: timeRange.clipEndTime,
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: newTimelineEndTime,
      })
    }
  } else if (isImageTimelineItem(props.selectedTimelineItem)) {
    sprite.setTimeRange({
      timelineStartTime: timeRange.timelineStartTime,
      timelineEndTime: newTimelineEndTime,
    })
  }

  // 更新timelineItem的timeRange（使用专用工具函数）
  if (props.selectedTimelineItem) {
    const { syncTimeRange } = await import('@/unified/utils/timeRangeUtils')
    syncTimeRange(props.selectedTimelineItem)
  }

  // 如果有动画，需要重新设置WebAV动画时长
  if (props.selectedTimelineItem.animation && props.selectedTimelineItem.animation.isEnabled) {
    const { updateWebAVAnimation } = await import('@/unified/utils/webavAnimationManager')
    await updateWebAVAnimation(props.selectedTimelineItem)
    console.log('🎬 [Duration Update] Animation duration updated after clip duration change')
  }

  console.log('✅ 帧数时长更新成功:', {
    inputFrames: newDurationFrames,
    alignedFrames: alignedDurationFrames,
    timecode: framesToTimecode(alignedDurationFrames),
  })
}

// 更新归一化速度
const updateNormalizedSpeed = (newNormalizedSpeed: number) => {
  const actualSpeed = normalizedToSpeed(newNormalizedSpeed)
  updatePlaybackRate(actualSpeed)
}

// 从输入框更新倍速
const updateSpeedFromInput = (newSpeed: number) => {
  if (newSpeed && newSpeed > 0) {
    // 确保倍速在合理范围内
    const clampedSpeed = Math.max(0.1, Math.min(100, newSpeed))
    updatePlaybackRate(clampedSpeed)
  }
}

// 更新音量
const updateVolume = (newVolume: number) => {
  if (!props.selectedTimelineItem || !isVideoTimelineItem(props.selectedTimelineItem)) return

  const clampedVolume = Math.max(0, Math.min(1, newVolume))

  // 确保属性存在，如果不存在则初始化（类型安全版本）
  if (!hasAudioProperties(props.selectedTimelineItem)) return

  // 📝 数据流向说明：
  // volume 和 isMuted 属性属于【非动画属性】，WebAV不支持这些属性的propsChange事件
  // 因此无法遵循标准的 UI → WebAV → TimelineItem → UI 数据流向
  // 这里直接修改config是技术限制导致的必要妥协，不是架构设计缺陷
  const config = props.selectedTimelineItem.config

  // 类型安全的属性初始化和访问
  if (config.volume === undefined) {
    config.volume = 1
  }
  if (config.isMuted === undefined) {
    config.isMuted = false
  }

  // 使用历史记录系统更新音量
  if (clampedVolume === 0) {
    // 设为静音，但保留原音量值
    unifiedStore.updateTimelineItemTransformWithHistory(props.selectedTimelineItem.id, {
      isMuted: true,
    })
  } else {
    // 更新音量值并取消静音
    unifiedStore.updateTimelineItemTransformWithHistory(props.selectedTimelineItem.id, {
      volume: clampedVolume,
      isMuted: false,
    })
  }

  console.log('✅ 音量更新成功:', clampedVolume)
}

// 切换静音状态（类型安全版本）
const toggleMute = () => {
  if (!props.selectedTimelineItem || !hasAudioProperties(props.selectedTimelineItem)) return

  // 📝 数据流向说明：
  // volume 和 isMuted 属性属于【非动画属性】，WebAV不支持这些属性的propsChange事件
  // 因此无法遵循标准的 UI → WebAV → TimelineItem → UI 数据流向
  // 这里直接修改config是技术限制导致的必要妥协，不是架构设计缺陷
  const config = props.selectedTimelineItem.config

  // 类型安全的属性访问和初始化
  if (config.volume === undefined) {
    config.volume = 1
  }
  if (config.isMuted === undefined) {
    config.isMuted = false
  }

  const newMutedState = !config.isMuted

  // 使用历史记录系统切换静音状态
  unifiedStore.updateTimelineItemTransformWithHistory(props.selectedTimelineItem.id, {
    isMuted: newMutedState,
  })

  console.log('✅ 静音状态切换:', newMutedState ? '静音' : '有声', '音量保持:', config.volume)
}

// 将归一化值(0-100)转换为实际播放速度
const normalizedToSpeed = (normalized: number) => {
  // 找到对应的段
  for (const segment of speedSegments) {
    if (normalized >= segment.normalizedStart && normalized <= segment.normalizedEnd) {
      // 在段内进行线性插值
      const segmentProgress =
        (normalized - segment.normalizedStart) / (segment.normalizedEnd - segment.normalizedStart)
      return segment.min + segmentProgress * (segment.max - segment.min)
    }
  }
  return 1 // 默认值
}

// 将实际播放速度转换为归一化值(0-100)
const speedToNormalized = (speed: number) => {
  // 找到对应的段
  for (const segment of speedSegments) {
    if (speed >= segment.min && speed <= segment.max) {
      // 在段内进行线性插值
      const segmentProgress = (speed - segment.min) / (segment.max - segment.min)
      return (
        segment.normalizedStart +
        segmentProgress * (segment.normalizedEnd - segment.normalizedStart)
      )
    }
  }
  return 20 // 默认值对应1x
}
</script>

<style scoped>
.video-clip-properties {
  width: 100%;
}

/* 使用全局样式 styles/components/panels.css 和 styles/components/inputs.css 中定义的样式 */

/* 时长控制样式 */
.duration-controls {
  display: flex;
  align-items: center;
  flex: 1;
}

.timecode-input::placeholder {
  color: var(--color-text-hint);
  font-style: italic;
}

/* 倍速控制样式 */
.speed-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
}

/* 分段倍速滑块容器 */
.segmented-speed-container {
  position: relative;
  flex: 1;
  height: 40px;
  display: flex;
  align-items: center;
}

/* 音量控制样式 */
.volume-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
}

.mute-btn {
  background: var(--color-bg-quaternary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-small);
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xs);
  transition: all 0.2s ease;
  min-width: 32px;
  height: 32px;
}

.mute-btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-focus);
}

.mute-btn.muted {
  background: var(--color-accent-secondary);
  color: var(--color-bg-primary);
}

/* 分辨率显示样式已迁移到 styles/components/inputs.css */

/* 注意：property-item, property-section, section-header 样式已在全局样式 styles/components/panels.css 中定义 */
</style>
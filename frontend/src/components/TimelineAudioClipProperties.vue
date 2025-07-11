<template>
  <div class="audio-clip-properties">
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
    </div>

    <!-- 播放设置 -->
    <div class="property-section">
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

      <!-- 倍速控制 -->
      <div class="property-item">
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

      <!-- 音量控制 -->
      <div class="property-item">
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
            :input-style="volumeInputStyle"
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

      <!-- 增益控制 -->
      <div class="property-item">
        <label>增益 (dB)</label>
        <div class="gain-controls">
          <SliderInput
            :model-value="gain"
            @input="updateGain"
            :min="-20"
            :max="20"
            :step="0.1"
            slider-class="gain-slider"
          />
          <NumberInput
            :model-value="gain"
            @change="updateGain"
            :min="-20"
            :max="20"
            :step="0.1"
            :precision="1"
            :show-controls="false"
            placeholder="增益"
            :input-style="gainInputStyle"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { isVideoTimeRange } from '../types'
import { framesToTimecode, timecodeToFrames } from '../stores/utils/timeUtils'
import NumberInput from './NumberInput.vue'
import SliderInput from './SliderInput.vue'
import type { LocalTimelineItem } from '../types'

interface Props {
  selectedTimelineItem: LocalTimelineItem<'audio'> | null
  currentFrame: number
}

const props = defineProps<Props>()

const videoStore = useVideoStore()

// 选中项目对应的素材
const selectedMediaItem = computed(() => {
  if (!props.selectedTimelineItem) return null
  return videoStore.getMediaItem(props.selectedTimelineItem.mediaItemId) || null
})

// 时间轴时长（帧数）
const timelineDurationFrames = computed(() => {
  if (!props.selectedTimelineItem) return 0
  const timeRange = props.selectedTimelineItem.timeRange
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

// 其他响应式属性
const clipName = computed({
  get: () => selectedMediaItem.value?.name || '',
  set: (value) => {
    if (selectedMediaItem.value && value.trim()) {
      videoStore.updateMediaItemName(selectedMediaItem.value.id, value.trim())
    }
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

// 倍速相关
const playbackRate = computed(() => {
  if (!props.selectedTimelineItem) return 1

  // 直接从TimeRange中获取播放速度属性
  const timeRange = props.selectedTimelineItem.timeRange
  return isVideoTimeRange(timeRange) ? timeRange.playbackRate || 1 : 1
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
  { position: 80, label: '10x' }
]

// 倍速输入框样式
const speedInputStyle = computed(() => ({
  width: '60px',
  textAlign: 'center' as const,
}))

// 音量相关 - 直接从TimelineItem读取，这是响应式的
const volume = computed(() => {
  if (!props.selectedTimelineItem || !hasAudioProps(props.selectedTimelineItem)) return 1
  const itemVolume = props.selectedTimelineItem.config.volume ?? 1
  const itemMuted = props.selectedTimelineItem.config.isMuted ?? false
  // 静音时显示0，否则显示实际音量
  return itemMuted ? 0 : itemVolume
})

const isMuted = computed(() => {
  if (!props.selectedTimelineItem || !hasAudioProps(props.selectedTimelineItem)) return false
  return props.selectedTimelineItem.config.isMuted ?? false
})

// 增益控制
const gain = computed(() => {
  if (!props.selectedTimelineItem) return 0
  return props.selectedTimelineItem.config.gain ?? 0
})

// NumberInput 样式定义
const propertyInputStyle = {
  maxWidth: '120px',
  textAlign: 'center' as const,
}

const volumeInputStyle = {
  maxWidth: '60px',
  textAlign: 'center' as const,
}

const gainInputStyle = {
  maxWidth: '60px',
  textAlign: 'center' as const,
}

// 更新片段名称
const updateClipName = () => {
  if (selectedMediaItem.value && clipName.value.trim()) {
    videoStore.updateMediaItemName(selectedMediaItem.value.id, clipName.value.trim())
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

    console.log('✅ 音频时间码时长更新成功:', {
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
      errorMessage = `格式错误：请使用 HH:MM:SS.FF 格式
示例：00:01:30.15（1分30秒15帧）
当前输入：${timecodeValue}`
    } else if (errorStr.includes('Invalid timecode values')) {
      errorMessage = `数值超出范围：
• 分钟和秒数应小于60
• 帧数应小于30（30fps）
当前输入：${timecodeValue}`
    } else {
      errorMessage = `时间码解析失败
请检查格式：HH:MM:SS.FF
当前输入：${timecodeValue}`
    }

    // 显示错误通知
    videoStore.showError(
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
  const sprite = props.selectedTimelineItem.sprite
  const timeRange = props.selectedTimelineItem.timeRange
  const newTimelineEndTime = timeRange.timelineStartTime + alignedDurationFrames

  // 音频使用与视频相同的时间范围结构
  if (isVideoTimeRange(timeRange)) {
    sprite.setTimeRange({
      clipStartTime: timeRange.clipStartTime,
      clipEndTime: timeRange.clipEndTime,
      timelineStartTime: timeRange.timelineStartTime,
      timelineEndTime: newTimelineEndTime,
    })
  }

  // 更新timelineItem的timeRange（音频使用VideoTimeRange）
  const newTimeRange = sprite.getTimeRange()
  if (isVideoTimeRange(newTimeRange)) {
    props.selectedTimelineItem.timeRange = newTimeRange
  }

  console.log('✅ 音频帧数时长更新成功:', {
    inputFrames: newDurationFrames,
    alignedFrames: alignedDurationFrames,
    timecode: framesToTimecode(alignedDurationFrames),
  })
}

// 更新音量
const updateVolume = (newVolume: number) => {
  if (!props.selectedTimelineItem || !hasAudioProps(props.selectedTimelineItem)) return

  const clampedVolume = Math.max(0, Math.min(1, newVolume))

  // 确保属性存在，如果不存在则初始化
  if (props.selectedTimelineItem.config.volume === undefined) {
    props.selectedTimelineItem.config.volume = 1
  }
  if (props.selectedTimelineItem.config.isMuted === undefined) {
    props.selectedTimelineItem.config.isMuted = false
  }

  // 使用历史记录系统更新音量
  if (clampedVolume === 0) {
    // 设为静音，但保留原音量值
    videoStore.updateTimelineItemTransformWithHistory(props.selectedTimelineItem.id, {
      isMuted: true,
    })
  } else {
    // 更新音量值并取消静音
    videoStore.updateTimelineItemTransformWithHistory(props.selectedTimelineItem.id, {
      volume: clampedVolume,
      isMuted: false,
    })
  }

  console.log('✅ 音频音量更新成功:', clampedVolume)
}

// 切换静音状态
const toggleMute = () => {
  if (!props.selectedTimelineItem || !hasAudioProps(props.selectedTimelineItem)) return

  // 确保属性存在，如果不存在则初始化
  if (props.selectedTimelineItem.config.volume === undefined) {
    props.selectedTimelineItem.config.volume = 1
  }
  if (props.selectedTimelineItem.config.isMuted === undefined) {
    props.selectedTimelineItem.config.isMuted = false
  }

  const newMutedState = !props.selectedTimelineItem.config.isMuted

  // 使用历史记录系统切换静音状态
  videoStore.updateTimelineItemTransformWithHistory(props.selectedTimelineItem.id, {
    isMuted: newMutedState,
  })

  console.log(
    '✅ 音频静音状态切换:',
    newMutedState ? '静音' : '有声',
    '音量保持:',
    props.selectedTimelineItem.config.volume,
  )
}

// 更新增益
const updateGain = (newGain: number) => {
  if (!props.selectedTimelineItem) return

  const clampedGain = Math.max(-20, Math.min(20, newGain))

  // 使用历史记录系统更新增益
  videoStore.updateTimelineItemTransformWithHistory(props.selectedTimelineItem.id, {
    gain: clampedGain,
  })

  console.log('✅ 音频增益更新成功:', clampedGain, 'dB')
}

// 更新播放速度 - 使用带历史记录的方法
const updatePlaybackRate = async (newRate?: number) => {
  if (props.selectedTimelineItem) {
    const rate = newRate || playbackRate.value

    try {
      // 使用带历史记录的变换属性更新方法
      await videoStore.updateTimelineItemTransformWithHistory(props.selectedTimelineItem.id, {
        playbackRate: rate,
      })
      console.log('✅ 音频倍速更新成功')
    } catch (error) {
      console.error('❌ 更新音频倍速失败:', error)
      // 如果历史记录更新失败，回退到直接更新
      videoStore.updateTimelineItemPlaybackRate(props.selectedTimelineItem.id, rate)
    }
  }
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
.audio-clip-properties {
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

/* 增益控制样式 */
.gain-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
}
</style>

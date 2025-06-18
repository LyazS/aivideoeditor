<template>
  <div class="properties-panel">
    <div class="panel-header">
      <h3>属性</h3>
    </div>

    <div class="panel-content">
      <div v-if="!selectedTimelineItem" class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,16.5L18,9.5L16.5,8L11,13.5L7.5,10L6,11.5L11,16.5Z"
          />
        </svg>
        <p>选择片段查看属性</p>
        <p class="hint">在时间轴上点击视频片段</p>
      </div>

      <div v-else class="properties-content">
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

        <!-- 播放设置 - 视频和图片都显示 -->
        <div v-if="selectedTimelineItem?.mediaType === 'video' || selectedTimelineItem?.mediaType === 'image'" class="property-section">
          <h4>播放设置</h4>

          <!-- 精确时长控制 -->
          <div class="property-item">
            <label>目标时长</label>
            <div class="duration-controls">
              <NumberInput
                :model-value="targetDuration"
                @change="updateTargetDuration"
                :min="0.1"
                :step="0.1"
                :precision="1"
                :show-controls="false"
                placeholder="秒"
                :input-style="propertyInputStyle"
              />
              <span class="duration-unit">秒</span>
            </div>
          </div>

          <!-- 倍速控制 - 仅对视频显示 -->
          <div v-if="selectedTimelineItem?.mediaType === 'video'" class="property-item">
            <label>倍速</label>
            <div class="speed-controls">
              <!-- 分段倍速滑块 -->
              <div class="segmented-speed-container">
                <input
                  :value="normalizedSpeed"
                  @input="
                    (e) => updateNormalizedSpeed((e.target as HTMLInputElement).valueAsNumber)
                  "
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  class="segmented-speed-slider"
                />
                <!-- 分段竖线 -->
                <div class="speed-dividers">
                  <div class="speed-divider" style="left: 20%"></div>
                  <div class="speed-divider" style="left: 40%"></div>
                  <div class="speed-divider" style="left: 60%"></div>
                  <div class="speed-divider" style="left: 80%"></div>
                </div>
              </div>
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
        </div>

        <!-- 位置大小 -->
        <div class="property-section">
          <h4>位置大小</h4>
          <!-- 位置：XY在同一行 -->
          <div class="property-item">
            <label>位置</label>
            <div class="position-controls">
              <div class="position-input-group">
                <span class="position-label">X</span>
                <NumberInput
                  :model-value="transformX"
                  @change="(value) => updateTransform({ position: { x: value, y: transformY } })"
                  :min="-videoStore.videoResolution.width"
                  :max="videoStore.videoResolution.width"
                  :step="1"
                  :precision="0"
                  placeholder="中心为0"
                  :input-style="positionInputStyle"
                />
              </div>
              <div class="position-input-group">
                <span class="position-label">Y</span>
                <NumberInput
                  :model-value="transformY"
                  @change="(value) => updateTransform({ position: { x: transformX, y: value } })"
                  :min="-videoStore.videoResolution.height"
                  :max="videoStore.videoResolution.height"
                  :step="1"
                  :precision="0"
                  placeholder="中心为0"
                  :input-style="positionInputStyle"
                />
              </div>
            </div>
          </div>

          <!-- 等比缩放选项 -->
          <div class="property-item">
            <label>等比缩放</label>
            <input
              v-model="proportionalScale"
              @change="toggleProportionalScale"
              type="checkbox"
              class="checkbox-input"
            />
          </div>

          <!-- 等比缩放时的统一缩放控制 -->
          <div v-if="proportionalScale" class="property-item">
            <label>缩放</label>
            <div class="scale-controls">
              <input
                :value="uniformScale"
                @input="(e) => updateUniformScale((e.target as HTMLInputElement).valueAsNumber)"
                type="range"
                min="0.01"
                max="5"
                step="0.01"
                class="scale-slider"
              />
              <NumberInput
                :model-value="uniformScale"
                @change="updateUniformScale"
                :min="0.01"
                :max="5"
                :step="0.01"
                :precision="2"
                :input-style="scaleInputStyle"
              />
            </div>
          </div>

          <!-- 非等比缩放时的独立XY缩放控制 -->
          <template v-else>
            <div class="property-item">
              <label>X缩放</label>
              <div class="scale-controls">
                <input
                  :value="scaleX"
                  @input="(e) => setScaleX((e.target as HTMLInputElement).valueAsNumber)"
                  type="range"
                  min="0.01"
                  max="5"
                  step="0.01"
                  class="scale-slider"
                />
                <NumberInput
                  :model-value="scaleX"
                  @change="setScaleX"
                  :min="0.01"
                  :max="5"
                  :step="0.01"
                  :precision="2"
                  :input-style="scaleInputStyle"
                />
              </div>
            </div>
            <div class="property-item">
              <label>Y缩放</label>
              <div class="scale-controls">
                <input
                  :value="scaleY"
                  @input="(e) => setScaleY((e.target as HTMLInputElement).valueAsNumber)"
                  type="range"
                  min="0.01"
                  max="5"
                  step="0.01"
                  class="scale-slider"
                />
                <NumberInput
                  :model-value="scaleY"
                  @change="setScaleY"
                  :min="0.01"
                  :max="5"
                  :step="0.01"
                  :precision="2"
                  :input-style="scaleInputStyle"
                />
              </div>
            </div>
          </template>

          <!-- 分辨率显示 -->
          <div class="property-item">
            <label>分辨率</label>
            <div class="resolution-display">
              {{ currentResolution.width }} × {{ currentResolution.height }}
            </div>
          </div>
        </div>

        <!-- 布局控制 -->
        <div class="property-section">
          <h4>布局控制</h4>

          <!-- 水平对齐 -->
          <div class="property-item">
            <label>水平对齐</label>
            <div class="alignment-controls">
              <button @click="alignHorizontal('left')" class="align-btn" title="左对齐">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="2" y="4" width="8" height="2" />
                  <rect x="2" y="7" width="6" height="2" />
                  <rect x="2" y="10" width="10" height="2" />
                  <line x1="1" y1="2" x2="1" y2="14" stroke="currentColor" stroke-width="1" />
                </svg>
              </button>
              <button @click="alignHorizontal('center')" class="align-btn" title="水平居中">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="4" y="4" width="8" height="2" />
                  <rect x="5" y="7" width="6" height="2" />
                  <rect x="3" y="10" width="10" height="2" />
                  <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" stroke-width="1" />
                </svg>
              </button>
              <button @click="alignHorizontal('right')" class="align-btn" title="右对齐">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="6" y="4" width="8" height="2" />
                  <rect x="8" y="7" width="6" height="2" />
                  <rect x="4" y="10" width="10" height="2" />
                  <line x1="15" y1="2" x2="15" y2="14" stroke="currentColor" stroke-width="1" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 垂直对齐 -->
          <div class="property-item">
            <label>垂直对齐</label>
            <div class="alignment-controls">
              <button @click="alignVertical('top')" class="align-btn" title="顶对齐">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="4" y="2" width="2" height="8" />
                  <rect x="7" y="2" width="2" height="6" />
                  <rect x="10" y="2" width="2" height="10" />
                  <line x1="2" y1="1" x2="14" y2="1" stroke="currentColor" stroke-width="1" />
                </svg>
              </button>
              <button @click="alignVertical('middle')" class="align-btn" title="垂直居中">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="4" y="4" width="2" height="8" />
                  <rect x="7" y="5" width="2" height="6" />
                  <rect x="10" y="3" width="2" height="10" />
                  <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1" />
                </svg>
              </button>
              <button @click="alignVertical('bottom')" class="align-btn" title="底对齐">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="4" y="6" width="2" height="8" />
                  <rect x="7" y="8" width="2" height="6" />
                  <rect x="10" y="4" width="2" height="10" />
                  <line x1="2" y1="15" x2="14" y2="15" stroke="currentColor" stroke-width="1" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 变换属性 -->
        <div class="property-section">
          <h4>变换</h4>

          <div class="property-item">
            <label>旋转</label>
            <div class="rotation-controls">
              <input
                :value="rotation"
                @input="(e) => setRotation((e.target as HTMLInputElement).valueAsNumber)"
                type="range"
                min="-180"
                max="180"
                step="0.1"
                class="rotation-slider"
              />
              <NumberInput
                :model-value="rotation"
                @change="setRotation"
                :step="1"
                :precision="1"
                :input-style="scaleInputStyle"
              />
            </div>
          </div>
          <div class="property-item">
            <label>透明度</label>
            <div class="opacity-controls">
              <input
                :value="opacity"
                @input="(e) => setOpacity((e.target as HTMLInputElement).valueAsNumber)"
                type="range"
                min="0"
                max="1"
                step="0.01"
                class="opacity-slider"
              />
              <NumberInput
                :model-value="opacity"
                @change="setOpacity"
                :min="0"
                :max="1"
                :step="0.01"
                :precision="2"
                :input-style="scaleInputStyle"
              />
            </div>
          </div>
          <div class="property-item">
            <label>层级</label>
            <NumberInput
              :model-value="zIndex"
              @change="(value) => updateTransform({ zIndex: value })"
              :min="0"
              :step="1"
              :precision="0"
              :input-style="scaleInputStyle"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { isVideoTimeRange } from '../types/videoTypes'
import { uiDegreesToWebAVRadians, webAVRadiansToUIDegrees } from '../utils/rotationTransform'
import NumberInput from './NumberInput.vue'

const videoStore = useVideoStore()

// 选中的时间轴项目
const selectedTimelineItem = computed(() => {
  if (!videoStore.selectedTimelineItemId) return null
  return videoStore.getTimelineItem(videoStore.selectedTimelineItemId) || null
})

// 选中项目对应的素材
const selectedMediaItem = computed(() => {
  if (!selectedTimelineItem.value) return null
  return videoStore.getMediaItem(selectedTimelineItem.value.mediaItemId) || null
})

// 时间轴时长
const timelineDuration = computed(() => {
  if (!selectedTimelineItem.value) return 0
  // 直接从timelineItem.timeRange获取，与videostore的同步机制保持一致
  const timeRange = selectedTimelineItem.value.timeRange
  return (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000 // 转换为秒
})

// 目标时长 - 与timelineDuration相同，直接使用timelineDuration
const targetDuration = computed(() => timelineDuration.value)

// 倍速分段配置
const speedSegments = [
  { min: 0.1, max: 1, normalizedStart: 0, normalizedEnd: 20 }, // 0-20%: 0.1-1x
  { min: 1, max: 2, normalizedStart: 20, normalizedEnd: 40 }, // 20-40%: 1-2x
  { min: 2, max: 5, normalizedStart: 40, normalizedEnd: 60 }, // 40-60%: 2-5x
  { min: 5, max: 10, normalizedStart: 60, normalizedEnd: 80 }, // 60-80%: 5-10x
  { min: 10, max: 100, normalizedStart: 80, normalizedEnd: 100 }, // 80-100%: 10-100x
]

// 变换属性 - 基于TimelineItem的响应式计算属性
const transformX = computed(() => selectedTimelineItem.value?.position.x || 0)
const transformY = computed(() => selectedTimelineItem.value?.position.y || 0)
const scaleX = computed(() => {
  if (!selectedTimelineItem.value || !selectedMediaItem.value) return 1
  const originalResolution = selectedMediaItem.value.mediaType === 'video'
    ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
    : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)
  return selectedTimelineItem.value.size.width / originalResolution.width
})
const scaleY = computed(() => {
  if (!selectedTimelineItem.value || !selectedMediaItem.value) return 1
  const originalResolution = selectedMediaItem.value.mediaType === 'video'
    ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
    : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)
  return selectedTimelineItem.value.size.height / originalResolution.height
})
const rotation = computed(() => {
  const radians = selectedTimelineItem.value?.rotation || 0
  return webAVRadiansToUIDegrees(radians)
})
const opacity = computed(() => selectedTimelineItem.value?.opacity || 1)
const zIndex = computed(() => selectedTimelineItem.value?.zIndex || 0)

// 等比缩放相关
const proportionalScale = computed({
  get: () => videoStore.proportionalScale,
  set: (value) => {
    videoStore.proportionalScale = value
  },
})

// 分辨率相关 - 显示当前选中视频缩放后的分辨率
const currentResolution = computed(() => {
  if (!selectedTimelineItem.value) {
    return { width: 0, height: 0 }
  }
  // 直接使用TimelineItem中的size属性，这是缩放后的实际尺寸
  return {
    width: Math.round(selectedTimelineItem.value.size.width),
    height: Math.round(selectedTimelineItem.value.size.height),
  }
})

// 等比缩放相关
const uniformScale = computed(() => scaleX.value) // 使用X缩放值作为统一缩放值

// 其他响应式属性
const clipName = computed({
  get: () => selectedMediaItem.value?.name || '',
  set: (value) => {
    if (selectedMediaItem.value && value.trim()) {
      videoStore.updateMediaItemName(selectedMediaItem.value.id, value.trim())
    }
  },
})

const playbackRate = computed(() => {
  if (!selectedTimelineItem.value) return 1

  // 图片类型没有播放速度概念，返回1
  if (selectedTimelineItem.value.mediaType === 'image') {
    return 1
  }

  // 直接从TimeRange中获取播放速度属性（仅对视频有效）
  const timeRange = selectedTimelineItem.value.timeRange
  return isVideoTimeRange(timeRange) ? timeRange.playbackRate || 1 : 1
})

const normalizedSpeed = computed(() => {
  return speedToNormalized(playbackRate.value)
})

const speedInputValue = computed(() => playbackRate.value)

// NumberInput 样式定义
const propertyInputStyle = {
  maxWidth: '80px',
  textAlign: 'right' as const,
}

const speedInputStyle = {
  maxWidth: '60px',
  textAlign: 'center' as const,
}

const positionInputStyle = {
  maxWidth: '60px',
  textAlign: 'center' as const,
  flex: '1',
  borderRadius: '0',
  borderRight: 'none',
}

const scaleInputStyle = {
  background: '#444',
  border: '1px solid #666',
  borderRadius: '0',
  borderRight: 'none',
  color: '#fff',
  fontSize: '11px',
  padding: '2px 4px',
  width: '78px',
  textAlign: 'center' as const,
  flex: '0 0 auto',
}

// 更新片段名称
const updateClipName = () => {
  if (selectedMediaItem.value && clipName.value.trim()) {
    videoStore.updateMediaItemName(selectedMediaItem.value.id, clipName.value.trim())
  }
}

// 更新播放速度（仅对视频有效）- 使用带历史记录的方法
const updatePlaybackRate = async (newRate?: number) => {
  if (selectedTimelineItem.value && selectedTimelineItem.value.mediaType === 'video') {
    const rate = newRate || playbackRate.value

    try {
      // 使用带历史记录的变换属性更新方法
      await videoStore.updateTimelineItemTransformWithHistory(selectedTimelineItem.value.id, {
        playbackRate: rate
      })
      console.log('✅ 倍速更新成功')
    } catch (error) {
      console.error('❌ 更新倍速失败:', error)
      // 如果历史记录更新失败，回退到直接更新
      videoStore.updateTimelineItemPlaybackRate(selectedTimelineItem.value.id, rate)
    }
  }
}

// 更新目标时长 - 使用带历史记录的方法
const updateTargetDuration = async (newTargetDuration: number) => {
  if (
    !isNaN(newTargetDuration) &&
    newTargetDuration > 0 &&
    selectedTimelineItem.value &&
    selectedMediaItem.value
  ) {
    try {
      // 使用带历史记录的变换属性更新方法
      await videoStore.updateTimelineItemTransformWithHistory(selectedTimelineItem.value.id, {
        duration: newTargetDuration
      })
      console.log('✅ 时长更新成功')
    } catch (error) {
      console.error('❌ 更新时长失败:', error)
      // 如果历史记录更新失败，回退到直接更新
      const sprite = selectedTimelineItem.value.sprite
      const timeRange = selectedTimelineItem.value.timeRange

      // 对于视频，直接更新时间范围
      if (selectedTimelineItem.value.mediaType === 'video') {
        // 更新VideoVisibleSprite的时间范围
        const newTimelineEndTime = timeRange.timelineStartTime + newTargetDuration * 1000000

        // 根据媒体类型设置不同的时间范围
        if (isVideoTimeRange(timeRange)) {
          sprite.setTimeRange({
            clipStartTime: timeRange.clipStartTime,
            clipEndTime: timeRange.clipEndTime,
            timelineStartTime: timeRange.timelineStartTime,
            timelineEndTime: newTimelineEndTime,
          })
        } else {
          // 图片类型
          sprite.setTimeRange({
            timelineStartTime: timeRange.timelineStartTime,
            timelineEndTime: newTimelineEndTime,
            displayDuration: newTargetDuration * 1000000,
          })
        }
      } else if (selectedTimelineItem.value.mediaType === 'image') {
        // 对于图片，直接更新显示时长
        const newTimelineEndTime = timeRange.timelineStartTime + newTargetDuration * 1000000
        sprite.setTimeRange({
          timelineStartTime: timeRange.timelineStartTime,
          timelineEndTime: newTimelineEndTime,
          displayDuration: newTargetDuration * 1000000,
        })
      }

      // 从sprite获取更新后的完整timeRange
      selectedTimelineItem.value.timeRange = sprite.getTimeRange()
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

// 更新变换属性 - 使用带历史记录的方法
const updateTransform = async (transform?: {
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  rotation?: number
  opacity?: number
  zIndex?: number
}) => {
  if (!selectedTimelineItem.value) return

  // 如果没有提供transform参数，使用当前的响应式值
  const finalTransform = transform || {
    position: { x: transformX.value, y: transformY.value },
    size: {
      width: selectedTimelineItem.value.size.width,
      height: selectedTimelineItem.value.size.height,
    },
    rotation: rotation.value,
    opacity: opacity.value,
    zIndex: zIndex.value,
  }

  try {
    // 使用带历史记录的变换属性更新方法
    await videoStore.updateTimelineItemTransformWithHistory(selectedTimelineItem.value.id, finalTransform)
    console.log('✅ 变换属性更新成功')
  } catch (error) {
    console.error('❌ 更新变换属性失败:', error)
    // 如果历史记录更新失败，回退到直接更新
    videoStore.updateTimelineItemTransform(selectedTimelineItem.value.id, finalTransform)
  }
}

// 切换等比缩放
const toggleProportionalScale = () => {
  if (proportionalScale.value && selectedTimelineItem.value && selectedMediaItem.value) {
    // 开启等比缩放时，使用当前X缩放值作为统一缩放值，同时更新Y缩放
    const originalResolution = selectedMediaItem.value.mediaType === 'video'
      ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
      : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)
    const newSize = {
      width: originalResolution.width * scaleX.value,
      height: originalResolution.height * scaleX.value, // 使用X缩放值保持等比
    }
    updateTransform({ size: newSize })
  }
}

// 更新统一缩放
const updateUniformScale = (newScale: number) => {
  if (proportionalScale.value && selectedTimelineItem.value && selectedMediaItem.value) {
    const originalResolution = selectedMediaItem.value.mediaType === 'video'
      ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
      : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)
    const newSize = {
      width: originalResolution.width * newScale,
      height: originalResolution.height * newScale,
    }
    updateTransform({ size: newSize })
  }
}

// 设置X缩放绝对值的方法
const setScaleX = (value: number) => {
  if (!selectedTimelineItem.value || !selectedMediaItem.value) return
  const originalResolution = selectedMediaItem.value.mediaType === 'video'
    ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
    : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)
  const newScaleX = Math.max(0.01, Math.min(5, value))
  const newSize = {
    width: originalResolution.width * newScaleX,
    height: selectedTimelineItem.value.size.height, // 保持Y尺寸不变
  }
  updateTransform({ size: newSize })
}

// 设置Y缩放绝对值的方法
const setScaleY = (value: number) => {
  if (!selectedTimelineItem.value || !selectedMediaItem.value) return
  const originalResolution = selectedMediaItem.value.mediaType === 'video'
    ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
    : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)
  const newScaleY = Math.max(0.01, Math.min(5, value))
  const newSize = {
    width: selectedTimelineItem.value.size.width, // 保持X尺寸不变
    height: originalResolution.height * newScaleY,
  }
  updateTransform({ size: newSize })
}

// 设置旋转绝对值的方法（输入角度，转换为弧度）
const setRotation = (value: number) => {
  const newRotationRadians = uiDegreesToWebAVRadians(value)
  updateTransform({ rotation: newRotationRadians })
}

// 设置透明度绝对值的方法
const setOpacity = (value: number) => {
  const newOpacity = Math.max(0, Math.min(1, value))
  updateTransform({ opacity: newOpacity })
}



// 实现对齐功能（基于项目坐标系：中心为原点）
const alignHorizontal = (alignment: 'left' | 'center' | 'right') => {
  if (!selectedTimelineItem.value) return

  const sprite = selectedTimelineItem.value.sprite
  const canvasWidth = videoStore.videoResolution.width
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

    const newPosition = {
      x: Math.round(newProjectX),
      y: transformY.value,
    }
    updateTransform({ position: newPosition })

    console.log('✅ 水平对齐完成:', alignment, '项目坐标X:', newPosition.x)
  } catch (error) {
    console.error('水平对齐失败:', error)
  }
}

const alignVertical = (alignment: 'top' | 'middle' | 'bottom') => {
  if (!selectedTimelineItem.value) return

  const sprite = selectedTimelineItem.value.sprite
  const canvasHeight = videoStore.videoResolution.height
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

    const newPosition = {
      x: transformX.value,
      y: Math.round(newProjectY),
    }
    updateTransform({ position: newPosition })

    console.log('✅ 垂直对齐完成:', alignment, '项目坐标Y:', newPosition.y)
  } catch (error) {
    console.error('垂直对齐失败:', error)
  }
}
</script>

<style scoped>
.properties-panel {
  width: 100%;
  height: 100%;
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-medium);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 使用通用的 panel-header, panel-content, empty-state, hint 样式 */

.properties-content {
  padding: var(--spacing-md) var(--spacing-lg);
}

/* 使用通用的 property-section, property-item 样式 */

.property-input {
  background: var(--color-bg-quaternary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-small);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  padding: var(--spacing-xs) var(--spacing-sm);
  flex: 1;
  min-width: 0;
}

.property-input:focus {
  outline: none;
  border-color: var(--color-border-focus);
}

/* 时长控制样式 */
.duration-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
}

.duration-unit {
  font-size: var(--font-size-base);
  color: var(--color-text-hint);
  min-width: 20px;
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

.segmented-speed-slider {
  width: 100%;
  height: 4px;
  background: var(--color-bg-quaternary);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  position: relative;
  z-index: 2;
}

.segmented-speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: var(--color-text-primary);
  border-radius: 50%;
  cursor: pointer;
}

.segmented-speed-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: var(--color-text-primary);
  border-radius: 50%;
  border: none;
  cursor: pointer;
}

/* 分段竖线 */
.speed-dividers {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 12px;
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 1;
}

.speed-divider {
  position: absolute;
  width: 1px;
  height: 100%;
  background: var(--color-border-secondary);
  transform: translateX(-50%);
}



/* 位置控制样式 */
.position-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
}

.position-input-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 1;
}

.position-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-hint);
  min-width: 12px;
  text-align: center;
}

/* 复选框样式 */
.checkbox-input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-text-primary);
  cursor: pointer;
}

.scale-controls,
.rotation-controls,
.opacity-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
}

/* 使用通用的 slider 样式 */
.scale-slider,
.rotation-slider,
.opacity-slider {
  flex: 1;
  height: 4px;
  background: var(--color-bg-quaternary);
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.scale-slider::-webkit-slider-thumb,
.rotation-slider::-webkit-slider-thumb,
.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: var(--color-accent-secondary);
  border-radius: 50%;
  cursor: pointer;
}

.scale-slider::-moz-range-thumb,
.rotation-slider::-moz-range-thumb,
.opacity-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: var(--color-accent-secondary);
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

/* 分辨率显示样式 */
.resolution-display {
  background: var(--color-bg-quaternary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-medium);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: center;
  font-family: monospace;
}

/* 对齐控制样式 */
.alignment-controls {
  display: flex;
  gap: var(--spacing-xs);
  flex: 1;
}

/* 使用通用的 align-btn 样式 */
</style>

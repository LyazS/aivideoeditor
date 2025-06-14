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
          <div class="property-item">
            <label>时长</label>
            <span class="property-value">{{ formatDuration(timelineDuration) }}</span>
          </div>
          <div class="property-item">
            <label>位置</label>
            <span class="property-value">{{ formatDuration(selectedTimelineItem?.timelinePosition || 0) }}</span>
          </div>

          <!-- 调试按钮 -->
          <div class="property-item">
            <button @click="debugTimelineItems" class="debug-button">
              🐛 调试：打印TimelineItems数据
            </button>
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
                v-model.number="targetDuration"
                @blur="updateTargetDuration"
                @keyup.enter="updateTargetDuration"
                type="number"
                step="0.1"
                min="0.1"
                class="property-input number-input"
                placeholder="秒"
              />
              <span class="duration-unit">秒</span>
            </div>
          </div>

          <!-- 倍速控制 -->
          <div class="property-item">
            <label>倍速</label>
            <div class="speed-controls">
              <!-- 分段倍速滑块 -->
              <div class="segmented-speed-container">
                <input
                  :value="normalizedSpeed"
                  @input="(e) => updateNormalizedSpeed((e.target as HTMLInputElement).valueAsNumber)"
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
              <input
                :value="speedInputValue"
                @input="(e) => updateSpeedFromInput((e.target as HTMLInputElement).valueAsNumber)"
                @blur="(e) => updateSpeedFromInput((e.target as HTMLInputElement).valueAsNumber)"
                @keyup.enter="(e) => updateSpeedFromInput((e.target as HTMLInputElement).valueAsNumber)"
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                class="speed-input"
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
                <div class="number-input-wrapper">
                  <input
                    :value="tempTransformXInput"
                    @blur="confirmTransformXFromInput"
                    @keyup.enter="confirmTransformXFromInput"
                    type="number"
                    step="1"
                    :min="-videoStore.videoResolution.width"
                    :max="videoStore.videoResolution.width"
                    class="property-input position-input-field"
                    placeholder="中心为0"
                  />
                  <div class="number-controls">
                    <button @click="adjustTransformX(1)" class="number-btn number-btn-up">▲</button>
                    <button @click="adjustTransformX(-1)" class="number-btn number-btn-down">
                      ▼
                    </button>
                  </div>
                </div>
              </div>
              <div class="position-input-group">
                <span class="position-label">Y</span>
                <div class="number-input-wrapper">
                  <input
                    :value="tempTransformYInput"
                    @blur="confirmTransformYFromInput"
                    @keyup.enter="confirmTransformYFromInput"
                    type="number"
                    step="1"
                    :min="-videoStore.videoResolution.height"
                    :max="videoStore.videoResolution.height"
                    class="property-input position-input-field"
                    placeholder="中心为0"
                  />
                  <div class="number-controls">
                    <button @click="adjustTransformY(1)" class="number-btn number-btn-up">▲</button>
                    <button @click="adjustTransformY(-1)" class="number-btn number-btn-down">
                      ▼
                    </button>
                  </div>
                </div>
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
                min="0.1"
                max="10"
                step="0.01"
                class="scale-slider"
              />
              <div class="number-input-wrapper">
                <input
                  :value="tempUniformScaleInput"
                  @blur="confirmUniformScaleFromInput"
                  @keyup.enter="confirmUniformScaleFromInput"
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.01"
                  class="scale-input-box"
                />
                <div class="number-controls">
                  <button @click="updateUniformScale(uniformScale + 0.1)" class="number-btn number-btn-up">
                    ▲
                  </button>
                  <button @click="updateUniformScale(uniformScale - 0.1)" class="number-btn number-btn-down">
                    ▼
                  </button>
                </div>
              </div>
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
                  min="0.1"
                  max="10"
                  step="0.01"
                  class="scale-slider"
                />
                <div class="number-input-wrapper">
                  <input
                    :value="tempScaleXInput"
                    @blur="confirmScaleXFromInput"
                    @keyup.enter="confirmScaleXFromInput"
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.01"
                    class="scale-input-box"
                  />
                  <div class="number-controls">
                    <button @click="setScaleX(scaleX + 0.1)" class="number-btn number-btn-up">▲</button>
                    <button @click="setScaleX(scaleX - 0.1)" class="number-btn number-btn-down">
                      ▼
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="property-item">
              <label>Y缩放</label>
              <div class="scale-controls">
                <input
                  :value="scaleY"
                  @input="(e) => setScaleY((e.target as HTMLInputElement).valueAsNumber)"
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.01"
                  class="scale-slider"
                />
                <div class="number-input-wrapper">
                  <input
                    :value="tempScaleYInput"
                    @blur="confirmScaleYFromInput"
                    @keyup.enter="confirmScaleYFromInput"
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.01"
                    class="scale-input-box"
                  />
                  <div class="number-controls">
                    <button @click="setScaleY(scaleY + 0.1)" class="number-btn number-btn-up">▲</button>
                    <button @click="setScaleY(scaleY - 0.1)" class="number-btn number-btn-down">
                      ▼
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 分辨率控制 -->
          <div class="property-item">
            <label>分辨率</label>
            <div class="resolution-controls">
              <div class="resolution-inputs">
                <div class="resolution-input-group">
                  <label class="resolution-label">宽</label>
                  <input
                    v-model="tempResolutionWidth"
                    @blur="confirmResolutionFromInput"
                    @keyup.enter="confirmResolutionFromInput"
                    type="number"
                    min="1"
                    max="7680"
                    class="resolution-input"
                  />
                </div>
                <span class="resolution-separator">×</span>
                <div class="resolution-input-group">
                  <label class="resolution-label">高</label>
                  <input
                    v-model="tempResolutionHeight"
                    @blur="confirmResolutionFromInput"
                    @keyup.enter="confirmResolutionFromInput"
                    type="number"
                    min="1"
                    max="4320"
                    class="resolution-input"
                  />
                </div>
              </div>
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
              <button
                @click="alignHorizontal('left')"
                class="align-btn"
                title="左对齐"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="2" y="4" width="8" height="2"/>
                  <rect x="2" y="7" width="6" height="2"/>
                  <rect x="2" y="10" width="10" height="2"/>
                  <line x1="1" y1="2" x2="1" y2="14" stroke="currentColor" stroke-width="1"/>
                </svg>
              </button>
              <button
                @click="alignHorizontal('center')"
                class="align-btn"
                title="水平居中"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="4" y="4" width="8" height="2"/>
                  <rect x="5" y="7" width="6" height="2"/>
                  <rect x="3" y="10" width="10" height="2"/>
                  <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" stroke-width="1"/>
                </svg>
              </button>
              <button
                @click="alignHorizontal('right')"
                class="align-btn"
                title="右对齐"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="6" y="4" width="8" height="2"/>
                  <rect x="8" y="7" width="6" height="2"/>
                  <rect x="4" y="10" width="10" height="2"/>
                  <line x1="15" y1="2" x2="15" y2="14" stroke="currentColor" stroke-width="1"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- 垂直对齐 -->
          <div class="property-item">
            <label>垂直对齐</label>
            <div class="alignment-controls">
              <button
                @click="alignVertical('top')"
                class="align-btn"
                title="顶对齐"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="4" y="2" width="2" height="8"/>
                  <rect x="7" y="2" width="2" height="6"/>
                  <rect x="10" y="2" width="2" height="10"/>
                  <line x1="2" y1="1" x2="14" y2="1" stroke="currentColor" stroke-width="1"/>
                </svg>
              </button>
              <button
                @click="alignVertical('middle')"
                class="align-btn"
                title="垂直居中"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="4" y="4" width="2" height="8"/>
                  <rect x="7" y="5" width="2" height="6"/>
                  <rect x="10" y="3" width="2" height="10"/>
                  <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1"/>
                </svg>
              </button>
              <button
                @click="alignVertical('bottom')"
                class="align-btn"
                title="底对齐"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="4" y="6" width="2" height="8"/>
                  <rect x="7" y="8" width="2" height="6"/>
                  <rect x="10" y="4" width="2" height="10"/>
                  <line x1="2" y1="15" x2="14" y2="15" stroke="currentColor" stroke-width="1"/>
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
              <div class="number-input-wrapper">
                <input
                  :value="tempRotationInput"
                  @blur="confirmRotationFromInput"
                  @keyup.enter="confirmRotationFromInput"
                  type="number"
                  step="0.1"
                  class="scale-input-box"
                />
                <div class="number-controls">
                  <button @click="setRotation(rotation + 1)" class="number-btn number-btn-up">▲</button>
                  <button @click="setRotation(rotation - 1)" class="number-btn number-btn-down">▼</button>
                </div>
              </div>
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
              <div class="number-input-wrapper">
                <input
                  :value="tempOpacityInput"
                  @blur="confirmOpacityFromInput"
                  @keyup.enter="confirmOpacityFromInput"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  class="scale-input-box"
                />
                <div class="number-controls">
                  <button @click="setOpacity(opacity + 0.01)" class="number-btn number-btn-up">▲</button>
                  <button @click="setOpacity(opacity - 0.01)" class="number-btn number-btn-down">
                    ▼
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="property-item">
            <label>层级</label>
            <input
              :value="tempZIndexInput"
              @blur="confirmZIndexFromInput"
              @keyup.enter="confirmZIndexFromInput"
              type="number"
              min="0"
              step="1"
              class="property-input number-input"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useVideoStore, type TimelineItem } from '../stores/videostore'
import { webavToProjectCoords } from '../utils/coordinateTransform'
import { uiDegreesToWebAVRadians, webAVRadiansToUIDegrees } from '../utils/rotationTransform'

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
  const sprite = selectedTimelineItem.value.sprite
  const timeRange = sprite.getTimeRange()
  return (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000 // 转换为秒
})

// 可编辑的属性
const targetDuration = ref(0)

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
  const originalResolution = videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
  return selectedTimelineItem.value.size.width / originalResolution.width
})
const scaleY = computed(() => {
  if (!selectedTimelineItem.value || !selectedMediaItem.value) return 1
  const originalResolution = videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
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

// 分辨率相关
const tempResolutionWidth = ref('1920')
const tempResolutionHeight = ref('1080')





// 等比缩放相关
const uniformScale = computed(() => scaleX.value) // 使用X缩放值作为统一缩放值

// 其他响应式属性
const clipName = computed({
  get: () => selectedMediaItem.value?.name || '',
  set: (value) => {
    if (selectedMediaItem.value && value.trim()) {
      videoStore.updateMediaItemName(selectedMediaItem.value.id, value.trim())
    }
  }
})

const playbackRate = computed(() => {
  if (!selectedTimelineItem.value) return 1
  return selectedTimelineItem.value.sprite.getPlaybackSpeed() || 1
})

const normalizedSpeed = computed(() => {
  return speedToNormalized(playbackRate.value)
})

const speedInputValue = computed(() => playbackRate.value)

// TODO: 重新实现变换属性监听
// 暂时禁用复杂的变换监听逻辑

// 更新片段名称
const updateClipName = () => {
  if (selectedMediaItem.value && clipName.value.trim()) {
    videoStore.updateMediaItemName(selectedMediaItem.value.id, clipName.value.trim())
  }
}

// 更新播放速度
const updatePlaybackRate = (newRate?: number) => {
  if (selectedTimelineItem.value) {
    const rate = newRate || playbackRate.value
    videoStore.updateTimelineItemPlaybackRate(selectedTimelineItem.value.id, rate)
    // 同步更新目标时长
    const sprite = selectedTimelineItem.value.sprite
    const timeRange = sprite.getTimeRange()
    targetDuration.value = (timeRange.timelineEndTime - timeRange.timelineStartTime) / 1000000
  }
}

// 更新目标时长
const updateTargetDuration = () => {
  if (selectedTimelineItem.value && selectedMediaItem.value && targetDuration.value > 0) {
    const sprite = selectedTimelineItem.value.sprite
    const timeRange = sprite.getTimeRange()

    // 计算新的播放速度：原始时长 / 目标时长
    const newPlaybackRate = selectedMediaItem.value.duration / targetDuration.value
    // 确保播放速度在合理范围内（0.1-100x）
    const clampedRate = Math.max(0.1, Math.min(100, newPlaybackRate))

    // 更新CustomVisibleSprite的时间范围
    const newTimelineEndTime = timeRange.timelineStartTime + (targetDuration.value * 1000000)
    sprite.setTimeRange({
      clipStartTime: timeRange.clipStartTime,
      clipEndTime: timeRange.clipEndTime,
      timelineStartTime: timeRange.timelineStartTime,
      timelineEndTime: newTimelineEndTime
    })

    // 重新计算实际时长（可能因为范围限制而有所调整）
    const actualDuration = selectedMediaItem.value.duration / clampedRate
    targetDuration.value = actualDuration
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



// 更新变换属性 - 使用新的双向同步机制
const updateTransform = (transform?: {
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  rotation?: number
  opacity?: number
  zIndex?: number
}) => {
  if (!selectedTimelineItem.value) return

  try {
    // 如果没有提供transform参数，使用当前的响应式值
    const finalTransform = transform || {
      position: { x: transformX.value, y: transformY.value },
      size: {
        width: selectedTimelineItem.value.size.width,
        height: selectedTimelineItem.value.size.height
      },
      rotation: rotation.value,
      opacity: opacity.value,
      zIndex: zIndex.value
    }

    // 使用videoStore的updateTimelineItemTransform方法
    // 这会触发propsChange事件，自动同步到TimelineItem，然后更新属性面板显示
    videoStore.updateTimelineItemTransform(selectedTimelineItem.value.id, finalTransform)
  } catch (error) {
    console.error('更新变换属性失败:', error)
  }
}

// 切换等比缩放
const toggleProportionalScale = () => {
  if (proportionalScale.value && selectedTimelineItem.value && selectedMediaItem.value) {
    // 开启等比缩放时，使用当前X缩放值作为统一缩放值，同时更新Y缩放
    const originalResolution = videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
    const newSize = {
      width: originalResolution.width * scaleX.value,
      height: originalResolution.height * scaleX.value // 使用X缩放值保持等比
    }
    updateTransform({ size: newSize })
  }
}

// 更新统一缩放
const updateUniformScale = (newScale: number) => {
  if (proportionalScale.value && selectedTimelineItem.value && selectedMediaItem.value) {
    const originalResolution = videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
    const newSize = {
      width: originalResolution.width * newScale,
      height: originalResolution.height * newScale
    }
    updateTransform({ size: newSize })
  }
}

// 调整位置数值的方法
const adjustTransformX = (delta: number) => {
  const newPosition = {
    x: transformX.value + delta,
    y: transformY.value
  }
  updateTransform({ position: newPosition })
}

const adjustTransformY = (delta: number) => {
  const newPosition = {
    x: transformX.value,
    y: transformY.value + delta
  }
  updateTransform({ position: newPosition })
}

// 设置X缩放绝对值的方法
const setScaleX = (value: number) => {
  if (!selectedTimelineItem.value || !selectedMediaItem.value) return
  const originalResolution = videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
  const newScaleX = Math.max(0.1, Math.min(10, value))
  const newSize = {
    width: originalResolution.width * newScaleX,
    height: selectedTimelineItem.value.size.height // 保持Y尺寸不变
  }
  updateTransform({ size: newSize })
}

// 设置Y缩放绝对值的方法
const setScaleY = (value: number) => {
  if (!selectedTimelineItem.value || !selectedMediaItem.value) return
  const originalResolution = videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
  const newScaleY = Math.max(0.1, Math.min(10, value))
  const newSize = {
    width: selectedTimelineItem.value.size.width, // 保持X尺寸不变
    height: originalResolution.height * newScaleY
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

// 临时输入值的computed（用于单向绑定显示）
const tempTransformXInput = computed(() => transformX.value.toString())
const tempTransformYInput = computed(() => transformY.value.toString())
const tempUniformScaleInput = computed(() => uniformScale.value.toFixed(2))
const tempScaleXInput = computed(() => scaleX.value.toFixed(2))
const tempScaleYInput = computed(() => scaleY.value.toFixed(2))
const tempRotationInput = computed(() => rotation.value.toFixed(1))
const tempOpacityInput = computed(() => opacity.value.toFixed(2))
const tempZIndexInput = computed(() => zIndex.value.toString())

// 确认统一缩放输入（失焦或回车时）
const confirmUniformScaleFromInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const value = parseFloat(input.value)
  if (!isNaN(value)) {
    const clampedValue = Math.max(0.1, Math.min(10, value))
    updateUniformScale(clampedValue)
  }
  // 如果输入无效，computed会自动恢复到当前正确值
}

// 确认X缩放输入（失焦或回车时）
const confirmScaleXFromInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const value = parseFloat(input.value)
  if (!isNaN(value) && selectedTimelineItem.value && selectedMediaItem.value) {
    const clampedValue = Math.max(0.1, Math.min(10, value))
    const originalResolution = videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
    const newSize = {
      width: originalResolution.width * clampedValue,
      height: selectedTimelineItem.value.size.height // 保持Y尺寸不变
    }
    updateTransform({ size: newSize })
  }
  // 如果输入无效，computed会自动恢复到当前正确值
}

// 确认Y缩放输入（失焦或回车时）
const confirmScaleYFromInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const value = parseFloat(input.value)
  if (!isNaN(value) && selectedTimelineItem.value && selectedMediaItem.value) {
    const clampedValue = Math.max(0.1, Math.min(10, value))
    const originalResolution = videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
    const newSize = {
      width: selectedTimelineItem.value.size.width, // 保持X尺寸不变
      height: originalResolution.height * clampedValue
    }
    updateTransform({ size: newSize })
  }
  // 如果输入无效，computed会自动恢复到当前正确值
}

// 确认位置X输入（失焦或回车时）
const confirmTransformXFromInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const value = parseInt(input.value)
  if (!isNaN(value)) {
    // 项目坐标系：中心为原点，允许的范围是 -canvasWidth 到 +canvasWidth
    const clampedValue = Math.max(
      -videoStore.videoResolution.width,
      Math.min(videoStore.videoResolution.width, value),
    )
    const newPosition = {
      x: clampedValue,
      y: transformY.value
    }
    updateTransform({ position: newPosition })
  }
  // 如果输入无效，computed会自动恢复到当前正确值
}

// 确认位置Y输入（失焦或回车时）
const confirmTransformYFromInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const value = parseInt(input.value)
  if (!isNaN(value)) {
    // 项目坐标系：中心为原点，允许的范围是 -canvasHeight 到 +canvasHeight
    const clampedValue = Math.max(
      -videoStore.videoResolution.height,
      Math.min(videoStore.videoResolution.height, value),
    )
    const newPosition = {
      x: transformX.value,
      y: clampedValue
    }
    updateTransform({ position: newPosition })
  }
  // 如果输入无效，computed会自动恢复到当前正确值
}

// 确认旋转输入（失焦或回车时）
const confirmRotationFromInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const value = parseFloat(input.value)
  if (!isNaN(value)) {
    setRotation(value)
  }
  // 如果输入无效，computed会自动恢复到当前正确值
}

// 确认透明度输入（失焦或回车时）
const confirmOpacityFromInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const value = parseFloat(input.value)
  if (!isNaN(value)) {
    const clampedValue = Math.max(0, Math.min(1, value))
    updateTransform({ opacity: clampedValue })
  }
  // 如果输入无效，computed会自动恢复到当前正确值
}

// 确认层级输入（失焦或回车时）
const confirmZIndexFromInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const value = parseInt(input.value)
  if (!isNaN(value) && value >= 0) {
    updateTransform({ zIndex: value })
  }
  // 如果输入无效，computed会自动恢复到当前正确值
}

// ==================== 调试函数 ====================

/**
 * 调试函数：打印TimelineItems的详细数据
 */
const debugTimelineItems = () => {
  console.group('🐛 TimelineItems 调试数据')

  console.log('📊 总体信息:')
  console.log(`- TimelineItems 数量: ${videoStore.timelineItems.length}`)
  console.log(`- 当前选中项目ID: ${videoStore.selectedTimelineItemId}`)

  if (videoStore.timelineItems.length === 0) {
    console.log('⚠️ 没有TimelineItems数据')
    console.groupEnd()
    return
  }

  console.log('\n📋 TimelineItems 详细数据:')
  videoStore.timelineItems.forEach((item, index) => {
    console.group(`📹 TimelineItem [${index}] - ID: ${item.id}`)

    // 基本信息
    console.log('🔍 基本信息:')
    console.log(`  - ID: ${item.id}`)
    console.log(`  - MediaItem ID: ${item.mediaItemId}`)
    console.log(`  - Track ID: ${item.trackId}`)
    console.log(`  - Timeline Position: ${item.timelinePosition}s`)

    // 位置和尺寸信息
    console.log('📐 位置和尺寸:')
    console.log(`  - Position: { x: ${item.position.x}, y: ${item.position.y} }`)
    console.log(`  - Size: { width: ${item.size.width}, height: ${item.size.height} }`)
    console.log(`  - Rotation: ${item.rotation} 弧度`)
    console.log(`  - Opacity: ${item.opacity}`)
    console.log(`  - Z-Index: ${item.zIndex}`)

    // Sprite信息
    console.log('🎬 Sprite 信息:')
    const sprite = item.sprite
    if (sprite) {
      const rect = sprite.rect
      const timeRange = sprite.getTimeRange()

      console.log(`  - WebAV Rect: { x: ${rect.x}, y: ${rect.y}, w: ${rect.w}, h: ${rect.h} }`)
      console.log(`  - WebAV Opacity: ${sprite.opacity}`)
      console.log(`  - WebAV Z-Index: ${sprite.zIndex}`)
      console.log(`  - Time Range:`)
      console.log(`    - Clip: ${timeRange.clipStartTime / 1000000}s - ${timeRange.clipEndTime / 1000000}s`)
      console.log(`    - Timeline: ${timeRange.timelineStartTime / 1000000}s - ${timeRange.timelineEndTime / 1000000}s`)
      console.log(`  - Playback Speed: ${sprite.getPlaybackSpeed()}x`)

      // 坐标系转换验证
      console.log('🔄 坐标系转换验证:')
      const convertedCoords = webavToProjectCoords(
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        videoStore.videoResolution.width,
        videoStore.videoResolution.height
      )

      console.log(`  - WebAV坐标: { x: ${rect.x}, y: ${rect.y} }`)
      console.log(`  - 转换为项目坐标: { x: ${Math.round(convertedCoords.x)}, y: ${Math.round(convertedCoords.y)} }`)
      console.log(`  - TimelineItem坐标: { x: ${item.position.x}, y: ${item.position.y} }`)

      const xDiff = Math.abs(item.position.x - Math.round(convertedCoords.x))
      const yDiff = Math.abs(item.position.y - Math.round(convertedCoords.y))
      const isConsistent = xDiff < 2 && yDiff < 2

      console.log(`  - 坐标差异: X=${xDiff}px, Y=${yDiff}px`)
      console.log(`  - 数据同步状态: ${isConsistent ? '✅ 同步' : '❌ 不同步'}`)
    } else {
      console.warn('  ⚠️ Sprite 为空!')
    }

    // 对应的MediaItem信息
    const mediaItem = videoStore.getMediaItem(item.mediaItemId)
    if (mediaItem) {
      console.log('📁 对应的MediaItem:')
      console.log(`  - Name: ${mediaItem.name}`)
      console.log(`  - Duration: ${mediaItem.duration}s`)
      console.log(`  - Type: ${mediaItem.type}`)
    } else {
      console.warn('  ⚠️ 找不到对应的MediaItem!')
    }

    console.groupEnd()
  })

  // 当前选中项目的特别信息
  if (selectedTimelineItem.value) {
    console.group('🎯 当前选中项目详情')
    const item = selectedTimelineItem.value
    console.log('📊 响应式计算属性值:')
    console.log(`  - transformX: ${transformX.value}`)
    console.log(`  - transformY: ${transformY.value}`)
    console.log(`  - scaleX: ${scaleX.value}`)
    console.log(`  - scaleY: ${scaleY.value}`)
    console.log(`  - rotation: ${rotation.value}`)
    console.log(`  - opacity: ${opacity.value}`)
    console.log(`  - zIndex: ${zIndex.value}`)

    console.log('🔄 数据同步状态:')
    const sprite = item.sprite
    if (sprite) {
      const rect = sprite.rect

      // 将WebAV坐标系转换为项目坐标系进行对比
      const convertedCoords = webavToProjectCoords(
        rect.x ?? 0,
        rect.y ?? 0,
        rect.w ?? item.size.width,
        rect.h ?? item.size.height,
        videoStore.videoResolution.width,
        videoStore.videoResolution.height
      )

      console.log(`  - TimelineItem Position: { x: ${item.position.x}, y: ${item.position.y} }`)
      console.log(`  - WebAV Sprite Rect: { x: ${rect.x}, y: ${rect.y} }`)
      console.log(`  - 转换后的项目坐标: { x: ${Math.round(convertedCoords.x)}, y: ${Math.round(convertedCoords.y)} }`)

      // 检查坐标系转换后的一致性
      const xDiff = Math.abs(item.position.x - Math.round(convertedCoords.x))
      const yDiff = Math.abs(item.position.y - Math.round(convertedCoords.y))
      const isConsistent = xDiff < 2 && yDiff < 2 // 允许1-2像素的误差

      console.log(`  - X坐标差异: ${xDiff}px`)
      console.log(`  - Y坐标差异: ${yDiff}px`)
      console.log(`  - 坐标系转换是否一致: ${isConsistent ? '✅' : '❌'}`)

      if (!isConsistent) {
        console.warn(`  ⚠️ 数据不同步！TimelineItem和Sprite的坐标存在较大差异`)
      }
    }
    console.groupEnd()
  }

  console.groupEnd()
}



// 格式化时长
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}



// 计算当前分辨率
const getCurrentResolution = () => {
  // TODO: 重新实现分辨率计算
  return { width: 1920, height: 1080 }
}

// 更新分辨率显示
const updateResolutionDisplay = () => {
  const resolution = getCurrentResolution()
  tempResolutionWidth.value = resolution.width.toString()
  tempResolutionHeight.value = resolution.height.toString()
}

// 确认分辨率输入
const confirmResolutionFromInput = () => {
  // TODO: 重新实现分辨率输入确认
  console.log('TODO: 确认分辨率输入')
  updateResolutionDisplay()

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
      y: transformY.value
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
      y: Math.round(newProjectY)
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
  background-color: #2a2a2a;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 8px 12px;
  background-color: #333;
  border-bottom: 1px solid #555;
  flex-shrink: 0;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  color: #fff;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #888;
  text-align: center;
  padding: 20px;
}

.empty-state svg {
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-state p {
  margin: 4px 0;
}

.hint {
  font-size: 12px;
  opacity: 0.7;
}

.properties-content {
  padding: 8px 12px;
}

.property-section {
  margin-bottom: 12px;
}

.property-section h4 {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #ccc;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #444;
  padding-bottom: 3px;
}

.property-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  gap: 6px;
}

.property-item label {
  font-size: 12px;
  color: #aaa;
  flex-shrink: 0;
  min-width: 60px;
}

.property-value {
  font-size: 12px;
  color: #fff;
  text-align: right;
  word-break: break-all;
  flex: 1;
}

.property-input {
  background: #444;
  border: 1px solid #666;
  border-radius: 3px;
  color: #fff;
  font-size: 12px;
  padding: 4px 6px;
  flex: 1;
  min-width: 0;
}

.property-input:focus {
  outline: none;
  border-color: #4caf50;
}

/* 时长控制样式 */
.duration-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.duration-unit {
  font-size: 12px;
  color: #999;
  min-width: 20px;
}

/* 倍速控制样式 */
.speed-controls {
  display: flex;
  align-items: center;
  gap: 8px;
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
  background: #444;
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  position: relative;
  z-index: 2;
}

.segmented-speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: #ffffff;
  border-radius: 50%;
  cursor: pointer;
}

.segmented-speed-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #ffffff;
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
  background: #666;
  transform: translateX(-50%);
}

/* 分段标签 */
.speed-labels {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  height: 16px;
  pointer-events: none;
  z-index: 1;
}

.speed-label {
  position: absolute;
  font-size: 9px;
  color: #999;
  transform: translateX(-50%);
  white-space: nowrap;
  margin-top: 2px;
}

/* 倍速输入框 */
.speed-input {
  background: #444;
  border: 1px solid #666;
  border-radius: 3px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 6px;
  min-width: 50px;
  max-width: 60px;
  text-align: center;
}

.speed-input:focus {
  outline: none;
  border-color: #ffffff;
}

.speed-input::-webkit-outer-spin-button,
.speed-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.number-input {
  max-width: 80px;
  text-align: right;
}

/* 位置控制样式 */
.position-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.position-input-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.position-label {
  font-size: 11px;
  color: #999;
  min-width: 12px;
  text-align: center;
}

/* 数字输入框包装器 */
.number-input-wrapper {
  display: flex;
  align-items: stretch;
  position: relative;
  flex: 1;
  min-width: 0;
  border-radius: 3px;
  overflow: hidden;
}

.position-input-field {
  max-width: 60px;
  text-align: center;
  flex: 1;
  border-radius: 0; /* 移除圆角，由包装器控制 */
  border-right: none; /* 移除右边框，与按钮连接 */
}

/* 隐藏默认的数字输入框上下箭头 */
.position-input-field::-webkit-outer-spin-button,
.position-input-field::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.position-input-field[type='number'] {
  -moz-appearance: textfield;
}

/* 自定义数字控制按钮 */
.number-controls {
  display: flex;
  flex-direction: column;
  width: 18px;
  flex-shrink: 0;
}

.number-btn {
  background: #555;
  border: 1px solid #666;
  border-left: none;
  color: #fff;
  cursor: pointer;
  font-size: 8px;
  line-height: 1;
  padding: 0;
  width: 100%;
  height: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  flex: 1;
}

.number-btn:hover {
  background: #666;
}

.number-btn:active {
  background: #777;
}

.number-btn-up {
  border-radius: 0;
  border-bottom: 0.5px solid #444;
}

.number-btn-down {
  border-radius: 0;
  border-top: 0.5px solid #444;
}

/* 复选框样式 */
.checkbox-input {
  width: 16px;
  height: 16px;
  accent-color: #ffffff;
  cursor: pointer;
}

/* 缩放输入框样式 */
.scale-input-box {
  background: #444;
  border: 1px solid #666;
  border-radius: 0; /* 移除圆角，由包装器控制 */
  border-right: none; /* 移除右边框，与按钮连接 */
  color: #fff;
  font-size: 11px;
  padding: 2px 4px;
  width: 60px; /* 固定宽度 */
  text-align: center;
  flex: 0 0 auto;
}

.scale-input-box:focus {
  outline: none;
  border-color: #4caf50;
}

/* 隐藏所有数字输入框的默认箭头 */
.scale-input-box::-webkit-outer-spin-button,
.scale-input-box::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.scale-input-box[type='number'] {
  -moz-appearance: textfield;
}

.scale-controls,
.rotation-controls,
.opacity-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

/* 让数字输入框包装器在这些控件中保持固定宽度，滑杆占满剩余空间 */
.scale-controls .number-input-wrapper,
.rotation-controls .number-input-wrapper,
.opacity-controls .number-input-wrapper {
  flex: 0 0 auto;
  width: 80px; /* 固定宽度 */
}

.scale-slider,
.rotation-slider,
.opacity-slider {
  flex: 1;
  height: 4px;
  background: #444;
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
}

.scale-slider::-webkit-slider-thumb,
.rotation-slider::-webkit-slider-thumb,
.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: #2196f3;
  border-radius: 50%;
  cursor: pointer;
}

.scale-slider::-moz-range-thumb,
.rotation-slider::-moz-range-thumb,
.opacity-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #2196f3;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.scale-value,
.rotation-value,
.opacity-value {
  font-size: 11px;
  color: #fff;
  min-width: 40px;
  text-align: right;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  background: #555;
  border: none;
  border-radius: 4px;
  color: white;
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background: #666;
}

.action-btn.danger {
  background: #f44336;
}

.action-btn.danger:hover {
  background: #d32f2f;
}

/* 分辨率控件样式 */
.resolution-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.resolution-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.resolution-input-group {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
}

.resolution-input-group .resolution-label {
  font-size: 12px;
  color: #ccc;
  margin: 0;
  min-width: 20px !important;
  text-align: left;
}

.resolution-input {
  background: #444;
  border: 1px solid #666;
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  padding: 4px 6px;
  width: 60px;
  text-align: center;
}

.resolution-input:focus {
  outline: none;
  border-color: #4caf50;
}

.resolution-input::-webkit-outer-spin-button,
.resolution-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.resolution-input[type='number'] {
  -moz-appearance: textfield;
}

.resolution-separator {
  font-size: 14px;
  color: #ccc;
  font-weight: bold;
  margin: 0 4px;
}

/* 调试按钮样式 */
.debug-button {
  width: 100%;
  padding: 8px 12px;
  background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(255, 107, 107, 0.3);
}

.debug-button:hover {
  background: linear-gradient(135deg, #ff5252, #e55100);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(255, 107, 107, 0.4);
}

.debug-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(255, 107, 107, 0.3);
}

/* 自定义滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #1a1a1a;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
  border: 1px solid #333;
}

::-webkit-scrollbar-thumb:hover {
  background: #666;
}

::-webkit-scrollbar-corner {
  background: #1a1a1a;
}

/* 对齐控制样式 */
.alignment-controls {
  display: flex;
  gap: 4px;
  flex: 1;
}

.align-btn {
  background: #555;
  border: 1px solid #666;
  border-radius: 4px;
  color: #ccc;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex: 1;
  min-width: 28px;
  height: 24px;
}

.align-btn:hover {
  background: #666;
  color: #fff;
  border-color: #777;
}

.align-btn:active {
  background: #777;
  transform: translateY(1px);
}

.align-btn svg {
  width: 14px;
  height: 14px;
}
</style>

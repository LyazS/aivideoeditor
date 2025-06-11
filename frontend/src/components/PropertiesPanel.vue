<template>
  <div class="properties-panel">
    <div class="panel-header">
      <h3>属性</h3>
    </div>

    <div class="panel-content">
      <div v-if="!selectedClip" class="empty-state">
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
            <span class="property-value">{{ formatDuration(selectedClip.duration) }}</span>
          </div>
          <div class="property-item">
            <label>位置</label>
            <span class="property-value">{{ formatDuration(selectedClip.timelinePosition) }}</span>
          </div>
          <div class="property-item">
            <label>原始分辨率</label>
            <span class="property-value">{{ formatResolution(selectedClip) }}</span>
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
                  v-model.number="normalizedSpeed"
                  @input="updateNormalizedSpeed"
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
                <!-- 分段标签 -->
                <div class="speed-labels">
                  <span class="speed-label" style="left: 10%">0.1-1x</span>
                  <span class="speed-label" style="left: 30%">1-2x</span>
                  <span class="speed-label" style="left: 50%">2-5x</span>
                  <span class="speed-label" style="left: 70%">5-10x</span>
                  <span class="speed-label" style="left: 90%">10-100x</span>
                </div>
              </div>
              <input
                v-model.number="speedInputValue"
                @input="updateSpeedFromInput"
                @blur="updateSpeedFromInput"
                @keyup.enter="updateSpeedFromInput"
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
                    v-model="tempTransformX"
                    @blur="confirmTransformXFromInput"
                    @keyup.enter="confirmTransformXFromInput"
                    type="number"
                    step="1"
                    :min="-videoStore.videoResolution.width"
                    :max="videoStore.videoResolution.width"
                    class="property-input position-input-field"
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
                    v-model="tempTransformY"
                    @blur="confirmTransformYFromInput"
                    @keyup.enter="confirmTransformYFromInput"
                    type="number"
                    step="1"
                    :min="-videoStore.videoResolution.height"
                    :max="videoStore.videoResolution.height"
                    class="property-input position-input-field"
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
                v-model.number="uniformScale"
                @input="updateUniformScale"
                type="range"
                min="0.1"
                max="10"
                step="0.01"
                class="scale-slider"
              />
              <div class="number-input-wrapper">
                <input
                  v-model="tempUniformScale"
                  @blur="confirmUniformScaleFromInput"
                  @keyup.enter="confirmUniformScaleFromInput"
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.01"
                  class="scale-input-box"
                />
                <div class="number-controls">
                  <button @click="adjustUniformScale(0.1)" class="number-btn number-btn-up">
                    ▲
                  </button>
                  <button @click="adjustUniformScale(-0.1)" class="number-btn number-btn-down">
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
                  v-model.number="scaleX"
                  @input="updateTransform"
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.01"
                  class="scale-slider"
                />
                <div class="number-input-wrapper">
                  <input
                    v-model="tempScaleX"
                    @blur="confirmScaleXFromInput"
                    @keyup.enter="confirmScaleXFromInput"
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.01"
                    class="scale-input-box"
                  />
                  <div class="number-controls">
                    <button @click="adjustScaleX(0.1)" class="number-btn number-btn-up">▲</button>
                    <button @click="adjustScaleX(-0.1)" class="number-btn number-btn-down">
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
                  v-model.number="scaleY"
                  @input="updateTransform"
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.01"
                  class="scale-slider"
                />
                <div class="number-input-wrapper">
                  <input
                    v-model="tempScaleY"
                    @blur="confirmScaleYFromInput"
                    @keyup.enter="confirmScaleYFromInput"
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.01"
                    class="scale-input-box"
                  />
                  <div class="number-controls">
                    <button @click="adjustScaleY(0.1)" class="number-btn number-btn-up">▲</button>
                    <button @click="adjustScaleY(-0.1)" class="number-btn number-btn-down">
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

          <div class="property-item">
            <label>旋转</label>
            <div class="rotation-controls">
              <input
                v-model.number="rotation"
                @input="updateTransform"
                type="range"
                min="-180"
                max="180"
                step="0.1"
                class="rotation-slider"
              />
              <div class="number-input-wrapper">
                <input
                  v-model="tempRotation"
                  @blur="confirmRotationFromInput"
                  @keyup.enter="confirmRotationFromInput"
                  type="number"
                  min="-180"
                  max="180"
                  step="0.1"
                  class="scale-input-box"
                />
                <div class="number-controls">
                  <button @click="adjustRotation(1)" class="number-btn number-btn-up">▲</button>
                  <button @click="adjustRotation(-1)" class="number-btn number-btn-down">▼</button>
                </div>
              </div>
            </div>
          </div>
          <div class="property-item">
            <label>透明度</label>
            <div class="opacity-controls">
              <input
                v-model.number="opacity"
                @input="updateTransform"
                type="range"
                min="0"
                max="1"
                step="0.01"
                class="opacity-slider"
              />
              <div class="number-input-wrapper">
                <input
                  v-model="tempOpacity"
                  @blur="confirmOpacityFromInput"
                  @keyup.enter="confirmOpacityFromInput"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  class="scale-input-box"
                />
                <div class="number-controls">
                  <button @click="adjustOpacity(0.01)" class="number-btn number-btn-up">▲</button>
                  <button @click="adjustOpacity(-0.01)" class="number-btn number-btn-down">
                    ▼
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="property-item">
            <label>层级</label>
            <input
              v-model="tempZIndex"
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
import { useVideoStore, type VideoClip } from '../stores/counter'

const videoStore = useVideoStore()

// 选中的片段
const selectedClip = computed(() => {
  if (!videoStore.selectedClipId) return null
  return videoStore.clips.find((clip) => clip.id === videoStore.selectedClipId) || null
})

// 可编辑的属性
const clipName = ref('')
const playbackRate = ref(1)
const targetDuration = ref(0)
const normalizedSpeed = ref(20) // 0-100的归一化值，默认20对应1x
const speedInputValue = ref(1) // 倍速输入框的值

// 倍速分段配置
const speedSegments = [
  { min: 0.1, max: 1, normalizedStart: 0, normalizedEnd: 20 }, // 0-20%: 0.1-1x
  { min: 1, max: 2, normalizedStart: 20, normalizedEnd: 40 }, // 20-40%: 1-2x
  { min: 2, max: 5, normalizedStart: 40, normalizedEnd: 60 }, // 40-60%: 2-5x
  { min: 5, max: 10, normalizedStart: 60, normalizedEnd: 80 }, // 60-80%: 5-10x
  { min: 10, max: 100, normalizedStart: 80, normalizedEnd: 100 }, // 80-100%: 10-100x
]

// 变换属性
const transformX = ref(0)
const transformY = ref(0)
const scaleX = ref(1)
const scaleY = ref(1)
const rotation = ref(0)
const opacity = ref(1)
const zIndex = ref(0)

// 等比缩放相关
const proportionalScale = computed({
  get: () => videoStore.proportionalScale,
  set: (value) => {
    videoStore.proportionalScale = value
  },
})
const uniformScale = ref(1) // 统一缩放值

// 临时输入值（用于延迟更新）
const tempTransformX = ref('0')
const tempTransformY = ref('0')
const tempUniformScale = ref('1.00')
const tempScaleX = ref('1.00')
const tempScaleY = ref('1.00')
const tempRotation = ref('0.0')
const tempOpacity = ref('1.00')
const tempZIndex = ref('0')

// 分辨率相关
const tempResolutionWidth = ref('1920')
const tempResolutionHeight = ref('1080')

// 标志：是否正在程序更新（避免用户输入时的冲突）
const isUpdatingFromExternal = ref(false)

// 更新本地状态的函数
const updateLocalState = (clip: any) => {
  if (clip) {
    clipName.value = clip.name
    playbackRate.value = clip.playbackRate || 1
    targetDuration.value = clip.duration
    speedInputValue.value = clip.playbackRate || 1

    // 根据当前播放速度更新归一化值
    normalizedSpeed.value = speedToNormalized(clip.playbackRate || 1)

    // 更新变换属性
    transformX.value = clip.transform.x
    transformY.value = clip.transform.y
    scaleX.value = clip.transform.scaleX
    scaleY.value = clip.transform.scaleY
    rotation.value = clip.transform.rotation
    opacity.value = clip.transform.opacity
    zIndex.value = clip.zIndex

    // 更新等比缩放相关属性
    // 保持用户设置的等比缩放状态，不要自动修改
    // 只更新uniformScale的值
    uniformScale.value = proportionalScale.value ? clip.transform.scaleX : 1

    // 更新临时输入值
    tempTransformX.value = transformX.value.toString()
    tempTransformY.value = transformY.value.toString()
    tempUniformScale.value = uniformScale.value.toFixed(2)
    tempScaleX.value = scaleX.value.toFixed(2)
    tempScaleY.value = scaleY.value.toFixed(2)
    tempRotation.value = rotation.value.toFixed(1)
    tempOpacity.value = opacity.value.toFixed(2)
    tempZIndex.value = zIndex.value.toString()

    // 更新分辨率显示
    updateResolutionDisplay()
  } else {
    clipName.value = ''
    playbackRate.value = 1
    targetDuration.value = 0
    normalizedSpeed.value = 20
    speedInputValue.value = 1

    // 重置变换属性
    transformX.value = 0
    transformY.value = 0
    scaleX.value = 1
    scaleY.value = 1
    rotation.value = 0
    opacity.value = 1
    zIndex.value = 0

    // 重置等比缩放属性
    proportionalScale.value = true
    uniformScale.value = 1

    // 重置临时输入值
    tempTransformX.value = '0'
    tempTransformY.value = '0'
    tempUniformScale.value = '1.00'
    tempScaleX.value = '1.00'
    tempScaleY.value = '1.00'
    tempRotation.value = '0.0'
    tempOpacity.value = '1.00'
    tempZIndex.value = '0'
    tempResolutionWidth.value = '1920'
    tempResolutionHeight.value = '1080'
  }
}

// 监听选中片段变化，更新本地状态
watch(selectedClip, updateLocalState, { immediate: true })

// 监听选中片段的变换属性变化
watch(
  () => selectedClip.value?.transform,
  (newTransform) => {
    if (newTransform && selectedClip.value && !isUpdatingFromExternal.value) {
      isUpdatingFromExternal.value = true

      // 只更新变换相关的属性，避免重复更新其他属性
      transformX.value = newTransform.x
      transformY.value = newTransform.y
      scaleX.value = newTransform.scaleX
      scaleY.value = newTransform.scaleY
      rotation.value = newTransform.rotation
      opacity.value = newTransform.opacity

      // 不要自动修改等比缩放状态，保持用户的选择
      // 只更新uniformScale的值（如果当前是等比缩放模式）
      if (proportionalScale.value) {
        uniformScale.value = newTransform.scaleX // 使用X轴缩放作为统一缩放值
      }

      // 更新临时输入值
      tempTransformX.value = transformX.value.toString()
      tempTransformY.value = transformY.value.toString()
      tempUniformScale.value = uniformScale.value.toFixed(2)
      tempScaleX.value = scaleX.value.toFixed(2)
      tempScaleY.value = scaleY.value.toFixed(2)
      tempRotation.value = rotation.value.toFixed(1)
      tempOpacity.value = opacity.value.toFixed(2)

      // 更新分辨率显示
      updateResolutionDisplay()

      // 下一个tick后重置标志
      nextTick(() => {
        isUpdatingFromExternal.value = false
      })
    }
  },
  { deep: true },
)

// 监听选中片段的zIndex变化
watch(
  () => selectedClip.value?.zIndex,
  (newZIndex) => {
    if (newZIndex !== undefined) {
      zIndex.value = newZIndex
      tempZIndex.value = zIndex.value.toString()
    }
  },
)

// 更新片段名称
const updateClipName = () => {
  if (selectedClip.value && clipName.value.trim()) {
    videoStore.updateClipName(selectedClip.value.id, clipName.value.trim())
  }
}

// 更新播放速度
const updatePlaybackRate = () => {
  if (selectedClip.value) {
    videoStore.updateClipPlaybackRate(selectedClip.value.id, playbackRate.value)
    // 同步更新目标时长和输入框值
    targetDuration.value = selectedClip.value.originalDuration / playbackRate.value
    speedInputValue.value = playbackRate.value
  }
}

// 更新目标时长
const updateTargetDuration = () => {
  if (selectedClip.value && targetDuration.value > 0) {
    const newPlaybackRate = selectedClip.value.originalDuration / targetDuration.value
    // 确保播放速度在合理范围内（0.1-100x）
    const clampedRate = Math.max(0.1, Math.min(100, newPlaybackRate))
    playbackRate.value = clampedRate
    // 更新归一化值
    normalizedSpeed.value = speedToNormalized(clampedRate)
    videoStore.updateClipPlaybackRate(selectedClip.value.id, clampedRate)
    // 重新计算实际时长（可能因为范围限制而有所调整）
    targetDuration.value = selectedClip.value.originalDuration / clampedRate
  }
}

// 更新归一化速度
const updateNormalizedSpeed = () => {
  const actualSpeed = normalizedToSpeed(normalizedSpeed.value)
  playbackRate.value = actualSpeed
  speedInputValue.value = actualSpeed
  updatePlaybackRate()
}

// 从输入框更新倍速
const updateSpeedFromInput = () => {
  if (speedInputValue.value && speedInputValue.value > 0) {
    // 确保倍速在合理范围内
    const clampedSpeed = Math.max(0.1, Math.min(100, speedInputValue.value))
    playbackRate.value = clampedSpeed
    speedInputValue.value = clampedSpeed
    // 更新归一化值和滑块位置
    normalizedSpeed.value = speedToNormalized(clampedSpeed)
    updatePlaybackRate()
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

// 格式化倍速显示值
const formatSpeedValue = (rate: number) => {
  if (rate >= 10) {
    return `${Math.round(rate)}x`
  } else if (rate >= 1) {
    return `${rate.toFixed(1)}x`
  } else {
    return `${rate.toFixed(2)}x`
  }
}

// 更新变换属性
const updateTransform = () => {
  if (selectedClip.value) {
    videoStore.updateClipTransform(selectedClip.value.id, {
      x: transformX.value,
      y: transformY.value,
      scaleX: scaleX.value,
      scaleY: scaleY.value,
      rotation: rotation.value,
      opacity: opacity.value,
    })
  }
}

// 切换等比缩放
const toggleProportionalScale = () => {
  if (proportionalScale.value) {
    // 开启等比缩放时，使用当前X缩放值作为统一缩放值
    uniformScale.value = scaleX.value
    scaleY.value = scaleX.value
    updateTransform()
  } else {
    // 关闭等比缩放时，保持当前的缩放值
    uniformScale.value = scaleX.value
  }
}

// 更新统一缩放
const updateUniformScale = () => {
  if (proportionalScale.value) {
    scaleX.value = uniformScale.value
    scaleY.value = uniformScale.value
    updateTransform()
  }
}

// 调整位置数值的方法
const adjustTransformX = (delta: number) => {
  transformX.value += delta
  tempTransformX.value = transformX.value.toString()
  updateTransform()
}

const adjustTransformY = (delta: number) => {
  transformY.value += delta
  tempTransformY.value = transformY.value.toString()
  updateTransform()
}

// 调整统一缩放数值的方法
const adjustUniformScale = (delta: number) => {
  uniformScale.value = Math.max(0.1, Math.min(10, uniformScale.value + delta))
  tempUniformScale.value = uniformScale.value.toFixed(2)
  updateUniformScale()
}

// 调整X缩放数值的方法
const adjustScaleX = (delta: number) => {
  scaleX.value = Math.max(0.1, Math.min(10, scaleX.value + delta))
  tempScaleX.value = scaleX.value.toFixed(2)
  updateTransform()
}

// 调整Y缩放数值的方法
const adjustScaleY = (delta: number) => {
  scaleY.value = Math.max(0.1, Math.min(10, scaleY.value + delta))
  tempScaleY.value = scaleY.value.toFixed(2)
  updateTransform()
}

// 调整旋转数值的方法
const adjustRotation = (delta: number) => {
  rotation.value = Math.max(-180, Math.min(180, rotation.value + delta))
  tempRotation.value = rotation.value.toFixed(1)
  updateTransform()
}

// 调整透明度数值的方法
const adjustOpacity = (delta: number) => {
  opacity.value = Math.max(0, Math.min(1, opacity.value + delta))
  tempOpacity.value = opacity.value.toFixed(2)
  updateTransform()
}

// 确认统一缩放输入（失焦或回车时）
const confirmUniformScaleFromInput = () => {
  const value = parseFloat(tempUniformScale.value)
  if (!isNaN(value)) {
    uniformScale.value = Math.max(0.1, Math.min(10, value))
    tempUniformScale.value = uniformScale.value.toFixed(2)
    updateUniformScale()
  } else {
    // 如果输入无效，恢复到当前值
    tempUniformScale.value = uniformScale.value.toFixed(2)
  }
}

// 确认X缩放输入（失焦或回车时）
const confirmScaleXFromInput = () => {
  const value = parseFloat(tempScaleX.value)
  if (!isNaN(value)) {
    scaleX.value = Math.max(0.1, Math.min(10, value))
    tempScaleX.value = scaleX.value.toFixed(2)
    updateTransform()
  } else {
    // 如果输入无效，恢复到当前值
    tempScaleX.value = scaleX.value.toFixed(2)
  }
}

// 确认Y缩放输入（失焦或回车时）
const confirmScaleYFromInput = () => {
  const value = parseFloat(tempScaleY.value)
  if (!isNaN(value)) {
    scaleY.value = Math.max(0.1, Math.min(10, value))
    tempScaleY.value = scaleY.value.toFixed(2)
    updateTransform()
  } else {
    // 如果输入无效，恢复到当前值
    tempScaleY.value = scaleY.value.toFixed(2)
  }
}

// 确认位置X输入（失焦或回车时）
const confirmTransformXFromInput = () => {
  const value = parseInt(tempTransformX.value)
  if (!isNaN(value)) {
    transformX.value = Math.max(
      -videoStore.videoResolution.width,
      Math.min(videoStore.videoResolution.width, value),
    )
    tempTransformX.value = transformX.value.toString()
    updateTransform()
  } else {
    // 如果输入无效，恢复到当前值
    tempTransformX.value = transformX.value.toString()
  }
}

// 确认位置Y输入（失焦或回车时）
const confirmTransformYFromInput = () => {
  const value = parseInt(tempTransformY.value)
  if (!isNaN(value)) {
    transformY.value = Math.max(
      -videoStore.videoResolution.height,
      Math.min(videoStore.videoResolution.height, value),
    )
    tempTransformY.value = transformY.value.toString()
    updateTransform()
  } else {
    // 如果输入无效，恢复到当前值
    tempTransformY.value = transformY.value.toString()
  }
}

// 确认旋转输入（失焦或回车时）
const confirmRotationFromInput = () => {
  const value = parseFloat(tempRotation.value)
  if (!isNaN(value)) {
    rotation.value = Math.max(-180, Math.min(180, value))
    tempRotation.value = rotation.value.toFixed(1)
    updateTransform()
  } else {
    // 如果输入无效，恢复到当前值
    tempRotation.value = rotation.value.toFixed(1)
  }
}

// 确认透明度输入（失焦或回车时）
const confirmOpacityFromInput = () => {
  const value = parseFloat(tempOpacity.value)
  if (!isNaN(value)) {
    opacity.value = Math.max(0, Math.min(1, value))
    tempOpacity.value = opacity.value.toFixed(2)
    updateTransform()
  } else {
    // 如果输入无效，恢复到当前值
    tempOpacity.value = opacity.value.toFixed(2)
  }
}

// 确认层级输入（失焦或回车时）
const confirmZIndexFromInput = () => {
  const value = parseInt(tempZIndex.value)
  if (!isNaN(value) && value >= 0) {
    zIndex.value = value
    tempZIndex.value = zIndex.value.toString()
    updateZIndex()
  } else {
    // 如果输入无效，恢复到当前值
    tempZIndex.value = zIndex.value.toString()
  }
}

// 更新层级
const updateZIndex = () => {
  if (selectedClip.value) {
    videoStore.updateClipZIndex(selectedClip.value.id, zIndex.value)
  }
}

// 删除片段
const removeClip = () => {
  if (selectedClip.value) {
    if (confirm('确定要删除这个视频片段吗？')) {
      videoStore.removeClip(selectedClip.value.id)
    }
  }
}

// 格式化时长
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

// 格式化分辨率
const formatResolution = (clip: VideoClip): string => {
  if (clip.originalWidth && clip.originalHeight) {
    return `${clip.originalWidth} × ${clip.originalHeight}`
  }
  return '未知'
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 计算当前分辨率
const getCurrentResolution = () => {
  if (!selectedClip.value) return { width: 1920, height: 1080 }

  // 从 store 获取视频原始分辨率
  const originalResolution = videoStore.getVideoOriginalResolution(selectedClip.value.id)

  const scaledWidth = Math.round(originalResolution.width * selectedClip.value.transform.scaleX)
  const scaledHeight = Math.round(originalResolution.height * selectedClip.value.transform.scaleY)

  return { width: scaledWidth, height: scaledHeight }
}

// 更新分辨率显示
const updateResolutionDisplay = () => {
  const resolution = getCurrentResolution()

  console.log('🔄 更新属性面板分辨率显示:')
  console.log('  - 计算的分辨率:', resolution)
  console.log('  - 更新前的输入框值:', {
    width: tempResolutionWidth.value,
    height: tempResolutionHeight.value
  })

  tempResolutionWidth.value = resolution.width.toString()
  tempResolutionHeight.value = resolution.height.toString()

  console.log('  - 更新后的输入框值:', {
    width: tempResolutionWidth.value,
    height: tempResolutionHeight.value
  })
}

// 确认分辨率输入
const confirmResolutionFromInput = () => {
  if (!selectedClip.value) return

  const newWidth = parseInt(tempResolutionWidth.value)
  const newHeight = parseInt(tempResolutionHeight.value)

  if (isNaN(newWidth) || isNaN(newHeight) || newWidth <= 0 || newHeight <= 0) {
    // 如果输入无效，恢复到当前值
    updateResolutionDisplay()
    return
  }

  // 从 store 获取视频原始分辨率
  const originalResolution = videoStore.getVideoOriginalResolution(selectedClip.value.id)

  const newScaleX = newWidth / originalResolution.width
  const newScaleY = newHeight / originalResolution.height

  // 限制缩放范围
  const clampedScaleX = Math.max(0.1, Math.min(10, newScaleX))
  const clampedScaleY = Math.max(0.1, Math.min(10, newScaleY))

  // 更新缩放值
  scaleX.value = clampedScaleX
  scaleY.value = clampedScaleY

  // 如果是等比缩放模式，使用平均值
  if (proportionalScale.value) {
    const avgScale = (clampedScaleX + clampedScaleY) / 2
    scaleX.value = avgScale
    scaleY.value = avgScale
    uniformScale.value = avgScale
    tempUniformScale.value = avgScale.toFixed(2)
  }

  // 更新临时缩放值
  tempScaleX.value = scaleX.value.toFixed(2)
  tempScaleY.value = scaleY.value.toFixed(2)

  // 应用变换
  updateTransform()

  // 重新计算并显示实际分辨率
  updateResolutionDisplay()
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
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.resolution-label {
  font-size: 10px;
  color: #ccc;
  margin: 0;
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
</style>

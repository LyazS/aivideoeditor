<template>
  <div class="properties-panel">
    <div class="panel-header">
      <h3>属性</h3>
    </div>

    <div class="panel-content">
      <!-- 多选状态 -->
      <div v-if="multiSelectInfo" class="multi-select-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" />
        </svg>
        <p>已选择 {{ multiSelectInfo.count }} 个片段</p>
        <p class="hint">批量操作功能开发中...</p>

        <!-- 选中项目列表 -->
        <div class="selected-items-list">
          <div v-for="item in multiSelectInfo.items" :key="item?.id" class="selected-item">
            <span class="item-name">
              {{
                item ? videoStore.getMediaItem(item.mediaItemId)?.name || '未知素材' : '未知素材'
              }}
            </span>
            <span class="item-type">{{ item?.mediaType === 'video' ? '视频' : '图片' }}</span>
          </div>
        </div>
      </div>

      <!-- 单选状态（现有内容保持不变） -->
      <div v-else-if="selectedTimelineItem" class="properties-content">
        <!-- 现有的属性编辑内容 -->
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
          v-if="
            selectedTimelineItem?.mediaType === 'video' ||
            selectedTimelineItem?.mediaType === 'image'
          "
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

          <!-- 音量控制 - 仅对视频显示 -->
          <div v-if="selectedTimelineItem?.mediaType === 'video'" class="property-item">
            <label>音量</label>
            <div class="volume-controls">
              <input
                :value="volume"
                @input="(e) => updateVolume((e.target as HTMLInputElement).valueAsNumber)"
                type="range"
                min="0"
                max="1"
                step="0.01"
                class="volume-slider"
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

        <!-- 统一关键帧控制 -->
        <div class="property-section unified-keyframe-section">
          <div class="section-header">
            <h4>关键帧动画</h4>
          </div>

          <!-- 关键帧控制按钮组 - 一行显示 -->
          <div class="keyframe-controls-row">
            <!-- 主关键帧按钮 -->
            <button
              class="unified-keyframe-toggle"
              :class="{
                'state-none': unifiedKeyframeButtonState === 'none',
                'state-on-keyframe': unifiedKeyframeButtonState === 'on-keyframe',
                'state-between-keyframes': unifiedKeyframeButtonState === 'between-keyframes',
              }"
              @click="toggleUnifiedKeyframe"
              :disabled="!canOperateUnifiedKeyframes"
              :title="getUnifiedKeyframeTooltip()"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 2L14 8L8 14L2 8L8 2Z"
                  fill="currentColor"
                  stroke="white"
                  stroke-width="1"
                />
              </svg>
              <span>关键帧</span>
            </button>

            <!-- 上一个关键帧 -->
            <button
              @click="goToPreviousUnifiedKeyframe"
              :disabled="!hasUnifiedPreviousKeyframe || !canOperateUnifiedKeyframes"
              class="keyframe-nav-btn"
              title="上一个关键帧"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z" />
              </svg>
              <span>上一帧</span>
            </button>

            <!-- 下一个关键帧 -->
            <button
              @click="goToNextUnifiedKeyframe"
              :disabled="!hasUnifiedNextKeyframe || !canOperateUnifiedKeyframes"
              class="keyframe-nav-btn"
              title="下一个关键帧"
            >
              <span>下一帧</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
              </svg>
            </button>

            <!-- 调试按钮 - 暂时隐藏 -->
            <button
              @click="debugUnifiedKeyframes"
              class="debug-btn"
              title="输出统一关键帧调试信息"
              style="display: none;"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6M9,8V17H11V8H9M13,8V17H15V8H13Z"
                />
              </svg>
              <span>调试</span>
            </button>
          </div>
        </div>

        <!-- 位置大小 -->
        <div class="property-section">
          <div class="section-header">
            <h4>位置大小</h4>
          </div>
          <!-- 位置：XY在同一行 -->
          <div class="property-item">
            <label>位置</label>
            <div class="position-controls">
              <div class="position-input-group">
                <span class="position-label">X</span>
                <NumberInput
                  :model-value="transformX"
                  @change="(value) => updateTransform({ x: value })"
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
                  @change="(value) => updateTransform({ y: value })"
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

      <!-- 无选择状态 -->
      <div v-else class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,16.5L18,9.5L16.5,8L11,13.5L7.5,10L6,11.5L11,16.5Z"
          />
        </svg>
        <p>选择片段查看属性</p>
        <p class="hint">在时间轴上点击视频片段</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { isVideoTimeRange } from '../types'
import { uiDegreesToWebAVRadians, webAVRadiansToUIDegrees } from '../utils/rotationTransform'
import { framesToTimecode, timecodeToFrames } from '../stores/utils/timeUtils'
import { useUnifiedKeyframeUI } from '../composables/useUnifiedKeyframeUI'
import NumberInput from './NumberInput.vue'

const videoStore = useVideoStore()

// 选中的时间轴项目
const selectedTimelineItem = computed(() => {
  // 多选模式时返回null，显示占位内容
  if (videoStore.isMultiSelectMode) return null

  // 单选模式时返回选中项
  if (!videoStore.selectedTimelineItemId) return null
  return videoStore.getTimelineItem(videoStore.selectedTimelineItemId) || null
})

// 当前播放帧数
const currentFrame = computed(() => videoStore.currentFrame)

// 统一关键帧UI管理
const {
  keyframeUIState: unifiedKeyframeUIState,
  buttonState: unifiedKeyframeButtonState,
  toggleKeyframe: toggleUnifiedKeyframe,
  handlePropertyChange: handleUnifiedPropertyChange,
  goToPreviousKeyframe: goToPreviousUnifiedKeyframe,
  goToNextKeyframe: goToNextUnifiedKeyframe,
  hasPreviousKeyframe: hasUnifiedPreviousKeyframe,
  hasNextKeyframe: hasUnifiedNextKeyframe,
  clearAllKeyframes: clearUnifiedKeyframes,
  isPlayheadInClip: isUnifiedPlayheadInClip,
  canOperateKeyframes: canOperateUnifiedKeyframes,
} = useUnifiedKeyframeUI(selectedTimelineItem, currentFrame)

// 多选状态信息
const multiSelectInfo = computed(() => {
  if (!videoStore.isMultiSelectMode) return null

  return {
    count: videoStore.selectedTimelineItemIds.size,
    items: Array.from(videoStore.selectedTimelineItemIds)
      .map((id) => videoStore.getTimelineItem(id))
      .filter(Boolean),
  }
})

// 选中项目对应的素材
const selectedMediaItem = computed(() => {
  if (!selectedTimelineItem.value) return null
  return videoStore.getMediaItem(selectedTimelineItem.value.mediaItemId) || null
})

// 时间轴时长（帧数）
const timelineDurationFrames = computed(() => {
  if (!selectedTimelineItem.value) return 0
  const timeRange = selectedTimelineItem.value.timeRange
  return timeRange.timelineEndTime - timeRange.timelineStartTime // 已经是帧数，不需要转换
})

// 格式化时长显示（使用时间码格式）
const formattedDuration = computed(() => {
  return framesToTimecode(timelineDurationFrames.value)
})

// 时间码输入框的临时值
const timecodeInput = computed({
  get: () => formattedDuration.value,
  set: (value) => {
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

// 变换属性 - 基于TimelineItem的响应式计算属性
const transformX = computed(() => selectedTimelineItem.value?.x || 0)
const transformY = computed(() => selectedTimelineItem.value?.y || 0)
const scaleX = computed(() => {
  if (!selectedTimelineItem.value || !selectedMediaItem.value) return 1
  const originalResolution =
    selectedMediaItem.value.mediaType === 'video'
      ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
      : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)
  return selectedTimelineItem.value.width / originalResolution.width
})
const scaleY = computed(() => {
  if (!selectedTimelineItem.value || !selectedMediaItem.value) return 1
  const originalResolution =
    selectedMediaItem.value.mediaType === 'video'
      ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
      : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)
  return selectedTimelineItem.value.height / originalResolution.height
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
  // 直接使用TimelineItem中的width/height属性，这是缩放后的实际尺寸
  return {
    width: Math.round(selectedTimelineItem.value.width),
    height: Math.round(selectedTimelineItem.value.height),
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

// 音量相关 - 直接从TimelineItem读取，这是响应式的
const volume = computed(() => {
  if (!selectedTimelineItem.value || selectedTimelineItem.value.mediaType !== 'video') return 1
  // 确保 volume 和 isMuted 都有默认值
  const itemVolume = selectedTimelineItem.value.volume ?? 1
  const itemMuted = selectedTimelineItem.value.isMuted ?? false
  // 静音时显示0，否则显示实际音量
  return itemMuted ? 0 : itemVolume
})

const isMuted = computed(() => {
  if (!selectedTimelineItem.value || selectedTimelineItem.value.mediaType !== 'video') return false
  return selectedTimelineItem.value.isMuted ?? false
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
        playbackRate: rate,
      })
      console.log('✅ 倍速更新成功')
    } catch (error) {
      console.error('❌ 更新倍速失败:', error)
      // 如果历史记录更新失败，回退到直接更新
      videoStore.updateTimelineItemPlaybackRate(selectedTimelineItem.value.id, rate)
    }
  }
}

// 更新目标时长（从时间码输入）
const updateTargetDurationFromTimecode = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const timecodeValue = input.value.trim()

  if (!timecodeValue || !selectedTimelineItem.value || !selectedMediaItem.value) {
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
  if (!selectedTimelineItem.value || !selectedMediaItem.value) {
    return
  }

  const alignedDurationFrames = Math.max(1, newDurationFrames) // 最少1帧
  const sprite = selectedTimelineItem.value.sprite
  const timeRange = selectedTimelineItem.value.timeRange
  const oldDurationFrames = timeRange.timelineEndTime - timeRange.timelineStartTime // 计算旧时长
  const newTimelineEndTime = timeRange.timelineStartTime + alignedDurationFrames // 帧数相加，不需要转换

  // 🎯 关键帧位置调整：在更新timeRange之前调整关键帧位置
  if (
    selectedTimelineItem.value.animation &&
    selectedTimelineItem.value.animation.keyframes.length > 0
  ) {
    const { adjustKeyframesForDurationChange } = await import('../utils/unifiedKeyframeUtils')
    adjustKeyframesForDurationChange(
      selectedTimelineItem.value,
      oldDurationFrames,
      alignedDurationFrames,
    )
    console.log('🎬 [Duration Update] Keyframes adjusted for duration change:', {
      oldDuration: oldDurationFrames,
      newDuration: alignedDurationFrames,
    })
  }

  if (selectedTimelineItem.value.mediaType === 'video') {
    if (isVideoTimeRange(timeRange)) {
      sprite.setTimeRange({
        clipStartTime: timeRange.clipStartTime,
        clipEndTime: timeRange.clipEndTime,
        timelineStartTime: timeRange.timelineStartTime,
        timelineEndTime: newTimelineEndTime,
      })
    }
  } else if (selectedTimelineItem.value.mediaType === 'image') {
    sprite.setTimeRange({
      timelineStartTime: timeRange.timelineStartTime,
      timelineEndTime: newTimelineEndTime,
    })
  }

  // 更新timelineItem的timeRange
  selectedTimelineItem.value.timeRange = sprite.getTimeRange()

  // 如果有动画，需要重新设置WebAV动画时长
  if (selectedTimelineItem.value.animation && selectedTimelineItem.value.animation.isEnabled) {
    const { updateWebAVAnimation } = await import('../utils/webavAnimationManager')
    await updateWebAVAnimation(selectedTimelineItem.value)
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
  if (!selectedTimelineItem.value || selectedTimelineItem.value.mediaType !== 'video') return

  const clampedVolume = Math.max(0, Math.min(1, newVolume))

  // 确保属性存在，如果不存在则初始化
  if (selectedTimelineItem.value.volume === undefined) {
    selectedTimelineItem.value.volume = 1
  }
  if (selectedTimelineItem.value.isMuted === undefined) {
    selectedTimelineItem.value.isMuted = false
  }

  // 使用历史记录系统更新音量
  if (clampedVolume === 0) {
    // 设为静音，但保留原音量值
    videoStore.updateTimelineItemTransformWithHistory(selectedTimelineItem.value.id, {
      isMuted: true,
    })
  } else {
    // 更新音量值并取消静音
    videoStore.updateTimelineItemTransformWithHistory(selectedTimelineItem.value.id, {
      volume: clampedVolume,
      isMuted: false,
    })
  }

  console.log('✅ 音量更新成功:', clampedVolume)
}

// 切换静音状态
const toggleMute = () => {
  if (!selectedTimelineItem.value || selectedTimelineItem.value.mediaType !== 'video') return

  // 确保属性存在，如果不存在则初始化
  if (selectedTimelineItem.value.volume === undefined) {
    selectedTimelineItem.value.volume = 1
  }
  if (selectedTimelineItem.value.isMuted === undefined) {
    selectedTimelineItem.value.isMuted = false
  }

  const newMutedState = !selectedTimelineItem.value.isMuted

  // 使用历史记录系统切换静音状态
  videoStore.updateTimelineItemTransformWithHistory(selectedTimelineItem.value.id, {
    isMuted: newMutedState,
  })

  console.log(
    '✅ 静音状态切换:',
    newMutedState ? '静音' : '有声',
    '音量保持:',
    selectedTimelineItem.value.volume,
  )
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
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  opacity?: number
  zIndex?: number
}) => {
  if (!selectedTimelineItem.value) return

  // 如果没有提供transform参数，使用当前的响应式值
  const finalTransform = transform || {
    x: transformX.value,
    y: transformY.value,
    width: selectedTimelineItem.value.width,
    height: selectedTimelineItem.value.height,
    rotation: rotation.value,
    opacity: opacity.value,
    zIndex: zIndex.value,
  }

  // 统一关键帧系统处理 - 根据当前状态自动处理关键帧创建/更新
  // 注意：updateUnifiedProperty 已经包含了实时渲染更新，所以不需要再调用 updateTimelineItemTransformWithHistory
  if (finalTransform.x !== undefined) {
    await updateUnifiedProperty('x', finalTransform.x)
  }
  if (finalTransform.y !== undefined) {
    await updateUnifiedProperty('y', finalTransform.y)
  }
  if (finalTransform.width !== undefined) {
    await updateUnifiedProperty('width', finalTransform.width)
  }
  if (finalTransform.height !== undefined) {
    await updateUnifiedProperty('height', finalTransform.height)
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
    try {
      // 使用带历史记录的变换属性更新方法（仅用于非关键帧属性）
      await videoStore.updateTimelineItemTransformWithHistory(
        selectedTimelineItem.value.id,
        otherTransform,
      )
      console.log('✅ 其他变换属性更新成功')
    } catch (error) {
      console.error('❌ 更新其他变换属性失败:', error)
      // 如果历史记录更新失败，回退到直接更新
      videoStore.updateTimelineItemTransform(selectedTimelineItem.value.id, otherTransform)
    }
  }

  console.log('✅ 统一关键帧变换属性更新完成')
}

// 切换等比缩放
const toggleProportionalScale = () => {
  if (proportionalScale.value && selectedTimelineItem.value && selectedMediaItem.value) {
    // 开启等比缩放时，使用当前X缩放值作为统一缩放值，同时更新Y缩放
    const originalResolution =
      selectedMediaItem.value.mediaType === 'video'
        ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
        : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)
    const newSize = {
      width: originalResolution.width * scaleX.value,
      height: originalResolution.height * scaleX.value, // 使用X缩放值保持等比
    }
    updateTransform({ width: newSize.width, height: newSize.height })
  }
}

// 更新统一缩放
const updateUniformScale = (newScale: number) => {
  if (proportionalScale.value && selectedTimelineItem.value && selectedMediaItem.value) {
    const originalResolution =
      selectedMediaItem.value.mediaType === 'video'
        ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
        : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)
    const newSize = {
      width: originalResolution.width * newScale,
      height: originalResolution.height * newScale,
    }
    updateTransform({ width: newSize.width, height: newSize.height })
  }
}

// 设置X缩放绝对值的方法
const setScaleX = (value: number) => {
  if (!selectedTimelineItem.value || !selectedMediaItem.value) return
  const originalResolution =
    selectedMediaItem.value.mediaType === 'video'
      ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
      : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)
  const newScaleX = Math.max(0.01, Math.min(5, value))
  const newSize = {
    width: originalResolution.width * newScaleX,
    height: selectedTimelineItem.value.height, // 保持Y尺寸不变
  }
  updateTransform({ width: newSize.width, height: newSize.height })
}

// 设置Y缩放绝对值的方法
const setScaleY = (value: number) => {
  if (!selectedTimelineItem.value || !selectedMediaItem.value) return
  const originalResolution =
    selectedMediaItem.value.mediaType === 'video'
      ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
      : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)
  const newScaleY = Math.max(0.01, Math.min(5, value))
  const newSize = {
    width: selectedTimelineItem.value.width, // 保持X尺寸不变
    height: originalResolution.height * newScaleY,
  }
  updateTransform({ width: newSize.width, height: newSize.height })
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

// ==================== 统一关键帧辅助函数 ====================

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

/**
 * 更新属性值（统一关键帧版本）
 * 根据当前状态自动处理关键帧创建，同时确保实时渲染更新
 */
const updateUnifiedProperty = async (property: string, value: any) => {
  if (!selectedTimelineItem.value) return

  try {
    // 1. 使用统一关键帧的属性修改处理（更新关键帧数据）
    await handleUnifiedPropertyChange(property, value)

    // 2. 重要：更新TimelineItem的实际属性值（这会触发响应式更新）
    // 这一步确保属性面板显示正确的值
    if (property === 'x') selectedTimelineItem.value.x = value
    else if (property === 'y') selectedTimelineItem.value.y = value
    else if (property === 'width') selectedTimelineItem.value.width = value
    else if (property === 'height') selectedTimelineItem.value.height = value
    else if (property === 'rotation') selectedTimelineItem.value.rotation = value
    else if (property === 'opacity') selectedTimelineItem.value.opacity = value

    // 3. 更新sprite的实时属性（触发WebAV的实时渲染和preframe）
    const sprite = selectedTimelineItem.value.sprite
    if (sprite) {
      // 构建变换对象，只包含当前修改的属性
      const transform: any = {}

      if (property === 'x' || property === 'y') {
        // 位置更新需要坐标转换
        const { projectToWebavCoords } = await import('../utils/coordinateTransform')
        const webavCoords = projectToWebavCoords(
          selectedTimelineItem.value.x,
          selectedTimelineItem.value.y,
          selectedTimelineItem.value.width,
          selectedTimelineItem.value.height,
          videoStore.videoResolution.width,
          videoStore.videoResolution.height,
        )
        transform.x = webavCoords.x
        transform.y = webavCoords.y
      } else if (property === 'width') {
        // 🔧 中心缩放：更新宽度时需要重新计算位置以保持中心不变
        transform.w = value
        const { projectToWebavCoords } = await import('../utils/coordinateTransform')
        const webavCoords = projectToWebavCoords(
          selectedTimelineItem.value.x,
          selectedTimelineItem.value.y,
          value, // 使用新的宽度
          selectedTimelineItem.value.height,
          videoStore.videoResolution.width,
          videoStore.videoResolution.height,
        )
        transform.x = webavCoords.x
        transform.y = webavCoords.y
      } else if (property === 'height') {
        // 🔧 中心缩放：更新高度时需要重新计算位置以保持中心不变
        transform.h = value
        const { projectToWebavCoords } = await import('../utils/coordinateTransform')
        const webavCoords = projectToWebavCoords(
          selectedTimelineItem.value.x,
          selectedTimelineItem.value.y,
          selectedTimelineItem.value.width,
          value, // 使用新的高度
          videoStore.videoResolution.width,
          videoStore.videoResolution.height,
        )
        transform.x = webavCoords.x
        transform.y = webavCoords.y
      } else if (property === 'rotation') {
        transform.angle = value
      } else if (property === 'opacity') {
        // 透明度属性需要直接设置到sprite，而不是sprite.rect
        sprite.opacity = value
      }

      // 更新sprite属性（这会触发propsChange事件和实时渲染）
      if (Object.keys(transform).length > 0) {
        Object.assign(sprite.rect, transform)
      }

      // 手动触发preframe以确保立即更新渲染
      const currentTime = videoStore.currentFrame * (1000000 / 30) // 转换为微秒
      sprite.preFrame(currentTime)
    }

    console.log('🎬 [Unified Property] Property updated with real-time rendering:', {
      property,
      value,
      buttonState: unifiedKeyframeButtonState.value,
    })
  } catch (error) {
    console.error('🎬 [Unified Property] Failed to update property:', error)
  }
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

    updateTransform({ x: Math.round(newProjectX) })

    console.log('✅ 水平对齐完成:', alignment, '项目坐标X:', Math.round(newProjectX))
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

    updateTransform({ y: Math.round(newProjectY) })

    console.log('✅ 垂直对齐完成:', alignment, '项目坐标Y:', Math.round(newProjectY))
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
  flex: 1;
}

/* 时间码输入框样式 */
.timecode-input {
  width: 100%;
  padding: var(--spacing-md);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-medium);
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-family: 'Courier New', monospace;
  font-size: var(--font-size-lg);
  text-align: center;
  transition: border-color 0.2s ease;
  min-height: 30px;
}

.timecode-input:focus {
  outline: none;
  border-color: var(--color-accent-secondary);
  box-shadow: 0 0 0 2px rgba(192, 192, 192, 0.2);
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
  width: 12px;
  height: 12px;
  background: var(--color-accent-secondary);
  border-radius: 50%;
  cursor: pointer;
}

.segmented-speed-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: var(--color-accent-secondary);
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

/* 音量控制样式 */
.volume-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
}

.volume-slider {
  flex: 1;
  height: 4px;
  background: var(--color-bg-quaternary);
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: var(--color-accent-secondary);
  border-radius: 50%;
  cursor: pointer;
}

.volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: var(--color-accent-secondary);
  border-radius: 50%;
  border: none;
  cursor: pointer;
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

/* 多选状态样式 */
.multi-select-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  text-align: center;
  color: var(--color-text-secondary);
  padding: var(--spacing-lg);
}

.multi-select-state svg {
  color: var(--color-success);
  margin-bottom: var(--spacing-md);
}

.multi-select-state p {
  margin: var(--spacing-xs) 0;
  font-size: var(--font-size-base);
}

.multi-select-state .hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-hint);
}

.selected-items-list {
  margin-top: var(--spacing-lg);
  width: 100%;
  max-height: 150px;
  overflow-y: auto;
}

.selected-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
  background: var(--color-bg-quaternary);
  border-radius: var(--border-radius-small);
  font-size: var(--font-size-sm);
}

.selected-item .item-name {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: var(--spacing-sm);
}

.selected-item .item-type {
  color: var(--color-text-hint);
  font-size: var(--font-size-xs);
  flex-shrink: 0;
}

/* 统一关键帧按钮样式 */
.unified-keyframe-toggle {
  display: flex;
  align-items: center;
  gap: 0px;
  padding: 0px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-primary); /* 默认白色 */
  height: 36px; /* 改为固定高度，与导航按钮一致 */
  position: relative;
}

.unified-keyframe-toggle:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-hover);
  transform: translateY(-1px);
}

/* 状态样式 */
.unified-keyframe-toggle.state-none {
  color: var(--color-text-primary); /* 白色 */
  border-color: var(--color-border);
}

.unified-keyframe-toggle.state-none:hover {
  border-color: var(--color-border-hover);
  background: var(--color-bg-tertiary);
}

.unified-keyframe-toggle.state-on-keyframe {
  color: var(--color-text-primary); /* 白色字体 */
  background: rgba(64, 158, 255, 0.2);
  border-color: #409eff;
  box-shadow: 0 0 8px rgba(64, 158, 255, 0.4);
}

.unified-keyframe-toggle.state-on-keyframe svg {
  color: #409eff; /* 钻石图标保持更亮的蓝色 */
}

.unified-keyframe-toggle.state-on-keyframe:hover {
  background: rgba(64, 158, 255, 0.3);
  box-shadow: 0 0 12px rgba(64, 158, 255, 0.6);
}

.unified-keyframe-toggle.state-between-keyframes {
  color: #ffd700; /* 金色 */
  background: rgba(255, 215, 0, 0.15);
  border-color: #ffd700;
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
}

.unified-keyframe-toggle.state-between-keyframes:hover {
  background: rgba(255, 215, 0, 0.25);
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.5);
}

/* 禁用状态样式 */
.unified-keyframe-toggle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: var(--color-bg-disabled);
  color: var(--color-text-disabled);
  border-color: var(--color-border-disabled);
  box-shadow: none;
}

.unified-keyframe-toggle:disabled:hover {
  background: var(--color-bg-disabled);
  border-color: var(--color-border-disabled);
  transform: none;
  box-shadow: none;
}

/* 关键帧控制按钮行 */
.keyframe-controls-row {
  display: flex;
  gap: 6px;
  align-items: stretch; /* 让所有按钮高度一致 */
  margin-bottom: 16px;
  flex-wrap: wrap; /* 在小屏幕上允许换行 */
}

/* 主关键帧按钮 */
.keyframe-controls-row .unified-keyframe-toggle {
  flex: 1 1 auto; /* 主按钮占据更多空间 */
  min-width: 90px;
  max-width: 120px;
  font-size: 14px; /* 与导航按钮保持一致 */
  height: 36px; /* 确保与导航按钮高度一致 */
}

/* 导航和调试按钮 */
.keyframe-controls-row .keyframe-nav-btn,
.keyframe-controls-row .debug-btn {
  flex: 0 0 auto;
  padding: 8px 10px;
  font-size: 11px;
  min-width: 55px;
  height: 36px; /* 与主按钮高度一致 */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.keyframe-controls-row .keyframe-nav-btn:hover:not(:disabled),
.keyframe-controls-row .debug-btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-hover);
  transform: translateY(-1px);
}

.keyframe-controls-row .keyframe-nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: var(--color-bg-disabled);
  color: var(--color-text-disabled);
}

.keyframe-controls-row .keyframe-nav-btn span,
.keyframe-controls-row .debug-btn span,
.keyframe-controls-row .unified-keyframe-toggle span {
  font-size: 10px;
  white-space: nowrap;
}

/* 响应式调整 */
@media (max-width: 400px) {
  .keyframe-controls-row {
    flex-wrap: wrap;
    gap: 4px;
  }

  .keyframe-controls-row .unified-keyframe-toggle {
    flex: 1 1 100%;
    margin-bottom: 4px;
  }

  .keyframe-controls-row .keyframe-nav-btn,
  .keyframe-controls-row .debug-btn {
    flex: 1 1 calc(33.333% - 3px);
    min-width: 0;
  }
}

/* 属性项布局调整，为钻石框留出空间 */
.property-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.property-item label {
  flex-shrink: 0;
  min-width: 60px;
}

/* 区域标题头部布局 */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
}

.section-header h4 {
  margin: 0;
  flex: 1;
}

.property-item .position-controls,
.property-item .scale-controls,
.property-item .rotation-controls,
.property-item .opacity-controls {
  flex: 1;
}
</style>

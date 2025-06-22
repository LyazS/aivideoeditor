<template>
  <div class="properties-panel">
    <div class="panel-header">
      <h3>属性</h3>
    </div>

    <div class="panel-content">
      <!-- 多选状态 -->
      <div v-if="multiSelectInfo" class="multi-select-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
        </svg>
        <p>已选择 {{ multiSelectInfo.count }} 个片段</p>
        <p class="hint">批量操作功能开发中...</p>

        <!-- 选中项目列表 -->
        <div class="selected-items-list">
          <div
            v-for="item in multiSelectInfo.items"
            :key="item?.id"
            class="selected-item"
          >
            <span class="item-name">
              {{ item ? videoStore.getMediaItem(item.mediaItemId)?.name || '未知素材' : '未知素材' }}
            </span>
            <span class="item-type">{{ item ? (item.mediaType === 'video' ? '视频' : '图片') : '未知' }}</span>
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

          <!-- 音量控制 - 仅对视频显示 -->
          <div v-if="selectedTimelineItem?.mediaType === 'video'" class="property-item">
            <label>音量</label>
            <div class="volume-controls">
              <input
                :value="displayVolume"
                @input="(e) => updateVolume((e.target as HTMLInputElement).valueAsNumber)"
                type="range"
                min="0"
                max="1"
                step="0.01"
                class="volume-slider"
              />
              <NumberInput
                :model-value="actualVolume"
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
                  <path d="M3,9V15H7L12,20V4L7,9H3M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23Z"/>
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 🆕 动画控制区域 -->
        <div class="property-section">
          <h4>动画控制</h4>
          <div class="property-item">
            <div class="animation-controls">
              <!-- 关键帧导航按钮 -->
              <div v-if="hasAnimation && keyFrameCount > 0" class="keyframe-navigation">
                <button
                  @click="goToPrevKeyFrame"
                  class="nav-btn"
                  title="跳转到上一个关键帧"
                >
                  ⏮️ 上一帧
                </button>
                <button
                  @click="goToNextKeyFrame"
                  class="nav-btn"
                  title="跳转到下一个关键帧"
                >
                  ⏭️ 下一帧
                </button>
              </div>

              <!-- 调试和控制按钮 -->
              <div class="debug-controls">
                <button @click="debugKeyFrames" class="debug-btn">
                  🔍 调试信息
                </button>
                <button
                  v-if="hasAnimation"
                  @click="clearAnimation"
                  class="debug-btn danger"
                  title="清除所有动画，转换为静态属性"
                >
                  🗑️ 清除动画
                </button>
                <button
                  v-if="hasAnimation"
                  @click="toggleAnimationEnabled"
                  class="debug-btn"
                  :title="selectedTimelineItem?.animationConfig?.isEnabled ? '禁用动画' : '启用动画'"
                >
                  {{ selectedTimelineItem?.animationConfig?.isEnabled ? '⏸️ 禁用' : '▶️ 启用' }}
                </button>
              </div>
            </div>
            <div v-if="hasAnimation" class="animation-status">
              <span class="status-indicator active">
                🎬 带动画clip {{ selectedTimelineItem?.animationConfig?.isEnabled ? '(已启用)' : '(已禁用)' }}
              </span>
              <span class="keyframe-count">{{ keyFrameCount }} 个关键帧</span>
              <span class="animation-mode-hint">属性修改 → 自动创建/更新关键帧</span>
            </div>
            <div v-else class="animation-status">
              <span class="status-indicator inactive">📄 非动画clip</span>
              <span class="hint">点击属性旁的◆按钮创建关键帧转换为动画clip</span>
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
                  @change="(value) => updatePositionProperty('x', value)"
                  :min="-videoStore.videoResolution.width"
                  :max="videoStore.videoResolution.width"
                  :step="1"
                  :precision="0"
                  placeholder="中心为0"
                  :input-style="positionInputStyle"
                />
                <span v-if="hasAnimation" class="property-mode-indicator animated" title="由关键帧驱动">🎬</span>
                <span v-else class="property-mode-indicator static" title="静态值">📄</span>
              </div>
              <div class="position-input-group">
                <span class="position-label">Y</span>
                <NumberInput
                  :model-value="transformY"
                  @change="(value) => updatePositionProperty('y', value)"
                  :min="-videoStore.videoResolution.height"
                  :max="videoStore.videoResolution.height"
                  :step="1"
                  :precision="0"
                  placeholder="中心为0"
                  :input-style="positionInputStyle"
                />
                <span v-if="hasAnimation" class="property-mode-indicator animated" title="由关键帧驱动">🎬</span>
                <span v-else class="property-mode-indicator static" title="静态值">📄</span>
              </div>
              <!-- 位置关键帧按钮 -->
              <div class="position-keyframe-button">
                <KeyFrameButton
                  property="position"
                  :has-keyframe="hasPositionKeyFrame"
                  @toggle-keyframe="handleTogglePositionKeyFrame"
                  :title="hasPositionKeyFrame ? '删除位置关键帧(X,Y)' : '添加位置关键帧(X,Y)'"
                />
                <span class="position-label-indicator">XY</span>
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
              <span v-if="hasAnimation" class="property-mode-indicator animated" title="由关键帧驱动">🎬</span>
              <span v-else class="property-mode-indicator static" title="静态值">📄</span>
              <KeyFrameButton
                property="width"
                :has-keyframe="hasKeyFrameAtTime('width')"
                @toggle-keyframe="handleToggleKeyFrame"
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
                <span v-if="hasAnimation" class="property-mode-indicator animated" title="由关键帧驱动">🎬</span>
                <span v-else class="property-mode-indicator static" title="静态值">📄</span>
                <KeyFrameButton
                  property="width"
                  :has-keyframe="hasKeyFrameAtTime('width')"
                  @toggle-keyframe="handleToggleKeyFrame"
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
                <span v-if="hasAnimation" class="property-mode-indicator animated" title="由关键帧驱动">🎬</span>
                <span v-else class="property-mode-indicator static" title="静态值">📄</span>
                <KeyFrameButton
                  property="height"
                  :has-keyframe="hasKeyFrameAtTime('height')"
                  @toggle-keyframe="handleToggleKeyFrame"
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
              <span v-if="hasAnimation" class="property-mode-indicator animated" title="由关键帧驱动">🎬</span>
              <span v-else class="property-mode-indicator static" title="静态值">📄</span>
              <KeyFrameButton
                property="rotation"
                :has-keyframe="hasKeyFrameAtTime('rotation')"
                @toggle-keyframe="handleToggleKeyFrame"
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
              <span v-if="hasAnimation" class="property-mode-indicator animated" title="由关键帧驱动">🎬</span>
              <span v-else class="property-mode-indicator static" title="静态值">📄</span>
              <KeyFrameButton
                property="opacity"
                :has-keyframe="hasKeyFrameAtTime('opacity')"
                @toggle-keyframe="handleToggleKeyFrame"
              />
            </div>
          </div>
          <div class="property-item">
            <label>层级</label>
            <div class="property-controls">
              <NumberInput
                :model-value="zIndex"
                @change="(value) => updatePropertySmart('zIndex', value)"
                :min="0"
                :step="1"
                :precision="0"
                :input-style="scaleInputStyle"
              />
              <span v-if="hasAnimation" class="property-mode-indicator animated" title="由关键帧驱动">🎬</span>
              <span v-else class="property-mode-indicator static" title="静态值">📄</span>
            </div>
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
import { computed, watch } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { isVideoTimeRange } from '../types/videoTypes'
import { uiDegreesToWebAVRadians, webAVRadiansToUIDegrees } from '../utils/rotationTransform'
import { useKeyFrameAnimation } from '../composables/useKeyFrameAnimation'
import { getCurrentPropertyValue, getPropertyValueAtTime } from '../utils/animationUtils'
import { ClearAnimationCommand } from '../stores/modules/commands/keyFrameCommands'
import { UpdateTransformCommand } from '../stores/modules/commands/timelineCommands'
import NumberInput from './NumberInput.vue'
import KeyFrameButton from './KeyFrameButton.vue'
import type { AnimatableProperty } from '../types/animationTypes'

const videoStore = useVideoStore()

// 🆕 动画管理功能
const {
  setSelectedTimelineItem,
  hasAnimation,
  keyFrameCount,
  hasKeyFrameAtTime,
  goToNextKeyFrame,
  goToPrevKeyFrame
} = useKeyFrameAnimation()

// 选中的时间轴项目
const selectedTimelineItem = computed(() => {
  // 多选模式时返回null，显示占位内容
  if (videoStore.isMultiSelectMode) return null

  // 单选模式时返回选中项
  if (!videoStore.selectedTimelineItemId) return null
  return videoStore.getTimelineItem(videoStore.selectedTimelineItemId) || null
})

// 多选状态信息
const multiSelectInfo = computed(() => {
  if (!videoStore.isMultiSelectMode) return null

  return {
    count: videoStore.selectedTimelineItemIds.size,
    items: Array.from(videoStore.selectedTimelineItemIds).map(id =>
      videoStore.getTimelineItem(id)
    ).filter(Boolean)
  }
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

// 🆕 智能变换属性 - 根据动画状态显示插值或静态值
const transformX = computed(() => {
  if (!selectedTimelineItem.value) return 0

  if (hasAnimation.value) {
    // 有动画：从position关键帧获取X值
    const positionValue = getPropertyValueAtTime(
      selectedTimelineItem.value,
      'position',
      videoStore.currentTime
    )
    // position值是{x, y}对象，取x值
    return typeof positionValue === 'object' && positionValue !== null ? positionValue.x : selectedTimelineItem.value.x
  } else {
    // 无动画：显示TimelineItem属性
    return selectedTimelineItem.value.x
  }
})

const transformY = computed(() => {
  if (!selectedTimelineItem.value) return 0

  if (hasAnimation.value) {
    // 有动画：从position关键帧获取Y值
    const positionValue = getPropertyValueAtTime(
      selectedTimelineItem.value,
      'position',
      videoStore.currentTime
    )
    // position值是{x, y}对象，取y值
    return typeof positionValue === 'object' && positionValue !== null ? positionValue.y : selectedTimelineItem.value.y
  } else {
    // 无动画：显示TimelineItem属性
    return selectedTimelineItem.value.y
  }
})
const scaleX = computed(() => {
  if (!selectedTimelineItem.value || !selectedMediaItem.value) return 1
  const originalResolution = selectedMediaItem.value.mediaType === 'video'
    ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
    : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)
  return selectedTimelineItem.value.width / originalResolution.width
})
const scaleY = computed(() => {
  if (!selectedTimelineItem.value || !selectedMediaItem.value) return 1
  const originalResolution = selectedMediaItem.value.mediaType === 'video'
    ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
    : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)
  return selectedTimelineItem.value.height / originalResolution.height
})
const rotation = computed(() => {
  if (!selectedTimelineItem.value) return 0

  let radians = 0
  if (hasAnimation.value) {
    // 有动画：显示当前时间点的插值
    radians = getPropertyValueAtTime(
      selectedTimelineItem.value,
      'rotation',
      videoStore.currentTime
    )
  } else {
    // 无动画：显示TimelineItem属性
    radians = selectedTimelineItem.value.rotation
  }

  return webAVRadiansToUIDegrees(radians)
})

const opacity = computed(() => {
  if (!selectedTimelineItem.value) return 1

  if (hasAnimation.value) {
    // 有动画：显示当前时间点的插值
    return getPropertyValueAtTime(
      selectedTimelineItem.value,
      'opacity',
      videoStore.currentTime
    )
  } else {
    // 无动画：显示TimelineItem属性
    return selectedTimelineItem.value.opacity
  }
})

const zIndex = computed(() => {
  if (!selectedTimelineItem.value) return 0

  if (hasAnimation.value) {
    // 有动画：显示当前时间点的插值
    return getPropertyValueAtTime(
      selectedTimelineItem.value,
      'zIndex',
      videoStore.currentTime
    )
  } else {
    // 无动画：显示TimelineItem属性
    return selectedTimelineItem.value.zIndex
  }
})

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
  // 🆕 直接使用TimelineItem的width/height属性，这是缩放后的实际尺寸
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
// 实际音量值（用于数值输入框，不受静音状态影响）
const actualVolume = computed(() => {
  if (!selectedTimelineItem.value || selectedTimelineItem.value.mediaType !== 'video') return 1
  return selectedTimelineItem.value.volume ?? 1
})

// 显示音量值（用于滑块，静音时显示0）
const displayVolume = computed(() => {
  if (!selectedTimelineItem.value || selectedTimelineItem.value.mediaType !== 'video') return 1
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

// 🆕 更新音量 - 使用带历史记录的属性更新
const updateVolume = (newVolume: number) => {
  if (!selectedTimelineItem.value || selectedTimelineItem.value.mediaType !== 'video') return

  const clampedVolume = Math.max(0, Math.min(1, newVolume))

  // 总是更新音量值
  updatePropertyWithHistory('volume', clampedVolume)

  // 如果音量大于0且当前是静音状态，则取消静音
  if (clampedVolume > 0 && selectedTimelineItem.value.isMuted) {
    updatePropertyWithHistory('isMuted', false)
  }
  // 如果音量为0，设为静音
  else if (clampedVolume === 0) {
    updatePropertyWithHistory('isMuted', true)
  }

  console.log('✅ 音量更新成功:', clampedVolume, '静音状态:', selectedTimelineItem.value.isMuted)
}

// 🆕 切换静音状态 - 使用带历史记录的属性更新
const toggleMute = () => {
  if (!selectedTimelineItem.value || selectedTimelineItem.value.mediaType !== 'video') return

  const newMutedState = !selectedTimelineItem.value.isMuted

  // 🆕 使用带历史记录的属性更新
  updatePropertyWithHistory('isMuted', newMutedState)

  console.log('✅ 静音状态切换:', newMutedState ? '静音' : '有声', '音量保持:', selectedTimelineItem.value.volume)
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

// 🆕 新架构：直接属性赋值，无需复杂的updateTransform方法
// TimelineItem的getter/setter会自动同步到Sprite

// 🆕 切换等比缩放 - 使用带历史记录的属性更新
const toggleProportionalScale = async () => {
  if (proportionalScale.value && selectedTimelineItem.value && selectedMediaItem.value) {
    // 开启等比缩放时，使用当前X缩放值作为统一缩放值，同时更新Y缩放
    const originalResolution = selectedMediaItem.value.mediaType === 'video'
      ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
      : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)

    const newSize = {
      width: originalResolution.width * scaleX.value,
      height: originalResolution.height * scaleX.value, // 使用X缩放值保持等比
    }

    try {
      await videoStore.updateTimelineItemTransformWithHistory(selectedTimelineItem.value.id, {
        width: newSize.width,
        height: newSize.height
      })
    } catch (error) {
      console.error('等比缩放切换失败:', error)
      // 回退到直接更新
      selectedTimelineItem.value.width = newSize.width
      selectedTimelineItem.value.height = newSize.height
    }
  }
}

// 🆕 更新统一缩放 - 使用带历史记录的属性更新
const updateUniformScale = async (newScale: number) => {
  if (proportionalScale.value && selectedTimelineItem.value && selectedMediaItem.value) {
    const originalResolution = selectedMediaItem.value.mediaType === 'video'
      ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
      : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)

    const newSize = {
      width: originalResolution.width * newScale,
      height: originalResolution.height * newScale,
    }

    try {
      await videoStore.updateTimelineItemTransformWithHistory(selectedTimelineItem.value.id, {
        width: newSize.width,
        height: newSize.height
      })
    } catch (error) {
      console.error('统一缩放更新失败:', error)
      // 回退到直接更新
      selectedTimelineItem.value.width = newSize.width
      selectedTimelineItem.value.height = newSize.height
    }
  }
}

// 🆕 设置X缩放绝对值的方法 - 使用智能属性更新
const setScaleX = (value: number) => {
  if (!selectedTimelineItem.value || !selectedMediaItem.value) return
  const originalResolution = selectedMediaItem.value.mediaType === 'video'
    ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
    : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)
  const newScaleX = Math.max(0.01, Math.min(5, value))

  const newWidth = originalResolution.width * newScaleX
  updatePropertySmart('width', newWidth)
}

// 🆕 设置Y缩放绝对值的方法 - 使用智能属性更新
const setScaleY = (value: number) => {
  if (!selectedTimelineItem.value || !selectedMediaItem.value) return
  const originalResolution = selectedMediaItem.value.mediaType === 'video'
    ? videoStore.getVideoOriginalResolution(selectedMediaItem.value.id)
    : videoStore.getImageOriginalResolution(selectedMediaItem.value.id)
  const newScaleY = Math.max(0.01, Math.min(5, value))

  const newHeight = originalResolution.height * newScaleY
  updatePropertySmart('height', newHeight)
}

// 🆕 设置旋转绝对值的方法（输入角度，转换为弧度）- 使用智能属性更新
const setRotation = (value: number) => {
  if (!selectedTimelineItem.value) return
  const newRotationRadians = uiDegreesToWebAVRadians(value)
  updatePropertySmart('rotation', newRotationRadians)
}

// 🆕 设置透明度绝对值的方法 - 使用智能属性更新
const setOpacity = (value: number) => {
  if (!selectedTimelineItem.value) return
  const newOpacity = Math.max(0, Math.min(1, value))
  updatePropertySmart('opacity', newOpacity)
}

// 🆕 智能属性更新方法：根据动画状态自动选择更新方式
const updatePropertySmart = async (property: AnimatableProperty, newValue: number) => {
  if (!selectedTimelineItem.value) return

  const oldValue = getCurrentPropertyValue(selectedTimelineItem.value, property)

  // 检查是否有实际变化
  if (Math.abs(oldValue - newValue) < 0.001) {
    return
  }

  if (hasAnimation.value) {
    // 🎬 有动画：通过关键帧命令更新
    try {
      await videoStore.createKeyFrameWithHistory(
        selectedTimelineItem.value.id,
        property,
        newValue
      )
      console.log(`🎬 [动画clip] 关键帧属性 ${property} 更新成功:`, { oldValue, newValue, time: videoStore.currentTime })
    } catch (error) {
      console.error(`❌ [动画clip] 关键帧属性 ${property} 更新失败:`, error)
    }
  } else {
    // 📄 无动画：通过变换命令更新
    const transform: any = {
      [property]: newValue
    }

    try {
      await videoStore.updateTimelineItemTransformWithHistory(selectedTimelineItem.value.id, transform)
      console.log(`📄 [非动画clip] 静态属性 ${property} 更新成功:`, { oldValue, newValue })
    } catch (error) {
      console.error(`❌ [非动画clip] 静态属性 ${property} 更新失败:`, error)
      // 如果历史记录更新失败，回退到直接更新
      ;(selectedTimelineItem.value as any)[property] = newValue
    }
  }
}

// 🆕 兼容性方法：保持现有非动画属性的更新方式
const updatePropertyWithHistory = async (property: string, newValue: any) => {
  if (!selectedTimelineItem.value) return

  // 获取旧值
  const oldValue = (selectedTimelineItem.value as any)[property]

  // 检查是否有实际变化
  if (oldValue === newValue) {
    return
  }

  // 🆕 新架构：直接使用属性名构造变换对象
  const transform: any = {
    [property]: newValue
  }

  try {
    // 使用带历史记录的更新方法
    await videoStore.updateTimelineItemTransformWithHistory(selectedTimelineItem.value.id, transform)
    console.log(`✅ 属性 ${property} 更新成功:`, { oldValue, newValue })
  } catch (error) {
    console.error(`❌ 属性 ${property} 更新失败:`, error)
    // 如果历史记录更新失败，回退到直接更新
    ;(selectedTimelineItem.value as any)[property] = newValue
  }
}



// 🆕 实现对齐功能（基于项目坐标系：中心为原点）- 使用带历史记录的属性更新
const alignHorizontal = (alignment: 'left' | 'center' | 'right') => {
  if (!selectedTimelineItem.value) return

  const canvasWidth = videoStore.videoResolution.width
  const spriteWidth = selectedTimelineItem.value.width

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

    // 🆕 使用位置属性更新
    updatePositionProperty('x', Math.round(newProjectX))

    console.log('✅ 水平对齐完成:', alignment, '项目坐标X:', newProjectX)
  } catch (error) {
    console.error('水平对齐失败:', error)
  }
}

const alignVertical = (alignment: 'top' | 'middle' | 'bottom') => {
  if (!selectedTimelineItem.value) return

  const canvasHeight = videoStore.videoResolution.height
  const spriteHeight = selectedTimelineItem.value.height

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

    // 🆕 使用位置属性更新
    updatePositionProperty('y', Math.round(newProjectY))

    console.log('✅ 垂直对齐完成:', alignment, '项目坐标Y:', newProjectY)
  } catch (error) {
    console.error('垂直对齐失败:', error)
  }
}

// 🆕 监听选中项目变化，同步到动画管理器
watch(selectedTimelineItem, (newItem) => {
  setSelectedTimelineItem(newItem)
}, { immediate: true })

// 🆕 位置属性更新函数：更新X或Y时，同时更新position关键帧
const updatePositionProperty = async (axis: 'x' | 'y', newValue: number) => {
  if (!selectedTimelineItem.value) return

  // 🔧 修复：在动画状态下获取当前时间点的实际值，而不是静态属性值
  let oldX: number, oldY: number

  if (hasAnimation.value) {
    // 有动画：从当前时间点的动画值获取
    const currentPosition = getPropertyValueAtTime(
      selectedTimelineItem.value,
      'position',
      videoStore.currentTime
    )
    oldX = currentPosition?.x ?? selectedTimelineItem.value.x
    oldY = currentPosition?.y ?? selectedTimelineItem.value.y
  } else {
    // 无动画：从静态属性获取
    oldX = selectedTimelineItem.value.x
    oldY = selectedTimelineItem.value.y
  }

  // 构建新的位置值
  const newPosition = {
    x: axis === 'x' ? newValue : oldX,
    y: axis === 'y' ? newValue : oldY
  }

  console.log(`🎬 更新位置属性 ${axis.toUpperCase()}:`, {
    oldValue: axis === 'x' ? oldX : oldY,
    newValue,
    newPosition,
    hasAnimation: hasAnimation.value
  })

  if (hasAnimation.value) {
    // 🎬 有动画：通过position关键帧命令更新
    try {
      await videoStore.createKeyFrameWithHistory(
        selectedTimelineItem.value.id,
        'position',
        newPosition
      )
      console.log(`🎬 [动画clip] 位置关键帧更新成功:`, { newPosition, time: videoStore.currentTime })
    } catch (error) {
      console.error(`❌ [动画clip] 位置关键帧更新失败:`, error)
    }
  } else {
    // 📄 无动画：通过变换命令更新
    const transform = {
      [axis]: newValue
    }

    try {
      await videoStore.updateTimelineItemTransformWithHistory(selectedTimelineItem.value.id, transform)
      console.log(`📄 [非动画clip] 位置属性 ${axis.toUpperCase()} 更新成功:`, { oldValue: axis === 'x' ? oldX : oldY, newValue })
    } catch (error) {
      console.error(`❌ [非动画clip] 位置属性 ${axis.toUpperCase()} 更新失败:`, error)
      // 如果历史记录更新失败，回退到直接更新
      ;(selectedTimelineItem.value as any)[axis] = newValue
    }
  }
}

// 🆕 位置关键帧状态：检查position属性是否有关键帧
const hasPositionKeyFrame = computed(() => {
  return hasKeyFrameAtTime('position')
})

// 🆕 位置关键帧切换处理函数：操作position属性，包含X和Y值
const handleTogglePositionKeyFrame = async () => {
  if (!selectedTimelineItem.value) return

  const currentTime = videoStore.currentTime
  const hasKeyFrame = hasKeyFrameAtTime('position')

  console.log(`🎬 切换位置关键帧:`, {
    time: currentTime,
    hasKeyFrame,
    currentX: selectedTimelineItem.value.x,
    currentY: selectedTimelineItem.value.y,
    willCreate: !hasKeyFrame
  })

  try {
    if (hasKeyFrame) {
      // 删除位置关键帧
      await videoStore.removeKeyFrameWithHistory(
        selectedTimelineItem.value.id,
        'position'
      )
      console.log(`✅ 已删除位置关键帧 (时间: ${currentTime}s)`)
    } else {
      // 创建位置关键帧：保存当前的X和Y值
      await videoStore.createKeyFrameWithHistory(
        selectedTimelineItem.value.id,
        'position'
      )

      const wasAnimated = hasAnimation.value
      if (!wasAnimated) {
        console.log(`🎬 ✨ clip转换为动画clip! 已创建位置关键帧 (X:${selectedTimelineItem.value.x}, Y:${selectedTimelineItem.value.y}) (时间: ${currentTime}s)`)
      } else {
        console.log(`✅ 已创建位置关键帧 (X:${selectedTimelineItem.value.x}, Y:${selectedTimelineItem.value.y}) (时间: ${currentTime}s)`)
      }
    }
  } catch (error) {
    console.error(`❌ 位置关键帧切换失败:`, error)
  }
}

// 🆕 关键帧切换处理函数：使用带历史记录的方法
const handleToggleKeyFrame = async (property: AnimatableProperty) => {
  if (!selectedTimelineItem.value) return

  const wasAnimated = hasAnimation.value
  const currentTime = videoStore.currentTime

  console.log(`🎬 切换关键帧:`, {
    property,
    time: currentTime,
    wasAnimated,
    hasKeyFrameAtCurrentTime: hasKeyFrameAtTime(property)
  })

  try {
    if (hasKeyFrameAtTime(property)) {
      // 删除关键帧
      await videoStore.removeKeyFrameWithHistory(
        selectedTimelineItem.value.id,
        property
      )
      console.log(`✅ 已删除关键帧: ${property} (时间: ${currentTime}s)`)
    } else {
      // 创建关键帧
      await videoStore.createKeyFrameWithHistory(
        selectedTimelineItem.value.id,
        property
      )
      if (!wasAnimated) {
        console.log(`🎬 ✨ clip转换为动画clip! 已创建关键帧: ${property} (时间: ${currentTime}s)`)
      } else {
        console.log(`✅ 已创建关键帧: ${property} (时间: ${currentTime}s)`)
      }
    }
  } catch (error) {
    console.error(`❌ 关键帧切换失败: ${property}`, error)
  }
}



// 🆕 清除动画：将动画转换为静态属性
const clearAnimation = async () => {
  if (!selectedTimelineItem.value || !hasAnimation.value) return

  console.log('🎬 开始清除动画')

  try {
    // 获取当前时间点的插值作为最终静态值
    const finalValues: Record<string, number> = {}
    const animatableProperties: AnimatableProperty[] = ['position', 'width', 'height', 'rotation', 'opacity', 'zIndex']

    animatableProperties.forEach(property => {
      finalValues[property] = getPropertyValueAtTime(
        selectedTimelineItem.value!,
        property,
        videoStore.currentTime
      )
    })

    console.log('🎬 最终静态值:', finalValues)

    // 批量操作：清除动画 + 设置最终值
    const batch = videoStore.startBatch('转换为静态属性')

    // 清除动画
    batch.addCommand(new ClearAnimationCommand(
      selectedTimelineItem.value.id,
      {
        getTimelineItem: videoStore.getTimelineItem,
      },
      videoStore.videoResolution
    ))

    // 设置最终静态值
    const currentValues = {
      x: selectedTimelineItem.value.x,
      y: selectedTimelineItem.value.y,
      width: selectedTimelineItem.value.width,
      height: selectedTimelineItem.value.height,
      rotation: selectedTimelineItem.value.rotation,
      opacity: selectedTimelineItem.value.opacity,
      zIndex: selectedTimelineItem.value.zIndex,
    }

    batch.addCommand(new UpdateTransformCommand(
      selectedTimelineItem.value.id,
      'multiple',
      currentValues, // 旧值
      finalValues, // 新值
      {
        getTimelineItem: videoStore.getTimelineItem,
      },
      {
        getMediaItem: videoStore.getMediaItem,
      }
    ))

    await videoStore.executeBatchCommand(batch.build())
    console.log('✅ 动画清除完成，已转换为静态属性')
  } catch (error) {
    console.error('❌ 清除动画失败:', error)
    throw error
  }
}

// 🆕 切换动画启用状态
const toggleAnimationEnabled = async () => {
  if (!selectedTimelineItem.value || !hasAnimation.value) return

  const currentEnabled = selectedTimelineItem.value.animationConfig?.isEnabled ?? false
  const newEnabled = !currentEnabled

  console.log(`🎬 切换动画状态: ${currentEnabled ? '禁用' : '启用'}`)

  try {
    await videoStore.toggleAnimationWithHistory(
      selectedTimelineItem.value.id,
      newEnabled
    )
    console.log(`✅ 动画状态已切换: ${newEnabled ? '启用' : '禁用'}`)
  } catch (error) {
    console.error('❌ 切换动画状态失败:', error)
  }
}

// 🆕 调试函数：打印关键帧信息
const debugKeyFrames = () => {
  if (!selectedTimelineItem.value) {
    console.log('🔍 [Debug] 没有选中的时间轴项目')
    return
  }

  const item = selectedTimelineItem.value
  console.log('🔍 [Debug] 时间轴项目信息:', {
    id: item.id,
    mediaType: item.mediaType,
    hasAnimationConfig: !!item.animationConfig
  })

  if (item.animationConfig) {
    console.log('🔍 [Debug] 动画配置:', {
      isEnabled: item.animationConfig.isEnabled,
      duration: item.animationConfig.duration,
      durationSeconds: item.animationConfig.duration / 1_000_000,
      iterCount: item.animationConfig.iterCount,
      keyFrameCount: item.animationConfig.keyFrames.length
    })

    console.log('🔍 [Debug] 关键帧列表:')
    item.animationConfig.keyFrames.forEach((kf, index) => {
      console.log(`  ${index + 1}. 关键帧 ${kf.id}:`, {
        time: kf.time,
        timeSeconds: (kf.time * item.animationConfig!.duration) / 1_000_000,
        properties: kf.properties.map(p => ({
          property: p.property,
          value: p.value,
          interpolation: p.interpolation
        }))
      })
    })
  } else {
    console.log('🔍 [Debug] 没有动画配置')
  }

  // 打印当前属性值
  console.log('🔍 [Debug] 当前属性值:', {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    opacity: item.opacity,
    zIndex: item.zIndex
  })

  // 打印WebAV Sprite信息
  console.log('🔍 [Debug] WebAV Sprite信息:', {
    rect: item.sprite.rect,
    opacity: item.sprite.opacity,
    zIndex: item.sprite.zIndex,
    visible: item.sprite.visible
  })
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

/* 🆕 动画控制样式 */
.animation-controls {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.keyframe-navigation {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.debug-controls {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.debug-btn {
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--border-radius-small);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.debug-btn:hover {
  background: var(--color-primary-hover);
}

.debug-btn.danger {
  background: var(--color-danger);
}

.debug-btn.danger:hover {
  background: var(--color-danger-hover);
}

/* 🆕 关键帧导航按钮样式 */
.nav-btn {
  background: var(--color-accent-secondary);
  color: white;
  border: none;
  border-radius: var(--border-radius-small);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.nav-btn:hover {
  background: var(--color-accent-secondary-hover);
}

.nav-btn:active {
  transform: translateY(1px);
}

/* 🆕 位置关键帧按钮样式 */
.position-keyframe-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  position: relative;
}

.position-label-indicator {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-weight: 500;
  background: var(--color-background-secondary);
  padding: 2px 4px;
  border-radius: var(--border-radius-small);
  border: 1px solid var(--color-border);
}

.animation-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-xs);
}

.status-indicator {
  font-size: var(--font-size-sm);
  padding: 2px 6px;
  border-radius: var(--border-radius-small);
  font-weight: 500;
}

.status-indicator.active {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-indicator.inactive {
  background: var(--color-text-quaternary);
  color: var(--color-text-secondary);
}

.keyframe-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.animation-mode-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-hint);
  font-style: italic;
}

.hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-hint);
  font-style: italic;
}

/* 🆕 属性模式指示器样式 */
.property-mode-indicator {
  font-size: 12px;
  margin-left: 4px;
  margin-right: 4px;
  opacity: 0.7;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
}

.property-mode-indicator.animated {
  opacity: 0.8;
}

.property-mode-indicator.static {
  opacity: 0.5;
}

.property-mode-indicator:hover {
  opacity: 1;
}

/* 🆕 属性控制容器样式 */
.property-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 1;
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

/* 🆕 关键帧按钮相关样式 */
/* 关键帧按钮现在放在控件后面，不需要特殊的标签容器样式 */
</style>

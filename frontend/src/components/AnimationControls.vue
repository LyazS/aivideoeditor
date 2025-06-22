<template>
  <div class="animation-controls">
    <div class="animation-header">
      <h3>关键帧动画</h3>
      <div class="animation-toggle">
        <label>
          <input 
            type="checkbox" 
            :checked="hasAnimation" 
            @change="toggleAnimation"
          />
          启用动画
        </label>
      </div>
    </div>

    <div v-if="hasAnimation" class="animation-content">
      <!-- 动画时长设置 -->
      <div class="duration-control">
        <label>动画时长（秒）:</label>
        <input 
          type="number" 
          :value="animationDuration" 
          @input="updateDuration"
          min="0.1" 
          max="60" 
          step="0.1"
        />
      </div>

      <!-- 关键帧信息 -->
      <div class="keyframe-info">
        <span>关键帧数量: {{ keyFrameCount }}</span>
        <span v-if="isNearCurrentKeyFrame" class="near-keyframe">📍 接近关键帧</span>
      </div>

      <!-- 属性控制 -->
      <div class="property-controls">
        <div v-for="property in animatableProperties" :key="property" class="property-row">
          <label>{{ getPropertyLabel(property) }}:</label>
          <div class="property-input-group">
            <input 
              type="number" 
              :value="getPropertyValue(property)"
              @input="updateProperty(property, $event)"
              :step="getPropertyStep(property)"
            />
            <button 
              class="keyframe-btn"
              :class="{ active: hasKeyFrameAtTime(property) }"
              @click="toggleKeyFrame(property)"
              :title="hasKeyFrameAtTime(property) ? '删除关键帧' : '创建关键帧'"
            >
              {{ hasKeyFrameAtTime(property) ? '◆' : '◇' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 导航控制 -->
      <div class="navigation-controls">
        <button @click="goToPrevKeyFrame" :disabled="keyFrameCount < 2">
          ⏮️ 上一个关键帧
        </button>
        <button @click="goToNextKeyFrame" :disabled="keyFrameCount < 2">
          ⏭️ 下一个关键帧
        </button>
        <button @click="clearAllAnimations" class="danger-btn">
          🗑️ 清除所有动画
        </button>
      </div>

      <!-- 关键帧列表 -->
      <div v-if="keyFrames.length > 0" class="keyframe-list">
        <h4>关键帧列表</h4>
        <div v-for="keyFrame in keyFrames" :key="keyFrame.id" class="keyframe-item">
          <span class="keyframe-time">{{ formatTime(keyFrame.time) }}</span>
          <span class="keyframe-properties">
            {{ keyFrame.properties.map(p => p.property).join(', ') }}
          </span>
          <button @click="removeKeyFrame(keyFrame.id)" class="remove-btn">×</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useKeyFrameAnimation } from '../composables/useKeyFrameAnimation'
import { setCurrentPropertyValue } from '../utils/animationUtils'
import type { AnimatableProperty } from '../types/animationTypes'
import type { TimelineItem } from '../types/videoTypes'

// Props
interface Props {
  timelineItem?: TimelineItem | null
}

const props = defineProps<Props>()

// 使用动画管理组合函数
const {
  selectedTimelineItem,
  hasAnimation,
  keyFrameCount,
  isNearCurrentKeyFrame,
  setSelectedTimelineItem,
  createKeyFrame,
  removeKeyFrame,
  removeKeyFrameProperty,
  hasKeyFrameAtTime,
  getPropertyValue,
  setAnimationEnabled,
  getKeyFrames,
  goToNextKeyFrame,
  goToPrevKeyFrame,
  clearAllAnimations,
  getAnimationDuration,
  setAnimationDuration
} = useKeyFrameAnimation()

// 可动画属性列表
const animatableProperties: AnimatableProperty[] = ['x', 'y', 'width', 'height', 'rotation', 'opacity']

// 计算属性
const animationDuration = computed(() => getAnimationDuration())
const keyFrames = computed(() => getKeyFrames())

// 监听props变化
watch(
  () => props.timelineItem,
  (newItem) => {
    setSelectedTimelineItem(newItem)
  },
  { immediate: true }
)

// 方法
function toggleAnimation(event: Event) {
  const target = event.target as HTMLInputElement
  setAnimationEnabled(target.checked)
}

function updateDuration(event: Event) {
  const target = event.target as HTMLInputElement
  const duration = parseFloat(target.value)
  if (duration > 0) {
    setAnimationDuration(duration)
  }
}

function updateProperty(property: AnimatableProperty, event: Event) {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value)
  
  if (selectedTimelineItem.value && !isNaN(value)) {
    setCurrentPropertyValue(selectedTimelineItem.value, property, value)
  }
}

function toggleKeyFrame(property: AnimatableProperty) {
  if (hasKeyFrameAtTime(property)) {
    removeKeyFrameProperty(property)
  } else {
    createKeyFrame(property)
  }
}

function getPropertyLabel(property: AnimatableProperty): string {
  const labels: Record<AnimatableProperty, string> = {
    x: 'X位置',
    y: 'Y位置',
    width: '宽度',
    height: '高度',
    rotation: '旋转',
    opacity: '透明度'
  }
  return labels[property]
}

function getPropertyStep(property: AnimatableProperty): string {
  if (property === 'opacity') return '0.01'
  if (property === 'rotation') return '0.1'
  return '1'
}

function formatTime(relativeTime: number): string {
  const seconds = relativeTime * animationDuration.value
  return `${seconds.toFixed(1)}s`
}
</script>

<style scoped>
.animation-controls {
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-color);
}

.animation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.animation-header h3 {
  margin: 0;
  font-size: 16px;
}

.animation-toggle label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.animation-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.duration-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.duration-control input {
  width: 80px;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.keyframe-info {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: var(--text-secondary);
}

.near-keyframe {
  color: var(--primary-color);
  font-weight: bold;
}

.property-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.property-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.property-row label {
  min-width: 60px;
  font-size: 14px;
}

.property-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.property-input-group input {
  width: 80px;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.keyframe-btn {
  width: 24px;
  height: 24px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.keyframe-btn.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.navigation-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.navigation-controls button {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 12px;
}

.navigation-controls button:hover:not(:disabled) {
  background: var(--hover-color);
}

.navigation-controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.danger-btn {
  background: var(--danger-color) !important;
  color: white !important;
  border-color: var(--danger-color) !important;
}

.keyframe-list {
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
}

.keyframe-list h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.keyframe-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
}

.keyframe-time {
  font-weight: bold;
  min-width: 40px;
}

.keyframe-properties {
  flex: 1;
  color: var(--text-secondary);
}

.remove-btn {
  width: 20px;
  height: 20px;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--danger-color);
}

.remove-btn:hover {
  background: var(--danger-color);
  color: white;
}
</style>

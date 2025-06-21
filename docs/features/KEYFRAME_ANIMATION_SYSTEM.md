# 🎬 关键帧动画系统设计方案

## 🎯 系统概述

### 核心理念
- **基于WebAV的setAnimation API**：充分利用WebAV内置的关键帧动画系统
- **时间轴驱动**：在当前播放时间点设置关键帧，与时间轴紧密集成
- **属性面板集成**：为每个可动画属性添加关键帧标记按钮
- **非侵入式设计**：不破坏现有架构，作为增强功能添加

### 支持的动画属性
根据WebAV的`TAnimateProps`类型：
- **位置**：`x`, `y`
- **尺寸**：`w` (width), `h` (height)  
- **旋转**：`angle`
- **透明度**：`opacity`

### 用户交互流程
1. **设置关键帧**：在当前时间刻度，点击属性控件右侧的关键帧按钮，为该clip设置关键帧
2. **关键帧导航**：属性区添加"上一个关键帧"、"下一个关键帧"按钮
3. **时间轴可视化**：在时间轴上显示关键帧标记
4. **实时预览**：播放时自动应用关键帧动画效果

### UI布局设计
```
位置    [X输入框] [Y输入框] 💎
缩放    [滑块] [数值输入] 💎
旋转    [滑块] [数值输入] 💎
透明度  [滑块] [数值输入] 💎
```

## 🏗️ 架构设计

### 1. 数据结构设计

#### 关键帧数据类型
```typescript
// 关键帧数据接口
export interface KeyFrame {
  id: string
  timelineItemId: string
  time: number // 时间（秒）
  property: AnimatableProperty
  value: number
  interpolation: 'linear' // 未来可扩展为 'ease-in', 'ease-out' 等
  createdAt: number // 创建时间戳
}

// 可动画属性枚举
export type AnimatableProperty = 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity'

// 动画配置接口
export interface AnimationConfig {
  timelineItemId: string
  keyFrames: KeyFrame[]
  duration: number // 动画总时长（微秒）
  iterCount: number // 迭代次数，默认1
  isEnabled: boolean // 是否启用动画
}

// WebAV关键帧格式转换类型
export type WebAVKeyFrameOpts = Partial<
  Record<`${number}%` | 'from' | 'to', Partial<TAnimateProps>>
>
```

#### TimelineItem扩展
```typescript
// 在现有TimelineItem接口中添加动画相关属性
export interface TimelineItem {
  // ... 现有属性
  
  // 🆕 动画相关属性
  keyFrames?: KeyFrame[] // 该项目的所有关键帧
  hasAnimation?: boolean // 是否包含动画
  animationConfig?: AnimationConfig // 动画配置
}
```

### 2. 模块架构

#### 核心模块：`animationModule.ts`
```typescript
/**
 * 关键帧动画管理模块
 * 负责关键帧的CRUD操作、动画应用、时间轴同步
 */
export function createAnimationModule(
  timelineModule: TimelineModule,
  playbackModule: PlaybackModule
) {
  // ==================== 状态定义 ====================
  
  // 关键帧存储 - 按timelineItemId分组
  const keyFrames = ref<Map<string, KeyFrame[]>>(new Map())
  
  // 当前选中的关键帧
  const selectedKeyFrame = ref<KeyFrame | null>(null)
  
  // 动画配置存储
  const animationConfigs = ref<Map<string, AnimationConfig>>(new Map())
  
  // ==================== 计算属性 ====================
  
  // 获取当前选中项目的关键帧
  const currentItemKeyFrames = computed(() => {
    const selectedItem = timelineModule.selectedTimelineItem.value
    if (!selectedItem) return []
    return keyFrames.value.get(selectedItem.id) || []
  })
  
  // 检查当前时间是否有关键帧
  const hasKeyFrameAtCurrentTime = computed(() => (property: AnimatableProperty) => {
    const currentTime = playbackModule.currentTime.value
    return findKeyFrameAtTime(currentItemKeyFrames.value, property, currentTime) !== null
  })
  
  // ==================== 核心方法 ====================
  
  /**
   * 添加关键帧
   */
  function addKeyFrame(
    timelineItemId: string,
    property: AnimatableProperty,
    time: number,
    value: number
  ): KeyFrame {
    const keyFrame: KeyFrame = {
      id: generateKeyFrameId(),
      timelineItemId,
      time,
      property,
      value,
      interpolation: 'linear',
      createdAt: Date.now()
    }
    
    // 添加到存储
    const itemKeyFrames = keyFrames.value.get(timelineItemId) || []
    itemKeyFrames.push(keyFrame)
    keyFrames.value.set(timelineItemId, itemKeyFrames)
    
    // 更新动画配置
    updateAnimationConfig(timelineItemId)
    
    return keyFrame
  }
  
  /**
   * 删除关键帧
   */
  function removeKeyFrame(keyFrameId: string): boolean {
    for (const [timelineItemId, itemKeyFrames] of keyFrames.value.entries()) {
      const index = itemKeyFrames.findIndex(kf => kf.id === keyFrameId)
      if (index !== -1) {
        itemKeyFrames.splice(index, 1)
        updateAnimationConfig(timelineItemId)
        return true
      }
    }
    return false
  }
  
  /**
   * 切换关键帧（添加或删除）
   */
  function toggleKeyFrame(
    timelineItemId: string,
    property: AnimatableProperty,
    time: number,
    value: number
  ): 'added' | 'removed' {
    const existingKeyFrame = findKeyFrameAtTime(
      keyFrames.value.get(timelineItemId) || [],
      property,
      time
    )
    
    if (existingKeyFrame) {
      removeKeyFrame(existingKeyFrame.id)
      return 'removed'
    } else {
      addKeyFrame(timelineItemId, property, time, value)
      return 'added'
    }
  }
  
  // 更多方法实现...
  
  return {
    // 状态
    keyFrames: readonly(keyFrames),
    selectedKeyFrame,
    currentItemKeyFrames,
    hasKeyFrameAtCurrentTime,
    
    // 方法
    addKeyFrame,
    removeKeyFrame,
    toggleKeyFrame,
    // ... 其他方法
  }
}
```

#### 工具模块：`animationUtils.ts`
```typescript
/**
 * 动画工具函数
 * 负责WebAV动画格式转换、关键帧计算等
 */

/**
 * 将项目关键帧转换为WebAV格式
 */
export function convertToWebAVKeyFrames(keyFrames: KeyFrame[]): WebAVKeyFrameOpts {
  if (keyFrames.length === 0) return {}
  
  // 按时间排序
  const sortedKeyFrames = [...keyFrames].sort((a, b) => a.time - b.time)
  
  // 计算总时长
  const totalDuration = sortedKeyFrames[sortedKeyFrames.length - 1].time - sortedKeyFrames[0].time
  
  const webavKeyFrames: WebAVKeyFrameOpts = {}
  
  sortedKeyFrames.forEach(keyFrame => {
    // 计算百分比位置
    const percentage = totalDuration > 0 
      ? Math.round(((keyFrame.time - sortedKeyFrames[0].time) / totalDuration) * 100)
      : 0
    
    const key = percentage === 0 ? 'from' : percentage === 100 ? 'to' : `${percentage}%`
    
    if (!webavKeyFrames[key]) {
      webavKeyFrames[key] = {}
    }
    
    // 转换属性名和值
    const webavProperty = convertPropertyToWebAV(keyFrame.property)
    const webavValue = convertValueToWebAV(keyFrame.property, keyFrame.value)
    
    webavKeyFrames[key]![webavProperty] = webavValue
  })
  
  return webavKeyFrames
}

/**
 * 查找指定时间和属性的关键帧
 */
export function findKeyFrameAtTime(
  keyFrames: KeyFrame[],
  property: AnimatableProperty,
  time: number,
  tolerance: number = 0.1
): KeyFrame | null {
  return keyFrames.find(kf => 
    kf.property === property && 
    Math.abs(kf.time - time) <= tolerance
  ) || null
}

/**
 * 获取下一个关键帧
 */
export function getNextKeyFrame(
  keyFrames: KeyFrame[],
  currentTime: number,
  property?: AnimatableProperty
): KeyFrame | null {
  const filtered = property 
    ? keyFrames.filter(kf => kf.property === property)
    : keyFrames
  
  const sorted = filtered
    .filter(kf => kf.time > currentTime)
    .sort((a, b) => a.time - b.time)
  
  return sorted[0] || null
}

/**
 * 获取上一个关键帧
 */
export function getPreviousKeyFrame(
  keyFrames: KeyFrame[],
  currentTime: number,
  property?: AnimatableProperty
): KeyFrame | null {
  const filtered = property 
    ? keyFrames.filter(kf => kf.property === property)
    : keyFrames
  
  const sorted = filtered
    .filter(kf => kf.time < currentTime)
    .sort((a, b) => b.time - a.time)
  
  return sorted[0] || null
}

/**
 * 转换项目属性名到WebAV属性名
 */
function convertPropertyToWebAV(property: AnimatableProperty): keyof TAnimateProps {
  const mapping: Record<AnimatableProperty, keyof TAnimateProps> = {
    'x': 'x',
    'y': 'y',
    'width': 'w',
    'height': 'h',
    'rotation': 'angle',
    'opacity': 'opacity'
  }
  return mapping[property]
}

/**
 * 转换项目属性值到WebAV格式
 */
function convertValueToWebAV(property: AnimatableProperty, value: number): number {
  switch (property) {
    case 'rotation':
      // 项目中使用弧度，WebAV也使用弧度，直接返回
      return value
    case 'x':
    case 'y':
      // 坐标转换：项目坐标系（中心为原点）→ WebAV坐标系（左上角为原点）
      // 这里需要根据具体的坐标转换逻辑来实现
      return value
    default:
      return value
  }
}

/**
 * 生成关键帧ID
 */
export function generateKeyFrameId(): string {
  return `keyframe_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}
```

## 🎨 UI组件设计

### 1. 关键帧按钮组件：`KeyFrameButton.vue`

#### 组件接口
```vue
<template>
  <button
    class="keyframe-btn"
    :class="{
      'has-keyframe': hasKeyframe,
      'active': isActive
    }"
    @click="handleToggleKeyFrame"
    :title="hasKeyframe ? '删除关键帧' : '添加关键帧'"
  >
    <svg width="14" height="14" viewBox="0 0 24 24">
      <!-- 钻石形状的关键帧图标 -->
      <path d="M12,2L15.5,8.5L22,12L15.5,15.5L12,22L8.5,15.5L2,12L8.5,8.5L12,2Z"
            :fill="hasKeyframe ? '#ff6b35' : 'transparent'"
            stroke="currentColor"
            stroke-width="1.5"/>
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import type { AnimatableProperty } from '../types/animationTypes'

interface Props {
  timelineItemId: string
  property: AnimatableProperty
  currentTime: number
}

interface Emits {
  (e: 'toggle-keyframe', data: {
    timelineItemId: string
    property: AnimatableProperty
    time: number
    value: number
  }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const videoStore = useVideoStore()

// 检查当前时间是否有关键帧
const hasKeyframe = computed(() => {
  return videoStore.hasKeyFrameAtCurrentTime(props.property)
})

// 检查是否为当前活动的关键帧
const isActive = computed(() => {
  // 如果当前时间正好在关键帧上，则高亮显示
  return hasKeyframe.value
})

// 处理关键帧切换
const handleToggleKeyFrame = () => {
  // 获取当前属性值
  const currentValue = getCurrentPropertyValue()

  emit('toggle-keyframe', {
    timelineItemId: props.timelineItemId,
    property: props.property,
    time: props.currentTime,
    value: currentValue
  })
}

// 获取当前属性值
const getCurrentPropertyValue = (): number => {
  const timelineItem = videoStore.getTimelineItem(props.timelineItemId)
  if (!timelineItem) return 0

  switch (props.property) {
    case 'x': return timelineItem.x
    case 'y': return timelineItem.y
    case 'width': return timelineItem.width
    case 'height': return timelineItem.height
    case 'rotation': return timelineItem.rotation
    case 'opacity': return timelineItem.opacity
    default: return 0
  }
}
</script>

<style scoped>
.keyframe-btn {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.2s ease;
  margin-left: 6px;
  flex-shrink: 0;
  color: #888; /* 默认更亮的灰色 */
}

.keyframe-btn:hover {
  background: rgba(255, 107, 53, 0.15);
  color: #ff6b35; /* 悬停时变橙色 */
}

.keyframe-btn.has-keyframe {
  color: #ff6b35;
}

.keyframe-btn.active {
  background: rgba(255, 107, 53, 0.25);
  box-shadow: 0 0 8px rgba(255, 107, 53, 0.5);
  color: #ff8c42; /* 更亮的橙色 */
}

.keyframe-btn svg {
  transition: all 0.2s ease;
}

.keyframe-btn:hover svg {
  transform: scale(1.15);
}
</style>
```

### 2. 关键帧导航组件：`KeyFrameNavigation.vue`

#### 组件实现
```vue
<template>
  <div class="keyframe-navigation">
    <div class="navigation-header">
      <h4>关键帧导航</h4>
      <span class="keyframe-count">{{ totalKeyFrames }} 个关键帧</span>
    </div>

    <div class="navigation-controls">
      <button
        @click="gotoPreviousKeyFrame"
        :disabled="!hasPreviousKeyFrame"
        class="nav-btn"
        title="上一个关键帧 (Ctrl+Left)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z"/>
        </svg>
        上一个
      </button>

      <div class="current-time-display">
        {{ formatTime(currentTime) }}
      </div>

      <button
        @click="gotoNextKeyFrame"
        :disabled="!hasNextKeyFrame"
        class="nav-btn"
        title="下一个关键帧 (Ctrl+Right)"
      >
        下一个
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
        </svg>
      </button>
    </div>

    <!-- 关键帧列表 -->
    <div class="keyframe-list" v-if="sortedKeyFrames.length > 0">
      <div class="list-header">
        <span>时间</span>
        <span>属性</span>
        <span>值</span>
        <span>操作</span>
      </div>

      <div
        v-for="keyframe in sortedKeyFrames"
        :key="keyframe.id"
        class="keyframe-item"
        :class="{
          'selected': selectedKeyFrame?.id === keyframe.id,
          'current': isCurrentKeyFrame(keyframe)
        }"
        @click="gotoKeyFrame(keyframe)"
      >
        <span class="keyframe-time">{{ formatTime(keyframe.time) }}</span>
        <span class="keyframe-property">{{ getPropertyDisplayName(keyframe.property) }}</span>
        <span class="keyframe-value">{{ formatValue(keyframe.value, keyframe.property) }}</span>
        <button
          class="delete-btn"
          @click.stop="deleteKeyFrame(keyframe)"
          title="删除关键帧"
        >
          <svg width="12" height="12" viewBox="0 0 24 24">
            <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
        <path d="M12,2L15.5,8.5L22,12L15.5,15.5L12,22L8.5,15.5L2,12L8.5,8.5L12,2Z"/>
      </svg>
      <p>暂无关键帧</p>
      <p class="hint">在属性控件旁点击钻石图标添加关键帧</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { formatTime as formatTimeUtil } from '../utils/timeUtils'
import type { KeyFrame, AnimatableProperty } from '../types/animationTypes'

const videoStore = useVideoStore()

// 计算属性
const currentTime = computed(() => videoStore.currentTime)
const selectedTimelineItem = computed(() => videoStore.selectedTimelineItem)
const selectedKeyFrame = computed(() => videoStore.selectedKeyFrame)

// 当前选中项目的关键帧（按时间排序）
const sortedKeyFrames = computed(() => {
  if (!selectedTimelineItem.value) return []

  const keyFrames = videoStore.getKeyFrames(selectedTimelineItem.value.id)
  return [...keyFrames].sort((a, b) => a.time - b.time)
})

// 关键帧总数
const totalKeyFrames = computed(() => sortedKeyFrames.value.length)

// 是否有上一个关键帧
const hasPreviousKeyFrame = computed(() => {
  return sortedKeyFrames.value.some(kf => kf.time < currentTime.value)
})

// 是否有下一个关键帧
const hasNextKeyFrame = computed(() => {
  return sortedKeyFrames.value.some(kf => kf.time > currentTime.value)
})

// 方法
const gotoPreviousKeyFrame = () => {
  const prevKeyFrame = sortedKeyFrames.value
    .filter(kf => kf.time < currentTime.value)
    .pop() // 获取最后一个（最接近当前时间的）

  if (prevKeyFrame) {
    gotoKeyFrame(prevKeyFrame)
  }
}

const gotoNextKeyFrame = () => {
  const nextKeyFrame = sortedKeyFrames.value
    .find(kf => kf.time > currentTime.value)

  if (nextKeyFrame) {
    gotoKeyFrame(nextKeyFrame)
  }
}

const gotoKeyFrame = (keyframe: KeyFrame) => {
  // 跳转到关键帧时间
  videoStore.setCurrentTime(keyframe.time)

  // 选中该关键帧
  videoStore.selectKeyFrame(keyframe)

  // 暂停播放以便查看关键帧
  if (videoStore.isPlaying) {
    videoStore.pause()
  }
}

const deleteKeyFrame = (keyframe: KeyFrame) => {
  if (confirm(`确定要删除 ${getPropertyDisplayName(keyframe.property)} 在 ${formatTime(keyframe.time)} 的关键帧吗？`)) {
    videoStore.removeKeyFrame(keyframe.id)
  }
}

const isCurrentKeyFrame = (keyframe: KeyFrame): boolean => {
  return Math.abs(keyframe.time - currentTime.value) < 0.1
}

const formatTime = (seconds: number): string => {
  return formatTimeUtil(seconds, 'milliseconds')
}

const getPropertyDisplayName = (property: AnimatableProperty): string => {
  const names: Record<AnimatableProperty, string> = {
    'x': 'X位置',
    'y': 'Y位置',
    'width': '宽度',
    'height': '高度',
    'rotation': '旋转',
    'opacity': '透明度'
  }
  return names[property]
}

const formatValue = (value: number, property: AnimatableProperty): string => {
  switch (property) {
    case 'rotation':
      return `${(value * 180 / Math.PI).toFixed(1)}°`
    case 'opacity':
      return `${(value * 100).toFixed(0)}%`
    case 'x':
    case 'y':
    case 'width':
    case 'height':
      return `${Math.round(value)}px`
    default:
      return value.toString()
  }
}

// 键盘快捷键
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        gotoPreviousKeyFrame()
        break
      case 'ArrowRight':
        event.preventDefault()
        gotoNextKeyFrame()
        break
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.keyframe-navigation {
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
  padding: 16px;
  margin-top: 16px;
}

.navigation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.navigation-header h4 {
  margin: 0;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.keyframe-count {
  font-size: 12px;
  color: var(--text-secondary);
}

.navigation-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  border-radius: var(--border-radius-small);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.nav-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.current-time-display {
  flex: 1;
  text-align: center;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  padding: 6px 8px;
  border-radius: var(--border-radius-small);
  border: 1px solid var(--border-color);
}

.keyframe-list {
  max-height: 200px;
  overflow-y: auto;
}

.list-header {
  display: grid;
  grid-template-columns: 80px 60px 60px 40px;
  gap: 8px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--border-color);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.keyframe-item {
  display: grid;
  grid-template-columns: 80px 60px 60px 40px;
  gap: 8px;
  padding: 8px 4px;
  border-radius: var(--border-radius-small);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
}

.keyframe-item:hover {
  background: var(--bg-hover);
}

.keyframe-item.selected {
  background: rgba(255, 107, 53, 0.1);
  border: 1px solid rgba(255, 107, 53, 0.3);
}

.keyframe-item.current {
  background: rgba(0, 123, 255, 0.1);
  border: 1px solid rgba(0, 123, 255, 0.3);
}

.keyframe-time {
  font-family: 'Courier New', monospace;
  color: var(--text-primary);
}

.keyframe-property {
  color: var(--text-secondary);
}

.keyframe-value {
  color: var(--text-primary);
  font-weight: 500;
}

.delete-btn {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.delete-btn:hover {
  background: var(--color-danger);
  color: white;
}

.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-secondary);
}

.empty-state p {
  margin: 8px 0;
}

.empty-state .hint {
  font-size: 11px;
  opacity: 0.7;
}
</style>
```

### 3. 时间轴关键帧标记组件：`KeyFrameMarker.vue`

#### 组件实现
```vue
<template>
  <div
    class="keyframe-marker"
    :style="{ left: position + 'px' }"
    :class="{
      'selected': isSelected,
      [`property-${keyframe.property}`]: true
    }"
    @click="handleClick"
    @contextmenu="handleRightClick"
  >
    <div class="marker-diamond"></div>

    <!-- 工具提示 -->
    <div class="marker-tooltip" v-if="showTooltip">
      <div class="tooltip-content">
        <strong>{{ getPropertyDisplayName(keyframe.property) }}</strong>
        <div>值: {{ formatValue(keyframe.value) }}</div>
        <div>时间: {{ formatTime(keyframe.time) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatTime as formatTimeUtil } from '../utils/timeUtils'
import type { KeyFrame, AnimatableProperty } from '../types/animationTypes'

interface Props {
  keyframe: KeyFrame
  position: number
  isSelected?: boolean
}

interface Emits {
  (e: 'click', keyframe: KeyFrame): void
  (e: 'delete', keyframe: KeyFrame): void
  (e: 'select', keyframe: KeyFrame): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const showTooltip = ref(false)

const handleClick = (event: MouseEvent) => {
  event.stopPropagation()
  emit('click', props.keyframe)
  emit('select', props.keyframe)
}

const handleRightClick = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()

  // 显示上下文菜单或直接删除
  if (confirm(`删除 ${getPropertyDisplayName(props.keyframe.property)} 关键帧？`)) {
    emit('delete', props.keyframe)
  }
}

const getPropertyDisplayName = (property: AnimatableProperty): string => {
  const names: Record<AnimatableProperty, string> = {
    'x': 'X位置',
    'y': 'Y位置',
    'width': '宽度',
    'height': '高度',
    'rotation': '旋转',
    'opacity': '透明度'
  }
  return names[property]
}

const formatValue = (value: number): string => {
  switch (props.keyframe.property) {
    case 'rotation':
      return `${(value * 180 / Math.PI).toFixed(1)}°`
    case 'opacity':
      return `${(value * 100).toFixed(0)}%`
    case 'x':
    case 'y':
    case 'width':
    case 'height':
      return `${Math.round(value)}px`
    default:
      return value.toString()
  }
}

const formatTime = (seconds: number): string => {
  return formatTimeUtil(seconds, 'milliseconds')
}
</script>

<style scoped>
.keyframe-marker {
  position: absolute;
  top: 0;
  width: 12px;
  height: 100%;
  pointer-events: auto;
  z-index: 10;
  cursor: pointer;
  transform: translateX(-6px); /* 居中对齐 */
}

.marker-diamond {
  width: 8px;
  height: 8px;
  background: #ff6b35;
  transform: rotate(45deg);
  margin: 4px auto;
  border: 1px solid #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

.keyframe-marker:hover .marker-diamond {
  transform: rotate(45deg) scale(1.2);
  box-shadow: 0 2px 6px rgba(255, 107, 53, 0.4);
}

.keyframe-marker.selected .marker-diamond {
  background: #ff8c42;
  box-shadow: 0 0 8px rgba(255, 107, 53, 0.6);
  transform: rotate(45deg) scale(1.3);
}

/* 不同属性的颜色区分 */
.property-x .marker-diamond { background: #ff6b35; }
.property-y .marker-diamond { background: #4ecdc4; }
.property-width .marker-diamond { background: #45b7d1; }
.property-height .marker-diamond { background: #96ceb4; }
.property-rotation .marker-diamond { background: #feca57; }
.property-opacity .marker-diamond { background: #ff9ff3; }

/* 工具提示 */
.marker-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  pointer-events: none;
  z-index: 1000;
}

.tooltip-content {
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.tooltip-content strong {
  display: block;
  margin-bottom: 4px;
  color: #ff6b35;
}

.keyframe-marker:hover .marker-tooltip {
  opacity: 1;
}
</style>
```

## 🔄 时间轴集成

### 1. Timeline.vue 集成方案

#### 在现有时间轴中添加关键帧标记层
```vue
<!-- 在Timeline.vue中添加关键帧标记层 -->
<template>
  <div class="timeline-container">
    <!-- 现有的时间轴内容 -->
    <div class="timeline-tracks">
      <!-- 轨道内容 -->
    </div>

    <!-- 🆕 关键帧标记层 -->
    <div class="keyframe-markers-layer" v-if="showKeyFrameMarkers">
      <KeyFrameMarker
        v-for="keyframe in visibleKeyFrames"
        :key="keyframe.id"
        :keyframe="keyframe"
        :position="timeToPixel(keyframe.time)"
        :is-selected="selectedKeyFrame?.id === keyframe.id"
        @click="handleKeyFrameClick"
        @select="handleKeyFrameSelect"
        @delete="handleKeyFrameDelete"
      />
    </div>

    <!-- 关键帧显示控制 -->
    <div class="timeline-controls">
      <button
        class="toggle-keyframes-btn"
        :class="{ active: showKeyFrameMarkers }"
        @click="toggleKeyFrameMarkers"
        title="显示/隐藏关键帧标记"
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path d="M12,2L15.5,8.5L22,12L15.5,15.5L12,22L8.5,15.5L2,12L8.5,8.5L12,2Z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// 现有导入...
import KeyFrameMarker from './KeyFrameMarker.vue'

// 关键帧显示控制
const showKeyFrameMarkers = ref(true)

// 可见的关键帧（当前选中项目的关键帧）
const visibleKeyFrames = computed(() => {
  if (!selectedTimelineItem.value || !showKeyFrameMarkers.value) return []

  return videoStore.getKeyFrames(selectedTimelineItem.value.id)
    .filter(keyframe => {
      // 只显示在可视范围内的关键帧
      const position = timeToPixel(keyframe.time)
      return position >= 0 && position <= containerWidth.value
    })
})

// 关键帧事件处理
const handleKeyFrameClick = (keyframe: KeyFrame) => {
  // 跳转到关键帧时间
  videoStore.setCurrentTime(keyframe.time)
}

const handleKeyFrameSelect = (keyframe: KeyFrame) => {
  videoStore.selectKeyFrame(keyframe)
}

const handleKeyFrameDelete = (keyframe: KeyFrame) => {
  videoStore.removeKeyFrame(keyframe.id)
}

const toggleKeyFrameMarkers = () => {
  showKeyFrameMarkers.value = !showKeyFrameMarkers.value
}

// 时间到像素转换（复用现有方法）
const timeToPixel = (time: number): number => {
  return videoStore.timeToPixel(time, containerWidth.value)
}
</script>

<style scoped>
.keyframe-markers-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

.timeline-controls {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
}

.toggle-keyframes-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-secondary);
  border-radius: var(--border-radius-small);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.toggle-keyframes-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
}

.toggle-keyframes-btn.active {
  background: rgba(255, 107, 53, 0.1);
  border-color: #ff6b35;
  color: #ff6b35;
}
</style>
```

### 2. PropertiesPanel.vue 集成方案

#### 在属性控件中添加关键帧按钮
```vue
<!-- 在PropertiesPanel.vue中集成关键帧按钮 -->
<template>
  <!-- 现有内容... -->

  <!-- 位置大小部分 -->
  <div class="property-section">
    <h4>位置大小</h4>

    <!-- 位置：XY在同一行，只有一个关键帧按钮 -->
    <div class="property-item">
      <label>位置</label>
      <div class="position-controls">
        <div class="position-input-group">
          <span class="position-label">X</span>
          <NumberInput
            :model-value="transformX"
            @change="(value) => updatePropertyWithHistory('x', value)"
            :input-style="positionInputStyle"
          />
        </div>
        <div class="position-input-group">
          <span class="position-label">Y</span>
          <NumberInput
            :model-value="transformY"
            @change="(value) => updatePropertyWithHistory('y', value)"
            :input-style="positionInputStyle"
          />
        </div>
        <!-- 🆕 位置的关键帧按钮（控制X和Y） -->
        <KeyFrameButton
          property="x"
          :has-keyframe="false"
          @toggle-keyframe="handleToggleKeyFrame"
        />
      </div>
    </div>

    <!-- 缩放属性 -->
    <div class="property-item">
      <label>缩放</label>
      <div class="scale-controls">
        <input type="range" class="scale-slider" />
        <NumberInput />
        <!-- 🆕 缩放的关键帧按钮 -->
        <KeyFrameButton
          property="width"
          :has-keyframe="false"
          @toggle-keyframe="handleToggleKeyFrame"
        />
      </div>
    </div>

    <!-- 旋转属性 -->
    <div class="property-item">
      <label>旋转</label>
      <div class="rotation-controls">
        <input type="range" class="rotation-slider" />
        <NumberInput />
        <!-- 🆕 旋转的关键帧按钮 -->
        <KeyFrameButton
          property="rotation"
          :has-keyframe="false"
          @toggle-keyframe="handleToggleKeyFrame"
        />
      </div>
    </div>

    <!-- 透明度属性 -->
    <div class="property-item">
      <label>透明度</label>
      <div class="opacity-controls">
        <input type="range" class="opacity-slider" />
        <NumberInput />
        <!-- 🆕 透明度的关键帧按钮 -->
        <KeyFrameButton
          property="opacity"
          :has-keyframe="false"
          @toggle-keyframe="handleToggleKeyFrame"
        />
      </div>
    </div>
  </div>

  <!-- 🆕 关键帧导航区域 -->
  <KeyFrameNavigation v-if="selectedTimelineItem" />
</template>

<script setup lang="ts">
// 现有导入...
import KeyFrameButton from './KeyFrameButton.vue'
import KeyFrameNavigation from './KeyFrameNavigation.vue'

// 关键帧切换处理
const handleToggleKeyFrame = async (data: {
  timelineItemId: string
  property: AnimatableProperty
  time: number
  value: number
}) => {
  try {
    const result = await videoStore.toggleKeyFrame(
      data.timelineItemId,
      data.property,
      data.time,
      data.value
    )

    console.log(`✅ 关键帧${result === 'added' ? '添加' : '删除'}成功:`, data)
  } catch (error) {
    console.error('❌ 关键帧操作失败:', error)
  }
}
</script>

<style scoped>
.position-input-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.position-controls {
  display: flex;
  gap: 8px;
}
</style>
```

## 🔧 技术实现要点

### 1. WebAV动画集成

#### 动画应用到VideoVisibleSprite
```typescript
/**
 * 应用动画到VideoVisibleSprite
 */
function applyAnimationToSprite(sprite: VideoVisibleSprite, keyFrames: KeyFrame[]): void {
  if (keyFrames.length === 0) {
    // 清除动画
    sprite.setAnimation({}, { duration: 0, iterCount: 1 })
    return
  }

  // 按属性分组关键帧
  const keyFramesByProperty = groupKeyFramesByProperty(keyFrames)

  // 转换为WebAV格式
  const webavKeyFrames = convertToWebAVKeyFrames(keyFrames)

  // 计算动画时长（从第一个到最后一个关键帧）
  const duration = calculateAnimationDuration(keyFrames)

  if (duration > 0) {
    // 应用动画
    sprite.setAnimation(webavKeyFrames, {
      duration: duration * 1000000, // 转换为微秒
      iterCount: 1, // 默认播放一次
      delay: 0
    })

    console.log('✅ 动画已应用到sprite:', {
      keyFrameCount: keyFrames.length,
      duration: duration,
      webavKeyFrames
    })
  }
}

/**
 * 按属性分组关键帧
 */
function groupKeyFramesByProperty(keyFrames: KeyFrame[]): Record<AnimatableProperty, KeyFrame[]> {
  const groups: Record<string, KeyFrame[]> = {}

  keyFrames.forEach(keyFrame => {
    if (!groups[keyFrame.property]) {
      groups[keyFrame.property] = []
    }
    groups[keyFrame.property].push(keyFrame)
  })

  return groups as Record<AnimatableProperty, KeyFrame[]>
}

/**
 * 计算动画总时长
 */
function calculateAnimationDuration(keyFrames: KeyFrame[]): number {
  if (keyFrames.length === 0) return 0

  const times = keyFrames.map(kf => kf.time).sort((a, b) => a - b)
  return times[times.length - 1] - times[0]
}
```

#### 实时动画同步
```typescript
/**
 * 监听播放时间变化，实时同步动画状态
 */
export function setupAnimationSync(
  animationModule: AnimationModule,
  playbackModule: PlaybackModule,
  timelineModule: TimelineModule
) {
  // 监听播放时间变化
  watch(() => playbackModule.currentTime.value, (newTime) => {
    // 更新当前时间的关键帧高亮状态
    updateKeyFrameHighlight(newTime)

    // 如果正在播放，确保动画同步
    if (playbackModule.isPlaying.value) {
      syncAnimationAtTime(newTime)
    }
  })

  // 监听选中项目变化，重新应用动画
  watch(() => timelineModule.selectedTimelineItem.value, (newItem) => {
    if (newItem) {
      const keyFrames = animationModule.getKeyFrames(newItem.id)
      applyAnimationToSprite(newItem.sprite, keyFrames)
    }
  })
}

/**
 * 更新关键帧高亮状态
 */
function updateKeyFrameHighlight(currentTime: number): void {
  // 查找当前时间附近的关键帧并高亮显示
  // 这个逻辑会在UI组件中实现
}

/**
 * 在指定时间同步动画状态
 */
function syncAnimationAtTime(time: number): void {
  // 确保WebAV动画与当前播放时间同步
  // WebAV会自动处理这个同步，我们主要确保数据一致性
}
```

### 2. 历史记录集成

#### 关键帧操作命令
```typescript
/**
 * 添加关键帧命令
 */
export class AddKeyFrameCommand implements Command {
  constructor(
    private keyFrame: KeyFrame,
    private animationModule: AnimationModule,
    private timelineModule: TimelineModule
  ) {}

  async execute(): Promise<void> {
    // 添加关键帧
    this.animationModule.addKeyFrame(
      this.keyFrame.timelineItemId,
      this.keyFrame.property,
      this.keyFrame.time,
      this.keyFrame.value
    )

    // 重新应用动画
    await this.applyAnimation()
  }

  async undo(): Promise<void> {
    // 删除关键帧
    this.animationModule.removeKeyFrame(this.keyFrame.id)

    // 重新应用动画
    await this.applyAnimation()
  }

  private async applyAnimation(): Promise<void> {
    const timelineItem = this.timelineModule.getTimelineItem(this.keyFrame.timelineItemId)
    if (timelineItem) {
      const keyFrames = this.animationModule.getKeyFrames(this.keyFrame.timelineItemId)
      applyAnimationToSprite(timelineItem.sprite, keyFrames)
    }
  }

  getDescription(): string {
    return `${this.keyFrame.property}关键帧操作`
  }
}

/**
 * 删除关键帧命令
 */
export class RemoveKeyFrameCommand implements Command {
  constructor(
    private keyFrame: KeyFrame,
    private animationModule: AnimationModule,
    private timelineModule: TimelineModule
  ) {}

  async execute(): Promise<void> {
    this.animationModule.removeKeyFrame(this.keyFrame.id)
    await this.applyAnimation()
  }

  async undo(): Promise<void> {
    this.animationModule.addKeyFrame(
      this.keyFrame.timelineItemId,
      this.keyFrame.property,
      this.keyFrame.time,
      this.keyFrame.value
    )
    await this.applyAnimation()
  }

  private async applyAnimation(): Promise<void> {
    const timelineItem = this.timelineModule.getTimelineItem(this.keyFrame.timelineItemId)
    if (timelineItem) {
      const keyFrames = this.animationModule.getKeyFrames(this.keyFrame.timelineItemId)
      applyAnimationToSprite(timelineItem.sprite, keyFrames)
    }
  }

  getDescription(): string {
    return `删除${this.keyFrame.property}关键帧`
  }
}
```

### 3. 坐标系转换

#### 项目坐标系与WebAV坐标系转换
```typescript
/**
 * 坐标系转换工具
 * 项目坐标系：中心为原点 (0,0)
 * WebAV坐标系：左上角为原点 (0,0)
 */

/**
 * 项目坐标转WebAV坐标
 */
export function projectToWebAVCoords(
  projectX: number,
  projectY: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  return {
    x: projectX + canvasWidth / 2,
    y: projectY + canvasHeight / 2
  }
}

/**
 * WebAV坐标转项目坐标
 */
export function webAVToProjectCoords(
  webavX: number,
  webavY: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  return {
    x: webavX - canvasWidth / 2,
    y: webavY - canvasHeight / 2
  }
}

/**
 * 转换关键帧值到WebAV格式
 */
function convertKeyFrameValueToWebAV(
  property: AnimatableProperty,
  value: number,
  videoResolution: { width: number; height: number }
): number {
  switch (property) {
    case 'x':
    case 'y':
      // 位置需要坐标系转换
      const coords = projectToWebAVCoords(
        property === 'x' ? value : 0,
        property === 'y' ? value : 0,
        videoResolution.width,
        videoResolution.height
      )
      return property === 'x' ? coords.x : coords.y

    case 'rotation':
      // 旋转角度直接使用（都是弧度）
      return value

    case 'width':
    case 'height':
    case 'opacity':
      // 尺寸和透明度直接使用
      return value

    default:
      return value
  }
}
```

### 4. 性能优化

#### 关键帧缓存和批量更新
```typescript
/**
 * 关键帧缓存管理
 */
class KeyFrameCache {
  private cache = new Map<string, {
    keyFrames: KeyFrame[]
    webavKeyFrames: WebAVKeyFrameOpts
    lastUpdate: number
  }>()

  /**
   * 获取缓存的WebAV关键帧
   */
  getWebAVKeyFrames(timelineItemId: string, keyFrames: KeyFrame[]): WebAVKeyFrameOpts | null {
    const cached = this.cache.get(timelineItemId)
    if (!cached) return null

    // 检查关键帧是否有变化
    if (this.hasKeyFramesChanged(cached.keyFrames, keyFrames)) {
      return null
    }

    return cached.webavKeyFrames
  }

  /**
   * 缓存WebAV关键帧
   */
  setWebAVKeyFrames(timelineItemId: string, keyFrames: KeyFrame[], webavKeyFrames: WebAVKeyFrameOpts): void {
    this.cache.set(timelineItemId, {
      keyFrames: [...keyFrames],
      webavKeyFrames,
      lastUpdate: Date.now()
    })
  }

  /**
   * 清除缓存
   */
  clear(timelineItemId?: string): void {
    if (timelineItemId) {
      this.cache.delete(timelineItemId)
    } else {
      this.cache.clear()
    }
  }

  private hasKeyFramesChanged(cached: KeyFrame[], current: KeyFrame[]): boolean {
    if (cached.length !== current.length) return true

    return cached.some((cachedKf, index) => {
      const currentKf = current[index]
      return cachedKf.id !== currentKf.id ||
             cachedKf.time !== currentKf.time ||
             cachedKf.value !== currentKf.value ||
             cachedKf.property !== currentKf.property
    })
  }
}

/**
 * 批量动画更新
 */
export function batchUpdateAnimations(updates: Array<{
  timelineItemId: string
  keyFrames: KeyFrame[]
}>): void {
  // 批量处理多个动画更新，减少WebAV调用次数
  const cache = new KeyFrameCache()

  updates.forEach(({ timelineItemId, keyFrames }) => {
    // 检查缓存
    let webavKeyFrames = cache.getWebAVKeyFrames(timelineItemId, keyFrames)

    if (!webavKeyFrames) {
      // 转换并缓存
      webavKeyFrames = convertToWebAVKeyFrames(keyFrames)
      cache.setWebAVKeyFrames(timelineItemId, keyFrames, webavKeyFrames)
    }

    // 应用动画
    const timelineItem = getTimelineItem(timelineItemId)
    if (timelineItem) {
      applyAnimationToSprite(timelineItem.sprite, keyFrames)
    }
  })
}
```

## 🚀 实施计划

### 阶段1：核心功能（MVP）- 预计2-3天
**目标：实现基础的关键帧添加和删除功能**

#### 1.1 数据结构和类型定义
- [ ] 创建 `types/animationTypes.ts`
- [ ] 定义 `KeyFrame`、`AnimationConfig`、`AnimatableProperty` 接口
- [ ] 扩展 `TimelineItem` 接口添加动画属性

#### 1.2 核心动画模块
- [ ] 创建 `stores/modules/animationModule.ts`
- [ ] 实现关键帧的基础CRUD操作
- [ ] 实现 `addKeyFrame`、`removeKeyFrame`、`toggleKeyFrame` 方法

#### 1.3 工具函数
- [ ] 创建 `utils/animationUtils.ts`
- [ ] 实现 `convertToWebAVKeyFrames` 转换函数
- [ ] 实现 `findKeyFrameAtTime` 查找函数

#### 1.4 关键帧按钮组件 ✅ **已完成**
- [x] 创建 `components/KeyFrameButton.vue`
- [x] 实现基础的关键帧标记和切换功能
- [x] 添加钻石图标和状态样式
- [x] 优化按钮颜色和交互效果

#### 1.5 属性面板集成 ✅ **已完成**
- [x] 在 `PropertiesPanel.vue` 中集成关键帧按钮
- [x] 为位置、缩放、旋转、透明度属性添加关键帧按钮
- [x] 实现关键帧切换事件处理（目前为日志输出）
- [x] 优化UI布局：位置使用单个按钮，其他属性按钮放在控件右侧

#### 1.6 VideoStore集成
- [ ] 在 `videoStore.ts` 中集成动画模块
- [ ] 暴露关键帧相关方法到store接口

### 阶段2：导航功能 - 预计2-3天
**目标：实现关键帧导航和管理功能**

#### 2.1 关键帧导航组件
- [ ] 创建 `components/KeyFrameNavigation.vue`
- [ ] 实现上一个/下一个关键帧导航
- [ ] 实现关键帧列表显示和管理

#### 2.2 导航逻辑
- [ ] 实现 `gotoNextKeyFrame`、`gotoPreviousKeyFrame` 方法
- [ ] 实现关键帧时间跳转功能
- [ ] 添加键盘快捷键支持（Ctrl+Left/Right）

#### 2.3 关键帧选择和高亮
- [ ] 实现关键帧选择状态管理
- [ ] 实现当前时间关键帧高亮显示
- [ ] 添加关键帧删除确认功能

#### 2.4 属性面板完善
- [ ] 在属性面板中集成关键帧导航组件
- [ ] 优化关键帧按钮的视觉反馈
- [ ] 添加关键帧数量显示

### 阶段3：时间轴集成 - 预计3-4天
**目标：在时间轴上可视化显示关键帧**

#### 3.1 时间轴关键帧标记
- [ ] 创建 `components/KeyFrameMarker.vue`
- [ ] 实现时间轴上的关键帧标记显示
- [ ] 添加不同属性的颜色区分

#### 3.2 Timeline.vue集成
- [ ] 在 `Timeline.vue` 中添加关键帧标记层
- [ ] 实现关键帧标记的位置计算和显示
- [ ] 添加关键帧显示开关控制

#### 3.3 交互功能
- [ ] 实现点击关键帧标记跳转时间
- [ ] 实现右键删除关键帧功能
- [ ] 添加关键帧工具提示显示

#### 3.4 可视化优化
- [ ] 优化关键帧标记的视觉效果
- [ ] 实现关键帧标记的选中状态
- [ ] 添加关键帧标记的悬停效果

### 阶段4：WebAV动画集成 - 预计3-4天
**目标：实现真正的动画播放效果**

#### 4.1 动画应用逻辑
- [ ] 实现 `applyAnimationToSprite` 函数
- [ ] 完善 WebAV 关键帧格式转换
- [ ] 实现动画时长计算

#### 4.2 坐标系转换
- [ ] 实现项目坐标系与WebAV坐标系转换
- [ ] 完善 `convertKeyFrameValueToWebAV` 函数
- [ ] 处理不同属性的值转换逻辑

#### 4.3 实时同步
- [ ] 实现播放时间与动画状态同步
- [ ] 监听播放状态变化应用动画
- [ ] 优化动画性能和流畅度

#### 4.4 动画预览
- [ ] 实现动画效果实时预览
- [ ] 添加动画播放控制
- [ ] 优化动画渲染性能

### 阶段5：扩展功能 - 预计2-3天
**目标：支持所有属性和高级功能**

#### 5.1 全属性支持
- [ ] 为旋转、透明度、尺寸属性添加关键帧支持
- [ ] 完善所有属性的关键帧按钮集成
- [ ] 优化属性面板布局

#### 5.2 历史记录集成
- [ ] 实现关键帧操作的撤销/重做
- [ ] 创建 `AddKeyFrameCommand`、`RemoveKeyFrameCommand`
- [ ] 集成到现有历史记录系统

#### 5.3 批量操作
- [ ] 实现多个关键帧的批量选择
- [ ] 实现批量删除关键帧功能
- [ ] 实现批量时间调整功能

#### 5.4 性能优化
- [ ] 实现关键帧缓存机制
- [ ] 优化大量关键帧的渲染性能
- [ ] 实现批量动画更新

### 阶段6：完善和优化 - 预计2-3天
**目标：完善用户体验和系统稳定性**

#### 6.1 用户体验优化
- [ ] 完善所有交互的视觉反馈
- [ ] 添加操作提示和帮助信息
- [ ] 优化关键帧操作的响应速度

#### 6.2 错误处理
- [ ] 添加关键帧操作的错误处理
- [ ] 实现数据验证和边界检查
- [ ] 添加用户友好的错误提示

#### 6.3 测试和调试
- [ ] 测试各种边界情况
- [ ] 优化动画性能和内存使用
- [ ] 修复发现的bug和问题

#### 6.4 文档完善
- [ ] 更新用户使用指南
- [ ] 完善开发者文档
- [ ] 添加功能演示和示例

## 📋 验收标准

### 功能验收
- [ ] **关键帧添加**：能够在当前时间为任意属性添加关键帧
- [ ] **关键帧删除**：能够删除指定的关键帧
- [ ] **关键帧导航**：能够在关键帧之间快速跳转
- [ ] **时间轴显示**：在时间轴上正确显示关键帧标记
- [ ] **动画播放**：播放时能够正确应用关键帧动画效果
- [ ] **属性支持**：支持位置、尺寸、旋转、透明度等所有属性
- [ ] **历史记录**：关键帧操作支持撤销/重做

### 性能验收
- [ ] **响应速度**：关键帧操作响应时间 < 100ms
- [ ] **动画流畅度**：30fps播放时动画流畅无卡顿
- [ ] **内存使用**：大量关键帧时内存使用合理
- [ ] **渲染性能**：时间轴关键帧标记渲染流畅

### 用户体验验收
- [ ] **直观操作**：关键帧按钮状态清晰易懂
- [ ] **视觉反馈**：所有操作都有明确的视觉反馈
- [ ] **错误处理**：错误情况有友好的提示信息
- [ ] **快捷键**：支持常用的键盘快捷键操作

## 🎯 总结

这个关键帧动画系统设计方案具有以下特点：

### ✅ 优势
1. **充分利用WebAV能力**：基于WebAV的setAnimation API，性能优异
2. **无缝集成现有架构**：不破坏现有代码结构，作为增强功能添加
3. **直观的用户界面**：钻石图标、时间轴标记、导航按钮等直观易用
4. **完整的功能覆盖**：从基础关键帧到高级动画功能一应俱全
5. **渐进式实现**：分阶段开发，每个阶段都能提供可用功能

### 🔧 技术亮点
1. **智能坐标转换**：自动处理项目坐标系与WebAV坐标系转换
2. **性能优化**：关键帧缓存、批量更新等优化机制
3. **历史记录集成**：完整的撤销/重做支持
4. **实时同步**：播放时间与动画状态完美同步

### 🚀 扩展性
1. **插值算法扩展**：未来可支持更多插值类型（ease-in、ease-out等）
2. **属性扩展**：可轻松添加新的可动画属性
3. **批量操作**：支持多关键帧的批量编辑
4. **导入导出**：可扩展动画配置的保存和加载功能

这个方案为你的视频编辑器提供了专业级的关键帧动画功能，让用户能够创建丰富的动画效果，大大提升了产品的竞争力和用户体验。

## 📋 当前实现状态

### ✅ 已完成功能

#### 1. **关键帧按钮组件 (KeyFrameButton.vue)**
- **钻石图标设计**：14x14px SVG钻石图标，描边宽度1.5px
- **三种视觉状态**：
  - 默认：灰色 (#888) 空心钻石
  - 悬停：橙色 (#ff6b35) 带背景高亮
  - 有关键帧：橙色 (#ff6b35) 实心钻石
  - 活动状态：亮橙色 (#ff8c42) 带发光效果
- **交互效果**：悬停缩放 (1.15x)、平滑过渡动画
- **事件处理**：`toggle-keyframe` 事件，传递属性类型

#### 2. **属性面板集成**
- **位置属性**：X和Y输入框后统一放置一个关键帧按钮
- **缩放属性**：等比缩放和非等比缩放模式都有对应的关键帧按钮
- **旋转属性**：旋转控件右侧有关键帧按钮
- **透明度属性**：透明度控件右侧有关键帧按钮
- **布局优化**：按钮统一放在控件右侧，margin-left: 6px

#### 3. **类型定义**
- **AnimatableProperty**：支持 'x', 'y', 'width', 'height', 'rotation', 'opacity'
- **组件接口**：简化的Props和Emits定义
- **事件处理**：`handleToggleKeyFrame` 函数（目前输出日志）

### 🔄 下一步开发

#### 即将开始：数据层实现
1. **创建动画类型定义** (`types/animationTypes.ts`)
2. **实现动画模块** (`stores/modules/animationModule.ts`)
3. **连接真实数据**：将关键帧按钮连接到实际的关键帧系统
4. **实现关键帧存储**：在内存中管理关键帧数据

#### 后续功能
1. **关键帧导航组件**：上一个/下一个关键帧按钮
2. **时间轴标记**：在时间轴上显示关键帧位置
3. **WebAV动画集成**：应用真实的动画效果

### 🎯 当前可测试功能

1. **视觉效果测试**：
   - 关键帧按钮是否正确显示在各个属性控件右侧
   - 悬停效果是否正常工作
   - 按钮颜色和大小是否合适

2. **交互测试**：
   - 点击关键帧按钮是否在控制台输出日志
   - 不同属性的按钮是否传递正确的属性类型

3. **布局测试**：
   - 位置属性是否只有一个关键帧按钮
   - 其他属性的按钮是否正确对齐
   - 响应式布局是否正常

这个基础UI实现为后续的数据层和功能层开发奠定了坚实的基础。
```
```

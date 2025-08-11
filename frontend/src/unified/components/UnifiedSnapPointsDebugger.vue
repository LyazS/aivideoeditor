<template>
  <div class="snap-points-debugger" v-if="showDebugger">
    <!-- 控制面板 -->
    <div class="debug-controls">
      <button @click="toggleVisibility" class="toggle-btn">
        {{ isVisible ? '隐藏吸附点' : '显示吸附点' }}
      </button>
      <button @click="refreshSnapPoints" class="refresh-btn">刷新</button>
      <button @click="showPlayheadSnapPoints" class="test-btn">播放头模式</button>
      <button @click="showAllSnapPoints" class="test-btn">显示全部</button>
      <div class="stats">
        总计: {{ snapPoints.length }} 个吸附点 | {{ currentMode }}
      </div>
    </div>

    <!-- 吸附点可视化层 -->
    <div 
      class="snap-points-overlay" 
      v-if="isVisible"
      :style="{ 
        left: trackControlWidth + 'px',
        width: timelineWidth + 'px' 
      }"
    >
      <!-- 渲染每个吸附点 -->
      <div
        v-for="point in visibleSnapPoints"
        :key="`${point.type}-${point.frame}`"
        class="snap-point"
        :class="[
          `snap-point--${point.type}`,
          { 'snap-point--near-playhead': isNearPlayhead(point.frame) }
        ]"
        :style="{ left: getSnapPointPosition(point.frame) + 'px' }"
        :title="getSnapPointTooltip(point)"
      >
        <div class="snap-point__line"></div>
        <div class="snap-point__marker">{{ getSnapPointIcon(point.type) }}</div>
        <div class="snap-point__label">{{ point.frame }}</div>
      </div>
    </div>

    <!-- 图例 -->
    <div class="legend" v-if="isVisible">
      <div class="legend-item">
        <span class="legend-color legend-color--clip-start"></span>
        <span>片段开始</span>
      </div>
      <div class="legend-item">
        <span class="legend-color legend-color--clip-end"></span>
        <span>片段结束</span>
      </div>
      <div class="legend-item">
        <span class="legend-color legend-color--keyframe"></span>
        <span>关键帧</span>
      </div>
      <div class="legend-item">
        <span class="legend-color legend-color--playhead"></span>
        <span>播放头</span>
      </div>
      <div class="legend-item">
        <span class="legend-color legend-color--timeline-start"></span>
        <span>时间轴起始</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useSnapManager } from '../composables/useSnapManager'
import { useUnifiedStore } from '../unifiedStore'
import { UnifiedSnapCalculator } from '../utils/snapCalculator'
import type { SnapPoint } from '../../types/snap'

interface Props {
  /** 时间轴容器宽度 */
  timelineWidth: number
  /** 轨道控制区域宽度 */
  trackControlWidth: number
  /** 是否显示调试器 */
  showDebugger?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showDebugger: true
})

const snapManager = useSnapManager()
const unifiedStore = useUnifiedStore()

const isVisible = ref(true)
const snapPoints = ref<SnapPoint[]>([])
const cacheSize = ref(0)
const currentMode = ref('全部模式')

// 获取当前可见区域的吸附点
const visibleSnapPoints = computed(() => {
  // 可以根据时间轴的可见范围进行过滤，这里暂时显示所有点
  return snapPoints.value
})

/**
 * 获取吸附点在时间轴上的像素位置
 */
function getSnapPointPosition(frame: number): number {
  return unifiedStore.frameToPixel(frame, props.timelineWidth)
}

/**
 * 获取吸附点图标
 */
function getSnapPointIcon(type: string): string {
  switch (type) {
    case 'clip-start': return '▶'
    case 'clip-end': return '⏹'
    case 'keyframe': return '◆'
    case 'playhead': return '▲'
    case 'timeline-start': return '⏸'
    default: return '●'
  }
}

/**
 * 获取吸附点提示信息
 */
function getSnapPointTooltip(point: SnapPoint): string {
  const frameInfo = `帧: ${point.frame}`
  switch (point.type) {
    case 'clip-start':
      return `片段开始 - ${frameInfo}\n片段: ${(point as any).clipName}`
    case 'clip-end':
      return `片段结束 - ${frameInfo}\n片段: ${(point as any).clipName}`
    case 'keyframe':
      return `关键帧 - ${frameInfo}\n片段: ${(point as any).clipId}`
    case 'playhead':
      return `播放头 - ${frameInfo}`
    case 'timeline-start':
      return `时间轴起始 - ${frameInfo}`
    default:
      return `吸附点 - ${frameInfo}`
  }
}

/**
 * 判断吸附点是否靠近播放头
 */
function isNearPlayhead(frame: number): boolean {
  const currentFrame = unifiedStore.currentFrame
  const distance = Math.abs(frame - currentFrame)
  return distance <= 5 // 5帧内算靠近
}

/**
 * 刷新吸附点数据
 */
function refreshSnapPoints() {
  console.log('🔄 [吸附点调试器] 开始刷新吸附点数据')
  
  // 获取当前所有吸附点 - 注意：这里显示的是所有可能的吸附点
  // 实际使用时会根据操作类型动态排除某些点（比如播放头拖动时排除播放头）
  const collectionOptions = {
    includeClipBoundaries: snapManager.snapConfig.isClipBoundariesEnabled.value,
    includeKeyframes: snapManager.snapConfig.isKeyframesEnabled.value,
    includePlayhead: snapManager.snapConfig.isPlayheadEnabled.value,
    includeTimelineStart: snapManager.snapConfig.isTimelineStartEnabled.value,
  }

  console.log('📋 [吸附点调试器] 收集选项:', collectionOptions)

  // 通过计算器直接收集吸附点
  const calculator = new UnifiedSnapCalculator()
  const newSnapPoints = calculator.collectSnapPoints(collectionOptions)
  
  snapPoints.value = newSnapPoints
  
  console.log('✅ [吸附点调试器] 收集完成:', {
    吸附点数量: snapPoints.value.length,
    吸附点列表: snapPoints.value.map(p => `${p.type}@${p.frame}`),
    时间轴项目数量: unifiedStore.timelineItems.length,
    说明: '注意：播放头拖动时会动态排除播放头吸附点，但这里显示所有可能的吸附点'
  })
  
  // 获取缓存大小（通过访问私有属性，仅用于调试）
  cacheSize.value = 0 // 暂时设为0，实际可以通过其他方式获取
}

/**
 * 显示播放头拖动模式的吸附点（排除播放头自身）
 */
function showPlayheadSnapPoints() {
  console.log('🎯 [吸附点调试器] 切换到播放头拖动模式')
  
  const collectionOptions = {
    includeClipBoundaries: snapManager.snapConfig.isClipBoundariesEnabled.value,
    includeKeyframes: snapManager.snapConfig.isKeyframesEnabled.value,
    includePlayhead: false, // 播放头拖动时排除播放头自身
    includeTimelineStart: snapManager.snapConfig.isTimelineStartEnabled.value,
  }

  const calculator = new UnifiedSnapCalculator()
  const newSnapPoints = calculator.collectSnapPoints(collectionOptions)
  
  snapPoints.value = newSnapPoints
  currentMode.value = '播放头模式(无播放头点)'
  
  console.log('✅ [播放头模式] 吸附点:', {
    吸附点数量: snapPoints.value.length,
    吸附点列表: snapPoints.value.map(p => `${p.type}@${p.frame}`),
    说明: '播放头拖动时使用的吸附点（已排除播放头自身）'
  })
}

/**
 * 显示所有吸附点
 */
function showAllSnapPoints() {
  currentMode.value = '全部模式'
  refreshSnapPoints()
}

/**
 * 切换可见性
 */
function toggleVisibility() {
  isVisible.value = !isVisible.value
}

// 监听时间轴项目变化，自动刷新
watch(() => unifiedStore.timelineItems, () => {
  if (isVisible.value) {
    refreshSnapPoints()
  }
}, { deep: true })

// 监听播放头变化
watch(() => unifiedStore.currentFrame, () => {
  // 播放头变化时不需要重新收集吸附点，只需要更新显示
}, { immediate: true })

// 组件挂载时刷新数据
onMounted(() => {
  console.log('🔧 [吸附点调试器] 组件挂载完成')
  refreshSnapPoints()
})

// 暴露刷新方法
defineExpose({
  refreshSnapPoints,
  toggleVisibility
})
</script>

<style scoped>
.snap-points-debugger {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  font-family: monospace;
  font-size: 12px;
  pointer-events: none;
}

.debug-controls {
  position: fixed;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 11px;
  z-index: 1001;
  pointer-events: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.toggle-btn,
.refresh-btn,
.test-btn {
  background: #007acc;
  color: white;
  border: none;
  padding: 2px 6px;
  border-radius: 2px;
  cursor: pointer;
  font-size: 10px;
}

.toggle-btn:hover,
.refresh-btn:hover,
.test-btn:hover {
  background: #005a9e;
}

.test-btn {
  background: #28a745;
}

.test-btn:hover {
  background: #1e7e34;
}

.stats {
  color: #ccc;
  font-size: 10px;
}

.snap-points-overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 999; /* 提高层级，确保在所有内容之上 */
}

.snap-point {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px; /* 增加宽度让吸附点更明显 */
  pointer-events: none;
}

.snap-point__line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px; /* 增加宽度 */
  opacity: 0.8; /* 提高透明度 */
}

.snap-point__marker {
  position: absolute;
  top: 5px;
  left: -6px;
  width: 12px; /* 增大标记 */
  height: 12px;
  font-size: 10px;
  line-height: 12px;
  text-align: center;
  border-radius: 50%;
  color: white;
  text-shadow: 0 0 3px rgba(0, 0, 0, 1);
  border: 1px solid rgba(255, 255, 255, 0.5); /* 添加边框 */
}

.snap-point__label {
  position: absolute;
  top: 12px;
  left: -10px;
  width: 20px;
  text-align: center;
  font-size: 9px;
  color: white;
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
  opacity: 0;
  transition: opacity 0.2s;
}

.snap-point:hover .snap-point__label,
.snap-point--near-playhead .snap-point__label {
  opacity: 1;
}

/* 不同类型的吸附点颜色 */
.snap-point--clip-start .snap-point__line { background-color: #00ff00; }
.snap-point--clip-start .snap-point__marker { background-color: #00ff00; }

.snap-point--clip-end .snap-point__line { background-color: #ff6600; }
.snap-point--clip-end .snap-point__marker { background-color: #ff6600; }

.snap-point--keyframe .snap-point__line { background-color: #ff00ff; }
.snap-point--keyframe .snap-point__marker { background-color: #ff00ff; }

.snap-point--playhead .snap-point__line { background-color: #ffffff; }
.snap-point--playhead .snap-point__marker { background-color: #ffffff; }

.snap-point--timeline-start .snap-point__line { background-color: #ffff00; }
.snap-point--timeline-start .snap-point__marker { background-color: #ffff00; }

/* 靠近播放头的吸附点高亮 */
.snap-point--near-playhead {
  z-index: 16;
}

.snap-point--near-playhead .snap-point__line {
  width: 2px;
  opacity: 1;
  animation: pulse 1s infinite;
}

.legend {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 15px;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 10px;
  z-index: 1001;
  pointer-events: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-color {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-color--clip-start { background-color: #00ff00; }
.legend-color--clip-end { background-color: #ff6600; }
.legend-color--keyframe { background-color: #ff00ff; }
.legend-color--playhead { background-color: #ffffff; }
.legend-color--timeline-start { background-color: #ffff00; }

@keyframes pulse {
  0%, 100% { opacity: 0.6; transform: scaleX(1); }
  50% { opacity: 1; transform: scaleX(1.5); }
}
</style>
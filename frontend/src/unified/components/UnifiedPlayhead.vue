<template>
  <div class="playhead-container" ref="playheadContainer">
    <!-- 播放头手柄 -->
    <div
      class="playhead-handle"
      :style="{ left: playheadPosition + 'px' }"
    >
      <!-- 白色倒三角 -->
      <div class="playhead-triangle"></div>
    </div>

    <!-- 播放竖线 - 覆盖整个时间轴 -->
    <div class="playhead-line" :style="{ left: playheadLinePosition + 'px' }"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUnifiedStore } from '@/unified/unifiedStore'

interface PlayheadProps {
  /** 时间轴容器宽度 */
  timelineWidth: number
  /** 轨道控制区域宽度（左侧偏移） */
  trackControlWidth?: number
}

const props = withDefaults(defineProps<PlayheadProps>(), {
  trackControlWidth: 150,
})

const unifiedStore = useUnifiedStore()

// 播放头手柄位置（相对于时间刻度区域）
const playheadPosition = computed(() => {
  const currentFrame = unifiedStore.currentFrame
  const pixelPosition = unifiedStore.frameToPixel(currentFrame, props.timelineWidth)
  // 如果是在 TimeScale 中使用（trackControlWidth = 0），直接返回像素位置
  // 如果是在 Timeline 中使用，需要加上偏移
  return props.trackControlWidth + pixelPosition
})

// 播放竖线位置（与播放头手柄位置保持一致）
const playheadLinePosition = computed(() => {
  return playheadPosition.value
})
</script>

<style scoped>
.playhead-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none; /* 容器本身不接收事件 */
}

.playhead-handle {
  position: absolute;
  top: 0;
  height: 100%;
  width: 20px; /* 增加点击区域 */
  margin-left: -10px; /* 居中对齐 */
  pointer-events: none; /* 不允许交互 */
  z-index: 25; /* 确保在播放竖线之上，但在clip tooltip之下 */
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 0; /* 移除顶部间距，让三角形紧贴顶端 */
}

.playhead-triangle {
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 10px solid white; /* 白色倒三角，稍微大一些 */
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.playhead-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: white; /* 白色竖线 */
  pointer-events: none;
  z-index: 20; /* 确保在所有内容之上，但在clip tooltip之下 */
  margin-left: -1px; /* 居中对齐 */
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
}
</style>
<template>
  <div class="time-scale">
    <div class="scale-container" ref="scaleContainer">
      <!-- 时间刻度标记 - 空状态显示基础刻度 -->
      <div
        v-for="mark in timeMarks"
        :key="mark.time"
        class="time-mark"
        :style="{ left: mark.position + 'px' }"
      >
        <div class="mark-line" :class="{ major: mark.isMajor }"></div>
        <div v-if="mark.isMajor" class="mark-label">
          {{ formatTime(mark.time) }}
        </div>
      </div>

      <!-- 播放头组件 - 空壳版本 -->
      <UnifiedPlayhead
        ref="playheadRef"
        :timeline-width="containerWidth"
        :track-control-width="0"
        :handle-container="scaleContainer"
        :wheel-container="scaleContainer"
        :enable-container-click="true"
        :enable-snapping="true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import UnifiedPlayhead from './UnifiedPlayhead.vue'

const scaleContainer = ref<HTMLElement>()
const playheadRef = ref<InstanceType<typeof UnifiedPlayhead>>()
const containerWidth = ref(800)

// 空状态的时间刻度 - 显示0-10秒的基础刻度
const timeMarks = computed(() => {
  const marks = []
  const totalSeconds = 10 // 空状态显示10秒
  const pixelsPerSecond = containerWidth.value / totalSeconds
  
  for (let i = 0; i <= totalSeconds; i++) {
    const position = i * pixelsPerSecond
    const isMajor = i % 1 === 0 // 每秒一个主刻度
    
    marks.push({
      time: i,
      position,
      isMajor
    })
    
    // 添加半秒刻度
    if (i < totalSeconds) {
      marks.push({
        time: i + 0.5,
        position: position + pixelsPerSecond / 2,
        isMajor: false
      })
    }
  }
  
  return marks
})

// 格式化时间显示
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 监听容器大小变化
const updateContainerWidth = () => {
  if (scaleContainer.value) {
    containerWidth.value = scaleContainer.value.clientWidth
  }
}

onMounted(() => {
  updateContainerWidth()
  window.addEventListener('resize', updateContainerWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateContainerWidth)
})
</script>

<style scoped>
.time-scale {
  height: 40px;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border-primary);
  position: relative;
  overflow: hidden;
}

.scale-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.time-mark {
  position: absolute;
  top: 0;
  height: 100%;
  pointer-events: none;
}

.mark-line {
  width: 1px;
  height: 8px;
  background: var(--color-border-primary);
  margin-top: auto;
}

.mark-line.major {
  height: 16px;
  background: var(--color-text-soft);
}

.mark-label {
  position: absolute;
  top: 2px;
  left: 4px;
  font-size: 11px;
  color: var(--color-text-soft);
  white-space: nowrap;
  user-select: none;
}
</style>

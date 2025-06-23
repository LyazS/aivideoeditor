<template>
  <div class="timecode-display" :class="{ 'large': size === 'large', 'small': size === 'small' }">
    <span class="timecode-text">{{ formattedTimecode }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Timecode } from '../utils/Timecode'

interface Props {
  /** 当前时间值（微秒） */
  value: number
  /** 帧率 */
  frameRate?: number
  /** 显示尺寸 */
  size?: 'small' | 'normal' | 'large'
  /** 是否显示毫秒而不是帧 */
  showMilliseconds?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  frameRate: 30,
  size: 'normal',
  showMilliseconds: false
})

// 格式化时间码显示
const formattedTimecode = computed(() => {
  const timecode = Timecode.fromMicroseconds(props.value, props.frameRate)

  if (props.showMilliseconds) {
    // 显示毫秒格式
    const seconds = timecode.toSeconds()
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
    } else {
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
    }
  } else {
    // 显示时间码格式（帧）
    return timecode.toString()
  }
})
</script>

<style scoped>
.timecode-display {
  display: inline-block;
  font-family: 'Courier New', monospace;
  font-weight: 500;
  color: #333;
  background: rgba(0, 0, 0, 0.05);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  user-select: text;
}

.timecode-display.small {
  font-size: 12px;
  padding: 2px 6px;
}

.timecode-display.normal {
  font-size: 14px;
  padding: 4px 8px;
}

.timecode-display.large {
  font-size: 18px;
  padding: 8px 12px;
  font-weight: 600;
}

.timecode-text {
  letter-spacing: 0.5px;
}

/* 深色主题支持 */
@media (prefers-color-scheme: dark) {
  .timecode-display {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }
}

/* 高对比度主题 */
.timecode-display.high-contrast {
  background: #000;
  color: #0f0;
  border-color: #0f0;
  font-weight: bold;
}
</style>

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
      <path
        d="M12,2L15.5,8.5L22,12L15.5,15.5L12,22L8.5,15.5L2,12L8.5,8.5L12,2Z"
        :fill="hasKeyframe ? '#ff6b35' : 'transparent'"
        stroke="currentColor"
        stroke-width="1.5"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AnimatableProperty } from '../types/animationTypes'

interface Props {
  property: AnimatableProperty
  // 暂时用假数据，后续会连接真实的关键帧系统
  hasKeyframe?: boolean
}

interface Emits {
  (e: 'toggle-keyframe', property: AnimatableProperty): void
}

const props = withDefaults(defineProps<Props>(), {
  hasKeyframe: false
})

const emit = defineEmits<Emits>()

// 检查是否为当前活动的关键帧（暂时用hasKeyframe代替）
const isActive = computed(() => {
  return props.hasKeyframe
})

// 处理关键帧切换
const handleToggleKeyFrame = () => {
  emit('toggle-keyframe', props.property)
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

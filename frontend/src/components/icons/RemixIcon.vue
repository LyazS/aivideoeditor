<template>
  <i 
    :class="[
      'ri', 
      `ri-${name}`, 
      sizeClass, 
      spin && 'ri-loader-4-line',
      className
    ]" 
    :style="iconStyle"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** Remix Icon 名称（不带 ri- 前缀） */
  name: string
  /** 图标尺寸：sm(16px)、md(20px)、lg(24px)、xl(32px) */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** 是否显示旋转动画（用于加载状态） */
  spin?: boolean
  /** 自定义颜色 */
  color?: string
  /** 自定义类名 */
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  spin: false
})

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'ri-sm'
    case 'md': return 'ri-md'
    case 'lg': return 'ri-lg'
    case 'xl': return 'ri-xl'
    default: return 'ri-md'
  }
})

const iconStyle = computed(() => {
  if (!props.color) return {}
  return { color: props.color }
})
</script>

<style scoped>
.ri {
  display: inline-block;
  line-height: 1;
  vertical-align: middle;
}

/* 旋转动画 */
.ri-loader-4-line {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
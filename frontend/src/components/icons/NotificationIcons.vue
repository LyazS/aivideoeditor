<template>
  <RemixIcon :name="iconName" :size="size" :className="className" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import RemixIcon from './RemixIcon.vue'
import { NOTIFICATION_ICONS } from '../../constants/remixIcons'

interface Props {
  type: 'success' | 'error' | 'warning' | 'info'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'xl'
})

const iconName = computed(() => {
  return NOTIFICATION_ICONS[props.type]
})
</script>

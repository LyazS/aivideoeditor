<template>
  <div class="tool-component" :class="{ 'has-errors': props.validationErrors && props.validationErrors.length > 0 }">
    <div class="tool-header-single">
      <div class="status-dot" :class="{ 'error': props.validationErrors && props.validationErrors.length > 0 }"></div>
      <RemixIcon :name="toolConfig.icon" size="sm" class="tool-icon" />
      <span class="tool-title">{{ toolConfig.title }}</span>
      <span class="tool-params">{{ getParamsDisplay() }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import RemixIcon from '@/components/icons/RemixIcon.vue'
import type { ToolComponentProps } from './index'
import { getToolComponentConfig } from '@/agent/utils/toolConfigs'
import { computed } from 'vue'

const props = defineProps<ToolComponentProps & {
  toolType: string
}>()

const toolConfig = computed(() => getToolComponentConfig(props.toolType))

const getParamsDisplay = () => {
  return toolConfig.value.getParams(props.attributes)
}
</script>

<style scoped>
.tool-component {
  margin: 2px 0;
  padding: 2px 12px;
  border-radius: 6px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: rgba(209, 213, 219, 0.1);
}

/* 单行头部样式 */
.tool-header-single {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 20px;
}

/* 状态指示点 */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #10b981;
  flex-shrink: 0;
}

.status-dot.error {
  background-color: #dc2626;
}

.tool-icon {
  flex-shrink: 0;
  color: #9ca3af;
}

.tool-title {
  font-weight: 600;
  font-size: 13px;
  color: #cbd0d6;
  flex-shrink: 0;
}

.tool-params {
  font-size: 11px;
  color: #adb3bd;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
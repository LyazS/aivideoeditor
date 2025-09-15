<template>
  <div class="properties-panel">
    <div class="panel-header">
      <h3>{{ t('properties.panelTitle') }}</h3>
      <span v-if="showPlayheadOutOfRangeHint" class="playhead-hint"> {{ t('properties.playheadStatus.outOfRange') }} </span>
    </div>

    <div class="panel-content">
      <!-- 多选状态 -->
      <div v-if="multiSelectInfo" class="multi-select-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" />
        </svg>
        <p>{{ t('properties.multiSelect.title', { count: multiSelectInfo.count }) }}</p>
        <p class="hint">{{ t('properties.multiSelect.hint') }}</p>

        <!-- 选中项目列表 -->
        <div class="selected-items-list">
          <div v-for="item in multiSelectInfo.items" :key="item?.id" class="selected-item">
            <span class="item-name">
              {{ item ? getItemDisplayName(item) : t('properties.multiSelect.unknownMedia') }}
            </span>
            <span class="item-type">{{
              t('properties.mediaTypes.' + (item?.mediaType || 'unknown'))
            }}</span>
          </div>
        </div>
      </div>

      <!-- 单选状态 -->
      <div v-else-if="selectedTimelineItem" class="properties-content">
        <!-- 只在ready状态时显示完整属性面板 -->
        <template v-if="selectedTimelineItem.timelineStatus === 'ready'">
          <!-- 根据选中项目类型显示不同的属性组件 -->
          <UnifiedVideoClipProperties
            v-if="
              selectedTimelineItem.mediaType === 'video' ||
              selectedTimelineItem.mediaType === 'image'
            "
            :selected-timeline-item="
              selectedTimelineItem as UnifiedTimelineItemData<'video' | 'image'>
            "
            :current-frame="currentFrame"
          />

          <!-- 文本项目属性组件 -->
          <UnifiedTextClipProperties
            v-else-if="selectedTimelineItem.mediaType === 'text'"
            :selected-timeline-item="selectedTimelineItem as UnifiedTimelineItemData<'text'>"
            :current-frame="currentFrame"
          />

          <!-- 音频项目属性组件 -->
          <UnifiedAudioClipProperties
            v-else-if="selectedTimelineItem.mediaType === 'audio'"
            :selected-timeline-item="selectedTimelineItem as UnifiedTimelineItemData<'audio'>"
            :current-frame="currentFrame"
          />
        </template>

        <!-- 非ready状态时显示加载状态或简化属性 -->
        <div v-else class="loading-properties">
          <div class="loading-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
            </svg>
          </div>
          <p class="loading-text">{{ t('properties.singleSelect.loading') }}</p>
          <p class="loading-status">
            {{
              t('properties.singleSelect.loadingStatus', {
                status: getStatusText(selectedTimelineItem),
              })
            }}
          </p>
        </div>
      </div>

      <!-- 无选择状态 -->
      <div v-else class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,16.5L18,9.5L16.5,8L11,13.5L7.5,10L6,11.5L11,16.5Z"
          />
        </svg>
        <p>{{ t('properties.singleSelect.emptyHint') }}</p>
        <p class="hint">{{ t('properties.singleSelect.emptyHintDetail') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { useAppI18n } from '@/unified/composables/useI18n'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import { getStatusText } from '@/unified/timelineitem/TimelineItemQueries'
import { isPlayheadInTimelineItem } from '@/unified/utils/timelineSearchUtils'

import UnifiedVideoClipProperties from './properties/UnifiedVideoClipProperties.vue'
import UnifiedTextClipProperties from './properties/UnifiedTextClipProperties.vue'
import UnifiedAudioClipProperties from './properties/UnifiedAudioClipProperties.vue'

const unifiedStore = useUnifiedStore()
const { t } = useAppI18n()

// 选中的时间轴项目
const selectedTimelineItem = computed(() => {
  // 多选模式时返回null，显示占位内容
  if (unifiedStore.isMultiSelectMode) return null

  // 单选模式时返回选中项
  const selectedIds = unifiedStore.selectedTimelineItemIds
  if (selectedIds.size === 0) return null

  const firstSelectedId = Array.from(selectedIds)[0]
  return unifiedStore.getTimelineItem(firstSelectedId) || null
})

// 当前播放帧数
const currentFrame = computed(() => unifiedStore.currentFrame)

// 多选状态信息
const multiSelectInfo = computed(() => {
  if (!unifiedStore.isMultiSelectMode) return null

  const selectedIds = unifiedStore.selectedTimelineItemIds
  return {
    count: selectedIds.size,
    items: Array.from(selectedIds)
      .map((id) => unifiedStore.getTimelineItem(id))
      .filter(Boolean),
  }
})

// 获取项目显示名称
const getItemDisplayName = (item: any) => {
  if (!item) return '未知素材'

  if (item.mediaType === 'text') {
    // 文本项目显示文本内容
    const text = item.config?.text || '空文本'
    return text.length > 15 ? text.substring(0, 15) + '...' : text
  } else {
    // 其他类型显示素材名称
    return unifiedStore.getMediaItem(item.mediaItemId)?.name || '未知素材'
  }
}

// 播放头位置状态计算属性
const isPlayheadInSelectedItem = computed(() => {
  if (!selectedTimelineItem.value) return false
  return isPlayheadInTimelineItem(selectedTimelineItem.value, currentFrame.value)
})

// 是否显示播放头不在区间提示
const showPlayheadOutOfRangeHint = computed(() => {
  return selectedTimelineItem.value && !isPlayheadInSelectedItem.value
})
</script>

<style scoped>
.properties-panel {
  width: 100%;
  height: 100%;
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-medium);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 使用通用的 panel-header, panel-content, empty-state, hint 样式 */

.properties-content {
  padding: var(--spacing-md) var(--spacing-lg);
}

/* 属性面板特定样式 - 通用属性样式已迁移到 styles/components/panels.css 和 styles/components/inputs.css */

/* 时长控制样式 */
.duration-controls {
  display: flex;
  align-items: center;
  flex: 1;
}

/* 倍速控制样式 */
.speed-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
}

/* 分段倍速滑块容器 */
.segmented-speed-container {
  position: relative;
  flex: 1;
  height: 40px;
  display: flex;
  align-items: center;
}

.segmented-speed-slider {
  width: 100%;
  height: 4px;
  background: var(--color-bg-quaternary);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
  position: relative;
  z-index: 2;
}

.segmented-speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: var(--color-accent-secondary);
  border-radius: 50%;
  cursor: pointer;
}

.segmented-speed-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: var(--color-accent-secondary);
  border-radius: 50%;
  border: none;
  cursor: pointer;
}

/* 分段竖线 */
.speed-dividers {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 12px;
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 1;
}

.speed-divider {
  position: absolute;
  width: 1px;
  height: 100%;
  background: var(--color-border-secondary);
  transform: translateX(-50%);
}

/* 音量控制样式 */
.volume-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
}

.volume-slider {
  flex: 1;
  height: 4px;
  background: var(--color-bg-quaternary);
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: var(--color-accent-secondary);
  border-radius: 50%;
  cursor: pointer;
}

.volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: var(--color-accent-secondary);
  border-radius: 50%;
  border: none;
  cursor: pointer;
}

.mute-btn {
  background: var(--color-bg-quaternary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-small);
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xs);
  transition: all 0.2s ease;
  min-width: 32px;
  height: 32px;
}

.mute-btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-focus);
}

.mute-btn.muted {
  background: var(--color-accent-secondary);
  color: var(--color-bg-primary);
}

/* 位置控制样式 */
.position-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
}

.position-input-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 1;
}

.position-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-hint);
  min-width: 12px;
  text-align: center;
}

/* 复选框样式 */
.checkbox-input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-text-primary);
  cursor: pointer;
}

.scale-controls,
.rotation-controls,
.opacity-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
}

/* 使用通用的 slider 样式 */
.scale-slider,
.rotation-slider,
.opacity-slider {
  flex: 1;
  height: 4px;
  background: var(--color-bg-quaternary);
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.scale-slider::-webkit-slider-thumb,
.rotation-slider::-webkit-slider-thumb,
.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: var(--color-accent-secondary);
  border-radius: 50%;
  cursor: pointer;
}

.scale-slider::-moz-range-thumb,
.rotation-slider::-moz-range-thumb,
.opacity-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: var(--color-accent-secondary);
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

/* 分辨率显示样式已迁移到 styles/components/inputs.css */

/* 对齐控制样式 */
.alignment-controls {
  display: flex;
  gap: var(--spacing-xs);
  flex: 1;
}

/* 使用通用的 align-btn 样式 */

/* 多选状态样式 */
.multi-select-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: var(--color-text-secondary);
  padding: var(--spacing-lg);
  height: 100%;
  overflow: hidden;
}

.multi-select-state svg {
  color: var(--color-success);
  margin-bottom: var(--spacing-md);
}

.multi-select-state p {
  margin: var(--spacing-xs) 0;
  font-size: var(--font-size-base);
}

.multi-select-state .hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-hint);
}

.selected-items-list {
  margin-top: var(--spacing-lg);
  width: 100%;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.selected-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
  background: var(--color-bg-quaternary);
  border-radius: var(--border-radius-small);
  font-size: var(--font-size-sm);
}

.selected-item .item-name {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: var(--spacing-sm);
}

.selected-item .item-type {
  color: var(--color-text-hint);
  font-size: var(--font-size-xs);
  flex-shrink: 0;
}

/* 统一关键帧按钮样式 */
.unified-keyframe-toggle {
  display: flex;
  align-items: center;
  gap: 0px;
  padding: 0px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-primary); /* 默认白色 */
  height: 36px; /* 改为固定高度，与导航按钮一致 */
  position: relative;
}

.unified-keyframe-toggle:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-hover);
  transform: translateY(-1px);
}

/* 状态样式 */
.unified-keyframe-toggle.state-none {
  color: var(--color-text-primary); /* 白色 */
  border-color: var(--color-border);
}

.unified-keyframe-toggle.state-none:hover {
  border-color: var(--color-border-hover);
  background: var(--color-bg-tertiary);
}

.unified-keyframe-toggle.state-on-keyframe {
  color: var(--color-text-primary); /* 白色字体 */
  background: rgba(64, 158, 255, 0.2);
  border-color: #409eff;
  box-shadow: 0 0 8px rgba(64, 158, 255, 0.4);
}

.unified-keyframe-toggle.state-on-keyframe svg {
  color: #409eff; /* 钻石图标保持更亮的蓝色 */
}

.unified-keyframe-toggle.state-on-keyframe:hover {
  background: rgba(64, 158, 255, 0.3);
  box-shadow: 0 0 12px rgba(64, 158, 255, 0.6);
}

.unified-keyframe-toggle.state-between-keyframes {
  color: #ffd700; /* 金色 */
  background: rgba(255, 215, 0, 0.15);
  border-color: #ffd700;
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
}

.unified-keyframe-toggle.state-between-keyframes:hover {
  background: rgba(255, 215, 0, 0.25);
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.5);
}

/* 禁用状态样式 */
.unified-keyframe-toggle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: var(--color-bg-disabled);
  color: var(--color-text-disabled);
  border-color: var(--color-border-disabled);
  box-shadow: none;
}

.unified-keyframe-toggle:disabled:hover {
  background: var(--color-bg-disabled);
  border-color: var(--color-border-disabled);
  transform: none;
  box-shadow: none;
}

/* 关键帧控制按钮行 */
.keyframe-controls-row {
  display: flex;
  gap: 6px;
  align-items: stretch; /* 让所有按钮高度一致 */
  margin-bottom: 16px;
  flex-wrap: wrap; /* 在小屏幕上允许换行 */
}

/* 主关键帧按钮 */
.keyframe-controls-row .unified-keyframe-toggle {
  flex: 1 1 auto; /* 主按钮占据更多空间 */
  min-width: 90px;
  max-width: 120px;
  font-size: 14px; /* 与导航按钮保持一致 */
  height: 36px; /* 确保与导航按钮高度一致 */
}

/* 导航和调试按钮 */
.keyframe-controls-row .keyframe-nav-btn,
.keyframe-controls-row .debug-btn {
  flex: 0 0 auto;
  padding: 8px 10px;
  font-size: 11px;
  min-width: 55px;
  height: 36px; /* 与主按钮高度一致 */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.keyframe-controls-row .keyframe-nav-btn:hover:not(:disabled),
.keyframe-controls-row .debug-btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-hover);
  transform: translateY(-1px);
}

.keyframe-controls-row .keyframe-nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: var(--color-bg-disabled);
  color: var(--color-text-disabled);
}

.keyframe-controls-row .keyframe-nav-btn span,
.keyframe-controls-row .debug-btn span,
.keyframe-controls-row .unified-keyframe-toggle span {
  font-size: 10px;
  white-space: nowrap;
}

/* 响应式调整 */
@media (max-width: 400px) {
  .keyframe-controls-row {
    flex-wrap: wrap;
    gap: 4px;
  }

  .keyframe-controls-row .unified-keyframe-toggle {
    flex: 1 1 100%;
    margin-bottom: 4px;
  }

  .keyframe-controls-row .keyframe-nav-btn,
  .keyframe-controls-row .debug-btn {
    flex: 1 1 calc(33.333% - 3px);
    min-width: 0;
  }
}

/* 属性项特定布局调整 */

.property-item .position-controls,
.property-item .scale-controls,
.property-item .rotation-controls,
.property-item .opacity-controls {
  flex: 1;
}

/* 加载状态样式 */
.loading-properties {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--color-text-secondary);
}

.loading-icon {
  margin-bottom: var(--spacing-md);
  animation: spin 1s linear infinite;
}

.loading-icon svg {
  color: var(--color-accent-secondary);
}

.loading-text {
  font-size: var(--font-size-base);
  margin-bottom: var(--spacing-sm);
}

.loading-status {
  font-size: var(--font-size-sm);
  color: var(--color-text-hint);
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 播放头位置提示样式 */
.playhead-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-hint);
  margin-left: var(--spacing-sm);
  font-weight: normal;
}

/* 调整标题区域布局 */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
}

.panel-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
}
</style>

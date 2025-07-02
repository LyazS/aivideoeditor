<template>
  <div class="properties-panel">
    <div class="panel-header">
      <h3>属性</h3>
    </div>

    <div class="panel-content">
      <!-- 多选状态 -->
      <div v-if="multiSelectInfo" class="multi-select-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" />
        </svg>
        <p>已选择 {{ multiSelectInfo.count }} 个片段</p>
        <p class="hint">批量操作功能开发中...</p>

        <!-- 选中项目列表 -->
        <div class="selected-items-list">
          <div v-for="item in multiSelectInfo.items" :key="item?.id" class="selected-item">
            <span class="item-name">
              {{
                item ? videoStore.getMediaItem(item.mediaItemId)?.name || '未知素材' : '未知素材'
              }}
            </span>
            <span class="item-type">{{ getMediaTypeLabel(item?.mediaType) }}</span>
          </div>
        </div>
      </div>

      <!-- 单选状态 -->
      <div v-else-if="selectedTimelineItem" class="properties-content">
        <!-- 根据选中项目类型显示不同的属性组件 -->
        <VideoClipProperties
          v-if="
            selectedTimelineItem.mediaType === 'video' || selectedTimelineItem.mediaType === 'image'
          "
          :selected-timeline-item="selectedTimelineItem"
          :current-frame="currentFrame"
        />

        <!-- 文本属性组件 -->
        <TextProperties
          v-else-if="selectedTimelineItem.mediaType === 'text'"
          :config="selectedTimelineItem.config"
          :timeline-item="selectedTimelineItem"
          @update:config="handleTextConfigUpdate"
          @update:text="handleTextUpdate"
        />

        <!-- 未来可以在这里添加其他类型的属性组件，比如字幕属性组件 -->
        <!-- <SubtitleClipProperties v-else-if="selectedTimelineItem.mediaType === 'subtitle'" ... /> -->
      </div>

      <!-- 无选择状态 -->
      <div v-else class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,16.5L18,9.5L16.5,8L11,13.5L7.5,10L6,11.5L11,16.5Z"
          />
        </svg>
        <p>选择片段查看属性</p>
        <p class="hint">在时间轴上点击视频片段</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import VideoClipProperties from './VideoClipProperties.vue'
import TextProperties from './TextProperties.vue'

const videoStore = useVideoStore()

// 选中的时间轴项目
const selectedTimelineItem = computed(() => {
  // 多选模式时返回null，显示占位内容
  if (videoStore.isMultiSelectMode) return null

  // 单选模式时返回选中项
  if (!videoStore.selectedTimelineItemId) return null
  return videoStore.getTimelineItem(videoStore.selectedTimelineItemId) || null
})

// 当前播放帧数
const currentFrame = computed(() => videoStore.currentFrame)

// 多选状态信息
const multiSelectInfo = computed(() => {
  if (!videoStore.isMultiSelectMode) return null

  return {
    count: videoStore.selectedTimelineItemIds.size,
    items: Array.from(videoStore.selectedTimelineItemIds)
      .map((id) => videoStore.getTimelineItem(id))
      .filter(Boolean),
  }
})

// 文本属性更新处理
async function handleTextConfigUpdate(newConfig: any) {
  if (!selectedTimelineItem.value || selectedTimelineItem.value.mediaType !== 'text') {
    return
  }

  try {
    console.log('🎨 更新文本配置:', newConfig)

    // 直接更新配置（非命令模式，用于实时预览）
    Object.assign(selectedTimelineItem.value.config, newConfig)

    // 同步到WebAV精灵
    const textSprite = selectedTimelineItem.value.sprite as any
    if (textSprite && typeof textSprite.updateFromConfig === 'function') {
      await textSprite.updateFromConfig(newConfig)
    }

    console.log('✅ 文本配置更新成功')
  } catch (error) {
    console.error('❌ 更新文本配置失败:', error)
  }
}

// 文本内容和样式更新处理
async function handleTextUpdate(text: string, style: any, originalText?: string) {
  console.log('📥 [PropertiesPanel] 收到文本更新请求:', {
    text: text.substring(0, 20) + '...',
    style,
    originalText: originalText?.substring(0, 20) + '...',
    selectedItem: selectedTimelineItem.value?.id,
    mediaType: selectedTimelineItem.value?.mediaType
  })

  if (!selectedTimelineItem.value || selectedTimelineItem.value.mediaType !== 'text') {
    console.warn('⚠️ [PropertiesPanel] 无效的选中项目或非文本类型')
    return
  }

  try {
    // 使用原始文本进行比较，如果没有提供则使用当前配置中的文本
    const comparisonText = originalText || selectedTimelineItem.value.config.text

    console.log('🎨 [PropertiesPanel] 开始更新文本内容和样式:', {
      text: text.substring(0, 20) + '...',
      style,
      comparisonText: comparisonText.substring(0, 20) + '...',
      currentText: selectedTimelineItem.value.config.text.substring(0, 20) + '...'
    })

    // 使用命令系统更新文本内容（支持撤销/重做）
    if (text !== comparisonText) {
      console.log('📝 [PropertiesPanel] 文本内容有变化，调用updateTextContentWithHistory')
      await videoStore.updateTextContentWithHistory(selectedTimelineItem.value.id, text)
    } else {
      console.log('⏭️ [PropertiesPanel] 文本内容无变化，跳过内容更新')
    }

    // 使用命令系统更新文本样式（支持撤销/重做）
    if (style && Object.keys(style).length > 0) {
      console.log('🎨 [PropertiesPanel] 样式有变化，调用updateTextStyleWithHistory')
      await videoStore.updateTextStyleWithHistory(selectedTimelineItem.value.id, style)
    } else {
      console.log('⏭️ [PropertiesPanel] 样式无变化，跳过样式更新')
    }

    console.log('✅ [PropertiesPanel] 文本内容和样式更新成功')
  } catch (error) {
    console.error('❌ [PropertiesPanel] 更新文本内容和样式失败:', error)
  }
}

// 获取媒体类型标签
function getMediaTypeLabel(mediaType: string | undefined): string {
  switch (mediaType) {
    case 'video':
      return '视频'
    case 'image':
      return '图片'
    case 'audio':
      return '音频'
    case 'text':
      return '文本'
    default:
      return '未知'
  }
}
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
  justify-content: center;
  height: 200px;
  text-align: center;
  color: var(--color-text-secondary);
  padding: var(--spacing-lg);
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
  max-height: 150px;
  overflow-y: auto;
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
</style>

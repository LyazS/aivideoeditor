<template>
  <div class="property-section unified-keyframe-section">
    <div class="section-header">
      <h4>关键帧动画</h4>
    </div>

    <!-- 关键帧控制按钮组 - 一行显示 -->
    <div class="keyframe-controls-row">
      <!-- 主关键帧按钮 -->
      <button
        class="unified-keyframe-toggle"
        :class="{
          'state-none': keyframeButtonState === 'none',
          'state-on-keyframe': keyframeButtonState === 'on-keyframe',
          'state-between-keyframes': keyframeButtonState === 'between-keyframes',
        }"
        @click="$emit('toggle-keyframe')"
        :disabled="!canOperateKeyframes"
        :title="keyframeTooltip"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M8 2L14 8L8 14L2 8L8 2Z" fill="currentColor" stroke="white" stroke-width="1" />
        </svg>
        <span>关键帧</span>
      </button>

      <!-- 上一个关键帧 -->
      <button
        @click="$emit('go-to-previous')"
        :disabled="!hasPreviousKeyframe || !canOperateKeyframes"
        class="keyframe-nav-btn"
        title="上一个关键帧"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z" />
        </svg>
        <span>上一帧</span>
      </button>

      <!-- 下一个关键帧 -->
      <button
        @click="$emit('go-to-next')"
        :disabled="!hasNextKeyframe || !canOperateKeyframes"
        class="keyframe-nav-btn"
        title="下一个关键帧"
      >
        <span>下一帧</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
        </svg>
      </button>

      <!-- 调试按钮 - 开发时使用 -->
      <button 
        v-if="showDebugButton"
        @click="$emit('debug-keyframes')" 
        class="debug-btn" 
        title="输出统一关键帧调试信息"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6M9,8V17H11V8H9M13,8V17H15V8H13Z"
          />
        </svg>
        <span>调试</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  keyframeButtonState: 'none' | 'on-keyframe' | 'between-keyframes'
  canOperateKeyframes: boolean
  hasPreviousKeyframe: boolean
  hasNextKeyframe: boolean
  keyframeTooltip: string
  showDebugButton?: boolean
}

interface Emits {
  (e: 'toggle-keyframe'): void
  (e: 'go-to-previous'): void
  (e: 'go-to-next'): void
  (e: 'debug-keyframes'): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<style scoped>
.unified-keyframe-section {
  border-bottom: 1px solid var(--color-border-secondary);
  padding-bottom: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.section-header {
  margin-bottom: var(--spacing-sm);
}

.section-header h4 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  font-weight: 600;
}

.keyframe-controls-row {
  display: flex;
  gap: 6px;
  align-items: stretch;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

/* 主关键帧按钮 */
.keyframe-controls-row .unified-keyframe-toggle {
  flex: 1 1 auto;
  min-width: 90px;
  max-width: 120px;
  font-size: 14px;
  height: 36px;
}

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
  color: var(--color-text-primary);
  height: 36px;
  position: relative;
}

.unified-keyframe-toggle:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-hover);
  transform: translateY(-1px);
}

/* 状态样式 */
.unified-keyframe-toggle.state-none {
  color: var(--color-text-primary);
  border-color: var(--color-border);
}

.unified-keyframe-toggle.state-none:hover {
  border-color: var(--color-border-hover);
  background: var(--color-bg-tertiary);
}

.unified-keyframe-toggle.state-on-keyframe {
  color: var(--color-text-primary);
  background: rgba(64, 158, 255, 0.2);
  border-color: #409eff;
  box-shadow: 0 0 8px rgba(64, 158, 255, 0.4);
}

.unified-keyframe-toggle.state-on-keyframe svg {
  color: #409eff;
}

.unified-keyframe-toggle.state-on-keyframe:hover {
  background: rgba(64, 158, 255, 0.3);
  box-shadow: 0 0 12px rgba(64, 158, 255, 0.6);
}

.unified-keyframe-toggle.state-between-keyframes {
  color: #ffd700;
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

/* 导航和调试按钮 */
.keyframe-controls-row .keyframe-nav-btn,
.keyframe-controls-row .debug-btn {
  flex: 0 0 auto;
  padding: 8px 10px;
  font-size: 11px;
  min-width: 55px;
  height: 36px;
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
</style>

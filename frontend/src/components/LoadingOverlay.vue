<template>
  <Transition name="loading-fade" appear>
    <div v-if="visible" class="loading-overlay">
      <div class="loading-content">
        <!-- 加载图标 -->
        <div class="loading-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" class="loading-spinner">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-dasharray="31.416"
              stroke-dashoffset="31.416"
            >
              <animate
                attributeName="stroke-dasharray"
                dur="2s"
                values="0 31.416;15.708 15.708;0 31.416"
                repeatCount="indefinite"
              />
              <animate
                attributeName="stroke-dashoffset"
                dur="2s"
                values="0;-15.708;-31.416"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
        </div>

        <!-- 加载标题 -->
        <h2 class="loading-title">正在加载项目</h2>

        <!-- 当前阶段 -->
        <p class="loading-stage">{{ currentStage }}</p>

        <!-- 进度条 -->
        <div class="progress-container">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: Math.max(0, Math.min(100, progress || 0)) + '%' }"
            ></div>
          </div>
          <span class="progress-text">{{ Math.round(progress || 0) }}%</span>
        </div>

        <!-- 详细信息 -->
        <div class="loading-details" v-if="details">
          <p class="details-text">{{ details }}</p>
        </div>

        <!-- 提示信息 -->
        <div class="loading-tips">
          <p class="tip-text">请稍候，正在为您准备编辑环境...</p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Props
interface Props {
  /** 是否显示加载覆盖层 */
  visible: boolean
  /** 当前加载阶段 */
  stage?: string
  /** 加载进度 (0-100) */
  progress?: number
  /** 详细信息 */
  details?: string
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  stage: '准备中...',
  progress: 0,
  details: '',
})

// 计算属性
const currentStage = computed(() => {
  return props.stage || '准备中...'
})
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* Vue Transition 动画 */
.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.2s ease;
}

.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}

.loading-content {
  text-align: center;
  color: var(--color-text-primary);
  max-width: 400px;
  padding: var(--spacing-xxl);
}

.loading-icon {
  margin-bottom: var(--spacing-xl);
}

.loading-spinner {
  color: var(--color-accent-primary, #4caf50);
  animation: rotate 2s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.loading-title {
  font-size: var(--font-size-xxl);
  font-weight: 600;
  margin-bottom: var(--spacing-lg);
  color: var(--color-text-primary);
}

.loading-stage {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-xl);
  min-height: 1.5em;
}

.progress-container {
  margin-bottom: var(--spacing-xl);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: var(--spacing-sm);
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--color-accent-primary, #4caf50),
    var(--color-accent-secondary, #2196f3)
  );
  border-radius: 4px;
  transition: width 0.5s ease-out;
  position: relative;
  overflow: hidden;
  min-width: 2px; /* 确保即使进度为0也有一些可见的宽度 */
}

.progress-fill::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

@keyframes shimmer {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
}

.progress-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.loading-details {
  margin-bottom: var(--spacing-lg);
  min-height: 1.2em;
}

.details-text {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  font-style: italic;
}

.loading-tips {
  border-top: 1px solid var(--color-border-secondary);
  padding-top: var(--spacing-lg);
}

.tip-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  opacity: 0.8;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .loading-content {
    max-width: 320px;
    padding: var(--spacing-xl);
  }

  .loading-title {
    font-size: var(--font-size-xl);
  }

  .loading-stage {
    font-size: var(--font-size-base);
  }
}

/* 深色主题适配 */
@media (prefers-color-scheme: dark) {
  .loading-overlay {
    background: rgba(0, 0, 0, 0.95);
  }
}

/* 高对比度模式 */
@media (prefers-contrast: high) {
  .loading-overlay {
    background: rgba(0, 0, 0, 0.98);
  }

  .progress-bar {
    border: 1px solid var(--color-border-primary);
  }
}

/* 减少动画模式 */
@media (prefers-reduced-motion: reduce) {
  .loading-spinner,
  .progress-fill {
    animation: none;
  }

  .loading-overlay {
    animation: none;
  }
}
</style>

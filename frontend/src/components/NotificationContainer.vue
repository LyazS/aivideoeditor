<template>
  <div class="notification-container">
    <TransitionGroup name="notification" tag="div" class="notification-list">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="['notification', `notification--${notification.type}`]"
        @click="removeNotification(notification.id)"
        role="alert"
        :aria-live="notification.type === 'error' ? 'assertive' : 'polite'"
      >
        <div class="notification__icon">
          <NotificationIcons :type="notification.type" />
        </div>
        <div class="notification__message">
          {{ notification.message }}
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useUnifiedStore } from '@/unified/unifiedStore'
import NotificationIcons from './icons/NotificationIcons.vue'

const unifiedStore = useUnifiedStore()

// 获取通知列表
const notifications = computed(() => unifiedStore.notifications)

// 移除通知
function removeNotification(id: string) {
  unifiedStore.removeNotification(id)
}
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  pointer-events: none;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 500px;
  min-width: 320px;
}

.notification {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(8px);
  cursor: pointer;
  pointer-events: auto;
  max-width: 100%;
  word-wrap: break-word;
  font-size: 13px;
  position: relative;
  background: var(--color-bg-quaternary);
  color: var(--color-text-primary);
}

.notification--success .notification__icon {
  color: #63e2b7;
}

.notification--error .notification__icon {
  color: #e88080;
}

.notification--warning .notification__icon {
  color: #f2c97d;
}

.notification--info .notification__icon {
  color: #70c0e8;
}

.notification__icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: currentColor;
  border-radius: 50%;
  padding: 2px;
}

.notification__icon svg {
  width: 10px;
  height: 10px;
  color: var(--color-bg-quaternary);
}

.notification__message {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  font-size: 14px;
  line-height: 1.6;
  opacity: 0.9;
}

/* 过渡动画 */
.notification-enter-active {
  transition: all 0.25s ease;
}

.notification-leave-active {
  transition: all 0.25s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}

.notification-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}

.notification-move {
  transition: transform 0.25s ease;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .notification-container {
    top: 12px;
    left: 12px;
    right: 12px;
    transform: none;
  }

  .notification-list {
    max-width: none;
  }

  .notification {
    padding: 3px 6px;
    font-size: 12px;
  }

  .notification__icon {
    width: 12px;
    height: 12px;
  }

  .notification__message {
    font-size: 12px;
  }
}

/* 深色模式适配 */

/* 减少动画效果（用户偏好） */
@media (prefers-reduced-motion: reduce) {
  .notification-enter-active,
  .notification-leave-active,
  .notification-move {
    transition: none;
  }
}
</style>

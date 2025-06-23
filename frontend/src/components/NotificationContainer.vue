<template>
  <div class="notification-container">
    <TransitionGroup name="notification" tag="div" class="notification-list">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="[
          'notification',
          `notification--${notification.type}`
        ]"
        @click="removeNotification(notification.id)"
        role="alert"
        :aria-live="notification.type === 'error' ? 'assertive' : 'polite'"
      >
        <div class="notification__icon">
          <NotificationIcons :type="notification.type" />
        </div>
        <div class="notification__content">
          <div class="notification__title">{{ notification.title }}</div>
          <div v-if="notification.message" class="notification__message">
            {{ notification.message }}
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import NotificationIcons from './icons/NotificationIcons.vue'

const videoStore = useVideoStore()

// 获取通知列表
const notifications = computed(() => videoStore.notifications)

// 移除通知
function removeNotification(id: string) {
  videoStore.removeNotification(id)
}

// 键盘快捷键支持
function handleKeydown(event: KeyboardEvent) {
  // ESC键清除所有通知
  if (event.key === 'Escape' && notifications.value.length > 0) {
    videoStore.clearNotifications()
    event.preventDefault()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
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
  max-width: 320px;
  min-width: 280px;
}

.notification {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(8px);
  cursor: pointer;
  pointer-events: auto;
  transition: all 0.2s ease;
  max-width: 100%;
  word-wrap: break-word;
  font-size: 13px;
  position: relative;
}

.notification:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}

.notification--success {
  background: rgba(34, 197, 94, 0.95);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: white;
}

.notification--success::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #16a34a;
  border-radius: 6px 0 0 6px;
}

.notification--error {
  background: rgba(239, 68, 68, 0.95);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: white;
}

.notification--error::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #dc2626;
  border-radius: 6px 0 0 6px;
}

.notification--warning {
  background: rgba(245, 158, 11, 0.95);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: white;
}

.notification--warning::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #d97706;
  border-radius: 6px 0 0 6px;
}

.notification--info {
  background: rgba(59, 130, 246, 0.95);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: white;
}

.notification--info::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #2563eb;
  border-radius: 6px 0 0 6px;
}

.notification__icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.notification__content {
  flex: 1;
  min-width: 0;
}

.notification__title {
  font-weight: 500;
  font-size: 13px;
  line-height: 1.3;
  margin-bottom: 2px;
}

.notification__message {
  font-size: 12px;
  line-height: 1.3;
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
    min-width: auto;
  }

  .notification {
    padding: 6px 10px;
    font-size: 12px;
  }

  .notification__icon {
    width: 14px;
    height: 14px;
  }

  .notification__title {
    font-size: 12px;
  }

  .notification__message {
    font-size: 11px;
  }
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .notification--success {
    background: rgba(34, 197, 94, 0.9);
    border-color: rgba(34, 197, 94, 0.4);
  }

  .notification--error {
    background: rgba(239, 68, 68, 0.9);
    border-color: rgba(239, 68, 68, 0.4);
  }

  .notification--warning {
    background: rgba(245, 158, 11, 0.9);
    border-color: rgba(245, 158, 11, 0.4);
  }

  .notification--info {
    background: rgba(59, 130, 246, 0.9);
    border-color: rgba(59, 130, 246, 0.4);
  }
}

/* 减少动画效果（用户偏好） */
@media (prefers-reduced-motion: reduce) {
  .notification-enter-active,
  .notification-leave-active,
  .notification-move,
  .notification {
    transition: none;
  }

  .notification:hover {
    transform: none;
  }
}
</style>

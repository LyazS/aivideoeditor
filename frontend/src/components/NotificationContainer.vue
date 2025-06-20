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
import { computed } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import NotificationIcons from './icons/NotificationIcons.vue'

const videoStore = useVideoStore()

// 获取通知列表
const notifications = computed(() => videoStore.notifications)

// 移除通知
function removeNotification(id: string) {
  videoStore.removeNotification(id)
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
  pointer-events: auto;
  transition: all 0.2s ease;
  max-width: 100%;
  word-wrap: break-word;
  font-size: 13px;
}

.notification--success {
  background: rgba(34, 197, 94, 0.95);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: white;
}

.notification--error {
  background: rgba(239, 68, 68, 0.95);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: white;
}

.notification--warning {
  background: rgba(245, 158, 11, 0.95);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: white;
}

.notification--info {
  background: rgba(59, 130, 246, 0.95);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: white;
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
</style>

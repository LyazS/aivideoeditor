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
        <button
          class="notification__close"
          @click.stop="removeNotification(notification.id)"
          aria-label="关闭通知"
        >
          ×
        </button>
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
  top: 20px;
  right: 20px;
  z-index: 9999;
  pointer-events: none;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 400px;
}

.notification {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(8px);
  cursor: pointer;
  pointer-events: auto;
  transition: all 0.2s ease;
  max-width: 100%;
  word-wrap: break-word;
}

.notification:hover {
  transform: translateX(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.notification--success {
  background: rgba(34, 197, 94, 0.9);
  border-left: 4px solid #16a34a;
  color: white;
}

.notification--error {
  background: rgba(239, 68, 68, 0.9);
  border-left: 4px solid #dc2626;
  color: white;
}

.notification--warning {
  background: rgba(245, 158, 11, 0.9);
  border-left: 4px solid #d97706;
  color: white;
}

.notification--info {
  background: rgba(59, 130, 246, 0.9);
  border-left: 4px solid #2563eb;
  color: white;
}

.notification__icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

.notification__content {
  flex: 1;
  min-width: 0;
}

.notification__title {
  font-weight: 600;
  font-size: 14px;
  line-height: 1.4;
  margin-bottom: 4px;
}

.notification__message {
  font-size: 13px;
  line-height: 1.4;
  opacity: 0.9;
}

.notification__close {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: currentColor;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
  transition: background-color 0.2s ease;
}

.notification__close:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 过渡动画 */
.notification-enter-active {
  transition: all 0.3s ease;
}

.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-move {
  transition: transform 0.3s ease;
}

/* 响应式设计 */
@media (max-width: 480px) {
  .notification-container {
    top: 10px;
    right: 10px;
    left: 10px;
  }
  
  .notification-list {
    max-width: none;
  }
  
  .notification {
    padding: 12px;
  }
  
  .notification__title {
    font-size: 13px;
  }
  
  .notification__message {
    font-size: 12px;
  }
}
</style>

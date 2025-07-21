<template>
  <div class="timeline">
    <!-- 顶部区域：轨道管理器头部 + 时间刻度 -->
    <div class="timeline-header">
      <div class="track-manager-header">
        <h3>轨道</h3>
        <HoverButton variant="small" @click="showAddTrackMenu" title="添加新轨道">
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
            </svg>
          </template>
        </HoverButton>
      </div>
      <div class="timeline-scale">
        <UnifiedTimeScale />
      </div>
    </div>

    <!-- 主体区域：空轨道显示 -->
    <div class="timeline-body">
      <!-- 默认轨道 - 空状态 -->
      <div
        v-for="track in defaultTracks"
        :key="track.id"
        class="track-row"
        :style="{ height: track.height + 'px' }"
      >
        <!-- 左侧轨道控制 -->
        <div class="track-controls">
          <!-- 轨道颜色标识 -->
          <div class="track-color-indicator" :class="`track-color-${track.type}`"></div>

          <!-- 轨道名称 -->
          <div class="track-name">
            <!-- 轨道类型图标和片段数量 -->
            <div class="track-type-info" :title="`${getTrackTypeLabel(track.type)}轨道，共 0 个片段`">
              <div class="track-type-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path :d="getTrackTypeIcon(track.type)" />
                </svg>
              </div>
              <div class="clip-count">0</div>
            </div>

            <span class="track-name-text" :title="track.name">
              {{ track.name }}
            </span>
          </div>

          <!-- 控制按钮 -->
          <div class="track-buttons">
            <div class="track-status">
              <!-- 可见性切换按钮 - 音频轨道不显示 -->
              <HoverButton
                v-if="track.type !== 'audio'"
                variant="small"
                :class="track.isVisible ? 'active' : ''"
                :title="track.isVisible ? '隐藏轨道' : '显示轨道'"
                @click="toggleVisibility(track.id)"
              >
                <template #icon>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"
                    />
                  </svg>
                </template>
              </HoverButton>

              <!-- 静音切换按钮 - 文本轨道不显示 -->
              <HoverButton
                v-if="track.type !== 'text'"
                variant="small"
                :class="track.isMuted ? '' : 'active'"
                :title="track.isMuted ? '取消静音' : '静音'"
                @click="toggleMute(track.id)"
              >
                <template #icon>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      v-if="!track.isMuted"
                      d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"
                    />
                    <path
                      v-else
                      d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z"
                    />
                  </svg>
                </template>
              </HoverButton>
            </div>
          </div>
        </div>

        <!-- 右侧轨道内容区域 - 空状态 -->
        <div class="track-content">
          <div class="empty-track-hint">
            <span>拖拽素材到此处添加到轨道</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import HoverButton from './HoverButton.vue'
import UnifiedTimeScale from './UnifiedTimeScale.vue'

// 默认空轨道
const defaultTracks = ref([
  {
    id: 'video-1',
    name: '视频轨道 1',
    type: 'video',
    height: 80,
    isVisible: true,
    isMuted: false
  },
  {
    id: 'audio-1',
    name: '音频轨道 1',
    type: 'audio',
    height: 60,
    isVisible: true,
    isMuted: false
  }
])

// 空壳方法
const showAddTrackMenu = () => {
  console.log('Add track menu clicked (empty shell)')
}

const toggleVisibility = (trackId: string) => {
  const track = defaultTracks.value.find(t => t.id === trackId)
  if (track) {
    track.isVisible = !track.isVisible
  }
}

const toggleMute = (trackId: string) => {
  const track = defaultTracks.value.find(t => t.id === trackId)
  if (track) {
    track.isMuted = !track.isMuted
  }
}

const getTrackTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    video: '视频',
    audio: '音频',
    text: '文本'
  }
  return labels[type] || type
}

const getTrackTypeIcon = (type: string) => {
  const icons: Record<string, string> = {
    video: 'M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z',
    audio: 'M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z',
    text: 'M18.5,4L19.66,8.35L18.7,8.61C18.25,7.74 17.79,6.87 17.26,6.43C16.73,6 16.11,6 15.5,6H13V16.5C13,17 13,17.5 13.33,17.75C13.67,18 14.33,18 15,18V19H9V18C9.67,18 10.33,18 10.67,17.75C11,17.5 11,17 11,16.5V6H8.5C7.89,6 7.27,6 6.74,6.43C6.21,6.87 5.75,7.74 5.3,8.61L4.34,8.35L5.5,4H18.5Z'
  }
  return icons[type] || icons.video
}
</script>

<style scoped>
/* 基础样式，复用原有设计 */
.timeline {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-primary);
  border-radius: 8px;
  overflow: hidden;
}

.timeline-header {
  display: flex;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-primary);
}

.track-manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  width: 200px;
  border-right: 1px solid var(--color-border-primary);
}

.track-manager-header h3 {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0;
}

.timeline-scale {
  flex: 1;
}

.timeline-body {
  flex: 1;
  overflow-y: auto;
}

.track-row {
  display: flex;
  border-bottom: 1px solid var(--color-border-primary);
}

.track-controls {
  display: flex;
  align-items: center;
  width: 200px;
  padding: 8px 12px;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border-primary);
  gap: 8px;
}

.track-color-indicator {
  width: 4px;
  height: 100%;
  border-radius: 2px;
}

.track-color-indicator.track-color-video {
  background: #3b82f6;
}

.track-color-indicator.track-color-audio {
  background: #10b981;
}

.track-color-indicator.track-color-text {
  background: #f59e0b;
}

.track-name {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.track-type-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.track-type-icon {
  color: var(--color-text-secondary);
}

.clip-count {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.track-name-text {
  font-size: 13px;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-buttons {
  display: flex;
  align-items: center;
}

.track-status {
  display: flex;
  gap: 4px;
}

.track-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-primary);
  position: relative;
}

.empty-track-hint {
  color: var(--color-text-soft);
  font-size: 12px;
  opacity: 0.5;
}
</style>

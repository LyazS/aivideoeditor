<template>
  <div class="preview-window">
    <div class="video-container">
      <!-- WebAV渲染器 - 空壳版本 -->
      <UnifiedWebAVRenderer />
      
      <!-- 空状态播放按钮 -->
      <div class="empty-state-overlay">
        <div class="play-button-placeholder">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8,5.14V19.14L19,12.14L8,5.14Z" />
          </svg>
        </div>
        <div class="empty-state-text">
          <p>预览窗口</p>
          <p class="hint">添加媒体到时间轴以开始预览</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import UnifiedWebAVRenderer from './UnifiedWebAVRenderer.vue'
</script>

<style scoped>
.preview-window {
  width: 100%;
  flex: 1;
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-xlarge);
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  border: 2px solid var(--color-bg-secondary);
  box-sizing: border-box;
  min-width: 150px;
  min-height: 100px;
}

.video-container {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: #333; /* 与控制条一致的背景色 */
  /* 允许极小尺寸 */
  min-height: 80px;
}

.empty-state-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  z-index: 10;
}

.play-button-placeholder {
  opacity: 0.3;
  margin-bottom: 16px;
  cursor: not-allowed;
}

.empty-state-text {
  text-align: center;
}

.empty-state-text p {
  margin: 4px 0;
  font-size: 14px;
}

.empty-state-text .hint {
  font-size: 12px;
  opacity: 0.7;
}

.video-player {
  /* 视频保持原始比例，在容器内居中显示 */
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain; /* 保持比例，可能会有黑边 */
  display: block;
}
</style>

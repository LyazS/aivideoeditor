<template>
  <div class="preview-window">
    <div class="video-container">
      <!-- WebAV渲染器 -->
      <WebAVRenderer />
    </div>
  </div>
</template>

<script setup lang="ts">
import WebAVRenderer from './WebAVRenderer.vue'
</script>

<style scoped>
.preview-window {
  width: 100%;
  flex: 1;
  background-color: #2a2a2a; /* 改为灰色背景 */
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  border: 2px solid #2a2a2a;
  box-sizing: border-box;
  /* 允许极大压缩，适应任何大小 */
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

.video-player {
  /* 视频保持原始比例，在容器内居中显示 */
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain; /* 保持比例，可能会有黑边 */
  display: block;
  box-sizing: border-box;
}

.blank-area-indicator {
  text-align: center;
  color: #666;
}

.time-indicator {
  font-size: 18px;
  font-family: monospace;
  color: #888;
  background-color: rgba(0, 0, 0, 0.8);
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid #333;
}

.aspect-ratio-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 5;
  transition: all 0.3s ease;
}

.frame-border {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  background-color: #666;
  position: relative;
}

.frame-label {
  position: absolute;
  bottom: -25px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(255, 68, 68, 0.9);
  color: white;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-family: monospace;
  font-weight: bold;
}
</style>

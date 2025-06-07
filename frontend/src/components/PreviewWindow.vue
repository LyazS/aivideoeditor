<template>
  <div class="preview-window">
    <div class="video-container">
      <!-- Canvas渲染器 -->
      <CanvasVideoRenderer v-if="hasClips" />

      <!-- 空白区域显示（没有片段时显示提示） -->
      <div v-if="!hasClips" class="placeholder">
        <div class="placeholder-content">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <p>预览窗口</p>
          <p class="hint">将视频文件导入到素材库开始编辑</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useVideoStore } from '../stores/counter'
import CanvasVideoRenderer from './CanvasVideoRenderer.vue'

const videoStore = useVideoStore()

// 检查是否有视频片段
const hasClips = computed(() => {
  return videoStore.clips.length > 0
})
</script>

<style scoped>
.preview-window {
  width: 100%;
  flex: 1;
  background-color: #444; /* 改为灰色背景 */
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  border: 2px solid #333;
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

.placeholder {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent; /* 透明背景，使用父容器的灰色背景 */
  transition: background-color 0.3s ease;
}

.placeholder.playing-blank {
  background-color: transparent; /* 播放空白区域时也使用透明背景 */
}

.placeholder-content {
  text-align: center;
  color: #666;
}

.placeholder-content svg {
  margin-bottom: 16px;
  opacity: 0.5;
}

.placeholder-content p {
  margin: 8px 0;
}

.hint {
  font-size: 14px;
  opacity: 0.7;
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
  border: 2px dashed #ff4444;
  border-radius: 4px;
  background-color: rgba(255, 68, 68, 0.1);
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

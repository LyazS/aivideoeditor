<template>
  <div class="video-preview-engine">
    <div class="main-content">
      <!-- 预览窗口 -->
      <div class="preview-section">
        <PreviewWindow />
      </div>
      
      <!-- 时间轴区域 -->
      <div class="timeline-section">
        <TimeScale />
        <Timeline />
      </div>
      
      <!-- 控制面板 -->
      <div class="controls-section">
        <PlaybackControls />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PreviewWindow from './PreviewWindow.vue'
import Timeline from './Timeline.vue'
import TimeScale from './TimeScale.vue'
import PlaybackControls from './PlaybackControls.vue'
</script>

<style scoped>
.video-preview-engine {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #1a1a1a;
  color: white;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 20px;
}

.preview-section {
  /* 固定预览窗口尺寸，使用16:9宽高比 */
  width: 100%;
  max-width: 800px; /* 最大宽度 */
  height: 450px; /* 固定高度，对应16:9比例 */
  margin: 0 auto; /* 水平居中 */
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  flex-shrink: 0; /* 防止被压缩 */
}

.timeline-section {
  height: 200px;
  background-color: #2a2a2a;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
}

.controls-section {
  height: 80px;
  background-color: #333;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
}
</style>

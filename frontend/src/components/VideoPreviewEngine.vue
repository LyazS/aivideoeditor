<template>
  <div class="video-preview-engine">
    <div class="main-content">
      <!-- 预览窗口和控制面板 -->
      <div class="preview-section">
        <PreviewWindow />
        <!-- 播放控制面板紧贴在预览窗口下方 -->
        <div class="controls-section">
          <PlaybackControls />
        </div>
      </div>

      <!-- 时间轴区域 -->
      <div class="timeline-section">
        <!-- 片段管理工具栏在时间刻度上方 -->
        <div class="clip-management-toolbar">
          <ClipManagementToolbar />
        </div>
        <Timeline />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PreviewWindow from './PreviewWindow.vue'
import Timeline from './Timeline.vue'
import PlaybackControls from './PlaybackControls.vue'
import ClipManagementToolbar from './ClipManagementToolbar.vue'
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
  /* 预览窗口和控制面板的容器 */
  width: 100%;
  max-width: 800px; /* 最大宽度 */
  margin: 0 auto; /* 水平居中 */
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0; /* 防止被压缩 */
  gap: 10px; /* 预览窗口和控制面板之间的间距 */
}

.timeline-section {
  height: 300px; /* 增加高度以容纳多轨道 */
  background-color: #2a2a2a;
  border-radius: 8px;
  padding: 8px; /* 减小内边距 */
  display: flex;
  flex-direction: column;
}

.clip-management-toolbar {
  /* 片段管理工具栏 */
  flex-shrink: 0;
}

.controls-section {
  /* 压缩后的控制面板 */
  height: 50px; /* 减小高度 */
  width: 100%;
  background-color: #333;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 15px; /* 减小内边距 */
}
</style>

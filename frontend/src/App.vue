<script setup lang="ts">
import VideoPreviewEngine from './components/VideoPreviewEngine.vue'
import NotificationContainer from './components/NotificationContainer.vue'
</script>

<template>
  <div id="app">
    <VideoPreviewEngine />
    <NotificationContainer />
  </div>
</template>

<style>
/* 引入通用样式 */
@import './styles/common.css';

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  width: 100vw;
  height: 100vh;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  overflow: hidden;
}

body {
  margin: 0;
  padding: 0;
}

/* 全局应用自定义滚动条样式 */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--color-bg-active) var(--color-bg-primary);
}

*::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

*::-webkit-scrollbar-track {
  background: var(--color-bg-primary);
  border-radius: var(--border-radius-medium);
}

*::-webkit-scrollbar-thumb {
  background: var(--color-bg-active);
  border-radius: var(--border-radius-medium);
  border: 1px solid var(--color-bg-tertiary);
}

*::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-secondary);
}

*::-webkit-scrollbar-corner {
  background: var(--color-bg-primary);
}
</style>

<template>
  <div class="preview-window">
    <!-- WebAV渲染器 -->
    <WebAVRenderer />
  </div>
</template>

<script setup lang="ts">
import WebAVRenderer from './WebAVRenderer.vue'
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


</style>

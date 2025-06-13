<script setup lang="ts">
import VideoPreviewEngine from './components/VideoPreviewEngine.vue'
</script>

<template>
  <div id="app">
    <VideoPreviewEngine />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  width: 100vw;
  height: 100vh;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #1a1a1a;
  color: white;
  overflow: hidden;
}

body {
  margin: 0;
  padding: 0;
}
</style>

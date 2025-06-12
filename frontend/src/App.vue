<script setup lang="ts">
import AppInitializer from './components/AppInitializer.vue'
</script>

<template>
  <div id="app">
    <AppInitializer />
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

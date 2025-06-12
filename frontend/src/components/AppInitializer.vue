<template>
  <div class="app-initializer">
    <!-- 初始化中 -->
    <div v-if="!isInitialized && !error" class="loading-screen">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <h2>正在初始化AI视频编辑器</h2>
        <p>{{ loadingMessage }}</p>
      </div>
    </div>

    <!-- 初始化失败 -->
    <div v-else-if="error" class="error-screen">
      <div class="error-content">
        <div class="error-icon">⚠️</div>
        <h2>初始化失败</h2>
        <p>{{ error }}</p>
        <button @click="retry" class="retry-btn">重试</button>
      </div>
    </div>

    <!-- 初始化成功，显示主应用 -->
    <VideoPreviewEngine v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import VideoPreviewEngine from './VideoPreviewEngine.vue'
const isInitialized = ref(false)
const error = ref<string | null>(null)
const loadingMessage = ref('正在加载WebAV引擎...')

/**
 * 初始化应用
 */
const initializeApp = async (): Promise<void> => {
  try {
    error.value = null
    loadingMessage.value = '正在加载WebAV引擎...'

    loadingMessage.value = '正在初始化应用...'

    // WebAV将在WebAVRenderer组件中进行实际初始化
    // 这里只是标记应用可以启动

    loadingMessage.value = '初始化完成'

    // 标记初始化完成
    isInitialized.value = true
  } catch (err) {
    const errorMessage = `应用初始化失败: ${(err as Error).message}`
    error.value = errorMessage
    console.error('应用初始化失败:', err)
  }
}

/**
 * 重试初始化
 */
const retry = (): void => {
  isInitialized.value = false
  error.value = null
  initializeApp()
}

// 应用启动时立即初始化
onMounted(() => {
  initializeApp()
})
</script>

<style scoped>
.app-initializer {
  width: 100vw;
  height: 100vh;
  background-color: #1a1a1a;
  color: white;
}

.loading-screen,
.error-screen {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-content,
.error-content {
  text-align: center;
  max-width: 400px;
  padding: 40px;
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid #333;
  border-top: 4px solid #ff4444;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon {
  font-size: 60px;
  margin-bottom: 20px;
}

h2 {
  margin-bottom: 16px;
  color: white;
  font-size: 24px;
}

p {
  margin-bottom: 20px;
  color: #ccc;
  font-size: 16px;
  line-height: 1.5;
}

.retry-btn {
  background-color: #ff4444;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.retry-btn:hover {
  background-color: #ff6666;
}
</style>

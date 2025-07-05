<template>
  <div class="video-editor-view">
    <!-- 顶部导航栏 -->
    <header class="editor-header">
      <div class="header-left">
        <button class="back-btn" @click="goBack" title="返回项目管理">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z" />
          </svg>
          返回
        </button>
        <div class="project-info">
          <h1 class="project-title">{{ projectTitle }}</h1>
          <span class="project-status">{{ projectStatus }}</span>
        </div>
      </div>
      
      <div class="header-right">
        <button class="save-btn" @click="saveProject" :disabled="isSaving" title="保存项目">
          <svg v-if="!isSaving" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z" />
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="spinning">
            <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
          </svg>
          {{ isSaving ? '保存中...' : '保存' }}
        </button>
        
        <button class="export-btn" @click="exportProject" title="导出项目">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
          导出
        </button>
      </div>
    </header>

    <!-- 视频编辑器主体 -->
    <div class="editor-content">
      <VideoPreviewEngine />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import VideoPreviewEngine from '../components/VideoPreviewEngine.vue'

const router = useRouter()
const route = useRoute()

// 响应式数据
const isSaving = ref(false)
const projectTitle = ref('未命名项目')
const lastSaved = ref<Date | null>(null)

// 计算属性
const projectStatus = computed(() => {
  if (isSaving.value) return '保存中...'
  if (lastSaved.value) {
    const now = new Date()
    const diff = now.getTime() - lastSaved.value.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return '刚刚保存'
    if (minutes < 60) return `${minutes}分钟前保存`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}小时前保存`
    return '需要保存'
  }
  return '未保存'
})

// 方法
function goBack() {
  // 如果有未保存的更改，可以在这里添加确认对话框
  router.push('/')
}

async function saveProject() {
  if (isSaving.value) return
  
  try {
    isSaving.value = true
    
    // TODO: 实现项目保存逻辑
    // 这里应该调用持久化存储的保存方法
    await new Promise(resolve => setTimeout(resolve, 1000)) // 模拟保存延迟
    
    lastSaved.value = new Date()
    console.log('项目已保存')
    
    // 可以添加成功提示
  } catch (error) {
    console.error('保存项目失败:', error)
    // 可以添加错误提示
  } finally {
    isSaving.value = false
  }
}

function exportProject() {
  // TODO: 实现项目导出逻辑
  console.log('导出项目')
}

// 键盘快捷键
function handleKeydown(event: KeyboardEvent) {
  // Ctrl+S 保存
  if (event.ctrlKey && event.key === 's') {
    event.preventDefault()
    saveProject()
  }
  
  // Ctrl+E 导出
  if (event.ctrlKey && event.key === 'e') {
    event.preventDefault()
    exportProject()
  }
}

// 生命周期
onMounted(() => {
  // 从路由参数获取项目ID
  const projectId = route.params.projectId as string
  if (projectId && projectId !== 'undefined') {
    // TODO: 根据项目ID加载项目数据
    projectTitle.value = `项目 ${projectId}`
    console.log('加载项目:', projectId)
  } else {
    projectTitle.value = '新建项目'
  }
  
  // 注册键盘快捷键
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  // 清理键盘快捷键
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.video-editor-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-primary);
}

.editor-header {
  background-color: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-medium);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.back-btn:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: var(--color-border-hover);
}

.project-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.project-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.project-status {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.save-btn,
.export-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--border-radius-medium);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-btn {
  background-color: var(--color-primary);
  color: white;
}

.save-btn:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.export-btn {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.export-btn:hover {
  background-color: var(--color-bg-hover);
  border-color: var(--color-border-hover);
}

.editor-content {
  flex: 1;
  overflow: hidden;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

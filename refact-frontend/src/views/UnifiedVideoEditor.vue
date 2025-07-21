<template>
  <div class="video-editor-view">
    <!-- 状态栏 -->
    <div class="status-bar-container">
      <div class="status-bar">
        <div class="status-content">
          <!-- 左侧：返回按钮和保存状态 -->
          <div class="status-left">
            <HoverButton @click="goBack" title="返回项目管理">
              <template #icon>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z" />
                </svg>
              </template>
              返回
            </HoverButton>
            <span class="project-status">{{ projectStatus }}</span>
          </div>

          <!-- 中间：项目名称 -->
          <div class="status-center">
            <button class="project-title-btn" @click="showEditProjectDialog" title="点击编辑项目信息">
              <span class="project-title">{{ projectTitle }}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="edit-icon">
                <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
              </svg>
            </button>
          </div>

          <!-- 右侧：保存和导出按钮 -->
          <div class="status-right">
            <HoverButton @click="saveProject" :disabled="true" title="保存项目">
              <template #icon>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z" />
                </svg>
              </template>
              保存
            </HoverButton>

            <HoverButton @click="exportProject" :disabled="true" title="导出项目">
              <template #icon>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                </svg>
              </template>
              导出
            </HoverButton>
          </div>
        </div>
      </div>
    </div>

    <!-- 视频编辑器主体 -->
    <div class="editor-content">
      <UnifiedVideoPreviewEngine />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUnifiedProjectStore } from '../stores/unified'
import HoverButton from '../components/HoverButton.vue'
import UnifiedVideoPreviewEngine from '../components/UnifiedVideoPreviewEngine.vue'

const router = useRouter()
const projectStore = useUnifiedProjectStore()

// 空壳状态
const showEditDialog = ref(false)

// 计算属性
const projectTitle = computed(() => projectStore.projectName)
const projectStatus = computed(() => {
  if (!projectStore.isProjectLoaded) return '未加载项目'
  if (projectStore.state.isDirty) return '未保存'
  return '已保存'
})

// 空壳方法
const goBack = () => {
  router.push('/projects')
}

const showEditProjectDialog = () => {
  showEditDialog.value = true
  console.log('Edit project dialog (empty shell)')
}

const saveProject = async () => {
  console.log('Save project (empty shell)')
  await projectStore.saveProject()
}

const exportProject = () => {
  console.log('Export project (empty shell)')
}
</script>

<style scoped>
.video-editor-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-bg-primary);
  overflow: hidden;
}

.status-bar-container {
  flex-shrink: 0;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-primary);
  z-index: 100;
}

.status-bar {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
}

.status-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.project-status {
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: 4px 8px;
  background: var(--color-bg-primary);
  border-radius: 4px;
  border: 1px solid var(--color-border-primary);
}

.status-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.project-title-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

.project-title-btn:hover {
  background: var(--color-bg-primary);
}

.project-title {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-icon {
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

.project-title-btn:hover .edit-icon {
  opacity: 1;
}

.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.editor-content {
  flex: 1;
  overflow: hidden;
}
</style>

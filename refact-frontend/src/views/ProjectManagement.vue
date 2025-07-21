<template>
  <div class="project-management">
    <div class="header">
      <h1>项目管理</h1>
      <p class="subtitle">统一异步源架构 - 空壳前端</p>
    </div>

    <div class="content">
      <div class="project-actions">
        <button class="create-project-btn" @click="createNewProject">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
          </svg>
          创建新项目
        </button>
      </div>

      <div class="projects-grid">
        <div class="project-card demo-card" @click="openDemoProject">
          <div class="project-thumbnail">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z" />
            </svg>
          </div>
          <div class="project-info">
            <h3>演示项目</h3>
            <p>空壳前端演示项目</p>
            <div class="project-meta">
              <span class="project-date">刚刚创建</span>
            </div>
          </div>
        </div>

        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
          <h3>暂无其他项目</h3>
          <p>点击上方按钮创建您的第一个项目</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUnifiedProjectStore } from '../stores/unified'

const router = useRouter()
const projectStore = useUnifiedProjectStore()

const createNewProject = async () => {
  console.log('Creating new project (empty shell)')
  
  // 创建空壳项目
  await projectStore.createProject('新项目')
  
  // 跳转到编辑器
  router.push('/editor/new')
}

const openDemoProject = () => {
  console.log('Opening demo project (empty shell)')
  
  // 跳转到编辑器
  router.push('/editor/demo')
}
</script>

<style scoped>
.project-management {
  min-height: 100vh;
  background: var(--color-bg-primary);
  padding: 32px;
}

.header {
  text-align: center;
  margin-bottom: 48px;
}

.header h1 {
  font-size: 32px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.subtitle {
  font-size: 16px;
  color: var(--color-text-soft);
  margin: 0;
}

.content {
  max-width: 1200px;
  margin: 0 auto;
}

.project-actions {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
}

.create-project-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: var(--color-accent-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.create-project-btn:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.project-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.project-card:hover {
  border-color: var(--color-accent-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.project-thumbnail {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 60px;
  background: var(--color-bg-primary);
  border-radius: 8px;
  margin-bottom: 16px;
  color: var(--color-text-secondary);
}

.project-info h3 {
  font-size: 18px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.project-info p {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0 0 12px 0;
}

.project-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.project-date {
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
  padding: 4px 8px;
  border-radius: 4px;
}

.empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  text-align: center;
  color: var(--color-text-secondary);
}

.empty-state svg {
  opacity: 0.3;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 18px;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.empty-state p {
  font-size: 14px;
  margin: 0;
}
</style>

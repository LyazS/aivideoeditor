<template>
  <div class="project-management">
    <!-- 顶部导航栏 -->
    <header class="header">
      <div class="header-content">
        <div class="logo-section">
          <h1 class="app-title">光影绘梦</h1>
          <span class="app-subtitle">AI视频编辑器</span>
        </div>
        <div class="header-actions">
          <button v-if="workspaceInfo" class="workspace-info" @click="changeWorkspace" title="点击更改工作目录">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z" />
            </svg>
            <span>{{ workspaceInfo.name }}</span>
          </button>
          <button
            class="btn btn-primary"
            @click="createNewProject"
            :disabled="!hasWorkspaceAccess || isLoading"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
            </svg>
            新建项目
          </button>
        </div>
      </div>
    </header>

    <!-- 主要内容区域 -->
    <main class="main-content">
      <div class="content-container">
        <!-- 权限检测和设置区域 -->
        <section v-if="!hasWorkspaceAccess" class="workspace-setup">
          <div class="setup-card">
            <div class="setup-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z" />
              </svg>
            </div>
            <h2>设置项目工作目录</h2>
            <p>为了管理您的视频编辑项目，请选择一个本地文件夹作为项目工作目录。所有项目文件将保存在此文件夹中。</p>

            <div v-if="!isApiSupported" class="error-message">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
              </svg>
              <span>当前浏览器不支持本地文件访问功能，请使用Chrome、Edge或其他支持File System Access API的现代浏览器。</span>
            </div>

            <button
              v-else
              class="btn btn-primary btn-large"
              @click="setupWorkspace"
              :disabled="isLoading"
            >
              <svg v-if="!isLoading" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z" />
              </svg>
              <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="spinning">
                <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
              </svg>
              {{ isLoading ? '设置中...' : '选择工作目录' }}
            </button>
          </div>
        </section>

        <!-- 项目列表区域 -->
        <section v-if="hasWorkspaceAccess" class="recent-projects">
          <div class="section-header">
            <h2>我的项目</h2>
            <div class="header-actions">
              <button class="refresh-btn" @click="loadProjects" :disabled="isLoading" title="刷新项目列表">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" :class="{ spinning: isLoading }">
                  <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z" />
                </svg>
              </button>
              <div class="view-options">
                <button
                  class="view-btn"
                  :class="{ active: viewMode === 'grid' }"
                  @click="viewMode = 'grid'"
                  title="网格视图"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3,11H11V3H3M3,21H11V13H3M13,21H21V13H13M13,3V11H21V3" />
                  </svg>
                </button>
                <button
                  class="view-btn"
                  :class="{ active: viewMode === 'list' }"
                  @click="viewMode = 'list'"
                  title="列表视图"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3,5H21V7H3V5M3,13V11H21V13H3M3,19V17H21V19H3Z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div v-if="isLoading && projects.length === 0" class="loading-state">
            <div class="loading-spinner"></div>
            <p>正在加载项目列表...</p>
          </div>

          <div v-else-if="projects.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
              </svg>
            </div>
            <h3>还没有项目</h3>
            <p>创建您的第一个视频编辑项目开始吧！</p>
            <button class="btn btn-primary" @click="createNewProject">
              创建新项目
            </button>
          </div>

          <div v-else class="projects-grid" :class="{ 'list-view': viewMode === 'list' }">
            <div
              v-for="project in projects"
              :key="project.id"
              class="project-card"
              @click="openProjectById(project.id)"
            >
              <div class="project-thumbnail">
                <img v-if="project.thumbnail" :src="project.thumbnail" :alt="project.name" />
                <div v-else class="thumbnail-placeholder">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z" />
                  </svg>
                </div>
              </div>
              <div class="project-info">
                <h3 class="project-name">{{ project.name }}</h3>
                <p class="project-description">{{ project.description || '无描述' }}</p>
                <div class="project-meta">
                  <span class="project-date">{{ formatDate(project.updatedAt) }}</span>
                  <span class="project-duration">{{ project.duration || '00:00' }}</span>
                </div>
              </div>
              <div class="project-actions">
                <button class="action-btn" @click.stop="duplicateProject(project.id)" title="复制项目">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />
                  </svg>
                </button>
                <button class="action-btn" @click.stop="confirmDeleteProject(project)" title="删除项目">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { directoryManager } from '../utils/DirectoryManager'
import { projectManager, type ProjectConfig } from '../utils/ProjectManager'

const router = useRouter()

// 响应式数据
const viewMode = ref<'grid' | 'list'>('grid')
const projects = ref<ProjectConfig[]>([])
const isLoading = ref(false)
const hasWorkspaceAccess = ref(false)
const workspaceInfo = ref<{ name: string; path?: string } | null>(null)

// 计算属性
const isApiSupported = computed(() => directoryManager.isSupported())

// 权限和工作目录管理
async function checkWorkspaceAccess() {
  try {
    console.log('🔍 开始检查工作目录权限...')
    const hasAccess = await directoryManager.hasWorkspaceAccess()
    console.log('📋 权限检查结果:', hasAccess)
    hasWorkspaceAccess.value = hasAccess

    if (hasAccess) {
      workspaceInfo.value = await directoryManager.getWorkspaceInfo()
      console.log('📁 工作目录信息:', workspaceInfo.value)
      await loadProjects()
    } else {
      console.log('⚠️ 没有工作目录权限，需要用户设置')
    }
  } catch (error) {
    console.error('❌ 检查工作目录权限失败:', error)
    hasWorkspaceAccess.value = false
  }
}

async function setupWorkspace() {
  if (isLoading.value) return

  try {
    isLoading.value = true
    const handle = await directoryManager.requestWorkspaceDirectory()

    if (handle) {
      hasWorkspaceAccess.value = true
      workspaceInfo.value = await directoryManager.getWorkspaceInfo()
      await loadProjects()
    }
  } catch (error) {
    console.error('设置工作目录失败:', error)
    // 可以添加错误提示
  } finally {
    isLoading.value = false
  }
}

async function changeWorkspace() {
  try {
    // 先尝试选择新的工作目录，不要清除现有的
    const newHandle = await directoryManager.requestWorkspaceDirectory()

    // 只有当用户成功选择了新目录时，才更新状态
    if (newHandle) {
      hasWorkspaceAccess.value = true
      workspaceInfo.value = await directoryManager.getWorkspaceInfo()
      projects.value = []
      await loadProjects()
      console.log('✅ 工作目录已更改为:', newHandle.name)
    } else {
      // 用户取消了选择，保持原有状态
      console.log('ℹ️ 用户取消了工作目录更改，保持原有设置')
    }
  } catch (error) {
    console.error('更改工作目录失败:', error)
    // 发生错误时，重新检查当前权限状态
    await checkWorkspaceAccess()
  }
}



// 项目管理
async function loadProjects() {
  if (!hasWorkspaceAccess.value) return

  try {
    isLoading.value = true
    projects.value = await projectManager.listProjects()
  } catch (error) {
    console.error('加载项目列表失败:', error)
    // 可以添加错误提示
  } finally {
    isLoading.value = false
  }
}

async function createNewProject() {
  if (!hasWorkspaceAccess.value || isLoading.value) return

  try {
    // 生成项目名称
    const projectName = `新项目 ${new Date().toLocaleDateString()}`
    const project = await projectManager.createProject(projectName)

    // 跳转到编辑器页面
    router.push(`/editor/${project.id}`)
  } catch (error) {
    console.error('创建项目失败:', error)
    // 可以添加错误提示
  }
}

function openProjectById(projectId: string) {
  router.push(`/editor/${projectId}`)
}

async function duplicateProject(projectId: string) {
  try {
    const originalProject = await projectManager.loadProject(projectId)
    if (!originalProject) {
      console.error('找不到要复制的项目')
      return
    }

    const newProject = await projectManager.createProject(
      `${originalProject.name} - 副本`,
      {
        ...originalProject,
        id: undefined, // 让系统生成新ID
        createdAt: undefined,
        updatedAt: undefined
      }
    )

    await loadProjects() // 刷新项目列表
    console.log('项目复制成功:', newProject.name)
  } catch (error) {
    console.error('复制项目失败:', error)
  }
}

function confirmDeleteProject(project: ProjectConfig) {
  if (confirm(`确定要删除项目"${project.name}"吗？此操作无法撤销。`)) {
    deleteProject(project.id)
  }
}

async function deleteProject(projectId: string) {
  try {
    await projectManager.deleteProject(projectId)
    await loadProjects() // 刷新项目列表
    console.log('项目删除成功')
  } catch (error) {
    console.error('删除项目失败:', error)
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// 生命周期
onMounted(async () => {
  // 调试IndexedDB内容
  await directoryManager.debugIndexedDB()

  await checkWorkspaceAccess()
})
</script>

<style scoped>
.project-management {
  min-height: 100vh;
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.header {
  background-color: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  padding: 1rem 0;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.workspace-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background-color: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-medium);
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.workspace-info:hover {
  background-color: var(--color-bg-hover);
  border-color: var(--color-border-hover);
  color: var(--color-text-primary);
}

.workspace-info:hover .change-indicator {
  color: var(--color-primary);
}

.change-indicator {
  opacity: 0.6;
  transition: all 0.2s ease;
}

.logo-section {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.app-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.app-subtitle {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.main-content {
  padding: 2rem 0;
}

.content-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.workspace-setup {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}

.setup-card {
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-large);
  padding: 3rem;
  text-align: center;
  max-width: 500px;
  width: 100%;
}

.setup-icon {
  color: var(--color-primary);
  margin-bottom: 1.5rem;
  opacity: 0.8;
}

.setup-card h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--color-text-primary);
}

.setup-card p {
  font-size: 1rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-bottom: 2rem;
}

.error-message {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--border-radius-medium);
  color: #dc2626;
  font-size: 0.875rem;
  line-height: 1.5;
  margin-bottom: 1.5rem;
  text-align: left;
}

.btn-large {
  padding: 0.75rem 2rem;
  font-size: 1rem;
}

.quick-actions h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--color-text-primary);
}

.action-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.action-card {
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-large);
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.action-card:hover {
  background-color: var(--color-bg-hover);
  border-color: var(--color-border-hover);
  transform: translateY(-2px);
}

.card-icon {
  color: var(--color-primary);
  margin-bottom: 1rem;
}

.action-card h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--color-text-primary);
}

.action-card p {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin: 0;
}

.recent-projects h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--color-text-primary);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.refresh-btn {
  padding: 0.5rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-small);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: var(--color-border-hover);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-text-secondary);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

.view-options {
  display: flex;
  gap: 0.25rem;
}

.view-btn {
  padding: 0.5rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-small);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-btn:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.view-btn.active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-text-secondary);
}

.empty-icon {
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--color-text-primary);
}

.empty-state p {
  margin-bottom: 1.5rem;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.projects-grid.list-view {
  grid-template-columns: 1fr;
}

.project-card {
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-large);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
}

.list-view .project-card {
  flex-direction: row;
  align-items: center;
}

.project-card:hover {
  background-color: var(--color-bg-hover);
  border-color: var(--color-border-hover);
  transform: translateY(-2px);
}

.project-thumbnail {
  aspect-ratio: 16/9;
  background-color: var(--color-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.list-view .project-thumbnail {
  aspect-ratio: 16/9;
  width: 120px;
  flex-shrink: 0;
}

.project-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-placeholder {
  color: var(--color-text-secondary);
  opacity: 0.5;
}

.project-info {
  padding: 1rem;
  flex: 1;
}

.project-name {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: var(--color-text-primary);
}

.project-description {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.project-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.project-actions {
  padding: 0.5rem 1rem;
  display: flex;
  gap: 0.5rem;
  border-top: 1px solid var(--color-border);
}

.list-view .project-actions {
  border-top: none;
  border-left: 1px solid var(--color-border);
  flex-direction: column;
  padding: 1rem;
}

.action-btn {
  padding: 0.5rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-small);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--border-radius-medium);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--color-primary-hover);
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

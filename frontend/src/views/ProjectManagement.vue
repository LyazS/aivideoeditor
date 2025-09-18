<template>
  <div class="project-management">
    <!-- 顶部导航栏 -->
    <header class="header">
      <div class="header-content">
        <div class="logo-section">
          <h1 class="app-title">{{ t('app.title') }}</h1>
          <span class="app-subtitle">{{ t('app.subtitle') }}</span>
        </div>
        <div class="header-actions">
          <button
            v-if="hasWorkspaceAccess && workspaceInfo"
            class="btn btn-primary"
            @click="createNewProject"
            :disabled="isLoading"
          >
            <RemixIcon name="add-line" size="lg" />
            {{ t('project.new') }}
          </button>
          <LanguageSelector />
          <button
            v-if="workspaceInfo"
            class="workspace-info"
            @click="changeWorkspace"
            :title="t('workspace.change')"
          >
            <RemixIcon name="folder-line" size="lg" />
            <span>{{ workspaceInfo.name }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- 主要内容区域 -->
    <main class="main-content">
      <div class="content-container">
        <!-- 权限检测和设置区域 -->
        <section v-if="!hasWorkspaceAccess" class="workspace-setup">
          <div
            class="setup-card"
            :class="{ 'clickable-card': isApiSupported && !permissionError }"
            @click="isApiSupported && !permissionError && !isLoading ? setupWorkspace() : null"
          >
            <div class="setup-icon">
              <RemixIcon name="folder-line" size="xl" />
            </div>
            <h2>{{ t('workspace.setup.title') }}</h2>
            <p>{{ t('workspace.setup.description') }}</p>

            <div v-if="!isApiSupported" class="error-message">
              <RemixIcon name="error-warning-line" size="sm" />
              <span>{{ t('workspace.error.unsupported') }}</span>
            </div>

            <!-- 权限丢失提示 -->
            <div v-else-if="permissionError" class="error-message">
              <RemixIcon name="close-circle-line" size="sm" />
              <span>{{ t('workspace.error.permission') }}</span>
            </div>
          </div>
        </section>

        <!-- 项目列表区域 -->
        <section v-if="hasWorkspaceAccess" class="recent-projects">
          <div class="section-header">
            <h2>{{ t('project.list.title') }}</h2>
            <div class="header-actions">
              <HoverButton
                class="refresh-btn"
                @click="loadProjects"
                :disabled="isLoading"
                :title="t('project.list.refresh')"
              >
                <RemixIcon
                  name="refresh-line"
                  size="xl"
                  :spin="isLoading"
                  :class="{ spinning: isLoading }"
                />
              </HoverButton>
              <div class="view-options">
                <HoverButton
                  v-if="viewMode !== 'grid'"
                  @click="viewMode = 'grid'"
                  :title="t('project.view.grid')"
                >
                  <RemixIcon name="grid-line" size="xl" />
                </HoverButton>
                <HoverButton
                  v-if="viewMode !== 'list'"
                  @click="viewMode = 'list'"
                  :title="t('project.view.list')"
                >
                  <RemixIcon name="list-check" size="xl" />
                </HoverButton>
              </div>
            </div>
          </div>

          <div v-if="isLoading && projects.length === 0" class="loading-state">
            <div class="loading-spinner"></div>
            <p>{{ t('project.loading') }}</p>
          </div>

          <div v-else-if="projects.length === 0" class="empty-state">
            <div class="empty-icon">
              <RemixIcon name="inbox-line" size="xl" />
            </div>
            <h3>{{ t('project.empty.title') }}</h3>
            <p>{{ t('project.empty.description') }}</p>
            <button class="btn btn-primary" @click="createNewProject">
              <RemixIcon name="add-line" size="sm" />
              {{ t('project.new') }}
            </button>
          </div>

          <div v-else class="projects-grid" :class="{ 'list-view': viewMode === 'list' }">
            <div
              v-for="project in projects"
              :key="project.id"
              class="project-card"
              @click="openProjectById(project.id)"
              @contextmenu="showProjectMenu($event, project)"
            >
              <div class="project-thumbnail">
                <img v-if="project.thumbnail" :src="project.thumbnail" :alt="project.name" />
                <div v-else class="thumbnail-placeholder">
                  <RemixIcon name="video-line" size="lg" />
                </div>
                <!-- 设置按钮移到缩略图右上角 -->
                <HoverButton
                  variant="small"
                  class="settings-btn-overlay"
                  @click.stop="showProjectMenu($event, project)"
                  :title="t('common.settings')"
                >
                  <RemixIcon name="more-2-fill" size="lg" />
                </HoverButton>
              </div>
              <div class="project-info">
                <h3 class="project-name">{{ project.name }}</h3>
                <p class="project-description">
                  {{ project.description || t('project.noDescription') }}
                </p>
                <div class="project-meta">
                  <span class="project-date">{{ formatDate(project.updatedAt) }}</span>
                  <span class="project-duration">{{ formatDuration(project.duration) }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>

  <!-- 项目设置菜单 -->
  <ContextMenu v-model:show="showContextMenu" :options="contextMenuOptions">
    <ContextMenuItem :label="t('project.edit')" @click="showEditDialog(selectedProject!)">
      <template #icon>
        <RemixIcon name="edit-line" size="sm" />
      </template>
    </ContextMenuItem>

    <ContextMenuItem :label="t('project.delete.title')" @click="confirmDeleteProject(selectedProject!)">
      <template #icon>
        <RemixIcon name="delete-bin-line" size="sm" color="#ff6b6b" />
      </template>
    </ContextMenuItem>
  </ContextMenu>

  <!-- 编辑项目对话框 -->
  <EditProjectDialog
    v-model:show="showEditProjectDialog"
    :project="selectedProject"
    :is-saving="false"
    @save="handleSaveProjectEdit"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { directoryManager } from '@/unified/utils/DirectoryManager'
import { unifiedProjectManager } from '@/unified/utils/projectManager'
import type { UnifiedProjectConfig } from '@/unified/project'
import { ContextMenu, ContextMenuItem } from '@imengyu/vue3-context-menu'
import EditProjectDialog from '../components/EditProjectDialog.vue'
import LanguageSelector from '../components/LanguageSelector.vue'
import RemixIcon from '../components/icons/RemixIcon.vue'
import HoverButton from '../components/HoverButton.vue'
import { useProjectThumbnailService } from '@/unified/composables/useProjectThumbnailService'
import { useAppI18n } from '@/unified/composables/useI18n'

const router = useRouter()
const { t, initLanguage } = useAppI18n()

// 响应式数据
const viewMode = ref<'grid' | 'list'>('grid')
const projects = ref<UnifiedProjectConfig[]>([])
const isLoading = ref(false)
const hasWorkspaceAccess = ref(false)
const workspaceInfo = ref<{ name: string; path?: string } | null>(null)
const permissionError = ref(false)

// 上下文菜单相关
const showContextMenu = ref(false)
const selectedProject = ref<UnifiedProjectConfig | null>(null)
const contextMenuOptions = ref({
  x: 0,
  y: 0,
  theme: 'mac dark',
  zIndex: 1000,
})

// 编辑项目对话框相关
const showEditProjectDialog = ref(false)

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
      // 检查是否是因为目录不存在导致的权限丢失
      await checkIfDirectoryLost()
    }
  } catch (error) {
    console.error('❌ 检查工作目录权限失败:', error)
    hasWorkspaceAccess.value = false
    // 显示具体的错误信息给用户
    showPermissionError(error)
  }
}

// 检查是否是因为目录不存在导致的权限丢失
async function checkIfDirectoryLost() {
  try {
    // 尝试重新检查权限，获取更详细的错误信息
    const recheckResult = await directoryManager.recheckPermissions()
    if (!recheckResult) {
      console.log('🔍 检测到目录权限已丢失，需要重新设置工作目录')
      // 清除旧的目录设置，强制用户重新选择
      await directoryManager.clearWorkspaceDirectory()
    }
  } catch (error) {
    console.warn('检查目录状态失败:', error)
  }
}

// 显示权限错误信息
function showPermissionError(error: unknown) {
  const errorMessage = error instanceof Error ? error.message : '未知错误'

  if (errorMessage.includes('权限') || errorMessage.includes('permission')) {
    console.log('🔒 权限错误，需要用户重新授权')
    permissionError.value = true
  } else if (errorMessage.includes('目录') || errorMessage.includes('directory')) {
    console.log('📁 目录访问错误，可能需要重新选择工作目录')
    permissionError.value = true
  }
}

async function setupWorkspace() {
  if (isLoading.value) return

  try {
    isLoading.value = true
    permissionError.value = false // 重置权限错误状态
    const handle = await directoryManager.requestWorkspaceDirectory()

    if (handle) {
      hasWorkspaceAccess.value = true
      workspaceInfo.value = await directoryManager.getWorkspaceInfo()
      await loadProjects()
    }
  } catch (error) {
    console.error('设置工作目录失败:', error)
    showPermissionError(error)
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
    const projectList = await unifiedProjectManager.listProjects()

    // 为每个项目加载缩略图
    const projectsWithThumbnails = await Promise.all(
      projectList.map(async (project) => {
        try {
          // 尝试加载缩略图
          const thumbnailService = useProjectThumbnailService()
          const thumbnailUrl = await thumbnailService.getThumbnailUrl(project.id)

          return {
            ...project,
            thumbnail: thumbnailUrl,
          }
        } catch (error) {
          console.warn(`无法加载项目 ${project.name} 的缩略图:`, error)
          // 如果缩略图加载失败，保持原项目数据
          return project
        }
      }),
    )

    projects.value = projectsWithThumbnails
  } catch (error) {
    console.error('加载项目列表失败:', error)
    // 可以添加错误提示
  } finally {
    isLoading.value = false
  }
}

/**
 * 加载单个项目的缩略图
 */
async function loadProjectThumbnail(projectId: string, projectName: string) {
  try {
    const thumbnailService = useProjectThumbnailService()
    const thumbnailUrl = await thumbnailService.getThumbnailUrl(projectId)

    // 更新项目的缩略图URL
    const projectIndex = projects.value.findIndex((p) => p.id === projectId)
    if (projectIndex !== -1) {
      projects.value[projectIndex].thumbnail = thumbnailUrl
    }

    return thumbnailUrl
  } catch (error) {
    console.warn(`加载项目缩略图失败: ${projectName}`, error)
    throw error
  }
}

async function createNewProject() {
  if (!hasWorkspaceAccess.value || isLoading.value) return

  try {
    // 生成项目名称
    const projectName = `新项目 ${new Date().toLocaleDateString()}`
    const project = await unifiedProjectManager.createProject(projectName)

    // 跳转到编辑器页面
    router.push(`/editor/${project.id}`)
  } catch (error) {
    console.error('创建项目失败:', error)
    // 可以添加错误提示
  }
}

function openProjectById(projectId: string) {
  // 使用 window.location.href 直接跳转，彻底重新加载页面
  // 这样可以确保所有store状态都被重新创建，避免数据混合问题
  console.log(`🚀 使用页面重载方式打开项目: ${projectId}`)
  window.location.href = `/editor/${projectId}`
}

function confirmDeleteProject(project: UnifiedProjectConfig) {
  if (confirm(t('project.delete.confirm', { name: project.name }))) {
    deleteProject(project.id)
  }
}

async function deleteProject(projectId: string) {
  try {
    await unifiedProjectManager.deleteProject(projectId)
    await loadProjects() // 刷新项目列表
    console.log('项目删除成功')
  } catch (error) {
    console.error('删除项目失败:', error)
  }
}

// 显示项目设置菜单
function showProjectMenu(event: MouseEvent, project: UnifiedProjectConfig) {
  event.preventDefault()
  event.stopPropagation()

  selectedProject.value = project
  contextMenuOptions.value.x = event.clientX
  contextMenuOptions.value.y = event.clientY
  showContextMenu.value = true
}

// 显示编辑项目对话框
function showEditDialog(project: UnifiedProjectConfig) {
  selectedProject.value = project
  showEditProjectDialog.value = true
  showContextMenu.value = false
}

// 处理保存项目编辑
async function handleSaveProjectEdit(data: { name: string; description: string }) {
  if (!selectedProject.value) {
    return
  }

  try {
    // 生成统一的更新时间戳
    const updatedAt = new Date().toISOString()

    // 更新项目配置
    const updatedProject: UnifiedProjectConfig = {
      ...selectedProject.value,
      name: data.name,
      description: data.description,
      updatedAt: updatedAt,
    }

    // 先关闭对话框，提升用户体验
    showEditProjectDialog.value = false
    console.log('项目信息已更新:', updatedProject.name)

    // 立即更新本地内存中的项目数据
    const projectIndex = projects.value.findIndex((p) => p.id === selectedProject.value!.id)
    if (projectIndex !== -1) {
      projects.value[projectIndex] = updatedProject
      // 重新排序项目列表（按更新时间排序）
      projects.value.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
    }

    // 异步保存项目配置到文件系统（传入相同的updatedAt确保一致性）
    unifiedProjectManager
      .saveProjectConfig(updatedProject, updatedAt)
      .then(() => {
        console.log('项目配置保存成功:', updatedProject.name)
      })
      .catch((error) => {
        console.error('保存项目配置失败:', error)
        // 保存失败时重新加载项目列表以恢复正确状态
        loadProjects()
      })
  } catch (error) {
    console.error('更新项目信息失败:', error)
    // 可以添加错误提示
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) {
    return '00:00'
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

// 生命周期
onMounted(async () => {
  // 初始化语言设置
  initLanguage()

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
  transition: all 0.2s ease;
}

.setup-card.clickable-card {
  cursor: pointer;
  border-color: var(--color-primary);
  opacity: 0.9;
}

.setup-card.clickable-card:hover {
  background-color: var(--color-bg-hover);
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  opacity: 1;
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
  margin: 0;  /* 移除 margin-bottom 以确保垂直居中 */
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
  position: relative;
}

.list-view .project-thumbnail {
  aspect-ratio: 16/9;
  width: 120px;
  flex-shrink: 0;
}

/* 列表视图中的设置按钮调整 */
.list-view .settings-btn-overlay {
  top: 4px;
  right: 4px;
  width: 28px;
  height: 28px;
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

/* 右上角设置按钮样式 */
.settings-btn-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 36px;
  height: 36px;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  border-radius: var(--border-radius-medium);
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  opacity: 0;
  transform: scale(0.9);
  backdrop-filter: blur(4px);
}

.project-card:hover .settings-btn-overlay {
  opacity: 1;
  transform: scale(1);
}

.settings-btn-overlay:hover {
  background: rgba(0, 0, 0, 0.8);
  transform: scale(1.05);
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
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

/* 空状态按钮的特殊样式 */
.empty-state .btn-primary {
  background-color: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.empty-state .btn-primary:hover {
  background-color: var(--color-bg-hover);
  border-color: var(--color-border-hover);
  color: var(--color-text-primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
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

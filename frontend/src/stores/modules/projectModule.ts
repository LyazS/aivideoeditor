import { ref, computed } from 'vue'
import { projectManager, type ProjectConfig } from '../../utils/ProjectManager'
import type { MediaReference } from '../../utils/MediaManager'

/**
 * 项目管理模块
 * 负责管理当前项目的状态和持久化
 */
export function createProjectModule() {
  // ==================== 状态定义 ====================

  // 当前项目配置
  const currentProject = ref<ProjectConfig | null>(null)
  
  // 项目保存状态
  const isSaving = ref(false)
  const lastSaved = ref<Date | null>(null)
  
  // 项目加载状态
  const isLoading = ref(false)

  // 加载进度状态
  const loadingProgress = ref(0) // 0-100
  const loadingStage = ref('') // 当前加载阶段
  const loadingDetails = ref('') // 详细信息

  // 媒体引用映射（用于持久化）
  const mediaReferences = ref<Record<string, MediaReference>>({})

  // ==================== 计算属性 ====================

  /**
   * 当前项目ID
   */
  const currentProjectId = computed(() => {
    return currentProject.value?.id || null
  })

  /**
   * 当前项目名称
   */
  const currentProjectName = computed(() => {
    return currentProject.value?.name || '未命名项目'
  })

  /**
   * 项目保存状态文本
   */
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

  /**
   * 是否有当前项目
   */
  const hasCurrentProject = computed(() => {
    return currentProject.value !== null
  })

  /**
   * 是否正在显示加载进度
   */
  const showLoadingProgress = computed(() => {
    return isLoading.value && loadingProgress.value > 0
  })

  // ==================== 项目管理方法 ====================

  /**
   * 更新加载进度
   * @param stage 当前阶段
   * @param progress 进度百分比 (0-100)
   * @param details 详细信息（可选）
   */
  function updateLoadingProgress(stage: string, progress: number, details?: string): void {
    loadingStage.value = stage
    loadingProgress.value = Math.max(0, Math.min(100, progress))
    loadingDetails.value = details || ''
    console.log(`📊 加载进度: ${stage} (${progress}%)${details ? ` - ${details}` : ''}`)
  }

  /**
   * 重置加载状态
   * @param delay 延迟时间（毫秒），默认1000ms
   */
  function resetLoadingState(delay: number = 1000): void {
    if (delay > 0) {
      // 延迟重置，让用户看到加载完成的状态
      setTimeout(() => {
        isLoading.value = false
        loadingProgress.value = 0
        loadingStage.value = ''
        loadingDetails.value = ''
      }, delay)
    } else {
      // 立即重置
      isLoading.value = false
      loadingProgress.value = 0
      loadingStage.value = ''
      loadingDetails.value = ''
    }
  }

  /**
   * 创建新项目
   * @param name 项目名称
   * @param template 项目模板（可选）
   */
  async function createProject(name: string, template?: Partial<ProjectConfig>): Promise<ProjectConfig> {
    try {
      isLoading.value = true
      updateLoadingProgress('创建项目...', 10)
      console.log(`📁 创建新项目: ${name}`)

      const projectConfig = await projectManager.createProject(name, template)
      currentProject.value = projectConfig
      mediaReferences.value = {}
      lastSaved.value = new Date()

      updateLoadingProgress('项目创建完成', 100)
      console.log(`✅ 项目创建成功: ${name} (ID: ${projectConfig.id})`)
      return projectConfig
    } catch (error) {
      console.error('创建项目失败:', error)
      throw error
    } finally {
      resetLoadingState()
    }
  }

  /**
   * 加载项目（完整版本，包含媒体文件）
   * @param projectId 项目ID
   */
  async function loadProject(projectId: string): Promise<ProjectConfig | null> {
    try {
      isLoading.value = true
      updateLoadingProgress('开始加载项目...', 5)
      console.log(`📂 开始完整加载项目: ${projectId}`)

      // 使用新的分阶段加载方法
      const result = await projectManager.loadProjectWithOptions(projectId, {
        loadMedia: true,
        loadTimeline: true, // 启用时间轴恢复
        onProgress: (stage, progress) => {
          updateLoadingProgress(stage, progress)
        }
      })

      if (result?.projectConfig) {
        const { projectConfig, mediaItems, timelineItems, tracks } = result

        // 设置项目配置
        currentProject.value = projectConfig
        mediaReferences.value = projectConfig.mediaReferences || {}
        lastSaved.value = new Date(projectConfig.updatedAt)

        // 动态导入VideoStore以避免循环依赖
        const { useVideoStore } = await import('../videoStore')
        const videoStore = useVideoStore()

        // 如果有媒体文件，恢复到VideoStore中
        if (mediaItems && mediaItems.length > 0) {
          console.log(`📁 恢复媒体文件到store: ${mediaItems.length}个文件`)

          // 使用专门的restoreMediaItems方法
          videoStore.restoreMediaItems(mediaItems)
          console.log(`✅ 媒体文件恢复完成: ${mediaItems.length}个文件`)
        }

        // 如果有轨道数据，恢复轨道结构
        if (tracks && tracks.length > 0) {
          console.log(`📋 恢复轨道结构: ${tracks.length}个轨道`)
          videoStore.restoreTracks(tracks)
          console.log(`✅ 轨道结构恢复完成: ${tracks.length}个轨道`)
        }

        // 如果有时间轴项目数据，恢复时间轴项目
        if (timelineItems && timelineItems.length > 0) {
          console.log(`⏰ 恢复时间轴项目: ${timelineItems.length}个项目`)
          await videoStore.restoreTimelineItems(timelineItems)
          console.log(`✅ 时间轴项目恢复完成: ${timelineItems.length}个项目`)
        }

        updateLoadingProgress('项目加载完成', 100)
        console.log(`✅ 项目完整加载成功: ${projectConfig.name}`)
        return projectConfig
      } else {
        console.warn(`❌ 项目不存在: ${projectId}`)
        return null
      }
    } catch (error) {
      console.error('加载项目失败:', error)
      throw error
    } finally {
      resetLoadingState()
    }
  }

  /**
   * 保存当前项目
   * @param projectData 项目数据（可选，如果不提供则使用当前项目）
   */
  async function saveCurrentProject(projectData?: Partial<ProjectConfig>): Promise<void> {
    if (!currentProject.value) {
      throw new Error('没有当前项目可保存')
    }

    try {
      isSaving.value = true
      console.log(`💾 保存项目: ${currentProject.value.name}`)
      
      // 合并项目数据
      const updatedProject: ProjectConfig = {
        ...currentProject.value,
        ...projectData,
        mediaReferences: mediaReferences.value,
        updatedAt: new Date().toISOString()
      }
      
      await projectManager.saveProject(updatedProject)
      currentProject.value = updatedProject
      lastSaved.value = new Date()
      
      console.log(`✅ 项目保存成功: ${updatedProject.name}`)
    } catch (error) {
      console.error('保存项目失败:', error)
      throw error
    } finally {
      isSaving.value = false
    }
  }

  /**
   * 添加媒体引用
   * @param mediaItemId 媒体项目ID
   * @param mediaReference 媒体引用
   */
  function addMediaReference(mediaItemId: string, mediaReference: MediaReference): void {
    mediaReferences.value[mediaItemId] = mediaReference
    console.log(`📎 添加媒体引用: ${mediaItemId} -> ${mediaReference.storedPath}`)
  }

  /**
   * 移除媒体引用
   * @param mediaItemId 媒体项目ID
   */
  function removeMediaReference(mediaItemId: string): void {
    delete mediaReferences.value[mediaItemId]
    console.log(`🗑️ 移除媒体引用: ${mediaItemId}`)
  }

  /**
   * 获取媒体引用
   * @param mediaItemId 媒体项目ID
   */
  function getMediaReference(mediaItemId: string): MediaReference | undefined {
    return mediaReferences.value[mediaItemId]
  }

  /**
   * 设置当前项目（用于从路由参数加载）
   * @param projectId 项目ID
   */
  async function setCurrentProject(projectId: string): Promise<void> {
    if (projectId && projectId !== 'undefined') {
      await loadProject(projectId)
    } else {
      // 创建新项目的情况
      currentProject.value = null
      mediaReferences.value = {}
      lastSaved.value = null
    }
  }

  /**
   * 清除当前项目
   */
  function clearCurrentProject(): void {
    currentProject.value = null
    mediaReferences.value = {}
    lastSaved.value = null
    console.log('🧹 已清除当前项目')
  }

  /**
   * 获取项目摘要信息
   */
  function getProjectSummary() {
    return {
      currentProject: currentProject.value,
      currentProjectId: currentProjectId.value,
      currentProjectName: currentProjectName.value,
      projectStatus: projectStatus.value,
      hasCurrentProject: hasCurrentProject.value,
      mediaReferencesCount: Object.keys(mediaReferences.value).length,
      isSaving: isSaving.value,
      isLoading: isLoading.value,
      lastSaved: lastSaved.value
    }
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    currentProject,
    currentProjectId,
    currentProjectName,
    projectStatus,
    hasCurrentProject,
    isSaving,
    isLoading,
    lastSaved,
    mediaReferences,

    // 加载进度状态
    loadingProgress,
    loadingStage,
    loadingDetails,
    showLoadingProgress,

    // 方法
    createProject,
    loadProject,
    saveCurrentProject,
    setCurrentProject,
    clearCurrentProject,
    addMediaReference,
    removeMediaReference,
    getMediaReference,
    getProjectSummary,

    // 加载进度方法
    updateLoadingProgress,
    resetLoadingState
  }
}

// 导出类型定义
export type ProjectModule = ReturnType<typeof createProjectModule>

import { ref, computed } from 'vue'
import type { UnifiedProjectConfig } from '../project/types'

/**
 * 统一项目管理模块
 * 基于新架构统一类型系统的项目管理，参考原projectModule设计
 */
export function createUnifiedProjectModule() {
  // ==================== 状态定义 ====================

  // 当前项目配置
  const currentProject = ref<UnifiedProjectConfig | null>(null)

  // 项目保存状态
  const isSaving = ref(false)
  const lastSaved = ref<Date | null>(null)

  // 项目加载状态
  const isLoading = ref(false)

  // 项目设置预加载状态
  const isProjectSettingsReady = ref(false)

  // 项目内容加载状态
  const isProjectContentReady = ref(false)

  // 加载进度状态
  const loadingProgress = ref(0) // 0-100
  const loadingStage = ref('') // 当前加载阶段
  const loadingDetails = ref('') // 详细信息

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
      // 格式化时间为 HH:MM:SS
      const timeString = lastSaved.value.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      return `${timeString} 已保存`
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
    return isLoading.value && loadingProgress.value >= 0
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
   * @param delay 延迟时间（毫秒），默认300ms
   */
  function resetLoadingState(delay: number = 300): void {
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
  async function createProject(
    name: string,
    template?: Partial<UnifiedProjectConfig>,
  ): Promise<UnifiedProjectConfig> {
    try {
      isLoading.value = true
      updateLoadingProgress('创建项目...', 10)
      console.log(`📁 创建新项目: ${name}`)

      // 创建基础项目配置
      const projectConfig: UnifiedProjectConfig = {
        id: `project_${Date.now()}`,
        name,
        description: template?.description || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        thumbnail: template?.thumbnail,
        duration: template?.duration,
        settings: template?.settings || {
          videoResolution: {
            name: '1920x1080',
            width: 1920,
            height: 1080,
            aspectRatio: '16:9',
          },
          frameRate: 30,
          timelineDurationFrames: 3000,
        },
        timeline: template?.timeline || {
          tracks: [],
          timelineItems: [],
          mediaItems: [],
        },
        exports: [],
      }

      currentProject.value = projectConfig
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
   * 保存当前项目
   * @param projectData 项目数据（可选，如果不提供则使用当前项目）
   */
  async function saveCurrentProject(projectData?: Partial<UnifiedProjectConfig>): Promise<void> {
    if (!currentProject.value) {
      throw new Error('没有当前项目可保存')
    }

    try {
      isSaving.value = true
      console.log(`💾 保存项目: ${currentProject.value.name}`)

      // 合并项目数据
      const updatedProject: UnifiedProjectConfig = {
        ...currentProject.value,
        ...projectData,
        updatedAt: new Date().toISOString(),
      }

      // 这里应该调用实际的保存逻辑
      // await projectManager.saveProject(updatedProject)

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
   * 预加载项目设置（轻量级，只加载关键配置）
   * @param projectId 项目ID
   */
  async function preloadProjectSettings(projectId: string): Promise<void> {
    if (!projectId || projectId === 'undefined') {
      console.log('🔄 [LIFECYCLE] UnifiedProjectModule 新项目，使用默认设置')
      isProjectSettingsReady.value = true
      console.log('🔄 [LIFECYCLE] UnifiedProjectModule isProjectSettingsReady 设置为 true')
      return
    }

    try {
      console.log(`🔧 [Settings Preload] 开始预加载项目设置: ${projectId}`)

      // 这里应该调用实际的设置加载逻辑
      // const settings = await projectManager.loadProjectSettings(projectId)

      // 模拟加载
      await new Promise((resolve) => setTimeout(resolve, 100))

      console.log('🔄 [LIFECYCLE] UnifiedProjectModule 项目设置预加载成功')
      isProjectSettingsReady.value = true
      console.log('🔄 [LIFECYCLE] UnifiedProjectModule isProjectSettingsReady 设置为 true')
    } catch (error) {
      console.error('❌ [Settings Preload] 预加载项目设置失败:', error)
      isProjectSettingsReady.value = false
      throw new Error(
        `项目设置加载失败，无法继续: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * 加载项目内容（媒体文件、时间轴数据等）
   * @param projectId 项目ID
   */
  async function loadProjectContent(projectId: string): Promise<void> {
    if (!projectId || projectId === 'undefined') {
      console.log('📂 [Content Load] 新项目，跳过内容加载')
      currentProject.value = null
      lastSaved.value = null
      isProjectContentReady.value = true
      return
    }

    try {
      isLoading.value = true
      updateLoadingProgress('开始加载项目内容...', 5)
      console.log(`📂 [Content Load] 开始加载项目内容: ${projectId}`)

      // 这里应该调用实际的项目内容加载逻辑
      // const result = await projectManager.loadProjectContent(projectId, ...)

      // 模拟加载过程
      updateLoadingProgress('加载项目配置...', 20)
      await new Promise((resolve) => setTimeout(resolve, 100))

      updateLoadingProgress('加载媒体文件...', 50)
      await new Promise((resolve) => setTimeout(resolve, 100))

      updateLoadingProgress('加载时间轴数据...', 80)
      await new Promise((resolve) => setTimeout(resolve, 100))

      updateLoadingProgress('项目内容加载完成', 100)
      console.log(`✅ [Content Load] 项目内容加载成功`)

      isProjectContentReady.value = true
    } catch (error) {
      console.error('❌ [Content Load] 加载项目内容失败:', error)
      throw error
    } finally {
      resetLoadingState()
    }
  }

  /**
   * 清除当前项目
   */
  function clearCurrentProject(): void {
    currentProject.value = null
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
      isSaving: isSaving.value,
      isLoading: isLoading.value,
      lastSaved: lastSaved.value,
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

    // 加载进度状态
    loadingProgress,
    loadingStage,
    loadingDetails,
    showLoadingProgress,
    isProjectSettingsReady,
    isProjectContentReady,

    // 方法
    createProject,
    saveCurrentProject,
    preloadProjectSettings,
    loadProjectContent,
    clearCurrentProject,
    getProjectSummary,

    // 加载进度方法
    updateLoadingProgress,
    resetLoadingState,
  }
}

// 导出类型定义
export type UnifiedProjectModule = ReturnType<typeof createUnifiedProjectModule>

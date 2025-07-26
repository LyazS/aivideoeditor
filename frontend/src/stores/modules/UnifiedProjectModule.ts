import { ref, computed } from 'vue'
import { projectManager } from '../../utils/ProjectManager'
import type { ProjectConfig } from '../../types'
import type { UnifiedMediaItemData } from '../../unified/UnifiedMediaItem'
import type { UnifiedTimelineItem } from '../../unified/timelineitem'
import type { UnifiedTrack } from '../../unified/track'

/**
 * 统一项目管理模块
 * 基于统一类型系统的项目状态管理和持久化
 * 
 * 核心设计理念：
 * - 统一类型架构：使用UnifiedMediaItem、UnifiedTimelineItem、UnifiedTrack
 * - 状态驱动管理：通过状态变化驱动项目生命周期
 * - 响应式数据：完全基于Vue3响应式系统
 * - 分离关注点：项目配置、媒体管理、时间轴管理分离
 */
export function createUnifiedProjectModule() {
  // ==================== 状态定义 ====================

  // 当前项目配置
  const currentProject = ref<ProjectConfig | null>(null)
  
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

  // 媒体引用映射（用于持久化）
  const mediaReferences = ref<Record<string, any>>({})

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
        second: '2-digit'
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
    console.log(`📊 [UnifiedProject] 加载进度: ${stage} (${progress}%)${details ? ` - ${details}` : ''}`)
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
  async function createProject(name: string, template?: Partial<ProjectConfig>): Promise<ProjectConfig> {
    try {
      isLoading.value = true
      updateLoadingProgress('创建统一项目...', 10)
      console.log(`📁 [UnifiedProject] 创建新项目: ${name}`)

      const projectConfig = await projectManager.createProject(name, template)
      currentProject.value = projectConfig
      mediaReferences.value = {}
      lastSaved.value = new Date()

      updateLoadingProgress('统一项目创建完成', 100)
      console.log(`✅ [UnifiedProject] 项目创建成功: ${name} (ID: ${projectConfig.id})`)
      return projectConfig
    } catch (error) {
      console.error('[UnifiedProject] 创建项目失败:', error)
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
      console.log(`💾 [UnifiedProject] 保存项目: ${currentProject.value.name}`)

      // 合并项目数据
      const updatedProject: ProjectConfig = {
        ...currentProject.value,
        ...projectData,
        // 使用媒体引用替代原有的localMediaReferences
        localMediaReferences: mediaReferences.value,
        asyncProcessingMediaReferences: {},
        updatedAt: new Date().toISOString()
      }
      
      await projectManager.saveProject(updatedProject)
      currentProject.value = updatedProject
      lastSaved.value = new Date()
      
      console.log(`✅ [UnifiedProject] 项目保存成功: ${updatedProject.name}`)
    } catch (error) {
      console.error('[UnifiedProject] 保存项目失败:', error)
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
  function addMediaReference(mediaItemId: string, mediaReference: any): void {
    mediaReferences.value[mediaItemId] = mediaReference
    console.log(`📎 [UnifiedProject] 添加媒体引用: ${mediaItemId}`)
  }

  /**
   * 移除媒体引用
   * @param mediaItemId 媒体项目ID
   */
  function removeMediaReference(mediaItemId: string): void {
    delete mediaReferences.value[mediaItemId]
    console.log(`🗑️ [UnifiedProject] 移除媒体引用: ${mediaItemId}`)
  }

  /**
   * 获取媒体引用
   * @param mediaItemId 媒体项目ID
   */
  function getMediaReference(mediaItemId: string): any | undefined {
    return mediaReferences.value[mediaItemId]
  }

  /**
   * 清理无效的媒体引用
   * 移除那些在project.json中存在但实际媒体文件已丢失的引用
   * @param loadedMediaItems 成功加载的媒体项目列表
   */
  async function cleanupInvalidMediaReferences(loadedMediaItems: UnifiedMediaItemData[]): Promise<void> {
    const loadedMediaIds = new Set(loadedMediaItems.map(item => item.id))
    const originalReferencesCount = Object.keys(mediaReferences.value).length

    console.log(`🧹 [UnifiedProject] 检查媒体引用一致性: ${originalReferencesCount} 个引用, ${loadedMediaItems.length} 个成功加载`)

    // 找出无效的媒体引用（在引用中存在但未成功加载的）
    const invalidMediaIds: string[] = []
    for (const mediaId in mediaReferences.value) {
      if (!loadedMediaIds.has(mediaId)) {
        invalidMediaIds.push(mediaId)
      }
    }

    if (invalidMediaIds.length > 0) {
      console.log(`🧹 [UnifiedProject] 发现 ${invalidMediaIds.length} 个无效媒体引用，开始清理...`)

      // 移除无效的媒体引用
      for (const mediaId of invalidMediaIds) {
        const reference = mediaReferences.value[mediaId]
        console.log(`🧹 [UnifiedProject] 清理无效媒体引用: ${mediaId}`)
        delete mediaReferences.value[mediaId]
      }

      // 立即保存更新后的项目配置
      try {
        if (currentProject.value) {
          // 更新当前项目的媒体引用
          currentProject.value.localMediaReferences = { ...mediaReferences.value }
          await projectManager.saveProject(currentProject.value)
          console.log(`🧹 [UnifiedProject] ✅ 媒体引用清理完成: 移除 ${invalidMediaIds.length} 个无效引用 (${originalReferencesCount} -> ${Object.keys(mediaReferences.value).length})`)
        }
      } catch (error) {
        console.error('🧹 [UnifiedProject] ❌ 保存清理后的项目配置失败:', error)
      }
    } else {
      console.log(`🧹 [UnifiedProject] ✅ 媒体引用检查完成: 所有 ${originalReferencesCount} 个引用都有效`)
    }
  }

  /**
   * 预加载项目设置（轻量级，只加载关键配置）
   * @param projectId 项目ID
   * @throws 当现有项目的设置加载失败时抛出错误
   */
  async function preloadProjectSettings(projectId: string): Promise<void> {
    if (!projectId || projectId === 'undefined') {
      console.log('🔄 [UnifiedProject] 新项目，使用默认设置')
      isProjectSettingsReady.value = true
      console.log('🔄 [UnifiedProject] isProjectSettingsReady 设置为 true')
      return
    }

    try {
      console.log(`🔧 [UnifiedProject] 开始预加载项目设置: ${projectId}`)

      const settings = await projectManager.loadProjectSettings(projectId)

      if (settings) {
        // 动态导入VideoStore以避免循环依赖
        const { useVideoStore } = await import('../videoStore')
        const videoStore = useVideoStore()

        // 恢复配置到configModule
        videoStore.restoreFromProjectSettings(settings)

        console.log('🔄 [UnifiedProject] 项目设置预加载成功')
        isProjectSettingsReady.value = true
        console.log('🔄 [UnifiedProject] isProjectSettingsReady 设置为 true')
      } else {
        // settings为null表示项目不存在（新项目），使用默认设置
        console.log('🔄 [UnifiedProject] 项目不存在，使用默认设置')
        isProjectSettingsReady.value = true
        console.log('🔄 [UnifiedProject] isProjectSettingsReady 设置为 true (新项目)')
      }
    } catch (error) {
      console.error('❌ [UnifiedProject] 预加载项目设置失败:', error)
      // 对于现有项目，设置加载失败是严重错误，不应该继续
      isProjectSettingsReady.value = false
      throw new Error(`项目设置加载失败，无法继续: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 加载项目内容（媒体项目、时间轴项目等）
   * @param projectId 项目ID
   */
  async function loadProjectContent(projectId: string): Promise<void> {
    if (!projectId || projectId === 'undefined') {
      console.log('📂 [UnifiedProject] 新项目，跳过内容加载')
      currentProject.value = null
      mediaReferences.value = {}
      lastSaved.value = null
      isProjectContentReady.value = true
      return
    }

    try {
      isLoading.value = true
      updateLoadingProgress('开始加载项目内容...', 5)
      console.log(`📂 [UnifiedProject] 开始加载项目内容: ${projectId}`)

      // 获取预加载的设置（如果有的话）
      const { useVideoStore } = await import('../videoStore')
      const videoStore = useVideoStore()
      const preloadedSettings = {
        videoResolution: videoStore.videoResolution,
        frameRate: videoStore.frameRate,
        timelineDurationFrames: videoStore.timelineDurationFrames
      }

      // 使用新的分阶段加载方法
      const result = await projectManager.loadProjectContent(projectId, preloadedSettings, {
        loadMedia: true,
        loadTimeline: true,
        onProgress: (stage, progress) => {
          updateLoadingProgress(stage, progress)
        }
      })

      if (result?.projectConfig) {
        const { projectConfig, mediaItems, timelineItems, tracks } = result

        // 设置项目配置
        currentProject.value = projectConfig
        mediaReferences.value = projectConfig.localMediaReferences || {}
        lastSaved.value = new Date(projectConfig.updatedAt)

        // 恢复媒体项目到VideoStore中
        if (mediaItems && mediaItems.length > 0) {
          console.log(`📁 [UnifiedProject] 恢复媒体项目: ${mediaItems.length}个文件`)
          videoStore.restoreMediaItems(mediaItems)
          console.log(`✅ [UnifiedProject] 媒体项目恢复完成: ${mediaItems.length}个文件`)
        }

        // 恢复轨道结构
        if (tracks && tracks.length > 0) {
          console.log(`📋 [UnifiedProject] 恢复轨道结构: ${tracks.length}个轨道`)
          videoStore.restoreTracks(tracks)
          console.log(`✅ [UnifiedProject] 轨道结构恢复完成: ${tracks.length}个轨道`)
        }

        // 恢复时间轴项目
        if (timelineItems && timelineItems.length > 0) {
          console.log(`⏰ [UnifiedProject] 恢复时间轴项目: ${timelineItems.length}个项目`)
          await videoStore.restoreTimelineItems(timelineItems)
          console.log(`✅ [UnifiedProject] 时间轴项目恢复完成: ${timelineItems.length}个项目`)
        }

        updateLoadingProgress('项目内容加载完成', 100)
        console.log(`✅ [UnifiedProject] 项目内容加载成功: ${projectConfig.name}`)
      } else {
        console.warn(`❌ [UnifiedProject] 项目不存在: ${projectId}`)
      }

      isProjectContentReady.value = true
    } catch (error) {
      console.error('❌ [UnifiedProject] 加载项目内容失败:', error)
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
    mediaReferences.value = {}
    lastSaved.value = null
    console.log('🧹 [UnifiedProject] 已清除当前项目')
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
      lastSaved: lastSaved.value,
      isProjectSettingsReady: isProjectSettingsReady.value,
      isProjectContentReady: isProjectContentReady.value
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
    isProjectSettingsReady,
    isProjectContentReady,

    // 方法
    createProject,
    saveCurrentProject,
    preloadProjectSettings,
    loadProjectContent,
    clearCurrentProject,
    addMediaReference,
    removeMediaReference,
    getMediaReference,
    cleanupInvalidMediaReferences,
    getProjectSummary,

    // 加载进度方法
    updateLoadingProgress,
    resetLoadingState
  }
}

// 导出类型定义
export type UnifiedProjectModule = ReturnType<typeof createUnifiedProjectModule>

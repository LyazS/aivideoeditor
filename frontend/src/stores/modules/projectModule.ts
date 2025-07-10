import { ref, computed } from 'vue'
import { projectManager } from '../../utils/ProjectManager'
import type { MediaReference, ProjectConfig, MediaItem } from '../../types'

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

  // 项目设置预加载状态
  const isProjectSettingsReady = ref(false)

  // 项目内容加载状态
  const isProjectContentReady = ref(false)

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
   * 清理无效的媒体引用
   * 移除那些在project.json中存在但实际媒体文件已丢失的引用
   * @param loadedMediaItems 成功加载的媒体项目列表
   */
  async function cleanupInvalidMediaReferences(loadedMediaItems: MediaItem[]): Promise<void> {
    const loadedMediaIds = new Set(loadedMediaItems.map(item => item.id))
    const originalReferencesCount = Object.keys(mediaReferences.value).length

    console.log(`🧹 [MEDIA-CLEANUP] 检查媒体引用一致性: ${originalReferencesCount} 个引用, ${loadedMediaItems.length} 个成功加载`)

    // 找出无效的媒体引用（在引用中存在但未成功加载的）
    const invalidMediaIds: string[] = []
    for (const mediaId in mediaReferences.value) {
      if (!loadedMediaIds.has(mediaId)) {
        invalidMediaIds.push(mediaId)
      }
    }

    if (invalidMediaIds.length > 0) {
      console.log(`🧹 [MEDIA-CLEANUP] 发现 ${invalidMediaIds.length} 个无效媒体引用，开始清理...`)

      // 移除无效的媒体引用
      for (const mediaId of invalidMediaIds) {
        const reference = mediaReferences.value[mediaId]
        console.log(`🧹 [MEDIA-CLEANUP] 清理无效媒体引用: ${mediaId} (${reference?.originalFileName || 'Unknown'})`)
        delete mediaReferences.value[mediaId]
      }

      // 立即保存更新后的项目配置
      try {
        if (currentProject.value) {
          // 更新当前项目的 mediaReferences
          currentProject.value.mediaReferences = { ...mediaReferences.value }
          await projectManager.saveProject(currentProject.value)
          console.log(`🧹 [MEDIA-CLEANUP] ✅ 媒体引用清理完成: 移除 ${invalidMediaIds.length} 个无效引用 (${originalReferencesCount} -> ${Object.keys(mediaReferences.value).length})`)
        }
      } catch (error) {
        console.error('🧹 [MEDIA-CLEANUP] ❌ 保存清理后的项目配置失败:', error)
      }
    } else {
      console.log(`🧹 [MEDIA-CLEANUP] ✅ 媒体引用检查完成: 所有 ${originalReferencesCount} 个引用都有效`)
    }
  }

  /**
   * 预加载项目设置（轻量级，只加载关键配置）
   * @param projectId 项目ID
   * @throws 当现有项目的设置加载失败时抛出错误
   */
  async function preloadProjectSettings(projectId: string): Promise<void> {
    if (!projectId || projectId === 'undefined') {
      console.log('🔄 [LIFECYCLE] ProjectModule 新项目，使用默认设置')
      isProjectSettingsReady.value = true
      console.log('🔄 [LIFECYCLE] ProjectModule isProjectSettingsReady 设置为 true')
      return
    }

    try {
      console.log(`🔧 [Settings Preload] 开始预加载项目设置: ${projectId}`)

      const settings = await projectManager.loadProjectSettings(projectId)

      if (settings) {
        // 动态导入VideoStore以避免循环依赖
        const { useVideoStore } = await import('../videoStore')
        const videoStore = useVideoStore()

        // 恢复配置到configModule
        videoStore.restoreFromProjectSettings(settings)

        console.log('🔄 [LIFECYCLE] ProjectModule 项目设置预加载成功')
        isProjectSettingsReady.value = true
        console.log('🔄 [LIFECYCLE] ProjectModule isProjectSettingsReady 设置为 true')
      } else {
        // settings为null表示项目不存在（新项目），使用默认设置
        console.log('🔄 [LIFECYCLE] ProjectModule 项目不存在，使用默认设置')
        isProjectSettingsReady.value = true
        console.log('🔄 [LIFECYCLE] ProjectModule isProjectSettingsReady 设置为 true (新项目)')
      }
    } catch (error) {
      console.error('❌ [Settings Preload] 预加载项目设置失败:', error)
      // 对于现有项目，设置加载失败是严重错误，不应该继续
      isProjectSettingsReady.value = false
      throw new Error(`项目设置加载失败，无法继续: ${error instanceof Error ? error.message : String(error)}`)
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
      mediaReferences.value = {}
      lastSaved.value = null
      isProjectContentReady.value = true
      return
    }

    try {
      isLoading.value = true
      updateLoadingProgress('开始加载项目内容...', 5)
      console.log(`📂 [Content Load] 开始加载项目内容: ${projectId}`)

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
        mediaReferences.value = projectConfig.mediaReferences || {}
        lastSaved.value = new Date(projectConfig.updatedAt)

        // 先清理无效的媒体引用，确保数据一致性
        await cleanupInvalidMediaReferences(mediaItems || [])

        // 然后恢复媒体文件到VideoStore中
        if (mediaItems && mediaItems.length > 0) {
          console.log(`📁 [Content Load] 恢复媒体文件到store: ${mediaItems.length}个文件`)
          videoStore.restoreMediaItems(mediaItems)
          console.log(`✅ [Content Load] 媒体文件恢复完成: ${mediaItems.length}个文件`)
        }

        // 如果有轨道数据，恢复轨道结构
        if (tracks && tracks.length > 0) {
          console.log(`📋 [Content Load] 恢复轨道结构: ${tracks.length}个轨道`)
          videoStore.restoreTracks(tracks)
          console.log(`✅ [Content Load] 轨道结构恢复完成: ${tracks.length}个轨道`)
        }

        // 如果有时间轴项目数据，恢复时间轴项目
        if (timelineItems && timelineItems.length > 0) {
          console.log(`⏰ [Content Load] 恢复时间轴项目: ${timelineItems.length}个项目`)
          await videoStore.restoreTimelineItems(timelineItems)
          console.log(`✅ [Content Load] 时间轴项目恢复完成: ${timelineItems.length}个项目`)
        }

        updateLoadingProgress('项目内容加载完成', 100)
        console.log(`✅ [Content Load] 项目内容加载成功: ${projectConfig.name}`)
      } else {
        console.warn(`❌ [Content Load] 项目不存在: ${projectId}`)
      }

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
export type ProjectModule = ReturnType<typeof createProjectModule>

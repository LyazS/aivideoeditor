import { ref, computed, type Ref } from 'vue'
import type { UnifiedProjectConfig } from '@/unified/project/types'
import { unifiedProjectManager } from '@/unified/utils/'
import type { VideoResolution } from '@/unified/types'
import { TimelineItemFactory } from '@/unified/timelineitem'

/**
 * 统一项目管理模块
 * 基于新架构统一类型系统的项目管理，参考原projectModule设计
 */
export function createUnifiedProjectModule(
  configModule: {
    projectId: Ref<string>
    projectName: Ref<string>
    projectDescription: Ref<string>
    projectCreatedAt: Ref<string>
    projectUpdatedAt: Ref<string>
    projectVersion: Ref<string>
    projectThumbnail: Ref<string | undefined | null>
    projectDuration: Ref<number>
    videoResolution: Ref<VideoResolution>
    frameRate: Ref<number>
    timelineDurationFrames: Ref<number>
    restoreFromProjectSettings: (pid: string, pconifg: UnifiedProjectConfig) => void
  },
  timelineModule?: {
    timelineItems: Ref<any[]>
  },
  trackModule?: {
    tracks: Ref<any[]>
  },
  mediaModule?: {
    mediaItems: Ref<any[]>
  }
) {
  // ==================== 状态定义 ====================

  // 项目保存状态
  const isSaving = ref(false)

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
   * 项目保存状态文本
   */
  const projectStatus = computed(() => {
    if (isSaving.value) return '保存中...'

    // 格式化时间为 HH:MM:SS
    const lastSaved = new Date(configModule.projectUpdatedAt.value)
    const timeString = lastSaved.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    return `${timeString} 已保存`
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
   * 保存当前项目
   * @param projectData 项目数据（可选，如果不提供则使用当前项目）
   */
  async function saveCurrentProject(): Promise<void> {
    try {
      isSaving.value = true
      console.log(`💾 保存项目: ${configModule.projectName.value}`)
      configModule.projectUpdatedAt.value = new Date().toISOString()
      
      // 构建更新的项目配置
      const updatedProject: UnifiedProjectConfig = {
        id: configModule.projectId.value,
        name: configModule.projectName.value,
        description: configModule.projectDescription.value,
        createdAt: configModule.projectCreatedAt.value,
        updatedAt: configModule.projectUpdatedAt.value,
        version: configModule.projectVersion.value,
        thumbnail: configModule.projectThumbnail.value || undefined,
        duration: configModule.projectDuration.value,

        // 项目设置
        settings: {
          videoResolution: configModule.videoResolution.value,
          frameRate: configModule.frameRate.value,
          timelineDurationFrames: configModule.timelineDurationFrames.value,
        },

        // 时间轴数据 - 从各个模块获取当前的时间轴数据，使用工厂函数克隆去掉运行时内容
        timeline: {
          // tracks 数据结构简单，没有运行时对象，可以直接使用
          tracks: trackModule?.tracks.value || [],
          // timelineItems 包含运行时数据，需要克隆并清理
          timelineItems: (timelineModule?.timelineItems.value || []).map(item => {
            // 使用工厂函数克隆时间轴项目，去掉运行时内容（如sprite等）
            const clonedItem = TimelineItemFactory.clone(item)
            // 确保克隆的项目没有运行时数据
            if (clonedItem.runtime) {
              clonedItem.runtime = {}
            }
            return clonedItem
          }),
          // mediaItems 包含 webav 运行时对象，需要清理
          mediaItems: (mediaModule?.mediaItems.value || []).map(item => {
            // 创建媒体项目的可持久化副本，去掉运行时的 webav 对象
            const { webav, ...persistableItem } = item
            return persistableItem
          }),
        },

        // 媒体数据
        media: {},
      }

      console.log(`📊 保存项目数据统计:`, {
        项目ID: updatedProject.id,
        项目名称: updatedProject.name,
        轨道数量: updatedProject.timeline.tracks.length,
        时间轴项目数量: updatedProject.timeline.timelineItems.length,
        媒体项目数量: updatedProject.timeline.mediaItems.length,
        视频分辨率: updatedProject.settings.videoResolution,
        帧率: updatedProject.settings.frameRate,
      })

      // 调用实际的保存逻辑
      await unifiedProjectManager.saveProject(updatedProject)

      console.log(`✅ 项目保存成功: ${configModule.projectName.value}`)
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
    try {
      console.log(`🔧 [Settings Preload] 开始预加载项目设置: ${projectId}`)

      // 这里应该调用实际的设置加载逻辑
      const projConfig = await unifiedProjectManager.loadProjectConfig(projectId)
      if (!projConfig) {
        console.error('❌ [Settings Preload] 预加载项目设置失败：项目配置不存在')
        throw new Error('项目配置不存在')
      }
      // 恢复配置到configModule
      configModule.restoreFromProjectSettings(projectId, projConfig)
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
    try {
      isLoading.value = true
      updateLoadingProgress('开始加载项目内容...', 5)
      console.log(`📂 [Content Load] 开始加载项目内容: ${projectId}`)
      // 这里应该调用实际的项目内容加载逻辑
      const result = await unifiedProjectManager.loadProjectContent(projectId, {
        loadMedia: true,
        loadTimeline: true,
        onProgress: (stage, progress) => {
          updateLoadingProgress(stage, progress)
        },
      })
      if (result?.projectConfig) {
        const { projectConfig, mediaItems, timelineItems, tracks } = result

        // 设置项目配置
        // currentProject.value = projectConfig

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
      } else {
        console.warn(`❌ [Content Load] 项目不存在: ${projectId}`)
      }
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
    console.log('🧹 已清除当前项目')
  }

  /**
   * 获取项目摘要信息
   */
  function getProjectSummary() {
    return {
      projectStatus: projectStatus.value,
      isSaving: isSaving.value,
      isLoading: isLoading.value,
    }
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    projectStatus,
    isSaving,
    isLoading,

    // 加载进度状态
    loadingProgress,
    loadingStage,
    loadingDetails,
    showLoadingProgress,
    isProjectSettingsReady,
    isProjectContentReady,

    // 方法
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

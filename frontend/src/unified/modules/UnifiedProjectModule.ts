import { ref, computed, type Ref } from 'vue'
import type { UnifiedProjectConfig, UnifiedMediaReference } from '@/unified/project/types'
import { projectFileOperations } from '@/unified/utils/ProjectFileOperations'
import type { VideoResolution } from '@/unified/types'
import { TimelineItemFactory } from '@/unified/timelineitem'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import type { UnifiedTrackData, UnifiedTrackType } from '@/unified/track/TrackTypes'
import type { UnifiedMediaItemData } from '@/unified/mediaitem/types'
import type { MediaType } from '@/unified/mediaitem/types'
import { globalProjectMediaManager } from '@/unified/utils/ProjectMediaManager'
import {
  DataSourceFactory,
  DataSourceQueries,
  extractSourceData,
} from '@/unified/sources/DataSourceTypes'

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
    timelineItems: Ref<UnifiedTimelineItemData<MediaType>[]>
    addTimelineItem: (item: UnifiedTimelineItemData<MediaType>) => void
  },
  trackModule?: {
    tracks: Ref<UnifiedTrackData[]>
    addTrack: (
      type: UnifiedTrackType,
      name?: string,
      position?: number,
      id?: string,
    ) => UnifiedTrackData
  },
  mediaModule?: {
    mediaItems: Ref<UnifiedMediaItemData[]>
    createUnifiedMediaItemData: (
      id: string,
      name: string,
      source: any,
      options?: any,
    ) => UnifiedMediaItemData
    addMediaItem: (item: UnifiedMediaItemData) => void
    startMediaProcessing: (item: UnifiedMediaItemData) => void
  },
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
      // 注意：采用即时保存策略后，媒体文件已在WebAV解析时保存，这里只保存项目配置
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
          timelineItems: (timelineModule?.timelineItems.value || []).map((item) => {
            // 使用工厂函数克隆时间轴项目，去掉运行时内容（如sprite等）
            const clonedItem = TimelineItemFactory.clone(item)
            // 确保克隆的项目没有运行时数据
            if (clonedItem.runtime) {
              clonedItem.runtime = {}
            }
            return clonedItem
          }),
          // mediaItems 包含 webav 运行时对象，需要清理
          mediaItems: (mediaModule?.mediaItems.value || [])
            .map((item) => {
              // 提取数据源的持久化数据
              const extractedSource = extractSourceData(item.source)

              // 如果提取失败，跳过该媒体项目
              if (!extractedSource) {
                console.warn(`无法提取媒体项目 ${item.name} 的数据源，跳过保存`)
                return null
              }

              // 创建媒体项目的可持久化副本
              return {
                // 核心属性
                id: item.id,
                name: item.name,
                createdAt: item.createdAt,

                // 状态信息 - 只保存媒体类型，不保存运行时状态
                // mediaStatus: item.mediaStatus, // 重新加载时会重置
                mediaType: item.mediaType,

                // 使用提取后的数据源
                source: extractedSource,

                // 元数据
                duration: item.duration,

                // 不保存 webav 对象
              }
            })
            .filter(Boolean) as UnifiedMediaItemData[], // 过滤掉提取失败的项目并断言类型
        },
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

      // 调用项目文件操作工具进行保存
      await projectFileOperations.saveProject(updatedProject)

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

      // 使用项目文件操作工具加载配置
      const projConfig = await projectFileOperations.loadProjectConfig(projectId)
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

      // 1. 加载项目配置
      updateLoadingProgress('加载项目配置...', 10)
      const projectConfig = await projectFileOperations.loadProjectConfig(projectId)
      if (!projectConfig) {
        throw new Error('项目配置不存在')
      }

      // 2. 初始化页面级媒体管理器（内部包含扫描媒体目录逻辑）
      updateLoadingProgress('初始化媒体管理器...', 20)
      await globalProjectMediaManager.initializeForProject(projectId)

      // 4. 构建媒体项目，启动数据源获取 - 强制传入配置的媒体项目
      updateLoadingProgress('重建媒体项目...', 50)
      await rebuildMediaItems(projectConfig.timeline.mediaItems)

      // 5. 恢复轨道状态
      updateLoadingProgress('恢复轨道数据...', 70)
      await restoreTracks()

      // 6. 恢复时间轴项目状态
      updateLoadingProgress('恢复时间轴项目...', 90)
      await restoreTimelineItems()

      updateLoadingProgress('项目内容加载完成', 100)
      isProjectContentReady.value = true
    } catch (error) {
      console.error('❌ [Content Load] 加载项目内容失败:', error)
      throw error
    } finally {
      resetLoadingState()
    }
  }

  /**
   * 重建媒体项目
   * @param mediaReferences 媒体引用数组
   * @param timelineMediaItems 时间轴媒体项目数组（必需，用于强制使用配置媒体项目构建策略）
   */
  async function rebuildMediaItems(timelineMediaItems: UnifiedMediaItemData[]): Promise<void> {
    try {
      if (!mediaModule) {
        throw new Error('媒体模块未初始化，请在构造函数中传入 mediaModule 参数')
      }

      // 必须使用传入的配置媒体项目进行重建
      // 注意：timelineMediaItems 是必需参数，但允许为空数组（表示项目没有媒体项目）
      if (!timelineMediaItems) {
        throw new Error('缺少必要的 timelineMediaItems 参数，重建必须基于配置的媒体项目')
      }

      // 如果 timelineMediaItems 为空数组，说明项目没有媒体项目，直接返回
      if (timelineMediaItems.length === 0) {
        console.log('项目没有媒体项目，跳过重建')
        return
      }

      // 使用项目配置中的媒体项目进行重建
      for (const savedMediaItem of timelineMediaItems) {
        try {
          // 根据数据源类型创建相应的数据源，原原本本传递 mediaReferenceId
          // 让数据源管理器内部处理缓存恢复或重新获取的逻辑
          if (DataSourceQueries.isUserSelectedSource(savedMediaItem.source)) {
            console.log(
              `📁 重建用户选择文件数据源: ${savedMediaItem.name} (ID: ${savedMediaItem.id})`,
            )

            const source = DataSourceFactory.createUserSelectedSource(savedMediaItem.source)

            // 使用保存的配置创建媒体项目
            const mediaItem = mediaModule.createUnifiedMediaItemData(
              savedMediaItem.id,
              savedMediaItem.name,
              source,
              {
                // 恢复保存的配置，排除 source 和 webav 属性
                createdAt: savedMediaItem.createdAt,
                mediaType: savedMediaItem.mediaType,
                duration: savedMediaItem.duration,
              },
            )

            // 添加到媒体模块并启动处理
            mediaModule.addMediaItem(mediaItem)
            mediaModule.startMediaProcessing(mediaItem)
          } else if (DataSourceQueries.isRemoteSource(savedMediaItem.source)) {
            // 远程文件数据源重建
            console.log(`🌐 重建远程文件数据源: ${savedMediaItem.name} (ID: ${savedMediaItem.id})`)

            const source = DataSourceFactory.createRemoteSource(savedMediaItem.source)

            // 创建媒体项目
            const mediaItem = mediaModule.createUnifiedMediaItemData(
              savedMediaItem.id,
              savedMediaItem.name,
              source,
              {
                // 恢复保存的配置，排除 source 和 webav 属性
                createdAt: savedMediaItem.createdAt,
                mediaType: savedMediaItem.mediaType,
                duration: savedMediaItem.duration,
              },
            )

            // 添加到媒体模块并启动处理（使用智能缓存处理）
            mediaModule.addMediaItem(mediaItem)
            mediaModule.startMediaProcessing(mediaItem)
          } else {
            // 对于其他未支持的数据源类型
            console.warn(
              `不支持的数据源类型，跳过重建: ${savedMediaItem.name} (ID: ${savedMediaItem.id})`,
            )
            continue
          }
        } catch (error) {
          console.error(`恢复媒体项目失败: ${savedMediaItem.name}`, error)
          // 即使单个媒体项目恢复失败，也要继续处理其他项目
          // 这样可以确保部分媒体项目能够正常恢复
        }
      }
    } catch (error) {
      console.error('重建媒体项目过程失败:', error)
      throw error
    }
  }

  /**
   * 恢复轨道状态（用于项目加载）
   */
  async function restoreTracks(): Promise<void> {
    try {
      console.log('🛤️ 开始恢复轨道状态...')
      
      // 获取项目配置
      const projectConfig = await projectFileOperations.loadProjectConfig(configModule.projectId.value)
      if (!projectConfig) {
        throw new Error('项目配置不存在，无法恢复轨道')
      }

      // 检查轨道模块是否可用
      if (!trackModule) {
        console.warn('⚠️ 轨道模块未初始化，跳过轨道恢复')
        return
      }

      // 清空现有轨道
      trackModule.tracks.value = []

      // 恢复轨道数据
      const savedTracks = projectConfig.timeline.tracks
      if (savedTracks && savedTracks.length > 0) {
        for (const trackData of savedTracks) {
          // 使用轨道模块的 addTrack 方法创建轨道
          trackModule.addTrack(
            trackData.type,
            trackData.name,
            undefined, // position 参数，使用默认值
            trackData.id // 使用保存的轨道ID
          )
          
          // 恢复轨道属性
          const restoredTrack = trackModule.tracks.value.find(t => t.id === trackData.id)
          if (restoredTrack) {
            // 在统一架构中，轨道数据是响应式的，直接修改属性
            restoredTrack.isVisible = trackData.isVisible
            restoredTrack.isMuted = trackData.isMuted
            restoredTrack.height = trackData.height
          }
          
          console.log(`🛤️ 恢复轨道: ${trackData.name} (${trackData.type})`)
        }
      } else {
        // 如果没有保存的轨道，创建默认轨道
        console.log('🛤️ 没有保存的轨道数据，创建默认轨道')
        trackModule.addTrack('video', '视频轨道')
      }

      console.log(`✅ 轨道恢复完成: ${trackModule.tracks.value.length}个轨道`)
    } catch (error) {
      console.error('❌ 恢复轨道失败:', error)
      throw error
    }
  }

  /**
   * 恢复时间轴项目状态（用于项目加载）
   */
  async function restoreTimelineItems(): Promise<void> {
    try {
      console.log('🎬 开始恢复时间轴项目状态...')
      
      // 获取项目配置
      const projectConfig = await projectFileOperations.loadProjectConfig(configModule.projectId.value)
      if (!projectConfig) {
        throw new Error('项目配置不存在，无法恢复时间轴项目')
      }

      // 检查时间轴模块是否可用
      if (!timelineModule) {
        console.warn('⚠️ 时间轴模块未初始化，跳过时间轴项目恢复')
        return
      }

      // 清空现有时间轴项目
      timelineModule.timelineItems.value = []

      // 恢复时间轴项目数据
      const savedTimelineItems = projectConfig.timeline.timelineItems
      if (savedTimelineItems && savedTimelineItems.length > 0) {
        for (const itemData of savedTimelineItems) {
          // 基本验证：必须有ID
          if (!itemData.id) {
            console.warn('⚠️ 跳过无效的时间轴项目数据（缺少ID）:', itemData)
            continue
          }

          // 验证轨道是否存在
          if (itemData.trackId && !trackModule?.tracks.value.some(t => t.id === itemData.trackId)) {
            console.warn(`⚠️ 跳过时间轴项目，对应的轨道不存在: ${itemData.trackId}`)
            continue
          }

          // 文本类型特殊处理（文本类型没有对应的媒体项目，mediaItemId可以为空）
          if (itemData.mediaType !== 'text' && !itemData.mediaItemId) {
            console.warn('⚠️ 跳过无效的时间轴项目数据（缺少mediaItemId）:', itemData)
            continue
          }

          // 非文本类型：验证对应的媒体项目是否存在
          if (itemData.mediaType !== 'text' && itemData.mediaItemId) {
            const mediaItem = mediaModule?.mediaItems.value.find(m => m.id === itemData.mediaItemId)
            if (!mediaItem) {
              console.warn(`⚠️ 跳过时间轴项目，对应的媒体项目不存在: ${itemData.mediaItemId}`)
              continue
            }
          }

          // 使用 TimelineItemFactory 克隆时间轴项目，确保数据结构正确
          const clonedItem = TimelineItemFactory.clone(itemData)
          
          // 清理运行时数据
          if (clonedItem.runtime) {
            clonedItem.runtime = {}
          }
          
          // 添加到时间轴模块
          timelineModule.addTimelineItem(clonedItem)
          
          console.log(`🎬 恢复时间轴项目: ${itemData.id} (${itemData.mediaType})`)
        }
      }

      console.log(`✅ 时间轴项目恢复完成: ${timelineModule.timelineItems.value.length}个项目`)
    } catch (error) {
      console.error('❌ 恢复时间轴项目失败:', error)
      throw error
    }
  }

  /**
   * 恢复时间轴轨道和项目状态（保持向后兼容）
   * @deprecated 请使用 restoreTracks 和 restoreTimelineItems 分别调用
   */
  async function restoreTimelineAndTracks(): Promise<void> {
    try {
      // 先恢复轨道
      await restoreTracks()
      
      // 然后恢复时间轴项目
      await restoreTimelineItems()
      
      console.log('✅ 时间轴轨道和项目状态恢复完成')
    } catch (error) {
      console.error('❌ 恢复时间轴轨道和项目状态失败:', error)
      throw error
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
    
    // 恢复方法（拆分后的独立函数）
    restoreTracks,
    restoreTimelineItems,
    restoreTimelineAndTracks, // 保持向后兼容

    // 加载进度方法
    updateLoadingProgress,
    resetLoadingState,
  }
}

// 导出类型定义
export type UnifiedProjectModule = ReturnType<typeof createUnifiedProjectModule>

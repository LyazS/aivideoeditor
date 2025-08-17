import { directoryManager } from '@/utils/DirectoryManager'
import type { UnifiedProjectConfig } from '@/unified/project'
import type { UnifiedMediaItemData, UnifiedTimelineItemData } from '@/unified'
import type { UnifiedTrackData } from '@/unified/track/TrackTypes'

/**
 * 统一项目加载选项
 */
export interface UnifiedLoadProjectOptions {
  /** 是否加载媒体文件 */
  loadMedia?: boolean
  /** 是否恢复时间轴 */
  loadTimeline?: boolean
  /** 进度回调函数 */
  onProgress?: (stage: string, progress: number) => void
}

/**
 * 统一项目加载结果
 */
export interface UnifiedProjectLoadResult {
  /** 项目配置 */
  projectConfig: UnifiedProjectConfig
  /** 加载的媒体项目（如果启用了媒体加载） */
  mediaItems?: UnifiedMediaItemData[]
  /** 时间轴项目数据（如果启用了时间轴加载） */
  timelineItems?: UnifiedTimelineItemData[]
  /** 轨道数据（如果启用了时间轴加载） */
  tracks?: UnifiedTrackData[]
  /** 已完成的加载阶段 */
  loadedStages: string[]
}

/**
 * 单项目文件操作工具类
 * 专门负责单个项目的保存和加载操作，供UnifiedProjectModule使用
 * 不涉及多项目管理逻辑
 */
export class ProjectFileOperations {
  private readonly PROJECTS_FOLDER = 'projects'

  /**
   * 轻量级设置预加载 - 只读取 project.json 中的配置
   * @param projectId 项目ID
   * @returns 项目配置或null（仅当项目不存在时）
   * @throws 当项目存在但读取失败时抛出错误
   */
  async loadProjectConfig(projectId: string): Promise<UnifiedProjectConfig | null> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      console.log(`🔧 [Project Config Load] 开始加载项目配置: ${projectId}`)

      const projectsHandle = await workspaceHandle.getDirectoryHandle(this.PROJECTS_FOLDER)
      const projectHandle = await projectsHandle.getDirectoryHandle(projectId)
      const projectConfig = await this.loadProjectJson(projectHandle)

      if (!projectConfig) {
        throw new Error(`项目配置文件读取失败或格式错误`)
      }

      if (!projectConfig.settings) {
        throw new Error(`项目配置文件缺少settings字段`)
      }

      // 验证关键设置字段
      if (!projectConfig.settings.videoResolution) {
        throw new Error(`项目配置缺少videoResolution设置`)
      }

      console.log(`✅ [Project Config Load] 项目配置加载成功:`, {
        videoResolution: projectConfig.settings.videoResolution,
        frameRate: projectConfig.settings.frameRate,
      })

      return projectConfig
    } catch (error) {
      // 如果是项目不存在的错误，返回null（用于新项目）
      if (error instanceof Error && error.name === 'NotFoundError') {
        console.error(`📝 [Project Config Load] 项目不存在，返回null: ${projectId}`)
        return null
      }

      // 其他错误（文件损坏、格式错误等）抛出异常
      console.error(`❌ [Project Config Load] 加载项目配置失败: ${projectId}`, error)
      return null
    }
  }

  /**
   * 加载项目内容（不包含设置预加载，专注于媒体和时间轴数据）
   * @param projectId 项目ID
   * @param options 加载选项
   * @returns 项目加载结果
   */
  async loadProjectContent(
    projectId: string,
    options: UnifiedLoadProjectOptions = {},
  ): Promise<UnifiedProjectLoadResult | null> {
    const { loadMedia = true, loadTimeline = true, onProgress } = options

    try {
      // 1. 加载项目配置
      onProgress?.('加载项目配置...', 10)
      const projectConfig = await this.loadProjectConfig(projectId)
      if (!projectConfig) {
        throw new Error('项目配置不存在')
      }

      // 2. 初始化页面级媒体管理器
      const { globalProjectMediaManager } = await import('@/unified/utils/ProjectMediaManager')
      globalProjectMediaManager.initializeForProject(projectId)

      // 3. Meta驱动的媒体加载策略
      let mediaItems: UnifiedMediaItemData[] = []
      if (loadMedia) {
        onProgress?.('扫描媒体目录...', 20)

        // 通过扫描目录meta文件构建媒体引用（Meta驱动策略）
        const scannedReferences = await globalProjectMediaManager.scanMediaDirectory()

        onProgress?.('重建媒体项目...', 40)
        mediaItems = await this.rebuildMediaItemsFromReferences(
          scannedReferences,
          (loaded, total) => {
            const progress = 40 + (loaded / total) * 30
            onProgress?.(`重建媒体项目 ${loaded}/${total}`, progress)
          }
        )

        // 🆕 新增：差异化加载不同类型的数据源
        onProgress?.('差异化加载数据源...', 70)
        await this.loadDataSourcesWithDifferentStrategies(mediaItems, onProgress)
      }

      // 4. 加载时间轴数据
      let timelineItems: UnifiedTimelineItemData[] = []
      let tracks: UnifiedTrackData[] = []
      if (loadTimeline && projectConfig.timeline) {
        onProgress?.('加载时间轴数据...', 80)
        timelineItems = projectConfig.timeline.timelineItems || []
        tracks = projectConfig.timeline.tracks || []
      }

      // 5. 返回加载结果
      onProgress?.('完成加载', 100)
      return {
        projectConfig,
        mediaItems,
        timelineItems,
        tracks,
        loadedStages: ['config', 'media', 'timeline']
      }
    } catch (error) {
      console.error(`加载项目内容失败: ${projectId}`, error)
      throw error
    }
  }

  /**
   * 保存项目配置
   */
  async saveProject(projectConfig: UnifiedProjectConfig): Promise<void> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      const projectsHandle = await workspaceHandle.getDirectoryHandle(this.PROJECTS_FOLDER)
      const projectHandle = await projectsHandle.getDirectoryHandle(projectConfig.id)

      await this.saveProjectConfig(projectHandle, projectConfig)
      console.log('项目保存成功:', projectConfig.name)
    } catch (error) {
      console.error('保存项目失败:', error)
      throw error
    }
  }

  /**
   * 从媒体引用重建媒体项目
   * @param mediaReferences 媒体引用数组
   * @param onProgress 进度回调
   * @returns 重建的媒体项目数组
   */
  private async rebuildMediaItemsFromReferences(
    mediaReferences: any[],
    onProgress?: (loaded: number, total: number) => void
  ): Promise<UnifiedMediaItemData[]> {
    const { createUnifiedMediaItemData } = await import('@/unified/mediaitem')
    const { DataSourceFactory } = await import('@/unified/sources/DataSourceTypes')

    const rebuiltItems: UnifiedMediaItemData[] = []

    console.log(`🔄 [Meta驱动] 开始从 ${mediaReferences.length} 个媒体引用重建媒体项目`)

    for (let i = 0; i < mediaReferences.length; i++) {
      const mediaRef = mediaReferences[i]

      try {
        // 创建一个临时的File对象用于数据源（实际文件将在需要时从项目目录加载）
        const tempFile = new File([''], mediaRef.originalFileName, { type: mediaRef.mimeType })

        // 创建数据源并设置媒体引用ID
        const source = DataSourceFactory.createUserSelectedSource(tempFile)
        source.mediaReferenceId = mediaRef.id

        // 创建媒体项目
        const mediaItem = createUnifiedMediaItemData(
          mediaRef.id, // 使用媒体引用ID作为媒体项目ID
          mediaRef.originalFileName,
          source,
          {
            mediaType: mediaRef.mediaType,
            mediaStatus: 'ready', // 从meta文件加载的项目默认为ready状态
            duration: mediaRef.metadata?.duration
          }
        )

        rebuiltItems.push(mediaItem)
        console.log(`✅ [Meta驱动] 媒体项目重建成功: ${mediaRef.originalFileName}`)
      } catch (error) {
        console.error(`❌ [Meta驱动] 媒体项目重建失败: ${mediaRef.originalFileName}`, error)
      }

      // 更新进度
      onProgress?.(i + 1, mediaReferences.length)
    }

    console.log(`✅ [Meta驱动] 媒体项目重建完成: ${rebuiltItems.length}/${mediaReferences.length}`)
    return rebuiltItems
  }

  /**
   * 差异化加载不同类型数据源的策略方法
   * 根据不同source类型实现不同的加载逻辑
   * @param mediaItems 媒体项目数组
   * @param onProgress 进度回调
   */
  private async loadDataSourcesWithDifferentStrategies(
    mediaItems: UnifiedMediaItemData[],
    onProgress?: (message: string, progress: number) => void
  ): Promise<void> {
    console.log(`🔄 开始差异化加载 ${mediaItems.length} 个数据源`)

    for (let i = 0; i < mediaItems.length; i++) {
      const mediaItem = mediaItems[i]

      try {
        // 🔄 根据数据源类型采用不同的加载策略
        const { DataSourceQueries } = await import('@/unified/sources/DataSourceTypes')

        if (DataSourceQueries.isUserSelectedSource(mediaItem.source)) {
          // 👤 本地文件数据源：根据mediaReferenceId从媒体管理器加载文件
          await this.loadUserSelectedFileSource(mediaItem.source)
        } else if (DataSourceQueries.isRemoteSource(mediaItem.source)) {
          // 🌐 远程文件数据源：优先查找本地缓存，不存在时启动下载
          await this.loadRemoteFileSource(mediaItem.source)
        }

        // 更新进度
        const progress = 70 + ((i + 1) / mediaItems.length) * 10
        onProgress?.(`加载数据源 ${i + 1}/${mediaItems.length}`, progress)
      } catch (error) {
        console.error(`加载数据源失败: ${mediaItem.name}`, error)
        // 单个文件加载失败不影响其他文件
        const { DataSourceBusinessActions } = await import('@/unified/sources/BaseDataSource')

        // 🔧 增强容错机制：提供详细的错误信息和恢复建议
        let errorMessage = `加载失败: ${error instanceof Error ? error.message : String(error)}`

        // 根据错误类型提供恢复建议
        if (error instanceof Error) {
          if (error.message.includes('NotFoundError') || error.message.includes('文件不存在')) {
            errorMessage += '\n💡 建议：文件可能已被移动或删除，请重新导入该文件'
          } else if (error.message.includes('网络') || error.message.includes('fetch')) {
            errorMessage += '\n💡 建议：网络连接问题，请检查网络连接后重试'
          } else if (error.message.includes('权限') || error.message.includes('permission')) {
            errorMessage += '\n💡 建议：文件访问权限不足，请检查文件权限设置'
          }
        }

        DataSourceBusinessActions.setError(mediaItem.source, errorMessage)
      }
    }

    console.log(`✅ 差异化数据源加载完成`)
  }

  /**
   * 加载本地文件数据源
   * 策略：根据mediaReferenceId从媒体管理器获取对应的file
   * @param source 本地文件数据源
   */
  private async loadUserSelectedFileSource(source: any): Promise<void> {
    if (!source.mediaReferenceId) {
      console.warn('本地文件数据源缺少mediaReferenceId，无法加载')
      const { DataSourceBusinessActions } = await import('@/unified/sources/BaseDataSource')
      DataSourceBusinessActions.setError(source, '缺少媒体引用ID')
      return
    }

    try {
      // 根据引用ID从媒体管理器获取媒体引用
      const { globalProjectMediaManager } = await import('@/unified/utils/ProjectMediaManager')
      const mediaRef = globalProjectMediaManager.getMediaReference(source.mediaReferenceId)
      if (!mediaRef) {
        console.warn(`媒体引用不存在: ${source.mediaReferenceId}`)
        const { DataSourceBusinessActions } = await import('@/unified/sources/BaseDataSource')
        DataSourceBusinessActions.setMissing(source)
        return
      }

      // 从项目目录加载对应的文件
      const file = await globalProjectMediaManager.loadMediaFromProject(
        globalProjectMediaManager.currentProjectId,
        mediaRef.storedPath
      )

      // 创建blob URL用于WebAV处理
      const url = URL.createObjectURL(file)

      // 设置数据源状态和数据
      const { DataSourceBusinessActions } = await import('@/unified/sources/BaseDataSource')
      DataSourceBusinessActions.completeAcquisition(source, file, url)

      console.log(`✅ 本地文件加载成功: ${mediaRef.metadata?.originalFileName || '未知文件'}`)
    } catch (error) {
      console.error(`加载本地文件失败: ${source.mediaReferenceId}`, error)
      const { DataSourceBusinessActions } = await import('@/unified/sources/BaseDataSource')
      DataSourceBusinessActions.setError(source, `文件加载失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 加载远程文件数据源
   * 策略：优先根据引用ID寻找本地缓存，不存在时启动下载流程
   * @param source 远程文件数据源
   */
  private async loadRemoteFileSource(source: any): Promise<void> {
    try {
      const { globalProjectMediaManager } = await import('@/unified/utils/ProjectMediaManager')

      // 🔍 第一步：检查本地缓存（通过mediaReferenceId）
      if (source.mediaReferenceId) {
        const mediaRef = globalProjectMediaManager.getMediaReference(source.mediaReferenceId)
        if (mediaRef) {
          console.log(`📦 发现本地缓存: ${mediaRef.metadata?.originalFileName || '未知文件'}`)

          // 从本地加载缓存文件
          const file = await globalProjectMediaManager.loadMediaFromProject(
            globalProjectMediaManager.currentProjectId,
            mediaRef.storedPath
          )

          const url = URL.createObjectURL(file)
          const { DataSourceBusinessActions } = await import('@/unified/sources/BaseDataSource')
          DataSourceBusinessActions.completeAcquisition(source, file, url)

          console.log(`✅ 远程文件本地缓存加载成功: ${source.remoteUrl}`)
          return
        }
      }

      // 🌐 第二步：本地缓存不存在，启动下载流程
      console.log(`🌐 启动远程文件下载: ${source.remoteUrl}`)

      // 设置下载状态
      const { DataSourceStateActions } = await import('@/unified/sources/BaseDataSource')
      DataSourceStateActions.setAcquiring(source)

      // 执行下载（集成RemoteFileManager的下载逻辑）
      const downloadResult = await this.downloadRemoteFile(source)

      if (downloadResult.success && downloadResult.file && downloadResult.url) {
        // 下载成功后，立即保存到媒体管理器并设置引用ID
        const saveResult = await globalProjectMediaManager.saveMediaToProject(
          downloadResult.file,
          'video', // 媒体类型待WebAV解析确定，暂时使用默认值
          null // 下载阶段没有WebAV clip
        )

        if (saveResult.success && saveResult.mediaReference) {
          source.mediaReferenceId = saveResult.mediaReference.id
          console.log(`🔗 远程文件下载并保存成功，设置引用ID: ${source.mediaReferenceId}`)
        }

        // 设置数据源完成状态
        const { DataSourceBusinessActions } = await import('@/unified/sources/BaseDataSource')
        DataSourceBusinessActions.completeAcquisition(source, downloadResult.file, downloadResult.url)
      } else {
        const { DataSourceBusinessActions } = await import('@/unified/sources/BaseDataSource')
        DataSourceBusinessActions.setError(source, downloadResult.error || '下载失败')
      }
    } catch (error) {
      console.error(`加载远程文件失败: ${source.remoteUrl}`, error)
      const { DataSourceBusinessActions } = await import('@/unified/sources/BaseDataSource')
      DataSourceBusinessActions.setError(source, `下载失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 下载远程文件
   * @param source 远程文件数据源
   * @returns 下载结果
   */
  private async downloadRemoteFile(source: any): Promise<{
    success: boolean
    file?: File
    url?: string
    error?: string
  }> {
    try {
      // 使用RemoteDownloadProcessor进行下载
      const { RemoteDownloadProcessor } = await import('@/utils/RemoteDownloadProcessor')
      const processor = new RemoteDownloadProcessor()

      const downloadConfig = {
        type: 'remote-download' as const,
        url: source.remoteUrl,
        timeout: 30000,
        retryCount: 3,
        retryDelay: 1000
      }

      // 执行下载，带进度回调
      const file = await processor.process(downloadConfig, (progress) => {
        // 更新数据源的下载进度
        source.progress = progress
        console.log(`📥 下载进度: ${progress}% - ${source.remoteUrl}`)
      })

      // 创建blob URL
      const url = URL.createObjectURL(file)

      return {
        success: true,
        file,
        url
      }
    } catch (error) {
      console.error('下载远程文件失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 从项目文件夹加载配置
   */
  private async loadProjectJson(
    projectHandle: FileSystemDirectoryHandle,
  ): Promise<UnifiedProjectConfig | null> {
    try {
      const configFileHandle = await projectHandle.getFileHandle('project.json')
      const configFile = await configFileHandle.getFile()
      const configText = await configFile.text()

      return JSON.parse(configText) as UnifiedProjectConfig
    } catch (error) {
      console.warn('加载项目配置失败:', error)
      return null
    }
  }

  /**
   * 保存项目配置到文件
   */
  private async saveProjectConfig(
    projectHandle: FileSystemDirectoryHandle,
    config: UnifiedProjectConfig,
  ): Promise<void> {
    const configFileHandle = await projectHandle.getFileHandle('project.json', { create: true })
    const writable = await configFileHandle.createWritable()

    await writable.write(JSON.stringify(config, null, 2))
    await writable.close()
  }
}

// 导出单例实例
export const projectFileOperations = new ProjectFileOperations()
import { directoryManager } from './DirectoryManager'
import type { MediaReference } from './MediaManager'
import type { MediaItem, TimelineItemData, Track } from '../types'
import { mediaManager } from './MediaManager'

/**
 * 项目加载选项
 */
export interface LoadProjectOptions {
  /** 是否加载媒体文件 */
  loadMedia?: boolean
  /** 是否恢复时间轴 */
  loadTimeline?: boolean
  /** 进度回调函数 */
  onProgress?: (stage: string, progress: number) => void
}

/**
 * 项目加载结果
 */
export interface ProjectLoadResult {
  /** 项目配置 */
  projectConfig: ProjectConfig
  /** 加载的媒体项目（如果启用了媒体加载） */
  mediaItems?: MediaItem[]
  /** 时间轴项目数据（如果启用了时间轴加载） */
  timelineItems?: TimelineItemData[]
  /** 轨道数据（如果启用了时间轴加载） */
  tracks?: Track[]
  /** 已完成的加载阶段 */
  loadedStages: string[]
}

/**
 * 项目配置接口
 */
export interface ProjectConfig {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  version: string
  thumbnail?: string
  duration?: string
  
  // 项目设置
  settings: {
    videoResolution: {
      name: string
      width: number
      height: number
      aspectRatio: string
    }
    frameRate: number
    timelineDurationFrames: number
  }
  
  // 时间轴数据
  timeline: {
    tracks: any[]
    timelineItems: any[]
    mediaItems: any[]
  }
  
  // 媒体文件引用
  mediaReferences: {
    [mediaId: string]: MediaReference
  }
  
  // 导出历史
  exports: any[]
}

/**
 * 项目管理器
 * 负责项目的创建、保存、加载、删除等操作
 */
export class ProjectManager {
  private static instance: ProjectManager
  private readonly PROJECTS_FOLDER = 'projects'

  private constructor() {}

  static getInstance(): ProjectManager {
    if (!ProjectManager.instance) {
      ProjectManager.instance = new ProjectManager()
    }
    return ProjectManager.instance
  }

  /**
   * 扫描并获取所有项目列表
   */
  async listProjects(): Promise<ProjectConfig[]> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      // 获取或创建projects文件夹
      const projectsHandle = await this.getOrCreateProjectsFolder(workspaceHandle)
      const projects: ProjectConfig[] = []

      // 遍历projects文件夹中的所有子文件夹
      for await (const [name, handle] of projectsHandle.entries()) {
        if (handle.kind === 'directory') {
          try {
            const projectConfig = await this.loadProjectConfig(handle)
            if (projectConfig) {
              projects.push(projectConfig)
            }
          } catch (error) {
            console.warn(`加载项目 ${name} 失败:`, error)
          }
        }
      }

      // 按更新时间排序
      projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      
      return projects
    } catch (error) {
      console.error('扫描项目列表失败:', error)
      throw error
    }
  }

  /**
   * 创建新项目
   */
  async createProject(name: string, template?: Partial<ProjectConfig>): Promise<ProjectConfig> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    const projectId = 'project_' + Date.now()
    const now = new Date().toISOString()

    const projectConfig: ProjectConfig = {
      id: projectId,
      name: name,
      description: template?.description || '',
      createdAt: now,
      updatedAt: now,
      version: '1.0.0',
      
      settings: {
        videoResolution: {
          name: '1080p',
          width: 1920,
          height: 1080,
          aspectRatio: '16:9'
        },
        frameRate: 30,
        timelineDurationFrames: 1800
      },
      
      timeline: {
        tracks: [],
        timelineItems: [],
        mediaItems: []
      },
      
      mediaReferences: {},
      exports: [],
      
      ...template
    }

    try {
      // 创建项目文件夹
      const projectsHandle = await this.getOrCreateProjectsFolder(workspaceHandle)
      const projectHandle = await projectsHandle.getDirectoryHandle(projectId, { create: true })

      // 创建子文件夹结构
      await projectHandle.getDirectoryHandle('media', { create: true })
      await projectHandle.getDirectoryHandle('exports', { create: true })
      
      const mediaHandle = await projectHandle.getDirectoryHandle('media')
      await mediaHandle.getDirectoryHandle('videos', { create: true })
      await mediaHandle.getDirectoryHandle('images', { create: true })
      await mediaHandle.getDirectoryHandle('audio', { create: true })
      await mediaHandle.getDirectoryHandle('thumbnails', { create: true })

      // 保存项目配置文件
      await this.saveProjectConfig(projectHandle, projectConfig)

      console.log('项目创建成功:', projectConfig.name)
      return projectConfig
    } catch (error) {
      console.error('创建项目失败:', error)
      throw error
    }
  }

  /**
   * 加载项目（简化版本，仅加载配置）
   * @deprecated 建议使用 loadProjectWithOptions 方法
   */
  async loadProject(projectId: string): Promise<ProjectConfig | null> {
    const result = await this.loadProjectWithOptions(projectId, { loadMedia: false })
    return result?.projectConfig || null
  }

  /**
   * 轻量级设置预加载 - 只读取 project.json 中的 settings 部分
   * @param projectId 项目ID
   * @returns 项目设置或null（仅当项目不存在时）
   * @throws 当项目存在但读取失败时抛出错误
   */
  async loadProjectSettings(projectId: string): Promise<ProjectConfig['settings'] | null> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      console.log(`🔧 [Settings Preload] 开始预加载项目设置: ${projectId}`)

      const projectsHandle = await workspaceHandle.getDirectoryHandle(this.PROJECTS_FOLDER)
      const projectHandle = await projectsHandle.getDirectoryHandle(projectId)
      const projectConfig = await this.loadProjectConfig(projectHandle)

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

      console.log(`✅ [Settings Preload] 项目设置预加载成功:`, {
        videoResolution: projectConfig.settings.videoResolution,
        frameRate: projectConfig.settings.frameRate,
        timelineDurationFrames: projectConfig.settings.timelineDurationFrames
      })

      return projectConfig.settings
    } catch (error) {
      // 如果是项目不存在的错误，返回null（用于新项目）
      if (error instanceof Error && error.name === 'NotFoundError') {
        console.log(`📝 [Settings Preload] 项目不存在，返回null: ${projectId}`)
        return null
      }

      // 其他错误（文件损坏、格式错误等）抛出异常
      console.error(`❌ [Settings Preload] 预加载项目设置失败: ${projectId}`, error)
      throw new Error(`无法加载项目设置: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 分阶段加载项目（完整版本）
   * @param projectId 项目ID
   * @param options 加载选项
   * @returns 项目加载结果
   */
  async loadProjectWithOptions(
    projectId: string,
    options: LoadProjectOptions = {}
  ): Promise<ProjectLoadResult | null> {
    const {
      loadMedia = true,
      loadTimeline = true,
      onProgress
    } = options

    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      console.log(`📂 开始分阶段加载项目: ${projectId}`)
      const loadedStages: string[] = []

      // 阶段1: 加载项目配置 (20%)
      onProgress?.('加载项目配置...', 20)
      const projectsHandle = await workspaceHandle.getDirectoryHandle(this.PROJECTS_FOLDER)
      const projectHandle = await projectsHandle.getDirectoryHandle(projectId)
      const projectConfig = await this.loadProjectConfig(projectHandle)

      if (!projectConfig) {
        throw new Error('项目配置加载失败')
      }

      loadedStages.push('config')
      console.log(`✅ 项目配置加载完成: ${projectConfig.name}`)

      let mediaItems: MediaItem[] | undefined

      if (loadMedia && projectConfig.mediaReferences && Object.keys(projectConfig.mediaReferences).length > 0) {
        // 阶段2: 加载媒体文件 (20% -> 80%)
        onProgress?.('加载媒体文件...', 40)

        try {
          mediaItems = await mediaManager.loadAllMediaForProject(
            projectId,
            projectConfig.mediaReferences,
            {
              batchSize: 3,
              onProgress: (loaded, total) => {
                // 将媒体加载进度映射到40%-80%范围
                const mediaProgress = 40 + (loaded / total) * 40
                onProgress?.(`加载媒体文件 ${loaded}/${total}...`, mediaProgress)
              }
            }
          )

          loadedStages.push('media')
          console.log(`✅ 媒体文件加载完成: ${mediaItems.length}个文件`)
        } catch (error) {
          console.error('媒体文件加载失败:', error)
          // 媒体加载失败不应该阻止项目加载，继续后续流程
          mediaItems = []
        }
      }

      // 阶段3: 加载时间轴数据 (80% -> 95%)
      let timelineItems: TimelineItemData[] | undefined
      let tracks: Track[] | undefined

      if (loadTimeline && projectConfig.timeline) {
        onProgress?.('加载时间轴数据...', 85)

        // 加载轨道数据
        tracks = projectConfig.timeline.tracks || []
        console.log(`📋 加载轨道数据: ${tracks.length}个轨道`)

        // 加载时间轴项目数据
        timelineItems = projectConfig.timeline.timelineItems || []
        console.log(`⏰ 加载时间轴项目数据: ${timelineItems.length}个项目`)

        onProgress?.('时间轴数据加载完成...', 95)
        loadedStages.push('timeline-loaded')
        console.log(`✅ 时间轴数据加载完成: ${tracks.length}个轨道, ${timelineItems.length}个项目`)
      }

      // 阶段4: 完成加载 (95% -> 100%)
      onProgress?.('加载完成', 100)
      loadedStages.push('complete')

      const result: ProjectLoadResult = {
        projectConfig,
        mediaItems,
        timelineItems,
        tracks,
        loadedStages
      }

      console.log(`✅ 项目加载完成: ${projectConfig.name}`, {
        stages: loadedStages,
        mediaCount: mediaItems?.length || 0
      })

      return result
    } catch (error) {
      console.error(`❌ 加载项目 ${projectId} 失败:`, error)
      return null
    }
  }

  /**
   * 加载项目内容（不包含设置预加载，专注于媒体和时间轴数据）
   * @param projectId 项目ID
   * @param preloadedSettings 可选的预加载设置，避免重复读取
   * @param options 加载选项
   * @returns 项目加载结果
   */
  async loadProjectContent(
    projectId: string,
    preloadedSettings?: ProjectConfig['settings'],
    options: LoadProjectOptions = {}
  ): Promise<ProjectLoadResult | null> {
    const {
      loadMedia = true,
      loadTimeline = true,
      onProgress
    } = options

    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      console.log(`📂 [Content Load] 开始加载项目内容: ${projectId}`)
      const loadedStages: string[] = []

      // 阶段1: 加载项目配置 (如果没有预加载设置则需要加载)
      let projectConfig: ProjectConfig

      if (preloadedSettings) {
        console.log(`🔧 [Content Load] 使用预加载的设置，跳过配置文件读取`)
        onProgress?.('使用预加载设置...', 10)

        // 仍需要读取完整配置以获取其他数据，但设置部分使用预加载的
        const projectsHandle = await workspaceHandle.getDirectoryHandle(this.PROJECTS_FOLDER)
        const projectHandle = await projectsHandle.getDirectoryHandle(projectId)
        const fullConfig = await this.loadProjectConfig(projectHandle)

        if (!fullConfig) {
          throw new Error('项目配置加载失败')
        }

        // 使用预加载的设置覆盖文件中的设置
        projectConfig = {
          ...fullConfig,
          settings: preloadedSettings
        }
      } else {
        console.log(`📂 [Content Load] 加载完整项目配置...`)
        onProgress?.('加载项目配置...', 10)

        const projectsHandle = await workspaceHandle.getDirectoryHandle(this.PROJECTS_FOLDER)
        const projectHandle = await projectsHandle.getDirectoryHandle(projectId)
        const fullConfig = await this.loadProjectConfig(projectHandle)

        if (!fullConfig) {
          throw new Error('项目配置加载失败')
        }

        projectConfig = fullConfig
      }

      loadedStages.push('config-loaded')
      console.log(`✅ [Content Load] 项目配置处理完成: ${projectConfig.name}`)

      // 阶段2: 加载媒体文件 (20% -> 80%)
      let mediaItems: MediaItem[] | undefined

      if (loadMedia && projectConfig.mediaReferences && Object.keys(projectConfig.mediaReferences).length > 0) {
        onProgress?.('加载媒体文件...', 30)

        console.log(`📁 [Content Load] 开始加载媒体文件: ${Object.keys(projectConfig.mediaReferences).length}个文件`)

        try {
          mediaItems = await mediaManager.loadAllMediaForProject(
            projectId,
            projectConfig.mediaReferences,
            {
              batchSize: 10,
              onProgress: (loaded, total) => {
                // 将媒体加载进度映射到30%-80%范围
                const mediaProgress = 30 + (loaded / total) * 50
                onProgress?.(`加载媒体文件 ${loaded}/${total}...`, mediaProgress)
              }
            }
          )

          loadedStages.push('media-loaded')
          console.log(`✅ [Content Load] 媒体文件加载完成: ${mediaItems.length}个文件`)
        } catch (error) {
          console.error('❌ [Content Load] 媒体文件加载失败:', error)
          // 媒体加载失败不应该阻止项目加载，继续后续流程
          mediaItems = []
        }
      }

      // 阶段3: 加载时间轴数据 (80% -> 95%)
      let timelineItems: TimelineItemData[] | undefined
      let tracks: Track[] | undefined

      if (loadTimeline && projectConfig.timeline) {
        onProgress?.('加载时间轴数据...', 85)

        tracks = projectConfig.timeline.tracks || []
        console.log(`📋 [Content Load] 加载轨道数据: ${tracks.length}个轨道`)

        timelineItems = projectConfig.timeline.timelineItems || []
        console.log(`⏰ [Content Load] 加载时间轴项目数据: ${timelineItems.length}个项目`)

        onProgress?.('时间轴数据加载完成...', 95)
        loadedStages.push('timeline-loaded')
        console.log(`✅ [Content Load] 时间轴数据加载完成: ${tracks.length}个轨道, ${timelineItems.length}个项目`)
      }

      // 阶段4: 完成加载 (95% -> 100%)
      onProgress?.('内容加载完成', 100)
      loadedStages.push('complete')

      const result: ProjectLoadResult = {
        projectConfig,
        mediaItems,
        timelineItems,
        tracks,
        loadedStages
      }

      console.log(`✅ [Content Load] 项目内容加载完成: ${projectConfig.name}`, {
        loadedStages,
        mediaItemsCount: mediaItems?.length || 0,
        timelineItemsCount: timelineItems?.length || 0,
        tracksCount: tracks?.length || 0
      })

      return result
    } catch (error) {
      console.error(`❌ [Content Load] 加载项目内容失败: ${projectId}`, error)
      throw error
    }
  }

  /**
   * 保存项目
   */
  async saveProject(projectConfig: ProjectConfig): Promise<void> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      const projectsHandle = await workspaceHandle.getDirectoryHandle(this.PROJECTS_FOLDER)
      const projectHandle = await projectsHandle.getDirectoryHandle(projectConfig.id)
      
      // 更新时间戳
      projectConfig.updatedAt = new Date().toISOString()
      
      await this.saveProjectConfig(projectHandle, projectConfig)
      console.log('项目保存成功:', projectConfig.name)
    } catch (error) {
      console.error('保存项目失败:', error)
      throw error
    }
  }

  /**
   * 删除项目
   */
  async deleteProject(projectId: string): Promise<void> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      const projectsHandle = await workspaceHandle.getDirectoryHandle(this.PROJECTS_FOLDER)
      await projectsHandle.removeEntry(projectId, { recursive: true })
      console.log('项目删除成功:', projectId)
    } catch (error) {
      console.error('删除项目失败:', error)
      throw error
    }
  }

  /**
   * 获取或创建projects文件夹
   */
  private async getOrCreateProjectsFolder(workspaceHandle: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
    try {
      return await workspaceHandle.getDirectoryHandle(this.PROJECTS_FOLDER)
    } catch (error) {
      // 文件夹不存在，创建它
      return await workspaceHandle.getDirectoryHandle(this.PROJECTS_FOLDER, { create: true })
    }
  }

  /**
   * 从项目文件夹加载配置
   */
  private async loadProjectConfig(projectHandle: FileSystemDirectoryHandle): Promise<ProjectConfig | null> {
    try {
      const configFileHandle = await projectHandle.getFileHandle('project.json')
      const configFile = await configFileHandle.getFile()
      const configText = await configFile.text()
      
      return JSON.parse(configText) as ProjectConfig
    } catch (error) {
      console.warn('加载项目配置失败:', error)
      return null
    }
  }

  /**
   * 保存项目配置到文件
   */
  private async saveProjectConfig(projectHandle: FileSystemDirectoryHandle, config: ProjectConfig): Promise<void> {
    const configFileHandle = await projectHandle.getFileHandle('project.json', { create: true })
    const writable = await configFileHandle.createWritable()
    
    await writable.write(JSON.stringify(config, null, 2))
    await writable.close()
  }
}

// 导出单例实例
export const projectManager = ProjectManager.getInstance()

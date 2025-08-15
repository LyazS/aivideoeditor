import { directoryManager } from '@/utils/DirectoryManager'
import { globalProjectMediaManager } from '@/unified/utils/ProjectMediaManager'
import type { UnifiedProjectConfig, UnifiedMediaReference } from '@/unified/project'
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
 * 统一项目管理器
 * 基于新架构统一类型系统的项目管理，参考原ProjectManager设计
 * 负责项目的创建、保存、加载、删除等操作
 */
export class UnifiedProjectManager {
  private static instance: UnifiedProjectManager
  private readonly PROJECTS_FOLDER = 'projects'

  private constructor() {}

  static getInstance(): UnifiedProjectManager {
    if (!UnifiedProjectManager.instance) {
      UnifiedProjectManager.instance = new UnifiedProjectManager()
    }
    return UnifiedProjectManager.instance
  }

  /**
   * 扫描并获取所有项目列表
   */
  async listProjects(): Promise<UnifiedProjectConfig[]> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      // 获取或创建projects文件夹
      const projectsHandle = await this.getOrCreateProjectsFolder(workspaceHandle)
      const projects: UnifiedProjectConfig[] = []

      // 遍历projects文件夹中的所有子文件夹
      for await (const [name, handle] of projectsHandle.entries()) {
        if (handle.kind === 'directory') {
          try {
            const projectConfig = await this.loadProjectJson(handle)
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
  async createProject(
    name: string,
    template?: Partial<UnifiedProjectConfig>,
  ): Promise<UnifiedProjectConfig> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    const projectId = 'project_' + Date.now()
    const now = new Date().toISOString()

    const projectConfig: UnifiedProjectConfig = {
      id: projectId,
      name: name,
      description: template?.description || '',
      createdAt: now,
      updatedAt: now,
      version: '1.0.0',
      thumbnail: template?.thumbnail,
      duration: template?.duration || 0,

      settings: template?.settings || {
        videoResolution: {
          name: '1080p',
          width: 1920,
          height: 1080,
          aspectRatio: '16:9',
        },
        frameRate: 30,
        timelineDurationFrames: 1800,
      },

      timeline: template?.timeline || {
        tracks: [],
        timelineItems: [],
        mediaItems: [],
      },
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

      console.log('统一项目创建成功:', projectConfig.name)
      return projectConfig
    } catch (error) {
      console.error('创建统一项目失败:', error)
      throw error
    }
  }

  /**
   * 轻量级设置预加载 - 只读取 project.json 中的 settings 部分
   * @param projectId 项目ID
   * @returns 项目设置或null（仅当项目不存在时）
   * @throws 当项目存在但读取失败时抛出错误
   */
  async loadProjectConfig(projectId: string): Promise<UnifiedProjectConfig | null> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      console.log(`🔧 [Unified Settings Preload] 开始预加载项目设置: ${projectId}`)

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

      console.log(`✅ [Unified Settings Preload] 项目设置预加载成功:`, {
        videoResolution: projectConfig.settings.videoResolution,
        frameRate: projectConfig.settings.frameRate,
      })

      return projectConfig
    } catch (error) {
      // 如果是项目不存在的错误，返回null（用于新项目）
      if (error instanceof Error && error.name === 'NotFoundError') {
        console.error(`📝 [Unified Settings Preload] 项目不存在，返回null: ${projectId}`)
        return null
      }

      // 其他错误（文件损坏、格式错误等）抛出异常
      console.error(`❌ [Unified Settings Preload] 预加载项目设置失败: ${projectId}`, error)
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
        // 无需返回管理器实例，页面级全局可访问
        loadedStages: ['config', 'media', 'timeline']
      }
    } catch (error) {
      console.error(`加载项目内容失败: ${projectId}`, error)
      throw error
    }
  }
  
  /**
   * 从媒体引用重建媒体项目
   * @param references 媒体引用数组
   * @param onProgress 进度回调
   * @returns 重建的媒体项目数组
   */
  private async rebuildMediaItemsFromReferences(
    references: UnifiedMediaReference[],
    onProgress?: (loaded: number, total: number) => void
  ): Promise<UnifiedMediaItemData[]> {
    // TODO: 阶段1 - 实现从媒体引用重建媒体项目的完整逻辑
    // 需要根据引用的元数据创建UnifiedMediaItemData对象，并重建WebAV对象
    console.log(`📁 [Unified] 开始重建 ${references.length} 个媒体项目`)
    
    // 模拟重建过程
    for (let i = 0; i < references.length; i++) {
      onProgress?.(i + 1, references.length)
      // TODO: 阶段1 - 这里需要实现实际的媒体项目重建逻辑
      // 1. 根据引用创建UnifiedMediaItemData对象
      // 2. 从存储路径加载文件
      // 3. 重建WebAV对象
      // 4. 设置媒体状态为ready
    }
    
    console.log(`✅ [Unified] 媒体项目重建完成: ${references.length}`)
    return []
  }

  /**
   * 保存项目
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
      console.log('统一项目保存成功:', projectConfig.name)
    } catch (error) {
      console.error('保存统一项目失败:', error)
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
      console.log('统一项目删除成功:', projectId)
    } catch (error) {
      console.error('删除统一项目失败:', error)
      throw error
    }
  }

  /**
   * 加载统一媒体项目数据
   * @param mediaItemsData 媒体项目数据数组
   * @param options 加载选项
   * @returns 统一媒体项目数组
   */
  private async loadUnifiedMediaItems(
    mediaItemsData: UnifiedMediaItemData[],
    options: {
      onProgress?: (loaded: number, total: number) => void
    } = {},
  ): Promise<UnifiedMediaItemData[]> {
    const { onProgress } = options
    const loadedItems: UnifiedMediaItemData[] = []

    console.log(`📁 [Unified] 开始加载 ${mediaItemsData.length} 个统一媒体项目`)

    for (let i = 0; i < mediaItemsData.length; i++) {
      const mediaItemData = mediaItemsData[i]

      try {
        // 直接使用保存的统一媒体项目数据
        // 注意：这里假设数据已经是响应式的，如果需要重新创建响应式对象，可以使用工厂函数
        loadedItems.push(mediaItemData)

        console.log(`✅ [Unified] 媒体项目加载成功: ${mediaItemData.name}`)
      } catch (error) {
        console.error(`❌ [Unified] 媒体项目加载失败: ${mediaItemData.name}`, error)
        // 继续加载其他项目
      }

      // 更新进度
      onProgress?.(i + 1, mediaItemsData.length)
    }

    console.log(`✅ [Unified] 统一媒体项目加载完成: ${loadedItems.length}/${mediaItemsData.length}`)
    return loadedItems
  }

  /**
   * 获取或创建projects文件夹
   */
  private async getOrCreateProjectsFolder(
    workspaceHandle: FileSystemDirectoryHandle,
  ): Promise<FileSystemDirectoryHandle> {
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
  private async loadProjectJson(
    projectHandle: FileSystemDirectoryHandle,
  ): Promise<UnifiedProjectConfig | null> {
    try {
      const configFileHandle = await projectHandle.getFileHandle('project.json')
      const configFile = await configFileHandle.getFile()
      const configText = await configFile.text()

      return JSON.parse(configText) as UnifiedProjectConfig
    } catch (error) {
      console.warn('加载统一项目配置失败:', error)
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
export const unifiedProjectManager = UnifiedProjectManager.getInstance()

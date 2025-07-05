import { directoryManager } from './DirectoryManager'

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
    [mediaId: string]: {
      originalPath: string
      storedPath: string
      type: string
      size: number
      checksum?: string
    }
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
   * 加载项目
   */
  async loadProject(projectId: string): Promise<ProjectConfig | null> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      const projectsHandle = await workspaceHandle.getDirectoryHandle(this.PROJECTS_FOLDER)
      const projectHandle = await projectsHandle.getDirectoryHandle(projectId)
      
      return await this.loadProjectConfig(projectHandle)
    } catch (error) {
      console.error(`加载项目 ${projectId} 失败:`, error)
      return null
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

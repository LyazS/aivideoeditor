import { directoryManager } from '@/utils/DirectoryManager'
import type { UnifiedProjectConfig } from '@/unified/project'

/**
 * 统一项目管理器
 * 专注于多项目管理：项目列表、创建、删除等操作
 * 不涉及单个项目的编辑操作（由UnifiedProjectModule处理）
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

      const mediaHandle = await projectHandle.getDirectoryHandle('media')
      await mediaHandle.getDirectoryHandle('videos', { create: true })
      await mediaHandle.getDirectoryHandle('images', { create: true })
      await mediaHandle.getDirectoryHandle('audios', { create: true })
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

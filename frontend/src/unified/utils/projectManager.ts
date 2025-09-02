import { directoryManager } from '@/unified/utils/DirectoryManager'
import type { UnifiedProjectConfig, UnifiedProjectContent } from '@/unified/project'
import { createUnifiedTrackData } from '@/unified/track'
import type { UnifiedTrackData } from '@/unified/track'

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
   * 创建默认轨道
   */
  private createDefaultTracks(): UnifiedTrackData[] {
    const videoTrack = createUnifiedTrackData('video')
    const audioTrack = createUnifiedTrackData('audio')
    const textTrack = createUnifiedTrackData('text')

    return [videoTrack, audioTrack, textTrack]
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

    // 创建默认轨道
    const defaultTracks = this.createDefaultTracks()

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
    }

    // 创建项目内容数据（拆分出来的timeline数据）
    const projectContent: UnifiedProjectContent = {
      tracks: defaultTracks,
      timelineItems: [],
      mediaItems: [],
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

      // 分别保存项目配置文件和内容文件
      await this.saveProjectConfigFile(projectHandle, projectConfig)
      await this.saveProjectContentFile(projectHandle, projectContent)

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
   * 保存项目配置（只保存project.json）
   */
  async saveProjectConfig(projectConfig: UnifiedProjectConfig, updatedAt?: string): Promise<void> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      const projectsHandle = await workspaceHandle.getDirectoryHandle(this.PROJECTS_FOLDER)
      const projectHandle = await projectsHandle.getDirectoryHandle(projectConfig.id)

      // 使用外部传入的时间戳，或者生成新的时间戳
      projectConfig.updatedAt = updatedAt || new Date().toISOString()

      await this.saveProjectConfigFile(projectHandle, projectConfig)
      console.log('统一项目配置保存成功:', projectConfig.name)
    } catch (error) {
      console.error('保存统一项目配置失败:', error)
      throw error
    }
  }

  /**
   * 保存项目内容（只保存content.json）
   */
  async saveProjectContent(projectId: string, projectContent: UnifiedProjectContent): Promise<void> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      const projectsHandle = await workspaceHandle.getDirectoryHandle(this.PROJECTS_FOLDER)
      const projectHandle = await projectsHandle.getDirectoryHandle(projectId)

      await this.saveProjectContentFile(projectHandle, projectContent)
      console.log('统一项目内容保存成功:', projectId)
    } catch (error) {
      console.error('保存统一项目内容失败:', error)
      throw error
    }
  }

  /**
   * 保存完整项目（配置+内容）
   */
  async saveProject(projectConfig: UnifiedProjectConfig, projectContent: UnifiedProjectContent): Promise<void> {
    try {
      // 更新时间戳
      projectConfig.updatedAt = new Date().toISOString()

      // 并行保存配置和内容
      await Promise.all([
        this.saveProjectConfig(projectConfig),
        this.saveProjectContent(projectConfig.id, projectContent)
      ])

      console.log('统一项目保存成功:', projectConfig.name)
    } catch (error) {
      console.error('保存统一项目失败:', error)
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
  private async saveProjectConfigFile(
    projectHandle: FileSystemDirectoryHandle,
    config: UnifiedProjectConfig,
  ): Promise<void> {
    const configFileHandle = await projectHandle.getFileHandle('project.json', { create: true })
    const writable = await configFileHandle.createWritable()

    await writable.write(JSON.stringify(config, null, 2))
    await writable.close()
  }

  /**
   * 保存项目内容到文件
   */
  private async saveProjectContentFile(
    projectHandle: FileSystemDirectoryHandle,
    content: UnifiedProjectContent,
  ): Promise<void> {
    const contentFileHandle = await projectHandle.getFileHandle('content.json', { create: true })
    const writable = await contentFileHandle.createWritable()

    await writable.write(JSON.stringify(content, null, 2))
    await writable.close()
  }
}

// 导出单例实例
export const unifiedProjectManager = UnifiedProjectManager.getInstance()

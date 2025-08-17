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

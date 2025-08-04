import { directoryManager } from './DirectoryManager'
import type { Raw } from 'vue'
import type { MP4Clip, ImgClip, AudioClip } from '@webav/av-cliper'
import type {
  MediaType,
  LocalMediaItem,
  MediaMetadata,
  LocalMediaReference,
  MediaErrorType,
} from '../types'

/**
 * 媒体文件管理器
 * 负责媒体文件的导入、存储、管理和元数据处理
 */
export class MediaManager {
  private static instance: MediaManager
  private readonly MEDIA_FOLDER = 'media'
  private readonly VIDEOS_FOLDER = 'videos'
  private readonly IMAGES_FOLDER = 'images'
  private readonly AUDIO_FOLDER = 'audio'

  private constructor() {}

  static getInstance(): MediaManager {
    if (!MediaManager.instance) {
      MediaManager.instance = new MediaManager()
    }
    return MediaManager.instance
  }

  /**
   * 保存媒体文件到项目目录
   * @param file 媒体文件
   * @param projectId 项目ID
   * @param mediaType 媒体类型
   * @returns 保存的文件路径（相对于项目目录）
   */
  async saveMediaToProject(file: File, projectId: string, mediaType: MediaType): Promise<string> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      // 获取项目目录
      const projectsHandle = await workspaceHandle.getDirectoryHandle('projects')
      const projectHandle = await projectsHandle.getDirectoryHandle(projectId)

      // 确保media目录存在
      const mediaHandle = await this.ensureDirectoryExists(projectHandle, this.MEDIA_FOLDER)

      // 根据媒体类型确定子目录
      let subFolder: string
      switch (mediaType) {
        case 'video':
          subFolder = this.VIDEOS_FOLDER
          break
        case 'image':
          subFolder = this.IMAGES_FOLDER
          break
        case 'audio':
          subFolder = this.AUDIO_FOLDER
          break
        default:
          throw new Error(`不支持的媒体类型: ${mediaType}`)
      }

      // 确保子目录存在
      const subHandle = await this.ensureDirectoryExists(mediaHandle, subFolder)

      // 生成唯一文件名（避免冲突）
      const timestamp = Date.now()
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const fileExtension = this.getFileExtension(file.name)
      const uniqueFileName = `${timestamp}_${randomSuffix}${fileExtension}`

      // 保存文件
      const fileHandle = await subHandle.getFileHandle(uniqueFileName, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(file)
      await writable.close()

      // 返回相对路径
      const relativePath = `${this.MEDIA_FOLDER}/${subFolder}/${uniqueFileName}`
      console.log(`✅ 媒体文件已保存: ${relativePath}`)

      return relativePath
    } catch (error) {
      console.error('保存媒体文件失败:', error)
      throw error
    }
  }

  /**
   * 生成媒体元数据
   * @param file 原始文件
   * @param clip WebAV Clip对象
   * @param mediaType 媒体类型
   * @returns 媒体元数据
   */
  async generateMediaMetadata(
    file: File,
    clip: Raw<MP4Clip> | Raw<ImgClip> | Raw<AudioClip>,
    mediaType: MediaType,
  ): Promise<MediaMetadata> {
    try {
      // 计算文件校验和
      const checksum = await this.calculateChecksum(file)

      // 等待clip准备完成
      const meta = await clip.ready

      // 确定clip类型
      let clipType: 'MP4Clip' | 'ImgClip' | 'AudioClip'
      switch (mediaType) {
        case 'video':
          clipType = 'MP4Clip'
          break
        case 'image':
          clipType = 'ImgClip'
          break
        case 'audio':
          clipType = 'AudioClip'
          break
        default:
          throw new Error(`不支持的媒体类型: ${mediaType}`)
      }

      // 构建元数据
      const metadata: MediaMetadata = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        originalFileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        checksum,
        clipType,
        importedAt: new Date().toISOString(),
      }

      // 根据媒体类型添加特定元数据
      if (mediaType === 'video' || mediaType === 'audio') {
        metadata.duration = meta.duration // WebAV返回的是微秒
      }

      if (mediaType === 'video' || mediaType === 'image') {
        metadata.width = meta.width
        metadata.height = meta.height
      }

      console.log(`📊 生成媒体元数据: ${file.name}`, metadata)
      return metadata
    } catch (error) {
      console.error('生成媒体元数据失败:', error)
      throw error
    }
  }

  /**
   * 保存媒体元数据文件
   * @param projectId 项目ID
   * @param storedPath 媒体文件存储路径
   * @param metadata 元数据
   */
  async saveMediaMetadata(
    projectId: string,
    storedPath: string,
    metadata: MediaMetadata,
  ): Promise<void> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      // 获取项目目录
      const projectsHandle = await workspaceHandle.getDirectoryHandle('projects')
      const projectHandle = await projectsHandle.getDirectoryHandle(projectId)

      // 构建.meta文件路径
      const metaPath = storedPath + '.meta'
      const pathParts = metaPath.split('/')

      // 逐级获取目录句柄
      let currentHandle: FileSystemDirectoryHandle = projectHandle
      for (let i = 0; i < pathParts.length - 1; i++) {
        currentHandle = await currentHandle.getDirectoryHandle(pathParts[i])
      }

      // 保存.meta文件
      const metaFileName = pathParts[pathParts.length - 1]
      const metaFileHandle = await currentHandle.getFileHandle(metaFileName, { create: true })
      const writable = await metaFileHandle.createWritable()
      await writable.write(JSON.stringify(metadata, null, 2))
      await writable.close()

      console.log(`✅ 元数据文件已保存: ${metaPath}`)
    } catch (error) {
      console.error('保存元数据文件失败:', error)
      throw error
    }
  }

  /**
   * 计算文件SHA-256校验和
   * @param file 文件
   * @returns 校验和字符串
   */
  async calculateChecksum(file: File): Promise<string> {
    try {
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    } catch (error) {
      console.error('计算文件校验和失败:', error)
      throw error
    }
  }

  /**
   * 验证媒体文件完整性
   * @param projectId 项目ID
   * @param storedPath 存储路径
   * @param expectedChecksum 期望的校验和
   * @returns 是否完整
   */
  async verifyMediaIntegrity(
    projectId: string,
    storedPath: string,
    expectedChecksum: string,
  ): Promise<boolean> {
    try {
      const file = await this.loadMediaFromProject(projectId, storedPath)
      const actualChecksum = await this.calculateChecksum(file)
      return actualChecksum === expectedChecksum
    } catch (error) {
      console.error('验证媒体文件完整性失败:', error)
      return false
    }
  }

  /**
   * 从项目目录加载媒体文件
   * @param projectId 项目ID
   * @param storedPath 存储路径
   * @returns 文件对象
   */
  async loadMediaFromProject(projectId: string, storedPath: string): Promise<File> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      // 获取项目目录
      const projectsHandle = await workspaceHandle.getDirectoryHandle('projects')
      const projectHandle = await projectsHandle.getDirectoryHandle(projectId)

      // 解析路径并获取文件
      const pathParts = storedPath.split('/')
      let currentHandle: FileSystemDirectoryHandle = projectHandle

      for (let i = 0; i < pathParts.length - 1; i++) {
        currentHandle = await currentHandle.getDirectoryHandle(pathParts[i])
      }

      const fileName = pathParts[pathParts.length - 1]
      const fileHandle = await currentHandle.getFileHandle(fileName)
      const file = await fileHandle.getFile()

      console.log(`✅ 媒体文件已加载: ${storedPath}`)
      return file
    } catch (error) {
      console.error('加载媒体文件失败:', error)
      throw error
    }
  }

  /**
   * 确保目录存在，如果不存在则创建
   * @param parentHandle 父目录句柄
   * @param dirName 目录名
   * @returns 目录句柄
   */
  private async ensureDirectoryExists(
    parentHandle: FileSystemDirectoryHandle,
    dirName: string,
  ): Promise<FileSystemDirectoryHandle> {
    try {
      return await parentHandle.getDirectoryHandle(dirName)
    } catch (error) {
      // 目录不存在，创建它
      return await parentHandle.getDirectoryHandle(dirName, { create: true })
    }
  }

  /**
   * 加载媒体元数据文件
   * @param projectId 项目ID
   * @param storedPath 媒体文件存储路径
   * @returns 元数据对象
   */
  async loadMediaMetadata(projectId: string, storedPath: string): Promise<MediaMetadata> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      // 获取项目目录
      const projectsHandle = await workspaceHandle.getDirectoryHandle('projects')
      const projectHandle = await projectsHandle.getDirectoryHandle(projectId)

      // 构建.meta文件路径
      const metaPath = storedPath + '.meta'
      const pathParts = metaPath.split('/')

      // 逐级获取目录句柄
      let currentHandle: FileSystemDirectoryHandle = projectHandle
      for (let i = 0; i < pathParts.length - 1; i++) {
        currentHandle = await currentHandle.getDirectoryHandle(pathParts[i])
      }

      // 读取.meta文件
      const metaFileName = pathParts[pathParts.length - 1]
      const metaFileHandle = await currentHandle.getFileHandle(metaFileName)
      const metaFile = await metaFileHandle.getFile()
      const metaContent = await metaFile.text()

      const metadata = JSON.parse(metaContent) as MediaMetadata
      console.log(`✅ 元数据文件已加载: ${metaPath}`)

      return metadata
    } catch (error) {
      console.error('加载元数据文件失败:', error)
      throw error
    }
  }

  /**
   * 导入媒体文件并生成.meta文件
   * @param file 文件对象
   * @param clip WebAV Clip对象
   * @param projectId 项目ID
   * @param mediaType 媒体类型
   * @returns 媒体引用对象
   */
  async importMediaFiles(
    file: File,
    clip: Raw<MP4Clip> | Raw<ImgClip> | Raw<AudioClip>,
    projectId: string,
    mediaType: MediaType,
  ): Promise<LocalMediaReference> {
    try {
      console.log(`📁 开始导入媒体文件: ${file.name}`)

      // 1. 保存媒体文件到项目目录
      const storedPath = await this.saveMediaToProject(file, projectId, mediaType)

      // 2. 生成媒体元数据
      const metadata = await this.generateMediaMetadata(file, clip, mediaType)

      // 3. 保存元数据文件
      await this.saveMediaMetadata(projectId, storedPath, metadata)

      // 4. 创建媒体引用
      const mediaReference: LocalMediaReference = {
        originalFileName: file.name,
        storedPath,
        type: mediaType,
        fileSize: file.size,
        checksum: metadata.checksum,
      }

      console.log(`✅ 媒体文件导入完成: ${file.name}`)
      return mediaReference
    } catch (error) {
      console.error('导入媒体文件失败:', error)
      throw error
    }
  }

  /**
   * 获取文件扩展名
   * @param fileName 文件名
   * @returns 扩展名（包含点号）
   */
  private getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.')
    return lastDotIndex > -1 ? fileName.substring(lastDotIndex) : ''
  }

  /**
   * 生成音频默认图标
   * @returns 音频默认图标的Data URL
   */
  private generateAudioDefaultIcon(): string {
    // 生成音频默认图标 - 使用纯SVG图形
    const svg = `<svg width="60" height="40" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="40" fill="#4CAF50" rx="4"/><g fill="white" transform="translate(30, 20)"><circle cx="-6" cy="8" r="3"/><circle cx="6" cy="6" r="3"/><rect x="-3" y="-2" width="1.5" height="10"/><rect x="9" y="-4" width="1.5" height="10"/><path d="M -1.5 -2 Q 6 -6 10.5 -4 L 10.5 -2 Q 6 -4 -1.5 0 Z"/></g></svg>`
    return `data:image/svg+xml;base64,${btoa(svg)}`
  }

  // ==================== WebAV Clip重建机制 ====================

  /**
   * 从本地文件重建WebAV Clip对象
   * 遵循"从源头重建"原则，每次都从原始文件重新创建
   * @param file 本地文件对象
   * @param mediaType 媒体类型
   * @returns 重建的WebAV Clip对象
   */
  async rebuildWebAVClip(
    file: File,
    mediaType: MediaType,
  ): Promise<Raw<MP4Clip> | Raw<ImgClip> | Raw<AudioClip>> {
    try {
      console.log(`🔄 开始从源头重建WebAV Clip: ${file.name} (${mediaType})`)

      // 动态导入videoStore以避免循环依赖
      const { useVideoStore } = await import('../stores/videoStore')
      const videoStore = useVideoStore()

      let clip: Raw<MP4Clip> | Raw<ImgClip> | Raw<AudioClip>

      switch (mediaType) {
        case 'video':
          clip = await videoStore.createMP4Clip(file)
          break
        case 'image':
          clip = await videoStore.createImgClip(file)
          break
        case 'audio':
          clip = await videoStore.createAudioClip(file)
          break
        default:
          throw new Error(`不支持的媒体类型: ${mediaType}`)
      }

      console.log(`✅ WebAV Clip重建成功: ${file.name}`)
      return clip
    } catch (error) {
      console.error(`❌ WebAV Clip重建失败: ${file.name}`, error)
      throw error
    }
  }

  /**
   * 从本地重建完整的LocalMediaItem对象
   * @param mediaId 媒体ID
   * @param reference 媒体引用信息
   * @param projectId 项目ID
   * @returns 重建的LocalMediaItem对象
   */
  async rebuildMediaItemFromLocal(
    mediaId: string,
    reference: LocalMediaReference,
    projectId: string,
  ): Promise<LocalMediaItem> {
    try {
      console.log(`🔄 开始重建LocalMediaItem: ${reference.originalFileName}`)

      // 1. 加载本地文件
      const localFile = await this.loadMediaFromProject(projectId, reference.storedPath)

      // 2. 验证文件完整性
      const currentChecksum = await this.calculateChecksum(localFile)
      if (currentChecksum !== reference.checksum) {
        throw new Error(`文件完整性校验失败: ${reference.originalFileName}`)
      }

      // 3. 重建WebAV Clip（从源头重建）
      const clip = await this.rebuildWebAVClip(localFile, reference.type)

      // 4. 等待clip准备完成并获取元数据
      const clipMeta = await clip.ready

      // 5. 计算时长（帧数）
      let durationFrames: number
      if (reference.type === 'video' || reference.type === 'audio') {
        // 视频和音频：从clip元数据获取时长并转换为帧数
        const durationSeconds = clipMeta.duration / 1_000_000 // 微秒转秒
        durationFrames = Math.round(durationSeconds * 30) // 假设30fps
      } else {
        // 图片：固定5秒（150帧@30fps）
        durationFrames = 150
      }

      // 6. 生成缩略图
      let thumbnailUrl: string | undefined
      if (reference.type === 'audio') {
        // 音频使用默认图标
        console.log(`🎵 生成音频默认图标: ${reference.originalFileName}`)
        thumbnailUrl = this.generateAudioDefaultIcon()
        console.log(`✅ 音频默认图标生成成功: ${reference.originalFileName}`)
      } else {
        // 视频和图片生成实际缩略图
        try {
          console.log(`🖼️ 生成缩略图: ${reference.originalFileName}`)

          // 动态导入缩略图生成器以避免循环依赖
          const { generateThumbnailForMediaItem } = await import('./thumbnailGenerator')

          thumbnailUrl = await generateThumbnailForMediaItem({
            mediaType: reference.type,
            mp4Clip: reference.type === 'video' ? (clip as Raw<MP4Clip>) : null,
            imgClip: reference.type === 'image' ? (clip as Raw<ImgClip>) : null,
          })

          if (thumbnailUrl) {
            console.log(`✅ 缩略图生成成功: ${reference.originalFileName}`)
          } else {
            console.warn(`⚠️ 缩略图生成失败: ${reference.originalFileName}`)
          }
        } catch (error) {
          console.error(`❌ 缩略图生成错误: ${reference.originalFileName}`, error)
          thumbnailUrl = undefined
        }
      }

      // 7. 创建完整的LocalMediaItem对象
      const mediaItem: LocalMediaItem = {
        id: mediaId,
        name: reference.originalFileName,
        createdAt: new Date().toISOString(),
        file: localFile,
        url: URL.createObjectURL(localFile),
        duration: durationFrames,
        type: localFile.type,
        mediaType: reference.type,
        mp4Clip: reference.type === 'video' ? (clip as Raw<MP4Clip>) : null,
        imgClip: reference.type === 'image' ? (clip as Raw<ImgClip>) : null,
        audioClip: reference.type === 'audio' ? (clip as Raw<AudioClip>) : null,
        status: 'ready',
        thumbnailUrl,
      }

      console.log(`✅ LocalMediaItem重建成功: ${reference.originalFileName}`, {
        id: mediaId,
        type: reference.type,
        duration: `${durationFrames}帧`,
        fileSize: `${(localFile.size / 1024 / 1024).toFixed(2)}MB`,
      })

      return mediaItem
    } catch (error) {
      console.error(`❌ LocalMediaItem重建失败: ${reference.originalFileName}`, error)
      throw error
    }
  }

  /**
   * 保存错误状态媒体引用
   * @param mediaId 媒体ID
   * @param file 原始文件对象
   * @param projectId 项目ID
   * @param mediaType 媒体类型
   * @param errorType 错误类型
   * @param errorMessage 错误信息
   * @returns 错误状态的媒体引用
   */
  async saveErrorMediaReference(
    mediaId: string,
    file: File,
    projectId: string,
    mediaType: MediaType,
    errorType: MediaErrorType,
    errorMessage: string,
  ): Promise<LocalMediaReference> {
    try {
      console.log(`💾 开始保存错误状态媒体引用: ${file.name}`)

      // 创建错误状态的媒体引用
      const errorReference: LocalMediaReference = {
        originalFileName: file.name,
        storedPath: '', // 错误状态没有实际存储路径
        type: mediaType,
        fileSize: file.size,
        checksum: '', // 错误状态没有文件校验和
        status: 'error',
        errorType,
        errorMessage,
        errorTimestamp: new Date().toISOString(),
        originalFile: {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        },
      }

      console.log(`✅ 错误状态媒体引用创建完成: ${file.name}`)
      return errorReference
    } catch (error) {
      console.error('保存错误状态媒体引用失败:', error)
      throw error
    }
  }

  /**
   * 删除本地媒体文件和元数据
   * @param projectId 项目ID
   * @param mediaReference 媒体引用信息
   */
  async deleteMediaFromProject(
    projectId: string,
    mediaReference: LocalMediaReference,
  ): Promise<void> {
    const workspaceHandle = await directoryManager.getWorkspaceHandle()
    if (!workspaceHandle) {
      throw new Error('未设置工作目录')
    }

    try {
      console.log(`🗑️ 开始删除本地媒体文件: ${mediaReference.originalFileName}`)

      // 获取项目目录
      const projectsHandle = await workspaceHandle.getDirectoryHandle('projects')
      const projectHandle = await projectsHandle.getDirectoryHandle(projectId)

      // 解析文件路径
      const pathParts = mediaReference.storedPath.split('/')
      let currentHandle: FileSystemDirectoryHandle = projectHandle

      // 导航到文件所在目录
      for (let i = 0; i < pathParts.length - 1; i++) {
        currentHandle = await currentHandle.getDirectoryHandle(pathParts[i])
      }

      const fileName = pathParts[pathParts.length - 1]

      // 删除媒体文件
      try {
        await currentHandle.removeEntry(fileName)
        console.log(`✅ 媒体文件已删除: ${mediaReference.storedPath}`)
      } catch (error) {
        console.warn(`⚠️ 删除媒体文件失败: ${mediaReference.storedPath}`, error)
        // 文件可能已经不存在，继续删除元数据
      }

      // 删除元数据文件
      const metaFileName = `${fileName}.meta`
      try {
        await currentHandle.removeEntry(metaFileName)
        console.log(`✅ 元数据文件已删除: ${mediaReference.storedPath}.meta`)
      } catch (error) {
        console.warn(`⚠️ 删除元数据文件失败: ${mediaReference.storedPath}.meta`, error)
      }

      console.log(`✅ 本地媒体文件删除完成: ${mediaReference.originalFileName}`)
    } catch (error) {
      console.error(`❌ 删除本地媒体文件失败: ${mediaReference.originalFileName}`, error)
      throw error
    }
  }

  /**
   * 恢复错误状态的媒体项
   * @param mediaId 媒体ID
   * @param reference 错误状态的媒体引用
   * @returns 错误状态的LocalMediaItem
   */
  private restoreErrorMediaItem(mediaId: string, reference: LocalMediaReference): LocalMediaItem {
    console.log(`🔴 恢复错误状态媒体项: ${reference.originalFileName}`)

    const errorMediaItem: LocalMediaItem = {
      id: mediaId,
      name: reference.originalFileName,
      createdAt: reference.errorTimestamp || new Date().toISOString(),
      file: null as any, // 错误状态没有实际文件对象
      url: '', // 错误状态没有URL
      duration: 0,
      type: reference.originalFile?.type || '',
      mediaType: reference.type,
      mp4Clip: null,
      imgClip: null,
      audioClip: null,
      status: 'error',
    }

    return errorMediaItem
  }

  /**
   * 批量加载项目的所有媒体文件（扩展支持错误状态媒体项）
   * @param projectId 项目ID
   * @param mediaReferences 媒体引用映射
   * @param options 加载选项
   * @returns 重建的LocalMediaItem数组
   */
  async loadAllMediaForProject(
    projectId: string,
    mediaReferences: Record<string, LocalMediaReference>,
    options?: {
      batchSize?: number
      onProgress?: (loaded: number, total: number) => void
    },
  ): Promise<LocalMediaItem[]> {
    try {
      const { batchSize = 3, onProgress } = options || {}
      const mediaEntries = Object.entries(mediaReferences)
      const totalCount = mediaEntries.length

      console.log(`📦 开始批量加载媒体文件: ${totalCount}个文件`)

      const mediaItems: LocalMediaItem[] = []
      let loadedCount = 0

      // 分批处理，避免同时加载太多大文件
      for (let i = 0; i < mediaEntries.length; i += batchSize) {
        const batch = mediaEntries.slice(i, i + batchSize)

        console.log(
          `📦 处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(mediaEntries.length / batchSize)}: ${batch.length}个文件`,
        )

        // 并行处理当前批次
        const batchPromises = batch.map(async ([mediaId, reference]) => {
          if (reference.status === 'error') {
            // 恢复错误状态的媒体项
            loadedCount++
            if (onProgress) {
              onProgress(loadedCount, totalCount)
            }
            return this.restoreErrorMediaItem(mediaId, reference)
          } else {
            // 正常加载流程
            try {
              const mediaItem = await this.rebuildMediaItemFromLocal(mediaId, reference, projectId)
              loadedCount++

              // 报告进度
              if (onProgress) {
                onProgress(loadedCount, totalCount)
              }

              return mediaItem
            } catch (error) {
              console.error(`加载媒体失败，转换为错误状态: ${reference.originalFileName}`, error)

              // 将加载失败的媒体转换为错误状态
              const updatedReference: LocalMediaReference = {
                ...reference,
                status: 'error',
                errorType: 'file_load_error',
                errorMessage: error instanceof Error ? error.message : String(error),
                errorTimestamp: new Date().toISOString(),
              }

              loadedCount++
              if (onProgress) {
                onProgress(loadedCount, totalCount)
              }

              return this.restoreErrorMediaItem(mediaId, updatedReference)
            }
          }
        })

        const batchResults = await Promise.all(batchPromises)

        // 过滤掉失败的项目
        const successfulItems = batchResults.filter((item): item is LocalMediaItem => item !== null)
        mediaItems.push(...successfulItems)
      }

      console.log(`✅ 批量加载完成: 成功${mediaItems.length}/${totalCount}个文件`)
      return mediaItems
    } catch (error) {
      console.error('❌ 批量加载媒体文件失败:', error)
      throw error
    }
  }
}

// 导出单例实例
export const mediaManager = MediaManager.getInstance()

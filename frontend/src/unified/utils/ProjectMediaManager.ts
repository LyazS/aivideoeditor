/**
 * 页面级项目媒体管理器
 * 基于新架构项目保存方案的核心实现
 *
 * 核心理念：
 * - 即时保存：素材解析成功后立刻保存到项目本地磁盘，确保数据安全
 * - Meta驱动架构：通过"磁盘Meta文件为权威数据源 + 页面级内存缓存"的模式实现数据管理
 * - 本地存储优先：所有媒体文件都保存在各自项目的本地目录中，确保项目的完整性和可移植性
 * - 页面级隔离：通过href跳转重新加载页面，每个项目都是独立的页面实例
 */

import { directoryManager } from '@/unified/utils/DirectoryManager'
import { generateUUID4 } from '@/unified/utils/idGenerator'
import type { UnifiedMediaMetadata, UnifiedMediaReference } from '@/unified/project/types'
import type { MediaType } from '@/unified/mediaitem/types'

// ==================== 类型定义 ====================

/**
 * Meta文件扫描过程中使用的临时数据结构
 */
interface MetaFileInfo {
  metaFileName: string // meta文件名
  sourceFileName: string // 对应的源文件名
  relativePath: string // 相对路径（不含.meta后缀）
  dirHandle: FileSystemDirectoryHandle // 目录句柄
  metadata: UnifiedMediaMetadata // 解析后的元数据
}

/**
 * 媒体保存结果接口
 */
export interface MediaSaveResult {
  success: boolean
  mediaReference?: UnifiedMediaReference
  storagePath?: string
  isReused?: boolean
  error?: string
}

// ==================== 核心类实现 ====================

/**
 * 页面级项目媒体管理器
 * 每个项目页面独立管理自己的媒体文件，通过页面跳转实现项目间完全隔离
 */
export class ProjectMediaManager {
  private projectId: string = ''
  private mediaReferences: Map<string, UnifiedMediaReference> = new Map()

  constructor() {
    // 无参构造函数，支持页面级全局实例化
  }

  /**
   * 初始化项目媒体管理器
   * @param projectId 项目ID
   */
  async initializeForProject(projectId: string): Promise<void> {
    this.projectId = projectId
    this.mediaReferences.clear()
    console.log(`🔧 初始化页面级媒体管理器: ${projectId}`)

    // 扫描媒体目录构建文件索引
    console.log(`🔍 开始扫描项目媒体目录: ${projectId}`)
    await this.scanMediaDirectory()
    console.log(`✅ 项目媒体管理器初始化完成: ${projectId}`)
  }

  /**
   * 获取当前项目ID
   */
  get currentProjectId(): string {
    return this.projectId
  }

  /**
   * 获取媒体引用
   * @param mediaReferenceId 媒体引用ID
   * @returns 媒体引用或undefined
   */
  getMediaReference(mediaReferenceId: string): UnifiedMediaReference | undefined {
    return this.mediaReferences.get(mediaReferenceId)
  }

  /**
   * 获取所有媒体引用
   * @returns 媒体引用数组
   */
  getAllMediaReferences(): UnifiedMediaReference[] {
    return Array.from(this.mediaReferences.values())
  }

  /**
   * 计算文件校验和
   * @param file 媒体文件
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
      throw new Error(
        `计算文件校验和失败: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * 获取文件扩展名
   * @param fileName 文件名
   * @returns 文件扩展名
   */
  private getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.')
    return lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : ''
  }

  /**
   * 生成存储路径
   */
  private generateStoragePath(fileName: string, mediaType: MediaType): string {
    const timestamp = Date.now()
    const extension = this.getFileExtension(fileName)
    const sanitizedName = fileName.replace(extension, '').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
    const uniqueName = `${sanitizedName}_${timestamp}${extension}`

    return `media/${mediaType}s/${uniqueName}`
  }

  /**
   * 确保目录存在
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
      if ((error as DOMException).name === 'NotFoundError') {
        return await parentHandle.getDirectoryHandle(dirName, { create: true })
      }
      throw error
    }
  }

  /**
   * 保存媒体文件到项目本地目录
   * @param file 媒体文件
   * @param mediaType 媒体类型
   * @param clip WebAV Clip对象（可选，用于生成完整元数据）
   * @returns 媒体保存结果
   */
  async saveMediaToProject(file: File, mediaType: MediaType, clip?: any): Promise<MediaSaveResult> {
    try {
      console.log(`💾 开始保存媒体文件到项目: ${file.name}`)

      // 1. 计算内容哈希用于去重
      const contentHash = await this.calculateChecksum(file)

      // 2. 检查是否已存在相同文件（通过遍历查找相同哈希）
      const existingRef = Array.from(this.mediaReferences.values()).find(
        (ref) => ref.metadata && ref.metadata.checksum === contentHash,
      )
      if (existingRef) {
        console.log(`♻️ 复用现有媒体: ${file.name} -> ${existingRef.id}`)
        return {
          success: true,
          mediaReference: existingRef,
          storagePath: existingRef.storedPath,
          isReused: true,
        }
      }

      // 3. 生成存储路径
      const storagePath = this.generateStoragePath(file.name, mediaType)

      // 4. 保存文件到项目目录
      await this.saveFileToStorage(file, storagePath)

      // 5. 生成持久化ID和媒体元数据
      const mediaId = generateUUID4()
      let metadata: UnifiedMediaMetadata

      if (clip) {
        // 如果有clip，生成完整的元数据（包含duration、width、height等）
        metadata = await this.generateMediaMetadata(file, clip, mediaType, mediaId, contentHash)
      } else {
        // 如果没有clip，只生成基础元数据
        metadata = {
          id: mediaId,
          originalFileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          checksum: contentHash,
          importedAt: new Date().toISOString(),
        }
      }

      // 6. 创建媒体引用
      const mediaReference: UnifiedMediaReference = {
        id: mediaId, // 使用相同的ID
        originalFileName: file.name,
        storedPath: storagePath,
        mediaType,
        fileSize: file.size,
        mimeType: file.type,
        checksum: contentHash,
        metadata,
      }

      // 7. 注册引用
      this.mediaReferences.set(mediaReference.id, mediaReference)

      // 8. 保存元数据到.meta文件
      await this.saveMediaMetadata(storagePath, metadata)

      console.log(`✅ 媒体文件保存成功: ${file.name} -> ${storagePath}`)

      return {
        success: true,
        mediaReference,
        storagePath,
        isReused: false,
      }
    } catch (error) {
      console.error('保存媒体文件失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * 保存文件到存储位置
   */
  private async saveFileToStorage(file: File, storagePath: string): Promise<void> {
    try {
      const workspaceHandle = await directoryManager.getWorkspaceHandle()
      if (!workspaceHandle) throw new Error('未设置工作目录')

      const projectsHandle = await workspaceHandle.getDirectoryHandle('projects')
      const projectHandle = await projectsHandle.getDirectoryHandle(this.projectId)

      // 解析路径并确保目录存在
      const pathParts = storagePath.split('/')
      const fileName = pathParts.pop()!

      let currentHandle = projectHandle
      for (const part of pathParts) {
        if (part) {
          currentHandle = await this.ensureDirectoryExists(currentHandle, part)
        }
      }

      // 保存文件
      const fileHandle = await currentHandle.getFileHandle(fileName, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(file)
      await writable.close()
    } catch (error) {
      console.error('保存文件到存储失败:', error)
      throw new Error(`保存文件失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 生成媒体元数据
   * @param file 媒体文件
   * @param clip WebAV Clip对象
   * @param mediaType 媒体类型
   * @param mediaId 媒体ID
   * @param checksum 文件校验和
   * @returns 媒体元数据
   */
  async generateMediaMetadata(
    file: File,
    clip: any,
    mediaType: MediaType,
    mediaId: string,
    checksum: string,
  ): Promise<UnifiedMediaMetadata> {
    try {
      // 等待clip准备完成
      const meta = await clip.ready

      // 构建元数据
      const metadata: UnifiedMediaMetadata = {
        id: mediaId, // 持久化ID
        originalFileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        checksum: checksum, // 文件校验和
        importedAt: new Date().toISOString(),
      }

      // 根据媒体类型添加特定元数据
      if (mediaType === 'video' || mediaType === 'audio') {
        metadata.duration = meta.duration
      }

      if (mediaType === 'video' || mediaType === 'image') {
        metadata.width = meta.width
        metadata.height = meta.height
      }

      return metadata
    } catch (error) {
      console.error('生成媒体元数据失败:', error)
      throw new Error(
        `生成媒体元数据失败: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * 保存媒体元数据文件
   * @param storedPath 存储路径
   * @param metadata 媒体元数据
   */
  async saveMediaMetadata(storedPath: string, metadata: UnifiedMediaMetadata): Promise<void> {
    try {
      const workspaceHandle = await directoryManager.getWorkspaceHandle()
      if (!workspaceHandle) throw new Error('未设置工作目录')

      const projectsHandle = await workspaceHandle.getDirectoryHandle('projects')
      const projectHandle = await projectsHandle.getDirectoryHandle(this.projectId)

      // 构建元数据文件路径
      const metaFilePath = `${storedPath}.meta`
      const pathParts = metaFilePath.split('/')
      const fileName = pathParts.pop()!
      const dirPath = pathParts.join('/')

      // 确保目录存在
      let currentHandle = projectHandle
      for (const part of dirPath.split('/')) {
        if (part) {
          currentHandle = await this.ensureDirectoryExists(currentHandle, part)
        }
      }

      // 保存元数据文件
      const fileHandle = await currentHandle.getFileHandle(fileName, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(JSON.stringify(metadata, null, 2))
      await writable.close()

      console.log(`💾 元数据文件保存成功: ${metaFilePath}`)
    } catch (error) {
      console.error('保存媒体元数据失败:', error)
      throw new Error(
        `保存媒体元数据失败: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Meta驱动扫描项目媒体目录
   * @returns 媒体引用数组
   */
  async scanMediaDirectory(): Promise<UnifiedMediaReference[]> {
    try {
      console.log(`🔍 开始Meta驱动扫描项目媒体目录: ${this.projectId}`)

      // 1. 扫描项目目录中的所有meta文件
      const allMetaFiles = await this.scanAllMetaFiles()
      console.log(`📄 发现 ${allMetaFiles.length} 个meta文件`)

      // 2. 逐个验证对应的源文件是否存在，过滤掉不存在源文件的meta
      const validReferences: UnifiedMediaReference[] = []

      for (const metaInfo of allMetaFiles) {
        try {
          // 验证对应的源文件是否存在
          const sourceFileExists = await this.verifySourceFileExists(
            metaInfo.dirHandle,
            metaInfo.sourceFileName,
          )

          if (sourceFileExists) {
            // 源文件存在，创建有效的媒体引用
            const mediaType = this.inferMediaTypeFromPath(metaInfo.relativePath)

            const reference: UnifiedMediaReference = {
              id: metaInfo.metadata.id, // 从meta文件读取持久化ID
              originalFileName: metaInfo.metadata.originalFileName,
              storedPath: `media/${metaInfo.relativePath}`,
              mediaType,
              fileSize: metaInfo.metadata.fileSize,
              mimeType: metaInfo.metadata.mimeType,
              checksum: metaInfo.metadata.checksum,
              metadata: metaInfo.metadata,
            }

            // 更新内存中的引用映射
            this.mediaReferences.set(reference.id, reference)

            validReferences.push(reference)
            console.log(`✅ 验证通过: ${metaInfo.metadata.originalFileName}`)
          } else {
            console.warn(`⚠️ 源文件不存在，跳过meta文件: ${metaInfo.sourceFileName}`)
          }
        } catch (error) {
          console.error(`验证meta文件失败: ${metaInfo.metaFileName}`, error)
        }
      }

      console.log(
        `📁 Meta驱动扫描完成，有效媒体引用: ${validReferences.length}/${allMetaFiles.length}`,
      )

      // 输出媒体素材调试信息表格
      if (validReferences.length > 0) {
        console.log('📊 媒体素材调试信息:')
        console.table(
          validReferences.map((ref) => ({
            ID: ref.id,
            文件名: ref.originalFileName,
            类型: ref.mediaType,
            大小: `${(ref.fileSize / 1024 / 1024).toFixed(2)} MB`,
            MIME类型: ref.mimeType,
            存储路径: ref.storedPath,
            校验和: ref.checksum.substring(0, 8) + '...',
            导入时间: ref.metadata?.importedAt || '-',
            时长: ref.metadata?.duration ? `${ref.metadata.duration.toFixed(2)}s` : '-',
            尺寸:
              ref.metadata?.width && ref.metadata?.height
                ? `${ref.metadata.width}x${ref.metadata.height}`
                : '-',
          })),
        )
      } else {
        console.log('📊 未发现有效的媒体素材')
      }

      return validReferences
    } catch (error) {
      console.error('Meta驱动扫描媒体目录失败:', error)
      return [] // 返回空数组而不是抛出错误，保证加载流程的健壮性
    }
  }

  /**
   * 扫描项目目录中的所有meta文件
   * @returns meta文件信息数组
   */
  private async scanAllMetaFiles(): Promise<MetaFileInfo[]> {
    try {
      const workspaceHandle = await directoryManager.getWorkspaceHandle()
      if (!workspaceHandle) return []

      const projectsHandle = await workspaceHandle.getDirectoryHandle('projects')
      const projectHandle = await projectsHandle.getDirectoryHandle(this.projectId)
      const mediaHandle = await projectHandle.getDirectoryHandle('media')

      const metaFiles: MetaFileInfo[] = []
      await this.scanDirectoryForMeta(mediaHandle, '', metaFiles)

      return metaFiles
    } catch (error) {
      console.error('扫描meta文件失败:', error)
      return []
    }
  }

  /**
   * 递归扫描目录中的meta文件
   */
  private async scanDirectoryForMeta(
    dirHandle: FileSystemDirectoryHandle,
    relativePath: string,
    metaFiles: MetaFileInfo[],
  ): Promise<void> {
    try {
      for await (const [name, handle] of dirHandle.entries()) {
        const currentPath = relativePath ? `${relativePath}/${name}` : name

        if (handle.kind === 'directory') {
          await this.scanDirectoryForMeta(handle, currentPath, metaFiles)
        } else if (handle.kind === 'file' && name.endsWith('.meta')) {
          try {
            const file = await handle.getFile()
            const content = await file.text()
            const metadata = JSON.parse(content) as UnifiedMediaMetadata

            const sourceFileName = name.replace('.meta', '')
            const sourceRelativePath = currentPath.replace('.meta', '')

            metaFiles.push({
              metaFileName: name,
              sourceFileName,
              relativePath: sourceRelativePath,
              dirHandle,
              metadata,
            })
          } catch (error) {
            console.warn(`解析meta文件失败: ${currentPath}`, error)
          }
        }
      }
    } catch (error) {
      console.error(`扫描目录失败: ${relativePath}`, error)
    }
  }

  /**
   * 验证源文件是否存在
   */
  private async verifySourceFileExists(
    dirHandle: FileSystemDirectoryHandle,
    sourceFileName: string,
  ): Promise<boolean> {
    try {
      await dirHandle.getFileHandle(sourceFileName)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 从路径推断媒体类型
   */
  private inferMediaTypeFromPath(relativePath: string): MediaType {
    const fileName = relativePath.toLowerCase()

    if (fileName.match(/\.(mp4|avi|mov|webm|mkv)$/)) return 'video'
    if (fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/)) return 'image'
    if (fileName.match(/\.(mp3|wav|ogg|aac|flac)$/)) return 'audio'
    if (fileName.match(/\.(txt|md|json|xml)$/)) return 'text'

    return 'video' // 默认类型
  }

  /**
   * 从项目目录加载媒体文件
   * @param storedPath 存储路径
   * @returns 媒体文件
   */
  async loadMediaFromProject(storedPath: string): Promise<File> {
    try {
      const workspaceHandle = await directoryManager.getWorkspaceHandle()
      if (!workspaceHandle) throw new Error('未设置工作目录')

      const projectsHandle = await workspaceHandle.getDirectoryHandle('projects')
      const projectHandle = await projectsHandle.getDirectoryHandle(this.projectId)

      // 解析路径并获取文件
      const pathParts = storedPath.split('/')
      let currentHandle: FileSystemDirectoryHandle = projectHandle

      // 遍历目录路径
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i]
        if (part) {
          currentHandle = await currentHandle.getDirectoryHandle(part)
        }
      }

      // 获取文件
      const fileName = pathParts[pathParts.length - 1]
      const fileHandle = await currentHandle.getFileHandle(fileName)
      const file = await fileHandle.getFile()

      return file
    } catch (error) {
      console.error('从项目加载媒体文件失败:', error)
      throw new Error(`加载媒体文件失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 验证媒体文件完整性
   * @param storedPath 存储路径
   * @param expectedChecksum 预期校验和
   * @returns 是否验证通过
   */
  async verifyMediaIntegrity(storedPath: string, expectedChecksum: string): Promise<boolean> {
    try {
      const file = await this.loadMediaFromProject(storedPath)
      const actualChecksum = await this.calculateChecksum(file)
      return actualChecksum === expectedChecksum
    } catch (error) {
      console.error('验证媒体文件完整性失败:', error)
      return false
    }
  }

  /**
   * 批量验证所有媒体文件完整性
   * @returns 验证结果报告
   */
  async verifyAllMediaIntegrity(): Promise<{
    total: number
    passed: number
    failed: number
    missing: number
    results: Array<{
      id: string
      originalFileName: string
      storedPath: string
      status: 'passed' | 'failed' | 'missing'
      error?: string
    }>
  }> {
    const allReferences = this.getAllMediaReferences()
    const results: Array<{
      id: string
      originalFileName: string
      storedPath: string
      status: 'passed' | 'failed' | 'missing'
      error?: string
    }> = []

    let passed = 0
    let failed = 0
    let missing = 0

    console.log(`🔍 开始批量验证 ${allReferences.length} 个媒体文件完整性`)

    for (const mediaRef of allReferences) {
      try {
        const isValid = await this.verifyMediaIntegrity(mediaRef.storedPath, mediaRef.checksum)

        if (isValid) {
          passed++
          results.push({
            id: mediaRef.id,
            originalFileName: mediaRef.originalFileName,
            storedPath: mediaRef.storedPath,
            status: 'passed',
          })
        } else {
          failed++
          results.push({
            id: mediaRef.id,
            originalFileName: mediaRef.originalFileName,
            storedPath: mediaRef.storedPath,
            status: 'failed',
            error: '文件校验和不匹配',
          })
        }
      } catch (error) {
        missing++
        results.push({
          id: mediaRef.id,
          originalFileName: mediaRef.originalFileName,
          storedPath: mediaRef.storedPath,
          status: 'missing',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const report = {
      total: allReferences.length,
      passed,
      failed,
      missing,
      results,
    }

    console.log(`✅ 批量验证完成:`, {
      总数: report.total,
      通过: report.passed,
      失败: report.failed,
      缺失: report.missing,
    })

    return report
  }

  /**
   * 清理孤立的媒体引用
   * 扫描并删除没有对应源文件的.meta文件
   * @returns 清理结果报告
   */
  async cleanupOrphanedReferences(): Promise<{
    total: number
    cleaned: number
    errors: number
    results: Array<{
      id: string
      originalFileName: string
      metaPath: string
      status: 'cleaned' | 'error'
      error?: string
    }>
  }> {
    const allMetaFiles = await this.scanAllMetaFiles()
    const results: Array<{
      id: string
      originalFileName: string
      metaPath: string
      status: 'cleaned' | 'error'
      error?: string
    }> = []

    let cleaned = 0
    let errors = 0

    console.log(`🧹 开始清理孤立的媒体引用，发现 ${allMetaFiles.length} 个meta文件`)

    for (const metaInfo of allMetaFiles) {
      try {
        // 检查对应的源文件是否存在
        const sourceFileExists = await this.verifySourceFileExists(
          metaInfo.dirHandle,
          metaInfo.sourceFileName,
        )

        if (!sourceFileExists) {
          // 源文件不存在，删除对应的meta文件
          try {
            await metaInfo.dirHandle.removeEntry(metaInfo.metaFileName)

            // 从内存中移除引用
            this.mediaReferences.delete(metaInfo.metadata.id)

            cleaned++
            results.push({
              id: metaInfo.metadata.id,
              originalFileName: metaInfo.metadata.originalFileName,
              metaPath: `${metaInfo.relativePath}.meta`,
              status: 'cleaned',
            })

            console.log(`🗑️ 已清理孤立引用: ${metaInfo.metadata.originalFileName}`)
          } catch (deleteError) {
            errors++
            results.push({
              id: metaInfo.metadata.id,
              originalFileName: metaInfo.metadata.originalFileName,
              metaPath: `${metaInfo.relativePath}.meta`,
              status: 'error',
              error: deleteError instanceof Error ? deleteError.message : String(deleteError),
            })

            console.error(`❌ 清理孤立引用失败: ${metaInfo.metadata.originalFileName}`, deleteError)
          }
        }
      } catch (error) {
        errors++
        results.push({
          id: metaInfo.metadata.id,
          originalFileName: metaInfo.metadata.originalFileName,
          metaPath: `${metaInfo.relativePath}.meta`,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        })

        console.error(`❌ 检查孤立引用失败: ${metaInfo.metaFileName}`, error)
      }
    }

    const report = {
      total: allMetaFiles.length,
      cleaned,
      errors,
      results,
    }

    console.log(`✅ 孤立引用清理完成:`, {
      总数: report.total,
      已清理: report.cleaned,
      错误: report.errors,
    })

    return report
  }
}

// ==================== 页面级实例 ====================

// 导出页面级实例，每个项目页面维护一个独立的管理器实例
export const globalProjectMediaManager = new ProjectMediaManager()

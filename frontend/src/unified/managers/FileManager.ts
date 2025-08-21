/**
 * 文件管理器
 * 专门负责媒体文件的保存和引用管理
 */

import type { UnifiedMediaItemData, MediaType } from '@/unified/mediaitem/types'
import { globalProjectMediaManager } from '@/unified/utils/ProjectMediaManager'

/**
 * 文件保存结果
 */
export interface FileSaveResult {
  success: boolean
  storagePath?: string
  mediaReference?: {
    id: string
    storedPath: string
  }
  error?: string
}

/**
 * 文件管理器
 * 负责媒体文件的保存、引用和资源管理
 */
export class FileManager {
  /**
   * 保存媒体文件到项目
   * @param file 文件对象
   * @param mediaType 媒体类型
   * @param clip WebAV Clip对象（可选，用于生成完整元数据）
   * @returns 保存结果
   */
  async saveMediaToProject(file: File, mediaType: MediaType, clip?: any): Promise<FileSaveResult> {
    try {
      console.log(`💾 [FileManager] 开始保存媒体文件到项目: ${file.name} (${mediaType})`)

      // 检查ProjectMediaManager是否已初始化
      if (!globalProjectMediaManager.currentProjectId) {
        throw new Error('ProjectMediaManager 未初始化，请先调用 initializeForProject')
      }

      // 保存媒体文件和元数据到当前项目页面
      const saveResult = await globalProjectMediaManager.saveMediaToProject(
        file,
        mediaType,
        clip, // 传入clip用于生成完整元数据
      )

      if (saveResult.success && saveResult.mediaReference) {
        console.log(`✅ [FileManager] 媒体文件保存成功: ${file.name} -> ${saveResult.storagePath}`)
        console.log(`🔗 [FileManager] 媒体引用ID: ${saveResult.mediaReference.id}`)

        return {
          success: true,
          storagePath: saveResult.storagePath,
          mediaReference: saveResult.mediaReference,
        }
      } else {
        throw new Error(saveResult.error || '保存失败')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '保存失败'
      console.error(`❌ [FileManager] 媒体文件保存失败: ${file.name}`, error)

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * 从项目加载媒体文件
   * @param projectId 项目ID
   * @param storedPath 存储路径
   * @returns 文件对象
   */
  async loadMediaFromProject(projectId: string, storedPath: string): Promise<File> {
    try {
      console.log(`📂 [FileManager] 从项目加载媒体文件: ${storedPath}`)

      const file = await globalProjectMediaManager.loadMediaFromProject(storedPath)

      console.log(`✅ [FileManager] 媒体文件加载成功: ${file.name}`)
      return file
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载失败'
      console.error(`❌ [FileManager] 媒体文件加载失败: ${storedPath}`, error)
      throw new Error(errorMessage)
    }
  }

  /**
   * 设置媒体引用ID到数据源
   * @param mediaItem 媒体项目
   * @param mediaReferenceId 媒体引用ID
   */
  setMediaReferenceId(mediaItem: UnifiedMediaItemData, mediaReferenceId: string): void {
    if (!mediaItem.source.mediaReferenceId) {
      mediaItem.source.mediaReferenceId = mediaReferenceId
      console.log(`🔗 [FileManager] 媒体引用ID已设置: ${mediaItem.name} -> ${mediaReferenceId}`)
    } else {
      console.log(
        `🔗 [FileManager] 媒体引用ID已存在: ${mediaItem.name} -> ${mediaItem.source.mediaReferenceId}`,
      )
    }
  }

  /**
   * 检查媒体文件是否已保存到项目
   * @param mediaItem 媒体项目
   * @returns 是否已保存
   */
  isMediaSavedToProject(mediaItem: UnifiedMediaItemData): boolean {
    return !!mediaItem.source.mediaReferenceId
  }

  /**
   * 获取媒体引用信息
   * @param mediaItem 媒体项目
   * @returns 媒体引用信息或undefined
   */
  getMediaReference(mediaItem: UnifiedMediaItemData) {
    if (!mediaItem.source.mediaReferenceId) {
      return undefined
    }

    return globalProjectMediaManager.getMediaReference(mediaItem.source.mediaReferenceId)
  }

  /**
   * 清理媒体文件资源
   * @param mediaItem 媒体项目
   */
  cleanupMediaResources(mediaItem: UnifiedMediaItemData): void {
    // 清理URL资源
    if (mediaItem.source.url) {
      URL.revokeObjectURL(mediaItem.source.url)
      console.log(`🧹 [FileManager] URL资源已清理: ${mediaItem.name}`)
    }

    // 清理WebAV缩略图URL
    if (mediaItem.webav?.thumbnailUrl) {
      URL.revokeObjectURL(mediaItem.webav.thumbnailUrl)
      console.log(`🧹 [FileManager] 缩略图URL资源已清理: ${mediaItem.name}`)
    }
  }

  /**
   * 获取文件大小信息
   * @param file 文件对象
   * @returns 格式化的文件大小信息
   */
  getFileInfo(file: File): {
    name: string
    size: number
    sizeFormatted: string
    type: string
    lastModified: Date
  } {
    const formatFileSize = (bytes: number): string => {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    return {
      name: file.name,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      type: file.type,
      lastModified: new Date(file.lastModified),
    }
  }

  /**
   * 验证文件是否有效
   * @param file 文件对象
   * @returns 验证结果
   */
  validateFile(file: File): {
    isValid: boolean
    error?: string
    info?: ReturnType<typeof FileManager.prototype.getFileInfo>
  } {
    try {
      // 检查文件是否存在
      if (!file) {
        return { isValid: false, error: '文件不存在' }
      }

      // 检查文件大小
      if (file.size === 0) {
        return { isValid: false, error: '文件为空' }
      }

      // 检查文件名
      if (!file.name || file.name.length === 0) {
        return { isValid: false, error: '文件名为空' }
      }

      const info = this.getFileInfo(file)
      return { isValid: true, info }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : '验证失败',
      }
    }
  }

  /**
   * 获取项目中的媒体文件统计信息
   * @returns 统计信息
   */
  getProjectMediaStats(): {
    totalFiles: number
    totalSize: number
    byType: Record<string, { count: number; size: number }>
  } {
    try {
      const projectId = globalProjectMediaManager.currentProjectId
      if (!projectId) {
        return {
          totalFiles: 0,
          totalSize: 0,
          byType: {},
        }
      }

      // 这里需要根据ProjectMediaManager的实际API来获取统计信息
      // 由于API可能不同，这里提供一个基本结构
      return {
        totalFiles: 0,
        totalSize: 0,
        byType: {
          video: { count: 0, size: 0 },
          audio: { count: 0, size: 0 },
          image: { count: 0, size: 0 },
        },
      }
    } catch (error) {
      console.error('❌ [FileManager] 获取项目媒体统计失败:', error)
      return {
        totalFiles: 0,
        totalSize: 0,
        byType: {},
      }
    }
  }
}

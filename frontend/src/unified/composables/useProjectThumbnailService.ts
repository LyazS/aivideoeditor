import { ref } from 'vue'
import type { UnifiedMediaItemData } from '@/unified/mediaitem'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem'
import { directoryManager } from '@/unified/utils/DirectoryManager'
import { generateThumbnailForUnifiedMediaItem } from '@/unified/utils/thumbnailGenerator'
import { UnifiedMediaItemQueries } from '@/unified/mediaitem'

/**
 * 项目缩略图服务
 * 负责生成、处理和保存项目缩略图
 */
export function useProjectThumbnailService() {
  const isGenerating = ref(false)

  /**
   * 错误类型定义
   */
  class ThumbnailError extends Error {
    constructor(
      message: string,
      public readonly code:
        | 'NO_SOURCE' // 没有找到可用的源项目
        | 'EXTRACTION_FAILED' // 帧提取失败
        | 'PROCESSING_FAILED' // 图像处理失败
        | 'SAVE_FAILED', // 文件保存失败
    ) {
      super(message)
      this.name = 'ThumbnailError'
    }
  }

  /**
   * 筛选时间轴项目，找到适合作为缩略图源的第一个视频或图像项目
   */
  const findThumbnailSource = (
    timelineItems: UnifiedTimelineItemData[],
    mediaModule: {
      getMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
  ): UnifiedTimelineItemData | null => {
    // 按时间位置排序，取第一个视频或图像项目
    const visualItems = timelineItems
      .filter((item) => {
        const mediaItem = mediaModule.getMediaItem(item.mediaItemId)
        return mediaItem && (UnifiedMediaItemQueries.isVideo(mediaItem) || UnifiedMediaItemQueries.isImage(mediaItem))
      })
      .sort((a, b) => a.timeRange.timelineStartTime - b.timeRange.timelineStartTime)

    return visualItems.length > 0 ? visualItems[0] : null
  }


  /**
   * 保存缩略图文件到指定目录
   */
  const saveThumbnail = async (projectId: string, imageBlob: Blob): Promise<string> => {
    try {
      const workspaceHandle = await directoryManager.getWorkspaceHandle()
      if (!workspaceHandle) {
        throw new ThumbnailError('未设置工作目录', 'SAVE_FAILED')
      }

      // 获取项目目录
      const projectsHandle = await workspaceHandle.getDirectoryHandle('projects')
      const projectHandle = await projectsHandle.getDirectoryHandle(projectId)

      // 创建缩略图目录
      let thumbnailsHandle: FileSystemDirectoryHandle
      try {
        thumbnailsHandle = await projectHandle.getDirectoryHandle('thumbnails')
      } catch {
        thumbnailsHandle = await projectHandle.getDirectoryHandle('thumbnails', { create: true })
      }

      // 保存缩略图文件
      const thumbnailFileHandle = await thumbnailsHandle.getFileHandle('projectThumbnail.webp', {
        create: true,
      })
      const writable = await thumbnailFileHandle.createWritable()

      await writable.write(imageBlob)
      await writable.close()

      return 'thumbnails/projectThumbnail.webp'
    } catch (error) {
      console.error('保存缩略图失败:', error)
      throw new ThumbnailError('保存缩略图文件失败', 'SAVE_FAILED')
    }
  }

  /**
   * 获取缩略图URL
   */
  const getThumbnailUrl = async (projectId: string): Promise<string> => {
    try {
      const workspaceHandle = await directoryManager.getWorkspaceHandle()
      if (!workspaceHandle) {
        throw new Error('未设置工作目录')
      }

      // 获取缩略图文件
      const projectsHandle = await workspaceHandle.getDirectoryHandle('projects')
      const projectHandle = await projectsHandle.getDirectoryHandle(projectId)
      const thumbnailsHandle = await projectHandle.getDirectoryHandle('thumbnails')
      const thumbnailFileHandle = await thumbnailsHandle.getFileHandle('projectThumbnail.webp')
      const thumbnailFile = await thumbnailFileHandle.getFile()

      return URL.createObjectURL(thumbnailFile)
    } catch (error) {
      console.warn('获取缩略图URL失败:', error)
      throw error
    }
  }

  /**
   * 清理缩略图资源
   */
  const cleanupThumbnails = async (projectId: string): Promise<void> => {
    try {
      const workspaceHandle = await directoryManager.getWorkspaceHandle()
      if (!workspaceHandle) {
        return
      }

      // 获取项目目录
      const projectsHandle = await workspaceHandle.getDirectoryHandle('projects')
      const projectHandle = await projectsHandle.getDirectoryHandle(projectId)

      try {
        // 删除缩略图目录
        await projectHandle.removeEntry('thumbnails', { recursive: true })
        console.log(`✅ 已清理项目缩略图: ${projectId}`)
      } catch (error) {
        // 缩略图目录可能不存在，忽略错误
        console.log(`📝 缩略图目录不存在，无需清理: ${projectId}`)
      }
    } catch (error) {
      console.warn('清理缩略图失败:', error)
    }
  }

  /**
   * 生成项目缩略图（异步）
   */
  const generateProjectThumbnail = async (
    projectId: string,
    timelineItems: UnifiedTimelineItemData[],
    mediaModule: {
      getMediaItem: (id: string) => UnifiedMediaItemData | undefined
    },
  ): Promise<string> => {
    if (isGenerating.value) {
      throw new ThumbnailError('缩略图生成中，请稍后重试', 'PROCESSING_FAILED')
    }

    isGenerating.value = true

    try {
      console.log(`🖼️ 开始生成项目缩略图: ${projectId}`)

      // 1. 筛选源项目
      const sourceItem = findThumbnailSource(timelineItems, mediaModule)
      if (!sourceItem) {
        throw new ThumbnailError('没有找到可用的缩略图源', 'NO_SOURCE')
      }

      // 2. 获取媒体项目
      const mediaItem = mediaModule.getMediaItem(sourceItem.mediaItemId)
      if (!mediaItem) {
        throw new ThumbnailError('媒体项目不存在', 'NO_SOURCE')
      }

      // 3. 使用统一的缩略图生成函数获取缩略图URL（直接生成640x360的高分辨率缩略图）
      console.log('🔄 使用统一缩略图生成器生成高分辨率缩略图...')
      const thumbnailUrl = await generateThumbnailForUnifiedMediaItem(
        mediaItem,
        100000,
        640,
        360
      )
      
      if (!thumbnailUrl) {
        throw new ThumbnailError('无法生成缩略图', 'EXTRACTION_FAILED')
      }

      // 4. 将Blob URL转换为Blob对象
      console.log('📥 转换高分辨率缩略图为Blob...')
      const response = await fetch(thumbnailUrl)
      const thumbnailBlob = await response.blob()

      // 清理Blob URL
      URL.revokeObjectURL(thumbnailUrl)

      // 5. 保存文件
      console.log('💾 保存高分辨率缩略图文件...')
      const thumbnailPath = await saveThumbnail(projectId, thumbnailBlob)

      console.log(`✅ 项目缩略图生成成功: ${projectId}`)
      return thumbnailPath
    } catch (error) {
      console.error('❌ 缩略图生成失败:', error)
      throw error
    } finally {
      isGenerating.value = false
    }
  }

  return {
    isGenerating,
    generateProjectThumbnail,
    getThumbnailUrl,
    cleanupThumbnails,
    findThumbnailSource,
    saveThumbnail,
  }
}

export type ProjectThumbnailService = ReturnType<typeof useProjectThumbnailService>

import { ref, watch, type Raw } from 'vue'
import { MP4Clip, ImgClip, AudioClip } from '@webav/av-cliper'
import {
  type UnifiedMediaItemData,
  type MediaStatus,
  type MediaType,
  createUnifiedMediaItemData,
  UnifiedMediaItemQueries,
  UnifiedMediaItemActions,
} from '@/unified'
import { UnifiedMediaSyncManager } from '@/unified/utils/unifiedMediaSyncManager'
import { useUnifiedStore } from '@/unified/unifiedStore'

// ==================== 统一媒体项目调试工具 ====================

/**
 * 统一媒体项目调试信息打印函数
 * @param operation 操作名称
 * @param details 操作详情
 * @param mediaItems 统一媒体项目数组
 */
function printUnifiedDebugInfo(
  operation: string,
  details: unknown,
  mediaItems: UnifiedMediaItemData[],
) {
  const timestamp = new Date().toLocaleTimeString()
  console.group(`🎬 [${timestamp}] ${operation}`)

  if (details) {
    console.log('📋 操作详情:', details)
  }

  console.log('📚 统一媒体项目状态:')
  console.table(
    mediaItems.map((item) => ({
      id: item.id,
      name: item.name,
      duration: item.duration ? `${item.duration}帧` : '未知',
      mediaType: item.mediaType,
      mediaStatus: item.mediaStatus,
      sourceType: item.source.type,
      sourceProgress: `${item.source.progress}%`,
      hasWebAV: !!item.webav,
      createdAt: new Date(item.createdAt).toLocaleTimeString(),
    })),
  )

  console.log('📊 统计信息:')
  const statusCounts = mediaItems.reduce(
    (acc, item) => {
      acc[item.mediaStatus] = (acc[item.mediaStatus] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  console.log(`- 总项目数: ${mediaItems.length}`)
  console.log(`- 状态分布:`, statusCounts)

  console.groupEnd()
}

// ==================== 统一媒体项目管理模块 ====================

/**
 * 统一媒体管理模块
 * 负责管理素材库中的统一媒体项目
 */
export function createUnifiedMediaModule(webavModule: {
  createMP4Clip: (file: File) => Promise<Raw<MP4Clip>>
  createImgClip: (file: File) => Promise<Raw<ImgClip>>
  createAudioClip: (file: File) => Promise<Raw<AudioClip>>
}) {
  // ==================== 状态定义 ====================

  // 统一媒体项目列表
  const mediaItems = ref<UnifiedMediaItemData[]>([])

  // ==================== 媒体项目管理方法 ====================

  /**
   * 添加媒体项目到素材库
   * @param mediaItem 媒体项目
   */
  function addMediaItem(mediaItem: UnifiedMediaItemData) {
    mediaItems.value.push(mediaItem)
    printUnifiedDebugInfo(
      '添加统一媒体项目到素材库',
      {
        mediaItemId: mediaItem.id,
        name: mediaItem.name,
        duration: mediaItem.duration,
        mediaType: mediaItem.mediaType,
        mediaStatus: mediaItem.mediaStatus,
        sourceType: mediaItem.source.type,
      },
      getAllMediaItems(),
    )
  }

  /**
   * 从素材库删除媒体项目
   * @param mediaItemId 媒体项目ID
   * @param cleanupCallback 清理回调函数
   */
  function removeMediaItem(
    mediaItemId: string,
    cleanupCallback?: (mediaItem: UnifiedMediaItemData) => void,
  ) {
    const index = mediaItems.value.findIndex(
      (item: UnifiedMediaItemData) => item.id === mediaItemId,
    )
    if (index > -1) {
      const mediaItem = mediaItems.value[index]

      // 1. 清理相关的时间轴项目
      cleanupRelatedTimelineItems(mediaItemId)

      // 2. 清理命令同步
      cleanupCommandMediaSyncForMediaItem(mediaItemId)

      // 3. 调用外部清理回调
      if (cleanupCallback) {
        cleanupCallback(mediaItem)
      }

      // 4. 从数组中移除
      mediaItems.value.splice(index, 1)

      printUnifiedDebugInfo(
        '从素材库删除统一媒体项目',
        {
          mediaItemId,
          mediaItemName: mediaItem.name,
        },
        getAllMediaItems(),
      )
    }
  }

  /**
   * 根据ID获取媒体项目
   * @param mediaItemId 媒体项目ID
   * @returns 媒体项目或undefined
   */
  function getMediaItem(mediaItemId: string): UnifiedMediaItemData | undefined {
    return mediaItems.value.find((item: UnifiedMediaItemData) => item.id === mediaItemId)
  }

  /**
   * 根据数据源ID查找对应的媒体项目
   * @param sourceId 数据源ID
   * @returns 媒体项目或undefined
   */
  function getMediaItemBySourceId(sourceId: string): UnifiedMediaItemData | undefined {
    return mediaItems.value.find((item: UnifiedMediaItemData) => item.source.id === sourceId)
  }

  /**
   * 获取所有媒体项目
   * @returns 所有媒体项目的数组
   */
  function getAllMediaItems(): UnifiedMediaItemData[] {
    return [...mediaItems.value]
  }

  /**
   * 更新媒体项目名称
   * @param mediaItemId 媒体项目ID
   * @param newName 新名称
   */
  function updateMediaItemName(mediaItemId: string, newName: string) {
    const mediaItem = getMediaItem(mediaItemId)
    if (mediaItem) {
      UnifiedMediaItemActions.updateName(mediaItem, newName)
    }
  }

  /**
   * 更新媒体项目
   * @param updatedMediaItem 更新后的媒体项目
   */
  function updateMediaItem(updatedMediaItem: UnifiedMediaItemData) {
    const index = mediaItems.value.findIndex(
      (item: UnifiedMediaItemData) => item.id === updatedMediaItem.id,
    )
    if (index !== -1) {
      mediaItems.value[index] = updatedMediaItem
      console.log(`统一媒体项目已更新: ${updatedMediaItem.id} -> ${updatedMediaItem.name}`)
    }
  }

  // ==================== 分辨率管理方法 ====================

  /**
   * 获取视频原始分辨率（从WebAV对象获取）
   * @param mediaItemId 素材ID
   * @returns 视频分辨率对象
   */
  function getVideoOriginalResolution(mediaItemId: string): { width: number; height: number } {
    const mediaItem = getMediaItem(mediaItemId)
    if (mediaItem && mediaItem.mediaType === 'video' && mediaItem.webav) {
      const size = UnifiedMediaItemQueries.getOriginalSize(mediaItem)
      if (size) {
        return size
      }
    }
    // 默认分辨率
    return { width: -1, height: -1 }
  }

  /**
   * 获取图片原始分辨率（从WebAV对象获取）
   * @param mediaItemId 素材ID
   * @returns 图片分辨率对象
   */
  function getImageOriginalResolution(mediaItemId: string): { width: number; height: number } {
    const mediaItem = getMediaItem(mediaItemId)
    if (mediaItem && mediaItem.mediaType === 'image' && mediaItem.webav) {
      const size = UnifiedMediaItemQueries.getOriginalSize(mediaItem)
      if (size) {
        return size
      }
    }
    // 默认分辨率
    return { width: -1, height: -1 }
  }

  // ==================== 异步等待方法 ====================

  /**
   * 等待媒体项目解析完成
   * 使用Vue的watch机制监听status状态变化，更符合响应式编程模式
   * @param mediaItemId 媒体项目ID
   * @returns Promise<boolean> 解析成功返回true，解析失败抛出错误
   */
  function waitForMediaItemReady(mediaItemId: string): Promise<boolean> {
    const mediaItem = getMediaItem(mediaItemId)

    if (!mediaItem) {
      return Promise.reject(new Error(`找不到媒体项目: ${mediaItemId}`))
    }

    // 使用 Vue watch 监听状态变化，immediate: true 会立即检查当前状态
    return new Promise((resolve, reject) => {
      let unwatch: (() => void) | null = null

      unwatch = watch(
        () => mediaItem.mediaStatus,
        (newStatus) => {
          if (newStatus === 'ready') {
            unwatch?.()
            resolve(true)
          } else if (
            newStatus === 'error' ||
            newStatus === 'cancelled' ||
            newStatus === 'missing'
          ) {
            unwatch?.()
            reject(new Error(`媒体项目解析失败: ${mediaItem.name}, 状态: ${newStatus}`))
          }
          // 如果是其他状态，继续等待
        },
        { immediate: true }, // 立即执行一次，检查当前状态
      )
    })
  }

  // ==================== WebAV处理方法 ====================

  // 注意：startWebAVProcessing方法已移除，现在由各个管理器直接处理WebAV解析

  /**
   * 生成视频缩略图
   * @param file 视频文件
   * @returns 缩略图URL
   */
  async function generateVideoThumbnail(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        video.currentTime = 1 // 获取第1秒的帧
      }

      video.onseeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(URL.createObjectURL(blob))
              } else {
                reject(new Error('生成缩略图失败'))
              }
            },
            'image/jpeg',
            0.8,
          )
        }
      }

      video.onerror = () => reject(new Error('视频加载失败'))
      video.src = URL.createObjectURL(file)
    })
  }

  // ==================== 数据源状态同步方法 ====================
  // 注意：handleSourceStatusChange方法已移除，现在由各个管理器直接处理媒体状态

  /**
   * 开始媒体项目处理流程
   * @param mediaItem 媒体项目
   */
  function startMediaProcessing(mediaItem: UnifiedMediaItemData) {
    console.log(`🚀 [UnifiedMediaModule] 开始处理媒体项目: ${mediaItem.name}`)

    // 导入并使用数据源管理器注册中心
    import('@/unified/managers/DataSourceManagerRegistry')
      .then(({ getManagerRegistry }) => {
        // 获取管理器注册中心实例
        const registry = getManagerRegistry()
        // 获取对应的数据源管理器
        const manager = registry.getManager(mediaItem.source.type)
        if (manager) {
          // 调用管理器的processMediaItem方法处理完整的媒体项目生命周期
          manager.processMediaItem(mediaItem)
            .then(() => {
              console.log(`✅ [UnifiedMediaModule] 媒体项目处理完成: ${mediaItem.name}`)
            })
            .catch((error: any) => {
              console.error(`❌ [UnifiedMediaModule] 媒体项目处理失败: ${mediaItem.name}`, error)
              // 设置媒体项目为错误状态
              UnifiedMediaItemActions.transitionTo(mediaItem, 'error')
            })
        } else {
          console.error(`❌ [UnifiedMediaModule] 找不到对应的数据源管理器: ${mediaItem.source.type}`)
          UnifiedMediaItemActions.transitionTo(mediaItem, 'error')
        }
      })
      .catch((error: any) => {
        console.error(`❌ [UnifiedMediaModule] 导入数据源管理器失败: ${mediaItem.name}`, error)
        UnifiedMediaItemActions.transitionTo(mediaItem, 'error')
      })
  }

  // ==================== 便捷查询方法 ====================

  /**
   * 获取就绪的媒体项目
   */
  function getReadyMediaItems(): UnifiedMediaItemData[] {
    return mediaItems.value.filter(UnifiedMediaItemQueries.isReady)
  }

  /**
   * 获取正在处理的媒体项目
   */
  function getProcessingMediaItems(): UnifiedMediaItemData[] {
    return mediaItems.value.filter(UnifiedMediaItemQueries.isProcessing)
  }

  /**
   * 获取有错误的媒体项目
   */
  function getErrorMediaItems(): UnifiedMediaItemData[] {
    return mediaItems.value.filter(UnifiedMediaItemQueries.hasAnyError)
  }

  /**
   * 根据媒体类型筛选项目
   */
  function getMediaItemsByType(mediaType: MediaType | 'unknown'): UnifiedMediaItemData[] {
    return mediaItems.value.filter((item) => item.mediaType === mediaType)
  }

  /**
   * 根据数据源类型筛选项目
   */
  function getMediaItemsBySourceType(sourceType: string): UnifiedMediaItemData[] {
    return mediaItems.value.filter((item) => item.source.type === sourceType)
  }

  /**
   * 获取媒体项目统计信息
   */
  function getMediaItemsStats() {
    const total = mediaItems.value.length
    const ready = getReadyMediaItems().length
    const processing = getProcessingMediaItems().length
    const error = getErrorMediaItems().length
    const pending = mediaItems.value.filter(UnifiedMediaItemQueries.isPending).length

    return {
      total,
      ready,
      processing,
      error,
      pending,
      readyPercentage: total > 0 ? Math.round((ready / total) * 100) : 0,
    }
  }

  /**
   * 批量重试错误的媒体项目
   */
  function retryAllErrorItems(): void {
    const errorItems = getErrorMediaItems()
    errorItems.forEach((item) => {
      UnifiedMediaItemActions.retry(item)
    })
    console.log(`批量重试 ${errorItems.length} 个错误项目`)
  }

  /**
   * 清理所有已取消的媒体项目
   */
  function clearCancelledItems(): void {
    const cancelledItems = mediaItems.value.filter((item) => item.mediaStatus === 'cancelled')
    cancelledItems.forEach((item) => {
      removeMediaItem(item.id)
    })
    console.log(`清理了 ${cancelledItems.length} 个已取消的项目`)
  }

  // ==================== 清理方法 ====================

  /**
   * 清理与媒体项目相关的时间轴项目
   * @param mediaItemId 媒体项目ID
   */
  function cleanupRelatedTimelineItems(mediaItemId: string): void {
    try {
      // 获取统一存储实例
      const unifiedStore = useUnifiedStore()

      // 获取所有时间轴项目
      const timelineItems = unifiedStore.timelineItems

      // 找出使用该素材的所有时间轴项目
      const relatedTimelineItems = timelineItems.filter((item: any) => item.mediaItemId === mediaItemId)

      // 清理每个相关的时间轴项目
      relatedTimelineItems.forEach((timelineItem: any) => {
        console.log(`🧹 清理时间轴项目: ${timelineItem.id}`)
        unifiedStore.removeTimelineItem(timelineItem.id)
      })

      console.log(`✅ 已清理 ${relatedTimelineItems.length} 个相关时间轴项目`)
    } catch (error) {
      console.error(`❌ 清理相关时间轴项目失败: ${mediaItemId}`, error)
    }
  }

  /**
   * 清理与媒体项目相关的命令同步
   * @param mediaItemId 媒体项目ID
   */
  function cleanupCommandMediaSyncForMediaItem(mediaItemId: string): void {
    try {
      const syncManager = UnifiedMediaSyncManager.getInstance()
      
      // 清理所有与该媒体项目相关的同步
      const syncInfoList = syncManager.getSyncInfo()
      const relatedSyncs = syncInfoList.filter(sync => sync.mediaItemId === mediaItemId)
      
      relatedSyncs.forEach(sync => {
        if (sync.commandId) {
          syncManager.cleanupByCommandId(sync.commandId)
        } else if (sync.timelineItemId) {
          syncManager.cleanupByTimelineItemId(sync.timelineItemId)
        } else {
          syncManager.cleanup(sync.id)
        }
      })

      console.log(`✅ 已清理媒体项目相关的命令同步: ${mediaItemId} (清理了 ${relatedSyncs.length} 个同步)`)
    } catch (error) {
      console.error(`❌ 清理媒体项目命令同步失败: ${mediaItemId}`, error)
    }
  }

  return {
    // 状态
    mediaItems,

    // 媒体项目管理方法
    addMediaItem,
    removeMediaItem,
    getMediaItem,
    getMediaItemBySourceId,
    updateMediaItemName,
    updateMediaItem,
    getAllMediaItems,

    // 分辨率管理方法
    getVideoOriginalResolution,
    getImageOriginalResolution,

    // 异步等待方法
    waitForMediaItemReady,

    // 数据源处理方法
    startMediaProcessing,

    // 便捷查询方法
    getReadyMediaItems,
    getProcessingMediaItems,
    getErrorMediaItems,
    getMediaItemsByType,
    getMediaItemsBySourceType,
    getMediaItemsStats,

    // 批量操作方法
    retryAllErrorItems,
    clearCancelledItems,

    // 清理方法
    cleanupRelatedTimelineItems,
    cleanupCommandMediaSyncForMediaItem,

    // 工厂函数和查询函数
    createUnifiedMediaItemData,
    UnifiedMediaItemQueries,
    UnifiedMediaItemActions,
  }
}

// 导出类型定义
export type UnifiedMediaModule = ReturnType<typeof createUnifiedMediaModule>

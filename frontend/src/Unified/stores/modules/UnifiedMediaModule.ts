import { ref, watch } from 'vue'
import { UnifiedMediaItem } from '../../UnifiedMediaItem'
import type { MediaStatus } from '../../contexts/MediaTransitionContext'

/**
 * 统一媒体管理模块
 * 
 * 基于统一异步源架构，管理UnifiedMediaItem的生命周期
 * 采用状态驱动的设计模式，支持所有类型的媒体源（本地、远程、工程文件等）
 */
export function createUnifiedMediaModule() {
  // ==================== 状态定义 ====================

  // 统一媒体项目库 - 所有媒体都是异步源
  const mediaItems = ref<UnifiedMediaItem[]>([])

  // ==================== 媒体项目管理方法 ====================

  /**
   * 添加统一媒体项目到素材库
   * @param mediaItem 统一媒体项目
   */
  function addUnifiedMediaItem(
    mediaItem: UnifiedMediaItem
  ) {
    mediaItems.value.push(mediaItem)
    console.log('🎬 [UnifiedMediaModule] 添加统一媒体项目:', {
      mediaItemId: mediaItem.id,
      name: mediaItem.name,
      mediaType: mediaItem.mediaType,
      mediaStatus: mediaItem.mediaStatus,
      sourceType: mediaItem.source.__type__,
    })

    // 设置状态变化监听
    mediaItem.onStatusChanged = (oldStatus, newStatus, context) => {
      console.log(`🔄 [UnifiedMediaModule] 媒体状态变化: ${mediaItem.name} (${mediaItem.id})`, {
        transition: `${oldStatus} → ${newStatus}`,
        context: context ? {
          type: context.type,
          source: context.source,
          reason: context.reason,
          timestamp: context.timestamp,
          // 根据不同类型的上下文提取相关信息
          ...(context.type === 'progress_update' && {
            progress: context.progress,
            progressMessage: context.progressMessage
          }),
          ...(context.type === 'error' && {
            errorMessage: context.errorMessage,
            errorCode: context.errorCode
          }),
          ...(context.type === 'download_completed' && {
            fileSize: context.fileSize,
            downloadDuration: context.downloadDuration
          }),
          ...(context.type === 'parse_completed' && {
            duration: context.parsedMetadata.duration,
            format: context.parsedMetadata.format
          })
        } : undefined
      })
    }
  }

  /**
   * 从素材库删除统一媒体项目
   * @param mediaItemId 媒体项目ID
   */
  function removeUnifiedMediaItem(
    mediaItemId: string
  ) {
    const index = mediaItems.value.findIndex(item => item.id === mediaItemId)
    if (index > -1) {
      const mediaItem = mediaItems.value[index]

      // 取消媒体项目的处理（如果正在进行中）
      if (mediaItem.isProcessing()) {
        mediaItem.cancel()
      }

      // 移除媒体项目
      mediaItems.value.splice(index, 1)

      console.log('🗑️ [UnifiedMediaModule] 删除统一媒体项目:', {
        mediaItemId,
        mediaItemName: mediaItem.name
      })
    }
  }

  /**
   * 根据ID获取统一媒体项目
   * @param mediaItemId 媒体项目ID
   * @returns 统一媒体项目或undefined
   */
  function getUnifiedMediaItem(mediaItemId: string): UnifiedMediaItem | undefined {
    return mediaItems.value.find(item => item.id === mediaItemId) as UnifiedMediaItem | undefined
  }

  /**
   * 获取所有统一媒体项目
   * @returns 所有统一媒体项目的数组
   */
  function getAllUnifiedMediaItems(): UnifiedMediaItem[] {
    return [...mediaItems.value] as UnifiedMediaItem[]
  }

  /**
   * 更新媒体项目名称
   * @param mediaItemId 媒体项目ID
   * @param newName 新名称
   */
  function updateUnifiedMediaItemName(mediaItemId: string, newName: string) {
    const mediaItem = getUnifiedMediaItem(mediaItemId)
    if (mediaItem && newName.trim()) {
      mediaItem.name = newName.trim()
      console.log(`📝 [UnifiedMediaModule] 媒体名称已更新: ${mediaItemId} -> ${newName}`)
    }
  }

  // ==================== 状态查询方法 ====================

  /**
   * 获取指定状态的媒体项目
   * @param status 媒体状态
   * @returns 符合状态的媒体项目数组
   */
  function getMediaItemsByStatus(status: MediaStatus): UnifiedMediaItem[] {
    return mediaItems.value.filter(item => item.mediaStatus === status) as UnifiedMediaItem[]
  }

  /**
   * 获取就绪的媒体项目
   * @returns 就绪状态的媒体项目数组
   */
  function getReadyMediaItems(): UnifiedMediaItem[] {
    return getMediaItemsByStatus('ready')
  }

  /**
   * 获取正在处理的媒体项目
   * @returns 处理中状态的媒体项目数组
   */
  function getProcessingMediaItems(): UnifiedMediaItem[] {
    return mediaItems.value.filter(item => item.isProcessing()) as UnifiedMediaItem[]
  }

  /**
   * 获取错误状态的媒体项目
   * @returns 错误状态的媒体项目数组
   */
  function getErrorMediaItems(): UnifiedMediaItem[] {
    return mediaItems.value.filter(item => item.hasError()) as UnifiedMediaItem[]
  }

  // ==================== 分辨率管理方法 ====================

  /**
   * 获取媒体原始分辨率
   * @param mediaItemId 媒体项目ID
   * @returns 分辨率对象或undefined
   */
  function getMediaOriginalResolution(mediaItemId: string): { width: number; height: number } | undefined {
    const mediaItem = getUnifiedMediaItem(mediaItemId)
    if (mediaItem && mediaItem.hasSize()) {
      return mediaItem.getOriginalSize()
    }
    return undefined
  }

  // ==================== 异步等待方法 ====================

  /**
   * 等待媒体项目解析完成
   * 使用Vue的watch机制监听status状态变化
   * @param mediaItemId 媒体项目ID
   * @param timeout 超时时间（毫秒），默认30秒
   * @returns Promise<boolean> 解析成功返回true，解析失败或超时抛出错误
   */
  function waitForUnifiedMediaItemReady(mediaItemId: string, timeout: number = 30000): Promise<boolean> {
    const mediaItem = getUnifiedMediaItem(mediaItemId)

    if (!mediaItem) {
      return Promise.reject(new Error(`找不到媒体项目: ${mediaItemId}`))
    }

    // 如果已经就绪，直接返回
    if (mediaItem.isReady()) {
      return Promise.resolve(true)
    }

    // 使用 Vue watch 监听状态变化
    return new Promise((resolve, reject) => {
      let unwatch: (() => void) | null = null
      let timeoutId: number | null = null

      // 设置超时
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          unwatch?.()
          reject(new Error(`媒体项目等待超时: ${mediaItem.name} (${timeout}ms)`))
        }, timeout)
      }

      unwatch = watch(
        () => mediaItem.mediaStatus,
        (newStatus) => {
          if (newStatus === 'ready') {
            if (timeoutId) clearTimeout(timeoutId)
            unwatch?.()
            resolve(true)
          } else if (newStatus === 'error' || newStatus === 'cancelled') {
            if (timeoutId) clearTimeout(timeoutId)
            unwatch?.()
            const errorMessage = mediaItem.getError() || `媒体项目处理失败: ${mediaItem.name}`
            reject(new Error(errorMessage))
          }
          // 如果是其他状态（pending, asyncprocessing, webavdecoding），继续等待
        },
        { immediate: true } // 立即执行一次，检查当前状态
      )
    })
  }



  // ==================== 批量操作方法 ====================

  /**
   * 批量添加媒体项目
   * @param mediaItems 媒体项目数组
   */
  function addUnifiedMediaItemsBatch(
    mediaItemsToAdd: UnifiedMediaItem[]
  ) {
    mediaItemsToAdd.forEach(mediaItem => {
      addUnifiedMediaItem(mediaItem)
    })
    console.log(`📦 [UnifiedMediaModule] 批量添加媒体项目: ${mediaItemsToAdd.length} 个`)
  }

  /**
   * 批量删除媒体项目
   * @param mediaItemIds 媒体项目ID数组
   */
  function removeUnifiedMediaItemsBatch(
    mediaItemIds: string[]
  ) {
    mediaItemIds.forEach(mediaItemId => {
      removeUnifiedMediaItem(mediaItemId)
    })
    console.log(`🗑️ [UnifiedMediaModule] 批量删除媒体项目: ${mediaItemIds.length} 个`)
  }

  /**
   * 清理所有媒体项目
   */
  function clearAllUnifiedMediaItems() {
    const allIds = mediaItems.value.map(item => item.id)
    removeUnifiedMediaItemsBatch(allIds)
    console.log('🧹 [UnifiedMediaModule] 清理所有媒体项目')
  }

  // ==================== 统计和监控方法 ====================

  /**
   * 获取媒体项目统计信息
   * @returns 统计信息对象
   */
  function getMediaItemsStats() {
    const total = mediaItems.value.length
    const ready = getReadyMediaItems().length
    const processing = getProcessingMediaItems().length
    const error = getErrorMediaItems().length
    const pending = getMediaItemsByStatus('pending').length

    return {
      total,
      ready,
      processing,
      error,
      pending,
      readyPercentage: total > 0 ? Math.round((ready / total) * 100) : 0,
      processingPercentage: total > 0 ? Math.round((processing / total) * 100) : 0,
      errorPercentage: total > 0 ? Math.round((error / total) * 100) : 0
    }
  }

  /**
   * 获取按媒体类型分组的统计信息
   * @returns 按媒体类型分组的统计信息
   */
  function getMediaItemsStatsByType() {
    const stats: Record<string, number> = {}
    mediaItems.value.forEach(item => {
      const type = item.mediaType
      stats[type] = (stats[type] || 0) + 1
    })
    return stats
  }

  /**
   * 获取按数据源类型分组的统计信息
   * @returns 按数据源类型分组的统计信息
   */
  function getMediaItemsStatsBySource() {
    const stats: Record<string, number> = {}
    mediaItems.value.forEach(item => {
      const sourceType = item.source.__type__
      stats[sourceType] = (stats[sourceType] || 0) + 1
    })
    return stats
  }

  // ==================== 重试和恢复方法 ====================

  /**
   * 重试错误状态的媒体项目
   * @param mediaItemId 媒体项目ID
   * @returns 是否成功开始重试
   */
  function retryUnifiedMediaItem(mediaItemId: string): boolean {
    const mediaItem = getUnifiedMediaItem(mediaItemId)
    if (mediaItem && (mediaItem.hasError() || mediaItem.mediaStatus === 'cancelled')) {
      mediaItem.retry()
      console.log(`🔄 [UnifiedMediaModule] 重试媒体项目: ${mediaItem.name} (${mediaItemId})`)
      return true
    }
    return false
  }

  /**
   * 批量重试所有错误状态的媒体项目
   * @returns 重试的媒体项目数量
   */
  function retryAllErrorMediaItems(): number {
    const errorItems = getErrorMediaItems()
    let retryCount = 0

    errorItems.forEach(mediaItem => {
      if (retryUnifiedMediaItem(mediaItem.id)) {
        retryCount++
      }
    })

    console.log(`🔄 [UnifiedMediaModule] 批量重试错误媒体项目: ${retryCount} 个`)
    return retryCount
  }

  /**
   * 取消处理中的媒体项目
   * @param mediaItemId 媒体项目ID
   * @returns 是否成功取消
   */
  function cancelUnifiedMediaItem(mediaItemId: string): boolean {
    const mediaItem = getUnifiedMediaItem(mediaItemId)
    if (mediaItem && mediaItem.isProcessing()) {
      mediaItem.cancel()
      console.log(`❌ [UnifiedMediaModule] 取消媒体项目: ${mediaItem.name} (${mediaItemId})`)
      return true
    }
    return false
  }

  /**
   * 批量取消所有处理中的媒体项目
   * @returns 取消的媒体项目数量
   */
  function cancelAllProcessingMediaItems(): number {
    const processingItems = getProcessingMediaItems()
    let cancelCount = 0

    processingItems.forEach(mediaItem => {
      if (cancelUnifiedMediaItem(mediaItem.id)) {
        cancelCount++
      }
    })

    console.log(`❌ [UnifiedMediaModule] 批量取消处理中媒体项目: ${cancelCount} 个`)
    return cancelCount
  }

  // ==================== 调试和工具方法 ====================

  /**
   * 打印媒体项目调试信息
   * @param title 调试标题
   * @param additionalInfo 额外信息
   */
  function printDebugInfo(title: string, additionalInfo?: any) {
    const stats = getMediaItemsStats()
    const typeStats = getMediaItemsStatsByType()
    const sourceStats = getMediaItemsStatsBySource()

    console.group(`🎬 [UnifiedMediaModule] ${title}`)
    console.log('📊 统计信息:', stats)
    console.log('📁 按类型统计:', typeStats)
    console.log('🔗 按数据源统计:', sourceStats)

    if (additionalInfo) {
      console.log('ℹ️ 额外信息:', additionalInfo)
    }

    // 打印所有媒体项目的详细信息
    console.log('📋 媒体项目列表:')
    mediaItems.value.forEach(item => {
      console.log(`  - ${item.name} (${item.id})`, {
        mediaType: item.mediaType,
        mediaStatus: item.mediaStatus,
        sourceType: item.source.__type__,
        hasSize: item.hasSize(),
        duration: item.getDuration(),
        progress: item.getProgress(),
        error: item.getError()
      })
    })
    console.groupEnd()
  }

  /**
   * 验证媒体项目的完整性
   * @param mediaItemId 媒体项目ID
   * @returns 验证结果
   */
  function validateUnifiedMediaItem(mediaItemId: string) {
    const mediaItem = getUnifiedMediaItem(mediaItemId)
    if (!mediaItem) {
      return {
        valid: false,
        errors: [`媒体项目不存在: ${mediaItemId}`]
      }
    }

    const errors: string[] = []

    // 检查基本属性
    if (!mediaItem.id) errors.push('缺少ID')
    if (!mediaItem.name) errors.push('缺少名称')
    if (!mediaItem.source) errors.push('缺少数据源')

    // 检查状态一致性
    if (mediaItem.mediaStatus === 'ready') {
      if (!mediaItem.webav) {
        errors.push('就绪状态但缺少WebAV对象')
      }
      if (mediaItem.mediaType === 'unknown') {
        errors.push('就绪状态但媒体类型未确定')
      }
    }

    // 检查数据源状态
    if (mediaItem.source && typeof mediaItem.source.getStatus === 'function') {
      const sourceStatus = mediaItem.source.getStatus()
      if (sourceStatus === 'error' && mediaItem.mediaStatus !== 'error') {
        errors.push('数据源错误但媒体状态不是错误')
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 获取媒体项目的详细信息（用于调试）
   * @param mediaItemId 媒体项目ID
   * @returns 详细信息对象
   */
  function getUnifiedMediaItemDetails(mediaItemId: string) {
    const mediaItem = getUnifiedMediaItem(mediaItemId)
    if (!mediaItem) {
      return null
    }

    return {
      // 基本信息
      id: mediaItem.id,
      name: mediaItem.name,
      createdAt: mediaItem.createdAt,
      mediaType: mediaItem.mediaType,
      mediaStatus: mediaItem.mediaStatus,

      // 数据源信息
      source: {
        type: mediaItem.source.__type__,
        status: mediaItem.source.getStatus?.(),
        url: mediaItem.getUrl(),
        progress: mediaItem.getProgress(),
        error: mediaItem.getError()
      },

      // WebAV信息
      webav: mediaItem.webav ? {
        hasMP4Clip: !!mediaItem.webav.mp4Clip,
        hasImgClip: !!mediaItem.webav.imgClip,
        hasAudioClip: !!mediaItem.webav.audioClip,
        hasThumbnail: !!mediaItem.webav.thumbnailUrl,
        originalSize: mediaItem.getOriginalSize()
      } : null,

      // 状态信息
      isReady: mediaItem.isReady(),
      isProcessing: mediaItem.isProcessing(),
      hasError: mediaItem.hasError(),
      hasSize: mediaItem.hasSize(),
      duration: mediaItem.getDuration(),

      // 验证结果
      validation: validateUnifiedMediaItem(mediaItemId)
    }
  }

  /**
   * 导出媒体项目配置（用于保存/恢复）
   * @returns 可序列化的配置对象
   */
  function exportUnifiedMediaItemsConfig() {
    return mediaItems.value.map(item => ({
      id: item.id,
      name: item.name,
      createdAt: item.createdAt,
      mediaType: item.mediaType,
      sourceConfig: {
        type: item.source.__type__,
        // 注意：这里只导出配置，不包含运行时状态
        // 具体的数据源配置需要根据类型来处理
      }
    }))
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    mediaItems,

    // 媒体项目管理方法
    addUnifiedMediaItem,
    removeUnifiedMediaItem,
    getUnifiedMediaItem,
    getAllUnifiedMediaItems,
    updateUnifiedMediaItemName,

    // 批量操作方法
    addUnifiedMediaItemsBatch,
    removeUnifiedMediaItemsBatch,
    clearAllUnifiedMediaItems,

    // 状态查询方法
    getMediaItemsByStatus,
    getReadyMediaItems,
    getProcessingMediaItems,
    getErrorMediaItems,

    // 分辨率管理方法
    getMediaOriginalResolution,

    // 异步等待方法
    waitForUnifiedMediaItemReady,

    // 统计和监控方法
    getMediaItemsStats,
    getMediaItemsStatsByType,
    getMediaItemsStatsBySource,

    // 重试和恢复方法
    retryUnifiedMediaItem,
    retryAllErrorMediaItems,
    cancelUnifiedMediaItem,
    cancelAllProcessingMediaItems,

    // 调试和工具方法
    printDebugInfo,
    validateUnifiedMediaItem,
    getUnifiedMediaItemDetails,
    exportUnifiedMediaItemsConfig,
  }
}

// 导出类型定义
export type UnifiedMediaModule = ReturnType<typeof createUnifiedMediaModule>

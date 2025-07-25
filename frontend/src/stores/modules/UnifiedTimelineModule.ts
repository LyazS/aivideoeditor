import { ref, type Ref } from 'vue'
import type { UnifiedTimelineItem } from '../../unified/timelineitem'
import { UnifiedTimelineItemActions } from '../../unified/timelineitem'
import type { UnifiedTrack } from '../../unified/track'

/**
 * 统一时间轴模块
 * 基于重构文档的统一类型设计理念
 * 
 * 核心设计理念：
 * - 状态驱动的统一架构：与UnifiedTimelineItem完美集成
 * - 响应式数据结构：核心数据 + 行为函数 + 查询函数
 * - 类型安全：完整的TypeScript类型定义
 * - 无状态操作：所有操作都是纯函数，便于测试和维护
 */

// ==================== 时间轴操作结果类型 ====================

export interface TimelineOperationResult {
  success: boolean
  message?: string
  data?: any
}

export interface TimelineItemPosition {
  timelineStartTime: number  // 微秒
  timelineEndTime: number    // 微秒
}

export interface TimelineItemTransform {
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  opacity?: number
  zIndex?: number
}

// ==================== 统一时间轴模块 ====================

/**
 * 创建统一时间轴模块
 * 负责管理时间轴项目的生命周期和状态
 */
export function createUnifiedTimelineModule(
  trackModule?: { tracks: Ref<UnifiedTrack[]> }
) {
  // ==================== 状态定义 ====================

  // 时间轴项目列表 - 使用响应式数据
  const timelineItems = ref<UnifiedTimelineItem[]>([])

  // ==================== 工具函数 ====================

  /**
   * 更新时间轴项目的时间戳
   */
  function updateItemTimestamp(item: UnifiedTimelineItem): void {
    // 注意：BasicTimelineConfig 没有 metadata 字段
    // 时间戳更新可以通过其他方式实现，比如在状态上下文中
    console.log('📝 更新时间轴项目时间戳:', item.id, new Date().toISOString())
  }

  /**
   * 查找可用的轨道
   */
  function findAvailableTrack(mediaType: string): string | undefined {
    if (!trackModule) return undefined
    
    // 根据媒体类型查找合适的轨道
    const suitableTrack = trackModule.tracks.value.find(track => {
      if (mediaType === 'video' && track.type === 'video') return true
      if (mediaType === 'audio' && track.type === 'audio') return true
      if (mediaType === 'text' && track.type === 'text') return true
      return false
    })
    
    return suitableTrack?.id || trackModule.tracks.value[0]?.id
  }

  /**
   * 检查时间轴项目是否有视觉属性
   */
  function hasVisualProps(item: UnifiedTimelineItem): boolean {
    const config = item.config.mediaConfig
    return config && typeof config === 'object' && 'x' in config && 'y' in config
  }

  /**
   * 验证时间轴项目配置
   */
  function validateTimelineItem(item: UnifiedTimelineItem): TimelineOperationResult {
    const errors: string[] = []

    // 检查基本属性
    if (!item.id) errors.push('时间轴项目ID不能为空')
    if (!item.mediaItemId) errors.push('媒体项目ID不能为空')
    if (!item.config.name) errors.push('时间轴项目名称不能为空')

    // 检查时间范围
    if (item.timeRange.timelineStartTime < 0) {
      errors.push('开始时间不能为负数')
    }
    if (item.timeRange.timelineEndTime <= item.timeRange.timelineStartTime) {
      errors.push('结束时间必须大于开始时间')
    }

    // 检查轨道ID
    if (trackModule && item.trackId) {
      const trackExists = trackModule.tracks.value.some(track => track.id === item.trackId)
      if (!trackExists) {
        errors.push(`轨道不存在: ${item.trackId}`)
      }
    }

    return {
      success: errors.length === 0,
      message: errors.length > 0 ? errors.join('; ') : undefined,
    }
  }

  // ==================== 时间轴项目管理方法 ====================

  /**
   * 添加时间轴项目
   * @param item 要添加的时间轴项目
   * @returns 操作结果
   */
  function addTimelineItem(item: UnifiedTimelineItem): TimelineOperationResult {
    // 验证项目配置
    const validation = validateTimelineItem(item)
    if (!validation.success) {
      console.warn('⚠️ 时间轴项目配置无效:', validation.message)
      return validation
    }

    // 如果没有指定轨道，自动分配
    if (!item.trackId) {
      const availableTrackId = findAvailableTrack(item.mediaType)
      if (availableTrackId) {
        item.trackId = availableTrackId
      } else {
        return {
          success: false,
          message: '没有可用的轨道',
        }
      }
    }

    // 检查ID是否已存在
    const existingItem = timelineItems.value.find(existing => existing.id === item.id)
    if (existingItem) {
      return {
        success: false,
        message: `时间轴项目ID已存在: ${item.id}`,
      }
    }

    // 根据轨道状态设置项目属性
    if (trackModule && item.trackId) {
      const track = trackModule.tracks.value.find(t => t.id === item.trackId)
      if (track) {
        // 根据轨道可见性设置sprite可见性
        if (item.sprite && 'visible' in item.sprite) {
          item.sprite.visible = track.isVisible
        }

        // 根据轨道静音状态设置sprite静音
        if (item.sprite && 'setTrackMuteChecker' in item.sprite) {
          const sprite = item.sprite as any
          sprite.setTrackMuteChecker(() => track.isMuted)
        }
      }
    }

    // 添加到列表
    timelineItems.value.push(item)

    console.log('✅ 添加时间轴项目:', {
      id: item.id,
      name: item.config.name,
      mediaType: item.mediaType,
      trackId: item.trackId,
      status: item.timelineStatus,
      startTime: item.timeRange.timelineStartTime,
      endTime: item.timeRange.timelineEndTime,
    })

    return {
      success: true,
      data: item,
    }
  }

  /**
   * 移除时间轴项目
   * @param itemId 要移除的项目ID
   * @returns 操作结果
   */
  function removeTimelineItem(itemId: string): TimelineOperationResult {
    const index = timelineItems.value.findIndex(item => item.id === itemId)
    if (index === -1) {
      return {
        success: false,
        message: `时间轴项目不存在: ${itemId}`,
      }
    }

    const item = timelineItems.value[index]

    // 清理sprite资源
    if (item.sprite && typeof item.sprite.destroy === 'function') {
      try {
        item.sprite.destroy()
      } catch (error) {
        console.warn('清理sprite资源时出错:', error)
      }
    }

    // 从列表中移除
    timelineItems.value.splice(index, 1)

    console.log('🗑️ 移除时间轴项目:', {
      id: itemId,
      name: item.config.name,
      mediaType: item.mediaType,
      trackId: item.trackId,
    })

    return {
      success: true,
      data: item,
    }
  }

  /**
   * 获取时间轴项目
   * @param itemId 项目ID
   * @returns 时间轴项目或undefined
   */
  function getTimelineItem(itemId: string): UnifiedTimelineItem | undefined {
    return timelineItems.value.find(item => item.id === itemId)
  }

  /**
   * 更新时间轴项目位置
   * @param itemId 项目ID
   * @param position 新位置
   * @param newTrackId 新轨道ID（可选）
   * @returns 操作结果
   */
  function updateTimelineItemPosition(
    itemId: string,
    position: TimelineItemPosition,
    newTrackId?: string
  ): TimelineOperationResult {
    const item = getTimelineItem(itemId)
    if (!item) {
      return {
        success: false,
        message: `时间轴项目不存在: ${itemId}`,
      }
    }

    // 验证新位置
    if (position.timelineStartTime < 0) {
      position.timelineStartTime = 0
    }
    if (position.timelineEndTime <= position.timelineStartTime) {
      return {
        success: false,
        message: '结束时间必须大于开始时间',
      }
    }

    const oldPosition = { ...item.timeRange }
    const oldTrackId = item.trackId

    // 更新轨道
    if (newTrackId !== undefined && newTrackId !== item.trackId) {
      if (trackModule) {
        const newTrack = trackModule.tracks.value.find(t => t.id === newTrackId)
        if (!newTrack) {
          return {
            success: false,
            message: `轨道不存在: ${newTrackId}`,
          }
        }
        
        item.trackId = newTrackId

        // 根据新轨道状态更新sprite属性
        if (item.sprite && 'visible' in item.sprite) {
          item.sprite.visible = newTrack.isVisible
        }
        if (item.sprite && 'setTrackMuteChecker' in item.sprite) {
          const sprite = item.sprite as any
          sprite.setTrackMuteChecker(() => newTrack.isMuted)
        }
      }
    }

    // 更新时间范围
    item.timeRange = { ...position }

    // 如果有sprite，同步更新sprite的时间范围
    if (item.sprite && typeof item.sprite.setTimeRange === 'function') {
      item.sprite.setTimeRange(position)
    }

    updateItemTimestamp(item)

    console.log('📍 更新时间轴项目位置:', {
      id: itemId,
      name: item.config.name,
      oldPosition,
      newPosition: position,
      oldTrackId,
      newTrackId: item.trackId,
      positionChanged: oldPosition.timelineStartTime !== position.timelineStartTime ||
                      oldPosition.timelineEndTime !== position.timelineEndTime,
      trackChanged: oldTrackId !== item.trackId,
    })

    return {
      success: true,
      data: item,
    }
  }

  /**
   * 更新时间轴项目变换属性
   * @param itemId 项目ID
   * @param transform 变换属性
   * @returns 操作结果
   */
  function updateTimelineItemTransform(
    itemId: string,
    transform: TimelineItemTransform
  ): TimelineOperationResult {
    const item = getTimelineItem(itemId)
    if (!item) {
      return {
        success: false,
        message: `时间轴项目不存在: ${itemId}`,
      }
    }

    // 检查项目是否支持变换属性
    if (!hasVisualProps(item)) {
      return {
        success: false,
        message: '该时间轴项目不支持视觉变换属性',
      }
    }

    const config = item.config.mediaConfig
    if (!config || !('x' in config)) {
      return {
        success: false,
        message: '时间轴项目配置不支持变换属性',
      }
    }

    // 更新配置
    if (transform.x !== undefined) config.x = transform.x
    if (transform.y !== undefined) config.y = transform.y
    if (transform.width !== undefined) config.width = transform.width
    if (transform.height !== undefined) config.height = transform.height
    if (transform.rotation !== undefined) config.rotation = transform.rotation
    if (transform.opacity !== undefined) config.opacity = transform.opacity
    if (transform.zIndex !== undefined) config.zIndex = transform.zIndex

    // 如果有sprite，同步更新sprite属性
    if (item.sprite) {
      try {
        if (transform.x !== undefined || transform.y !== undefined) {
          if ('rect' in item.sprite) {
            const sprite = item.sprite as any
            if (transform.x !== undefined) sprite.rect.x = transform.x
            if (transform.y !== undefined) sprite.rect.y = transform.y
          }
        }

        if (transform.width !== undefined || transform.height !== undefined) {
          if ('rect' in item.sprite) {
            const sprite = item.sprite as any
            if (transform.width !== undefined) sprite.rect.w = transform.width
            if (transform.height !== undefined) sprite.rect.h = transform.height
          }
        }

        if (transform.rotation !== undefined && 'rect' in item.sprite) {
          const sprite = item.sprite as any
          sprite.rect.angle = transform.rotation
        }

        if (transform.opacity !== undefined && 'opacity' in item.sprite) {
          item.sprite.opacity = transform.opacity
        }

        if (transform.zIndex !== undefined && 'zIndex' in item.sprite) {
          item.sprite.zIndex = transform.zIndex
        }
      } catch (error) {
        console.warn('更新sprite属性时出错:', error)
      }
    }

    updateItemTimestamp(item)

    console.log('🎨 更新时间轴项目变换:', {
      id: itemId,
      name: item.config.name,
      transform,
    })

    return {
      success: true,
      data: item,
    }
  }

  /**
   * 更新时间轴项目状态
   * @param itemId 项目ID
   * @param newStatus 新状态
   * @param context 状态上下文
   * @returns 操作结果
   */
  function updateTimelineItemStatus(
    itemId: string,
    newStatus: UnifiedTimelineItem['timelineStatus'],
    context?: any
  ): TimelineOperationResult {
    const item = getTimelineItem(itemId)
    if (!item) {
      return {
        success: false,
        message: `时间轴项目不存在: ${itemId}`,
      }
    }

    // 使用统一行为函数进行状态转换
    const success = UnifiedTimelineItemActions.transitionTo(item, newStatus, context)
    if (!success) {
      return {
        success: false,
        message: `状态转换失败: ${item.timelineStatus} → ${newStatus}`,
      }
    }

    updateItemTimestamp(item)

    console.log('🔄 更新时间轴项目状态:', {
      id: itemId,
      name: item.config.name,
      newStatus,
    })

    return {
      success: true,
      data: item,
    }
  }

  // ==================== 查询方法 ====================

  /**
   * 获取指定轨道上的时间轴项目
   * @param trackId 轨道ID
   * @returns 时间轴项目数组
   */
  function getTimelineItemsByTrack(trackId: string): UnifiedTimelineItem[] {
    return timelineItems.value.filter(item => item.trackId === trackId)
  }

  /**
   * 获取指定媒体类型的时间轴项目
   * @param mediaType 媒体类型
   * @returns 时间轴项目数组
   */
  function getTimelineItemsByMediaType(mediaType: string): UnifiedTimelineItem[] {
    return timelineItems.value.filter(item => item.mediaType === mediaType)
  }

  /**
   * 获取指定状态的时间轴项目
   * @param status 状态
   * @returns 时间轴项目数组
   */
  function getTimelineItemsByStatus(status: UnifiedTimelineItem['timelineStatus']): UnifiedTimelineItem[] {
    return timelineItems.value.filter(item => item.timelineStatus === status)
  }

  /**
   * 获取指定时间范围内的时间轴项目
   * @param startTime 开始时间（微秒）
   * @param endTime 结束时间（微秒）
   * @returns 时间轴项目数组
   */
  function getTimelineItemsInRange(startTime: number, endTime: number): UnifiedTimelineItem[] {
    return timelineItems.value.filter(item => {
      return item.timeRange.timelineStartTime < endTime &&
             item.timeRange.timelineEndTime > startTime
    })
  }

  /**
   * 检查时间轴项目是否与指定时间范围重叠
   * @param itemId 项目ID
   * @param startTime 开始时间（微秒）
   * @param endTime 结束时间（微秒）
   * @returns 是否重叠
   */
  function isTimelineItemOverlapping(itemId: string, startTime: number, endTime: number): boolean {
    const item = getTimelineItem(itemId)
    if (!item) return false

    return item.timeRange.timelineStartTime < endTime &&
           item.timeRange.timelineEndTime > startTime
  }

  /**
   * 获取时间轴项目的总时长
   * @returns 总时长（微秒）
   */
  function getTotalDuration(): number {
    if (timelineItems.value.length === 0) return 0

    const maxEndTime = Math.max(...timelineItems.value.map(item => item.timeRange.timelineEndTime))
    return maxEndTime
  }

  /**
   * 获取时间轴统计信息
   * @returns 统计信息
   */
  function getTimelineStats(): {
    totalItems: number
    byMediaType: Record<string, number>
    byStatus: Record<string, number>
    byTrack: Record<string, number>
    totalDuration: number
  } {
    const stats = {
      totalItems: timelineItems.value.length,
      byMediaType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byTrack: {} as Record<string, number>,
      totalDuration: getTotalDuration(),
    }

    timelineItems.value.forEach(item => {
      // 按媒体类型统计
      stats.byMediaType[item.mediaType] = (stats.byMediaType[item.mediaType] || 0) + 1

      // 按状态统计
      stats.byStatus[item.timelineStatus] = (stats.byStatus[item.timelineStatus] || 0) + 1

      // 按轨道统计
      if (item.trackId) {
        stats.byTrack[item.trackId] = (stats.byTrack[item.trackId] || 0) + 1
      }
    })

    return stats
  }

  // ==================== 批量操作方法 ====================

  /**
   * 批量添加时间轴项目
   * @param items 要添加的时间轴项目数组
   * @returns 操作结果
   */
  function addTimelineItems(items: UnifiedTimelineItem[]): TimelineOperationResult {
    const results: { item: UnifiedTimelineItem; success: boolean; message?: string }[] = []

    for (const item of items) {
      const result = addTimelineItem(item)
      results.push({
        item,
        success: result.success,
        message: result.message,
      })
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount

    console.log(`📦 批量添加时间轴项目: ${successCount}成功, ${failureCount}失败`)

    return {
      success: failureCount === 0,
      message: failureCount > 0 ? `${failureCount}个项目添加失败` : undefined,
      data: results,
    }
  }

  /**
   * 批量移除时间轴项目
   * @param itemIds 要移除的项目ID数组
   * @returns 操作结果
   */
  function removeTimelineItems(itemIds: string[]): TimelineOperationResult {
    const results: { itemId: string; success: boolean; message?: string }[] = []

    for (const itemId of itemIds) {
      const result = removeTimelineItem(itemId)
      results.push({
        itemId,
        success: result.success,
        message: result.message,
      })
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.length - successCount

    console.log(`🗑️ 批量移除时间轴项目: ${successCount}成功, ${failureCount}失败`)

    return {
      success: failureCount === 0,
      message: failureCount > 0 ? `${failureCount}个项目移除失败` : undefined,
      data: results,
    }
  }

  /**
   * 清空所有时间轴项目
   * @returns 操作结果
   */
  function clearAllTimelineItems(): TimelineOperationResult {
    const itemCount = timelineItems.value.length

    // 清理所有sprite资源
    timelineItems.value.forEach(item => {
      if (item.sprite && typeof item.sprite.destroy === 'function') {
        try {
          item.sprite.destroy()
        } catch (error) {
          console.warn('清理sprite资源时出错:', error)
        }
      }
    })

    // 清空数组
    timelineItems.value = []

    console.log(`🗑️ 清空所有时间轴项目: ${itemCount}个项目`)

    return {
      success: true,
      data: { removedCount: itemCount },
    }
  }

  /**
   * 恢复时间轴项目列表（用于项目加载）
   * @param restoredItems 要恢复的时间轴项目数组
   * @returns 操作结果
   */
  function restoreTimelineItems(restoredItems: UnifiedTimelineItem[]): TimelineOperationResult {
    console.log(`📋 开始恢复时间轴项目: ${restoredItems.length}个项目`)

    // 清空现有项目
    clearAllTimelineItems()

    // 添加恢复的项目
    const result = addTimelineItems(restoredItems)

    console.log(`✅ 时间轴项目恢复完成: ${timelineItems.value.length}个项目`)

    return result
  }

  /**
   * 按轨道排序时间轴项目
   * @param trackOrder 轨道顺序数组
   * @returns 排序后的时间轴项目数组
   */
  function sortTimelineItemsByTrack(trackOrder: string[]): UnifiedTimelineItem[] {
    const trackOrderMap = new Map(trackOrder.map((trackId, index) => [trackId, index]))

    return [...timelineItems.value].sort((a, b) => {
      const aOrder = trackOrderMap.get(a.trackId || '') ?? Infinity
      const bOrder = trackOrderMap.get(b.trackId || '') ?? Infinity

      if (aOrder !== bOrder) {
        return aOrder - bOrder
      }

      // 同一轨道内按时间排序
      return a.timeRange.timelineStartTime - b.timeRange.timelineStartTime
    })
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    timelineItems,

    // 核心方法
    addTimelineItem,
    removeTimelineItem,
    getTimelineItem,
    updateTimelineItemPosition,
    updateTimelineItemTransform,
    updateTimelineItemStatus,

    // 查询方法
    getTimelineItemsByTrack,
    getTimelineItemsByMediaType,
    getTimelineItemsByStatus,
    getTimelineItemsInRange,
    isTimelineItemOverlapping,
    getTotalDuration,
    getTimelineStats,

    // 批量操作方法
    addTimelineItems,
    removeTimelineItems,
    clearAllTimelineItems,
    restoreTimelineItems,
    sortTimelineItemsByTrack,

    // 工具函数
    validateTimelineItem,
    findAvailableTrack,
    updateItemTimestamp,
  }
}

// 导出类型定义
export type UnifiedTimelineModule = ReturnType<typeof createUnifiedTimelineModule>

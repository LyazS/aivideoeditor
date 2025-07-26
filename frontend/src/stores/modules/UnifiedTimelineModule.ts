import { ref, type Ref } from 'vue'
import type { UnifiedTimelineItem } from '../../unified/timelineitem'
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
   * 获取已准备好的时间轴项目（可进行操作的项目）
   * @param itemId 项目ID
   * @returns 已准备好的时间轴项目或undefined
   */
  function getReadyTimelineItem(itemId: string): UnifiedTimelineItem | undefined {
    const item = getTimelineItem(itemId)
    // 在统一架构中，只有ready状态的项目才能进行sprite操作
    return item && item.timelineStatus === 'ready' ? item : undefined
  }

  /**
   * 为TimelineItem设置双向数据同步（兼容接口）
   * @param timelineItem TimelineItem实例
   */
  function setupBidirectionalSync(timelineItem: UnifiedTimelineItem) {
    // 在统一架构中，双向同步通过状态管理自动处理
    // 这里提供兼容接口，实际同步逻辑在状态更新时处理
    console.log('🔄 设置双向数据同步:', timelineItem.id)

    // 如果有sprite，设置基本的事件监听
    if (timelineItem.sprite && typeof timelineItem.sprite.on === 'function') {
      timelineItem.sprite.on('propsChange', (changedProps: any) => {
        // 同步属性变化到配置
        if (changedProps.rect && hasVisualProps(timelineItem)) {
          const config = timelineItem.config.mediaConfig
          if (config && 'x' in config) {
            if (changedProps.rect.x !== undefined) config.x = changedProps.rect.x
            if (changedProps.rect.y !== undefined) config.y = changedProps.rect.y
            if (changedProps.rect.w !== undefined) config.width = changedProps.rect.w
            if (changedProps.rect.h !== undefined) config.height = changedProps.rect.h
            if (changedProps.rect.angle !== undefined) config.rotation = changedProps.rect.angle
          }
        }

        if (changedProps.opacity !== undefined && hasVisualProps(timelineItem)) {
          const config = timelineItem.config.mediaConfig
          if (config && 'opacity' in config) {
            config.opacity = changedProps.opacity
          }
        }

        if (changedProps.zIndex !== undefined) {
          const config = timelineItem.config.mediaConfig
          if (config && 'zIndex' in config) {
            config.zIndex = changedProps.zIndex
          }
        }
      })
    }
  }

  /**
   * 更新时间轴项目的sprite（仅限已准备好的项目）
   * @param timelineItemId 时间轴项目ID
   * @param newSprite 新的sprite实例
   */
  function updateTimelineItemSprite(timelineItemId: string, newSprite: any) {
    const item = getReadyTimelineItem(timelineItemId)
    if (!item) {
      console.warn('⚠️ 时间轴项目不存在:', timelineItemId)
      return
    }

    // 清理旧的sprite资源
    if (item.sprite && typeof item.sprite.destroy === 'function') {
      try {
        item.sprite.destroy()
      } catch (error) {
        console.warn('清理旧sprite资源时出错:', error)
      }
    }

    // 更新sprite引用
    item.sprite = newSprite

    // 重新设置双向同步
    setupBidirectionalSync(item)

    console.log('🔄 更新时间轴项目sprite:', {
      id: timelineItemId,
      name: item.config.name,
      trackId: item.trackId,
    })
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
   * 更新时间轴项目变换属性（仅限已准备好的项目）
   * @param itemId 项目ID
   * @param transform 变换属性
   */
  function updateTimelineItemTransform(
    itemId: string,
    transform: TimelineItemTransform
  ) {
    const item = getTimelineItem(itemId)
    if (!item) {
      console.warn('⚠️ 时间轴项目不存在:', itemId)
      return
    }

    // 检查项目是否支持变换属性
    if (!hasVisualProps(item)) {
      console.warn('⚠️ 该时间轴项目不支持视觉变换属性:', itemId)
      return
    }

    const config = item.config.mediaConfig
    if (!config || !('x' in config)) {
      console.warn('⚠️ 时间轴项目配置不支持变换属性:', itemId)
      return
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
  }



  // ==================== 导出接口 ====================

  return {
    // 状态
    timelineItems,

    // 方法
    addTimelineItem,
    removeTimelineItem,
    getTimelineItem,
    getReadyTimelineItem,
    setupBidirectionalSync,
    updateTimelineItemPosition,
    updateTimelineItemSprite,
    updateTimelineItemTransform,
  }
}

// 导出类型定义
export type UnifiedTimelineModule = ReturnType<typeof createUnifiedTimelineModule>

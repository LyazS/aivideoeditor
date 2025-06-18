import type { TimelineItem } from '../../types/videoTypes'
import type { OperationSystemManager } from '../operations'

/**
 * 操作迁移助手
 * 帮助从旧的命令系统平滑迁移到新的操作系统
 */
export class OperationMigrationHelper {
  constructor(private systemManager: OperationSystemManager) {}

  // ==================== 时间轴项目操作迁移 ====================

  /**
   * 迁移：添加时间轴项目
   */
  async addTimelineItemWithHistory(timelineItem: TimelineItem): Promise<void> {
    console.log('🔄 迁移操作：添加时间轴项目 ->', timelineItem.id)
    
    // 构建操作数据
    const itemData = {
      id: timelineItem.id,
      mediaItemId: timelineItem.mediaItemId,
      trackId: timelineItem.trackId,
      mediaType: timelineItem.mediaType,
      timeRange: { ...timelineItem.timeRange },
      position: { ...timelineItem.position },
      size: { ...timelineItem.size },
      rotation: timelineItem.rotation,
      zIndex: timelineItem.zIndex,
      opacity: timelineItem.opacity,
      thumbnailUrl: timelineItem.thumbnailUrl,
      volume: timelineItem.volume || 1.0,
      isMuted: timelineItem.isMuted || false
    }

    // 使用新系统执行操作
    const result = await this.systemManager.addTimelineItem(itemData)
    
    if (!result.success) {
      throw new Error(result.error || '添加时间轴项目失败')
    }
  }

  /**
   * 迁移：删除时间轴项目
   */
  async removeTimelineItemWithHistory(timelineItemId: string): Promise<void> {
    console.log('🔄 迁移操作：删除时间轴项目 ->', timelineItemId)
    
    const result = await this.systemManager.removeTimelineItem(timelineItemId)
    
    if (!result.success) {
      throw new Error(result.error || '删除时间轴项目失败')
    }
  }

  /**
   * 迁移：移动时间轴项目
   */
  async moveTimelineItemWithHistory(
    timelineItemId: string,
    fromTime: number,
    toTime: number,
    fromTrackId?: number,
    toTrackId?: number
  ): Promise<void> {
    console.log('🔄 迁移操作：移动时间轴项目 ->', timelineItemId)
    
    const from = { time: fromTime, trackId: fromTrackId }
    const to = { time: toTime, trackId: toTrackId }
    
    const result = await this.systemManager.moveTimelineItem(timelineItemId, from, to)
    
    if (!result.success) {
      throw new Error(result.error || '移动时间轴项目失败')
    }
  }

  /**
   * 迁移：更新时间轴项目变换属性
   */
  async updateTimelineItemTransformWithHistory(
    timelineItemId: string,
    newTransform: {
      position?: { x: number; y: number }
      size?: { width: number; height: number }
      rotation?: number
      opacity?: number
      zIndex?: number
      duration?: number
      playbackRate?: number
      volume?: number
      isMuted?: boolean
    }
  ): Promise<void> {
    console.log('🔄 迁移操作：更新时间轴项目变换属性 ->', timelineItemId)
    
    // 获取当前项目状态作为oldTransform
    const currentItem = this.systemManager.context.timeline.getItem(timelineItemId)
    if (!currentItem) {
      throw new Error(`时间轴项目不存在: ${timelineItemId}`)
    }

    const oldTransform = {
      position: currentItem.position,
      size: currentItem.size,
      rotation: currentItem.rotation,
      opacity: currentItem.opacity,
      zIndex: currentItem.zIndex,
      volume: currentItem.volume,
      isMuted: currentItem.isMuted
    }

    const result = await this.systemManager.transformTimelineItem(
      timelineItemId,
      oldTransform,
      newTransform
    )
    
    if (!result.success) {
      throw new Error(result.error || '更新时间轴项目变换属性失败')
    }
  }

  // ==================== 轨道操作迁移 ====================

  /**
   * 迁移：添加轨道
   */
  async addTrackWithHistory(name?: string): Promise<number | null> {
    console.log('🔄 迁移操作：添加轨道 ->', name || '新轨道')
    
    const result = await this.systemManager.addTrack(name)
    
    if (!result.success) {
      console.error('添加轨道失败:', result.error)
      return null
    }

    // 从结果中提取轨道ID
    const track = result.data?.track
    return track?.id || null
  }

  /**
   * 迁移：删除轨道
   */
  async removeTrackWithHistory(trackId: number): Promise<boolean> {
    console.log('🔄 迁移操作：删除轨道 ->', trackId)
    
    const result = await this.systemManager.removeTrack(trackId)
    
    if (!result.success) {
      console.error('删除轨道失败:', result.error)
      return false
    }

    return true
  }

  /**
   * 迁移：自动排列轨道
   */
  async autoArrangeTrackWithHistory(trackId: number): Promise<boolean> {
    console.log('🔄 迁移操作：自动排列轨道 ->', trackId)
    
    const result = await this.systemManager.autoArrange(trackId)
    
    if (!result.success) {
      console.error('自动排列轨道失败:', result.error)
      return false
    }

    return true
  }

  // ==================== 复杂操作迁移 ====================

  /**
   * 迁移：分割时间轴项目
   * 注意：这是一个复合操作，需要分解为删除原项目和添加两个新项目
   */
  async splitTimelineItemAtTimeWithHistory(
    timelineItemId: string,
    splitTime: number
  ): Promise<string | null> {
    console.log('🔄 迁移操作：分割时间轴项目 ->', timelineItemId, 'at', splitTime)
    
    // 获取原始项目
    const originalItem = this.systemManager.context.timeline.getItem(timelineItemId)
    if (!originalItem) {
      throw new Error(`时间轴项目不存在: ${timelineItemId}`)
    }

    // 检查是否为视频类型
    if (originalItem.mediaType !== 'video') {
      throw new Error('只有视频片段支持分割操作')
    }

    // 计算分割点
    const timelineStartTime = originalItem.timeRange.timelineStartTime / 1000000
    const timelineEndTime = originalItem.timeRange.timelineEndTime / 1000000

    if (splitTime <= timelineStartTime || splitTime >= timelineEndTime) {
      throw new Error('分割时间不在项目范围内')
    }

    try {
      // 创建第一个片段的数据
      const firstItemId = `${timelineItemId}_split_1_${Date.now()}`
      const firstItemData = {
        ...originalItem,
        id: firstItemId,
        timeRange: {
          ...originalItem.timeRange,
          timelineEndTime: splitTime * 1000000
        }
      }

      // 创建第二个片段的数据
      const secondItemId = `${timelineItemId}_split_2_${Date.now()}`
      const secondItemData = {
        ...originalItem,
        id: secondItemId,
        timeRange: {
          ...originalItem.timeRange,
          timelineStartTime: splitTime * 1000000
        }
      }

      // 使用批量操作：删除原项目，添加两个新项目
      const operations = [
        this.systemManager.factory.createTimelineItemRemove(timelineItemId),
        this.systemManager.factory.createTimelineItemAdd(firstItemData),
        this.systemManager.factory.createTimelineItemAdd(secondItemData)
      ]

      const result = await this.systemManager.executeBatch(operations, 'transactional')
      
      if (!result.success) {
        throw new Error(result.error || '分割操作失败')
      }

      return secondItemId // 返回第二个片段的ID
    } catch (error) {
      console.error('分割时间轴项目失败:', error)
      return null
    }
  }

  /**
   * 迁移：复制时间轴项目
   */
  async duplicateTimelineItemWithHistory(
    timelineItemId: string,
    offsetTime?: number
  ): Promise<string | null> {
    console.log('🔄 迁移操作：复制时间轴项目 ->', timelineItemId)
    
    // 获取原始项目
    const originalItem = this.systemManager.context.timeline.getItem(timelineItemId)
    if (!originalItem) {
      throw new Error(`时间轴项目不存在: ${timelineItemId}`)
    }

    try {
      // 创建新项目的数据
      const newItemId = `${timelineItemId}_copy_${Date.now()}`
      const duration = (originalItem.timeRange.timelineEndTime - originalItem.timeRange.timelineStartTime) / 1000000
      const newStartTime = offsetTime !== undefined 
        ? offsetTime * 1000000
        : originalItem.timeRange.timelineEndTime // 默认紧接在原项目后面

      const newItemData = {
        ...originalItem,
        id: newItemId,
        timeRange: {
          ...originalItem.timeRange,
          timelineStartTime: newStartTime,
          timelineEndTime: newStartTime + (duration * 1000000)
        }
      }

      const result = await this.systemManager.addTimelineItem(newItemData)
      
      if (!result.success) {
        throw new Error(result.error || '复制操作失败')
      }

      return newItemId
    } catch (error) {
      console.error('复制时间轴项目失败:', error)
      return null
    }
  }

  // ==================== 历史记录操作迁移 ====================

  /**
   * 迁移：撤销操作
   */
  async undo(): Promise<boolean> {
    return await this.systemManager.undo() !== null
  }

  /**
   * 迁移：重做操作
   */
  async redo(): Promise<boolean> {
    return await this.systemManager.redo() !== null
  }

  /**
   * 迁移：清空历史记录
   */
  clear(): void {
    this.systemManager.clearHistory()
  }

  /**
   * 迁移：获取历史摘要
   */
  getHistorySummary(): any {
    return this.systemManager.history.getHistorySummary()
  }

  // ==================== 状态访问 ====================

  /**
   * 获取是否可以撤销
   */
  get canUndo(): boolean {
    return this.systemManager.history.canUndo.value
  }

  /**
   * 获取是否可以重做
   */
  get canRedo(): boolean {
    return this.systemManager.history.canRedo.value
  }
}

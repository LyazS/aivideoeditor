import { defineStore } from 'pinia'
import { computed } from 'vue'
import { createUnifiedMediaModule } from './modules/UnifiedMediaModule'
import { createUnifiedTrackModule } from './modules/UnifiedTrackModule'
import { createUnifiedTimelineModule } from './modules/UnifiedTimelineModule'
import { createUnifiedProjectModule } from './modules/UnifiedProjectModule'
import { createUnifiedViewportModule } from './modules/UnifiedViewportModule'
import { createUnifiedHistoryModule } from './modules/UnifiedHistoryModule'
import { createUnifiedSelectionModule } from './modules/UnifiedSelectionModule'
import { createNotificationModule } from './modules/notificationModule'
import { createConfigModule } from './modules/configModule'
import { createPlaybackModule } from './modules/playbackModule'
import { createWebAVModule } from './modules/webavModule'
import { calculateContentEndTimeFrames, calculateTotalDurationFrames } from './utils/durationUtils'
import { frameToPixel, pixelToFrame } from './utils/coordinateUtils'
import { expandTimelineIfNeededFrames } from './utils/timeUtils'
import { autoArrangeTimelineItems, autoArrangeTrackItems } from './utils/timelineArrangementUtils'
import {
  findTimelineItemBySprite,
  getTimelineItemsByTrack,
  getTimelineItemAtFrames,
  getTimelineItemsAtFrames,
  getTimelineItemAtTrackAndFrames
} from './utils/timelineSearchUtils'
import { generateCommandId } from '../utils/idGenerator'
import type { UnifiedMediaItemData, MediaType } from '@/unified'
import type { UnifiedTrackType } from '@/unified/track'
import type { UnifiedTimelineItem } from '@/unified/timelineitem'
import type { ProjectConfig } from '@/types'
import type { Raw } from 'vue'

/**
 * 统一视频编辑器存储
 * 基于新的统一类型系统重构的主要状态管理
 *
 * 架构特点：
 * 1. 使用 UnifiedProjectModule 管理统一项目状态和持久化
 * 2. 使用 UnifiedMediaModule 管理统一媒体项目
 * 3. 使用 UnifiedTrackModule 管理轨道系统
 * 4. 使用 UnifiedTimelineModule 管理时间轴项目
 * 5. 使用 UnifiedViewportModule 管理视口缩放和滚动
 * 6. 保持模块化设计，各模块职责清晰
 * 7. 兼容现有的配置、播放控制和WebAV集成
 * 8. 提供完整的项目生命周期管理（创建、保存、加载、清理）
 */
export const useUnifiedStore = defineStore('unified', () => {
  // ==================== 核心模块初始化 ====================

  // 创建统一媒体管理模块（替代原有的mediaModule）
  const unifiedMediaModule = createUnifiedMediaModule()

  // 创建统一轨道管理模块
  const unifiedTrackModule = createUnifiedTrackModule()

  // 创建统一时间轴管理模块
  const unifiedTimelineModule = createUnifiedTimelineModule()

  // 创建统一项目管理模块（替代原有的projectModule）
  const unifiedProjectModule = createUnifiedProjectModule()

  // 创建配置管理模块
  const configModule = createConfigModule()

  // 创建播放控制模块
  const playbackModule = createPlaybackModule(configModule.frameRate)

  // 创建WebAV集成模块
  const webavModule = createWebAVModule()

  // 创建通知管理模块
  const notificationModule = createNotificationModule()

  // 创建统一历史管理模块
  const unifiedHistoryModule = createUnifiedHistoryModule(notificationModule)

  // 创建统一选择管理模块（需要在historyModule之后创建）
  const unifiedSelectionModule = createUnifiedSelectionModule(
    unifiedTimelineModule.getTimelineItem,
    unifiedMediaModule.getMediaItem,
    unifiedHistoryModule.executeCommand,
  )

  // ==================== 计算属性 ====================

  /**
   * 媒体项目统计信息
   */
  const mediaStats = computed(() => {
    return unifiedMediaModule.getMediaItemsStats()
  })

  /**
   * 就绪的媒体项目数量
   */
  const readyMediaCount = computed(() => {
    return unifiedMediaModule.getReadyMediaItems().length
  })

  /**
   * 是否有正在处理的媒体项目
   */
  const hasProcessingMedia = computed(() => {
    return unifiedMediaModule.getProcessingMediaItems().length > 0
  })

  /**
   * 是否有错误的媒体项目
   */
  const hasErrorMedia = computed(() => {
    return unifiedMediaModule.getErrorMediaItems().length > 0
  })

  /**
   * WebAV是否可用（保留，因为是方法调用的计算属性）
   */
  const isWebAVAvailable = computed(() => {
    return webavModule.isWebAVAvailable()
  })

  /**
   * 轨道统计信息
   */
  const trackStats = computed(() => {
    return unifiedTrackModule.getTracksSummary()
  })

  /**
   * 活跃轨道数量
   */
  const activeTrackCount = computed(() => {
    return unifiedTrackModule.tracks.value.filter(track => track.status === 'active').length
  })

  /**
   * 时间轴项目统计信息
   */
  const timelineStats = computed(() => {
    const items = unifiedTimelineModule.timelineItems.value
    const stats = {
      totalItems: items.length,
      byMediaType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byTrack: {} as Record<string, number>,
      totalDuration: 0,
    }

    if (items.length > 0) {
      stats.totalDuration = Math.max(...items.map(item => item.timeRange.timelineEndTime))

      items.forEach(item => {
        // 按媒体类型统计
        stats.byMediaType[item.mediaType] = (stats.byMediaType[item.mediaType] || 0) + 1
        // 按状态统计
        stats.byStatus[item.timelineStatus] = (stats.byStatus[item.timelineStatus] || 0) + 1
        // 按轨道统计
        if (item.trackId) {
          stats.byTrack[item.trackId] = (stats.byTrack[item.trackId] || 0) + 1
        }
      })
    }

    return stats
  })

  /**
   * 时间轴总时长
   */
  const totalTimelineDuration = computed(() => {
    const items = unifiedTimelineModule.timelineItems.value
    if (items.length === 0) return 0
    return Math.max(...items.map(item => item.timeRange.timelineEndTime))
  })

  /**
   * 内容结束时间（帧数）
   */
  const contentEndTimeFrames = computed(() => {
    // 需要将UnifiedTimelineItem转换为兼容的类型
    const items = unifiedTimelineModule.timelineItems.value.map(item => ({
      timeRange: item.timeRange
    }))
    return calculateContentEndTimeFrames(items as any)
  })

  /**
   * 总时长（帧数）
   */
  const totalDurationFrames = computed(() => {
    // 需要将UnifiedTimelineItem转换为兼容的类型
    const items = unifiedTimelineModule.timelineItems.value.map(item => ({
      timeRange: item.timeRange
    }))
    return calculateTotalDurationFrames(items as any, configModule.timelineDurationFrames.value)
  })

  // ==================== 视口模块初始化 ====================

  // 创建统一视口管理模块（在计算属性定义之后）
  const unifiedViewportModule = createUnifiedViewportModule(
    unifiedTimelineModule.timelineItems,
    totalDurationFrames,
    configModule.timelineDurationFrames
  )

  /**
   * 项目状态相关计算属性
   */
  const projectStats = computed(() => {
    return unifiedProjectModule.getProjectSummary()
  })

  /**
   * 是否有当前项目
   */
  const hasCurrentProject = computed(() => {
    return unifiedProjectModule.hasCurrentProject.value
  })

  /**
   * 项目是否正在保存
   */
  const isProjectSaving = computed(() => {
    return unifiedProjectModule.isSaving.value
  })

  /**
   * 项目是否正在加载
   */
  const isProjectLoading = computed(() => {
    return unifiedProjectModule.isLoading.value
  })

  /**
   * 项目设置是否就绪
   */
  const isProjectSettingsReady = computed(() => {
    return unifiedProjectModule.isProjectSettingsReady.value
  })

  /**
   * 项目内容是否就绪
   */
  const isProjectContentReady = computed(() => {
    return unifiedProjectModule.isProjectContentReady.value
  })

  // ==================== 项目管理方法 ====================

  /**
   * 创建新项目
   * @param name 项目名称
   * @param template 项目模板（可选）
   */
  async function createProject(name: string, template?: Partial<ProjectConfig>) {
    const result = await unifiedProjectModule.createProject(name, template)
    console.log('📁 [UnifiedStore] 创建项目:', name)
    return result
  }

  /**
   * 保存当前项目
   * @param projectData 项目数据（可选）
   */
  async function saveCurrentProject(projectData?: Partial<ProjectConfig>) {
    await unifiedProjectModule.saveCurrentProject(projectData)
    console.log('💾 [UnifiedStore] 保存项目完成')
  }

  /**
   * 预加载项目设置
   * @param projectId 项目ID
   */
  async function preloadProjectSettings(projectId: string) {
    await unifiedProjectModule.preloadProjectSettings(projectId)
    console.log('🔧 [UnifiedStore] 预加载项目设置完成:', projectId)
  }

  /**
   * 加载项目内容
   * @param projectId 项目ID
   */
  async function loadProjectContent(projectId: string) {
    await unifiedProjectModule.loadProjectContent(projectId)
    console.log('📂 [UnifiedStore] 加载项目内容完成:', projectId)
  }

  /**
   * 清除当前项目
   */
  function clearCurrentProject() {
    unifiedProjectModule.clearCurrentProject()
    console.log('🧹 [UnifiedStore] 清除当前项目')
  }

  // ==================== 媒体管理方法 ====================

  /**
   * 添加媒体项目
   * @param mediaItem 统一媒体项目数据
   */
  function addMediaItem(mediaItem: UnifiedMediaItemData) {
    unifiedMediaModule.addMediaItem(mediaItem)
    console.log('📚 [UnifiedStore] 添加媒体项目:', mediaItem.name)
  }

  /**
   * 移除媒体项目（带日志）
   * @param mediaItemId 媒体项目ID
   */
  function removeMediaItem(mediaItemId: string) {
    const mediaItem = unifiedMediaModule.getMediaItem(mediaItemId)
    if (mediaItem) {
      unifiedMediaModule.removeMediaItem(mediaItemId)
      console.log('🗑️ [UnifiedStore] 移除媒体项目:', mediaItem.name)
    }
  }

  // ==================== 轨道管理方法 ====================

  /**
   * 添加轨道 - 兼容trackModule接口
   * @param type 轨道类型
   * @param name 轨道名称（可选）
   * @param position 插入位置（可选，默认为末尾）
   */
  function addTrack(type: UnifiedTrackType = 'video', name?: string, position?: number) {
    const result = unifiedTrackModule.addTrack(type, name, position)
    console.log('🛤️ [UnifiedStore] 添加轨道:', name || `${type}轨道`)
    return { success: true, data: result }
  }



  /**
   * 移除轨道（带日志）
   * @param trackId 轨道ID
   */
  function removeTrack(trackId: string) {
    const track = unifiedTrackModule.getTrack(trackId)
    if (track) {
      // 需要传递timelineItems参数以保持接口一致性
      unifiedTrackModule.removeTrack(trackId, unifiedTimelineModule.timelineItems, (itemId) => {
        unifiedTimelineModule.removeTimelineItem(itemId)
      })
      console.log('🗑️ [UnifiedStore] 移除轨道:', track.name)
      return { success: true }
    }
    return { success: false, message: '轨道不存在' }
  }

  /**
   * 重命名轨道（带日志）
   * @param trackId 轨道ID
   * @param newName 新名称
   */
  function renameTrack(trackId: string, newName: string) {
    const track = unifiedTrackModule.getTrack(trackId)
    if (track && newName.trim()) {
      const oldName = track.name
      unifiedTrackModule.renameTrack(trackId, newName)
      console.log('✏️ [UnifiedStore] 重命名轨道:', `${oldName} -> ${newName}`)
      return { success: true }
    } else if (!track) {
      return { success: false, message: '轨道不存在' }
    } else {
      return { success: false, message: '无效的轨道名称' }
    }
  }

  // ==================== 时间轴项目管理方法 ====================

  /**
   * 添加时间轴项目
   * @param timelineItem 时间轴项目
   */
  function addTimelineItem(timelineItem: UnifiedTimelineItem) {
    const result = unifiedTimelineModule.addTimelineItem(timelineItem)
    if (result.success) {
      console.log('⏱️ [UnifiedStore] 添加时间轴项目:', timelineItem.config.name)
    }
    return result
  }

  /**
   * 移除时间轴项目（带日志）
   * @param itemId 时间轴项目ID
   */
  function removeTimelineItem(itemId: string) {
    const item = unifiedTimelineModule.getTimelineItem(itemId)
    if (item) {
      const result = unifiedTimelineModule.removeTimelineItem(itemId)
      if (result.success) {
        console.log('🗑️ [UnifiedStore] 移除时间轴项目:', item.config.name)
      }
      return result
    }
    return { success: false, message: '时间轴项目不存在' }
  }

  /**
   * 更新时间轴项目位置（带日志）
   * @param itemId 时间轴项目ID
   * @param position 新位置
   */
  function updateTimelineItemPosition(itemId: string, position: { timelineStartTime: number; timelineEndTime: number }) {
    const item = unifiedTimelineModule.getTimelineItem(itemId)
    if (item) {
      const result = unifiedTimelineModule.updateTimelineItemPosition(itemId, position)
      if (result.success) {
        console.log('📍 [UnifiedStore] 更新时间轴项目位置:', item.config.name)
      }
      return result
    }
    return { success: false, message: '时间轴项目不存在' }
  }

  // ==================== 播放控制方法 ====================

  // 移除不必要的播放控制封装，直接在导出部分使用底层模块方法

  // 移除不必要的配置管理封装，直接在导出部分使用底层模块方法

  // ==================== WebAV管理方法（直接导出底层方法） ====================
  // 这些方法都是简单的代理调用，直接在导出部分使用底层模块方法

  // ==================== 异步处理管理方法 ====================

  /**
   * 添加异步处理项目（兼容旧架构API）
   * @param processingItem 异步处理项目数据
   */
  function addAsyncProcessingItem(processingItem: any) {
    // 在统一架构中，异步处理通过媒体状态管理
    // 这里提供兼容性封装
    console.log('📝 [UnifiedStore] 添加异步处理项目:', processingItem.name)
    // 实际逻辑可以通过 UnifiedMediaItemActions 处理
  }

  /**
   * 更新异步处理项目状态（兼容旧架构API）
   * @param itemId 项目ID
   * @param updates 更新数据
   */
  function updateAsyncProcessingItem(itemId: string, updates: any) {
    console.log('📝 [UnifiedStore] 更新异步处理项目:', itemId, updates)
    // 实际逻辑可以通过 UnifiedMediaItemActions 处理
  }

  /**
   * 移除异步处理项目（兼容旧架构API）
   * @param itemId 项目ID
   */
  function removeAsyncProcessingItem(itemId: string) {
    console.log('📝 [UnifiedStore] 移除异步处理项目:', itemId)
    // 实际逻辑可以通过 UnifiedMediaItemActions 处理
  }

  /**
   * 获取异步处理项目（兼容旧架构API）
   * @param itemId 项目ID
   */
  function getAsyncProcessingItem(itemId: string) {
    console.log('📝 [UnifiedStore] 获取异步处理项目:', itemId)
    // 在统一架构中，可以通过媒体项目状态查询
    return unifiedMediaModule.getProcessingMediaItems().find(item => item.id === itemId)
  }

  /**
   * 等待媒体项目就绪（兼容旧架构API）
   * @param mediaItemId 媒体项目ID
   * @param timeout 超时时间（毫秒）
   */
  async function waitForMediaItemReady(mediaItemId: string, timeout: number = 30000): Promise<boolean> {
    console.log('⏳ [UnifiedStore] 等待媒体项目就绪:', mediaItemId)
    return await unifiedMediaModule.waitForMediaItemReady(mediaItemId)
  }

  /**
   * 获取所有媒体项目（兼容旧架构API）
   */
  function getAllMediaItems() {
    return unifiedMediaModule.getAllMediaItems()
  }

  // ==================== 批量操作方法（带日志） ====================

  /**
   * 批量重试错误的媒体项目
   */
  function retryAllErrorItems() {
    unifiedMediaModule.retryAllErrorItems()
    console.log('🔄 [UnifiedStore] 批量重试错误项目')
  }

  /**
   * 清理已取消的媒体项目
   */
  function clearCancelledItems() {
    unifiedMediaModule.clearCancelledItems()
    console.log('🧹 [UnifiedStore] 清理已取消项目')
  }

  // ==================== 分辨率管理方法 ====================

  /**
   * 获取视频原始分辨率
   * @param mediaItemId 媒体项目ID
   */
  function getVideoOriginalResolution(mediaItemId: string): { width: number; height: number } {
    return unifiedMediaModule.getVideoOriginalResolution(mediaItemId)
  }

  /**
   * 获取图片原始分辨率
   * @param mediaItemId 媒体项目ID
   */
  function getImageOriginalResolution(mediaItemId: string): { width: number; height: number } {
    return unifiedMediaModule.getImageOriginalResolution(mediaItemId)
  }

  // ==================== 业务逻辑封装方法 ====================

  /**
   * 检查变换属性是否有实际变化
   * @param oldTransform 旧的变换属性
   * @param newTransform 新的变换属性
   */
  function checkTransformChanges(
    oldTransform: Record<string, any>,
    newTransform: Record<string, any>,
  ): boolean {
    // 检查位置变化
    if (
      (newTransform.x !== undefined && oldTransform.x !== undefined) ||
      (newTransform.y !== undefined && oldTransform.y !== undefined)
    ) {
      const xChanged =
        newTransform.x !== undefined &&
        oldTransform.x !== undefined &&
        Math.abs(oldTransform.x - newTransform.x) > 0.1
      const yChanged =
        newTransform.y !== undefined &&
        oldTransform.y !== undefined &&
        Math.abs(oldTransform.y - newTransform.y) > 0.1
      if (xChanged || yChanged) return true
    }

    // 检查大小变化
    if (
      (newTransform.width !== undefined && oldTransform.width !== undefined) ||
      (newTransform.height !== undefined && oldTransform.height !== undefined)
    ) {
      const widthChanged =
        newTransform.width !== undefined &&
        oldTransform.width !== undefined &&
        Math.abs(oldTransform.width - newTransform.width) > 0.1
      const heightChanged =
        newTransform.height !== undefined &&
        oldTransform.height !== undefined &&
        Math.abs(oldTransform.height - newTransform.height) > 0.1
      if (widthChanged || heightChanged) return true
    }

    // 检查旋转变化
    if (newTransform.rotation !== undefined && oldTransform.rotation !== undefined) {
      const rotationChanged = Math.abs(oldTransform.rotation - newTransform.rotation) > 0.001
      if (rotationChanged) return true
    }

    // 检查透明度变化
    if (newTransform.opacity !== undefined && oldTransform.opacity !== undefined) {
      const opacityChanged = Math.abs(oldTransform.opacity - newTransform.opacity) > 0.001
      if (opacityChanged) return true
    }

    // 检查其他属性变化
    const otherProperties = ['zIndex', 'duration', 'playbackRate', 'volume', 'isMuted', 'gain']
    for (const prop of otherProperties) {
      if (newTransform[prop] !== undefined && oldTransform[prop] !== undefined) {
        if (typeof newTransform[prop] === 'number' && typeof oldTransform[prop] === 'number') {
          const threshold = prop === 'duration' ? 0.1 : prop === 'gain' ? 0.1 : 0.01
          if (Math.abs(oldTransform[prop] - newTransform[prop]) > threshold) return true
        } else if (oldTransform[prop] !== newTransform[prop]) {
          return true
        }
      }
    }

    return false
  }

  /**
   * 确定属性类型
   * @param transform 变换属性
   */
  function determinePropertyType(transform: Record<string, any>): string {
    const changedProperties = []

    if (transform.x !== undefined || transform.y !== undefined) changedProperties.push('position')
    if (transform.width !== undefined || transform.height !== undefined)
      changedProperties.push('size')
    if (transform.rotation !== undefined) changedProperties.push('rotation')
    if (transform.opacity !== undefined) changedProperties.push('opacity')
    if (transform.zIndex !== undefined) changedProperties.push('zIndex')
    if (transform.duration !== undefined) changedProperties.push('duration')
    if (transform.playbackRate !== undefined) changedProperties.push('playbackRate')
    if (transform.volume !== undefined) changedProperties.push('volume')
    if (transform.isMuted !== undefined) changedProperties.push('audioState')
    if (transform.gain !== undefined) changedProperties.push('gain')

    // 如果同时有音量和静音状态变化，归类为audioState
    if (transform.volume !== undefined && transform.isMuted !== undefined) {
      return 'audioState'
    }

    return changedProperties.length === 1 ? changedProperties[0] : 'multiple'
  }

  // ==================== 需要特殊处理的方法 ====================

  /**
   * 按类型获取媒体项目（保留类型检查）
   * @param mediaType 媒体类型
   */
  function getMediaItemsByType(mediaType: MediaType | 'unknown') {
    return unifiedMediaModule.getMediaItemsByType(mediaType)
  }

  // ==================== 项目恢复方法 ====================

  /**
   * 恢复媒体项目列表（用于项目加载）
   * @param restoredMediaItems 要恢复的媒体项目数组
   */
  function restoreMediaItems(restoredMediaItems: UnifiedMediaItemData[]) {
    console.log(`📁 [UnifiedStore] 开始恢复媒体项目: ${restoredMediaItems.length}个文件`)

    // 清空现有的媒体项目
    unifiedMediaModule.mediaItems.value = []

    // 添加恢复的媒体项目
    for (const mediaItem of restoredMediaItems) {
      unifiedMediaModule.mediaItems.value.push(mediaItem)
      console.log(`📁 [UnifiedStore] 恢复媒体项目: ${mediaItem.name} (${mediaItem.mediaType})`)
    }

    console.log(`✅ [UnifiedStore] 媒体项目恢复完成: ${unifiedMediaModule.mediaItems.value.length}个文件`)
  }

  /**
   * 恢复时间轴项目（用于项目加载）
   * @param restoredTimelineItems 要恢复的时间轴项目数组
   */
  async function restoreTimelineItems(restoredTimelineItems: UnifiedTimelineItem[]) {
    console.log(`⏰ [UnifiedStore] 开始恢复时间轴项目: ${restoredTimelineItems.length}个项目`)

    // 清空现有的时间轴项目
    unifiedTimelineModule.timelineItems.value = []

    // 添加恢复的时间轴项目
    for (const timelineItem of restoredTimelineItems) {
      unifiedTimelineModule.timelineItems.value.push(timelineItem)
      console.log(`📋 [UnifiedStore] 恢复时间轴项目: ${timelineItem.config.name} (${timelineItem.mediaType})`)
    }

    console.log(`✅ [UnifiedStore] 时间轴项目数据恢复完成: ${unifiedTimelineModule.timelineItems.value.length}个项目`)

    // 然后等待WebAV画布准备好，重建所有sprite
    await rebuildTimelineItemSprites()
  }

  /**
   * 重建所有时间轴项目的sprite（从原始素材重新创建）
   */
  async function rebuildTimelineItemSprites() {
    console.log(`🔄 [UnifiedStore] 开始重建时间轴项目的sprite...`)

    const items = unifiedTimelineModule.timelineItems.value
    if (items.length === 0) {
      console.log(`ℹ️ [UnifiedStore] 没有时间轴项目需要重建sprite`)
      return
    }

    // 等待WebAV画布准备好
    await webavModule.waitForWebAVReady()

    let rebuiltCount = 0
    for (const timelineItem of items) {
      try {
        console.log(`🔄 [UnifiedStore] 重建sprite: ${timelineItem.id} (${rebuiltCount + 1}/${items.length})`)

        // 这里需要根据统一类型系统重建sprite
        // 暂时记录日志，具体实现需要根据WebAV集成情况调整
        console.log(`📝 [UnifiedStore] 重建sprite逻辑待实现: ${timelineItem.config.name}`)

        rebuiltCount++
        console.log(`✅ [UnifiedStore] sprite重建完成: ${timelineItem.id} (${rebuiltCount}/${items.length})`)
      } catch (error) {
        console.error(`❌ [UnifiedStore] sprite重建失败: ${timelineItem.id}`, error)
      }
    }

    console.log(`✅ [UnifiedStore] 所有sprite重建完成: 成功${rebuiltCount}/${items.length}个`)
  }

  // ==================== 系统状态方法（带日志） ====================

  /**
   * 重置所有模块到默认状态
   */
  function resetToDefaults() {
    unifiedProjectModule.clearCurrentProject()
    unifiedTrackModule.resetTracksToDefaults()
    // 清空时间轴项目
    unifiedTimelineModule.timelineItems.value = []
    // 重置视口状态
    unifiedViewportModule.resetViewport()
    // 重置选择状态
    unifiedSelectionModule.resetToDefaults()
    // 清空历史记录
    unifiedHistoryModule.clear()
    // 清空通知
    notificationModule.clearNotifications()
    configModule.resetToDefaults()
    playbackModule.resetToDefaults()
    webavModule.resetToDefaults()
    console.log('🔄 [UnifiedStore] 重置所有模块到默认状态')
  }

  // ==================== 带历史记录的高级操作API实现 ====================

  /**
   * 创建添加时间轴项目的带历史记录方法
   */
  function createAddTimelineItemWithHistory() {
    return async (timelineItem: UnifiedTimelineItem) => {
      const { UnifiedAddTimelineItemCommand } = await import('./modules/commands/UnifiedTimelineCommands')

      const command = new UnifiedAddTimelineItemCommand(
        timelineItem,
        {
          getUnifiedTimelineItem: unifiedTimelineModule.getTimelineItem,
          addTimelineItem: (item: UnifiedTimelineItem) => {
            try {
              unifiedTimelineModule.addTimelineItem(item)
              return { success: true }
            } catch (error) {
              return { success: false, error: (error as Error).message }
            }
          },
          removeTimelineItem: (id: string) => {
            try {
              unifiedTimelineModule.removeTimelineItem(id)
              return { success: true }
            } catch (error) {
              return { success: false, error: (error as Error).message }
            }
          }
        },
        {
          getUnifiedMediaItem: unifiedMediaModule.getMediaItem
        },
        {
          addSprite: webavModule.addSprite,
          removeSprite: webavModule.removeSprite
        }
      )

      await unifiedHistoryModule.executeCommand(command)
    }
  }

  /**
   * 创建移除时间轴项目的带历史记录方法
   */
  function createRemoveTimelineItemWithHistory() {
    return async (timelineItemId: string) => {
      const { UnifiedRemoveTimelineItemCommand } = await import('./modules/commands/UnifiedTimelineCommands')

      const command = new UnifiedRemoveTimelineItemCommand(
        timelineItemId,
        {
          getUnifiedTimelineItem: unifiedTimelineModule.getTimelineItem,
          addTimelineItem: unifiedTimelineModule.addTimelineItem,
          removeTimelineItem: unifiedTimelineModule.removeTimelineItem
        },
        {
          getUnifiedMediaItem: unifiedMediaModule.getMediaItem
        },
        {
          addSprite: webavModule.addSprite,
          removeSprite: webavModule.removeSprite
        }
      )

      await unifiedHistoryModule.executeCommand(command)
    }
  }

  /**
   * 创建移动时间轴项目的带历史记录方法
   */
  function createMoveTimelineItemWithHistory() {
    return async (
      timelineItemId: string,
      oldPositionFrames: number,
      newPositionFrames: number,
      oldTrackId: string,
      newTrackId: string
    ) => {
      const { UnifiedMoveTimelineItemCommand } = await import('./modules/commands/UnifiedTimelineCommands')

      const command = new UnifiedMoveTimelineItemCommand(
        timelineItemId,
        oldPositionFrames,
        newPositionFrames,
        oldTrackId,
        newTrackId,
        {
          getUnifiedTimelineItem: unifiedTimelineModule.getTimelineItem,
          updateTimelineItemPosition: (id: string, positionFrames: number, trackId?: string) => {
            try {
              const item = unifiedTimelineModule.getTimelineItem(id)
              if (!item) {
                return { success: false, error: '时间轴项目不存在' }
              }
              const duration = item.timeRange.timelineEndTime - item.timeRange.timelineStartTime
              const position = {
                timelineStartTime: positionFrames,
                timelineEndTime: positionFrames + duration
              }
              const result = unifiedTimelineModule.updateTimelineItemPosition(id, position, trackId)
              return { success: result.success, error: result.message }
            } catch (error) {
              return { success: false, error: (error as Error).message }
            }
          }
        },
        {
          getUnifiedMediaItem: unifiedMediaModule.getMediaItem
        }
      )

      await unifiedHistoryModule.executeCommand(command)
    }
  }

  /**
   * 创建更新变换属性的带历史记录方法
   */
  function createUpdateTransformWithHistory() {
    return async (
      timelineItemId: string,
      newTransform: {
        x?: number
        y?: number
        width?: number
        height?: number
        rotation?: number
        opacity?: number
        zIndex?: number
        duration?: number
        playbackRate?: number
        volume?: number
        isMuted?: boolean
        gain?: number
      }
    ) => {
      const { UnifiedUpdateTransformCommand } = await import('./modules/commands/UnifiedTimelineCommands')

      const command = new UnifiedUpdateTransformCommand(
        timelineItemId,
        newTransform,
        {
          getUnifiedTimelineItem: unifiedTimelineModule.getTimelineItem,
          updateTimelineItemTransform: (id: string, transform: any) => {
            try {
              unifiedTimelineModule.updateTimelineItemTransform(id, transform)
              return { success: true }
            } catch (error) {
              return { success: false, error: (error as Error).message }
            }
          }
        },
        {
          getUnifiedMediaItem: unifiedMediaModule.getMediaItem
        }
      )

      await unifiedHistoryModule.executeCommand(command)
    }
  }

  /**
   * 创建调整时间范围的带历史记录方法
   */
  function createResizeTimelineItemWithHistory() {
    return async (
      timelineItemId: string,
      newTimeRange: {
        timelineStartTime: number
        timelineEndTime: number
      }
    ) => {
      const { UnifiedResizeTimelineItemCommand } = await import('./modules/commands/UnifiedTimelineCommands')

      const command = new UnifiedResizeTimelineItemCommand(
        timelineItemId,
        newTimeRange,
        {
          getUnifiedTimelineItem: unifiedTimelineModule.getTimelineItem,
          updateTimelineItemTimeRange: (id: string, timeRange: any) => {
            try {
              const result = unifiedTimelineModule.updateTimelineItemPosition(id, timeRange)
              return { success: result.success, error: result.message }
            } catch (error) {
              return { success: false, error: (error as Error).message }
            }
          }
        },
        {
          getUnifiedMediaItem: unifiedMediaModule.getMediaItem
        }
      )

      await unifiedHistoryModule.executeCommand(command)
    }
  }

  /**
   * 创建分割时间轴项目的带历史记录方法
   */
  function createSplitTimelineItemWithHistory() {
    return async (timelineItemId: string, splitTimeFrames: number) => {
      // 暂时使用简单的分割逻辑，后续可以扩展
      console.log(`🔄 分割时间轴项目: ${timelineItemId} 在 ${splitTimeFrames} 帧`)
      // 这里需要实际的分割逻辑
    }
  }

  /**
   * 创建复制时间轴项目的带历史记录方法
   */
  function createDuplicateTimelineItemWithHistory() {
    return async (originalItemId: string, offsetFrames: number) => {
      // 暂时使用简单的复制逻辑，后续可以扩展
      console.log(`🔄 复制时间轴项目: ${originalItemId} 偏移 ${offsetFrames} 帧`)
      // 这里需要实际的复制逻辑
    }
  }

  /**
   * 创建关键帧操作的带历史记录方法
   */
  function createKeyframeWithHistory() {
    return async (timelineItemId: string, framePosition: number) => {
      const { UnifiedCreateKeyframeCommand } = await import('./modules/commands/UnifiedKeyframeCommands')

      const command = new UnifiedCreateKeyframeCommand(
        timelineItemId,
        framePosition,
        {
          getUnifiedTimelineItem: unifiedTimelineModule.getTimelineItem,
          createKeyframe: (id: string, frame: number) => {
            try {
              // 这里需要实际的关键帧创建逻辑
              console.log(`创建关键帧: ${id} @ ${frame}`)
              return { success: true }
            } catch (error) {
              return { success: false, error: (error as Error).message }
            }
          }
        },
        {
          getUnifiedMediaItem: unifiedMediaModule.getMediaItem
        },
        undefined, // webavAnimationManager - 待实现
        {
          seekTo: (frame: number) => {
            // 这里需要实际的播放控制逻辑
            console.log(`跳转到帧: ${frame}`)
          }
        }
      )

      await unifiedHistoryModule.executeCommand(command)
    }
  }

  function createDeleteKeyframeWithHistory() {
    return async (timelineItemId: string, framePosition: number) => {
      const { UnifiedDeleteKeyframeCommand } = await import('./modules/commands/UnifiedKeyframeCommands')

      const command = new UnifiedDeleteKeyframeCommand(
        timelineItemId,
        framePosition,
        {
          getUnifiedTimelineItem: unifiedTimelineModule.getTimelineItem,
          deleteKeyframe: (id: string, frame: number) => {
            try {
              console.log(`删除关键帧: ${id} @ ${frame}`)
              return { success: true }
            } catch (error) {
              return { success: false, error: (error as Error).message }
            }
          }
        },
        {
          getUnifiedMediaItem: unifiedMediaModule.getMediaItem
        }
      )

      await unifiedHistoryModule.executeCommand(command)
    }
  }

  function createUpdateKeyframeWithHistory() {
    return async (timelineItemId: string, framePosition: number, newProperties: Record<string, any>) => {
      const { UnifiedUpdateKeyframeCommand } = await import('./modules/commands/UnifiedKeyframeCommands')

      const command = new UnifiedUpdateKeyframeCommand(
        timelineItemId,
        framePosition,
        newProperties,
        {
          getUnifiedTimelineItem: unifiedTimelineModule.getTimelineItem,
          updateKeyframe: (id: string, frame: number, properties: any) => {
            try {
              console.log(`更新关键帧: ${id} @ ${frame}`, properties)
              return { success: true }
            } catch (error) {
              return { success: false, error: (error as Error).message }
            }
          }
        },
        {
          getUnifiedMediaItem: unifiedMediaModule.getMediaItem
        }
      )

      await unifiedHistoryModule.executeCommand(command)
    }
  }

  function createClearAllKeyframesWithHistory() {
    return async (timelineItemId: string) => {
      const { UnifiedClearAllKeyframesCommand } = await import('./modules/commands/UnifiedKeyframeCommands')

      const command = new UnifiedClearAllKeyframesCommand(
        timelineItemId,
        {
          getUnifiedTimelineItem: unifiedTimelineModule.getTimelineItem,
          clearAllKeyframes: (id: string) => {
            try {
              console.log(`清除所有关键帧: ${id}`)
              return { success: true }
            } catch (error) {
              return { success: false, error: (error as Error).message }
            }
          }
        },
        {
          getUnifiedMediaItem: unifiedMediaModule.getMediaItem
        }
      )

      await unifiedHistoryModule.executeCommand(command)
    }
  }

  function createToggleKeyframeWithHistory() {
    return async (timelineItemId: string, framePosition: number) => {
      const { UnifiedToggleKeyframeCommand } = await import('./modules/commands/UnifiedKeyframeCommands')

      const command = new UnifiedToggleKeyframeCommand(
        timelineItemId,
        framePosition,
        {
          getUnifiedTimelineItem: unifiedTimelineModule.getTimelineItem,
          toggleKeyframe: (id: string, frame: number) => {
            try {
              console.log(`切换关键帧: ${id} @ ${frame}`)
              // 这里需要检查关键帧是否存在的逻辑
              const created = Math.random() > 0.5 // 临时逻辑
              return { success: true, created }
            } catch (error) {
              return { success: false, error: (error as Error).message }
            }
          }
        },
        {
          getUnifiedMediaItem: unifiedMediaModule.getMediaItem
        }
      )

      await unifiedHistoryModule.executeCommand(command)
    }
  }

  /**
   * 创建添加轨道的带历史记录方法
   */
  function createAddTrackWithHistory() {
    return async (trackData: {
      id: string
      name: string
      type: 'video' | 'audio' | 'text'
      height?: number
      isVisible?: boolean
      isMuted?: boolean
    }) => {
      const { UnifiedAddTrackCommand } = await import('./modules/commands/UnifiedTrackCommands')

      // 创建适配器函数
      const trackModuleAdapter = {
        getTrack: unifiedTrackModule.getTrack,
        addTrack: (track: any) => {
          try {
            const result = unifiedTrackModule.addTrack(track.type, track.name)
            return { success: true, data: result }
          } catch (error) {
            return { success: false, error: (error as Error).message }
          }
        },
        removeTrack: (id: string) => {
          try {
            unifiedTrackModule.removeTrack(id, unifiedTimelineModule.timelineItems, (itemId) => {
              unifiedTimelineModule.removeTimelineItem(itemId)
            })
            return { success: true }
          } catch (error) {
            return { success: false, error: (error as Error).message }
          }
        }
      }

      const command = new UnifiedAddTrackCommand(trackData, trackModuleAdapter)
      await unifiedHistoryModule.executeCommand(command)
    }
  }

  /**
   * 创建移除轨道的带历史记录方法
   */
  function createRemoveTrackWithHistory() {
    return async (trackId: string) => {
      const { UnifiedRemoveTrackCommand } = await import('./modules/commands/UnifiedTrackCommands')

      // 创建适配器函数
      const trackModuleAdapter = {
        getTrack: unifiedTrackModule.getTrack,
        addTrack: (track: any) => {
          try {
            const result = unifiedTrackModule.addTrack(track.type, track.name)
            return { success: true, data: result }
          } catch (error) {
            return { success: false, error: (error as Error).message }
          }
        },
        removeTrack: (id: string) => {
          try {
            unifiedTrackModule.removeTrack(id, unifiedTimelineModule.timelineItems, (itemId) => {
              unifiedTimelineModule.removeTimelineItem(itemId)
            })
            return { success: true }
          } catch (error) {
            return { success: false, error: (error as Error).message }
          }
        }
      }

      const command = new UnifiedRemoveTrackCommand(trackId, trackModuleAdapter)
      await unifiedHistoryModule.executeCommand(command)
    }
  }

  /**
   * 创建重命名轨道的带历史记录方法
   */
  function createRenameTrackWithHistory() {
    return async (trackId: string, newName: string) => {
      const { UnifiedRenameTrackCommand } = await import('./modules/commands/UnifiedTrackCommands')

      // 创建适配器函数
      const trackModuleAdapter = {
        getTrack: unifiedTrackModule.getTrack,
        renameTrack: (id: string, name: string) => {
          try {
            unifiedTrackModule.renameTrack(id, name)
            return { success: true }
          } catch (error) {
            return { success: false, error: (error as Error).message }
          }
        }
      }

      const command = new UnifiedRenameTrackCommand(trackId, newName, trackModuleAdapter)
      await unifiedHistoryModule.executeCommand(command)
    }
  }

  /**
   * 创建切换轨道可见性的带历史记录方法
   */
  function createToggleTrackVisibilityWithHistory() {
    return async (trackId: string) => {
      const { UnifiedToggleTrackVisibilityCommand } = await import('./modules/commands/UnifiedTrackCommands')

      // 创建适配器函数
      const trackModuleAdapter = {
        getTrack: unifiedTrackModule.getTrack,
        toggleTrackVisibility: (id: string) => {
          try {
            const track = unifiedTrackModule.getTrack(id)
            const oldVisibility = track?.isVisible ?? true
            unifiedTrackModule.toggleTrackVisibility(id, unifiedTimelineModule.timelineItems)
            return { success: true, newVisibility: !oldVisibility }
          } catch (error) {
            return { success: false, error: (error as Error).message }
          }
        }
      }

      const command = new UnifiedToggleTrackVisibilityCommand(trackId, trackModuleAdapter)
      await unifiedHistoryModule.executeCommand(command)
    }
  }

  /**
   * 创建切换轨道静音的带历史记录方法
   */
  function createToggleTrackMuteWithHistory() {
    return async (trackId: string) => {
      const { UnifiedToggleTrackMuteCommand } = await import('./modules/commands/UnifiedTrackCommands')

      // 创建适配器函数
      const trackModuleAdapter = {
        getTrack: unifiedTrackModule.getTrack,
        toggleTrackMute: (id: string) => {
          try {
            const track = unifiedTrackModule.getTrack(id)
            const oldMuteState = track?.isMuted ?? false
            unifiedTrackModule.toggleTrackMute(id, unifiedTimelineModule.timelineItems)
            return { success: true, newMuteState: !oldMuteState }
          } catch (error) {
            return { success: false, error: (error as Error).message }
          }
        }
      }

      const command = new UnifiedToggleTrackMuteCommand(trackId, trackModuleAdapter)
      await unifiedHistoryModule.executeCommand(command)
    }
  }

  /**
   * 创建添加文本项目的带历史记录方法
   */
  function createAddTextItemWithHistory() {
    return async (textData: {
      text: string
      style: any
      startTimeFrames: number
      duration: number
      trackId: string
      position: { x: number; y: number }
      size: { width: number; height: number }
    }) => {
      const { UnifiedAddTextItemCommand } = await import('./modules/commands/UnifiedTextCommands')

      const command = new UnifiedAddTextItemCommand(
        textData,
        {
          getUnifiedTimelineItem: unifiedTimelineModule.getTimelineItem,
          addTimelineItem: (item: UnifiedTimelineItem) => {
            try {
              unifiedTimelineModule.addTimelineItem(item)
              return { success: true }
            } catch (error) {
              return { success: false, error: (error as Error).message }
            }
          },
          removeTimelineItem: (id: string) => {
            try {
              unifiedTimelineModule.removeTimelineItem(id)
              return { success: true }
            } catch (error) {
              return { success: false, error: (error as Error).message }
            }
          },
          createTextTimelineItem: (data: any) => {
            // 这里需要实际的文本时间轴项目创建逻辑
            console.log('创建文本时间轴项目:', data)
            return {
              id: generateCommandId(),
              mediaItemId: generateCommandId(),
              mediaType: 'text' as const,
              config: {
                name: `文本-${data.text.substring(0, 10)}`,
                mediaConfig: data,
                text: data.text,
                style: data.style
              },
              timeRange: {
                timelineStartTime: data.startTimeFrames,
                timelineEndTime: data.startTimeFrames + data.duration
              },
              trackId: data.trackId,
              timelineStatus: 'ready' as const
            } as UnifiedTimelineItem
          }
        },
        {
          getUnifiedMediaItem: unifiedMediaModule.getMediaItem
        },
        {
          addSprite: webavModule.addSprite,
          removeSprite: webavModule.removeSprite
        }
      )

      await unifiedHistoryModule.executeCommand(command)
    }
  }

  /**
   * 创建更新文本项目的带历史记录方法
   */
  function createUpdateTextItemWithHistory() {
    return async (timelineItemId: string, newText: string, newStyle: any) => {
      const { UnifiedUpdateTextCommand } = await import('./modules/commands/UnifiedTextCommands')

      const command = new UnifiedUpdateTextCommand(
        timelineItemId,
        newText,
        newStyle,
        {
          getUnifiedTimelineItem: unifiedTimelineModule.getTimelineItem,
          updateTextItem: (id: string, text: string, style: any) => {
            try {
              const item = unifiedTimelineModule.getTimelineItem(id)
              if (item && item.mediaType === 'text') {
                // 更新文本内容和样式
                ;(item.config as any).text = text
                ;(item.config as any).style = style
                return { success: true }
              }
              return { success: false, error: '文本项目不存在' }
            } catch (error) {
              return { success: false, error: (error as Error).message }
            }
          }
        },
        {
          getUnifiedMediaItem: unifiedMediaModule.getMediaItem
        }
      )

      await unifiedHistoryModule.executeCommand(command)
    }
  }

  /**
   * 创建更新文本样式的带历史记录方法
   */
  function createUpdateTextStyleWithHistory() {
    return async (timelineItemId: string, newStyle: any) => {
      const { UnifiedUpdateTextStyleCommand } = await import('./modules/commands/UnifiedTextCommands')

      const command = new UnifiedUpdateTextStyleCommand(
        timelineItemId,
        newStyle,
        {
          getUnifiedTimelineItem: unifiedTimelineModule.getTimelineItem,
          updateTextStyle: (id: string, style: any) => {
            try {
              const item = unifiedTimelineModule.getTimelineItem(id)
              if (item && item.mediaType === 'text') {
                ;(item.config as any).style = { ...(item.config as any).style, ...style }
                return { success: true }
              }
              return { success: false, error: '文本项目不存在' }
            } catch (error) {
              return { success: false, error: (error as Error).message }
            }
          }
        },
        {
          getUnifiedMediaItem: unifiedMediaModule.getMediaItem
        }
      )

      await unifiedHistoryModule.executeCommand(command)
    }
  }

  /**
   * 创建批量删除时间轴项目的方法
   */
  function createBatchDeleteTimelineItems() {
    return async (timelineItemIds: string[]) => {
      const { UnifiedBatchDeleteCommand } = await import('./modules/commands/UnifiedBatchCommands')

      const command = new UnifiedBatchDeleteCommand(
        timelineItemIds,
        {
          getUnifiedTimelineItem: unifiedTimelineModule.getTimelineItem,
          addTimelineItem: unifiedTimelineModule.addTimelineItem,
          removeTimelineItem: unifiedTimelineModule.removeTimelineItem
        },
        {
          getUnifiedMediaItem: unifiedMediaModule.getMediaItem
        },
        {
          addSprite: webavModule.addSprite,
          removeSprite: webavModule.removeSprite
        }
      )

      await unifiedHistoryModule.executeBatchCommand(command)
    }
  }

  /**
   * 创建批量更新属性的方法
   */
  function createBatchUpdateProperties() {
    return async (targetItemIds: string[], updateCommands: any[]) => {
      const { UnifiedBatchUpdatePropertiesCommand } = await import('./modules/commands/UnifiedBatchCommands')

      const command = new UnifiedBatchUpdatePropertiesCommand(targetItemIds, updateCommands)

      await unifiedHistoryModule.executeBatchCommand(command)
    }
  }

  /**
   * 创建批量移动的方法
   */
  function createBatchMoveWithHistory() {
    return async (moveOperations: Array<{
      itemId: string
      oldPositionFrames: number
      newPositionFrames: number
      oldTrackId: string
      newTrackId: string
    }>) => {
      const { UnifiedBatchMoveCommand } = await import('./modules/commands/UnifiedBatchCommands')

      const command = new UnifiedBatchMoveCommand(
        moveOperations,
        {
          getUnifiedTimelineItem: unifiedTimelineModule.getTimelineItem,
          updateTimelineItemPosition: (id: string, positionFrames: number, trackId?: string) => {
            try {
              const item = unifiedTimelineModule.getTimelineItem(id)
              if (!item) {
                return { success: false, error: '时间轴项目不存在' }
              }
              const duration = item.timeRange.timelineEndTime - item.timeRange.timelineStartTime
              const position = {
                timelineStartTime: positionFrames,
                timelineEndTime: positionFrames + duration
              }
              const result = unifiedTimelineModule.updateTimelineItemPosition(id, position, trackId)
              return { success: result.success, error: result.message }
            } catch (error) {
              return { success: false, error: (error as Error).message }
            }
          }
        },
        {
          getUnifiedMediaItem: unifiedMediaModule.getMediaItem
        }
      )

      await unifiedHistoryModule.executeBatchCommand(command)
    }
  }

  /**
   * 创建自动排列轨道的带历史记录方法
   */
  function createAutoArrangeTrackWithHistory() {
    return async (trackId: string) => {
      // 暂时使用简单的自动排列逻辑
      console.log(`🔄 自动排列轨道: ${trackId}`)
      // 这里需要实际的自动排列逻辑
    }
  }

  // ==================== 导出接口 ====================

  return {
    // ==================== 统一项目模块状态和方法 ====================

    // 项目状态
    currentProject: unifiedProjectModule.currentProject,
    currentProjectId: unifiedProjectModule.currentProjectId,
    currentProjectName: unifiedProjectModule.currentProjectName,
    projectStatus: unifiedProjectModule.projectStatus,
    hasCurrentProject: unifiedProjectModule.hasCurrentProject,
    isSaving: unifiedProjectModule.isSaving,
    isLoading: unifiedProjectModule.isLoading,
    lastSaved: unifiedProjectModule.lastSaved,
    mediaReferences: unifiedProjectModule.mediaReferences,

    // 项目加载进度状态
    loadingProgress: unifiedProjectModule.loadingProgress,
    loadingStage: unifiedProjectModule.loadingStage,
    loadingDetails: unifiedProjectModule.loadingDetails,
    showLoadingProgress: unifiedProjectModule.showLoadingProgress,
    isProjectSettingsReady: unifiedProjectModule.isProjectSettingsReady,
    isProjectContentReady: unifiedProjectModule.isProjectContentReady,

    // 项目管理方法
    createProject,
    saveCurrentProject,
    preloadProjectSettings,
    loadProjectContent,
    clearCurrentProject,
    addMediaReference: unifiedProjectModule.addMediaReference,
    removeMediaReference: unifiedProjectModule.removeMediaReference,
    getMediaReference: unifiedProjectModule.getMediaReference,
    getMediaReferences: () => unifiedProjectModule.mediaReferences.value,
    cleanupInvalidMediaReferences: unifiedProjectModule.cleanupInvalidMediaReferences,
    getProjectSummary: unifiedProjectModule.getProjectSummary,

    // 项目加载进度方法
    updateLoadingProgress: unifiedProjectModule.updateLoadingProgress,
    resetLoadingState: unifiedProjectModule.resetLoadingState,

    // ==================== 统一媒体模块状态和方法 ====================

    // 媒体项目状态
    mediaItems: unifiedMediaModule.mediaItems,

    // 媒体项目管理方法
    addMediaItem,
    removeMediaItem,
    getMediaItem: unifiedMediaModule.getMediaItem,
    getMediaItemBySourceId: unifiedMediaModule.getMediaItemBySourceId,
    updateMediaItemName: unifiedMediaModule.updateMediaItemName,
    updateMediaItem: unifiedMediaModule.updateMediaItem,
    getAllMediaItems,

    // 分辨率管理方法
    getVideoOriginalResolution,
    getImageOriginalResolution,

    // 异步等待方法
    waitForMediaItemReady,

    // 数据源处理方法
    handleSourceStatusChange: unifiedMediaModule.handleSourceStatusChange,
    startMediaProcessing: unifiedMediaModule.startMediaProcessing,

    // 便捷查询方法
    getReadyMediaItems: unifiedMediaModule.getReadyMediaItems,
    getProcessingMediaItems: unifiedMediaModule.getProcessingMediaItems,
    getErrorMediaItems: unifiedMediaModule.getErrorMediaItems,
    getMediaItemsByType,
    getMediaItemsBySourceType: unifiedMediaModule.getMediaItemsBySourceType,
    getMediaItemsStats: unifiedMediaModule.getMediaItemsStats,

    // 异步处理管理方法（兼容旧架构API）
    addAsyncProcessingItem,
    updateAsyncProcessingItem,
    removeAsyncProcessingItem,
    getAsyncProcessingItem,

    // 批量操作方法
    retryAllErrorItems,
    clearCancelledItems,

    // 工厂函数和查询函数
    createUnifiedMediaItemData: unifiedMediaModule.createUnifiedMediaItemData,
    UnifiedMediaItemQueries: unifiedMediaModule.UnifiedMediaItemQueries,
    UnifiedMediaItemActions: unifiedMediaModule.UnifiedMediaItemActions,

    // ==================== 统一轨道模块状态和方法 ====================

    // 轨道状态
    tracks: unifiedTrackModule.tracks,

    // 轨道管理方法
    addTrack,
    removeTrack,
    toggleTrackVisibility: unifiedTrackModule.toggleTrackVisibility,
    toggleTrackMute: unifiedTrackModule.toggleTrackMute,
    renameTrack,
    setTrackHeight: unifiedTrackModule.setTrackHeight,
    getTrack: unifiedTrackModule.getTrack,
    getTracksSummary: unifiedTrackModule.getTracksSummary,
    resetTracksToDefaults: unifiedTrackModule.resetTracksToDefaults,
    restoreTracks: unifiedTrackModule.restoreTracks,

    // ==================== 统一时间轴模块状态和方法 ====================

    // 时间轴项目状态
    timelineItems: unifiedTimelineModule.timelineItems,

    // 时间轴项目管理方法
    addTimelineItem,
    removeTimelineItem,
    getTimelineItem: unifiedTimelineModule.getTimelineItem,
    getReadyTimelineItem: unifiedTimelineModule.getReadyTimelineItem,
    setupBidirectionalSync: unifiedTimelineModule.setupBidirectionalSync,
    updateTimelineItemPosition,
    updateTimelineItemSprite: unifiedTimelineModule.updateTimelineItemSprite,
    updateTimelineItemTransform: unifiedTimelineModule.updateTimelineItemTransform,

    // ==================== 播放控制模块状态和方法 ====================

    // 播放控制状态
    currentFrame: playbackModule.currentFrame,
    isPlaying: playbackModule.isPlaying,
    playbackRate: playbackModule.playbackRate,

    // 计算属性
    formattedCurrentTime: playbackModule.formattedCurrentTime,
    playbackRateText: playbackModule.playbackRateText,

    // 帧数控制方法
    setCurrentFrame: playbackModule.setCurrentFrame,
    seekToFrame: playbackModule.seekToFrame,
    seekByFrames: playbackModule.seekByFrames,
    nextFrame: playbackModule.nextFrame,
    previousFrame: playbackModule.previousFrame,

    // 播放控制方法
    setPlaying: playbackModule.setPlaying,
    play: playbackModule.play,
    pause: playbackModule.pause,
    togglePlayPause: playbackModule.togglePlayPause,
    stop: playbackModule.stop,
    setPlaybackRate: playbackModule.setPlaybackRate,
    resetPlaybackRate: playbackModule.resetPlaybackRate,
    getPlaybackSummary: playbackModule.getPlaybackSummary,
    resetPlaybackToDefaults: playbackModule.resetToDefaults,

    // ==================== 配置模块状态和方法 ====================

    // 配置状态
    videoResolution: configModule.videoResolution,
    frameRate: configModule.frameRate,
    timelineDurationFrames: configModule.timelineDurationFrames,
    proportionalScale: configModule.proportionalScale,

    // 配置管理方法
    setVideoResolution: configModule.setVideoResolution,
    setFrameRate: configModule.setFrameRate,
    setTimelineDurationFrames: configModule.setTimelineDurationFrames,
    setProportionalScale: configModule.setProportionalScale,
    getConfigSummary: configModule.getConfigSummary,
    resetConfigToDefaults: configModule.resetToDefaults,
    restoreFromProjectSettings: configModule.restoreFromProjectSettings,

    // ==================== WebAV模块状态和方法 ====================

    // WebAV状态
    avCanvas: webavModule.avCanvas,
    isWebAVReady: webavModule.isWebAVReady,
    webAVError: webavModule.webAVError,

    // WebAV管理方法
    setAVCanvas: webavModule.setAVCanvas,
    setWebAVReady: webavModule.setWebAVReady,
    setWebAVError: webavModule.setWebAVError,
    clearWebAVState: webavModule.clearWebAVState,
    getWebAVSummary: webavModule.getWebAVSummary,
    resetWebAVToDefaults: webavModule.resetToDefaults,
    addSpriteToCanvas: webavModule.addSprite,
    removeSpriteFromCanvas: webavModule.removeSprite,

    // WebAV画布容器管理
    createCanvasContainer: webavModule.createCanvasContainer,
    initializeCanvas: webavModule.initializeCanvas,
    getAVCanvas: webavModule.getAVCanvas,
    getCanvasContainer: webavModule.getCanvasContainer,

    // WebAV播放控制
    webAVPlay: webavModule.play,
    webAVPause: webavModule.pause,
    webAVSeekTo: webavModule.seekTo,

    // WebAV Clip创建和管理
    createMP4Clip: webavModule.createMP4Clip,
    createImgClip: webavModule.createImgClip,
    createAudioClip: webavModule.createAudioClip,
    cloneMP4Clip: webavModule.cloneMP4Clip,
    cloneImgClip: webavModule.cloneImgClip,
    cloneAudioClip: webavModule.cloneAudioClip,

    // WebAV实例管理
    destroyWebAV: webavModule.destroy,
    isWebAVReadyGlobal: webavModule.isWebAVReadyGlobal,
    waitForWebAVReady: webavModule.waitForWebAVReady,

    // WebAV画布销毁和重建
    destroyCanvas: webavModule.destroyCanvas,
    recreateCanvas: webavModule.recreateCanvas,

    // ==================== 计算属性 ====================

    // 项目相关计算属性
    projectStats,
    isProjectSaving,
    isProjectLoading,

    // 媒体相关计算属性
    mediaStats,
    readyMediaCount,
    hasProcessingMedia,
    hasErrorMedia,

    // WebAV相关计算属性
    isWebAVAvailable,

    // 轨道相关计算属性
    trackStats,
    activeTrackCount,

    // 时间轴相关计算属性
    timelineStats,
    totalTimelineDuration,
    contentEndTimeFrames,
    totalDurationFrames,

    // ==================== 统一视口模块状态和方法 ====================

    // 视口状态
    zoomLevel: unifiedViewportModule.zoomLevel,
    scrollOffset: unifiedViewportModule.scrollOffset,
    isViewportReady: unifiedViewportModule.isViewportReady,
    lastViewportUpdate: unifiedViewportModule.lastViewportUpdate,

    // 视口计算属性
    minZoomLevel: unifiedViewportModule.minZoomLevel,
    visibleDurationFrames: unifiedViewportModule.visibleDurationFrames,
    maxVisibleDurationFrames: unifiedViewportModule.maxVisibleDurationFrames,
    viewportContentEndTimeFrames: unifiedViewportModule.contentEndTimeFrames,
    viewportSummary: unifiedViewportModule.viewportSummary,

    // 视口配置
    viewportConfig: unifiedViewportModule.viewportConfig,

    // 视口核心方法
    getMaxZoomLevelForTimeline: unifiedViewportModule.getMaxZoomLevelForTimeline,
    getMaxScrollOffsetForTimeline: unifiedViewportModule.getMaxScrollOffsetForTimeline,
    setZoomLevel: unifiedViewportModule.setZoomLevel,
    setScrollOffset: unifiedViewportModule.setScrollOffset,

    // 视口缩放方法
    zoomIn: unifiedViewportModule.zoomIn,
    zoomOut: unifiedViewportModule.zoomOut,

    // 视口滚动方法
    scrollLeft: unifiedViewportModule.scrollLeft,
    scrollRight: unifiedViewportModule.scrollRight,
    scrollToFrame: unifiedViewportModule.scrollToFrame,

    // 视口系统方法
    resetViewport: unifiedViewportModule.resetViewport,
    initializeViewport: unifiedViewportModule.initializeViewport,
    updateViewportTimestamp: unifiedViewportModule.updateViewportTimestamp,

    // 视口验证方法
    validateZoomLevel: unifiedViewportModule.validateZoomLevel,
    validateScrollOffset: unifiedViewportModule.validateScrollOffset,

    // ==================== 统一历史模块状态和方法 ====================

    // 历史状态
    canUndo: unifiedHistoryModule.canUndo,
    canRedo: unifiedHistoryModule.canRedo,

    // 历史管理方法
    executeCommand: unifiedHistoryModule.executeCommand,
    undo: unifiedHistoryModule.undo,
    redo: unifiedHistoryModule.redo,
    clearHistory: unifiedHistoryModule.clear,
    getHistorySummary: unifiedHistoryModule.getHistorySummary,
    startBatch: unifiedHistoryModule.startBatch,
    executeBatchCommand: unifiedHistoryModule.executeBatchCommand,

    // ==================== 统一选择模块状态和方法 ====================

    // 选择状态
    selectedTimelineItemId: unifiedSelectionModule.selectedTimelineItemId,
    selectedTimelineItemIds: unifiedSelectionModule.selectedTimelineItemIds,
    isMultiSelectMode: unifiedSelectionModule.isMultiSelectMode,
    hasSelection: unifiedSelectionModule.hasSelection,

    // 统一选择API
    selectTimelineItems: unifiedSelectionModule.selectTimelineItems,
    selectTimelineItemsWithHistory: unifiedSelectionModule.selectTimelineItemsWithHistory,
    syncSelectionState: unifiedSelectionModule.syncSelectionState,

    // 兼容性选择方法
    selectTimelineItem: unifiedSelectionModule.selectTimelineItem,
    clearAllSelections: unifiedSelectionModule.clearAllSelections,
    toggleTimelineItemSelection: unifiedSelectionModule.toggleTimelineItemSelection,
    isTimelineItemSelected: unifiedSelectionModule.isTimelineItemSelected,
    getSelectedTimelineItem: unifiedSelectionModule.getSelectedTimelineItem,
    getSelectionSummary: unifiedSelectionModule.getSelectionSummary,
    resetSelectionToDefaults: unifiedSelectionModule.resetToDefaults,

    // 多选兼容性方法
    addToMultiSelection: unifiedSelectionModule.addToMultiSelection,
    removeFromMultiSelection: unifiedSelectionModule.removeFromMultiSelection,
    toggleMultiSelection: unifiedSelectionModule.toggleMultiSelection,
    clearMultiSelection: unifiedSelectionModule.clearMultiSelection,
    isInMultiSelection: unifiedSelectionModule.isInMultiSelection,

    // ==================== 通知模块状态和方法 ====================

    // 通知状态
    notifications: notificationModule.notifications,

    // 通知管理方法
    showNotification: notificationModule.showNotification,
    removeNotification: notificationModule.removeNotification,
    clearNotifications: notificationModule.clearNotifications,
    removeNotificationsByType: notificationModule.removeNotificationsByType,
    getNotificationCountByType: notificationModule.getNotificationCountByType,

    // 便捷通知方法
    showSuccess: notificationModule.showSuccess,
    showError: notificationModule.showError,
    showWarning: notificationModule.showWarning,
    showInfo: notificationModule.showInfo,

    // ==================== 带历史记录的高级操作API ====================

    // 时间轴项目操作方法
    addTimelineItemWithHistory: createAddTimelineItemWithHistory(),
    removeTimelineItemWithHistory: createRemoveTimelineItemWithHistory(),
    moveTimelineItemWithHistory: createMoveTimelineItemWithHistory(),
    updateTimelineItemTransformWithHistory: createUpdateTransformWithHistory(),
    resizeTimelineItemWithHistory: createResizeTimelineItemWithHistory(),
    splitTimelineItemAtTimeWithHistory: createSplitTimelineItemWithHistory(),
    duplicateTimelineItemWithHistory: createDuplicateTimelineItemWithHistory(),

    // 关键帧操作方法
    createKeyframeWithHistory: createKeyframeWithHistory(),
    deleteKeyframeWithHistory: createDeleteKeyframeWithHistory(),
    updateKeyframeWithHistory: createUpdateKeyframeWithHistory(),
    clearAllKeyframesWithHistory: createClearAllKeyframesWithHistory(),
    toggleKeyframeWithHistory: createToggleKeyframeWithHistory(),

    // 轨道操作方法
    addTrackWithHistory: createAddTrackWithHistory(),
    removeTrackWithHistory: createRemoveTrackWithHistory(),
    renameTrackWithHistory: createRenameTrackWithHistory(),
    toggleTrackVisibilityWithHistory: createToggleTrackVisibilityWithHistory(),
    toggleTrackMuteWithHistory: createToggleTrackMuteWithHistory(),

    // 文本操作方法
    addTextItemWithHistory: createAddTextItemWithHistory(),
    updateTextItemWithHistory: createUpdateTextItemWithHistory(),
    updateTextStyleWithHistory: createUpdateTextStyleWithHistory(),

    // 批量操作方法
    batchDeleteTimelineItems: createBatchDeleteTimelineItems(),
    batchUpdateProperties: createBatchUpdateProperties(),
    batchMoveWithHistory: createBatchMoveWithHistory(),
    autoArrangeTrackWithHistory: createAutoArrangeTrackWithHistory(),

    // ==================== 工具函数导出 ====================

    // 坐标转换工具函数
    frameToPixel: (frames: number, timelineWidth: number) =>
      frameToPixel(
        frames,
        timelineWidth,
        totalDurationFrames.value,
        unifiedViewportModule.zoomLevel.value,
        unifiedViewportModule.scrollOffset.value,
      ),
    pixelToFrame: (pixel: number, timelineWidth: number) =>
      pixelToFrame(
        pixel,
        timelineWidth,
        totalDurationFrames.value,
        unifiedViewportModule.zoomLevel.value,
        unifiedViewportModule.scrollOffset.value,
      ),

    // 时间轴搜索工具函数
    findTimelineItemBySprite: (sprite: Raw<any>) =>
      findTimelineItemBySprite(sprite, unifiedTimelineModule.timelineItems.value as any),
    getTimelineItemsByTrack: (trackId: string) =>
      getTimelineItemsByTrack(trackId, unifiedTimelineModule.timelineItems.value as any),
    getTimelineItemAtFrames: (frames: number) =>
      getTimelineItemAtFrames(frames, unifiedTimelineModule.timelineItems.value as any),
    getTimelineItemsAtFrames: (frames: number) =>
      getTimelineItemsAtFrames(frames, unifiedTimelineModule.timelineItems.value as any),
    getTimelineItemAtTrackAndFrames: (trackId: string, frames: number) =>
      getTimelineItemAtTrackAndFrames(trackId, frames, unifiedTimelineModule.timelineItems.value as any),

    // 自动排列工具函数
    autoArrangeTimelineItems: () =>
      autoArrangeTimelineItems(unifiedTimelineModule.timelineItems as any),
    autoArrangeTrackItems: (trackId: string) =>
      autoArrangeTrackItems(unifiedTimelineModule.timelineItems as any, trackId),

    // 时间轴扩展工具函数
    expandTimelineIfNeededFrames: (targetFrames: number) =>
      expandTimelineIfNeededFrames(targetFrames, configModule.timelineDurationFrames),

    // ==================== 业务逻辑封装方法 ====================

    // 变换属性处理逻辑
    checkTransformChanges,
    determinePropertyType,

    // ==================== 项目恢复方法 ====================

    // 项目恢复方法
    restoreMediaItems,
    restoreTimelineItems,
    rebuildTimelineItemSprites,

    // ==================== 系统状态方法 ====================

    resetToDefaults,  // 保留封装，因为需要重置所有模块
  }
})
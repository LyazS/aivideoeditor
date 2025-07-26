import { ref, type Ref } from 'vue'
import type { UnifiedTimelineItem } from '../../unified/timelineitem'
import type {
  UnifiedTrack,
  UnifiedTrackType,
} from '../../unified/track'
import {
  DEFAULT_UNIFIED_TRACK_CONFIGS,
} from '../../unified/track'
import { generateTrackId } from '../../utils/idGenerator'

/**
 * 统一轨道模块
 * 基于重构文档的统一类型设计理念
 *
 * 核心设计理念：
 * - 状态驱动的统一架构：与UnifiedTimelineItem完美集成
 * - 响应式数据结构：核心数据 + 行为函数 + 查询函数
 * - 类型安全：完整的TypeScript类型定义
 */

// ==================== 常量定义 ====================
// 常量已移至 ../../unified/track 模块

// ==================== 统一轨道模块 ====================

/**
 * 创建统一轨道模块
 * 负责管理轨道的创建、删除、属性设置和状态管理
 */
export function createUnifiedTrackModule() {
  // ==================== 状态定义 ====================

  // 轨道列表 - 使用响应式数据
  const tracks = ref<UnifiedTrack[]>([
    createDefaultTrack('video', '默认视频轨道', 0),
    createDefaultTrack('audio', '默认音频轨道', 1),
    createDefaultTrack('text', '默认文本轨道', 2),
  ])

  // ==================== 工具函数 ====================

  /**
   * 创建默认轨道
   */
  function createDefaultTrack(type: UnifiedTrackType, name: string, order: number): UnifiedTrack {
    const now = new Date().toISOString()
    const defaultConfig = DEFAULT_UNIFIED_TRACK_CONFIGS[type]

    return {
      id: generateTrackId(),
      name,
      type,
      status: 'active',
      isVisible: defaultConfig.isVisible ?? true,
      isMuted: defaultConfig.isMuted ?? false,
      height: defaultConfig.height ?? 60,
      order,
      color: defaultConfig.color,
      createdAt: now,
      updatedAt: now,
    }
  }

  /**
   * 更新轨道的updatedAt时间戳
   */
  function updateTrackTimestamp(track: UnifiedTrack): void {
    track.updatedAt = new Date().toISOString()
  }

  // ==================== 轨道管理方法 ====================

  /**
   * 添加新轨道 - 兼容trackModule接口
   * @param type 轨道类型
   * @param name 轨道名称（可选）
   * @param position 插入位置（可选，默认为末尾）
   * @returns 新创建的轨道对象
   */
  function addTrack(type: UnifiedTrackType = 'video', name?: string, position?: number): UnifiedTrack {
    const now = new Date().toISOString()
    const defaultConfig = DEFAULT_UNIFIED_TRACK_CONFIGS[type]

    // 计算同类型轨道的数量，用于生成默认名称
    const sameTypeCount = tracks.value.filter((t) => t.type === type).length + 1
    const typeNames = {
      video: '视频轨道',
      audio: '音频轨道',
      text: '文本轨道',
    }

    // 确定插入位置和顺序
    const insertPosition = position ?? tracks.value.length
    const order = insertPosition

    const newTrack: UnifiedTrack = {
      id: generateTrackId(),
      name: name || `${typeNames[type]} ${sameTypeCount}`,
      type,
      status: 'active',
      isVisible: defaultConfig.isVisible ?? true,
      isMuted: defaultConfig.isMuted ?? false,
      height: defaultConfig.height ?? 60,
      order,
      color: defaultConfig.color,
      createdAt: now,
      updatedAt: now,
    }

    // 调整其他轨道的顺序
    tracks.value.forEach((track) => {
      if (track.order >= order) {
        track.order++
        updateTrackTimestamp(track)
      }
    })

    // 插入新轨道
    if (insertPosition >= 0 && insertPosition <= tracks.value.length) {
      tracks.value.splice(insertPosition, 0, newTrack)
    } else {
      tracks.value.push(newTrack)
    }

    console.log('🎵 添加新轨道:', {
      id: newTrack.id,
      name: newTrack.name,
      type: newTrack.type,
      position: insertPosition,
      totalTracks: tracks.value.length,
    })

    return newTrack
  }



  /**
   * 删除轨道 - 兼容trackModule接口
   * @param trackId 要删除的轨道ID
   * @param timelineItems 时间轴项目引用（用于删除该轨道上的所有项目）
   * @param removeTimelineItemCallback 删除时间轴项目的回调函数
   */
  function removeTrack(
    trackId: string,
    timelineItems: Ref<UnifiedTimelineItem[]>,
    removeTimelineItemCallback?: (timelineItemId: string) => void,
  ) {
    // 不能删除最后一个轨道
    if (tracks.value.length <= 1) {
      console.warn('⚠️ 不能删除最后一个轨道')
      return
    }

    const trackIndex = tracks.value.findIndex((t) => t.id === trackId)
    if (trackIndex === -1) {
      console.warn('⚠️ 找不到要删除的轨道:', trackId)
      return
    }

    const trackToRemove = tracks.value[trackIndex]

    // 删除该轨道上的所有时间轴项目
    const affectedItems = timelineItems.value.filter((item) => item.trackId === trackId)
    affectedItems.forEach((item) => {
      if (removeTimelineItemCallback) {
        removeTimelineItemCallback(item.id)
      }
    })

    // 删除轨道
    tracks.value.splice(trackIndex, 1)

    // 调整其他轨道的顺序
    tracks.value.forEach((track) => {
      if (track.order > trackToRemove.order) {
        track.order--
        updateTrackTimestamp(track)
      }
    })

    console.log('🗑️ 删除轨道:', {
      removedTrackId: trackId,
      removedTrackName: trackToRemove.name,
      deletedItemsCount: affectedItems.length,
      remainingTracks: tracks.value.length,
    })
  }



  /**
   * 切换轨道可见性 - 兼容trackModule接口
   * @param trackId 轨道ID
   * @param timelineItems 时间轴项目列表（用于同步sprite可见性）
   */
  function toggleTrackVisibility(
    trackId: string,
    timelineItems?: Ref<UnifiedTimelineItem[]>,
  ) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (!track) {
      console.warn('⚠️ 找不到轨道:', trackId)
      return
    }

    // 音频轨道不支持可见性控制
    if (track.type === 'audio') {
      console.warn('⚠️ 音频轨道不支持可见性控制，请使用静音功能')
      return
    }

    track.isVisible = !track.isVisible
    updateTrackTimestamp(track)

    // 同步该轨道上所有TimelineItem的sprite可见性
    if (timelineItems) {
      const trackItems = timelineItems.value.filter((item) => item.trackId === trackId)
      trackItems.forEach((item) => {
        if (item.timelineStatus === 'ready' && item.sprite) {
          item.sprite.visible = track.isVisible
        }
      })

      console.log('👁️ 切换轨道可见性:', {
        trackId,
        trackName: track.name,
        trackType: track.type,
        isVisible: track.isVisible,
        affectedClips: trackItems.length,
      })
    } else {
      console.log('👁️ 切换轨道可见性:', {
        trackId,
        trackName: track.name,
        trackType: track.type,
        isVisible: track.isVisible,
      })
    }
  }

  /**
   * 切换轨道静音状态 - 兼容trackModule接口
   * @param trackId 轨道ID
   * @param timelineItems 时间轴项目列表（用于同步sprite静音状态）
   */
  function toggleTrackMute(trackId: string, timelineItems?: Ref<UnifiedTimelineItem[]>) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (!track) {
      console.warn('⚠️ 找不到轨道:', trackId)
      return
    }

    // 文本轨道不支持静音操作
    if (track.type === 'text') {
      console.warn('⚠️ 文本轨道不支持静音操作')
      return
    }

    track.isMuted = !track.isMuted
    updateTrackTimestamp(track)

    // 同步该轨道上所有TimelineItem的sprite静音状态
    if (timelineItems) {
      let affectedClips = 0

      const trackItems = timelineItems.value.filter(
        (item) => item.trackId === trackId && item.timelineStatus === 'ready' && item.sprite,
      )

      trackItems.forEach((item) => {
        if (item.sprite && 'setTrackMuteChecker' in item.sprite) {
          // 为sprite设置轨道静音检查函数
          const sprite = item.sprite as any
          sprite.setTrackMuteChecker(() => track.isMuted)
          affectedClips++
        }
      })

      console.log('🔇 切换轨道静音状态:', {
        trackId,
        trackName: track.name,
        trackType: track.type,
        isMuted: track.isMuted,
        affectedClips,
      })
    } else {
      console.log('🔇 切换轨道静音状态:', {
        trackId,
        trackName: track.name,
        trackType: track.type,
        isMuted: track.isMuted,
      })
    }
  }

  /**
   * 重命名轨道 - 兼容trackModule接口
   * @param trackId 轨道ID
   * @param newName 新名称
   */
  function renameTrack(trackId: string, newName: string) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track && newName.trim()) {
      const oldName = track.name
      track.name = newName.trim()
      updateTrackTimestamp(track)
      console.log('✏️ 重命名轨道:', {
        trackId,
        oldName,
        newName: track.name,
      })
    } else if (!track) {
      console.warn('⚠️ 找不到轨道:', trackId)
    } else {
      console.warn('⚠️ 无效的轨道名称:', newName)
    }
  }

  /**
   * 设置轨道高度 - 兼容trackModule接口
   * @param trackId 轨道ID
   * @param height 新高度
   */
  function setTrackHeight(trackId: string, height: number) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track && height > 0) {
      track.height = height
      updateTrackTimestamp(track)
      console.log('📏 设置轨道高度:', {
        trackId,
        trackName: track.name,
        height,
      })
    } else if (!track) {
      console.warn('⚠️ 找不到轨道:', trackId)
    } else {
      console.warn('⚠️ 无效的轨道高度:', height)
    }
  }



  // ==================== 查询方法 ====================

  /**
   * 获取轨道信息
   * @param trackId 轨道ID
   * @returns 轨道对象或undefined
   */
  function getTrack(trackId: string): UnifiedTrack | undefined {
    return tracks.value.find((t) => t.id === trackId)
  }

  /**
   * 获取所有轨道的摘要信息
   * @returns 轨道摘要数组
   */
  function getTracksSummary() {
    return tracks.value.map((track) => ({
      id: track.id,
      name: track.name,
      type: track.type,
      isVisible: track.isVisible,
      isMuted: track.isMuted,
      height: track.height,
    }))
  }

  // ==================== 批量操作方法 ====================

  /**
   * 重置所有轨道为默认状态
   */
  function resetTracksToDefaults(): void {
    tracks.value.forEach((track) => {
      const defaultConfig = DEFAULT_UNIFIED_TRACK_CONFIGS[track.type]
      track.status = 'active'
      track.isVisible = defaultConfig.isVisible ?? true
      track.isMuted = defaultConfig.isMuted ?? false
      track.height = defaultConfig.height ?? 60
      updateTrackTimestamp(track)
    })

    console.log('🔄 所有轨道已重置为默认状态')
  }

  /**
   * 恢复轨道列表（用于项目加载）
   * @param restoredTracks 要恢复的轨道数组
   */
  function restoreTracks(restoredTracks: UnifiedTrack[]): void {
    console.log(`📋 开始恢复轨道: ${restoredTracks.length}个轨道`)

    // 清空现有轨道
    tracks.value = []

    // 添加恢复的轨道
    for (const track of restoredTracks) {
      tracks.value.push({ ...track })
      console.log(`📋 恢复轨道: ${track.name} (${track.type})`)
    }

    // 重新排序
    tracks.value.sort((a, b) => a.order - b.order)

    console.log(`✅ 轨道恢复完成: ${tracks.value.length}个轨道`)
  }



  // ==================== 导出接口 ====================

  return {
    // 状态
    tracks,

    // 方法 - 与trackModule保持一致的接口
    addTrack,
    removeTrack,
    toggleTrackVisibility,
    toggleTrackMute,
    renameTrack,
    setTrackHeight,
    getTrack,
    getTracksSummary,
    resetTracksToDefaults,

    // 恢复方法
    restoreTracks,
  }
}

// ==================== 工具函数和类型守卫 ====================
// 工具函数已移至 ../../unified/track 模块，可直接导入使用

// 导出类型定义
export type UnifiedTrackModule = ReturnType<typeof createUnifiedTrackModule>

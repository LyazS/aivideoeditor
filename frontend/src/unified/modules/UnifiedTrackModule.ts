import { ref, type Ref } from 'vue'
import type { UnifiedTrackData, UnifiedTrackType } from '../track/TrackTypes'
import { createUnifiedTrackData } from '../track/TrackTypes'
import type { UnifiedTimelineItemData } from '../timelineitem/TimelineItemData'
import { isReady } from '../timelineitem/TimelineItemQueries'
import { hasAudioCapabilities } from '../utils/UnifiedSpriteTypeGuards'

/**
 * 统一轨道管理模块
 * 基于新架构的统一类型系统重构的轨道管理功能
 *
 * 主要变化：
 * 1. 使用 UnifiedTrackData 替代原有的 Track 类型
 * 2. 支持更丰富的轨道状态和属性管理
 * 3. 保持与原有模块相同的API接口，便于迁移
 */
export function createUnifiedTrackModule() {
  // ==================== 状态定义 ====================

  // 轨道列表 - 使用统一轨道类型
  const tracks = ref<UnifiedTrackData[]>([
    createUnifiedTrackData('video', '默认视频轨道'),
    createUnifiedTrackData('audio', '默认音频轨道'),
    createUnifiedTrackData('text', '默认文本轨道'),
  ])

  // ==================== 轨道管理方法 ====================

  /**
   * 添加新轨道
   * @param type 轨道类型
   * @param name 轨道名称（可选）
   * @param position 插入位置（可选，默认为末尾）
   * @returns 新创建的轨道对象
   */
  function addTrack(
    type: UnifiedTrackType = 'video',
    name?: string,
    position?: number,
    id?: string,
  ): UnifiedTrackData {
    // 计算同类型轨道的数量，用于生成默认名称
    const sameTypeCount = tracks.value.filter((t) => t.type === type).length + 1

    // 生成默认名称
    const typeNames = {
      video: '视频轨道',
      audio: '音频轨道',
      text: '文本轨道',
      subtitle: '字幕轨道',
      effect: '特效轨道',
    }

    const trackName = name || `${typeNames[type]} ${sameTypeCount}`

    // 创建新轨道
    const newTrack = createUnifiedTrackData(type, trackName, undefined, id)

    // 根据位置参数决定插入位置
    if (position !== undefined && position >= 0 && position <= tracks.value.length) {
      tracks.value.splice(position, 0, newTrack)
    } else {
      tracks.value.push(newTrack)
    }

    console.log('🎵 添加新轨道:', {
      id: newTrack.id,
      name: newTrack.name,
      type: newTrack.type,
      position: position !== undefined ? position : tracks.value.length - 1,
      totalTracks: tracks.value.length,
    })

    return newTrack
  }

  /**
   * 删除轨道
   * @param trackId 要删除的轨道ID
   * @param timelineItems 时间轴项目引用（用于删除该轨道上的所有项目）
   * @param removeTimelineItemCallback 删除时间轴项目的回调函数
   */
  function removeTrack(
    trackId: string,
    timelineItems: Ref<UnifiedTimelineItemData[]>,
    removeTimelineItemCallback?: (timelineItemId: string) => void,
  ) {
    // 不能删除最后一个轨道
    if (tracks.value.length <= 1) {
      console.warn('⚠️ 不能删除最后一个轨道')
      return
    }

    const trackToRemove = tracks.value.find((t) => t.id === trackId)
    if (!trackToRemove) {
      console.warn('⚠️ 找不到要删除的轨道:', trackId)
      return
    }

    // 找到该轨道上的所有时间轴项目并删除它们
    const affectedItems = timelineItems.value.filter((item) => item.trackId === trackId)

    // 删除该轨道上的所有时间轴项目
    affectedItems.forEach((item) => {
      if (removeTimelineItemCallback) {
        removeTimelineItemCallback(item.id)
      }
    })

    // 删除轨道
    const index = tracks.value.findIndex((t) => t.id === trackId)
    if (index > -1) {
      tracks.value.splice(index, 1)
    }

    console.log('🗑️ 删除轨道:', {
      removedTrackId: trackId,
      removedTrackName: trackToRemove.name,
      deletedItemsCount: affectedItems.length,
      remainingTracks: tracks.value.length,
    })
  }

  /**
   * 切换轨道可见性
   * @param trackId 轨道ID
   * @param timelineItems 时间轴项目列表（用于同步sprite可见性）
   */
  function toggleTrackVisibility(trackId: string, timelineItems?: Ref<UnifiedTimelineItemData[]>) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (!track) {
      console.warn('⚠️ 找不到轨道:', trackId)
      return
    }

    // 音频轨道不支持可见性控制，只支持静音控制
    if (track.type === 'audio') {
      console.warn('⚠️ 音频轨道不支持可见性控制，请使用静音功能')
      return
    }

    // 切换可见性状态
    track.isVisible = !track.isVisible

    // 同步该轨道上所有TimelineItem的sprite可见性（仅限视觉轨道）
    if (timelineItems) {
      const trackItems = timelineItems.value.filter((item) => item.trackId === trackId)
      trackItems.forEach((item) => {
        // 使用 isReady 函数检查时间轴项目是否就绪且有 sprite
        if (isReady(item)) {
          // 所有UnifiedSprite都继承自WebAV的VisibleSprite，都有visible属性
          item.runtime.sprite!.visible = track.isVisible
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
   * 切换轨道静音状态
   * @param trackId 轨道ID
   * @param timelineItems 时间轴项目列表（用于同步sprite静音状态）
   */
  function toggleTrackMute(trackId: string, timelineItems?: Ref<UnifiedTimelineItemData[]>) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (!track) {
      console.warn('⚠️ 找不到轨道:', trackId)
      return
    }

    // 检查轨道类型是否支持静音操作
    if (track.type === 'text' || track.type === 'subtitle') {
      console.warn('⚠️ 文本/字幕轨道不支持静音操作')
      return
    }

    // 切换静音状态
    track.isMuted = !track.isMuted

    // 同步该轨道上所有TimelineItem的sprite静音状态
    if (timelineItems) {
      // 获取该轨道上具有音频功能的时间轴项目
      const trackItems = timelineItems.value.filter((item) => item.trackId === trackId)
      let affectedClips = 0

      trackItems.forEach((item) => {
        // 使用 isReady 函数检查时间轴项目是否就绪且有 sprite
        if (isReady(item)) {
          const sprite = item.runtime.sprite!
          // 检查sprite是否具有音频功能（VideoVisibleSprite 或 AudioVisibleSprite）
          if (hasAudioCapabilities(sprite)) {
            sprite.setTrackMuted(track.isMuted)
          }
        }
        affectedClips++
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
   * 重命名轨道
   * @param trackId 轨道ID
   * @param newName 新名称
   */
  function renameTrack(trackId: string, newName: string) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track && newName.trim()) {
      const oldName = track.name
      track.name = newName.trim()

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
   * 设置轨道高度
   * @param trackId 轨道ID
   * @param height 新高度
   */
  function setTrackHeight(trackId: string, height: number) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track && height > 0) {
      track.height = height

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

  /**
   * 获取轨道信息
   * @param trackId 轨道ID
   * @returns 轨道对象或undefined
   */
  function getTrack(trackId: string): UnifiedTrackData | undefined {
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

  /**
   * 重置所有轨道为默认状态
   */
  function resetTracksToDefaults() {
    tracks.value.forEach((track) => {
      // 重置可见性和静音状态
      track.isVisible = true
      track.isMuted = false
    })
    console.log('🔄 所有轨道已重置为默认状态')
  }

  /**
   * 恢复轨道列表（用于项目加载）
   * @param restoredTracks 要恢复的轨道数组
   */
  function restoreTracks(restoredTracks: UnifiedTrackData[]) {
    console.log(`📋 开始恢复轨道: ${restoredTracks.length}个轨道`)

    // 清空现有轨道
    tracks.value = []

    // 添加恢复的轨道
    for (const track of restoredTracks) {
      // 创建新的响应式轨道对象
      const restoredTrack = createUnifiedTrackData(track.type, track.name, {
        ...track,
      }, track.id)

      tracks.value.push(restoredTrack)
      console.log(`📋 恢复轨道: ${track.name} (${track.type})`)
    }

    console.log(`✅ 轨道恢复完成: ${tracks.value.length}个轨道`)
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    tracks,

    // 基础方法
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

// 导出类型定义
export type UnifiedTrackModule = ReturnType<typeof createUnifiedTrackModule>

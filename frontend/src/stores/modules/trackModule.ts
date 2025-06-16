import { ref, type Ref } from 'vue'
import type { Track, TimelineItem } from '../../types/videoTypes'

/**
 * 轨道管理模块
 * 负责管理轨道的创建、删除和属性设置
 */
export function createTrackModule() {
  // ==================== 状态定义 ====================

  // 轨道列表
  const tracks = ref<Track[]>([
    { id: 1, name: '轨道 1', isVisible: true, isMuted: false, height: 80 },
    { id: 2, name: '轨道 2', isVisible: true, isMuted: false, height: 80 },
  ])

  // ==================== 轨道管理方法 ====================

  /**
   * 添加新轨道
   * @param name 轨道名称（可选）
   * @returns 新创建的轨道对象
   */
  function addTrack(name?: string): Track {
    const newId = Math.max(...tracks.value.map((t) => t.id)) + 1
    const newTrack: Track = {
      id: newId,
      name: name || `轨道 ${newId}`,
      isVisible: true,
      isMuted: false,
      height: 80,
    }
    tracks.value.push(newTrack)

    console.log('🎵 添加新轨道:', {
      id: newTrack.id,
      name: newTrack.name,
      totalTracks: tracks.value.length,
    })

    return newTrack
  }

  /**
   * 删除轨道
   * @param trackId 要删除的轨道ID
   * @param timelineItems 时间轴项目引用（用于重新分配轨道）
   */
  function removeTrack(trackId: number, timelineItems: Ref<TimelineItem[]>) {
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

    // 将该轨道的所有时间轴项目移动到第一个轨道
    const firstTrackId = tracks.value[0].id
    const affectedItems = timelineItems.value.filter((item) => item.trackId === trackId)

    affectedItems.forEach((item) => {
      item.trackId = firstTrackId
    })

    // 删除轨道
    const index = tracks.value.findIndex((t) => t.id === trackId)
    if (index > -1) {
      tracks.value.splice(index, 1)
    }

    console.log('🗑️ 删除轨道:', {
      removedTrackId: trackId,
      removedTrackName: trackToRemove.name,
      affectedItemsCount: affectedItems.length,
      remainingTracks: tracks.value.length,
    })
  }

  /**
   * 切换轨道可见性
   * @param trackId 轨道ID
   */
  function toggleTrackVisibility(trackId: number) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) {
      track.isVisible = !track.isVisible
      console.log('👁️ 切换轨道可见性:', {
        trackId,
        trackName: track.name,
        isVisible: track.isVisible,
      })
    } else {
      console.warn('⚠️ 找不到轨道:', trackId)
    }
  }

  /**
   * 切换轨道静音状态
   * @param trackId 轨道ID
   */
  function toggleTrackMute(trackId: number) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) {
      track.isMuted = !track.isMuted
      console.log('🔇 切换轨道静音状态:', {
        trackId,
        trackName: track.name,
        isMuted: track.isMuted,
      })
    } else {
      console.warn('⚠️ 找不到轨道:', trackId)
    }
  }

  /**
   * 重命名轨道
   * @param trackId 轨道ID
   * @param newName 新名称
   */
  function renameTrack(trackId: number, newName: string) {
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
  function setTrackHeight(trackId: number, height: number) {
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
  function getTrack(trackId: number): Track | undefined {
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
      track.isVisible = true
      track.isMuted = false
      track.height = 80
    })
    console.log('🔄 所有轨道已重置为默认状态')
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    tracks,

    // 方法
    addTrack,
    removeTrack,
    toggleTrackVisibility,
    toggleTrackMute,
    renameTrack,
    setTrackHeight,
    getTrack,
    getTracksSummary,
    resetTracksToDefaults,
  }
}

// 导出类型定义
export type TrackModule = ReturnType<typeof createTrackModule>

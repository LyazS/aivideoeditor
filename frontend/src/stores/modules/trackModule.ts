import { ref, type Ref } from 'vue'
import type { Track, TimelineItem, TrackType } from '../../types'
import { VideoVisibleSprite } from '../../utils/VideoVisibleSprite'

/**
 * 轨道管理模块
 * 负责管理轨道的创建、删除和属性设置
 */
export function createTrackModule() {
  // ==================== 状态定义 ====================

  // 轨道列表
  const tracks = ref<Track[]>([
    { id: 1, name: '视频轨道 1', type: 'video', isVisible: true, isMuted: false, height: 80 },
    { id: 2, name: '视频轨道 2', type: 'video', isVisible: true, isMuted: false, height: 80 },
  ])

  // ==================== 轨道管理方法 ====================

  /**
   * 添加新轨道
   * @param type 轨道类型
   * @param name 轨道名称（可选）
   * @returns 新创建的轨道对象
   */
  function addTrack(type: TrackType = 'video', name?: string): Track {
    const newId = Math.max(...tracks.value.map((t) => t.id)) + 1

    // 根据轨道类型生成默认名称和高度
    const typeNames = {
      video: '视频轨道',
      audio: '音频轨道',
      subtitle: '字幕轨道'
    }

    // 根据轨道类型设置默认高度
    const defaultHeights = {
      video: 80,    // 视频轨道标准高度
      audio: 60,    // 音频轨道较矮
      subtitle: 50  // 字幕轨道最矮
    }

    const newTrack: Track = {
      id: newId,
      name: name || `${typeNames[type]} ${newId}`,
      type,
      isVisible: true,
      isMuted: false,
      height: defaultHeights[type],
    }
    tracks.value.push(newTrack)

    console.log('🎵 添加新轨道:', {
      id: newTrack.id,
      name: newTrack.name,
      type: newTrack.type,
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
    trackId: number,
    timelineItems: Ref<TimelineItem[]>,
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
  function toggleTrackVisibility(trackId: number, timelineItems?: Ref<TimelineItem[]>) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) {
      track.isVisible = !track.isVisible

      // 同步该轨道上所有TimelineItem的sprite可见性
      if (timelineItems) {
        const trackItems = timelineItems.value.filter((item) => item.trackId === trackId)
        trackItems.forEach((item) => {
          if (item.sprite) {
            item.sprite.visible = track.isVisible
          }
        })

        console.log('👁️ 切换轨道可见性:', {
          trackId,
          trackName: track.name,
          isVisible: track.isVisible,
          affectedClips: trackItems.length,
        })
      } else {
        console.log('👁️ 切换轨道可见性:', {
          trackId,
          trackName: track.name,
          isVisible: track.isVisible,
        })
      }
    } else {
      console.warn('⚠️ 找不到轨道:', trackId)
    }
  }

  /**
   * 切换轨道静音状态
   * @param trackId 轨道ID
   * @param timelineItems 时间轴项目列表（用于同步sprite静音状态）
   */
  function toggleTrackMute(trackId: number, timelineItems?: Ref<TimelineItem[]>) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) {
      // 检查轨道类型是否支持静音操作
      if (track.type === 'subtitle') {
        console.warn('⚠️ 字幕轨道不支持静音操作')
        return
      }

      track.isMuted = !track.isMuted

      // 同步该轨道上所有TimelineItem的sprite静音状态
      if (timelineItems) {
        let affectedClips = 0

        if (track.type === 'video') {
          // 视频轨道：只影响视频类型的项目
          const trackItems = timelineItems.value.filter(
            (item) => item.trackId === trackId && item.mediaType === 'video',
          )
          trackItems.forEach((item) => {
            if (item.sprite && 'setTrackMuteChecker' in item.sprite) {
              // 为每个VideoVisibleSprite设置轨道静音检查函数
              const sprite = item.sprite as VideoVisibleSprite
              sprite.setTrackMuteChecker(() => track.isMuted)
              affectedClips++
            }
          })
        } else if (track.type === 'audio') {
          // 音频轨道：将来处理纯音频项目
          // TODO: 实现音频轨道的静音逻辑
        }

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
    const defaultHeights = {
      video: 80,
      audio: 60,
      subtitle: 50
    }

    tracks.value.forEach((track) => {
      track.isVisible = true
      track.isMuted = false
      track.height = defaultHeights[track.type] || 80
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

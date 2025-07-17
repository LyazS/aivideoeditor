import { ref, type Ref } from 'vue'
import type { Track, TimelineItem, TrackType } from '../../types'
import { VideoVisibleSprite } from '../../utils/VideoVisibleSprite'
import { AudioVisibleSprite } from '../../utils/AudioVisibleSprite'
import { generateTrackId } from '../../utils/idGenerator'

/**
 * 轨道管理模块
 * 负责管理轨道的创建、删除和属性设置
 */
export function createTrackModule() {
  // ==================== 状态定义 ====================

  // 轨道列表
  const tracks = ref<Track[]>([
    {
      id: generateTrackId(),
      name: '默认视频轨道',
      type: 'video',
      isVisible: true,
      isMuted: false,
      height: 60,
    },
    {
      id: generateTrackId(),
      name: '默认音频轨道',
      type: 'audio',
      isVisible: true,
      isMuted: false,
      height: 60,
    },
    {
      id: generateTrackId(),
      name: '默认文本轨道',
      type: 'text',
      isVisible: true,
      isMuted: false,
      height: 60,
    },
  ])

  // ==================== 轨道管理方法 ====================

  /**
   * 添加新轨道
   * @param type 轨道类型
   * @param name 轨道名称（可选）
   * @param position 插入位置（可选，默认为末尾）
   * @returns 新创建的轨道对象
   */
  function addTrack(type: TrackType = 'video', name?: string, position?: number): Track {
    // 使用UUID4生成唯一ID
    const newId = generateTrackId()

    // 根据轨道类型生成默认名称和高度
    const typeNames = {
      video: '视频轨道',
      audio: '音频轨道',
      text: '文本轨道',
    }

    // 根据轨道类型设置默认高度
    const defaultHeights = {
      video: 60, // 视频轨道统一高度
      audio: 60, // 音频轨道统一高度
      text: 60, // 文本轨道统一高度
    }

    // 计算同类型轨道的数量，用于生成默认名称
    const sameTypeCount = tracks.value.filter((t) => t.type === type).length + 1

    const newTrack: Track = {
      id: newId,
      name: name || `${typeNames[type]} ${sameTypeCount}`,
      type,
      isVisible: true,
      isMuted: false,
      height: defaultHeights[type],
    }

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
  function toggleTrackVisibility(trackId: string, timelineItems?: Ref<TimelineItem[]>) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) {
      // 音频轨道不支持可见性控制，只支持静音控制
      if (track.type === 'audio') {
        console.warn('⚠️ 音频轨道不支持可见性控制，请使用静音功能')
        return
      }

      track.isVisible = !track.isVisible

      // 同步该轨道上所有TimelineItem的sprite可见性（仅限视觉轨道）
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
    } else {
      console.warn('⚠️ 找不到轨道:', trackId)
    }
  }

  /**
   * 切换轨道静音状态
   * @param trackId 轨道ID
   * @param timelineItems 时间轴项目列表（用于同步sprite静音状态）
   */
  function toggleTrackMute(trackId: string, timelineItems?: Ref<TimelineItem[]>) {
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) {
      // 检查轨道类型是否支持静音操作
      if (track.type === 'text') {
        console.warn('⚠️ 文本轨道不支持静音操作')
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
          // 音频轨道：影响音频类型的项目
          const trackItems = timelineItems.value.filter(
            (item) => item.trackId === trackId && item.mediaType === 'audio',
          )
          trackItems.forEach((item) => {
            if (item.sprite && 'setTrackMuteChecker' in item.sprite) {
              // 为每个AudioVisibleSprite设置轨道静音检查函数
              const sprite = item.sprite as AudioVisibleSprite
              sprite.setTrackMuteChecker(() => track.isMuted)
              affectedClips++
            }
          })
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
  function getTrack(trackId: string): Track | undefined {
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
      video: 60,
      audio: 60,
      text: 60,
    }

    tracks.value.forEach((track) => {
      track.isVisible = true
      track.isMuted = false
      track.height = defaultHeights[track.type] || 60
    })
    console.log('🔄 所有轨道已重置为默认状态')
  }

  /**
   * 恢复轨道列表（用于项目加载）
   * @param restoredTracks 要恢复的轨道数组
   */
  function restoreTracks(restoredTracks: Track[]) {
    console.log(`📋 开始恢复轨道: ${restoredTracks.length}个轨道`)

    // 清空现有轨道
    tracks.value = []

    // 添加恢复的轨道
    for (const track of restoredTracks) {
      tracks.value.push({ ...track })
      console.log(`📋 恢复轨道: ${track.name} (${track.type})`)
    }

    console.log(`✅ 轨道恢复完成: ${tracks.value.length}个轨道`)
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

    // 恢复方法
    restoreTracks,
  }
}

// 导出类型定义
export type TrackModule = ReturnType<typeof createTrackModule>

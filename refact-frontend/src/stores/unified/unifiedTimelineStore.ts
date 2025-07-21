/**
 * 统一异步源架构 - 时间轴管理Store
 * 
 * 基于统一异步源架构的时间轴状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  UnifiedTimelineItem,
  UnifiedTrack,
  TimelineItemType,
  TrackType,
  TimelineItemQuery,
  BaseDataSource,
  DataSourceStatus
} from '@/types/unified'

// 时间轴状态
export interface TimelineState {
  tracks: UnifiedTrack[]
  items: UnifiedTimelineItem[]
  selectedItemIds: string[]
  currentFrame: number
  zoomLevel: number
  isLoading: boolean
  error: string | null
}

export const useUnifiedTimelineStore = defineStore('unifiedTimeline', () => {
  // 状态
  const state = ref<TimelineState>({
    tracks: [],
    items: [],
    selectedItemIds: [],
    currentFrame: 0,
    zoomLevel: 1,
    isLoading: false,
    error: null
  })

  // 数据源
  const timelineDataSource = ref<BaseDataSource<UnifiedTimelineItem[]> | null>(null)
  const tracksDataSource = ref<BaseDataSource<UnifiedTrack[]> | null>(null)

  // 计算属性
  const selectedItems = computed(() => 
    state.value.items.filter(item => state.value.selectedItemIds.includes(item.id))
  )

  const itemsByTrack = computed(() => {
    const groups: Record<string, UnifiedTimelineItem[]> = {}
    
    state.value.tracks.forEach(track => {
      groups[track.id] = state.value.items.filter(item => item.trackId === track.id)
    })
    
    return groups
  })

  const totalDuration = computed(() => {
    if (state.value.items.length === 0) return 0
    return Math.max(...state.value.items.map(item => item.endFrame))
  })

  const visibleTracks = computed(() => 
    state.value.tracks.filter(track => track.visible)
  )

  // 初始化默认轨道
  const initializeDefaultTracks = () => {
    if (state.value.tracks.length === 0) {
      const defaultTracks: UnifiedTrack[] = [
        {
          id: 'video-track-1',
          name: '视频轨道 1',
          type: TrackType.VIDEO,
          height: 80,
          order: 0,
          visible: true,
          muted: false,
          locked: false,
          color: '#3b82f6',
          createdAt: new Date()
        },
        {
          id: 'audio-track-1',
          name: '音频轨道 1',
          type: TrackType.AUDIO,
          height: 60,
          order: 1,
          visible: true,
          muted: false,
          locked: false,
          color: '#10b981',
          createdAt: new Date()
        }
      ]
      
      state.value.tracks = defaultTracks
    }
  }

  // 创建轨道
  const createTrack = (type: TrackType, name?: string) => {
    const trackCount = state.value.tracks.filter(t => t.type === type).length
    const defaultName = name || `${getTrackTypeLabel(type)}轨道 ${trackCount + 1}`
    
    const newTrack: UnifiedTrack = {
      id: `${type}-track-${Date.now()}`,
      name: defaultName,
      type,
      height: getDefaultTrackHeight(type),
      order: state.value.tracks.length,
      visible: true,
      muted: false,
      locked: false,
      color: getTrackTypeColor(type),
      createdAt: new Date()
    }
    
    state.value.tracks.push(newTrack)
    console.log('Track created (empty shell):', newTrack)
    
    return newTrack
  }

  // 删除轨道
  const removeTrack = (trackId: string) => {
    const trackIndex = state.value.tracks.findIndex(t => t.id === trackId)
    if (trackIndex === -1) return false
    
    // 移除轨道上的所有项目
    state.value.items = state.value.items.filter(item => item.trackId !== trackId)
    
    // 移除轨道
    const removedTrack = state.value.tracks.splice(trackIndex, 1)[0]
    console.log('Track removed (empty shell):', removedTrack)
    
    return true
  }

  // 更新轨道
  const updateTrack = (trackId: string, updates: Partial<UnifiedTrack>) => {
    const track = state.value.tracks.find(t => t.id === trackId)
    if (track) {
      Object.assign(track, updates)
      console.log('Track updated (empty shell):', track)
    }
  }

  // 添加时间轴项目
  const addTimelineItem = async (item: Partial<UnifiedTimelineItem>) => {
    state.value.isLoading = true
    state.value.error = null

    try {
      // 空壳实现 - 创建模拟时间轴项目
      const newItem: UnifiedTimelineItem = {
        id: `timeline_${Date.now()}`,
        name: item.name || '未命名项目',
        type: item.type || TimelineItemType.MEDIA_CLIP,
        trackId: item.trackId || state.value.tracks[0]?.id || '',
        startFrame: item.startFrame || 0,
        durationFrames: item.durationFrames || 30,
        endFrame: (item.startFrame || 0) + (item.durationFrames || 30),
        status: DataSourceStatus.SUCCESS,
        error: null,
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
          anchorX: 0.5,
          anchorY: 0.5
        },
        animationTracks: [],
        visible: true,
        enabled: true,
        locked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        customProperties: item.customProperties || {}
      } as UnifiedTimelineItem

      state.value.items.push(newItem)
      console.log('Timeline item added (empty shell):', newItem)
      
      return newItem
    } catch (error) {
      state.value.error = error instanceof Error ? error.message : '添加时间轴项目失败'
      return null
    } finally {
      state.value.isLoading = false
    }
  }

  // 移除时间轴项目
  const removeTimelineItem = (id: string) => {
    const index = state.value.items.findIndex(item => item.id === id)
    if (index !== -1) {
      const removedItem = state.value.items.splice(index, 1)[0]
      
      // 从选中列表中移除
      const selectedIndex = state.value.selectedItemIds.indexOf(id)
      if (selectedIndex !== -1) {
        state.value.selectedItemIds.splice(selectedIndex, 1)
      }
      
      console.log('Timeline item removed (empty shell):', removedItem)
    }
  }

  // 更新时间轴项目
  const updateTimelineItem = (id: string, updates: Partial<UnifiedTimelineItem>) => {
    const item = state.value.items.find(item => item.id === id)
    if (item) {
      Object.assign(item, updates)
      
      // 更新结束帧
      if (updates.startFrame !== undefined || updates.durationFrames !== undefined) {
        item.endFrame = item.startFrame + item.durationFrames
      }
      
      item.updatedAt = new Date()
      console.log('Timeline item updated (empty shell):', item)
    }
  }

  // 查询时间轴项目
  const queryTimelineItems = (query: TimelineItemQuery) => {
    let items = state.value.items

    if (query.type) {
      const types = Array.isArray(query.type) ? query.type : [query.type]
      items = items.filter(item => types.includes(item.type))
    }

    if (query.trackId) {
      const trackIds = Array.isArray(query.trackId) ? query.trackId : [query.trackId]
      items = items.filter(item => trackIds.includes(item.trackId))
    }

    if (query.startFrameAfter !== undefined) {
      items = items.filter(item => item.startFrame >= query.startFrameAfter!)
    }

    if (query.startFrameBefore !== undefined) {
      items = items.filter(item => item.startFrame <= query.startFrameBefore!)
    }

    return items
  }

  // 选择时间轴项目
  const selectTimelineItem = (id: string, multiSelect = false) => {
    if (!multiSelect) {
      state.value.selectedItemIds = [id]
    } else {
      const index = state.value.selectedItemIds.indexOf(id)
      if (index === -1) {
        state.value.selectedItemIds.push(id)
      } else {
        state.value.selectedItemIds.splice(index, 1)
      }
    }
  }

  // 清空选择
  const clearSelection = () => {
    state.value.selectedItemIds = []
  }

  // 设置当前帧
  const setCurrentFrame = (frame: number) => {
    state.value.currentFrame = Math.max(0, frame)
  }

  // 设置缩放级别
  const setZoomLevel = (zoom: number) => {
    state.value.zoomLevel = Math.max(0.1, Math.min(10, zoom))
  }

  // 清空时间轴
  const clearTimeline = () => {
    state.value.items = []
    state.value.selectedItemIds = []
    state.value.currentFrame = 0
    state.value.error = null
  }

  // 辅助函数
  const getTrackTypeLabel = (type: TrackType): string => {
    const labels: Record<TrackType, string> = {
      [TrackType.VIDEO]: '视频',
      [TrackType.AUDIO]: '音频',
      [TrackType.TEXT]: '文本',
      [TrackType.EFFECT]: '效果'
    }
    return labels[type]
  }

  const getDefaultTrackHeight = (type: TrackType): number => {
    const heights: Record<TrackType, number> = {
      [TrackType.VIDEO]: 80,
      [TrackType.AUDIO]: 60,
      [TrackType.TEXT]: 60,
      [TrackType.EFFECT]: 40
    }
    return heights[type]
  }

  const getTrackTypeColor = (type: TrackType): string => {
    const colors: Record<TrackType, string> = {
      [TrackType.VIDEO]: '#3b82f6',
      [TrackType.AUDIO]: '#10b981',
      [TrackType.TEXT]: '#f59e0b',
      [TrackType.EFFECT]: '#8b5cf6'
    }
    return colors[type]
  }

  // 初始化
  initializeDefaultTracks()

  return {
    // 状态
    state,
    timelineDataSource,
    tracksDataSource,
    
    // 计算属性
    selectedItems,
    itemsByTrack,
    totalDuration,
    visibleTracks,
    
    // 方法
    createTrack,
    removeTrack,
    updateTrack,
    addTimelineItem,
    removeTimelineItem,
    updateTimelineItem,
    queryTimelineItems,
    selectTimelineItem,
    clearSelection,
    setCurrentFrame,
    setZoomLevel,
    clearTimeline,
    initializeDefaultTracks
  }
})

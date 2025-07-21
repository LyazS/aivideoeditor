/**
 * 统一异步源架构 - 媒体管理Store
 * 
 * 基于统一异步源架构的媒体项目状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  UnifiedMediaItem,
  UnifiedMediaType,
  MediaSourceType,
  MediaItemQuery,
  BaseDataSource,
  DataSourceStatus
} from '@/types/unified'

// 媒体库状态
export interface MediaLibraryState {
  items: UnifiedMediaItem[]
  isLoading: boolean
  error: string | null
  selectedItemIds: string[]
  activeFilter: UnifiedMediaType | 'all'
  searchQuery: string
}

export const useUnifiedMediaStore = defineStore('unifiedMedia', () => {
  // 状态
  const state = ref<MediaLibraryState>({
    items: [],
    isLoading: false,
    error: null,
    selectedItemIds: [],
    activeFilter: 'all',
    searchQuery: ''
  })

  // 数据源
  const mediaLibrarySource = ref<BaseDataSource<UnifiedMediaItem[]> | null>(null)
  const importSource = ref<BaseDataSource<UnifiedMediaItem[]> | null>(null)

  // 计算属性
  const filteredItems = computed(() => {
    let items = state.value.items

    // 按类型筛选
    if (state.value.activeFilter !== 'all') {
      items = items.filter(item => item.mediaType === state.value.activeFilter)
    }

    // 按搜索查询筛选
    if (state.value.searchQuery) {
      const query = state.value.searchQuery.toLowerCase()
      items = items.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    return items
  })

  const selectedItems = computed(() => 
    state.value.items.filter(item => state.value.selectedItemIds.includes(item.id))
  )

  const itemsByType = computed(() => {
    const groups: Record<string, UnifiedMediaItem[]> = {
      all: state.value.items,
      video: [],
      audio: [],
      image: [],
      text: []
    }

    state.value.items.forEach(item => {
      groups[item.mediaType].push(item)
    })

    return groups
  })

  const itemCounts = computed(() => ({
    all: state.value.items.length,
    video: itemsByType.value.video.length,
    audio: itemsByType.value.audio.length,
    image: itemsByType.value.image.length,
    text: itemsByType.value.text.length
  }))

  // 添加媒体项目
  const addMediaItem = async (item: Partial<UnifiedMediaItem>) => {
    state.value.isLoading = true
    state.value.error = null

    try {
      // 空壳实现 - 创建模拟媒体项目
      const newItem: UnifiedMediaItem = {
        id: `media_${Date.now()}`,
        name: item.name || '未命名媒体',
        mediaType: item.mediaType || UnifiedMediaType.VIDEO,
        sourceType: item.sourceType || MediaSourceType.LOCAL_FILE,
        dataSource: {
          id: `data_${Date.now()}`,
          type: 'media_file',
          status: DataSourceStatus.SUCCESS,
          data: null,
          error: null,
          progress: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {}
        },
        metadataSource: {
          id: `metadata_${Date.now()}`,
          type: 'media_metadata',
          status: DataSourceStatus.SUCCESS,
          data: null,
          error: null,
          progress: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {}
        },
        status: DataSourceStatus.SUCCESS,
        progress: 100,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: item.tags || [],
        customProperties: item.customProperties || {}
      }

      state.value.items.push(newItem)
      console.log('Media item added (empty shell):', newItem)
      
      return newItem
    } catch (error) {
      state.value.error = error instanceof Error ? error.message : '添加媒体失败'
      return null
    } finally {
      state.value.isLoading = false
    }
  }

  // 从文件添加媒体
  const addFromFiles = async (files: File[]) => {
    const results: UnifiedMediaItem[] = []

    for (const file of files) {
      const mediaType = getMediaTypeFromFile(file)
      const item = await addMediaItem({
        name: file.name,
        mediaType,
        sourceType: MediaSourceType.LOCAL_FILE,
        tags: [mediaType]
      })
      
      if (item) {
        results.push(item)
      }
    }

    return results
  }

  // 从URL添加媒体
  const addFromUrl = async (url: string, name?: string) => {
    const mediaType = getMediaTypeFromUrl(url)
    return await addMediaItem({
      name: name || extractNameFromUrl(url),
      mediaType,
      sourceType: MediaSourceType.REMOTE_URL,
      tags: [mediaType, 'remote']
    })
  }

  // 移除媒体项目
  const removeMediaItem = (id: string) => {
    const index = state.value.items.findIndex(item => item.id === id)
    if (index !== -1) {
      const removedItem = state.value.items.splice(index, 1)[0]
      
      // 从选中列表中移除
      const selectedIndex = state.value.selectedItemIds.indexOf(id)
      if (selectedIndex !== -1) {
        state.value.selectedItemIds.splice(selectedIndex, 1)
      }
      
      console.log('Media item removed (empty shell):', removedItem)
    }
  }

  // 更新媒体项目
  const updateMediaItem = (id: string, updates: Partial<UnifiedMediaItem>) => {
    const item = state.value.items.find(item => item.id === id)
    if (item) {
      Object.assign(item, updates)
      item.updatedAt = new Date()
      console.log('Media item updated (empty shell):', item)
    }
  }

  // 获取媒体项目
  const getMediaItem = (id: string) => {
    return state.value.items.find(item => item.id === id) || null
  }

  // 查询媒体项目
  const queryMediaItems = (query: MediaItemQuery) => {
    let items = state.value.items

    if (query.mediaType) {
      const types = Array.isArray(query.mediaType) ? query.mediaType : [query.mediaType]
      items = items.filter(item => types.includes(item.mediaType))
    }

    if (query.sourceType) {
      const types = Array.isArray(query.sourceType) ? query.sourceType : [query.sourceType]
      items = items.filter(item => types.includes(item.sourceType))
    }

    if (query.status) {
      const statuses = Array.isArray(query.status) ? query.status : [query.status]
      items = items.filter(item => statuses.includes(item.status))
    }

    if (query.tags && query.tags.length > 0) {
      items = items.filter(item => 
        query.tags!.some(tag => item.tags.includes(tag))
      )
    }

    if (query.nameContains) {
      const searchTerm = query.nameContains.toLowerCase()
      items = items.filter(item => item.name.toLowerCase().includes(searchTerm))
    }

    return items
  }

  // 选择媒体项目
  const selectMediaItem = (id: string, multiSelect = false) => {
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

  // 设置筛选器
  const setFilter = (filter: UnifiedMediaType | 'all') => {
    state.value.activeFilter = filter
  }

  // 设置搜索查询
  const setSearchQuery = (query: string) => {
    state.value.searchQuery = query
  }

  // 清空媒体库
  const clearMediaLibrary = () => {
    state.value.items = []
    state.value.selectedItemIds = []
    state.value.error = null
  }

  // 辅助函数
  const getMediaTypeFromFile = (file: File): UnifiedMediaType => {
    const type = file.type.toLowerCase()
    if (type.startsWith('video/')) return UnifiedMediaType.VIDEO
    if (type.startsWith('audio/')) return UnifiedMediaType.AUDIO
    if (type.startsWith('image/')) return UnifiedMediaType.IMAGE
    return UnifiedMediaType.VIDEO // 默认
  }

  const getMediaTypeFromUrl = (url: string): UnifiedMediaType => {
    const extension = url.split('.').pop()?.toLowerCase()
    if (['mp4', 'webm', 'avi', 'mov'].includes(extension || '')) return UnifiedMediaType.VIDEO
    if (['mp3', 'wav', 'm4a', 'ogg'].includes(extension || '')) return UnifiedMediaType.AUDIO
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) return UnifiedMediaType.IMAGE
    return UnifiedMediaType.VIDEO // 默认
  }

  const extractNameFromUrl = (url: string): string => {
    return url.split('/').pop()?.split('?')[0] || 'Remote Media'
  }

  return {
    // 状态
    state,
    mediaLibrarySource,
    importSource,
    
    // 计算属性
    filteredItems,
    selectedItems,
    itemsByType,
    itemCounts,
    
    // 方法
    addMediaItem,
    addFromFiles,
    addFromUrl,
    removeMediaItem,
    updateMediaItem,
    getMediaItem,
    queryMediaItems,
    selectMediaItem,
    clearSelection,
    setFilter,
    setSearchQuery,
    clearMediaLibrary
  }
})

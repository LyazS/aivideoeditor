import { ref, computed, type Ref } from 'vue'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { useDialogs } from '@/unified/composables'
import {
  getTrackTypeIcon,
  getTrackTypeLabel,
  getVisibilityIcon,
  getMuteIcon,
  MENU_ICONS,
} from '@/unified/constants/timelineIcons'
import type { UnifiedTrackType, UnifiedTrackData } from '@/unified/track/TrackTypes'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import { regenerateThumbnailForUnifiedTimelineItem } from '@/unified/utils/thumbnailGenerator'

/**
 * 菜单项类型定义
 */
type MenuItem =
  | {
      label: string
      icon: string
      onClick: () => void
    }
  | {
      label: string
      icon: string
      children: MenuItem[]
    }
  | {
      type: 'separator'
    }

/**
 * 时间轴右键菜单模块
 * 提供时间轴右键菜单相关的功能，包括菜单项生成和菜单操作
 */
export function useTimelineContextMenu(
  addNewTrack: (type: UnifiedTrackType, afterTrackId?: string) => Promise<void>,
  toggleVisibility: (trackId: string) => Promise<void>,
  toggleMute: (trackId: string) => Promise<void>,
  autoArrangeTrack: (trackId: string) => Promise<void>,
  startRename: (track: { id: string; name: string }) => Promise<void>,
  removeTrack: (trackId: string) => Promise<void>,
  handleTimelineItemRemove: (timelineItemId: string) => Promise<void>,
  createTextAtPosition: (trackId: string, timePosition: number) => Promise<void>,
  tracks: Ref<UnifiedTrackData[]>,
  getClipsForTrack: (trackId: string) => UnifiedTimelineItemData[],
  getTimePositionFromContextMenu: (contextMenuOptions: { x: number }) => number,
) {
  const unifiedStore = useUnifiedStore()
  const dialogs = useDialogs()

  // 右键菜单相关
  const showContextMenu = ref(false)
  const contextMenuType = ref<'clip' | 'track' | 'empty'>('empty')
  const contextMenuTarget = ref<{
    clipId?: string
    trackId?: string
    element?: HTMLElement
  }>({})

  const contextMenuOptions = ref({
    x: 0,
    y: 0,
    theme: 'mac dark',
    zIndex: 1000,
  })

  // 计算当前菜单项
  const currentMenuItems = computed(() => {
    switch (contextMenuType.value) {
      case 'clip':
        return getClipMenuItems()
      case 'track':
        return getTrackMenuItems()
      case 'empty':
      default:
        return getEmptyMenuItems()
    }
  })

  /**
   * 获取空白区域菜单项
   */
  function getEmptyMenuItems(): MenuItem[] {
    return [
      {
        label: '添加视频轨道',
        icon: getTrackTypeIcon('video'),
        onClick: () => addNewTrack('video'),
      },
      {
        label: '添加音频轨道',
        icon: getTrackTypeIcon('audio'),
        onClick: () => addNewTrack('audio'),
      },
      {
        label: '添加文本轨道',
        icon: getTrackTypeIcon('text'),
        onClick: () => addNewTrack('text'),
      },
    ]
  }

  /**
   * 获取片段菜单项
   */
  function getClipMenuItems(): MenuItem[] {
    const clipId = contextMenuTarget.value.clipId
    if (!clipId) return []

    const timelineItem = unifiedStore.getTimelineItem(clipId)
    if (!timelineItem) return []

    const menuItems: MenuItem[] = []

    // 复制片段 - 所有类型都支持
    menuItems.push({
      label: '复制片段',
      icon: MENU_ICONS.copy,
      onClick: () => duplicateClip(),
    })

    // 重新生成缩略图 - 只有视频和图片支持
    if (timelineItem.mediaType === 'video' || timelineItem.mediaType === 'image') {
      menuItems.push({
        label: '重新生成缩略图',
        icon: MENU_ICONS.refresh,
        onClick: () => regenerateThumbnail(),
      })
    }

    // 分隔符
    menuItems.push({ type: 'separator' } as MenuItem)

    // 删除片段 - 所有类型都支持
    menuItems.push({
      label: '删除片段',
      icon: MENU_ICONS.delete,
      onClick: () => removeClip(),
    })

    return menuItems
  }

  /**
   * 获取轨道菜单项
   */
  function getTrackMenuItems(): MenuItem[] {
    const trackId = contextMenuTarget.value.trackId
    if (!trackId) return []

    const track = tracks.value.find((t) => t.id === trackId)
    if (!track) return []

    const hasClips = getClipsForTrack(trackId).length > 0
    const canDelete = tracks.value.length > 1

    const menuItems: MenuItem[] = []

    // 文本轨道专用菜单项
    if (track.type === 'text') {
      menuItems.push({
        label: '添加文本',
        icon: MENU_ICONS.addText,
        onClick: () => {
          const timePosition = getTimePositionFromContextMenu(contextMenuOptions.value)
          createTextAtPosition(trackId, timePosition)
        },
      })

      if (hasClips) {
        menuItems.push({ type: 'separator' } as MenuItem)
      }
    }

    // 通用菜单项
    menuItems.push(
      {
        label: hasClips ? '自动排列片段' : '自动排列片段（无片段）',
        icon: MENU_ICONS.autoArrange,
        onClick: hasClips ? () => autoArrangeTrack(trackId) : () => {},
      },
      {
        label: '重命名轨道',
        icon: MENU_ICONS.rename,
        onClick: () => renameTrack(),
      },
    )

    // 可见性控制 - 音频轨道不显示
    if (track.type !== 'audio') {
      menuItems.push({
        label: track.isVisible ? '隐藏轨道' : '显示轨道',
        icon: getVisibilityIcon(track.isVisible),
        onClick: () => toggleVisibility(trackId),
      })
    }

    // 静音控制 - 文本轨道不显示
    if (track.type !== 'text') {
      menuItems.push({
        label: track.isMuted ? '取消静音' : '静音轨道',
        icon: getMuteIcon(track.isMuted),
        onClick: () => toggleMute(trackId),
      })
    }

    // 添加新轨道子菜单
    menuItems.push({ type: 'separator' } as MenuItem, {
      label: '添加新轨道',
      icon: MENU_ICONS.addTrack,
      children: [
        {
          label: '视频轨道',
          icon: getTrackTypeIcon('video'),
          onClick: () => addNewTrack('video', trackId),
        },
        {
          label: '音频轨道',
          icon: getTrackTypeIcon('audio'),
          onClick: () => addNewTrack('audio', trackId),
        },
        {
          label: '文本轨道',
          icon: getTrackTypeIcon('text'),
          onClick: () => addNewTrack('text', trackId),
        },
      ],
    })

    // 删除轨道选项
    if (canDelete) {
      menuItems.push({
        label: '删除轨道',
        icon: MENU_ICONS.delete,
        onClick: () => removeTrack(trackId),
      })
    }

    return menuItems
  }

  /**
   * 处理右键菜单
   * @param event 鼠标事件
   */
  function handleContextMenu(event: MouseEvent) {
    event.preventDefault()

    // 更新菜单位置
    contextMenuOptions.value.x = event.clientX
    contextMenuOptions.value.y = event.clientY

    // 判断右键点击的目标类型
    const target = event.target as HTMLElement

    // 查找最近的片段元素
    const clipElement = target.closest('[data-timeline-item-id]') as HTMLElement
    if (clipElement) {
      // 点击在片段上
      const clipId = clipElement.getAttribute('data-timeline-item-id')
      if (clipId) {
        contextMenuType.value = 'clip'
        contextMenuTarget.value = { clipId, element: clipElement }
        showContextMenu.value = true
        return
      }
    }

    // 查找最近的轨道控制元素
    const trackControlElement = target.closest('.track-controls') as HTMLElement
    if (trackControlElement) {
      // 点击在轨道控制区域
      const trackRow = trackControlElement.closest('.track-row') as HTMLElement
      if (trackRow) {
        const trackIndex = Array.from(trackRow.parentElement?.children || []).indexOf(trackRow)
        const track = tracks.value[trackIndex]
        if (track) {
          contextMenuType.value = 'track'
          contextMenuTarget.value = { trackId: track.id, element: trackControlElement }
          showContextMenu.value = true
          return
        }
      }
    }

    // 查找轨道内容区域
    const trackContentElement = target.closest('.track-content') as HTMLElement
    if (trackContentElement) {
      // 点击在轨道内容区域（空白处）
      const trackRow = trackContentElement.closest('.track-row') as HTMLElement
      if (trackRow) {
        const trackIndex = Array.from(trackRow.parentElement?.children || []).indexOf(trackRow)
        const track = tracks.value[trackIndex]
        if (track) {
          contextMenuType.value = 'track'
          contextMenuTarget.value = { trackId: track.id, element: trackContentElement }
          showContextMenu.value = true
          return
        }
      }
    }

    // 默认情况：点击在空白区域
    contextMenuType.value = 'empty'
    contextMenuTarget.value = { element: target }
    showContextMenu.value = true
  }

  /**
   * 处理时间轴项目右键菜单
   * @param event 鼠标事件
   * @param id 时间轴项目ID
   */
  function handleTimelineItemContextMenu(event: MouseEvent, id: string) {
    // 处理时间轴项目右键菜单
    event.preventDefault()
    contextMenuOptions.value.x = event.clientX
    contextMenuOptions.value.y = event.clientY
    contextMenuType.value = 'clip'
    contextMenuTarget.value = { clipId: id }
    showContextMenu.value = true
  }

  /**
   * 删除片段
   */
  async function removeClip() {
    if (contextMenuTarget.value.clipId) {
      await handleTimelineItemRemove(contextMenuTarget.value.clipId)
      showContextMenu.value = false
    }
  }

  /**
   * 复制片段
   */
  async function duplicateClip() {
    if (contextMenuTarget.value.clipId) {
      try {
        await unifiedStore.duplicateTimelineItemWithHistory(contextMenuTarget.value.clipId)
        console.log('✅ 时间轴项目复制成功')
      } catch (error) {
        console.error('❌ 复制时间轴项目时出错:', error)
      }
      showContextMenu.value = false
    }
  }

  /**
   * 重新生成缩略图
   */
  async function regenerateThumbnail() {
    if (contextMenuTarget.value.clipId) {
      try {
        const timelineItem = unifiedStore.getTimelineItem(contextMenuTarget.value.clipId)
        const mediaItem = timelineItem ? unifiedStore.getMediaItem(timelineItem.mediaItemId) : null

        // 只对本地时间轴项目进行缩略图重新生成
        if (timelineItem && mediaItem) {
          await regenerateThumbnailForUnifiedTimelineItem(timelineItem, mediaItem)
        }
      } catch (error) {
        console.error('❌ 重新生成缩略图失败:', error)
      }
      showContextMenu.value = false
    }
  }

  /**
   * 重命名轨道
   */
  function renameTrack() {
    if (contextMenuTarget.value.trackId) {
      const track = tracks.value.find((t) => t.id === contextMenuTarget.value.trackId)
      if (track) {
        startRename(track)
      }
      showContextMenu.value = false
    }
  }

  /**
   * 显示添加轨道菜单
   * @param event 鼠标事件（可选）
   */
  function showAddTrackMenu(event?: MouseEvent) {
    // 如果是点击按钮触发，获取按钮位置
    if (event) {
      const button = event.currentTarget as HTMLElement
      const rect = button.getBoundingClientRect()
      contextMenuOptions.value.x = rect.left
      contextMenuOptions.value.y = rect.bottom + 5
    } else {
      // 默认位置
      contextMenuOptions.value.x = 100
      contextMenuOptions.value.y = 100
    }

    contextMenuType.value = 'empty'
    contextMenuTarget.value = {}
    showContextMenu.value = true
  }

  return {
    // 状态
    showContextMenu,
    contextMenuType,
    contextMenuTarget,
    contextMenuOptions,
    currentMenuItems,

    // 方法
    handleContextMenu,
    handleTimelineItemContextMenu,
    removeClip,
    duplicateClip,
    regenerateThumbnail,
    renameTrack,
    showAddTrackMenu,
  }
}

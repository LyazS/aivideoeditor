<template>
  <div class="media-library">
    <div class="library-header">
      <div class="header-left">
        <!-- Tab 切换 -->
        <div class="tab-list">
          <button
            v-for="tab in tabs"
            :key="tab.type"
            class="tab-button"
            :class="{ active: activeTab === tab.type }"
            @click="setActiveTab(tab.type)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path :d="tab.icon" />
            </svg>
            <span>{{ tab.label }}</span>
            <span class="tab-count">({{ getTabCount(tab.type) }})</span>
          </button>
        </div>
      </div>
      <div class="header-buttons">
        <HoverButton @click="showImportMenu" title="导入文件">
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
            </svg>
          </template>
        </HoverButton>
      </div>
    </div>

    <!-- 拖拽区域 -->
    <div
      class="drop-zone"
      :class="{ 'drag-over': isDragOver }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @contextmenu="handleContextMenu"
    >
      <div v-if="filteredMediaItems.length === 0" class="empty-state" @contextmenu="handleEmptyAreaContextMenu">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"
          />
        </svg>
        <p v-if="videoStore.mediaItems.length === 0">拖拽文件到此处导入</p>
        <p v-else>当前分类暂无素材</p>
        <p class="hint">支持 MP4, WebM, AVI 等视频格式、JPG, PNG, GIF 等图片格式和 MP3, WAV, M4A 等音频格式</p>
      </div>

      <!-- 素材列表 -->
      <div v-else class="media-list">
        <div
          v-for="item in filteredMediaItems"
          :key="item.id"
          class="media-item"
          :class="{
            parsing: isLocalMediaItem(item) && !item.isReady,
            'async-processing': isAsyncProcessingMediaItem(item),
            [`status-${isAsyncProcessingMediaItem(item) ? item.processingStatus : (isLocalMediaItem(item) ? item.status : 'ready')}`]: true
          }"
          :data-media-item-id="item.id"
          :draggable="isLocalMediaItem(item) ? item.isReady : (isAsyncProcessingMediaItem(item) ? true : false)"
          @dragstart="isLocalMediaItem(item) ? handleItemDragStart($event, item) : (isAsyncProcessingMediaItem(item) ? handleAsyncProcessingItemDragStart($event, item) : null)"
          @dragend="handleItemDragEnd"
          @contextmenu="isLocalMediaItem(item) ? handleMediaItemContextMenu($event, item) : handleAsyncProcessingItemContextMenu($event, item)"
        >
          <div class="media-thumbnail">
            <!-- 异步处理项目：显示进度 -->
            <template v-if="isAsyncProcessingMediaItem(item)">
              <div class="async-processing-display">
                <!-- 等待状态 -->
                <div v-if="item.processingStatus === 'pending'" class="processing-status pending">
                  <div class="status-icon" title="等待中">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4Z" />
                    </svg>
                  </div>
                </div>

                <!-- 处理中状态：显示大的进度百分比 -->
                <div v-else-if="item.processingStatus === 'processing'" class="processing-status processing">
                  <div
                    class="progress-circle"
                    :style="{ '--progress': item.processingProgress }"
                    :title="`下载中 ${item.processingProgress}%`"
                  >
                    <div class="progress-text">{{ item.processingProgress }}%</div>
                  </div>
                </div>

                <!-- 错误状态 -->
                <div v-else-if="item.processingStatus === 'error' || item.processingStatus === 'unsupported'" class="processing-status error">
                  <div class="status-icon" title="下载失败">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z" />
                    </svg>
                  </div>
                </div>

                <!-- 完成状态 -->
                <div v-else-if="item.processingStatus === 'completed'" class="processing-status completed">
                  <div class="status-icon" title="下载完成">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z" />
                    </svg>
                  </div>
                </div>
              </div>
            </template>

            <!-- 本地素材：显示缩略图 -->
            <template v-else>
              <!-- 错误状态显示 -->
              <div v-if="item.status === 'error'" class="local-error-display">
                <div class="status-icon" title="转换失败">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z" />
                  </svg>
                </div>
              </div>
              <!-- 正常状态：WebAV生成的缩略图 -->
              <img
                v-else-if="item.thumbnailUrl"
                :src="item.thumbnailUrl"
                class="thumbnail-image"
                alt="缩略图"
              />
              <!-- 缩略图生成中的占位符 -->
              <div v-else class="thumbnail-placeholder">
                <div class="loading-spinner"></div>
              </div>

              <!-- 右上角时长标签（视频和音频显示） -->
              <div v-if="item.mediaType === 'video' || item.mediaType === 'audio'" class="duration-badge">
                {{ item.status === 'error' ? '转换失败' : (item.isReady ? formatDuration(item.duration) : '分析中') }}
              </div>
            </template>
          </div>

          <!-- 底部素材名称 -->
          <div class="media-name" :title="item.name">{{ item.name }}</div>

          <!-- 移除按钮 -->
          <button
            class="remove-btn"
            @click.stop="removeMediaItem(item.id)"
            @mousedown.stop
            title="移除素材"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInput"
      type="file"
      multiple
      accept="video/*,image/*,audio/*"
      style="display: none"
      @change="handleFileSelect"
    />

    <!-- 右键菜单 -->
    <ContextMenu v-model:show="showContextMenu" :options="contextMenuOptions">
      <template v-for="(item, index) in currentMenuItems" :key="index">
        <ContextMenuSeparator v-if="'type' in item && item.type === 'separator'" />
        <ContextMenuItem
          v-else-if="'label' in item && 'onClick' in item"
          :label="item.label"
          @click="item.onClick"
        >
          <template #icon>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              :fill="item.label.includes('删除') ? '#ff6b6b' : 'currentColor'"
            >
              <path :d="item.icon" />
            </svg>
          </template>
        </ContextMenuItem>
      </template>
    </ContextMenu>

    <!-- 远程下载对话框 -->
    <RemoteDownloadDialog
      v-model:show="showRemoteDownloadDialog"
      @submit="handleRemoteDownloadSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, markRaw, computed } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { useWebAVControls } from '../composables/useWebAVControls'
import { useDialogs } from '../composables/useDialogs'
import { useDragUtils } from '../composables/useDragUtils'
import { framesToTimecode, secondsToFrames } from '../stores/utils/timeUtils'
import type { LocalMediaItem, AsyncProcessingMediaItem, RemoteDownloadConfig, MediaType, MediaErrorType } from '../types'

// 临时联合类型，用于支持异步处理素材显示
type AnyMediaItem = LocalMediaItem | AsyncProcessingMediaItem

// 临时类型守卫函数
function isLocalMediaItem(item: AnyMediaItem): item is LocalMediaItem {
  return !('isAsyncProcessing' in item) || item.isAsyncProcessing === false
}

function isAsyncProcessingMediaItem(item: AnyMediaItem): item is AsyncProcessingMediaItem {
  return 'isAsyncProcessing' in item && item.isAsyncProcessing === true
}
import { generateThumbnailForMediaItem } from '../utils/thumbnailGenerator'
import { mediaManager } from '../utils/MediaManager'
import { asyncProcessingManager } from '../utils/AsyncProcessingManager'
import HoverButton from './HoverButton.vue'
import RemoteDownloadDialog from './RemoteDownloadDialog.vue'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '@imengyu/vue3-context-menu'

const videoStore = useVideoStore()
const webAVControls = useWebAVControls()
const dialogs = useDialogs()
const dragUtils = useDragUtils()
const fileInput = ref<HTMLInputElement>()
const isDragOver = ref(false)

// 远程下载对话框状态
const showRemoteDownloadDialog = ref(false)

// Tab 相关状态
type TabType = 'all' | 'video' | 'audio' | 'processing'

const activeTab = ref<TabType>('all')

// 右键菜单相关状态
const showContextMenu = ref(false)
const contextMenuType = ref<'media-item' | 'empty'>('empty')
const selectedMediaItem = ref<LocalMediaItem | null>(null)
const contextMenuOptions = ref({
  x: 0,
  y: 0,
  theme: 'mac dark',
  zIndex: 1000,
})

// Tab 配置
const tabs = [
  {
    type: 'all' as TabType,
    label: '全部',
    icon: 'M4,6H20V8H4V6M4,11H20V13H4V11M4,16H20V18H4V16Z'
  },
  {
    type: 'video' as TabType,
    label: '视频',
    icon: 'M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z'
  },
  {
    type: 'audio' as TabType,
    label: '音频',
    icon: 'M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z'
  },
  {
    type: 'processing' as TabType,
    label: '处理中',
    icon: 'M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z' // 加载图标
  }
]

// 菜单项类型定义
type MenuItem = {
  label: string
  icon: string
  onClick: () => void
}

// 动态菜单项配置
const currentMenuItems = computed((): MenuItem[] => {
  if (contextMenuType.value === 'media-item' && selectedMediaItem.value) {
    return [
      {
        label: '删除素材',
        icon: 'M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z',
        onClick: () => handleDeleteMediaItem(),
      }
    ]
  } else {
    // 空白区域菜单
    return [
      {
        label: '导入本地文件',
        icon: 'M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z',
        onClick: () => handleImportFromMenu(),
      },
      {
        label: '远程下载',
        icon: 'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,19.93C7.05,19.44 4,16.08 4,12C4,11.38 4.08,10.78 4.21,10.21L9,15V16A1,1 0 0,0 10,17H11V19.93M17.9,17.39C17.64,16.58 16.9,16 16,16H15V13A1,1 0 0,0 14,12H8V10H10A1,1 0 0,0 11,9V7H13A2,2 0 0,0 15,5V4.59C17.93,5.77 20,8.64 20,12C20,14.08 19.2,15.97 17.9,17.39Z',
        onClick: () => handleRemoteDownload(),
      }
    ]
  }
})

// 计算过滤后的素材列表
const filteredMediaItems = computed(() => {
  // 合并本地素材和异步处理素材
  const allMediaItems: AnyMediaItem[] = [
    ...videoStore.mediaItems,
    ...videoStore.asyncProcessingItems
  ]

  if (activeTab.value === 'all') {
    return allMediaItems
  }

  return allMediaItems.filter(item => {
    if (activeTab.value === 'video') {
      // 本地素材：视频和图片
      if (isLocalMediaItem(item)) {
        return item.mediaType === 'video' || item.mediaType === 'image'
      }
      // 异步处理素材：处理后可能是视频或图片的
      if (isAsyncProcessingMediaItem(item)) {
        return item.mediaType === 'video' || item.mediaType === 'image' || item.mediaType === 'unknown'
      }
      return false
    }
    if (activeTab.value === 'audio') {
      // 本地素材：音频
      if (isLocalMediaItem(item)) {
        return item.mediaType === 'audio'
      }
      // 异步处理素材：处理后可能是音频的
      if (isAsyncProcessingMediaItem(item)) {
        return item.mediaType === 'audio' || item.mediaType === 'unknown'
      }
      return false
    }
    if (activeTab.value === 'processing') {
      // 只显示异步处理素材
      return isAsyncProcessingMediaItem(item)
    }
    return true
  })
})

// 设置活动tab
const setActiveTab = (tabType: TabType) => {
  activeTab.value = tabType
}

// 获取tab对应的素材数量
const getTabCount = (tabType: TabType) => {
  // 合并本地素材和异步处理素材
  const allMediaItems: AnyMediaItem[] = [
    ...videoStore.mediaItems,
    ...videoStore.asyncProcessingItems
  ]

  if (tabType === 'all') {
    return allMediaItems.length
  }

  if (tabType === 'video') {
    return allMediaItems.filter(item => {
      // 本地素材：视频和图片
      if (isLocalMediaItem(item)) {
        return item.mediaType === 'video' || item.mediaType === 'image'
      }
      // 异步处理素材：处理后可能是视频或图片的
      if (isAsyncProcessingMediaItem(item)) {
        return item.mediaType === 'video' || item.mediaType === 'image' || item.mediaType === 'unknown'
      }
      return false
    }).length
  }

  if (tabType === 'audio') {
    return allMediaItems.filter(item => {
      // 本地素材：音频
      if (isLocalMediaItem(item)) {
        return item.mediaType === 'audio'
      }
      // 异步处理素材：处理后可能是音频的
      if (isAsyncProcessingMediaItem(item)) {
        return item.mediaType === 'audio' || item.mediaType === 'unknown'
      }
      return false
    }).length
  }

  if (tabType === 'processing') {
    // 只计算异步处理素材
    return allMediaItems.filter(item => isAsyncProcessingMediaItem(item)).length
  }

  return 0
}

// 格式化时长显示（使用时间码格式）
function formatDuration(frames: number): string {
  return framesToTimecode(frames)
}

// 触发文件选择
const triggerFileInput = () => {
  fileInput.value?.click()
}

// 显示导入菜单（左键点击导入按钮时）
const showImportMenu = (event?: MouseEvent) => {
  if (event) {
    const button = event.currentTarget as HTMLElement
    const rect = button.getBoundingClientRect()
    contextMenuOptions.value.x = rect.left
    contextMenuOptions.value.y = rect.bottom + 5
  } else {
    contextMenuOptions.value.x = 100
    contextMenuOptions.value.y = 100
  }

  contextMenuType.value = 'empty'
  selectedMediaItem.value = null
  showContextMenu.value = true
}

// 右键菜单处理方法
const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault()

  // 更新菜单位置
  contextMenuOptions.value.x = event.clientX
  contextMenuOptions.value.y = event.clientY

  // 默认显示空白区域菜单
  contextMenuType.value = 'empty'
  selectedMediaItem.value = null
  showContextMenu.value = true
}

const handleMediaItemContextMenu = (event: MouseEvent, item: LocalMediaItem) => {
  event.preventDefault()
  event.stopPropagation()

  // 更新菜单位置
  contextMenuOptions.value.x = event.clientX
  contextMenuOptions.value.y = event.clientY

  // 设置为素材项菜单
  contextMenuType.value = 'media-item'
  selectedMediaItem.value = item
  showContextMenu.value = true
}

const handleAsyncProcessingItemContextMenu = (event: MouseEvent, item: AsyncProcessingMediaItem) => {
  event.preventDefault()
  event.stopPropagation()

  // TODO: 在 Phase 3 中实现异步处理素材的右键菜单
  console.log('🔄 [MediaLibrary] 异步处理素材右键菜单:', item.name)
}

const handleEmptyAreaContextMenu = (event: MouseEvent) => {
  event.preventDefault()

  // 更新菜单位置
  contextMenuOptions.value.x = event.clientX
  contextMenuOptions.value.y = event.clientY

  // 显示空白区域菜单
  contextMenuType.value = 'empty'
  selectedMediaItem.value = null
  showContextMenu.value = true
}

// 菜单项处理方法
const handleDeleteMediaItem = () => {
  if (selectedMediaItem.value) {
    removeMediaItem(selectedMediaItem.value.id)
  }
  showContextMenu.value = false
}

const handleImportFromMenu = () => {
  triggerFileInput()
  showContextMenu.value = false
}

const handleRemoteDownload = () => {
  showRemoteDownloadDialog.value = true
  showContextMenu.value = false
}

// 将异步处理素材转换为普通素材
const convertAsyncProcessingToLocalMedia = async (asyncProcessingItem: AsyncProcessingMediaItem) => {
  if (!asyncProcessingItem.processedFile) {
    throw new Error('没有处理完成的文件')
  }

  console.log('🔄 [MediaLibrary] 开始转换异步处理素材:', asyncProcessingItem.name)

  try {
    // 先从异步处理列表中移除，避免同时显示两个项目
    videoStore.removeAsyncProcessingItem(asyncProcessingItem.id)

    // 使用现有的文件处理逻辑
    const files = [asyncProcessingItem.processedFile]
    await processFiles(files)

    console.log('✅ [MediaLibrary] 异步处理素材转换完成:', asyncProcessingItem.name)
  } catch (error) {
    console.error('❌ [MediaLibrary] 转换异步处理素材失败:', error)

    // 转换失败时不重新添加回异步处理列表，让其自然消失
    console.log(`🔴 [MediaLibrary] 异步处理素材转换失败，不再重新添加: ${asyncProcessingItem.name}`)

    throw error
  }
}

const handleRemoteDownloadSubmit = async (config: RemoteDownloadConfig, expectedDuration: number, name?: string) => {
  console.log('🌐 [MediaLibrary] 开始远程下载:', { config, expectedDuration, name })

  try {
    // 创建异步处理素材项目
    const asyncProcessingItem = asyncProcessingManager.createAsyncProcessingMediaItem(
      'remote-download',
      config,
      expectedDuration,
      name
    )

    // 添加到媒体库的异步处理列表
    videoStore.addAsyncProcessingItem(asyncProcessingItem)

    // 关闭对话框
    showRemoteDownloadDialog.value = false

    // 异步开始处理，不阻塞UI，并传入状态更新回调
    asyncProcessingManager.startProcessing(
      asyncProcessingItem,
      (updatedItem: AsyncProcessingMediaItem) => {
        // 实时同步状态到 videoStore
        videoStore.updateAsyncProcessingItem(updatedItem)
        // console.log('🔄 [MediaLibrary] 异步处理状态更新:', {
        //   id: updatedItem.id,
        //   status: updatedItem.processingStatus,
        //   progress: updatedItem.processingProgress
        // })
      }
    ).then(() => {
      // 处理完成后，检查是否成功
      const updatedItem = asyncProcessingManager.getAsyncProcessingMediaItem(asyncProcessingItem.id)
      if (updatedItem) {
        if (updatedItem.processingStatus === 'completed' && updatedItem.processedFile) {
          // 转换为普通素材
          convertAsyncProcessingToLocalMedia(updatedItem).catch(error => {
            console.error('❌ [MediaLibrary] 转换异步处理素材失败:', error)
            dialogs.showError('转换失败', error instanceof Error ? error.message : '未知错误')
          })
        } else if (updatedItem.processingStatus === 'error') {
          dialogs.showError('下载失败', updatedItem.errorMessage || '未知错误')
        }
      }
    }).catch(error => {
      console.error('❌ [MediaLibrary] 远程下载失败:', error)
      dialogs.showError('下载失败', error instanceof Error ? error.message : '未知错误')
    })

  } catch (error) {
    console.error('❌ [MediaLibrary] 远程下载失败:', error)
    dialogs.showError('下载失败', error instanceof Error ? error.message : '未知错误')
    showRemoteDownloadDialog.value = false
  }
}

// 处理文件选择
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  processFiles(files)
  // 清空input值，允许重复选择同一文件
  target.value = ''
}

// 拖拽处理
const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'copy'
  isDragOver.value = true
}

const handleDragLeave = (event: DragEvent) => {
  // 只有当离开整个拖拽区域时才取消高亮
  const currentTarget = event.currentTarget as Element
  const relatedTarget = event.relatedTarget as Node
  if (currentTarget && !currentTarget.contains(relatedTarget)) {
    isDragOver.value = false
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false

  const files = Array.from(event.dataTransfer?.files || [])
  processFiles(files)
}

// 保存错误媒体引用的辅助函数
const saveErrorMediaReference = async (
  mediaItemId: string,
  file: File,
  mediaType: MediaType,
  errorType: MediaErrorType,
  errorMessage: string
) => {
  if (!videoStore.currentProjectId) {
    console.warn('没有当前项目，跳过错误媒体引用保存')
    return
  }

  try {
    const { MediaManager } = await import('../utils/MediaManager')
    const mediaManager = MediaManager.getInstance()

    const errorReference = await mediaManager.saveErrorMediaReference(
      mediaItemId,
      file,
      videoStore.currentProjectId,
      mediaType,
      errorType,
      errorMessage
    )

    videoStore.addMediaReference(mediaItemId, errorReference)
    console.log(`💾 错误状态媒体引用已保存: ${file.name}`)
  } catch (referenceError) {
    console.warn(`保存错误状态媒体引用失败: ${file.name}`, referenceError)
    // 不阻断用户操作，只记录警告
  }
}

// 支持的音频文件类型
const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg',     // .mp3
  'audio/wav',      // .wav
  'audio/mp4',      // .m4a
  'audio/aac',      // .aac
  'audio/ogg',      // .ogg
  'audio/webm',     // .webm
]

// 处理文件 - 并行处理，限制最大并发数为5
const processFiles = async (files: File[]) => {
  const mediaFiles = files.filter(
    (file) => file.type.startsWith('video/') ||
              file.type.startsWith('image/') ||
              SUPPORTED_AUDIO_TYPES.includes(file.type),
  )

  if (mediaFiles.length === 0) {
    dialogs.showFileTypeError()
    return
  }

  console.log(`📁 开始并行处理 ${mediaFiles.length} 个文件，最大并发数: 5`)

  // 分析文件类型，确定tab跳转逻辑
  const fileTypeCounts = {
    video: 0,
    audio: 0
  }

  mediaFiles.forEach(file => {
    if (file.type.startsWith('video/') || file.type.startsWith('image/')) {
      fileTypeCounts.video++
    } else if (SUPPORTED_AUDIO_TYPES.includes(file.type)) {
      fileTypeCounts.audio++
    }
  })

  // 使用并发控制处理文件
  await processConcurrentFiles(mediaFiles, 5)

  // 根据素材类型自动跳转到对应tab
  if (fileTypeCounts.video > 0 && fileTypeCounts.audio > 0) {
    // 多种类型的素材，跳转到all tab
    setActiveTab('all')
    console.log(`📂 自动切换到全部tab (多种类型: 视频/图片: ${fileTypeCounts.video}, 音频: ${fileTypeCounts.audio})`)
  } else if (fileTypeCounts.video > 0 && fileTypeCounts.audio === 0) {
    // 只有视频/图片，跳转到视频tab
    setActiveTab('video')
    console.log(`📂 自动切换到视频tab (仅视频/图片: ${fileTypeCounts.video})`)
  } else if (fileTypeCounts.audio > 0 && fileTypeCounts.video === 0) {
    // 只有音频，跳转到音频tab
    setActiveTab('audio')
    console.log(`📂 自动切换到音频tab (仅音频: ${fileTypeCounts.audio})`)
  }

  console.log(`✅ 所有文件处理完成`)
}

// 并发控制处理文件
const processConcurrentFiles = async (files: File[], maxConcurrency: number) => {
  const results: Promise<void>[] = []
  const executing: Promise<void>[] = []

  for (const file of files) {
    const promise = addMediaItem(file).then(() => {
      // 从执行队列中移除已完成的任务
      executing.splice(executing.indexOf(promise), 1)
    })

    results.push(promise)
    executing.push(promise)

    // 如果达到最大并发数，等待其中一个完成
    if (executing.length >= maxConcurrency) {
      await Promise.race(executing)
    }
  }

  // 等待所有任务完成
  await Promise.all(results)
}

// 添加素材项
const addMediaItem = async (file: File): Promise<void> => {
  const startTime = Date.now()
  return new Promise(async (resolve) => {
    console.log(
      `📁 [并发处理] 开始处理文件: ${file.name} (大小: ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
    )

    const url = URL.createObjectURL(file)
    const mediaItemId = Date.now().toString() + Math.random().toString(36).substring(2, 11)
    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')
    const isAudio = SUPPORTED_AUDIO_TYPES.includes(file.type)

    if (isVideo) {
      await addVideoItem(file, url, mediaItemId, startTime, resolve)
    } else if (isImage) {
      await addImageItem(file, url, mediaItemId, startTime, resolve)
    } else if (isAudio) {
      await addAudioItem(file, url, mediaItemId, startTime, resolve)
    } else {
      console.error('不支持的文件类型:', file.type)
      URL.revokeObjectURL(url)
      resolve()
    }
  })
}

// 添加视频素材项
const addVideoItem = async (
  file: File,
  url: string,
  mediaItemId: string,
  startTime: number,
  resolve: () => void,
) => {
  // 创建解析中状态的LocalMediaItem（不需要video元素）
  const parsingMediaItem: LocalMediaItem = {
    id: mediaItemId,
    name: file.name,
    createdAt: new Date().toISOString(),
    file,
    url,
    duration: 0, // 初始为0，等MP4Clip解析完成后更新
    type: file.type,
    mediaType: 'video',
    mp4Clip: null, // 解析中时为null
    imgClip: null,
    audioClip: null,
    isReady: false, // 标记为未准备好
    status: 'parsing', // 解析中状态
  }

  try {

    console.log(`📋 创建解析中的MediaItem: ${parsingMediaItem.name} (ID: ${mediaItemId})`)

    // 先添加解析中状态的素材到store
    videoStore.addMediaItem(parsingMediaItem)

    // 异步创建MP4Clip
    console.log(`🎬 Creating MP4Clip for: ${file.name}`)
    const mp4Clip = await webAVControls.createMP4Clip(file)
    console.log(`✅ MP4Clip created successfully for: ${file.name}`)

    // 获取MP4Clip的元数据
    const meta = await mp4Clip.ready
    const durationFrames = secondsToFrames(meta.duration / 1_000_000) // meta.duration是微秒，转换为秒再转为帧数

    console.log(`📊 MP4Clip元数据: ${file.name}`, {
      duration: meta.duration / 1_000_000 + 's',
      durationFrames: durationFrames + '帧',
      resolution: `${meta.width}x${meta.height}`,
    })

    // 生成缩略图
    console.log(`🖼️ 生成视频缩略图: ${file.name}`)
    const thumbnailUrl = await generateThumbnailForMediaItem({
      mediaType: 'video',
      mp4Clip,
    })

    // 保存媒体文件到本地（如果有当前项目）
    let mediaReference = null
    if (videoStore.currentProjectId) {
      try {
        console.log(`💾 保存视频文件到本地: ${file.name}`)
        mediaReference = await mediaManager.importMediaFiles(file, mp4Clip, videoStore.currentProjectId, 'video')
        videoStore.addMediaReference(mediaItemId, mediaReference)
        console.log(`✅ 视频文件已保存到本地: ${mediaReference.storedPath}`)
      } catch (error) {
        console.warn(`⚠️ 保存视频文件到本地失败: ${file.name}`, error)
        // 继续处理，不阻断用户操作
      }
    }

    // 更新LocalMediaItem为完成状态
    const readyMediaItem: LocalMediaItem = {
      ...parsingMediaItem,
      duration: durationFrames, // 使用MP4Clip的准确时长
      mp4Clip: markRaw(mp4Clip), // 使用markRaw避免Vue响应式包装
      isReady: true, // 标记为准备好
      status: 'ready', // 已准备好状态
      thumbnailUrl, // 添加缩略图URL
    }

    console.log(
      `📋 更新MediaItem为完成状态: ${readyMediaItem.name} (时长: ${framesToTimecode(readyMediaItem.duration)})`,
    )
    console.log(`📐 视频原始分辨率: ${meta.width}x${meta.height}`)

    // 更新store中的MediaItem
    videoStore.updateMediaItem(readyMediaItem)

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✅ [并发处理] 视频文件处理完成: ${file.name} (耗时: ${processingTime}s)`)
    resolve()
  } catch (error) {
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.error(`❌ [并发处理] 视频文件处理失败: ${file.name} (耗时: ${processingTime}s)`, error)

    // 如果解析失败，将媒体项状态设置为错误，保留在媒体库中让用户知道
    const errorMediaItem: LocalMediaItem = {
      ...parsingMediaItem,
      isReady: false,
      status: 'error',
      mp4Clip: null,
      duration: 0,
      thumbnailUrl: undefined
    }

    console.log(`🔴 [并发处理] 视频文件转换失败，设置为错误状态: ${file.name}`)
    videoStore.updateMediaItem(errorMediaItem)

    // 新增：保存错误状态的媒体引用到项目
    await saveErrorMediaReference(mediaItemId, file, 'video', 'webav_parse_error', error.message)

    resolve()
  }
}

// 添加图片素材项
const addImageItem = async (
  file: File,
  url: string,
  mediaItemId: string,
  startTime: number,
  resolve: () => void,
) => {
  // 创建解析中状态的LocalMediaItem
  const parsingMediaItem: LocalMediaItem = {
    id: mediaItemId,
    name: file.name,
    createdAt: new Date().toISOString(),
    file,
    url,
    duration: 150, // 图片默认150帧时长（5秒@30fps）
    type: file.type,
    mediaType: 'image',
    mp4Clip: null,
    imgClip: null, // 解析中时为null
    audioClip: null,
    isReady: false, // 标记为未准备好
    status: 'parsing', // 解析中状态
  }

  console.log(`📋 创建解析中的图片MediaItem: ${parsingMediaItem.name} (ID: ${mediaItemId})`)

  // 先添加解析中状态的素材到store
  videoStore.addMediaItem(parsingMediaItem)

  const img = document.createElement('img')

  img.onload = async () => {
    try {

      // 异步创建ImgClip
      console.log(`🖼️ Creating ImgClip for: ${file.name}`)
      const imgClip = await webAVControls.createImgClip(file)
      console.log(`✅ ImgClip created successfully for: ${file.name}`)

      // 生成缩略图
      console.log(`🖼️ 生成图片缩略图: ${file.name}`)
      const thumbnailUrl = await generateThumbnailForMediaItem({
        mediaType: 'image',
        imgClip,
      })

      // 保存媒体文件到本地（如果有当前项目）
      let mediaReference = null
      if (videoStore.currentProjectId) {
        try {
          console.log(`💾 保存图片文件到本地: ${file.name}`)
          mediaReference = await mediaManager.importMediaFiles(file, imgClip, videoStore.currentProjectId, 'image')
          videoStore.addMediaReference(mediaItemId, mediaReference)
          console.log(`✅ 图片文件已保存到本地: ${mediaReference.storedPath}`)
        } catch (error) {
          console.warn(`⚠️ 保存图片文件到本地失败: ${file.name}`, error)
          // 继续处理，不阻断用户操作
        }
      }

      // 更新LocalMediaItem为完成状态
      const readyMediaItem: LocalMediaItem = {
        ...parsingMediaItem,
        imgClip: markRaw(imgClip), // 使用markRaw避免Vue响应式包装
        isReady: true, // 标记为准备好
        status: 'ready', // 已准备好状态
        thumbnailUrl, // 添加缩略图URL
      }

      console.log(
        `📋 更新图片MediaItem为完成状态: ${readyMediaItem.name} (时长: ${readyMediaItem.duration.toFixed(2)}s)`,
      )
      console.log(`📐 图片原始分辨率: ${img.naturalWidth}x${img.naturalHeight}`)

      // 更新store中的MediaItem
      videoStore.updateMediaItem(readyMediaItem)

      const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`✅ [并发处理] 图片文件处理完成: ${file.name} (耗时: ${processingTime}s)`)
      resolve()
    } catch (error) {
      const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
      console.error(
        `❌ [并发处理] 图片文件处理失败: ${file.name} (耗时: ${processingTime}s)`,
        error,
      )

      // 如果解析失败，将媒体项状态设置为错误，保留在媒体库中让用户知道
      const errorMediaItem: LocalMediaItem = {
        ...parsingMediaItem,
        isReady: false,
        status: 'error',
        imgClip: null,
        duration: 0,
        thumbnailUrl: undefined
      }

      console.log(`🔴 [并发处理] 图片文件转换失败，设置为错误状态: ${file.name}`)
      videoStore.updateMediaItem(errorMediaItem)

      // 新增：保存错误状态的媒体引用到项目
      await saveErrorMediaReference(mediaItemId, file, 'image', 'webav_parse_error', error.message)

      resolve()
    }
  }

  img.onerror = async () => {
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.error(`❌ [并发处理] 图片加载失败: ${file.name} (耗时: ${processingTime}s)`)

    // 如果图片加载失败，将媒体项状态设置为错误，保留在媒体库中让用户知道
    const errorMediaItem: LocalMediaItem = {
      ...parsingMediaItem,
      isReady: false,
      status: 'error',
      imgClip: null,
      duration: 0,
      thumbnailUrl: undefined
    }

    console.log(`🔴 [并发处理] 图片文件加载失败，设置为错误状态: ${file.name}`)
    videoStore.updateMediaItem(errorMediaItem)

    // 新增：保存错误状态的媒体引用到项目
    await saveErrorMediaReference(mediaItemId, file, 'image', 'file_load_error', '图片文件加载失败')

    resolve()
  }

  img.src = url
}

// 添加音频素材项
const addAudioItem = async (
  file: File,
  url: string,
  mediaItemId: string,
  startTime: number,
  resolve: () => void,
) => {
  // 创建解析中状态的音频素材
  const parsingMediaItem: LocalMediaItem = {
    id: mediaItemId,
    name: file.name,
    createdAt: new Date().toISOString(),
    file: file,
    url: url,
    duration: 0, // 音频时长待解析后确定
    type: file.type,
    mediaType: 'audio',
    mp4Clip: null,
    imgClip: null,
    audioClip: null, // 解析中时为null
    isReady: false,
    status: 'parsing',
  }

  try {

    console.log(`📋 创建解析中的音频MediaItem: ${parsingMediaItem.name} (ID: ${mediaItemId})`)

    // 先添加解析中状态的素材到store
    videoStore.addMediaItem(parsingMediaItem)

    // 异步创建AudioClip
    console.log(`🎵 Creating AudioClip for: ${file.name}`)
    const audioClip = await webAVControls.createAudioClip(file)
    console.log(`✅ AudioClip created successfully for: ${file.name}`)

    // 获取AudioClip的元数据
    const meta = await audioClip.ready
    const durationFrames = secondsToFrames(meta.duration / 1_000_000) // meta.duration是微秒

    console.log(`📊 AudioClip元数据: ${file.name}`, {
      duration: meta.duration / 1_000_000 + 's',
      durationFrames: durationFrames + '帧',
      // 音频特有属性可能不在meta中，暂时注释
      // channels: meta.numberOfChannels,
      // sampleRate: meta.sampleRate,
    })

    // 音频使用默认图标
    const thumbnailUrl = generateAudioDefaultIcon()

    // 保存媒体文件到本地（如果有当前项目）
    let mediaReference = null
    if (videoStore.currentProjectId) {
      try {
        console.log(`💾 保存音频文件到本地: ${file.name}`)
        mediaReference = await mediaManager.importMediaFiles(file, audioClip, videoStore.currentProjectId, 'audio')
        videoStore.addMediaReference(mediaItemId, mediaReference)
        console.log(`✅ 音频文件已保存到本地: ${mediaReference.storedPath}`)
      } catch (error) {
        console.warn(`⚠️ 保存音频文件到本地失败: ${file.name}`, error)
        // 继续处理，不阻断用户操作
      }
    }

    // 更新LocalMediaItem为就绪状态
    const readyMediaItem: LocalMediaItem = {
      ...parsingMediaItem,
      duration: durationFrames,
      audioClip: markRaw(audioClip),
      isReady: true,
      status: 'ready',
      thumbnailUrl,
    }

    console.log(
      `📋 更新音频MediaItem为完成状态: ${readyMediaItem.name} (时长: ${framesToTimecode(readyMediaItem.duration)})`,
    )

    videoStore.updateMediaItem(readyMediaItem)

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✅ [并发处理] 音频文件处理完成: ${file.name} (耗时: ${processingTime}s)`)
    resolve()
  } catch (error) {
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.error(`❌ [并发处理] 音频文件处理失败: ${file.name} (耗时: ${processingTime}s)`, error)

    // 如果解析失败，将媒体项状态设置为错误，保留在媒体库中让用户知道
    const errorMediaItem: LocalMediaItem = {
      ...parsingMediaItem,
      isReady: false,
      status: 'error',
      audioClip: null,
      duration: 0,
      thumbnailUrl: undefined
    }

    console.log(`🔴 [并发处理] 音频文件转换失败，设置为错误状态: ${file.name}`)
    videoStore.updateMediaItem(errorMediaItem)

    // 新增：保存错误状态的媒体引用到项目
    await saveErrorMediaReference(mediaItemId, file, 'audio', 'webav_parse_error', error.message)

    resolve()
  }
}

// 生成音频默认图标
function generateAudioDefaultIcon(): string {
  // 生成音频默认图标 - 使用纯SVG图形
  const svg = `<svg width="60" height="40" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="40" fill="#4CAF50" rx="4"/><g fill="white" transform="translate(30, 20)"><circle cx="-6" cy="8" r="3"/><circle cx="6" cy="6" r="3"/><rect x="-3" y="-2" width="1.5" height="10"/><rect x="9" y="-4" width="1.5" height="10"/><path d="M -1.5 -2 Q 6 -6 10.5 -4 L 10.5 -2 Q 6 -4 -1.5 0 Z"/></g></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

// 移除素材项
const removeMediaItem = async (id: string) => {
  const item = videoStore.getMediaItem(id)
  if (item) {
    // 检查是否有相关的时间轴项目
    const relatedTimelineItems = videoStore.timelineItems.filter(
      (timelineItem) => timelineItem.mediaItemId === id,
    )

    if (dialogs.confirmMediaDelete(item.name, relatedTimelineItems.length)) {
      console.log(`🗑️ 准备删除素材库项目: ${item.name} (ID: ${id})`)

      try {
        // 清理URL
        URL.revokeObjectURL(item.url)

        // 清理缩略图URL
        if (item.thumbnailUrl) {
          URL.revokeObjectURL(item.thumbnailUrl)
        }

        // 从store中移除MediaItem（会自动移除相关的TimelineItem和本地文件）
        await videoStore.removeMediaItem(id)

        console.log(`✅ 素材库项目删除完成: ${item.name}`)
        dialogs.showSuccess('删除成功', `素材 "${item.name}" 已从项目中删除`)
      } catch (error) {
        console.error(`❌ 删除素材失败: ${item.name}`, error)
        dialogs.showError('删除失败', `删除素材 "${item.name}" 时发生错误`)
      }
    }
  }
}

// 素材项拖拽开始
const handleItemDragStart = (event: DragEvent, item: LocalMediaItem) => {
  console.log('🎯 [MediaLibrary] 开始拖拽素材:', item.name, 'isReady:', item.isReady)

  // 如果素材还未解析完成，阻止拖拽
  if (!item.isReady) {
    event.preventDefault()
    console.log('❌ [MediaLibrary] 素材解析中，无法拖拽:', item.name)
    return
  }

  // 使用统一的拖拽工具设置精简的拖拽数据
  const dragData = dragUtils.setMediaItemDragData(
    event,
    item.id,
    item.name,
    item.duration,
    item.mediaType,
  )

  console.log('📦 [MediaLibrary] 使用统一格式设置拖拽数据:', dragData)
  console.log('✅ [MediaLibrary] 拖拽数据设置完成，类型:', event.dataTransfer!.types)
}

// 异步处理素材拖拽开始
const handleAsyncProcessingItemDragStart = (event: DragEvent, item: AsyncProcessingMediaItem) => {
  console.log('🎯 [MediaLibrary] 开始拖拽异步处理素材:', item.name, 'status:', item.processingStatus)

  // 只有等待中和处理中的异步处理素材可以拖拽
  if (!['pending', 'processing'].includes(item.processingStatus)) {
    event.preventDefault()
    console.log('❌ [MediaLibrary] 异步处理素材状态不允许拖拽:', item.processingStatus)
    return
  }

  // 使用统一的拖拽工具设置异步处理素材的拖拽数据
  // 对于 'unknown' 类型，使用 'video' 作为默认类型（异步处理占位符可以拖拽到任何轨道）
  const mediaType = item.mediaType === 'unknown' ? 'video' : item.mediaType as MediaType
  const dragData = dragUtils.setMediaItemDragData(
    event,
    item.id,
    item.name,
    item.expectedDuration, // 使用预计时长
    mediaType
  )

  console.log('📦 [MediaLibrary] 异步处理素材拖拽数据已设置:', dragData)
  console.log('✅ [MediaLibrary] 异步处理素材拖拽数据设置完成，类型:', event.dataTransfer!.types)
}

const handleItemDragEnd = () => {
  console.log('🏁 [MediaLibrary] 拖拽结束，清理全局状态')
  // 使用统一的拖拽工具清理状态
  dragUtils.clearDragData()
}

</script>

<style scoped>
.media-library {
  width: 100%;
  height: 100%;
  background-color: var(--color-bg-secondary);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.library-header {
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--color-bg-tertiary);
  border-bottom: 1px solid var(--color-border-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}

.library-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
  flex-shrink: 0;
}

.header-buttons {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

/* Tab 样式 */
.tab-list {
  display: flex;
  gap: var(--spacing-xs);
}

.tab-button {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--border-radius-small);
  padding: var(--spacing-xs) var(--spacing-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  transition: all var(--transition-fast);
  position: relative;
}

.tab-button:hover {
  color: var(--color-text-primary);
  background-color: var(--color-bg-hover);
  border-color: var(--color-border-secondary);
}

.tab-button.active {
  color: var(--color-accent-primary);
  background-color: var(--color-accent-primary);
  background-color: rgba(59, 130, 246, 0.1);
  border-color: var(--color-accent-primary);
}

.tab-button svg {
  flex-shrink: 0;
}

.tab-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-weight: normal;
}

.tab-button.active .tab-count {
  color: var(--color-accent-primary);
}

.import-btn {
  background: var(--color-bg-active);
  border: none;
  border-radius: var(--border-radius-medium);
  color: var(--color-text-secondary);
  padding: var(--spacing-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--transition-fast);
}

.import-btn:hover {
  background: var(--color-border-secondary);
  color: var(--color-text-primary);
}

.drop-zone {
  flex: 1;
  padding: var(--spacing-xl);
  transition: background-color var(--transition-fast);
  overflow-y: auto;
}

.drop-zone.drag-over {
  background-color: var(--color-bg-hover);
  border: 2px dashed var(--color-accent-primary);
}

/* 使用通用的 empty-state 和 hint 样式 */

.media-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
}

.media-item {
  background-color: transparent;
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-xs);
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: grab;
  transition: background-color var(--transition-fast);
  position: relative;
  min-height: 85px;
}

.media-item:hover {
  background-color: var(--color-bg-tertiary);
}

.media-item:active {
  cursor: grabbing;
}

/* 解析中状态样式 */
.media-item.parsing {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--color-bg-secondary);
}

.media-item.parsing:hover {
  background-color: var(--color-bg-secondary);
}

.media-thumbnail {
  width: 85px;
  height: 50px;
  background-color: var(--color-bg-primary);
  border-radius: var(--border-radius-small);
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  margin-bottom: var(--spacing-xs);
}

.thumbnail-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.3);
}

.loading-spinner {
  width: 12px;
  height: 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-top: 1px solid var(--color-text-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.duration-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 3px;
  z-index: 2;
  font-family: monospace;
}

/* 解析中覆盖层样式 */
.parsing-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius-medium);
}

.parsing-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-text-muted);
  border-top: 2px solid var(--color-accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 4px;
}

.parsing-text {
  color: var(--color-text-primary);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 素材名称样式 */
.media-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-primary);
  text-align: center;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
  padding: 0 2px;
  line-height: 1.1;
  max-width: 100px;
}

.remove-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  background: rgba(244, 67, 54, 0.9);
  border: none;
  border-radius: 50%;
  color: white;
  width: 18px;
  height: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  opacity: 0;
  z-index: 4;
}

.media-item:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background: rgba(211, 47, 47, 0.9);
  transform: scale(1.1);
}

/* 异步处理素材样式 */
.media-item.async-processing {
  position: relative;
}

.media-item.status-pending .media-thumbnail {
  border: 2px solid #f39c12;
}

.media-item.status-processing .media-thumbnail {
  border: 2px solid #3498db;
}

.media-item.status-error .media-thumbnail,
.media-item.status-unsupported .media-thumbnail {
  border: 2px solid #e74c3c;
}

.media-item.status-completed .media-thumbnail {
  border: 2px solid #27ae60;
}

/* 异步处理显示区域 */
.async-processing-display {
  width: 100%;
  height: 50px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-variant);
  border-radius: 8px;
}

.processing-status {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.processing-status .status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.processing-status.pending .status-icon {
  color: #f39c12;
}

.processing-status.processing .status-icon {
  color: #3498db;
}

.processing-status.error .status-icon {
  color: #e74c3c;
}

.processing-status.completed .status-icon {
  color: #27ae60;
}

.progress-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    #3498db 0deg,
    #3498db calc(var(--progress, 0) * 3.6deg),
    #2c3e50 calc(var(--progress, 0) * 3.6deg),
    #2c3e50 360deg
  );
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-circle::before {
  content: '';
  position: absolute;
  top: 4px;
  left: 4px;
  right: 4px;
  bottom: 4px;
  border-radius: 50%;
  background: var(--color-surface);
  z-index: 1;
}

.progress-text {
  position: relative;
  z-index: 2;
  font-size: 12px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}



.processing-indicator {
  position: absolute;
  top: 4px;
  left: 4px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 4px;
  padding: 2px 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 3;
}

.status-icon {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  font-weight: 500;
}

.status-icon.pending {
  color: #f39c12;
}

.status-icon.processing {
  color: #3498db;
}

.status-icon.processing svg {
  animation: spin 1s linear infinite;
}

.status-icon.error {
  color: #e74c3c;
}

/* 本地媒体项错误状态样式 */
.local-error-display {
  width: 100%;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-variant);
  border-radius: 8px;
}

.local-error-display .status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e74c3c;
}

/* 本地媒体项错误状态的边框 */
.media-item.status-error .media-thumbnail {
  border: 2px solid #e74c3c;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 自定义滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--color-bg-primary);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--color-bg-active);
  border-radius: 4px;
  border: 1px solid var(--color-bg-tertiary);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-secondary);
}

::-webkit-scrollbar-corner {
  background: var(--color-bg-primary);
}
</style>

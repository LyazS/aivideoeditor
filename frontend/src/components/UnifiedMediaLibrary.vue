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
        <HoverButton @click="debugMediaItems" title="调试：输出媒体项目状态">
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z" />
            </svg>
          </template>
        </HoverButton>
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
        <p v-if="unifiedStore.mediaModule.mediaItems.length === 0">拖拽文件到此处导入</p>
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
            parsing: ['pending', 'asyncprocessing', 'webavdecoding'].includes(item.mediaStatus),
            [getMediaStatusClass(item.mediaStatus)]: true
          }"
          :data-media-item-id="item.id"
          :draggable="item.mediaStatus === 'ready'"
          @dragstart="handleItemDragStart($event, item)"
          @dragend="handleItemDragEnd"
          @contextmenu="handleMediaItemContextMenu($event, item.id)"
        >
          <div class="media-thumbnail">
            <!-- 处理中状态：显示进度 -->
            <template v-if="['pending', 'asyncprocessing', 'webavdecoding'].includes(item.mediaStatus)">
              <div class="async-processing-display">
                <!-- 等待状态 -->
                <div v-if="item.mediaStatus === 'pending'" class="processing-status pending">
                  <div class="status-icon" title="等待中">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4Z" />
                    </svg>
                  </div>
                </div>

                <!-- 处理中状态：显示进度 -->
                <div v-else-if="['asyncprocessing', 'webavdecoding'].includes(item.mediaStatus)" class="processing-status processing">
                  <div
                    class="progress-circle"
                    :style="{ '--progress': item.getProgress() || 0 }"
                    :title="`处理中 ${Math.round(item.getProgress() || 0)}%`"
                  >
                    <div class="progress-text">{{ Math.round(item.getProgress() || 0) }}%</div>
                  </div>
                </div>
              </div>
            </template>

            <!-- 错误状态显示 -->
            <template v-else-if="['error', 'cancelled', 'missing'].includes(item.mediaStatus)">
              <div class="local-error-display">
                <div class="status-icon" title="处理失败">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z" />
                  </svg>
                </div>
              </div>
            </template>

            <!-- 正常状态：显示缩略图 -->
            <template v-else>
              <!-- WebAV生成的缩略图 -->
              <img
                v-if="getThumbnailUrl(item)"
                :src="getThumbnailUrl(item)"
                class="thumbnail-image"
                alt="缩略图"
              />
              <!-- 缩略图生成中的占位符 -->
              <div v-else class="thumbnail-placeholder">
                <div class="loading-spinner"></div>
              </div>

              <!-- 右上角时长标签（视频和音频显示） -->
              <div v-if="item.mediaType === 'video' || item.mediaType === 'audio'" class="duration-badge">
                {{ ['error', 'cancelled', 'missing'].includes(item.mediaStatus) ? '处理失败' : (item.mediaStatus === 'ready' && item.duration ? formatDuration(item.duration) : '处理中') }}
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
import { ref, computed } from 'vue'
import { useUnifiedStore } from '../Unified/stores/UnifiedStore'
import { UnifiedMediaItemFactory } from '../Unified/UnifiedMediaItemFactory'
import { useDialogs } from '../composables/useDialogs'
import { useDragUtils } from '../composables/useDragUtils'
import { framesToTimecode } from '../stores/utils/timeUtils'
import type { MediaType } from '../Unified/UnifiedMediaItem'
import type { MediaStatus } from '../Unified/contexts/MediaTransitionContext'
import HoverButton from './HoverButton.vue'
import RemoteDownloadDialog from './RemoteDownloadDialog.vue'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '@imengyu/vue3-context-menu'

// 使用统一Store
const unifiedStore = useUnifiedStore()
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
const selectedMediaItem = ref<string | null>(null)
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
    icon: 'M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z'
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
  const allItems = unifiedStore.mediaModule.mediaItems

  if (activeTab.value === 'all') {
    return allItems
  }

  return allItems.filter(item => {
    if (activeTab.value === 'video') {
      return item.mediaType === 'video' || item.mediaType === 'image' || item.mediaType === 'unknown'
    }
    if (activeTab.value === 'audio') {
      return item.mediaType === 'audio' || item.mediaType === 'unknown'
    }
    if (activeTab.value === 'processing') {
      return ['pending', 'asyncprocessing', 'webavdecoding'].includes(item.mediaStatus)
    }
    return true
  })
})

// 设置活动tab
const setActiveTab = (tabType: TabType) => {
  activeTab.value = tabType
}

// 计算各个tab的素材数量
const tabCounts = computed(() => {
  const allItems = unifiedStore.mediaModule.mediaItems

  return {
    all: allItems.length,
    video: allItems.filter(item =>
      item.mediaType === 'video' || item.mediaType === 'image' || item.mediaType === 'unknown'
    ).length,
    audio: allItems.filter(item =>
      item.mediaType === 'audio' || item.mediaType === 'unknown'
    ).length,
    processing: allItems.filter(item =>
      ['pending', 'asyncprocessing', 'webavdecoding'].includes(item.mediaStatus)
    ).length
  }
})

// 获取tab对应的素材数量
const getTabCount = (tabType: TabType) => {
  return tabCounts.value[tabType] || 0
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

const handleMediaItemContextMenu = (event: MouseEvent, itemId: string) => {
  event.preventDefault()
  event.stopPropagation()

  // 更新菜单位置
  contextMenuOptions.value.x = event.clientX
  contextMenuOptions.value.y = event.clientY

  // 设置为素材项菜单
  contextMenuType.value = 'media-item'
  selectedMediaItem.value = itemId
  showContextMenu.value = true
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
    removeMediaItem(selectedMediaItem.value)
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

// 远程下载提交处理
const handleRemoteDownloadSubmit = async (config: any, expectedDuration: number, name?: string) => {
  console.log('🌐 [UnifiedMediaLibrary] 开始远程下载:', { config, expectedDuration, name })

  try {
    // 使用UnifiedMediaItemFactory创建远程媒体项目（自动启动数据源获取）
    const mediaItem = await UnifiedMediaItemFactory.fromRemoteUrl(config.url, {
      timeout: config.timeout || 30000,
      headers: config.headers,
      retryCount: config.retryCount || 3,
      onStatusChanged: (oldStatus, newStatus, context) => {
        console.log(`🔄 [UnifiedMediaLibrary] 远程媒体状态更新: ${oldStatus} → ${newStatus}`)
        if (context?.type === 'progress_update' && context.progress !== undefined) {
          console.log(`📊 [UnifiedMediaLibrary] 下载进度: ${context.progress}%`)
        }
      }
    })

    // 如果提供了自定义名称，更新媒体项目名称
    if (name && name.trim()) {
      mediaItem.name = name.trim()
    }

    // 添加到统一媒体模块
    unifiedStore.mediaModule.addUnifiedMediaItem(mediaItem)

    // 关闭对话框
    showRemoteDownloadDialog.value = false

    console.log('✅ [UnifiedMediaLibrary] 远程媒体项目已添加:', mediaItem.name)
  } catch (error) {
    console.error('❌ [UnifiedMediaLibrary] 远程下载失败:', error)
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



// 处理文件 - 使用统一媒体项目架构
const processFiles = async (files: File[]) => {
  if (files.length === 0) {
    return
  }

  console.log(`📁 开始处理 ${files.length} 个文件`)

  // 分析文件类型，确定tab跳转逻辑
  const fileTypeCounts = {
    video: 0,
    audio: 0,
    total: 0
  }

  // 批量创建媒体项目
  const mediaItems: any[] = []

  for (const file of files) {
    try {
      // 使用UnifiedMediaItemFactory创建媒体项目（自动启动数据源获取）
      const mediaItem = await UnifiedMediaItemFactory.fromUserSelectedFile(file, {
        onStatusChanged: (oldStatus, newStatus, context) => {
          console.log(`🔄 [UnifiedMediaLibrary] 媒体状态更新: ${file.name} ${oldStatus} → ${newStatus}`)

          if (newStatus === 'ready') {
            console.log(`✅ [UnifiedMediaLibrary] 媒体项目已就绪: ${file.name}`)
          } else if (newStatus === 'error') {
            console.error(`❌ [UnifiedMediaLibrary] 媒体项目处理失败: ${file.name}`, context)
          }
        }
      })

      mediaItems.push(mediaItem)
      fileTypeCounts.total++

      // 统计文件类型（基于文件MIME类型）
      if (file.type.startsWith('video/') || file.type.startsWith('image/')) {
        fileTypeCounts.video++
      } else if (file.type.startsWith('audio/')) {
        fileTypeCounts.audio++
      }

      console.log(`📋 创建媒体项目: ${file.name} (类型: ${mediaItem.mediaType})`)
    } catch (error) {
      console.error(`❌ 创建媒体项目失败: ${file.name}`, error)
      dialogs.showError('文件处理失败', `处理文件 "${file.name}" 时发生错误: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 批量添加到统一媒体模块
  if (mediaItems.length > 0) {
    console.log(`📦 批量添加 ${mediaItems.length} 个媒体项目到统一媒体模块`)
    unifiedStore.mediaModule.addUnifiedMediaItemsBatch(mediaItems)
  }

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

  console.log(`✅ 文件处理完成，成功创建 ${mediaItems.length}/${files.length} 个媒体项目`)
}

// 移除媒体项目
const removeMediaItem = async (id: string) => {
  const item = unifiedStore.mediaModule.getUnifiedMediaItem(id)
  if (item) {
    if (dialogs.confirmMediaDelete(item.name, 0)) { // TODO: 实现时间轴项目关联检查
      console.log(`🗑️ 准备删除媒体项目: ${item.name} (ID: ${id})`)

      try {
        // 从统一媒体模块中移除
        unifiedStore.mediaModule.removeUnifiedMediaItem(id)

        console.log(`✅ 媒体项目删除完成: ${item.name}`)
        dialogs.showSuccess('删除成功', `素材 "${item.name}" 已从项目中删除`)
      } catch (error) {
        console.error(`❌ 删除媒体项目失败: ${item.name}`, error)
        dialogs.showError('删除失败', `删除素材 "${item.name}" 时发生错误`)
      }
    }
  }
}

// 媒体项目拖拽开始
const handleItemDragStart = (event: DragEvent, item: any) => {
  console.log('🎯 [UnifiedMediaLibrary] 开始拖拽媒体项目:', item.name, 'status:', item.mediaStatus)

  // 如果媒体项目还未就绪，阻止拖拽
  if (item.mediaStatus !== 'ready') {
    event.preventDefault()
    console.log('❌ [UnifiedMediaLibrary] 媒体项目未就绪，无法拖拽:', item.name)
    return
  }

  // 使用统一的拖拽工具设置拖拽数据
  const dragData = dragUtils.setMediaItemDragData(
    event,
    item.id,
    item.name,
    item.duration || 0,
    item.mediaType as MediaType,
  )

  console.log('📦 [UnifiedMediaLibrary] 使用统一格式设置拖拽数据:', dragData)
  console.log('✅ [UnifiedMediaLibrary] 拖拽数据设置完成，类型:', event.dataTransfer!.types)
}

const handleItemDragEnd = () => {
  console.log('🏁 [UnifiedMediaLibrary] 拖拽结束，清理全局状态')
  // 使用统一的拖拽工具清理状态
  dragUtils.clearDragData()
}

// 获取媒体状态对应的CSS类
const getMediaStatusClass = (status: MediaStatus) => {
  switch (status) {
    case 'pending':
      return 'status-pending'
    case 'asyncprocessing':
      return 'status-processing'
    case 'webavdecoding':
      return 'status-processing'
    case 'ready':
      return 'status-ready'
    case 'error':
      return 'status-error'
    case 'cancelled':
      return 'status-cancelled'
    case 'missing':
      return 'status-missing'
    default:
      return 'status-unknown'
  }
}

// 获取缩略图URL
const getThumbnailUrl = (item: any) => {
  // 如果有WebAV对象且有缩略图URL，返回缩略图URL
  if (item.webav?.thumbnailUrl) {
    return item.webav.thumbnailUrl
  }

  // 音频类型返回默认音频图标
  if (item.mediaType === 'audio') {
    return generateAudioDefaultIcon()
  }

  return undefined
}

// 调试：输出媒体项目状态
const debugMediaItems = () => {
  console.log('🔍 [调试] 统一媒体项目状态调试信息')
  console.log('=' .repeat(80))

  const allItems = unifiedStore.mediaModule.mediaItems
  console.log(`📊 总计媒体项目数量: ${allItems.length}`)

  if (allItems.length === 0) {
    console.log('📭 当前没有媒体项目')
    return
  }

  // 按状态分组统计
  const statusStats = allItems.reduce((stats, item) => {
    stats[item.mediaStatus] = (stats[item.mediaStatus] || 0) + 1
    return stats
  }, {} as Record<string, number>)

  console.log('📈 状态统计:')
  Object.entries(statusStats).forEach(([status, count]) => {
    console.log(`  ${status}: ${count} 个`)
  })

  console.log('\n📋 详细项目信息:')
  allItems.forEach((item, index) => {
    console.log(`\n${index + 1}. ${item.name}`)
    console.log(`   ID: ${item.id}`)
    console.log(`   状态: ${item.mediaStatus}`)
    console.log(`   类型: ${item.mediaType}`)
    console.log(`   时长: ${item.duration ? `${item.duration} 帧 (${framesToTimecode(item.duration)})` : '未知'}`)
    console.log(`   创建时间: ${item.createdAt}`)
    console.log(`   数据源类型: ${item.source?.constructor?.name || '未知'}`)
    console.log(`   进度: ${item.getProgress ? `${Math.round(item.getProgress() || 0)}%` : '不支持'}`)
    console.log(`   URL: ${item.getUrl() || '无'}`)

    // 数据源详细信息
    console.log(`   数据源详细信息:`)
    console.log(`     状态: ${item.source.getStatus()}`)
    console.log(`     进度: ${item.source.getProgress()}%`)
    console.log(`     错误: ${item.source.getError() || '无'}`)
    console.log(`     任务ID: ${item.source.getTaskId() || '无'}`)
    console.log(`     文件对象: ${item.source.getFile() ? '已获取' : '未获取'}`)
    console.log(`     URL: ${item.source.getUrl() || '无'}`)

    if (item.webav) {
      console.log(`   WebAV对象:`)
      console.log(`     缩略图: ${item.webav.thumbnailUrl ? '已生成' : '未生成'}`)
      console.log(`     原始尺寸: ${item.webav.originalWidth && item.webav.originalHeight ? `${item.webav.originalWidth}x${item.webav.originalHeight}` : '未知'}`)
      console.log(`     MP4Clip: ${item.webav.mp4Clip ? '已创建' : '未创建'}`)
      console.log(`     ImgClip: ${item.webav.imgClip ? '已创建' : '未创建'}`)
      console.log(`     AudioClip: ${item.webav.audioClip ? '已创建' : '未创建'}`)
    } else {
      console.log(`   WebAV对象: 未创建`)
    }
  })

  // 输出模块统计信息
  console.log('\n📊 模块统计信息:')
  try {
    const stats = unifiedStore.mediaModule.getMediaItemsStats()
    console.log('   总体统计:', stats)

    const typeStats = unifiedStore.mediaModule.getMediaItemsStatsByType()
    console.log('   类型统计:', typeStats)

    const sourceStats = unifiedStore.mediaModule.getMediaItemsStatsBySource()
    console.log('   数据源统计:', sourceStats)
  } catch (error) {
    console.log('   统计信息获取失败:', error)
  }

  console.log('=' .repeat(80))
  console.log('🔍 调试信息输出完成')
}

// 生成音频默认图标
function generateAudioDefaultIcon(): string {
  const svg = `<svg width="60" height="40" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="40" fill="#4CAF50" rx="4"/><g fill="white" transform="translate(30, 20)"><circle cx="-6" cy="8" r="3"/><circle cx="6" cy="6" r="3"/><rect x="-3" y="-2" width="1.5" height="10"/><rect x="9" y="-4" width="1.5" height="10"/><path d="M -1.5 -2 Q 6 -6 10.5 -4 L 10.5 -2 Q 6 -4 -1.5 0 Z"/></g></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
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

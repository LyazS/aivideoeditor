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
            <RemixIcon :name="tab.icon" size="lg" />
            <span>{{ tab.label }}</span>
            <span class="tab-count">({{ getTabCount(tab.type) }})</span>
          </button>
        </div>
      </div>
      <div class="header-center">
        <!-- 选中状态提示 -->
        <div
          v-if="unifiedStore.hasMediaSelection"
          class="selection-info"
          @mouseenter="showSelectionTooltip = true"
          @mouseleave="showSelectionTooltip = false"
        >
          <span>{{ t('media.selected') }} {{ unifiedStore.selectedMediaItemIds.size }}</span>
          <div v-if="showSelectionTooltip" class="selection-tooltip">
            <div class="tooltip-content">
              <div class="tooltip-title">{{ t('media.selectedItems') }}</div>
              <div
                v-for="id in Array.from(unifiedStore.selectedMediaItemIds)"
                :key="id"
                class="tooltip-item"
              >
                {{ getMediaItemName(id) }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="header-buttons">
        <!-- <HoverButton @click="debugMediaItems" title="调试统一媒体">
          <template #icon>
            <RemixIcon :name="MEDIA_LIBRARY_ICONS.tools" size="lg" />
          </template>
        </HoverButton> -->
        <HoverButton @click="showImportMenu" :title="t('media.importFiles')">
          <template #icon>
            <RemixIcon :name="MEDIA_LIBRARY_ICONS.import" size="lg" />
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
      @click="handleContainerClick"
    >
      <div
        v-if="filteredMediaItems.length === 0"
        class="empty-state"
        @contextmenu="handleEmptyAreaContextMenu"
      >
        <RemixIcon :name="MEDIA_LIBRARY_ICONS.file" size="xl" />
        <p v-if="unifiedStore.getAllMediaItems().length === 0">{{ t('media.dragFilesHere') }}</p>
        <p v-else>{{ t('media.noItemsInCategory') }}</p>
        <p class="hint">
          {{ t('media.supportedFormats') }}
        </p>
      </div>

      <!-- 素材列表 -->
      <div v-else class="media-list">
        <div
          v-for="item in filteredMediaItems"
          :key="item.id"
          class="media-item"
          :class="{
            parsing: item.mediaStatus === 'webavdecoding',
            'async-processing': ['pending', 'asyncprocessing', 'webavdecoding'].includes(
              item.mediaStatus,
            ),
            [`status-${item.mediaStatus}`]: true,
            selected: unifiedStore.isMediaItemSelected(item.id),
          }"
          :data-media-item-id="item.id"
          :draggable="item.mediaType !== 'unknown' && (item.duration || 0) > 0"
          @dragstart="handleItemDragStart($event, item)"
          @dragend="handleItemDragEnd"
          @contextmenu="handleMediaItemContextMenu($event, item)"
          @click="handleMediaItemClick($event, item)"
          @mousedown="handleMediaItemMouseDown($event, item)"
        >
          <!-- 复选框 -->
          <div
            v-if="unifiedStore.selectedMediaItemIds.size > 1"
            class="media-checkbox"
            :class="{ checked: unifiedStore.isMediaItemSelected(item.id) }"
            @click.stop="handleCheckboxClick($event, item)"
          >
            <RemixIcon :name="MEDIA_LIBRARY_ICONS.success" size="sm" class="check-icon" />
          </div>
          <div class="media-thumbnail">
            <!-- 异步处理项目：显示进度 -->
            <!-- 等待状态 -->
            <template v-if="item.mediaStatus === 'pending'">
              <div class="async-processing-display">
                <div class="processing-status pending">
                  <div class="status-icon" :title="t('media.waiting')">
                    <RemixIcon :name="MEDIA_LIBRARY_ICONS.pending" size="lg" spin />
                  </div>
                </div>
              </div>
              <!-- 时长标签 -->
              <div
                v-if="item.mediaType === 'video' || item.mediaType === 'audio'"
                class="duration-badge"
              >
                {{ t('media.waiting') }}
              </div>
            </template>

            <!-- 异步处理中状态 -->
            <template v-else-if="item.mediaStatus === 'asyncprocessing'">
              <div class="async-processing-display">
                <div class="processing-status processing">
                  <div
                    class="progress-circle"
                    :style="{ '--progress': item.source.progress }"
                    :title="`${t('media.processingItem')} ${item.source.progress.toFixed(2)}%`"
                  >
                    <div class="progress-text">{{ item.source.progress.toFixed(2) }}%</div>
                  </div>
                </div>
              </div>
              <!-- 时长标签 -->
              <div
                v-if="item.mediaType === 'video' || item.mediaType === 'audio'"
                class="duration-badge"
              >
                {{ t('media.processingItem') }}
              </div>
            </template>

            <!-- WebAV解析中状态 -->
            <template v-else-if="item.mediaStatus === 'webavdecoding'">
              <div class="thumbnail-placeholder">
                <div class="loading-spinner"></div>
              </div>
              <!-- 时长标签 -->
              <div
                v-if="item.mediaType === 'video' || item.mediaType === 'audio'"
                class="duration-badge"
              >
                {{ t('media.processingItem') }}
              </div>
            </template>

            <!-- 错误状态 -->
            <template v-else-if="item.mediaStatus === 'error'">
              <div class="local-error-display">
                <div class="status-icon" :title="item.source.errorMessage || t('media.conversionFailed')">
                  <RemixIcon :name="MEDIA_LIBRARY_ICONS.error" size="lg" />
                </div>
              </div>
              <!-- 时长标签 -->
              <div
                v-if="item.mediaType === 'video' || item.mediaType === 'audio'"
                class="duration-badge"
              >
                {{ t('media.conversionFailed') }}
              </div>
            </template>

            <!-- 就绪状态：显示缩略图 -->
            <template v-else>
              <!-- WebAV生成的缩略图 -->
              <img
                v-if="item.webav?.thumbnailUrl"
                :src="item.webav.thumbnailUrl"
                class="thumbnail-image"
                alt="缩略图"
              />
              <!-- 缩略图生成中的占位符 -->
              <div v-else class="thumbnail-placeholder">
                <RemixIcon :name="MEDIA_LIBRARY_ICONS.pending" size="lg" spin />
              </div>

              <!-- 右上角时长标签（视频和音频显示） -->
              <div
                v-if="item.mediaType === 'video' || item.mediaType === 'audio'"
                class="duration-badge"
              >
                {{
                  item.mediaStatus === 'ready' && item.duration
                    ? formatDuration(item.duration)
                    : t('media.processingItem')
                }}
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
            :title="t('media.removeMedia')"
          >
            <RemixIcon :name="MEDIA_LIBRARY_ICONS.close" size="sm" />
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
            <RemixIcon
              :name="item.icon"
              size="sm"
              :color="item.label.includes('删除') ? '#ff6b6b' : undefined"
            />
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { generateUUID4 } from '@/unified/utils/idGenerator'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { useDialogs, useDragUtils } from '@/unified/composables'
import { framesToTimecode } from '@/unified/utils/timeUtils'
import { useAppI18n } from '@/unified/composables/useI18n'
import type { UnifiedMediaItemData, MediaType } from '@/unified'
import { DataSourceFactory } from '@/unified'
import { DEFAULT_REMOTE_CONFIG } from '@/unified/sources/RemoteFileSource'
import { UnifiedMediaItemQueries } from '@/unified/mediaitem/actions'

import HoverButton from '@/components/HoverButton.vue'
import RemoteDownloadDialog from '@/components/RemoteDownloadDialog.vue'
import RemixIcon from '@/components/icons/RemixIcon.vue'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '@imengyu/vue3-context-menu'
import { MEDIA_LIBRARY_ICONS } from '@/constants/remixIcons'

const unifiedStore = useUnifiedStore()
const dialogs = useDialogs()
const dragUtils = useDragUtils()
const { t } = useAppI18n()
const fileInput = ref<HTMLInputElement>()
const isDragOver = ref(false)
const showCheckbox = ref(false)
const showSelectionTooltip = ref(false)
const lastSelectedItem = ref<UnifiedMediaItemData | null>(null)

// 远程下载对话框状态
const showRemoteDownloadDialog = ref(false)

// Tab 相关状态
type TabType = 'all' | 'video' | 'audio' | 'processing'

const activeTab = ref<TabType>('all')

// 右键菜单相关状态
const showContextMenu = ref(false)
const contextMenuType = ref<'media-item' | 'empty'>('empty')
const selectedMediaItem = ref<UnifiedMediaItemData | null>(null)
const contextMenuOptions = ref({
  x: 0,
  y: 0,
  theme: 'mac dark',
  zIndex: 1000,
})

// Tab 配置
const tabs = computed(() => {
  const allTabs = [
    {
      type: 'all' as TabType,
      label: t('media.all'),
      icon: MEDIA_LIBRARY_ICONS.all as string,
    },
    {
      type: 'video' as TabType,
      label: t('media.video'),
      icon: MEDIA_LIBRARY_ICONS.video as string,
    },
    {
      type: 'audio' as TabType,
      label: t('media.audio'),
      icon: MEDIA_LIBRARY_ICONS.audio as string,
    },
  ]
  
  // 如果有处理中的项目，添加processing标签
  if (getTabCount('processing') > 0) {
    allTabs.push({
      type: 'processing' as TabType,
      label: t('media.processing'),
      icon: MEDIA_LIBRARY_ICONS.processing as string,
    })
  }
  
  return allTabs
})

// 菜单项类型定义
type MenuItem = {
  label: string
  icon: string
  onClick: () => void
}

// 动态菜单项配置
const currentMenuItems = computed((): MenuItem[] => {
  if (contextMenuType.value === 'media-item' && selectedMediaItem.value) {
    const menuItems: MenuItem[] = []

    // 如果有多个媒体项目被选中，显示批量删除选项
    if (unifiedStore.hasMediaSelection && unifiedStore.selectedMediaItemIds.size > 1) {
      menuItems.push({
        label: t('media.deleteSelectedItems', { count: unifiedStore.selectedMediaItemIds.size }),
        icon: MEDIA_LIBRARY_ICONS.delete,
        onClick: () => handleBatchDeleteMediaItems(),
      })
    } else {
      // 单个素材删除
      menuItems.push({
        label: t('media.deleteMedia'),
        icon: MEDIA_LIBRARY_ICONS.delete,
        onClick: () => handleDeleteMediaItem(),
      })
    }

    return menuItems
  } else {
    // 空白区域菜单
    return [
      {
        label: t('media.importLocalFiles'),
        icon: MEDIA_LIBRARY_ICONS.importLocal,
        onClick: () => handleImportFromMenu(),
      },
      {
        label: t('media.remoteDownload'),
        icon: MEDIA_LIBRARY_ICONS.remoteDownload,
        onClick: () => handleRemoteDownload(),
      },
    ]
  }
})

// 计算过滤后的素材列表
const filteredMediaItems = computed(() => {
  const allMediaItems = unifiedStore.getAllMediaItems()

  if (activeTab.value === 'all') {
    return allMediaItems
  }

  return allMediaItems.filter((item) => {
    if (activeTab.value === 'video') {
      return (
        UnifiedMediaItemQueries.isVideo(item) ||
        UnifiedMediaItemQueries.isImage(item) ||
        UnifiedMediaItemQueries.isUnknownType(item)
      )
    }
    if (activeTab.value === 'audio') {
      return UnifiedMediaItemQueries.isAudio(item) || UnifiedMediaItemQueries.isUnknownType(item)
    }
    if (activeTab.value === 'processing') {
      // 显示正在处理的项目
      return (
        item.mediaStatus === 'asyncprocessing' ||
        item.mediaStatus === 'webavdecoding' ||
        item.mediaStatus === 'pending'
      )
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
  const allMediaItems = unifiedStore.getAllMediaItems()

  if (tabType === 'all') {
    return allMediaItems.length
  }

  if (tabType === 'video') {
    return allMediaItems.filter(
      (item) =>
        item.mediaType === 'video' || item.mediaType === 'image' || item.mediaType === 'unknown',
    ).length
  }

  if (tabType === 'audio') {
    return allMediaItems.filter(
      (item) => item.mediaType === 'audio' || item.mediaType === 'unknown',
    ).length
  }

  if (tabType === 'processing') {
    return allMediaItems.filter(
      (item) =>
        item.mediaStatus === 'asyncprocessing' ||
        item.mediaStatus === 'webavdecoding' ||
        item.mediaStatus === 'pending',
    ).length
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

const handleMediaItemContextMenu = (event: MouseEvent, item: UnifiedMediaItemData) => {
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

const handleBatchDeleteMediaItems = () => {
  const selectedCount = unifiedStore.selectedMediaItemIds.size
  if (selectedCount === 0) return

  if (dialogs.confirm(t('media.batchDeleteConfirmation', { count: selectedCount }), t('media.batchDelete'))) {
    const selectedIds = Array.from(unifiedStore.selectedMediaItemIds)
    const deletedNames: string[] = []
    const failedNames: string[] = []

    selectedIds.forEach((id) => {
      const item = unifiedStore.getMediaItem(id)
      if (item) {
        try {
          unifiedStore.removeMediaItem(id)
          deletedNames.push(item.name)
        } catch (error) {
          failedNames.push(item.name)
          console.error(`❌ 删除素材失败: ${item.name}`, error)
        }
      }
    })

    // 清除选择状态
    unifiedStore.clearMediaSelection()

    if (failedNames.length === 0) {
      dialogs.showSuccess(t('media.deleteComplete', { success: deletedNames.length, failed: failedNames.length }))
    } else {
      dialogs.showError(t('media.deleteComplete', { success: deletedNames.length, failed: failedNames.length }))
    }
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
    // 创建远程数据源
    const remoteSource = DataSourceFactory.createRemoteSource({
      id: generateUUID4(),
      type: 'remote' as const, // 明确指定类型为 'remote'
      remoteUrl: config.url,
      headers: config.headers || DEFAULT_REMOTE_CONFIG.headers,
      timeout: config.timeout || DEFAULT_REMOTE_CONFIG.timeout,
      retryCount: config.retryCount || DEFAULT_REMOTE_CONFIG.retryCount,
      retryDelay: config.retryDelay || DEFAULT_REMOTE_CONFIG.retryDelay,
    })

    // 如果用户没有提供名称，从URL中提取文件名
    let mediaItemName = name
    if (!mediaItemName) {
      const { RemoteFileManager } = await import('@/unified/managers/RemoteFileManager')
      mediaItemName = RemoteFileManager.extractFileNameFromUrl(config.url)
    }

    // 创建统一媒体项目
    const mediaItem = unifiedStore.createUnifiedMediaItemData(
      generateUUID4(),
      mediaItemName,
      remoteSource,
      {
        duration: expectedDuration,
        mediaType: 'unknown',
      },
    )

    // 添加到媒体库
    unifiedStore.addMediaItem(mediaItem)

    // 关闭对话框
    showRemoteDownloadDialog.value = false

    // 启动媒体处理流程（包含数据源获取和WebAV处理）
    unifiedStore.startMediaProcessing(mediaItem)

    console.log('✅ [UnifiedMediaLibrary] 远程下载任务已启动')
  } catch (error) {
    console.error('❌ [UnifiedMediaLibrary] 远程下载失败:', error)
    dialogs.showError(`下载失败：${error instanceof Error ? error.message : '未知错误'}`)
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

  // 使用统一的拖拽工具检查拖拽数据类型
  const dragType = dragUtils.getDragDataType(event)

  // 只对外部文件拖拽显示拖拽效果和高亮
  if (dragType === 'files') {
    event.dataTransfer!.dropEffect = 'copy'
    isDragOver.value = true
  } else {
    // 内部素材拖拽或其他类型，不显示拖拽效果
    event.dataTransfer!.dropEffect = 'none'
    isDragOver.value = false
  }
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

  // 使用统一的拖拽工具检查拖拽数据类型
  const dragType = dragUtils.getDragDataType(event)

  console.log('🎯 [UnifiedMediaLibrary] 检测到拖拽类型:', dragType)

  // 只处理外部文件拖拽，忽略内部素材拖拽
  if (dragType === 'files') {
    const files = Array.from(event.dataTransfer?.files || [])
    if (files.length > 0) {
      console.log(
        '📁 [UnifiedMediaLibrary] 处理外部文件拖拽:',
        files.map((f) => f.name),
      )
      processFiles(files)
    }
  } else if (dragType === 'media-item') {
    console.log('🚫 [UnifiedMediaLibrary] 忽略内部素材拖拽，不进行文件导入')
    // 内部素材拖拽不应该触发文件导入，直接忽略
  } else {
    console.log('❓ [UnifiedMediaLibrary] 未知拖拽类型，忽略')
  }
}

// 处理文件 - 统一使用 UserSelectedFileSource 的详细验证
const processFiles = async (files: File[]) => {
  console.log(`📁 开始处理 ${files.length} 个文件`)

  // 直接处理所有文件，让 UserSelectedFileSource 进行详细验证
  // 管理器内部会处理并发控制和错误处理
  const results = await Promise.allSettled(files.map((file) => addMediaItem(file)))

  // 统计处理结果
  const successful = results.filter((result) => result.status === 'fulfilled').length
  const failed = results.filter((result) => result.status === 'rejected').length

  if (successful === 0 && failed > 0) {
    // 所有文件都处理失败，显示提示
    dialogs.showError(t('media.allFilesFailed'))
    return
  }

  // 分析成功处理的文件类型，确定tab跳转逻辑
  const allMediaItems = unifiedStore.getAllMediaItems()
  const recentItems = allMediaItems.slice(-successful) // 获取最近添加的项目

  const fileTypeCounts = {
    video: 0,
    audio: 0,
  }

  recentItems.forEach((item) => {
    if (item.mediaType === 'video' || item.mediaType === 'image') {
      fileTypeCounts.video++
    } else if (item.mediaType === 'audio') {
      fileTypeCounts.audio++
    }
  })

  // 根据素材类型自动跳转到对应tab
  if (fileTypeCounts.video > 0 && fileTypeCounts.audio > 0) {
    // 多种类型的素材，跳转到all tab
    setActiveTab('all')
    console.log(
      `📂 自动切换到全部tab (多种类型: 视频/图片: ${fileTypeCounts.video}, 音频: ${fileTypeCounts.audio})`,
    )
  } else if (fileTypeCounts.video > 0 && fileTypeCounts.audio === 0) {
    // 只有视频/图片，跳转到视频tab
    setActiveTab('video')
    console.log(`📂 自动切换到视频tab (仅视频/图片: ${fileTypeCounts.video})`)
  } else if (fileTypeCounts.audio > 0 && fileTypeCounts.video === 0) {
    // 只有音频，跳转到音频tab
    setActiveTab('audio')
    console.log(`📂 自动切换到音频tab (仅音频: ${fileTypeCounts.audio})`)
  }

  console.log(`✅ 文件处理完成 - 成功: ${successful}, 失败: ${failed}`)
}

// 添加素材项
const addMediaItem = async (file: File): Promise<void> => {
  console.log(`📁 开始处理文件: ${file.name} (大小: ${(file.size / 1024 / 1024).toFixed(2)}MB)`)

  try {
    // 创建用户选择文件数据源
    const userSelectedSource = DataSourceFactory.createUserSelectedSource(file)

    // 创建统一媒体项目
    const mediaItem = unifiedStore.createUnifiedMediaItemData(
      generateUUID4(),
      file.name,
      userSelectedSource,
      {
        mediaType: getMediaTypeFromFile(file),
      },
    )

    // 添加到媒体库
    unifiedStore.addMediaItem(mediaItem)

    // 启动媒体处理流程（包含数据源获取和WebAV处理）
    unifiedStore.startMediaProcessing(mediaItem)

    console.log(`✅ 文件处理任务已启动: ${file.name}`)
  } catch (error) {
    console.error(`❌ 文件处理失败: ${file.name}`, error)
    // 不抛出错误，让其他文件继续处理
  }
}

// 根据文件类型获取媒体类型
const getMediaTypeFromFile = (file: File): MediaType | 'unknown' => {
  if (file.type.startsWith('video/')) {
    return 'video'
  } else if (file.type.startsWith('image/')) {
    return 'image'
  } else if (file.type.startsWith('audio/')) {
    return 'audio'
  }
  return 'unknown'
}

// 移除素材项
const removeMediaItem = async (id: string) => {
  const item = unifiedStore.getMediaItem(id)
  if (item) {
    if (dialogs.confirmMediaDelete(item.name, 0)) {
      console.log(`🗑️ 准备删除素材库项目: ${item.name} (ID: ${id})`)

      try {
        // 从store中移除MediaItem
        unifiedStore.removeMediaItem(id)

        console.log(`✅ 素材库项目删除完成: ${item.name}`)
        dialogs.showSuccess(t('media.mediaRemoved', { name: item.name }))
      } catch (error) {
        console.error(`❌ 删除素材失败: ${item.name}`, error)
        dialogs.showError(t('media.mediaRemoveError', { name: item.name }))
      }
    }
  }
}

// 处理媒体项目点击事件
function handleMediaItemClick(event: MouseEvent, item: UnifiedMediaItemData) {
  if (event.ctrlKey || event.metaKey) {
    // Ctrl+点击：切换选择状态（进入多选模式）
    unifiedStore.selectMediaItems([item.id], 'toggle')
    lastSelectedItem.value = item
  } else if (event.shiftKey && lastSelectedItem.value) {
    // Shift+点击：顺序多选
    handleRangeSelection(lastSelectedItem.value, item)
  } else {
    // 普通点击：单选模式，清除其他选择且不显示复选框
    unifiedStore.selectMediaItems([item.id], 'replace')
    lastSelectedItem.value = item
  }
}

// 处理媒体项目鼠标按下事件（用于显示复选框）
function handleMediaItemMouseDown(event: MouseEvent, item: UnifiedMediaItemData) {
  showCheckbox.value = true
}

// 处理复选框点击事件
function handleCheckboxClick(event: MouseEvent, item: UnifiedMediaItemData) {
  event.stopPropagation()
  unifiedStore.selectMediaItems([item.id], 'toggle')
  lastSelectedItem.value = item
}

// 顺序多选处理
function handleRangeSelection(startItem: UnifiedMediaItemData, endItem: UnifiedMediaItemData) {
  const allItems = filteredMediaItems.value
  const startIndex = allItems.findIndex((item) => item.id === startItem.id)
  const endIndex = allItems.findIndex((item) => item.id === endItem.id)

  if (startIndex !== -1 && endIndex !== -1) {
    const [minIndex, maxIndex] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)]
    const rangeItems = allItems.slice(minIndex, maxIndex + 1)
    unifiedStore.selectMediaItems(
      rangeItems.map((item) => item.id),
      'replace',
    )
  }
}

// 点击空白区域取消选择
function handleContainerClick(event: MouseEvent) {
  if (!event.target || !(event.target as Element).closest('.media-item')) {
    unifiedStore.clearMediaSelection()
    showCheckbox.value = false
  }
}

// 素材项拖拽开始
const handleItemDragStart = (event: DragEvent, item: UnifiedMediaItemData) => {
  console.log('🎯 [UnifiedMediaLibrary] 开始拖拽素材:', item.name, 'status:', item.mediaStatus)

  // 如果媒体类型未知或时长为0，阻止拖拽
  if (item.mediaType === 'unknown' || (item.duration || 0) <= 0) {
    event.preventDefault()
    console.log('❌ [UnifiedMediaLibrary] 媒体类型未知或时长为0，无法拖拽:', item.name)
    return
  }

  // 使用统一的拖拽工具设置精简的拖拽数据
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

// 调试统一媒体项目
const debugMediaItems = () => {
  const allItems = unifiedStore.getAllMediaItems()
  const stats = unifiedStore.getMediaItemsStats()

  console.group('🔍 [调试] 统一媒体库状态')

  // 基本统计信息
  console.log('📊 统计信息:', {
    总数: stats.total,
    就绪: stats.ready,
    处理中: stats.processing,
    错误: stats.error,
    等待中: stats.pending,
    就绪率: stats.readyPercentage + '%',
  })

  // 按类型分组
  const byType = allItems.reduce(
    (acc, item) => {
      const type = item.mediaType
      if (!acc[type]) acc[type] = []
      acc[type].push(item)
      return acc
    },
    {} as Record<string, UnifiedMediaItemData[]>,
  )

  console.log(
    '📂 按类型分组:',
    Object.keys(byType).map((type) => ({
      类型: type,
      数量: byType[type].length,
      项目: byType[type].map((item) => ({ 名称: item.name, 状态: item.mediaStatus })),
    })),
  )

  // 按状态分组
  const byStatus = allItems.reduce(
    (acc, item) => {
      const status = item.mediaStatus
      if (!acc[status]) acc[status] = []
      acc[status].push(item)
      return acc
    },
    {} as Record<string, UnifiedMediaItemData[]>,
  )

  console.log(
    '🔄 按状态分组:',
    Object.keys(byStatus).map((status) => ({
      状态: status,
      数量: byStatus[status].length,
      项目: byStatus[status].map((item) => ({ 名称: item.name, 类型: item.mediaType })),
    })),
  )

  // 数据源信息
  console.log(
    '💾 数据源信息:',
    allItems.map((item) => ({
      名称: item.name,
      数据源类型: item.source.type,
      媒体状态: item.mediaStatus,
      进度: item.source.progress.toFixed(2) + '%',
      错误信息: item.source.errorMessage || '无',
      任务ID: item.source.taskId || '无',
    })),
  )

  // WebAV对象信息
  const webavInfo = allItems
    .filter((item) => item.webav)
    .map((item) => ({
      名称: item.name,
      有缩略图: !!item.webav?.thumbnailUrl,
      有MP4Clip: !!item.webav?.mp4Clip,
      有ImgClip: !!item.webav?.imgClip,
      有AudioClip: !!item.webav?.audioClip,
      原始尺寸:
        item.webav?.originalWidth && item.webav?.originalHeight
          ? `${item.webav.originalWidth}x${item.webav.originalHeight}`
          : '未知',
    }))

  if (webavInfo.length > 0) {
    console.log('🎬 WebAV对象信息:', webavInfo)
  }

  // 详细项目信息
  console.log(
    '📋 详细项目列表:',
    allItems.map((item) => ({
      ID: item.id,
      名称: item.name,
      创建时间: new Date(item.createdAt).toLocaleString(),
      媒体状态: item.mediaStatus,
      媒体类型: item.mediaType,
      时长: item.duration ? `${item.duration}帧 (${framesToTimecode(item.duration)})` : '未知',
      数据源: {
        类型: item.source.type,
        进度: item.source.progress.toFixed(2) + '%',
        文件: item.source.file?.name || '无',
        URL: item.source.url || '无',
      },
    })),
  )

  console.groupEnd()

  // 在控制台显示提示
  console.log('💡 提示: 可以通过 window.unifiedStore 访问统一存储对象')

  // 将unifiedStore暴露到全局，方便调试
  ;(window as any).unifiedStore = unifiedStore
}

// 获取媒体项目名称
const getMediaItemName = (id: string): string => {
  const item = unifiedStore.getMediaItem(id)
  return item ? item.name : t('media.unknownMedia')
}

// 键盘事件处理
const handleKeyDown = (event: KeyboardEvent) => {
  // Delete键删除选中的媒体项目
  if ((event.key === 'Delete' || event.key === 'Backspace') && unifiedStore.hasMediaSelection) {
    event.preventDefault()
    handleBatchDeleteMediaItems()
  }
}

// 组件生命周期
onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.media-library {
  width: 100%;
  height: 100%;
  background-color: var(--color-bg-secondary);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
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

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
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

/* 选中状态提示样式 */
.selection-info {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-small);
  cursor: pointer;
  position: relative;
  transition: all var(--transition-fast);
}

.selection-info:hover {
  color: var(--color-text-primary);
  background-color: var(--color-bg-hover);
}

.selection-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: var(--spacing-xs);
  background-color: var(--color-bg-primary);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 100;
  min-width: 200px;
  max-width: 300px;
}

.tooltip-content {
  white-space: normal;
}

.tooltip-title {
  color: var(--color-text-primary);
  font-weight: 500;
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-sm);
}

.tooltip-item {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  padding: 2px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tooltip-item:not(:last-child) {
  border-bottom: 1px solid var(--color-border-primary);
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

/* 选中状态 */
.media-item.selected {
  background-color: rgba(59, 130, 246, 0.1);
  border: 2px solid var(--color-accent-primary);
}

/* 复选框样式 */
.media-checkbox {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border-primary);
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.media-checkbox.checked {
  background: var(--color-accent-primary);
  border-color: var(--color-accent-primary);
}

.media-checkbox:hover {
  border-color: var(--color-accent-secondary);
}

.check-icon {
  width: 12px;
  height: 12px;
  color: white;
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
  border: 2px solid var(--color-status-pending);
}

.media-item.status-processing .media-thumbnail {
  border: 2px solid var(--color-status-processing);
}

.media-item.status-error .media-thumbnail,
.media-item.status-unsupported .media-thumbnail {
  border: 2px solid var(--color-status-error);
}

.media-item.status-completed .media-thumbnail {
  border: 2px solid var(--color-status-completed);
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
  color: var(--color-status-pending);
}

.processing-status.processing .status-icon {
  color: var(--color-status-processing);
}

.processing-status.error .status-icon {
  color: var(--color-status-error);
}

.processing-status.completed .status-icon {
  color: var(--color-status-completed);
}

.progress-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    var(--color-status-processing) 0deg,
    var(--color-status-processing) calc(var(--progress, 0) * 3.6deg),
    var(--color-progress-background) calc(var(--progress, 0) * 3.6deg),
    var(--color-progress-background) 360deg
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
  color: var(--color-status-pending);
}

.status-icon.processing {
  color: var(--color-status-processing);
}

.status-icon.processing svg {
  animation: spin 1s linear infinite;
}

.status-icon.error {
  color: var(--color-status-error);
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
  color: var(--color-status-error);
}

/* 本地媒体项错误状态的边框 */
.media-item.status-error .media-thumbnail {
  border: 2px solid var(--color-status-error);
}

/* 从旧组件复制的样式 */
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

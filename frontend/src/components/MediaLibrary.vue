<template>
  <div class="media-library">
    <div class="library-header">
      <h3>素材库</h3>
      <button class="import-btn" @click="triggerFileInput" title="导入文件">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
        </svg>
      </button>
    </div>

    <!-- 拖拽区域 -->
    <div
      class="drop-zone"
      :class="{ 'drag-over': isDragOver }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <div v-if="videoStore.mediaItems.length === 0" class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"
          />
        </svg>
        <p>拖拽文件到此处导入</p>
        <p class="hint">支持 MP4, WebM, AVI 等视频格式和 JPG, PNG, GIF 等图片格式</p>
      </div>

      <!-- 素材列表 -->
      <div v-else class="media-list">
        <div
          v-for="item in videoStore.mediaItems"
          :key="item.id"
          class="media-item"
          :class="{ 'parsing': !item.isReady }"
          :data-media-item-id="item.id"
          :draggable="item.isReady"
          @dragstart="handleItemDragStart($event, item)"
          @dragend="handleItemDragEnd"
        >
          <div class="media-thumbnail">
            <!-- WebAV生成的缩略图 -->
            <img
              v-if="item.thumbnailUrl"
              :src="item.thumbnailUrl"
              class="thumbnail-image"
              alt="缩略图"
            />
            <!-- 缩略图生成中的占位符 -->
            <div v-else class="thumbnail-placeholder">
              <div class="loading-spinner"></div>
            </div>

            <!-- 左上角状态标签 -->
            <div class="status-badge" :class="`status-${item.status || (item.isReady ? 'ready' : 'parsing')}`">
              {{ getStatusText(item.status || (item.isReady ? 'ready' : 'parsing')) }}
            </div>

            <!-- 右上角时长标签（只有视频才显示） -->
            <div v-if="item.mediaType === 'video'" class="duration-badge">
              {{ formatTime(item.duration, 'timecode') }}
            </div>
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
      accept="video/*,image/*"
      style="display: none"
      @change="handleFileSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, markRaw } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { useWebAVControls } from '../composables/useWebAVControls'
import { useDialogs } from '../composables/useDialogs'
import { useDragUtils } from '../composables/useDragUtils'
import { formatTime, formatFileSize } from '../stores/utils/timeUtils'
import type { MediaItem } from '../types/videoTypes'
import { generateThumbnailForMediaItem } from '../utils/thumbnailGenerator'

const videoStore = useVideoStore()
const webAVControls = useWebAVControls()
const dialogs = useDialogs()
const dragUtils = useDragUtils()
const fileInput = ref<HTMLInputElement>()
const isDragOver = ref(false)

// 触发文件选择
const triggerFileInput = () => {
  fileInput.value?.click()
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

// 处理文件 - 并行处理，限制最大并发数为5
const processFiles = async (files: File[]) => {
  const mediaFiles = files.filter((file) =>
    file.type.startsWith('video/') || file.type.startsWith('image/')
  )

  if (mediaFiles.length === 0) {
    dialogs.showFileTypeError()
    return
  }

  console.log(`📁 开始并行处理 ${mediaFiles.length} 个文件，最大并发数: 5`)

  // 使用并发控制处理文件
  await processConcurrentFiles(mediaFiles, 5)

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

    if (isVideo) {
      await addVideoItem(file, url, mediaItemId, startTime, resolve)
    } else if (isImage) {
      await addImageItem(file, url, mediaItemId, startTime, resolve)
    } else {
      console.error('不支持的文件类型:', file.type)
      URL.revokeObjectURL(url)
      resolve()
    }
  })
}

// 添加视频素材项
const addVideoItem = async (file: File, url: string, mediaItemId: string, startTime: number, resolve: () => void) => {
  const video = document.createElement('video')

  video.onloadedmetadata = async () => {
    try {
      const parsingMediaItem: MediaItem = {
        id: mediaItemId,
        file,
        url,
        name: file.name,
        duration: video.duration,
        type: file.type,
        mediaType: 'video',
        mp4Clip: null, // 解析中时为null
        imgClip: null,
        isReady: false, // 标记为未准备好
        status: 'parsing', // 解析中状态
      }

      console.log(`📋 创建解析中的MediaItem: ${parsingMediaItem.name} (ID: ${mediaItemId})`)

      // 先添加解析中状态的素材到store
      videoStore.addMediaItem(parsingMediaItem)

      // 异步创建MP4Clip
      console.log(`🎬 Creating MP4Clip for: ${file.name}`)
      const mp4Clip = await webAVControls.createMP4Clip(file)
      console.log(`✅ MP4Clip created successfully for: ${file.name}`)

      // 生成缩略图
      console.log(`🖼️ 生成视频缩略图: ${file.name}`)
      const thumbnailUrl = await generateThumbnailForMediaItem({
        mediaType: 'video',
        mp4Clip
      })

      // 更新MediaItem为完成状态
      const readyMediaItem: MediaItem = {
        ...parsingMediaItem,
        mp4Clip: markRaw(mp4Clip), // 使用markRaw避免Vue响应式包装
        isReady: true, // 标记为准备好
        status: 'ready', // 已准备好状态
        thumbnailUrl, // 添加缩略图URL
      }

      console.log(
        `📋 更新MediaItem为完成状态: ${readyMediaItem.name} (时长: ${readyMediaItem.duration.toFixed(2)}s)`,
      )
      console.log(`📐 视频原始分辨率: ${video.videoWidth}x${video.videoHeight}`)

      // 设置视频元素到store中，用于获取原始分辨率
      videoStore.setVideoElement(mediaItemId, video)

      // 更新store中的MediaItem
      videoStore.updateMediaItem(readyMediaItem)

      const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`✅ [并发处理] 视频文件处理完成: ${file.name} (耗时: ${processingTime}s)`)
      resolve()
    } catch (error) {
      const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
      console.error(`❌ [并发处理] 视频文件处理失败: ${file.name} (耗时: ${processingTime}s)`, error)
      // 如果解析失败，从store中移除该项目
      videoStore.removeMediaItem(mediaItemId)
      URL.revokeObjectURL(url)
      resolve()
    }
  }

  video.onerror = () => {
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.error(`❌ [并发处理] 视频加载失败: ${file.name} (耗时: ${processingTime}s)`)
    // 如果视频加载失败，也需要清理可能已经添加的解析中状态的素材
    const existingItem = videoStore.getMediaItem(mediaItemId)
    if (existingItem) {
      videoStore.removeMediaItem(mediaItemId)
    }
    URL.revokeObjectURL(url)
    resolve()
  }

  video.src = url
}

// 添加图片素材项
const addImageItem = async (file: File, url: string, mediaItemId: string, startTime: number, resolve: () => void) => {
  const img = document.createElement('img')

  img.onload = async () => {
    try {
      const parsingMediaItem: MediaItem = {
        id: mediaItemId,
        file,
        url,
        name: file.name,
        duration: 5, // 图片默认5秒时长
        type: file.type,
        mediaType: 'image',
        mp4Clip: null,
        imgClip: null, // 解析中时为null
        isReady: false, // 标记为未准备好
        status: 'parsing', // 解析中状态
      }

      console.log(`📋 创建解析中的图片MediaItem: ${parsingMediaItem.name} (ID: ${mediaItemId})`)

      // 先添加解析中状态的素材到store
      videoStore.addMediaItem(parsingMediaItem)

      // 异步创建ImgClip
      console.log(`🖼️ Creating ImgClip for: ${file.name}`)
      const imgClip = await webAVControls.createImgClip(file)
      console.log(`✅ ImgClip created successfully for: ${file.name}`)

      // 生成缩略图
      console.log(`🖼️ 生成图片缩略图: ${file.name}`)
      const thumbnailUrl = await generateThumbnailForMediaItem({
        mediaType: 'image',
        imgClip
      })

      // 更新MediaItem为完成状态
      const readyMediaItem: MediaItem = {
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

      // 设置图片元素到store中，用于获取原始分辨率
      videoStore.setImageElement(mediaItemId, img)

      // 更新store中的MediaItem
      videoStore.updateMediaItem(readyMediaItem)

      const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`✅ [并发处理] 图片文件处理完成: ${file.name} (耗时: ${processingTime}s)`)
      resolve()
    } catch (error) {
      const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
      console.error(`❌ [并发处理] 图片文件处理失败: ${file.name} (耗时: ${processingTime}s)`, error)
      // 如果解析失败，从store中移除该项目
      videoStore.removeMediaItem(mediaItemId)
      URL.revokeObjectURL(url)
      resolve()
    }
  }

  img.onerror = () => {
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.error(`❌ [并发处理] 图片加载失败: ${file.name} (耗时: ${processingTime}s)`)
    // 如果图片加载失败，也需要清理可能已经添加的解析中状态的素材
    const existingItem = videoStore.getMediaItem(mediaItemId)
    if (existingItem) {
      videoStore.removeMediaItem(mediaItemId)
    }
    URL.revokeObjectURL(url)
    resolve()
  }

  img.src = url
}

// 移除素材项
const removeMediaItem = (id: string) => {
  const item = videoStore.getMediaItem(id)
  if (item) {
    // 检查是否有相关的时间轴项目
    const relatedTimelineItems = videoStore.timelineItems.filter(
      (timelineItem) => timelineItem.mediaItemId === id
    )

    if (dialogs.confirmMediaDelete(item.name, relatedTimelineItems.length)) {
      console.log(`🗑️ 准备删除素材库项目: ${item.name} (ID: ${id})`)

      // 清理URL
      URL.revokeObjectURL(item.url)

      // 清理缩略图URL
      if (item.thumbnailUrl) {
        URL.revokeObjectURL(item.thumbnailUrl)
      }

      // 从store中移除MediaItem（会自动移除相关的TimelineItem）
      videoStore.removeMediaItem(id)

      console.log(`✅ 素材库项目删除完成: ${item.name}`)
    }
  }
}

// 素材项拖拽开始
const handleItemDragStart = (event: DragEvent, item: MediaItem) => {
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
    item.mediaType
  )

  console.log('📦 [MediaLibrary] 使用统一格式设置拖拽数据:', dragData)
  console.log('✅ [MediaLibrary] 拖拽数据设置完成，类型:', event.dataTransfer!.types)
}

const handleItemDragEnd = () => {
  console.log('🏁 [MediaLibrary] 拖拽结束，清理全局状态')
  // 使用统一的拖拽工具清理状态
  dragUtils.clearDragData()
}




// 获取状态文本
const getStatusText = (status: string): string => {
  switch (status) {
    case 'parsing':
      return '解析中'
    case 'ready':
      return '已添加'
    case 'error':
      return '错误'
    case 'missing':
      return '已丢失'
    default:
      return '未知'
  }
}


</script>

<style scoped>
.media-library {
  width: 100%;
  height: 100%;
  background-color: #2a2a2a;
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

.library-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
}

.import-btn {
  background: var(--color-accent-primary);
  border: none;
  border-radius: var(--border-radius-medium);
  color: var(--color-text-primary);
  padding: var(--spacing-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--transition-fast);
}

.import-btn:hover {
  background: var(--color-accent-primary-hover);
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
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--spacing-md);
  padding: var(--spacing-md);
}

.media-item {
  background-color: var(--color-bg-tertiary);
  border-radius: var(--border-radius-large);
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: grab;
  transition: background-color var(--transition-fast);
  position: relative;
  min-height: 100px;
}

.media-item:hover {
  background-color: var(--color-bg-hover);
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
  width: 100px;
  height: 60px;
  background-color: #000;
  border-radius: var(--border-radius-medium);
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
  border-top: 1px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* 状态标签样式 */
.status-badge {
  position: absolute;
  top: 2px;
  left: 2px;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 3px;
  z-index: 2;
}

.status-badge.status-parsing {
  background-color: rgba(255, 165, 0, 0.9);
}

.status-badge.status-ready {
  background-color: rgba(34, 197, 94, 0.9);
}

.status-badge.status-error {
  background-color: rgba(239, 68, 68, 0.9);
}

.status-badge.status-missing {
  background-color: rgba(156, 163, 175, 0.9);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
  margin-top: var(--spacing-xs);
  padding: 0 2px;
  line-height: 1.2;
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

/* 自定义滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #1a1a1a;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
  border: 1px solid #333;
}

::-webkit-scrollbar-thumb:hover {
  background: #666;
}

::-webkit-scrollbar-corner {
  background: #1a1a1a;
}
</style>

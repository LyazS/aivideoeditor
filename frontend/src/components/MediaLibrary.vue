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
        <p class="hint">支持 MP4, WebM, AVI 等格式</p>
      </div>

      <!-- 素材列表 -->
      <div v-else class="media-list">
        <div
          v-for="item in videoStore.mediaItems"
          :key="item.id"
          class="media-item"
          :class="{ 'parsing': !item.isReady }"
          :draggable="item.isReady"
          @dragstart="handleItemDragStart($event, item)"
          @dragend="handleItemDragEnd"
        >
          <div class="media-thumbnail">
            <video
              :src="item.url"
              class="thumbnail-video"
              preload="metadata"
              muted
              @loadedmetadata="onThumbnailLoaded"
            />
            <div class="duration-badge">
              {{ formatDuration(item.duration) }}
            </div>
            <!-- 解析中状态覆盖层 -->
            <div v-if="!item.isReady" class="parsing-overlay">
              <div class="parsing-spinner"></div>
              <div class="parsing-text">解析中</div>
            </div>
          </div>
          <div class="media-info">
            <div class="media-name" :title="item.name">{{ item.name }}</div>
            <div class="media-details">
              {{ formatFileSize(item.file.size) }}
            </div>
          </div>
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
      accept="video/*"
      style="display: none"
      @change="handleFileSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, markRaw } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { useWebAVControls } from '../composables/useWebAVControls'
import type { MediaItem } from '../types/videoTypes'

const videoStore = useVideoStore()
const webAVControls = useWebAVControls()
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

// 处理文件
const processFiles = async (files: File[]) => {
  const videoFiles = files.filter((file) => file.type.startsWith('video/'))

  if (videoFiles.length === 0) {
    alert('请选择视频文件')
    return
  }

  for (const file of videoFiles) {
    await addMediaItem(file)
  }
}

// 添加素材项
const addMediaItem = async (file: File): Promise<void> => {
  return new Promise(async (resolve) => {
    console.log(
      `📁 开始处理上传文件: ${file.name} (大小: ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
    )

    const url = URL.createObjectURL(file)
    const video = document.createElement('video')

    // 先创建一个解析中状态的MediaItem ID
    const mediaItemId = Date.now().toString() + Math.random().toString(36).substring(2, 11)

    video.onloadedmetadata = async () => {
      try {
        const parsingMediaItem: MediaItem = {
          id: mediaItemId,
          file,
          url,
          name: file.name,
          duration: video.duration,
          type: file.type,
          mp4Clip: null, // 解析中时为null
          isReady: false, // 标记为未准备好
        }

        console.log(`📋 创建解析中的MediaItem: ${parsingMediaItem.name} (ID: ${mediaItemId})`)

        // 先添加解析中状态的素材到store
        videoStore.addMediaItem(parsingMediaItem)

        // 异步创建MP4Clip
        console.log(`🎬 Creating MP4Clip for: ${file.name}`)
        const mp4Clip = await webAVControls.createMP4Clip(file)
        console.log(`✅ MP4Clip created successfully for: ${file.name}`)

        // 更新MediaItem为完成状态
        const readyMediaItem: MediaItem = {
          ...parsingMediaItem,
          mp4Clip: markRaw(mp4Clip), // 使用markRaw避免Vue响应式包装
          isReady: true, // 标记为准备好
        }

        console.log(
          `📋 更新MediaItem为完成状态: ${readyMediaItem.name} (时长: ${readyMediaItem.duration.toFixed(2)}s)`,
        )
        console.log(`📐 视频原始分辨率: ${video.videoWidth}x${video.videoHeight}`)

        // 设置视频元素到store中，用于获取原始分辨率
        videoStore.setVideoElement(mediaItemId, video)

        // 更新store中的MediaItem
        videoStore.updateMediaItem(readyMediaItem)
        resolve()
      } catch (error) {
        console.error('❌ Failed to create MP4Clip:', error)
        // 如果解析失败，从store中移除该项目
        videoStore.removeMediaItem(mediaItemId)
        URL.revokeObjectURL(url)
        resolve()
      }
    }

    video.onerror = () => {
      console.error('Failed to load video:', file.name)
      // 如果视频加载失败，也需要清理可能已经添加的解析中状态的素材
      const existingItem = videoStore.getMediaItem(mediaItemId)
      if (existingItem) {
        videoStore.removeMediaItem(mediaItemId)
      }
      URL.revokeObjectURL(url)
      resolve()
    }

    video.src = url
  })
}

// 移除素材项
const removeMediaItem = (id: string) => {
  const item = videoStore.getMediaItem(id)
  if (item) {
    console.log(`🗑️ 准备删除素材库项目: ${item.name} (ID: ${id})`)

    // 清理URL
    URL.revokeObjectURL(item.url)

    // 从store中移除MediaItem（会自动移除相关的TimelineItem）
    videoStore.removeMediaItem(id)

    console.log(`✅ 素材库项目删除完成: ${item.name}`)
  }
}

// 素材项拖拽开始
const handleItemDragStart = (event: DragEvent, item: MediaItem) => {
  // 如果素材还未解析完成，阻止拖拽
  if (!item.isReady) {
    event.preventDefault()
    console.log('素材解析中，无法拖拽:', item.name)
    return
  }

  // 设置拖拽数据，不包含 File 对象（因为不能序列化）
  const dragData = {
    id: item.id,
    url: item.url,
    name: item.name,
    duration: item.duration,
    type: item.type,
    // 存储文件的基本信息，而不是整个 File 对象
    fileInfo: {
      name: item.file.name,
      size: item.file.size,
      type: item.file.type,
      lastModified: item.file.lastModified,
    },
  }

  event.dataTransfer!.setData('application/media-item', JSON.stringify(dragData))
  event.dataTransfer!.effectAllowed = 'copy'

  console.log('开始拖拽素材:', dragData.name)
}

const handleItemDragEnd = () => {
  // 拖拽结束处理
}

// 缩略图加载完成
const onThumbnailLoaded = (event: Event) => {
  const video = event.target as HTMLVideoElement
  // 跳转到视频中间位置作为缩略图
  video.currentTime = video.duration / 2
}

// 格式化时长
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
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
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.media-item {
  background-color: var(--color-bg-tertiary);
  border-radius: var(--border-radius-large);
  padding: var(--spacing-md);
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  cursor: grab;
  transition: background-color var(--transition-fast);
  position: relative;
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
  width: 60px;
  height: 34px;
  background-color: #000;
  border-radius: var(--border-radius-medium);
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.thumbnail-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.duration-badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  background-color: rgba(0, 0, 0, 0.8);
  color: var(--color-text-primary);
  font-size: var(--font-size-xs);
  padding: 1px var(--spacing-xs);
  border-radius: 2px;
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

.media-info {
  flex: 1;
  min-width: 0;
}

.media-name {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.media-details {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.remove-btn {
  background: #f44336;
  border: none;
  border-radius: 3px;
  color: white;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.remove-btn:hover {
  background: #d32f2f;
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

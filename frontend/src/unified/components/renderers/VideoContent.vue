<!-- VideoContentTemplate.vue - 多缩略图版本 -->
<template>
  <div class="video-content" :class="{ selected: isSelected }">
    <!-- 多缩略图容器 -->
    <div class="multi-thumbnails-container" :style="{ height: `${THUMBNAIL_CONSTANTS.HEIGHT}px`, top: `${THUMBNAIL_CONSTANTS.TOP_OFFSET}px` }">
      <div
        v-for="item in thumbnailLayout"
        :key="item.index"
        class="thumbnail-slot"
        :style="getThumbnailSlotStyle(item)"
      >
        <!-- 实时生成的缩略图 -->
        <img
          v-if="getThumbnailUrl(item)"
          :src="getThumbnailUrl(item)!"
          class="thumbnail-image"
          @load="onThumbnailLoad(item)"
          @error="onThumbnailError(item)"
        />
        <div v-else class="thumbnail-placeholder">
          <!-- 生成中的加载状态 -->
          <div class="loading-spinner"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch, ref } from 'vue'
import type { ContentTemplateProps } from '@/unified/types/clipRenderer'
import { useUnifiedStore } from '@/unified/unifiedStore'
import {
  calculateThumbnailLayout,
  filterThumbnailVisible,
  calculateViewportFrameRange,
  calculateClipWidthPixels,
} from '@/unified/utils/thumbnailAlgorithms'
import type { ThumbnailLayoutItem } from '@/unified/types/thumbnail'
import { THUMBNAIL_CONSTANTS } from '@/unified/constants/ThumbnailConstants'
import { realtimeThumbnailManager } from '@/unified/managers/RealtimeThumbnailManager'

const props = defineProps<ContentTemplateProps<'video' | 'image'>>()
const unifiedStore = useUnifiedStore()

// 缩略图状态管理
const thumbnailStates = ref(new Map<string, string | null>())

// 缩略图布局数组
const thumbnailLayout = computed<ThumbnailLayoutItem[]>(() => {
  if (!props.data.timeRange) return []

  const clipTLStartFrame = props.data.timeRange.timelineStartTime
  const clipTLDurationFrames = props.data.timeRange.timelineEndTime - clipTLStartFrame
  const clipStartFrame = props.data.timeRange.clipStartTime
  const clipDurationFrames = props.data.timeRange.clipEndTime - clipStartFrame

  // 计算clip的像素宽度
  const clipWidthPixels = calculateClipWidthPixels(
    clipTLDurationFrames,
    props.timelineWidth,
    unifiedStore.totalDurationFrames,
    unifiedStore.zoomLevel,
  )

  // 计算视口帧范围
  const { startFrames: viewportStartFrame, endFrames: viewportEndFrame } =
    calculateViewportFrameRange(
      props.timelineWidth,
      unifiedStore.totalDurationFrames,
      unifiedStore.zoomLevel,
      unifiedStore.scrollOffset,
      unifiedStore.maxVisibleDurationFrames,
    )

  // 计算初始布局
  const layout = calculateThumbnailLayout(
    clipStartFrame,
    clipDurationFrames,
    clipWidthPixels,
    clipTLStartFrame,
    clipTLDurationFrames,
    THUMBNAIL_CONSTANTS.WIDTH, // 固定缩略图宽度
  )

  // 过滤可见的缩略图
  return filterThumbnailVisible(
    layout,
    clipTLStartFrame,
    clipTLDurationFrames,
    viewportStartFrame,
    viewportEndFrame,
  )
})

// 获取缩略图槽位样式
function getThumbnailSlotStyle(item: ThumbnailLayoutItem) {
  return {
    left: `${item.pixelPosition}px`,
    width: `${THUMBNAIL_CONSTANTS.WIDTH}px`,
    height: `${THUMBNAIL_CONSTANTS.HEIGHT}px`,
  }
}

// 获取缩略图URL
function getThumbnailUrl(item: ThumbnailLayoutItem): string | null {
  const cacheKey = `${props.data.id}-${item.framePosition}`
  return thumbnailStates.value.get(cacheKey) || null
}

// 缩略图加载成功
function onThumbnailLoad(item: ThumbnailLayoutItem) {
  console.log('✅ 缩略图加载成功:', item.framePosition)
}

// 缩略图加载失败
function onThumbnailError(item: ThumbnailLayoutItem) {
  console.error('❌ 缩略图加载失败:', item.framePosition)
  const cacheKey = `${props.data.id}-${item.framePosition}`
  thumbnailStates.value.set(cacheKey, null) // 标记为加载失败
}

// 监听布局变化触发实时生成
watch(thumbnailLayout, (newLayout, oldLayout) => {
  // 清理离开视口的缩略图资源
  if (oldLayout) {
    const newKeys = new Set(newLayout.map(item =>
      `${props.data.id}-${item.framePosition}`
    ))
    
    // 找出离开视口的缩略图
    oldLayout.forEach(item => {
      const cacheKey = `${props.data.id}-${item.framePosition}`
      if (!newKeys.has(cacheKey)) {
        const url = thumbnailStates.value.get(cacheKey)
        
        // 释放Blob URL资源
        if (url && url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(url)
          } catch (error) {
            console.warn('释放Blob URL失败:', error)
          }
        }
        
        // 从状态中移除
        thumbnailStates.value.delete(cacheKey)
      }
    })
  }

  // 为新进入视口的缩略图触发生成
  newLayout.forEach(async (item) => {
    const cacheKey = `${props.data.id}-${item.framePosition}`
    
    // 如果已经有URL或者正在生成，跳过
    if (thumbnailStates.value.has(cacheKey)) {
      return
    }
    
    // 标记为正在生成（设置为null）
    thumbnailStates.value.set(cacheKey, null)
    
    try {
      // 获取对应的媒体项目
      const mediaItem = unifiedStore.getMediaItem(props.data.mediaItemId)
      
      if (!mediaItem) {
        console.error('❌ 找不到对应的媒体项目:', props.data.mediaItemId)
        thumbnailStates.value.set(cacheKey, null)
        return
      }

      // 实时生成缩略图
      const url = await realtimeThumbnailManager.generateThumbnail(
        props.data.id,
        item.framePosition,
        mediaItem
      )
      
      // 更新状态
      thumbnailStates.value.set(cacheKey, url)
      
    } catch (error) {
      console.error('实时缩略图生成失败:', error)
      thumbnailStates.value.set(cacheKey, null)
    }
  })
}, { deep: true, immediate: true })

// 生命周期钩子
onMounted(() => {
  console.log('🎬 VideoContent mounted with multi-thumbnail support')
})

onUnmounted(() => {
  console.log('🧹 VideoContent unmounted')
})
</script>

<style scoped>
/* 多缩略图容器样式 */
.multi-thumbnails-container {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.thumbnail-slot {
  position: absolute;
  width: 50px;
  top: 0;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.3);
}

.thumbnail-slot:last-child {
  border-right: none;
}

.thumbnail-frame-index {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: bold;
  color: white;
  background-color: rgba(0, 0, 0, 0.5);
}


/* 保持原有样式（向后兼容） */
.video-content {
  display: flex;
  align-items: center;
  height: 100%;
  overflow: hidden;
}

.overlay-info {
  position: absolute;
  top: 4px;
  left: 8px;
  right: 8px;
  pointer-events: none;
  z-index: 10;
}

.clip-name {
  font-size: 11px;
  font-weight: bold;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.clip-duration {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.8);
}

.clip-speed {
  font-size: 9px;
  color: var(--color-speed-indicator);
  font-weight: bold;
}

.clip-simple {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.simple-duration {
  font-size: 10px;
  font-weight: bold;
  color: white;
  background-color: rgba(0, 0, 0, 0.3);
  padding: 2px 4px;
  border-radius: 2px;
  white-space: nowrap;
}

/* 选中状态样式 */
.video-content.selected {
  outline: 2px solid var(--color-clip-selected);
  outline-offset: -2px;
}

.video-content.selected .multi-thumbnails-container {
  opacity: 0.9;
}
</style>

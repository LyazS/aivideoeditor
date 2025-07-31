<template>
  <!-- 工具栏 -->
  <div class="clip-management-toolbar">
    <!-- 历史管理工具栏 -->
    <div class="toolbar-section">
      <HoverButton @click="undo" :disabled="!unifiedStore.canUndo" title="撤销上一个操作 (Ctrl+Z)">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z"
            />
          </svg>
        </template>
        撤销
      </HoverButton>
      <HoverButton @click="redo" :disabled="!unifiedStore.canRedo" title="重做下一个操作 (Ctrl+Y)">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M18.4,10.6C16.55,9 14.15,8 11.5,8C6.85,8 2.92,11.03 1.53,15.22L3.9,16C4.95,12.81 7.96,10.5 11.5,10.5C13.46,10.5 15.23,11.22 16.62,12.38L13,16H22V7L18.4,10.6Z"
            />
          </svg>
        </template>
        重做
      </HoverButton>
    </div>

    <div v-if="timelineItems.length > 0" class="toolbar-section">
      <HoverButton
        v-if="unifiedStore.selectedTimelineItemId"
        :disabled="isSplitButtonDisabled"
        @click="splitSelectedClip"
        :title="splitButtonTitle"
      >
        <template #icon>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <!-- 左方括号 [ -->
            <path d="M10 6 L10 18 M8 6 L10 6 M8 18 L10 18" />
            <!-- 右方括号 ] -->
            <path d="M14 6 L14 18 M14 6 L16 6 M14 18 L16 18" />
          </svg>
        </template>
        裁剪
      </HoverButton>
      <HoverButton
        v-if="unifiedStore.selectedTimelineItemId"
        @click="deleteSelectedClip"
        title="删除选中的片段"
      >
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#ef4444">
            <path
              d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"
            />
          </svg>
        </template>
        删除
      </HoverButton>
      <span v-if="overlappingCount > 0" class="overlap-warning">
        ⚠️ {{ overlappingCount }} 个重叠
      </span>
    </div>

    <!-- 调试按钮放在最右边 - 暂时隐藏 -->
    <div class="toolbar-section debug-section">
      <HoverButton @click="debugTimeline" title="在控制台打印时间轴配置信息">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"
            />
          </svg>
        </template>
        调试
      </HoverButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUnifiedStore } from '../unifiedStore'
import { formatFileSize, framesToSeconds } from '../utils/UnifiedTimeUtils'
import { countOverlappingItems } from '../utils/timeOverlapUtils'
import HoverButton from '@/components/HoverButton.vue'

const unifiedStore = useUnifiedStore()

const timelineItems = computed(() => unifiedStore.timelineItems)

// 计算重叠时间轴项目数量（只计算同轨道内的重叠）
const overlappingCount = computed(() => {
  // 使用统一的重叠检测工具
  return countOverlappingItems(unifiedStore.timelineItems)
})

// 检查选中的项目是否支持裁剪（视频和音频支持，图片和文本不支持）
const selectedItemSupportsSplit = computed(() => {
  if (!unifiedStore.selectedTimelineItemId) return false
  const item = unifiedStore.getTimelineItem(unifiedStore.selectedTimelineItemId)
  if (!item) return false

  // 视频和音频支持裁剪，图片和文本不支持
  return item.mediaType === 'video' || item.mediaType === 'audio'
})

// 裁剪按钮是否禁用
const isSplitButtonDisabled = computed(() => {
  return !selectedItemSupportsSplit.value
})

// 裁剪按钮的提示文本
const splitButtonTitle = computed(() => {
  if (!unifiedStore.selectedTimelineItemId) {
    return '请先选择一个片段'
  }

  const item = unifiedStore.getTimelineItem(unifiedStore.selectedTimelineItemId)
  if (!item) {
    return '片段不存在'
  }

  if (item.mediaType === 'text') {
    return '文本类型不支持裁剪功能'
  } else if (item.mediaType === 'image') {
    return '图片类型不支持裁剪功能'
  } else if (item.mediaType === 'video' || item.mediaType === 'audio') {
    return '在当前时间位置裁剪选中的片段'
  } else {
    return '该类型不支持裁剪功能'
  }
})

async function splitSelectedClip() {
  if (unifiedStore.selectedTimelineItemId) {
    const item = unifiedStore.getTimelineItem(unifiedStore.selectedTimelineItemId)
    const mediaItem = item ? unifiedStore.getMediaItem(item.mediaItemId) : null
    console.log(
      `🔪 开始裁剪时间轴项目: ${mediaItem?.name || '未知'} (ID: ${unifiedStore.selectedTimelineItemId})`,
    )
    console.log(
      `📍 裁剪时间位置: ${unifiedStore.currentFrame}帧 (${unifiedStore.formattedCurrentTime})`,
    )

    // 使用带历史记录的分割方法（传入帧数）
    await unifiedStore.splitTimelineItemAtTimeWithHistory(
      unifiedStore.selectedTimelineItemId,
      unifiedStore.currentFrame,
    )
    console.log('✅ 时间轴项目分割成功')
  }
}

async function deleteSelectedClip() {
  if (unifiedStore.selectedTimelineItemId) {
    const item = unifiedStore.getTimelineItem(unifiedStore.selectedTimelineItemId)
    const mediaItem = item ? unifiedStore.getMediaItem(item.mediaItemId) : null
    console.log(
      `🗑️ 删除时间轴项目: ${mediaItem?.name || '未知'} (ID: ${unifiedStore.selectedTimelineItemId})`,
    )

    try {
      // 使用带历史记录的删除方法
      await unifiedStore.removeTimelineItemWithHistory(unifiedStore.selectedTimelineItemId)
      console.log('✅ 时间轴项目删除成功')
    } catch (error) {
      console.error('❌ 删除时间轴项目失败:', error)
      // 如果历史记录删除失败，回退到直接删除
      unifiedStore.removeTimelineItem(unifiedStore.selectedTimelineItemId)
    }
  }
}

// ==================== 历史管理方法 ====================

/**
 * 撤销上一个操作
 */
async function undo() {
  try {
    const success = await unifiedStore.undo()
    if (success) {
      console.log('↩️ 撤销操作成功')
    } else {
      console.log('⚠️ 没有可撤销的操作')
    }
  } catch (error) {
    console.error('❌ 撤销操作失败:', error)
  }
}

/**
 * 重做下一个操作
 */
async function redo() {
  try {
    const success = await unifiedStore.redo()
    if (success) {
      console.log('↪️ 重做操作成功')
    } else {
      console.log('⚠️ 没有可重做的操作')
    }
  } catch (error) {
    console.error('❌ 重做操作失败:', error)
  }
}

function debugTimeline() {
  console.group('🎬 时间轴配置调试信息')

  // 基本配置
  console.group('📊 基本配置')
  console.log('总时长 (帧):', unifiedStore.totalDurationFrames)
  console.log('内容结束时间 (帧):', unifiedStore.contentEndTimeFrames)
  console.log(
    `当前播放时间 ${framesToSeconds(unifiedStore.currentFrame)}秒 (${unifiedStore.currentFrame}帧)`,
  )
  console.log('播放状态:', unifiedStore.isPlaying ? '播放中' : '已暂停')
  console.log('播放速度:', unifiedStore.playbackRate + 'x')
  console.groupEnd()

  // 素材信息
  console.group('📁 素材信息 (' + unifiedStore.mediaItems.length + ' 个)')
  unifiedStore.mediaItems.forEach((item, index) => {
    console.group(`素材 ${index + 1}: ${item.name}`)
    console.log('ID:', item.id)
    console.log('文件名:', item.name)
    console.log('时长 (帧):', item.duration)
    console.log('媒体状态:', item.mediaStatus)
    console.log('媒体类型:', item.mediaType)
    if (item.source.type === 'user-selected') {
      console.log('文件大小:', formatFileSize(item.source.selectedFile.size))
      console.log('文件类型:', item.source.selectedFile.type)
    }
    console.groupEnd()
  })
  console.groupEnd()

  // 时间轴项目信息
  console.group('🎞️ 时间轴项目信息 (' + timelineItems.value.length + ' 个)')
  timelineItems.value.forEach((item, index) => {
    const mediaItem = unifiedStore.getMediaItem(item.mediaItemId)
    // 直接从timelineItem.timeRange获取，与unifiedStore的同步机制保持一致
    const timeRange = item.timeRange

    console.group(`时间轴项目 ${index + 1}: ${mediaItem?.name || 'Unknown'}`)
    console.log('ID:', item.id)
    console.log('素材ID:', item.mediaItemId)
    console.log('轨道ID:', item.trackId)
    console.log('媒体类型:', item.mediaType)
    console.log('时间轴开始 (帧):', timeRange.timelineStartTime)
    console.log('时间轴结束 (帧):', timeRange.timelineEndTime)
    console.groupEnd()
  })
  console.groupEnd()

  console.groupEnd()
}
</script>

<style scoped>
.clip-management-toolbar {
  background-color: #333;
  padding: 8px 12px;
  border-bottom: 1px solid #444;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  border-radius: 4px 4px 0 0;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.debug-section {
  margin-left: auto;
}

.toolbar-label {
  font-size: 12px;
  color: #ccc;
  font-weight: 500;
}

.toolbar-btn {
  background-color: #555;
  color: #ccc;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background-color 0.2s;
}

.toolbar-btn:hover {
  background-color: #666;
  color: white;
}

.toolbar-btn.debug-btn {
  background-color: #6c757d;
  border: 1px dashed #adb5bd;
}

.toolbar-btn.debug-btn:hover {
  background-color: #5a6268;
  border-color: #6c757d;
}

.toolbar-btn.split-btn {
  background-color: #555;
  color: #ccc;
}

.toolbar-btn.split-btn:hover {
  background-color: #666;
  color: white;
}

.toolbar-btn.delete-btn {
  background-color: #dc3545;
  color: white;
}

.toolbar-btn.delete-btn:hover {
  background-color: #c82333;
  color: white;
}

.toolbar-btn.undo-btn {
  background-color: #555;
  color: #ccc;
}

.toolbar-btn.undo-btn:hover {
  background-color: #666;
  color: white;
}

.toolbar-btn.redo-btn {
  background-color: #555;
  color: #ccc;
}

.toolbar-btn.redo-btn:hover {
  background-color: #666;
  color: white;
}

.toolbar-btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.toolbar-btn:disabled:hover {
  background-color: #6c757d;
}

.toolbar-btn svg {
  width: 14px;
  height: 14px;
}

.overlap-warning {
  color: #ff6b6b;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.split-hint {
  color: #ffd700;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>

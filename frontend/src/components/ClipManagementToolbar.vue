<template>
  <!-- 工具栏 -->
  <div class="clip-management-toolbar">
    <!-- 历史管理工具栏 -->
    <div class="toolbar-section">
      <button
        class="toolbar-btn undo-btn"
        @click="undo"
        :disabled="!videoStore.canUndo"
        title="撤销上一个操作 (Ctrl+Z)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z" />
        </svg>
        撤销
      </button>
      <button
        class="toolbar-btn redo-btn"
        @click="redo"
        :disabled="!videoStore.canRedo"
        title="重做下一个操作 (Ctrl+Y)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.4,10.6C16.55,9 14.15,8 11.5,8C6.85,8 2.92,11.03 1.53,15.22L3.9,16C4.95,12.81 7.96,10.5 11.5,10.5C13.46,10.5 15.23,11.22 16.62,12.38L13,16H22V7L18.4,10.6Z" />
        </svg>
        重做
      </button>
    </div>

    <div v-if="timelineItems.length > 0" class="toolbar-section">
      <button
        v-if="videoStore.selectedTimelineItemId"
        class="toolbar-btn split-btn"
        @click="splitSelectedClip"
        title="在当前时间位置裁剪选中的片段"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,19H5V5H19V19Z"
          />
          <path d="M12,7V17M7,12H17" stroke="white" stroke-width="1" />
        </svg>
        裁剪
      </button>
      <button
        v-if="videoStore.selectedTimelineItemId"
        class="toolbar-btn delete-btn"
        @click="deleteSelectedClip"
        title="删除选中的片段"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"
          />
        </svg>
        删除
      </button>
      <span v-if="overlappingCount > 0" class="overlap-warning">
        ⚠️ {{ overlappingCount }} 个重叠
      </span>
    </div>

    <!-- 调试按钮放在最右边 -->
    <div class="toolbar-section debug-section">
      <button
        class="toolbar-btn debug-btn"
        @click="debugTimeline"
        title="在控制台打印时间轴配置信息"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"
          />
        </svg>
        调试
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { formatFileSize } from '../stores/utils/timeUtils'
import type { TimelineItem } from '../types/videoTypes'
import { isVideoTimeRange } from '../types/videoTypes'

const videoStore = useVideoStore()

const timelineItems = computed(() => videoStore.timelineItems)

// 计算重叠时间轴项目数量（只计算同轨道内的重叠）
const overlappingCount = computed(() => {
  let count = 0
  const tracks = new Map<number, TimelineItem[]>()

  // 按轨道分组
  videoStore.timelineItems.forEach((item) => {
    if (!tracks.has(item.trackId)) {
      tracks.set(item.trackId, [])
    }
    tracks.get(item.trackId)!.push(item)
  })

  // 检查每个轨道内的重叠
  tracks.forEach((trackItems) => {
    for (let i = 0; i < trackItems.length; i++) {
      for (let j = i + 1; j < trackItems.length; j++) {
        if (isTimelineItemsOverlapping(trackItems[i], trackItems[j])) {
          count++
        }
      }
    }
  })

  return count
})

// 检测两个时间轴项目是否重叠
function isTimelineItemsOverlapping(item1: TimelineItem, item2: TimelineItem): boolean {
  const sprite1 = item1.sprite
  const sprite2 = item2.sprite
  const range1 = sprite1.getTimeRange()
  const range2 = sprite2.getTimeRange()

  const item1Start = range1.timelineStartTime / 1000000 // 转换为秒
  const item1End = range1.timelineEndTime / 1000000
  const item2Start = range2.timelineStartTime / 1000000
  const item2End = range2.timelineEndTime / 1000000

  return !(item1End <= item2Start || item2End <= item1Start)
}

async function splitSelectedClip() {
  if (videoStore.selectedTimelineItemId) {
    const item = videoStore.getTimelineItem(videoStore.selectedTimelineItemId)
    const mediaItem = item ? videoStore.getMediaItem(item.mediaItemId) : null
    console.log(
      `🔪 开始裁剪时间轴项目: ${mediaItem?.name || '未知'} (ID: ${videoStore.selectedTimelineItemId})`,
    )
    console.log(`📍 裁剪时间位置: ${videoStore.currentTime.toFixed(2)}s`)

    try {
      // 使用带历史记录的分割方法
      await videoStore.splitTimelineItemAtTimeWithHistory(
        videoStore.selectedTimelineItemId,
        videoStore.currentTime,
      )
      console.log('✅ 时间轴项目分割成功')
    } catch (error) {
      console.error('❌ 分割时间轴项目失败:', error)
      // 如果历史记录分割失败，回退到直接分割
      await videoStore.splitTimelineItemAtTime(
        videoStore.selectedTimelineItemId,
        videoStore.currentTime,
      )
    }
  }
}

async function deleteSelectedClip() {
  if (videoStore.selectedTimelineItemId) {
    const item = videoStore.getTimelineItem(videoStore.selectedTimelineItemId)
    const mediaItem = item ? videoStore.getMediaItem(item.mediaItemId) : null
    console.log(
      `🗑️ 删除时间轴项目: ${mediaItem?.name || '未知'} (ID: ${videoStore.selectedTimelineItemId})`,
    )

    try {
      // 使用带历史记录的删除方法
      await videoStore.removeTimelineItemWithHistory(videoStore.selectedTimelineItemId)
      console.log('✅ 时间轴项目删除成功')
    } catch (error) {
      console.error('❌ 删除时间轴项目失败:', error)
      // 如果历史记录删除失败，回退到直接删除
      videoStore.removeTimelineItem(videoStore.selectedTimelineItemId)
    }
  }
}

// ==================== 历史管理方法 ====================

/**
 * 撤销上一个操作
 */
async function undo() {
  try {
    const success = await videoStore.undo()
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
    const success = await videoStore.redo()
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
  console.log('总时长 (秒):', videoStore.totalDuration)
  console.log('内容结束时间 (秒):', videoStore.contentEndTime)
  console.log('当前播放时间 (秒):', videoStore.currentTime)
  console.log('播放状态:', videoStore.isPlaying ? '播放中' : '已暂停')
  console.log('播放速度:', videoStore.playbackRate + 'x')
  console.groupEnd()

  // 素材信息
  console.group('📁 素材信息 (' + videoStore.mediaItems.length + ' 个)')
  videoStore.mediaItems.forEach((item, index) => {
    console.group(`素材 ${index + 1}: ${item.name}`)
    console.log('ID:', item.id)
    console.log('文件名:', item.name)
    console.log('时长 (秒):', item.duration.toFixed(2))
    console.log('文件大小:', formatFileSize(item.file.size))
    console.log('文件类型:', item.file.type)
    console.groupEnd()
  })
  console.groupEnd()

  // 时间轴项目信息
  console.group('🎞️ 时间轴项目信息 (' + timelineItems.value.length + ' 个)')
  timelineItems.value.forEach((item, index) => {
    const mediaItem = videoStore.getMediaItem(item.mediaItemId)
    // 直接从timelineItem.timeRange获取，与videostore的同步机制保持一致
    const timeRange = item.timeRange

    console.group(`时间轴项目 ${index + 1}: ${mediaItem?.name || 'Unknown'}`)
    console.log('ID:', item.id)
    console.log('素材ID:', item.mediaItemId)
    console.log('轨道ID:', item.trackId)
    console.log('时间轴位置 (秒):', (timeRange.timelineStartTime / 1000000).toFixed(2))
    console.log('时间轴开始 (秒):', (timeRange.timelineStartTime / 1000000).toFixed(2))
    console.log('时间轴结束 (秒):', (timeRange.timelineEndTime / 1000000).toFixed(2))
    console.log('播放速度:', isVideoTimeRange(timeRange) ? timeRange.playbackRate : '不适用(图片)')
    console.groupEnd()
  })
  console.groupEnd()

  console.log('✅ 调试信息输出完成')
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
  background-color: #4a90e2;
  color: white;
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
  background-color: #357abd;
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
  background-color: #28a745;
}

.toolbar-btn.split-btn:hover {
  background-color: #218838;
}

.toolbar-btn.delete-btn {
  background-color: #dc3545;
}

.toolbar-btn.delete-btn:hover {
  background-color: #c82333;
}

.toolbar-btn.undo-btn {
  background-color: #6f42c1;
}

.toolbar-btn.undo-btn:hover {
  background-color: #5a32a3;
}

.toolbar-btn.redo-btn {
  background-color: #6f42c1;
}

.toolbar-btn.redo-btn:hover {
  background-color: #5a32a3;
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

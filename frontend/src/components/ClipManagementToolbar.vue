<template>
  <!-- 工具栏 -->
  <div v-if="timelineItems.length > 0" class="clip-management-toolbar">
    <div class="toolbar-section">
      <span class="toolbar-label">片段管理:</span>
      <button class="toolbar-btn" @click="autoArrange" title="自动排列片段，消除重叠">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3,3H21V5H3V3M3,7H15V9H3V7M3,11H21V13H3V11M3,15H15V17H3V15M3,19H21V21H3V19Z" />
        </svg>
        自动排列
      </button>
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

    <div class="toolbar-section">
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
import { useVideoStore, type TimelineItem } from '../stores/counter'

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
  const sprite1 = item1.customSprite
  const sprite2 = item2.customSprite
  const range1 = sprite1.getTimeRange()
  const range2 = sprite2.getTimeRange()

  const item1Start = range1.timelineStartTime / 1000000 // 转换为秒
  const item1End = range1.timelineEndTime / 1000000
  const item2Start = range2.timelineStartTime / 1000000
  const item2End = range2.timelineEndTime / 1000000

  return !(item1End <= item2Start || item2End <= item1Start)
}

function splitSelectedClip() {
  if (videoStore.selectedTimelineItemId) {
    console.log('🔪 开始裁剪时间轴项目:', videoStore.selectedTimelineItemId)
    console.log('📍 裁剪时间位置:', videoStore.currentTime)
    videoStore.splitTimelineItemAtTime(videoStore.selectedTimelineItemId, videoStore.currentTime)
  }
}

function deleteSelectedClip() {
  if (videoStore.selectedTimelineItemId) {
    console.log('🗑️ 删除时间轴项目:', videoStore.selectedTimelineItemId)
    videoStore.removeTimelineItem(videoStore.selectedTimelineItemId)
  }
}

function autoArrange() {
  videoStore.autoArrangeTimelineItems()
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
    const sprite = item.customSprite
    const timeRange = sprite.getTimeRange()

    console.group(`时间轴项目 ${index + 1}: ${mediaItem?.name || 'Unknown'}`)
    console.log('ID:', item.id)
    console.log('素材ID:', item.mediaItemId)
    console.log('轨道ID:', item.trackId)
    console.log('时间轴位置 (秒):', item.timelinePosition.toFixed(2))
    console.log('时间轴开始 (秒):', (timeRange.timelineStartTime / 1000000).toFixed(2))
    console.log('时间轴结束 (秒):', (timeRange.timelineEndTime / 1000000).toFixed(2))
    console.log('播放速度:', sprite.getPlaybackSpeed())
    console.groupEnd()
  })
  console.groupEnd()

  console.log('✅ 调试信息输出完成')
  console.groupEnd()
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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

<template>
  <!-- 工具栏 -->
  <div v-if="clips.length > 0" class="clip-management-toolbar">
    <div class="toolbar-section">
      <span class="toolbar-label">片段管理:</span>
      <button class="toolbar-btn" @click="autoArrange" title="自动排列片段，消除重叠">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3,3H21V5H3V3M3,7H15V9H3V7M3,11H21V13H3V11M3,15H15V17H3V15M3,19H21V21H3V19Z" />
        </svg>
        自动排列
      </button>
      <button
        v-if="videoStore.selectedClipId"
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
        v-if="videoStore.selectedClipId"
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
import { useVideoStore, type VideoClip } from '../stores/counter'

const videoStore = useVideoStore()

const clips = computed(() => videoStore.clips)

// 计算重叠片段数量（只计算同轨道内的重叠）
const overlappingCount = computed(() => {
  let count = 0
  const tracks = new Map<number, VideoClip[]>()

  // 按轨道分组
  videoStore.clips.forEach((clip) => {
    if (!tracks.has(clip.trackId)) {
      tracks.set(clip.trackId, [])
    }
    tracks.get(clip.trackId)!.push(clip)
  })

  // 检查每个轨道内的重叠
  tracks.forEach((trackClips) => {
    for (let i = 0; i < trackClips.length; i++) {
      for (let j = i + 1; j < trackClips.length; j++) {
        if (videoStore.isOverlapping(trackClips[i], trackClips[j])) {
          count++
        }
      }
    }
  })

  return count
})

function splitSelectedClip() {
  if (videoStore.selectedClipId) {
    console.log('🔪 开始裁剪片段:', videoStore.selectedClipId)
    console.log('📍 裁剪时间位置:', videoStore.currentTime)
    videoStore.splitClipAtTime(videoStore.selectedClipId, videoStore.currentTime)
  }
}

function deleteSelectedClip() {
  if (videoStore.selectedClipId) {
    console.log('🗑️ 删除片段:', videoStore.selectedClipId)
    videoStore.removeClip(videoStore.selectedClipId)
  }
}

function autoArrange() {
  videoStore.autoArrangeClips()
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

  // 视频片段信息
  console.group('🎞️ 视频片段信息 (' + clips.value.length + ' 个)')
  clips.value.forEach((clip, index) => {
    console.group(`片段 ${index + 1}: ${clip.name}`)
    console.log('ID:', clip.id)
    console.log('文件名:', clip.name)
    console.log('时长 (秒):', clip.duration.toFixed(2))
    console.log('时间轴位置 (秒):', clip.timelinePosition.toFixed(2))
    console.log('结束位置 (秒):', (clip.timelinePosition + clip.duration).toFixed(2))
    console.log('文件大小:', formatFileSize(clip.file.size))
    console.log('文件类型:', clip.file.type)
    console.groupEnd()
  })
  console.groupEnd()

  // 重叠检测
  const overlaps = videoStore.getOverlappingClips()
  console.group('⚠️ 重叠检测 (' + overlaps.length + ' 个重叠)')
  if (overlaps.length > 0) {
    overlaps.forEach((overlap, index) => {
      console.group(`重叠 ${index + 1}`)
      console.log('片段1:', overlap.clip1.name)
      console.log(
        '片段1范围:',
        `${overlap.clip1.timelinePosition.toFixed(2)}s - ${(overlap.clip1.timelinePosition + overlap.clip1.duration).toFixed(2)}s`,
      )
      console.log('片段2:', overlap.clip2.name)
      console.log(
        '片段2范围:',
        `${overlap.clip2.timelinePosition.toFixed(2)}s - ${(overlap.clip2.timelinePosition + overlap.clip2.duration).toFixed(2)}s`,
      )

      // 计算重叠区域
      const overlapStart = Math.max(overlap.clip1.timelinePosition, overlap.clip2.timelinePosition)
      const overlapEnd = Math.min(
        overlap.clip1.timelinePosition + overlap.clip1.duration,
        overlap.clip2.timelinePosition + overlap.clip2.duration,
      )
      console.log(
        '重叠区域:',
        `${overlapStart.toFixed(2)}s - ${overlapEnd.toFixed(2)}s (${(overlapEnd - overlapStart).toFixed(2)}s)`,
      )
      console.groupEnd()
    })
  } else {
    console.log('✅ 没有检测到重叠')
  }
  console.groupEnd()

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

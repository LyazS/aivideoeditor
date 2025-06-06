<template>
  <div class="timeline">
    <!-- 工具栏 -->
    <div v-if="clips.length > 0" class="timeline-toolbar">
      <div class="toolbar-section">
        <span class="toolbar-label">片段管理:</span>
        <button
          class="toolbar-btn"
          @click="autoArrange"
          title="自动排列片段，消除重叠"
        >
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
            <path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,19H5V5H19V19Z" />
            <path d="M12,7V17M7,12H17" stroke="white" stroke-width="1"/>
          </svg>
          裁剪片段
        </button>
        <button
          v-if="videoStore.selectedClipId"
          class="toolbar-btn delete-btn"
          @click="deleteSelectedClip"
          title="删除选中的片段"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
          </svg>
          删除片段
        </button>
        <span v-if="overlappingCount > 0" class="overlap-warning">
          ⚠️ {{ overlappingCount }} 个重叠
        </span>
        <span v-if="videoStore.selectedClipId" class="split-hint">
          💡 选中片段: {{ getSelectedClipName() }}
        </span>
      </div>

      <div class="toolbar-section">
        <button
          class="toolbar-btn debug-btn"
          @click="debugTimeline"
          title="在控制台打印时间轴配置信息"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z" />
          </svg>
          调试
        </button>
      </div>
    </div>

    <div
      class="timeline-container"
      ref="timelineContainer"
      @dragover="handleDragOver"
      @drop="handleDrop"
      @click="handleTimelineClick"
    >
      <!-- 拖拽提示 -->
      <div v-if="clips.length === 0" class="drop-zone">
        <div class="drop-hint">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
          </svg>
          <p>拖拽视频文件到此处</p>
          <p class="hint">支持 MP4, WebM, AVI 等格式</p>
        </div>
      </div>
      
      <!-- 视频片段 -->
      <VideoClip
        v-for="clip in clips"
        :key="clip.id"
        :clip="clip"
        :timeline-width="timelineWidth"
        :total-duration="videoStore.totalDuration"
        @update-position="handleClipPositionUpdate"
        @update-timing="handleClipTimingUpdate"
        @remove="handleClipRemove"
      />
      
      <!-- 时间轴背景网格 -->
      <div class="timeline-grid">
        <div
          v-for="i in gridLines"
          :key="i"
          class="grid-line"
          :style="{ left: (i / videoStore.totalDuration) * timelineWidth + 'px' }"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVideoStore, type VideoClip as VideoClipType } from '../stores/counter'
import VideoClip from './VideoClip.vue'

const videoStore = useVideoStore()
const timelineContainer = ref<HTMLElement>()
const timelineWidth = ref(800)

const clips = computed(() => videoStore.clips)

// 计算重叠片段数量
const overlappingCount = computed(() => {
  return videoStore.getOverlappingClips().length
})

// 网格线
const gridLines = computed(() => {
  const lines = []
  const interval = 5 // 每5秒一条网格线
  for (let i = 0; i <= videoStore.totalDuration; i += interval) {
    lines.push(i)
  }
  return lines
})

function updateTimelineWidth() {
  if (timelineContainer.value) {
    timelineWidth.value = timelineContainer.value.clientWidth
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'copy'
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()
  
  const files = Array.from(event.dataTransfer?.files || [])
  const videoFiles = files.filter(file => file.type.startsWith('video/'))
  
  if (videoFiles.length === 0) {
    alert('请拖拽视频文件')
    return
  }
  
  // 计算拖拽位置对应的时间
  const rect = timelineContainer.value!.getBoundingClientRect()
  const dropX = event.clientX - rect.left
  const dropTime = (dropX / timelineWidth.value) * videoStore.totalDuration
  
  for (const file of videoFiles) {
    await createVideoClip(file, dropTime)
  }
}

async function createVideoClip(file: File, startTime: number): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    
    video.onloadedmetadata = () => {
      const clip: VideoClipType = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        file,
        url,
        duration: video.duration, // 初始时间轴显示时长等于原始时长
        originalDuration: video.duration,
        startTime: 0,
        endTime: video.duration,
        timelinePosition: Math.max(0, startTime),
        name: file.name,
        playbackRate: 1.0 // 初始播放速度为正常速度
      }

      videoStore.addClip(clip)
      resolve()
    }
    
    video.src = url
  })
}

function handleClipPositionUpdate(clipId: string, newPosition: number) {
  videoStore.updateClipPosition(clipId, newPosition)
}

function handleClipTimingUpdate(clipId: string, newDuration: number, timelinePosition?: number) {
  videoStore.updateClipDuration(clipId, newDuration, timelinePosition)
}

function handleClipRemove(clipId: string) {
  videoStore.removeClip(clipId)
}

function handleTimelineClick(event: MouseEvent) {
  // 点击空白区域取消选中
  if (event.target === timelineContainer.value) {
    videoStore.selectClip(null)
  }
}

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

function getSelectedClipName() {
  if (videoStore.selectedClipId) {
    const clip = videoStore.clips.find(c => c.id === videoStore.selectedClipId)
    return clip ? clip.name : ''
  }
  return ''
}

function handleKeyDown(event: KeyboardEvent) {
  // 按 Escape 键取消选中
  if (event.key === 'Escape') {
    videoStore.selectClip(null)
  }
}

function autoArrange() {
  videoStore.autoArrangeClips()
}

function debugTimeline() {
  console.group('🎬 时间轴配置调试信息')

  // 基本配置
  console.group('📊 基本配置')
  console.log('时间轴宽度 (像素):', timelineWidth.value)
  console.log('总时长 (秒):', videoStore.totalDuration)
  console.log('内容结束时间 (秒):', videoStore.contentEndTime)
  console.log('像素/秒比例:', timelineWidth.value / videoStore.totalDuration)
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
    console.log('像素位置:', Math.round((clip.timelinePosition / videoStore.totalDuration) * timelineWidth.value))
    console.log('像素宽度:', Math.round((clip.duration / videoStore.totalDuration) * timelineWidth.value))
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
      console.log('片段1范围:', `${overlap.clip1.timelinePosition.toFixed(2)}s - ${(overlap.clip1.timelinePosition + overlap.clip1.duration).toFixed(2)}s`)
      console.log('片段2:', overlap.clip2.name)
      console.log('片段2范围:', `${overlap.clip2.timelinePosition.toFixed(2)}s - ${(overlap.clip2.timelinePosition + overlap.clip2.duration).toFixed(2)}s`)

      // 计算重叠区域
      const overlapStart = Math.max(overlap.clip1.timelinePosition, overlap.clip2.timelinePosition)
      const overlapEnd = Math.min(
        overlap.clip1.timelinePosition + overlap.clip1.duration,
        overlap.clip2.timelinePosition + overlap.clip2.duration
      )
      console.log('重叠区域:', `${overlapStart.toFixed(2)}s - ${overlapEnd.toFixed(2)}s (${(overlapEnd - overlapStart).toFixed(2)}s)`)
      console.groupEnd()
    })
  } else {
    console.log('✅ 没有检测到重叠')
  }
  console.groupEnd()

  // 时间轴分析
  console.group('📈 时间轴分析')
  const totalClipDuration = clips.value.reduce((sum, clip) => sum + clip.duration, 0)
  const utilizationRate = clips.value.length > 0 ? (totalClipDuration / videoStore.contentEndTime) * 100 : 0
  const gapCount = calculateGaps().length

  console.log('片段总时长 (秒):', totalClipDuration.toFixed(2))
  console.log('时间轴利用率:', utilizationRate.toFixed(1) + '%')
  console.log('空隙数量:', gapCount)
  console.log('平均片段时长 (秒):', clips.value.length > 0 ? (totalClipDuration / clips.value.length).toFixed(2) : 0)

  // 显示空隙信息
  const gaps = calculateGaps()
  if (gaps.length > 0) {
    console.group('🕳️ 空隙详情')
    gaps.forEach((gap, index) => {
      console.log(`空隙 ${index + 1}: ${gap.start.toFixed(2)}s - ${gap.end.toFixed(2)}s (${gap.duration.toFixed(2)}s)`)
    })
    console.groupEnd()
  }
  console.groupEnd()

  // 当前播放状态
  if (videoStore.currentClip) {
    console.group('▶️ 当前播放状态')
    console.log('当前片段:', videoStore.currentClip.name)
    console.log('片段内时间:', (videoStore.currentTime - videoStore.currentClip.timelinePosition).toFixed(2) + 's')
    console.log('片段进度:', ((videoStore.currentTime - videoStore.currentClip.timelinePosition) / videoStore.currentClip.duration * 100).toFixed(1) + '%')
    console.groupEnd()
  } else {
    console.log('🔇 当前在空白区域')
  }

  console.groupEnd()
}

// 计算空隙
function calculateGaps() {
  if (clips.value.length === 0) return []

  const sortedClips = [...clips.value].sort((a, b) => a.timelinePosition - b.timelinePosition)
  const gaps = []

  // 开始到第一个片段的空隙
  if (sortedClips[0].timelinePosition > 0) {
    gaps.push({
      start: 0,
      end: sortedClips[0].timelinePosition,
      duration: sortedClips[0].timelinePosition
    })
  }

  // 片段之间的空隙
  for (let i = 0; i < sortedClips.length - 1; i++) {
    const currentEnd = sortedClips[i].timelinePosition + sortedClips[i].duration
    const nextStart = sortedClips[i + 1].timelinePosition

    if (nextStart > currentEnd) {
      gaps.push({
        start: currentEnd,
        end: nextStart,
        duration: nextStart - currentEnd
      })
    }
  }

  return gaps
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

onMounted(() => {
  updateTimelineWidth()
  window.addEventListener('resize', updateTimelineWidth)
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateTimelineWidth)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.timeline {
  flex: 1;
  background-color: #2a2a2a;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.timeline-toolbar {
  background-color: #333;
  padding: 8px 12px;
  border-bottom: 1px solid #444;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
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

.timeline-container {
  width: 100%;
  flex: 1;
  position: relative;
  min-height: 120px;
}

.drop-zone {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #555;
  border-radius: 4px;
  margin: 10px;
}

.drop-hint {
  text-align: center;
  color: #888;
}

.drop-hint svg {
  margin-bottom: 12px;
  opacity: 0.6;
}

.drop-hint p {
  margin: 4px 0;
}

.hint {
  font-size: 14px;
  opacity: 0.7;
}

.timeline-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background-color: #444;
  opacity: 0.5;
}
</style>

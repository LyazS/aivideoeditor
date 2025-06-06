<template>
  <div class="properties-panel">
    <div class="panel-header">
      <h3>属性</h3>
    </div>

    <div class="panel-content">
      <div v-if="!selectedClip" class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,16.5L18,9.5L16.5,8L11,13.5L7.5,10L6,11.5L11,16.5Z" />
        </svg>
        <p>选择片段查看属性</p>
        <p class="hint">在时间轴上点击视频片段</p>
      </div>

      <div v-else class="properties-content">
        <!-- 基本信息 -->
        <div class="property-section">
          <h4>基本信息</h4>
          <div class="property-item">
            <label>名称</label>
            <input 
              v-model="clipName" 
              @blur="updateClipName"
              @keyup.enter="updateClipName"
              class="property-input"
            />
          </div>
          <div class="property-item">
            <label>时长</label>
            <span class="property-value">{{ formatDuration(selectedClip.duration) }}</span>
          </div>
          <div class="property-item">
            <label>位置</label>
            <span class="property-value">{{ formatDuration(selectedClip.timelinePosition) }}</span>
          </div>
        </div>

        <!-- 播放设置 -->
        <div class="property-section">
          <h4>播放设置</h4>
          <div class="property-item">
            <label>播放速度</label>
            <div class="speed-controls">
              <input 
                v-model.number="playbackRate" 
                @input="updatePlaybackRate"
                type="range"
                min="0.25"
                max="4"
                step="0.25"
                class="speed-slider"
              />
              <span class="speed-value">{{ playbackRate }}x</span>
            </div>
          </div>
        </div>

        <!-- 时间范围 -->
        <div class="property-section">
          <h4>时间范围</h4>
          <div class="property-item">
            <label>开始时间</label>
            <span class="property-value">{{ formatDuration(selectedClip.startTime) }}</span>
          </div>
          <div class="property-item">
            <label>结束时间</label>
            <span class="property-value">{{ formatDuration(selectedClip.endTime) }}</span>
          </div>
          <div class="property-item">
            <label>原始时长</label>
            <span class="property-value">{{ formatDuration(selectedClip.originalDuration) }}</span>
          </div>
        </div>

        <!-- 文件信息 -->
        <div class="property-section">
          <h4>文件信息</h4>
          <div class="property-item">
            <label>文件名</label>
            <span class="property-value" :title="selectedClip.file.name">
              {{ selectedClip.file.name }}
            </span>
          </div>
          <div class="property-item">
            <label>文件大小</label>
            <span class="property-value">{{ formatFileSize(selectedClip.file.size) }}</span>
          </div>
          <div class="property-item">
            <label>文件类型</label>
            <span class="property-value">{{ selectedClip.file.type }}</span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="property-section">
          <h4>操作</h4>
          <div class="action-buttons">
            <button class="action-btn danger" @click="removeClip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
              </svg>
              删除片段
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useVideoStore } from '../stores/counter'

const videoStore = useVideoStore()

// 选中的片段
const selectedClip = computed(() => {
  if (!videoStore.selectedClipId) return null
  return videoStore.clips.find(clip => clip.id === videoStore.selectedClipId) || null
})

// 可编辑的属性
const clipName = ref('')
const playbackRate = ref(1)

// 监听选中片段变化，更新本地状态
watch(selectedClip, (newClip) => {
  if (newClip) {
    clipName.value = newClip.name
    playbackRate.value = newClip.playbackRate || 1
  } else {
    clipName.value = ''
    playbackRate.value = 1
  }
}, { immediate: true })

// 更新片段名称
const updateClipName = () => {
  if (selectedClip.value && clipName.value.trim()) {
    videoStore.updateClipName(selectedClip.value.id, clipName.value.trim())
  }
}

// 更新播放速度
const updatePlaybackRate = () => {
  if (selectedClip.value) {
    videoStore.updateClipPlaybackRate(selectedClip.value.id, playbackRate.value)
  }
}

// 删除片段
const removeClip = () => {
  if (selectedClip.value) {
    if (confirm('确定要删除这个视频片段吗？')) {
      videoStore.removeClip(selectedClip.value.id)
    }
  }
}

// 格式化时长
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
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
.properties-panel {
  width: 100%;
  height: 100%;
  background-color: #2a2a2a;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  padding: 12px 16px;
  background-color: #333;
  border-bottom: 1px solid #555;
  flex-shrink: 0;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  color: #fff;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #888;
  text-align: center;
  padding: 20px;
}

.empty-state svg {
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-state p {
  margin: 4px 0;
}

.hint {
  font-size: 12px;
  opacity: 0.7;
}

.properties-content {
  padding: 16px;
}

.property-section {
  margin-bottom: 20px;
}

.property-section h4 {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: #ccc;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #444;
  padding-bottom: 4px;
}

.property-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
}

.property-item label {
  font-size: 12px;
  color: #aaa;
  flex-shrink: 0;
  min-width: 60px;
}

.property-value {
  font-size: 12px;
  color: #fff;
  text-align: right;
  word-break: break-all;
  flex: 1;
}

.property-input {
  background: #444;
  border: 1px solid #666;
  border-radius: 3px;
  color: #fff;
  font-size: 12px;
  padding: 4px 6px;
  flex: 1;
  min-width: 0;
}

.property-input:focus {
  outline: none;
  border-color: #4CAF50;
}

.speed-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.speed-slider {
  flex: 1;
  height: 4px;
  background: #444;
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
}

.speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: #4CAF50;
  border-radius: 50%;
  cursor: pointer;
}

.speed-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #4CAF50;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.speed-value {
  font-size: 11px;
  color: #fff;
  min-width: 30px;
  text-align: right;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  background: #555;
  border: none;
  border-radius: 4px;
  color: white;
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background: #666;
}

.action-btn.danger {
  background: #f44336;
}

.action-btn.danger:hover {
  background: #d32f2f;
}
</style>

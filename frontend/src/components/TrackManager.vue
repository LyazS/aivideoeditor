<template>
  <div class="track-manager">
    <div class="track-header">
      <h3>轨道</h3>
      <button class="add-track-btn" @click="addNewTrack" title="添加新轨道">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
        </svg>
      </button>
    </div>

    <div class="tracks-list">
      <div
        v-for="track in tracks"
        :key="track.id"
        class="track-item"
        :style="{ height: track.height + 'px' }"
      >
        <div class="track-controls">
          <!-- 轨道名称 -->
          <div class="track-name">
            <input
              v-if="editingTrackId === track.id"
              v-model="editingTrackName"
              @blur="finishRename"
              @keyup.enter="finishRename"
              @keyup.escape="cancelRename"
              class="track-name-input"
              ref="nameInput"
            />
            <span
              v-else
              @dblclick="startRename(track)"
              class="track-name-text"
              :title="'双击编辑轨道名称'"
            >
              {{ track.name }}
            </span>
          </div>

          <!-- 控制按钮 -->
          <div class="track-buttons">
            <!-- 可见性切换 -->
            <button
              class="track-btn"
              :class="{ active: track.isVisible }"
              @click="toggleVisibility(track.id)"
              :title="track.isVisible ? '隐藏轨道' : '显示轨道'"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path
                  v-if="track.isVisible"
                  d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"
                />
                <path
                  v-else
                  d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.09L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.76,7.13 11.37,7 12,7Z"
                />
              </svg>
            </button>

            <!-- 静音切换 -->
            <button
              class="track-btn"
              :class="{ active: !track.isMuted }"
              @click="toggleMute(track.id)"
              :title="track.isMuted ? '取消静音' : '静音'"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path
                  v-if="!track.isMuted"
                  d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"
                />
                <path
                  v-else
                  d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z"
                />
              </svg>
            </button>

            <!-- 删除轨道 -->
            <button
              v-if="tracks.length > 1"
              class="track-btn delete-btn"
              @click="removeTrack(track.id)"
              title="删除轨道"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useVideoStore } from '../stores/videostore'

const videoStore = useVideoStore()

const tracks = computed(() => videoStore.tracks)

// 编辑轨道名称相关
const editingTrackId = ref<number | null>(null)
const editingTrackName = ref('')
const nameInput = ref<HTMLInputElement>()

function addNewTrack() {
  videoStore.addTrack()
}

function removeTrack(trackId: number) {
  if (tracks.value.length <= 1) {
    alert('至少需要保留一个轨道')
    return
  }

  if (confirm('确定要删除这个轨道吗？轨道上的所有片段将移动到第一个轨道。')) {
    videoStore.removeTrack(trackId)
  }
}

function toggleVisibility(trackId: number) {
  videoStore.toggleTrackVisibility(trackId)
}

function toggleMute(trackId: number) {
  videoStore.toggleTrackMute(trackId)
}

async function startRename(track: { id: number; name: string }) {
  editingTrackId.value = track.id
  editingTrackName.value = track.name
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

function finishRename() {
  if (editingTrackId.value && editingTrackName.value.trim()) {
    videoStore.renameTrack(editingTrackId.value, editingTrackName.value.trim())
  }
  editingTrackId.value = null
  editingTrackName.value = ''
}

function cancelRename() {
  editingTrackId.value = null
  editingTrackName.value = ''
}
</script>

<style scoped>
.track-manager {
  width: 200px;
  background-color: #333;
  border-right: 1px solid #555;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.track-header {
  padding: 12px;
  border-bottom: 1px solid #555;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #2a2a2a;
}

.track-header h3 {
  margin: 0;
  font-size: 14px;
  color: #fff;
}

.add-track-btn {
  background: #4caf50;
  border: none;
  border-radius: 4px;
  color: white;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.add-track-btn:hover {
  background: #45a049;
}

.tracks-list {
  flex: 1;
  overflow-y: auto;
}

.track-item {
  border-bottom: 1px solid #555;
  display: flex;
  align-items: center;
  padding: 0;
  min-height: 80px;
}

.track-controls {
  width: 100%;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.track-name {
  flex: 1;
}

.track-name-text {
  font-size: 12px;
  color: #fff;
  cursor: pointer;
  display: block;
  padding: 2px 4px;
  border-radius: 2px;
  transition: background-color 0.2s;
}

.track-name-text:hover {
  background-color: #444;
}

.track-name-input {
  background: #444;
  border: 1px solid #666;
  border-radius: 2px;
  color: #fff;
  font-size: 12px;
  padding: 2px 4px;
  width: 100%;
}

.track-buttons {
  display: flex;
  gap: 4px;
  justify-content: flex-start;
}

.track-btn {
  background: #555;
  border: none;
  border-radius: 3px;
  color: #ccc;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  width: 24px;
  height: 24px;
}

.track-btn:hover {
  background: #666;
  color: #fff;
}

.track-btn.active {
  background: #4caf50;
  color: #fff;
}

.track-btn.delete-btn {
  background: #f44336;
}

.track-btn.delete-btn:hover {
  background: #d32f2f;
}
</style>

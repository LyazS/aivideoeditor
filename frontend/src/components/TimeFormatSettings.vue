<template>
  <div class="time-format-settings">
    <div class="settings-header">
      <h4>时间显示设置</h4>
    </div>
    
    <div class="settings-content">
      <!-- 时间格式选择 -->
      <div class="setting-item">
        <label>时间格式:</label>
        <select v-model="selectedTimeFormat" @change="handleTimeFormatChange" class="format-select">
          <option value="timecode">时间码 (00:30.15)</option>
          <option value="seconds">秒 (30.5s)</option>
          <option value="milliseconds">毫秒 (00:30.50)</option>
          <option value="frames">帧 (00:30:15)</option>
        </select>
      </div>

      <!-- 帧率设置 -->
      <div class="setting-item">
        <label>帧率:</label>
        <select v-model="selectedFrameRate" @change="handleFrameRateChange" class="format-select">
          <option value="24">24 fps</option>
          <option value="25">25 fps</option>
          <option value="30">30 fps</option>
          <option value="60">60 fps</option>
        </select>
      </div>

      <!-- 时间码显示选项 -->
      <div v-if="selectedTimeFormat === 'timecode'" class="setting-item">
        <label>
          <input 
            type="checkbox" 
            v-model="showHours" 
            @change="handleShowHoursChange"
          />
          始终显示小时
        </label>
      </div>

      <!-- 预览 -->
      <div class="setting-item">
        <label>预览:</label>
        <div class="preview-container">
          <TimecodeDisplay 
            :value="previewTimeMicroseconds" 
            :frame-rate="selectedFrameRate"
            :show-milliseconds="selectedTimeFormat === 'milliseconds'"
            size="normal"
          />
          <span class="preview-label">当前时间</span>
        </div>
      </div>

      <!-- 应用按钮 -->
      <div class="setting-actions">
        <button @click="applySettings" class="apply-btn">
          应用设置
        </button>
        <button @click="resetToDefaults" class="reset-btn">
          重置默认
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import TimecodeDisplay from './TimecodeDisplay.vue'

interface Emits {
  (e: 'settingsChanged', settings: TimeFormatSettings): void
}

interface TimeFormatSettings {
  timeFormat: 'timecode' | 'seconds' | 'milliseconds' | 'frames'
  frameRate: number
  showHours: boolean
}

const emit = defineEmits<Emits>()
const videoStore = useVideoStore()

// 设置状态
const selectedTimeFormat = ref<'timecode' | 'seconds' | 'milliseconds' | 'frames'>('timecode')
const selectedFrameRate = ref(30)
const showHours = ref(false)

// 预览时间（当前播放时间）
const previewTimeMicroseconds = computed(() => {
  return Math.round(videoStore.currentTime * 1000000)
})

// 处理时间格式变化
const handleTimeFormatChange = () => {
  console.log('时间格式变化:', selectedTimeFormat.value)
}

// 处理帧率变化
const handleFrameRateChange = () => {
  console.log('帧率变化:', selectedFrameRate.value)
  // 更新videoStore的帧率
  videoStore.setFrameRate(selectedFrameRate.value)
}

// 处理小时显示变化
const handleShowHoursChange = () => {
  console.log('小时显示变化:', showHours.value)
}

// 应用设置
const applySettings = () => {
  const settings: TimeFormatSettings = {
    timeFormat: selectedTimeFormat.value,
    frameRate: selectedFrameRate.value,
    showHours: showHours.value
  }
  
  // 更新videoStore的帧率
  videoStore.setFrameRate(selectedFrameRate.value)
  
  // 发送设置变化事件
  emit('settingsChanged', settings)
  
  // 保存到localStorage
  localStorage.setItem('timeFormatSettings', JSON.stringify(settings))
  
  console.log('✅ 时间格式设置已应用:', settings)
}

// 重置为默认设置
const resetToDefaults = () => {
  selectedTimeFormat.value = 'timecode'
  selectedFrameRate.value = 30
  showHours.value = false
  
  applySettings()
  
  console.log('✅ 时间格式设置已重置为默认值')
}

// 从localStorage加载设置
const loadSettings = () => {
  try {
    const saved = localStorage.getItem('timeFormatSettings')
    if (saved) {
      const settings: TimeFormatSettings = JSON.parse(saved)
      selectedTimeFormat.value = settings.timeFormat
      selectedFrameRate.value = settings.frameRate
      showHours.value = settings.showHours
      
      // 应用帧率设置
      videoStore.setFrameRate(settings.frameRate)
      
      console.log('✅ 已加载保存的时间格式设置:', settings)
    }
  } catch (error) {
    console.warn('加载时间格式设置失败，使用默认值:', error)
    resetToDefaults()
  }
}

// 组件挂载时加载设置
onMounted(() => {
  loadSettings()
})

// 暴露方法给父组件
defineExpose({
  applySettings,
  resetToDefaults,
  getCurrentSettings: () => ({
    timeFormat: selectedTimeFormat.value,
    frameRate: selectedFrameRate.value,
    showHours: showHours.value
  })
})
</script>

<style scoped>
.time-format-settings {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--color-border-primary);
  overflow: hidden;
}

.settings-header {
  background: var(--color-bg-tertiary);
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-primary);
}

.settings-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.settings-content {
  padding: 16px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-item label {
  font-size: 13px;
  color: var(--color-text-secondary);
  min-width: 60px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.format-select {
  background: var(--color-bg-quaternary);
  border: 1px solid var(--color-border-secondary);
  border-radius: 4px;
  color: var(--color-text-primary);
  font-size: 13px;
  padding: 4px 8px;
  min-width: 140px;
  cursor: pointer;
}

.format-select:focus {
  outline: none;
  border-color: var(--color-accent-primary);
}

.preview-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-label {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.setting-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-secondary);
}

.apply-btn,
.reset-btn {
  flex: 1;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.apply-btn {
  background: var(--color-accent-primary);
  color: white;
  border: none;
}

.apply-btn:hover {
  background: var(--color-accent-primary-hover);
}

.reset-btn {
  background: var(--color-bg-quaternary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-secondary);
}

.reset-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

/* 复选框样式 */
input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
}

/* 深色主题支持 */
@media (prefers-color-scheme: dark) {
  .time-format-settings {
    background: #2d2d2d;
    border-color: #555;
  }
  
  .settings-header {
    background: #3d3d3d;
    border-color: #555;
  }
  
  .format-select {
    background: #3d3d3d;
    border-color: #555;
    color: #fff;
  }
}
</style>

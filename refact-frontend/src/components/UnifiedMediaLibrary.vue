<template>
  <div class="media-library">
    <div class="library-header">
      <div class="header-left">
        <!-- Tab 切换 -->
        <div class="tab-list">
          <button
            v-for="tab in tabs"
            :key="tab.type"
            class="tab-button"
            :class="{ active: activeTab === tab.type }"
            @click="setActiveTab(tab.type)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path :d="tab.icon" />
            </svg>
            <span>{{ tab.label }}</span>
            <span class="tab-count">({{ getTabCount(tab.type) }})</span>
          </button>
        </div>
      </div>
      <div class="header-buttons">
        <HoverButton @click="showImportMenu" title="导入文件">
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
            </svg>
          </template>
        </HoverButton>
      </div>
    </div>

    <!-- 拖拽区域 - 空状态 -->
    <div class="drop-zone">
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"
          />
        </svg>
        <p>拖拽文件到此处导入</p>
        <p class="hint">支持 MP4, WebM, AVI 等视频格式、JPG, PNG, GIF 等图片格式和 MP3, WAV, M4A 等音频格式</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import HoverButton from './HoverButton.vue'

// 空壳状态数据
const activeTab = ref('all')
const tabs = ref([
  {
    type: 'all',
    label: '全部',
    icon: 'M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z'
  },
  {
    type: 'video',
    label: '视频',
    icon: 'M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z'
  },
  {
    type: 'audio',
    label: '音频',
    icon: 'M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z'
  },
  {
    type: 'image',
    label: '图片',
    icon: 'M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z'
  }
])

// 空壳方法 - 不执行任何实际操作
const setActiveTab = (type: string) => {
  activeTab.value = type
}

const getTabCount = (type: string) => {
  return 0 // 空状态返回0
}

const showImportMenu = () => {
  // 空壳方法，不执行任何操作
  console.log('Import menu clicked (empty shell)')
}
</script>

<style scoped>
/* 复用原有样式，这里只是占位 */
.media-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  overflow: hidden;
}

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border-primary);
}

.tab-list {
  display: flex;
  gap: 4px;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-soft);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-button:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.tab-button.active {
  background: var(--color-accent-primary);
  color: white;
}

.tab-count {
  font-size: 11px;
  opacity: 0.8;
}

.drop-zone {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.empty-state {
  text-align: center;
  color: var(--color-text-soft);
}

.empty-state svg {
  opacity: 0.3;
  margin-bottom: 16px;
}

.empty-state p {
  margin: 8px 0;
  font-size: 14px;
}

.empty-state .hint {
  font-size: 12px;
  opacity: 0.7;
  max-width: 300px;
  line-height: 1.4;
}
</style>

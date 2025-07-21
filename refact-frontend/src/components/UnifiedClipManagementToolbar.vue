<template>
  <!-- 工具栏 -->
  <div class="clip-management-toolbar">
    <!-- 历史管理工具栏 -->
    <div class="toolbar-section">
      <HoverButton @click="undo" :disabled="true" title="撤销上一个操作 (Ctrl+Z)">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z"
            />
          </svg>
        </template>
        撤销
      </HoverButton>
      <HoverButton @click="redo" :disabled="true" title="重做下一个操作 (Ctrl+Y)">
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

    <!-- 片段操作工具栏 -->
    <div class="toolbar-section">
      <HoverButton
        :disabled="true"
        @click="splitSelectedClip"
        title="裁剪选中的片段"
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
        :disabled="true"
        @click="deleteSelectedClip"
        title="删除选中的片段"
      >
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
          </svg>
        </template>
        删除
      </HoverButton>

      <HoverButton
        :disabled="true"
        @click="copySelectedClip"
        title="复制选中的片段"
      >
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" />
          </svg>
        </template>
        复制
      </HoverButton>
    </div>

    <!-- 对齐和排列工具 -->
    <div class="toolbar-section">
      <HoverButton
        :disabled="true"
        @click="alignToGrid"
        title="对齐到网格"
      >
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3,11H5V13H3V11M7,11H9V13H7V11M11,11H13V13H11V11M15,11H17V13H15V11M19,11H21V13H19V11M3,7H5V9H3V7M7,7H9V9H7V7M11,7H13V9H11V7M15,7H17V9H15V7M19,7H21V9H19V7M3,15H5V17H3V15M7,15H9V17H7V15M11,15H13V17H11V15M15,15H17V17H15V15M19,15H21V17H19V15Z" />
          </svg>
        </template>
        对齐
      </HoverButton>

      <HoverButton
        :disabled="true"
        @click="snapToTimeline"
        title="吸附到时间轴"
      >
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16,12A2,2 0 0,1 18,10A2,2 0 0,1 20,12A2,2 0 0,1 18,14A2,2 0 0,1 16,12M10,12A2,2 0 0,1 12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12M4,12A2,2 0 0,1 6,10A2,2 0 0,1 8,12A2,2 0 0,1 6,14A2,2 0 0,1 4,12Z" />
          </svg>
        </template>
        吸附
      </HoverButton>
    </div>

    <!-- 状态信息 -->
    <div class="toolbar-info">
      <span class="info-text">选中: 0 个片段</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import HoverButton from './HoverButton.vue'

// 空壳方法 - 不执行实际操作
const undo = () => {
  console.log('Undo (empty shell)')
}

const redo = () => {
  console.log('Redo (empty shell)')
}

const splitSelectedClip = () => {
  console.log('Split clip (empty shell)')
}

const deleteSelectedClip = () => {
  console.log('Delete clip (empty shell)')
}

const copySelectedClip = () => {
  console.log('Copy clip (empty shell)')
}

const alignToGrid = () => {
  console.log('Align to grid (empty shell)')
}

const snapToTimeline = () => {
  console.log('Snap to timeline (empty shell)')
}
</script>

<style scoped>
.clip-management-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-primary);
  height: 40px;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 16px;
  border-right: 1px solid var(--color-border-primary);
}

.toolbar-section:last-of-type {
  border-right: none;
  padding-right: 0;
}

.toolbar-info {
  margin-left: auto;
  display: flex;
  align-items: center;
}

.info-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--color-border-primary);
}
</style>

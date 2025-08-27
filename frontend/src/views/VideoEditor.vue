<template>
  <div class="video-editor-view">
    <!-- 状态栏 -->
    <div
      class="status-bar-container"
      :class="{ 'loading-hidden': unifiedStore.showProjectLoadingProgress }"
    >
      <div class="status-bar">
        <div class="status-content">
          <!-- 左侧：返回按钮和保存状态 -->
          <div class="status-left">
            <HoverButton @click="goBack" title="返回项目管理">
              <template #icon>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"
                  />
                </svg>
              </template>
              返回
            </HoverButton>
            <span class="project-status">{{ projectStatus }}</span>
          </div>

          <!-- 中间：项目名称 -->
          <div class="status-center">
            <button
              class="project-title-btn"
              @click="showEditProjectDialog"
              title="点击编辑项目信息"
            >
              <span class="project-title">{{ projectTitle }}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="edit-icon">
                <path
                  d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"
                />
              </svg>
            </button>
          </div>

          <!-- 右侧：保存和导出按钮 -->
          <div class="status-right">
            <HoverButton @click="saveProject" :disabled="isSaving" title="保存项目">
              <template #icon>
                <svg
                  v-if="!isSaving"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z"
                  />
                </svg>
                <svg
                  v-else
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  class="spinning"
                >
                  <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
                </svg>
              </template>
              {{ isSaving ? '保存中...' : '保存' }}
            </HoverButton>

            <HoverButton @click="exportProject" title="导出项目">
              <template #icon>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"
                  />
                </svg>
              </template>
              导出
            </HoverButton>

            <!-- <HoverButton @click="debugProject" title="调试：打印项目JSON">
              <template #icon>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M20,19V7H4V19H20M20,3A2,2 0 0,1 22,5V19A2,2 0 0,1 20,21H4A2,2 0 0,1 2,19V5A2,2 0 0,1 4,3H20M13,17V15H18V17H13M9.58,13L5.57,9H8.4L11.7,12.3C12.09,12.69 12.09,13.33 11.7,13.72L8.42,17H5.59L9.58,13Z"
                  />
                </svg>
              </template>
              调试
            </HoverButton> -->
          </div>
        </div>
      </div>
    </div>

    <!-- 视频编辑器主体 -->
    <div
      class="editor-content"
      :class="{ 'loading-hidden': unifiedStore.showProjectLoadingProgress }"
    >
      <VideoPreviewEngine />
    </div>

    <!-- 加载进度覆盖层 -->
    <LoadingOverlay
      :visible="unifiedStore.showProjectLoadingProgress"
      :stage="unifiedStore.projectLoadingStage"
      :progress="unifiedStore.projectLoadingProgress"
      :details="unifiedStore.projectLoadingDetails"
    />

    <!-- 编辑项目对话框 -->
    <!-- <EditProjectDialog
      v-model:show="showEditDialog"
      :project="currentProject"
      :is-saving="isSaving"
      @save="handleSaveProject"
    /> -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeMount, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUnifiedStore } from '@/unified/unifiedStore'
import VideoPreviewEngine from '../components/VideoPreviewEngine.vue'
import HoverButton from '../components/HoverButton.vue'
import LoadingOverlay from '../components/LoadingOverlay.vue'
import EditProjectDialog from '../components/EditProjectDialog.vue'
import { exportProject as exportProjectUtil } from '@/unified/utils/projectExporter'

const route = useRoute()
const unifiedStore = useUnifiedStore()

// 响应式数据
const projectTitle = ref('未命名项目')
const showEditDialog = ref(false)

// 计算属性 - 使用store中的项目状态（适配新的API）
const projectStatus = computed(() => unifiedStore.projectStatus)
const isSaving = computed(() => unifiedStore.isProjectSaving)

// 方法
function goBack() {
  // 如果有未保存的更改，可以在这里添加确认对话框
  // 使用 window.location.href 直接跳转，彻底重新加载页面
  // 这样可以确保所有store状态都被重新创建，避免数据混合问题
  console.log('🔙 使用页面重载方式返回项目管理')
  window.location.href = '/'
}

async function saveProject() {
  if (isSaving.value) return

  try {
    const success = await unifiedStore.manualSave()
    if (success) {
      console.log('项目已手动保存')
      // 可以添加成功提示
    } else {
      console.warn('手动保存失败')
      // 可以添加失败提示
    }
  } catch (error) {
    console.error('保存项目失败:', error)
    // 可以添加错误提示
  }
}

async function exportProject() {
  try {
    await exportProjectUtil({
      videoWidth: unifiedStore.videoResolution.width,
      videoHeight: unifiedStore.videoResolution.height,
      projectName: unifiedStore.projectName,
      timelineItems: unifiedStore.timelineItems,
      tracks: unifiedStore.tracks
    })
  } catch (error) {
    console.error('导出项目失败:', error)
  }
}

// 显示编辑项目对话框
function showEditProjectDialog() {
  showEditDialog.value = true
}

// 处理保存项目编辑
async function handleSaveProject() {
  try {
    // 更新项目信息
    await unifiedStore.saveCurrentProject()
    // 关闭对话框
    showEditDialog.value = false
    console.log('项目信息更新成功:', unifiedStore.projectName)
  } catch (error) {
    console.error('更新项目信息失败:', error)
    // 可以添加错误提示
  }
}

function debugProject() {}
// 键盘快捷键
function handleKeydown(event: KeyboardEvent) {
  // Ctrl+S 保存
  if (event.ctrlKey && event.key === 's') {
    event.preventDefault()
    saveProject()
  }

  // Ctrl+E 导出
  if (event.ctrlKey && event.key === 'e') {
    event.preventDefault()
    exportProject()
  }

  // Ctrl+D 调试
  if (event.ctrlKey && event.key === 'd') {
    event.preventDefault()
    debugProject()
  }
}

// 生命周期
// 预加载项目设置（在所有子组件挂载前完成，确保WebAV初始化时使用正确的分辨率）
onBeforeMount(async () => {
  console.log('� [LIFECYCLE] VideoEditor.onBeforeMount 开始')

  // 从路由参数获取项目ID
  const projectId = route.params.projectId as string
  if (!projectId) {
    console.error('❌ [LIFECYCLE] VideoEditor 缺少项目ID参数')
    // 返回根目录
    window.location.href = '/'
  }

  try {
    console.log('� [LIFECYCLE] VideoEditor 开始预加载项目设置')
    await unifiedStore.preloadProjectSettings(projectId)
    console.log('🔄 [LIFECYCLE] VideoEditor 项目设置预加载完成')
  } catch (error) {
    // 对于现有项目，预加载失败是严重错误，需要通知用户
    console.error('🔄 [LIFECYCLE] VideoEditor 预加载项目设置失败:', error)
    // 跳转到项目管理页面
    window.location.href = '/'
  }
  console.log('🔄 [LIFECYCLE] VideoEditor.onBeforeMount 完成')
})

onMounted(async () => {
  console.log('� [LIFECYCLE] VideoEditor.onMounted 开始')

  // 从路由参数获取项目ID
  const projectId = route.params.projectId as string
  if (!projectId) {
    console.error('❌ [LIFECYCLE] VideoEditor 缺少项目ID参数')
    // 返回根目录
    window.location.href = '/'
  }

  // 加载项目内容
  try {
    unifiedStore.disableAutoSave()
    console.log('📂 [VideoEditor] 开始加载项目内容...')
    await unifiedStore.loadProjectContent(projectId)

    console.log('✅ [VideoEditor] 项目内容加载完成:', unifiedStore.projectName)
    // 启用自动保存（模块化版本）
    unifiedStore.enableAutoSave()
    console.log('✅ [VideoEditor] 自动保存已启用')
  } catch (error) {
    console.error('❌ [VideoEditor] 加载项目内容失败:', error)
    // 跳转到项目管理页面
    window.location.href = '/'
  }

  // 注册键盘快捷键
  window.addEventListener('keydown', handleKeydown)
  console.log('🔄 [LIFECYCLE] VideoEditor.onMounted 完成')
})

onUnmounted(() => {
  // 禁用自动保存（模块化版本）
  unifiedStore.disableAutoSave()
  // 清理键盘快捷键
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.video-editor-view {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.status-bar-container {
  padding: var(--spacing-sm) var(--spacing-sm) 0 var(--spacing-sm);
  flex-shrink: 0;
}

.status-bar {
  height: 30px;
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-medium);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0 var(--spacing-lg);
}

.status-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  position: relative; /* 为中间区域的绝对定位提供参考 */
}

.status-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 0 0 200px; /* 固定左侧宽度 */
}

.status-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  position: absolute;
  left: 50%;
  transform: translateX(-50%); /* 绝对居中 */
}

.status-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 0 0 200px; /* 固定右侧宽度，与左侧对称 */
  justify-content: flex-end;
}

/* 旧的按钮样式已移除，现在使用 HoverButton 组件 */

.project-title-btn {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--border-radius-medium);
  transition: all 0.2s ease;
  color: var(--color-text-primary);
}

.project-title-btn:hover {
  background: var(--color-bg-hover);
}

.project-title-btn:hover .edit-icon {
  opacity: 1;
}

.project-title {
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
  font-weight: 600;
}

.edit-icon {
  opacity: 0.6;
  transition: opacity 0.2s ease;
  color: var(--color-text-secondary);
}

.project-status {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.editor-content {
  flex: 1;
  overflow: hidden;
  transition: opacity 0.3s ease;
}

.status-bar-container.loading-hidden,
.editor-content.loading-hidden {
  opacity: 0;
  pointer-events: none;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

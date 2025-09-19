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
            <HoverButton @click="goBack" :title="t('editor.backToProject')">
              <template #icon>
                <RemixIcon name="arrow-left-line" size="lg" />
              </template>
              {{ t('editor.back') }}
            </HoverButton>
            <span class="project-status">{{ projectStatus }}</span>
          </div>

          <!-- 中间：项目名称 -->
          <div class="status-center">
            <button
              class="project-title-btn"
              @click="showEditProjectDialog"
              :title="t('editor.editProjectInfo')"
            >
              <span class="project-title">{{
                unifiedStore.projectName || t('editor.untitledProject')
              }}</span>
              <RemixIcon name="edit-line" size="lg" class="edit-icon" />
            </button>
          </div>

          <!-- 右侧：保存和导出按钮 -->
          <div class="status-right">
            <LanguageSelector />

            <HoverButton @click="saveProject" :disabled="isSaving" :title="t('editor.save')">
              <template #icon>
                <RemixIcon
                  v-if="!isSaving"
                  name="save-line"
                  size="lg"
                />
                <RemixIcon
                  v-else
                  name="loader-4-line"
                  size="lg"
                  spin
                  class="spinning"
                />
              </template>
              {{ isSaving ? t('editor.saving') : t('editor.save') }}
            </HoverButton>

            <HoverButton @click="exportProject" :title="t('editor.export')">
              <template #icon>
                <RemixIcon name="download-line" size="lg" />
              </template>
              {{ t('editor.export') }}
            </HoverButton>

            <!-- <HoverButton @click="debugProject" title="调试：打印项目JSON">
              <template #icon>
                <RemixIcon name="tools-line" size="lg" />
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
      :title="t('editor.loading')"
      :stage="unifiedStore.projectLoadingStage"
      :progress="unifiedStore.projectLoadingProgress"
      :details="unifiedStore.projectLoadingDetails"
      :tipText="t('editor.loadTip')"
      :showTitle="true"
      :showStage="true"
      :showProgress="true"
      :showDetails="true"
      :showTips="true"
    />

    <!-- 导出进度覆盖层 -->
    <LoadingOverlay
      :visible="showExportProgress"
      :title="t('editor.exporting')"
      :progress="exportProgress"
      :details="exportDetails"
      :tipText="t('editor.exportTip')"
      :showTitle="true"
      :showStage="false"
      :showProgress="true"
      :showDetails="true"
      :showTips="true"
    />

    <!-- 编辑项目对话框 -->
    <EditProjectDialog
      v-model:show="showEditDialog"
      :project="currentProject"
      :is-saving="isSaving"
      @save="handleSaveProject"
    />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeMount, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useUnifiedStore } from '@/unified/unifiedStore'
import VideoPreviewEngine from '@/components/VideoPreviewEngine.vue'
import HoverButton from '@/components/HoverButton.vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import EditProjectDialog from '@/components/EditProjectDialog.vue'
import LanguageSelector from '@/components/LanguageSelector.vue'
import RemixIcon from '@/components/icons/RemixIcon.vue'
import { exportProject as exportProjectUtil } from '@/unified/utils/projectExporter'
import { useAppI18n } from '@/unified/composables/useI18n'

const route = useRoute()
const unifiedStore = useUnifiedStore()
const { t, initLanguage } = useAppI18n()

// 响应式数据
const showEditDialog = ref(false)

// 导出进度状态（本地管理，替代使用单独模块）
const isExporting = ref(false)
const exportProgress = ref(0)
const exportDetails = ref('')

// 计算属性：是否显示导出进度
const showExportProgress = computed(() => isExporting.value && exportProgress.value >= 0)

// 计算属性 - 使用store中的项目状态（适配新的API）
const projectStatus = computed(() => unifiedStore.projectStatus)
const isSaving = computed(() => unifiedStore.isProjectSaving)

// 当前项目配置对象（用于编辑对话框）
const currentProject = computed(() => {
  return {
    id: unifiedStore.projectId,
    name: unifiedStore.projectName,
    description: unifiedStore.projectDescription,
    createdAt: unifiedStore.projectCreatedAt,
    updatedAt: unifiedStore.projectUpdatedAt,
    version: unifiedStore.projectVersion,
    thumbnail: unifiedStore.projectThumbnail || undefined,
    duration: 0, // 未使用
    settings: {
      videoResolution: unifiedStore.videoResolution,
      frameRate: unifiedStore.frameRate,
      timelineDurationFrames: unifiedStore.timelineDurationFrames,
    },
  }
})

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
    // 开始导出
    isExporting.value = true
    exportProgress.value = 0
    exportDetails.value = ''

    // 执行导出，传入进度回调
    await exportProjectUtil({
      videoWidth: unifiedStore.videoResolution.width,
      videoHeight: unifiedStore.videoResolution.height,
      projectName: unifiedStore.projectName,
      timelineItems: unifiedStore.timelineItems,
      tracks: unifiedStore.tracks,
      onProgress: (stage: string, progress: number, details?: string) => {
        // 更新本地导出进度
        exportProgress.value = Math.max(0, Math.min(100, progress))
        exportDetails.value = details || ''
        console.log(`📤 [导出进度] ${progress}%${details ? ` - ${details}` : ''}`)
      },
    })

    // 导出成功完成
    isExporting.value = false
    console.log('✅ [导出] 视频导出完成')

    // 显示成功通知
    unifiedStore.showSuccess(t('editor.exportSuccess'))
  } catch (error) {
    console.error('导出项目失败:', error)

    // 显示错误通知
    unifiedStore.showError(error instanceof Error ? error.message : t('editor.exportFailed'))

    // 重置导出状态
    isExporting.value = false
    exportProgress.value = 0
    exportDetails.value = ''
  }
}

// 显示编辑项目对话框
function showEditProjectDialog() {
  showEditDialog.value = true
}

// 处理保存项目编辑
async function handleSaveProject(data: { name: string; description: string }) {
  try {
    // 更新 store 中的项目信息
    unifiedStore.projectName = data.name
    unifiedStore.projectDescription = data.description

    // 先关闭对话框，提升用户体验
    showEditDialog.value = false
    console.log('项目信息已更新:', data.name)

    // 异步保存项目配置（只保存元信息，不涉及timeline内容）
    unifiedStore
      .saveCurrentProject({ configChanged: true })
      .then(() => {
        console.log('项目配置保存成功:', data.name)
      })
      .catch((error) => {
        console.error('保存项目配置失败:', error)
        // 可以添加错误提示，但不影响对话框关闭
      })
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
  console.log(' [LIFECYCLE] VideoEditor.onBeforeMount 开始')
  // 初始化语言设置
  initLanguage()

  // 从路由参数获取项目ID
  const projectId = route.params.projectId as string
  if (!projectId) {
    console.error('❌ [LIFECYCLE] VideoEditor 缺少项目ID参数')
    // 返回根目录
    window.location.href = '/'
  }

  try {
    console.log(' [LIFECYCLE] VideoEditor 开始预加载项目设置')
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
  console.log(' [LIFECYCLE] VideoEditor.onMounted 开始')

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

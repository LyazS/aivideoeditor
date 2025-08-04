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

            <HoverButton @click="debugProject" title="调试：打印项目JSON">
              <template #icon>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M20,19V7H4V19H20M20,3A2,2 0 0,1 22,5V19A2,2 0 0,1 20,21H4A2,2 0 0,1 2,19V5A2,2 0 0,1 4,3H20M13,17V15H18V17H13M9.58,13L5.57,9H8.4L11.7,12.3C12.09,12.69 12.09,13.33 11.7,13.72L8.42,17H5.59L9.58,13Z"
                  />
                </svg>
              </template>
              调试
            </HoverButton>
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
import { useAutoSave } from '../composables/useAutoSave'
import VideoPreviewEngine from '../components/VideoPreviewEngine.vue'
import HoverButton from '../components/HoverButton.vue'
import LoadingOverlay from '../components/LoadingOverlay.vue'
import EditProjectDialog from '../components/EditProjectDialog.vue'
// 移除不再使用的类型检查导入，新架构使用统一类型

const route = useRoute()
const unifiedStore = useUnifiedStore()

// 初始化自动保存
const autoSave = useAutoSave({
  debounceTime: 2000, // 2秒防抖
  throttleTime: 30000, // 30秒强制保存
  enabled: true,
})

// 响应式数据
const projectTitle = ref('未命名项目')
const showEditDialog = ref(false)

// 计算属性 - 使用store中的项目状态（适配新的API）
const projectStatus = computed(() => unifiedStore.projectStatus)
const isSaving = computed(() => unifiedStore.isProjectSaving) // 新API：isSaving → isProjectSaving
const currentProject = computed(() => unifiedStore.currentProject)

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
    const success = await autoSave.manualSave()
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

function exportProject() {
  // TODO: 实现项目导出逻辑
  console.log('导出项目')
}

// 显示编辑项目对话框
function showEditProjectDialog() {
  showEditDialog.value = true
}

// 处理保存项目编辑
async function handleSaveProject(data: { name: string; description: string }) {
  if (!currentProject.value) {
    console.error('没有当前项目可编辑')
    return
  }

  try {
    // 更新项目信息
    await unifiedStore.saveCurrentProject({
      name: data.name,
      description: data.description,
    })

    // 更新标题显示
    projectTitle.value = data.name

    // 关闭对话框
    showEditDialog.value = false

    console.log('项目信息更新成功:', data.name)
  } catch (error) {
    console.error('更新项目信息失败:', error)
    // 可以添加错误提示
  }
}

function debugProject() {
  console.log('🔍 [调试] 开始打印项目JSON数据...')

  try {
    // 构建完整的项目数据（适配新的 useUnifiedStore API）
    const projectData = {
      // 基本信息（使用新的属性名）
      projectInfo: {
        currentProject: unifiedStore.currentProject,
        currentProjectId: unifiedStore.currentProjectId,
        currentProjectName: unifiedStore.currentProjectName,
        projectStatus: unifiedStore.projectStatus,
        hasCurrentProject: unifiedStore.hasCurrentProject,
        isSaving: unifiedStore.isProjectSaving, // 新API：isSaving → isProjectSaving
        lastSaved: unifiedStore.lastProjectSaved, // 新API：lastSaved → lastProjectSaved
      },

      // 项目设置
      settings: {
        videoResolution: unifiedStore.videoResolution,
        frameRate: unifiedStore.frameRate,
        timelineDurationFrames: unifiedStore.timelineDurationFrames,
      },

      // 轨道数据
      tracks: unifiedStore.tracks,

      // 统一媒体项目数据（适配 UnifiedMediaItemData 结构）
      mediaItems: unifiedStore.mediaItems.map((item) => ({
        id: item.id,
        name: item.name,
        createdAt: item.createdAt,
        mediaStatus: item.mediaStatus, // 新结构：status → mediaStatus
        mediaType: item.mediaType,
        duration: item.duration,

        // 数据源信息（新结构）
        source: {
          type: item.source.type,
          status: item.source.status,
          progress: item.source.progress,
          file: item.source.file
            ? {
                name: item.source.file.name,
                size: item.source.file.size,
                type: item.source.file.type,
                lastModified: item.source.file.lastModified,
              }
            : null,
          url: item.source.url || null,
        },

        // WebAV对象信息（新结构）
        webav: item.webav
          ? {
              hasMP4Clip: !!item.webav.mp4Clip,
              hasImgClip: !!item.webav.imgClip,
              hasAudioClip: !!item.webav.audioClip,
              thumbnailUrl: item.webav.thumbnailUrl ? 'blob URL存在' : null,
              originalWidth: item.webav.originalWidth,
              originalHeight: item.webav.originalHeight,
            }
          : null,
      })),

      // 统一时间轴项目数据（适配 UnifiedTimelineItemData 结构）
      timelineItems: unifiedStore.timelineItems.map((item: any) => {
        // 使用新的统一媒体项目查询方法
        const mediaItem = unifiedStore.getMediaItem(item.mediaItemId)
        const mediaName = mediaItem?.name || 'Unknown'

        return {
          id: item.id,
          mediaItemId: item.mediaItemId,
          trackId: item.trackId,
          mediaType: item.mediaType,
          timelineStatus: item.timelineStatus, // 新结构：3状态系统
          timeRange: item.timeRange,
          config: item.config,
          hasSprite: !!item.sprite,
          mediaName,
        }
      }),

      // 统计信息（使用新的查询方法）
      statistics: {
        totalMediaItems: unifiedStore.mediaItems.length,
        totalTimelineItems: unifiedStore.timelineItems.length,
        totalTracks: unifiedStore.tracks.length,
        readyMediaItems: unifiedStore.getReadyMediaItems().length, // 使用新的查询方法
        processingMediaItems: unifiedStore.getProcessingMediaItems().length,
        errorMediaItems: unifiedStore.getErrorMediaItems().length,
        mediaStats: unifiedStore.getMediaItemsStats(), // 新的统计方法
      },
    }

    // 打印到控制台
    console.log('📊 [调试] 完整项目数据:', projectData)

    // 打印格式化的JSON
    console.log('� [调试] 项目JSON (格式化):')
    console.log(JSON.stringify(projectData, null, 2))

    // 打印持久化数据（不包含运行时状态）
    const persistenceData = {
      timeline: {
        tracks: unifiedStore.tracks,
        timelineItems: unifiedStore.timelineItems.map((item: any) => {
          // 使用新的统一媒体项目查询方法
          const mediaItem = unifiedStore.getMediaItem(item.mediaItemId)
          const mediaName = mediaItem?.name || 'Unknown'

          return {
            id: item.id,
            mediaItemId: item.mediaItemId,
            trackId: item.trackId,
            mediaType: item.mediaType,
            timelineStatus: item.timelineStatus,
            timeRange: item.timeRange,
            config: item.config,
            mediaName,
          }
        }),
        mediaItems: unifiedStore.mediaItems.map((item) => ({
          id: item.id,
          name: item.name,
          createdAt: item.createdAt,
          mediaType: item.mediaType,
          duration: item.duration,
          sourceType: item.source.type,
        })),
      },
      settings: {
        videoResolution: unifiedStore.videoResolution,
        frameRate: unifiedStore.frameRate,
        timelineDurationFrames: unifiedStore.timelineDurationFrames,
      },
    }

    console.log('💾 [调试] 持久化数据 (将保存到project.json):')
    console.log(JSON.stringify(persistenceData, null, 2))

    // 在浏览器中显示通知
    console.log('✅ [调试] 项目JSON数据已打印到控制台，请查看开发者工具')

    // 将unifiedStore暴露到全局，方便调试
    ;(window as any).unifiedStore = unifiedStore
  } catch (error) {
    console.error('❌ [调试] 打印项目数据失败:', error)
  }
}

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

  try {
    console.log('� [LIFECYCLE] VideoEditor 开始预加载项目设置')
    await unifiedStore.preloadProjectSettings(projectId)
    console.log('🔄 [LIFECYCLE] VideoEditor 项目设置预加载完成')
  } catch (error) {
    console.error('🔄 [LIFECYCLE] VideoEditor 预加载项目设置失败:', error)
    // 对于现有项目，预加载失败是严重错误，需要通知用户
    if (projectId && projectId !== 'undefined') {
      projectTitle.value = '项目设置加载失败'
      // 这里可以显示错误提示给用户
      throw new Error(`项目设置加载失败: ${error}`)
    }
    // 对于新项目，可以使用默认设置继续
    console.log('🔄 [LIFECYCLE] VideoEditor 新项目使用默认设置')
  }

  console.log('🔄 [LIFECYCLE] VideoEditor.onBeforeMount 完成')
})

onMounted(async () => {
  console.log('� [LIFECYCLE] VideoEditor.onMounted 开始')

  // 从路由参数获取项目ID
  const projectId = route.params.projectId as string

  // 加载项目内容

  try {
    console.log('📂 [VideoEditor] 开始加载项目内容...')
    await unifiedStore.loadProjectContent(projectId)

    if (unifiedStore.hasCurrentProject) {
      projectTitle.value = unifiedStore.currentProjectName
      console.log('✅ [VideoEditor] 项目内容加载完成:', unifiedStore.currentProjectName)

      // 启用自动保存
      autoSave.enableAutoSave()
      console.log('✅ [VideoEditor] 自动保存已启用')
    } else {
      projectTitle.value = '新建项目'
      console.log('📝 [VideoEditor] 准备创建新项目')

      // 对于新项目，暂时禁用自动保存，直到项目被创建
      autoSave.disableAutoSave()
    }
  } catch (error) {
    console.error('❌ [VideoEditor] 加载项目内容失败:', error)
    projectTitle.value = '加载失败'
    autoSave.disableAutoSave()
  }

  // 注册键盘快捷键
  window.addEventListener('keydown', handleKeydown)

  console.log('🔄 [LIFECYCLE] VideoEditor.onMounted 完成')
})

onUnmounted(() => {
  // 禁用自动保存
  autoSave.disableAutoSave()

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

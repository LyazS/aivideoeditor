/**
 * 统一异步源架构 - 项目管理Store
 * 
 * 基于统一异步源架构的项目状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  BaseDataSource, 
  DataSourceStatus,
  UnifiedCommand,
  CommandHistoryManager 
} from '@/types/unified'

// 项目基础信息
export interface ProjectInfo {
  id: string
  name: string
  description: string
  createdAt: Date
  updatedAt: Date
  version: string
  author: string
  tags: string[]
}

// 项目设置
export interface ProjectSettings {
  // 视频设置
  videoResolution: {
    width: number
    height: number
  }
  frameRate: number
  duration: number // 总时长（秒）
  
  // 音频设置
  sampleRate: number
  channels: number
  
  // 渲染设置
  outputFormat: string
  quality: string
  
  // 界面设置
  timelineZoom: number
  snapEnabled: boolean
  snapSensitivity: number
}

// 项目状态
export interface ProjectState {
  info: ProjectInfo | null
  settings: ProjectSettings
  isDirty: boolean // 是否有未保存的更改
  isLoading: boolean
  error: string | null
}

export const useUnifiedProjectStore = defineStore('unifiedProject', () => {
  // 状态
  const state = ref<ProjectState>({
    info: null,
    settings: {
      videoResolution: { width: 1920, height: 1080 },
      frameRate: 30,
      duration: 0,
      sampleRate: 44100,
      channels: 2,
      outputFormat: 'mp4',
      quality: 'high',
      timelineZoom: 1,
      snapEnabled: true,
      snapSensitivity: 10
    },
    isDirty: false,
    isLoading: false,
    error: null
  })

  // 数据源
  const projectDataSource = ref<BaseDataSource<ProjectInfo> | null>(null)
  const settingsDataSource = ref<BaseDataSource<ProjectSettings> | null>(null)
  const saveDataSource = ref<BaseDataSource<boolean> | null>(null)

  // 计算属性
  const isProjectLoaded = computed(() => state.value.info !== null)
  const projectName = computed(() => state.value.info?.name || '未命名项目')
  const canSave = computed(() => state.value.isDirty && !state.value.isLoading)
  const totalDurationFrames = computed(() => 
    Math.floor(state.value.settings.duration * state.value.settings.frameRate)
  )

  // 创建新项目
  const createProject = async (name: string, settings?: Partial<ProjectSettings>) => {
    state.value.isLoading = true
    state.value.error = null

    try {
      const newProject: ProjectInfo = {
        id: `project_${Date.now()}`,
        name,
        description: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        author: 'User',
        tags: []
      }

      // 合并设置
      if (settings) {
        state.value.settings = { ...state.value.settings, ...settings }
      }

      state.value.info = newProject
      state.value.isDirty = false
      
      console.log('Project created (empty shell):', newProject)
    } catch (error) {
      state.value.error = error instanceof Error ? error.message : '创建项目失败'
    } finally {
      state.value.isLoading = false
    }
  }

  // 加载项目
  const loadProject = async (projectId: string) => {
    state.value.isLoading = true
    state.value.error = null

    try {
      // 空壳实现 - 模拟加载
      console.log('Loading project (empty shell):', projectId)
      
      // 模拟项目数据
      const mockProject: ProjectInfo = {
        id: projectId,
        name: '示例项目',
        description: '这是一个示例项目',
        createdAt: new Date(Date.now() - 86400000), // 昨天
        updatedAt: new Date(),
        version: '1.0.0',
        author: 'User',
        tags: ['demo']
      }

      state.value.info = mockProject
      state.value.isDirty = false
    } catch (error) {
      state.value.error = error instanceof Error ? error.message : '加载项目失败'
    } finally {
      state.value.isLoading = false
    }
  }

  // 保存项目
  const saveProject = async () => {
    if (!canSave.value) return false

    state.value.isLoading = true
    state.value.error = null

    try {
      // 空壳实现 - 模拟保存
      console.log('Saving project (empty shell):', state.value.info)
      
      if (state.value.info) {
        state.value.info.updatedAt = new Date()
      }
      
      state.value.isDirty = false
      return true
    } catch (error) {
      state.value.error = error instanceof Error ? error.message : '保存项目失败'
      return false
    } finally {
      state.value.isLoading = false
    }
  }

  // 更新项目信息
  const updateProjectInfo = (updates: Partial<ProjectInfo>) => {
    if (!state.value.info) return

    state.value.info = { ...state.value.info, ...updates }
    state.value.isDirty = true
  }

  // 更新项目设置
  const updateProjectSettings = (updates: Partial<ProjectSettings>) => {
    state.value.settings = { ...state.value.settings, ...updates }
    state.value.isDirty = true
  }

  // 关闭项目
  const closeProject = () => {
    state.value.info = null
    state.value.isDirty = false
    state.value.error = null
    
    // 清理数据源
    projectDataSource.value = null
    settingsDataSource.value = null
    saveDataSource.value = null
  }

  // 检查是否有未保存的更改
  const checkUnsavedChanges = () => {
    return state.value.isDirty
  }

  // 重置错误状态
  const clearError = () => {
    state.value.error = null
  }

  // 导出项目数据
  const exportProject = async () => {
    if (!state.value.info) return null

    try {
      const exportData = {
        info: state.value.info,
        settings: state.value.settings,
        exportedAt: new Date(),
        version: '1.0.0'
      }

      console.log('Exporting project (empty shell):', exportData)
      return exportData
    } catch (error) {
      state.value.error = error instanceof Error ? error.message : '导出项目失败'
      return null
    }
  }

  // 导入项目数据
  const importProject = async (projectData: any) => {
    state.value.isLoading = true
    state.value.error = null

    try {
      console.log('Importing project (empty shell):', projectData)
      
      if (projectData.info) {
        state.value.info = projectData.info
      }
      
      if (projectData.settings) {
        state.value.settings = { ...state.value.settings, ...projectData.settings }
      }
      
      state.value.isDirty = false
      return true
    } catch (error) {
      state.value.error = error instanceof Error ? error.message : '导入项目失败'
      return false
    } finally {
      state.value.isLoading = false
    }
  }

  return {
    // 状态
    state,
    projectDataSource,
    settingsDataSource,
    saveDataSource,
    
    // 计算属性
    isProjectLoaded,
    projectName,
    canSave,
    totalDurationFrames,
    
    // 方法
    createProject,
    loadProject,
    saveProject,
    updateProjectInfo,
    updateProjectSettings,
    closeProject,
    checkUnsavedChanges,
    clearError,
    exportProject,
    importProject
  }
})

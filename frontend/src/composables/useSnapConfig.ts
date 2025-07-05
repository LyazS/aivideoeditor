import { ref, computed, watch } from 'vue'
import type { SnapConfig } from '../types/snap'
import { DEFAULT_SNAP_CONFIG } from '../types/snap'

/**
 * 吸附配置管理 Composable
 * 提供统一的吸附配置管理，支持配置持久化
 */
export function useSnapConfig() {
  // 配置存储键
  const STORAGE_KEY = 'timeline-snap-config'
  
  // 从本地存储加载配置
  function loadConfigFromStorage(): SnapConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // 合并默认配置，确保新增的配置项有默认值
        return { ...DEFAULT_SNAP_CONFIG, ...parsed }
      }
    } catch (error) {
      console.warn('加载吸附配置失败，使用默认配置:', error)
    }
    return { ...DEFAULT_SNAP_CONFIG }
  }
  
  // 保存配置到本地存储
  function saveConfigToStorage(config: SnapConfig) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch (error) {
      console.warn('保存吸附配置失败:', error)
    }
  }
  
  // 响应式配置状态
  const config = ref<SnapConfig>(loadConfigFromStorage())
  
  // 监听配置变化，自动保存
  watch(
    config,
    (newConfig) => {
      saveConfigToStorage(newConfig)
    },
    { deep: true }
  )
  
  // 计算属性：是否启用吸附
  const isSnapEnabled = computed(() => config.value.enabled)
  
  // 计算属性：是否启用片段边界吸附
  const isClipBoundariesEnabled = computed(() => 
    config.value.enabled && config.value.clipBoundaries
  )
  
  // 计算属性：是否启用关键帧吸附
  const isKeyframesEnabled = computed(() => 
    config.value.enabled && config.value.keyframes
  )
  
  // 计算属性：是否启用播放头吸附
  const isPlayheadEnabled = computed(() => 
    config.value.enabled && config.value.playhead
  )
  
  // 计算属性：是否启用时间轴起始位置吸附
  const isTimelineStartEnabled = computed(() => 
    config.value.enabled && config.value.timelineStart
  )
  
  // 计算属性：是否启用可视化反馈
  const isVisualFeedbackEnabled = computed(() => 
    config.value.enabled && config.value.visualFeedback
  )
  
  // 更新配置的方法
  function updateConfig(updates: Partial<SnapConfig>) {
    config.value = { ...config.value, ...updates }
  }
  
  // 重置配置为默认值
  function resetConfig() {
    config.value = { ...DEFAULT_SNAP_CONFIG }
  }
  
  // 临时禁用吸附（用于快捷键控制）
  const temporaryDisabled = ref(false)
  
  // 计算属性：实际是否启用吸附（考虑临时禁用）
  const isActuallyEnabled = computed(() => 
    config.value.enabled && !temporaryDisabled.value
  )
  
  // 设置临时禁用状态
  function setTemporaryDisabled(disabled: boolean) {
    temporaryDisabled.value = disabled
  }
  
  // 切换全局吸附开关
  function toggleSnapEnabled() {
    updateConfig({ enabled: !config.value.enabled })
  }
  
  // 切换片段边界吸附
  function toggleClipBoundaries() {
    updateConfig({ clipBoundaries: !config.value.clipBoundaries })
  }
  
  // 切换关键帧吸附
  function toggleKeyframes() {
    updateConfig({ keyframes: !config.value.keyframes })
  }
  
  // 切换播放头吸附
  function togglePlayhead() {
    updateConfig({ playhead: !config.value.playhead })
  }
  
  // 切换时间轴起始位置吸附
  function toggleTimelineStart() {
    updateConfig({ timelineStart: !config.value.timelineStart })
  }
  
  // 切换可视化反馈
  function toggleVisualFeedback() {
    updateConfig({ visualFeedback: !config.value.visualFeedback })
  }
  
  // 设置吸附阈值
  function setThreshold(threshold: number) {
    updateConfig({ threshold: Math.max(1, threshold) })
  }
  
  return {
    // 配置状态
    config: computed(() => config.value),
    
    // 计算属性
    isSnapEnabled,
    isClipBoundariesEnabled,
    isKeyframesEnabled,
    isPlayheadEnabled,
    isTimelineStartEnabled,
    isVisualFeedbackEnabled,
    isActuallyEnabled,
    
    // 临时禁用
    temporaryDisabled: computed(() => temporaryDisabled.value),
    setTemporaryDisabled,
    
    // 配置更新方法
    updateConfig,
    resetConfig,
    
    // 快捷切换方法
    toggleSnapEnabled,
    toggleClipBoundaries,
    toggleKeyframes,
    togglePlayhead,
    toggleTimelineStart,
    toggleVisualFeedback,
    setThreshold,
  }
}

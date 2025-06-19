import { ref } from 'vue'
import type { VideoResolution } from '../../types/videoTypes'
import {
  createStateSetter,
  createNumberSetter,
  createBooleanSetter,
  createRangeValidator,
  createPositiveValidator
} from '../utils/stateSetterUtils'

/**
 * 项目配置管理模块
 * 负责管理项目级别的配置和设置
 */
export function createConfigModule() {
  // ==================== 状态定义 ====================

  // 视频分辨率设置
  const videoResolution = ref<VideoResolution>({
    name: '1080p',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
  })

  // 帧率设置
  const frameRate = ref(30) // 假设视频帧率为30fps

  // 时间轴基础时长
  const timelineDuration = ref(60) // 默认60秒时间轴，确保有足够的刻度线空间

  // 编辑设置
  const proportionalScale = ref(true) // 等比缩放设置

  // ==================== 配置管理方法 ====================

  // 创建统一的状态设置器
  const setFrameRateUnified = createNumberSetter(
    frameRate,
    'ConfigModule',
    '帧率',
    1,
    120,
    '🎬'
  )

  const setTimelineDurationUnified = createStateSetter(timelineDuration, {
    moduleName: 'ConfigModule',
    stateName: '时间轴时长',
    emoji: '🎬',
    validator: createPositiveValidator('时间轴时长'),
    logFormatter: (value, oldValue) => ({
      duration: `${value}秒`,
      oldDuration: oldValue ? `${oldValue}秒` : undefined,
      changed: oldValue !== value
    })
  })

  const setProportionalScaleUnified = createBooleanSetter(
    proportionalScale,
    'ConfigModule',
    '等比缩放',
    '🎬'
  )

  /**
   * 设置视频分辨率
   * @param resolution 新的视频分辨率配置
   */
  function setVideoResolution(resolution: VideoResolution) {
    videoResolution.value = resolution
    console.log('🎬 [ConfigModule] 设置视频分辨率:', {
      name: resolution.name,
      dimensions: `${resolution.width}x${resolution.height}`,
      aspectRatio: resolution.aspectRatio
    })
  }

  /**
   * 设置帧率
   * @param rate 新的帧率值
   */
  function setFrameRate(rate: number) {
    const result = setFrameRateUnified(rate)
    return result.success
  }

  /**
   * 设置时间轴基础时长
   * @param duration 新的时间轴时长（秒）
   */
  function setTimelineDuration(duration: number) {
    const result = setTimelineDurationUnified(duration)
    return result.success
  }

  /**
   * 设置等比缩放模式
   * @param enabled 是否启用等比缩放
   */
  function setProportionalScale(enabled: boolean) {
    const result = setProportionalScaleUnified(enabled)
    return result.success
  }

  /**
   * 获取当前配置的摘要信息
   * @returns 配置摘要对象
   */
  function getConfigSummary() {
    return {
      videoResolution: videoResolution.value,
      frameRate: frameRate.value,
      timelineDuration: timelineDuration.value,
      proportionalScale: proportionalScale.value,
    }
  }

  /**
   * 重置配置为默认值
   */
  function resetToDefaults() {
    videoResolution.value = {
      name: '1080p',
      width: 1920,
      height: 1080,
      aspectRatio: '16:9',
    }
    frameRate.value = 30
    timelineDuration.value = 60
    proportionalScale.value = true

    console.log('🔄 配置已重置为默认值')
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    videoResolution,
    frameRate,
    timelineDuration,
    proportionalScale,

    // 方法
    setVideoResolution,
    setFrameRate,
    setTimelineDuration,
    setProportionalScale,
    getConfigSummary,
    resetToDefaults,
  }
}

// 导出类型定义
export type ConfigModule = ReturnType<typeof createConfigModule>

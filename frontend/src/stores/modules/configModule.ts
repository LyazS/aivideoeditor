import { ref } from 'vue'
import type { VideoResolution } from '../../types/videoTypes'

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
  const timelineDuration = ref(300) // 默认300秒时间轴，确保有足够的刻度线空间

  // 编辑设置
  const proportionalScale = ref(true) // 等比缩放设置

  // ==================== 配置管理方法 ====================

  /**
   * 设置视频分辨率
   * @param resolution 新的视频分辨率配置
   */
  function setVideoResolution(resolution: VideoResolution) {
    videoResolution.value = resolution
    console.log('🎬 视频分辨率已设置为:', resolution)
  }

  /**
   * 设置帧率
   * @param rate 新的帧率值
   */
  function setFrameRate(rate: number) {
    if (rate > 0 && rate <= 120) { // 合理的帧率范围
      frameRate.value = rate
      console.log('🎬 帧率已设置为:', rate)
    } else {
      console.warn('⚠️ 无效的帧率值:', rate)
    }
  }

  /**
   * 设置时间轴基础时长
   * @param duration 新的时间轴时长（秒）
   */
  function setTimelineDuration(duration: number) {
    if (duration > 0) {
      timelineDuration.value = duration
      console.log('🎬 时间轴时长已设置为:', duration, '秒')
    } else {
      console.warn('⚠️ 无效的时间轴时长:', duration)
    }
  }

  /**
   * 设置等比缩放模式
   * @param enabled 是否启用等比缩放
   */
  function setProportionalScale(enabled: boolean) {
    proportionalScale.value = enabled
    console.log('🎬 等比缩放已设置为:', enabled ? '启用' : '禁用')
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
    timelineDuration.value = 300
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

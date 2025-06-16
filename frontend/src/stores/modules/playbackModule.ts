import { ref, computed } from 'vue'
import { alignTimeToFrame } from '../utils/storeUtils'

/**
 * 播放控制管理模块
 * 负责管理播放状态和时间控制
 */
export function createPlaybackModule(frameRate: { value: number }) {
  // ==================== 状态定义 ====================
  
  // 播放相关状态
  const currentTime = ref(0) // 当前播放时间（秒）
  const isPlaying = ref(false) // 是否正在播放
  const playbackRate = ref(1) // 播放速度倍率

  // ==================== 计算属性 ====================

  /**
   * 格式化当前时间为时分秒格式
   */
  const formattedCurrentTime = computed(() => {
    const time = currentTime.value
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const seconds = Math.floor(time % 60)
    const milliseconds = Math.floor((time % 1) * 1000)

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
    }
  })

  /**
   * 播放速度的显示文本
   */
  const playbackRateText = computed(() => {
    if (playbackRate.value === 1) {
      return '正常速度'
    } else if (playbackRate.value < 1) {
      return `${playbackRate.value}x 慢速`
    } else {
      return `${playbackRate.value}x 快速`
    }
  })

  // ==================== 播放控制方法 ====================

  /**
   * 设置当前播放时间
   * @param time 时间（秒）
   * @param forceAlign 是否强制对齐到帧边界
   */
  function setCurrentTime(time: number, forceAlign: boolean = true) {
    const finalTime = forceAlign ? alignTimeToFrame(time, frameRate.value) : time
    
    // 确保时间不为负数
    const clampedTime = Math.max(0, finalTime)
    
    if (currentTime.value !== clampedTime) {
      currentTime.value = clampedTime
    }
  }

  /**
   * 跳转到指定时间
   * @param time 目标时间（秒）
   */
  function seekTo(time: number) {
    setCurrentTime(time, true)
    console.log('🎯 跳转到时间:', time)
  }

  /**
   * 相对跳转
   * @param deltaTime 时间偏移量（秒，可为负数）
   */
  function seekBy(deltaTime: number) {
    const newTime = currentTime.value + deltaTime
    setCurrentTime(newTime, true)
    console.log('⏭️ 相对跳转:', {
      deltaTime,
      oldTime: currentTime.value - deltaTime,
      newTime: currentTime.value
    })
  }

  /**
   * 跳转到下一帧
   */
  function nextFrame() {
    const frameDuration = 1 / frameRate.value
    seekBy(frameDuration)
    console.log('⏭️ 下一帧')
  }

  /**
   * 跳转到上一帧
   */
  function previousFrame() {
    const frameDuration = 1 / frameRate.value
    seekBy(-frameDuration)
    console.log('⏮️ 上一帧')
  }

  /**
   * 设置播放状态
   * @param playing 是否播放
   */
  function setPlaying(playing: boolean) {
    if (isPlaying.value !== playing) {
      isPlaying.value = playing
      console.log('▶️ 设置播放状态:', playing ? '播放' : '暂停')
    }
  }

  /**
   * 播放
   */
  function play() {
    setPlaying(true)
  }

  /**
   * 暂停
   */
  function pause() {
    setPlaying(false)
  }

  /**
   * 切换播放/暂停状态
   */
  function togglePlayPause() {
    setPlaying(!isPlaying.value)
    console.log('⏯️ 切换播放状态:', isPlaying.value ? '播放' : '暂停')
  }

  /**
   * 停止播放并回到开始
   */
  function stop() {
    setPlaying(false)
    setCurrentTime(0)
    console.log('⏹️ 停止播放')
  }

  /**
   * 设置播放速度
   * @param rate 播放速度倍率
   */
  function setPlaybackRate(rate: number) {
    // 限制播放速度在合理范围内
    const clampedRate = Math.max(0.1, Math.min(10, rate))
    
    if (playbackRate.value !== clampedRate) {
      const oldRate = playbackRate.value
      playbackRate.value = clampedRate
      console.log('🏃 设置播放速度:', {
        requestedRate: rate,
        oldRate,
        newRate: clampedRate,
        clamped: rate !== clampedRate
      })
    }
  }

  /**
   * 重置播放速度为正常
   */
  function resetPlaybackRate() {
    setPlaybackRate(1)
    console.log('🔄 重置播放速度为正常')
  }

  /**
   * 获取播放状态摘要
   * @returns 播放状态摘要对象
   */
  function getPlaybackSummary() {
    return {
      currentTime: currentTime.value,
      formattedCurrentTime: formattedCurrentTime.value,
      isPlaying: isPlaying.value,
      playbackRate: playbackRate.value,
      playbackRateText: playbackRateText.value,
      frameRate: frameRate.value
    }
  }

  /**
   * 重置播放状态为默认值
   */
  function resetToDefaults() {
    currentTime.value = 0
    isPlaying.value = false
    playbackRate.value = 1
    console.log('🔄 播放状态已重置为默认值')
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    currentTime,
    isPlaying,
    playbackRate,

    // 计算属性
    formattedCurrentTime,
    playbackRateText,

    // 方法
    setCurrentTime,
    seekTo,
    seekBy,
    nextFrame,
    previousFrame,
    setPlaying,
    play,
    pause,
    togglePlayPause,
    stop,
    setPlaybackRate,
    resetPlaybackRate,
    getPlaybackSummary,
    resetToDefaults,
  }
}

// 导出类型定义
export type PlaybackModule = ReturnType<typeof createPlaybackModule>

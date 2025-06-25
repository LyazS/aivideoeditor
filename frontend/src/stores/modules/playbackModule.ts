import { ref, computed } from 'vue'
import {
  alignFramesToFrame,
  framesToTimecode,
  framesToSeconds,
  secondsToFrames
} from '../utils/timeUtils'

/**
 * 播放控制管理模块
 * 负责管理播放状态和时间控制
 */
export function createPlaybackModule(frameRate: { value: number }) {
  // ==================== 状态定义 ====================

  // 播放相关状态
  const currentFrame = ref(0) // 当前播放帧数（整数）
  const isPlaying = ref(false) // 是否正在播放
  const playbackRate = ref(1) // 播放速度倍率

  // ==================== 计算属性 ====================

  /**
   * 格式化当前时间为时间码格式
   */
  const formattedCurrentTime = computed(() => {
    return framesToTimecode(currentFrame.value)
  })

  /**
   * 当前时间（秒）- 向后兼容
   */
  const currentTime = computed(() => {
    return framesToSeconds(currentFrame.value)
  })

  /**
   * 播放速度的显示文本
   */
  const playbackRateText = computed(() => {
    // 使用容差来处理浮点数精度问题，避免显示1.00x快速
    const tolerance = 0.001
    const rate = playbackRate.value

    if (Math.abs(rate - 1) <= tolerance) {
      return '正常速度'
    } else if (rate < 1 - tolerance) {
      return `${rate.toFixed(1)}x 慢速`
    } else {
      return `${rate.toFixed(1)}x 快速`
    }
  })

  // ==================== 播放控制方法 ====================

  /**
   * 设置当前播放帧数
   * @param frames 帧数
   * @param forceAlign 是否强制对齐到整数帧
   */
  function setCurrentFrame(frames: number, forceAlign: boolean = true) {
    const finalFrames = forceAlign ? alignFramesToFrame(frames) : frames
    const clampedFrames = Math.max(0, finalFrames)

    if (currentFrame.value !== clampedFrames) {
      currentFrame.value = clampedFrames
    }
  }

  /**
   * 设置当前播放时间（向后兼容）
   * @param time 时间（秒）
   * @param forceAlign 是否强制对齐到帧边界
   */
  function setCurrentTime(time: number, forceAlign: boolean = true) {
    const frames = secondsToFrames(time)
    setCurrentFrame(frames, forceAlign)
  }

  /**
   * 跳转到指定帧数
   * @param frames 目标帧数
   */
  function seekToFrame(frames: number) {
    setCurrentFrame(frames, true)
    console.log('🎯 跳转到帧:', frames, `(${framesToTimecode(frames)})`)
  }

  /**
   * 跳转到指定时间（向后兼容）
   * @param time 目标时间（秒）
   */
  function seekTo(time: number) {
    setCurrentTime(time, true)
    console.log('🎯 跳转到时间:', time)
  }

  /**
   * 相对跳转（帧数）
   * @param deltaFrames 帧数偏移量（可为负数）
   */
  function seekByFrames(deltaFrames: number) {
    const newFrames = currentFrame.value + deltaFrames
    setCurrentFrame(newFrames, true)
    console.log('⏭️ 相对跳转:', {
      deltaFrames,
      oldFrame: currentFrame.value - deltaFrames,
      newFrame: currentFrame.value,
      timecode: framesToTimecode(currentFrame.value)
    })
  }

  /**
   * 相对跳转（向后兼容）
   * @param deltaTime 时间偏移量（秒，可为负数）
   */
  function seekBy(deltaTime: number) {
    const deltaFrames = secondsToFrames(deltaTime)
    seekByFrames(deltaFrames)
  }

  /**
   * 跳转到下一帧
   */
  function nextFrame() {
    seekByFrames(1)
    console.log('⏭️ 下一帧')
  }

  /**
   * 跳转到上一帧
   */
  function previousFrame() {
    seekByFrames(-1)
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
        clamped: rate !== clampedRate,
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
      frameRate: frameRate.value,
    }
  }

  /**
   * 重置播放状态为默认值
   */
  function resetToDefaults() {
    currentFrame.value = 0
    isPlaying.value = false
    playbackRate.value = 1
    console.log('🔄 播放状态已重置为默认值')
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    currentFrame, // 新增：当前帧数
    currentTime, // 兼容：当前时间（秒）
    isPlaying,
    playbackRate,

    // 计算属性
    formattedCurrentTime,
    playbackRateText,

    // 帧数控制方法（新增）
    setCurrentFrame,
    seekToFrame,
    seekByFrames,
    nextFrame,
    previousFrame,

    // 时间控制方法（兼容）
    setCurrentTime,
    seekTo,
    seekBy,

    // 播放控制方法
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

import { ref, computed } from 'vue'
import { Timecode } from '../../utils/Timecode'

/**
 * 播放控制管理模块
 * 负责管理播放状态和时间控制
 * 使用Timecode对象进行精确的时间管理
 */
export function createPlaybackModule(frameRate: { value: number }) {
  // ==================== 状态定义 ====================

  // 播放相关状态
  const currentTime = ref(Timecode.zero(frameRate.value)) // 当前播放时间（Timecode对象）
  const isPlaying = ref(false) // 是否正在播放
  const playbackRate = ref(1) // 播放速度倍率

  // ==================== 计算属性 ====================

  /**
   * 格式化当前时间为时间码格式
   */
  const formattedCurrentTime = computed(() => {
    // 直接使用Timecode对象的toString方法
    return currentTime.value.toString()
  })

  /**
   * 当前时间的秒数（用于WebAV交互）
   */
  const currentTimeSeconds = computed(() => {
    return currentTime.value.toSeconds()
  })

  /**
   * 当前时间的微秒数（用于WebAV交互）
   */
  const currentTimeMicroseconds = computed(() => {
    return currentTime.value.toMicroseconds()
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
   * 设置当前播放时间
   * @param time 时间（可以是秒数或Timecode对象）
   * @param forceAlign 是否强制对齐到帧边界
   */
  function setCurrentTime(time: number | Timecode, forceAlign: boolean = true) {
    let newTimecode: Timecode

    if (typeof time === 'number') {
      // 从秒数创建Timecode
      newTimecode = Timecode.fromSeconds(time, frameRate.value)
    } else {
      // 直接使用Timecode对象
      newTimecode = time
    }

    // 确保时间不为负数
    if (newTimecode.totalFrames < 0) {
      newTimecode = Timecode.zero(frameRate.value)
    }

    // 只有当时间真正改变时才更新
    if (!currentTime.value.equals(newTimecode)) {
      currentTime.value = newTimecode
    }
  }

  /**
   * 设置当前播放时间（从Timecode对象）
   * @param timecode Timecode对象
   */
  function setCurrentTimecode(timecode: Timecode) {
    setCurrentTime(timecode, false)
  }

  /**
   * 设置当前播放时间（从微秒）
   * @param microseconds 微秒值
   * @param forceAlign 是否强制对齐到帧边界
   */
  function setCurrentTimeMicroseconds(microseconds: number, forceAlign: boolean = true) {
    const timecode = Timecode.fromMicroseconds(microseconds, frameRate.value)
    setCurrentTime(timecode, forceAlign)
  }

  /**
   * 跳转到指定时间
   * @param time 目标时间（秒数或Timecode对象）
   */
  function seekTo(time: number | Timecode) {
    setCurrentTime(time, true)
    const timeStr = typeof time === 'number' ? time.toString() : time.toString()
    console.log('🎯 跳转到时间:', timeStr)
  }

  /**
   * 相对跳转
   * @param deltaTime 时间偏移量（秒，可为负数）
   */
  function seekBy(deltaTime: number) {
    const deltaTimecode = Timecode.fromSeconds(deltaTime, frameRate.value)
    const newTime = currentTime.value.add(deltaTimecode)
    setCurrentTime(newTime, true)
    console.log('⏭️ 相对跳转:', {
      deltaTime,
      oldTime: currentTime.value.toString(),
      newTime: newTime.toString(),
    })
  }

  /**
   * 跳转到下一帧
   */
  function nextFrame() {
    const oneFrame = Timecode.fromFrames(1, frameRate.value)
    const newTime = currentTime.value.add(oneFrame)
    setCurrentTime(newTime, false) // 不需要对齐，已经是帧级别
    console.log('⏭️ 下一帧')
  }

  /**
   * 跳转到上一帧
   */
  function previousFrame() {
    const oneFrame = Timecode.fromFrames(1, frameRate.value)
    const newTime = currentTime.value.subtract(oneFrame)
    setCurrentTime(newTime, false) // 不需要对齐，已经是帧级别
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
    setCurrentTime(Timecode.zero(frameRate.value))
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
      currentTimeSeconds: currentTimeSeconds.value,
      currentTimeMicroseconds: currentTimeMicroseconds.value,
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
    currentTime.value = Timecode.zero(frameRate.value)
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
    currentTimeSeconds,
    currentTimeMicroseconds,
    playbackRateText,

    // 方法
    setCurrentTime,
    setCurrentTimecode,
    setCurrentTimeMicroseconds,
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

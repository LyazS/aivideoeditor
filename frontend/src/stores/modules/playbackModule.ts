import { ref, computed, watch } from 'vue'
import { Timecode } from '@/utils/Timecode'

/**
 * 播放控制管理模块
 * 负责管理播放状态和时间控制
 */
export function createPlaybackModule(frameRate: { value: number }) {
  // ==================== 状态定义 ====================

  // 播放相关状态
  const currentTimecode = ref(Timecode.zero(frameRate.value)) // 当前播放时间（Timecode对象）
  const isPlaying = ref(false) // 是否正在播放
  const playbackRate = ref(1) // 播放速度倍率

  // 监听帧率变化，更新当前时间码的帧率
  watch(() => frameRate.value, (newFrameRate) => {
    const currentSeconds = currentTimecode.value.toSeconds()
    currentTimecode.value = Timecode.fromSeconds(currentSeconds, newFrameRate)
  })

  // ==================== 计算属性 ====================

  /**
   * 格式化当前时间为时间码格式
   */
  const formattedCurrentTime = computed(() => {
    // 直接使用Timecode对象的toString方法
    return currentTimecode.value.toString()
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
   * @param timecode Timecode对象
   * @param forceAlign 是否强制对齐到帧边界
   */
  function setCurrentTime(timecode: Timecode, forceAlign: boolean = true) {
    let finalTimecode = timecode

    if (forceAlign) {
      // 如果帧率不匹配则转换帧率
      if (timecode.frameRate !== frameRate.value) {
        finalTimecode = timecode.convertFrameRate(frameRate.value)
      }
    }

    // 确保时间不为负数
    if (finalTimecode.totalFrames < 0) {
      finalTimecode = Timecode.zero(frameRate.value)
    }

    // 只有当时间码真正改变时才更新
    if (!currentTimecode.value.equals(finalTimecode)) {
      currentTimecode.value = finalTimecode
    }
  }

  /**
   * 跳转到指定时间
   * @param timecode 目标时间（Timecode对象）
   */
  function seekTo(timecode: Timecode) {
    setCurrentTime(timecode, true)
    console.log('🎯 跳转到时间:', timecode.toString())
  }

  /**
   * 相对跳转
   * @param deltaTime 时间偏移量（秒，可为负数）
   */
  function seekBy(deltaTime: number) {
    const deltaFrames = Math.round(deltaTime * frameRate.value)
    const newTimecode = new Timecode(currentTimecode.value.totalFrames + deltaFrames, frameRate.value)
    setCurrentTime(newTimecode, true)
    console.log('⏭️ 相对跳转:', {
      deltaTime,
      deltaFrames,
      oldTime: currentTimecode.value.toString(),
      newTime: newTimecode.toString(),
    })
  }

  /**
   * 跳转到下一帧
   */
  function nextFrame() {
    const newTimecode = new Timecode(currentTimecode.value.totalFrames + 1, frameRate.value)
    setCurrentTime(newTimecode, false) // 不需要强制对齐，因为已经是帧级操作
    console.log('⏭️ 下一帧:', newTimecode.toString())
  }

  /**
   * 跳转到上一帧
   */
  function previousFrame() {
    const newFrames = Math.max(0, currentTimecode.value.totalFrames - 1)
    const newTimecode = new Timecode(newFrames, frameRate.value)
    setCurrentTime(newTimecode, false) // 不需要强制对齐，因为已经是帧级操作
    console.log('⏮️ 上一帧:', newTimecode.toString())
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
      currentTimecode: currentTimecode.value,
      formattedCurrentTime: formattedCurrentTime.value,
      isPlaying: isPlaying.value,
      playbackRate: playbackRate.value,
      playbackRateText: playbackRateText.value,
      frameRate: frameRate.value,
      totalFrames: currentTimecode.value.totalFrames,
    }
  }

  /**
   * 重置播放状态为默认值
   */
  function resetToDefaults() {
    currentTimecode.value = Timecode.zero(frameRate.value)
    isPlaying.value = false
    playbackRate.value = 1
    console.log('🔄 播放状态已重置为默认值')
  }

  // ==================== 导出接口 ====================

  return {
    // 状态
    currentTimecode,
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

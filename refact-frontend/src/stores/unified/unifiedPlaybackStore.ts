/**
 * 统一异步源架构 - 播放控制Store
 * 
 * 基于统一异步源架构的播放状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { BaseDataSource, DataSourceStatus } from '@/types/unified'

// 播放状态枚举
export enum PlaybackState {
  STOPPED = 'stopped',
  PLAYING = 'playing',
  PAUSED = 'paused',
  SEEKING = 'seeking',
  BUFFERING = 'buffering',
  ERROR = 'error'
}

// 播放模式枚举
export enum PlaybackMode {
  NORMAL = 'normal',
  LOOP = 'loop',
  LOOP_SELECTION = 'loop_selection'
}

// 播放控制状态
export interface PlaybackControlState {
  state: PlaybackState
  currentFrame: number
  currentTime: number // 当前时间（秒）
  totalFrames: number
  totalTime: number // 总时长（秒）
  playbackRate: number
  volume: number
  muted: boolean
  mode: PlaybackMode
  isLoading: boolean
  error: string | null
  
  // 选择区域（用于循环播放）
  selectionStart: number
  selectionEnd: number
  hasSelection: boolean
  
  // 预览相关
  previewQuality: 'low' | 'medium' | 'high'
  enableRealTimePreview: boolean
}

export const useUnifiedPlaybackStore = defineStore('unifiedPlayback', () => {
  // 状态
  const state = ref<PlaybackControlState>({
    state: PlaybackState.STOPPED,
    currentFrame: 0,
    currentTime: 0,
    totalFrames: 0,
    totalTime: 0,
    playbackRate: 1,
    volume: 1,
    muted: false,
    mode: PlaybackMode.NORMAL,
    isLoading: false,
    error: null,
    selectionStart: 0,
    selectionEnd: 0,
    hasSelection: false,
    previewQuality: 'medium',
    enableRealTimePreview: true
  })

  // 数据源
  const playbackDataSource = ref<BaseDataSource<any> | null>(null)
  const renderDataSource = ref<BaseDataSource<ArrayBuffer> | null>(null)

  // 计算属性
  const isPlaying = computed(() => state.value.state === PlaybackState.PLAYING)
  const isPaused = computed(() => state.value.state === PlaybackState.PAUSED)
  const isStopped = computed(() => state.value.state === PlaybackState.STOPPED)
  const isBuffering = computed(() => state.value.state === PlaybackState.BUFFERING)
  const hasError = computed(() => state.value.state === PlaybackState.ERROR)

  const progress = computed(() => {
    if (state.value.totalFrames === 0) return 0
    return state.value.currentFrame / state.value.totalFrames
  })

  const timeProgress = computed(() => {
    if (state.value.totalTime === 0) return 0
    return state.value.currentTime / state.value.totalTime
  })

  const canPlay = computed(() => 
    state.value.totalFrames > 0 && 
    !isBuffering.value && 
    !hasError.value
  )

  const canSeek = computed(() => 
    state.value.totalFrames > 0 && 
    state.value.state !== PlaybackState.SEEKING
  )

  // 播放控制方法
  const play = async () => {
    if (!canPlay.value) return false

    try {
      state.value.state = PlaybackState.PLAYING
      console.log('Playback started (empty shell)')
      
      // 空壳实现 - 模拟播放
      // 在实际实现中，这里会启动WebAV渲染循环
      
      return true
    } catch (error) {
      state.value.state = PlaybackState.ERROR
      state.value.error = error instanceof Error ? error.message : '播放失败'
      return false
    }
  }

  const pause = () => {
    if (isPlaying.value) {
      state.value.state = PlaybackState.PAUSED
      console.log('Playback paused (empty shell)')
    }
  }

  const stop = () => {
    state.value.state = PlaybackState.STOPPED
    state.value.currentFrame = 0
    state.value.currentTime = 0
    console.log('Playback stopped (empty shell)')
  }

  const togglePlayPause = async () => {
    if (isPlaying.value) {
      pause()
    } else {
      await play()
    }
  }

  // 跳转控制
  const seekToFrame = async (frame: number) => {
    if (!canSeek.value) return false

    const targetFrame = Math.max(0, Math.min(frame, state.value.totalFrames - 1))
    
    try {
      state.value.state = PlaybackState.SEEKING
      state.value.currentFrame = targetFrame
      state.value.currentTime = frameToTime(targetFrame)
      
      console.log('Seeked to frame (empty shell):', targetFrame)
      
      // 恢复之前的状态
      if (state.value.state === PlaybackState.SEEKING) {
        state.value.state = isPaused.value ? PlaybackState.PAUSED : PlaybackState.STOPPED
      }
      
      return true
    } catch (error) {
      state.value.state = PlaybackState.ERROR
      state.value.error = error instanceof Error ? error.message : '跳转失败'
      return false
    }
  }

  const seekToTime = async (time: number) => {
    const frame = timeToFrame(time)
    return await seekToFrame(frame)
  }

  const seekToProgress = async (progress: number) => {
    const frame = Math.floor(progress * state.value.totalFrames)
    return await seekToFrame(frame)
  }

  // 播放速度控制
  const setPlaybackRate = (rate: number) => {
    const newRate = Math.max(0.1, Math.min(5, rate))
    state.value.playbackRate = newRate
    console.log('Playback rate changed (empty shell):', newRate)
  }

  // 音量控制
  const setVolume = (volume: number) => {
    state.value.volume = Math.max(0, Math.min(1, volume))
    console.log('Volume changed (empty shell):', state.value.volume)
  }

  const toggleMute = () => {
    state.value.muted = !state.value.muted
    console.log('Mute toggled (empty shell):', state.value.muted)
  }

  // 播放模式控制
  const setPlaybackMode = (mode: PlaybackMode) => {
    state.value.mode = mode
    console.log('Playback mode changed (empty shell):', mode)
  }

  // 选择区域控制
  const setSelection = (startFrame: number, endFrame: number) => {
    state.value.selectionStart = Math.max(0, startFrame)
    state.value.selectionEnd = Math.min(state.value.totalFrames, endFrame)
    state.value.hasSelection = state.value.selectionEnd > state.value.selectionStart
    
    console.log('Selection set (empty shell):', {
      start: state.value.selectionStart,
      end: state.value.selectionEnd
    })
  }

  const clearSelection = () => {
    state.value.selectionStart = 0
    state.value.selectionEnd = 0
    state.value.hasSelection = false
    console.log('Selection cleared (empty shell)')
  }

  // 预览质量控制
  const setPreviewQuality = (quality: 'low' | 'medium' | 'high') => {
    state.value.previewQuality = quality
    console.log('Preview quality changed (empty shell):', quality)
  }

  const toggleRealTimePreview = () => {
    state.value.enableRealTimePreview = !state.value.enableRealTimePreview
    console.log('Real-time preview toggled (empty shell):', state.value.enableRealTimePreview)
  }

  // 项目设置更新
  const updateProjectSettings = (totalFrames: number, frameRate: number) => {
    state.value.totalFrames = totalFrames
    state.value.totalTime = totalFrames / frameRate
    
    // 确保当前帧在有效范围内
    if (state.value.currentFrame >= totalFrames) {
      state.value.currentFrame = Math.max(0, totalFrames - 1)
      state.value.currentTime = frameToTime(state.value.currentFrame)
    }
    
    console.log('Project settings updated (empty shell):', {
      totalFrames,
      frameRate,
      totalTime: state.value.totalTime
    })
  }

  // 错误处理
  const clearError = () => {
    state.value.error = null
    if (state.value.state === PlaybackState.ERROR) {
      state.value.state = PlaybackState.STOPPED
    }
  }

  // 重置播放状态
  const reset = () => {
    stop()
    state.value.totalFrames = 0
    state.value.totalTime = 0
    state.value.playbackRate = 1
    state.value.volume = 1
    state.value.muted = false
    state.value.mode = PlaybackMode.NORMAL
    clearSelection()
    clearError()
  }

  // 辅助函数
  const frameToTime = (frame: number): number => {
    // 假设30fps，实际应该从项目设置获取
    return frame / 30
  }

  const timeToFrame = (time: number): number => {
    // 假设30fps，实际应该从项目设置获取
    return Math.floor(time * 30)
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const frames = Math.floor((seconds % 1) * 30)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`
  }

  const formatFrame = (frame: number): string => {
    const time = frameToTime(frame)
    return formatTime(time)
  }

  return {
    // 状态
    state,
    playbackDataSource,
    renderDataSource,
    
    // 计算属性
    isPlaying,
    isPaused,
    isStopped,
    isBuffering,
    hasError,
    progress,
    timeProgress,
    canPlay,
    canSeek,
    
    // 播放控制
    play,
    pause,
    stop,
    togglePlayPause,
    
    // 跳转控制
    seekToFrame,
    seekToTime,
    seekToProgress,
    
    // 设置控制
    setPlaybackRate,
    setVolume,
    toggleMute,
    setPlaybackMode,
    
    // 选择区域
    setSelection,
    clearSelection,
    
    // 预览设置
    setPreviewQuality,
    toggleRealTimePreview,
    
    // 项目设置
    updateProjectSettings,
    
    // 错误处理
    clearError,
    reset,
    
    // 辅助函数
    formatTime,
    formatFrame
  }
})

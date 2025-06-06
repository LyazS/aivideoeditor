import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface VideoClip {
  id: string
  file: File
  url: string
  duration: number // 在时间轴上的显示时长（可以通过拉伸调整）
  originalDuration: number // 原始视频文件的完整时长
  startTime: number // 视频内容的开始时间（通常是0）
  endTime: number // 视频内容的结束时间（通常等于originalDuration）
  timelinePosition: number
  name: string
  playbackRate?: number // 播放速度倍率（自动计算：originalDuration / duration）
}

export const useVideoStore = defineStore('video', () => {
  const clips = ref<VideoClip[]>([])
  const currentTime = ref(0)
  const isPlaying = ref(false)
  const timelineDuration = ref(60) // 默认60秒时间轴
  const currentClip = ref<VideoClip | null>(null)
  const playbackRate = ref(1) // 播放速度
  const selectedClipId = ref<string | null>(null) // 当前选中的片段ID

  // 全局时间控制器
  let timeUpdateInterval: number | null = null

  const totalDuration = computed(() => {
    if (clips.value.length === 0) return timelineDuration.value
    const maxEndTime = Math.max(...clips.value.map(clip => clip.timelinePosition + clip.duration))
    return Math.max(maxEndTime, timelineDuration.value)
  })

  // 计算实际内容的结束时间（最后一个视频片段的结束时间）
  const contentEndTime = computed(() => {
    if (clips.value.length === 0) return 0
    return Math.max(...clips.value.map(clip => clip.timelinePosition + clip.duration))
  })

  function addClip(clip: VideoClip) {
    // 检查并调整新片段的位置以避免重叠
    const adjustedPosition = resolveOverlap(clip.id, clip.timelinePosition)
    clip.timelinePosition = adjustedPosition
    clips.value.push(clip)
  }

  function removeClip(clipId: string) {
    const index = clips.value.findIndex(clip => clip.id === clipId)
    if (index > -1) {
      clips.value.splice(index, 1)
    }
  }

  function updateClipPosition(clipId: string, newPosition: number) {
    const clip = clips.value.find(c => c.id === clipId)
    if (clip) {
      // 检查并处理重叠
      const adjustedPosition = resolveOverlap(clipId, newPosition)
      clip.timelinePosition = adjustedPosition
    }
  }

  function updateClipDuration(clipId: string, newDuration: number, timelinePosition?: number) {
    const clip = clips.value.find(c => c.id === clipId)
    if (clip) {
      // 确保最小时长（0.1秒）和最大时长限制
      const minDuration = 0.1
      const maxDuration = clip.originalDuration * 10 // 最多可以拉伸到10倍长度（0.1倍速）
      const validDuration = Math.max(minDuration, Math.min(newDuration, maxDuration))

      clip.duration = validDuration
      // 计算播放速度倍率
      clip.playbackRate = clip.originalDuration / validDuration

      // 如果提供了新的时间轴位置，也更新它
      if (timelinePosition !== undefined) {
        const adjustedPosition = resolveOverlap(clipId, timelinePosition)
        clip.timelinePosition = adjustedPosition
      }
    }
  }

  function selectClip(clipId: string | null) {
    selectedClipId.value = clipId
  }

  function splitClipAtTime(clipId: string, splitTime: number) {
    console.group('🔪 视频片段裁剪调试')

    const clipIndex = clips.value.findIndex(c => c.id === clipId)
    if (clipIndex === -1) {
      console.error('❌ 找不到要裁剪的片段:', clipId)
      console.groupEnd()
      return
    }

    const originalClip = clips.value[clipIndex]
    console.log('📹 原始片段信息:')
    console.log('  - 名称:', originalClip.name)
    console.log('  - 时间轴位置:', originalClip.timelinePosition)
    console.log('  - 时间轴时长:', originalClip.duration)
    console.log('  - 视频开始时间:', originalClip.startTime)
    console.log('  - 视频结束时间:', originalClip.endTime)
    console.log('  - 播放速度:', originalClip.playbackRate)
    console.log('  - 原始时长:', originalClip.originalDuration)

    // 检查分割时间是否在片段范围内
    if (splitTime <= originalClip.timelinePosition || splitTime >= originalClip.timelinePosition + originalClip.duration) {
      console.error('❌ 分割时间不在片段范围内')
      console.log('  - 分割时间:', splitTime)
      console.log('  - 片段开始:', originalClip.timelinePosition)
      console.log('  - 片段结束:', originalClip.timelinePosition + originalClip.duration)
      console.groupEnd()
      return
    }

    // 计算分割点在片段内的相对时间
    const relativeTimelineTime = splitTime - originalClip.timelinePosition
    console.log('📍 分割点计算:')
    console.log('  - 分割时间:', splitTime)
    console.log('  - 片段内相对时间:', relativeTimelineTime)

    // 计算在原始视频中的分割点时间
    const playbackRate = originalClip.playbackRate || 1.0
    const videoContentDuration = originalClip.endTime - originalClip.startTime
    const relativeVideoTime = (relativeTimelineTime / originalClip.duration) * videoContentDuration
    const splitVideoTime = originalClip.startTime + relativeVideoTime

    console.log('🎬 视频时间计算:')
    console.log('  - 视频内容时长:', videoContentDuration)
    console.log('  - 相对视频时间:', relativeVideoTime)
    console.log('  - 分割点视频时间:', splitVideoTime)

    // 创建第一个片段（从开始到分割点）
    const firstClip: VideoClip = {
      ...originalClip,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      duration: relativeTimelineTime,
      endTime: splitVideoTime,
      playbackRate: videoContentDuration / originalClip.duration // 保持原有播放速度
    }

    // 创建第二个片段（从分割点到结束）
    const secondClip: VideoClip = {
      ...originalClip,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timelinePosition: splitTime,
      duration: originalClip.duration - relativeTimelineTime,
      startTime: splitVideoTime,
      playbackRate: videoContentDuration / originalClip.duration // 保持原有播放速度
    }

    console.log('✂️ 第一个片段:')
    console.log('  - 时间轴位置:', firstClip.timelinePosition)
    console.log('  - 时间轴时长:', firstClip.duration)
    console.log('  - 视频开始时间:', firstClip.startTime)
    console.log('  - 视频结束时间:', firstClip.endTime)
    console.log('  - 播放速度:', firstClip.playbackRate)

    console.log('✂️ 第二个片段:')
    console.log('  - 时间轴位置:', secondClip.timelinePosition)
    console.log('  - 时间轴时长:', secondClip.duration)
    console.log('  - 视频开始时间:', secondClip.startTime)
    console.log('  - 视频结束时间:', secondClip.endTime)
    console.log('  - 播放速度:', secondClip.playbackRate)

    // 替换原片段为两个新片段
    clips.value.splice(clipIndex, 1, firstClip, secondClip)
    console.log('✅ 裁剪完成，已替换原片段')

    // 清除选中状态
    selectedClipId.value = null
    console.groupEnd()
  }

  // 检测两个片段是否重叠
  function isOverlapping(clip1: VideoClip, clip2: VideoClip): boolean {
    const clip1Start = clip1.timelinePosition
    const clip1End = clip1.timelinePosition + clip1.duration
    const clip2Start = clip2.timelinePosition
    const clip2End = clip2.timelinePosition + clip2.duration

    return !(clip1End <= clip2Start || clip2End <= clip1Start)
  }

  // 解决重叠问题
  function resolveOverlap(movingClipId: string, newPosition: number): number {
    const movingClip = clips.value.find(c => c.id === movingClipId)
    if (!movingClip) return newPosition

    // 创建临时片段用于检测
    const tempClip: VideoClip = {
      ...movingClip,
      timelinePosition: newPosition
    }

    // 找到所有与移动片段重叠的其他片段
    const overlappingClips = clips.value.filter(clip =>
      clip.id !== movingClipId && isOverlapping(tempClip, clip)
    )

    if (overlappingClips.length === 0) {
      return newPosition // 没有重叠，直接返回
    }

    // 策略1: 自动吸附到最近的空隙
    return findNearestGap(tempClip, overlappingClips)
  }

  // 寻找最近的可用空隙
  function findNearestGap(movingClip: VideoClip, overlappingClips: VideoClip[]): number {
    const allClips = clips.value.filter(c => c.id !== movingClip.id)

    // 按时间位置排序
    allClips.sort((a, b) => a.timelinePosition - b.timelinePosition)

    // 尝试在每个片段之前和之后放置
    const possiblePositions: number[] = [0] // 开始位置

    for (const clip of allClips) {
      // 片段之前的位置
      const beforePosition = clip.timelinePosition - movingClip.duration
      if (beforePosition >= 0) {
        possiblePositions.push(beforePosition)
      }

      // 片段之后的位置
      const afterPosition = clip.timelinePosition + clip.duration
      possiblePositions.push(afterPosition)
    }

    // 找到最接近原始位置且不重叠的位置
    const originalPosition = movingClip.timelinePosition
    let bestPosition = 0
    let minDistance = Infinity

    for (const pos of possiblePositions) {
      if (pos + movingClip.duration <= totalDuration.value) {
        const tempClip: VideoClip = { ...movingClip, timelinePosition: pos }
        const hasOverlap = allClips.some(clip => isOverlapping(tempClip, clip))

        if (!hasOverlap) {
          const distance = Math.abs(pos - originalPosition)
          if (distance < minDistance) {
            minDistance = distance
            bestPosition = pos
          }
        }
      }
    }

    return bestPosition
  }

  function getClipAtTime(time: number): VideoClip | null {
    return clips.value.find(clip =>
      time >= clip.timelinePosition &&
      time < clip.timelinePosition + clip.duration
    ) || null
  }

  function setCurrentTime(time: number) {
    currentTime.value = time
    currentClip.value = getClipAtTime(time)
  }

  function startTimeUpdate() {
    if (timeUpdateInterval) return

    timeUpdateInterval = setInterval(() => {
      if (isPlaying.value) {
        const newTime = currentTime.value + (0.1 * playbackRate.value) // 每100ms更新一次
        // 如果有视频片段，播放到最后一个片段结束；如果没有片段，播放到时间轴结束
        const endTime = contentEndTime.value > 0 ? contentEndTime.value : totalDuration.value
        if (newTime >= endTime) {
          stop()
        } else {
          setCurrentTime(newTime)
        }
      }
    }, 100) // 100ms间隔，确保流畅播放
  }

  function stopTimeUpdate() {
    if (timeUpdateInterval) {
      clearInterval(timeUpdateInterval)
      timeUpdateInterval = null
    }
  }

  function play() {
    isPlaying.value = true
    startTimeUpdate()
  }

  function pause() {
    isPlaying.value = false
    stopTimeUpdate()
  }

  function stop() {
    isPlaying.value = false
    currentTime.value = 0
    stopTimeUpdate()
  }

  function setPlaybackRate(rate: number) {
    playbackRate.value = rate
  }

  // 获取所有重叠的片段对
  function getOverlappingClips(): Array<{ clip1: VideoClip, clip2: VideoClip }> {
    const overlaps: Array<{ clip1: VideoClip, clip2: VideoClip }> = []

    for (let i = 0; i < clips.value.length; i++) {
      for (let j = i + 1; j < clips.value.length; j++) {
        if (isOverlapping(clips.value[i], clips.value[j])) {
          overlaps.push({ clip1: clips.value[i], clip2: clips.value[j] })
        }
      }
    }

    return overlaps
  }

  // 自动整理所有片段，消除重叠
  function autoArrangeClips() {
    // 按时间位置排序
    const sortedClips = [...clips.value].sort((a, b) => a.timelinePosition - b.timelinePosition)

    let currentPosition = 0
    for (const clip of sortedClips) {
      clip.timelinePosition = currentPosition
      currentPosition += clip.duration
    }
  }

  return {
    clips,
    currentTime,
    isPlaying,
    timelineDuration,
    currentClip,
    totalDuration,
    contentEndTime,
    playbackRate,
    selectedClipId,
    addClip,
    removeClip,
    updateClipPosition,
    updateClipDuration,
    selectClip,
    splitClipAtTime,
    getClipAtTime,
    setCurrentTime,
    play,
    pause,
    stop,
    setPlaybackRate,
    startTimeUpdate,
    stopTimeUpdate,
    isOverlapping,
    getOverlappingClips,
    autoArrangeClips
  }
})

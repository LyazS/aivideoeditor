import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface VideoTransform {
  x: number // X轴位置 (像素，相对于画布中心)
  y: number // Y轴位置 (像素，相对于画布中心)
  scaleX: number // X轴缩放 (1.0 = 100%)
  scaleY: number // Y轴缩放 (1.0 = 100%)
  rotation: number // 旋转角度 (度)
  opacity: number // 透明度 (0-1)
}

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
  trackId: number // 所属轨道ID
  transform: VideoTransform // 视频变换属性
  zIndex: number // 层级顺序
}

export interface VideoResolution {
  name: string
  width: number
  height: number
  aspectRatio: string
  category?: string
}

export interface Track {
  id: number
  name: string
  isVisible: boolean
  isMuted: boolean
  height: number // 轨道高度
}

export const useVideoStore = defineStore('video', () => {
  const clips = ref<VideoClip[]>([])
  const tracks = ref<Track[]>([
    { id: 1, name: '轨道 1', isVisible: true, isMuted: false, height: 80 },
    { id: 2, name: '轨道 2', isVisible: true, isMuted: false, height: 80 }
  ])
  const currentTime = ref(0)
  const isPlaying = ref(false)
  const timelineDuration = ref(300) // 默认300秒时间轴，确保有足够的刻度线空间
  const currentClip = ref<VideoClip | null>(null)
  const playbackRate = ref(1) // 播放速度
  const selectedClipId = ref<string | null>(null) // 当前选中的片段ID

  // 音量控制
  const volume = ref(1) // 音量 0-1
  const isMuted = ref(false) // 是否静音

  // 时间轴缩放和滚动状态
  const zoomLevel = ref(1) // 缩放级别，1为默认，大于1为放大，小于1为缩小
  const scrollOffset = ref(0) // 水平滚动偏移量（像素）
  const frameRate = ref(30) // 假设视频帧率为30fps

  // 视频分辨率设置
  const videoResolution = ref<VideoResolution>({
    name: '1080p',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9'
  })

  // 全局时间控制器
  let timeUpdateInterval: number | null = null

  const totalDuration = computed(() => {
    if (clips.value.length === 0) return timelineDuration.value
    const maxEndTime = Math.max(...clips.value.map(clip => clip.timelinePosition + clip.duration))
    return Math.max(maxEndTime, timelineDuration.value)
  })

  // 动态扩展时间轴长度（用于拖拽时预先扩展）
  function expandTimelineIfNeeded(targetTime: number) {
    if (targetTime > timelineDuration.value) {
      // 扩展到目标时间的1.5倍，确保有足够的空间
      timelineDuration.value = Math.max(targetTime * 1.5, timelineDuration.value)
    }
  }

  // 计算最大允许的可见时间范围（基于视频内容长度）
  const maxVisibleDuration = computed(() => {
    if (contentEndTime.value === 0) {
      return 300 // 没有视频时使用默认值300秒
    }
    // 最大可见范围：视频内容长度的4倍
    return contentEndTime.value * 4
  })

  // 缩放相关计算属性
  const minZoomLevel = computed(() => {
    // 基于最大可见范围计算最小缩放级别
    return totalDuration.value / maxVisibleDuration.value
  })

  // 当前可见时间范围（受最大可见范围限制）
  const visibleDuration = computed(() => {
    const calculatedDuration = totalDuration.value / zoomLevel.value
    return Math.min(calculatedDuration, maxVisibleDuration.value)
  })

  // 计算最大缩放级别的函数（需要时间轴宽度参数）
  function getMaxZoomLevel(timelineWidth: number): number {
    // 最大缩放级别：一帧占用容器宽度的1/20（即5%）
    const targetFrameWidth = timelineWidth / 20 // 一帧占1/20横幅
    const frameDuration = 1 / frameRate.value // 一帧的时长（秒）
    const requiredPixelsPerSecond = targetFrameWidth / frameDuration
    const maxZoom = (requiredPixelsPerSecond * totalDuration.value) / timelineWidth



    return Math.max(maxZoom, 100) // 确保至少有100倍缩放
  }

  // 计算最大滚动偏移量的函数（需要时间轴宽度参数）
  function getMaxScrollOffset(timelineWidth: number): number {
    // 基于最大可见范围计算滚动限制，而不是基于totalDuration
    const effectiveDuration = Math.min(totalDuration.value, maxVisibleDuration.value)
    const pixelsPerSecond = (timelineWidth * zoomLevel.value) / totalDuration.value
    const maxScrollableTime = Math.max(0, effectiveDuration - (timelineWidth / pixelsPerSecond))
    return maxScrollableTime * pixelsPerSecond
  }

  // 计算实际内容的结束时间（最后一个视频片段的结束时间）
  const contentEndTime = computed(() => {
    if (clips.value.length === 0) return 0
    return Math.max(...clips.value.map(clip => clip.timelinePosition + clip.duration))
  })

  function addClip(clip: VideoClip) {
    // 如果没有指定轨道，默认分配到第一个轨道
    if (!clip.trackId) {
      clip.trackId = 1
    }
    // 检查并调整新片段的位置以避免重叠（只在同一轨道内检查）
    const adjustedPosition = resolveOverlap(clip.id, clip.timelinePosition, clip.trackId)
    clip.timelinePosition = adjustedPosition
    clips.value.push(clip)
  }

  function removeClip(clipId: string) {
    const index = clips.value.findIndex(clip => clip.id === clipId)
    if (index > -1) {
      clips.value.splice(index, 1)
    }
  }

  function updateClipPosition(clipId: string, newPosition: number, newTrackId?: number) {
    const clip = clips.value.find(c => c.id === clipId)
    if (clip) {
      // 如果指定了新轨道，更新轨道ID
      if (newTrackId !== undefined) {
        clip.trackId = newTrackId
      }
      // 检查并处理重叠（只在同一轨道内检查）
      const adjustedPosition = resolveOverlap(clipId, newPosition, clip.trackId)
      clip.timelinePosition = adjustedPosition
    }
  }

  function updateClipDuration(clipId: string, newDuration: number, timelinePosition?: number) {
    const clip = clips.value.find(c => c.id === clipId)
    if (clip) {
      // 确保最小时长（0.01秒）和最大时长限制
      const minDuration = 0.01
      const maxDuration = clip.originalDuration * 100 // 最多可以拉伸到100倍长度（0.01倍速）
      const validDuration = Math.max(minDuration, Math.min(newDuration, maxDuration))

      clip.duration = validDuration
      // 计算播放速度倍率
      clip.playbackRate = clip.originalDuration / validDuration

      // 如果提供了新的时间轴位置，也更新它
      if (timelinePosition !== undefined) {
        const adjustedPosition = resolveOverlap(clipId, timelinePosition, clip.trackId)
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
      id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
      duration: relativeTimelineTime,
      endTime: splitVideoTime,
      playbackRate: videoContentDuration / originalClip.duration, // 保持原有播放速度
      trackId: originalClip.trackId, // 保持原轨道
      transform: { ...originalClip.transform }, // 复制变换属性
      zIndex: originalClip.zIndex
    }

    // 创建第二个片段（从分割点到结束）
    const secondClip: VideoClip = {
      ...originalClip,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
      timelinePosition: splitTime,
      duration: originalClip.duration - relativeTimelineTime,
      startTime: splitVideoTime,
      playbackRate: videoContentDuration / originalClip.duration, // 保持原有播放速度
      trackId: originalClip.trackId, // 保持原轨道
      transform: { ...originalClip.transform }, // 复制变换属性
      zIndex: originalClip.zIndex
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

  // 解决重叠问题（只在同一轨道内检查）
  function resolveOverlap(movingClipId: string, newPosition: number, trackId: number): number {
    const movingClip = clips.value.find(c => c.id === movingClipId)
    if (!movingClip) return newPosition

    // 创建临时片段用于检测
    const tempClip: VideoClip = {
      ...movingClip,
      timelinePosition: newPosition,
      trackId: trackId
    }

    // 找到所有与移动片段重叠的同轨道其他片段
    const overlappingClips = clips.value.filter(clip =>
      clip.id !== movingClipId &&
      clip.trackId === trackId &&
      isOverlapping(tempClip, clip)
    )

    if (overlappingClips.length === 0) {
      return newPosition // 没有重叠，直接返回
    }

    // 策略1: 自动吸附到最近的空隙
    return findNearestGap(tempClip, overlappingClips)
  }

  // 寻找最近的可用空隙（只在同一轨道内）
  function findNearestGap(movingClip: VideoClip, overlappingClips: VideoClip[]): number {
    const allClips = clips.value.filter(c => c.id !== movingClip.id && c.trackId === movingClip.trackId)

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

  // 将时间对齐到帧边界
  function alignTimeToFrame(time: number): number {
    const frameDuration = 1 / frameRate.value
    return Math.floor(time / frameDuration) * frameDuration
  }

  function setCurrentTime(time: number, forceAlign: boolean = true) {
    const finalTime = forceAlign ? alignTimeToFrame(time) : time
    currentTime.value = finalTime
    currentClip.value = getClipAtTime(finalTime)


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

  // 音量控制方法
  function setVolume(newVolume: number) {
    volume.value = Math.max(0, Math.min(1, newVolume)) // 确保音量在0-1范围内
    if (volume.value > 0) {
      isMuted.value = false
    }
  }

  function toggleMute() {
    isMuted.value = !isMuted.value
  }

  function mute() {
    isMuted.value = true
  }

  function unmute() {
    isMuted.value = false
  }

  // 前一帧控制
  function previousFrame() {
    const frameDuration = 1 / frameRate.value
    const newTime = Math.max(0, currentTime.value - frameDuration)
    setCurrentTime(newTime)
  }

  // 后一帧控制
  function nextFrame() {
    const frameDuration = 1 / frameRate.value
    const endTime = contentEndTime.value > 0 ? contentEndTime.value : totalDuration.value
    const newTime = Math.min(endTime, currentTime.value + frameDuration)
    setCurrentTime(newTime)
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

  // 自动整理所有片段，消除重叠（按轨道分组处理）
  function autoArrangeClips() {
    // 按轨道分组，然后在每个轨道内按时间位置排序
    const trackGroups = new Map<number, VideoClip[]>()

    clips.value.forEach(clip => {
      if (!trackGroups.has(clip.trackId)) {
        trackGroups.set(clip.trackId, [])
      }
      trackGroups.get(clip.trackId)!.push(clip)
    })

    // 在每个轨道内重新排列片段
    trackGroups.forEach((trackClips) => {
      const sortedClips = trackClips.sort((a, b) => a.timelinePosition - b.timelinePosition)
      let currentPosition = 0
      for (const clip of sortedClips) {
        clip.timelinePosition = currentPosition
        currentPosition += clip.duration
      }
    })
  }

  // 轨道管理方法
  function addTrack(name?: string): Track {
    const newId = Math.max(...tracks.value.map(t => t.id)) + 1
    const newTrack: Track = {
      id: newId,
      name: name || `轨道 ${newId}`,
      isVisible: true,
      isMuted: false,
      height: 80
    }
    tracks.value.push(newTrack)
    return newTrack
  }

  function removeTrack(trackId: number) {
    // 不能删除最后一个轨道
    if (tracks.value.length <= 1) return

    // 将该轨道的所有片段移动到第一个轨道
    clips.value.forEach(clip => {
      if (clip.trackId === trackId) {
        clip.trackId = tracks.value[0].id
      }
    })

    // 删除轨道
    const index = tracks.value.findIndex(t => t.id === trackId)
    if (index > -1) {
      tracks.value.splice(index, 1)
    }
  }

  function toggleTrackVisibility(trackId: number) {
    const track = tracks.value.find(t => t.id === trackId)
    if (track) {
      track.isVisible = !track.isVisible
    }
  }

  function toggleTrackMute(trackId: number) {
    const track = tracks.value.find(t => t.id === trackId)
    if (track) {
      track.isMuted = !track.isMuted
    }
  }

  function renameTrack(trackId: number, newName: string) {
    const track = tracks.value.find(t => t.id === trackId)
    if (track) {
      track.name = newName
    }
  }

  // 缩放和滚动方法
  function setZoomLevel(newZoomLevel: number, timelineWidth: number = 800) {
    const maxZoom = getMaxZoomLevel(timelineWidth)
    const minZoom = minZoomLevel.value
    const clampedZoom = Math.max(minZoom, Math.min(newZoomLevel, maxZoom))

    // 如果达到最小缩放级别，提供调试信息
    if (newZoomLevel < minZoom && contentEndTime.value > 0) {
      console.log(`🔍 已达到最小缩放级别 (${minZoom.toFixed(3)})`)
      console.log(`📏 当前视频总长度: ${contentEndTime.value.toFixed(1)}秒`)
      console.log(`👁️ 最大可见范围限制: ${maxVisibleDuration.value.toFixed(1)}秒`)
      console.log(`🎯 当前可见范围: ${visibleDuration.value.toFixed(1)}秒`)
    }

    zoomLevel.value = clampedZoom

    // 调整滚动偏移量以保持在有效范围内
    const maxOffset = getMaxScrollOffset(timelineWidth)
    scrollOffset.value = Math.max(0, Math.min(scrollOffset.value, maxOffset))
  }

  function setScrollOffset(newOffset: number, timelineWidth: number = 800) {
    const maxOffset = getMaxScrollOffset(timelineWidth)
    scrollOffset.value = Math.max(0, Math.min(newOffset, maxOffset))
  }

  function zoomIn(factor: number = 1.2, timelineWidth: number = 800) {
    setZoomLevel(zoomLevel.value * factor, timelineWidth)
  }

  function zoomOut(factor: number = 1.2, timelineWidth: number = 800) {
    setZoomLevel(zoomLevel.value / factor, timelineWidth)

    // 当缩小时间轴时，确保基础时间轴长度足够大以显示更多刻度线
    const pixelsPerSecond = (timelineWidth * zoomLevel.value) / totalDuration.value
    const visibleDuration = timelineWidth / pixelsPerSecond

    // 如果可见时间范围超过当前时间轴长度，扩展时间轴
    if (visibleDuration > timelineDuration.value) {
      timelineDuration.value = Math.max(visibleDuration * 1.5, timelineDuration.value)
    }
  }

  function scrollLeft(amount: number = 50, timelineWidth: number = 800) {
    setScrollOffset(scrollOffset.value - amount, timelineWidth)
  }

  function scrollRight(amount: number = 50, timelineWidth: number = 800) {
    setScrollOffset(scrollOffset.value + amount, timelineWidth)
  }

  // 计算用于刻度线显示的虚拟时间轴长度
  function getVirtualTimelineDuration(timelineWidth: number): number {
    // 当缩小时间轴时，计算可见范围的结束时间
    const pixelsPerSecond = (timelineWidth * zoomLevel.value) / totalDuration.value
    const visibleEndTime = scrollOffset.value / pixelsPerSecond + (timelineWidth / pixelsPerSecond)

    // 返回当前内容长度和可见范围结束时间的较大值，确保刻度线能够扩展
    return Math.max(totalDuration.value, visibleEndTime + 60) // 额外添加60秒缓冲
  }

  // 将时间转换为像素位置（考虑缩放和滚动）
  function timeToPixel(time: number, timelineWidth: number): number {
    const pixelsPerSecond = (timelineWidth * zoomLevel.value) / totalDuration.value
    return (time * pixelsPerSecond) - scrollOffset.value
  }

  // 将像素位置转换为时间（考虑缩放和滚动）
  function pixelToTime(pixel: number, timelineWidth: number): number {
    const pixelsPerSecond = (timelineWidth * zoomLevel.value) / totalDuration.value
    return (pixel + scrollOffset.value) / pixelsPerSecond
  }

  // 专门用于刻度线计算的时间到像素转换（使用虚拟时间轴长度）
  function timeToPixelForScale(time: number, timelineWidth: number): number {
    const virtualDuration = getVirtualTimelineDuration(timelineWidth)
    const pixelsPerSecond = (timelineWidth * zoomLevel.value) / virtualDuration
    return (time * pixelsPerSecond) - scrollOffset.value
  }

  // 更新片段名称
  function updateClipName(clipId: string, newName: string) {
    const clip = clips.value.find(c => c.id === clipId)
    if (clip) {
      clip.name = newName
    }
  }

  // 设置视频分辨率
  function setVideoResolution(resolution: VideoResolution) {
    videoResolution.value = resolution
    console.log('视频分辨率已设置为:', resolution)
  }

  // 更新片段播放速度
  function updateClipPlaybackRate(clipId: string, newRate: number) {
    const clip = clips.value.find(c => c.id === clipId)
    if (clip) {
      // 确保播放速度在合理范围内（扩展到0.1-100倍）
      const clampedRate = Math.max(0.1, Math.min(100, newRate))
      clip.playbackRate = clampedRate
      // 根据新的播放速度重新计算时间轴显示时长
      clip.duration = clip.originalDuration / clampedRate
    }
  }

  // 更新片段变换属性
  function updateClipTransform(clipId: string, transform: Partial<VideoTransform>) {
    const clip = clips.value.find(c => c.id === clipId)
    if (clip) {
      clip.transform = { ...clip.transform, ...transform }
    }
  }

  // 更新片段层级
  function updateClipZIndex(clipId: string, zIndex: number) {
    const clip = clips.value.find(c => c.id === clipId)
    if (clip) {
      clip.zIndex = zIndex
    }
  }

  return {
    clips,
    tracks,
    currentTime,
    isPlaying,
    timelineDuration,
    currentClip,
    totalDuration,
    contentEndTime,
    playbackRate,
    selectedClipId,
    // 音量状态
    volume,
    isMuted,
    // 缩放和滚动状态
    zoomLevel,
    scrollOffset,
    frameRate,
    minZoomLevel,
    visibleDuration,
    maxVisibleDuration,
    getMaxZoomLevel,
    getMaxScrollOffset,
    // 原有方法
    addClip,
    removeClip,
    updateClipPosition,
    updateClipDuration,
    updateClipName,
    updateClipPlaybackRate,
    updateClipTransform,
    updateClipZIndex,
    selectClip,
    splitClipAtTime,
    getClipAtTime,
    setCurrentTime,
    play,
    pause,
    stop,
    setPlaybackRate,
    // 音量控制方法
    setVolume,
    toggleMute,
    mute,
    unmute,
    previousFrame,
    nextFrame,
    startTimeUpdate,
    stopTimeUpdate,
    isOverlapping,
    getOverlappingClips,
    autoArrangeClips,
    // 轨道管理方法
    addTrack,
    removeTrack,
    toggleTrackVisibility,
    toggleTrackMute,
    renameTrack,
    // 缩放和滚动方法
    setZoomLevel,
    setScrollOffset,
    zoomIn,
    zoomOut,
    scrollLeft,
    scrollRight,
    timeToPixel,
    pixelToTime,
    alignTimeToFrame,
    expandTimelineIfNeeded,
    getVirtualTimelineDuration,
    timeToPixelForScale,
    // 分辨率相关
    videoResolution,
    setVideoResolution
  }
})

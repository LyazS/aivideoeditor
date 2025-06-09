import type { VideoClip } from '@/stores/counter'
import type { CanvasTransform } from '@/types/video'

export class MultiTrackVideoRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private videoElements: Map<string, HTMLVideoElement> = new Map()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas')
    }
    this.ctx = ctx
  }

  // 设置视频元素
  setVideoElement(clipId: string, videoElement: HTMLVideoElement | null) {
    if (videoElement) {
      this.videoElements.set(clipId, videoElement)
    } else {
      this.videoElements.delete(clipId)
    }
  }

  // 清空画布
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    // 填充黑色背景
    this.ctx.fillStyle = '#000000'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // 添加调试信息 - 绘制一个小的测试矩形
    this.ctx.fillStyle = '#ff0000'
    this.ctx.fillRect(10, 10, 50, 30)
    this.ctx.fillStyle = '#ffffff'
    this.ctx.font = '12px Arial'
    this.ctx.fillText('Canvas OK', 15, 28)
  }

  // 检查片段是否在当前时间活跃
  private isClipActive(clip: VideoClip, currentTime: number): boolean {
    return currentTime >= clip.timelinePosition && 
           currentTime < clip.timelinePosition + clip.duration
  }

  // 计算片段在视频中的当前时间
  private getClipVideoTime(clip: VideoClip, currentTime: number): number {
    const clipRelativeTime = currentTime - clip.timelinePosition
    return clip.startTime + clipRelativeTime * (clip.playbackRate || 1)
  }

  // 渲染单个视频片段
  private drawVideoClip(video: HTMLVideoElement, clip: VideoClip, currentTime: number) {
    if (!video || video.readyState < 2) {
      if (!this.warnedNotReady.has(clip.id)) {
        console.warn('Video not ready for clip:', clip.id, 'readyState:', video.readyState)
        this.warnedNotReady.add(clip.id)
      }
      return
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      if (!this.warnedZeroDimensions.has(clip.id)) {
        console.warn('Video dimensions are zero for clip:', clip.id)
        this.warnedZeroDimensions.add(clip.id)
      }
      return
    }

    // 只在第一次成功渲染时输出调试信息
    if (!this.successfullyRendered.has(clip.id)) {
      console.log('Successfully rendering video clip:', {
        clipId: clip.id,
        videoReady: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        canvasSize: { width: this.canvas.width, height: this.canvas.height }
      })
      this.successfullyRendered.add(clip.id)
    }

    const { transform } = clip
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2

    // 保存当前状态
    this.ctx.save()

    // 设置透明度
    this.ctx.globalAlpha = transform.opacity

    // 移动到画布中心
    this.ctx.translate(centerX, centerY)

    // 应用位置偏移
    this.ctx.translate(transform.x, transform.y)

    // 应用旋转
    this.ctx.rotate((transform.rotation * Math.PI) / 180)

    // 简化尺寸计算，使用固定比例
    const scale = Math.min(
      (this.canvas.width * 0.8) / video.videoWidth,
      (this.canvas.height * 0.8) / video.videoHeight
    )

    const drawWidth = video.videoWidth * scale * transform.scaleX
    const drawHeight = video.videoHeight * scale * transform.scaleY

    // 移除频繁的调试输出

    // 绘制视频（以中心为原点）
    this.ctx.drawImage(
      video,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    )

    // 恢复状态
    this.ctx.restore()
  }

  // 渲染多轨道视频帧
  drawMultiTrackFrame(clips: VideoClip[], currentTime: number) {
    // 获取当前时间活跃的片段
    const activeClips = clips.filter(clip => this.isClipActive(clip, currentTime))

    // 只在片段数量变化时输出调试信息
    if (this.lastActiveClipsCount !== activeClips.length) {
      console.log('Active clips changed:', {
        totalClips: clips.length,
        activeClips: activeClips.length,
        currentTime,
        videoElementsCount: this.videoElements.size
      })
      this.lastActiveClipsCount = activeClips.length
    }

    // 检查是否需要重新渲染
    const needsRedraw = this.shouldRedraw(activeClips, currentTime)
    if (!needsRedraw) {
      return
    }

    // 清除画布
    this.clear()

    // 按zIndex排序，从低到高渲染
    const sortedClips = activeClips.sort((a, b) => a.zIndex - b.zIndex)

    for (const clip of sortedClips) {
      const video = this.videoElements.get(clip.id)
      if (!video) {
        // 只在第一次缺失时警告
        if (!this.warnedClips.has(clip.id)) {
          console.warn('No video element for clip:', clip.id)
          this.warnedClips.add(clip.id)
        }
        continue
      }

      // 同步视频时间 - 使用更智能的同步策略
      this.syncVideoTime(video, clip, currentTime)

      // 渲染视频片段
      this.drawVideoClip(video, clip, currentTime)
    }

    // 更新最后渲染状态
    this.lastRenderTime = currentTime
    this.lastActiveClips = activeClips.map(c => c.id)
  }

  private lastActiveClipsCount = -1
  private warnedClips = new Set<string>()
  private warnedNotReady = new Set<string>()
  private warnedZeroDimensions = new Set<string>()
  private successfullyRendered = new Set<string>()
  private lastRenderTime = -1
  private lastActiveClips: string[] = []
  private videoTimeCache = new Map<string, number>()

  // 检查是否需要重新渲染
  private shouldRedraw(activeClips: VideoClip[], currentTime: number): boolean {
    // 时间变化超过阈值
    if (Math.abs(currentTime - this.lastRenderTime) > 0.033) { // ~30fps
      return true
    }

    // 活跃片段发生变化
    const currentClipIds = activeClips.map(c => c.id)
    if (currentClipIds.length !== this.lastActiveClips.length ||
        !currentClipIds.every(id => this.lastActiveClips.includes(id))) {
      return true
    }

    return false
  }

  // 智能视频时间同步
  private syncVideoTime(video: HTMLVideoElement, clip: VideoClip, currentTime: number) {
    const videoTime = this.getClipVideoTime(clip, currentTime)
    const cachedTime = this.videoTimeCache.get(clip.id)

    // 只在时间差异较大时才更新
    if (cachedTime === undefined || Math.abs(video.currentTime - videoTime) > 0.1) {
      video.currentTime = videoTime
      this.videoTimeCache.set(clip.id, videoTime)
    }
  }

  // 调整画布尺寸
  resize(width: number, height: number) {
    this.canvas.width = width
    this.canvas.height = height
  }

  // 销毁渲染器
  destroy() {
    this.videoElements.clear()
  }
}
